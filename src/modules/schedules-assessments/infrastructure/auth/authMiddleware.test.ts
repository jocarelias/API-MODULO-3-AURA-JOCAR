import { describe, it, expect, beforeAll } from 'vitest';
import { Response, NextFunction } from 'express';
import { createAuthMiddleware, signToken, type AuthUserRecord, type TokenVerifier } from '@smartcampus/auth';
import { createG3Auth, createG3AuthMiddleware, requestContextOf } from './authMiddleware';
import { identityConfig, type IdentityConfig } from './identityProvider';

/**
 * Montagem do middleware de autenticação do G3.
 *
 * O que se testa aqui é a *ligação* entre as peças: o verificador de tokens, o
 * carregamento do perfil e o contexto que segue para os contratos a montante.
 * O middleware genérico em si (`@smartcampus/auth`) tem suite própria.
 */

interface FakeRequest {
  get(name: string): string | undefined;
  ip?: string;
  correlationId?: string;
  auth?: { token: string };
}

function fakeRequest(headers: Record<string, string> = {}, extra: Partial<FakeRequest> = {}): FakeRequest {
  return {
    get: (name: string) => headers[name.toLowerCase()],
    ip: '10.0.0.1',
    ...extra,
  };
}

/**
 * Verificador controlado: só aceita o token que espera. Servir qualquer token
 * não provaria nada — o middleware passaria a aceitar tokens forjados.
 */
function stubVerifier(expectedToken: string, claims: Partial<Record<string, unknown>>): TokenVerifier {
  return (async (token: string) => {
    if (token !== expectedToken) throw new Error('token inválido');
    return claims;
  }) as unknown as TokenVerifier;
}

const GOOD_TOKEN = 'token-valido';

const ACTIVE_USER: AuthUserRecord = {
  id: 'user-1',
  role: 'STUDENT',
  schoolId: 'escola-1',
  status: 'ACTIVE',
};

describe('requestContextOf', () => {
  it('reúne o que os contratos a montante precisam de propagate', () => {
    const ctx = requestContextOf({
      correlationId: 'corr-1',
      auth: { token: 'jwt-abc' },
      get: (name) => (name === 'user-agent' ? 'PostmanRuntime/7.0' : undefined),
      ip: '10.0.0.9',
    });

    expect(ctx).toEqual({
      correlationId: 'corr-1',
      token: 'jwt-abc',
      userAgent: 'PostmanRuntime/7.0',
      ipAddress: '10.0.0.9',
    });
  });

  it('nunca envia token undefined ao Core — um header "Bearer undefined" seria pior do que nenhum', () => {
    const ctx = requestContextOf({ correlationId: '', get: () => undefined });
    expect(ctx.token).toBeUndefined();
    expect('token' in ctx).toBe(true);
  });

  it('funciona antes de haver correlationId e sem user-agent (o contexto nunca deve rebentar um pedido)', () => {
    const ctx = requestContextOf({ get: () => undefined });
    expect(ctx.correlationId).toBe('');
    expect(ctx.userAgent).toBeUndefined();
  });
});

describe('createG3Auth', () => {
  it('monta as três peças: middleware, verificador e fornecedor de identidade', () => {
    const g3 = createG3Auth();
    expect(typeof g3.middleware).toBe('function');
    expect(typeof g3.verify).toBe('function');
    expect(g3.identity.mode).toBe('standalone');
  });

  it('o verificador aceita um token que ele próprio assinou e rejeita os forjados', () => {
    const g3 = createG3Auth();
    const token = signToken(
      { id: 'user-1', role: 'STUDENT', schoolId: 'escola-1' },
      process.env.JWT_ACCESS_SECRET ?? '',
      3600,
    );
    const claims = g3.verify(token);
    expect(claims.sub).toBe('user-1');
    expect(claims.role).toBe('STUDENT');

    expect(() => g3.verify('nao-e-um-token')).toThrow();

    // Assinatura alterada à mão, como manda o Passo 1 do guia. O carácter
    // trocado é a meio da terceira parte: o último pode não ter todos os bits
    // significativos em base64url e a assinatura continuaria válida.
    const [header, payload, signature] = token.split('.');
    const middle = Math.floor(signature.length / 2);
    const flipped = `${signature.slice(0, middle)}${signature[middle] === 'a' ? 'b' : 'a'}${signature.slice(middle + 1)}`;
    expect(() => g3.verify(`${header}.${payload}.${flipped}`)).toThrow();

    // Payload adulterado com a assinatura original: os claims não podem ser
    // escalados para um role diferente sem a chave.
    const claimsPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    claimsPayload.role = 'SUPER_ADMIN';
    const forged = `${header}.${Buffer.from(JSON.stringify(claimsPayload)).toString('base64url')}.${signature}`;
    expect(() => g3.verify(forged)).toThrow();
  });

  it('o verificador recusa um token expirado', () => {
    const g3 = createG3Auth();
    const expired = signToken(
      { id: 'user-1', role: 'STUDENT', schoolId: 'escola-1' },
      process.env.JWT_ACCESS_SECRET ?? '',
      -10,
    );
    expect(() => g3.verify(expired)).toThrow();
  });

  it('createG3AuthMiddleware devolve directamente a função de middleware', () => {
    expect(typeof createG3AuthMiddleware()).toBe('function');
  });
});

describe('middleware de autenticação — decisões de acesso', () => {
  async function run(
    middleware: ReturnType<typeof createG3AuthMiddleware>,
    req: FakeRequest,
    response: Response,
  ): Promise<boolean> {
    // `passed` é true só quando o middleware chama `next()` sem erro. Nas
    // rejeições o middleware escreve a resposta e não chama `next`, por isso a
    // promessa se resolve quando a resposta é enviada.
    return new Promise<boolean>((resolve) => {
      let passed = false;
      const next: NextFunction = () => {
        passed = true;
        resolve(true);
      };
      const onSend = () => resolve(passed);
      const originalJson = response.json.bind(response);
      response.json = ((body: unknown) => {
        response.json = originalJson as typeof response.json;
        onSend();
        return originalJson(body);
      }) as typeof response.json;
      void (middleware as (req: unknown, res: unknown, next: NextFunction) => Promise<void>)(req, response, next);
    });
  }

  function fakeResponse(): { res: Response; statusCode: () => number; body: () => Record<string, unknown> } {
    let code = 200;
    let payload: Record<string, unknown> = {};
    const res = {
      status(value: number) {
        code = value;
        return res;
      },
      json(value: Record<string, unknown>) {
        payload = value;
        return res;
      },
    } as unknown as Response;
    return { res, statusCode: () => code, body: () => payload };
  }

  it('rejeita com 401 quando o token é válido mas o utilizador foi desactivado', async () => {
    // Um token válido de um utilizador desactivado tem de ser recusado: sem
    // esta verificação, desactivar uma conta não tiraria acesso a nada.
    const middleware = createG3AuthMiddlewareWith(
      stubVerifier(GOOD_TOKEN, { sub: 'user-1' }),
      async () => ({ ...ACTIVE_USER, status: 'SUSPENDED' }),
    );
    const { res, statusCode, body } = fakeResponse();
    const passed = await run(middleware, fakeRequest({ authorization: `Bearer ${GOOD_TOKEN}` }), res);

    expect(passed).toBe(false);
    expect(statusCode()).toBe(401);
    expect(body().code).toBe('UNAUTHENTICATED');
  });

  it('rejeita com 401 quando o perfil não existe (token válido de um utilizador apagado)', async () => {
    const middleware = createG3AuthMiddlewareWith(stubVerifier(GOOD_TOKEN, { sub: 'fantasma' }), async () => null);
    const { res, statusCode, body } = fakeResponse();
    const passed = await run(middleware, fakeRequest({ authorization: `Bearer ${GOOD_TOKEN}` }), res);

    expect(passed).toBe(false);
    expect(statusCode()).toBe(401);
    expect(body().code).toBe('UNAUTHENTICATED');
  });

  it('deixa passar um utilizador activo e carrega role e escola no pedido', async () => {
    const middleware = createG3AuthMiddlewareWith(stubVerifier(GOOD_TOKEN, { sub: 'user-1' }), async () => ACTIVE_USER);
    const req = fakeRequest({ authorization: `Bearer ${GOOD_TOKEN}` });
    const { res } = fakeResponse();
    const passed = await run(middleware, req, res);

    expect(passed).toBe(true);
    expect((req as FakeRequest & { auth?: { userId: string; role: string } }).auth).toMatchObject({
      userId: 'user-1',
      role: 'STUDENT',
      schoolId: 'escola-1',
    });
  });

  it('401 sem cabecalho Authorization, com esquema errado e com token vazio', async () => {
    const middleware = createG3AuthMiddlewareWith(stubVerifier(GOOD_TOKEN, { sub: 'user-1' }), async () => ACTIVE_USER);

    for (const header of ['', 'Bearer', 'Basic abc123', GOOD_TOKEN]) {
      const { res, statusCode, body } = fakeResponse();
      await run(middleware, fakeRequest(header ? { authorization: header } : {}), res);
      expect(statusCode(), `cabeçalho "${header}" devia dar 401`).toBe(401);
      expect(body().code).toBe('UNAUTHENTICATED');
    }
  });

  it('503 quando o serviço de identidade está em baixo — sem ficha local não há acesso', async () => {
    const middleware = createG3AuthMiddlewareWith(
      stubVerifier(GOOD_TOKEN, { sub: 'user-1' }),
      async () => {
        throw new Error('Core em baixo');
      },
    );
    const { res, statusCode, body } = fakeResponse();
    await run(middleware, fakeRequest({ authorization: `Bearer ${GOOD_TOKEN}` }), res);

    // 503 e não 401: o token pode ser válido, é a confirmação de identidade que
    // falhou. Um 401 levaria o cliente a desistir de uma sessão que ainda é boa.
    expect(statusCode()).toBe(503);
    expect(body().code).toBe('IDENTITY_PROVIDER_UNAVAILABLE');
  });

  it('o token de serviço interna bypassa a verificação JWT mas fica marcado como role de serviço', async () => {
    const serviceToken = 'token-de-servico';
    const middleware = createG3AuthMiddlewareWith(
      stubVerifier(GOOD_TOKEN, { sub: 'user-1' }),
      async () => ACTIVE_USER,
      serviceToken,
    );

    const req = fakeRequest({ authorization: `Bearer ${serviceToken}` });
    const { res } = fakeResponse();
    expect(await run(middleware, req, res)).toBe(true);
    expect((req as FakeRequest & { auth?: { role: string } }).auth?.role).toBe('__SERVICE__');
  });

  it('um token de serviço diferente do configurado NÃO é aceite como atalho', async () => {
    const middleware = createG3AuthMiddlewareWith(
      stubVerifier(GOOD_TOKEN, { sub: 'user-1' }),
      async () => ACTIVE_USER,
      'certa',
    );
    const req = fakeRequest({ authorization: 'Bearer errada' });
    const { res, statusCode } = fakeResponse();
    // A comparação é em tempo constante e sobre o valor inteiro: um prefixo
    // parecido ou um token de outro comprimento tem de cair no 401 normal.
    const passed = await run(middleware, req, res);
    expect(statusCode()).toBe(401);
    expect((req as FakeRequest & { auth?: unknown }).auth).toBeUndefined();
    expect(passed).toBe(false);
  });
});

/**
 * Constrói o middleware com as dependências injectadas, para não depender do
 * banco de dados nem do segredo de ambiente nesta suite. É a mesma fábrica que
 * `createG3Auth` usa — só muda quem fornece o verificador e o perfil.
 */
function createG3AuthMiddlewareWith(
  verify: TokenVerifier,
  loadUser: (userId: string) => Promise<AuthUserRecord | null>,
  serviceToken?: string,
): ReturnType<typeof createG3AuthMiddleware> {
  return createAuthMiddleware({ verify, loadUser, serviceToken }) as ReturnType<typeof createG3AuthMiddleware>;
}