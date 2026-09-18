import { PrismaClient, User } from '@prisma/client';
import { signToken, verifyToken, verifyPassword, hashToken } from '@smartcampus/auth';
import { AuthTokensDto, LoginInputDto, AuthUserDto } from '@smartcampus/shared-types';
import { prisma } from '../infrastructure/prisma';

const DEFAULT_ACCESS_TTL = 3600;
const DEFAULT_REFRESH_TTL = 7 * 24 * 3600;

export interface AuthRequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

function parseDuration(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  if (!match) {
    return fallback;
  }
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const multiplier = multipliers[match[2] ?? 's'] ?? 1;
  return Math.max(1, Number.parseInt(match[1], 10) * multiplier);
}

function accessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.SMARTCAMPUS_JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET (ou SMARTCAMPUS_JWT_SECRET) é obrigatório');
  }
  return secret;
}

function refreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.SMARTCAMPUS_JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET (ou SMARTCAMPUS_JWT_SECRET) é obrigatório');
  }
  return secret;
}

function accessTtl(): number {
  return parseDuration(process.env.JWT_ACCESS_EXPIRES_IN, DEFAULT_ACCESS_TTL);
}

function refreshTtl(): number {
  return parseDuration(process.env.JWT_REFRESH_EXPIRES_IN, DEFAULT_REFRESH_TTL);
}

export class AuthError extends Error {
  code: string;
  httpStatus: number;
  details: unknown[];

  constructor(code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.httpStatus = 401;
    this.details = details;
  }
}

export class AuthService {
  private prisma: PrismaClient;

  constructor({ db = prisma }: { db?: PrismaClient } = {}) {
    this.prisma = db;
  }

  private buildTokens(user: Pick<User, 'id' | 'role' | 'schoolId' | 'name' | 'email'>) {
    const accessTtlSeconds = accessTtl();
    const refreshTtlSeconds = refreshTtl();
    const accessToken = signToken({ id: user.id, role: user.role, schoolId: user.schoolId }, accessSecret(), accessTtlSeconds, 'access');
    const refreshToken = signToken({ id: user.id, role: user.role, schoolId: user.schoolId }, refreshSecret(), refreshTtlSeconds, 'refresh');
    const userDto: AuthUserDto = { id: user.id, role: user.role, schoolId: user.schoolId, name: user.name, email: user.email };
    const tokens: AuthTokensDto = {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: accessTtlSeconds,
      refreshToken,
      refreshExpiresIn: refreshTtlSeconds,
      user: userDto,
    };
    return { tokens, refreshTtlSeconds };
  }

  async login(input: LoginInputDto, meta?: AuthRequestMeta): Promise<AuthTokensDto> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new AuthError('UNAUTHENTICATED', 'Credenciais inválidas');
    }
    if (user.status !== 'ACTIVE') {
      throw new AuthError('UNAUTHENTICATED', 'Utilizador inativo');
    }
    const { tokens, refreshTtlSeconds } = this.buildTokens(user);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
        userAgent: meta?.userAgent ?? null,
        ipAddress: meta?.ipAddress ?? null,
      },
    });
    void this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return tokens;
  }

  async refresh(refreshToken: string, meta?: AuthRequestMeta): Promise<AuthTokensDto> {
    let claims;
    try {
      claims = verifyToken(refreshToken, refreshSecret(), 'refresh');
    } catch {
      throw new AuthError('UNAUTHENTICATED', 'Sessão expirada ou token de refresh inválido');
    }
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
    if (!row || row.revokedAt !== null || row.expiresAt.getTime() <= Date.now()) {
      throw new AuthError('UNAUTHENTICATED', 'Sessão expirada');
    }
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || user.status !== 'ACTIVE') {
      throw new AuthError('UNAUTHENTICATED', 'Utilizador inativo');
    }
    const { tokens, refreshTtlSeconds } = this.buildTokens(user);
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(tokens.refreshToken),
          expiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
          userAgent: meta?.userAgent ?? null,
          ipAddress: meta?.ipAddress ?? null,
        },
      }),
    ]);
    return tokens;
  }

  async logout(refreshToken: string, userId: string): Promise<{ revoked: boolean }> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count > 0 };
  }
}