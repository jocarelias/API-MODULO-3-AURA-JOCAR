export declare const CALCULATION_MIN_SCORE_DEFAULT = 0;
export declare const CALCULATION_MAX_SCORE_DEFAULT = 20;
export declare const CALCULATION_EXPECTED_TOTAL_DEFAULT = 100;
export declare const CALCULATION_DECIMALS_DEFAULT = 2;
export declare const CALCULATION_METHOD_CODES: readonly ["ARITHMETIC_MEAN", "WEIGHTED_PERCENTAGE", "PERCENTAGE_SUM", "NORMALIZED_WEIGHTED_MEAN", "COMPONENT_BASED", "CUSTOM_WEIGHTED"];
export type CalculationMethodCode = (typeof CALCULATION_METHOD_CODES)[number];
export type CalculationErrorCode = 'EMPTY_ITEMS' | 'INVALID_SCORE' | 'INVALID_WEIGHT' | 'WEIGHT_TOTAL_MISMATCH' | 'WEIGHT_SUM_MUST_BE_POSITIVE' | 'INVALID_COMPONENTS' | 'COMPONENT_WEIGHT_MISMATCH' | 'FORMULA_NOT_REGISTERED';
export declare const CALCULATION_ERROR_HTTP: Record<CalculationErrorCode, number>;
export declare class CalculationError extends Error {
    code: CalculationErrorCode;
    constructor(code: CalculationErrorCode, message: string);
}
export interface CalculationItem {
    assessmentId?: string;
    name?: string;
    type?: string;
    score: number;
    weight?: number;
}
export interface CalculationComponent {
    id?: string;
    assessmentId?: string;
    name?: string;
    weight: number;
    score?: number;
    children?: CalculationComponent[];
}
export interface RoundingOption {
    decimals: 0 | 1 | 2;
}
export interface CalculationInput {
    method: CalculationMethodCode;
    items: CalculationItem[];
    components?: CalculationComponent[];
    formula?: string;
    rounding?: RoundingOption;
    minScore?: number;
    maxScore?: number;
    expectedTotal?: number;
    allowNormalization?: boolean;
    top?: number;
}
export interface CalculationBreakdownEntry {
    id?: string;
    assessmentId?: string;
    name?: string;
    type?: string;
    label?: string;
    score: number;
    weight?: number;
    normalizedWeight?: number;
    contribution?: number;
    children?: CalculationBreakdownEntry[];
}
export interface CalculationResult {
    method: CalculationMethodCode;
    value: number;
    decimals: number;
    formula?: string;
    breakdown: CalculationBreakdownEntry[];
}
export interface CalculationMethodMeta {
    code: CalculationMethodCode;
    name: string;
    description: string;
    formula: string;
}
export interface CustomFormulaMeta {
    key: string;
    name: string;
    description: string;
    requiresWeights: boolean;
}
export declare function calculateArithmeticMean(input: CalculationInput): CalculationResult;
export declare function calculateWeightedPercentage(input: CalculationInput): CalculationResult;
export declare function calculatePercentageSum(input: CalculationInput): CalculationResult;
export declare function calculateNormalizedWeightedMean(input: CalculationInput): CalculationResult;
export declare function calculateComponentBased(input: CalculationInput): CalculationResult;
export interface CustomFormula {
    meta: CustomFormulaMeta;
    calculate(items: CalculationItem[], input: CalculationInput): number;
}
export declare const CUSTOM_FORMULAS: Record<string, CustomFormula>;
export declare function calculateCustomWeighted(input: CalculationInput): CalculationResult;
export declare function calculate(input: CalculationInput): CalculationResult;
export declare const CALCULATION_METHODS: CalculationMethodMeta[];
export declare const CUSTOM_FORMULA_LIST: CustomFormulaMeta[];
//# sourceMappingURL=calculationEngine.d.ts.map