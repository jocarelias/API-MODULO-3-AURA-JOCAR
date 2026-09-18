import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app';
import { prisma } from '../infrastructure/prisma';
import { startContractServices, ContractTestContext } from './contractTestEnv';

describe('G3 cenários de erro (400, 404, 500) — API autenticada', () => {
  let app: ReturnType<typeof createApp>;
  let server: ReturnType<typeof app.listen>;
  let apiBase: string;
  let api: ReturnType<typeof request.agent>;
  let testContext: ContractTestContext;

  beforeAll(async () => {
    testContext = await startContractServices();
    app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    apiBase = typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}` : '';
    api = request.agent(apiBase).set('authorization', `Bearer ${testContext.token}`);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise((resolve) => server.close(resolve));
    await testContext.stop();
  });

  it('400 — VALIDATION_ERROR para payload inválido (peso zero)', async () => {
    const res = await api
      .post('/api/v1/assessments')
      .send({ name: 'Cenário 400', type: 'TESTE', weight: 0 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details[0]).toHaveProperty('field');
    expect(res.body.correlationId).toBeTruthy();
  });

  it('404 — NOT_FOUND para recurso inexistente', async () => {
    const res = await api.get('/api/v1/assessments/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.message).toBe('Avaliação não encontrada');
    expect(res.body.correlationId).toBeTruthy();
  });

  it('500 — INTERNAL_ERROR quando a infraestrutura falha', async () => {
    const countSpy = vi
      .spyOn(prisma.assessment, 'count')
      .mockRejectedValueOnce(new Error('falha simulada do banco de dados'));

    const res = await api.post('/api/v1/results').send({
      termId: '67bf93dc-7803-430c-9e03-0d34e450440f',
      classId: '497ec6cc-2ba3-4777-abed-9f6a86c1dd52',
      subjectId: '03e61c5c-446f-40c2-99ba-63aca10c6b9c',
    });

    expect(countSpy).toHaveBeenCalled();
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(res.body.message).toBe('Erro interno do servidor');
    expect(res.body.correlationId).toBeTruthy();
    countSpy.mockRestore();
  });
});