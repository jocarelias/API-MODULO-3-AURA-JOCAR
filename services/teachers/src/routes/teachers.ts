import { Router, Response } from 'express';
import { z } from 'zod';
import { createAuthMiddleware, requireRoles, AuthRequest, AuthUserRecord } from '@smartcampus/auth';
import { teacherProfileDto, TeacherProfileDto, STAFF_ROLES } from '@smartcampus/shared-types';
import { Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/prisma';

const idParamsSchema = z.object({ id: z.string().uuid() });
const listQuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(1000).optional(),
});

async function loadUser(userId: string): Promise<AuthUserRecord | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }
  return { id: user.id, role: user.role, schoolId: user.schoolId, status: user.status };
}

function sendSuccess(res: Response, data: unknown, correlationId: string | undefined, pagination?: { page: number; pageSize: number; total: number }) {
  const body: { data: unknown; meta: Record<string, unknown> } = { data, meta: { correlationId } };
  if (pagination) {
    body.meta.page = pagination.page;
    body.meta.pageSize = pagination.pageSize;
    body.meta.total = pagination.total;
  }
  res.status(200).json(body);
}

function sendError(res: Response, status: number, code: string, message: string, correlationId: string | undefined): void {
  res.status(status).json({ code, message, details: [], correlationId });
}

type TeacherRow = Prisma.TeacherGetPayload<{}>;

function toProfile(row: TeacherRow): TeacherProfileDto {
  return teacherProfileDto({
    id: row.id,
    schoolId: row.schoolId,
    userId: row.userId,
    staffNumber: null,
    departmentId: null,
    title: null,
    name: row.name,
    email: row.email,
    status: row.status,
  });
}

export function createTeachersRouter(): Router {
  const router = Router();
  const secret = process.env.JWT_ACCESS_SECRET || process.env.SMARTCAMPUS_JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET (ou SMARTCAMPUS_JWT_SECRET) é obrigatório para o serviço de professores');
  }
  const auth = createAuthMiddleware({ secret, loadUser });

  router.get(
    '/teachers',
    auth,
    requireRoles(...STAFF_ROLES),
    async (req: AuthRequest, res: Response) => {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Parâmetros de consulta inválidos', req.correlationId);
        return;
      }
      const { schoolId, status, page = 1, pageSize = 100 } = parsed.data;
      const where: Prisma.TeacherWhereInput = {};
      if (schoolId) where.schoolId = schoolId;
      if (status) where.status = status as Prisma.TeacherWhereInput['status'];
      const rows = await prisma.teacher.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      const total = await prisma.teacher.count({ where });
      sendSuccess(res, rows.map(toProfile), req.correlationId, { page, pageSize, total });
    },
  );

  router.get(
    '/teachers/:id',
    auth,
    async (req: AuthRequest, res: Response) => {
      const authData = req.auth as { role: string };
      const parsed = idParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Identificador de professor inválido', req.correlationId);
        return;
      }
      if (authData.role === 'STUDENT' || authData.role === 'PARENT') {
        sendError(res, 403, 'FORBIDDEN', 'Sem permissão para consultar perfis de outros professores', req.correlationId);
        return;
      }
      const row = await prisma.teacher.findUnique({ where: { id: parsed.data.id } });
      if (!row) {
        sendError(res, 404, 'TEACHER_NOT_FOUND', 'Professor não encontrado no catálogo', req.correlationId);
        return;
      }
      sendSuccess(res, toProfile(row), req.correlationId);
    },
  );

  return router;
}