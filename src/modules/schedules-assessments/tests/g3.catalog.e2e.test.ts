import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../../app';
import { startContractServices, ContractTestContext } from './contractTestEnv';

describe('G3 Catálogo e nomes legíveis (e2e) — API autenticada + contratos', () => {
  let app: ReturnType<typeof createApp>;
  let server: ReturnType<typeof app.listen>;
  let apiBase: string;
  let api: ReturnType<typeof request.agent>;
  let testContext: ContractTestContext;
  let ids: {
    termId: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    studentId: string;
    scheduleId: string;
    assessmentWithGradesId: string;
    resultId: string | null;
    catalog: {
      academicYearId: string;
      termId: string;
      classId: string;
      subjectId: string;
      foreignClassId: string;
    };
  };

  const prisma = new PrismaClient();
  let seedSchoolId = '';
  let seedForeignYearId = '';

  beforeAll(async () => {
    testContext = await startContractServices();
    app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    apiBase = typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}` : '';
    api = request.agent(apiBase).set('authorization', `Bearer ${testContext.token}`);

    const term = await prisma.term.findFirst({ where: { name: { startsWith: '1º' } } });
    const academicYear = await prisma.academicYear.findFirst({ where: { status: 'ACTIVE' } });
    const classRecord = await prisma.class.findFirst({ where: { status: 'ACTIVE' } });
    const subject = await prisma.subject.findFirst({ where: { status: 'ACTIVE' } });
    const teacher = await prisma.teacher.findFirst({ where: { status: 'ACTIVE' } });
    const schedule = await prisma.schedule.findFirst({ where: { status: 'ACTIVE' } });
    const enrollment = await prisma.enrollment.findFirst({ where: { status: 'ACTIVE' } });
    const assessmentWithGrades = await prisma.assessment.findFirst({
      where: { grades: { some: {} } },
      orderBy: { date: 'asc' },
    });
    const result = await prisma.result.findFirst({ orderBy: { updatedAt: 'asc' } });

    const resolved = await Promise.all([
      term,
      academicYear,
      classRecord,
      subject,
      teacher,
      schedule,
      enrollment,
      assessmentWithGrades,
    ]);

    seedSchoolId = resolved[0].schoolId;
    seedForeignYearId = resolved[1].id;
    ids = {
      termId: resolved[0].id,
      academicYearId: resolved[1].id,
      classId: resolved[2].id,
      subjectId: resolved[3].id,
      teacherId: resolved[4].id,
      scheduleId: resolved[5].id,
      studentId: resolved[6].studentId,
      assessmentWithGradesId: resolved[7].id,
      resultId: result?.id ?? null,
      catalog: await seedCatalogFixtures(prisma, testContext.schoolId, seedSchoolId),
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
    await testContext.stop();
  });

  it('catálogo de escolas: GET /api/v1/schools lista com nome', async () => {
    const res = await api.get('/api/v1/schools');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0].name).toBeTruthy();
    expect(res.body.data[0].code).toBeTruthy();
    expect(res.body.meta).toHaveProperty('page');
    expect(res.body.meta).toHaveProperty('total');
  });

  it('catálogo de anos letivos: GET /api/v1/academic-years lista com nome', async () => {
    const res = await api.get('/api/v1/academic-years');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toBeTruthy();
  });

  it('catálogo de períodos: GET /api/v1/terms lista com nome e datas', async () => {
    const res = await api.get('/api/v1/terms');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toBeTruthy();
    expect(res.body.data[0]).toHaveProperty('startDate');
    expect(res.body.data[0]).toHaveProperty('endDate');
  });

  it('catálogo de turmas: GET /api/v1/classes lista com nome', async () => {
    const res = await api.get('/api/v1/classes');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toBeTruthy();
  });

  it('catálogo de turmas filtrado por termId: GET /api/v1/classes?termId=...', async () => {
    const res = await api.get('/api/v1/classes').query({ termId: ids.catalog.termId });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('name');
  });

  it('catálogo de disciplinas: GET /api/v1/subjects lista com nome', async () => {
    const res = await api.get('/api/v1/subjects');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toBeTruthy();
  });

  it('catálogo de professores: GET /api/v1/teachers lista com nome', async () => {
    const res = await api.get('/api/v1/teachers');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toBeTruthy();
  });

  it('catálogo de alunos: GET /api/v1/students lista com nome e número de matrícula', async () => {
    const res = await api.get('/api/v1/students');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toBeTruthy();
    expect(res.body.data[0]).toHaveProperty('enrollmentNumber');
  });

  it('catálogo de alunos filtrado por turma: GET /api/v1/students?classId=...', async () => {
    const res = await api.get('/api/v1/students').query({ classId: ids.classId });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((s: { id: string }) => s.id)).toBe(true);
  });

  it('GET /api/v1/assessments/:id devolve nomes legíveis (className, subjectName, teacherName, termName)', async () => {
    const res = await api.get(`/api/v1/assessments/${ids.assessmentWithGradesId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.className).toBeTruthy();
    expect(res.body.data.subjectName).toBeTruthy();
    expect(res.body.data.teacherName).toBeTruthy();
    expect(res.body.data.termName).toBeTruthy();
    expect(res.body.data.academicYearName).toBeTruthy();
  });

  it('GET /api/v1/assessments lista com nomes legíveis', async () => {
    const res = await api.get('/api/v1/assessments').query({ pageSize: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const item of res.body.data) {
      expect(item).toHaveProperty('className');
      expect(item).toHaveProperty('subjectName');
      expect(item).toHaveProperty('teacherName');
    }
  });

  it('GET /api/v1/assessments/:id/grades devolve studentName e assessmentName', async () => {
    const res = await api.get(`/api/v1/assessments/${ids.assessmentWithGradesId}/grades`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].studentName).toBeTruthy();
    expect(res.body.data[0].assessmentName).toBeTruthy();
  });

  it('GET /api/v1/schedules/:id devolve className, subjectName, teacherName e termName', async () => {
    const res = await api.get(`/api/v1/schedules/${ids.scheduleId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.className).toBeTruthy();
    expect(res.body.data.subjectName).toBeTruthy();
    expect(res.body.data.teacherName).toBeTruthy();
    expect(res.body.data.termName).toBeTruthy();
  });

  it('GET /api/v1/results devolve studentName, className, subjectName e termName', async () => {
    if (!ids.resultId) {
      return;
    }
    const res = await api.get(`/api/v1/results/${ids.resultId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.studentName).toBeTruthy();
    expect(res.body.data.className).toBeTruthy();
    expect(res.body.data.subjectName).toBeTruthy();
    expect(res.body.data.termName).toBeTruthy();
  });

  it('isolamento multi-escolar: SCHOOL_ADMIN não vê turmas de outra escola', async () => {
    const res = await api.get('/api/v1/classes').query({ pageSize: 100 });
    expect(res.status).toBe(200);
    const returned = res.body.data as Array<{ id: string; name: string }>;
    expect(returned.some((item) => item.id === ids.catalog.classId)).toBe(true);
    expect(returned.some((item) => item.id === ids.catalog.foreignClassId)).toBe(false);
  });

  it('isolamento multi-escolar: subjects e academic-years também são filtrados por escola', async () => {
    const subjects = await api.get('/api/v1/subjects').query({ pageSize: 100 });
    const years = await api.get('/api/v1/academic-years').query({ pageSize: 100 });
    expect(subjects.status).toBe(200);
    expect(years.status).toBe(200);
    expect((subjects.body.data as Array<{ id: string }>).some((s) => s.id === ids.catalog.subjectId)).toBe(true);
    expect((years.body.data as Array<{ id: string }>).some((y) => y.id === ids.catalog.academicYearId)).toBe(true);
    expect((years.body.data as Array<{ id: string }>).every((y) => y.id !== seedForeignYearId)).toBe(true);
  });

  it('catálogo usa paginação: /api/v1/classes?page=1&pageSize=2', async () => {
    const res = await api.get('/api/v1/classes').query({ page: 1, pageSize: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.pageSize).toBe(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

async function seedCatalogFixtures(
  prisma: PrismaClient,
  schoolId: string,
  foreignSchoolId: string,
): Promise<G3CatalogTestState['ids']['catalog']> {
  const now = new Date();
  const year = await prisma.academicYear.create({
    data: { schoolId, name: `Ano ${schoolId.slice(0, 4)}`, startDate: now, endDate: new Date(now.getFullYear() + 1, 0, 1) },
  });
  const term = await prisma.term.create({
    data: {
      schoolId,
      academicYearId: year.id,
      name: `1º Período ${schoolId.slice(0, 4)}`,
      startDate: now,
      endDate: new Date(now.getFullYear(), 11, 31),
    },
  });
  const classRecord = await prisma.class.create({
    data: { schoolId, academicYearId: year.id, name: `Turma ${schoolId.slice(0, 4)}`, grade: '1', shift: 'Manhã', room: 'Sala 1' },
  });
  const subject = await prisma.subject.create({
    data: { schoolId, name: `Disciplina ${schoolId.slice(0, 4)}`, code: `SUB${schoolId.slice(0, 4)}` },
  });

  const foreignYear = await prisma.academicYear.findFirst({ where: { schoolId: foreignSchoolId } });
  const foreignClass =
    foreignYear &&
    (await prisma.class.create({
      data: {
        schoolId: foreignSchoolId,
        academicYearId: foreignYear.id,
        name: `Turma Estrangeira ${schoolId.slice(0, 4)}`,
        grade: '9',
      },
    }));

  return {
    academicYearId: year.id,
    termId: term.id,
    classId: classRecord.id,
    subjectId: subject.id,
    foreignClassId: foreignClass?.id ?? '',
  };
}

});
