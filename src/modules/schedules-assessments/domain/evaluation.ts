export type EvaluationType = 'TESTE' | 'EXAME_NORMAL' | 'EXAME_RECURRENCIA';

export const EVALUATION_TYPES: EvaluationType[] = ['TESTE', 'EXAME_NORMAL', 'EXAME_RECURRENCIA'];

export const EVALUATION_DEFAULT_MAX_SCORE = 20;
export const EVALUATION_MIN_SCORE = 0;
export const EVALUATION_MIN_WEIGHT = 0;
export const PASSING_SCORE = 10;
export const RECOVERY_SCORE = 8;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isValidEvaluationType(type: string): type is EvaluationType {
  return (EVALUATION_TYPES as string[]).includes(type);
}

export function validateEvaluationType(type: string): { valid: true } | { valid: false; error: string } {
  if (!isValidEvaluationType(type)) {
    return { valid: false, error: `Tipo de avaliação inválido: ${type}` };
  }
  return { valid: true };
}

export function validateWeight(weight: unknown): { valid: true } | { valid: false; error: string } {
  if (typeof weight !== 'number' || Number.isNaN(weight)) {
    return { valid: false, error: 'Peso deve ser um número' };
  }
  if (weight <= EVALUATION_MIN_WEIGHT) {
    return { valid: false, error: `Peso deve ser maior que ${EVALUATION_MIN_WEIGHT}` };
  }
  return { valid: true };
}

export function validateScore(score: unknown, maxScore: number = EVALUATION_DEFAULT_MAX_SCORE): { valid: true } | { valid: false; error: string } {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return { valid: false, error: 'Nota deve ser um número' };
  }
  if (score < EVALUATION_MIN_SCORE) {
    return { valid: false, error: `Nota não pode ser menor que ${EVALUATION_MIN_SCORE}` };
  }
  if (score > maxScore) {
    return { valid: false, error: `Nota não pode ser maior que ${maxScore}` };
  }
  return { valid: true };
}

export interface GradeInput {
  score: number;
  weight: number;
}

export function weightedAverage(grades: GradeInput[]): number | null {
  if (!Array.isArray(grades) || grades.length === 0) {
    return null;
  }
  const totalWeight = grades.reduce((acc: number, g: GradeInput) => acc + g.weight, 0);
  const weightedSum = grades.reduce((acc: number, g: GradeInput) => acc + g.score * g.weight, 0);

  if (totalWeight <= 0) {
    const sum = grades.reduce((acc: number, g: GradeInput) => acc + g.score, 0);
    return round2(sum / grades.length);
  }
  return round2(weightedSum / totalWeight);
}

export type ResultStatus = 'APPROVED' | 'RECOVERY' | 'FAILED' | 'IN_PROGRESS' | 'PENDING';

export function resolveResultStatus({
  gradedCount,
  missingCount,
  average,
}: {
  gradedCount: number;
  missingCount: number;
  average: number | null;
}): ResultStatus {
  if (gradedCount === 0 && missingCount === 0) {
    return 'PENDING';
  }
  if (missingCount > 0) {
    return 'IN_PROGRESS';
  }
  if (average === null) {
    return 'PENDING';
  }
  if (average >= PASSING_SCORE) {
    return 'APPROVED';
  }
  if (average >= RECOVERY_SCORE) {
    return 'RECOVERY';
  }
  return 'FAILED';
}

export function computeCompleteResult({
  grades,
  missing = 0,
}: {
  grades: GradeInput[];
  missing?: number;
}): { average: number | null; status: ResultStatus } {
  const average = weightedAverage(grades);
  const status = resolveResultStatus({
    gradedCount: grades.length,
    missingCount: missing,
    average,
  });
  return { average, status };
}

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateTimeRange(startTime: string, endTime: string): { valid: true } | { valid: false; error: string } {
  if (!TIME_PATTERN.test(startTime)) {
    return { valid: false, error: `Hora de início inválida: ${startTime}` };
  }
  if (!TIME_PATTERN.test(endTime)) {
    return { valid: false, error: `Hora de fim inválida: ${endTime}` };
  }
  if (startTime >= endTime) {
    return { valid: false, error: 'Hora de início deve ser anterior à hora de fim' };
  }
  return { valid: true };
}
