import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { signToken } from '@smartcampus/auth';
import { createApp } from '../../../app';
import { startContractServices, ContractTestContext, TEST_JWT_SECRET } from './contractTestEnv';

const unique = (label: string) => `fin-access-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

describe('G3 Regra financeira — consulta de notas bloqueada para estudantes com dívida (e2e)', () => {
  let app: ReturnType<typeof createApp>;
  let server: ReturnType<typeof app.listen>;
  let apiBase: string;
  let testContext: ContractTestContext;
  let prisma: PrismaClient;

  let activeToken = '';
  let blockedToken = '';
  let staffToken = '';
  let ghostToken = '';
  let blocked: { id: string };
  let active: { id: string };
  let ghostUser: { id: string };
  let schoolId = '';
  let ids: {
    academicYearId: string;
    termId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    assessmentId: string;
  };

  const tokenFor = (userId: string, role: string, sId: string): string => signToken({ id: userId, role, schoolId: sId }, TEST_JWT_SECRET, 3600);

  beforeAll(async () => {
    testContext = await startContractServices();
    prisma = new PrismaClient();
    app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    apiBase = typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}` : '';

    const school = await prisma.school.create({
      data: { name: unique('Escola'), code: unique('COD').replace(/-/g, '').slice(0, 12), status: 'ACTIVE' },
    });
    schoolId = school.id;
    const academicYear = await prisma.academicYear.create({
      data: { schoolId, name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'ACTIVE' },
    });
    const term = await prisma.term.create({
      data: { schoolId, academicYearId: academicYear.id, name: '1º Semestre', startDate: new Date('2026-02-01'), endDate: new Date('2026-06-30'), status: 'ACTIVE' },
    });
    const classRecord = await prisma.class.create({
      data: { schoolId, academicYearId: academicYear.id, name: '11A', grade: '11', status: 'ACTIVE' },
    });
    const subject = await prisma.subject.create({
      data: { schoolId, name: unique('Matemática'), code: 'MAT', status: 'ACTIVE' },
    });
    const teacher = await prisma.teacher.create({
      data: { schoolId, name: unique('Professor'), status: 'ACTIVE' },
    });

    const activeUser = await prisma.user.create({
      data: { schoolId, role: 'STUDENT', name: 'Aluno Regular', email: unique('regular') + '@teste.mz', passwordHash: 'x', status: 'ACTIVE' },
    });
    const blockedUser = await prisma.user.create({
      data: { schoolId, role: 'STUDENT', name: 'Aluno Endividado', email: unique('blocked') + '@teste.mz', passwordHash: 'x', status: 'ACTIVE' },
    });
    ghostUser = await prisma.user.create({
      data: { schoolId, role: 'STUDENT', name: 'Aluno Sem Perfil', email: unique('ghost') + '@teste.mz', passwordHash: 'x', status: 'ACTIVE' },
    });
    const staffUser = await prisma.user.create({
      data: { schoolId, role: 'SCHOOL_ADMIN', name: 'Admin Fin Access', email: unique('staff') + '@teste.mz', passwordHash: 'x', status: 'ACTIVE' },
    });

    active = await prisma.student.create({
      data: { schoolId, userId: activeUser.id, name: 'Aluno Regular', email: activeUser.email, enrollmentNumber: `REG-${randomUUID().slice(0, 8)}`, status: 'ACTIVE' },
    });
    blocked = await prisma.student.create({
      data: { schoolId, userId: blockedUser.id, name: 'Aluno Endividado', email: blockedUser.email, enrollmentNumber: `DEB-${randomUUID().slice(0, 8)}`, status: 'ACTIVE' },
    });

    await prisma.financialStatus.create({
      data: { schoolId, studentId: active.id, hasDebt: false, status: 'REGULAR', outstandingAmount: 0 },
    });
    await prisma.financialStatus.create({
      data: { schoolId, studentId: blocked.id, hasDebt: true, status: 'IN_DEBT', outstandingAmount: 99999 },
    });

    await prisma.enrollment.createMany({
      data: [active.id, blocked.id].map((studentId) => ({
        schoolId,
        academicYearId: academicYear.id,
        termId: term.id,
        classId: classRecord.id,
        subjectId: subject.id,
        studentId,
        status: 'ACTIVE',
      })),
    });

    const assessment = await prisma.assessment.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        termId: term.id,
        classId: classRecord.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        name: unique('Avaliação'),
        type: 'TEST',
        date: new Date('2026-03-01T10:00:00Z'),
        status: 'OPEN',
      },
    });

    await prisma.grade.create({
      data: { assessmentId: assessment.id, studentId: active.id, score: 15, status: 'SUBMITTED' },
    });
    await prisma.grade.create({
      data: { assessmentId: assessment.id, studentId: blocked.id, score: 17, status: 'SUBMITTED' },
    });

    await prisma.result.create({
      data: { schoolId, academicYearId: academicYear.id, termId: term.id, classId: classRecord.id, subjectId: subject.id, studentId: active.id, average: 15, finalScore: 15, calculationMethod: 'WEIGHTED_PERCENTAGE', status: 'APPROVED', calculatedAt: new Date() },
    });
    await prisma.result.create({
      data: { schoolId, academicYearId: academicYear.id, termId: term.id, classId: classRecord.id, subjectId: subject.id, studentId: blocked.id, average: 17, finalScore: 17, calculationMethod: 'WEIGHTED_PERCENTAGE', status: 'APPROVED', calculatedAt: new Date() },
    });

    ids = {
      academicYearId: academicYear.id,
      termId: term.id,
      classId: classRecord.id,
      subjectId: subject.id,
      teacherId: teacher.id,
      assessmentId: assessment.id,
    };

    activeToken = tokenFor(activeUser.id, 'STUDENT', schoolId);
    blockedToken = tokenFor(blockedUser.id, 'STUDENT', schoolId);
    ghostToken = tokenFor(ghostUser.id, 'STUDENT', schoolId);
    staffToken = tokenFor(staffUser.id, 'SCHOOL_ADMIN', schoolId);
  });

  afterAll(async () => {
    if (schoolId) {
      await prisma.result.deleteMany({ where: { schoolId } });
      await prisma.grade.deleteMany({ where: { assessment: { schoolId } } });
      await prisma.assessment.deleteMany({ where: { schoolId } });
      await prisma.enrollment.deleteMany({ where: { schoolId } });
      await prisma.financialStatus.deleteMany({ where: { schoolId } });
      await prisma.student.deleteMany({ where: { schoolId } });
      await prisma.user.deleteMany({ where: { schoolId } });
      await prisma.teacher.deleteMany({ where: { schoolId } });
      await prisma.subject.deleteMany({ where: { schoolId } });
      await prisma.class.deleteMany({ where: { schoolId } });
      await prisma.term.deleteMany({ where: { schoolId } });
      await prisma.academicYear.deleteMany({ where: { schoolId } });
      await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
    }
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
    await testContext.stop();
  });

  const authGet = (token: string, path: string) =>
    request(apiBase).get(path).set('authorization', `Bearer ${token}`).set('x-correlation-id', 'fin-access-e2e');

  it('TESTE 1 — estudante ACTIVE consulta os seus resultados com notas (200)', async () => {
    const res = await authGet(activeToken, '/api/v1/results');
    expect(res.status).toBe(200);
    const rows = res.body.data as { studentId: string; average: number | null }[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.studentId).toBe(active.id);
      expect(typeof row.average).toBe('number');
    }
  });

  it('TESTE 2 — estudante BLOCKED recebe 403 FINANCIAL_ACCESS_BLOCKED e NENHUMA nota vaza', async () => {
    const res = await authGet(blockedToken, '/api/v1/results');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FINANCIAL_ACCESS_BLOCKED');
    expect(res.body.message).toContain('Regularize a sua situação financeira');
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('APPROVED');
    expect(raw).not.toContain('average');
    expect(raw).not.toContain(blocked.id);
  });

  it('TESTE 2.1 — BLOCKED não vê o resultado individual (403)', async () => {
    const mine = await prisma.result.findFirst({ where: { studentId: blocked.id } });
    const res = await authGet(blockedToken, `/api/v1/results/${mine?.id ?? ''}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FINANCIAL_ACCESS_BLOCKED');
  });

  it('TESTE 3 — BLOCKED não acede às notas das avaliações (403)', async () => {
    const res = await authGet(blockedToken, `/api/v1/assessments/${ids.assessmentId}/grades`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FINANCIAL_ACCESS_BLOCKED');
  });

  it('TESTE 4 — BLOCKED não acede à pauta/exportação (403)', async () => {
    const res = await authGet(blockedToken, `/api/v1/print/class/${ids.classId}/pauta`)
      .query({ termId: ids.termId, subjectId: ids.subjectId });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FINANCIAL_ACCESS_BLOCKED');
  });

  it('TESTE 5 — financeiro indisponível falha fechado: 503 FINANCIAL_VERIFICATION_UNAVAILABLE', async () => {
    const saved = process.env.FINANCE_SERVICE_URL;
    try {
      process.env.FINANCE_SERVICE_URL = 'http://127.0.0.1:1';
      const res = await authGet(activeToken, '/api/v1/results');
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('FINANCIAL_VERIFICATION_UNAVAILABLE');
    } finally {
      process.env.FINANCE_SERVICE_URL = saved;
    }
  });

  it('TESTE 6 — sem token ou token inválido → 401 UNAUTHENTICATED', async () => {
    const missing = await request(apiBase).get('/api/v1/results').set('x-correlation-id', 'fin-access-e2e');
    expect(missing.status).toBe(401);
    expect(missing.body.code).toBe('UNAUTHENTICATED');
    const invalid = await request(apiBase)
      .get('/api/v1/results')
      .set('authorization', 'Bearer abc.def.ghi')
      .set('x-correlation-id', 'fin-access-e2e');
    expect(invalid.status).toBe(401);
    expect(invalid.body.code).toBe('UNAUTHENTICATED');
  });

  it('TESTE 7 — estudante sem perfil académico → 404 STUDENT_NOT_FOUND', async () => {
    const res = await authGet(ghostToken, '/api/v1/results');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STUDENT_NOT_FOUND');
  });

  it('TESTE 8 — frontend reflete estado via /me/financial-status (ACTIVE) sem expor valores', async () => {
    const res = await authGet(activeToken, '/api/v1/me/financial-status');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
    expect('outstandingAmount' in res.body.data).toBe(false);
    expect(JSON.stringify(res.body).search(/amount|valor/gi)).toBe(-1);
  });

  it('TESTE 9 — frontend reflete estado via /me/financial-status (BLOCKED) sem expor a dívida', async () => {
    const res = await authGet(blockedToken, '/api/v1/me/financial-status');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('BLOCKED');
    expect('outstandingAmount' in res.body.data).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('99999');
  });

  it('TESTE 10 — staff continua acessível: pauta mascara a linha do endividado', async () => {
    const res = await authGet(staffToken, `/api/v1/print/class/${ids.classId}/pauta`)
      .query({ termId: ids.termId, subjectId: ids.subjectId });
    expect(res.status).toBe(200);
    const rows = res.body.data.rows as { studentId: string; debtRestricted?: boolean; average: number | null }[];
    const regular = rows.find((r) => r.studentId === active.id);
    const debtor = rows.find((r) => r.studentId === blocked.id);
    expect(regular?.average).toBe(15);
    expect(debtor?.debtRestricted).toBe(true);
    expect(debtor?.average).toBeNull();
  });

  it('TESTE 27 — tentativa direta (curl) de BLOCKED não devolve notas em formato algum', async () => {
    const direct = await authGet(blockedToken, `/api/v1/results`);
    expect(direct.status).toBe(403);
    const raw = JSON.stringify(direct.body);
    expect(raw).not.toMatch(/\b15(\.0+)?\b/);
    expect(raw).not.toMatch(/\b17(\.0+)?\b/);
  });

  it('correlationId é propagating através do pedido', async () => {
    const correlationId = randomUUID();
    const res = await request(apiBase)
      .get('/api/v1/results')
      .set('authorization', `Bearer ${activeToken}`)
      .set('x-correlation-id', correlationId)
      .set('x-request-id', correlationId);
    expect(res.status).toBe(200);
    expect(res.body.meta.correlationId).toBe(correlationId);
  });
});