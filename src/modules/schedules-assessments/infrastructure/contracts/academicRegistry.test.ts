import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../application/schedulesAssessmentsService';
import { AcademicRegistryClient, academicRegistryConfig } from './academicRegistry';

/**
 * Registo Académico remoto com degradação para o espelho local.
 *
 * A regra que interessa: quando o Registo remoto falha, o módulo nãoinventa
 * dados — ou degrada para a cópia local marcando `degraded: true` (para o
 * cliente saber que viu um espelho) ou, se a degradação estiver desligada,
 * propaga o erro. E nunca fica a martelar um serviço em baixo.
 */

let prisma: PrismaClient;
let schoolId: string;
let otherSchoolId: string;
let subjectId: string;

const remoteSubject = {
  id: 'subject-remoto',
  schoolId: 'escola-remota',
  name: 'Física (remota)',
  code: 'FIS',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stubFetch(handler: (url: string) => Response | Promise<Response>): typeof fetch {
  return (async (input: RequestInfo | URL) => handler(String(input))) as typeof fetch;
}

beforeAll(async () => {
  prisma = new PrismaClient();
  schoolId = (await prisma.user.findFirst({ where: { status: 'ACTIVE' } }))?.schoolId as string;
  otherSchoolId = schoolId;
  subjectId = (await prisma.subject.findFirst({ where: { schoolId } }))?.id as string;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('academicRegistryConfig', () => {
  it('lê a configuração do ambiente com valores por omissão seguros', () => {
    const saved = {
      url: process.env.ACADEMIC_REGISTRY_URL,
      timeout: process.env.ACADEMIC_REGISTRY_TIMEOUT_MS,
      fallback: process.env.ACADEMIC_REGISTRY_FALLBACK,
    };
    delete process.env.ACADEMIC_REGISTRY_URL;
    delete process.env.ACADEMIC_REGISTRY_TIMEOUT_MS;
    delete process.env.ACADEMIC_REGISTRY_FALLBACK;
    try {
      const config = academicRegistryConfig();
      expect(config.baseUrl).toBeUndefined();
      expect(config.timeoutMs).toBe(4000);
      expect(config.cacheTtlMs).toBe(60_000);
      expect(config.failureThreshold).toBe(5);
      expect(config.resetTimeoutMs).toBe(30_000);
      expect(config.fallbackToLocalMirror).toBe(true);
    } finally {
      restoreEnv(saved);
    }
  });

  it('descarta barras Inválidas nos números e remove a barra final da URL', () => {
    const saved = {
      url: process.env.ACADEMIC_REGISTRY_URL,
      timeout: process.env.ACADEMIC_REGISTRY_TIMEOUT_MS,
      threshold: process.env.ACADEMIC_REGISTRY_FAILURE_THRESHOLD,
    };
    process.env.ACADEMIC_REGISTRY_URL = 'http://registo.local/';
    process.env.ACADEMIC_REGISTRY_TIMEOUT_MS = 'lixo';
    process.env.ACADEMIC_REGISTRY_FAILURE_THRESHOLD = '-3';
    try {
      const config = academicRegistryConfig();
      expect(config.baseUrl).toBe('http://registo.local');
      expect(config.timeoutMs).toBe(4000);
      expect(config.failureThreshold).toBe(5);
    } finally {
      restoreEnv(saved);
    }
  });

  it('ACADEMIC_REGISTRY_FALLBACK=false desliga a degradação silenciosa', () => {
    const saved = process.env.ACADEMIC_REGISTRY_FALLBACK;
    process.env.ACADEMIC_REGISTRY_FALLBACK = 'FALSE';
    try {
      expect(academicRegistryConfig().fallbackToLocalMirror).toBe(false);
    } finally {
      restoreEnv({ ACADEMIC_REGISTRY_FALLBACK: saved });
    }
  });
});

describe('AcademicRegistryClient — desligado', () => {
  it('sem ACADEMIC_REGISTRY_URL lê do espelho local e marca os dados como degradados', async () => {
    const client = new AcademicRegistryClient({ baseUrl: undefined });
    expect(client.enabled).toBe(false);

    const result = await client.listSubjects({ schoolId });
    expect(result.source).toBe('local-mirror');
    expect(result.degraded).toBe(true);
    expect(result.items.every((item) => item.schoolId === schoolId)).toBe(true);
  });

  it('os filtros de escola e ano letivo são aplicados também no espelho local', async () => {
    const client = new AcademicRegistryClient({ baseUrl: undefined });
    const turmas = await client.listClasses({ schoolId: 'escola-que-nao-existe' });
    expect(turmas.items).toHaveLength(0);

    const termos = await client.listTerms({ schoolId, academicYearId: 'ano-que-nao-existe' });
    expect(termos.items).toHaveLength(0);

    const anos = await client.listAcademicYears({ schoolId });
    expect(anos.items.length).toBeGreaterThan(0);
  });

  it('assertSubjectExists passa para uma disciplina do espelho e falha para uma inventada', async () => {
    const client = new AcademicRegistryClient({ baseUrl: undefined });
    await expect(client.assertSubjectExists(subjectId)).resolves.toBeUndefined();
    await expect(client.assertSubjectExists('disciplina-inventada')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('AcademicRegistryClient — Registo remoto saudável', () => {
  it('mapeia a resposta remota para DTOs e serve o resultado como autoritativo', async () => {
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      fetchImpl: stubFetch(() => jsonResponse(200, { data: [remoteSubject] })),
    });
    expect(client.enabled).toBe(true);

    const result = await client.listSubjects({ schoolId: 'escola-remota' });
    expect(result.source).toBe('academic-registry');
    expect(result.degraded).toBe(false);
    expect(result.items).toEqual([remoteSubject]);
  });

  it('cacha o resultado: duas leituras fazem uma só chamada ao Registo', async () => {
    let calls = 0;
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      cacheTtlMs: 60_000,
      fetchImpl: stubFetch(() => {
        calls += 1;
        return jsonResponse(200, { data: [remoteSubject] });
      }),
    });

    await client.listSubjects();
    await client.listSubjects();
    expect(calls).toBe(1);

    client.invalidateCaches();
    await client.listSubjects();
    expect(calls).toBe(2);
  });

  it('cada catálogo tem a sua própria cache e o seu próprio endpoint', async () => {
    const urls: string[] = [];
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      fetchImpl: stubFetch((url) => {
        urls.push(url);
        return jsonResponse(200, { data: [] });
      }),
    });

    await client.listSubjects();
    await client.listAcademicYears();
    await client.listTerms();
    await client.listClasses();
    expect(urls).toEqual([
      'http://registo.local/api/v1/subjects',
      'http://registo.local/api/v1/academic-years',
      'http://registo.local/api/v1/terms',
      'http://registo.local/api/v1/classes',
    ]);
  });

  it('uma resposta sem lista de dados é tratada como lista vazia, não como erro', async () => {
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      fetchImpl: stubFetch(() => jsonResponse(200, {Unexpected: true})),
    });
    expect((await client.listSubjects()).items).toEqual([]);
  });

  it('o circuit breaker fecha enquanto o Registo responde bem', async () => {
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      fetchImpl: stubFetch(() => jsonResponse(200, { data: [remoteSubject] })),
    });
    await client.listSubjects();
    await client.listSubjects();
    expect(client.circuitState()).toBe('CLOSED');
  });
});

describe('AcademicRegistryClient — Registo remoto indisponível', () => {
  it('degrada para o espelho local em vez de falhar o pedido (e diz que degradou)', async () => {
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      fetchImpl: stubFetch(() => jsonResponse(500, {})),
    });

    const result = await client.listSubjects({ schoolId });
    expect(result.source).toBe('local-mirror');
    expect(result.degraded).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('tenta duas vezes antes de desistir (o erro pode ser transitório)', async () => {
    let calls = 0;
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      fallbackToLocalMirror: false,
      fetchImpl: stubFetch(() => {
        calls += 1;
        return jsonResponse(503, {});
      }),
    });

    await expect(client.listSubjects()).rejects.toBeInstanceOf(DomainError);
    expect(calls).toBe(2);
  });

  it('recupera no segundo attempt sem degradação', async () => {
    let calls = 0;
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      fetchImpl: stubFetch(() => {
        calls += 1;
        return calls === 1 ? jsonResponse(500, {}) : jsonResponse(200, { data: [remoteSubject] });
      }),
    });

    const result = await client.listSubjects({ schoolId: 'escola-remota' });
    expect(result.source).toBe('academic-registry');
    expect(result.degraded).toBe(false);
  });

  it('com a degradação desligada, um erro não-DomainError vira UPSTREAM_UNAVAILABLE', async () => {
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      fallbackToLocalMirror: false,
      fetchImpl: stubFetch(() => {
        throw new TypeError('fetch falhou');
      }),
    });

    await expect(client.listSubjects()).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      details: [{ service: 'academic-registry' }],
    });
  });

  it('com a degradação desligada, o DomainError do Registo propaga-se tal e qual', async () => {
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      fallbackToLocalMirror: false,
      fetchImpl: stubFetch(() => jsonResponse(500, {})),
    });
    await expect(client.listSubjects()).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
  });

  it('um erro de rede (fetch lança) degrada para o espelho quando o fallback está ligado', async () => {
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      fetchImpl: stubFetch(() => {
        throw new TypeError('ECONNREFUSED');
      }),
    });
    const result = await client.listSubjects({ schoolId });
    expect(result.source).toBe('local-mirror');
    expect(result.degraded).toBe(true);
  });

  it('abre o circuito ao atingir o limite de falhas e deixa de chamar o Registo', async () => {
    let calls = 0;
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      failureThreshold: 2,
      fallbackToLocalMirror: false,
      fetchImpl: stubFetch(() => {
        calls += 1;
        return jsonResponse(500, {});
      }),
    });

    await expect(client.listSubjects()).rejects.toBeInstanceOf(DomainError);
    await expect(client.listSubjects()).rejects.toBeInstanceOf(DomainError);
    expect(client.circuitState()).toBe('OPEN');

    const callsBeforeOpen = calls;
    // Com o circuito aberto e sem espelho local, a resposta é 503
    // UPSTREAM_UNAVAILABLE — nunca uma lista vazia, que pareceria "não há
    // disciplinas" e esconderia que o Registo está em baixo.
    await expect(client.listSubjects()).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      details: [{ service: 'academic-registry', circuit: 'academic-registry' }],
    });
    expect(calls).toBe(callsBeforeOpen);
  });

  it('com o circuito aberto e a degradação ligada, o fallback é o valor servido', async () => {
    let calls = 0;
    const client = new AcademicRegistryClient({
      baseUrl: 'http://registo.local',
      failureThreshold: 1,
      fallbackToLocalMirror: true,
      fetchImpl: stubFetch(() => {
        calls += 1;
        return jsonResponse(500, {});
      }),
    });

    await client.listSubjects({ schoolId });
    expect(client.circuitState()).toBe('OPEN');

    // Segundo pedido: o circuito recusa antes de tocar na rede, e o espelho
    // local é servido declarando a procedência certa.
    const callsBeforeOpen = calls;
    const result = await client.listSubjects({ schoolId });
    expect(result.source).toBe('local-mirror');
    expect(result.degraded).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    expect(calls).toBe(callsBeforeOpen);
  });
});

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}