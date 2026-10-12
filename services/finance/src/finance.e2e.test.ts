import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { signToken } from '@smartcampus/auth';
import { createApp } from './app';

const SECRET = 'e2e-secret-finance';
process.env.SMARTCAMPUS_JWT_SECRET = SECRET;
process.env.JWT_ACCESS_SECRET = SECRET;
process.env.FINANCE_SERVICE_PORT = '4104';
const SERVICE_TOKEN = 'fin-service-e2e-token';
process.env.SMARTCAMPUS_SERVICE_TOKEN = SERVICE_TOKEN;

const prisma = new PrismaClient();
const app = createApp();

let schoolId = '';
let adminUserId = '';
let debtorStudentId = '';
let regularStudentId = '';

function tokenFor(userId: string, role: string): string {
  return signToken({ id: userId, role, schoolId }, SECRET, 3600);
}

describe('services/finance — contrato de Situação Financeira', () => {
  beforeAll(async () => {
    schoolId = randomUUID();
    await prisma.school.create({ data: { id: schoolId, name: 'Escola Teste Finance', code: 'ETF', status: 'ACTIVE' } });
    adminUserId = randomUUID();
    await prisma.user.create({
      data: { id: adminUserId, schoolId, role: 'SCHOOL_ADMIN', name: 'Admin Finance', email: `admin.${schoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    debtorStudentId = randomUUID();
    await prisma.student.create({
      data: { id: debtorStudentId, schoolId, userId: null, name: 'Aluno Com Dívida', email: `divida.${schoolId}@teste.mz`, enrollmentNumber: `DEBT-${schoolId.slice(0, 4)}`, status: 'ACTIVE' },
    });
    await prisma.financialStatus.create({
      data: {
        id: randomUUID(),
        schoolId,
        studentId: debtorStudentId,
        hasDebt: true,
        status: 'IN_DEBT',
        outstandingAmount: 17500,
      },
    });
    regularStudentId = randomUUID();
    await prisma.student.create({
      data: { id: regularStudentId, schoolId, userId: null, name: 'Aluno Sem Dívida', email: `regular.${schoolId}@teste.mz`, enrollmentNumber: `REG-${schoolId.slice(0, 4)}`, status: 'ACTIVE' },
    });
  });

  afterAll(async () => {
    await prisma.financialStatus.deleteMany({ where: { schoolId } });
    await prisma.student.deleteMany({ where: { schoolId } });
    await prisma.user.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.$disconnect();
  });

  it('health responde ok', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('sem token → 401 UNAUTHENTICATED (Token em falta)', async () => {
    const res = await request(app).get(`/api/v1/financial-status/${debtorStudentId}`).expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    expect(res.body.message).toContain('Token em falta');
  });

  it('token inválido → 401 UNAUTHENTICATED', async () => {
    const res = await request(app)
      .get(`/api/v1/financial-status/${debtorStudentId}`)
      .set('authorization', 'Bearer abc.def.ghi')
      .expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('estudante desconhecido → 404 STUDENT_NOT_FOUND', async () => {
    const res = await request(app)
      .get(`/api/v1/financial-status/${randomUUID()}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(404);
    expect(res.body.code).toBe('STUDENT_NOT_FOUND');
  });

  it('estudante com dívida → 200 IN_DEBT com valor em dívida', async () => {
    const res = await request(app)
      .get(`/api/v1/financial-status/${debtorStudentId}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    expect(res.body.data.studentId).toBe(debtorStudentId);
    expect(res.body.data.schoolId).toBe(schoolId);
    expect(res.body.data.hasDebt).toBe(true);
    expect(res.body.data.status).toBe('IN_DEBT');
    expect(res.body.data.outstandingAmount).toBe(17500);
    expect(typeof res.body.data.updatedAt).toBe('string');
  });

  it('estudante sem registo financeiro → 200 REGULAR sem dívida', async () => {
    const res = await request(app)
      .get(`/api/v1/financial-status/${regularStudentId}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    expect(res.body.data.studentId).toBe(regularStudentId);
    expect(res.body.data.schoolId).toBe(schoolId);
    expect(res.body.data.hasDebt).toBe(false);
    expect(res.body.data.status).toBe('REGULAR');
    expect(res.body.data.outstandingAmount).toBe(0);
    expect(res.body.data.updatedAt).toBeNull();
  });

  it('estudante com dívida responde para qualquer papel autenticado (STUDENT)', async () => {
    const res = await request(app)
      .get(`/api/v1/financial-status/${debtorStudentId}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'STUDENT')}`)
      .expect(200);
    expect(res.body.data.hasDebt).toBe(true);
  });

  it('estudante sem registo devolve contrato com atualizado null para TEACHER autenticado', async () => {
    const res = await request(app)
      .get(`/api/v1/financial-status/${regularStudentId}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'TEACHER')}`)
      .expect(200);
    expect(res.body.data.hasDebt).toBe(false);
    expect(res.body.data.status).toBe('REGULAR');
    expect(res.body.data.updatedAt).toBeNull();
  });

  it('identificador de estudante malformado → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/api/v1/financial-status/nao-e-uuid')
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('resposta ecoa o x-request-id como correlationId', async () => {
    const correlationId = randomUUID();
    const res = await request(app)
      .get(`/api/v1/financial-status/${debtorStudentId}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .set('x-request-id', correlationId)
      .expect(200);
    expect(res.headers['x-request-id']).toBe(correlationId);
    expect(res.body.meta.correlationId).toBe(correlationId);
  });
});

describe('services/finance — contrato idempotente de cobranças de avaliação', () => {
  let chargesSchoolId = '';
  let chargesAdminId = '';
  let chargeStudentUserId = '';
  let chargeStudentId = '';

  beforeAll(async () => {
    chargesSchoolId = randomUUID();
    await prisma.school.create({ data: { id: chargesSchoolId, name: 'Escola Cobranças', code: `CHG${chargesSchoolId.slice(0, 6)}`, status: 'ACTIVE' } });
    const admin = await prisma.user.create({
      data: { id: randomUUID(), schoolId: chargesSchoolId, role: 'SCHOOL_ADMIN', name: 'Admin Cobranças', email: `chargeadmin.${chargesSchoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    chargesAdminId = admin.id;
    const chargeUser = await prisma.user.create({
      data: { schoolId: chargesSchoolId, role: 'STUDENT', name: 'Aluno Cobrança', email: `charge.${chargesSchoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    chargeStudentUserId = chargeUser.id;
    const student = await prisma.student.create({
      data: { schoolId: chargesSchoolId, userId: chargeUser.id, name: 'Aluno Cobrança', email: chargeUser.email, enrollmentNumber: `CHG-${chargesSchoolId.slice(0, 4)}`, status: 'ACTIVE' },
    });
    chargeStudentId = student.id;
  });

  afterAll(async () => {
    await prisma.student.deleteMany({ where: { id: chargeStudentId } });
    await prisma.user.deleteMany({ where: { schoolId: chargesSchoolId } });
    await prisma.school.delete({ where: { id: chargesSchoolId } }).catch(() => {});
  });

  it('401 sem token', async () => {
    const res = await request(app)
      .post('/api/v1/financial/integration/assessment-charges')
      .send({ sourceModule: 'G3', sourceRequestId: 'x', studentUserId: chargeStudentUserId, feeCode: 'ASSESSMENT-TAKE' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('pedido repetido com a mesma chave de idempotência devolve o mesmo registo', async () => {
    const sourceRequestId = randomUUID();
    const body = { sourceModule: 'G3', sourceRequestId, studentUserId: chargeStudentUserId, feeCode: 'ASSESSMENT-TAKE' };
    const headers = { authorization: `Bearer ${tokenFor(chargesAdminId, 'SCHOOL_ADMIN')}` };

    const first = await request(app).post('/api/v1/financial/integration/assessment-charges').set(headers).send(body);
    expect(first.status).toBe(200);
    expect(first.body.data.feeCode).toBe('ASSESSMENT-TAKE');
    expect(first.body.data.amount).toBe(150);
    expect(first.body.data.status).toBe('PENDING');
    const firstId = first.body.data.externalRegistrationId;

    const second = await request(app).post('/api/v1/financial/integration/assessment-charges').set(headers).send(body);
    expect(second.status).toBe(200);
    expect(second.body.data.externalRegistrationId).toBe(firstId);
  });

  it('código de taxa desconhecido → 404 FEE_NOT_FOUND', async () => {
    const res = await request(app)
      .post('/api/v1/financial/integration/assessment-charges')
      .set('authorization', `Bearer ${tokenFor(chargesAdminId, 'SCHOOL_ADMIN')}`)
      .send({ sourceModule: 'G3', sourceRequestId: randomUUID(), studentUserId: chargeStudentUserId, feeCode: 'NAO-EXISTE' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('FEE_NOT_FOUND');
  });

  it('payload de estudante inválido → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/financial/integration/assessment-charges')
      .set('authorization', `Bearer ${tokenFor(chargesAdminId, 'SCHOOL_ADMIN')}`)
      .send({ sourceModule: 'G3' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('services/finance — rota de regularidade (standing) do contrato 03-financeiro', () => {
  let standingSchoolId = '';
  let standingAdminId = '';
  let activeUserId = '';
  let blockedUserId = '';

  beforeAll(async () => {
    standingSchoolId = randomUUID();
    await prisma.school.create({ data: { id: standingSchoolId, name: 'Escola Standing', code: `STD${standingSchoolId.slice(0, 6)}`, status: 'ACTIVE' } });
    standingAdminId = randomUUID();
    await prisma.user.create({
      data: { id: standingAdminId, schoolId: standingSchoolId, role: 'SCHOOL_ADMIN', name: 'Admin Standing', email: `admin.${standingSchoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    const activeUser = await prisma.user.create({
      data: { schoolId: standingSchoolId, role: 'STUDENT', name: 'Aluno Regular', email: `ativo.${standingSchoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    activeUserId = activeUser.id;
    const blockedUser = await prisma.user.create({
      data: { schoolId: standingSchoolId, role: 'STUDENT', name: 'Aluno Endividado', email: `devedor.${standingSchoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    blockedUserId = blockedUser.id;
    const active = await prisma.student.create({
      data: { schoolId: standingSchoolId, userId: activeUserId, name: 'Aluno Regular', email: activeUser.email, enrollmentNumber: `STD-${standingSchoolId.slice(0, 8)}`, status: 'ACTIVE' },
    });
    await prisma.financialStatus.create({ data: { schoolId: standingSchoolId, studentId: active.id, hasDebt: false, status: 'REGULAR', outstandingAmount: 0 } });
    const blockedStudent = await prisma.student.create({
      data: { schoolId: standingSchoolId, userId: blockedUserId, name: 'Aluno Endividado', email: blockedUser.email, enrollmentNumber: `STDB-${standingSchoolId.slice(0, 7)}`, status: 'ACTIVE' },
    });
    await prisma.financialStatus.create({ data: { schoolId: standingSchoolId, studentId: blockedStudent.id, hasDebt: true, status: 'IN_DEBT', outstandingAmount: 5000 } });
  });

  afterAll(async () => {
    await prisma.financialStatus.deleteMany({ where: { schoolId: standingSchoolId } });
    await prisma.student.deleteMany({ where: { schoolId: standingSchoolId } });
    await prisma.user.deleteMany({ where: { schoolId: standingSchoolId } });
    await prisma.school.delete({ where: { id: standingSchoolId } });
  });

  it('sem token → 401 UNAUTHENTICATED', async () => {
    const res = await request(app).get(`/api/v1/financial/integration/students/${activeUserId}/standing`).expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('token de utilizador comum (não serviço) → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get(`/api/v1/financial/integration/students/${activeUserId}/standing`)
      .set('authorization', `Bearer ${tokenFor(standingAdminId, 'SCHOOL_ADMIN')}`)
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('estudante regular → 200 ACTIVE sem expor montantes', async () => {
    const res = await request(app)
      .get(`/api/v1/financial/integration/students/${activeUserId}/standing`)
      .set('authorization', `Bearer ${SERVICE_TOKEN}`)
      .expect(200);
    expect(res.body.data.studentUserId).toBe(activeUserId);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(typeof res.body.data.checkedAt).toBe('string');
    expect(JSON.stringify(res.body)).not.toMatch(/amount|outstanding|value/i);
  });

  it('estudante com dívida → 200 BLOCKED sem revelar o valor em dívida', async () => {
    const res = await request(app)
      .get(`/api/v1/financial/integration/students/${blockedUserId}/standing`)
      .set('authorization', `Bearer ${SERVICE_TOKEN}`)
      .expect(200);
    expect(res.body.data.studentUserId).toBe(blockedUserId);
    expect(res.body.data.status).toBe('BLOCKED');
    expect(JSON.stringify(res.body)).not.toContain('5000');
  });

  it('estudante desconhecido → 404 STUDENT_NOT_FOUND', async () => {
    const res = await request(app)
      .get(`/api/v1/financial/integration/students/${randomUUID()}/standing`)
      .set('authorization', `Bearer ${SERVICE_TOKEN}`)
      .expect(404);
    expect(res.body.code).toBe('STUDENT_NOT_FOUND');
  });

  it('identificador malformado → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/api/v1/financial/integration/students/nao-e-uuid/standing')
      .set('authorization', `Bearer ${SERVICE_TOKEN}`)
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('resposta ecoa o x-request-id como correlationId', async () => {
    const correlationId = randomUUID();
    const res = await request(app)
      .get(`/api/v1/financial/integration/students/${activeUserId}/standing`)
      .set('authorization', `Bearer ${SERVICE_TOKEN}`)
      .set('x-request-id', correlationId)
      .expect(200);
    expect(res.headers['x-request-id']).toBe(correlationId);
    expect(res.body.meta.correlationId).toBe(correlationId);
  });
});