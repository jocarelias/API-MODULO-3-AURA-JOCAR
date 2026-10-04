import { createHmac, timingSafeEqual, randomBytes, scryptSync, createHash, randomUUID } from 'node:crypto';
import { createHmacVerifier, type SyncTokenVerifier } from './verifiers';

const HEADER_B64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

export type TokenType = 'access' | 'refresh';

export interface TokenClaims {
  jti?: string;
  sub: string;
  role: string;
  schoolId: string;
  type: TokenType;
  iat?: number;
  exp: number;
  nbf?: number;
  iss?: string;
  aud?: string | string[];
  scopes?: string[];
}

export interface LoginUser {
  id: string;
  role: string;
  schoolId: string;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

export function signToken(user: LoginUser, secret: string, ttlSeconds = 3600, type: TokenType = 'access', jti = randomUUID()): string {
  const claims: TokenClaims = {
    jti,
    sub: user.id,
    role: user.role,
    schoolId: user.schoolId,
    type,
    iat: unixNow(),
    exp: unixNow() + ttlSeconds,
  };
  const payload = JSON.stringify(claims);
  const signingInput = `${HEADER_B64}.${b64url(payload)}`;
  const signature = b64url(createHmac('sha256', secret).update(signingInput).digest());
  return `${signingInput}.${signature}`;
}

const hmacVerifiers = new Map<string, SyncTokenVerifier>();

export function verifyToken(token: string, secret: string, expectedType: TokenType = 'access'): TokenClaims {
  const cacheKey = `${expectedType}:${secret}`;
  let verifier = hmacVerifiers.get(cacheKey);
  if (!verifier) {
    verifier = createHmacVerifier(secret, { expectedType });
    hmacVerifiers.set(cacheKey, verifier);
  }
  return verifier(token);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) {
    return false;
  }
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export { createAuthMiddleware, requireRoles, SERVICE_ROLE } from './express';
export type { AuthRequest, AuthContext, AuthUserRecord, AuthMiddlewareOptions } from './express';
export {
  createHmacVerifier,
  createJwksVerifier,
  TokenVerificationError,
  SUPPORTED_HMAC_ALGORITHMS,
  SUPPORTED_ASYMMETRIC_ALGORITHMS,
} from './verifiers';
export type { TokenVerifier, SyncTokenVerifier, ClaimConstraints, JwksVerifierOptions, JwksDocument, Jwk } from './verifiers';