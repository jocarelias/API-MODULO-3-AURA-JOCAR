import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { hashToken } from '@smartcampus/auth';
import { createApp } from '../../../app';
import { startContractServices, ContractTestContext } from './contractTestEnv';

const ADMIN_EMAIL = 'admin@ucjac.ac.mz';
const ADMIN_PASSWORD = 'admin123';
const STUDENT_EMAIL = 'aluno1@student.ucjac.ac.mz';
const STUDENT_PASSWORD = 'aluno123';

describe('G3 Refresh Token e RBAC (e2e)', () => {
  let app: ReturnType<typeof createApp>;
  let server: ReturnType<typeof app.listen>;
  let apiBase: string;
  let testContext: ContractTestContext;
  let prisma: PrismaClient;
  let adminId: string;

  const login = (email: string, password: string) => request(apiBase).post('/api/v1/auth/login').send({ email, password });
  const refresh = (refreshToken: string) => request(apiBase).post('/api/v1/auth/refresh').send({ refreshToken });
  const logout = (accessToken: string, refreshToken: string) =>
    request(apiBase).post('/api/v1/auth/logout').set('authorization', `Bearer ${accessToken}`).send({ refreshToken });

  beforeAll(async () => {
    testContext = await startContractServices();
    prisma = new PrismaClient();
    app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    apiBase = typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}` : '';
    const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (!admin) {
      throw new Error('Utilizador admin do seed não encontrado');
    }
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId: adminId } });
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
    await testContext.stop();
  });

  it('login devolve accessToken + refreshToken e o par funciona', async () => {
    const res = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.data.tokenType).toBe('Bearer');
    expect(res.body.data.expiresIn).toBe(3600);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
    expect(res.body.data.refreshExpiresIn).toBeGreaterThan(0);
    expect(res.body.data.user.role).toBe('SUPER_ADMIN');

    const authed = request(apiBase).get('/api/v1/assessments').set('authorization', `Bearer ${res.body.data.accessToken}`);
    const list = await authed;
    expect(list.status).toBe(200);
  });

  it('refreshToken é persistido por hash (nunca em claro)', async () => {
    const loginRes = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const raw = loginRes.body.data.refreshToken as string;
    const rows = await prisma.refreshToken.findMany({ where: { userId: adminId } });
    const row = rows.find((r) => r.tokenHash === hashToken(raw));
    expect(row).toBeTruthy();
    expect(row?.tokenHash).not.toBe(raw);
    expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.revokedAt).toBeNull();
  });

  it('refresh renova com rotação: novo par, antigo reutilizado devolve 401', async () => {
    const loginRes = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const oldRefresh = loginRes.body.data.refreshToken as string;

    const rotated = await refresh(oldRefresh);
    expect(rotated.status).toBe(200);
    const newAccess = rotated.body.data.accessToken as string;
    const newRefresh = rotated.body.data.refreshToken as string;
    expect(newAccess).toBeTruthy();
    expect(newRefresh).not.toBe(oldRefresh);

    const authed = request(apiBase).get('/api/v1/assessments').set('authorization', `Bearer ${newAccess}`);
    const list = await authed;
    expect(list.status).toBe(200);

    const reuse = await refresh(oldRefresh);
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('UNAUTHENTICATED');

    const again = await refresh(newRefresh);
    expect(again.status).toBe(200);
    expect(again.body.data.refreshToken).not.toBe(newRefresh);
  });

  it('refresh com token inválido ou adulterado devolve 401', async () => {
    const garbage = await refresh('nao.e.um.jwt.válido');
    expect(garbage.status).toBe(401);

    const loginRes = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const raw = loginRes.body.data.refreshToken as string;
    const tampered = `${raw.slice(0, -1)}${raw.endsWith('a') ? 'b' : 'a'}`;
    const bad = await refresh(tampered);
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('UNAUTHENTICATED');
  });

  it('logout revoga o refreshToken e o refresh posterior devolve 401', async () => {
    const loginRes = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const access = loginRes.body.data.accessToken as string;
    const rt = loginRes.body.data.refreshToken as string;

    const out = await logout(access, rt);
    expect(out.status).toBe(200);
    expect(out.body.data.revoked).toBe(true);

    const after = await refresh(rt);
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('UNAUTHENTICATED');
  });

  it('logout sem autenticação devolve 401', async () => {
    const res = await request(apiBase).post('/api/v1/auth/logout').send({ refreshToken: 'x'.repeat(32) });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('RBAC — STUDENT não acede a catálogos de alunos/professores (403)', async () => {
    const studentLogin = await login(STUDENT_EMAIL, STUDENT_PASSWORD);
    expect(studentLogin.status).toBe(200);
    const studentApi = request.agent(apiBase).set('authorization', `Bearer ${studentLogin.body.data.accessToken}`);

    const students = await studentApi.get('/api/v1/students');
    expect(students.status).toBe(403);
    expect(students.body.code).toBe('FORBIDDEN');

    const teachers = await studentApi.get('/api/v1/teachers');
    expect(teachers.status).toBe(403);

    const subjects = await studentApi.get('/api/v1/subjects');
    expect(subjects.status).toBe(200);
  });

  it('RBAC — STAFF acede aos catálogos de alunos e professores', async () => {
    const adminLogin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const adminApi = request.agent(apiBase).set('authorization', `Bearer ${adminLogin.body.data.accessToken}`);

    const students = await adminApi.get('/api/v1/students');
    expect(students.status).toBe(200);
    expect(Array.isArray(students.body.data)).toBe(true);

    const teachers = await adminApi.get('/api/v1/teachers');
    expect(teachers.status).toBe(200);
  });
});