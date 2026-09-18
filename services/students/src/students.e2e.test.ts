import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { signToken } from '@smartcampus/auth';
import { createApp } from './app';

const SECRET = 'e2e-secret-students';
process.env.SMARTCAMPUS_JWT_SECRET = SECRET;
process.env.STUDENTS_SERVICE_PORT = '4101';

const prisma = new PrismaClient();
const app = createApp();

let schoolId = '';
let adminUserId = '';
let studentUserId = '';
let studentId = '';

function tokenFor(userId: string, role: string): string {
  return signToken({ id: userId, role, schoolId }, SECRET, 3600);
}

describe('services/students — contrato de Estudantes', () => {
  beforeAll(async () => {
    schoolId = randomUUID();
    await prisma.school.create({ data: { id: schoolId, name: 'Escola Teste Students', code: 'ETS', status: 'ACTIVE' } });
    adminUserId = randomUUID();
    await prisma.user.create({
      data: { id: adminUserId, schoolId, role: 'SCHOOL_ADMIN', name: 'Admin Students', email: `admin.${schoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    studentUserId = randomUUID();
    await prisma.user.create({
      data: { id: studentUserId, schoolId, role: 'STUDENT', name: 'Aluno Students', email: `aluno.${schoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    studentId = randomUUID();
    await prisma.student.create({
      data: { id: studentId, schoolId, userId: studentUserId, name: 'Aluno Students', email: `aluno.${schoolId}@teste.mz`, enrollmentNumber: `TEST-${schoolId.slice(0, 4)}`, status: 'ACTIVE' },
    });
  });

  afterAll(async () => {
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
    const res = await request(app).get(`/api/v1/students/${studentId}`).expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    expect(res.body.message).toContain('Token em falta');
  });

  it('token inválido → 401 UNAUTHENTICATED', async () => {
    const res = await request(app).get('/api/v1/students').set('authorization', 'Bearer abc.def.ghi').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('listagem requisita perfil staff (estudante → 403 FORBIDDEN)', async () => {
    const res = await request(app)
      .get('/api/v1/students')
      .set('authorization', `Bearer ${tokenFor(studentUserId, 'STUDENT')}`)
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('listagem por staff devolve o estudante criado', async () => {
    const res = await request(app)
      .get('/api/v1/students')
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    const found = res.body.data.find((row: { id: string }) => row.id === studentId);
    expect(found).toBeDefined();
    expect(found.studentNumber).toBe(`TEST-${schoolId.slice(0, 4)}`);
    expect(found.status).toBe('ACTIVE');
  });

  it('GET /students/me devolve o perfil do próprio estudante', async () => {
    const res = await request(app)
      .get('/api/v1/students/me')
      .set('authorization', `Bearer ${tokenFor(studentUserId, 'STUDENT')}`)
      .expect(200);
    expect(res.body.data.id).toBe(studentId);
    expect(res.body.data.name).toBe('Aluno Students');
  });

  it('GET /students/me para um utilizador sem perfil → 404 STUDENT_NOT_FOUND', async () => {
    const res = await request(app)
      .get('/api/v1/students/me')
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(404);
    expect(res.body.code).toBe('STUDENT_NOT_FOUND');
  });

  it('GET /students/:id por admin devolve o perfil do contrato', async () => {
    const res = await request(app)
      .get(`/api/v1/students/${studentId}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    expect(res.body.data.id).toBe(studentId);
    expect(res.body.data.schoolId).toBe(schoolId);
  });

  it('GET /students/:id inexistente → 404 STUDENT_NOT_FOUND', async () => {
    const res = await request(app)
      .get(`/api/v1/students/${randomUUID()}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(404);
    expect(res.body.code).toBe('STUDENT_NOT_FOUND');
  });

  it('GET /students/:id por estudante → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get(`/api/v1/students/${studentId}`)
      .set('authorization', `Bearer ${tokenFor(studentUserId, 'STUDENT')}`)
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});