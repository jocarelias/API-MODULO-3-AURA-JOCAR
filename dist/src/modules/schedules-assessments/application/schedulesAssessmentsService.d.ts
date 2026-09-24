import { Prisma, PrismaClient } from '@prisma/client';
import { AssessmentDto, GradeDto, ScheduleDto, ResultDto, CalculationInputDto, CalculationResultDto, CalculationMethodMetaDto } from '@smartcampus/shared-types';
export declare const TYPE_MAP: Record<string, string>;
export declare class DomainError extends Error {
    code: string;
    details: unknown[];
    httpStatus: number;
    constructor(code: string, message: string, details?: unknown[]);
}
export interface AssessmentInput {
    termId: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    name: string;
    type: string;
    description?: string | null;
    date: string;
    maxScore?: number;
    weight: number;
    status?: string;
}
export interface GradeInputDto {
    studentId: string;
    score: number;
    comment?: string | null;
}
export interface ScheduleInput {
    termId: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room?: string | null;
    status?: string;
}
export interface ResultInput {
    classId: string;
    subjectId: string;
    termId: string;
    studentIds?: string[];
}
export declare class SchedulesAssessmentsService {
    private prisma;
    constructor({ db }?: {
        db?: PrismaClient;
    });
    listAssessments({ termId, classId, subjectId, teacherId }?: {
        termId?: string;
        classId?: string;
        subjectId?: string;
        teacherId?: string;
    }): Promise<AssessmentDto[]>;
    getAssessment(id: string): Promise<AssessmentDto>;
    createAssessment(input: AssessmentInput): Promise<AssessmentDto>;
    updateAssessment(id: string, patch: Record<string, unknown>): Promise<AssessmentDto>;
    deleteAssessment(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    listGrades(assessmentId: string): Promise<GradeDto[]>;
    _recalculateInTx(tx: Prisma.TransactionClient, assessment: {
        classId: string;
        subjectId: string;
        termId: string;
        schoolId?: string;
        academicYearId?: string;
    }, studentIds?: string[]): Promise<void>;
    createGrade(assessmentId: string, input: GradeInputDto): Promise<GradeDto>;
    updateGrade(assessmentId: string, gradeId: string, patch: Record<string, unknown>): Promise<GradeDto>;
    listSchedules({ termId, classId, teacherId, studentId }?: {
        termId?: string;
        classId?: string;
        teacherId?: string;
        studentId?: string;
    }): Promise<ScheduleDto[]>;
    createSchedule(input: ScheduleInput): Promise<ScheduleDto>;
    findConflicts(input: ConflictCandidate, existing: ScheduleConflictRecord[]): {
        type: string;
        description: string;
    }[];
    updateSchedule(id: string, patch: Record<string, unknown>): Promise<ScheduleDto>;
    deleteSchedule(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    getSchedule(id: string): Promise<ScheduleDto>;
    listResults({ termId, classId, subjectId, studentId }?: {
        termId?: string;
        classId?: string;
        subjectId?: string;
        studentId?: string;
    }): Promise<ResultDto[]>;
    getResult(id: string): Promise<ResultDto>;
    createResults(input: ResultInput): Promise<ResultDto[]>;
    deleteResult(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    patchResult(id: string): Promise<ResultDto>;
    calculateResult(input: CalculationInputDto): Promise<CalculationResultDto>;
    listCalculationMethods(): CalculationMethodMetaDto[];
    getPrintClassSchedule(classId: string, termId?: string): Promise<Record<string, unknown>>;
    getPrintClassPauta(classId: string, termId?: string, subjectId?: string): Promise<Record<string, unknown>>;
}
export interface ConflictCandidate {
    teacherId: string;
    classId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room?: string | null;
}
export interface ScheduleConflictRecord {
    id: string;
    teacherId: string;
    classId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room: string | null;
    status: string;
}
//# sourceMappingURL=schedulesAssessmentsService.d.ts.map