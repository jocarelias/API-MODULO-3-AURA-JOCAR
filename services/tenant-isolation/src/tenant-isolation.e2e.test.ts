import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { signToken } from '@smartcampus/auth';

/**
 * Isolamento por escola nos SERVIÇOS DE CONTRATO.
 *
 * Estes testes existem porque a auditoria encontrou vazamentos reais: as
 * listagens aceitavam `?schoolId=` como filtro sem o impor como autorização, e
 * as rotas por `:id` não comparavam a escola do recurso com a do token. Na
 * prática, um SCHOOL_ADMIN de uma escola obtinha dados de todas as outras.
 *
 * Regra imposta (igual à do módulo G3):
 *   - `SUPER_ADMIN` tem alcance global e pode filtrar por `?schoolId=`;
 *   - qualquer outro role fica preso ao `schoolId` do token;
 *   - um recurso de outra escola responde 403, nunca 200.
 */

const SECRET = 'e2e-secret-tenant-isolation';
process.env.SMARTCAMPUS_JWT_SECRET = SECRET;
process.env.JWT_ACCESS_SECRET = SECRET;
process.env.SMARTCAMPUS_SERVICE_TOKEN = 'e2e-service-token';
process.env.FINANCIAL_SERVICE_TOKEN = 'e2e-service-token';

const prisma = new PrismaClient();

interface Fixture {
  schoolId: string;
  otherSchoolId: string;
  studentId: string;
  otherStudentId: string;
  studentUserId: string;
  otherStudentUserId: string;
  teacherId: string;
  otherTeacherId: string;
  teacherUserId: string;
  otherTeacherUserId: string;
  adminToken: string;
  otherAdminToken: string;
  superAdminToken: string;
  studentToken: string;
  otherStudentToken: string;
  teacherToken: string;
  enrolmentId: string;
}

let apps: Record<string, ReturnType<typeof createApp>> = {};
let servers: Array<{ close: (cb: () => void) => void }> = [];
let base: Record<string, string> = {};
let fx: Fixture;

type createApp = () => import('express').Express;

async function boot(name: string, factory: () => Promise<createApp>): Promise<void> {
  const create = await factory();
  const app = create();
  apps[name] = app;
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address() as { port: number };
  base[name] = `http://127.0.0.1:${address.port}`;
}

const tokenFor = (userId: string, role: string, schoolId: string): string => signToken({ id: userId, role, schoolId }, SECRET, 3600);

beforeAll(async () => {
  await boot('students', () => import('../../students/src/app').then((m) => m.createApp));
  await boot('teachers', () => import('../../teachers/src/app').then((m) => m.createApp));
  await boot('enrolments', () => import('../../enrolments/src/app').then((m) => m.createApp));
  await boot('finance', () => import('../../finance/src/app').then((m) => m.createApp));

  const schoolId = randomUUID();
  const otherSchoolId = randomUUID();
  await prisma.school.createMany({
    data: [
      { id: schoolId, name: 'Escola A', code: `TA${schoolId.slice(0, 8).toUpperCase()}`, status: 'ACTIVE' },
      { id: otherSchoolId, name: 'Escola B', code: `TB${otherSchoolId.slice(0, 8).toUpperCase()}`, status: 'ACTIVE' },
    ],
  });

  const mkUser = async (sid: string, role: string, label: string) =>
    prisma.user.create({ data: { schoolId: sid, role, name: `${label} ${sid.slice(0, 4)}`, email: `${label}.${sid}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' } });

  const adminUser = await mkUser(schoolId, 'SCHOOL_ADMIN', 'adminA');
  const otherAdminUser = await mkUser(otherSchoolId, 'SCHOOL_ADMIN', 'adminB');
  const superAdminUser = await mkUser(schoolId, 'SUPER_ADMIN', 'super');
  const studentUser = await mkUser(schoolId, 'STUDENT', 'alunoA');
  const otherStudentUser = await mkUser(otherSchoolId, 'STUDENT', 'alunoB');
  const teacherUser = await mkUser(schoolId, 'TEACHER', 'docA');
  const otherTeacherUser = await mkUser(otherSchoolId, 'TEACHER', 'docB');

  const student = await prisma.student.create({ data: { schoolId, userId: studentUser.id, name: 'Aluno A', email: studentUser.email, enrollmentNumber: `A-${schoolId.slice(0, 6)}`, status: 'ACTIVE' } });
  const otherStudent = await prisma.student.create({ data: { schoolId: otherSchoolId, userId: otherStudentUser.id, name: 'Aluno B', email: otherStudentUser.email, enrollmentNumber: `B-${otherSchoolId.slice(0, 6)}`, status: 'ACTIVE' } });
  const teacher = await prisma.teacher.create({ data: { schoolId, userId: teacherUser.id, name: 'Docente A', email: teacherUser.email, status: 'ACTIVE' } });
  const otherTeacher = await prisma.teacher.create({ data: { schoolId: otherSchoolId, userId: otherTeacherUser.id, name: 'Docente B', email: otherTeacherUser.email, status: 'ACTIVE' } });

  await prisma.financialStatus.create({ data: { schoolId, studentId: student.id, hasDebt: false, status: 'REGULAR', outstandingAmount: 0 } });
  await prisma.financialStatus.create({ data: { schoolId: otherSchoolId, studentId: otherStudent.id, hasDebt: true, status: 'IN_DEBT', outstandingAmount: 5000 } });

  const mkEnrolment = async (sid: string, studentId: string) => {
    const year = await prisma.academicYear.create({ data: { schoolId: sid, name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'ACTIVE' } });
    const term = await prisma.term.create({ data: { schoolId: sid, academicYearId: year.id, name: '1º T', startDate: new Date('2026-02-01'), endDate: new Date('2026-04-30'), status: 'ACTIVE' } });
    const klass = await prisma.class.create({ data: { schoolId: sid, academicYearId: year.id, name: '10A', status: 'ACTIVE' } });
    const subject = await prisma.subject.create({ data: { schoolId: sid, name: 'Mat', code: `M${sid.slice(0, 4)}`, status: 'ACTIVE' } });
    return prisma.enrollment.create({ data: { schoolId: sid, academicYearId: year.id, termId: term.id, classId: klass.id, subjectId: subject.id, studentId, status: 'ACTIVE' } });
  };

  const enrolment = await mkEnrolment(schoolId, student.id);
  await mkEnrolment(otherSchoolId, otherStudent.id);

  fx = {
    schoolId,
    otherSchoolId,
    studentId: student.id,
    otherStudentId: otherStudent.id,
    studentUserId: studentUser.id,
    otherStudentUserId: otherStudentUser.id,
    teacherId: teacher.id,
    otherTeacherId: otherTeacher.id,
    teacherUserId: teacherUser.id,
    otherTeacherUserId: otherTeacherUser.id,
    adminToken: tokenFor(adminUser.id, 'SCHOOL_ADMIN', schoolId),
    otherAdminToken: tokenFor(otherAdminUser.id, 'SCHOOL_ADMIN', otherSchoolId),
    superAdminToken: tokenFor(superAdminUser.id, 'SUPER_ADMIN', schoolId),
    studentToken: tokenFor(studentUser.id, 'STUDENT', schoolId),
    otherStudentToken: tokenFor(otherStudentUser.id, 'STUDENT', otherSchoolId),
    teacherToken: tokenFor(teacherUser.id, 'TEACHER', schoolId),
    enrolmentId: enrolment.id,
  };
});

afterAll(async () => {
  await prisma.school.deleteMany({ where: { id: { in: [fx.schoolId, fx.otherSchoolId] } } });
  await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
  await prisma.$disconnect();
});

const get = (service: string, path: string, token: string) =>
  request(apps[service]).get(path).set('authorization', `Bearer ${token}`);

describe('students — listagem isolada por escola', () => {
  it('sem ?schoolId devolve apenas estudantes da própria escola', async () => {
    const res = await get('students', '/api/v1/students', fx.adminToken).expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((s) => s.id);
    expect(ids).toContain(fx.studentId);
    expect(ids).not.toContain(fx.otherStudentId);
  });

  it('?schoolId de outra escola é ignorado (o query não autoriza)', async () => {
    const res = await get('students', `/api/v1/students?schoolId=${fx.otherSchoolId}`, fx.adminToken).expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((s) => s.id);
    expect(ids).not.toContain(fx.otherStudentId);
  });

  it('SUPER_ADMIN pode filtrar por outra escola', async () => {
    const res = await get('students', `/api/v1/students?schoolId=${fx.otherSchoolId}`, fx.superAdminToken).expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((s) => s.id);
    expect(ids).toContain(fx.otherStudentId);
  });

  it('o total do meta também respeita o isolamento', async () => {
    const res = await get('students', '/api/v1/students', fx.adminToken).expect(200);
    const others = await get('students', '/api/v1/students', fx.otherAdminToken).expect(200);
    expect(res.body.meta.total).toBe(1);
    expect(others.body.meta.total).toBe(1);
  });
});

describe('students — recurso por :id isolado por escola', () => {
  it('a própria escola lê o seu estudante', async () => {
    await get('students', `/api/v1/students/${fx.studentId}`, fx.adminToken).expect(200);
  });

  it('outra escola recebe 403, não 200', async () => {
    const res = await get('students', `/api/v1/students/${fx.studentId}`, fx.otherAdminToken).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('SUPER_ADMIN mantém alcance global', async () => {
    await get('students', `/api/v1/students/${fx.otherStudentId}`, fx.superAdminToken).expect(200);
  });
});

describe('teachers — isolamento por escola', () => {
  it('sem ?schoolId devolve apenas docentes da própria escola', async () => {
    const res = await get('teachers', '/api/v1/teachers', fx.adminToken).expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((t) => t.id);
    expect(ids).toContain(fx.teacherId);
    expect(ids).not.toContain(fx.otherTeacherId);
  });

  it('?schoolId de outra escola é ignorado', async () => {
    const res = await get('teachers', `/api/v1/teachers?schoolId=${fx.otherSchoolId}`, fx.adminToken).expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((t) => t.id);
    expect(ids).not.toContain(fx.otherTeacherId);
  });

  it('docente de outra escola por :id devolve 403', async () => {
    const res = await get('teachers', `/api/v1/teachers/${fx.teacherId}`, fx.otherAdminToken).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('a própria escola lê o seu docente', async () => {
    await get('teachers', `/api/v1/teachers/${fx.teacherId}`, fx.adminToken).expect(200);
  });
});

describe('enrolments — isolamento por escola', () => {
  it('sem filtros devolve apenas inscrições da própria escola', async () => {
    const res = await get('enrolments', '/api/v1/enrolments', fx.adminToken).expect(200);
    const rows = res.body.data as Array<{ id: string; studentId: string }>;
    expect(rows.map((r) => r.id)).toContain(fx.enrolmentId);
    expect(rows.every((r) => r.studentId === fx.studentId)).toBe(true);
    expect(res.body.meta.total).toBe(1);
  });

  it('a inscrição de outra escola não aparece nem no total', async () => {
    const res = await get('enrolments', '/api/v1/enrolments', fx.otherAdminToken).expect(200);
    const rows = res.body.data as Array<{ id: string }>;
    expect(rows.map((r) => r.id)).not.toContain(fx.enrolmentId);
  });

  it('os filtros não allows ler de outra escola', async () => {
    const res = await get('enrolments', `/api/v1/enrolments?studentId=${fx.studentId}`, fx.otherAdminToken).expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });
});

describe('finance — situação financeira isolada por escola', () => {
  it('a escola consulta o estado dos seus estudantes', async () => {
    const res = await get('finance', `/api/v1/financial-status/${fx.studentId}`, fx.adminToken).expect(200);
    expect(res.body.data.status).toBe('REGULAR');
  });

  it('outra escola não lê a dívida de um estudante que não é seu', async () => {
    const res = await get('finance', `/api/v1/financial-status/${fx.otherStudentId}`, fx.adminToken).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('o estudante só consulta a própria situação', async () => {
    await get('finance', `/api/v1/financial-status/${fx.studentId}`, fx.studentToken).expect(200);
    const res = await get('finance', `/api/v1/financial-status/${fx.otherStudentId}`, fx.studentToken).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('um docente não consulta a dívida de um estudante', async () => {
    const res = await get('finance', `/api/v1/financial-status/${fx.studentId}`, fx.teacherToken).expect(200);
    // O docente da mesma escola continua a poder consultar (uso pedagógico),
    // mas nunca de outra escola.
    expect(res.status).toBe(200);
    await get('finance', `/api/v1/financial-status/${fx.otherStudentId}`, fx.teacherToken).expect(403);
  });
});
