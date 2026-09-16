import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { SchedulesAssessmentsService, DomainError } from '../application/schedulesAssessmentsService';
import { toHttpError } from '../infrastructure/httpError';
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  assessmentQuerySchema,
  createGradeSchema,
  updateGradeSchema,
  createScheduleSchema,
  updateScheduleSchema,
  scheduleQuerySchema,
  createResultSchema,
  updateResultSchema,
  resultQuerySchema,
  calculationInputSchema,
  idParamsSchema,
  assessmentIdParamsSchema,
  gradeParamsSchema,
  classIdParamsSchema,
  printPautaQuerySchema,
  printScheduleQuerySchema,
} from '../schemas';
import { z } from 'zod';

interface CustomRequest extends Request {
  correlationId?: string;
}

function mapZodIssues(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

function success(res: Response, data: unknown, status: number, correlationId: string | undefined, pagination?: { page: number; pageSize: number; total: number }) {
  const body: { data: unknown; meta: Record<string, unknown> } = { data, meta: { correlationId } };
  if (pagination) {
    body.meta.page = pagination.page;
    body.meta.pageSize = pagination.pageSize;
    body.meta.total = pagination.total;
  }
  return res.status(status).json(body);
}

function listMeta(data: unknown[]): { page: number; pageSize: number; total: number } {
  return { page: 1, pageSize: data.length, total: data.length };
}

function paginate(data: unknown[], { page = 1, pageSize = 100 }: { page?: number; pageSize?: number } = {}): {
  rows: unknown[];
  meta: { page: number; pageSize: number; total: number };
} {
  page = Math.max(1, page);
  pageSize = Math.min(100, Math.max(1, pageSize));
  const total = data.length;
  const start = (page - 1) * pageSize;
  return { rows: data.slice(start, start + pageSize), meta: { page, pageSize, total } };
}

function validate<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new DomainError('VALIDATION_ERROR', 'Dados inválidos', mapZodIssues(result.error));
    error.httpStatus = 400;
    throw error;
  }
  return result.data;
}

export function createSchedulesAssessmentsRouter(): Router {
  const router = Router();
  const service = new SchedulesAssessmentsService();

  router.use((req: CustomRequest, res: Response, next: NextFunction) => {
    if (!req.correlationId) {
      req.correlationId = req.get('x-request-id') || randomUUID();
    }
    res.setHeader('x-request-id', req.correlationId);
    next();
  });

  const handler =
    (fn: (req: CustomRequest, res: Response) => Promise<unknown>) =>
    async (req: CustomRequest, res: Response) => {
      try {
        await fn(req, res);
      } catch (error) {
        const mapped = toHttpError(error, req.correlationId as string);
        res.status(mapped.status).json(mapped.body);
      }
    };

  router.get(
    '/assessments',
    handler(async (req, res) => {
      const query = validate(assessmentQuerySchema, req.query);
      const data = await service.listAssessments(query);
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.post(
    '/assessments',
    handler(async (req, res) => {
      const body = validate(createAssessmentSchema, req.body);
      const data = await service.createAssessment(body);
      return success(res, data, 201, req.correlationId);
    }),
  );

  router.get(
    '/assessments/:id',
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const data = await service.getAssessment(id);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.patch(
    '/assessments/:id',
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const body = validate(updateAssessmentSchema, req.body);
      const data = await service.updateAssessment(id, body);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.delete(
    '/assessments/:id',
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const data = await service.deleteAssessment(id);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/assessments/:assessmentId/grades',
    handler(async (req, res) => {
      const { assessmentId } = validate(assessmentIdParamsSchema, req.params);
      const data = await service.listGrades(assessmentId);
      return success(res, data, 200, req.correlationId, listMeta(data));
    }),
  );

  router.post(
    '/assessments/:assessmentId/grades',
    handler(async (req, res) => {
      const { assessmentId } = validate(assessmentIdParamsSchema, req.params);
      const body = validate(createGradeSchema, req.body);
      const data = await service.createGrade(assessmentId, body);
      return success(res, data, 201, req.correlationId);
    }),
  );

  router.patch(
    '/assessments/:assessmentId/grades/:gradeId',
    handler(async (req, res) => {
      const { assessmentId, gradeId } = validate(gradeParamsSchema, req.params);
      const body = validate(updateGradeSchema, req.body);
      const data = await service.updateGrade(assessmentId, gradeId, body);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/schedules',
    handler(async (req, res) => {
      const query = validate(scheduleQuerySchema, req.query);
      const data = await service.listSchedules(query);
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.post(
    '/schedules',
    handler(async (req, res) => {
      const body = validate(createScheduleSchema, req.body);
      const data = await service.createSchedule(body);
      return success(res, data, 201, req.correlationId);
    }),
  );

  router.get(
    '/schedules/:id',
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const data = await service.getSchedule(id);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.patch(
    '/schedules/:id',
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const body = validate(updateScheduleSchema, req.body);
      const data = await service.updateSchedule(id, body);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.delete(
    '/schedules/:id',
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const data = await service.deleteSchedule(id);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/results',
    handler(async (req, res) => {
      const query = validate(resultQuerySchema, req.query);
      const data = await service.listResults(query);
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.get(
    '/results/calculation-methods',
    handler(async (_req, res) => {
      const data = service.listCalculationMethods();
      return success(res, data, 200, _req.correlationId);
    }),
  );

  router.post(
    '/results/calculate',
    handler(async (req, res) => {
      const body = validate(calculationInputSchema, req.body);
      const data = await service.calculateResult(body);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/results/:id',
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const data = await service.getResult(id);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.post(
    '/results',
    handler(async (req, res) => {
      const body = validate(createResultSchema, req.body);
      const data = await service.createResults(body);
      return success(res, data, 201, req.correlationId);
    }),
  );

  router.patch(
    '/results/:id',
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      validate(updateResultSchema, req.body);
      const data = await service.patchResult(id);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.delete(
    '/results/:id',
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const data = await service.deleteResult(id);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/print/class/:classId/schedule',
    handler(async (req, res) => {
      const { classId } = validate(classIdParamsSchema, req.params);
      const query = validate(printScheduleQuerySchema, req.query);
      const data = await service.getPrintClassSchedule(classId, query.termId);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/print/class/:classId/pauta',
    handler(async (req, res) => {
      const { classId } = validate(classIdParamsSchema, req.params);
      const query = validate(printPautaQuerySchema, req.query);
      const data = await service.getPrintClassPauta(classId, query.termId, query.subjectId);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.use((req: CustomRequest, res: Response) => {
    const mapped = toHttpError(new DomainError('NOT_FOUND', 'Recurso não encontrado'), req.correlationId as string);
    res.status(mapped.status).json(mapped.body);
  });

  return router;
}

export { SchedulesAssessmentsService, DomainError };