"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma = new client_1.PrismaClient();
const SCHOOL_ID = (0, node_crypto_1.randomUUID)();
const AY_ID = (0, node_crypto_1.randomUUID)();
const TERM_ID = (0, node_crypto_1.randomUUID)();
const CLASS_IDS = [(0, node_crypto_1.randomUUID)(), (0, node_crypto_1.randomUUID)(), (0, node_crypto_1.randomUUID)()];
const SUBJECT_IDS = [(0, node_crypto_1.randomUUID)(), (0, node_crypto_1.randomUUID)(), (0, node_crypto_1.randomUUID)()];
const TEACHER_IDS = [(0, node_crypto_1.randomUUID)(), (0, node_crypto_1.randomUUID)(), (0, node_crypto_1.randomUUID)(), (0, node_crypto_1.randomUUID)(), (0, node_crypto_1.randomUUID)()];
const STUDENT_IDS = Array.from({ length: 10 }, () => (0, node_crypto_1.randomUUID)());
const CLASS_NAMES = ['Engenharia Informática - 1º Ano', 'Engenharia Informática - 2º Ano', 'Engenharia Informática - 3º Ano'];
const CLASS_ROOMS = ['Sala 204', 'Sala 203', 'Sala 201'];
const SUBJECT_NAMES = ['PTP 3', 'Administração de Redes', 'Programação Paralela'];
const TEACHER_NAMES = ['Armando Correia', 'Leandro Titos', 'Carsolino Sambo', 'Cidalia da Camara', 'Fortunato Farao'];
const STUDENT_NAMES = [
    'Ana JAC', 'Berto Catarina', 'Carlos UC', 'Diana Maputo', 'Eduardo Matola',
    'Fátima Nampula', 'Gabriel Beira', 'Helena Tete', 'Ivan Sofala', 'Julia Zambezia',
];
async function seed() {
    console.log(' A iniciar seed G3 — Avaliações e Horários...');
    await prisma.school.create({
        data: { id: SCHOOL_ID, name: 'UJAC', code: 'UJAC', status: 'ACTIVE' },
    });
    await prisma.academicYear.create({
        data: { id: AY_ID, schoolId: SCHOOL_ID, name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'ACTIVE' },
    });
    await prisma.term.create({
        data: { id: TERM_ID, schoolId: SCHOOL_ID, academicYearId: AY_ID, name: '1º Trimestre', startDate: new Date('2026-01-15'), endDate: new Date('2026-04-15'), status: 'ACTIVE' },
    });
    for (let i = 0; i < CLASS_IDS.length; i++) {
        await prisma.class.create({
            data: { id: CLASS_IDS[i], schoolId: SCHOOL_ID, academicYearId: AY_ID, name: CLASS_NAMES[i], grade: String(i + 1), shift: 'Manhã', room: CLASS_ROOMS[i], status: 'ACTIVE' },
        });
    }
    for (let i = 0; i < SUBJECT_IDS.length; i++) {
        await prisma.subject.create({
            data: { id: SUBJECT_IDS[i], schoolId: SCHOOL_ID, name: SUBJECT_NAMES[i], code: `SUBJ${i + 1}`, status: 'ACTIVE' },
        });
    }
    for (let i = 0; i < TEACHER_IDS.length; i++) {
        await prisma.teacher.create({
            data: { id: TEACHER_IDS[i], schoolId: SCHOOL_ID, name: TEACHER_NAMES[i], email: `prof${i + 1}@ucjac.ac.mz`, status: 'ACTIVE' },
        });
    }
    for (let i = 0; i < STUDENT_IDS.length; i++) {
        await prisma.student.create({
            data: { id: STUDENT_IDS[i], schoolId: SCHOOL_ID, name: STUDENT_NAMES[i], email: `aluno${i + 1}@student.ucjac.ac.mz`, enrollmentNumber: `UCJAC-${2026}-${String(i + 1).padStart(3, '0')}`, status: 'ACTIVE' },
        });
    }
    for (const classId of CLASS_IDS) {
        for (const subjectId of SUBJECT_IDS) {
            for (const studentId of STUDENT_IDS) {
                const existing = await prisma.enrollment.findFirst({
                    where: { studentId, classId, subjectId, termId: TERM_ID },
                });
                if (!existing) {
                    await prisma.enrollment.create({
                        data: { schoolId: SCHOOL_ID, academicYearId: AY_ID, termId: TERM_ID, classId, studentId, subjectId, status: 'ACTIVE' },
                    });
                }
            }
        }
    }
    const assessmentDefs = [
        { classId: CLASS_IDS[0], subjectId: SUBJECT_IDS[0], teacherId: TEACHER_IDS[0], name: 'Teste 1 - PTP 3', type: 'TEST', weight: 1, status: 'OPEN' },
        { classId: CLASS_IDS[0], subjectId: SUBJECT_IDS[1], teacherId: TEACHER_IDS[4], name: 'Teste 1 - Administração de Redes', type: 'TEST', weight: 1, status: 'OPEN' },
        { classId: CLASS_IDS[1], subjectId: SUBJECT_IDS[0], teacherId: TEACHER_IDS[0], name: 'Exame Final - PTP 3', type: 'EXAM', weight: 2, status: 'OPEN' },
        { classId: CLASS_IDS[0], subjectId: SUBJECT_IDS[2], teacherId: TEACHER_IDS[3], name: 'Teste 1 - Programação Paralela', type: 'TEST', weight: 1, status: 'OPEN' },
        { classId: CLASS_IDS[0], subjectId: SUBJECT_IDS[0], teacherId: TEACHER_IDS[0], name: 'Projeto Final - PTP 3', type: 'TEST', weight: 2, status: 'DRAFT' },
    ];
    const assessmentIds = [];
    for (const def of assessmentDefs) {
        const a = await prisma.assessment.create({
            data: {
                schoolId: SCHOOL_ID, academicYearId: AY_ID, termId: TERM_ID,
                ...def,
                description: 'Avaliação de exemplo gerada pelo seed (UJAC)',
                date: new Date('2026-03-10T10:00:00Z'),
                maxScore: 20,
            },
        });
        assessmentIds.push(a.id);
    }
    for (const subjectId of SUBJECT_IDS) {
        for (const classId of CLASS_IDS) {
            const days = ['MONDAY', 'WEDNESDAY', 'FRIDAY'];
            for (let d = 0; d < days.length; d++) {
                const teacher = TEACHER_IDS[d % TEACHER_IDS.length];
                await prisma.schedule.create({
                    data: {
                        schoolId: SCHOOL_ID, academicYearId: AY_ID, termId: TERM_ID,
                        classId, subjectId, teacherId: teacher,
                        dayOfWeek: days[d], startTime: '08:00', endTime: '09:40',
                        room: d === 0 ? 'Laboratório de Informática' : d === 1 ? 'Sala 201' : 'Auditório',
                        status: 'ACTIVE',
                    },
                });
            }
        }
    }
    for (const assessmentId of assessmentIds) {
        const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
        if (!assessment || assessment.status !== 'OPEN')
            continue;
        for (const classId of CLASS_IDS) {
            const enrollments = await prisma.enrollment.findMany({
                where: { classId, subjectId: assessment.subjectId, termId: TERM_ID, status: 'ACTIVE' },
                select: { studentId: true },
            });
            for (const { studentId } of enrollments) {
                const exists = await prisma.grade.findUnique({
                    where: { assessmentId_studentId: { assessmentId, studentId } },
                });
                if (exists)
                    continue;
                const score = Math.round(Math.random() * Number(assessment.maxScore));
                await prisma.grade.create({
                    data: { assessmentId, studentId, score, status: 'SUBMITTED' },
                });
            }
        }
    }
    const allAssessments = await prisma.assessment.findMany({ where: { status: 'OPEN', termId: TERM_ID } });
    const allEnrollments = await prisma.enrollment.findMany({ where: { termId: TERM_ID, status: 'ACTIVE' } });
    for (const classId of CLASS_IDS) {
        for (const subjectId of SUBJECT_IDS) {
            const relevant = allEnrollments.filter((e) => e.classId === classId && e.subjectId === subjectId);
            for (const enrollment of relevant) {
                const exists = await prisma.result.findUnique({
                    where: { studentId_classId_subjectId_termId: { studentId: enrollment.studentId, classId, subjectId, termId: TERM_ID } },
                });
                if (exists)
                    continue;
                const classAssessments = allAssessments.filter((a) => a.classId === classId && a.subjectId === subjectId);
                const grades = await prisma.grade.findMany({
                    where: { studentId: enrollment.studentId, assessmentId: { in: classAssessments.map((a) => a.id) } },
                });
                const totalWeight = classAssessments.reduce((sum, a) => sum + Number(a.weight), 0);
                const weightedSum = grades.reduce((sum, g) => {
                    const assessment = classAssessments.find((a) => a.id === g.assessmentId);
                    return sum + Number(g.score) * Number(assessment?.weight ?? 1);
                }, 0);
                const average = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null;
                let status = 'PENDING';
                if (average !== null) {
                    if (average >= 10)
                        status = 'APPROVED';
                    else if (average >= 8)
                        status = 'RECOVERY';
                    else
                        status = 'FAILED';
                }
                if (classAssessments.length > 0 && grades.length < classAssessments.length)
                    status = 'IN_PROGRESS';
                await prisma.result.create({
                    data: {
                        schoolId: SCHOOL_ID, academicYearId: AY_ID, termId: TERM_ID,
                        classId, subjectId, studentId: enrollment.studentId,
                        average, finalScore: average, status, calculatedAt: new Date(),
                    },
                });
            }
        }
    }
    console.log(' Seed concluído: 1 escola, 1 ano lectivo, 1 período, 3 turmas, 3 disciplinas, 5 professores, 10 alunos, avaliações, horários e resultados.');
}
seed()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map