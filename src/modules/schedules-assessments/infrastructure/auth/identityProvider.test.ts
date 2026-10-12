import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../application/schedulesAssessmentsService';
import {
  CoreIdentityProvider,
  LocalIdentityProvider,
  createIdentityProvider,
  createTokenVerifier,
  identityConfig,
  resolveTokenStrategy,
  type IdentityConfig,
} from './identityProvider';

/**
 * Fornecedor de identidade: modo standalone (o G3 é dono do login) e modo core
 * (o login é delegado ao Core e o G3 só valida tokens e perfis).
 *
 * Estes testes cobrem o caminho de autenticação do Módulo V com um Core falso
 * levantado em memória — não interessa testar o Core, interessa testar que o G3
 * fala com ele correctamente e que falha de forma previsível quando ele não
 * responde.
 */

interface CoreReply {
  status: number;
  body: unknown;
}

interface RecordedCall {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

let server: Server;
let baseUrl: string;
let calls: RecordedCall[];
let replies: Map<string, CoreReply>;
let prisma: PrismaClient;

const CATCH_ALL = () => ({ status: 404, body: { code: 'NOT_FOUND', message: 'sem rota' } });

function replyFor(call: RecordedCall): CoreReply {
  for (const [key, reply] of replies) {
    const [method, pathPattern] = key.split(' ');
    if (method === call.method && matches(pathPattern, call.path)) return reply;
  }
  return CATCH_ALL();
}

function matches(pattern: string, actual: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z]+/g, '[^/]+');
  return new RegExp(`^${escaped}$`).test(actual);
}

function core(overrides: Partial<IdentityConfig> = {}): CoreIdentityProvider {
  return new CoreIdentityProvider({
    mode: 'core',
    coreAuthUrl: baseUrl,
    timeoutMs: 2000,
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
    ...readConfigDefaults(),
    ...overrides,
  });
}

function readConfigDefaults(): Partial<IdentityConfig> {
  return { serviceToken: undefined };
}

const ctx = { correlationId: 'corr-1' };

beforeAll(async () => {
  prisma = new PrismaClient();
  calls = [];
  replies = new Map();

  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk as Buffer));
    req.on('end', () => {
      const call: RecordedCall = {
        method: req.method as string,
        path: req.url as string,
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      };
      calls.push(call);
      const reply = replyFor(call);
      res.writeHead(reply.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(reply.body));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

function reset(): void {
  calls = [];
  replies = new Map();
}

describe('selecção do fornecedor de identidade', () => {
  it('standalone é o padrão quando AUTH_MODE não está definido', () => {
    const previous = process.env.AUTH_MODE;
    delete process.env.AUTH_MODE;
    expect(identityConfig().mode).toBe('standalone');
    if (previous !== undefined) process.env.AUTH_MODE = previous;
  });

  it('reconhece "core" em qualquer grafia e ignora valores desconhecidos', () => {
    const previous = process.env.AUTH_MODE;
    process.env.AUTH_MODE = 'CORE';
    expect(identityConfig().mode).toBe('core');
    process.env.AUTH_MODE = 'qualquer-coisa';
    expect(identityConfig().mode).toBe('standalone');
    if (previous !== undefined) process.env.AUTH_MODE = previous;
  });

  it('createIdentityProvider devolve o provider correspondente a cada modo', () => {
    const standalone = createIdentityProvider({ mode: 'standalone', timeoutMs: 100 });
    expect(standalone.mode).toBe('standalone');
    expect(standalone.ownsAuthRoutes).toBe(true);

    const delegated = createIdentityProvider({ mode: 'core', timeoutMs: 100 });
    expect(delegated.mode).toBe('core');
    expect(delegated.ownsAuthRoutes).toBe(false);
  });

  it('JWKS quando há CORE_JWKS_URI, HMAC caso contrário', () => {
    expect(resolveTokenStrategy({ mode: 'core', timeoutMs: 100, coreJwksUri: 'https://core/jwks' })).toBe('jwks');
    expect(resolveTokenStrategy({ mode: 'core', timeoutMs: 100 })).toBe('hmac');
  });

  it('usa o verificador JWKS quando o Core publica as chaves públicas', () => {
    const verify = createTokenVerifier({
      mode: 'core',
      timeoutMs: 100,
      coreJwksUri: 'https://core.invalido/jwks.json',
      coreIssuer: 'https://core',
      coreAudience: 'g3',
    });
    expect(typeof verify).toBe('function');
  });

  it('exige um segredo quando não há JWKS — falhar aqui é melhor do que aceitar tokens sem chave', () => {
    const saved = {
      access: process.env.JWT_ACCESS_SECRET,
      shared: process.env.SMARTCAMPUS_JWT_SECRET,
      core: process.env.CORE_JWT_SECRET,
    };
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.SMARTCAMPUS_JWT_SECRET;
    delete process.env.CORE_JWT_SECRET;
    try {
      expect(() => createTokenVerifier({ mode: 'standalone', timeoutMs: 100 })).toThrow(/JWT_ACCESS_SECRET/);
    } finally {
      if (saved.access !== undefined) process.env.JWT_ACCESS_SECRET = saved.access;
      if (saved.shared !== undefined) process.env.SMARTCAMPUS_JWT_SECRET = saved.shared;
      if (saved.core !== undefined) process.env.CORE_JWT_SECRET = saved.core;
    }
  });
});

describe('LocalIdentityProvider (modo standalone)', () => {
  const provider = new LocalIdentityProvider();

  it('carrega o utilizador da base de dados com id, role, escola e estado', async () => {
    const user = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
    expect(user).not.toBeNull();
    const loaded = await provider.loadUser((user as { id: string }).id);
    expect(loaded).toEqual({ id: user?.id, role: user?.role, schoolId: user?.schoolId, status: 'ACTIVE' });
  });

  it('devolve null para um utilizador que não existe', async () => {
    expect(await provider.loadUser('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('recusa login/refresh/logout: em standalone quem serve essas rotas é o AuthService', async () => {
    await expect(provider.login()).rejects.toBeInstanceOf(DomainError);
    await expect(provider.refresh()).rejects.toBeInstanceOf(DomainError);
    await expect(provider.logout()).rejects.toBeInstanceOf(DomainError);
  });

  it('assertHealthy confirma que a base de dados responde', async () => {
    await expect(provider.assertHealthy()).resolves.toBeUndefined();
  });
});

describe('CoreIdentityProvider — delegação de login/refresh/logout', () => {
  it('login envia as credenciais ao Core e devolve o que ele responder', async () => {
    reset();
    replies.set('POST /api/v1/auth/login', {
      status: 200,
      body: { data: { accessToken: 'a', refreshToken: 'r', user: { id: 'u1' } } },
    });

    const result = await core().login({ email: 'aluno@ujac.ac.mz', password: 'segredo' }, ctx);
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r', user: { id: 'u1' } });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(JSON.parse(calls[0].body)).toEqual({ email: 'aluno@ujac.ac.mz', password: 'segredo' });
  });

  it('propaga o correlationId em x-correlation-id e x-request-id (rastreio ponta a ponta)', async () => {
    reset();
    replies.set('POST /api/v1/auth/login', { status: 200, body: { data: { ok: true } } });
    await core().login({ email: 'a@b.mz', password: 'x' }, { correlationId: 'corr-abc-123' });
    expect(calls[0].headers['x-correlation-id']).toBe('corr-abc-123');
    expect(calls[0].headers['x-request-id']).toBe('corr-abc-123');
    expect(calls[0].headers['content-type']).toBe('application/json');
  });

  it('refresh envia o refreshToken e logout envia também o userId do próprio utilizador', async () => {
    reset();
    replies.set('POST /api/v1/auth/refresh', { status: 200, body: { data: { accessToken: 'novo' } } });
    replies.set('POST /api/v1/auth/logout', { status: 200, body: { data: { revoked: true } } });

    await core().refresh('rt-123', ctx);
    await core().logout('rt-123', 'u1', ctx);

    expect(JSON.parse(calls[0].body)).toEqual({ refreshToken: 'rt-123' });
    expect(JSON.parse(calls[1].body)).toEqual({ refreshToken: 'rt-123', userId: 'u1' });
  });

  it('repassa o erro do Core com o mesmo código e mensagem (401 do Core continua 401)', async () => {
    reset();
    replies.set('POST /api/v1/auth/login', {
      status: 401,
      body: { code: 'UNAUTHENTICATED', message: 'Credenciais inválidas' },
    });

    await expect(core().login({ email: 'a@b.mz', password: 'errada' }, ctx)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Credenciais inválidas',
      httpStatus: 401,
    });
  });

  it('404 do Core propaga-se como 404 e 5xx do Core como 502 (o Core não é o nosso cliente HTTP)', async () => {
    reset();
    replies.set('POST /api/v1/auth/login', { status: 404, body: { code: 'NOT_FOUND', message: 'rota ausente' } });
    await expect(core().login({ email: 'a@b.mz', password: 'x' }, ctx)).rejects.toMatchObject({ httpStatus: 404 });

    reset();
    replies.set('POST /api/v1/auth/login', { status: 503, body: null });
    await expect(core().login({ email: 'a@b.mz', password: 'x' }, ctx)).rejects.toMatchObject({ httpStatus: 502 });
  });

  it('401 sem corpo JSON continua a ser 401 UNAUTHENTICATED (o corpo não é fiado)', async () => {
    reset();
    replies.set('POST /api/v1/auth/login', { status: 401, body: undefined });
    await expect(core().login({ email: 'a@b.mz', password: 'x' }, ctx)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      httpStatus: 401,
    });
  });

  it('Core indisponível dá UPSTREAM_UNAVAILABLE — nunca um 500 opaco', async () => {
    const provider = core({ coreAuthUrl: 'http://127.0.0.1:1', timeoutMs: 300 });
    await expect(provider.login({ email: 'a@b.mz', password: 'x' }, ctx)).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });
  });

  it('sem CORE_AUTH_URL o modo core recusa a delegar em vez de adivinhar', async () => {
    const provider = core({ coreAuthUrl: undefined });
    await expect(provider.login({ email: 'a@b.mz', password: 'x' }, ctx)).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      message: expect.stringContaining('CORE_AUTH_URL'),
    });
  });
});

describe('CoreIdentityProvider — carregamento de perfil (anti-BOLA server-side)', () => {
  it('devolve o perfil que o Core afirma e repassa o token do utilizador', async () => {
    reset();
    replies.set('GET /api/v1/users/:id', {
      status: 200,
      body: { data: { id: 'u-42', role: 'STUDENT', schoolId: 'esc-1', status: 'ACTIVE' } },
    });

    const loaded = await core().loadUser('u-42', { correlationId: 'c', token: 'jwt-do-utilizador' });
    expect(loaded).toEqual({ id: 'u-42', role: 'STUDENT', schoolId: 'esc-1', status: 'ACTIVE' });
    expect(calls[0].headers.authorization).toBe('Bearer jwt-do-utilizador');
  });

  it('404 no Core significa "utilizador não existe", não "erro" — devolve null', async () => {
    reset();
    expect(await core().loadUser('fantasma', ctx)).toBeNull();
  });

  it('um payload sem id é tratado como perfil inválido em vez de confiar no vazio', async () => {
    reset();
    replies.set('GET /api/v1/users/:id', { status: 200, body: { data: { role: 'STUDENT' } } });
    expect(await core().loadUser('u-1', ctx)).toBeNull();

    reset();
    replies.set('GET /api/v1/users/:id', { status: 200, body: {} });
    expect(await core().loadUser('u-1', ctx)).toBeNull();
  });

  it('completa os campos em falta com valores seguros em vez de os deixar undefined', async () => {
    reset();
    replies.set('GET /api/v1/users/:id', { status: 200, body: { data: { id: 'u-9', role: 'TEACHER' } } });
    const loaded = await core().loadUser('u-9', ctx);
    expect(loaded).toEqual({ id: 'u-9', role: 'TEACHER', schoolId: '', status: 'ACTIVE' });
  });

  it('erro do Core ao carregar o perfil propaga-se (o middleware transforma em 503)', async () => {
    reset();
    replies.set('GET /api/v1/users/:id', { status: 500, body: {} });
    await expect(core().loadUser('u-1', ctx)).rejects.toThrow(/500/);
  });

  it('sem CORE_AUTH_URL o perfil é lido da base local (o G3 não fica cego)', async () => {
    const user = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
    const loaded = await core({ coreAuthUrl: undefined }).loadUser((user as { id: string }).id, ctx);
    expect(loaded?.id).toBe(user?.id);
  });
});

describe('CoreIdentityProvider — health check', () => {
  it('confirmar quando o Core está de pé', async () => {
    reset();
    replies.set('GET /api/v1/health', { status: 200, body: { data: { status: 'ok' } } });
    await expect(core().assertHealthy()).resolves.toBeUndefined();
  });

  it('falhar com a mensagem do Core quando o health check responde com erro', async () => {
    reset();
    replies.set('GET /api/v1/health', { status: 503, body: {} });
    await expect(core().assertHealthy()).rejects.toThrow(/503/);
  });

  it('não chama o Core quando não há URL configurada', async () => {
    reset();
    await core({ coreAuthUrl: undefined }).assertHealthy();
    expect(calls).toHaveLength(0);
  });
});