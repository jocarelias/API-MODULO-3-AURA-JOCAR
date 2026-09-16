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

function relName(record: Record<string, unknown>, key: string): string | null {
  const relation = record[key] as { name?: unknown } | null | undefined;
  return relation && typeof relation.name === 'string' ? relation.name : null;
}

export interface AssessmentDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  academicYearName: string | null;
  termId: string;
  termName: string | null;
  classId: string;
  className: string | null;
  subjectId: string;
  subjectName: string | null;
  teacherId: string;
  teacherName: string | null;
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
  assessmentName: string | null;
  studentId: string;
  studentName: string | null;
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
  termName: string | null;
  classId: string;
  className: string | null;
  subjectId: string;
  subjectName: string | null;
  teacherId: string;
  teacherName: string | null;
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
  termName: string | null;
  classId: string;
  className: string | null;
  subjectId: string;
  subjectName: string | null;
  studentId: string;
  studentName: string | null;
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
    academicYearName: relName(record, 'academicYear'),
    termId: record.termId as string,
    termName: relName(record, 'term'),
    classId: record.classId as string,
    className: relName(record, 'class'),
    subjectId: record.subjectId as string,
    subjectName: relName(record, 'subject'),
    teacherId: record.teacherId as string,
    teacherName: relName(record, 'teacher'),
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
    assessmentName: relName(record, 'assessment'),
    studentId: record.studentId as string,
    studentName: relName(record, 'student'),
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
    termName: relName(record, 'term'),
    classId: record.classId as string,
    className: relName(record, 'class'),
    subjectId: record.subjectId as string,
    subjectName: relName(record, 'subject'),
    teacherId: record.teacherId as string,
    teacherName: relName(record, 'teacher'),
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
    termName: relName(record, 'term'),
    classId: record.classId as string,
    className: relName(record, 'class'),
    subjectId: record.subjectId as string,
    subjectName: relName(record, 'subject'),
    studentId: record.studentId as string,
    studentName: relName(record, 'student'),
    average: toNumber(record.average),
    finalScore: toNumber(record.finalScore),
    calculationMethod: record.calculationMethod === null || record.calculationMethod === undefined ? null : String(record.calculationMethod),
    status: record.status as string,
    calculatedAt: toIso(record.calculatedAt),
  };
}

export interface SchoolDto {
  id: string;
  name: string;
  code: string;
  phone: string | null;
}

export interface AcademicYearDto {
  id: string;
  schoolId: string;
  name: string;
}

export interface TermDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

export interface ClassDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  grade: string | null;
  shift: string | null;
  room: string | null;
}

export interface SubjectDto {
  id: string;
  schoolId: string;
  name: string;
  code: string | null;
}

export interface TeacherDto {
  id: string;
  schoolId: string;
  name: string;
  email: string | null;
}

export interface StudentDto {
  id: string;
  schoolId: string;
  name: string;
  email: string | null;
  enrollmentNumber: string | null;
}

export function schoolDto(record: Record<string, unknown>): SchoolDto {
  return {
    id: record.id as string,
    name: record.name as string,
    code: record.code as string,
    phone: record.phone as string | null,
  };
}

export function academicYearDto(record: Record<string, unknown>): AcademicYearDto {
  return {
    id: record.id as string,
    schoolId: record.schoolId as string,
    name: record.name as string,
  };
}

export function termDto(record: Record<string, unknown>): TermDto {
  return {
    id: record.id as string,
    schoolId: record.schoolId as string,
    academicYearId: record.academicYearId as string,
    name: record.name as string,
    startDate: toIso(record.startDate),
    endDate: toIso(record.endDate),
    status: record.status as string,
  };
}

export function classDto(record: Record<string, unknown>): ClassDto {
  return {
    id: record.id as string,
    schoolId: record.schoolId as string,
    academicYearId: record.academicYearId as string,
    name: record.name as string,
    grade: record.grade as string | null,
    shift: record.shift as string | null,
    room: record.room as string | null,
  };
}

export function subjectDto(record: Record<string, unknown>): SubjectDto {
  return {
    id: record.id as string,
    schoolId: record.schoolId as string,
    name: record.name as string,
    code: record.code as string | null,
  };
}

export function teacherDto(record: Record<string, unknown>): TeacherDto {
  return {
    id: record.id as string,
    schoolId: record.schoolId as string,
    name: record.name as string,
    email: record.email as string | null,
  };
}

export function studentDto(record: Record<string, unknown>): StudentDto {
  return {
    id: record.id as string,
    schoolId: record.schoolId as string,
    name: record.name as string,
    email: record.email as string | null,
    enrollmentNumber: record.enrollmentNumber as string | null,
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
