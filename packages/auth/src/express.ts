import { Request, Response, NextFunction } from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { verifyToken } from './index';
import type { TokenVerifier } from './verifiers';

export const SERVICE_ROLE = '__SERVICE__';

export interface AuthContext {
  userId: string;
  role: string;
  schoolId: string;
  token: string;
}

export interface AuthRequest extends Request {
  auth?: AuthContext;
  correlationId?: string;
}

export interface AuthUserRecord {
  id: string;
  role: string;
  schoolId: string;
  status: string;
}

export interface AuthMiddlewareOptions {
  secret?: string;
  verify?: TokenVerifier;
  loadUser: (userId: string) => Promise<AuthUserRecord | null>;
  serviceToken?: string;
}

export const AUTH_ERROR_CODES = {
  MISSING_TOKEN: 'UNAUTHENTICATED',
  INVALID_TOKEN: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
} as const;

function correlationId(req: Request): string {
  return (req.get('x-correlation-id') as string | undefined) || (req.get('x-request-id') as string | undefined) || randomUUID();
}

function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

function sendError(res: Response, req: Request, status: number, code: string, message: string): void {
  res.status(status).json({ code, message, details: [], correlationId: correlationId(req) });
}

export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  const verify = options.verify;
  if (!verify && !options.secret) {
    throw new Error('createAuthMiddleware exige `secret` (HMAC) ou `verify` (verificador customizado, ex.: JWKS do Core)');
  }

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const header = req.get('authorization');
    if (!header || !header.startsWith('Bearer ')) {
      sendError(res, req, 401, AUTH_ERROR_CODES.MISSING_TOKEN, 'Token em falta');
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    if (options.serviceToken && constantTimeEqual(Buffer.from(token), Buffer.from(options.serviceToken))) {
      req.auth = { userId: '__service__', role: SERVICE_ROLE, schoolId: '', token };
      next();
      return;
    }

    let claims;
    try {
      claims = verify ? await verify(token) : verifyToken(token, options.secret as string);
    } catch {
      sendError(res, req, 401, AUTH_ERROR_CODES.INVALID_TOKEN, 'Token inválido ou expirado');
      return;
    }

    let user: AuthUserRecord | null;
    try {
      user = await options.loadUser(claims.sub);
    } catch {
      sendError(res, req, 503, 'IDENTITY_PROVIDER_UNAVAILABLE', 'Não foi possível confirmar a identidade do utilizador');
      return;
    }
    if (!user || user.status !== 'ACTIVE') {
      sendError(res, req, 401, AUTH_ERROR_CODES.INVALID_TOKEN, 'Utilizador inválido ou inativo');
      return;
    }
    req.auth = { userId: user.id, role: user.role, schoolId: user.schoolId, token };
    next();
  };
}

export function requireRoles(...roles: readonly string[]) {
  const allowed = new Set(roles);
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      sendError(res, req, 401, AUTH_ERROR_CODES.MISSING_TOKEN, 'Token em falta');
      return;
    }
    if (!allowed.has(req.auth.role)) {
      sendError(res, req, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Sem permissão para executar esta operação');
      return;
    }
    next();
  };
}

export function resolveSchoolScope(req: AuthRequest): string {
  const auth = req.auth as AuthContext;
  const body = (req.body ?? {}) as { schoolId?: string };
  if (body.schoolId && auth.role !== 'SUPER_ADMIN') {
    return body.schoolId;
  }
  return auth.schoolId;
}