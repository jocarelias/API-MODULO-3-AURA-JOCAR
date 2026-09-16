import { Prisma, PrismaClient, EvaluationType, EvaluationStatus, GradeStatus, ScheduleStatus, DayOfWeek, CalculationMethod } from '@prisma/client';
import { prisma } from '../infrastructure/prisma';
import {
  validateEvaluationType,
  validateWeight,
  validateScore,
  validateTimeRange,
  weightedAverage,
  resolveResultStatus,
  EVALUATION_DEFAULT_MAX_SCORE,
  GradeInput,
} from '../domain/evaluation';
import {
  calculate,
  CalculationError,
  CalculationErrorCode,
  CALCULATION_METHODS,
  CalculationInput,
  CalculationResult,
  CalculationMethodMeta,
} from '../domain/calculationEngine';
import {
  assessmentDto,
  gradeDto,
  scheduleDto,
  resultDto,
  AssessmentDto,
  GradeDto,
  ScheduleDto,
  ResultDto,
  CalculationInputDto,
  CalculationResultDto,
  CalculationMethodMetaDto,
} from '@smartcampus/shared-types';

export const TYPE_MAP: Record<string, string> = {
  TESTE: 'TEST',
  EXAME_NORMAL: 'EXAM',
  EXAME_RECURRENCIA: 'EXAM',
};

export class DomainError extends Error {
  code: string;
  details: unknown[];
  httpStatus: number;

  constructor(code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
    this.httpStatus = ({ NOT_FOUND: 404, CONFLICT: 409, VALIDATION_ERROR: 400, BAD_REQUEST: 400 } as Record<string, number>)[code] ?? 400;
  }
}

const CALCULATION_DOMAIN_CODE: Record<CalculationErrorCode, { code: string; httpStatus: number }> = {
  EMPTY_ITEMS: { code: 'VALIDATION_ERROR', httpStatus: 400 },
  INVALID_SCORE: { code: 'VALIDATION_ERROR', httpStatus: 400 },
  INVALID_WEIGHT: { code: 'VALIDATION_ERROR', httpStatus: 400 },
  WEIGHT_TOTAL_MISMATCH: { code: 'CONFLICT', httpStatus: 409 },
  WEIGHT_SUM_MUST_BE_POSITIVE: { code: 'CONFLICT', httpStatus: 409 },
  INVALID_COMPONENTS: { code: 'VALIDATION_ERROR', httpStatus: 400 },
  COMPONENT_WEIGHT_MISMATCH: { code: 'CONFLICT', httpStatus: 409 },
  FORMULA_NOT_REGISTERED: { code: 'VALIDATION_ERROR', httpStatus: 400 },
};

function withValidAssessmentType(type: string): string {
  const check = validateEvaluationType(type);
  if (!check.valid) {
    throw new DomainError('VALIDATION_ERROR', check.error);
  }
  return TYPE_MAP[type];
}

function assertRelation<T>(value: T | null | undefined, message: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new DomainError('NOT_FOUND', message);
  }
}

function toConflictDetails(conflicts: { type: string; description: string }[]): { type: string; message: string }[] {
  return conflicts.map((c) => ({ type: c.type, message: c.description }));
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

export class SchedulesAssessmentsService {
  private prisma: PrismaClient;

  constructor({ db = prisma }: { db?: PrismaClient } = {}) {
    this.prisma = db;
  }

  async listAssessments({ termId, classId, subjectId, teacherId }: { termId?: string; classId?: string; subjectId?: string; teacherId?: string } = {}): Promise<AssessmentDto[]> {
    const where: Prisma.AssessmentWhereInput = {};
    if (termId) where.termId = termId;
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    if (teacherId) where.teacherId = teacherId;
    const rows = await this.prisma.assessment.findMany({
      where,
      orderBy: { date: 'asc' },
    });
    return rows.map((row) => assessmentDto(row as unknown as Record<string, unknown>));
  }

  async getAssessment(id: string): Promise<AssessmentDto> {
    const record = await this.prisma.assessment.findUnique({ where: { id } });
    if (!record) {
      throw new DomainError('NOT_FOUND', 'Avaliação não encontrada');
    }
    return assessmentDto(record as unknown as Record<string, unknown>);
  }

  async createAssessment(input: AssessmentInput): Promise<AssessmentDto> {
    const type = withValidAssessmentType(input.type);
    const weightCheck = validateWeight(input.weight);
    if (!weightCheck.valid) {
      throw new DomainError('VALIDATION_ERROR', weightCheck.error);
    }
    if ((input.maxScore ?? EVALUATION_DEFAULT_MAX_SCORE) <= 0) {
      throw new DomainError('VALIDATION_ERROR', 'Nota máxima deve ser maior que 0');
    }

    const [term, classRecord, subject, teacher, academicYear] = await Promise.all([
      this.prisma.term.findUnique({ where: { id: input.termId } }),
      this.prisma.class.findUnique({ where: { id: input.classId } }),
      this.prisma.subject.findUnique({ where: { id: input.subjectId } }),
      this.prisma.teacher.findUnique({ where: { id: input.teacherId } }),
      this.prisma.academicYear.findUnique({ where: { id: input.academicYearId } }),
    ]);

    assertRelation(term, 'Período (termo) não encontrado');
    assertRelation(classRecord, 'Turma não encontrada');
    assertRelation(subject, 'Disciplina não encontrada');
    assertRelation(teacher, 'Professor não encontrado');
    assertRelation(academicYear, 'Ano letivo não encontrado');

    if (
      term.academicYearId !== classRecord.academicYearId ||
      term.academicYearId !== input.academicYearId ||
      classRecord.academicYearId !== input.academicYearId
    ) {
      throw new DomainError('CONFLICT', 'Período, turma e ano letivo não pertencem ao mesmo ano letivo');
    }

    const duplicate = await this.prisma.assessment.findFirst({
      where: { termId: term.id, classId: classRecord.id, subjectId: subject.id, name: input.name },
      select: { id: true },
    });
    if (duplicate) {
      throw new DomainError('CONFLICT', 'Já existe uma avaliação com este nome para esta turma, disciplina e período');
    }

    const assigned = await this.prisma.$transaction([
      this.prisma.schedule.findMany({
        where: { schoolId: term.schoolId, teacherId: teacher.id, classId: classRecord.id, status: { not: 'CANCELLED' as const } },
        select: { subjectId: true },
        distinct: ['subjectId'],
      }),
      this.prisma.assessment.findMany({
        where: { schoolId: term.schoolId, teacherId: teacher.id, classId: classRecord.id },
        select: { subjectId: true },
        distinct: ['subjectId'],
      }),
    ]);
    const assignedIds = Array.from(
      new Set([...assigned[0].map((s) => s.subjectId), ...assigned[1].map((s) => s.subjectId)]),
    );
    if (assignedIds.length > 0 && !assignedIds.includes(subject.id)) {
      throw new DomainError('CONFLICT', 'Professor não leciona esta disciplina nesta turma');
    }

    const record = await this.prisma.assessment.create({
      data: {
        schoolId: term.schoolId,
        academicYearId: input.academicYearId,
        termId: term.id,
        classId: classRecord.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        name: input.name,
        type: type as EvaluationType,
        description: input.description ?? null,
        date: new Date(input.date),
        maxScore: input.maxScore ?? EVALUATION_DEFAULT_MAX_SCORE,
        weight: input.weight,
        status: (input.status ?? 'DRAFT') as EvaluationStatus,
      },
    });

    return assessmentDto(record as unknown as Record<string, unknown>);
  }

  async updateAssessment(id: string, patch: Record<string, unknown>): Promise<AssessmentDto> {
    const existing = await this.prisma.assessment.findUnique({ where: { id } });
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Avaliação não encontrada');
    }

    if (patch.weight !== undefined || patch.maxScore !== undefined) {
      const gradeCount = await this.prisma.grade.count({ where: { assessmentId: id } });
      if (gradeCount > 0) {
        throw new DomainError('CONFLICT', 'Peso e nota máxima não podem ser alterados após o lançamento de notas');
      }
    }

    const data: Prisma.AssessmentUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name as string;
    if (patch.description !== undefined) data.description = patch.description as string | null;
    if (patch.date !== undefined) data.date = new Date(patch.date as string);
    if (patch.status !== undefined) data.status = patch.status as EvaluationStatus;
    if (patch.weight !== undefined) {
      const weightCheck = validateWeight(patch.weight as number);
      if (!weightCheck.valid) throw new DomainError('VALIDATION_ERROR', weightCheck.error);
      data.weight = patch.weight as number;
    }
    if (patch.maxScore !== undefined) {
      if ((patch.maxScore as number) <= 0) throw new DomainError('VALIDATION_ERROR', 'Nota máxima deve ser maior que 0');
      data.maxScore = patch.maxScore as number;
    }
    if (patch.type !== undefined) data.type = withValidAssessmentType(patch.type as string) as EvaluationType;

    const updated = await this.prisma.assessment.update({ where: { id }, data });
    return assessmentDto(updated as unknown as Record<string, unknown>);
  }

  async deleteAssessment(id: string): Promise<{ id: string; deleted: boolean }> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: { _count: { select: { grades: true } } },
    });
    if (!assessment) {
      throw new DomainError('NOT_FOUND', 'Avaliação não encontrada');
    }
    if (assessment._count.grades > 0) {
      throw new DomainError(
        'CONFLICT',
        'Avaliação não pode ser eliminada porque já possui notas lançadas',
      );
    }
    await this.prisma.assessment.delete({ where: { id } });
    return { id, deleted: true };
  }

  async listGrades(assessmentId: string): Promise<GradeDto[]> {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) {
      throw new DomainError('NOT_FOUND', 'Avaliação não encontrada');
    }
    const rows = await this.prisma.grade.findMany({
      where: { assessmentId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => gradeDto(row as unknown as Record<string, unknown>));
  }

  async _recalculateInTx(
    tx: Prisma.TransactionClient,
    assessment: { classId: string; subjectId: string; termId: string; schoolId?: string; academicYearId?: string },
    studentIds?: string[],
  ): Promise<void> {
    const { classId, subjectId, termId } = assessment;
    const evaluations = await tx.assessment.findMany({
      where: { classId, subjectId, termId },
      include: { grades: true },
      orderBy: { date: 'asc' },
    });

    if (evaluations.length === 0) {
      return;
    }

    let students: string[] = studentIds ?? [];
    if (!students || students.length === 0) {
      const enrollments = await tx.enrollment.findMany({
        where: { classId, subjectId, termId, status: 'ACTIVE' },
        select: { studentId: true },
      });
      students = enrollments.map((e) => e.studentId);
    }

    const reference = evaluations[0];

    for (const studentId of students) {
      const graded: GradeInput[] = [];
      let missing = 0;
      for (const evaluation of evaluations) {
        const grade = evaluation.grades.find((g) => g.studentId === studentId);
        if (grade) {
          graded.push({ score: Number(grade.score), weight: Number(evaluation.weight) });
        } else {
          missing += 1;
        }
      }
      const average = weightedAverage(graded);
      const status = resolveResultStatus({ gradedCount: graded.length, missingCount: missing, average });

      await tx.result.upsert({
        where: { studentId_classId_subjectId_termId: { studentId, classId, subjectId, termId } },
        update: { average, finalScore: average, calculationMethod: 'WEIGHTED_PERCENTAGE' as CalculationMethod, status, calculatedAt: new Date() },
        create: {
          schoolId: assessment.schoolId ?? reference.schoolId,
          academicYearId: assessment.academicYearId ?? reference.academicYearId,
          termId,
          classId,
          subjectId,
          studentId,
          average,
          finalScore: average,
          calculationMethod: 'WEIGHTED_PERCENTAGE' as CalculationMethod,
          status,
          calculatedAt: new Date(),
        },
      });
    }
  }

  async createGrade(assessmentId: string, input: GradeInputDto): Promise<GradeDto> {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) {
      throw new DomainError('NOT_FOUND', 'Avaliação não encontrada');
    }
    if (assessment.status !== 'OPEN') {
      throw new DomainError('CONFLICT', 'Nota só pode ser lançada em avaliação aberta');
    }

    const scoreCheck = validateScore(input.score, Number(assessment.maxScore));
    if (!scoreCheck.valid) {
      throw new DomainError('VALIDATION_ERROR', scoreCheck.error);
    }

    const [student, enrolledClass, enrolledSubject] = await Promise.all([
      this.prisma.student.findUnique({ where: { id: input.studentId } }),
      this.prisma.enrollment.findFirst({
        where: {
          schoolId: assessment.schoolId,
          studentId: input.studentId,
          classId: assessment.classId,
          termId: assessment.termId,
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
      this.prisma.enrollment.findFirst({
        where: {
          schoolId: assessment.schoolId,
          studentId: input.studentId,
          subjectId: assessment.subjectId,
          termId: assessment.termId,
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
    ]);

    assertRelation(student, 'Aluno não encontrado');
    if (!enrolledClass || !enrolledSubject) {
      throw new DomainError('VALIDATION_ERROR', 'Aluno não está matriculado na turma e disciplina desta avaliação');
    }

    const existing = await this.prisma.grade.findUnique({
      where: { assessmentId_studentId: { assessmentId, studentId: input.studentId } },
    });
    if (existing) {
      throw new DomainError('CONFLICT', 'Já existe nota para este aluno nesta avaliação');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.grade.create({
        data: {
          assessmentId,
          studentId: input.studentId,
          score: input.score,
          comment: input.comment ?? null,
          status: 'SUBMITTED',
        },
      });
      await this._recalculateInTx(
        tx,
        { classId: assessment.classId, subjectId: assessment.subjectId, termId: assessment.termId, schoolId: assessment.schoolId, academicYearId: assessment.academicYearId },
        [input.studentId],
      );
      return row;
    });

    return gradeDto(created as unknown as Record<string, unknown>);
  }

  async updateGrade(assessmentId: string, gradeId: string, patch: Record<string, unknown>): Promise<GradeDto> {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) {
      throw new DomainError('NOT_FOUND', 'Avaliação não encontrada');
    }
    const existing = await this.prisma.grade.findUnique({ where: { id: gradeId } });
    if (!existing || existing.assessmentId !== assessmentId) {
      throw new DomainError('NOT_FOUND', 'Nota não encontrada');
    }
    if (assessment.status !== 'OPEN') {
      throw new DomainError('CONFLICT', 'Nota só pode ser alterada em avaliação aberta');
    }

    const data: Prisma.GradeUpdateInput = {};
    if (patch.score !== undefined) {
      const scoreCheck = validateScore(patch.score as number, Number(assessment.maxScore));
      if (!scoreCheck.valid) throw new DomainError('VALIDATION_ERROR', scoreCheck.error);
      data.score = patch.score as number;
    }
    if (patch.comment !== undefined) data.comment = patch.comment as string | null;
    if (patch.status !== undefined) data.status = patch.status as GradeStatus;

    if (Object.keys(data).length === 0) {
      return gradeDto(existing as unknown as Record<string, unknown>);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.grade.update({ where: { id: gradeId }, data });
      await this._recalculateInTx(
        tx,
        { classId: assessment.classId, subjectId: assessment.subjectId, termId: assessment.termId, schoolId: assessment.schoolId, academicYearId: assessment.academicYearId },
        [existing.studentId],
      );
      return row;
    });

    return gradeDto(updated as unknown as Record<string, unknown>);
  }

  async listSchedules({ termId, classId, teacherId, studentId }: { termId?: string; classId?: string; teacherId?: string; studentId?: string } = {}): Promise<ScheduleDto[]> {
    const where: Prisma.ScheduleWhereInput = {};
    if (termId) where.termId = termId;
    if (classId) where.classId = classId;
    if (teacherId) where.teacherId = teacherId;
    if (studentId) {
      const classes = await this.prisma.enrollment.findMany({
        where: { studentId, status: 'ACTIVE' },
        select: { classId: true },
        distinct: ['classId'],
      });
      where.classId = { in: classes.map((c) => c.classId) };
    }
    const rows = await this.prisma.schedule.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return rows.map((row) => scheduleDto(row as unknown as Record<string, unknown>));
  }

  async createSchedule(input: ScheduleInput): Promise<ScheduleDto> {
    const timeCheck = validateTimeRange(input.startTime, input.endTime);
    if (!timeCheck.valid) {
      throw new DomainError('VALIDATION_ERROR', timeCheck.error);
    }

    const [term, classRecord, subject, teacher, academicYear] = await Promise.all([
      this.prisma.term.findUnique({ where: { id: input.termId } }),
      this.prisma.class.findUnique({ where: { id: input.classId } }),
      this.prisma.subject.findUnique({ where: { id: input.subjectId } }),
      this.prisma.teacher.findUnique({ where: { id: input.teacherId } }),
      this.prisma.academicYear.findUnique({ where: { id: input.academicYearId } }),
    ]);

    assertRelation(term, 'Período (termo) não encontrado');
    assertRelation(classRecord, 'Turma não encontrada');
    assertRelation(subject, 'Disciplina não encontrada');
    assertRelation(teacher, 'Professor não encontrado');
    assertRelation(academicYear, 'Ano letivo não encontrado');
    if (term.academicYearId !== input.academicYearId || classRecord.academicYearId !== input.academicYearId) {
      throw new DomainError('CONFLICT', 'Período, turma e ano letivo não pertencem ao mesmo ano letivo');
    }

    const sameDay = await this.prisma.schedule.findMany({
      where: {
        schoolId: term.schoolId,
        termId: term.id,
        dayOfWeek: input.dayOfWeek as DayOfWeek,
        status: { not: 'CANCELLED' as const },
      },
    });

    const conflicts = this.findConflicts(input, sameDay as unknown as ScheduleConflictRecord[]);
    if (conflicts.length > 0) {
      throw new DomainError('CONFLICT', 'Conflito de horário detectado', toConflictDetails(conflicts));
    }

    const created = await this.prisma.schedule.create({
      data: {
        schoolId: term.schoolId,
        academicYearId: input.academicYearId,
        termId: term.id,
        classId: classRecord.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        dayOfWeek: input.dayOfWeek as DayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room ?? null,
        status: (input.status ?? 'ACTIVE') as ScheduleStatus,
      },
    });

    return scheduleDto(created as unknown as Record<string, unknown>);
  }

  findConflicts(
    input: ConflictCandidate,
    existing: ScheduleConflictRecord[],
  ): { type: string; description: string }[] {
    const active = existing.filter((s) => !s.status || s.status === 'ACTIVE');
    const conflicts: { type: string; description: string }[] = [];
    for (const s of active) {
      const overlaps = input.startTime < s.endTime && s.startTime < input.endTime;
      if (!overlaps) continue;
      if (input.teacherId === s.teacherId) {
        conflicts.push({ type: 'TEACHER', description: `Professor já possui aula das ${s.startTime} às ${s.endTime}` });
      }
      if (input.classId === s.classId) {
        conflicts.push({ type: 'CLASS', description: `Turma já possui aula das ${s.startTime} às ${s.endTime}` });
      }
      if (input.room && input.room === s.room) {
        conflicts.push({ type: 'ROOM', description: `Sala ${s.room} já está ocupada das ${s.startTime} às ${s.endTime}` });
      }
    }
    return conflicts;
  }

  async updateSchedule(id: string, patch: Record<string, unknown>): Promise<ScheduleDto> {
    const existing = await this.prisma.schedule.findUnique({ where: { id } });
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Horário não encontrado');
    }

    const data: Prisma.ScheduleUpdateInput = {};
    if (patch.dayOfWeek !== undefined) data.dayOfWeek = patch.dayOfWeek as DayOfWeek;
    if (patch.startTime !== undefined) data.startTime = patch.startTime as string;
    if (patch.endTime !== undefined) data.endTime = patch.endTime as string;
    if (patch.room !== undefined) data.room = patch.room as string | null;
    if (patch.status !== undefined) data.status = patch.status as ScheduleStatus;

    if (patch.startTime || patch.endTime) {
      const timeCheck = validateTimeRange(
        (patch.startTime as string) ?? existing.startTime,
        (patch.endTime as string) ?? existing.endTime,
      );
      if (!timeCheck.valid) throw new DomainError('VALIDATION_ERROR', timeCheck.error);
    }

    if (Object.keys(data).length > 0) {
      const candidate: ConflictCandidate = {
        teacherId: existing.teacherId,
        classId: existing.classId,
        dayOfWeek: (patch.dayOfWeek as string) ?? existing.dayOfWeek,
        startTime: (patch.startTime as string) ?? existing.startTime,
        endTime: (patch.endTime as string) ?? existing.endTime,
        room: patch.room !== undefined ? (patch.room as string | null) : existing.room,
      };
      const sameDay = await this.prisma.schedule.findMany({
        where: {
          schoolId: existing.schoolId,
          termId: existing.termId,
          dayOfWeek: candidate.dayOfWeek as DayOfWeek,
          status: { not: 'CANCELLED' as const },
          NOT: { id },
        },
      });
      const conflicts = this.findConflicts(candidate, sameDay as unknown as ScheduleConflictRecord[]);
      if (conflicts.length > 0) {
        throw new DomainError('CONFLICT', 'Conflito de horário detectado', toConflictDetails(conflicts));
      }
      const updated = await this.prisma.schedule.update({ where: { id }, data });
      return scheduleDto(updated as unknown as Record<string, unknown>);
    }

    return scheduleDto(existing as unknown as Record<string, unknown>);
  }

  async deleteSchedule(id: string): Promise<{ id: string; deleted: boolean }> {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) {
      throw new DomainError('NOT_FOUND', 'Horário não encontrado');
    }
    await this.prisma.schedule.delete({ where: { id } });
    return { id, deleted: true };
  }

  async getSchedule(id: string): Promise<ScheduleDto> {
    const record = await this.prisma.schedule.findUnique({ where: { id } });
    if (!record) {
      throw new DomainError('NOT_FOUND', 'Horário não encontrado');
    }
    return scheduleDto(record as unknown as Record<string, unknown>);
  }

  async listResults({ termId, classId, subjectId, studentId }: { termId?: string; classId?: string; subjectId?: string; studentId?: string } = {}): Promise<ResultDto[]> {
    const where: Prisma.ResultWhereInput = {};
    if (termId) where.termId = termId;
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    if (studentId) where.studentId = studentId;
    const rows = await this.prisma.result.findMany({ where, orderBy: { updatedAt: 'asc' } });
    return rows.map((row) => resultDto(row as unknown as Record<string, unknown>));
  }

  async getResult(id: string): Promise<ResultDto> {
    const record = await this.prisma.result.findUnique({ where: { id } });
    if (!record) {
      throw new DomainError('NOT_FOUND', 'Resultado não encontrado');
    }
    return resultDto(record as unknown as Record<string, unknown>);
  }

  async createResults(input: ResultInput): Promise<ResultDto[]> {
    const assessmentCount = await this.prisma.assessment.count({
      where: { classId: input.classId, subjectId: input.subjectId, termId: input.termId },
    });
    if (assessmentCount === 0) {
      throw new DomainError('VALIDATION_ERROR', 'Não existem avaliações para calcular resultados nesta combinação');
    }

    return this.prisma.$transaction(async (tx) => {
      await this._recalculateInTx(tx, input, input.studentIds);
      const rows = await tx.result.findMany({
        where: {
          classId: input.classId,
          subjectId: input.subjectId,
          termId: input.termId,
          ...(input.studentIds ? { studentId: { in: input.studentIds } } : {}),
        },
        orderBy: { studentId: 'asc' },
      });
      return rows.map((row) => resultDto(row as unknown as Record<string, unknown>));
    });
  }

  async deleteResult(id: string): Promise<{ id: string; deleted: boolean }> {
    const result = await this.prisma.result.findUnique({ where: { id } });
    if (!result) {
      throw new DomainError('NOT_FOUND', 'Resultado não encontrado');
    }
    await this.prisma.result.delete({ where: { id } });
    return { id, deleted: true };
  }

  async patchResult(id: string): Promise<ResultDto> {
    const result = await this.prisma.result.findUnique({ where: { id } });
    if (!result) {
      throw new DomainError('NOT_FOUND', 'Resultado não encontrado');
    }

    return this.prisma.$transaction(async (tx) => {
      await this._recalculateInTx(
        tx,
        { classId: result.classId, subjectId: result.subjectId, termId: result.termId, schoolId: result.schoolId, academicYearId: result.academicYearId },
        [result.studentId],
      );
      const updated = await tx.result.findUnique({ where: { id } });
      if (!updated) {
        throw new DomainError('NOT_FOUND', 'Resultado não encontrado');
      }
      return resultDto(updated as unknown as Record<string, unknown>);
    });
  }

  async calculateResult(input: CalculationInputDto): Promise<CalculationResultDto> {
    const aggregatedIds = new Set<string>();
    input.items.forEach((item) => {
      if (item.assessmentId) aggregatedIds.add(item.assessmentId);
    });
    const collectComponentIds = (components: { assessmentId?: string }[]): void => {
      components.forEach((component) => {
        if (component.assessmentId) aggregatedIds.add(component.assessmentId);
        if ('children' in component && Array.isArray(component.children)) {
          collectComponentIds(component.children as { assessmentId?: string }[]);
        }
      });
    };
    if (input.components) {
      collectComponentIds(input.components);
    }

    const uniqueIds = Array.from(aggregatedIds);
    if (uniqueIds.length > 0) {
      const found = await this.prisma.assessment.findMany({ where: { id: { in: uniqueIds } }, select: { id: true } });
      const foundIds = new Set(found.map((row) => row.id));
      const missing = uniqueIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new DomainError(
          'NOT_FOUND',
          'Avaliação(ões) não encontrada(s)',
          missing.map((id) => ({ assessmentId: id })),
        );
      }
    }

    try {
      return calculate(input as unknown as CalculationInput);
    } catch (error) {
      if (error instanceof CalculationError) {
        const mapping = CALCULATION_DOMAIN_CODE[error.code];
        const domain = new DomainError(mapping.code, error.message);
        domain.httpStatus = mapping.httpStatus;
        throw domain;
      }
      throw error;
    }
  }

  listCalculationMethods(): CalculationMethodMetaDto[] {
    return CALCULATION_METHODS;
  }

  async getPrintClassSchedule(classId: string, termId?: string): Promise<Record<string, unknown>> {
    const classRecord = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!classRecord) {
      throw new DomainError('NOT_FOUND', 'Turma não encontrada');
    }
    const where: Prisma.ScheduleWhereInput = { classId };
    if (termId) where.termId = termId;
    const schedules = await this.prisma.schedule.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      include: { subject: true, teacher: true },
    });
    return {
      className: classRecord.name,
      termId: termId ?? null,
      schedules: schedules.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        subject: s.subject.name,
        teacher: s.teacher.name,
        status: s.status,
      })),
    };
  }

  async getPrintClassPauta(classId: string, termId?: string, subjectId?: string): Promise<Record<string, unknown>> {
    const classRecord = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!classRecord) {
      throw new DomainError('NOT_FOUND', 'Turma não encontrada');
    }
    if (!subjectId) {
      throw new DomainError('BAD_REQUEST', 'Disciplina (subjectId) é obrigatória para gerar a pauta');
    }

    const [subject, students] = await Promise.all([
      this.prisma.subject.findUnique({ where: { id: subjectId } }),
      this.prisma.enrollment.findMany({
        where: { classId, subjectId, ...(termId ? { termId } : {}), status: 'ACTIVE' },
        include: { student: true },
        orderBy: { student: { name: 'asc' } },
      }),
    ]);
    assertRelation(subject, 'Disciplina não encontrada');

    const rows: Record<string, unknown>[] = [];
    for (const enrollment of students) {
      const assessments = await this.prisma.assessment.findMany({
        where: { classId, subjectId, schoolId: classRecord.schoolId, ...(termId ? { termId } : {}) },
        include: {
          grades: {
            where: { studentId: enrollment.studentId },
          },
        },
        orderBy: { date: 'asc' },
      });

      const graded: GradeInput[] = [];
      let missing = 0;
      const breakdown: Record<string, unknown>[] = [];
      for (const assessment of assessments) {
        const grade = assessment.grades[0];
        if (grade) {
          graded.push({ score: Number(grade.score), weight: Number(assessment.weight) });
          breakdown.push({
            assessmentId: assessment.id,
            name: assessment.name,
            score: Number(grade.score),
            weight: Number(assessment.weight),
          });
        } else {
          missing += 1;
          breakdown.push({
            assessmentId: assessment.id,
            name: assessment.name,
            score: null,
            weight: Number(assessment.weight),
          });
        }
      }

      const average = weightedAverage(graded);
      const status = resolveResultStatus({ gradedCount: graded.length, missingCount: missing, average });
      rows.push({
        studentId: enrollment.studentId,
        studentName: enrollment.student.name,
        average,
        status,
        evaluations: breakdown,
      });
    }

    return {
      className: classRecord.name,
      subject: subject.name,
      termId: termId ?? null,
      rows,
    };
  }
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