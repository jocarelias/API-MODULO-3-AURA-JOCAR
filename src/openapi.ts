import { EVALUATION_TYPES, EVALUATION_DEFAULT_MAX_SCORE } from './modules/schedules-assessments/domain/evaluation';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const ASSESSMENT_DB_STATUS = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'];
const SCHEDULE_DB_STATUS = ['ACTIVE', 'INACTIVE', 'CANCELLED'];
const RESULT_STATUS = ['APPROVED', 'FAILED', 'RECOVERY', 'PENDING', 'IN_PROGRESS'];
const GRADE_DB_STATUS = ['SUBMITTED', 'APPROVED', 'REVISED'];

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

const uuid: OpenApiSchema = { type: 'string', format: 'uuid' };
const dateTime: OpenApiSchema = { type: 'string', format: 'date-time' };
const hhmm: OpenApiSchema = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };

const errorSchema: OpenApiSchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    details: { type: 'array', items: { type: 'object' } },
    correlationId: { type: 'string' },
  },
};

const assessment: OpenApiSchema = {
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    academicYearId: uuid,
    termId: uuid,
    classId: uuid,
    subjectId: uuid,
    teacherId: uuid,
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
};

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

const grade: OpenApiSchema = {
  type: 'object',
  properties: {
    id: uuid,
    assessmentId: uuid,
    studentId: uuid,
    score: { type: 'number' },
    comment: { type: 'string', nullable: true },
    status: { type: 'string', enum: GRADE_DB_STATUS },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

const gradeBody: OpenApiSchema = {
  type: 'object',
  required: ['studentId', 'score'],
  properties: {
    studentId: uuid,
    score: { type: 'number', minimum: 0 },
    comment: { type: 'string', nullable: true },
  },
};

const schedule: OpenApiSchema = {
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
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
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

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

const result: OpenApiSchema = {
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    academicYearId: uuid,
    termId: uuid,
    classId: uuid,
    subjectId: uuid,
    studentId: uuid,
    average: { type: 'number', nullable: true },
    finalScore: { type: 'number', nullable: true },
    status: { type: 'string', enum: RESULT_STATUS },
    calculatedAt: dateTime,
    weightedTotal: { type: 'number', nullable: true },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
};

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

const meta: OpenApiSchema = {
  type: 'object',
  properties: {
    correlationId: { type: 'string' },
    page: { type: 'number' },
    pageSize: { type: 'number' },
    total: { type: 'number' },
  },
};

function successEnvelope(items: OpenApiSchema): OpenApiSchema {
  return {
    type: 'object',
    properties: {
      data: items,
      meta,
    },
    required: ['data', 'meta'],
  };
}

function responses(dataSchema: OpenApiSchema): Record<string, unknown> {
  return {
    200: {
      description: 'Operação realizada com sucesso',
      content: { 'application/json': { schema: successEnvelope(dataSchema) } },
    },
    201: {
      description: 'Recurso criado',
      content: { 'application/json': { schema: successEnvelope(dataSchema) } },
    },
    400: { description: 'Requisição inválida (validação Zod ou regra de domínio)', content: { 'application/json': { schema: errorSchema } } },
    404: { description: 'Recurso não encontrado', content: { 'application/json': { schema: errorSchema } } },
    409: { description: 'Conflito (duplicação, horário, bloqueio por notas)', content: { 'application/json': { schema: errorSchema } } },
    500: { description: 'Erro interno do servidor', content: { 'application/json': { schema: errorSchema } } },
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

export function buildOpenApi(): Record<string, unknown> {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Smart Campos — Módulo G3 (Avaliações e Horários)',
      version: '1.0.0',
      description:
        'API aberta para gestão de avaliações, notas, médias, horários, resultados e impressão de pautas/horários.',
    },
    paths: {
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
          responses: responses({ type: 'array', items: assessment }),
        },
        post: {
          tags: ['Avaliações'],
          summary: 'Cria uma avaliação',
          description: 'Valida período, atribuição do professor, não duplicação e peso > 0.',
          requestBody: { required: true, content: { 'application/json': { schema: assessmentBody } } },
          responses: responses(assessment),
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
          responses: responses({ type: 'object' }),
        },
      },
      '/api/v1/assessments/{assessmentId}/grades': {
        get: {
          tags: ['Notas'],
          summary: 'Lista notas de uma avaliação',
          parameters: [idParam('assessmentId')],
          responses: responses({ type: 'array', items: grade }),
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
          responses: responses({ type: 'array', items: schedule }),
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
          responses: responses({ type: 'object' }),
        },
      },
      '/api/v1/results': {
        get: {
          tags: ['Resultados'],
          summary: 'Lista resultados acadêmicos (filtros opcionais por termo, turma, disciplina, aluno)',
          parameters: [
            queryParam('termId'),
            queryParam('classId'),
            queryParam('subjectId'),
            queryParam('studentId'),
            pageParam,
            pageSizeParam,
          ],
          responses: responses({ type: 'array', items: result }),
        },
        post: {
          tags: ['Resultados'],
          summary: 'Calcula/atualiza resultados em lote',
          description: 'Recalcula médias e status de uma turma/disciplina/período em transação atómica.',
          requestBody: { required: true, content: { 'application/json': { schema: resultBody } } },
          responses: responses({ type: 'array', items: result }),
        },
      },
      '/api/v1/results/{id}': {
        get: {
          tags: ['Resultados'],
          summary: 'Obtém um resultado por ID',
          parameters: [idParam('id')],
          responses: responses(result),
        },
        patch: {
          tags: ['Resultados'],
          summary: 'Recalcula um resultado individual',
          parameters: [idParam('id')],
          requestBody: { required: false, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: responses(result),
        },
      },
      '/api/v1/print/class/{classId}/schedule': {
        get: {
          tags: ['Impressão'],
          summary: 'Dados para impressão do horário de uma turma',
          parameters: [idParam('classId'), queryParam('termId')],
          responses: responses({ type: 'object' }),
        },
      },
      '/api/v1/print/class/{classId}/pauta': {
        get: {
          tags: ['Impressão'],
          summary: 'Dados para impressão da pauta de uma turma/disciplina',
          parameters: [idParam('classId'), queryParam('termId'), queryParam('subjectId')],
          responses: responses({ type: 'object' }),
        },
      },
    },
    components: {
      schemas: {
        Assessment: assessment,
        AssessmentBody: assessmentBody,
        Grade: grade,
        GradeBody: gradeBody,
        Schedule: schedule,
        ScheduleBody: scheduleBody,
        Result: result,
        ResultBody: resultBody,
        ResultStatus: { type: 'string', enum: RESULT_STATUS },
        Error: errorSchema,
      },
    },
  };
}