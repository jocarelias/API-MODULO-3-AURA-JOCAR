import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { signToken } from '@smartcampus/auth';
import { createApp } from '../../../app';
import { startContractServices, TEST_JWT_SECRET, type ContractTestContext } from './contractTestEnv';

/**
 * SUITE ADVERSARIAL ANTI-BOLA (Módulo V — Passo 4 do guia)
 * ===========================================================================
 * Convenção Adoptada (documentada e usada de forma consistente em todo o módulo):
 *
 *   - O recurso EXISTE mas pertence a outro utilizador  → 403 FORBIDDEN
 *     (o role é válido; falta a verificação de POSSE do objecto).
 *   - O recurso NÃO EXISTE                              → 404 NOT_FOUND
 *
 * Onde está a verificação de posse, rota a rota:
 *
 *   GET  /results/:id .............. src/modules/schedules-assessments/http/schedulesAssessmentsRouter.ts
 *                                    → assertStudentOwnsResource(data.studentId, scope.studentId)
 *                                    (definição: infrastructure/auth/accessPolicy.ts)
 *   GET  /results?studentId=B ..... infrastructure/auth/accessPolicy.ts
 *                                    → POSSESSION.STUDENT_OWN_RESULTS
 *                                    → service.resolveStudentScope() → POSSESSION_DENIED (FORBIDDEN)
 *   GET  /me/financial-status ..... infrastructure/auth/accessPolicy.ts
 *                                    → POSSESSION.STUDENT_OWN_FINANCIAL → resolveStudentScope()
 *   GET  /assessments/:id ......... infrastructure/auth/accessPolicy.ts
 *                                    → POSSESSION.STUDENT_OR_TEACHER_ASSESSMENT
 *                                      → student: service.assertStudentInClass(); teacher: assertTeacherOwns()
 *   GET  /assessments/:id/grades .. infrastructure/auth/accessPolicy.ts
 *                                    → POSSESSION.STUDENT_OR_TEACHER_GRADES
 *                                      → student: assertStudentInClass(); teacher: assertTeacherOwnsTeaching()
 *   GET  /results/:id ............. infrastructure/auth/accessPolicy.ts
 *                                    → POSSESSION.STUDENT_OR_TEACHER_RESULT
 *   GET  /schedules, /schedules/:id  infrastructure/auth/accessPolicy.ts
 *                                    → POSSESSION.STUDENT_OR_TEACHER_SCHEDULE(_LIST)
 *   GET  /print/class/:classId/...  infrastructure/auth/accessPolicy.ts
 *                                    → POSSESSION.STUDENT_OR_TEACHER_PAUTA
 *   POST|PATCH|DELETE /schedules ... infrastructure/auth/routeAccess.ts → roles ADMIN (coordenação/administração)
 *   PATCH|DELETE /results/:id ..... application/schedulesAssessmentsService.ts
 *                                    → patchResult()/deleteResult() → assertTeacherOwnsTeaching()
 *   PATCH|DELETE /assessments/:id . application/schedulesAssessmentsService.ts
 *                                    → assertTeacherOwns(assessment.teacherId, ctx)
 *   PATCH|DELETE /schedules/:id ... application/schedulesAssessmentsService.ts
 *                                    → assertTeacherOwns(schedule.teacherId, ctx)
 *
 * PONTO DE VERIFICAÇÃO DO GUIA: esta suite deve FALHAR se qualquer uma destas
 * linhas for removida. Para o confirmar, comente a linha indicada e corra
 * `npx vitest run --config vitest.e2e.config.ts src/modules/schedules-assessments/tests/bola.e2e.test.ts`
 * — o teste correspondente passa a devolver 200/201 e o teste quebra.
 */

interface Fixtures {
  schoolId: string;
  classA: string;
  classB: string;
  subjectId: string;
  termId: string;
  assessmentA: string;
  assessmentB: string;
  gradeA: string;
  gradeB: string;
  scheduleA: string;
  scheduleB: string;
  resultA: string;
  resultB: string;
  studentAId: string;
  studentBId: string;
  tokenStudentA: string;
  tokenStudentB: string;
  tokenTeacherA: string;
  tokenTeacherB: string;
  tokenCoordinator: string;
  teacherAId: string;
  teacherBId: string;
  academicYearId: string;
}

describe('Anti-BOLA adversarial — posse de objectos por STUDENT e por TEACHER (e2e)', () => {
  let app: ReturnType<typeof createApp>;
  let server: ReturnType<typeof app.listen>;
  let apiBase: string;
  let testContext: ContractTestContext;
  const prisma = new PrismaClient();
  let f: Fixtures;

  const asA = (method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    request(apiBase)[method](url).set('authorization', `Bearer ${f.tokenStudentA}`);
  const asB = (method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    request(apiBase)[method](url).set('authorization', `Bearer ${f.tokenStudentB}`);
  const asTeacherA = (method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    request(apiBase)[method](url).set('authorization', `Bearer ${f.tokenTeacherA}`);
  const asTeacherB = (method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    request(apiBase)[method](url).set('authorization', `Bearer ${f.tokenTeacherB}`);
  const asCoordinator = (method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    request(apiBase)[method](url).set('authorization', `Bearer ${f.tokenCoordinator}`);

  beforeAll(async () => {
    testContext = await startContractServices();
    app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    apiBase = typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}` : '';

    f = await seedIsolatedFixtures(prisma);

    // Garante: os dois estudantes estão sem dívida, para que um 403
    // observado seja sempre de POSSE e nunca de blockage financeiro.
    await prisma.financialStatus.deleteMany({ where: { studentId: { in: [f.studentAId, f.studentBId] } } });
    await prisma.financialStatus.createMany({
      data: [
        { schoolId: f.schoolId, studentId: f.studentAId, hasDebt: false, status: 'REGULAR', outstandingAmount: 0 },
        { schoolId: f.schoolId, studentId: f.studentBId, hasDebt: false, status: 'REGULAR', outstandingAmount: 0 },
      ],
    });
  });

  afterAll(async () => {
    if (f?.schoolId) {
      await prisma.school.deleteMany({ where: { id: f.schoolId } });
    }
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
    await testContext.stop();
  });

  /* --------------------------------------------------------------------- */
  /* SANITY: os fixtures são válidos — sem isto um 403 seria indistinguível  */
  /* de "rota não encontrada" e a suite não provaria nada.                    */
  /* --------------------------------------------------------------------- */
  it('SANITY — Estudante A consegue ler o seu próprio resultado (200)', async () => {
    const res = await asA('get', `/api/v1/results/${f.resultA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.studentId).toBe(f.studentAId);
  });

  it('SANITY — Estudante B consegue ler o seu próprio resultado (200)', async () => {
    const res = await asB('get', `/api/v1/results/${f.resultB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.studentId).toBe(f.studentBId);
  });

  it('SANITY — 404 para recurso inexistente (consistência com a convenção)', async () => {
    const res = await asA('get', `/api/v1/results/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  /* --------------------------------------------------------------------- */
  /* LEITURA — Estudante A tenta aceder aos dados do Estudante B             */
  /* --------------------------------------------------------------------- */
  it('LEITURA — GET /results/:id do B com token do A → 403 (posse no router)', async () => {
    const res = await asA('get', `/api/v1/results/${f.resultB}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('LEITURA — GET /results?studentId=<B> com token do A → 403 (resolveStudentScope)', async () => {
    const res = await asA('get', `/api/v1/results?studentId=${f.studentBId}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('LEITURA — GET /me/financial-status?studentId=<B> com token do A → 403', async () => {
    const res = await asA('get', `/api/v1/me/financial-status?studentId=${f.studentBId}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('LEITURA — GET /assessments/:id da turma do B com token do A → 403 (assertStudentInClass)', async () => {
    const res = await asA('get', `/api/v1/assessments/${f.assessmentB}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('LEITURA — GET /schedules/:id da turma do B com token do A → 403', async () => {
    const res = await asA('get', `/api/v1/schedules/${f.scheduleB}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('LEITURA — GET /print/class/<turma do B>/pauta com token do A → 403', async () => {
    const res = await asA('get', `/api/v1/print/class/${f.classB}/pauta?subjectId=${f.subjectId}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('LEITURA — GET /print/class/<turma do B>/schedule com token do A → 403', async () => {
    const res = await asA('get', `/api/v1/print/class/${f.classB}/schedule`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('LEITURA — GET /assessments/:assessmentId/grades da turma do B → 403', async () => {
    const res = await asA('get', `/api/v1/assessments/${f.assessmentB}/grades`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('LEITURA — a negação não revela o recurso do B nem deixa de o existir', async () => {
    const [denied, owner] = await Promise.all([
      asA('get', `/api/v1/results/${f.resultB}`),
      asB('get', `/api/v1/results/${f.resultB}`),
    ]);
    expect(denied.status).toBe(403);
    expect(JSON.stringify(denied.body)).not.toContain(f.studentBId);
    expect(owner.status).toBe(200);
  });

  /* --------------------------------------------------------------------- */
  /* ESCRITA — Estudante A tenta alterar/apagar recursos do Estudante B     */
  /* --------------------------------------------------------------------- */
  it('ESCRITA — PATCH /results/:id do B com token do A → 403 e nada é alterado', async () => {
    const before = await prisma.result.findUnique({ where: { id: f.resultB } });
    const res = await asA('patch', `/api/v1/results/${f.resultB}`).send({});
    expect([403, 404]).toContain(res.status);
    expect(res.status).toBe(403);
    const after = await prisma.result.findUnique({ where: { id: f.resultB } });
    expect(after?.status).toBe(before?.status);
    expect(await prisma.result.count({ where: { id: f.resultB } })).toBe(1);
  });

  it('ESCRITA — DELETE /results/:id do B com token do A → 403 e o recurso sobrevive', async () => {
    const res = await asA('delete', `/api/v1/results/${f.resultB}`);
    expect(res.status).toBe(403);
    expect(await prisma.result.count({ where: { id: f.resultB } })).toBe(1);
  });

  it('ESCRITA — PATCH /assessments/:id do B com token do A → 403', async () => {
    const res = await asA('patch', `/api/v1/assessments/${f.assessmentB}`).send({ name: ' sequestrada ' });
    expect(res.status).toBe(403);
    const stored = await prisma.assessment.findUnique({ where: { id: f.assessmentB } });
    expect(stored?.name).not.toBe(' sequestrada ');
  });

  it('ESCRITA — DELETE /assessments/:id do B com token do A → 403', async () => {
    const res = await asA('delete', `/api/v1/assessments/${f.assessmentB}`);
    expect(res.status).toBe(403);
    expect(await prisma.assessment.count({ where: { id: f.assessmentB } })).toBe(1);
  });

  it('ESCRITA — PATCH /schedules/:id do B com token do A → 403', async () => {
    const res = await asA('patch', `/api/v1/schedules/${f.scheduleB}`).send({ room: 'Sala 999' });
    expect(res.status).toBe(403);
    const stored = await prisma.schedule.findUnique({ where: { id: f.scheduleB } });
    expect(stored?.room).not.toBe('Sala 999');
  });

  it('ESCRITA — DELETE /schedules/:id do B com token do A → 403', async () => {
    const res = await asA('delete', `/api/v1/schedules/${f.scheduleB}`);
    expect(res.status).toBe(403);
    expect(await prisma.schedule.count({ where: { id: f.scheduleB } })).toBe(1);
  });

  it('ESCRITA — PATCH /assessments/:id/grades/<nota do B> com token do A → 403', async () => {
    const before = await prisma.grade.findUnique({ where: { id: f.gradeB } });
    const res = await asA('patch', `/api/v1/assessments/${f.assessmentB}/grades/${f.gradeB}`).send({ score: 20 });
    expect([403, 404]).toContain(res.status);
    expect(res.status).toBe(403);
    const after = await prisma.grade.findUnique({ where: { id: f.gradeB } });
    expect(after?.value).toEqual(before?.value);
  });

  /* --------------------------------------------------------------------- */
  /* ESCRITA — Docente A tenta alterar recursos da docência do Docente B    */
  /* (o role está correcto: a única barreira é a posse)                       */
  /* --------------------------------------------------------------------- */
  it('ESCRITA — TEACHER A faz PATCH /results/:id do B → 403 (assertTeacherOwnsTeaching)', async () => {
    const before = await prisma.result.findUnique({ where: { id: f.resultB } });
    const res = await asTeacherA('patch', `/api/v1/results/${f.resultB}`).send({});
    expect(res.status).toBe(403);
    const after = await prisma.result.findUnique({ where: { id: f.resultB } });
    expect(after?.status).toBe(before?.status);
  });

  it('ESCRITA — TEACHER A faz DELETE /results/:id do B → 403', async () => {
    const res = await asTeacherA('delete', `/api/v1/results/${f.resultB}`);
    expect(res.status).toBe(403);
    expect(await prisma.result.count({ where: { id: f.resultB } })).toBe(1);
  });

  it('ESCRITA — TEACHER A faz PATCH /assessments/:id do B → 403 (assertTeacherOwns)', async () => {
    const res = await asTeacherA('patch', `/api/v1/assessments/${f.assessmentB}`).send({ name: 'Docencia B' });
    expect(res.status).toBe(403);
  });

  it('ESCRITA — TEACHER A faz PATCH /schedules/:id do B → 403', async () => {
    const res = await asTeacherA('patch', `/api/v1/schedules/${f.scheduleB}`).send({ room: 'Sala 999' });
    expect(res.status).toBe(403);
  });

  it('ESCRITA — TEACHER A lança nota na avaliação do B → 403', async () => {
    const res = await asTeacherA('post', `/api/v1/assessments/${f.assessmentB}/grades`).send({
      studentId: f.studentBId,
      score: 20,
    });
    expect([403, 400, 404]).toContain(res.status);
    expect(res.status).toBe(403);
  });

  it('CONTRA-PROVA — TEACHER B continua a conseguir alterar a sua própria avaliação (200)', async () => {
    const res = await asTeacherB('patch', `/api/v1/assessments/${f.assessmentB}`).send({ name: 'Avaliação do B' });
    expect(res.status).toBe(200);
    const stored = await prisma.assessment.findUnique({ where: { id: f.assessmentB } });
    expect(stored?.name).toBe('Avaliação do B');
  });

  /* --------------------------------------------------------------------- */
  /* LEITURA — Docente A tenta ler recursos da docência do Docente B        */
  /* (alinhamento com UniversityCampusSystem: TEACHER só lê o que leciona)  */
  /* --------------------------------------------------------------------- */
  it('LEITURA — TEACHER A lê a avaliação do B (GET /assessments/:id) → 403', async () => {
    const res = await asTeacherA('get', `/api/v1/assessments/${f.assessmentB}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('LEITURA — TEACHER A lê as notas da avaliação do B (GET /assessments/:id/grades) → 403', async () => {
    const res = await asTeacherA('get', `/api/v1/assessments/${f.assessmentB}/grades`);
    expect(res.status).toBe(403);
  });

  it('LEITURA — TEACHER A lê o resultado do B (GET /results/:id) → 403', async () => {
    const res = await asTeacherA('get', `/api/v1/results/${f.resultB}`);
    expect(res.status).toBe(403);
  });

  it('LEITURA — TEACHER A lista resultados: vê os seus e nunca os do B', async () => {
    const res = await asTeacherA('get', '/api/v1/results');
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(f.resultA);
    expect(ids).not.toContain(f.resultB);
  });

  it('LEITURA — TEACHER A lista horários: vê os seus e nunca os do B', async () => {
    const res = await asTeacherA('get', '/api/v1/schedules');
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: string }[]).map((s) => s.id);
    expect(ids).toContain(f.scheduleA);
    expect(ids).not.toContain(f.scheduleB);
  });

  it('LEITURA — TEACHER A lê o horário do B (GET /schedules/:id) → 403', async () => {
    const res = await asTeacherA('get', `/api/v1/schedules/${f.scheduleB}`);
    expect(res.status).toBe(403);
  });

  it('LEITURA — CONTRA-PROVA: TEACHER A lê a sua própria avaliação e notas (200)', async () => {
    const assessment = await asTeacherA('get', `/api/v1/assessments/${f.assessmentA}`);
    expect(assessment.status).toBe(200);
    const grades = await asTeacherA('get', `/api/v1/assessments/${f.assessmentA}/grades`);
    expect(grades.status).toBe(200);
    const ids = (grades.body.data as { id: string }[]).map((g) => g.id);
    expect(ids).toContain(f.gradeA);
  });

  /* --------------------------------------------------------------------- */
  /* ESCRITA — criação de horários é exclusiva da coordenação/administração */
  /* --------------------------------------------------------------------- */
  it('ESCRITA — TEACHER A tenta criar horário (POST /schedules) → 403', async () => {
    const res = await asTeacherA('post', '/api/v1/schedules').send({
      academicYearId: f.academicYearId,
      termId: f.termId,
      classId: f.classA,
      subjectId: f.subjectId,
      teacherId: f.teacherAId,
      dayOfWeek: 'WEDNESDAY',
      startTime: '11:00',
      endTime: '12:00',
    });
    expect(res.status).toBe(403);
  });

  it('CONTRA-PROVA — COORDINATOR cria horário (POST /schedules) → 201', async () => {
    const res = await asCoordinator('post', '/api/v1/schedules').send({
      academicYearId: f.academicYearId,
      termId: f.termId,
      classId: f.classA,
      subjectId: f.subjectId,
      teacherId: f.teacherAId,
      dayOfWeek: 'WEDNESDAY',
      startTime: '11:00',
      endTime: '12:00',
      room: 'Sala Coord',
    });
    expect(res.status).toBe(201);
    await prisma.schedule.deleteMany({ where: { id: res.body.data.id } });
  });
});

async function seedIsolatedFixtures(prisma: PrismaClient): Promise<Fixtures> {
  const schoolId = randomUUID();
  const now = new Date();

  await prisma.school.create({
    data: { id: schoolId, name: `BOLA ${schoolId.slice(0, 6)}`, code: `BOL${schoolId.slice(0, 4)}`, status: 'ACTIVE' },
  });

  const year = await prisma.academicYear.create({
    data: { schoolId, name: `Ano BOLA ${schoolId.slice(0, 4)}`, startDate: now, endDate: new Date(now.getFullYear() + 1, 0, 1) },
  });
  const term = await prisma.term.create({
    data: { schoolId, academicYearId: year.id, name: `1º Período BOLA`, startDate: now, endDate: new Date(now.getFullYear(), 11, 31) },
  });
  const [classA, classB] = await Promise.all([
    prisma.class.create({ data: { schoolId, academicYearId: year.id, name: 'Turma A', grade: '1', shift: 'Manhã', room: 'Sala A' } }),
    prisma.class.create({ data: { schoolId, academicYearId: year.id, name: 'Turma B', grade: '2', shift: 'Tarde', room: 'Sala B' } }),
  ]);
  const subject = await prisma.subject.create({ data: { schoolId, name: 'Disciplina BOLA', code: 'BOL' } });

  const teacherA = await createTeacher(prisma, schoolId, 'Professor A');
  const teacherB = await createTeacher(prisma, schoolId, 'Professor B');
  const studentA = await createStudent(prisma, schoolId, 'Estudante A');
  const studentB = await createStudent(prisma, schoolId, 'Estudante B');
  const coordinator = await createStaff(prisma, schoolId, 'Coordenador BOLA', 'COORDINATOR');

  await prisma.enrollment.createMany({
    data: [
      { schoolId, studentId: studentA.studentId, classId: classA.id, subjectId: subject.id, termId: term.id, academicYearId: year.id, status: 'ACTIVE' },
      { schoolId, studentId: studentB.studentId, classId: classB.id, subjectId: subject.id, termId: term.id, academicYearId: year.id, status: 'ACTIVE' },
    ],
  });

  const assessmentA = await createAssessment(prisma, { schoolId, classId: classA.id, subjectId: subject.id, termId: term.id, yearId: year.id, teacherId: teacherA.teacherId, name: 'Avaliação A' });
  const assessmentB = await createAssessment(prisma, { schoolId, classId: classB.id, subjectId: subject.id, termId: term.id, yearId: year.id, teacherId: teacherB.teacherId, name: 'Avaliação B' });

  const gradeA = await createGrade(prisma, { schoolId, assessmentId: assessmentA, studentId: studentA.studentId });
  const gradeB = await createGrade(prisma, { schoolId, assessmentId: assessmentB, studentId: studentB.studentId });

  const scheduleA = await createSchedule(prisma, { schoolId, classId: classA.id, subjectId: subject.id, termId: term.id, yearId: year.id, teacherId: teacherA.teacherId, room: 'Sala A' });
  const scheduleB = await createSchedule(prisma, { schoolId, classId: classB.id, subjectId: subject.id, termId: term.id, yearId: year.id, teacherId: teacherB.teacherId, room: 'Sala B' });

  const resultA = await createResult(prisma, { schoolId, studentId: studentA.studentId, classId: classA.id, subjectId: subject.id, termId: term.id, yearId: year.id });
  const resultB = await createResult(prisma, { schoolId, studentId: studentB.studentId, classId: classB.id, subjectId: subject.id, termId: term.id, yearId: year.id });

  return {
    schoolId,
    classA: classA.id,
    classB: classB.id,
    subjectId: subject.id,
    termId: term.id,
    assessmentA,
    assessmentB,
    gradeA,
    gradeB,
    scheduleA,
    scheduleB,
    resultA,
    resultB,
    studentAId: studentA.studentId,
    studentBId: studentB.studentId,
    teacherAId: teacherA.teacherId,
    teacherBId: teacherB.teacherId,
    academicYearId: year.id,
    tokenStudentA: signToken({ id: studentA.userId, role: 'STUDENT', schoolId }, TEST_JWT_SECRET, 3600),
    tokenStudentB: signToken({ id: studentB.userId, role: 'STUDENT', schoolId }, TEST_JWT_SECRET, 3600),
    tokenTeacherA: signToken({ id: teacherA.userId, role: 'TEACHER', schoolId }, TEST_JWT_SECRET, 3600),
    tokenTeacherB: signToken({ id: teacherB.userId, role: 'TEACHER', schoolId }, TEST_JWT_SECRET, 3600),
    tokenCoordinator: signToken({ id: coordinator.userId, role: 'COORDINATOR', schoolId }, TEST_JWT_SECRET, 3600),
  };
}

async function createStaff(
  prisma: PrismaClient,
  schoolId: string,
  name: string,
  role: 'COORDINATOR' | 'SCHOOL_ADMIN',
): Promise<{ userId: string }> {
  const userId = randomUUID();
  await prisma.user.create({
    data: { id: userId, schoolId, role, name, email: `${userId}@bola.teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
  });
  return { userId };
}

interface TeacherFixture {
  userId: string;
  teacherId: string;
}

async function createTeacher(prisma: PrismaClient, schoolId: string, name: string): Promise<TeacherFixture> {
  const userId = randomUUID();
  await prisma.user.create({
    data: { id: userId, schoolId, role: 'TEACHER', name, email: `${userId}@bola.teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
  });
  const teacher = await prisma.teacher.create({ data: { schoolId, userId, name, email: `${userId}@bola.teste.mz`, status: 'ACTIVE' } });
  return { userId, teacherId: teacher.id };
}

interface StudentFixture {
  userId: string;
  studentId: string;
}

async function createStudent(prisma: PrismaClient, schoolId: string, name: string): Promise<StudentFixture> {
  const userId = randomUUID();
  await prisma.user.create({
    data: { id: userId, schoolId, role: 'STUDENT', name, email: `${userId}@bola.teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
  });
  const student = await prisma.student.create({
    data: { schoolId, userId, name, email: `${userId}@bola.teste.mz`, enrollmentNumber: `BOL-${userId.slice(0, 8)}`, status: 'ACTIVE' },
  });
  return { userId, studentId: student.id };
}

async function createAssessment(
  prisma: PrismaClient,
  input: { schoolId: string; classId: string; subjectId: string; termId: string; yearId: string; teacherId: string; name: string },
): Promise<string> {
  const row = await prisma.assessment.create({
    data: {
      schoolId: input.schoolId,
      classId: input.classId,
      subjectId: input.subjectId,
      termId: input.termId,
      academicYearId: input.yearId,
      teacherId: input.teacherId,
      name: input.name,
      weight: 50,
      date: new Date(),
      type: 'TEST',
      status: 'OPEN',
    },
  });
  return row.id;
}

async function createGrade(
  prisma: PrismaClient,
  input: { schoolId: string; assessmentId: string; studentId: string },
): Promise<string> {
  const row = await prisma.grade.create({
    data: {
      assessmentId: input.assessmentId,
      studentId: input.studentId,
      score: 15,
      status: 'APPROVED',
    },
  });
  return row.id;
}

async function createSchedule(
  prisma: PrismaClient,
  input: { schoolId: string; classId: string; subjectId: string; termId: string; yearId: string; teacherId: string; room: string },
): Promise<string> {
  const row = await prisma.schedule.create({
    data: {
      schoolId: input.schoolId,
      classId: input.classId,
      subjectId: input.subjectId,
      termId: input.termId,
      academicYearId: input.yearId,
      teacherId: input.teacherId,
      dayOfWeek: 'MONDAY',
      startTime: '08:00',
      endTime: '10:00',
      room: input.room,
      status: 'ACTIVE',
    },
  });
  return row.id;
}

async function createResult(
  prisma: PrismaClient,
  input: { schoolId: string; studentId: string; classId: string; subjectId: string; termId: string; yearId: string },
): Promise<string> {
  const row = await prisma.result.create({
    data: {
      schoolId: input.schoolId,
      studentId: input.studentId,
      classId: input.classId,
      subjectId: input.subjectId,
      termId: input.termId,
      academicYearId: input.yearId,
      average: 15,
      finalScore: 15,
      weightedTotal: 15,
      calculatedAt: new Date(),
      calculationMethod: 'WEIGHTED_PERCENTAGE',
      status: 'APPROVED',
    },
  });
  return row.id;
}
