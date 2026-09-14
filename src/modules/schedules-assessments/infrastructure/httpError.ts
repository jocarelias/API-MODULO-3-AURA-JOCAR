import { Prisma, PrismaClient } from '@prisma/client';

const INTERNAL_MESSAGE = 'Erro interno do servidor';

interface HttpErrorBody {
  code: string;
  message: string;
  details: unknown[];
  correlationId: string;
}

function errorBody(code: string, message: string, details: unknown[], correlationId: string): HttpErrorBody {
  return { code, message, details: details || [], correlationId };
}

function isPrismaUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

interface DomainLike {
  httpStatus?: number;
  code?: string;
  message?: string;
  details?: unknown[];
}

export function toHttpError(error: unknown, correlationId: string): { status: number; body: HttpErrorBody } {
  if (isPrismaUniqueViolation(error)) {
    return {
      status: 409,
      body: errorBody('CONFLICT', 'Recurso duplicado: viola uma restrição única', [], correlationId),
    };
  }

  const domainErr = error as DomainLike;
  if (domainErr?.httpStatus && domainErr?.code) {
    return { status: domainErr.httpStatus, body: errorBody(domainErr.code, domainErr.message || '', domainErr.details || [], correlationId) };
  }

  const httpErr = error as { status?: number; statusCode?: number; message?: string };
  if (Number.isInteger(httpErr?.status) || Number.isInteger(httpErr?.statusCode)) {
    const status = httpErr.status ?? httpErr.statusCode ?? 500;
    return { status, body: errorBody('BAD_REQUEST', httpErr.message || 'Requisição inválida', [], correlationId) };
  }

  return { status: 500, body: errorBody('INTERNAL_ERROR', INTERNAL_MESSAGE, [], correlationId) };
}

export { errorBody, isPrismaUniqueViolation };
