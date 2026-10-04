import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { requireRoles, AuthRequest as AuthRequestBase } from '@smartcampus/auth';
import { SchedulesAssessmentsService, DomainError } from '../application/schedulesAssessmentsService';
import { AuthService } from '../application/authService';
import { createG3AuthMiddleware, createG3Auth, requestContextOf, type G3Auth } from '../infrastructure/auth/authMiddleware';
import { accessRule, isSuperAdmin, type HttpMethod } from '../infrastructure/auth/routeAccess';
import { enforcePossession, assertStudentOwnsResource } from '../infrastructure/auth/accessPolicy';
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
  catalogQuerySchema,
  calculationInputSchema,
  idParamsSchema,
  assessmentIdParamsSchema,
  gradeParamsSchema,
  classIdParamsSchema,
  printPautaQuerySchema,
  printScheduleQuerySchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from '../schemas';
import { z } from 'zod';

interface CustomRequest extends AuthRequestBase {
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

export function createSchedulesAssessmentsRouter(
  options: { service?: SchedulesAssessmentsService; authService?: AuthService; auth?: G3Auth } = {},
): Router {
  const router = Router();
  const service = options.service ?? new SchedulesAssessmentsService();
  const authService = options.authService ?? new AuthService();
  const g3Auth = options.auth ?? createG3Auth();
  const identity = g3Auth.identity;
  const coreOwnsAuth = !identity.ownsAuthRoutes;

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

  const ctxOf = (req: CustomRequest) => ({
    token: (req.auth as { token: string }).token,
    correlationId: req.correlationId as string,
    userId: (req.auth as { userId: string }).userId,
    role: (req.auth as { role: string }).role,
  });

  const guard = (method: HttpMethod, path: string) => requireRoles(...accessRule(method, path).roles);

  const enforce = (method: HttpMethod, path: string) => async (req: CustomRequest) =>
    enforcePossession(service, accessRule(method, path), {
      method,
      path,
      params: req.params as Record<string, string | undefined>,
      query: req.query as Record<string, unknown>,
      ctx: ctxOf(req),
    });

  const reqMeta = (req: CustomRequest) => ({
    userAgent: (req.get('user-agent') as string | undefined) ?? undefined,
    ipAddress: req.ip,
  });

  const schoolScope = (req: CustomRequest): { schoolId?: string } => {
    const auth = req.auth as { role?: string; schoolId?: string } | undefined;
    if (!auth?.schoolId || isSuperAdmin(auth.role ?? '')) {
      return {};
    }
    return { schoolId: auth.schoolId };
  };

  router.use((req: CustomRequest, res: Response, next: NextFunction) => {
    if (!req.correlationId) {
      req.correlationId = req.get('x-request-id') || randomUUID();
    }
    res.setHeader('x-request-id', req.correlationId);
    next();
  });

  router.post(
    '/auth/login',
    handler(async (req: CustomRequest, res: Response) => {
      const body = validate(loginSchema, req.body);
      const data = coreOwnsAuth
        ? await identity.login(body, requestContextOf(req))
        : await authService.login(body, reqMeta(req));
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.post(
    '/auth/refresh',
    handler(async (req: CustomRequest, res: Response) => {
      const body = validate(refreshSchema, req.body);
      const data = coreOwnsAuth
        ? await identity.refresh(body.refreshToken, requestContextOf(req))
        : await authService.refresh(body.refreshToken, reqMeta(req));
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.use(g3Auth.middleware);

  router.post(
    '/auth/logout',
    guard('POST', '/auth/logout'),
    handler(async (req: CustomRequest, res: Response) => {
      const body = validate(logoutSchema, req.body);
      const userId = (req.auth as { userId: string }).userId;
      const data = coreOwnsAuth
        ? await identity.logout(body.refreshToken, userId, requestContextOf(req))
        : await authService.logout(body.refreshToken, userId);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/me/financial-status',
    guard('GET', '/me/financial-status'),
    handler(async (req: CustomRequest, res: Response) => {
      const scope = await enforce('GET', '/me/financial-status')(req);
      const data = await service.getMyFinancialStanding(ctxOf(req), scope.studentId);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/assessments',
    guard('GET', '/assessments'),
    handler(async (req, res) => {
      const query = validate(assessmentQuerySchema, req.query);
      const scope = await enforce('GET', '/assessments')(req);
      const filters = scope.studentId
        ? { ...query, classId: query.classId ?? scope.classId, classIds: query.classId ? undefined : scope.classIds }
        : query;
      const data = await service.listAssessments(filters);
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.post(
    '/assessments',
    guard('POST', '/assessments'),
    handler(async (req, res) => {
      const body = validate(createAssessmentSchema, req.body);
      const data = await service.createAssessment(body, ctxOf(req));
      return success(res, data, 201, req.correlationId);
    }),
  );

  router.get(
    '/assessments/:id',
    guard('GET', '/assessments/:id'),
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      await enforce('GET', '/assessments/:id')(req);
      const data = await service.getAssessment(id);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.patch(
    '/assessments/:id',
    guard('PATCH', '/assessments/:id'),
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const body = validate(updateAssessmentSchema, req.body);
      const data = await service.updateAssessment(id, body, ctxOf(req));
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.delete(
    '/assessments/:id',
    guard('DELETE', '/assessments/:id'),
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const data = await service.deleteAssessment(id, ctxOf(req));
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/assessments/:assessmentId/grades',
    guard('GET', '/assessments/:assessmentId/grades'),
    handler(async (req, res) => {
      const { assessmentId } = validate(assessmentIdParamsSchema, req.params);
      const scope = await enforce('GET', '/assessments/:assessmentId/grades')(req);
      const all = await service.listGrades(assessmentId);
      const data = scope.studentId
        ? all.filter((row: { studentId: string }) => row.studentId === scope.studentId)
        : all;
      return success(res, data, 200, req.correlationId, listMeta(data));
    }),
  );

  router.post(
    '/assessments/:assessmentId/grades',
    guard('POST', '/assessments/:assessmentId/grades'),
    handler(async (req, res) => {
      const { assessmentId } = validate(assessmentIdParamsSchema, req.params);
      const body = validate(createGradeSchema, req.body);
      const data = await service.createGrade(assessmentId, body, ctxOf(req));
      return success(res, data, 201, req.correlationId);
    }),
  );

  router.patch(
    '/assessments/:assessmentId/grades/:gradeId',
    guard('PATCH', '/assessments/:assessmentId/grades/:gradeId'),
    handler(async (req, res) => {
      const { assessmentId, gradeId } = validate(gradeParamsSchema, req.params);
      const body = validate(updateGradeSchema, req.body);
      const data = await service.updateGrade(assessmentId, gradeId, body, ctxOf(req));
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/schedules',
    guard('GET', '/schedules'),
    handler(async (req, res) => {
      const query = validate(scheduleQuerySchema, req.query);
      const scope = await enforce('GET', '/schedules')(req);
      const data = await service.listSchedules({
        ...query,
        classId: query.classId ?? scope.classId,
        studentId: scope.studentId ?? query.studentId,
      });
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.post(
    '/schedules',
    guard('POST', '/schedules'),
    handler(async (req, res) => {
      const body = validate(createScheduleSchema, req.body);
      const data = await service.createSchedule(body, ctxOf(req));
      return success(res, data, 201, req.correlationId);
    }),
  );

  router.get(
    '/schedules/:id',
    guard('GET', '/schedules/:id'),
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      await enforce('GET', '/schedules/:id')(req);
      const data = await service.getSchedule(id);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.patch(
    '/schedules/:id',
    guard('PATCH', '/schedules/:id'),
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const body = validate(updateScheduleSchema, req.body);
      const data = await service.updateSchedule(id, body, ctxOf(req));
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.delete(
    '/schedules/:id',
    guard('DELETE', '/schedules/:id'),
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const data = await service.deleteSchedule(id, ctxOf(req));
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/results',
    guard('GET', '/results'),
    handler(async (req, res) => {
      const query = validate(resultQuerySchema, req.query);
      const scope = await enforce('GET', '/results')(req);
      const data = await service.listResults({ ...query, studentId: scope.studentId ?? query.studentId });
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.get(
    '/results/calculation-methods',
    guard('GET', '/results/calculation-methods'),
    handler(async (_req, res) => {
      const data = service.listCalculationMethods();
      return success(res, data, 200, _req.correlationId);
    }),
  );

  router.post(
    '/results/calculate',
    guard('POST', '/results/calculate'),
    handler(async (req, res) => {
      const body = validate(calculationInputSchema, req.body);
      const data = await service.calculateResult(body);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/results/:id',
    guard('GET', '/results/:id'),
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const scope = await enforce('GET', '/results/:id')(req);
      const data = await service.getResult(id);
      if (scope.studentId) {
        assertStudentOwnsResource(data.studentId, scope.studentId);
      }
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.post(
    '/results',
    guard('POST', '/results'),
    handler(async (req, res) => {
      const body = validate(createResultSchema, req.body);
      const { results, blockedByDebt } = await service.createResults(body, ctxOf(req));
      const meta: Record<string, unknown> = { correlationId: req.correlationId };
      if (blockedByDebt.length > 0) {
        meta.blockedByDebt = blockedByDebt;
      }
      return res.status(201).json({ data: results, meta });
    }),
  );

  router.patch(
    '/results/:id',
    guard('PATCH', '/results/:id'),
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      validate(updateResultSchema, req.body);
      const data = await service.patchResult(id, ctxOf(req));
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.delete(
    '/results/:id',
    guard('DELETE', '/results/:id'),
    handler(async (req, res) => {
      const { id } = validate(idParamsSchema, req.params);
      const data = await service.deleteResult(id, ctxOf(req));
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/print/class/:classId/schedule',
    guard('GET', '/print/class/:classId/schedule'),
    handler(async (req, res) => {
      const { classId } = validate(classIdParamsSchema, req.params);
      const query = validate(printScheduleQuerySchema, req.query);
      await enforce('GET', '/print/class/:classId/schedule')(req);
      const data = await service.getPrintClassSchedule(classId, query.termId);
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/print/class/:classId/pauta',
    guard('GET', '/print/class/:classId/pauta'),
    handler(async (req, res) => {
      const { classId } = validate(classIdParamsSchema, req.params);
      const query = validate(printPautaQuerySchema, req.query);
      const scope = await enforce('GET', '/print/class/:classId/pauta')(req);
      const data = await service.getPrintClassPauta(
        classId,
        query.termId,
        query.subjectId,
        ctxOf(req),
        scope.studentId,
      );
      return success(res, data, 200, req.correlationId);
    }),
  );

  router.get(
    '/schools',
    guard('GET', '/schools'),
    handler(async (req, res) => {
      const query = validate(catalogQuerySchema, req.query);
      const data = await service.listSchools();
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.get(
    '/academic-years',
    guard('GET', '/academic-years'),
    handler(async (req, res) => {
      const query = validate(catalogQuerySchema, req.query);
      const data = await service.listAcademicYears(schoolScope(req));
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.get(
    '/terms',
    guard('GET', '/terms'),
    handler(async (req, res) => {
      const query = validate(catalogQuerySchema, req.query);
      const data = await service.listTerms({ academicYearId: query.academicYearId, ...schoolScope(req) });
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.get(
    '/classes',
    guard('GET', '/classes'),
    handler(async (req, res) => {
      const query = validate(catalogQuerySchema, req.query);
      const data = await service.listClasses({ termId: query.termId, academicYearId: query.academicYearId, ...schoolScope(req) });
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.get(
    '/subjects',
    guard('GET', '/subjects'),
    handler(async (req, res) => {
      const query = validate(catalogQuerySchema, req.query);
      const data = await service.listSubjects(schoolScope(req));
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.get(
    '/teachers',
    guard('GET', '/teachers'),
    handler(async (req, res) => {
      const query = validate(catalogQuerySchema, req.query);
      const data = await service.listTeachers();
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.get(
    '/students',
    guard('GET', '/students'),
    handler(async (req, res) => {
      const query = validate(catalogQuerySchema, req.query);
      const data = await service.listStudents({ classId: query.classId, termId: query.termId });
      const { rows, meta } = paginate(data, query);
      return success(res, rows, 200, req.correlationId, meta);
    }),
  );

  router.use((req: CustomRequest, res: Response) => {
    const mapped = toHttpError(new DomainError('NOT_FOUND', 'Recurso não encontrado'), req.correlationId as string);
    res.status(mapped.status).json(mapped.body);
  });

  return router;
}

export { SchedulesAssessmentsService, DomainError };