import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../../app';
import { startContractServices, createEnrolledStudent, ContractTestContext } from './contractTestEnv';

describe('G3 Avaliações e Horários (e2e) — API autenticada + contratos', () => {
  let app: ReturnType<typeof createApp>;
  let server: ReturnType<typeof app.listen>;
  let apiBase: string;
  let api: ReturnType<typeof request.agent>;
  let testContext: ContractTestContext;
  let ids: {
    termId: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    seedAssessmentId: string;
    studentId: string;
    seedResult: { id: string };
  };

  const prisma = new PrismaClient();
  const created: { assessments: string[]; schedules: string[] } = { assessments: [], schedules: [] };

  const unique = (label: string) => `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  beforeAll(async () => {
    testContext = await startContractServices();
    app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (typeof address === 'object' && address !== null) {
      apiBase = `http://127.0.0.1:${address.port}`;
    } else {
      apiBase = '';
    }
    api = request.agent(apiBase).set('authorization', `Bearer ${testContext.token}`);

    // Fixtures na mesma escola do token (ver nota em contract-debt).
    const fx = testContext.fixtures;

    // A escola descartável nasce sem alunos: o estudante matriculado é criado
    // aqui para que os lançamentos de nota tenham um aluno real e validado
    // pelos contratos (matrícula + situação financeira).
    const studentId = (await createEnrolledStudent(testContext, 'g3')).studentId;

    // Avaliação e nota de base. Lançar a nota recalcula resultados, o que dá um
    // `Result` com id conhecido: sem isto os testes que operam sobre
    // `seedResult` não teriam sobre o que trabalhar.
    const baseline = await api.post('/api/v1/assessments').send({
      academicYearId: fx.academicYearId,
      termId: fx.termId,
      classId: fx.classId,
      subjectId: fx.subjectId,
      teacherId: fx.teacherId,
      name: unique('Base'),
      type: 'TESTE',
      date: '2026-12-01T10:00:00.000Z',
      weight: 1,
      status: 'OPEN',
    });
    expect(baseline.status).toBe(201);
    created.assessments.push(baseline.body.data.id);

    const baselineGrade = await api
      .post(`/api/v1/assessments/${baseline.body.data.id}/grades`)
      .send({ studentId, score: 10 });
    expect(baselineGrade.status).toBe(201);

    const seedResult = await prisma.result.findFirstOrThrow({
      where: { termId: fx.termId, classId: fx.classId, subjectId: fx.subjectId, studentId },
    });

    ids = {
      termId: fx.termId,
      academicYearId: fx.academicYearId,
      classId: fx.classId,
      subjectId: fx.subjectId,
      teacherId: fx.teacherId,
      seedAssessmentId: baseline.body.data.id,
      studentId,
      seedResult,
    };
  });

  afterAll(async () => {
    for (const id of created.schedules) {
      await prisma.schedule.delete({ where: { id } }).catch(() => {});
    }
    for (const id of created.assessments) {
      await prisma.assessment.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
    await testContext.stop();
  });

  const assessmentPayload = (overrides: Record<string, unknown> = {}) => ({
    academicYearId: ids.academicYearId,
    termId: ids.termId,
    classId: ids.classId,
    subjectId: ids.subjectId,
    teacherId: ids.teacherId,
    name: unique('Teste'),
    type: 'TESTE',
    date: '2026-12-01T10:00:00.000Z',
    weight: 1,
    ...overrides,
  });

  it('401 — UNAUTHENTICATED sem token em endpoint protegido', async () => {
    const res = await request(apiBase).get('/api/v1/assessments');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    expect(res.body.message).toContain('Token em falta');
    expect(res.body.correlationId).toBeTruthy();
  });

  it('respostas autenticadas não expõem credenciais', async () => {
    const res = await api.get('/api/v1/assessments');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const text = JSON.stringify(res.body).toLowerCase();
    expect(text).not.toMatch(/password|passwordHash|senha|senhaHash|accessToken|refreshToken|bearer/i);
  });

  it('health responde sem exigir token', async () => {
    const res = await request(apiBase).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok' });
    expect(res.body.meta.correlationId).toBeTruthy();
  });

  it('eco o x-request-id como correlationId', async () => {
    const cid = 'sc-e2e-integration-456';
    const res = await api.get('/api/v1/schedules').set('x-request-id', cid);
    expect(res.status).toBe(200);
    expect(res.body.meta.correlationId).toBe(cid);
    expect(res.headers['x-request-id']).toBe(cid);
  });

  it('rota inexistente retorna 404 com contrato de erro', async () => {
    const res = await api.get('/api/v1/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.message).toBeTruthy();
    expect(res.body.meta).toBeUndefined();
    expect(res.body.correlationId).toBeTruthy();
  });

  it('validação Zod: payload inválido retorna 400 VALIDATION_ERROR com details', async () => {
    const res = await api.post('/api/v1/assessments').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('validação Zod: peso zero rejeitado (400)', async () => {
    const res = await api
      .post('/api/v1/assessments')
      .send(assessmentPayload({ weight: 0 }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('validação Zod: tipo de avaliação inexistente rejeitado (400)', async () => {
    const res = await api
      .post('/api/v1/assessments')
      .send(assessmentPayload({ type: 'EXAME' }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('cria avaliação e obtém por ID', async () => {
    const createdRes = await api
      .post('/api/v1/assessments')
      .send(assessmentPayload({ status: 'OPEN' }));
    expect(createdRes.status).toBe(201);
    created.assessments.push(createdRes.body.data.id);

    const getRes = await api.get(`/api/v1/assessments/${createdRes.body.data.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe(createdRes.body.data.name);
    expect(getRes.body.data.type).toBe('TESTE');
    expect(getRes.body.data.maxScore).toBe(20);
  });

  it('rejeita avaliação duplicada (mesmo nome, turma, disciplina, período) com 409', async () => {
    const first = await api.post('/api/v1/assessments').send(assessmentPayload({ status: 'OPEN' }));
    expect(first.status).toBe(201);
    const dup = await api
      .post('/api/v1/assessments')
      .send(assessmentPayload({ status: 'OPEN', name: first.body.data.name }));
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('CONFLICT');
    created.assessments.push(first.body.data.id);
  });

  it('bloqueia alteração de peso/maxScore após lançar notas (409)', async () => {
    const res = await api
      .post('/api/v1/assessments')
      .send(assessmentPayload({ status: 'OPEN', weight: 2 }));
    expect(res.status).toBe(201);
    const assessmentId = res.body.data.id;
    created.assessments.push(assessmentId);

    const gradeRes = await api
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .send({ studentId: ids.studentId, score: 15 });
    expect(gradeRes.status).toBe(201);

    const patchWeight = await api
      .patch(`/api/v1/assessments/${assessmentId}`)
      .send({ weight: 5 });
    expect(patchWeight.status).toBe(409);

    const patchMax = await api
      .patch(`/api/v1/assessments/${assessmentId}`)
      .send({ maxScore: 30 });
    expect(patchMax.status).toBe(409);
  });

  it('bloqueia eliminação de avaliação com notas (409)', async () => {
    const res = await api
      .post('/api/v1/assessments')
      .send(assessmentPayload({ status: 'OPEN' }));
    const assessmentId = res.body.data.id;
    created.assessments.push(assessmentId);

    await api
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .send({ studentId: ids.studentId, score: 14 });

    const del = await api.delete(`/api/v1/assessments/${assessmentId}`);
    expect(del.status).toBe(409);
    expect(del.body.code).toBe('CONFLICT');
  });

  it('permite eliminar avaliação sem notas', async () => {
    const res = await api
      .post('/api/v1/assessments')
      .send(assessmentPayload({ status: 'DRAFT' }));
    const assessmentId = res.body.data.id;

    const del = await api.delete(`/api/v1/assessments/${assessmentId}`);
    expect(del.status).toBe(200);
    expect(del.body.data).toEqual({ id: assessmentId, deleted: true });

    const gone = await api.get(`/api/v1/assessments/${assessmentId}`);
    expect(gone.status).toBe(404);
  });

  it('rejeita nota fora da escala de valores (400)', async () => {
    const res = await api
      .post('/api/v1/assessments')
      .send(assessmentPayload({ status: 'OPEN', maxScore: 30 }));
    const assessmentId = res.body.data.id;
    created.assessments.push(assessmentId);

    const bad = await api
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .send({ studentId: ids.studentId, score: 31 });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION_ERROR');

    const ok = await api
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .send({ studentId: ids.studentId, score: 30 });
    expect(ok.status).toBe(201);
  });

  it('rejeita nota duplicada para o mesmo aluno na mesma avaliação (409)', async () => {
    const res = await api
      .post('/api/v1/assessments')
      .send(assessmentPayload({ status: 'OPEN' }));
    const assessmentId = res.body.data.id;
    created.assessments.push(assessmentId);

    const first = await api
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .send({ studentId: ids.studentId, score: 12 });
    expect(first.status).toBe(201);

    const dup = await api
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .send({ studentId: ids.studentId, score: 13 });
    expect(dup.status).toBe(409);
  });

  it('rejeita nota em avaliação não aberta (409)', async () => {
    const res = await api
      .post('/api/v1/assessments')
      .send(assessmentPayload({ status: 'CLOSED' }));
    const assessmentId = res.body.data.id;
    created.assessments.push(assessmentId);

    const grade = await api
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .send({ studentId: ids.studentId, score: 10 });
    expect(grade.status).toBe(409);
  });

  it('lançar nota recalcula resultados (ACID, status IN_PROGRESS enquanto faltam notas)', async () => {
    const res = await api
      .post('/api/v1/assessments')
      .send(assessmentPayload({ status: 'OPEN', name: unique('Recalculo') }));
    const assessmentId = res.body.data.id;
    created.assessments.push(assessmentId);

    await api
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .send({ studentId: ids.studentId, score: 10 });

    const results = await api.get('/api/v1/results').query({
      termId: ids.termId,
      classId: ids.classId,
      subjectId: ids.subjectId,
      studentId: ids.studentId,
    });
    expect(results.status).toBe(200);
    const studentResults = results.body.data.filter((r: { studentId: string }) => r.studentId === ids.studentId);
    expect(studentResults.length).toBeGreaterThan(0);
    const updated = ids.seedResult ? studentResults.find((r: { id: string }) => r.id === ids.seedResult!.id) ?? studentResults[0] : studentResults[0];
    expect(updated.status).toBe('IN_PROGRESS');
  });

  it('PATCH recalcula um resultado individual', async () => {
    const before = await api.get(`/api/v1/results/${ids.seedResult.id}`);
    expect(before.status).toBe(200);

    const recalc = await api.patch(`/api/v1/results/${ids.seedResult.id}`).send({});
    expect(recalc.status).toBe(200);
    expect(recalc.body.data).toHaveProperty('average');
    expect(recalc.body.data).toHaveProperty('status');
  });

  it('POST /results recalcula em lote a turma/disciplina/período', async () => {
    const res = await api.post('/api/v1/results').send({
      termId: ids.termId,
      classId: ids.classId,
      subjectId: ids.subjectId,
    });
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('cria horário, valida conflito 409 e elimina', async () => {
    const dayOfWeek = 'SATURDAY';
    const startTime = '10:00';
    const endTime = '11:40';
    const room = unique('sala');

    const payload = (roomOverride: string = room) => ({
      academicYearId: ids.academicYearId,
      termId: ids.termId,
      classId: ids.classId,
      subjectId: ids.subjectId,
      teacherId: ids.teacherId,
      dayOfWeek,
      startTime,
      endTime,
      room: roomOverride,
    });

    const first = await api.post('/api/v1/schedules').send(payload());
    expect(first.status).toBe(201);
    created.schedules.push(first.body.data.id);

    const conflict = await api.post('/api/v1/schedules').send(payload());
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('CONFLICT');
    expect(Array.isArray(conflict.body.details)).toBe(true);

    const del = await api.delete(`/api/v1/schedules/${first.body.data.id}`);
    expect(del.status).toBe(200);
    created.schedules = created.schedules.filter((id) => id !== first.body.data.id);
  });

  it('obtém horário por ID', async () => {
    const payload = {
      academicYearId: ids.academicYearId,
      termId: ids.termId,
      classId: ids.classId,
      subjectId: ids.subjectId,
      teacherId: ids.teacherId,
      dayOfWeek: 'SATURDAY',
      startTime: '14:00',
      endTime: '15:00',
      room: unique('sala-get'),
    };
    const createdRes = await api.post('/api/v1/schedules').send(payload);
    expect(createdRes.status).toBe(201);
    created.schedules.push(createdRes.body.data.id);

    const getRes = await api.get(`/api/v1/schedules/${createdRes.body.data.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(createdRes.body.data.id);
    expect(getRes.body.data.dayOfWeek).toBe('SATURDAY');
    expect(getRes.body.data.startTime).toBe('14:00');

    await api.delete(`/api/v1/schedules/${createdRes.body.data.id}`);
    created.schedules = created.schedules.filter((id) => id !== createdRes.body.data.id);
  });

  it('actualiza um horário (dia, hora, sala)', async () => {
    const payload = {
      academicYearId: ids.academicYearId,
      termId: ids.termId,
      classId: ids.classId,
      subjectId: ids.subjectId,
      teacherId: ids.teacherId,
      dayOfWeek: 'FRIDAY',
      startTime: '16:00',
      endTime: '17:00',
      room: unique('sala-patch'),
    };
    const createdRes = await api.post('/api/v1/schedules').send(payload);
    expect(createdRes.status).toBe(201);
    created.schedules.push(createdRes.body.data.id);

    const patchRes = await api
      .patch(`/api/v1/schedules/${createdRes.body.data.id}`)
      .send({ startTime: '16:30', endTime: '17:30', room: unique('sala-nova') });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.startTime).toBe('16:30');
    expect(patchRes.body.data.endTime).toBe('17:30');

    await api.delete(`/api/v1/schedules/${createdRes.body.data.id}`);
    created.schedules = created.schedules.filter((id) => id !== createdRes.body.data.id);
  });

  it('404 para horário inexistente', async () => {
    const res = await api.get('/api/v1/schedules/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('conflito de sala apenas (mesma sala, dia e período, diferente professor/turma)', async () => {
    const room = unique('sala-conflict');
    const base = {
      academicYearId: ids.academicYearId,
      termId: ids.termId,
      subjectId: ids.subjectId,
      dayOfWeek: 'SATURDAY',
      startTime: '08:00',
      endTime: '09:00',
      room,
    };
    const first = await api.post('/api/v1/schedules').send({
      ...base,
      classId: ids.classId,
      teacherId: ids.teacherId,
    });
    expect(first.status).toBe(201);
    created.schedules.push(first.body.data.id);

    // A 2ª turma e o 2º docente são criados aqui (e não procurados na base)
    // porque o conflito tem de ser *apenas* de sala. Uma turma de outra escola
    // ou de outro ano letivo faria o `createSchedule` devolver 409 pela validação
    // de ano letivo — o mesmo status, mas com `details` sem `ROOM` — e o teste
    // deixaria de provar a regra que diz verificar.
    const classRecord2 = await prisma.class.create({
      data: {
        schoolId: testContext.schoolId,
        academicYearId: ids.academicYearId,
        name: unique('Turma'),
        grade: '2',
        status: 'ACTIVE',
      },
    });
    const teacher2 = await prisma.teacher.create({
      data: { schoolId: testContext.schoolId, name: unique('Docente'), status: 'ACTIVE' },
    });

    const conflict = await api.post('/api/v1/schedules').send({
      ...base,
      classId: classRecord2.id,
      teacherId: teacher2.id,
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('CONFLICT');
    expect(conflict.body.details).toEqual([
      expect.objectContaining({ type: 'ROOM', message: expect.stringContaining(room) }),
    ]);

    await api.delete(`/api/v1/schedules/${first.body.data.id}`);
    created.schedules = created.schedules.filter((id) => id !== first.body.data.id);
  });

  it('elimina resultado existente e verifica 404 após delete', async () => {
    if (!ids.seedResult) return;

    const before = await api.get(`/api/v1/results/${ids.seedResult.id}`);
    expect(before.status).toBe(200);

    const del = await api.delete(`/api/v1/results/${ids.seedResult.id}`);
    expect(del.status).toBe(200);
    expect(del.body.data).toEqual({ id: ids.seedResult.id, deleted: true });

    const after = await api.get(`/api/v1/results/${ids.seedResult.id}`);
    expect(after.status).toBe(404);
  });

  it('404 para resultado inexistente no DELETE', async () => {
    const res = await api.delete('/api/v1/results/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('impressão do horário da turma', async () => {
    const res = await api.get(`/api/v1/print/class/${ids.classId}/schedule`).query({ termId: ids.termId });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('className');
    expect(Array.isArray(res.body.data.schedules)).toBe(true);
  });

  it('impressão da pauta exige subjectId (400 BAD_REQUEST)', async () => {
    const res = await api.get(`/api/v1/print/class/${ids.classId}/pauta`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('openapi.json documenta as rotas e o esquema de segurança Bearer', async () => {
    const res = await api.get('/api/openapi.json');
    expect(res.status).toBe(200);
    const doc = res.body;
    expect(doc.openapi).toBe('3.0.0');
    const paths = Object.keys(doc.paths);
    expect(paths).toContain('/api/v1/assessments');
    expect(paths).toContain('/api/v1/results');
    expect(paths).toContain('/api/v1/auth/login');
    expect(paths).not.toContain('/api/v1/schedules-assessments/evaluations');
    const scheme = doc.components?.securitySchemes?.BearerAuth;
    expect(scheme?.type).toBe('http');
    expect(scheme?.scheme).toBe('bearer');
    expect(JSON.stringify(doc)).toContain('"security"');
    expect(JSON.stringify(doc)).not.toMatch(/passwordHash|senhaHash|tokenHash/i);
  });
});