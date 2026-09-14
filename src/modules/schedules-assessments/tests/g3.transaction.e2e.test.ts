import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { SchedulesAssessmentsService } from '../application/schedulesAssessmentsService';

describe('G3 transações ACID (nível de serviço)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('lançar nota + recálculo é atómico: falha no recálculo faz rollback total', async () => {
    const term = await prisma.term.findFirst({ where: { name: { startsWith: '1º' } } });
    const academicYear = await prisma.academicYear.findFirst({ where: { status: 'ACTIVE' } });
    const classRecord = await prisma.class.findFirst({ where: { status: 'ACTIVE' } });
    const subject = await prisma.subject.findFirst({ where: { status: 'ACTIVE' } });
    const teacher = await prisma.teacher.findFirst({ where: { status: 'ACTIVE' } });
    const enrollment = await prisma.enrollment.findFirst({
      where: { status: 'ACTIVE', termId: term.id, classId: classRecord.id, subjectId: subject.id },
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
      service.createGrade(assessment.id, { studentId: enrollment.studentId, score: 15 }),
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
    expect(resultAfter.average.toString()).toBe(resultBefore.average.toString());
    expect(resultAfter.status).toBe(resultBefore.status);

    await prisma.assessment.delete({ where: { id: assessment.id } });
  });

  it('lançar nota + recálculo é atómico: sucesso persiste tudo', async () => {
    const term = await prisma.term.findFirst({ where: { name: { startsWith: '1º' } } });
    const academicYear = await prisma.academicYear.findFirst({ where: { status: 'ACTIVE' } });
    const classRecord = await prisma.class.findFirst({ where: { status: 'ACTIVE' } });
    const subject = await prisma.subject.findFirst({ where: { status: 'ACTIVE' } });
    const teacher = await prisma.teacher.findFirst({ where: { status: 'ACTIVE' } });
    const enrollment = await prisma.enrollment.findFirst({
      where: { status: 'ACTIVE', termId: term.id, classId: classRecord.id, subjectId: subject.id },
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
    const grade = await service.createGrade(assessment.id, {
      studentId: enrollment.studentId,
      score: 18,
    });
    expect(grade.score).toBe(18);

    const persisted = await prisma.grade.findUnique({
      where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: enrollment.studentId } },
    });
    expect(persisted).not.toBeNull();

    await prisma.assessment.delete({ where: { id: assessment.id } });
  });
});