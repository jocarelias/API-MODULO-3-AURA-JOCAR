import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../../app';
import { startContractServices, ContractTestContext } from './contractTestEnv';

const unique = (label: string) => `contract-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

describe('G3 Integração com contratos HTTP e regra de dívida (e2e)', () => {
  let app: ReturnType<typeof createApp>;
  let server: ReturnType<typeof app.listen>;
  let apiBase: string;
  let api: ReturnType<typeof request.agent>;
  let testContext: ContractTestContext;
  let prisma: PrismaClient;
  let ids: {
    termId: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    schoolId: string;
    assessmentId: string;
    enrolledStudentId: string;
    outsiderStudentId: string;
  };

  const created = { assessmentIds: [] as string[], studentIds: [] as string[] };

  beforeAll(async () => {
    testContext = await startContractServices();
    prisma = new PrismaClient();
    app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    apiBase = typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}` : '';
    api = request.agent(apiBase).set('authorization', `Bearer ${testContext.token}`);

    const [term, academicYear, classRecord, subject, teacher] = await Promise.all([
      prisma.term.findFirst({ where: { name: { startsWith: '1º' } } }),
      prisma.academicYear.findFirst({ where: { status: 'ACTIVE' } }),
      prisma.class.findFirst({ where: { status: 'ACTIVE' } }),
      prisma.subject.findFirst({ where: { status: 'ACTIVE' } }),
      prisma.teacher.findFirst({ where: { status: 'ACTIVE' } }),
    ]);
    if (!term || !academicYear || !classRecord || !subject || !teacher) {
      throw new Error('Dados seed insuficientes');
    }

    const cohortEnrolments = await prisma.enrollment.findMany({
      where: { classId: classRecord.id, subjectId: subject.id, termId: term.id, status: 'ACTIVE' },
    });
    const enrolledIds = new Set(cohortEnrolments.map((e) => e.studentId));
    const enrolledStudentId = cohortEnrolments[0]?.studentId;

    if (!enrolledStudentId) {
      throw new Error('Dados seed insuficientes (alunos matriculados)');
    }

    const outsider = await prisma.student.create({
      data: {
        schoolId: term.schoolId,
        name: unique('AlunoExterno'),
        email: `${unique('externo')}@student.ucjac.ac.mz`,
        enrollmentNumber: `EXT-${Date.now()}`,
        status: 'ACTIVE',
      },
    });
    created.studentIds.push(outsider.id);
    void enrolledIds;

    const createRes = await api.post('/api/v1/assessments').send({
      academicYearId: academicYear.id,
      termId: term.id,
      classId: classRecord.id,
      subjectId: subject.id,
      teacherId: teacher.id,
      name: unique('Avaliação'),
      type: 'TESTE',
      date: '2026-12-01T10:00:00.000Z',
      weight: 1,
      status: 'OPEN',
    });
    expect(createRes.status).toBe(201);
    created.assessmentIds.push(createRes.body.data.id);

    ids = {
      termId: term.id,
      academicYearId: academicYear.id,
      classId: classRecord.id,
      subjectId: subject.id,
      teacherId: teacher.id,
      schoolId: term.schoolId,
      assessmentId: createRes.body.data.id,
      enrolledStudentId,
      outsiderStudentId: outsider.id,
    };
  });

  afterAll(async () => {
    if (ids?.enrolledStudentId) {
      await prisma.financialStatus.deleteMany({ where: { studentId: ids.enrolledStudentId } });
    }
    for (const id of created.assessmentIds) {
      await prisma.assessment.delete({ where: { id } }).catch(() => {});
    }
    for (const id of created.studentIds) {
      await prisma.student.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
    await testContext.stop();
  });

  it('lancamento de nota com aluno matriculado e sem divida', async () => {
    const res = await api
      .post(`/api/v1/assessments/${ids.assessmentId}/grades`)
      .send({ studentId: ids.enrolledStudentId, score: 14 });
    expect(res.status).toBe(201);
    expect(res.body.data.studentId).toBe(ids.enrolledStudentId);
    expect(res.body.data.score).toBe(14);
    expect(typeof res.body.data.studentName).toBe('string');
  });

  it('404 — STUDENT_NOT_FOUND para aluno inexistente', async () => {
    const res = await api
      .post(`/api/v1/assessments/${ids.assessmentId}/grades`)
      .send({ studentId: '00000000-0000-0000-0000-000000000000', score: 10 });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STUDENT_NOT_FOUND');
  });

  it('400 — VALIDATION_ERROR para aluno nao matriculado na turma/disciplina', async () => {
    const res = await api
      .post(`/api/v1/assessments/${ids.assessmentId}/grades`)
      .send({ studentId: ids.outsiderStudentId, score: 12 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message.toLowerCase()).toContain('matriculado');
  });

  it('503 — FINANCIAL_VERIFICATION_UNAVAILABLE quando servico financeiro esta indisponivel (fail-closed)', async () => {
    const saved = process.env.FINANCE_SERVICE_URL;
    try {
      process.env.FINANCE_SERVICE_URL = 'http://127.0.0.1:1';
      const res = await api
        .post(`/api/v1/assessments/${ids.assessmentId}/grades`)
        .send({ studentId: ids.enrolledStudentId, score: 10 });
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('FINANCIAL_VERIFICATION_UNAVAILABLE');
    } finally {
      process.env.FINANCE_SERVICE_URL = saved;
    }
  });

  it('409 — GRADES_BLOCKED_DUE_TO_DEBT bloqueia lancamento de nota e desbloqueia apos regularizar', async () => {
    await prisma.financialStatus.upsert({
      where: { studentId: ids.enrolledStudentId },
      create: { studentId: ids.enrolledStudentId, schoolId: ids.schoolId, hasDebt: true, status: 'IN_DEBT', outstandingAmount: 15000 },
      update: { hasDebt: true, status: 'IN_DEBT', outstandingAmount: 15000 },
    });

    const blocked = await api
      .post(`/api/v1/assessments/${ids.assessmentId}/grades`)
      .send({ studentId: ids.enrolledStudentId, score: 15 });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('GRADES_BLOCKED_DUE_TO_DEBT');
    expect(Number(blocked.body.details[0]?.outstandingAmount)).toBe(15000);

    await prisma.financialStatus.update({
      where: { studentId: ids.enrolledStudentId },
      data: { hasDebt: false, status: 'REGULAR', outstandingAmount: 0 },
    });

    const existing = await prisma.grade.findUnique({
      where: { assessmentId_studentId: { assessmentId: ids.assessmentId, studentId: ids.enrolledStudentId } },
    });
    const released = await api
      .patch(`/api/v1/assessments/${ids.assessmentId}/grades/${existing?.id ?? ''}`)
      .send({ score: 12 });
    expect(released.status).toBe(200);
    expect(released.body.data.score).toBe(12);
  });

  it('POST /results exclui alunos endividados e devolve blockedByDebt', async () => {
    await prisma.financialStatus.upsert({
      where: { studentId: ids.enrolledStudentId },
      create: { studentId: ids.enrolledStudentId, schoolId: ids.schoolId, hasDebt: true, status: 'IN_DEBT', outstandingAmount: 15000 },
      update: { hasDebt: true, status: 'IN_DEBT', outstandingAmount: 15000 },
    });

    const res = await api.post('/api/v1/results').send({
      termId: ids.termId,
      classId: ids.classId,
      subjectId: ids.subjectId,
    });
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(Array.isArray(res.body.meta.blockedByDebt)).toBe(true);
    expect(res.body.meta.blockedByDebt).toContain(ids.enrolledStudentId);
    for (const row of res.body.data as { studentId: string }[]) {
      expect(row.studentId).not.toBe(ids.enrolledStudentId);
    }

    await prisma.financialStatus.update({
      where: { studentId: ids.enrolledStudentId },
      data: { hasDebt: false, status: 'REGULAR', outstandingAmount: 0 },
    });
  });

  it('pauta mascara linhas de alunos endividados', async () => {
    await prisma.financialStatus.upsert({
      where: { studentId: ids.enrolledStudentId },
      create: { studentId: ids.enrolledStudentId, schoolId: ids.schoolId, hasDebt: true, status: 'IN_DEBT', outstandingAmount: 10000 },
      update: { hasDebt: true, status: 'IN_DEBT', outstandingAmount: 10000 },
    });

    const res = await api.get(`/api/v1/print/class/${ids.classId}/pauta`).query({ termId: ids.termId, subjectId: ids.subjectId });
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toBeDefined();
    const debtorRow = res.body.data.rows.find((r: { studentId: string }) => r.studentId === ids.enrolledStudentId);
    expect(debtorRow.debtRestricted).toBe(true);
    expect(debtorRow.average).toBeNull();
    expect(debtorRow.status).toBe('RESTRICTED');
    for (const ev of debtorRow.evaluations as { score: number | null; scoreRestricted: boolean }[]) {
      expect(ev.score).toBeNull();
      expect(ev.scoreRestricted).toBe(true);
    }

    await prisma.financialStatus.update({
      where: { studentId: ids.enrolledStudentId },
      data: { hasDebt: false, status: 'REGULAR', outstandingAmount: 0 },
    });
  });
});