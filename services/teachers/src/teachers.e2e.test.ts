import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { signToken } from '@smartcampus/auth';
import { createApp } from './app';

const SECRET = 'e2e-secret-teachers';
process.env.SMARTCAMPUS_JWT_SECRET = SECRET;
process.env.JWT_ACCESS_SECRET = SECRET;
process.env.TEACHERS_SERVICE_PORT = '4102';

const prisma = new PrismaClient();
const app = createApp();

let schoolId = '';
let adminUserId = '';
let studentUserId = '';
let teacherId = '';
let teacherName = '';

function tokenFor(userId: string, role: string): string {
  return signToken({ id: userId, role, schoolId }, SECRET, 3600);
}

describe('services/teachers — contrato de Professores', () => {
  beforeAll(async () => {
    schoolId = randomUUID();
    await prisma.school.create({ data: { id: schoolId, name: 'Escola Teste Teachers', code: 'ETT', status: 'ACTIVE' } });
    adminUserId = randomUUID();
    await prisma.user.create({
      data: { id: adminUserId, schoolId, role: 'SCHOOL_ADMIN', name: 'Admin Teachers', email: `admin.${schoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    studentUserId = randomUUID();
    await prisma.user.create({
      data: { id: studentUserId, schoolId, role: 'STUDENT', name: 'Aluno Teachers', email: `aluno.${schoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
    });
    teacherId = randomUUID();
    teacherName = 'Professor Teachers';
    await prisma.teacher.create({
      data: { id: teacherId, schoolId, name: teacherName, email: `professor.${schoolId}@teste.mz`, status: 'ACTIVE' },
    });
  });

  afterAll(async () => {
    await prisma.teacher.deleteMany({ where: { schoolId } });
    await prisma.user.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.$disconnect();
  });

  it('health responde ok', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('sem token → 401 UNAUTHENTICATED (Token em falta)', async () => {
    const res = await request(app).get(`/api/v1/teachers/${teacherId}`).expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    expect(res.body.message).toContain('Token em falta');
  });

  it('token inválido → 401 UNAUTHENTICATED', async () => {
    const res = await request(app).get('/api/v1/teachers').set('authorization', 'Bearer abc.def.ghi').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('listagem requisita perfil staff (estudante → 403 FORBIDDEN)', async () => {
    const res = await request(app)
      .get('/api/v1/teachers')
      .set('authorization', `Bearer ${tokenFor(studentUserId, 'STUDENT')}`)
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('listagem por staff devolve o professor criado com staffNumber null', async () => {
    const res = await request(app)
      .get('/api/v1/teachers')
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    const found = res.body.data.find((row: { id: string }) => row.id === teacherId);
    expect(found).toBeDefined();
    expect(found.staffNumber).toBeNull();
    expect(found.name).toBe(teacherName);
    expect(found.status).toBe('ACTIVE');
  });

  it('listagem devolve meta de paginação (page, pageSize, total)', async () => {
    const res = await request(app)
      .get('/api/v1/teachers?page=1&pageSize=10')
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.pageSize).toBe(10);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('listagem filtra por status', async () => {
    const res = await request(app)
      .get('/api/v1/teachers?status=ACTIVE')
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    const found = res.body.data.find((row: { id: string }) => row.id === teacherId);
    expect(found).toBeDefined();
  });

  it('GET /teachers/:id por admin devolve o perfil do contrato', async () => {
    const res = await request(app)
      .get(`/api/v1/teachers/${teacherId}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(200);
    expect(res.body.data.id).toBe(teacherId);
    expect(res.body.data.schoolId).toBe(schoolId);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('GET /teachers/:id inexistente → 404 TEACHER_NOT_FOUND', async () => {
    const res = await request(app)
      .get(`/api/v1/teachers/${randomUUID()}`)
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(404);
    expect(res.body.code).toBe('TEACHER_NOT_FOUND');
  });

  it('GET /teachers/:id por estudante → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get(`/api/v1/teachers/${teacherId}`)
      .set('authorization', `Bearer ${tokenFor(studentUserId, 'STUDENT')}`)
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('GET /teachers/:id com id malformado → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/api/v1/teachers/nao-e-um-uuid')
      .set('authorization', `Bearer ${tokenFor(adminUserId, 'SCHOOL_ADMIN')}`)
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});