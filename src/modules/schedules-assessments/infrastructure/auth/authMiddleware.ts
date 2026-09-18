import { createAuthMiddleware, AuthUserRecord } from '@smartcampus/auth';
import { prisma } from '../prisma';

async function loadUser(userId: string): Promise<AuthUserRecord | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }
  return { id: user.id, role: user.role, schoolId: user.schoolId, status: user.status };
}

export function createG3AuthMiddleware() {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.SMARTCAMPUS_JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET (ou SMARTCAMPUS_JWT_SECRET) é obrigatório para o módulo G3');
  }
  return createAuthMiddleware({ secret, loadUser });
}