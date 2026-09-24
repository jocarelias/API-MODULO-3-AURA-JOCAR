"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusModules = exports.SmartCampusApiClient = exports.ApiError = void 0;
const shared_types_1 = require("@smartcampus/shared-types");
Object.defineProperty(exports, "campusModules", { enumerable: true, get: function () { return shared_types_1.campusModules; } });
const G3 = shared_types_1.campusModules.G3_AVALIACOES_HORARIOS;
class ApiError extends Error {
    status;
    code;
    details;
    correlationId;
    constructor(status, code, message, details = [], correlationId) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
        this.correlationId = correlationId;
    }
}
exports.ApiError = ApiError;
class SmartCampusApiClient {
    baseUrl;
    timeoutMs;
    constructor({ baseUrl = process.env.G3_API_URL || 'http://localhost:4100', timeoutMs = 10000 } = {}) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.timeoutMs = timeoutMs;
    }
    async request(method, path, body, query = {}) {
        const url = new URL(`${this.baseUrl}${G3.basePath}${path}`);
        const searchParams = Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '');
        for (const [key, value] of searchParams) {
            url.searchParams.set(key, String(value));
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const options = { method, headers: {}, signal: controller.signal };
        if (body !== undefined) {
            options.headers['content-type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        let response;
        try {
            response = await fetch(url, options);
        }
        finally {
            clearTimeout(timer);
        }
        const payload = (await response.json().catch(() => null));
        if (!payload) {
            throw new ApiError(response.status, 'INVALID_RESPONSE', 'Resposta sem corpo JSON', [], '');
        }
        if (!response.ok) {
            throw new ApiError(response.status, payload.code || 'UNKNOWN_ERROR', payload.message || 'Erro na chamada à API', payload.details || [], payload.correlationId || '');
        }
        return payload.data;
    }
    get(path, query = {}) {
        return this.request('GET', path, undefined, query);
    }
    post(path, body) {
        return this.request('POST', path, body);
    }
    patch(path, body = {}) {
        return this.request('PATCH', path, body);
    }
    delete(path) {
        return this.request('DELETE', path);
    }
    listAssessments(query = {}) {
        return this.get('/assessments', query);
    }
    getAssessment(id) {
        return this.get(`/assessments/${id}`);
    }
    createAssessment(payload) {
        return this.post('/assessments', payload);
    }
    updateAssessment(id, payload) {
        return this.patch(`/assessments/${id}`, payload);
    }
    deleteAssessment(id) {
        return this.delete(`/assessments/${id}`);
    }
    listGrades(assessmentId) {
        return this.get(`/assessments/${assessmentId}/grades`);
    }
    createGrade(assessmentId, payload) {
        return this.post(`/assessments/${assessmentId}/grades`, payload);
    }
    updateGrade(assessmentId, gradeId, payload) {
        return this.patch(`/assessments/${assessmentId}/grades/${gradeId}`, payload);
    }
    listSchedules(query = {}) {
        return this.get('/schedules', query);
    }
    getSchedule(id) {
        return this.get(`/schedules/${id}`);
    }
    createSchedule(payload) {
        return this.post('/schedules', payload);
    }
    updateSchedule(id, payload) {
        return this.patch(`/schedules/${id}`, payload);
    }
    deleteSchedule(id) {
        return this.delete(`/schedules/${id}`);
    }
    listResults(query = {}) {
        return this.get('/results', query);
    }
    getResult(id) {
        return this.get(`/results/${id}`);
    }
    createResults(payload) {
        return this.post('/results', payload);
    }
    deleteResult(id) {
        return this.delete(`/results/${id}`);
    }
    patchResult(id) {
        return this.patch(`/results/${id}`);
    }
    updateResult(id, payload = {}) {
        return this.patch(`/results/${id}`, payload);
    }
    printClassSchedule(classId, { termId } = {}) {
        return this.get(`/print/class/${classId}/schedule`, { termId });
    }
    printClassPauta(classId, { termId, subjectId } = {}) {
        return this.get(`/print/class/${classId}/pauta`, { termId, subjectId });
    }
    listCalculationMethods() {
        return this.get('/results/calculation-methods');
    }
    calculate(payload) {
        return this.post('/results/calculate', payload);
    }
}
exports.SmartCampusApiClient = SmartCampusApiClient;
//# sourceMappingURL=index.js.map