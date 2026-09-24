"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHttpError = toHttpError;
exports.errorBody = errorBody;
exports.isPrismaUniqueViolation = isPrismaUniqueViolation;
const client_1 = require("@prisma/client");
const INTERNAL_MESSAGE = 'Erro interno do servidor';
function errorBody(code, message, details, correlationId) {
    return { code, message, details: details || [], correlationId };
}
function isPrismaUniqueViolation(error) {
    return error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
function toHttpError(error, correlationId) {
    if (isPrismaUniqueViolation(error)) {
        return {
            status: 409,
            body: errorBody('CONFLICT', 'Recurso duplicado: viola uma restrição única', [], correlationId),
        };
    }
    const domainErr = error;
    if (domainErr?.httpStatus && domainErr?.code) {
        return { status: domainErr.httpStatus, body: errorBody(domainErr.code, domainErr.message || '', domainErr.details || [], correlationId) };
    }
    const httpErr = error;
    if (Number.isInteger(httpErr?.status) || Number.isInteger(httpErr?.statusCode)) {
        const status = httpErr.status ?? httpErr.statusCode ?? 500;
        return { status, body: errorBody('BAD_REQUEST', httpErr.message || 'Requisição inválida', [], correlationId) };
    }
    return { status: 500, body: errorBody('INTERNAL_ERROR', INTERNAL_MESSAGE, [], correlationId) };
}
//# sourceMappingURL=httpError.js.map