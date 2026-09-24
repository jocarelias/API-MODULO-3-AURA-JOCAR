"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIME_PATTERN = exports.RECOVERY_SCORE = exports.PASSING_SCORE = exports.EVALUATION_MIN_WEIGHT = exports.EVALUATION_MIN_SCORE = exports.EVALUATION_DEFAULT_MAX_SCORE = exports.EVALUATION_TYPES = void 0;
exports.round2 = round2;
exports.isValidEvaluationType = isValidEvaluationType;
exports.validateEvaluationType = validateEvaluationType;
exports.validateWeight = validateWeight;
exports.validateScore = validateScore;
exports.weightedAverage = weightedAverage;
exports.resolveResultStatus = resolveResultStatus;
exports.computeCompleteResult = computeCompleteResult;
exports.validateTimeRange = validateTimeRange;
exports.EVALUATION_TYPES = ['TESTE', 'EXAME_NORMAL', 'EXAME_RECURRENCIA'];
exports.EVALUATION_DEFAULT_MAX_SCORE = 20;
exports.EVALUATION_MIN_SCORE = 0;
exports.EVALUATION_MIN_WEIGHT = 0;
exports.PASSING_SCORE = 10;
exports.RECOVERY_SCORE = 8;
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function isValidEvaluationType(type) {
    return exports.EVALUATION_TYPES.includes(type);
}
function validateEvaluationType(type) {
    if (!isValidEvaluationType(type)) {
        return { valid: false, error: `Tipo de avaliação inválido: ${type}` };
    }
    return { valid: true };
}
function validateWeight(weight) {
    if (typeof weight !== 'number' || Number.isNaN(weight)) {
        return { valid: false, error: 'Peso deve ser um número' };
    }
    if (weight <= exports.EVALUATION_MIN_WEIGHT) {
        return { valid: false, error: `Peso deve ser maior que ${exports.EVALUATION_MIN_WEIGHT}` };
    }
    return { valid: true };
}
function validateScore(score, maxScore = exports.EVALUATION_DEFAULT_MAX_SCORE) {
    if (typeof score !== 'number' || Number.isNaN(score)) {
        return { valid: false, error: 'Nota deve ser um número' };
    }
    if (score < exports.EVALUATION_MIN_SCORE) {
        return { valid: false, error: `Nota não pode ser menor que ${exports.EVALUATION_MIN_SCORE}` };
    }
    if (score > maxScore) {
        return { valid: false, error: `Nota não pode ser maior que ${maxScore}` };
    }
    return { valid: true };
}
function weightedAverage(grades) {
    if (!Array.isArray(grades) || grades.length === 0) {
        return null;
    }
    const totalWeight = grades.reduce((acc, g) => acc + g.weight, 0);
    const weightedSum = grades.reduce((acc, g) => acc + g.score * g.weight, 0);
    if (totalWeight <= 0) {
        const sum = grades.reduce((acc, g) => acc + g.score, 0);
        return round2(sum / grades.length);
    }
    return round2(weightedSum / totalWeight);
}
function resolveResultStatus({ gradedCount, missingCount, average, }) {
    if (gradedCount === 0 && missingCount === 0) {
        return 'PENDING';
    }
    if (missingCount > 0) {
        return 'IN_PROGRESS';
    }
    if (average === null) {
        return 'PENDING';
    }
    if (average >= exports.PASSING_SCORE) {
        return 'APPROVED';
    }
    if (average >= exports.RECOVERY_SCORE) {
        return 'RECOVERY';
    }
    return 'FAILED';
}
function computeCompleteResult({ grades, missing = 0, }) {
    const average = weightedAverage(grades);
    const status = resolveResultStatus({
        gradedCount: grades.length,
        missingCount: missing,
        average,
    });
    return { average, status };
}
exports.TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
function validateTimeRange(startTime, endTime) {
    if (!exports.TIME_PATTERN.test(startTime)) {
        return { valid: false, error: `Hora de início inválida: ${startTime}` };
    }
    if (!exports.TIME_PATTERN.test(endTime)) {
        return { valid: false, error: `Hora de fim inválida: ${endTime}` };
    }
    if (startTime >= endTime) {
        return { valid: false, error: 'Hora de início deve ser anterior à hora de fim' };
    }
    return { valid: true };
}
//# sourceMappingURL=evaluation.js.map