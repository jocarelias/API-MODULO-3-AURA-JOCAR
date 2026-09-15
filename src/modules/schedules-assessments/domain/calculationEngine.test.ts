import { describe, it, expect } from 'vitest';
import {
  CALCULATION_METHOD_CODES,
  CALCULATION_METHODS,
  CUSTOM_FORMULA_LIST,
  calculateArithmeticMean,
  calculateWeightedPercentage,
  calculatePercentageSum,
  calculateNormalizedWeightedMean,
  calculateComponentBased,
  calculateCustomWeighted,
  calculate,
  CalculationInput,
  CalculationError,
} from './calculationEngine';

function mi(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return { method: 'ARITHMETIC_MEAN', items: [], ...overrides };
}

describe('domain/calculationEngine', () => {
  describe('metadata', () => {
    it('contém 6 métodos de cálculo', () => {
      expect(CALCULATION_METHODS).toHaveLength(6);
      expect(CALCULATION_METHOD_CODES).toEqual(
        expect.arrayContaining([
          'ARITHMETIC_MEAN',
          'WEIGHTED_PERCENTAGE',
          'PERCENTAGE_SUM',
          'NORMALIZED_WEIGHTED_MEAN',
          'COMPONENT_BASED',
          'CUSTOM_WEIGHTED',
        ]),
      );
    });

    it('cada método tem code, name e formula', () => {
      for (const m of CALCULATION_METHODS) {
        expect(m.code).toBeTruthy();
        expect(m.name).toBeTruthy();
        expect(m.formula).toBeTruthy();
      }
    });

    it('fórmulas registadas são documentadas', () => {
      expect(CUSTOM_FORMULA_LIST.length).toBeGreaterThanOrEqual(5);
      for (const f of CUSTOM_FORMULA_LIST) {
        expect(f.key).toBeTruthy();
        expect(f.name).toBeTruthy();
        expect(typeof f.requiresWeights).toBe('boolean');
      }
    });
  });

  describe('ARITHMETIC_MEAN', () => {
    it('média simples de três notas', () => {
      const r = calculateArithmeticMean(mi({
        items: [{ score: 12 }, { score: 14 }, { score: 16 }],
      }));
      expect(r.method).toBe('ARITHMETIC_MEAN');
      expect(r.value).toBe(14);
      expect(r.breakdown).toHaveLength(3);
      expect(r.breakdown[0].contribution).toBe(12);
    });

    it('única nota devolve a própria nota', () => {
      const r = calculateArithmeticMean(mi({ items: [{ score: 15 }] }));
      expect(r.value).toBe(15);
    });

    it('notas com decimais', () => {
      const r = calculateArithmeticMean(mi({ items: [{ score: 10 }, { score: 11 }] }));
      expect(r.value).toBe(10.5);
    });

    it('arredondamento a 0 casas', () => {
      const r = calculateArithmeticMean(mi({
        items: [{ score: 10 }, { score: 11 }, { score: 12 }],
        rounding: { decimals: 0 },
      }));
      expect(r.value).toBe(11);
      expect(r.decimals).toBe(0);
    });

    it('lista vazia lança erro', () => {
      expect(() => calculateArithmeticMean(mi({ items: [] }))).toThrow(CalculationError);
    });

    it('nota abaixo do mínimo lança INVALID_SCORE', () => {
      expect(() =>
        calculateArithmeticMean(mi({
          items: [{ score: -1 }],
          minScore: 0,
          maxScore: 20,
        })),
      ).toThrow('inferior ao mínimo');
    });

    it('nota acima do máximo lança INVALID_SCORE', () => {
      expect(() =>
        calculateArithmeticMean(mi({
          items: [{ score: 25 }],
          minScore: 0,
          maxScore: 20,
        })),
      ).toThrow('superior ao máximo');
    });

    it('peso é ignorado no cálculo', () => {
      const r = calculateArithmeticMean(mi({
        items: [{ score: 10, weight: 3 }, { score: 20, weight: 1 }],
      }));
      expect(r.value).toBe(15);
    });

    it('notas idênticas', () => {
      const r = calculateArithmeticMean(mi({ items: [{ score: 12 }, { score: 12 }, { score: 12 }] }));
      expect(r.value).toBe(12);
    });
  });

  describe('WEIGHTED_PERCENTAGE', () => {
    it('pesos 30 e 70', () => {
      const r = calculateWeightedPercentage(mi({
        method: 'WEIGHTED_PERCENTAGE',
        items: [
          { score: 14, weight: 30 },
          { score: 16, weight: 70 },
        ],
      }));
      expect(r.value).toBe(15.4);
      expect(r.breakdown[0].contribution).toBe(4.2);
      expect(r.breakdown[1].contribution).toBe(11.2);
    });

    it('pesos iguais equivalem à média aritmética', () => {
      const r = calculateWeightedPercentage(mi({
        method: 'WEIGHTED_PERCENTAGE',
        items: [
          { score: 10, weight: 50 },
          { score: 20, weight: 50 },
        ],
      }));
      expect(r.value).toBe(15);
    });

    it('soma dos pesos diferente de expectedTotal lança CONFLICT', () => {
      expect(() =>
        calculateWeightedPercentage(mi({
          method: 'WEIGHTED_PERCENTAGE',
          items: [
            { score: 14, weight: 20 },
            { score: 16, weight: 30 },
          ],
          expectedTotal: 100,
        })),
      ).toThrow('deve corresponder');
    });

    it('peso negativo lança INVALID_WEIGHT', () => {
      expect(() =>
        calculateWeightedPercentage(mi({
          method: 'WEIGHTED_PERCENTAGE',
          items: [
            { score: 14, weight: -10 },
            { score: 16, weight: 110 },
          ],
        })),
      ).toThrow('maior que zero');
    });

    it('peso zero lança INVALID_WEIGHT', () => {
      expect(() =>
        calculateWeightedPercentage(mi({
          method: 'WEIGHTED_PERCENTAGE',
          items: [
            { score: 14, weight: 0 },
            { score: 16, weight: 100 },
          ],
        })),
      ).toThrow('maior que zero');
    });

    it('arredondamento a 1 casa decimal', () => {
      const r = calculateWeightedPercentage(mi({
        method: 'WEIGHTED_PERCENTAGE',
        items: [
          { score: 11, weight: 30 },
          { score: 16, weight: 70 },
        ],
        rounding: { decimals: 1 },
      }));
      expect(r.decimals).toBe(1);
      expect(Number.isFinite(r.value)).toBe(true);
    });
  });

  describe('PERCENTAGE_SUM', () => {
    it('pesos somam 100', () => {
      const r = calculatePercentageSum(mi({
        method: 'PERCENTAGE_SUM',
        items: [
          { score: 15, weight: 20 },
          { score: 12, weight: 30 },
          { score: 17, weight: 50 },
        ],
      }));
      const expected = 15 * 0.2 + 12 * 0.3 + 17 * 0.5;
      expect(r.value).toBe(Math.round(expected * 100) / 100);
    });

    it('contribuições são exatas', () => {
      const r = calculatePercentageSum(mi({
        method: 'PERCENTAGE_SUM',
        items: [
          { score: 15, weight: 20 },
          { score: 12, weight: 30 },
          { score: 17, weight: 50 },
        ],
      }));
      expect(r.breakdown[0].contribution).toBe(3);
      expect(r.breakdown[1].contribution).toBe(3.6);
      expect(r.breakdown[2].contribution).toBe(8.5);
    });

    it('pesos não somam 100 sem normalização lança CONFLICT', () => {
      expect(() =>
        calculatePercentageSum(mi({
          method: 'PERCENTAGE_SUM',
          items: [
            { score: 10, weight: 40 },
            { score: 10, weight: 40 },
          ],
          allowNormalization: false,
        })),
      ).toThrow('totalizar');
    });

    it('pesos não somam 100 com normalização calcula', () => {
      const r = calculatePercentageSum(mi({
        method: 'PERCENTAGE_SUM',
        items: [
          { score: 14, weight: 2 },
          { score: 16, weight: 3 },
        ],
        allowNormalization: true,
      }));
      const totalW = 5;
      const expected = 14 * (2 / totalW) + 16 * (3 / totalW);
      expect(r.value).toBe(Math.round(expected * 100) / 100);
      expect(r.breakdown[0].normalizedWeight).toBeDefined();
    });

    it('peso 100% retorna a própria nota', () => {
      const r = calculatePercentageSum(mi({
        method: 'PERCENTAGE_SUM',
        items: [{ score: 14, weight: 100 }],
      }));
      expect(r.value).toBe(14);
    });
  });

  describe('NORMALIZED_WEIGHTED_MEAN', () => {
    it('pesos 2, 3, 5 normalizados', () => {
      const r = calculateNormalizedWeightedMean(mi({
        method: 'NORMALIZED_WEIGHTED_MEAN',
        items: [
          { score: 14, weight: 2 },
          { score: 16, weight: 3 },
          { score: 18, weight: 5 },
        ],
      }));
      expect(r.value).toBe(16.6);
      expect(r.breakdown[0].normalizedWeight).toBe(0.2);
      expect(r.breakdown[1].normalizedWeight).toBe(0.3);
      expect(r.breakdown[2].normalizedWeight).toBe(0.5);
    });

    it('soma dos pesos zero lança erro', () => {
      expect(() =>
        calculateNormalizedWeightedMean(mi({
          method: 'NORMALIZED_WEIGHTED_MEAN',
          items: [{ score: 10, weight: 0 }],
        })),
      ).toThrow('maior que zero');
    });

    it('pesos não normalizados em 100%', () => {
      const r = calculateNormalizedWeightedMean(mi({
        method: 'NORMALIZED_WEIGHTED_MEAN',
        items: [
          { score: 10, weight: 1 },
          { score: 20, weight: 2 },
        ],
      }));
      expect(r.value).toBeCloseTo(16.67, 2);
      expect(r.breakdown[0].normalizedWeight).toBeCloseTo(1 / 3, 4);
      expect(r.breakdown[1].normalizedWeight).toBeCloseTo(2 / 3, 4);
    });

    it('peso negativo lança INVALID_WEIGHT', () => {
      expect(() =>
        calculateNormalizedWeightedMean(mi({
          method: 'NORMALIZED_WEIGHTED_MEAN',
          items: [{ score: 10, weight: -1 }],
        })),
      ).toThrow('não pode ser negativo');
    });
  });

  describe('COMPONENT_BASED', () => {
    const acItems: { name: string; weight: number; score: number }[] = [
      { name: 'Teste 1', weight: 30, score: 14 },
      { name: 'Teste 2', weight: 30, score: 16 },
      { name: 'Trabalho', weight: 40, score: 18 },
    ];

    const componentInput: CalculationInput = {
      method: 'COMPONENT_BASED',
      items: [],
      components: [
        {
          name: 'Avaliação Contínua',
          weight: 40,
          children: acItems.map((item) => ({
            name: item.name,
            weight: item.weight,
            score: item.score,
          })),
        },
        { name: 'Exame', weight: 60, score: 17 },
      ],
    };

    it('cálculo hierárquico correto', () => {
      const r = calculateComponentBased(mi(componentInput));
      const acExpected = 14 * 0.3 + 16 * 0.3 + 18 * 0.4;
      const finalExpected = acExpected * 0.4 + 17 * 0.6;
      expect(r.value).toBe(Math.round(finalExpected * 100) / 100);
      expect(r.method).toBe('COMPONENT_BASED');
      expect(r.breakdown).toHaveLength(2);
    });

    it('breakdown contém sub-componentes', () => {
      const r = calculateComponentBased(mi(componentInput));
      expect(r.breakdown[0].children).toHaveLength(3);
      expect(r.breakdown[1].children).toBeUndefined();
    });

    it('componentes obrigatórios', () => {
      expect(() =>
        calculateComponentBased(mi({ method: 'COMPONENT_BASED', items: [] })),
      ).toThrow('obrigatórios');
    });

    it('componente sem nota lança erro', () => {
      expect(() =>
        calculateComponentBased(mi({
          method: 'COMPONENT_BASED',
          items: [],
          components: [{ name: 'A', weight: 100 }],
        })),
      ).toThrow('não possui nota');
    });

    it('pesos do nível não somam 100 lança CONFLICT', () => {
      expect(() =>
        calculateComponentBased(mi({
          method: 'COMPONENT_BASED',
          items: [],
          components: [
            { name: 'A', weight: 40, score: 10 },
            { name: 'B', weight: 60, score: 10 },
            { name: 'C', weight: 20, score: 10 },
          ],
        })),
      ).toThrow('devem somar');
    });

    it('pesos internos não somam 100 lança erro', () => {
      expect(() =>
        calculateComponentBased(mi({
          method: 'COMPONENT_BASED',
          items: [],
          components: [
            {
              name: 'AC',
              weight: 50,
              children: [
                { name: 'T1', weight: 50, score: 10 },
                { name: 'T2', weight: 30, score: 10 },
              ],
            },
            { name: 'Exame', weight: 50, score: 10 },
          ],
        })),
      ).toThrow('devem somar');
    });

    it('com allowNormalization aceita pesos não 100', () => {
      const r = calculateComponentBased(mi({
        method: 'COMPONENT_BASED',
        items: [],
        allowNormalization: true,
        components: [
          { name: 'A', weight: 40, score: 10 },
          { name: 'B', weight: 60, score: 20 },
        ],
      }));
      expect(r.value).toBe(16);
    });
  });

  describe('CUSTOM_WEIGHTED', () => {
    it('fórmula SUM', () => {
      const r = calculateCustomWeighted(mi({
        method: 'CUSTOM_WEIGHTED',
        formula: 'SUM',
        maxScore: 100,
        items: [{ score: 10 }, { score: 20 }, { score: 30 }],
      }));
      expect(r.value).toBe(60);
      expect(r.formula).toBe('SUM');
    });

    it('fórmula MAX', () => {
      const r = calculateCustomWeighted(mi({
        method: 'CUSTOM_WEIGHTED',
        formula: 'MAX',
        maxScore: 100,
        items: [{ score: 10 }, { score: 25 }, { score: 15 }],
      }));
      expect(r.value).toBe(25);
    });

    it('fórmula MIN', () => {
      const r = calculateCustomWeighted(mi({
        method: 'CUSTOM_WEIGHTED',
        formula: 'MIN',
        items: [{ score: 10 }, { score: 5 }, { score: 15 }],
      }));
      expect(r.value).toBe(5);
    });

    it('fórmula WEIGHTED_100', () => {
      const r = calculateCustomWeighted(mi({
        method: 'CUSTOM_WEIGHTED',
        formula: 'WEIGHTED_100',
        items: [
          { score: 14, weight: 30 },
          { score: 16, weight: 70 },
        ],
      }));
      expect(r.value).toBe(15.4);
    });

    it('fórmula NORMALIZED_MEAN', () => {
      const r = calculateCustomWeighted(mi({
        method: 'CUSTOM_WEIGHTED',
        formula: 'NORMALIZED_MEAN',
        items: [
          { score: 14, weight: 2 },
          { score: 16, weight: 3 },
        ],
      }));
      expect(r.value).toBeCloseTo(15.2, 2);
    });

    it('fórmula MEAN_OF_TOP_K padrão (k=2)', () => {
      const r = calculateCustomWeighted(mi({
        method: 'CUSTOM_WEIGHTED',
        formula: 'MEAN_OF_TOP_K',
        items: [{ score: 10 }, { score: 12 }, { score: 14 }, { score: 16 }],
      }));
      expect(r.value).toBe(15);
    });

    it('fórmula MEAN_OF_TOP_K com k customizado', () => {
      const r = calculateCustomWeighted(mi({
        method: 'CUSTOM_WEIGHTED',
        formula: 'MEAN_OF_TOP_K',
        top: 1,
        items: [{ score: 10 }, { score: 20 }],
      }));
      expect(r.value).toBe(20);
    });

    it('fórmula não registada lança erro', () => {
      expect(() =>
        calculateCustomWeighted(mi({
          method: 'CUSTOM_WEIGHTED',
          formula: 'FORMULA_INEXISTENTE',
          items: [{ score: 10 }],
        })),
      ).toThrow('não está registada');
    });

    it('fórmula obrigatória para CUSTOM_WEIGHTED', () => {
      expect(() =>
        calculateCustomWeighted(mi({
          method: 'CUSTOM_WEIGHTED',
          items: [{ score: 10 }],
        })),
      ).toThrow('obrigatória');
    });

    it('WEIGHTED_100 com pesos que não somam 100 lança CONFLICT', () => {
      expect(() =>
        calculateCustomWeighted(mi({
          method: 'CUSTOM_WEIGHTED',
          formula: 'WEIGHTED_100',
          items: [{ score: 10, weight: 50 }, { score: 10, weight: 60 }],
          expectedTotal: 100,
        })),
      ).toThrow('deve corresponder');
    });
  });

  describe('calculate (dispatcher)', () => {
    it('despacha para ARITHMETIC_MEAN', () => {
      const r = calculate(mi({
        method: 'ARITHMETIC_MEAN',
        items: [{ score: 10 }, { score: 20 }],
      }));
      expect(r.method).toBe('ARITHMETIC_MEAN');
      expect(r.value).toBe(15);
    });

    it('despacha para WEIGHTED_PERCENTAGE', () => {
      const r = calculate(mi({
        method: 'WEIGHTED_PERCENTAGE',
        items: [{ score: 14, weight: 30 }, { score: 16, weight: 70 }],
      }));
      expect(r.method).toBe('WEIGHTED_PERCENTAGE');
      expect(r.value).toBe(15.4);
    });

    it('despacha para CUSTOM_WEIGHTED', () => {
      const r = calculate(mi({
        method: 'CUSTOM_WEIGHTED',
        formula: 'SUM',
        items: [{ score: 10 }, { score: 5 }],
      }));
      expect(r.value).toBe(15);
    });
  });

  describe('arredondamento', () => {
    it('0 casas: 15.4567 → 15', () => {
      const r = calculateArithmeticMean(mi({
        items: [{ score: 15.4567 }],
        rounding: { decimals: 0 },
      }));
      expect(r.value).toBe(15);
    });

    it('1 casa: 15.4567 → 15.5', () => {
      const r = calculateArithmeticMean(mi({
        items: [{ score: 15.4567 }],
        rounding: { decimals: 1 },
      }));
      expect(r.value).toBe(15.5);
    });

    it('2 casas: 15.4567 → 15.46', () => {
      const r = calculateArithmeticMean(mi({
        items: [{ score: 15.4567 }],
        rounding: { decimals: 2 },
      }));
      expect(r.value).toBe(15.46);
    });

    it('padrão é 2 casas decimais', () => {
      const r = calculateArithmeticMean(mi({ items: [{ score: 15.4567 }] }));
      expect(r.decimals).toBe(2);
      expect(r.value).toBe(15.46);
    });
  });

  describe('intervalos de notas', () => {
    it('minScore e maxScore personalizados', () => {
      const r = calculateArithmeticMean(mi({
        items: [{ score: 100 }, { score: 90 }],
        minScore: 0,
        maxScore: 100,
      }));
      expect(r.value).toBe(95);
    });

    it('nota abaixo de minScore personalizado', () => {
      expect(() =>
        calculateArithmeticMean(mi({
          items: [{ score: 2 }],
          minScore: 5,
          maxScore: 20,
        })),
      ).toThrow('inferior ao mínimo');
    });
  });

  describe('pesos', () => {
    it('peso negativo é rejeitado em todos os métodos', () => {
      const items = [{ score: 10, weight: -1 }];
      expect(() => calculateWeightedPercentage(mi({ method: 'WEIGHTED_PERCENTAGE', items }))).toThrow('maior que zero');
      expect(() => calculatePercentageSum(mi({ method: 'PERCENTAGE_SUM', items }))).toThrow('não pode ser negativo');
      expect(() => calculateNormalizedWeightedMean(mi({ method: 'NORMALIZED_WEIGHTED_MEAN', items }))).toThrow('não pode ser negativo');
    });
  });
});
