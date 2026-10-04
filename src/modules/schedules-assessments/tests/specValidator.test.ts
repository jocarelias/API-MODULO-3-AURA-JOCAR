import { describe, expect, it } from 'vitest';
import { expectConforms, formatViolations, validateAgainstSchema } from './specValidator';

const UUID = '02e95780-9708-48e6-bced-d8607a61fa5a';

describe('validateAgainstSchema — tipos', () => {
  it('aceita o valor correcto de cada tipo', () => {
    expect(validateAgainstSchema('texto', { type: 'string' })).toEqual([]);
    expect(validateAgainstSchema(7, { type: 'integer' })).toEqual([]);
    expect(validateAgainstSchema(7.5, { type: 'number' })).toEqual([]);
    expect(validateAgainstSchema(7, { type: 'number' })).toEqual([]);
    expect(validateAgainstSchema(true, { type: 'boolean' })).toEqual([]);
    expect(validateAgainstSchema([], { type: 'array' })).toEqual([]);
    expect(validateAgainstSchema({}, { type: 'object' })).toEqual([]);
  });

  it('rejeita o tipo errado com mensagem legível', () => {
    const [violation] = validateAgainstSchema('7', { type: 'integer' });
    expect(violation.message).toContain('tipo esperado integer, recebido string');
  });

  it('trata null como tipo próprio', () => {
    expect(validateAgainstSchema(null, { type: 'string' })[0].message).toContain('nulo');
  });

  it('aceita null quando nullable', () => {
    expect(validateAgainstSchema(null, { type: 'string', nullable: true })).toEqual([]);
  });
});

describe('validateAgainstSchema — enum e format', () => {
  it('valida enums', () => {
    expect(validateAgainstSchema('ACTIVE', { type: 'string', enum: ['ACTIVE', 'BLOCKED'] })).toEqual([]);
    expect(validateAgainstSchema('PAGO', { type: 'string', enum: ['ACTIVE', 'BLOCKED'] })[0].message).toContain('fora do enum');
  });

  it('valida uuid e date-time', () => {
    expect(validateAgainstSchema(UUID, { type: 'string', format: 'uuid' })).toEqual([]);
    expect(validateAgainstSchema('123', { type: 'string', format: 'uuid' })[0].message).toContain('uuid');
    expect(validateAgainstSchema('2026-03-14T09:00:00.000Z', { type: 'string', format: 'date-time' })).toEqual([]);
    expect(validateAgainstSchema('14/03/2026', { type: 'string', format: 'date-time' })[0].message).toContain('date-time');
  });

  it('valida email e hora HH:MM', () => {
    expect(validateAgainstSchema('a@b.co', { type: 'string', format: 'email' })).toEqual([]);
    expect(validateAgainstSchema('a@b', { type: 'string', format: 'email' })[0].message).toContain('email');
    expect(validateAgainstSchema('08:00', { type: 'string', format: 'time' })).toEqual([]);
    expect(validateAgainstSchema('25:00', { type: 'string', format: 'time' })[0].message).toContain('HH:MM');
  });
});

describe('validateAgainstSchema — objectos e arrays', () => {
  const schema = {
    type: 'object' as const,
    required: ['id', 'score'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      score: { type: 'number' },
      comment: { type: 'string', nullable: true },
    },
  };

  it('aceita um objecto conforme', () => {
    expect(validateAgainstSchema({ id: UUID, score: 17.5 }, schema)).toEqual([]);
  });

  it('detecta campos obrigatórios em falta', () => {
    const violations = validateAgainstSchema({ id: UUID }, schema);
    expect(violations).toHaveLength(1);
    expect(violations[0].pointer).toBe('$.score');
    expect(violations[0].message).toContain('obrigatório');
  });

  it('detecta campos obrigatórios presentes mas undefined', () => {
    expect(validateAgainstSchema({ id: UUID, score: undefined }, schema)[0].message).toContain('obrigatório');
  });

  it('ignora campos opcionais ausentes', () => {
    expect(validateAgainstSchema({ id: UUID, score: 1 }, schema)).toEqual([]);
  });

  it('reporta o caminho exacto de um erro aninhado', () => {
    const nested = { type: 'object', properties: { rows: { type: 'array', items: { type: 'object', required: ['studentId'], properties: { studentId: { type: 'string', format: 'uuid' } } } } } };
    const violations = validateAgainstSchema({ rows: [{ studentId: UUID }, { studentId: 'nope' }] }, nested);
    expect(violations).toHaveLength(1);
    expect(violations[0].pointer).toBe('$.rows[1].studentId');
  });

  it('valida cada item de um array', () => {
    const violations = validateAgainstSchema([1, 'dois'], { type: 'array', items: { type: 'integer' } });
    expect(violations).toHaveLength(1);
    expect(violations[0].pointer).toBe('$[1]');
  });

  it('rejeita campos não documentados quando additionalProperties é false', () => {
    const closed = { type: 'object' as const, properties: { a: { type: 'string' } }, additionalProperties: false };
    expect(validateAgainstSchema({ a: 'x' }, closed)).toEqual([]);
    expect(validateAgainstSchema({ a: 'x', b: 'y' }, closed)[0].message).toContain('não documentado: b');
  });

  it('valida properties livres quando additionalProperties é um schema', () => {
    const details = { type: 'object', properties: { details: { type: 'array', items: { type: 'object', additionalProperties: { type: 'string' } } } } };
    expect(validateAgainstSchema({ details: [{ path: 'weight' }] }, details)).toEqual([]);
    expect(validateAgainstSchema({ details: [{ path: 7 }] }, details)).toHaveLength(1);
  });
});

describe('validateAgainstSchema — accumulates', () => {
  it('reporta todas as violações de uma vez, não só a primeira', () => {
    const violations = validateAgainstSchema(
      { studentId: 'x', score: 'dez' },
      { type: 'object', required: ['studentId', 'score', 'absent'], properties: { studentId: { type: 'string', format: 'uuid' }, score: { type: 'number' } } },
    );
    expect(violations.length).toBeGreaterThanOrEqual(3);
  });

  it('formatViolations produz uma linha por violação', () => {
    const text = formatViolations([
      { pointer: '$.a', message: 'primeiro' },
      { pointer: '$.b', message: 'segundo' },
    ]);
    expect(text.split('\n')).toEqual(['$.a: primeiro', '$.b: segundo']);
  });

  it('não valida quando não há schema', () => {
    expect(validateAgainstSchema({ qualquer: 1 }, undefined)).toEqual([]);
  });
});

describe('expectConforms', () => {
  it('não lança quando o valor é conforme', () => {
    expect(() => expectConforms({ a: 1 }, { type: 'object', required: ['a'], properties: { a: { type: 'integer' } } }, 'contexto')).not.toThrow();
  });

  it('lança com o contexto e a lista de violações', () => {
    expect(() => expectConforms({}, { type: 'object', required: ['a'] }, 'GET /notas')).toThrow(/GET \/notas não conforme o spec/);
  });
});
