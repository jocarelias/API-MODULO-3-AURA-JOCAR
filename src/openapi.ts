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

const loginInput: OpenApiSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 1 },
  },
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
};

const refreshInput: OpenApiSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: { type: 'string', minLength: 16 },
  },
};

const logoutInput: OpenApiSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: { type: 'string', minLength: 16 },
  },
};

const financialStatus: OpenApiSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
    checkedAt: dateTime,
  },
  required: ['status', 'checkedAt'],
};

const school: OpenApiSchema = {
  type: 'object',
  properties: {
    id: uuid,
    name: { type: 'string' },
    code: { type: 'string' },
    phone: { type: 'string', nullable: true },
  },
};

const academicYear: OpenApiSchema = {
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    name: { type: 'string' },
  },
};

const term: OpenApiSchema = {
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
};

const classSchema: OpenApiSchema = {
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
};

const subject: OpenApiSchema = {
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    name: { type: 'string' },
    code: { type: 'string', nullable: true },
  },
};

const teacher: OpenApiSchema = {
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    name: { type: 'string' },
    email: { type: 'string', nullable: true },
  },
};

const student: OpenApiSchema = {
  type: 'object',
  properties: {
    id: uuid,
    schoolId: uuid,
    name: { type: 'string' },
    email: { type: 'string', nullable: true },
    enrollmentNumber: { type: 'string', nullable: true },
  },
};

const assessment: OpenApiSchema = {
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
    assessmentName: { type: 'string', nullable: true },
    studentId: uuid,
    studentName: { type: 'string', nullable: true },
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
};

const calculationMethodMetaSchema: OpenApiSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', enum: calculationMethodEnum },
    name: { type: 'string' },
    description: { type: 'string' },
    formula: { type: 'string' },
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
    401: { description: 'Não autenticado — token em falta ou inválido (UNAUTHENTICATED)', content: { 'application/json': { schema: errorSchema } } },
    404: { description: 'Recurso não encontrado', content: { 'application/json': { schema: errorSchema } } },
    409: { description: 'Conflito (duplicação, horário, bloqueio por notas)', content: { 'application/json': { schema: errorSchema } } },
    500: { description: 'Erro interno do servidor', content: { 'application/json': { schema: errorSchema } } },
  };
}

function studentResponses(dataSchema: OpenApiSchema): Record<string, unknown> {
  return {
    ...responses(dataSchema),
    403: {
      description: 'Estudante com dívida financeira — bloqueado de consultar notas (FINANCIAL_ACCESS_BLOCKED)',
      content: { 'application/json': { schema: errorSchema } },
    },
    503: {
      description: 'Serviço financeiro indisponível — falha fechada (FINANCIAL_VERIFICATION_UNAVAILABLE)',
      content: { 'application/json': { schema: errorSchema } },
    },
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
            200: {
              description: 'Credenciais válidas',
              content: { 'application/json': { schema: successEnvelope(authTokens) } },
            },
            400: { description: 'Requisição inválida', content: { 'application/json': { schema: errorSchema } } },
            401: { description: 'Credenciais inválidas ou utilizador inativo', content: { 'application/json': { schema: errorSchema } } },
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
            200: {
              description: 'Novo par de tokens',
              content: { 'application/json': { schema: successEnvelope(authTokens) } },
            },
            400: { description: 'Requisição inválida', content: { 'application/json': { schema: errorSchema } } },
            401: { description: 'RefreshToken inválido, expirado ou já utilizado', content: { 'application/json': { schema: errorSchema } } },
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
            200: { description: 'Sessão revogada', content: { 'application/json': { schema: successEnvelope({ type: 'object', properties: { revoked: { type: 'boolean' } } }) } } },
            400: { description: 'Requisição inválida', content: { 'application/json': { schema: errorSchema } } },
            401: { description: 'Não autenticado', content: { 'application/json': { schema: errorSchema } } },
          },
        },
      },
      '/api/v1/results/calculation-methods': {
        get: {
          tags: ['Resultados'],
          summary: 'Lista os métodos de cálculo disponíveis',
          description: 'Retorna os 6 métodos de cálculo suportados pelo motor académico.',
          responses: responses({ type: 'array', items: calculationMethodMetaSchema }),
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
          description: 'Para estudantes, devolve 403 cuando o utilizador tem dívida financeira (fail-closed 503 se o serviço financeiro estiver indisponível).',
          parameters: [idParam('assessmentId')],
          responses: studentResponses({ type: 'array', items: grade }),
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
          description: 'Estudantes apenas veem os próprios resultados; com dívida financeira recebem 403 (fail-closed 503).',
          parameters: [
            queryParam('termId'),
            queryParam('classId'),
            queryParam('subjectId'),
            queryParam('studentId'),
            pageParam,
            pageSizeParam,
          ],
          responses: studentResponses({ type: 'array', items: result }),
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
          responses: responses({ type: 'object' }),
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
          description: 'Para estudantes, devolve 403 com dívida financeira (fail-closed 503); o staff vê linhas de endividados mascaradas (debtRestricted).',
          parameters: [idParam('classId'), queryParam('termId'), queryParam('subjectId')],
          responses: studentResponses({ type: 'object' }),
        },
      },
      '/api/v1/schools': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista escolas (catálogo)',
          description: 'Referência para montar formulários: id + nome + código.',
          parameters: [pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: school }),
        },
      },
      '/api/v1/academic-years': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista anos letivos (catálogo)',
          parameters: [pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: academicYear }),
        },
      },
      '/api/v1/terms': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista períodos/termos letivos (catálogo)',
          description: 'Filtro opcional por ano letivo.',
          parameters: [queryParam('academicYearId'), pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: term }),
        },
      },
      '/api/v1/classes': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista turmas (catálogo)',
          description: 'Filtros opcionais por período ou ano letivo.',
          parameters: [queryParam('termId'), queryParam('academicYearId'), pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: classSchema }),
        },
      },
      '/api/v1/subjects': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista disciplinas (catálogo)',
          parameters: [pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: subject }),
        },
      },
      '/api/v1/teachers': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista professores (catálogo)',
          parameters: [pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: teacher }),
        },
      },
      '/api/v1/students': {
        get: {
          tags: ['Catálogo'],
          summary: 'Lista alunos (catálogo)',
          description: 'Filtros opcionais por turma ou período (usa matrículas ativas).',
          parameters: [queryParam('classId'), queryParam('termId'), pageParam, pageSizeParam],
          responses: responses({ type: 'array', items: student }),
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
}