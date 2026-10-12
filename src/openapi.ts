import { EVALUATION_TYPES, EVALUATION_DEFAULT_MAX_SCORE } from './modules/schedules-assessments/domain/evaluation';
import { CALCULATION_METHOD_CODES, CALCULATION_METHODS, CUSTOM_FORMULA_LIST } from './modules/schedules-assessments/domain/calculationEngine';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const ASSESSMENT_DB_STATUS = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'];
const SCHEDULE_DB_STATUS = ['ACTIVE', 'INACTIVE', 'CANCELLED'];
const RESULT_STATUS = ['APPROVED', 'FAILED', 'RECOVERY', 'PENDING', 'IN_PROGRESS'];
const GRADE_DB_STATUS = ['SUBMITTED', 'APPROVED', 'REVISED'];
const calculationMethodEnum = CALCULATION_METHOD_CODES as unknown as string[];

interface OpenApiSchema {
  type?: string;
  format?: string;
  pattern?: string;
  enum?: string[];
  properties?: Record<string, OpenApiSchema | { type: string; items?: unknown; nullable?: boolean; minLength?: number; exclusiveMinimum?: number; minimum?: number; default?: number; format?: string; pattern?: string; enum?: string[] } & Record<string, unknown>>;
  required?: string[];
  items?: OpenApiSchema | { type: string; items?: unknown };
  nullable?: boolean;
  minLength?: number;
  exclusiveMinimum?: number;
  minimum?: number;
  default?: number;
  [key: string]: unknown;
}

/**
 * Deriva `required` a partir das propriedades não-nullable.
 *
 * Uma propriedade marcada `nullable: true` pode não vir; todas as outras são
 * garantidas. Sem `required`, um consumidor do spec não consegue distinguir
 * "campo opcional" de "campo que a API promete sempre" — e o guia pede
 * schemas completos.
 */
function requireNonNullable<T extends OpenApiSchema>(schema: T): T {
  const properties = schema.properties ?? {};
  const required = Object.entries(properties)
    .filter(([, property]) => (property as { nullable?: boolean }).nullable !== true)
    .map(([key]) => key);
  if (required.length === 0) return schema;
  const merged = new Set([...(schema.required ?? []), ...required]);
  return { ...schema, required: [...merged] };
}

const uuid: OpenApiSchema = { type: 'string', format: 'uuid' };
const dateTime: OpenApiSchema = { type: 'string', format: 'date-time' };
const hhmm: OpenApiSchema = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };

const deletedAck: OpenApiSchema = {
  type: 'object',
  properties: { deleted: { type: 'boolean' }, id: uuid },
  required: ['deleted', 'id'],
  example: { deleted: true, id: '7c75e533-aa49-4dcf-97a2-9ecdd3bfb1d4' },
};

const errorSchema: OpenApiSchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    details: { type: 'array', items: { type: 'object' } },
    correlationId: { type: 'string' },
  },
};

const loginInput: OpenApiSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 1 },
  },
  example: { email: 'aluno1@student.ucjac.ac.mz', password: 'aluno123' },
};

const authUser: OpenApiSchema = {
  type: 'object',
  properties: {
    id: uuid,
    role: { type: 'string' },
    schoolId: uuid,
    name: { type: 'string' },
    email: { type: 'string' },
  },
  example: {
    id: '02e95780-9708-48e6-bced-d8607a61fa5a',
    role: 'STUDENT',
    schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
    name: 'Abu Bakar Ossum',
    email: 'aluno1@student.ucjac.ac.mz',
  },
};

const authTokens: OpenApiSchema = {
  type: 'object',
  properties: {
    accessToken: { type: 'string' },
    tokenType: { type: 'string' },
    expiresIn: { type: 'integer' },
    refreshToken: { type: 'string' },
    refreshExpiresIn: { type: 'integer' },
    user: authUser,
  },
  required: ['accessToken', 'tokenType', 'expiresIn', 'refreshToken', 'refreshExpiresIn', 'user'],
  example: {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMmU5NTc4MC05NzA4LTQ4ZTZiY2VkLWQ4NjA3YTYxZmE1YSJ9.Q7x2vJ0m3sTg9pQeYb1nZ8kL4cW6rD5fH7jK0lM9nP2qR4s',
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken: 'rt_9f2c7a41b8d64e0f9a3c5d7e1b2f4a6c8e0d2f4a6c8e0d2f4a6c8e0d2f4a6c8',
    refreshExpiresIn: 604800,
    user: {
      id: '02e95780-9708-48e6-bced-d8607a61fa5a',
      role: 'STUDENT',
      schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
      name: 'Abu Bakar Ossum',
      email: 'aluno1@student.ucjac.ac.mz',
    },
  },
};

const refreshInput: OpenApiSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: { type: 'string', minLength: 16 },
  },
  example: { refreshToken: 'rt_9f2c7a41b8d64e0f9a3c5d7e1b2f4a6c8e0d2f4a6c8e0d2f4a6c8e0d2f4a6c8' },
};

const logoutInput: OpenApiSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: { type: 'string', minLength: 16 },
  },
  example: { refreshToken: 'rt_9f2c7a41b8d64e0f9a3c5d7e1b2f4a6c8e0d2f4a6c8e0d2f4a6c8e0d2f4a6c8' },
};

const financialStatus: OpenApiSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
    checkedAt: dateTime,
  },
  required: ['status', 'checkedAt'],
  example: { status: 'ACTIVE', checkedAt: '2026-03-18T07:40:00.000Z' },
};

const school: OpenApiSchema = requireNonNullable({
  example: {
    id: 'f266cdec-aee4-45a5-a962-9d961a95638b',
    name: 'Universidade Júnior de Angola e Moçambique',
    code: 'UJAC',
    phone: '+258 843 000 111',
  },
  type: 'object',
  properties: {
    id: uuid,
    name: { type: 'string' },
    code: { type: 'string' },
    phone: { type: 'string', nullable: true },
  },
});

const academicYear: OpenApiSchema = requireNonNullable({
  example: {
    id: 'e902338e-b3e1-47dc-995b-13bec814c404',
    schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
    name: '2026',
    startDate: '2026-02-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
  },
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    name: { type: 'string' },
  },
});

const term: OpenApiSchema = requireNonNullable({
  example: {
    id: 'df8c0eac-1660-4e17-95c9-22fb27a33a5e',
    schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
    academicYearId: 'e902338e-b3e1-47dc-995b-13bec814c404',
    name: '1º Período',
    startDate: '2026-02-23T00:00:00.000Z',
    endDate: '2026-07-10T00:00:00.000Z',
  },
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    academicYearId: uuid,
    name: { type: 'string' },
    startDate: dateTime,
    endDate: dateTime,
    status: { type: 'string' },
  },
});

const classSchema: OpenApiSchema = requireNonNullable({
  example: {
    id: 'ff47d5a7-c2e3-4bff-8ea7-2e816902c9db',
    schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
    academicYearId: 'e902338e-b3e1-47dc-995b-13bec814c404',
    name: 'Engenharia Informática - 1º Ano',
    grade: '1',
    shift: 'Manhã',
    room: 'Sala 204',
  },
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    academicYearId: uuid,
    name: { type: 'string' },
    grade: { type: 'string', nullable: true },
    shift: { type: 'string', nullable: true },
    room: { type: 'string', nullable: true },
  },
});

const subject: OpenApiSchema = requireNonNullable({
  example: {
    id: '9406a157-34f4-4d70-b6de-defdbaf496fa',
    schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
    name: 'Programação Paralela',
    code: 'SUBJ3',
    description: 'Computação distribuída e modelos de programação concorrente.',
  },
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    name: { type: 'string' },
    code: { type: 'string', nullable: true },
  },
});

const teacher: OpenApiSchema = requireNonNullable({
  example: {
    id: '294481dd-a867-4db8-998c-db6851fafdd2',
    schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
    name: 'Eng. Maria Tivane',
    email: 'maria.tivane@ucjac.ac.mz',
    employeeNumber: 'DOC-2019-014',
    specialization: 'Sistemas Distribuídos',
    status: 'ACTIVE',
  },
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    name: { type: 'string' },
    email: { type: 'string', nullable: true },
  },
});

const student: OpenApiSchema = requireNonNullable({
  example: {
    id: '02e95780-9708-48e6-bced-d8607a61fa5a',
    schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
    name: 'Abu Bakar Ossum',
    email: 'aluno1@student.ucjac.ac.mz',
    enrollmentNumber: 'UCJAC-2026-001',
    status: 'ACTIVE',
  },
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    name: { type: 'string' },
    email: { type: 'string', nullable: true },
    enrollmentNumber: { type: 'string', nullable: true },
  },
});

const assessment: OpenApiSchema = requireNonNullable({
  example: {
    id: '7c75e533-aa49-4dcf-97a2-9ecdd3bfb1d4',
    schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
    academicYearId: 'e902338e-b3e1-47dc-995b-13bec814c404',
    academicYearName: '2026',
    termId: 'df8c0eac-1660-4e17-95c9-22fb27a33a5e',
    termName: '1º Período',
    classId: 'ff47d5a7-c2e3-4bff-8ea7-2e816902c9db',
    className: 'Engenharia Informática - 1º Ano',
    subjectId: '9406a157-34f4-4d70-b6de-defdbaf496fa',
    subjectName: 'Programação Paralela',
    teacherId: '294481dd-a867-4db8-998c-db6851fafdd2',
    teacherName: 'Eng. Maria Tivane',
    name: 'Teste 1 — Programação Paralela',
    type: 'TEST',
    description: 'Prova teórica com 12 questões de escolha múltipla.',
    date: '2026-03-14T09:00:00.000Z',
    maxScore: 20,
    weight: 40,
    status: 'OPEN',
    createdAt: '2026-03-01T08:12:00.000Z',
    updatedAt: '2026-03-14T10:05:00.000Z',
  },
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    academicYearId: uuid,
    academicYearName: { type: 'string', nullable: true },
    termId: uuid,
    termName: { type: 'string', nullable: true },
    classId: uuid,
    className: { type: 'string', nullable: true },
    subjectId: uuid,
    subjectName: { type: 'string', nullable: true },
    teacherId: uuid,
    teacherName: { type: 'string', nullable: true },
    name: { type: 'string' },
    type: { type: 'string', enum: EVALUATION_TYPES },
    description: { type: 'string', nullable: true },
    date: dateTime,
    maxScore: { type: 'number' },
    weight: { type: 'number' },
    status: { type: 'string', enum: ASSESSMENT_DB_STATUS },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
});

const assessmentBody: OpenApiSchema = {
  type: 'object',
  required: ['academicYearId', 'termId', 'classId', 'subjectId', 'teacherId', 'name', 'type', 'date', 'weight'],
  properties: {
    academicYearId: uuid,
    termId: uuid,
    classId: uuid,
    subjectId: uuid,
    teacherId: uuid,
    name: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: EVALUATION_TYPES },
    description: { type: 'string', nullable: true },
    date: dateTime,
    maxScore: { type: 'number', exclusiveMinimum: 0, default: EVALUATION_DEFAULT_MAX_SCORE },
    weight: { type: 'number', exclusiveMinimum: 0 },
    status: { type: 'string', enum: ASSESSMENT_DB_STATUS },
  },
};

const assessmentPlanBody: OpenApiSchema = {
  type: 'object',
  required: ['academicYearId', 'termId', 'classId', 'subjectId', 'teacherId', 'assessments'],
  properties: {
    academicYearId: uuid,
    termId: uuid,
    classId: uuid,
    subjectId: uuid,
    teacherId: uuid,
    assessments: {
      type: 'array',
      minItems: 1,
      maxItems: 30,
      items: {
        type: 'object',
        required: ['name', 'type', 'date', 'weight'],
        properties: {
          name: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: EVALUATION_TYPES },
          description: { type: 'string', nullable: true },
          date: dateTime,
          maxScore: { type: 'number', exclusiveMinimum: 0, default: EVALUATION_DEFAULT_MAX_SCORE },
          weight: { type: 'number', exclusiveMinimum: 0 },
          status: { type: 'string', enum: ASSESSMENT_DB_STATUS },
        },
      },
    },
  },
};

const grade: OpenApiSchema = requireNonNullable({
  // Campos exactamente iguais aos de `gradeDto` em @smartcampus/shared-types:
  // o exemplo não pode prometer campos que a API não devolve.
  example: {
    id: '2f9a1c77-0d3e-4a5b-9c88-2f1d0e7b5a91',
    assessmentId: '7c75e533-aa49-4dcf-97a2-9ecdd3bfb1d4',
    assessmentName: 'Teste 1 — Programação Paralela',
    studentId: '02e95780-9708-48e6-bced-d8607a61fa5a',
    studentName: 'Abu Bakar Ossum',
    score: 17.5,
    comment: 'Demonstrou domínio de mapeamento paralelo.',
    status: 'APPROVED',
    createdAt: '2026-03-15T09:30:00.000Z',
    updatedAt: '2026-03-15T09:30:00.000Z',
  },
  type: 'object',
  properties: {
    id: uuid,
    assessmentId: uuid,
    assessmentName: { type: 'string', nullable: true },
    studentId: uuid,
    studentName: { type: 'string', nullable: true },
    score: { type: 'number' },
    comment: { type: 'string', nullable: true },
    status: { type: 'string', enum: GRADE_DB_STATUS },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
});

const gradeBody: OpenApiSchema = {
  type: 'object',
  required: ['studentId', 'score'],
  properties: {
    studentId: uuid,
    score: { type: 'number', minimum: 0 },
    comment: { type: 'string', nullable: true },
  },
};

const schedule: OpenApiSchema = requireNonNullable({
  example: {
    id: '1d3f7a20-6b8e-4c11-9f52-8a7b3d6e4c90',
    schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
    academicYearId: 'e902338e-b3e1-47dc-995b-13bec814c404',
    academicYearName: '2026',
    termId: 'df8c0eac-1660-4e17-95c9-22fb27a33a5e',
    termName: '1º Período',
    classId: 'ff47d5a7-c2e3-4bff-8ea7-2e816902c9db',
    className: 'Engenharia Informática - 1º Ano',
    subjectId: '9406a157-34f4-4d70-b6de-defdbaf496fa',
    subjectName: 'Programação Paralela',
    teacherId: '294481dd-a867-4db8-998c-db6851fafdd2',
    teacherName: 'Eng. Maria Tivane',
    dayOfWeek: 'MONDAY',
    startTime: '08:00',
    endTime: '10:00',
    room: 'Sala 204',
    status: 'ACTIVE',
  },
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    academicYearId: uuid,
    termId: uuid,
    termName: { type: 'string', nullable: true },
    classId: uuid,
    className: { type: 'string', nullable: true },
    subjectId: uuid,
    subjectName: { type: 'string', nullable: true },
    teacherId: uuid,
    teacherName: { type: 'string', nullable: true },
    dayOfWeek: { type: 'string', enum: DAYS },
    startTime: hhmm,
    endTime: hhmm,
    room: { type: 'string', nullable: true },
    status: { type: 'string', enum: SCHEDULE_DB_STATUS },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
});

const scheduleBody: OpenApiSchema = {
  type: 'object',
  required: ['academicYearId', 'termId', 'classId', 'subjectId', 'teacherId', 'dayOfWeek', 'startTime', 'endTime'],
  properties: {
    academicYearId: uuid,
    termId: uuid,
    classId: uuid,
    subjectId: uuid,
    teacherId: uuid,
    dayOfWeek: { type: 'string', enum: DAYS },
    startTime: hhmm,
    endTime: hhmm,
    room: { type: 'string', nullable: true },
    status: { type: 'string', enum: SCHEDULE_DB_STATUS },
  },
};

const result: OpenApiSchema = requireNonNullable({
  example: {
    id: 'b7e4d2a9-5c3f-4a8e-9d61-7f2b8c4e5a30',
    schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
    academicYearId: 'e902338e-b3e1-47dc-995b-13bec814c404',
    academicYearName: '2026',
    termId: 'df8c0eac-1660-4e17-95c9-22fb27a33a5e',
    termName: '1º Período',
    classId: 'ff47d5a7-c2e3-4bff-8ea7-2e816902c9db',
    className: 'Engenharia Informática - 1º Ano',
    subjectId: '9406a157-34f4-4d70-b6de-defdbaf496fa',
    subjectName: 'Programação Paralela',
    studentId: '02e95780-9708-48e6-bced-d8607a61fa5a',
    studentName: 'Abu Bakar Ossum',
    teacherId: '294481dd-a867-4db8-998c-db6851fafdd2',
    teacherName: 'Eng. Maria Tivane',
    average: 16.4,
    finalScore: 16.4,
    weightedTotal: 16.4,
    status: 'APPROVED',
    calculationMethod: 'WEIGHTED_PERCENTAGE',
    calculatedAt: '2026-03-20T07:45:00.000Z',
  },
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    academicYearId: uuid,
    termId: uuid,
    termName: { type: 'string', nullable: true },
    classId: uuid,
    className: { type: 'string', nullable: true },
    subjectId: uuid,
    subjectName: { type: 'string', nullable: true },
    studentId: uuid,
    studentName: { type: 'string', nullable: true },
    average: { type: 'number', nullable: true },
    finalScore: { type: 'number', nullable: true },
    calculationMethod: { type: 'string', enum: calculationMethodEnum, nullable: true },
    status: { type: 'string', enum: RESULT_STATUS },
    calculatedAt: dateTime,
    weightedTotal: { type: 'number', nullable: true },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
});

const resultBody: OpenApiSchema = {
  type: 'object',
  required: ['classId', 'subjectId', 'termId'],
  properties: {
    classId: uuid,
    subjectId: uuid,
    termId: uuid,
    studentIds: { type: 'array', items: uuid },
  },
};

const calculationItemSchema: OpenApiSchema = {
  type: 'object',
  required: ['score'],
  properties: {
    assessmentId: { ...uuid, description: 'UUID da avaliação (opcional)' },
    name: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: EVALUATION_TYPES },
    score: { type: 'number', minimum: 0 },
    weight: { type: 'number', minimum: 0, maximum: 100, description: 'Peso percentual (0–100)' },
  },
};

const calculationComponentSchema: OpenApiSchema = {
  type: 'object',
  required: ['weight'],
  properties: {
    id: { type: 'string', minLength: 1 },
    assessmentId: uuid,
    name: { type: 'string', minLength: 1 },
    weight: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
    score: { type: 'number', minimum: 0, description: 'Nota (obrigatória nos nós-folha)' },
    children: { type: 'array', items: { type: 'object' }, description: 'Sub-componentes (nível interno)' },
  },
};

const calculationInputSchema: OpenApiSchema = {
  type: 'object',
  required: ['method', 'items'],
  properties: {
    method: { type: 'string', enum: calculationMethodEnum },
    items: { type: 'array', items: calculationItemSchema, minLength: 1, description: 'Notas com pesos (mínimo 1 item)' },
    components: { type: 'array', items: calculationComponentSchema, minLength: 1, description: 'Obrigatório para COMPONENT_BASED' },
    formula: { type: 'string', minLength: 1, description: 'Código da fórmula registada (obrigatório para CUSTOM_WEIGHTED)' },
    rounding: {
      type: 'object',
      properties: { decimals: { type: 'integer', enum: [0, 1, 2] } },
      description: 'Precisão de arredondamento (0, 1 ou 2 casas decimais)',
    },
    minScore: { type: 'number', minimum: 0, description: 'Nota mínima do intervalo (padrão 0)' },
    maxScore: { type: 'number', minimum: 1, description: 'Nota máxima do intervalo (padrão 20)' },
    expectedTotal: { type: 'number', exclusiveMinimum: 0, description: 'Total esperado dos pesos (padrão 100)' },
    allowNormalization: { type: 'boolean', description: 'Permitir normalização de pesos' },
    top: { type: 'integer', minimum: 1, description: 'Número de melhores notas para MEAN_OF_TOP_K' },
  },
};

const calculationBreakdownSchema: OpenApiSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    assessmentId: uuid,
    name: { type: 'string' },
    type: { type: 'string', enum: EVALUATION_TYPES },
    label: { type: 'string' },
    score: { type: 'number' },
    weight: { type: 'number', nullable: true },
    normalizedWeight: { type: 'number', nullable: true },
    contribution: { type: 'number', nullable: true },
    children: { type: 'array', items: { type: 'object' } },
  },
};

const calculationResultSchema: OpenApiSchema = {
  type: 'object',
  properties: {
    method: { type: 'string', enum: calculationMethodEnum },
    value: { type: 'number' },
    decimals: { type: 'integer' },
    formula: { type: 'string', nullable: true },
    breakdown: { type: 'array', items: calculationBreakdownSchema },
  },
  example: {
    method: 'WEIGHTED_PERCENTAGE',
    value: 16.4,
    decimals: 2,
    formula: 'Σ (nota × peso) ÷ Σ pesos',
    breakdown: [
      { label: 'Teste 1', value: 17.5, weight: 40 },
      { label: 'Trabalho de grupo', value: 15.5, weight: 60 },
    ],
  },
};

const calculationMethodMetaSchema: OpenApiSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', enum: calculationMethodEnum },
    name: { type: 'string' },
    description: { type: 'string' },
    formula: { type: 'string' },
  },
  example: {
    code: 'WEIGHTED_PERCENTAGE',
    name: 'Média ponderada por percentagem',
    description: 'Soma as notas ponderadas pela percentagem de cada componente e divide pelo total.',
    formula: 'Σ (nota × peso) ÷ Σ pesos',
  },
};

const customFormulaMetaSchema: OpenApiSchema = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    requiresWeights: { type: 'boolean' },
  },
};

const meta: OpenApiSchema = {
  type: 'object',
  properties: {
    correlationId: { type: 'string' },
    page: { type: 'number' },
    pageSize: { type: 'number' },
    total: { type: 'number' },
  },
};

const pautaRow: OpenApiSchema = {
  type: 'object',
  properties: {
    studentId: uuid,
    studentName: { type: 'string' },
    enrollmentNumber: { type: 'string' },
    assessments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          score: { type: 'number', nullable: true },
          weight: { type: 'number' },
          maxScore: { type: 'number' },
        },
      },
    },
    average: { type: 'number', nullable: true },
    weightedTotal: { type: 'number', nullable: true },
    status: { type: 'string', enum: RESULT_STATUS },
    debtRestricted: { type: 'boolean' },
  },
};

const printableSchedule: OpenApiSchema = {
  type: 'object',
  properties: {
    school: school,
    class: classSchema,
    academicYear: academicYear,
    term: term,
    slots: { type: 'array', items: schedule },
  },
  required: ['school', 'class', 'academicYear', 'term', 'slots'],
  example: {
    school: {
      id: 'f266cdec-aee4-45a5-a962-9d961a95638b',
      name: 'Universidade Júnior de Angola e Moçambique',
      code: 'UJAC',
      phone: '+258 843 000 111',
    },
    class: {
      id: 'ff47d5a7-c2e3-4bff-8ea7-2e816902c9db',
      schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
      academicYearId: 'e902338e-b3e1-47dc-995b-13bec814c404',
      name: 'Engenharia Informática - 1º Ano',
      grade: '1',
      shift: 'Manhã',
      room: 'Sala 204',
    },
    academicYear: {
      id: 'e902338e-b3e1-47dc-995b-13bec814c404',
      schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
      name: '2026',
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
    },
    term: {
      id: 'df8c0eac-1660-4e17-95c9-22fb27a33a5e',
      schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
      academicYearId: 'e902338e-b3e1-47dc-995b-13bec814c404',
      name: '1º Período',
      startDate: '2026-02-23T00:00:00.000Z',
      endDate: '2026-07-10T00:00:00.000Z',
    },
    slots: [
      {
        id: '1d3f7a20-6b8e-4c11-9f52-8a7b3d6e4c90',
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        room: 'Sala 204',
        subjectName: 'Programação Paralela',
        teacherName: 'Eng. Maria Tivane',
        status: 'ACTIVE',
      },
    ],
  },
};

const printablePauta: OpenApiSchema = {
  type: 'object',
  properties: {
    school: school,
    class: classSchema,
    academicYear: academicYear,
    term: term,
    subject: subject,
    teacher: teacher,
    rows: { type: 'array', items: pautaRow },
  },
  required: ['school', 'class', 'academicYear', 'term', 'subject', 'rows'],
  example: {
    school: {
      id: 'f266cdec-aee4-45a5-a962-9d961a95638b',
      name: 'Universidade Júnior de Angola e Moçambique',
      code: 'UJAC',
      phone: '+258 843 000 111',
    },
    class: {
      id: 'ff47d5a7-c2e3-4bff-8ea7-2e816902c9db',
      schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
      academicYearId: 'e902338e-b3e1-47dc-995b-13bec814c404',
      name: 'Engenharia Informática - 1º Ano',
      grade: '1',
      shift: 'Manhã',
      room: 'Sala 204',
    },
    academicYear: {
      id: 'e902338e-b3e1-47dc-995b-13bec814c404',
      schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
      name: '2026',
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
    },
    term: {
      id: 'df8c0eac-1660-4e17-95c9-22fb27a33a5e',
      schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
      academicYearId: 'e902338e-b3e1-47dc-995b-13bec814c404',
      name: '1º Período',
      startDate: '2026-02-23T00:00:00.000Z',
      endDate: '2026-07-10T00:00:00.000Z',
    },
    subject: {
      id: '9406a157-34f4-4d70-b6de-defdbaf496fa',
      schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
      name: 'Programação Paralela',
      code: 'SUBJ3',
      description: 'Computação distribuída e modelos de programação concorrente.',
    },
    teacher: {
      id: '294481dd-a867-4db8-998c-db6851fafdd2',
      schoolId: 'f266cdec-aee4-45a5-a962-9d961a95638b',
      name: 'Eng. Maria Tivane',
      email: 'maria.tivane@ucjac.ac.mz',
      employeeNumber: 'DOC-2019-014',
      specialization: 'Sistemas Distribuídos',
      status: 'ACTIVE',
    },
    rows: [
      {
        studentId: '02e95780-9708-48e6-bced-d8607a61fa5a',
        studentName: 'Abu Bakar Ossum',
        enrollmentNumber: 'UCJAC-2026-001',
        assessments: [{ name: 'Teste 1', score: 17.5, weight: 40, maxScore: 20 }],
        average: 17.5,
        weightedTotal: 17.5,
        status: 'APPROVED',
        debtRestricted: false,
      },
    ],
  },
};

const CORRELATION_ID_EXAMPLE = '3f7c1b52-9a4e-4d18-8b6f-2e5a9c7d1e04';

const errorExample = {
  code: 'VALIDATION_ERROR',
  message: 'Requisição inválida (validação Zod ou regra de domínio)',
  details: [{ path: 'weight', message: 'Peso deve ser maior que zero' }],
  correlationId: CORRELATION_ID_EXAMPLE,
};

const forbiddenExample = {
  code: 'FORBIDDEN',
  message: 'Só tem permissão para aceder aos seus próprios dados',
  details: [],
  correlationId: CORRELATION_ID_EXAMPLE,
};

const unauthenticatedExample = {
  code: 'UNAUTHENTICATED',
  message: 'Token em falta',
  details: [],
  correlationId: CORRELATION_ID_EXAMPLE,
};

const notFoundExample = {
  code: 'NOT_FOUND',
  message: 'Recurso não encontrado',
  details: [],
  correlationId: CORRELATION_ID_EXAMPLE,
};

const listMetaExample = {
  correlationId: CORRELATION_ID_EXAMPLE,
  page: 1,
  pageSize: 20,
  total: 3,
};

/**
 * Envelope de sucesso com exemplo realista.
 *
 * Quando `dataSchema` é um array, o exemplo é apresentado como lista paginada
 * (`data` + `meta.page/pageSize/total`), que é o formato real devolvido pelo
 * módulo para endpoints de listagem.
 */
function successExample(items: OpenApiSchema, options: { list?: boolean; singleExample?: unknown } = {}): unknown {
  // Numa listagem, `items` é `{ type: 'array', items: <entidade> }`: o exemplo
  // realisticamente está no elemento, não no array. Sem esta leitura o exemplo
  // da listagem saía vazio e não ensinava nada ao consumidor.
  const elementExample = (items as { example?: unknown }).example ?? (items.items as { example?: unknown } | undefined)?.example;
  const single = options.singleExample ?? elementExample;
  if (options.list) return { data: single === undefined ? [] : [single], meta: listMetaExample };
  return single === undefined ? undefined : { data: single, meta: { correlationId: CORRELATION_ID_EXAMPLE } };
}

function successEnvelope(items: OpenApiSchema, options: { list?: boolean; singleExample?: unknown } = {}): OpenApiSchema {
  const envelope: OpenApiSchema = {
    type: 'object',
    properties: {
      data: items,
      meta,
    },
    required: ['data', 'meta'],
  };
  const example = successExample(items, options);
  if (example !== undefined) envelope.example = example;
  return envelope;
}

/**
 * Resposta de sucesso com o exemplo nos dois níveis.
 *
 * O OpenAPI distingue o exemplo do *schema* (`schema.example`) do exemplo do
 * *media type* (`content[...].example`). O segundo é o que o Swagger UI e o
 * Postman mostram por omissão, por isso o exemplo é escrito nos dois sítios.
 */
function successResponse(description: string, items: OpenApiSchema, options: { list?: boolean } = {}): Record<string, unknown> {
  const example = successExample(items, options);
  return {
    description,
    content: {
      'application/json': {
        schema: successEnvelope(items, options),
        ...(example === undefined ? {} : { example }),
      },
    },
  };
}

function errorResponse(description: string, example: unknown): Record<string, unknown> {
  return { description, content: { 'application/json': { schema: errorSchema, example } } };
}

function responses(dataSchema: OpenApiSchema, options: { list?: boolean } = {}): Record<string, unknown> {
  return {
    200: successResponse('Operação realizada com sucesso', dataSchema, options),
    201: successResponse('Recurso criado', dataSchema, options),
    400: errorResponse('Requisição inválida (validação Zod ou regra de domínio)', errorExample),
    401: errorResponse('Não autenticado — token em falta, expirado ou com assinatura inválida (UNAUTHENTICATED)', unauthenticatedExample),
    403: errorResponse(
      'Sem permissão para este recurso — role insuficiente (FORBIDDEN) ou recurso pertence a outro utilizador (verificação de posse)',
      forbiddenExample,
    ),
    404: errorResponse('Recurso inexistente (NOT_FOUND)', notFoundExample),
    409: errorResponse(
      'Conflito (duplicação, sobreposição de horário, avaliação com notas já lançadas)',
      { code: 'CONFLICT', message: 'Conflito de domínio', details: [], correlationId: CORRELATION_ID_EXAMPLE },
    ),
    500: errorResponse(
      'Erro interno do servidor (INTERNAL_ERROR)',
      { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro inesperado', details: [], correlationId: CORRELATION_ID_EXAMPLE },
    ),
  };
}

function studentResponses(dataSchema: OpenApiSchema, options: { list?: boolean } = {}): Record<string, unknown> {
  return {
    ...responses(dataSchema, options),
    403: errorResponse(
      'Estudante com dívida financeira — bloqueado de consultar notas (FINANCIAL_ACCESS_BLOCKED), ou recurso de outro estudante (FORBIDDEN)',
      { code: 'FINANCIAL_ACCESS_BLOCKED', message: 'A consulta das notas está indisponível. Regularize a sua situação financeira.', details: [], correlationId: CORRELATION_ID_EXAMPLE },
    ),
    503: errorResponse(
      'Serviço financeiro indisponível — o acesso falha fechado por segurança (FINANCIAL_VERIFICATION_UNAVAILABLE)',
      { code: 'FINANCIAL_VERIFICATION_UNAVAILABLE', message: 'Não foi possível confirmar a situação financeira — acesso bloqueado por segurança', details: [], correlationId: CORRELATION_ID_EXAMPLE },
    ),
  };
}

function idParam(name: string): { name: string; in: string; required: boolean; schema: OpenApiSchema } {
  return { name, in: 'path', required: true, schema: uuid };
}

function queryParam(name: string): { name: string; in: string; schema: OpenApiSchema } {
  return { name, in: 'query', schema: uuid };
}

const pageParam = { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } };
const pageSizeParam = { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 100 } };

const HTTP_METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;

/**
 * Deriva um `operationId` estável e legível a partir do método e do caminho.
 *
 * Gerar o id em vez de o escrever à mão garante três coisas de que o guia
 * exige: todos os operações têm id, não há ids duplicados e o id nunca
 * diverge do caminho documentado.
 *
 *   GET /api/v1/assessments/{id}/grades  ->  getAssessmentsIdGrades
 */
export function deriveOperationId(method: string, path: string): string {
  const withoutPrefix = path.replace(/^\/api\/v1\/?/, '');
  const segments = withoutPrefix
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1));
  const name = segments.length > 0 ? segments.join('') : 'Root';
  return `${method.toLowerCase()}${name}`;
}

function withOperationIds(paths: Record<string, Record<string, unknown>>): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const [path, item] of Object.entries(paths)) {
    const methods: Record<string, unknown> = {};
    for (const [key, operation] of Object.entries(item)) {
      if (!(HTTP_METHODS as readonly string[]).includes(key)) {
        methods[key] = operation;
        continue;
      }
      const withId: Record<string, unknown> = { operationId: deriveOperationId(key, path), ...(operation as Record<string, unknown>) };

      // Um GET nunca cria um recurso: documentar 201 numa leitura e' ru'ido que
      // faz o consumidor duvidar do contrato. Remove-se o 201 das leituras.
      if (key === 'get') {
        const responses = (withId.responses ?? {}) as Record<string, unknown>;
        const { 201: _unused, ...rest } = responses;
        withId.responses = rest;
      }
      methods[key] = withId;
    }
    result[path] = methods;
  }
  return result;
}

export function buildOpenApi(): Record<string, unknown> {
  const document: Record<string, unknown> = {
    openapi: '3.0.0',
    info: {
      title: 'Smart Campos — Módulo G3 (Avaliações e Horários)',
      version: '1.0.0',
      description:
        'API autenticada (Bearer) para gestão de avaliações, notas, médias, horários, resultados e impressão de pautas/horários. ' +
        'Consome os serviços de contratos (estudantes, docentes, inscrições e financeiro) e bloqueia o lançamento de notas de alunos com dívida.',
    },
    security: [{ BearerAuth: [] }],
    paths: {
      '/api/v1/auth/login': {
        post: {
          tags: ['Autenticação'],
          summary: 'Autentica um utilizador e devolve accessToken + refreshToken',
          description:
            'Público. Verifica credenciais e devolve um accessToken (Bearer, curta duração) e um refreshToken ' +
            '(longa duração, 7 dias por omissão). O refreshToken é gerido com rotação e revogação.',
          requestBody: { required: true, content: { 'application/json': { schema: loginInput } } },
          responses: {
            200: successResponse('Credenciais válidas — accessToken + refreshToken + perfil', authTokens),
            400: errorResponse('Requisição inválida (email ou password em falta)', errorExample),
            401: errorResponse(
              'Credenciais inválidas ou utilizador inativo',
              { code: 'UNAUTHENTICATED', message: 'Credenciais inválidas', details: [], correlationId: CORRELATION_ID_EXAMPLE },
            ),
          },
          security: [],
        },
      },
      '/api/v1/auth/refresh': {
        post: {
          tags: ['Autenticação'],
          summary: 'Renova a sessão (rotação de refreshToken)',
          description:
            'Público. Recebe um refreshToken válido, revoga-o e devolve um novo par accessToken + refreshToken. ' +
            'Reutilização de um refreshToken já revogado devolve 401 UNAUTHENTICATED.',
          requestBody: { required: true, content: { 'application/json': { schema: refreshInput } } },
          responses: {
            200: successResponse('Novo par de tokens (o refreshToken anterior foi revogado)', authTokens),
            400: errorResponse('Requisição inválida (refreshToken em falta)', errorExample),
            401: errorResponse(
              'RefreshToken inválido, expirado, já utilizado ou revogado',
              { code: 'UNAUTHENTICATED', message: 'RefreshToken inválido ou expirado', details: [], correlationId: CORRELATION_ID_EXAMPLE },
            ),
          },
          security: [],
        },
      },
      '/api/v1/auth/logout': {
        post: {
          tags: ['Autenticação'],
          summary: 'Revoga o refreshToken (logout)',
          description: 'Autenticado. Revoga o refreshToken indicado; pedidos posteriores com esse refreshToken devolvem 401.',
          requestBody: { required: true, content: { 'application/json': { schema: logoutInput } } },
          responses: {
            ...responses({ type: 'object', properties: { revoked: { type: 'boolean' } }, example: { revoked: true } }),
            200: successResponse('Sessão revogada', { type: 'object', properties: { revoked: { type: 'boolean' } }, example: { revoked: true } }),
            401: errorResponse(
              'Não autenticado — accessToken em falta, expirado ou revogado (UNAUTHENTICATED)',
              unauthenticatedExample,
            ),
          },
        },
      },
      '/api/v1/results/calculation-methods': {
        get: {
          tags: ['Resultados'],
          summary: 'Lista os métodos de cálculo disponíveis',
          description: 'Retorna os 6 métodos de cálculo suportados pelo motor académico.',
          responses: responses({ type: 'array', items: calculationMethodMetaSchema }, { list: true }),
        },
      },
      '/api/v1/results/calculate': {
        post: {
          tags: ['Resultados'],
          summary: 'Calcula a nota final usando um método de cálculo flexível',
          description:
            'Motor multi-método: permite escolher entre média aritmética, ponderada percentual, soma percentual, média normalizada, cálculo por componentes ou cálculo personalizado.',
          requestBody: { required: true, content: { 'application/json': { schema: calculationInputSchema } } },
          responses: responses(calculationResultSchema),
        },
      },
      '/api/v1/assessments': {
        get: {
          tags: ['Avaliações'],
          summary: 'Lista avaliações (filtros opcionais por termo, turma, disciplina, professor)',
          parameters: [
            queryParam('termId'),
            queryParam('classId'),
            queryParam('subjectId'),
            queryParam('teacherId'),
            pageParam,
            pageSizeParam,
          ],
          responses: responses({ type: 'array', items: assessment }, { list: true }),
        },
        post: {
          tags: ['Avaliações'],
          summary: 'Cria uma avaliação',
          description: 'Valida período, atribuição do professor, não duplicação e peso > 0.',
          requestBody: { required: true, content: { 'application/json': { schema: assessmentBody } } },
          responses: responses(assessment),
        },
      },
      '/api/v1/assessments/plan': {
        post: {
          tags: ['Avaliações'],
          summary: 'Cria o plano de avaliações do docente (nomes, tipos e pesos em lote)',
          description:
            'O docente define quantas avaliações existem e o peso de cada uma (ex.: Teste 1 = 40, Teste 2 = 40, Trabalho = 20). Tudo é criado numa transação; nomes duplicados no mesmo período, turma e disciplina retornam 409.',
          requestBody: { required: true, content: { 'application/json': { schema: assessmentPlanBody } } },
          responses: responses({ type: 'array', items: assessment }, { list: true }),
        },
      },
      '/api/v1/assessments/{id}': {
        get: {
          tags: ['Avaliações'],
          summary: 'Obtém uma avaliação por ID',
          parameters: [idParam('id')],
          responses: responses(assessment),
        },
        patch: {
          tags: ['Avaliações'],
          summary: 'Atualiza uma avaliação',
          description: 'Peso e nota máxima ficam bloqueados após o lançamento de notas (409).',
          parameters: [idParam('id')],
          requestBody: { required: true, content: { 'application/json': { schema: assessmentBody } } },
          responses: responses(assessment),
        },
        delete: {
          tags: ['Avaliações'],
          summary: 'Elimina uma avaliação sem notas',
          description: 'Avaliações com notas lançadas retornam 409.',
          parameters: [idParam('id')],
          responses: responses(deletedAck),
        },
      },
      '/api/v1/me/financial-status': {
        get: {
          tags: ['Resultados'],
          summary: 'Estado financeiro do próprio utilizador (estudante)',
          description:
            'Usado pelo frontend para refletir bloqueio de consulta de notas sem expor montantes: devolve apenas ACTIVE ou BLOCKED.',
          security: [{ BearerAuth: [] }],
          responses: studentResponses(financialStatus),
        },
      },
      '/api/v1/assessments/{assessmentId}/grades': {
        get: {
          tags: ['Notas'],
          summary: 'Lista notas de uma avaliação',
          description: 'Para estudantes, devolve 403 quando o utilizador tem dívida financeira (fail-closed 503 se o serviço financeiro estiver indisponível).',
          parameters: [idParam('assessmentId')],
          responses: studentResponses({ type: 'array', items: grade }, { list: true }),
        },
        post: {
          tags: ['Notas'],
          summary: 'Lança uma nota para um aluno',
          description: 'Avaliação deve estar OPEN; uma nota por aluno; recalcula resultados em transação (ACID).',
          parameters: [idParam('assessmentId')],
          requestBody: { required: true, content: { 'application/json': { schema: gradeBody } } },
          responses: responses(grade),
        },
      },
      '/api/v1/assessments/{assessmentId}/grades/{gradeId}': {
        patch: {
          tags: ['Notas'],
          summary: 'Atualiza uma nota',
          parameters: [idParam('assessmentId'), idParam('gradeId')],
          requestBody: { required: true, content: { 'application/json': { schema: gradeBody } } },
          responses: responses(grade),
        },
      },
      '/api/v1/schedules': {
        get: {
          tags: ['Horários'],
          summary: 'Lista horários (filtros opcionais por termo, turma, professor, aluno)',
          parameters: [
            queryParam('termId'),
            queryParam('classId'),
            queryParam('teacherId'),
            queryParam('studentId'),
            pageParam,
            pageSizeParam,
          ],
          responses: responses({ type: 'array', items: schedule }, { list: true }),
        },
        post: {
          tags: ['Horários'],
          summary: 'Cria um horário',
          description: 'Conflitos de professor, turma ou sala no mesmo dia/período retornam 409.',
          requestBody: { required: true, content: { 'application/json': { schema: scheduleBody } } },
          responses: responses(schedule),
        },
      },
      '/api/v1/schedules/{id}': {
        get: {
          tags: ['Horários'],
          summary: 'Obtém um horário por ID',
          parameters: [idParam('id')],
          responses: responses(schedule),
        },
        patch: {
          tags: ['Horários'],
          summary: 'Atualiza um horário',
          description: 'Revalida conflitos considerando os novos valores.',
          parameters: [idParam('id')],
          requestBody: { required: true, content: { 'application/json': { schema: scheduleBody } } },
          responses: responses(schedule),
        },
        delete: {
          tags: ['Horários'],
          summary: 'Elimina um horário',
          parameters: [idParam('id')],
          responses: responses(deletedAck),
        },
      },
      '/api/v1/results': {
        get: {
          tags: ['Resultados'],
          summary: 'Lista resultados acadêmicos (filtros opcionais por termo, turma, disciplina, aluno)',
          description: 'Estudantes apenas veem os próprios resultados; com dívida financeira recebem 403 (fail-closed 503).',
          parameters: [
            queryParam('termId'),
            queryParam('classId'),
            queryParam('subjectId'),
            queryParam('studentId'),
            pageParam,
            pageSizeParam,
          ],
          responses: studentResponses({ type: 'array', items: result }, { list: true }),
        },
        post: {
          tags: ['Resultados'],
          summary: 'Calcula/atualiza resultados em lote',
          description: 'Recalcula médias e status de uma turma/disciplina/período em transação atómica.',
          requestBody: { required: true, content: { 'application/json': { schema: resultBody } } },
          responses: responses({ type: 'array', items: result }, { list: true }),
        },
      },
      '/api/v1/results/{id}': {
        get: {
          tags: ['Resultados'],
          summary: 'Obtém um resultado por ID',
          description: 'Estudantes apenas acedem aos próprios resultados; com dívida financeira recebem 403 (fail-closed 503).',
          parameters: [idParam('id')],
          responses: studentResponses(result),
        },
        patch: {
          tags: ['Resultados'],
          summary: 'Recalcula um resultado individual',
          parameters: [idParam('id')],
          requestBody: { required: false, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: responses(result),
        },
        delete: {
          tags: ['Resultados'],
          summary: 'Elimina um resultado',
          parameters: [idParam('id')],
          responses: responses(deletedAck),
        },
      },
      '/api/v1/print/class/{classId}/schedule': {
        get: {
          tags: ['Impressão'],
          summary: 'Dados para impressão do horário de uma turma',
          parameters: [idParam('classId'), queryParam('termId')],
          responses: responses(printableSchedule),
        },
      },
      '/api/v1/print/class/{classId}/pauta': {
        get: {
          tags: ['Impressão'],
          summary: 'Dados para impressão da pauta de uma turma/disciplina',
          description: 'Para estudantes, devolve 403 com dívida financeira (fail-closed 503); o staff vê linhas de endividados mascaradas (debtRestricted).',
          parameters: [idParam('classId'), queryParam('termId'), queryParam('subjectId')],
          responses: studentResponses(printablePauta),
        },
      },
      '/api/v1/schools': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista escolas (catálogo)',
          description: 'Referência para montar formulários: id + nome + código.',
          parameters: [pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: school }, { list: true }),
        },
      },
      '/api/v1/academic-years': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista anos letivos (catálogo)',
          parameters: [pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: academicYear }, { list: true }),
        },
      },
      '/api/v1/terms': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista períodos/termos letivos (catálogo)',
          description: 'Filtro opcional por ano letivo.',
          parameters: [queryParam('academicYearId'), pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: term }, { list: true }),
        },
      },
      '/api/v1/classes': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista turmas (catálogo)',
          description: 'Filtros opcionais por período ou ano letivo.',
          parameters: [queryParam('termId'), queryParam('academicYearId'), pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: classSchema }, { list: true }),
        },
      },
      '/api/v1/subjects': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista disciplinas (catálogo)',
          parameters: [pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: subject }, { list: true }),
        },
      },
      '/api/v1/teachers': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista professores (catálogo)',
          parameters: [pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: teacher }, { list: true }),
        },
      },
      '/api/v1/students': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista alunos (catálogo)',
          description: 'Filtros opcionais por turma ou período (usa matrículas ativas).',
          parameters: [queryParam('classId'), queryParam('termId'), pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: student }, { list: true }),
        },
      },
    },
    components: {
      schemas: {
        Assessment: assessment,
        AssessmentBody: assessmentBody,
        AssessmentPlanBody: assessmentPlanBody,
        Grade: grade,
        GradeBody: gradeBody,
        Schedule: schedule,
        ScheduleBody: scheduleBody,
        Result: result,
        ResultBody: resultBody,
        ResultStatus: { type: 'string', enum: RESULT_STATUS },
        CalculationInput: calculationInputSchema,
        CalculationItem: calculationItemSchema,
        CalculationComponent: calculationComponentSchema,
        CalculationResult: calculationResultSchema,
        CalculationMethodMeta: calculationMethodMetaSchema,
        CalculationMethod: { type: 'string', enum: calculationMethodEnum },
        CustomFormulaMeta: customFormulaMetaSchema,
        School: school,
        AcademicYear: academicYear,
        Term: term,
        Class: classSchema,
        Subject: subject,
        Teacher: teacher,
        Student: student,
        Error: errorSchema,
        FinancialStatus: financialStatus,
        LoginInput: loginInput,
        RefreshInput: refreshInput,
        LogoutInput: logoutInput,
        AuthTokens: authTokens,
        AuthUser: authUser,
      },
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  };

  document.paths = withOperationIds(document.paths as Record<string, Record<string, unknown>>);
  return document;
}