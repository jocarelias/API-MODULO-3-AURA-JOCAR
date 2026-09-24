"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusModules = exports.RESULT_STATUS = exports.SCHEDULE_STATUS = exports.GRADE_STATUS = exports.ASSESSMENT_STATUS = exports.CALCULATION_METHODS = exports.DAYS_OF_WEEK = exports.RECOVERY_SCORE = exports.PASSING_SCORE = exports.ASSESSMENT_DEFAULT_MAX_SCORE = exports.ASSESSMENT_TYPES = void 0;
exports.assessmentDto = assessmentDto;
exports.gradeDto = gradeDto;
exports.scheduleDto = scheduleDto;
exports.resultDto = resultDto;
exports.ASSESSMENT_TYPES = ['TESTE', 'EXAME_NORMAL', 'EXAME_RECURRENCIA'];
exports.ASSESSMENT_DEFAULT_MAX_SCORE = 20;
exports.PASSING_SCORE = 10;
exports.RECOVERY_SCORE = 8;
exports.DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
exports.CALCULATION_METHODS = [
    'ARITHMETIC_MEAN',
    'WEIGHTED_PERCENTAGE',
    'PERCENTAGE_SUM',
    'NORMALIZED_WEIGHTED_MEAN',
    'COMPONENT_BASED',
    'CUSTOM_WEIGHTED',
];
exports.ASSESSMENT_STATUS = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'];
exports.GRADE_STATUS = ['SUBMITTED', 'APPROVED', 'REVISED'];
exports.SCHEDULE_STATUS = ['ACTIVE', 'INACTIVE', 'CANCELLED'];
exports.RESULT_STATUS = ['APPROVED', 'FAILED', 'RECOVERY', 'PENDING', 'IN_PROGRESS'];
function toNumber(value) {
    return value === null || value === undefined ? null : Number(value);
}
function toIso(value) {
    if (value instanceof Date)
        return value.toISOString();
    return value ? new Date(value).toISOString() : null;
}
const DB_TYPE_TO_API = {
    TEST: 'TESTE',
    EXAM: 'EXAME_NORMAL',
};
function apiAssessmentType(dbType) {
    return DB_TYPE_TO_API[dbType] ?? dbType;
}
function assessmentDto(record) {
    return {
        id: record.id,
        schoolId: record.schoolId,
        academicYearId: record.academicYearId,
        termId: record.termId,
        classId: record.classId,
        subjectId: record.subjectId,
        teacherId: record.teacherId,
        name: record.name,
        type: apiAssessmentType(record.type),
        description: record.description,
        date: toIso(record.date),
        maxScore: toNumber(record.maxScore),
        weight: toNumber(record.weight),
        status: record.status,
        createdAt: toIso(record.createdAt),
        updatedAt: toIso(record.updatedAt),
    };
}
function gradeDto(record) {
    return {
        id: record.id,
        assessmentId: record.assessmentId,
        studentId: record.studentId,
        score: toNumber(record.score),
        comment: record.comment,
        status: record.status,
        createdAt: toIso(record.createdAt),
        updatedAt: toIso(record.updatedAt),
    };
}
function scheduleDto(record) {
    return {
        id: record.id,
        schoolId: record.schoolId,
        academicYearId: record.academicYearId,
        termId: record.termId,
        classId: record.classId,
        subjectId: record.subjectId,
        teacherId: record.teacherId,
        dayOfWeek: record.dayOfWeek,
        startTime: record.startTime,
        endTime: record.endTime,
        room: record.room,
        status: record.status,
        createdAt: toIso(record.createdAt),
        updatedAt: toIso(record.updatedAt),
    };
}
function resultDto(record) {
    return {
        id: record.id,
        schoolId: record.schoolId,
        academicYearId: record.academicYearId,
        termId: record.termId,
        classId: record.classId,
        subjectId: record.subjectId,
        studentId: record.studentId,
        average: toNumber(record.average),
        finalScore: toNumber(record.finalScore),
        calculationMethod: record.calculationMethod === null || record.calculationMethod === undefined ? null : String(record.calculationMethod),
        status: record.status,
        calculatedAt: toIso(record.calculatedAt),
    };
}
exports.campusModules = {
    G3_AVALIACOES_HORARIOS: {
        name: 'Avaliações e Horários',
        basePath: '/api/v1',
        resources: ['assessments', 'schedules', 'results'],
        open: true,
    },
};
//# sourceMappingURL=index.js.map