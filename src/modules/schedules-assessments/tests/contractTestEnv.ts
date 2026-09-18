import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { signToken } from '@smartcampus/auth';

export const TEST_JWT_SECRET = 'g3-e2e-secret';
process.env.SMARTCAMPUS_JWT_SECRET = TEST_JWT_SECRET;
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

  const schoolId = randomUUID();
  await prisma.school.create({
    data: { id: schoolId, name: `G3 E2E ${schoolId.slice(0, 6)}`, code: `GE2${schoolId.slice(0, 3)}`, status: 'ACTIVE' },
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
    },
  };
}