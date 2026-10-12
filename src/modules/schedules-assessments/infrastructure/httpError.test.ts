import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { toHttpError, errorBody, isPrismaUniqueViolation } from './httpError';

/**
 * Tradução de erros para a resposta HTTP.
 *
 * A ordem das regras importa: um `DomainError` que já sabe o seu código e o seu
 * status tem prioridade sobre a forma genérica "objeto com `status`", e uma
 * violação de unicidade do Prisma tem de dar 409 e não 500. Um erro
 * desconhecido nunca pode vazar a mensagem original ao cliente.
 */

function prismaUniqueError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
  });
}

describe('errorBody', () => {
  it('devolve sempre a mesma forma, com details vazio quando não há', () => {
    expect(errorBody('NOT_FOUND', 'não existe', [], 'corr-1')).toEqual({
      code: 'NOT_FOUND',
      message: 'não existe',
      details: [],
      correlationId: 'corr-1',
    });
  });
});

describe('isPrismaUniqueViolation', () => {
  it('reconhece P2002 e recusa o resto', () => {
    expect(isPrismaUniqueViolation(prismaUniqueError())).toBe(true);
    expect(isPrismaUniqueViolation(new Error('P2002'))).toBe(false);
    expect(isPrismaUniqueViolation(null)).toBe(false);
    expect(isPrismaUniqueViolation(undefined)).toBe(false);
  });

  it('uma violação única do Prisma é 409 CONFLICT, nunca 500', () => {
    const mapped = toHttpError(prismaUniqueError(), 'corr-2');
    expect(mapped.status).toBe(409);
    expect(mapped.body.code).toBe('CONFLICT');
    expect(mapped.body.correlationId).toBe('corr-2');
  });

  it('outros erros do Prisma não são violações de unicidade e caem no 500 genérico', () => {
    const other = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '6.0.0',
    });
    expect(toHttpError(other, 'corr-3').status).toBe(500);
  });
});

describe('toHttpError — erros de domínio', () => {
  it('usa o status e o código do próprio DomainError', () => {
    const mapped = toHttpError({ httpStatus: 403, code: 'FORBIDDEN', message: 'Sem permissão' }, 'corr-4');
    expect(mapped).toEqual({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Sem permissão', details: [], correlationId: 'corr-4' },
    });
  });

  it('preserva os detalhes quando existem', () => {
    const mapped = toHttpError(
      { httpStatus: 409, code: 'CONFLICT', message: 'Conflito', details: [{ type: 'ROOM' }] },
      'corr-5',
    );
    expect(mapped.body.details).toEqual([{ type: 'ROOM' }]);
  });

  it('um DomainError sem mensagem não produz "undefined" na resposta', () => {
    expect(toHttpError({ httpStatus: 400, code: 'BAD_REQUEST' }, 'corr-6').body.message).toBe('');
  });

  it('um DomainError sem details devolve lista vazia, não undefined', () => {
    const mapped = toHttpError({ httpStatus: 400, code: 'BAD_REQUEST', message: 'x' }, 'corr-7');
    expect(mapped.body.details).toEqual([]);
  });

  it('um objecto com `status` mas sem `code` NÃO é tratado como erro de domínio', () => {
    const mapped = toHttpError({ httpStatus: 403, message: 'sem code' }, 'corr-8');
    expect(mapped.body.code).not.toBe('FORBIDDEN');
  });
});

describe('toHttpError — erros com forma HTTP', () => {
  it('reconhece `status` de libs de validação e devolve 400', () => {
    const mapped = toHttpError({ status: 422, message: 'campo inválido' }, 'corr-9');
    expect(mapped.status).toBe(422);
    expect(mapped.body.code).toBe('BAD_REQUEST');
    expect(mapped.body.message).toBe('campo inválido');
  });

  it('reconhece `statusCode`, a forma usada por jsonwebtoken e afins', () => {
    const mapped = toHttpError({ statusCode: 401, message: 'jwt expirado' }, 'corr-10');
    expect(mapped.status).toBe(401);
    expect(mapped.body.message).toBe('jwt expirado');
  });

  it('prefere `status` quando ambos estão presentes', () => {
    expect(toHttpError({ status: 400, statusCode: 500, message: 'x' }, 'corr-11').status).toBe(400);
  });

  it('uma forma HTTP sem mensagem não devolve undefined ao cliente', () => {
    expect(toHttpError({ status: 400 }, 'corr-12').body.message).toBe('Requisição inválida');
  });
});

describe('toHttpError — erros desconhecidos', () => {
  it('não vaza a mensagem interna: diz "erro interno" e nada mais', () => {
    const secret = 'connection string postgresql://utilizador:senha@host/';
    const mapped = toHttpError(new Error(secret), 'corr-13');
    expect(mapped.status).toBe(500);
    expect(mapped.body.code).toBe('INTERNAL_ERROR');
    expect(mapped.body.message).toBe('Erro interno do servidor');
    expect(JSON.stringify(mapped.body)).not.toContain('senha');
  });

  it('lida com null, undefined e valores primitivos sem rebentar', () => {
    for (const input of [null, undefined, 0, '', 'texto', false]) {
      const mapped = toHttpError(input, 'corr-14');
      expect(mapped.status).toBe(500);
      expect(mapped.body.code).toBe('INTERNAL_ERROR');
    }
  });

  it('um Error sem status nem code cai no 500 genérico', () => {
    expect(toHttpError(new TypeError('x is not a function'), 'corr-15').status).toBe(500);
  });

  it('o correlationId propaga-se em todos os caminhos', () => {
    expect(toHttpError(new Error('x'), 'corr-final').body.correlationId).toBe('corr-final');
  });
});