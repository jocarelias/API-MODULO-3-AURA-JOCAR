import { Router, Response } from 'express';
import { z } from 'zod';
import { createAuthMiddleware, AuthRequest, AuthUserRecord } from '@smartcampus/auth';
import { financialStatusDto, FinancialStatusDto } from '@smartcampus/shared-types';
import { prisma } from '../infrastructure/prisma';

const studentIdParamsSchema = z.object({ studentId: z.string().uuid() });

async function loadUser(userId: string): Promise<AuthUserRecord | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }
  return { id: user.id, role: user.role, schoolId: user.schoolId, status: user.status };
}

function sendSuccess(res: Response, data: unknown, correlationId: string | undefined): void {
  res.status(200).json({ data, meta: { correlationId } });
}

function sendError(res: Response, status: number, code: string, message: string, correlationId: string | undefined): void {
  res.status(status).json({ code, message, details: [], correlationId });
}

export function createFinancialStatusRouter(): Router {
  const router = Router();
  const secret = process.env.SMARTCAMPUS_JWT_SECRET;
  if (!secret) {
    throw new Error('SMARTCAMPUS_JWT_SECRET é obrigatório para o serviço financeiro');
  }
  const auth = createAuthMiddleware({
    secret,
    loadUser,
    serviceToken: process.env.FINANCIAL_SERVICE_TOKEN || process.env.SMARTCAMPUS_SERVICE_TOKEN,
  });

  router.get(
    '/financial-status/:studentId',
    auth,
    async (req: AuthRequest, res: Response) => {
      const parsed = studentIdParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Identificador de estudante inválido', req.correlationId);
        return;
      }
      const student = await prisma.student.findUnique({ where: { id: parsed.data.studentId } });
      if (!student) {
        sendError(res, 404, 'STUDENT_NOT_FOUND', 'Aluno não encontrado', req.correlationId);
        return;
      }
      const row = await prisma.financialStatus.findUnique({ where: { studentId: student.id } });
      if (!row) {
        const data: FinancialStatusDto = {
          studentId: student.id,
          schoolId: student.schoolId,
          hasDebt: false,
          status: 'REGULAR',
          outstandingAmount: 0,
          updatedAt: null,
        };
        sendSuccess(res, data, req.correlationId);
        return;
      }
      const data = financialStatusDto({
        studentId: row.studentId,
        schoolId: row.schoolId,
        hasDebt: row.hasDebt,
        status: row.status,
        outstandingAmount: Number(row.outstandingAmount),
        updatedAt: row.updatedAt,
      });
      sendSuccess(res, data, req.correlationId);
    },
  );

  return router;
}