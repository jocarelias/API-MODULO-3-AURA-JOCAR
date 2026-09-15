export type AssessmentType = 'TESTE' | 'EXAME_NORMAL' | 'EXAME_RECURRENCIA';

export const ASSESSMENT_TYPES: AssessmentType[] = ['TESTE', 'EXAME_NORMAL', 'EXAME_RECURRENCIA'];

export const ASSESSMENT_DEFAULT_MAX_SCORE = 20;
export const PASSING_SCORE = 10;
export const RECOVERY_SCORE = 8;

export const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

export const CALCULATION_METHODS = [
  'ARITHMETIC_MEAN',
  'WEIGHTED_PERCENTAGE',
  'PERCENTAGE_SUM',
  'NORMALIZED_WEIGHTED_MEAN',
  'COMPONENT_BASED',
  'CUSTOM_WEIGHTED',
] as const;

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
  rounding?: { decimals: 0 | 1 | 2 };
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

export const ASSESSMENT_STATUS = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'] as const;
export const GRADE_STATUS = ['SUBMITTED', 'APPROVED', 'REVISED'] as const;
export const SCHEDULE_STATUS = ['ACTIVE', 'INACTIVE', 'CANCELLED'] as const;
export const RESULT_STATUS = ['APPROVED', 'FAILED', 'RECOVERY', 'PENDING', 'IN_PROGRESS'] as const;

function toNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return value ? new Date(value as string).toISOString() : null;
}

const DB_TYPE_TO_API: Record<string, string> = {
  TEST: 'TESTE',
  EXAM: 'EXAME_NORMAL',
};

function apiAssessmentType(dbType: string): string {
  return DB_TYPE_TO_API[dbType] ?? dbType;
}

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

export function assessmentDto(record: Record<string, unknown>): AssessmentDto {
  return {
    id: record.id as string,
    schoolId: record.schoolId as string,
    academicYearId: record.academicYearId as string,
    termId: record.termId as string,
    classId: record.classId as string,
    subjectId: record.subjectId as string,
    teacherId: record.teacherId as string,
    name: record.name as string,
    type: apiAssessmentType(record.type as string),
    description: record.description as string | null,
    date: toIso(record.date),
    maxScore: toNumber(record.maxScore),
    weight: toNumber(record.weight),
    status: record.status as string,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export function gradeDto(record: Record<string, unknown>): GradeDto {
  return {
    id: record.id as string,
    assessmentId: record.assessmentId as string,
    studentId: record.studentId as string,
    score: toNumber(record.score),
    comment: record.comment as string | null,
    status: record.status as string,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export function scheduleDto(record: Record<string, unknown>): ScheduleDto {
  return {
    id: record.id as string,
    schoolId: record.schoolId as string,
    academicYearId: record.academicYearId as string,
    termId: record.termId as string,
    classId: record.classId as string,
    subjectId: record.subjectId as string,
    teacherId: record.teacherId as string,
    dayOfWeek: record.dayOfWeek as string,
    startTime: record.startTime as string,
    endTime: record.endTime as string,
    room: record.room as string | null,
    status: record.status as string,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export function resultDto(record: Record<string, unknown>): ResultDto {
  return {
    id: record.id as string,
    schoolId: record.schoolId as string,
    academicYearId: record.academicYearId as string,
    termId: record.termId as string,
    classId: record.classId as string,
    subjectId: record.subjectId as string,
    studentId: record.studentId as string,
    average: toNumber(record.average),
    finalScore: toNumber(record.finalScore),
    calculationMethod: record.calculationMethod === null || record.calculationMethod === undefined ? null : String(record.calculationMethod),
    status: record.status as string,
    calculatedAt: toIso(record.calculatedAt),
  };
}

export const campusModules = {
  G3_AVALIACOES_HORARIOS: {
    name: 'Avaliações e Horários',
    basePath: '/api/v1',
    resources: ['assessments', 'schedules', 'results'],
    open: true,
  },
};
