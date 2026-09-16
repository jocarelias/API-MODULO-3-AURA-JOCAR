import { z } from 'zod';
import { EVALUATION_TYPES, EVALUATION_DEFAULT_MAX_SCORE, TIME_PATTERN } from '../domain/evaluation';
import { CALCULATION_METHOD_CODES } from '../domain/calculationEngine';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
const ASSESSMENT_DB_STATUS = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'] as const;
const GRADE_DB_STATUS = ['SUBMITTED', 'APPROVED', 'REVISED'] as const;
const SCHEDULE_DB_STATUS = ['ACTIVE', 'INACTIVE', 'CANCELLED'] as const;

export const uuidSchema = z.string().uuid('ID inválido (deve ser um UUID)');
export const optionalUuid = z.string().uuid('ID inválido (deve ser um UUID)').optional();
export const pageSchema = z.coerce.number().int().min(1, 'page deve ser >= 1').max(10000).default(1);
export const pageSizeSchema = z.coerce.number().int().min(1, 'pageSize deve ser >= 1').max(100, 'pageSize máximo 100').default(100);

export const createAssessmentSchema = z
  .object({
    termId: uuidSchema,
    academicYearId: uuidSchema,
    classId: uuidSchema,
    subjectId: uuidSchema,
    teacherId: uuidSchema,
    name: z.string().min(1, 'Nome é obrigatório').max(200),
    type: z.enum(EVALUATION_TYPES as unknown as [string, ...string[]], { errorMap: () => ({ message: 'Tipo de avaliação inválido' }) }),
    description: z.string().max(500).optional(),
    date: z.string().datetime({ offset: true, message: 'Data inválida (ISO-8601 com offset)' }),
    maxScore: z.number().positive('maxScore deve ser positivo').max(100).default(EVALUATION_DEFAULT_MAX_SCORE),
    weight: z.number().positive('Peso deve ser maior que 0').max(100).default(1),
    status: z.enum(ASSESSMENT_DB_STATUS).optional(),
  })
  .strict();

export const updateAssessmentSchema = z
  .object({
    name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
    description: z.string().max(500).nullable().optional(),
    date: z.string().datetime({ offset: true, message: 'Data inválida (ISO-8601 com offset)' }).optional(),
    type: z.enum(EVALUATION_TYPES as unknown as [string, ...string[]], { errorMap: () => ({ message: 'Tipo de avaliação inválido' }) }).optional(),
    maxScore: z.number().positive('maxScore deve ser positivo').max(100).optional(),
    weight: z.number().positive('Peso deve ser maior que 0').max(100).optional(),
    status: z.enum(ASSESSMENT_DB_STATUS).optional(),
  })
  .strict();

export const assessmentQuerySchema = z
  .object({
    termId: optionalUuid,
    classId: optionalUuid,
    subjectId: optionalUuid,
    teacherId: optionalUuid,
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const createGradeSchema = z
  .object({
    studentId: uuidSchema,
    score: z.number().min(0, 'Nota não pode ser negativa').max(100, 'Nota acima do limite'),
    comment: z.string().max(500).optional(),
  })
  .strict();

export const updateGradeSchema = z
  .object({
    score: z.number().min(0, 'Nota não pode ser negativa').max(100, 'Nota acima do limite').optional(),
    comment: z.string().max(500).nullable().optional(),
    status: z.enum(GRADE_DB_STATUS).optional(),
  })
  .strict();

export const createScheduleSchema = z
  .object({
    termId: uuidSchema,
    academicYearId: uuidSchema,
    classId: uuidSchema,
    subjectId: uuidSchema,
    teacherId: uuidSchema,
    dayOfWeek: z.enum(DAYS, { errorMap: () => ({ message: 'Dia da semana inválido' }) }),
    startTime: z.string().regex(TIME_PATTERN, 'Hora inválida (HH:mm)'),
    endTime: z.string().regex(TIME_PATTERN, 'Hora inválida (HH:mm)'),
    room: z.string().max(100).nullable().optional(),
    status: z.enum(SCHEDULE_DB_STATUS).optional(),
  })
  .strict();

export const updateScheduleSchema = z
  .object({
    dayOfWeek: z.enum(DAYS, { errorMap: () => ({ message: 'Dia da semana inválido' }) }).optional(),
    startTime: z.string().regex(TIME_PATTERN, 'Hora inválida (HH:mm)').optional(),
    endTime: z.string().regex(TIME_PATTERN, 'Hora inválida (HH:mm)').optional(),
    room: z.string().max(100).nullable().optional(),
    status: z.enum(SCHEDULE_DB_STATUS).optional(),
  })
  .strict();

export const scheduleQuerySchema = z
  .object({
    termId: optionalUuid,
    classId: optionalUuid,
    teacherId: optionalUuid,
    studentId: optionalUuid,
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const createResultSchema = z
  .object({
    classId: uuidSchema,
    subjectId: uuidSchema,
    termId: uuidSchema,
    studentIds: z.array(uuidSchema).max(500).optional(),
  })
  .strict();

export const updateResultSchema = z.object({}).strict();

export const resultQuerySchema = z
  .object({
    termId: optionalUuid,
    classId: optionalUuid,
    subjectId: optionalUuid,
    studentId: optionalUuid,
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const idParamsSchema = z.object({ id: uuidSchema }).strict();
export const assessmentIdParamsSchema = z.object({ assessmentId: uuidSchema }).strict();
export const gradeParamsSchema = z.object({ assessmentId: uuidSchema, gradeId: uuidSchema }).strict();
export const classIdParamsSchema = z.object({ classId: uuidSchema }).strict();
export const printPautaQuerySchema = z.object({ termId: optionalUuid, subjectId: optionalUuid }).strict();
export const printScheduleQuerySchema = z.object({ termId: optionalUuid }).strict();

export const catalogQuerySchema = z
  .object({
    academicYearId: optionalUuid,
    termId: optionalUuid,
    classId: optionalUuid,
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const calculationMethodSchema = z.enum(CALCULATION_METHOD_CODES, {
  errorMap: () => ({ message: 'Método de cálculo inválido' }),
});

export const roundingSchema = z
  .object({
    decimals: z.union([z.literal(0), z.literal(1), z.literal(2)], {
      errorMap: () => ({ message: 'Casas decimais devem ser 0, 1 ou 2' }),
    }),
  })
  .strict();

export const calculationItemSchema = z
  .object({
    assessmentId: z.string().uuid('ID inválido (deve ser um UUID)').optional(),
    name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
    type: z
      .enum(EVALUATION_TYPES as unknown as [string, ...string[]], {
        errorMap: () => ({ message: 'Tipo de avaliação inválido' }),
      })
      .optional(),
    score: z.number({ message: 'Nota deve ser um número' }).min(0, 'Nota não pode ser negativa').max(100, 'Nota acima do limite'),
    weight: z
      .number({ message: 'Peso deve ser um número' })
      .min(0, 'Peso não pode ser negativo')
      .max(100, 'Peso acima do máximo permitido')
      .optional(),
  })
  .strict();

export const calculationComponentSchema: z.ZodType<{
  id?: string;
  assessmentId?: string;
  name?: string;
  weight: number;
  score?: number;
  children?: z.infer<typeof calculationComponentSchema>[];
}, z.ZodTypeDef, unknown> = z
  .object({
    id: z.string().min(1, 'ID do componente é obrigatório').optional(),
    assessmentId: z.string().uuid('ID inválido (deve ser um UUID)').optional(),
    name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
    weight: z.number({ message: 'Peso deve ser um número' }).positive('Peso deve ser maior que zero').max(100, 'Peso acima do máximo'),
    score: z.number({ message: 'Nota deve ser um número' }).min(0, 'Nota não pode ser negativa').max(100, 'Nota acima do limite').optional(),
    children: z.array(z.lazy(() => calculationComponentSchema)).min(1, 'Nível sem filhos').optional(),
  })
  .strict();

export const calculationInputSchema = z
  .object({
    method: calculationMethodSchema,
    items: z.array(calculationItemSchema).max(500, 'Máximo de 500 itens'),
    components: z.array(calculationComponentSchema).min(1).max(100).optional(),
    formula: z.string().min(1, 'Fórmula é obrigatória').max(100).optional(),
    rounding: roundingSchema.optional(),
    minScore: z.number({ message: 'minScore deve ser um número' }).min(0).max(100).optional(),
    maxScore: z.number({ message: 'maxScore deve ser um número' }).min(1).max(100).optional(),
    expectedTotal: z.number({ message: 'expectedTotal deve ser um número' }).positive('expectedTotal deve ser positivo').max(1000).optional(),
    allowNormalization: z.boolean().optional(),
    top: z.number({ message: 'top deve ser um número' }).int('top deve ser inteiro').min(1).max(100).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.items.length === 0 && data.method !== 'COMPONENT_BASED') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'A lista de notas não pode estar vazia' });
    }
    if (data.minScore !== undefined && data.maxScore !== undefined && data.minScore >= data.maxScore) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxScore'], message: 'maxScore deve ser maior que minScore' });
    }
    if (data.method === 'CUSTOM_WEIGHTED' && !data.formula) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['formula'], message: 'Fórmula é obrigatória para CUSTOM_WEIGHTED' });
    }
    if (data.method === 'COMPONENT_BASED' && !data.components) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['components'],
        message: 'Componentes são obrigatórios para COMPONENT_BASED',
      });
    }
  });
