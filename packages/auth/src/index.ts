import { createHmac, timingSafeEqual, randomBytes, scryptSync, createHash, randomUUID } from 'node:crypto';

const HEADER_B64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

export type TokenType = 'access' | 'refresh';

export interface TokenClaims {
  jti: string;
  sub: string;
  role: string;
  schoolId: string;
  type: TokenType;
  iat: number;
  exp: number;
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

export function verifyToken(token: string, secret: string, expectedType: TokenType = 'access'): TokenClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token malformado');
  }
  const [header, payload, signature] = parts;
  if (header !== HEADER_B64) {
    throw new Error('Algoritmo não suportado');
  }
  const expected = b64url(createHmac('sha256', secret).update(`${header}.${payload}`).digest());
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Assinatura inválida');
  }
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenClaims;
  if (claims.type !== expectedType || !claims.sub || !claims.role || !claims.schoolId) {
    throw new Error('Reclamações inválidas');
  }
  if (claims.exp <= unixNow()) {
    throw new Error('Token expirado');
  }
  return claims;
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