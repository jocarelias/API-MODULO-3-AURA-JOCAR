export type EvaluationType = 'TESTE' | 'EXAME_NORMAL' | 'EXAME_RECURRENCIA';
export declare const EVALUATION_TYPES: EvaluationType[];
export declare const EVALUATION_DEFAULT_MAX_SCORE = 20;
export declare const EVALUATION_MIN_SCORE = 0;
export declare const EVALUATION_MIN_WEIGHT = 0;
export declare const PASSING_SCORE = 10;
export declare const RECOVERY_SCORE = 8;
export declare function round2(value: number): number;
export declare function isValidEvaluationType(type: string): type is EvaluationType;
export declare function validateEvaluationType(type: string): {
    valid: true;
} | {
    valid: false;
    error: string;
};
export declare function validateWeight(weight: unknown): {
    valid: true;
} | {
    valid: false;
    error: string;
};
export declare function validateScore(score: unknown, maxScore?: number): {
    valid: true;
} | {
    valid: false;
    error: string;
};
export interface GradeInput {
    score: number;
    weight: number;
}
export declare function weightedAverage(grades: GradeInput[]): number | null;
export type ResultStatus = 'APPROVED' | 'RECOVERY' | 'FAILED' | 'IN_PROGRESS' | 'PENDING';
export declare function resolveResultStatus({ gradedCount, missingCount, average, }: {
    gradedCount: number;
    missingCount: number;
    average: number | null;
}): ResultStatus;
export declare function computeCompleteResult({ grades, missing, }: {
    grades: GradeInput[];
    missing?: number;
}): {
    average: number | null;
    status: ResultStatus;
};
export declare const TIME_PATTERN: RegExp;
export declare function validateTimeRange(startTime: string, endTime: string): {
    valid: true;
} | {
    valid: false;
    error: string;
};
//# sourceMappingURL=evaluation.d.ts.map