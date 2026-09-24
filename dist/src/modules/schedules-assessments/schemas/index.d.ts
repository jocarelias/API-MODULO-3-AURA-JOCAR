import { z } from 'zod';
export declare const uuidSchema: z.ZodString;
export declare const optionalUuid: z.ZodOptional<z.ZodString>;
export declare const pageSchema: z.ZodDefault<z.ZodNumber>;
export declare const pageSizeSchema: z.ZodDefault<z.ZodNumber>;
export declare const createAssessmentSchema: z.ZodObject<{
    termId: z.ZodString;
    academicYearId: z.ZodString;
    classId: z.ZodString;
    subjectId: z.ZodString;
    teacherId: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<[string, ...string[]]>;
    description: z.ZodOptional<z.ZodString>;
    date: z.ZodString;
    maxScore: z.ZodDefault<z.ZodNumber>;
    weight: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["DRAFT", "SCHEDULED", "OPEN", "CLOSED", "CANCELLED"]>>;
}, "strict", z.ZodTypeAny, {
    maxScore: number;
    academicYearId: string;
    termId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    name: string;
    type: string;
    date: string;
    weight: number;
    description?: string | undefined;
    status?: "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "CANCELLED" | undefined;
}, {
    academicYearId: string;
    termId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    name: string;
    type: string;
    date: string;
    maxScore?: number | undefined;
    description?: string | undefined;
    weight?: number | undefined;
    status?: "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "CANCELLED" | undefined;
}>;
export declare const updateAssessmentSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    date: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    maxScore: z.ZodOptional<z.ZodNumber>;
    weight: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["DRAFT", "SCHEDULED", "OPEN", "CLOSED", "CANCELLED"]>>;
}, "strict", z.ZodTypeAny, {
    maxScore?: number | undefined;
    name?: string | undefined;
    type?: string | undefined;
    description?: string | null | undefined;
    date?: string | undefined;
    weight?: number | undefined;
    status?: "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "CANCELLED" | undefined;
}, {
    maxScore?: number | undefined;
    name?: string | undefined;
    type?: string | undefined;
    description?: string | null | undefined;
    date?: string | undefined;
    weight?: number | undefined;
    status?: "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "CANCELLED" | undefined;
}>;
export declare const assessmentQuerySchema: z.ZodObject<{
    termId: z.ZodOptional<z.ZodString>;
    classId: z.ZodOptional<z.ZodString>;
    subjectId: z.ZodOptional<z.ZodString>;
    teacherId: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    termId?: string | undefined;
    classId?: string | undefined;
    subjectId?: string | undefined;
    teacherId?: string | undefined;
}, {
    termId?: string | undefined;
    classId?: string | undefined;
    subjectId?: string | undefined;
    teacherId?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const createGradeSchema: z.ZodObject<{
    studentId: z.ZodString;
    score: z.ZodNumber;
    comment: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    studentId: string;
    score: number;
    comment?: string | undefined;
}, {
    studentId: string;
    score: number;
    comment?: string | undefined;
}>;
export declare const updateGradeSchema: z.ZodObject<{
    score: z.ZodOptional<z.ZodNumber>;
    comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["SUBMITTED", "APPROVED", "REVISED"]>>;
}, "strict", z.ZodTypeAny, {
    status?: "APPROVED" | "SUBMITTED" | "REVISED" | undefined;
    score?: number | undefined;
    comment?: string | null | undefined;
}, {
    status?: "APPROVED" | "SUBMITTED" | "REVISED" | undefined;
    score?: number | undefined;
    comment?: string | null | undefined;
}>;
export declare const createScheduleSchema: z.ZodObject<{
    termId: z.ZodString;
    academicYearId: z.ZodString;
    classId: z.ZodString;
    subjectId: z.ZodString;
    teacherId: z.ZodString;
    dayOfWeek: z.ZodEnum<["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]>;
    startTime: z.ZodString;
    endTime: z.ZodString;
    room: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["ACTIVE", "INACTIVE", "CANCELLED"]>>;
}, "strict", z.ZodTypeAny, {
    academicYearId: string;
    termId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";
    startTime: string;
    endTime: string;
    status?: "CANCELLED" | "ACTIVE" | "INACTIVE" | undefined;
    room?: string | null | undefined;
}, {
    academicYearId: string;
    termId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";
    startTime: string;
    endTime: string;
    status?: "CANCELLED" | "ACTIVE" | "INACTIVE" | undefined;
    room?: string | null | undefined;
}>;
export declare const updateScheduleSchema: z.ZodObject<{
    dayOfWeek: z.ZodOptional<z.ZodEnum<["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]>>;
    startTime: z.ZodOptional<z.ZodString>;
    endTime: z.ZodOptional<z.ZodString>;
    room: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["ACTIVE", "INACTIVE", "CANCELLED"]>>;
}, "strict", z.ZodTypeAny, {
    status?: "CANCELLED" | "ACTIVE" | "INACTIVE" | undefined;
    dayOfWeek?: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | undefined;
    startTime?: string | undefined;
    endTime?: string | undefined;
    room?: string | null | undefined;
}, {
    status?: "CANCELLED" | "ACTIVE" | "INACTIVE" | undefined;
    dayOfWeek?: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | undefined;
    startTime?: string | undefined;
    endTime?: string | undefined;
    room?: string | null | undefined;
}>;
export declare const scheduleQuerySchema: z.ZodObject<{
    termId: z.ZodOptional<z.ZodString>;
    classId: z.ZodOptional<z.ZodString>;
    teacherId: z.ZodOptional<z.ZodString>;
    studentId: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    termId?: string | undefined;
    classId?: string | undefined;
    teacherId?: string | undefined;
    studentId?: string | undefined;
}, {
    termId?: string | undefined;
    classId?: string | undefined;
    teacherId?: string | undefined;
    studentId?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const createResultSchema: z.ZodObject<{
    classId: z.ZodString;
    subjectId: z.ZodString;
    termId: z.ZodString;
    studentIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    termId: string;
    classId: string;
    subjectId: string;
    studentIds?: string[] | undefined;
}, {
    termId: string;
    classId: string;
    subjectId: string;
    studentIds?: string[] | undefined;
}>;
export declare const updateResultSchema: z.ZodObject<{}, "strict", z.ZodTypeAny, {}, {}>;
export declare const resultQuerySchema: z.ZodObject<{
    termId: z.ZodOptional<z.ZodString>;
    classId: z.ZodOptional<z.ZodString>;
    subjectId: z.ZodOptional<z.ZodString>;
    studentId: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    termId?: string | undefined;
    classId?: string | undefined;
    subjectId?: string | undefined;
    studentId?: string | undefined;
}, {
    termId?: string | undefined;
    classId?: string | undefined;
    subjectId?: string | undefined;
    studentId?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const idParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const assessmentIdParamsSchema: z.ZodObject<{
    assessmentId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    assessmentId: string;
}, {
    assessmentId: string;
}>;
export declare const gradeParamsSchema: z.ZodObject<{
    assessmentId: z.ZodString;
    gradeId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    assessmentId: string;
    gradeId: string;
}, {
    assessmentId: string;
    gradeId: string;
}>;
export declare const classIdParamsSchema: z.ZodObject<{
    classId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    classId: string;
}, {
    classId: string;
}>;
export declare const printPautaQuerySchema: z.ZodObject<{
    termId: z.ZodOptional<z.ZodString>;
    subjectId: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    termId?: string | undefined;
    subjectId?: string | undefined;
}, {
    termId?: string | undefined;
    subjectId?: string | undefined;
}>;
export declare const printScheduleQuerySchema: z.ZodObject<{
    termId: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    termId?: string | undefined;
}, {
    termId?: string | undefined;
}>;
export declare const calculationMethodSchema: z.ZodEnum<["ARITHMETIC_MEAN", "WEIGHTED_PERCENTAGE", "PERCENTAGE_SUM", "NORMALIZED_WEIGHTED_MEAN", "COMPONENT_BASED", "CUSTOM_WEIGHTED"]>;
export declare const roundingSchema: z.ZodObject<{
    decimals: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>]>;
}, "strict", z.ZodTypeAny, {
    decimals: 0 | 2 | 1;
}, {
    decimals: 0 | 2 | 1;
}>;
export declare const calculationItemSchema: z.ZodObject<{
    assessmentId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
    score: z.ZodNumber;
    weight: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    score: number;
    name?: string | undefined;
    type?: string | undefined;
    weight?: number | undefined;
    assessmentId?: string | undefined;
}, {
    score: number;
    name?: string | undefined;
    type?: string | undefined;
    weight?: number | undefined;
    assessmentId?: string | undefined;
}>;
export declare const calculationComponentSchema: z.ZodType<{
    id?: string;
    assessmentId?: string;
    name?: string;
    weight: number;
    score?: number;
    children?: z.infer<typeof calculationComponentSchema>[];
}, z.ZodTypeDef, unknown>;
export declare const calculationInputSchema: z.ZodEffects<z.ZodObject<{
    method: z.ZodEnum<["ARITHMETIC_MEAN", "WEIGHTED_PERCENTAGE", "PERCENTAGE_SUM", "NORMALIZED_WEIGHTED_MEAN", "COMPONENT_BASED", "CUSTOM_WEIGHTED"]>;
    items: z.ZodArray<z.ZodObject<{
        assessmentId: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
        score: z.ZodNumber;
        weight: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        score: number;
        name?: string | undefined;
        type?: string | undefined;
        weight?: number | undefined;
        assessmentId?: string | undefined;
    }, {
        score: number;
        name?: string | undefined;
        type?: string | undefined;
        weight?: number | undefined;
        assessmentId?: string | undefined;
    }>, "many">;
    components: z.ZodOptional<z.ZodArray<z.ZodType<{
        id?: string;
        assessmentId?: string;
        name?: string;
        weight: number;
        score?: number;
        children?: z.infer<typeof calculationComponentSchema>[];
    }, z.ZodTypeDef, unknown>, "many">>;
    formula: z.ZodOptional<z.ZodString>;
    rounding: z.ZodOptional<z.ZodObject<{
        decimals: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>]>;
    }, "strict", z.ZodTypeAny, {
        decimals: 0 | 2 | 1;
    }, {
        decimals: 0 | 2 | 1;
    }>>;
    minScore: z.ZodOptional<z.ZodNumber>;
    maxScore: z.ZodOptional<z.ZodNumber>;
    expectedTotal: z.ZodOptional<z.ZodNumber>;
    allowNormalization: z.ZodOptional<z.ZodBoolean>;
    top: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    method: "ARITHMETIC_MEAN" | "WEIGHTED_PERCENTAGE" | "PERCENTAGE_SUM" | "NORMALIZED_WEIGHTED_MEAN" | "COMPONENT_BASED" | "CUSTOM_WEIGHTED";
    items: {
        score: number;
        name?: string | undefined;
        type?: string | undefined;
        weight?: number | undefined;
        assessmentId?: string | undefined;
    }[];
    minScore?: number | undefined;
    maxScore?: number | undefined;
    components?: {
        id?: string;
        assessmentId?: string;
        name?: string;
        weight: number;
        score?: number;
        children?: z.infer<typeof calculationComponentSchema>[];
    }[] | undefined;
    formula?: string | undefined;
    rounding?: {
        decimals: 0 | 2 | 1;
    } | undefined;
    expectedTotal?: number | undefined;
    allowNormalization?: boolean | undefined;
    top?: number | undefined;
}, {
    method: "ARITHMETIC_MEAN" | "WEIGHTED_PERCENTAGE" | "PERCENTAGE_SUM" | "NORMALIZED_WEIGHTED_MEAN" | "COMPONENT_BASED" | "CUSTOM_WEIGHTED";
    items: {
        score: number;
        name?: string | undefined;
        type?: string | undefined;
        weight?: number | undefined;
        assessmentId?: string | undefined;
    }[];
    minScore?: number | undefined;
    maxScore?: number | undefined;
    components?: unknown[] | undefined;
    formula?: string | undefined;
    rounding?: {
        decimals: 0 | 2 | 1;
    } | undefined;
    expectedTotal?: number | undefined;
    allowNormalization?: boolean | undefined;
    top?: number | undefined;
}>, {
    method: "ARITHMETIC_MEAN" | "WEIGHTED_PERCENTAGE" | "PERCENTAGE_SUM" | "NORMALIZED_WEIGHTED_MEAN" | "COMPONENT_BASED" | "CUSTOM_WEIGHTED";
    items: {
        score: number;
        name?: string | undefined;
        type?: string | undefined;
        weight?: number | undefined;
        assessmentId?: string | undefined;
    }[];
    minScore?: number | undefined;
    maxScore?: number | undefined;
    components?: {
        id?: string;
        assessmentId?: string;
        name?: string;
        weight: number;
        score?: number;
        children?: z.infer<typeof calculationComponentSchema>[];
    }[] | undefined;
    formula?: string | undefined;
    rounding?: {
        decimals: 0 | 2 | 1;
    } | undefined;
    expectedTotal?: number | undefined;
    allowNormalization?: boolean | undefined;
    top?: number | undefined;
}, {
    method: "ARITHMETIC_MEAN" | "WEIGHTED_PERCENTAGE" | "PERCENTAGE_SUM" | "NORMALIZED_WEIGHTED_MEAN" | "COMPONENT_BASED" | "CUSTOM_WEIGHTED";
    items: {
        score: number;
        name?: string | undefined;
        type?: string | undefined;
        weight?: number | undefined;
        assessmentId?: string | undefined;
    }[];
    minScore?: number | undefined;
    maxScore?: number | undefined;
    components?: unknown[] | undefined;
    formula?: string | undefined;
    rounding?: {
        decimals: 0 | 2 | 1;
    } | undefined;
    expectedTotal?: number | undefined;
    allowNormalization?: boolean | undefined;
    top?: number | undefined;
}>;
//# sourceMappingURL=index.d.ts.map