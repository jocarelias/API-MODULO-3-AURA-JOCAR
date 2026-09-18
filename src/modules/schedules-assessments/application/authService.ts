import { PrismaClient } from '@prisma/client';
import { signToken, verifyPassword } from '@smartcampus/auth';
import { AuthTokensDto, LoginInputDto, AuthUserDto } from '@smartcampus/shared-types';
import { prisma } from '../infrastructure/prisma';

const TOKEN_TTL_SECONDS = 3600;

function jwtSecret(): string {
  const secret = process.env.SMARTCAMPUS_JWT_SECRET;
  if (!secret) {
    throw new Error('SMARTCAMPUS_JWT_SECRET é obrigatório');
  }
  return secret;
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

  async login(input: LoginInputDto): Promise<AuthTokensDto> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new AuthError('UNAUTHENTICATED', 'Credenciais inválidas');
    }
    if (user.status !== 'ACTIVE') {
      throw new AuthError('UNAUTHENTICATED', 'Utilizador inativo');
    }
    const accessToken = signToken({ id: user.id, role: user.role, schoolId: user.schoolId }, jwtSecret(), TOKEN_TTL_SECONDS);
    const userDto: AuthUserDto = { id: user.id, role: user.role, schoolId: user.schoolId, name: user.name, email: user.email };
    return { accessToken, tokenType: 'Bearer', expiresIn: TOKEN_TTL_SECONDS, user: userDto };
  }
}