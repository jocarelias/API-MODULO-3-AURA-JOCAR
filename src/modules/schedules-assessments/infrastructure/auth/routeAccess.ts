import { ADMIN_ROLES, ROLES, STAFF_ROLES } from '@smartcampus/shared-types';

export const ALL_ROLES: readonly string[] = ROLES;
export const STAFF: readonly string[] = STAFF_ROLES;
export const ADMIN: readonly string[] = ADMIN_ROLES;
export const STUDENT_ROLE = 'STUDENT';
export const TEACHER_ROLE = 'TEACHER';
export const STUDENT_OR_STAFF: readonly string[] = [...STAFF_ROLES, STUDENT_ROLE];

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export const POSSESSION = {
  NONE: 'none',
  STUDENT_OWN_RESULTS: 'student-own-results',
  STUDENT_OWN_GRADES: 'student-own-grades',
  STUDENT_CLASS_SCOPE: 'student-class-scope',
  STUDENT_GRADES_IN_CLASS: 'student-grades-in-class',
  STUDENT_PAUTA_IN_CLASS: 'student-pauta-in-class',
  STUDENT_OWN_FINANCIAL: 'student-own-financial',
  TEACHER_OWN_ASSESSMENT: 'teacher-own-assessment',
  TEACHER_OWN_SCHEDULE: 'teacher-own-schedule',
  TEACHER_OWN_RESULT: 'teacher-own-result',
} as const;

export type PossessionKind = (typeof POSSESSION)[keyof typeof POSSESSION];

export interface RouteAccessRule {
  method: HttpMethod;
  path: string;
  roles: readonly string[];
  summary: string;
  possession: PossessionKind;
}

export const PUBLIC_ROUTES: readonly string[] = ['POST /auth/login', 'POST /auth/refresh'];
export const ROUTE_ACCESS: readonly RouteAccessRule[] = [
  {
    method: 'POST',
    path: '/auth/logout',
    roles: ALL_ROLES,
    summary: 'Revoga o refreshToken do próprio utilizador autenticado',
    possession: 'none',
  },
  {
    method: 'GET',
    path: '/me/financial-status',
    roles: [STUDENT_ROLE],
    summary: 'Estado financeiro do próprio estudante (ACTIVE/BLOCKED)',
    possession: 'student-own-financial',
  },
  {
    method: 'GET',
    path: '/assessments',
    roles: STUDENT_OR_STAFF,
    summary: 'Lista avaliações; o estudante fica limitado às turmas em que está matriculado',
    possession: 'student-class-scope',
  },
  {
    method: 'POST',
    path: '/assessments',
    roles: STAFF,
    summary: 'Cria uma avaliação',
    possession: 'teacher-own-assessment',
  },
  {
    method: 'GET',
    path: '/assessments/:id',
    roles: STUDENT_OR_STAFF,
    summary: 'Obtém uma avaliação; o estudante só acede a avaliações das suas turmas',
    possession: 'student-class-scope',
  },
  {
    method: 'PATCH',
    path: '/assessments/:id',
    roles: STAFF,
    summary: 'Atualiza uma avaliação',
    possession: 'teacher-own-assessment',
  },
  {
    method: 'DELETE',
    path: '/assessments/:id',
    roles: STAFF,
    summary: 'Elimina uma avaliação sem notas lançadas',
    possession: 'teacher-own-assessment',
  },
  {
    method: 'GET',
    path: '/assessments/:assessmentId/grades',
    roles: STUDENT_OR_STAFF,
    summary: 'Lista notas da avaliação; o estudante recebe apenas as suas',
    possession: 'student-grades-in-class',
  },
  {
    method: 'POST',
    path: '/assessments/:assessmentId/grades',
    roles: STAFF,
    summary: 'Lança a nota de um aluno numa avaliação',
    possession: 'teacher-own-assessment',
  },
  {
    method: 'PATCH',
    path: '/assessments/:assessmentId/grades/:gradeId',
    roles: STAFF,
    summary: 'Altera a nota lançada',
    possession: 'teacher-own-assessment',
  },
  {
    method: 'GET',
    path: '/schedules',
    roles: STUDENT_OR_STAFF,
    summary: 'Lista horários; o estudante fica limitado às suas turmas e a si próprio',
    possession: 'student-class-scope',
  },
  {
    method: 'POST',
    path: '/schedules',
    roles: STAFF,
    summary: 'Cria um horário',
    possession: 'teacher-own-schedule',
  },
  {
    method: 'GET',
    path: '/schedules/:id',
    roles: STUDENT_OR_STAFF,
    summary: 'Obtém um horário; o estudante só acede a horários das suas turmas',
    possession: 'student-class-scope',
  },
  {
    method: 'PATCH',
    path: '/schedules/:id',
    roles: STAFF,
    summary: 'Atualiza um horário',
    possession: 'teacher-own-schedule',
  },
  {
    method: 'DELETE',
    path: '/schedules/:id',
    roles: STAFF,
    summary: 'Elimina um horário',
    possession: 'teacher-own-schedule',
  },
  {
    method: 'GET',
    path: '/results',
    roles: STUDENT_OR_STAFF,
    summary: 'Lista resultados; o estudante fica limitado aos seus resultados',
    possession: 'student-own-results',
  },
  {
    method: 'GET',
    path: '/results/calculation-methods',
    roles: ALL_ROLES,
    summary: 'Lista os métodos de cálculo do motor académico (metadado sem dados pessoais)',
    possession: 'none',
  },
  {
    method: 'POST',
    path: '/results/calculate',
    roles: ALL_ROLES,
    summary: 'Calcula uma média com as notas enviadas no próprio pedido',
    possession: 'none',
  },
  {
    method: 'GET',
    path: '/results/:id',
    roles: STUDENT_OR_STAFF,
    summary: 'Obtém um resultado; o estudante só acede ao seu próprio resultado',
    possession: 'student-own-results',
  },
  {
    method: 'POST',
    path: '/results',
    roles: STAFF,
    summary: 'Calcula/atualiza resultados em lote',
    possession: 'teacher-own-result',
  },
  {
    method: 'PATCH',
    path: '/results/:id',
    roles: STAFF,
    summary: 'Recalcula um resultado individual',
    possession: 'teacher-own-result',
  },
  {
    method: 'DELETE',
    path: '/results/:id',
    roles: STAFF,
    summary: 'Elimina um resultado',
    possession: 'teacher-own-result',
  },
  {
    method: 'GET',
    path: '/print/class/:classId/schedule',
    roles: STUDENT_OR_STAFF,
    summary: 'Dados para impressão do horário de uma turma; o estudante só imprime as suas turmas',
    possession: 'student-class-scope',
  },
  {
    method: 'GET',
    path: '/print/class/:classId/pauta',
    roles: STUDENT_OR_STAFF,
    summary: 'Dados para impressão da pauta; o estudante recebe apenas a sua linha',
    possession: 'student-pauta-in-class',
  },
  {
    method: 'GET',
    path: '/schools',
    roles: ALL_ROLES,
    summary: 'Catálogo de escolas',
    possession: 'none',
  },
  {
    method: 'GET',
    path: '/academic-years',
    roles: ALL_ROLES,
    summary: 'Catálogo de anos letivos',
    possession: 'none',
  },
  {
    method: 'GET',
    path: '/terms',
    roles: ALL_ROLES,
    summary: 'Catálogo de períodos letivos',
    possession: 'none',
  },
  {
    method: 'GET',
    path: '/classes',
    roles: ALL_ROLES,
    summary: 'Catálogo de turmas',
    possession: 'none',
  },
  {
    method: 'GET',
    path: '/subjects',
    roles: ALL_ROLES,
    summary: 'Catálogo de disciplinas',
    possession: 'none',
  },
  {
    method: 'GET',
    path: '/teachers',
    roles: STAFF,
    summary: 'Catálogo de docentes (dados pessoais)',
    possession: 'none',
  },
  {
    method: 'GET',
    path: '/students',
    roles: STAFF,
    summary: 'Catálogo de estudantes (dados pessoais)',
    possession: 'none',
  },
];
export function routeKey(method: HttpMethod, path: string): string {
  return `${method} ${path}`;
}

export function accessRule(method: HttpMethod, path: string): RouteAccessRule {
  const rule = ROUTE_ACCESS.find((entry) => entry.method === method && entry.path === path);
  if (!rule) {
    throw new Error(`Rota sem regra de acesso declarada: ${routeKey(method, path)}`);
  }
  return rule;
}

export function isSuperAdmin(role: string): boolean {
  return role === 'SUPER_ADMIN';
}