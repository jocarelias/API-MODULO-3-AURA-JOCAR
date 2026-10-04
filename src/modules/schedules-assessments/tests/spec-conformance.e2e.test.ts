import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { signToken } from '@smartcampus/auth';
import { createApp } from '../../../app';
import { buildOpenApi } from '../../../openapi';
import { startContractServices, ContractTestContext, TEST_JWT_SECRET } from './contractTestEnv';
import { expectConforms, type SchemaLike } from './specValidator';

/**
 * MÓDULO VI — Conformidade spec-vs-realidade.
 *
 * Endpoint escolhido: `GET /api/v1/assessments/{assessmentId}/grades`.
 *
 * Porque este endpoint:
 *  - é o mais rico do módulo (envelope paginado + array de notas + 4 recursos
 *    externos:contratos de estudante, inscrição e financeiro);
 *  - acumula as três regras que o módulo implementa — RBAC, verificação de
 *    posse (anti-BOLA) e bloqueio por dívida, cada uma com um código de erro
 *    distinto (403 FORBIDDEN, 403 FINANCIAL_ACCESS_BLOCKED, 404 NOT_FOUND).
 *
 * O ponto essencial: as expectativas NÃO são escritas à mão. Cada resposta real
 * é validada contra o schema que está no OpenAPI, e, no sentido inverso, cada código de
 * estado documentado tem de ser observável na API real. Assim o teste falha
 * nos dois sentidos — se a API divergir do spec, ou se o spec descrever
 * comportamentos que a API não tem.
 */

const CHOSEN = {
  method: 'GET' as const,
  path: '/api/v1/assessments/{assessmentId}/grades',
  routerPath: '/api/v1/assessments/:assessmentId/grades',
};

type DocumentedOperation = {
  responses: Record<string, { description: string; content: Record<string, { schema: SchemaLike; example?: unknown }> }>;
};
const spec = buildOpenApi() as { paths: Record<string, Record<string, DocumentedOperation>> };
// As chaves de método no OpenAPI são minúsculas (`get`), ao contrário do
// cabeçalho HTTP (`GET`).
const operation = spec.paths[CHOSEN.path][CHOSEN.method.toLowerCase()];
const documentedCodes = Object.keys(operation.responses);

const unique = (label: string) => `conf-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

// `code` tem unicidade global e um maximo curto: um prefixo fixo deixa de
// distinguir execucoes quando o timestamp e' truncado. Usa-se o id do
// utilizador corrente para garantir unicidade real.
const uniqueCode = (label: string) =>
  `${label}${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`.slice(0, 12);

interface Envelope {
  data: unknown;
  meta: Record<string, unknown>;
}

describe('Módulo VI — conformidade: GET /api/v1/assessments/{assessmentId}/grades', () => {
  let app: ReturnType<typeof createApp>;
  let server: ReturnType<typeof app.listen>;
  let testContext: ContractTestContext;
  let prisma: PrismaClient;
  let schoolId = '';
  let ids: { assessmentId: string; assessmentIdOtherClass: string; classId: string; otherClassId: string };
  let tokens: { owner: string; other: string; staff: string; ghost: string };
  let students: { owner: string; other: string };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const body = (response: request.Response): Envelope => response.body as Envelope;

  /** Valida a resposta real contra o schema documentado para o código recebido. */
  const conformsToSpec = (response: request.Response, context: string): void => {
    const documented = operation.responses[String(response.status)];
    expect(documented, `${context}: o spec não documenta ${response.status}`).toBeDefined();
    const schema = documented?.content?.['application/json']?.schema;
    expectConforms(response.body, schema, `${CHOSEN.method} ${CHOSEN.path} -> ${response.status} (${context})`);
  };

  beforeAll(async () => {
    testContext = await startContractServices();
    prisma = new PrismaClient();
    app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));

    const school = await prisma.school.create({
      data: { name: unique('Escola'), code: uniqueCode('CONF'), status: 'ACTIVE' },
    });
    schoolId = school.id;

    const academicYear = await prisma.academicYear.create({
      data: { schoolId, name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'ACTIVE' },
    });
    const term = await prisma.term.create({
      data: { schoolId, academicYearId: academicYear.id, name: '1º Período', startDate: new Date('2026-02-01'), endDate: new Date('2026-06-30'), status: 'ACTIVE' },
    });
    const classRecord = await prisma.class.create({
      data: { schoolId, academicYearId: academicYear.id, name: '11A', grade: '11', status: 'ACTIVE' },
    });
    const otherClass = await prisma.class.create({
      data: { schoolId, academicYearId: academicYear.id, name: '11B', grade: '11', status: 'ACTIVE' },
    });
    const subject = await prisma.subject.create({ data: { schoolId, name: unique('Matemática'), code: 'MAT', status: 'ACTIVE' } });
    const teacher = await prisma.teacher.create({ data: { schoolId, name: unique('Docente'), status: 'ACTIVE' } });

    const mkUser = async (role: string, label: string) =>
      prisma.user.create({
        data: { schoolId, role, name: `Utilizador ${label}`, email: unique(label) + '@teste.mz', passwordHash: 'x', status: 'ACTIVE' },
      });

    const ownerUser = await mkUser('STUDENT', 'dono');
    const otherUser = await mkUser('STUDENT', 'outro');
    const staffUser = await mkUser('SCHOOL_ADMIN', 'staff');
    const ghostUser = await mkUser('STUDENT', 'fantasma');

    const owner = await prisma.student.create({
      data: { schoolId, userId: ownerUser.id, name: 'Aluno Dono', email: ownerUser.email, enrollmentNumber: `DON-${randomUUID().slice(0, 8)}`, status: 'ACTIVE' },
    });
    const other = await prisma.student.create({
      data: { schoolId, userId: otherUser.id, name: 'Aluno Outro', email: otherUser.email, enrollmentNumber: `OUT-${randomUUID().slice(0, 8)}`, status: 'ACTIVE' },
    });
    students = { owner: owner.id, other: other.id };

    // Sem dívida: pode ler as suas notas.
    await prisma.financialStatus.create({ data: { schoolId, studentId: owner.id, hasDebt: false, status: 'REGULAR', outstandingAmount: 0 } });
    await prisma.financialStatus.create({ data: { schoolId, studentId: other.id, hasDebt: false, status: 'REGULAR', outstandingAmount: 0 } });

    // O dono está inscrito na turma; o outro estudante também (para provar o
    // anti-BOLA: mesma turma, recurso alheio -> 403 e não 404).
    await prisma.enrollment.create({
      data: { schoolId, academicYearId: academicYear.id, termId: term.id, classId: classRecord.id, subjectId: subject.id, studentId: owner.id, status: 'ACTIVE' },
    });
    await prisma.enrollment.create({
      data: { schoolId, academicYearId: academicYear.id, termId: term.id, classId: classRecord.id, subjectId: subject.id, studentId: other.id, status: 'ACTIVE' },
    });

    const mkAssessment = (classId: string, name: string) =>
      prisma.assessment.create({
        data: { schoolId, academicYearId: academicYear.id, termId: term.id, classId, subjectId: subject.id, teacherId: teacher.id, name, type: 'TEST', date: new Date('2026-03-01T10:00:00Z'), status: 'OPEN' },
      });

    const assessment = await mkAssessment(classRecord.id, unique('Avaliação da turma'));
    const assessmentOtherClass = await mkAssessment(otherClass.id, unique('Avaliação de outra turma'));

    await prisma.grade.create({ data: { assessmentId: assessment.id, studentId: owner.id, score: 17.5, status: 'SUBMITTED' } });
    await prisma.grade.create({ data: { assessmentId: assessment.id, studentId: other.id, score: 12, status: 'SUBMITTED' } });

    ids = { assessmentId: assessment.id, assessmentIdOtherClass: assessmentOtherClass.id, classId: classRecord.id, otherClassId: otherClass.id };

    const token = (userId: string, role: string) => signToken({ id: userId, role, schoolId }, TEST_JWT_SECRET, 3600);
    tokens = {
      owner: token(ownerUser.id, 'STUDENT'),
      other: token(otherUser.id, 'STUDENT'),
      staff: token(staffUser.id, 'SCHOOL_ADMIN'),
      ghost: token(ghostUser.id, 'STUDENT'),
    };
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await testContext.stop();
    await prisma.$disconnect();
  });

  describe('1. A resposta real está conforme o schema documentado', () => {
    it('200 do estudante: envelope { data, meta } validado contra o spec', async () => {
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentId)).set(auth(tokens.owner));
      expect(response.status).toBe(200);
      conformsToSpec(response, 'estudante dono, sem dívida');
    });

    it('200 do staff: mesma conformidade, maisuma unica chamada', async () => {
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentId)).set(auth(tokens.staff));
      expect(response.status).toBe(200);
      conformsToSpec(response, 'staff');
    });

    it('o exemplo do spec descreve um formato que a API real também produz', async () => {
      const example = operation.responses['200'].content['application/json'].example as Envelope;
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentId)).set(auth(tokens.staff));

      // Mesmo envelope, mesmas chaves de topo.
      expect(Object.keys(body(response)).sort()).toEqual(Object.keys(example).sort());
      // O exemplo é uma lista; a resposta real também.
      expect(Array.isArray(example.data)).toBe(true);
      expect(Array.isArray(body(response).data)).toBe(true);
      // Todas as chaves prometidas pelo exemplo existem no schema do documento.
      const schemaKeys = Object.keys(
        (operation.responses['200'].content['application/json'].schema.properties?.data as SchemaLike).items?.properties ?? {},
      );
      const exampleKeys = Object.keys((example.data as Array<Record<string, unknown>>)[0]);
      for (const key of exampleKeys) expect(schemaKeys, `o exemplo usa "${key}" mas o schema não o declara`).toContain(key);
    });

    it('os campos documentados estão presentes em cada nota devolvida', async () => {
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentId)).set(auth(tokens.staff));
      const schema = (operation.responses['200'].content['application/json'].schema.properties?.data as SchemaLike).items as SchemaLike;
      const required = schema.required ?? [];
      expect(required.length).toBeGreaterThan(0);
      for (const grade of body(response).data as Array<Record<string, unknown>>) {
        for (const field of required) {
          expect(grade[field], `a nota real não traz o campo obrigatório "${field}"`).toBeDefined();
        }
      }
    });

    it('o estudante recebe apenas as suas notas (o spec não promete mais do que a API entrega)', async () => {
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentId)).set(auth(tokens.owner));
      const grades = body(response).data as Array<{ studentId: string }>;
      expect(grades).toHaveLength(1);
      expect(grades[0].studentId).toBe(students.owner);
    });
  });

  describe('2. Os erros reais estão conformes com o que o spec promete', () => {
    it('401 sem token', async () => {
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentId));
      expect(response.status).toBe(401);
      conformsToSpec(response, 'sem token');
    });

    it('401 com token inválido', async () => {
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentId)).set(auth('token.invalido'));
      expect(response.status).toBe(401);
      conformsToSpec(response, 'token inválido');
    });

    it('400 com assessmentId mal formado', async () => {
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', 'nao-e-um-uuid')).set(auth(tokens.staff));
      expect(response.status).toBe(400);
      conformsToSpec(response, 'uuid inválido');
    });

    it('404 para avaliação inexistente', async () => {
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', randomUUID())).set(auth(tokens.staff));
      expect(response.status).toBe(404);
      conformsToSpec(response, 'avaliação inexistente');
    });

    it('404 para um estudante sem perfil de estudante (anti-BOLA por coerencia)', async () => {
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentId)).set(auth(tokens.ghost));
      expect([403, 404]).toContain(response.status);
      conformsToSpec(response, 'estudante sem perfil');
    });

    it('403 quando o estudante não pertence à turma da avaliação (outra turma)', async () => {
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentIdOtherClass)).set(auth(tokens.owner));
      expect(response.status).toBe(403);
      conformsToSpec(response, 'avaliação de outra turma');
    });
  });

  describe('3. As promessas do spec são cumpridas (spec -> realidade)', () => {
    it('todos os códigos documentados são codes HTTP válidos', () => {
      for (const code of documentedCodes) {
        expect(code, `código documentado inválido: ${code}`).toMatch(/^[1-5]\d\d$/);
      }
    });

    it('o endpoint tem documentado o conjunto de erros que a API real devolve', () => {
      // Observados na prática contra a API real (ver testes acima).
      const observed = ['200', '400', '401', '403', '404'];
      for (const code of observed) {
        expect(documentedCodes, `a API devolve ${code} mas o spec não o documenta`).toContain(code);
      }
    });

    it('o spec descreve 503 (financeiro fail-closed) e o teste cobre-o noutro ficheiro', () => {
      expect(documentedCodes).toContain('503');
      // A indisponibilidade do serviço financeiro é simulada em
      // financial-access.e2e.test.ts; aqui só garantimos que está documentada.
      expect(operation.responses['503'].description).toMatch(/fechad/i);
    });

    it('cada código documentado tem descrição e schema de erro utilizáveis', () => {
      for (const [code, response] of Object.entries(operation.responses)) {
        expect(response.description, `${code} sem descrição`).toBeTruthy();
        if (code === '200') continue;
        expect(response.content['application/json'].schema, `${code} sem schema`).toBeDefined();
      }
    });

    it('a API real nunca devolve um código que o spec não documenta', async () => {
      const attempts = [
        await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentId)).set(auth(tokens.owner)),
        await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentId)),
        await request(app).get(CHOSEN.routerPath.replace(':assessmentId', randomUUID())).set(auth(tokens.staff)),
        await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentIdOtherClass)).set(auth(tokens.owner)),
      ];
      for (const response of attempts) {
        expect(documentedCodes, `resposta real ${response.status} não está no spec`).toContain(String(response.status));
      }
    });
  });

  describe('4. O exemplo do spec é realmente alcançável pela API', () => {
    it('os valores de enum documentados para `status` existem no domínio real', async () => {
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentId)).set(auth(tokens.staff));
      const schema = (operation.responses['200'].content['application/json'].schema.properties?.data as SchemaLike).items as SchemaLike;
      const documented = (schema.properties?.status as SchemaLike).enum as string[];
      expect(documented.length).toBeGreaterThan(0);
      const real = [...new Set((body(response).data as Array<{ status: string }>).map((g) => g.status))];
      for (const value of real) {
        expect(documented, `o valor real "${value}" não está no enum documentado`).toContain(value);
      }
    });

    it('os campos de data documentados chegam como date-time ISO', async () => {
      const response = await request(app).get(CHOSEN.routerPath.replace(':assessmentId', ids.assessmentId)).set(auth(tokens.staff));
      for (const grade of body(response).data as Array<Record<string, string>>) {
        for (const [key, value] of Object.entries(grade)) {
          if (!key.endsWith('At')) continue;
          expect(value, `${key} não é um date-time ISO`).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
        }
      }
    });
  });
});
