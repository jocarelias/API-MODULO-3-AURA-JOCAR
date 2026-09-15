import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app';

describe('Motor de cálculo de notas (e2e) — API aberta', () => {
  let app: ReturnType<typeof createApp>;
  let server: ReturnType<typeof app.listen>;
  let apiBase: string;

  beforeAll(async () => {
    app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    apiBase = typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}` : '';
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /results/calculation-methods lista os 6 métodos', async () => {
    const res = await request(apiBase).get('/api/v1/results/calculation-methods');
    expect(res.status).toBe(200);
    expect(res.body.meta.correlationId).toBeTruthy();
    const codes = res.body.data.map((m: { code: string }) => m.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'ARITHMETIC_MEAN',
        'WEIGHTED_PERCENTAGE',
        'PERCENTAGE_SUM',
        'NORMALIZED_WEIGHTED_MEAN',
        'COMPONENT_BASED',
        'CUSTOM_WEIGHTED',
      ]),
    );
    for (const method of res.body.data) {
      expect(method.name).toBeTruthy();
      expect(method.formula).toBeTruthy();
    }
  });

  it('calcula média aritmética [10, 12, 14] → 12', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'ARITHMETIC_MEAN',
      items: [{ score: 10 }, { score: 12 }, { score: 14 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.method).toBe('ARITHMETIC_MEAN');
    expect(res.body.data.value).toBe(12);
    expect(res.body.data.breakdown).toHaveLength(3);
    expect(res.body.meta.correlationId).toBeTruthy();
  });

  it('calcula média ponderada percentual 14×30% + 16×70% → 15.4', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'WEIGHTED_PERCENTAGE',
      items: [
        { score: 14, weight: 30 },
        { score: 16, weight: 70 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe(15.4);
    expect(res.body.data.breakdown[0].contribution).toBe(4.2);
    expect(res.body.data.breakdown[1].contribution).toBe(11.2);
  });

  it('calcula soma percentual com contribuições verificadas', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'PERCENTAGE_SUM',
      items: [
        { score: 15, weight: 20 },
        { score: 12, weight: 30 },
        { score: 17, weight: 50 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.breakdown[0].contribution).toBe(3);
    expect(res.body.data.breakdown[1].contribution).toBe(3.6);
    expect(res.body.data.breakdown[2].contribution).toBe(8.5);
    expect(res.body.data.value).toBe(15.1);
  });

  it('normaliza pesos 2, 3, 5 → 16.6', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'NORMALIZED_WEIGHTED_MEAN',
      items: [
        { score: 14, weight: 2 },
        { score: 16, weight: 3 },
        { score: 18, weight: 5 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe(16.6);
    expect(res.body.data.breakdown[0].normalizedWeight).toBe(0.2);
  });

  it('calcula por componentes (Avaliação Contínua + Exame)', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'COMPONENT_BASED',
      items: [],
      components: [
        {
          name: 'Avaliação Contínua',
          weight: 40,
          children: [
            { name: 'Teste 1', weight: 30, score: 14 },
            { name: 'Teste 2', weight: 30, score: 16 },
            { name: 'Trabalho', weight: 40, score: 18 },
          ],
        },
        { name: 'Exame', weight: 60, score: 17 },
      ],
    });
    expect(res.status).toBe(200);
    const ac = 14 * 0.3 + 16 * 0.3 + 18 * 0.4;
    const finalExpected = ac * 0.4 + 17 * 0.6;
    expect(res.body.data.value).toBe(Math.round(finalExpected * 100) / 100);
    expect(res.body.data.breakdown[0].children).toHaveLength(3);
  });

  it('executa cálculo personalizado registado (WEIGHTED_100)', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'CUSTOM_WEIGHTED',
      formula: 'WEIGHTED_100',
      items: [
        { score: 14, weight: 30 },
        { score: 16, weight: 70 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe(15.4);
    expect(res.body.data.formula).toBe('WEIGHTED_100');
  });

  it('arredondamento a 0 casas decimais', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'ARITHMETIC_MEAN',
      items: [{ score: 10 }, { score: 11 }, { score: 12 }],
      rounding: { decimals: 0 },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe(11);
    expect(res.body.data.decimals).toBe(0);
  });

  it('400 — método de cálculo inválido', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'MEDIA_INEXISTENTE',
      items: [{ score: 10 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('400 — lista vazia rejeitada', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'ARITHMETIC_MEAN',
      items: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400 — nota inválida (negativa)', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'ARITHMETIC_MEAN',
      items: [{ score: -5 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400 — peso inválido (negativo)', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'WEIGHTED_PERCENTAGE',
      items: [{ score: 10, weight: -1 }],
    });
    expect(res.status).toBe(400);
  });

  it('400 — CUSTOM_WEIGHTED sem fórmula', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'CUSTOM_WEIGHTED',
      items: [{ score: 10 }],
    });
    expect(res.status).toBe(400);
  });

  it('400 — COMPONENT_BASED sem componentes', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'COMPONENT_BASED',
      items: [],
    });
    expect(res.status).toBe(400);
  });

  it('409 — pesos incompatíveis com o método (WEIGHTED_PERCENTAGE)', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'WEIGHTED_PERCENTAGE',
      items: [
        { score: 14, weight: 20 },
        { score: 16, weight: 30 },
      ],
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('409 — percentagens não totalizam 100 (PERCENTAGE_SUM)', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'PERCENTAGE_SUM',
      items: [
        { score: 10, weight: 40 },
        { score: 10, weight: 40 },
      ],
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('404 — assessment inexistente', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'ARITHMETIC_MEAN',
      items: [{ assessmentId: '99999999-9999-4999-8999-999999999999', score: 10 }],
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.details[0]).toHaveProperty('assessmentId');
  });

  it('400 — fórmula não registada (CUSTOM_WEIGHTED)', async () => {
    const res = await request(apiBase).post('/api/v1/results/calculate').send({
      method: 'CUSTOM_WEIGHTED',
      formula: 'NAO_EXISTE',
      items: [{ score: 10 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});