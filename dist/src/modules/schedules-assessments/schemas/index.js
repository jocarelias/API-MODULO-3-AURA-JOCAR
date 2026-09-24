"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculationInputSchema = exports.calculationComponentSchema = exports.calculationItemSchema = exports.roundingSchema = exports.calculationMethodSchema = exports.printScheduleQuerySchema = exports.printPautaQuerySchema = exports.classIdParamsSchema = exports.gradeParamsSchema = exports.assessmentIdParamsSchema = exports.idParamsSchema = exports.resultQuerySchema = exports.updateResultSchema = exports.createResultSchema = exports.scheduleQuerySchema = exports.updateScheduleSchema = exports.createScheduleSchema = exports.updateGradeSchema = exports.createGradeSchema = exports.assessmentQuerySchema = exports.updateAssessmentSchema = exports.createAssessmentSchema = exports.pageSizeSchema = exports.pageSchema = exports.optionalUuid = exports.uuidSchema = void 0;
const zod_1 = require("zod");
const evaluation_1 = require("../domain/evaluation");
const calculationEngine_1 = require("../domain/calculationEngine");
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const ASSESSMENT_DB_STATUS = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'];
const GRADE_DB_STATUS = ['SUBMITTED', 'APPROVED', 'REVISED'];
const SCHEDULE_DB_STATUS = ['ACTIVE', 'INACTIVE', 'CANCELLED'];
exports.uuidSchema = zod_1.z.string().uuid('ID inválido (deve ser um UUID)');
exports.optionalUuid = zod_1.z.string().uuid('ID inválido (deve ser um UUID)').optional();
exports.pageSchema = zod_1.z.coerce.number().int().min(1, 'page deve ser >= 1').max(10000).default(1);
exports.pageSizeSchema = zod_1.z.coerce.number().int().min(1, 'pageSize deve ser >= 1').max(100, 'pageSize máximo 100').default(100);
exports.createAssessmentSchema = zod_1.z
    .object({
    termId: exports.uuidSchema,
    academicYearId: exports.uuidSchema,
    classId: exports.uuidSchema,
    subjectId: exports.uuidSchema,
    teacherId: exports.uuidSchema,
    name: zod_1.z.string().min(1, 'Nome é obrigatório').max(200),
    type: zod_1.z.enum(evaluation_1.EVALUATION_TYPES, { errorMap: () => ({ message: 'Tipo de avaliação inválido' }) }),
    description: zod_1.z.string().max(500).optional(),
    date: zod_1.z.string().datetime({ offset: true, message: 'Data inválida (ISO-8601 com offset)' }),
    maxScore: zod_1.z.number().positive('maxScore deve ser positivo').max(100).default(evaluation_1.EVALUATION_DEFAULT_MAX_SCORE),
    weight: zod_1.z.number().positive('Peso deve ser maior que 0').max(100).default(1),
    status: zod_1.z.enum(ASSESSMENT_DB_STATUS).optional(),
})
    .strict();
exports.updateAssessmentSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1, 'Nome é obrigatório').max(200).optional(),
    description: zod_1.z.string().max(500).nullable().optional(),
    date: zod_1.z.string().datetime({ offset: true, message: 'Data inválida (ISO-8601 com offset)' }).optional(),
    type: zod_1.z.enum(evaluation_1.EVALUATION_TYPES, { errorMap: () => ({ message: 'Tipo de avaliação inválido' }) }).optional(),
    maxScore: zod_1.z.number().positive('maxScore deve ser positivo').max(100).optional(),
    weight: zod_1.z.number().positive('Peso deve ser maior que 0').max(100).optional(),
    status: zod_1.z.enum(ASSESSMENT_DB_STATUS).optional(),
})
    .strict();
exports.assessmentQuerySchema = zod_1.z
    .object({
    termId: exports.optionalUuid,
    classId: exports.optionalUuid,
    subjectId: exports.optionalUuid,
    teacherId: exports.optionalUuid,
    page: exports.pageSchema,
    pageSize: exports.pageSizeSchema,
})
    .strict();
exports.createGradeSchema = zod_1.z
    .object({
    studentId: exports.uuidSchema,
    score: zod_1.z.number().min(0, 'Nota não pode ser negativa').max(100, 'Nota acima do limite'),
    comment: zod_1.z.string().max(500).optional(),
})
    .strict();
exports.updateGradeSchema = zod_1.z
    .object({
    score: zod_1.z.number().min(0, 'Nota não pode ser negativa').max(100, 'Nota acima do limite').optional(),
    comment: zod_1.z.string().max(500).nullable().optional(),
    status: zod_1.z.enum(GRADE_DB_STATUS).optional(),
})
    .strict();
exports.createScheduleSchema = zod_1.z
    .object({
    termId: exports.uuidSchema,
    academicYearId: exports.uuidSchema,
    classId: exports.uuidSchema,
    subjectId: exports.uuidSchema,
    teacherId: exports.uuidSchema,
    dayOfWeek: zod_1.z.enum(DAYS, { errorMap: () => ({ message: 'Dia da semana inválido' }) }),
    startTime: zod_1.z.string().regex(evaluation_1.TIME_PATTERN, 'Hora inválida (HH:mm)'),
    endTime: zod_1.z.string().regex(evaluation_1.TIME_PATTERN, 'Hora inválida (HH:mm)'),
    room: zod_1.z.string().max(100).nullable().optional(),
    status: zod_1.z.enum(SCHEDULE_DB_STATUS).optional(),
})
    .strict();
exports.updateScheduleSchema = zod_1.z
    .object({
    dayOfWeek: zod_1.z.enum(DAYS, { errorMap: () => ({ message: 'Dia da semana inválido' }) }).optional(),
    startTime: zod_1.z.string().regex(evaluation_1.TIME_PATTERN, 'Hora inválida (HH:mm)').optional(),
    endTime: zod_1.z.string().regex(evaluation_1.TIME_PATTERN, 'Hora inválida (HH:mm)').optional(),
    room: zod_1.z.string().max(100).nullable().optional(),
    status: zod_1.z.enum(SCHEDULE_DB_STATUS).optional(),
})
    .strict();
exports.scheduleQuerySchema = zod_1.z
    .object({
    termId: exports.optionalUuid,
    classId: exports.optionalUuid,
    teacherId: exports.optionalUuid,
    studentId: exports.optionalUuid,
    page: exports.pageSchema,
    pageSize: exports.pageSizeSchema,
})
    .strict();
exports.createResultSchema = zod_1.z
    .object({
    classId: exports.uuidSchema,
    subjectId: exports.uuidSchema,
    termId: exports.uuidSchema,
    studentIds: zod_1.z.array(exports.uuidSchema).max(500).optional(),
})
    .strict();
exports.updateResultSchema = zod_1.z.object({}).strict();
exports.resultQuerySchema = zod_1.z
    .object({
    termId: exports.optionalUuid,
    classId: exports.optionalUuid,
    subjectId: exports.optionalUuid,
    studentId: exports.optionalUuid,
    page: exports.pageSchema,
    pageSize: exports.pageSizeSchema,
})
    .strict();
exports.idParamsSchema = zod_1.z.object({ id: exports.uuidSchema }).strict();
exports.assessmentIdParamsSchema = zod_1.z.object({ assessmentId: exports.uuidSchema }).strict();
exports.gradeParamsSchema = zod_1.z.object({ assessmentId: exports.uuidSchema, gradeId: exports.uuidSchema }).strict();
exports.classIdParamsSchema = zod_1.z.object({ classId: exports.uuidSchema }).strict();
exports.printPautaQuerySchema = zod_1.z.object({ termId: exports.optionalUuid, subjectId: exports.optionalUuid }).strict();
exports.printScheduleQuerySchema = zod_1.z.object({ termId: exports.optionalUuid }).strict();
exports.calculationMethodSchema = zod_1.z.enum(calculationEngine_1.CALCULATION_METHOD_CODES, {
    errorMap: () => ({ message: 'Método de cálculo inválido' }),
});
exports.roundingSchema = zod_1.z
    .object({
    decimals: zod_1.z.union([zod_1.z.literal(0), zod_1.z.literal(1), zod_1.z.literal(2)], {
        errorMap: () => ({ message: 'Casas decimais devem ser 0, 1 ou 2' }),
    }),
})
    .strict();
exports.calculationItemSchema = zod_1.z
    .object({
    assessmentId: zod_1.z.string().uuid('ID inválido (deve ser um UUID)').optional(),
    name: zod_1.z.string().min(1, 'Nome é obrigatório').max(200).optional(),
    type: zod_1.z
        .enum(evaluation_1.EVALUATION_TYPES, {
        errorMap: () => ({ message: 'Tipo de avaliação inválido' }),
    })
        .optional(),
    score: zod_1.z.number({ message: 'Nota deve ser um número' }).min(0, 'Nota não pode ser negativa').max(100, 'Nota acima do limite'),
    weight: zod_1.z
        .number({ message: 'Peso deve ser um número' })
        .min(0, 'Peso não pode ser negativo')
        .max(100, 'Peso acima do máximo permitido')
        .optional(),
})
    .strict();
exports.calculationComponentSchema = zod_1.z
    .object({
    id: zod_1.z.string().min(1, 'ID do componente é obrigatório').optional(),
    assessmentId: zod_1.z.string().uuid('ID inválido (deve ser um UUID)').optional(),
    name: zod_1.z.string().min(1, 'Nome é obrigatório').max(200).optional(),
    weight: zod_1.z.number({ message: 'Peso deve ser um número' }).positive('Peso deve ser maior que zero').max(100, 'Peso acima do máximo'),
    score: zod_1.z.number({ message: 'Nota deve ser um número' }).min(0, 'Nota não pode ser negativa').max(100, 'Nota acima do limite').optional(),
    children: zod_1.z.array(zod_1.z.lazy(() => exports.calculationComponentSchema)).min(1, 'Nível sem filhos').optional(),
})
    .strict();
exports.calculationInputSchema = zod_1.z
    .object({
    method: exports.calculationMethodSchema,
    items: zod_1.z.array(exports.calculationItemSchema).max(500, 'Máximo de 500 itens'),
    components: zod_1.z.array(exports.calculationComponentSchema).min(1).max(100).optional(),
    formula: zod_1.z.string().min(1, 'Fórmula é obrigatória').max(100).optional(),
    rounding: exports.roundingSchema.optional(),
    minScore: zod_1.z.number({ message: 'minScore deve ser um número' }).min(0).max(100).optional(),
    maxScore: zod_1.z.number({ message: 'maxScore deve ser um número' }).min(1).max(100).optional(),
    expectedTotal: zod_1.z.number({ message: 'expectedTotal deve ser um número' }).positive('expectedTotal deve ser positivo').max(1000).optional(),
    allowNormalization: zod_1.z.boolean().optional(),
    top: zod_1.z.number({ message: 'top deve ser um número' }).int('top deve ser inteiro').min(1).max(100).optional(),
})
    .strict()
    .superRefine((data, ctx) => {
    if (data.items.length === 0 && data.method !== 'COMPONENT_BASED') {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['items'], message: 'A lista de notas não pode estar vazia' });
    }
    if (data.minScore !== undefined && data.maxScore !== undefined && data.minScore >= data.maxScore) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['maxScore'], message: 'maxScore deve ser maior que minScore' });
    }
    if (data.method === 'CUSTOM_WEIGHTED' && !data.formula) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['formula'], message: 'Fórmula é obrigatória para CUSTOM_WEIGHTED' });
    }
    if (data.method === 'COMPONENT_BASED' && !data.components) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['components'],
            message: 'Componentes são obrigatórios para COMPONENT_BASED',
        });
    }
});
//# sourceMappingURL=index.js.map