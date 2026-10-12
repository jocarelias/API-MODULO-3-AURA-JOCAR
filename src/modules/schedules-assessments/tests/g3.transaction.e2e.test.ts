import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { SchedulesAssessmentsService } from '../application/schedulesAssessmentsService';
import { startContractServices, createEnrolledStudent, ContractTestContext } from './contractTestEnv';

describe('G3 transações ACID (nível de serviço)', () => {
  let prisma: PrismaClient;
  let ctx: { token: string; correlationId: string };
  let testContext: ContractTestContext;
  let studentId: string;

  beforeAll(async () => {
    testContext = await startContractServices();
    prisma = new PrismaClient();
    ctx = { token: testContext.token, correlationId: 'e2e-acid' };
    // A escola descartável nasce sem alunos: sem uma matrícula real não há
    // `enrollment` nem Result sobre os quais provar o rollback. O aluno é
    // criado na mesma escola do token (ver nota em contract-debt).
    studentId = (await createEnrolledStudent(testContext, 'acid')).studentId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await testContext.stop();
  });

  it('lançar nota + recálculo é atómico: falha no recálculo faz rollback total', async () => {
    const fx = testContext.fixtures;
    const term = { id: fx.termId, schoolId: fx.schoolId, name: fx.termName };
    const academicYear = { id: fx.academicYearId, name: fx.academicYearName };
    const classRecord = { id: fx.classId, name: fx.className };
    const subject = { id: fx.subjectId, name: fx.subjectName, code: fx.subjectCode };
    const teacher = { id: fx.teacherId, name: fx.teacherName };
    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { status: 'ACTIVE', termId: term.id, classId: classRecord.id, subjectId: subject.id, studentId },
    });

    const name = `e2e-acid-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const assessment = await prisma.assessment.create({
      data: {
        schoolId: term.schoolId,
        academicYearId: academicYear.id,
        termId: term.id,
        classId: classRecord.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        name,
        type: 'TEST',
        date: new Date(),
        maxScore: 20,
        weight: 1,
        status: 'OPEN',
      },
    });

    const resultBefore = await prisma.result.findUnique({
      where: {
        studentId_classId_subjectId_termId: {
          studentId: enrollment.studentId,
          classId: classRecord.id,
          subjectId: subject.id,
          termId: term.id,
        },
      },
    });

    const service = new SchedulesAssessmentsService();
    service._recalculateInTx = async () => {
      throw new Error('falha forçada no recálculo');
    };

    await expect(
      service.createGrade(assessment.id, { studentId: enrollment.studentId, score: 15 }, ctx),
    ).rejects.toThrow('falha forçada no recálculo');

    const grade = await prisma.grade.findUnique({
      where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: enrollment.studentId } },
    });
    expect(grade).toBeNull();

    const resultAfter = await prisma.result.findUnique({
      where: {
        studentId_classId_subjectId_termId: {
          studentId: enrollment.studentId,
          classId: classRecord.id,
          subjectId: subject.id,
          termId: term.id,
        },
      },
    });
    if (resultBefore) {
      expect(resultAfter).not.toBeNull();
      expect(resultAfter!.average.toString()).toBe(resultBefore.average.toString());
      expect(resultAfter!.status).toBe(resultBefore.status);
    } else {
      expect(resultAfter).toBeNull();
    }

    await prisma.assessment.delete({ where: { id: assessment.id } });
  });

  it('lançar nota + recálculo é atómico: sucesso persiste tudo', async () => {
    const fx = testContext.fixtures;
    const term = { id: fx.termId, schoolId: fx.schoolId, name: fx.termName };
    const academicYear = { id: fx.academicYearId, name: fx.academicYearName };
    const classRecord = { id: fx.classId, name: fx.className };
    const subject = { id: fx.subjectId, name: fx.subjectName, code: fx.subjectCode };
    const teacher = { id: fx.teacherId, name: fx.teacherName };
    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { status: 'ACTIVE', termId: term.id, classId: classRecord.id, subjectId: subject.id, studentId },
    });

    const name = `e2e-acid-ok-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const assessment = await prisma.assessment.create({
      data: {
        schoolId: term.schoolId,
        academicYearId: academicYear.id,
        termId: term.id,
        classId: classRecord.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        name,
        type: 'TEST',
        date: new Date(),
        maxScore: 20,
        weight: 1,
        status: 'OPEN',
      },
    });

    const service = new SchedulesAssessmentsService();
    const grade = await service.createGrade(
      assessment.id,
      { studentId: enrollment.studentId, score: 18 },
      ctx,
    );
    expect(grade.score).toBe(18);

    const persisted = await prisma.grade.findUnique({
      where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: enrollment.studentId } },
    });
    expect(persisted).not.toBeNull();

    await prisma.assessment.delete({ where: { id: assessment.id } });
  });
});