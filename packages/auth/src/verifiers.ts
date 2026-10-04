import { createHmac, timingSafeEqual, createPublicKey, createVerify, type KeyObject } from 'node:crypto';
import type { TokenClaims, TokenType } from './index';

export interface SyncTokenVerifier {
  (token: string): TokenClaims;
}

export interface TokenVerifier {
  (token: string): TokenClaims | Promise<TokenClaims>;
}

export class TokenVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenVerificationError';
  }
}

export const SUPPORTED_HMAC_ALGORITHMS = ['HS256', 'HS384', 'HS512'] as const;

const HMAC_DIGEST: Record<string, string> = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' };

export interface ClaimConstraints {
  expectedType?: TokenType;
  issuer?: string;
  audience?: string;
}

interface ParsedToken {
  header: string;
  payload: string;
  signature: string;
  alg: string;
  kid?: string;
  claims: TokenClaims;
}

function parseToken(token: string): ParsedToken {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new TokenVerificationError('Token malformado');
  }
  const [header, payload, signature] = parts;

  let decodedHeader: { alg?: unknown; kid?: unknown };
  try {
    decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: unknown; kid?: unknown };
  } catch {
    throw new TokenVerificationError('Cabeçalho do token ilegível');
  }
  if (typeof decodedHeader.alg !== 'string') {
    throw new TokenVerificationError('Cabeçalho do token sem algoritmo');
  }

  let claims: TokenClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenClaims;
  } catch {
    throw new TokenVerificationError('Payload do token ilegível');
  }

  return {
    header,
    payload,
    signature,
    alg: decodedHeader.alg,
    kid: typeof decodedHeader.kid === 'string' ? decodedHeader.kid : undefined,
    claims,
  };
}

function assertClaims(claims: TokenClaims, constraints: ClaimConstraints): TokenClaims {
  const { expectedType, issuer, audience } = constraints;

  if (expectedType && claims.type !== expectedType) {
    throw new TokenVerificationError('Reclamações inválidas');
  }
  if (!claims.sub || !claims.role || !claims.schoolId) {
    throw new TokenVerificationError('Reclamações inválidas');
  }
  if (issuer && claims.iss !== issuer) {
    throw new TokenVerificationError('Emissor do token não autorizado');
  }
  if (audience) {
    const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
    if (!audiences.includes(audience)) {
      throw new TokenVerificationError('Audience do token não autorizada');
    }
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= now) {
    throw new TokenVerificationError('Token expirado');
  }
  if (typeof claims.nbf === 'number' && claims.nbf > now) {
    throw new TokenVerificationError('Token ainda não válido');
  }

  return claims;
}

export function createHmacVerifier(secret: string, constraints: ClaimConstraints = {}): SyncTokenVerifier {
  if (!secret) {
    throw new Error('Segredo HMAC é obrigatório para verificação de tokens');
  }
  const allowed = new Set<string>(SUPPORTED_HMAC_ALGORITHMS);

  const verifyHmac: SyncTokenVerifier = (token) => {
    const parsed = parseToken(token);
    if (!allowed.has(parsed.alg)) {
      throw new TokenVerificationError('Algoritmo não suportado');
    }
    const digest = HMAC_DIGEST[parsed.alg];
    if (!digest) {
      throw new TokenVerificationError('Algoritmo não suportado');
    }
    const expected = createHmac(digest, secret).update(`${parsed.header}.${parsed.payload}`).digest();
    const actual = Buffer.from(parsed.signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new TokenVerificationError('Assinatura inválida');
    }
    return assertClaims(parsed.claims, constraints);
  };

  return verifyHmac;
}

export interface Jwk {
  kty: string;
  kid?: string;
  alg?: string;
  use?: string;
}

export interface JwksDocument {
  keys: Jwk[];
}

export interface JwksVerifierOptions extends ClaimConstraints {
  jwksUri: string;
  algorithms?: readonly string[];
  cacheTtlMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export const SUPPORTED_ASYMMETRIC_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'] as const;

export function createJwksVerifier(options: JwksVerifierOptions): TokenVerifier {
  if (!options.jwksUri) {
    throw new Error('jwksUri é obrigatório para verificação via JWKS');
  }

  const allowed = new Set<string>(options.algorithms ?? SUPPORTED_ASYMMETRIC_ALGORITHMS);
  const cacheTtlMs = options.cacheTtlMs ?? 300_000;
  const timeoutMs = options.timeoutMs ?? 3000;
  const doFetch = options.fetchImpl ?? fetch;
  const constraints: ClaimConstraints = {
    expectedType: options.expectedType,
    issuer: options.issuer,
    audience: options.audience,
  };

  let cache: { keys: Map<string, KeyObject>; expiresAt: number } | null = null;
  let inflight: Promise<Map<string, KeyObject>> | null = null;

  async function fetchJwks(): Promise<Jwk[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(options.jwksUri, { signal: controller.signal, headers: { accept: 'application/json' } });
      if (!response.ok) {
        throw new TokenVerificationError(`JWKS indisponível (HTTP ${response.status})`);
      }
      const document = (await response.json()) as JwksDocument;
      if (!document || !Array.isArray(document.keys)) {
        throw new TokenVerificationError('JWKS sem chaves válidas');
      }
      return document.keys;
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadKeys(forceRefresh: boolean): Promise<Map<string, KeyObject>> {
    if (forceRefresh) {
      cache = null;
    } else if (cache && cache.expiresAt > Date.now()) {
      return cache.keys;
    } else if (inflight) {
      return inflight;
    }

    const pending = (async () => {
      const keys = new Map<string, KeyObject>();
      for (const [index, jwk] of (await fetchJwks()).entries()) {
        if (jwk.use && jwk.use !== 'sig') continue;
        if (jwk.kty !== 'RSA' && jwk.kty !== 'EC') continue;
        const kid = jwk.kid ?? `${jwk.kty}-${index}`;
        try {
          keys.set(kid, createPublicKey({ key: jwk as unknown as Record<string, unknown>, format: 'jwk' }));
        } catch {
          continue;
        }
      }
      if (keys.size === 0) {
        throw new TokenVerificationError('JWKS sem chaves utilizáveis');
      }
      cache = { keys, expiresAt: Date.now() + cacheTtlMs };
      return keys;
    })();

    inflight = pending;
    try {
      return await pending;
    } finally {
      if (inflight === pending) {
        inflight = null;
      }
    }
  }

  return async (token: string): Promise<TokenClaims> => {
    const parsed = parseToken(token);
    if (!allowed.has(parsed.alg)) {
      throw new TokenVerificationError('Algoritmo não suportado');
    }

    let keys = await loadKeys(false);
    let publicKey = parsed.kid ? keys.get(parsed.kid) : keys.values().next().value;
    if (!publicKey && parsed.kid) {
      keys = await loadKeys(true);
      publicKey = keys.get(parsed.kid);
    }
    if (!publicKey) {
      throw new TokenVerificationError('Chave pública não encontrada para o token');
    }

    const signatureValid = createVerify(parsed.alg)
      .update(`${parsed.header}.${parsed.payload}`)
      .end()
      .verify(publicKey, Buffer.from(parsed.signature, 'base64url'));
    if (!signatureValid) {
      throw new TokenVerificationError('Assinatura inválida');
    }

    return assertClaims(parsed.claims, constraints);
  };
}