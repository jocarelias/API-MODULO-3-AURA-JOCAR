import { describe, it, expect } from 'vitest';
import {
  EVALUATION_TYPES,
  isValidEvaluationType,
  validateEvaluationType,
  validateWeight,
  validateScore,
  weightedAverage,
  resolveResultStatus,
  computeCompleteResult,
  validateTimeRange,
} from './evaluation';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

describe('domain/evaluation', () => {
  describe('isValidEvaluationType / validateEvaluationType', () => {
    it('reconhece os tipos de avaliação do módulo', () => {
      expect(EVALUATION_TYPES).toEqual(['TESTE', 'EXAME_NORMAL', 'EXAME_RECURRENCIA']);
      expect(isValidEvaluationType('TESTE')).toBe(true);
      expect(isValidEvaluationType('EXAME_NORMAL')).toBe(true);
      expect(isValidEvaluationType('EXAME_RECURRENCIA')).toBe(true);
    });

    it('rejeita tipos fora do domínio', () => {
      expect(isValidEvaluationType('EXAME')).toBe(false);
      expect(isValidEvaluationType('PROVA')).toBe(false);
      expect(validateEvaluationType('EXAME').valid).toBe(false);
      expect(validateEvaluationType('TESTE').valid).toBe(true);
    });
  });

  describe('validateWeight', () => {
    it('aceita pesos positivos', () => {
      expect(validateWeight(1).valid).toBe(true);
      expect(validateWeight(2).valid).toBe(true);
      expect(validateWeight(0.5).valid).toBe(true);
    });

    it('rejeita peso por omissão implícito (zero ou negativo)', () => {
      expect(validateWeight(0).valid).toBe(false);
      expect(validateWeight(-1).valid).toBe(false);
    });

    it('rejeita pesos não numéricos', () => {
      expect(validateWeight('1').valid).toBe(false);
      expect(validateWeight('1').valid).toBe(false);
      expect(validateWeight(Number.NaN).valid).toBe(false);
    });
  });

  describe('validateScore', () => {
    it('aceita notas entre 0 e o máximo', () => {
      expect(validateScore(0).valid).toBe(true);
      expect(validateScore(10).valid).toBe(true);
      expect(validateScore(20).valid).toBe(true);
    });

    it('rejeita notas fora do intervalo', () => {
      expect(validateScore(-1).valid).toBe(false);
      expect(validateScore(21).valid).toBe(false);
    });

    it('respeita o máximo informado', () => {
      expect(validateScore(25, 30).valid).toBe(true);
      expect(validateScore(31, 30).valid).toBe(false);
    });
  });

  describe('weightedAverage', () => {
    it('calcula média percentual ponderada', () => {
      const grades = [
        { score: 10, weight: 1 },
        { score: 20, weight: 1 },
      ];
      expect(weightedAverage(grades)).toBe(15);
    });

    it('considera os pesos no cálculo', () => {
      const grades = [
        { score: 10, weight: 2 },
        { score: 20, weight: 1 },
      ];
      expect(weightedAverage(grades)).toBe(round2(40 / 3));
    });

    it('usa média aritmética quando a soma dos pesos é zero', () => {
      const grades = [
        { score: 10, weight: 0 },
        { score: 20, weight: 0 },
      ];
      expect(weightedAverage(grades)).toBe(15);
    });

    it('retorna null para lista vazia', () => {
      expect(weightedAverage([])).toBeNull();
      expect(weightedAverage(undefined as unknown as GradeInput[])).toBeNull();
    });
  });

  describe('resolveResultStatus', () => {
    it('PENDING sem avaliações cadastradas', () => {
      expect(resolveResultStatus({ gradedCount: 0, missingCount: 0, average: null })).toBe('PENDING');
    });

    it('IN_PROGRESS quando faltam notas', () => {
      expect(resolveResultStatus({ gradedCount: 2, missingCount: 1, average: 15 })).toBe('IN_PROGRESS');
    });

    it('APPROVED para média igual ou acima do corte', () => {
      expect(resolveResultStatus({ gradedCount: 2, missingCount: 0, average: 10 })).toBe('APPROVED');
      expect(resolveResultStatus({ gradedCount: 2, missingCount: 0, average: 16 })).toBe('APPROVED');
    });

    it('RECOVERY para média abaixo de aprovação mas acima do corte de recuperação', () => {
      expect(resolveResultStatus({ gradedCount: 2, missingCount: 0, average: 8 })).toBe('RECOVERY');
      expect(resolveResultStatus({ gradedCount: 2, missingCount: 0, average: 9.5 })).toBe('RECOVERY');
    });

    it('FAILED para média abaixo de recuperação', () => {
      expect(resolveResultStatus({ gradedCount: 2, missingCount: 0, average: 7.9 })).toBe('FAILED');
    });
  });

  describe('computeCompleteResult', () => {
    it('combina média e situação', () => {
      const result = computeCompleteResult({
        grades: [
          { score: 10, weight: 1 },
          { score: 20, weight: 1 },
        ],
        missing: 0,
      });
      expect(result.average).toBe(15);
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('validateTimeRange', () => {
    it('aceita faixas horárias válidas', () => {
      expect(validateTimeRange('07:00', '08:40').valid).toBe(true);
    });

    it('rejeita formato inválido', () => {
      expect(validateTimeRange('7:00', '08:40').valid).toBe(false);
      expect(validateTimeRange('07:00', '8:40').valid).toBe(false);
    });

    it('rejeita intervalos invertidos ou iguais', () => {
      expect(validateTimeRange('08:40', '07:00').valid).toBe(false);
      expect(validateTimeRange('08:40', '08:40').valid).toBe(false);
    });
  });
});
