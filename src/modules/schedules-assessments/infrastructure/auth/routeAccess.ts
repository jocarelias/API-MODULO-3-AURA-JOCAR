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
  // Leitura mista (alinhamento com o Core/UniversityCampusSystem):
  // STUDENT fica limitado aos próprios dados; TEACHER fica limitado às turmas
  // e disciplinas que leciona (posse pela cadeira); COORDINATOR/ADMIN vê tudo.
  STUDENT_OR_TEACHER_ASSESSMENT_LIST: 'student-or-teacher-assessment-list',
  STUDENT_OR_TEACHER_ASSESSMENT: 'student-or-teacher-assessment',
  STUDENT_OR_TEACHER_GRADES: 'student-or-teacher-grades',
  STUDENT_OR_TEACHER_RESULTS: 'student-or-teacher-results',
  STUDENT_OR_TEACHER_RESULT: 'student-or-teacher-result',
  STUDENT_OR_TEACHER_SCHEDULE_LIST: 'student-or-teacher-schedule-list',
  STUDENT_OR_TEACHER_SCHEDULE: 'student-or-teacher-schedule',
  STUDENT_OR_TEACHER_PAUTA: 'student-or-teacher-pauta',
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
    summary: 'Lista avaliações; o estudante fica limitado às suas turmas e o docente às avaliações das cadeiras que leciona',
    possession: 'student-or-teacher-assessment-list',
  },
  {
    method: 'POST',
    path: '/assessments',
    roles: STAFF,
    summary: 'Cria uma avaliação',
    possession: 'teacher-own-assessment',
  },
  {
    method: 'POST',
    path: '/assessments/plan',
    roles: STAFF,
    summary: 'Cria o conjunto de avaliações (nomes e pesos) definido pelo docente',
    possession: 'teacher-own-assessment',
  },
  {
    method: 'GET',
    path: '/assessments/:id',
    roles: STUDENT_OR_STAFF,
    summary: 'Obtém uma avaliação; o estudante só acede às suas turmas e o docente só às avaliações que lhe pertencem',
    possession: 'student-or-teacher-assessment',
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
    summary: 'Lista notas da avaliação; o estudante recebe apenas as suas e o docente só as das cadeiras que leciona',
    possession: 'student-or-teacher-grades',
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
    summary: 'Lista horários; o estudante fica limitado às suas turmas e o docente às aulas que leciona',
    possession: 'student-or-teacher-schedule-list',
  },
  {
    method: 'POST',
    path: '/schedules',
    roles: ADMIN,
    summary: 'Cria um horário (só coordenação/administração)',
    possession: 'teacher-own-schedule',
  },
  {
    method: 'GET',
    path: '/schedules/:id',
    roles: STUDENT_OR_STAFF,
    summary: 'Obtém um horário; o estudante só acede às suas turmas e o docente só às suas aulas',
    possession: 'student-or-teacher-schedule',
  },
  {
    method: 'PATCH',
    path: '/schedules/:id',
    roles: ADMIN,
    summary: 'Atualiza um horário (só coordenação/administração)',
    possession: 'teacher-own-schedule',
  },
  {
    method: 'DELETE',
    path: '/schedules/:id',
    roles: ADMIN,
    summary: 'Elimina um horário (só coordenação/administração)',
    possession: 'teacher-own-schedule',
  },
  {
    method: 'GET',
    path: '/results',
    roles: STUDENT_OR_STAFF,
    summary: 'Lista resultados; o estudante fica limitado aos seus e o docente às cadeiras que leciona',
    possession: 'student-or-teacher-results',
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
    summary: 'Obtém um resultado; o estudante só acede ao seu e o docente só às cadeiras que leciona',
    possession: 'student-or-teacher-result',
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
    summary: 'Dados para impressão da pauta; o estudante recebe apenas a sua linha e o docente só as cadeiras que leciona',
    possession: 'student-or-teacher-pauta',
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
/**
 * Tabela Rota -> Roles em Markdown, gerada a partir de ROUTE_ACCESS.
 *
 * A tabela não é mantida à mão: `npm run docs:access-table` regenera
 * `docs/ROUTE_ACCESS.md` a partir desta fonte de verdade, garantindo que a
 * documentação nunca diverge do que o código faz.
 */
export function renderAccessTableMarkdown(): string {
  const header = ['| Método | Rota | Roles | Verificação de posse | Descrição |', '| --- | --- | --- | --- | --- |'];
  const rows = ROUTE_ACCESS.map((rule) => {
    const roles = rule.roles.length === ROLES.length ? 'TODOS' : rule.roles.join(', ');
    const possession = rule.possession === POSSESSION.NONE ? '—' : `\`${rule.possession}\``;
    return `| \`${rule.method}\` | \`${rule.path}\` | ${roles} | ${possession} | ${rule.summary} |`;
  });
  const publics = PUBLIC_ROUTES.map((route) => `| \`${route.split(' ')[0]}\` | \`${route.split(' ')[1]}\` | *(público)* | — | Não exige token |`);

  return [
    '# Tabela Rota → Roles',
    '',
    '> Ficheiro **gerado automaticamente** a partir de `ROUTE_ACCESS`',
    '> (`src/modules/schedules-assessments/infrastructure/auth/routeAccess.ts`).',
    '> Não editar à mão: alterar `ROUTE_ACCESS` e correr `npm run docs:access-table`.',
    '',
    '## Rotas públicas',
    '',
    '| Método | Rota | Roles | Verificação de posse | Descrição |',
    '| --- | --- | --- | --- | --- |',
    ...publics,
    '',
    '## Rotas protegidas',
    '',
    ...header,
    ...rows,
    '',
    '## Como ler a coluna "Verificação de posse"',
    '',
    'Ter o role certo **não** é suficiente: a tabela declara também, para cada rota,',
    'a verificação explícita de posse do objecto (`POSSESSION`). Os guards correspondentes',
    'estão em `infrastructure/auth/accessPolicy.ts` e são aplicados pelo router.',
    '',
    `- \`${POSSESSION.STUDENT_OR_TEACHER_RESULTS}\` — resultados: o estudante só vê os seus; o docente só os das turmas/disciplinas que leciona.`,
    `- \`${POSSESSION.STUDENT_OR_TEACHER_RESULT}\` — um resultado concreto: posse do estudante ou da cadeira lecionada pelo docente.`,
    `- \`${POSSESSION.STUDENT_OR_TEACHER_ASSESSMENT_LIST}\` — avaliações: limite por turma (estudante) ou por docência (docente).`,
    `- \`${POSSESSION.STUDENT_OR_TEACHER_ASSESSMENT}\` — uma avaliação concreta: turma do estudante ou docência do docente.`,
    `- \`${POSSESSION.STUDENT_OR_TEACHER_GRADES}\` — notas: estudante (turma + dívida regularizada) ou docente (cadeira lecionada).`,
    `- \`${POSSESSION.STUDENT_OR_TEACHER_SCHEDULE_LIST}\` — horários: limite por turma (estudante) ou por docência (docente).`,
    `- \`${POSSESSION.STUDENT_OR_TEACHER_SCHEDULE}\` — um horário concreto: turma do estudante ou aula do docente.`,
    `- \`${POSSESSION.STUDENT_OR_TEACHER_PAUTA}\` — pauta: linha do estudante ou cadeira lecionada pelo docente.`,
    `- \`${POSSESSION.STUDENT_OWN_RESULTS}\` — o estudante só acede aos resultados cujo \`studentId\` é o seu.`,
    `- \`${POSSESSION.STUDENT_OWN_FINANCIAL}\` — só consulta a própria situação financeira.`,
    `- \`${POSSESSION.STUDENT_CLASS_SCOPE}\` — o recurso tem de pertencer a uma turma em que o estudante está inscrito.`,
    `- \`${POSSESSION.STUDENT_GRADES_IN_CLASS}\` — notas: turma do recurso **e** dívida regularizada.`,
    `- \`${POSSESSION.STUDENT_PAUTA_IN_CLASS}\` — pauta: turma do recurso **e** dívida regularizada.`,
    `- \`${POSSESSION.STUDENT_OWN_GRADES}\` — o estudante recebe apenas as suas notas.`,
    `- \`${POSSESSION.TEACHER_OWN_ASSESSMENT}\` — só o docente atribuído à avaliação.`,
    `- \`${POSSESSION.TEACHER_OWN_SCHEDULE}\` — só o docente atribuído ao horário.`,
    `- \`${POSSESSION.TEACHER_OWN_RESULT}\` — só o docente que leciona a turma/disciplina do resultado.`,
    '',
  ].join('\n');
}
