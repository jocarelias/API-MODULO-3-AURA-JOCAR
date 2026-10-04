import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, createSign, randomUUID } from 'node:crypto';
import {
  createHmacVerifier,
  createJwksVerifier,
  TokenVerificationError,
  SUPPORTED_ASYMMETRIC_ALGORITHMS,
} from './verifiers';
import type { TokenClaims } from './index';

const SECRET = 'segredo-de-teste-com-tamanho-suficiente';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signHs256(claims: TokenClaims, secret = SECRET, alg = 'HS256'): string {
  const header = base64url(JSON.stringify({ alg, typ: 'JWT' }));
  const payload = base64url(JSON.stringify(claims));
  const { createHmac } = require('node:crypto') as typeof import('node:crypto');
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function validClaims(overrides: Partial<TokenClaims> = {}): TokenClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: randomUUID(),
    role: 'STUDENT',
    schoolId: randomUUID(),
    type: 'access',
    iat: now,
    exp: now + 3600,
    ...overrides,
  } as TokenClaims;
}

describe('createHmacVerifier', () => {
  it('aceita um token assinado com o segredo correcto', () => {
    const claims = validClaims();
    const verified = createHmacVerifier(SECRET)(signHs256(claims));
    expect(verified.sub).toBe(claims.sub);
    expect(verified.role).toBe('STUDENT');
  });

  it('rejeita assinatura feita com outro segredo', () => {
    const token = signHs256(validClaims(), 'outro-segredo-totalmente-diferente');
    expect(() => createHmacVerifier(SECRET)(token)).toThrow(TokenVerificationError);
  });

  it('rejeita token expirado', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signHs256(validClaims({ exp: now - 10, iat: now - 100 }));
    expect(() => createHmacVerifier(SECRET)(token)).toThrow(/expirado/i);
  });

  it('rejeita token ainda não válido (nbf no futuro)', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signHs256(validClaims({ nbf: now + 600 }));
    expect(() => createHmacVerifier(SECRET)(token)).toThrow(/ainda não válido/i);
  });

  it('rejeita emissor não autorizado', () => {
    const token = signHs256(validClaims({ iss: 'outra-origem' }));
    expect(() => createHmacVerifier(SECRET, { issuer: 'core-ucjac' })(token)).toThrow(/emissor/i);
  });

  it('rejeita audience não autorizada', () => {
    const token = signHs256(validClaims({ aud: 'outro-sistema' }));
    expect(() => createHmacVerifier(SECRET, { audience: 'g3' })(token)).toThrow(/audience/i);
  });

  it('aceita audience Claims quando é um array que inclui a esperada', () => {
    const token = signHs256(validClaims({ aud: ['core', 'g3'] }));
    expect(() => createHmacVerifier(SECRET, { audience: 'g3' })(token)).not.toThrow();
  });

  it('rejeita refresh token quando se espera access token', () => {
    const token = signHs256(validClaims({ type: 'refresh' }));
    expect(() => createHmacVerifier(SECRET, { expectedType: 'access' })(token)).toThrow(TokenVerificationError);
  });

  it('rejeita claims sem role ou schoolId (sem escopo de tenancy)', () => {
    const semRole = signHs256(validClaims({ role: undefined as unknown as string }));
    expect(() => createHmacVerifier(SECRET)(semRole)).toThrow(/reclamações/i);
  });

  it('rejeita o algoritmo "none" (ataque clássico de downgrade)', () => {
    const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const payload = base64url(JSON.stringify(validClaims()));
    const token = `${header}.${payload}.${base64url('assinatura-falsa')}`;
    expect(() => createHmacVerifier(SECRET)(token)).toThrow(/não suportado/i);
  });

  it('rejeita token malformado', () => {
    expect(() => createHmacVerifier(SECRET)('nao.e.um.token')).toThrow(TokenVerificationError);
    expect(() => createHmacVerifier(SECRET)('so-um-segumento')).toThrow(TokenVerificationError);
  });

  it('exige segredo não vazio na construção', () => {
    expect(() => createHmacVerifier('')).toThrow(/obrigatório/i);
  });
});

describe('createJwksVerifier', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const KID = 'chave-de-teste-1';

  function jwksDocument(kid = KID) {
    const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
    return { keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] };
  }

  function signRs256(claims: TokenClaims, kid = KID): string {
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
    const payload = base64url(JSON.stringify(claims));
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    signer.end();
    return `${header}.${payload}.${signer.sign(privateKey, 'base64url')}`;
  }

  function fetchReturning(document: unknown, calls: { count: number }): typeof fetch {
    return (async () => {
      calls.count += 1;
      return new Response(JSON.stringify(document), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
  }

  it('valida um token RS256 assinado pela chave publicada no JWKS', async () => {
    const calls = { count: 0 };
    const verify = createJwksVerifier({
      jwksUri: 'https://core.example/.well-known/jwks.json',
      fetchImpl: fetchReturning(jwksDocument(), calls),
    });
    const claims = validClaims({ iss: 'core-ucjac', aud: 'g3' });
    const verified = await verify(signRs256(claims));
    expect(verified.sub).toBe(claims.sub);
    expect(calls.count).toBe(1);
  });

  it('usa cache: vários tokens com a mesma kid não refazem o fetch do JWKS', async () => {
    const calls = { count: 0 };
    const verify = createJwksVerifier({
      jwksUri: 'https://core.example/.well-known/jwks.json',
      fetchImpl: fetchReturning(jwksDocument(), calls),
    });
    await verify(signRs256(validClaims()));
    await verify(signRs256(validClaims()));
    await verify(signRs256(validClaims()));
    expect(calls.count).toBe(1);
  });

  it('rejeita token assinado por uma chave que não está no JWKS', async () => {
    const outro = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const assinatura = (() => {
      const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KID }));
      const payload = base64url(JSON.stringify(validClaims()));
      const signer = createSign('RSA-SHA256');
      signer.update(`${header}.${payload}`);
      signer.end();
      return `${header}.${payload}.${signer.sign(outro.privateKey, 'base64url')}`;
    })();

    const calls = { count: 0 };
    const verify = createJwksVerifier({
      jwksUri: 'https://core.example/.well-known/jwks.json',
      fetchImpl: fetchReturning(jwksDocument(), calls),
    });
    await expect(verify(assinatura)).rejects.toThrow(TokenVerificationError);
  });

  it('rejeita token HS256 (não pode ser validado com uma chave assimétrica)', async () => {
    const calls = { count: 0 };
    const verify = createJwksVerifier({
      jwksUri: 'https://core.example/.well-known/jwks.json',
      fetchImpl: fetchReturning(jwksDocument(), calls),
    });
    await expect(verify(signHs256(validClaims()))).rejects.toThrow(/não suportado/i);
  });

  it('propaga erro quando o JWKS está indisponível (HTTP 500)', async () => {
    const verify = createJwksVerifier({
      jwksUri: 'https://core.example/.well-known/jwks.json',
      fetchImpl: (async () => new Response('erro', { status: 500 })) as unknown as typeof fetch,
    });
    await expect(verify(signRs256(validClaims()))).rejects.toThrow(/indisponível/i);
  });

  it('rejeita documento JWKS sem chaves utilizáveis', async () => {
    const calls = { count: 0 };
    const verify = createJwksVerifier({
      jwksUri: 'https://core.example/.well-known/jwks.json',
      fetchImpl: fetchReturning({ keys: [] }, calls),
    });
    await expect(verify(signRs256(validClaims()))).rejects.toThrow(/chaves utilizáveis/i);
  });

  it('aplica issuer e audience vindos da Core', async () => {
    const calls = { count: 0 };
    const verify = createJwksVerifier({
      jwksUri: 'https://core.example/.well-known/jwks.json',
      issuer: 'core-ucjac',
      audience: 'g3',
      expectedType: 'access',
      fetchImpl: fetchReturning(jwksDocument(), calls),
    });
    await expect(verify(signRs256(validClaims({ iss: 'outra-origem' })))).rejects.toThrow(/emissor/i);
    await expect(verify(signRs256(validClaims({ iss: 'core-ucjac', aud: 'outro' })))).rejects.toThrow(/audience/i);
    await expect(
      verify(signRs256(validClaims({ iss: 'core-ucjac', aud: 'g3', type: 'refresh' }))),
    ).rejects.toThrow(TokenVerificationError);
  });

  it('exige jwksUri na construção', () => {
    expect(() => createJwksVerifier({ jwksUri: '' })).toThrow(/jwksUri/i);
  });

  it('aceita HS256 apenas quando explicitamente permitido', async () => {
    const calls = { count: 0 };
    const verify = createJwksVerifier({
      jwksUri: 'https://core.example/.well-known/jwks.json',
      algorithms: [...SUPPORTED_ASYMMETRIC_ALGORITHMS, 'HS256'],
      fetchImpl: fetchReturning(jwksDocument(), calls),
    });
    // Mesmo que o algoritmo seja permitido na lista, a assinatura tem de ser
    // validada pela chave pública — não pode passar só porque o header diz HS256.
    await expect(verify(signHs256(validClaims()))).rejects.toThrow(TokenVerificationError);
  });
});
