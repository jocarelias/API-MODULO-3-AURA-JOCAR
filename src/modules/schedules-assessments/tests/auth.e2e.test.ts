import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../../app';
import { startContractServices, ContractTestContext } from './contractTestEnv';

describe('G3 Autenticação, RBAC e scoping (e2e)', () => {
  let app: ReturnType<typeof createApp>;
  let server: ReturnType<typeof app.listen>;
  let apiBase: string;
  let api: ReturnType<typeof request.agent>;
  let testContext: ContractTestContext;
  let prisma: PrismaClient;
  let ownStudentId: string;
  let otherStudentId: string;
  let ids: { termId: string; academicYearId: string; classId: string; subjectId: string; teacherId: string; assessmentId: string };

  const login = (email: string, password: string) =>
    request(apiBase)
      .post('/api/v1/auth/login')
      .send({ email, password });

  beforeAll(async () => {
    testContext = await startContractServices();
    prisma = new PrismaClient();
    app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    apiBase = typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}` : '';
    api = request.agent(apiBase);

    const [term, academicYear, classRecord, subject, teacher, assessment] = await Promise.all([
      prisma.term.findFirst({ where: { name: { startsWith: '1º' } } }),
      prisma.academicYear.findFirst({ where: { status: 'ACTIVE' } }),
      prisma.class.findFirst({ where: { status: 'ACTIVE' } }),
      prisma.subject.findFirst({ where: { status: 'ACTIVE' } }),
      prisma.teacher.findFirst({ where: { status: 'ACTIVE' } }),
      prisma.assessment.findFirst({ where: {} }),
    ]);
    const alunos = await prisma.user.findMany({ where: { role: 'STUDENT', status: 'ACTIVE' }, orderBy: { email: 'asc' }, take: 2 });
    const studentLoginUser = await prisma.user.findFirst({ where: { email: 'aluno1@student.ucjac.ac.mz' } });
    const students = await prisma.student.findMany({
      where: { userId: { in: alunos.map((a) => a.id) }, status: 'ACTIVE' },
    });
    const first = students.find((s) => s.userId === studentLoginUser?.id);
    const rest = students.filter((s) => s.userId !== studentLoginUser?.id);
    const second = rest.find((s) => s.userId === alunos[1]?.id) ?? rest[0];
    const secondNoOwn = rest.find((s) => s.id !== first?.id);
    if (!term || !academicYear || !classRecord || !subject || !teacher || !assessment || !first || !second) {
      throw new Error('Dados seed insuficientes para os testes de autenticação');
    }

    ids = {
      termId: term.id,
      academicYearId: academicYear.id,
      classId: classRecord.id,
      subjectId: subject.id,
      teacherId: teacher.id,
      assessmentId: assessment.id,
    };
    ownStudentId = first.id;
    otherStudentId = second.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
    await testContext.stop();
  });

  it('401 — UNAUTHENTICATED sem token', async () => {
    const res = await api.get('/api/v1/assessments');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('401 — token inválido rejeitado', async () => {
    const res = await api.get('/api/v1/assessments').set('authorization', 'Bearer token-invalido');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('POST /auth/login devolve accessToken para credenciais válidas', async () => {
    const res = await login('admin@ucjac.ac.mz', 'admin123');
    expect(res.status).toBe(200);
    expect(res.body.data.tokenType).toBe('Bearer');
    expect(res.body.data.expiresIn).toBe(3600);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.role).toBe('SUPER_ADMIN');
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);

    const authed = request(apiBase).get('/api/v1/assessments').set('authorization', `Bearer ${res.body.data.accessToken}`);
    const list = await authed;
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
  });

  it('401 — credenciais incorretas', async () => {
    const res = await login('admin@ucjac.ac.mz', 'errada');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('401 — email desconhecido', async () => {
    const res = await login('nao.existe@ucjac.ac.mz', 'qualquer');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('400 — VALIDATION_ERROR em payload de login inválido', async () => {
    const res = await login('', '');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('RBAC — STUDENT não pode criar avaliações (403 FORBIDDEN)', async () => {
    const studentLogin = await login('aluno1@student.ucjac.ac.mz', 'aluno123');
    expect(studentLogin.status).toBe(200);
    const studentApi = request.agent(apiBase).set('authorization', `Bearer ${studentLogin.body.data.accessToken}`);

    const create = await studentApi.post('/api/v1/assessments').send({
      academicYearId: ids.academicYearId,
      termId: ids.termId,
      classId: ids.classId,
      subjectId: ids.subjectId,
      teacherId: ids.teacherId,
      name: 'Tentativa STUDENT',
      type: 'TESTE',
      date: '2026-12-01T10:00:00.000Z',
      weight: 1,
    });
    expect(create.status).toBe(403);
    expect(create.body.code).toBe('FORBIDDEN');

    const patch = await studentApi.patch(`/api/v1/results/00000000-0000-0000-0000-000000000000`).send({});
    expect(patch.status).toBe(403);
  });

  it('Scoping — STUDENT só vê resultados próprios', async () => {
    const studentLogin = await login('aluno1@student.ucjac.ac.mz', 'aluno123');
    const studentApi = request.agent(apiBase).set('authorization', `Bearer ${studentLogin.body.data.accessToken}`);

    const res = await studentApi.get('/api/v1/results');
    expect(res.status).toBe(200);
    const rows = res.body.data as { studentId: string }[];
    for (const row of rows) {
      expect(row.studentId).toBe(ownStudentId);
    }
  });

  it('Scoping — STUDENT bloqueado para resultados de terceiros (403)', async () => {
    const studentLogin = await login('aluno1@student.ucjac.ac.mz', 'aluno123');
    const studentApi = request.agent(apiBase).set('authorization', `Bearer ${studentLogin.body.data.accessToken}`);

    const mine = await prisma.result.findFirst({ where: { studentId: ownStudentId } });
    const theirs = await prisma.result.findFirst({ where: { studentId: otherStudentId } });

    if (theirs) {
      const list = await studentApi.get('/api/v1/results').query({ studentId: otherStudentId });
      expect(list.status).toBe(403);
      expect(list.body.code).toBe('FORBIDDEN');
    }

    if (mine) {
      const own = await studentApi.get(`/api/v1/results/${mine.id}`);
      expect(own.status).toBe(200);
      expect(own.body.data.studentId).toBe(ownStudentId);
    }

    if (theirs) {
      const hidden = await studentApi.get(`/api/v1/results/${theirs.id}`);
      expect(hidden.status).toBe(403);
      expect(hidden.body.code).toBe('FORBIDDEN');
    }
  });

  it('Scoping — STUDENT vê apenas os seus relatórios de notas', async () => {
    const studentLogin = await login('aluno1@student.ucjac.ac.mz', 'aluno123');
    const studentApi = request.agent(apiBase).set('authorization', `Bearer ${studentLogin.body.data.accessToken}`);

    const res = await studentApi.get(`/api/v1/assessments/${ids.assessmentId}/grades`);
    expect(res.status).toBe(200);
    const rows = res.body.data as { studentId: string }[];
    for (const row of rows) {
      expect(row.studentId).toBe(ownStudentId);
    }
  });
});