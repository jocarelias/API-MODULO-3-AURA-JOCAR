/**
 * Validador mínimo de JSON Schema, guiado pelo OpenAPI.
 *
 * Existe para que os testes de conformidade do Módulo VI não repitam as
 * expectativas "à mão": eles validam a resposta real usando o schema que está
 * no `docs/openapi.yaml`. Se o spec mente sobre um campo, o teste falha — que
 * é exactamente o objectivo do exercício.
 *
 * Suporta o subconjunto usado pelo spec: type, enum, format, required,
 * properties, items, additionalProperties e nullable.
 */

export interface SchemaLike {
  type?: string | string[];
  enum?: unknown[];
  format?: string;
  required?: string[];
  properties?: Record<string, SchemaLike>;
  items?: SchemaLike;
  additionalProperties?: boolean | SchemaLike;
  nullable?: boolean;
}

export interface Violation {
  pointer: string;
  message: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value: unknown, expected: string): boolean {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  if (expected === 'integer') return actual === 'integer';
  return actual === expected;
}

function checkFormat(value: unknown, format: string, pointer: string, out: Violation[]): void {
  if (typeof value !== 'string') return;
  const rules: Record<string, RegExp> = {
    uuid: UUID_RE,
    'date-time': DATE_TIME_RE,
    date: DATE_RE,
    email: EMAIL_RE,
  };
  if (format === 'time') {
    if (!TIME_RE.test(value)) out.push({ pointer, message: `"${value}" não é uma hora HH:MM` });
    return;
  }
  const rule = rules[format];
  if (rule && !rule.test(value)) out.push({ pointer, message: `"${value}" não cumpre o formato ${format}` });
}

/**
 * Valida `value` contra `schema`.
 *
 * Devolve uma lista de violações (vazia = conforme). Não interrompe no primeiro
 * erro: reportar tudo de uma vez torna o diagnóstico do teste utilizável.
 */
export function validateAgainstSchema(value: unknown, schema: SchemaLike | undefined, pointer = '$'): Violation[] {
  if (!schema) return [];
  const out: Violation[] = [];

  if (value === null) {
    if (schema.nullable === true) return out;
    out.push({ pointer, message: 'valor nulo mas o schema não é nullable' });
    return out;
  }

  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expected.some((t) => matchesType(value, t))) {
      out.push({ pointer, message: `tipo esperado ${expected.join('|')}, recebido ${typeOf(value)}` });
      return out;
    }
  }

  if (schema.enum && !schema.enum.some((allowed) => allowed === value)) {
    out.push({ pointer, message: `valor ${JSON.stringify(value)} fora do enum ${JSON.stringify(schema.enum)}` });
  }

  if (schema.format) checkFormat(value, schema.format, pointer, out);

  if (Array.isArray(value)) {
    if (schema.items) {
      value.forEach((item, index) => out.push(...validateAgainstSchema(item, schema.items, `${pointer}[${index}]`)));
    }
    return out;
  }

  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record) || record[key] === undefined) {
        out.push({ pointer: `${pointer}.${key}`, message: `campo obrigatório em falta: ${key}` });
      }
    }
    for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (!(key in record) || record[key] === undefined) continue;
      out.push(...validateAgainstSchema(record[key], propertySchema, `${pointer}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!(key in (schema.properties ?? {}))) {
          out.push({ pointer: `${pointer}.${key}`, message: `campo não documentado: ${key}` });
        }
      }
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const [key, child] of Object.entries(record)) {
        if (key in (schema.properties ?? {})) continue;
        out.push(...validateAgainstSchema(child, schema.additionalProperties, `${pointer}.${key}`));
      }
    }
  }

  return out;
}

/** Formata violações numa mensagem legível para o `expect`. */
export function formatViolations(violations: Violation[]): string {
  return violations.map((v) => `${v.pointer}: ${v.message}`).join('\n');
}

export function expectConforms(value: unknown, schema: SchemaLike | undefined, context: string): void {
  const violations = validateAgainstSchema(value, schema);
  if (violations.length > 0) {
    throw new Error(`${context} não conforme o spec:\n${formatViolations(violations)}`);
  }
}
