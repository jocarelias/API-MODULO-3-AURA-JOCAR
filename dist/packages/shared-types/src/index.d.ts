export type AssessmentType = 'TESTE' | 'EXAME_NORMAL' | 'EXAME_RECURRENCIA';
export declare const ASSESSMENT_TYPES: AssessmentType[];
export declare const ASSESSMENT_DEFAULT_MAX_SCORE = 20;
export declare const PASSING_SCORE = 10;
export declare const RECOVERY_SCORE = 8;
export declare const DAYS_OF_WEEK: readonly ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
export declare const CALCULATION_METHODS: readonly ["ARITHMETIC_MEAN", "WEIGHTED_PERCENTAGE", "PERCENTAGE_SUM", "NORMALIZED_WEIGHTED_MEAN", "COMPONENT_BASED", "CUSTOM_WEIGHTED"];
export type CalculationMethod = (typeof CALCULATION_METHODS)[number];
export interface CalculationItemDto {
    assessmentId?: string;
    name?: string;
    type?: string;
    score: number;
    weight?: number;
}
export interface CalculationComponentDto {
    id?: string;
    assessmentId?: string;
    name?: string;
    weight: number;
    score?: number;
    children?: CalculationComponentDto[];
}
export interface CalculationInputDto {
    method: CalculationMethod;
    items: CalculationItemDto[];
    components?: CalculationComponentDto[];
    formula?: string;
    rounding?: {
        decimals: 0 | 1 | 2;
    };
    minScore?: number;
    maxScore?: number;
    expectedTotal?: number;
    allowNormalization?: boolean;
    top?: number;
}
export interface CalculationBreakdownEntryDto {
    id?: string;
    assessmentId?: string;
    name?: string;
    type?: string;
    label?: string;
    score: number;
    weight?: number;
    normalizedWeight?: number;
    contribution?: number;
    children?: CalculationBreakdownEntryDto[];
}
export interface CalculationResultDto {
    method: CalculationMethod;
    value: number;
    decimals: number;
    formula?: string;
    breakdown: CalculationBreakdownEntryDto[];
}
export interface CalculationMethodMetaDto {
    code: CalculationMethod;
    name: string;
    description: string;
    formula: string;
}
export declare const ASSESSMENT_STATUS: readonly ["DRAFT", "SCHEDULED", "OPEN", "CLOSED", "CANCELLED"];
export declare const GRADE_STATUS: readonly ["SUBMITTED", "APPROVED", "REVISED"];
export declare const SCHEDULE_STATUS: readonly ["ACTIVE", "INACTIVE", "CANCELLED"];
export declare const RESULT_STATUS: readonly ["APPROVED", "FAILED", "RECOVERY", "PENDING", "IN_PROGRESS"];
export interface AssessmentDto {
    id: string;
    schoolId: string;
    academicYearId: string;
    termId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    name: string;
    type: string;
    description: string | null;
    date: string | null;
    maxScore: number | null;
    weight: number | null;
    status: string;
    createdAt: string | null;
    updatedAt: string | null;
}
export interface GradeDto {
    id: string;
    assessmentId: string;
    studentId: string;
    score: number | null;
    comment: string | null;
    status: string;
    createdAt: string | null;
    updatedAt: string | null;
}
export interface ScheduleDto {
    id: string;
    schoolId: string;
    academicYearId: string;
    termId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room: string | null;
    status: string;
    createdAt: string | null;
    updatedAt: string | null;
}
export interface ResultDto {
    id: string;
    schoolId: string;
    academicYearId: string;
    termId: string;
    classId: string;
    subjectId: string;
    studentId: string;
    average: number | null;
    finalScore: number | null;
    calculationMethod: string | null;
    status: string;
    calculatedAt: string | null;
}
export declare function assessmentDto(record: Record<string, unknown>): AssessmentDto;
export declare function gradeDto(record: Record<string, unknown>): GradeDto;
export declare function scheduleDto(record: Record<string, unknown>): ScheduleDto;
export declare function resultDto(record: Record<string, unknown>): ResultDto;
export declare const campusModules: {
    G3_AVALIACOES_HORARIOS: {
        name: string;
        basePath: string;
        resources: string[];
        open: boolean;
    };
};
//# sourceMappingURL=index.d.ts.map