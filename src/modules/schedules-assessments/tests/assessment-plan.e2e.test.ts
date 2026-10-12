import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { signToken } from '@smartcampus/auth';
import { createApp } from '../../../app';
import { startContractServices, ContractTestContext, TEST_JWT_SECRET } from './contractTestEnv';

const unique = (label: string) => `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function planBody(
  fixtures: ContractTestContext['fixtures'],
  teacherId: string,
  tag: string,
): { academicYearId: string; termId: string; classId: string; subjectId: string; teacherId: string; assessments: { name: string; type: string; date: string; weight: number }[] } {
  return {
    academicYearId: fixtures.academicYearId,
    termId: fixtures.termId,
    classId: fixtures.classId,
    subjectId: fixtures.subjectId,
    teacherId,
    assessments: [
      { name: `${tag} Teste 1`, type: 'TESTE', date: '2026-03-10T09:00:00.000Z', weight: 40 },
      { name: `${tag} Teste 2`, type: 'TESTE', date: '2026-04-10T09:00:00.000Z', weight: 40 },
      { name: `${tag} Trabalho`, type: 'TRABALHO', date: '2026-05-10T09:00:00.000Z', weight: 20 },
    ],
  };
}

describe('G3 Plano de avaliações — o docente define nomes, tipos e pesos (e2e)', () => {
  let testContext: ContractTestContext;
  let prisma: PrismaClient;
  let app: ReturnType<typeof createApp>;
  let server: ReturnType<typeof app.listen>;
  let apiBase: string;

  const createdAssessmentIds: string[] = [];
  let tokenTeacher = '';
  let tokenStudent = '';

  beforeAll(async () => {
    testContext = await startContractServices();
    prisma = new PrismaClient();
    app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    apiBase = typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}` : '';

    const fx = testContext.fixtures;
    const teacherUser = await prisma.user.create({
      data: { id: randomUUID(), schoolId: fx.schoolId, role: 'TEACHER', name: 'Docente Plano', email: `${unique('doc')}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    await prisma.teacher.update({ where: { id: fx.teacherId }, data: { userId: teacherUser.id } });
    tokenTeacher = signToken({ id: teacherUser.id, role: 'TEACHER', schoolId: fx.schoolId }, TEST_JWT_SECRET, 3600);

    const studentUser = await prisma.user.create({
      data: { id: randomUUID(), schoolId: fx.schoolId, role: 'STUDENT', name: 'Aluno Plano', email: `${unique('aluno')}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    tokenStudent = signToken({ id: studentUser.id, role: 'STUDENT', schoolId: fx.schoolId }, TEST_JWT_SECRET, 3600);
  });

  afterAll(async () => {
    if (createdAssessmentIds.length > 0) {
      await prisma.assessment.deleteMany({ where: { id: { in: createdAssessmentIds } } });
    }
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
    await testContext.stop();
  });

  const api = () => request(apiBase);

  it('ADMIN cria o plano com nomes e pesos definidos → 201 e devolve as avaliações', async () => {
    const tag = unique('PlanoAdmin');
    const res = await api()
      .post('/api/v1/assessments/plan')
      .set('authorization', `Bearer ${testContext.token}`)
      .send(planBody(testContext.fixtures, testContext.fixtures.teacherId, tag));

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(3);
    for (const row of res.body.data) createdAssessmentIds.push(row.id);
    const byName = new Map(
      (res.body.data as { name: string; type: string; weight: number }[]).map((r) => [r.name, r]),
    );
    expect(byName.get(`${tag} Teste 1`)).toMatchObject({ type: 'TESTE', weight: 40 });
    expect(byName.get(`${tag} Teste 2`)).toMatchObject({ type: 'TESTE', weight: 40 });
    expect(byName.get(`${tag} Trabalho`)).toMatchObject({ type: 'TRABALHO', weight: 20 });
  });

  it('TEACHER cria o plano para a sua própria docência → 201', async () => {
    const tag = unique('PlanoDocente');
    const res = await api()
      .post('/api/v1/assessments/plan')
      .set('authorization', `Bearer ${tokenTeacher}`)
      .send(planBody(testContext.fixtures, testContext.fixtures.teacherId, tag));

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(3);
    for (const row of res.body.data) createdAssessmentIds.push(row.id);
  });

  it('plano com nomes duplicados → 400 VALIDATION_ERROR', async () => {
    const tag = unique('DuplicadoInterno');
    const body = planBody(testContext.fixtures, testContext.fixtures.teacherId, tag);
    body.assessments = [body.assessments[0], { ...body.assessments[1], name: body.assessments[0].name }];
    const res = await api()
      .post('/api/v1/assessments/plan')
      .set('authorization', `Bearer ${testContext.token}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('nome já existente no mesmo período/turma/disciplina → 409 CONFLICT', async () => {
    const tag = unique('Duplicado');
    const first = await api()
      .post('/api/v1/assessments/plan')
      .set('authorization', `Bearer ${testContext.token}`)
      .send(planBody(testContext.fixtures, testContext.fixtures.teacherId, tag));
    expect(first.status).toBe(201);
    for (const row of first.body.data) createdAssessmentIds.push(row.id);

    const second = await api()
      .post('/api/v1/assessments/plan')
      .set('authorization', `Bearer ${testContext.token}`)
      .send(planBody(testContext.fixtures, testContext.fixtures.teacherId, tag));
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('CONFLICT');
  });

  it('peso inválido (0) → 400 VALIDATION_ERROR', async () => {
    const body = planBody(testContext.fixtures, testContext.fixtures.teacherId, unique('Peso'));
    body.assessments[0].weight = 0;
    const res = await api()
      .post('/api/v1/assessments/plan')
      .set('authorization', `Bearer ${testContext.token}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('tipo de avaliação inválido → 400 VALIDATION_ERROR', async () => {
    const body = planBody(testContext.fixtures, testContext.fixtures.teacherId, unique('Tipo'));
    body.assessments[0].type = 'PROVA_REAL';
    const res = await api()
      .post('/api/v1/assessments/plan')
      .set('authorization', `Bearer ${testContext.token}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('plano vazio → 400 VALIDATION_ERROR', async () => {
    const body = { ...planBody(testContext.fixtures, testContext.fixtures.teacherId, unique('Vazio')), assessments: [] };
    const res = await api()
      .post('/api/v1/assessments/plan')
      .set('authorization', `Bearer ${testContext.token}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('estudante não pode criar o plano → 403 FORBIDDEN', async () => {
    const body = planBody(testContext.fixtures, testContext.fixtures.teacherId, unique('Aluno'));
    const res = await api()
      .post('/api/v1/assessments/plan')
      .set('authorization', `Bearer ${tokenStudent}`)
      .send(body);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});
