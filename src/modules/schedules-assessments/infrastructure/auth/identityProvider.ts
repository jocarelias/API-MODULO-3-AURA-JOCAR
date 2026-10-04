import type { AuthUserRecord, TokenVerifier } from '@smartcampus/auth';
import { createHmacVerifier, createJwksVerifier } from '@smartcampus/auth';
import { DomainError } from '../../application/schedulesAssessmentsService';
import { prisma } from '../prisma';

export type AuthMode = 'standalone' | 'core';
export type TokenStrategy = 'hmac' | 'jwks';

export interface IdentityProvider {
  readonly mode: AuthMode;
  readonly ownsAuthRoutes: boolean;
  loadUser(userId: string, ctx: RequestContext): Promise<AuthUserRecord | null>;
  login(input: { email: string; password: string }, ctx: RequestContext): Promise<unknown>;
  refresh(refreshToken: string, ctx: RequestContext): Promise<unknown>;
  logout(refreshToken: string, userId: string, ctx: RequestContext): Promise<unknown>;
  assertHealthy(): Promise<void>;
}

export interface RequestContext {
  correlationId: string;
  token?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface IdentityConfig {
  mode: AuthMode;
  coreAuthUrl?: string;
  coreJwksUri?: string;
  coreIssuer?: string;
  coreAudience?: string;
  serviceToken?: string;
  timeoutMs: number;
}

function readConfig(): IdentityConfig {
  const mode = (process.env.AUTH_MODE ?? 'standalone').toLowerCase() === 'core' ? 'core' : 'standalone';
  return {
    mode,
    coreAuthUrl: process.env.CORE_AUTH_URL?.replace(/\/$/, ''),
    coreJwksUri: process.env.CORE_JWKS_URI,
    coreIssuer: process.env.CORE_JWT_ISSUER,
    coreAudience: process.env.CORE_JWT_AUDIENCE,
    serviceToken: process.env.FINANCIAL_SERVICE_TOKEN ?? process.env.SMARTCAMPUS_SERVICE_TOKEN,
    timeoutMs: Number(process.env.AUTH_PROVIDER_TIMEOUT_MS ?? 5000) || 5000,
  };
}

export function identityConfig(): IdentityConfig {
  return readConfig();
}

export function resolveTokenStrategy(config: IdentityConfig): TokenStrategy {
  return config.coreJwksUri ? 'jwks' : 'hmac';
}

function hmacSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.SMARTCAMPUS_JWT_SECRET || process.env.CORE_JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_ACCESS_SECRET (ou SMARTCAMPUS_JWT_SECRET/CORE_JWT_SECRET) é obrigatório quando CORE_JWKS_URI não está definido',
    );
  }
  return secret;
}

export function createTokenVerifier(config: IdentityConfig = readConfig()): TokenVerifier {
  if (config.coreJwksUri) {
    return createJwksVerifier({
      jwksUri: config.coreJwksUri,
      issuer: config.coreIssuer,
      audience: config.coreAudience,
      expectedType: 'access',
      timeoutMs: config.timeoutMs,
    });
  }
  return createHmacVerifier(hmacSecret(), { expectedType: 'access' });
}

async function loadUserFromPrisma(userId: string): Promise<AuthUserRecord | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }
  return { id: user.id, role: user.role, schoolId: user.schoolId, status: user.status };
}

async function postToCore(config: IdentityConfig, path: string, body: unknown, ctx: RequestContext): Promise<unknown> {
  if (!config.coreAuthUrl) {
    throw new DomainError('UPSTREAM_UNAVAILABLE', 'CORE_AUTH_URL não configurado para o modo core');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.coreAuthUrl}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-correlation-id': ctx.correlationId,
        'x-request-id': ctx.correlationId,
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as
      | { data?: unknown; code?: string; message?: string }
      | null;
    if (!response.ok) {
      const code = payload?.code ?? (response.status === 401 ? 'UNAUTHENTICATED' : 'UPSTREAM_ERROR');
      const error = new DomainError(code, payload?.message ?? `Core respondeu ${response.status} em ${path}`);
      error.httpStatus = response.status === 404 ? 404 : response.status >= 500 ? 502 : response.status;
      throw error;
    }
    return payload?.data;
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }
    throw new DomainError('UPSTREAM_UNAVAILABLE', 'Serviço de autenticação do Core indisponível', [{ path }]);
  } finally {
    clearTimeout(timer);
  }
}

export class LocalIdentityProvider implements IdentityProvider {
  readonly mode: AuthMode = 'standalone';
  readonly ownsAuthRoutes = true;

  async loadUser(userId: string): Promise<AuthUserRecord | null> {
    return loadUserFromPrisma(userId);
  }

  async login(): Promise<unknown> {
    throw new DomainError('NOT_IMPLEMENTED', 'O login é servido pelo AuthService local');
  }

  async refresh(): Promise<unknown> {
    throw new DomainError('NOT_IMPLEMENTED', 'O refresh é servido pelo AuthService local');
  }

  async logout(): Promise<unknown> {
    throw new DomainError('NOT_IMPLEMENTED', 'O logout é servido pelo AuthService local');
  }

  async assertHealthy(): Promise<void> {
    await prisma.user.count();
  }
}

export class CoreIdentityProvider implements IdentityProvider {
  readonly mode: AuthMode = 'core';
  readonly ownsAuthRoutes = false;

  private config: IdentityConfig;

  constructor(config: IdentityConfig = readConfig()) {
    this.config = config;
  }

  async loadUser(userId: string, ctx: RequestContext): Promise<AuthUserRecord | null> {
    if (!this.config.coreAuthUrl) {
      return loadUserFromPrisma(userId);
    }
    const path = `/api/v1/users/${encodeURIComponent(userId)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(`${this.config.coreAuthUrl}${path}`, {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${ctx.token ?? ''}`,
          'x-correlation-id': ctx.correlationId,
          'x-request-id': ctx.correlationId,
        },
      });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Core /users respondeu ${response.status}`);
      }
      const payload = (await response.json()) as { data?: Record<string, unknown> };
      const data = payload?.data;
      if (!data || typeof data.id !== 'string') {
        return null;
      }
      return {
        id: data.id,
        role: String(data.role ?? ''),
        schoolId: String(data.schoolId ?? ''),
        status: String(data.status ?? 'ACTIVE'),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async login(input: { email: string; password: string }, ctx: RequestContext): Promise<unknown> {
    return postToCore(this.config, '/api/v1/auth/login', input, ctx);
  }

  async refresh(refreshToken: string, ctx: RequestContext): Promise<unknown> {
    return postToCore(this.config, '/api/v1/auth/refresh', { refreshToken }, ctx);
  }

  async logout(refreshToken: string, userId: string, ctx: RequestContext): Promise<unknown> {
    return postToCore(this.config, '/api/v1/auth/logout', { refreshToken, userId }, ctx);
  }

  async assertHealthy(): Promise<void> {
    if (!this.config.coreAuthUrl) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(`${this.config.coreAuthUrl}/api/v1/health`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Core health respondeu ${response.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createIdentityProvider(config: IdentityConfig = readConfig()): IdentityProvider {
  return config.mode === 'core' ? new CoreIdentityProvider(config) : new LocalIdentityProvider();
}