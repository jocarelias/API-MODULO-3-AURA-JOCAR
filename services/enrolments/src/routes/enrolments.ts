import { Router, Response } from 'express';
import { z } from 'zod';
import { createAuthMiddleware, requireRoles, AuthRequest, AuthUserRecord } from '@smartcampus/auth';
import { enrolmentDto, STAFF_ROLES } from '@smartcampus/shared-types';
import { Prisma, EnrollmentStatus } from '@prisma/client';
import { prisma } from '../infrastructure/prisma';

const listQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
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

export function createEnrolmentsRouter(): Router {
  const router = Router();
  const secret = process.env.JWT_ACCESS_SECRET || process.env.SMARTCAMPUS_JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET (ou SMARTCAMPUS_JWT_SECRET) é obrigatório para o serviço de inscrições');
  }
  const auth = createAuthMiddleware({ secret, loadUser });

  router.get(
    '/enrolments',
    auth,
    requireRoles(...STAFF_ROLES),
    async (req: AuthRequest, res: Response) => {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Parâmetros de consulta inválidos', req.correlationId);
        return;
      }
      const { studentId, subjectId, academicYearId, classId, termId, status, page = 1, pageSize = 100 } = parsed.data;
      const where: Prisma.EnrollmentWhereInput = {};
      if (studentId) where.studentId = studentId;
      if (subjectId) where.subjectId = subjectId;
      if (academicYearId) where.academicYearId = academicYearId;
      if (classId) where.classId = classId;
      if (termId) where.termId = termId;
      if (status) where.status = status as EnrollmentStatus;
      const rows = await prisma.enrollment.findMany({
        where,
        include: { academicYear: true },
        orderBy: { studentId: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      const total = await prisma.enrollment.count({ where });
      sendSuccess(res, rows.map((row) => enrolmentDto(row)), req.correlationId, { page, pageSize, total });
    },
  );

  return router;
}