import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { signToken } from '@smartcampus/auth';
import { createApp } from './app';

const SECRET = 'e2e-secret-enrolments';
process.env.SMARTCAMPUS_JWT_SECRET = SECRET;
process.env.JWT_ACCESS_SECRET = SECRET;
process.env.ENROLMENTS_SERVICE_PORT = '4103';

const prisma = new PrismaClient();
const app = createApp();

let schoolId = '';
let adminUserId = '';
let studentUserId = '';
let academicYearId = '';
let academicYearName = '';
let termId = '';
let classId = '';
let subjectId = '';
let studentId = '';
let enrolmentId = '';

function tokenFor(userId: string, role: string): string {
  return signToken({ id: userId, role, schoolId }, SECRET, 3600);
}

describe('services/enrolments — contrato de Inscrições', () => {
  beforeAll(async () => {
    schoolId = randomUUID();
    await prisma.school.create({ data: { id: schoolId, name: 'Escola Teste Enrolments', code: 'ETE', status: 'ACTIVE' } });
    adminUserId = randomUUID();
    await prisma.user.create({
      data: { id: adminUserId, schoolId, role: 'SCHOOL_ADMIN', name: 'Admin Enrolments', email: `admin.${schoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    studentUserId = randomUUID();
    await prisma.user.create({
      data: { id: studentUserId, schoolId, role: 'STUDENT', name: 'Aluno Enrolments', email: `aluno.${schoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    academicYearId = randomUUID();
    academicYearName = '2026';
    await prisma.academicYear.create({
      data: { id: academicYearId, schoolId, name: academicYearName, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'ACTIVE' },
    });
    termId = randomUUID();
    await prisma.term.create({
      data: { id: termId, schoolId, academicYearId, name: '1º Trimestre', startDate: new Date('2026-02-01'), endDate: new Date('2026-04-30'), status: 'ACTIVE' },
    });
    classId = randomUUID();
    await prisma.class.create({ data: { id: classId, schoolId, academicYearId, name: '10ª A', status: 'ACTIVE' } });
    subjectId = randomUUID();
    await prisma.subject.create({ data: { id: subjectId, schoolId, name: 'Matemática', code: 'MAT', status: 'ACTIVE' } });
    studentId = randomUUID();
    await prisma.student.create({
      data: { id: studentId, schoolId, userId: studentUserId, name: 'Aluno Enrolments', email: `aluno.${schoolId}@teste.mz`, enrollmentNumber: `TEST-${schoolId.slice(0, 4)}`, status: 'ACTIVE' },
    });
    enrolmentId = randomUUID();
    await prisma.enrollment.create({
      data: { id: enrolmentId, schoolId, academicYearId, termId, classId, studentId, subjectId, status: 'ACTIVE' },
    });
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { schoolId } });
    await prisma.student.deleteMany({ where: { schoolId } });
    await prisma.subject.deleteMany({ where: { schoolId } });
    await prisma.class.deleteMany({ where: { schoolId } });
    await prisma.term.deleteMany({ where: { schoolId } });
    await prisma.academicYear.deleteMany({ where: { schoolId } });
    await prisma.user.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.$disconnect();
  });

  it('health responde ok', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('sem token → 401 UNAUTHENTICATED (Token em falta)', async () => {
    const res = await request(app).get('/api/v1/enrolments').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    expect(res.body.message).toContain('Token em falta');
  });

  it('token inválido → 401 UNAUTHENTICATED', async () => {
    const res = await request(app).get('/api/v1/enrolments').set('authorization', 'Bearer abc.def.ghi').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('listagem requisita perfil staff (estudante → 403 FORBIDDEN)', async () => {
    const res = await request(app)
      .get('/api/v1/enrolments')
      .set('authorization', `Bearer ${tokenFor(studentUserId, 'STUDENT')}`)
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('listagem por staff devolve a inscrição criada', async () => {
    const res = await request(app)
      .get('/api/v1/enrolments')
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    const found = res.body.data.find((row: { id: string }) => row.id === enrolmentId);
    expect(found).toBeDefined();
    expect(found.studentId).toBe(studentId);
    expect(found.academicYear).toBe(academicYearName);
    expect(found.status).toBe('ACTIVE');
  });

  it('listagem filtra por studentId', async () => {
    const res = await request(app)
      .get(`/api/v1/enrolments?studentId=${studentId}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(enrolmentId);
    expect(res.body.data[0].studentId).toBe(studentId);
  });

  it('listagem filtra por subjectId', async () => {
    const res = await request(app)
      .get(`/api/v1/enrolments?subjectId=${subjectId}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    const found = res.body.data.find((row: { id: string }) => row.id === enrolmentId);
    expect(found).toBeDefined();
    expect(found.subjectId).toBe(subjectId);
  });

  it('listagem filtra por termId', async () => {
    const res = await request(app)
      .get(`/api/v1/enrolments?termId=${termId}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    const found = res.body.data.find((row: { id: string }) => row.id === enrolmentId);
    expect(found).toBeDefined();
    expect(found.termId).toBe(termId);
  });

  it('listagem filtra por classId', async () => {
    const res = await request(app)
      .get(`/api/v1/enrolments?classId=${classId}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    const found = res.body.data.find((row: { id: string }) => row.id === enrolmentId);
    expect(found).toBeDefined();
    expect(found.classId).toBe(classId);
  });

  it('listagem por termId não registado devolve lista vazia e total 0', async () => {
    const res = await request(app)
      .get(`/api/v1/enrolments?termId=${randomUUID()}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });

  it('listagem devolve meta de paginação (pageSize 1)', async () => {
    const res = await request(app)
      .get('/api/v1/enrolments?page=1&pageSize=1')
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.pageSize).toBe(1);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });
});