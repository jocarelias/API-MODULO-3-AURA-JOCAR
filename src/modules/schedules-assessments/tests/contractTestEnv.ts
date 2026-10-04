import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { signToken } from '@smartcampus/auth';

export const TEST_JWT_SECRET = 'g3-e2e-secret';
process.env.SMARTCAMPUS_JWT_SECRET = TEST_JWT_SECRET;
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;
process.env.JWT_REFRESH_SECRET = 'g3-e2e-refresh-secret';
process.env.JWT_ACCESS_EXPIRES_IN = '3600';
process.env.JWT_REFRESH_EXPIRES_IN = '86400';
process.env.FINANCIAL_SERVICE_TOKEN = 'g3-e2e-service-token';
process.env.SMARTCAMPUS_SERVICE_TOKEN = 'g3-e2e-service-token';

export interface ContractTestContext {
  token: string;
  role: string;
  schoolId: string;
  stop: () => Promise<void>;
}

function listen(serverLike: Express, servers: Server[]): Promise<string> {
  return new Promise((resolve) => {
    const server = serverLike.listen(0, '127.0.0.1', () => {
      servers.push(server);
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });
}

export async function startContractServices(): Promise<ContractTestContext> {
  const prisma = new PrismaClient();

  const seedTerm = await prisma.term.findFirst({ where: { name: { startsWith: '1º' } } });
  if (seedTerm) {
    await prisma.$executeRawUnsafe(
      `UPDATE "financial_statuses" SET "hasDebt" = false, "status" = 'REGULAR', "outstandingAmount" = 0 WHERE "status" = 'IN_DEBT' AND "schoolId" = '${seedTerm.schoolId}'`,
    );
  }

  // O código tem de ser praticamente único: cada ficheiro de teste cria a sua
  // escola e `code` tem um índice único. Com apenas 3 caracteres hexadecimais
  // (~4 mil combinações) passavam a colidir com regularidade, tornando a suite
  // intermitente. Usamos 12 caracteres + PID para garantir unicidade.
  const schoolId = randomUUID();
  const schoolCode = `GE2${schoolId.replace(/-/g, '').slice(0, 12)}${process.pid.toString(36)}`.slice(0, 24);
  await prisma.school.create({
    data: { id: schoolId, name: `G3 E2E ${schoolId.slice(0, 6)}`, code: schoolCode, status: 'ACTIVE' },
  });
  const userId = randomUUID();
  await prisma.user.create({
    data: { id: userId, schoolId, role: 'SCHOOL_ADMIN', name: 'G3 E2E Admin', email: `e2e.admin.${schoolId}@teste.mz`, passwordHash: 'x', status: 'ACTIVE' },
  });
  await prisma.$disconnect();

  const token = signToken({ id: userId, role: 'SCHOOL_ADMIN', schoolId }, TEST_JWT_SECRET, 3600);

  const servers: Server[] = [];
  const [{ createApp: createStudents }, { createApp: createTeachers }, { createApp: createEnrolments }, { createApp: createFinance }] = await Promise.all([
    import('../../../../services/students/src/app'),
    import('../../../../services/teachers/src/app'),
    import('../../../../services/enrolments/src/app'),
    import('../../../../services/finance/src/app'),
  ]);

  const [students, teachers, enrolments, finance] = await Promise.all([
    listen(createStudents(), servers),
    listen(createTeachers(), servers),
    listen(createEnrolments(), servers),
    listen(createFinance(), servers),
  ]);

  process.env.STUDENTS_SERVICE_URL = students;
  process.env.TEACHERS_SERVICE_URL = teachers;
  process.env.ENROLMENTS_SERVICE_URL = enrolments;
  process.env.FINANCE_SERVICE_URL = finance;

  return {
    token,
    role: 'SCHOOL_ADMIN',
    schoolId,
    stop: async () => {
      await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
      // Limpa a escola descartável (cascata apaga utilizadores, turmas, notas, etc.)
      // para não contaminar execuções seguintes.
      const cleanup = new PrismaClient();
      try {
        await cleanup.school.deleteMany({ where: { id: schoolId } });
      } finally {
        await cleanup.$disconnect();
      }
    },
  };
}
export interface SeedFixtures {
  schoolId: string;
  termId: string;
  academicYearId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
}

/**
 * Resolve as entidades do seed de forma DETERMINÍSTICA.
 *
 * Os testes criam as suas próprias escolas e registos (por exemplo a suite
 * anti-BOLA), pelo que procurar apenas por `status: 'ACTIVE'` ou por
 * `name startsWith '1º'` é ambíguo e torna os testes dependentes da ordem de
 * execução. Aqui ancoramos sempre na escola do seed.
 */
export async function resolveSeedFixtures(prisma: PrismaClient): Promise<SeedFixtures> {
  const term = await prisma.term.findFirst({ where: { name: { startsWith: '1º' } }, orderBy: { createdAt: 'asc' } });
  if (!term) {
    throw new Error('Seed ausente: nenhum período encontrado. Executar `npm run db:seed`.');
  }
  const schoolId = term.schoolId;

  const [academicYear, classRecord, subject, teacher] = await Promise.all([
    prisma.academicYear.findFirst({ where: { schoolId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } }),
    prisma.class.findFirst({ where: { schoolId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } }),
    prisma.subject.findFirst({ where: { schoolId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } }),
    prisma.teacher.findFirst({ where: { schoolId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } }),
  ]);

  if (!academicYear || !classRecord || !subject || !teacher) {
    throw new Error('Seed incompleto: faltam ano letivo, turma, disciplina ou docente');
  }

  return { schoolId, termId: term.id, academicYearId: academicYear.id, classId: classRecord.id, subjectId: subject.id, teacherId: teacher.id };
}
