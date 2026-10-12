import {
  DomainError,
  POSSESSION_MESSAGE,
  type SchedulesAssessmentsService,
} from '../../application/schedulesAssessmentsService';
import type { ContractCallContext } from '../contracts/gateway';
import { POSSESSION, STUDENT_ROLE, TEACHER_ROLE, type PossessionKind, type RouteAccessRule } from './routeAccess';

export { POSSESSION };
export type { PossessionKind };

export interface PossessionRequest {
  method: string;
  path: string;
  params: Record<string, string | undefined>;
  query: Record<string, unknown>;
  ctx: ContractCallContext;
}

export interface PossessionOutcome {
  studentId?: string;
  classIds?: string[];
  classId?: string;
  teacherId?: string;
}

export type PossessionGuard = (
  service: SchedulesAssessmentsService,
  request: PossessionRequest,
) => Promise<PossessionOutcome>;

const NO_OUTCOME: PossessionOutcome = {};

function requestedId(request: PossessionRequest, key: string): string | undefined {
  const value = request.query[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

async function resolveResourceClassId(
  service: SchedulesAssessmentsService,
  request: PossessionRequest,
): Promise<string | undefined> {
  const id = request.params.id ?? request.params.assessmentId;
  if (!id) {
    return undefined;
  }
  try {
    const assessment = await service.getAssessment(id);
    return assessment.classId;
  } catch (error) {
    if (!(error instanceof DomainError) || error.code !== 'NOT_FOUND') {
      throw error;
    }
  }
  const schedule = await service.getSchedule(id);
  return schedule.classId;
}

const guards: Record<PossessionKind, PossessionGuard> = {
  [POSSESSION.NONE]: async () => NO_OUTCOME,

  [POSSESSION.STUDENT_OWN_RESULTS]: async (service, request) => {
    const studentId = await service.assertStudentCanViewNotes(requestedId(request, 'studentId'), request.ctx);
    return { studentId };
  },

  [POSSESSION.STUDENT_OWN_GRADES]: async (service, request) => {
    const studentId = await service.assertStudentCanViewNotes(undefined, request.ctx);
    return { studentId };
  },

  [POSSESSION.STUDENT_OWN_FINANCIAL]: async (service, request) => {
    const studentId = await service.resolveStudentScope(requestedId(request, 'studentId'), request.ctx);
    return { studentId };
  },

  [POSSESSION.STUDENT_CLASS_SCOPE]: async (service, request) => {
    const studentId = await service.resolveStudentScope(requestedId(request, 'studentId'), request.ctx);
    const classId =
      (typeof request.params.classId === 'string' ? request.params.classId : undefined) ??
      requestedId(request, 'classId') ??
      (await resolveResourceClassId(service, request));
    if (classId) {
      await service.assertStudentInClass(studentId, classId);
      return { studentId, classId };
    }
    return { studentId, classIds: await service.listStudentClassIds(studentId) };
  },

  [POSSESSION.TEACHER_OWN_ASSESSMENT]: async (service, request) => {
    const id = request.params.id;
    if (!id) {
      return NO_OUTCOME;
    }
    const assessment = await service.getAssessment(id);
    await service.assertTeacherOwns(assessment.teacherId, request.ctx);
    return { classId: assessment.classId };
  },

  [POSSESSION.TEACHER_OWN_SCHEDULE]: async (service, request) => {
    const id = request.params.id;
    if (!id) {
      return NO_OUTCOME;
    }
    const schedule = await service.getSchedule(id);
    await service.assertTeacherOwns(schedule.teacherId, request.ctx);
    return { classId: schedule.classId };
  },

  // Notas de uma avaliação: o estudante tem de pertencer à turma da avaliação
  // E não pode ter dívida. As duas verificações são explícitas e cumulativas.
  [POSSESSION.STUDENT_GRADES_IN_CLASS]: async (service, request) => {
    const studentId = await service.assertStudentCanViewNotes(undefined, request.ctx);
    const assessment = await service.getAssessment(request.params.assessmentId as string);
    await service.assertStudentInClass(studentId, assessment.classId);
    return { studentId, classId: assessment.classId };
  },

  // Pauta de uma turma: mesma dupla verificação (posse da turma + dívida).
  [POSSESSION.STUDENT_PAUTA_IN_CLASS]: async (service, request) => {
    const studentId = await service.assertStudentCanViewNotes(undefined, request.ctx);
    const classId = request.params.classId as string;
    await service.assertStudentInClass(studentId, classId);
    return { studentId, classId };
  },

  [POSSESSION.TEACHER_OWN_RESULT]: async (service, request) => {
    const id = request.params.id;
    if (!id) {
      return NO_OUTCOME;
    }
    const result = await service.getResult(id);
    await service.assertTeacherOwnsTeaching({ classId: result.classId, subjectId: result.subjectId }, request.ctx);
    return { classId: result.classId };
  },

  /* ---- Leitura mista: STUDENT limitado a si próprio, TEACHER limitado à
     cadeira/turma que leciona, COORDINATOR/ADMIN sem restrição. ---- */

  [POSSESSION.STUDENT_OR_TEACHER_ASSESSMENT_LIST]: async (service, request) => {
    const role = request.ctx.role;
    if (isTeacherRole(role)) {
      return { teacherId: await service.currentTeacherId(request.ctx) };
    }
    if (!isStudentRole(role)) {
      return NO_OUTCOME;
    }
    const studentId = await service.resolveStudentScope(requestedId(request, 'studentId'), request.ctx);
    const classId = requestedId(request, 'classId');
    if (classId) {
      await service.assertStudentInClass(studentId, classId);
      return { studentId, classId };
    }
    return { studentId, classIds: await service.listStudentClassIds(studentId) };
  },

  [POSSESSION.STUDENT_OR_TEACHER_ASSESSMENT]: async (service, request) => {
    const id = request.params.id;
    if (!id) {
      return NO_OUTCOME;
    }
    const assessment = await service.getAssessment(id);
    const role = request.ctx.role;
    if (isTeacherRole(role)) {
      await service.assertTeacherOwns(assessment.teacherId, request.ctx);
      return { classId: assessment.classId };
    }
    if (!isStudentRole(role)) {
      return NO_OUTCOME;
    }
    const studentId = await service.resolveStudentScope(undefined, request.ctx);
    await service.assertStudentInClass(studentId, assessment.classId);
    return { studentId, classId: assessment.classId };
  },

  [POSSESSION.STUDENT_OR_TEACHER_GRADES]: async (service, request) => {
    const assessment = await service.getAssessment(request.params.assessmentId as string);
    const role = request.ctx.role;
    if (isTeacherRole(role)) {
      await service.assertTeacherOwnsTeaching({ classId: assessment.classId, subjectId: assessment.subjectId }, request.ctx);
      return { classId: assessment.classId };
    }
    if (!isStudentRole(role)) {
      return NO_OUTCOME;
    }
    const studentId = await service.assertStudentCanViewNotes(undefined, request.ctx);
    await service.assertStudentInClass(studentId, assessment.classId);
    return { studentId, classId: assessment.classId };
  },

  [POSSESSION.STUDENT_OR_TEACHER_RESULTS]: async (service, request) => {
    const role = request.ctx.role;
    if (isTeacherRole(role)) {
      return { teacherId: await service.currentTeacherId(request.ctx) };
    }
    if (!isStudentRole(role)) {
      return NO_OUTCOME;
    }
    const studentId = await service.assertStudentCanViewNotes(requestedId(request, 'studentId'), request.ctx);
    return { studentId };
  },

  [POSSESSION.STUDENT_OR_TEACHER_RESULT]: async (service, request) => {
    const id = request.params.id;
    if (!id) {
      return NO_OUTCOME;
    }
    const role = request.ctx.role;
    if (isTeacherRole(role)) {
      const result = await service.getResult(id);
      await service.assertTeacherOwnsTeaching({ classId: result.classId, subjectId: result.subjectId }, request.ctx);
      return { classId: result.classId };
    }
    if (!isStudentRole(role)) {
      return NO_OUTCOME;
    }
    const studentId = await service.assertStudentCanViewNotes(undefined, request.ctx);
    return { studentId };
  },

  [POSSESSION.STUDENT_OR_TEACHER_SCHEDULE_LIST]: async (service, request) => {
    const role = request.ctx.role;
    if (isTeacherRole(role)) {
      return { teacherId: await service.currentTeacherId(request.ctx) };
    }
    if (!isStudentRole(role)) {
      return NO_OUTCOME;
    }
    const studentId = await service.resolveStudentScope(undefined, request.ctx);
    return { studentId, classIds: await service.listStudentClassIds(studentId) };
  },

  [POSSESSION.STUDENT_OR_TEACHER_SCHEDULE]: async (service, request) => {
    const id = request.params.id;
    if (!id) {
      return NO_OUTCOME;
    }
    const schedule = await service.getSchedule(id);
    const role = request.ctx.role;
    if (isTeacherRole(role)) {
      await service.assertTeacherOwns(schedule.teacherId, request.ctx);
      return { classId: schedule.classId };
    }
    if (!isStudentRole(role)) {
      return NO_OUTCOME;
    }
    const studentId = await service.resolveStudentScope(undefined, request.ctx);
    await service.assertStudentInClass(studentId, schedule.classId);
    return { studentId, classId: schedule.classId };
  },

  [POSSESSION.STUDENT_OR_TEACHER_PAUTA]: async (service, request) => {
    const classId = request.params.classId as string;
    const role = request.ctx.role;
    if (isTeacherRole(role)) {
      const subjectId = requestedId(request, 'subjectId');
      if (!subjectId) {
        return NO_OUTCOME;
      }
      await service.assertTeacherOwnsTeaching({ classId, subjectId }, request.ctx);
      return { classId };
    }
    if (!isStudentRole(role)) {
      return NO_OUTCOME;
    }
    const studentId = await service.assertStudentCanViewNotes(undefined, request.ctx);
    await service.assertStudentInClass(studentId, classId);
    return { studentId, classId };
  },
};

export function isStudentRole(role: string | undefined): boolean {
  return role === STUDENT_ROLE;
}

export function isTeacherRole(role: string | undefined): boolean {
  return role === TEACHER_ROLE;
}

export function assertPossessionGuardExists(rule: RouteAccessRule): void {
  if (!(rule.possession in guards)) {
    throw new Error(`Regra de posse sem guard implementado: ${rule.method} ${rule.path} → ${rule.possession}`);
  }
}

const STUDENT_SCOPED: ReadonlySet<PossessionKind> = new Set<PossessionKind>([
  POSSESSION.STUDENT_OWN_RESULTS,
  POSSESSION.STUDENT_OWN_GRADES,
  POSSESSION.STUDENT_CLASS_SCOPE,
  POSSESSION.STUDENT_OWN_FINANCIAL,
  POSSESSION.STUDENT_GRADES_IN_CLASS,
  POSSESSION.STUDENT_PAUTA_IN_CLASS,
]);

const TEACHER_SCOPED: ReadonlySet<PossessionKind> = new Set<PossessionKind>([
  POSSESSION.TEACHER_OWN_ASSESSMENT,
  POSSESSION.TEACHER_OWN_SCHEDULE,
  POSSESSION.TEACHER_OWN_RESULT,
]);

/**
 * Posses de leitura combinadas (estudante OU docente). O guard decide pelo
 * role: o estudante é limitado a si próprio; o docente é limitado às turmas e
 * disciplinas que leciona; a coordenação/administração não é restringida.
 */
const MIXED_SCOPED: ReadonlySet<PossessionKind> = new Set<PossessionKind>([
  POSSESSION.STUDENT_OR_TEACHER_ASSESSMENT_LIST,
  POSSESSION.STUDENT_OR_TEACHER_ASSESSMENT,
  POSSESSION.STUDENT_OR_TEACHER_GRADES,
  POSSESSION.STUDENT_OR_TEACHER_RESULTS,
  POSSESSION.STUDENT_OR_TEACHER_RESULT,
  POSSESSION.STUDENT_OR_TEACHER_SCHEDULE_LIST,
  POSSESSION.STUDENT_OR_TEACHER_SCHEDULE,
  POSSESSION.STUDENT_OR_TEACHER_PAUTA,
]);

export function isStudentScoped(possession: PossessionKind): boolean {
  return STUDENT_SCOPED.has(possession) || MIXED_SCOPED.has(possession);
}

export function isTeacherScoped(possession: PossessionKind): boolean {
  return TEACHER_SCOPED.has(possession);
}

export async function enforcePossession(
  service: SchedulesAssessmentsService,
  rule: RouteAccessRule,
  request: PossessionRequest,
): Promise<PossessionOutcome> {
  const guard = guards[rule.possession];
  if (!guard) {
    throw new Error(`Regra de posse sem guard implementado: ${rule.method} ${rule.path} → ${rule.possession}`);
  }

  const role = request.ctx.role;
  if (MIXED_SCOPED.has(rule.possession)) {
    // O guard distingue o role (estudante vs. docente vs. coordenação).
    return guard(service, request);
  }
  if (STUDENT_SCOPED.has(rule.possession)) {
    if (!isStudentRole(role)) {
      return NO_OUTCOME;
    }
  } else if (TEACHER_SCOPED.has(rule.possession)) {
    if (isStudentRole(role)) {
      throw new DomainError('FORBIDDEN', POSSESSION_MESSAGE);
    }
  }

  return guard(service, request);
}

export function assertStudentOwnsResource(
  resourceOwnerId: string | undefined,
  ownStudentId: string | undefined,
): void {
  if (!ownStudentId || !resourceOwnerId || resourceOwnerId !== ownStudentId) {
    throw new DomainError('FORBIDDEN', POSSESSION_MESSAGE);
  }
}

export const POSSESSION_KINDS = Object.values(POSSESSION);