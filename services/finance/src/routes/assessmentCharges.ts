import { Router, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { createAuthMiddleware, AuthRequest, AuthUserRecord, SERVICE_ROLE } from '@smartcampus/auth';
import { AssessmentChargeDto, STAFF_ROLES } from '@smartcampus/shared-types';
import { prisma } from '../infrastructure/prisma';

const chargeSchema = z
  .object({
    sourceModule: z.string().min(1).max(50),
    sourceRequestId: z.string().min(1).max(120),
    studentUserId: z.string().uuid(),
    feeCode: z.string().min(1).max(50),
    externalAssessmentId: z.string().uuid().optional(),
    externalEnrolmentId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
    termId: z.string().uuid().optional(),
  })
  .strict();

const FEE_CATALOG: Record<string, { amount: number; currency: string; description: string; dueInDays: number }> = {
  'ASSESSMENT-TAKE': { amount: 150, currency: 'MZN', description: 'Taxa de inscrição em avaliação', dueInDays: 5 },
  'EXAM-TAKE': { amount: 250, currency: 'MZN', description: 'Taxa de exame', dueInDays: 5 },
};

const idempotency = new Map<string, AssessmentChargeDto>();

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
  res.status(status).json({ code, message, details: [] as unknown[], correlationId });
}

export function createAssessmentChargesRouter(): Router {
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

  const serviceOrStaff = (req: AuthRequest, res: Response, next: () => void): void => {
    if (req.auth && (req.auth.role === SERVICE_ROLE || (STAFF_ROLES as readonly string[]).includes(req.auth.role))) {
      next();
      return;
    }
    sendError(res, 403, 'FORBIDDEN', 'Sem permissão para executar esta operação', req.correlationId);
  };

  router.post(
    '/financial/integration/assessment-charges',
    auth,
    serviceOrStaff,
    async (req: AuthRequest, res: Response) => {
      const parsed = chargeSchema.safeParse(req.body);
      if (!parsed.success) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Payload inválido', req.correlationId);
        return;
      }
      const input = parsed.data;
      const key = `${input.sourceModule}:${input.sourceRequestId}:${input.studentUserId}:${input.feeCode}`;
      const stored = idempotency.get(key);
      if (stored) {
        sendSuccess(res, stored, req.correlationId);
        return;
      }
      const fee = FEE_CATALOG[input.feeCode];
      if (!fee) {
        sendError(res, 404, 'FEE_NOT_FOUND', 'Código de taxa desconhecido', req.correlationId);
        return;
      }
      const studentId = await prisma.student.findFirst({ where: { userId: input.studentUserId }, select: { id: true } });
      if (!studentId) {
        sendError(res, 404, 'STUDENT_NOT_FOUND', 'Estudante não encontrado', req.correlationId);
        return;
      }
      const due = new Date(Date.now() + fee.dueInDays * 86400000).toISOString();
      const charge: AssessmentChargeDto = {
        externalRegistrationId: randomUUID(),
        feeCode: input.feeCode,
        amount: fee.amount,
        currency: fee.currency,
        description: fee.description,
        dueDate: due,
        status: 'PENDING',
      };
      idempotency.set(key, charge);
      sendSuccess(res, charge, req.correlationId);
    },
  );

  return router;
}