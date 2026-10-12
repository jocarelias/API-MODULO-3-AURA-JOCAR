import { Router, Response } from 'express';
import { z } from 'zod';
import { createAuthMiddleware, AuthRequest, AuthUserRecord, SERVICE_ROLE } from '@smartcampus/auth';
import { financialStatusDto, FinancialStandingCheckDto, FinancialStatusDto } from '@smartcampus/shared-types';
import { prisma } from '../infrastructure/prisma';

const studentIdParamsSchema = z.object({ studentId: z.string().uuid() });
const studentUserIdParamsSchema = z.object({ studentUserId: z.string().uuid() });

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
  const secret = process.env.JWT_ACCESS_SECRET || process.env.SMARTCAMPUS_JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET (ou SMARTCAMPUS_JWT_SECRET) é obrigatório para o serviço financeiro');
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

      // Situação financeira é dado sensível: só a própria escola (ou o
      // SUPER_ADMIN) pode ver os seus estudantes. Sem esta verificação, qualquer
      // token autenticado lia a dívida de qualquer aluno conhecido pelo
      // :studentId. O service token é o gateway, que já aplicou o scoping.
      const auth = req.auth as { role: string; schoolId: string; userId: string };
      const trusted = auth.role === 'SUPER_ADMIN' || auth.role === SERVICE_ROLE;
      if (!trusted && student.schoolId !== auth.schoolId) {
        sendError(res, 403, 'FORBIDDEN', 'Este estudante pertence a outra escola', req.correlationId);
        return;
      }

      // Um estudante só pode consultar a própria situação; o resto é staff.
      if (auth.role === 'STUDENT') {
        const own = await prisma.student.findUnique({ where: { userId: auth.userId } });
        if (!own || own.id !== student.id) {
          sendError(res, 403, 'FORBIDDEN', 'Só pode consultar a sua própria situação financeira', req.correlationId);
          return;
        }
      } else if (auth.role === 'PARENT') {
        sendError(res, 403, 'FORBIDDEN', 'Sem permissão para consultar a situação financeira de outros utilizadores', req.correlationId);
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

  /**
   * Rota de integração proposta no contrato 03-financeiro-avaliacoes-horarios:
   * devolve apenas a regularidade (ACTIVE/BLOCKED) e o instante da consulta,
   * sem saldo, dívidas ou motivos privados. `studentUserId` é o `User.id` do
   * Core. Apenas o token de serviço (G3) pode consumi-la.
   */
  router.get(
    '/financial/integration/students/:studentUserId/standing',
    auth,
    async (req: AuthRequest, res: Response) => {
      const authInfo = req.auth as { role: string } | undefined;
      if (!authInfo || authInfo.role !== SERVICE_ROLE) {
        sendError(res, 403, 'FORBIDDEN', 'Sem permissão para consultar a regularidade', req.correlationId);
        return;
      }
      const parsed = studentUserIdParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Identificador de utilizador inválido', req.correlationId);
        return;
      }
      const student = await prisma.student.findFirst({
        where: { userId: parsed.data.studentUserId },
        select: { id: true },
      });
      if (!student) {
        sendError(res, 404, 'STUDENT_NOT_FOUND', 'Aluno não encontrado', req.correlationId);
        return;
      }
      const row = await prisma.financialStatus.findUnique({ where: { studentId: student.id } });
      const data: FinancialStandingCheckDto = {
        studentUserId: parsed.data.studentUserId,
        status: row?.hasDebt ? 'BLOCKED' : 'ACTIVE',
        checkedAt: new Date().toISOString(),
      };
      sendSuccess(res, data, req.correlationId);
    },
  );

  return router;
}