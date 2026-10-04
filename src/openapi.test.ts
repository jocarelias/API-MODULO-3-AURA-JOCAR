import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpenApi } from './openapi';
import { ROUTE_ACCESS } from './modules/schedules-assessments/infrastructure/auth/routeAccess';

interface MediaType {
  schema?: Record<string, unknown>;
  example?: unknown;
}

interface Operation {
  operationId?: string;
  summary?: string;
  tags?: string[];
  parameters?: Array<Record<string, unknown>>;
  requestBody?: { content?: Record<string, { schema?: Record<string, unknown>; example?: unknown }> };
  responses?: Record<string, { description?: string; content?: Record<string, MediaType> }>;
  security?: unknown;
}

const spec = buildOpenApi() as {
  openapi: string;
  info: { title: string; version: string };
  components: {
    securitySchemes: Record<string, { type: string; scheme?: string; bearerFormat?: string }>;
    schemas: Record<string, Record<string, unknown>>;
  };
  paths: Record<string, Record<string, Operation>>;
};

const HTTP_METHODS = ['get', 'post', 'patch', 'delete', 'put'] as const;
const operations = Object.entries(spec.paths).flatMap(([path, item]) =>
  HTTP_METHODS.filter((m) => item[m]).map((method) => ({ path, method, op: item[method] as Operation })),
);
const protectedOperations = operations.filter(({ path }) => !path.includes('/auth/login') && !path.includes('/auth/refresh'));
const listOperations = operations.filter(({ op }) => op.responses?.['200'] !== undefined && Array.isArray(((op.responses?.['200']?.content?.['application/json']?.schema as { properties?: Record<string, { type?: string }> } | undefined)?.properties?.data as { type?: string } | undefined)?.type === 'array'));

describe('OpenAPI — estrutura do documento', () => {
  it('é OpenAPI 3.0.0 com título e versão', () => {
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info.title).toBeTruthy();
    expect(spec.info.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('declara BearerAuth como esquema de segurança e como default global', () => {
    expect(spec.components.securitySchemes.BearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect((spec as { security?: unknown }).security).toEqual([{ BearerAuth: [] }]);
  });

  it('as rotas públicas dispensam explicitamente o Bearer e nenhuma rota protegida o faz', () => {
    for (const { path, method, op } of operations) {
      const where = `${method.toUpperCase()} ${path}`;
      const isPublic = where === 'POST /api/v1/auth/login' || where === 'POST /api/v1/auth/refresh';
      if (isPublic) {
        expect(op.security, `${where} devia declarar security: []`).toEqual([]);
      } else {
        expect(op.security, `${where} é protegida e não pode dispensar o token`).not.toEqual([]);
      }
    }
  });

  it('dá operationId, summary e tags a todas as operações', () => {
    for (const { path, method, op } of operations) {
      const where = `${method.toUpperCase()} ${path}`;
      expect(op.operationId, `${where} sem operationId`).toBeTruthy();
      expect(op.summary, `${where} sem summary`).toBeTruthy();
      expect(op.tags?.length, `${where} sem tags`).toBeGreaterThan(0);
    }
  });

  it('tem operationIds únicos', () => {
    const ids = operations.map(({ op }) => op.operationId as string);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('usa o prefixo /api/v1 em todos os caminhos', () => {
    for (const { path } of operations) expect(path).toMatch(/^\/api\/v1\//);
  });

  it('documenta um pathParam para cada {param} do caminho', () => {
    for (const { path, op } of operations) {
      const declared = (op.parameters ?? []).filter((p) => p.in === 'path').map((p) => p.name);
      for (const m of path.matchAll(/\{(\w+)\}/g)) {
        expect(declared, `${path} não declara o pathParam ${m[1]}`).toContain(m[1]);
      }
      for (const p of op.parameters ?? []) {
        if (p.in === 'path') expect(path, `${p.name} declarado mas não existe em ${path}`).toContain(`{${String(p.name)}}`);
      }
    }
  });

  it('marca todos os pathParams como required', () => {
    for (const { op } of operations) {
      for (const p of op.parameters ?? []) {
        if (p.in === 'path') expect(p.required, `pathParam ${String(p.name)} sem required`).toBe(true);
      }
    }
  });
});

describe('OpenAPI — exemplos realistas', () => {
  it('todas as respostas 200/201 de coleções trazem exemplo de lista paginada', () => {
    for (const { path, method, op } of listOperations) {
      const where = `${method.toUpperCase()} ${path}`;
      for (const code of ['200', '201']) {
        const response = op.responses?.[code];
        if (!response) continue;
        const media = response.content?.['application/json'];
        expect(media?.example, `${where} resposta ${code} sem exemplo`).toBeDefined();
        const example = media?.example as { data?: unknown[]; meta?: Record<string, unknown> };
        expect(Array.isArray(example.data), `${where} resposta ${code}: data do exemplo não é lista`).toBe(true);
        expect(example.meta, `${where} resposta ${code}: exemplo sem meta`).toMatchObject({
          page: expect.any(Number),
          pageSize: expect.any(Number),
          total: expect.any(Number),
        });
      }
    }
  });

  it('todas as respostas 200/201 trazem exemplo com envelope { data, meta }', () => {
    for (const { path, method, op } of operations) {
      for (const code of ['200', '201']) {
        const response = op.responses?.[code];
        if (!response) continue;
        const where = `${method.toUpperCase()} ${path} ${code}`;
        const example = response.content?.['application/json']?.example as Record<string, unknown> | undefined;
        expect(example, `${where} sem exemplo`).toBeDefined();
        expect(Object.keys(example as object).sort(), `${where}: envelope inesperado`).toEqual(['data', 'meta']);
        expect((example as { meta: Record<string, unknown> }).meta.correlationId, `${where}: exemplo sem correlationId`).toBeTruthy();
      }
    }
  });

  it('os exemplos de coleções não são listas vazias (dados realistas)', () => {
    for (const { path, method, op } of listOperations) {
      const example = op.responses?.['200']?.content?.['application/json']?.example as { data?: unknown[] } | undefined;
      expect(example?.data?.length, `${method.toUpperCase()} ${path}: exemplo de lista vazio`).toBeGreaterThan(0);
    }
  });

  it('os exemplos de erro trazem code, message e correlationId', () => {
    for (const { path, method, op } of operations) {
      for (const [code, response] of Object.entries(op.responses ?? {})) {
        if (code === '200' || code === '201') continue;
        const example = response.content?.['application/json']?.example as Record<string, unknown> | undefined;
        const where = `${method.toUpperCase()} ${path} ${code}`;
        expect(example, `${where} sem exemplo de erro`).toBeDefined();
        expect(example?.code, `${where}: exemplo sem code`).toBeTruthy();
        expect(example?.message, `${where}: exemplo sem message`).toBeTruthy();
        expect(example?.correlationId, `${where}: exemplo sem correlationId`).toBeTruthy();
      }
    }
  });

  it('os exemplos usam datas ISO e UUIDs válidos', () => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const dateRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (node === null || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (key === 'id' && typeof value === 'string') expect(value, `id inválido: ${value}`).toMatch(uuidRe);
        if (key.endsWith('At') && typeof value === 'string') expect(value, `data inválida: ${value}`).toMatch(dateRe);
        walk(value);
      }
    };
    for (const { op } of operations) {
      for (const code of ['200', '201']) {
        walk(op.responses?.[code]?.content?.['application/json']?.example);
      }
    }
  });
});

describe('OpenAPI — códigos de erro', () => {
  it('toda rota protegida documenta 400, 401, 403, 404 e 500', () => {
    for (const { path, method, op } of protectedOperations) {
      const where = `${method.toUpperCase()} ${path}`;
      for (const code of ['400', '401', '403', '404', '500']) {
        expect(op.responses?.[code], `${where} não documenta ${code}`).toBeDefined();
        expect(op.responses?.[code]?.description, `${where} ${code} sem descrição`).toBeTruthy();
      }
    }
  });

  it('o login documenta 400 e 401 mas não 403 (rota pública)', () => {
    const login = spec.paths['/api/v1/auth/login'].post as Operation;
    expect(login.responses?.['400']).toBeDefined();
    expect(login.responses?.['401']).toBeDefined();
    expect(login.responses?.['403']).toBeUndefined();
  });

  it('as leituras sensíveis ao financeiro documentam 503 com fail-closed', () => {
    const with503 = operations
      .filter(({ op }) => op.responses?.['503'] !== undefined)
      .map(({ path, method }) => `${method.toUpperCase()} ${path}`.replace(/\/api\/v1/, ''));
    expect(with503).toEqual(
      expect.arrayContaining([
        'GET /assessments/{assessmentId}/grades',
        'GET /results',
        'GET /me/financial-status',
      ]),
    );
    for (const { path, method, op } of operations.filter(({ op: o }) => o.responses?.['503'] !== undefined)) {
      const where = `${method.toUpperCase()} ${path}`;
      const example = op.responses?.['503']?.content?.['application/json']?.example as { code?: string } | undefined;
      expect(example?.code, `${where} documenta 503 mas sem exemplo com código`).toBe('FINANCIAL_VERIFICATION_UNAVAILABLE');
      expect(op.responses?.['503']?.description, `${where} documenta 503 mas a descrição não menciona fail-closed`).toMatch(/fechad/i);
    }
  });

  it('toda descrição que promete 503 documenta-o de facto', () => {
    for (const { path, method, op } of operations) {
      if (!op.description?.includes('503')) continue;
      expect(op.responses?.['503'], `${method.toUpperCase()} ${path} promete 503 na descrição mas não o documenta`).toBeDefined();
    }
  });

  it('os exemplos de 403 distinguem FORBIDDEN de FINANCIAL_ACCESS_BLOCKED', () => {
    const plain = spec.paths['/api/v1/assessments/{id}'].patch?.responses?.['403']?.content?.['application/json']?.example as { code?: string };
    expect(plain?.code).toBe('FORBIDDEN');

    const grades = spec.paths['/api/v1/assessments/{assessmentId}/grades'].get?.responses?.['403']?.content?.['application/json']?.example as { code?: string };
    expect(grades?.code).toBe('FINANCIAL_ACCESS_BLOCKED');
  });
});

describe('OpenAPI — coerência com o código (fonte de verdade partilhada)', () => {
  it('documenta exactamente as rotas registadas em ROUTE_ACCESS', () => {
    // O router Express usa :id; o OpenAPI usa {id}. Normaliza-se para comparar.
    const toOpenApiPath = (path: string): string => `/api/v1${path}`.replace(/:(\w+)/g, '{$1}');
    const fromCode = ROUTE_ACCESS.map((rule) => `${rule.method} ${toOpenApiPath(rule.path)}`).sort();
    const fromSpec = operations
      .filter(({ path }) => !path.includes('/auth/login') && !path.includes('/auth/refresh'))
      .map(({ path, method }) => `${method.toUpperCase()} ${path}`)
      .sort();
    expect(fromSpec).toEqual(fromCode);
  });

  it('mantém o pathParam :id do código como {id} no OpenAPI', () => {
    const byId = spec.paths['/api/v1/assessments/{id}'];
    expect(byId).toBeDefined();
    expect(byId?.get).toBeDefined();
    expect(byId?.patch).toBeDefined();
    expect(byId?.delete).toBeDefined();
  });

  it('documenta exatamente as operações que o router implementa (nenhum path a mais)', () => {
    // Todas as rotas do router de G3 estão em ROUTE_ACCESS; a comparação acima
    // garante que o spec não inventa nem omite rotas. Este teste fixa o total
    // para detectar alterações acidentais de âmbito.
    expect(operations.length).toBe(ROUTE_ACCESS.length + 2);
  });
});

describe('OpenAPI — docs/openapi.yaml é gerado a partir do código', () => {
  const onDisk = readFileSync(resolve(process.cwd(), 'docs/openapi.yaml'), 'utf8');

  it('o ficheiro publicado existe e avisa que é gerado', () => {
    expect(onDisk).toContain('GERADO AUTOMATICAMENTE');
    expect(onDisk).toContain('npm run docs:openapi');
  });

  it('contém todas as rotas e todos os exemplos presentes no spec', () => {
    for (const { path, method } of operations) {
      expect(onDisk, `falta ${method.toUpperCase()} ${path}`).toContain(path);
    }
    for (const marker of ['Teste 1 — Programação Paralela', 'FINANCIAL_ACCESS_BLOCKED', 'Abu Bakar Ossum', 'correlationId']) {
      expect(onDisk, `falta o marcador ${marker}`).toContain(marker);
    }
  });

  it('está sincronizado byte a byte com buildOpenApi() (se falhar, correr npm run docs:openapi)', () => {
    const { dump } = require('js-yaml') as { dump: (input: unknown, opts: unknown) => string };
    const HEADER = onDisk.slice(0, onDisk.indexOf('openapi: 3.0.0'));
    const expected = HEADER + dump(buildOpenApi(), { indent: 2, lineWidth: 120, noRefs: true, sortKeys: false, quotingType: '"', forceQuotes: false });
    expect(onDisk).toBe(expected);
  });
});
