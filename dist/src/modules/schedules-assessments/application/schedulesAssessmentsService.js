"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulesAssessmentsService = exports.DomainError = exports.TYPE_MAP = void 0;
const prisma_1 = require("../infrastructure/prisma");
const evaluation_1 = require("../domain/evaluation");
const calculationEngine_1 = require("../domain/calculationEngine");
const shared_types_1 = require("@smartcampus/shared-types");
exports.TYPE_MAP = {
    TESTE: 'TEST',
    EXAME_NORMAL: 'EXAM',
    EXAME_RECURRENCIA: 'EXAM',
};
class DomainError extends Error {
    code;
    details;
    httpStatus;
    constructor(code, message, details = []) {
        super(message);
        this.name = 'DomainError';
        this.code = code;
        this.details = details;
        this.httpStatus = { NOT_FOUND: 404, CONFLICT: 409, VALIDATION_ERROR: 400, BAD_REQUEST: 400 }[code] ?? 400;
    }
}
exports.DomainError = DomainError;
const CALCULATION_DOMAIN_CODE = {
    EMPTY_ITEMS: { code: 'VALIDATION_ERROR', httpStatus: 400 },
    INVALID_SCORE: { code: 'VALIDATION_ERROR', httpStatus: 400 },
    INVALID_WEIGHT: { code: 'VALIDATION_ERROR', httpStatus: 400 },
    WEIGHT_TOTAL_MISMATCH: { code: 'CONFLICT', httpStatus: 409 },
    WEIGHT_SUM_MUST_BE_POSITIVE: { code: 'CONFLICT', httpStatus: 409 },
    INVALID_COMPONENTS: { code: 'VALIDATION_ERROR', httpStatus: 400 },
    COMPONENT_WEIGHT_MISMATCH: { code: 'CONFLICT', httpStatus: 409 },
    FORMULA_NOT_REGISTERED: { code: 'VALIDATION_ERROR', httpStatus: 400 },
};
function withValidAssessmentType(type) {
    const check = (0, evaluation_1.validateEvaluationType)(type);
    if (!check.valid) {
        throw new DomainError('VALIDATION_ERROR', check.error);
    }
    return exports.TYPE_MAP[type];
}
function assertRelation(value, message) {
    if (value === null || value === undefined) {
        throw new DomainError('NOT_FOUND', message);
    }
}
function toConflictDetails(conflicts) {
    return conflicts.map((c) => ({ type: c.type, message: c.description }));
}
class SchedulesAssessmentsService {
    prisma;
    constructor({ db = prisma_1.prisma } = {}) {
        this.prisma = db;
    }
    async listAssessments({ termId, classId, subjectId, teacherId } = {}) {
        const where = {};
        if (termId)
            where.termId = termId;
        if (classId)
            where.classId = classId;
        if (subjectId)
            where.subjectId = subjectId;
        if (teacherId)
            where.teacherId = teacherId;
        const rows = await this.prisma.assessment.findMany({
            where,
            orderBy: { date: 'asc' },
        });
        return rows.map((row) => (0, shared_types_1.assessmentDto)(row));
    }
    async getAssessment(id) {
        const record = await this.prisma.assessment.findUnique({ where: { id } });
        if (!record) {
            throw new DomainError('NOT_FOUND', 'Avaliação não encontrada');
        }
        return (0, shared_types_1.assessmentDto)(record);
    }
    async createAssessment(input) {
        const type = withValidAssessmentType(input.type);
        const weightCheck = (0, evaluation_1.validateWeight)(input.weight);
        if (!weightCheck.valid) {
            throw new DomainError('VALIDATION_ERROR', weightCheck.error);
        }
        if ((input.maxScore ?? evaluation_1.EVALUATION_DEFAULT_MAX_SCORE) <= 0) {
            throw new DomainError('VALIDATION_ERROR', 'Nota máxima deve ser maior que 0');
        }
        const [term, classRecord, subject, teacher, academicYear] = await Promise.all([
            this.prisma.term.findUnique({ where: { id: input.termId } }),
            this.prisma.class.findUnique({ where: { id: input.classId } }),
            this.prisma.subject.findUnique({ where: { id: input.subjectId } }),
            this.prisma.teacher.findUnique({ where: { id: input.teacherId } }),
            this.prisma.academicYear.findUnique({ where: { id: input.academicYearId } }),
        ]);
        assertRelation(term, 'Período (termo) não encontrado');
        assertRelation(classRecord, 'Turma não encontrada');
        assertRelation(subject, 'Disciplina não encontrada');
        assertRelation(teacher, 'Professor não encontrado');
        assertRelation(academicYear, 'Ano letivo não encontrado');
        if (term.academicYearId !== classRecord.academicYearId ||
            term.academicYearId !== input.academicYearId ||
            classRecord.academicYearId !== input.academicYearId) {
            throw new DomainError('CONFLICT', 'Período, turma e ano letivo não pertencem ao mesmo ano letivo');
        }
        const duplicate = await this.prisma.assessment.findFirst({
            where: { termId: term.id, classId: classRecord.id, subjectId: subject.id, name: input.name },
            select: { id: true },
        });
        if (duplicate) {
            throw new DomainError('CONFLICT', 'Já existe uma avaliação com este nome para esta turma, disciplina e período');
        }
        const assigned = await this.prisma.$transaction([
            this.prisma.schedule.findMany({
                where: { schoolId: term.schoolId, teacherId: teacher.id, classId: classRecord.id, status: { not: 'CANCELLED' } },
                select: { subjectId: true },
                distinct: ['subjectId'],
            }),
            this.prisma.assessment.findMany({
                where: { schoolId: term.schoolId, teacherId: teacher.id, classId: classRecord.id },
                select: { subjectId: true },
                distinct: ['subjectId'],
            }),
        ]);
        const assignedIds = Array.from(new Set([...assigned[0].map((s) => s.subjectId), ...assigned[1].map((s) => s.subjectId)]));
        if (assignedIds.length > 0 && !assignedIds.includes(subject.id)) {
            throw new DomainError('CONFLICT', 'Professor não leciona esta disciplina nesta turma');
        }
        const record = await this.prisma.assessment.create({
            data: {
                schoolId: term.schoolId,
                academicYearId: input.academicYearId,
                termId: term.id,
                classId: classRecord.id,
                subjectId: subject.id,
                teacherId: teacher.id,
                name: input.name,
                type: type,
                description: input.description ?? null,
                date: new Date(input.date),
                maxScore: input.maxScore ?? evaluation_1.EVALUATION_DEFAULT_MAX_SCORE,
                weight: input.weight,
                status: (input.status ?? 'DRAFT'),
            },
        });
        return (0, shared_types_1.assessmentDto)(record);
    }
    async updateAssessment(id, patch) {
        const existing = await this.prisma.assessment.findUnique({ where: { id } });
        if (!existing) {
            throw new DomainError('NOT_FOUND', 'Avaliação não encontrada');
        }
        if (patch.weight !== undefined || patch.maxScore !== undefined) {
            const gradeCount = await this.prisma.grade.count({ where: { assessmentId: id } });
            if (gradeCount > 0) {
                throw new DomainError('CONFLICT', 'Peso e nota máxima não podem ser alterados após o lançamento de notas');
            }
        }
        const data = {};
        if (patch.name !== undefined)
            data.name = patch.name;
        if (patch.description !== undefined)
            data.description = patch.description;
        if (patch.date !== undefined)
            data.date = new Date(patch.date);
        if (patch.status !== undefined)
            data.status = patch.status;
        if (patch.weight !== undefined) {
            const weightCheck = (0, evaluation_1.validateWeight)(patch.weight);
            if (!weightCheck.valid)
                throw new DomainError('VALIDATION_ERROR', weightCheck.error);
            data.weight = patch.weight;
        }
        if (patch.maxScore !== undefined) {
            if (patch.maxScore <= 0)
                throw new DomainError('VALIDATION_ERROR', 'Nota máxima deve ser maior que 0');
            data.maxScore = patch.maxScore;
        }
        if (patch.type !== undefined)
            data.type = withValidAssessmentType(patch.type);
        const updated = await this.prisma.assessment.update({ where: { id }, data });
        return (0, shared_types_1.assessmentDto)(updated);
    }
    async deleteAssessment(id) {
        const assessment = await this.prisma.assessment.findUnique({
            where: { id },
            include: { _count: { select: { grades: true } } },
        });
        if (!assessment) {
            throw new DomainError('NOT_FOUND', 'Avaliação não encontrada');
        }
        if (assessment._count.grades > 0) {
            throw new DomainError('CONFLICT', 'Avaliação não pode ser eliminada porque já possui notas lançadas');
        }
        await this.prisma.assessment.delete({ where: { id } });
        return { id, deleted: true };
    }
    async listGrades(assessmentId) {
        const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
        if (!assessment) {
            throw new DomainError('NOT_FOUND', 'Avaliação não encontrada');
        }
        const rows = await this.prisma.grade.findMany({
            where: { assessmentId },
            orderBy: { createdAt: 'asc' },
        });
        return rows.map((row) => (0, shared_types_1.gradeDto)(row));
    }
    async _recalculateInTx(tx, assessment, studentIds) {
        const { classId, subjectId, termId } = assessment;
        const evaluations = await tx.assessment.findMany({
            where: { classId, subjectId, termId },
            include: { grades: true },
            orderBy: { date: 'asc' },
        });
        if (evaluations.length === 0) {
            return;
        }
        let students = studentIds ?? [];
        if (!students || students.length === 0) {
            const enrollments = await tx.enrollment.findMany({
                where: { classId, subjectId, termId, status: 'ACTIVE' },
                select: { studentId: true },
            });
            students = enrollments.map((e) => e.studentId);
        }
        const reference = evaluations[0];
        for (const studentId of students) {
            const graded = [];
            let missing = 0;
            for (const evaluation of evaluations) {
                const grade = evaluation.grades.find((g) => g.studentId === studentId);
                if (grade) {
                    graded.push({ score: Number(grade.score), weight: Number(evaluation.weight) });
                }
                else {
                    missing += 1;
                }
            }
            const average = (0, evaluation_1.weightedAverage)(graded);
            const status = (0, evaluation_1.resolveResultStatus)({ gradedCount: graded.length, missingCount: missing, average });
            await tx.result.upsert({
                where: { studentId_classId_subjectId_termId: { studentId, classId, subjectId, termId } },
                update: { average, finalScore: average, calculationMethod: 'WEIGHTED_PERCENTAGE', status, calculatedAt: new Date() },
                create: {
                    schoolId: assessment.schoolId ?? reference.schoolId,
                    academicYearId: assessment.academicYearId ?? reference.academicYearId,
                    termId,
                    classId,
                    subjectId,
                    studentId,
                    average,
                    finalScore: average,
                    calculationMethod: 'WEIGHTED_PERCENTAGE',
                    status,
                    calculatedAt: new Date(),
                },
            });
        }
    }
    async createGrade(assessmentId, input) {
        const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
        if (!assessment) {
            throw new DomainError('NOT_FOUND', 'Avaliação não encontrada');
        }
        if (assessment.status !== 'OPEN') {
            throw new DomainError('CONFLICT', 'Nota só pode ser lançada em avaliação aberta');
        }
        const scoreCheck = (0, evaluation_1.validateScore)(input.score, Number(assessment.maxScore));
        if (!scoreCheck.valid) {
            throw new DomainError('VALIDATION_ERROR', scoreCheck.error);
        }
        const [student, enrolledClass, enrolledSubject] = await Promise.all([
            this.prisma.student.findUnique({ where: { id: input.studentId } }),
            this.prisma.enrollment.findFirst({
                where: {
                    schoolId: assessment.schoolId,
                    studentId: input.studentId,
                    classId: assessment.classId,
                    termId: assessment.termId,
                    status: 'ACTIVE',
                },
                select: { id: true },
            }),
            this.prisma.enrollment.findFirst({
                where: {
                    schoolId: assessment.schoolId,
                    studentId: input.studentId,
                    subjectId: assessment.subjectId,
                    termId: assessment.termId,
                    status: 'ACTIVE',
                },
                select: { id: true },
            }),
        ]);
        assertRelation(student, 'Aluno não encontrado');
        if (!enrolledClass || !enrolledSubject) {
            throw new DomainError('VALIDATION_ERROR', 'Aluno não está matriculado na turma e disciplina desta avaliação');
        }
        const existing = await this.prisma.grade.findUnique({
            where: { assessmentId_studentId: { assessmentId, studentId: input.studentId } },
        });
        if (existing) {
            throw new DomainError('CONFLICT', 'Já existe nota para este aluno nesta avaliação');
        }
        const created = await this.prisma.$transaction(async (tx) => {
            const row = await tx.grade.create({
                data: {
                    assessmentId,
                    studentId: input.studentId,
                    score: input.score,
                    comment: input.comment ?? null,
                    status: 'SUBMITTED',
                },
            });
            await this._recalculateInTx(tx, { classId: assessment.classId, subjectId: assessment.subjectId, termId: assessment.termId, schoolId: assessment.schoolId, academicYearId: assessment.academicYearId }, [input.studentId]);
            return row;
        });
        return (0, shared_types_1.gradeDto)(created);
    }
    async updateGrade(assessmentId, gradeId, patch) {
        const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
        if (!assessment) {
            throw new DomainError('NOT_FOUND', 'Avaliação não encontrada');
        }
        const existing = await this.prisma.grade.findUnique({ where: { id: gradeId } });
        if (!existing || existing.assessmentId !== assessmentId) {
            throw new DomainError('NOT_FOUND', 'Nota não encontrada');
        }
        if (assessment.status !== 'OPEN') {
            throw new DomainError('CONFLICT', 'Nota só pode ser alterada em avaliação aberta');
        }
        const data = {};
        if (patch.score !== undefined) {
            const scoreCheck = (0, evaluation_1.validateScore)(patch.score, Number(assessment.maxScore));
            if (!scoreCheck.valid)
                throw new DomainError('VALIDATION_ERROR', scoreCheck.error);
            data.score = patch.score;
        }
        if (patch.comment !== undefined)
            data.comment = patch.comment;
        if (patch.status !== undefined)
            data.status = patch.status;
        if (Object.keys(data).length === 0) {
            return (0, shared_types_1.gradeDto)(existing);
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const row = await tx.grade.update({ where: { id: gradeId }, data });
            await this._recalculateInTx(tx, { classId: assessment.classId, subjectId: assessment.subjectId, termId: assessment.termId, schoolId: assessment.schoolId, academicYearId: assessment.academicYearId }, [existing.studentId]);
            return row;
        });
        return (0, shared_types_1.gradeDto)(updated);
    }
    async listSchedules({ termId, classId, teacherId, studentId } = {}) {
        const where = {};
        if (termId)
            where.termId = termId;
        if (classId)
            where.classId = classId;
        if (teacherId)
            where.teacherId = teacherId;
        if (studentId) {
            const classes = await this.prisma.enrollment.findMany({
                where: { studentId, status: 'ACTIVE' },
                select: { classId: true },
                distinct: ['classId'],
            });
            where.classId = { in: classes.map((c) => c.classId) };
        }
        const rows = await this.prisma.schedule.findMany({
            where,
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        });
        return rows.map((row) => (0, shared_types_1.scheduleDto)(row));
    }
    async createSchedule(input) {
        const timeCheck = (0, evaluation_1.validateTimeRange)(input.startTime, input.endTime);
        if (!timeCheck.valid) {
            throw new DomainError('VALIDATION_ERROR', timeCheck.error);
        }
        const [term, classRecord, subject, teacher, academicYear] = await Promise.all([
            this.prisma.term.findUnique({ where: { id: input.termId } }),
            this.prisma.class.findUnique({ where: { id: input.classId } }),
            this.prisma.subject.findUnique({ where: { id: input.subjectId } }),
            this.prisma.teacher.findUnique({ where: { id: input.teacherId } }),
            this.prisma.academicYear.findUnique({ where: { id: input.academicYearId } }),
        ]);
        assertRelation(term, 'Período (termo) não encontrado');
        assertRelation(classRecord, 'Turma não encontrada');
        assertRelation(subject, 'Disciplina não encontrada');
        assertRelation(teacher, 'Professor não encontrado');
        assertRelation(academicYear, 'Ano letivo não encontrado');
        if (term.academicYearId !== input.academicYearId || classRecord.academicYearId !== input.academicYearId) {
            throw new DomainError('CONFLICT', 'Período, turma e ano letivo não pertencem ao mesmo ano letivo');
        }
        const sameDay = await this.prisma.schedule.findMany({
            where: {
                schoolId: term.schoolId,
                termId: term.id,
                dayOfWeek: input.dayOfWeek,
                status: { not: 'CANCELLED' },
            },
        });
        const conflicts = this.findConflicts(input, sameDay);
        if (conflicts.length > 0) {
            throw new DomainError('CONFLICT', 'Conflito de horário detectado', toConflictDetails(conflicts));
        }
        const created = await this.prisma.schedule.create({
            data: {
                schoolId: term.schoolId,
                academicYearId: input.academicYearId,
                termId: term.id,
                classId: classRecord.id,
                subjectId: subject.id,
                teacherId: teacher.id,
                dayOfWeek: input.dayOfWeek,
                startTime: input.startTime,
                endTime: input.endTime,
                room: input.room ?? null,
                status: (input.status ?? 'ACTIVE'),
            },
        });
        return (0, shared_types_1.scheduleDto)(created);
    }
    findConflicts(input, existing) {
        const active = existing.filter((s) => !s.status || s.status === 'ACTIVE');
        const conflicts = [];
        for (const s of active) {
            const overlaps = input.startTime < s.endTime && s.startTime < input.endTime;
            if (!overlaps)
                continue;
            if (input.teacherId === s.teacherId) {
                conflicts.push({ type: 'TEACHER', description: `Professor já possui aula das ${s.startTime} às ${s.endTime}` });
            }
            if (input.classId === s.classId) {
                conflicts.push({ type: 'CLASS', description: `Turma já possui aula das ${s.startTime} às ${s.endTime}` });
            }
            if (input.room && input.room === s.room) {
                conflicts.push({ type: 'ROOM', description: `Sala ${s.room} já está ocupada das ${s.startTime} às ${s.endTime}` });
            }
        }
        return conflicts;
    }
    async updateSchedule(id, patch) {
        const existing = await this.prisma.schedule.findUnique({ where: { id } });
        if (!existing) {
            throw new DomainError('NOT_FOUND', 'Horário não encontrado');
        }
        const data = {};
        if (patch.dayOfWeek !== undefined)
            data.dayOfWeek = patch.dayOfWeek;
        if (patch.startTime !== undefined)
            data.startTime = patch.startTime;
        if (patch.endTime !== undefined)
            data.endTime = patch.endTime;
        if (patch.room !== undefined)
            data.room = patch.room;
        if (patch.status !== undefined)
            data.status = patch.status;
        if (patch.startTime || patch.endTime) {
            const timeCheck = (0, evaluation_1.validateTimeRange)(patch.startTime ?? existing.startTime, patch.endTime ?? existing.endTime);
            if (!timeCheck.valid)
                throw new DomainError('VALIDATION_ERROR', timeCheck.error);
        }
        if (Object.keys(data).length > 0) {
            const candidate = {
                teacherId: existing.teacherId,
                classId: existing.classId,
                dayOfWeek: patch.dayOfWeek ?? existing.dayOfWeek,
                startTime: patch.startTime ?? existing.startTime,
                endTime: patch.endTime ?? existing.endTime,
                room: patch.room !== undefined ? patch.room : existing.room,
            };
            const sameDay = await this.prisma.schedule.findMany({
                where: {
                    schoolId: existing.schoolId,
                    termId: existing.termId,
                    dayOfWeek: candidate.dayOfWeek,
                    status: { not: 'CANCELLED' },
                    NOT: { id },
                },
            });
            const conflicts = this.findConflicts(candidate, sameDay);
            if (conflicts.length > 0) {
                throw new DomainError('CONFLICT', 'Conflito de horário detectado', toConflictDetails(conflicts));
            }
            const updated = await this.prisma.schedule.update({ where: { id }, data });
            return (0, shared_types_1.scheduleDto)(updated);
        }
        return (0, shared_types_1.scheduleDto)(existing);
    }
    async deleteSchedule(id) {
        const schedule = await this.prisma.schedule.findUnique({ where: { id } });
        if (!schedule) {
            throw new DomainError('NOT_FOUND', 'Horário não encontrado');
        }
        await this.prisma.schedule.delete({ where: { id } });
        return { id, deleted: true };
    }
    async getSchedule(id) {
        const record = await this.prisma.schedule.findUnique({ where: { id } });
        if (!record) {
            throw new DomainError('NOT_FOUND', 'Horário não encontrado');
        }
        return (0, shared_types_1.scheduleDto)(record);
    }
    async listResults({ termId, classId, subjectId, studentId } = {}) {
        const where = {};
        if (termId)
            where.termId = termId;
        if (classId)
            where.classId = classId;
        if (subjectId)
            where.subjectId = subjectId;
        if (studentId)
            where.studentId = studentId;
        const rows = await this.prisma.result.findMany({ where, orderBy: { updatedAt: 'asc' } });
        return rows.map((row) => (0, shared_types_1.resultDto)(row));
    }
    async getResult(id) {
        const record = await this.prisma.result.findUnique({ where: { id } });
        if (!record) {
            throw new DomainError('NOT_FOUND', 'Resultado não encontrado');
        }
        return (0, shared_types_1.resultDto)(record);
    }
    async createResults(input) {
        const assessmentCount = await this.prisma.assessment.count({
            where: { classId: input.classId, subjectId: input.subjectId, termId: input.termId },
        });
        if (assessmentCount === 0) {
            throw new DomainError('VALIDATION_ERROR', 'Não existem avaliações para calcular resultados nesta combinação');
        }
        return this.prisma.$transaction(async (tx) => {
            await this._recalculateInTx(tx, input, input.studentIds);
            const rows = await tx.result.findMany({
                where: {
                    classId: input.classId,
                    subjectId: input.subjectId,
                    termId: input.termId,
                    ...(input.studentIds ? { studentId: { in: input.studentIds } } : {}),
                },
                orderBy: { studentId: 'asc' },
            });
            return rows.map((row) => (0, shared_types_1.resultDto)(row));
        });
    }
    async deleteResult(id) {
        const result = await this.prisma.result.findUnique({ where: { id } });
        if (!result) {
            throw new DomainError('NOT_FOUND', 'Resultado não encontrado');
        }
        await this.prisma.result.delete({ where: { id } });
        return { id, deleted: true };
    }
    async patchResult(id) {
        const result = await this.prisma.result.findUnique({ where: { id } });
        if (!result) {
            throw new DomainError('NOT_FOUND', 'Resultado não encontrado');
        }
        return this.prisma.$transaction(async (tx) => {
            await this._recalculateInTx(tx, { classId: result.classId, subjectId: result.subjectId, termId: result.termId, schoolId: result.schoolId, academicYearId: result.academicYearId }, [result.studentId]);
            const updated = await tx.result.findUnique({ where: { id } });
            if (!updated) {
                throw new DomainError('NOT_FOUND', 'Resultado não encontrado');
            }
            return (0, shared_types_1.resultDto)(updated);
        });
    }
    async calculateResult(input) {
        const aggregatedIds = new Set();
        input.items.forEach((item) => {
            if (item.assessmentId)
                aggregatedIds.add(item.assessmentId);
        });
        const collectComponentIds = (components) => {
            components.forEach((component) => {
                if (component.assessmentId)
                    aggregatedIds.add(component.assessmentId);
                if ('children' in component && Array.isArray(component.children)) {
                    collectComponentIds(component.children);
                }
            });
        };
        if (input.components) {
            collectComponentIds(input.components);
        }
        const uniqueIds = Array.from(aggregatedIds);
        if (uniqueIds.length > 0) {
            const found = await this.prisma.assessment.findMany({ where: { id: { in: uniqueIds } }, select: { id: true } });
            const foundIds = new Set(found.map((row) => row.id));
            const missing = uniqueIds.filter((id) => !foundIds.has(id));
            if (missing.length > 0) {
                throw new DomainError('NOT_FOUND', 'Avaliação(ões) não encontrada(s)', missing.map((id) => ({ assessmentId: id })));
            }
        }
        try {
            return (0, calculationEngine_1.calculate)(input);
        }
        catch (error) {
            if (error instanceof calculationEngine_1.CalculationError) {
                const mapping = CALCULATION_DOMAIN_CODE[error.code];
                const domain = new DomainError(mapping.code, error.message);
                domain.httpStatus = mapping.httpStatus;
                throw domain;
            }
            throw error;
        }
    }
    listCalculationMethods() {
        return calculationEngine_1.CALCULATION_METHODS;
    }
    async getPrintClassSchedule(classId, termId) {
        const classRecord = await this.prisma.class.findUnique({ where: { id: classId } });
        if (!classRecord) {
            throw new DomainError('NOT_FOUND', 'Turma não encontrada');
        }
        const where = { classId };
        if (termId)
            where.termId = termId;
        const schedules = await this.prisma.schedule.findMany({
            where,
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
            include: { subject: true, teacher: true },
        });
        return {
            className: classRecord.name,
            termId: termId ?? null,
            schedules: schedules.map((s) => ({
                dayOfWeek: s.dayOfWeek,
                startTime: s.startTime,
                endTime: s.endTime,
                room: s.room,
                subject: s.subject.name,
                teacher: s.teacher.name,
                status: s.status,
            })),
        };
    }
    async getPrintClassPauta(classId, termId, subjectId) {
        const classRecord = await this.prisma.class.findUnique({ where: { id: classId } });
        if (!classRecord) {
            throw new DomainError('NOT_FOUND', 'Turma não encontrada');
        }
        if (!subjectId) {
            throw new DomainError('BAD_REQUEST', 'Disciplina (subjectId) é obrigatória para gerar a pauta');
        }
        const [subject, students] = await Promise.all([
            this.prisma.subject.findUnique({ where: { id: subjectId } }),
            this.prisma.enrollment.findMany({
                where: { classId, subjectId, ...(termId ? { termId } : {}), status: 'ACTIVE' },
                include: { student: true },
                orderBy: { student: { name: 'asc' } },
            }),
        ]);
        assertRelation(subject, 'Disciplina não encontrada');
        const rows = [];
        for (const enrollment of students) {
            const assessments = await this.prisma.assessment.findMany({
                where: { classId, subjectId, schoolId: classRecord.schoolId, ...(termId ? { termId } : {}) },
                include: {
                    grades: {
                        where: { studentId: enrollment.studentId },
                    },
                },
                orderBy: { date: 'asc' },
            });
            const graded = [];
            let missing = 0;
            const breakdown = [];
            for (const assessment of assessments) {
                const grade = assessment.grades[0];
                if (grade) {
                    graded.push({ score: Number(grade.score), weight: Number(assessment.weight) });
                    breakdown.push({
                        assessmentId: assessment.id,
                        name: assessment.name,
                        score: Number(grade.score),
                        weight: Number(assessment.weight),
                    });
                }
                else {
                    missing += 1;
                    breakdown.push({
                        assessmentId: assessment.id,
                        name: assessment.name,
                        score: null,
                        weight: Number(assessment.weight),
                    });
                }
            }
            const average = (0, evaluation_1.weightedAverage)(graded);
            const status = (0, evaluation_1.resolveResultStatus)({ gradedCount: graded.length, missingCount: missing, average });
            rows.push({
                studentId: enrollment.studentId,
                studentName: enrollment.student.name,
                average,
                status,
                evaluations: breakdown,
            });
        }
        return {
            className: classRecord.name,
            subject: subject.name,
            termId: termId ?? null,
            rows,
        };
    }
}
exports.SchedulesAssessmentsService = SchedulesAssessmentsService;
//# sourceMappingURL=schedulesAssessmentsService.js.map