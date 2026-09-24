"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainError = exports.SchedulesAssessmentsService = void 0;
exports.createSchedulesAssessmentsRouter = createSchedulesAssessmentsRouter;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const schedulesAssessmentsService_1 = require("../application/schedulesAssessmentsService");
Object.defineProperty(exports, "SchedulesAssessmentsService", { enumerable: true, get: function () { return schedulesAssessmentsService_1.SchedulesAssessmentsService; } });
Object.defineProperty(exports, "DomainError", { enumerable: true, get: function () { return schedulesAssessmentsService_1.DomainError; } });
const httpError_1 = require("../infrastructure/httpError");
const schemas_1 = require("../schemas");
function mapZodIssues(error) {
    return error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
    }));
}
function success(res, data, status, correlationId, pagination) {
    const body = { data, meta: { correlationId } };
    if (pagination) {
        body.meta.page = pagination.page;
        body.meta.pageSize = pagination.pageSize;
        body.meta.total = pagination.total;
    }
    return res.status(status).json(body);
}
function listMeta(data) {
    return { page: 1, pageSize: data.length, total: data.length };
}
function paginate(data, { page = 1, pageSize = 100 } = {}) {
    page = Math.max(1, page);
    pageSize = Math.min(100, Math.max(1, pageSize));
    const total = data.length;
    const start = (page - 1) * pageSize;
    return { rows: data.slice(start, start + pageSize), meta: { page, pageSize, total } };
}
function validate(schema, value) {
    const result = schema.safeParse(value);
    if (!result.success) {
        const error = new schedulesAssessmentsService_1.DomainError('VALIDATION_ERROR', 'Dados inválidos', mapZodIssues(result.error));
        error.httpStatus = 400;
        throw error;
    }
    return result.data;
}
function createSchedulesAssessmentsRouter() {
    const router = (0, express_1.Router)();
    const service = new schedulesAssessmentsService_1.SchedulesAssessmentsService();
    router.use((req, res, next) => {
        if (!req.correlationId) {
            req.correlationId = req.get('x-request-id') || (0, node_crypto_1.randomUUID)();
        }
        res.setHeader('x-request-id', req.correlationId);
        next();
    });
    const handler = (fn) => async (req, res) => {
        try {
            await fn(req, res);
        }
        catch (error) {
            const mapped = (0, httpError_1.toHttpError)(error, req.correlationId);
            res.status(mapped.status).json(mapped.body);
        }
    };
    router.get('/assessments', handler(async (req, res) => {
        const query = validate(schemas_1.assessmentQuerySchema, req.query);
        const data = await service.listAssessments(query);
        const { rows, meta } = paginate(data, query);
        return success(res, rows, 200, req.correlationId, meta);
    }));
    router.post('/assessments', handler(async (req, res) => {
        const body = validate(schemas_1.createAssessmentSchema, req.body);
        const data = await service.createAssessment(body);
        return success(res, data, 201, req.correlationId);
    }));
    router.get('/assessments/:id', handler(async (req, res) => {
        const { id } = validate(schemas_1.idParamsSchema, req.params);
        const data = await service.getAssessment(id);
        return success(res, data, 200, req.correlationId);
    }));
    router.patch('/assessments/:id', handler(async (req, res) => {
        const { id } = validate(schemas_1.idParamsSchema, req.params);
        const body = validate(schemas_1.updateAssessmentSchema, req.body);
        const data = await service.updateAssessment(id, body);
        return success(res, data, 200, req.correlationId);
    }));
    router.delete('/assessments/:id', handler(async (req, res) => {
        const { id } = validate(schemas_1.idParamsSchema, req.params);
        const data = await service.deleteAssessment(id);
        return success(res, data, 200, req.correlationId);
    }));
    router.get('/assessments/:assessmentId/grades', handler(async (req, res) => {
        const { assessmentId } = validate(schemas_1.assessmentIdParamsSchema, req.params);
        const data = await service.listGrades(assessmentId);
        return success(res, data, 200, req.correlationId, listMeta(data));
    }));
    router.post('/assessments/:assessmentId/grades', handler(async (req, res) => {
        const { assessmentId } = validate(schemas_1.assessmentIdParamsSchema, req.params);
        const body = validate(schemas_1.createGradeSchema, req.body);
        const data = await service.createGrade(assessmentId, body);
        return success(res, data, 201, req.correlationId);
    }));
    router.patch('/assessments/:assessmentId/grades/:gradeId', handler(async (req, res) => {
        const { assessmentId, gradeId } = validate(schemas_1.gradeParamsSchema, req.params);
        const body = validate(schemas_1.updateGradeSchema, req.body);
        const data = await service.updateGrade(assessmentId, gradeId, body);
        return success(res, data, 200, req.correlationId);
    }));
    router.get('/schedules', handler(async (req, res) => {
        const query = validate(schemas_1.scheduleQuerySchema, req.query);
        const data = await service.listSchedules(query);
        const { rows, meta } = paginate(data, query);
        return success(res, rows, 200, req.correlationId, meta);
    }));
    router.post('/schedules', handler(async (req, res) => {
        const body = validate(schemas_1.createScheduleSchema, req.body);
        const data = await service.createSchedule(body);
        return success(res, data, 201, req.correlationId);
    }));
    router.get('/schedules/:id', handler(async (req, res) => {
        const { id } = validate(schemas_1.idParamsSchema, req.params);
        const data = await service.getSchedule(id);
        return success(res, data, 200, req.correlationId);
    }));
    router.patch('/schedules/:id', handler(async (req, res) => {
        const { id } = validate(schemas_1.idParamsSchema, req.params);
        const body = validate(schemas_1.updateScheduleSchema, req.body);
        const data = await service.updateSchedule(id, body);
        return success(res, data, 200, req.correlationId);
    }));
    router.delete('/schedules/:id', handler(async (req, res) => {
        const { id } = validate(schemas_1.idParamsSchema, req.params);
        const data = await service.deleteSchedule(id);
        return success(res, data, 200, req.correlationId);
    }));
    router.get('/results', handler(async (req, res) => {
        const query = validate(schemas_1.resultQuerySchema, req.query);
        const data = await service.listResults(query);
        const { rows, meta } = paginate(data, query);
        return success(res, rows, 200, req.correlationId, meta);
    }));
    router.get('/results/calculation-methods', handler(async (_req, res) => {
        const data = service.listCalculationMethods();
        return success(res, data, 200, _req.correlationId);
    }));
    router.post('/results/calculate', handler(async (req, res) => {
        const body = validate(schemas_1.calculationInputSchema, req.body);
        const data = await service.calculateResult(body);
        return success(res, data, 200, req.correlationId);
    }));
    router.get('/results/:id', handler(async (req, res) => {
        const { id } = validate(schemas_1.idParamsSchema, req.params);
        const data = await service.getResult(id);
        return success(res, data, 200, req.correlationId);
    }));
    router.post('/results', handler(async (req, res) => {
        const body = validate(schemas_1.createResultSchema, req.body);
        const data = await service.createResults(body);
        return success(res, data, 201, req.correlationId);
    }));
    router.patch('/results/:id', handler(async (req, res) => {
        const { id } = validate(schemas_1.idParamsSchema, req.params);
        validate(schemas_1.updateResultSchema, req.body);
        const data = await service.patchResult(id);
        return success(res, data, 200, req.correlationId);
    }));
    router.delete('/results/:id', handler(async (req, res) => {
        const { id } = validate(schemas_1.idParamsSchema, req.params);
        const data = await service.deleteResult(id);
        return success(res, data, 200, req.correlationId);
    }));
    router.get('/print/class/:classId/schedule', handler(async (req, res) => {
        const { classId } = validate(schemas_1.classIdParamsSchema, req.params);
        const query = validate(schemas_1.printScheduleQuerySchema, req.query);
        const data = await service.getPrintClassSchedule(classId, query.termId);
        return success(res, data, 200, req.correlationId);
    }));
    router.get('/print/class/:classId/pauta', handler(async (req, res) => {
        const { classId } = validate(schemas_1.classIdParamsSchema, req.params);
        const query = validate(schemas_1.printPautaQuerySchema, req.query);
        const data = await service.getPrintClassPauta(classId, query.termId, query.subjectId);
        return success(res, data, 200, req.correlationId);
    }));
    router.use((req, res) => {
        const mapped = (0, httpError_1.toHttpError)(new schedulesAssessmentsService_1.DomainError('NOT_FOUND', 'Recurso não encontrado'), req.correlationId);
        res.status(mapped.status).json(mapped.body);
    });
    return router;
}
//# sourceMappingURL=schedulesAssessmentsRouter.js.map