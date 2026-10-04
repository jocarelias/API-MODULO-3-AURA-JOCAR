import { createAuthMiddleware, type AuthUserRecord, type TokenVerifier } from '@smartcampus/auth';
import {
  createIdentityProvider,
  createTokenVerifier,
  identityConfig,
  type IdentityProvider,
  type RequestContext,
} from './identityProvider';

export interface G3Auth {
  middleware: ReturnType<typeof createAuthMiddleware>;
  verify: TokenVerifier;
  identity: IdentityProvider;
}

export function createG3Auth(): G3Auth {
  const config = identityConfig();
  const identity = createIdentityProvider(config);
  const verify = createTokenVerifier(config);

  const middleware = createAuthMiddleware({
    verify,
    serviceToken: config.serviceToken,
    loadUser: (userId: string) => identity.loadUser(userId, { correlationId: '' } as RequestContext),
  });

  return { middleware, verify, identity };
}

export function createG3AuthMiddleware() {
  return createG3Auth().middleware;
}

export function requestContextOf(req: {
  correlationId?: string;
  auth?: { token: string };
  get(name: string): string | undefined;
  ip?: string;
}): RequestContext {
  return {
    correlationId: req.correlationId ?? '',
    token: req.auth?.token,
    userAgent: req.get('user-agent') ?? undefined,
    ipAddress: req.ip,
  };
}

export type { AuthUserRecord, IdentityProvider };