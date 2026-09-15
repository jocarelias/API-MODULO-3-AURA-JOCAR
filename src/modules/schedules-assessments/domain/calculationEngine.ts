export const CALCULATION_MIN_SCORE_DEFAULT = 0;
export const CALCULATION_MAX_SCORE_DEFAULT = 20;
export const CALCULATION_EXPECTED_TOTAL_DEFAULT = 100;
export const CALCULATION_DECIMALS_DEFAULT = 2;

export const CALCULATION_METHOD_CODES = [
  'ARITHMETIC_MEAN',
  'WEIGHTED_PERCENTAGE',
  'PERCENTAGE_SUM',
  'NORMALIZED_WEIGHTED_MEAN',
  'COMPONENT_BASED',
  'CUSTOM_WEIGHTED',
] as const;

export type CalculationMethodCode = (typeof CALCULATION_METHOD_CODES)[number];

export type CalculationErrorCode =
  | 'EMPTY_ITEMS'
  | 'INVALID_SCORE'
  | 'INVALID_WEIGHT'
  | 'WEIGHT_TOTAL_MISMATCH'
  | 'WEIGHT_SUM_MUST_BE_POSITIVE'
  | 'INVALID_COMPONENTS'
  | 'COMPONENT_WEIGHT_MISMATCH'
  | 'FORMULA_NOT_REGISTERED';

export const CALCULATION_ERROR_HTTP: Record<CalculationErrorCode, number> = {
  EMPTY_ITEMS: 400,
  INVALID_SCORE: 400,
  INVALID_WEIGHT: 400,
  WEIGHT_TOTAL_MISMATCH: 409,
  WEIGHT_SUM_MUST_BE_POSITIVE: 409,
  INVALID_COMPONENTS: 400,
  COMPONENT_WEIGHT_MISMATCH: 409,
  FORMULA_NOT_REGISTERED: 400,
};

export class CalculationError extends Error {
  code: CalculationErrorCode;

  constructor(code: CalculationErrorCode, message: string) {
    super(message);
    this.name = 'CalculationError';
    this.code = code;
  }
}

export interface CalculationItem {
  assessmentId?: string;
  name?: string;
  type?: string;
  score: number;
  weight?: number;
}

export interface CalculationComponent {
  id?: string;
  assessmentId?: string;
  name?: string;
  weight: number;
  score?: number;
  children?: CalculationComponent[];
}

export interface RoundingOption {
  decimals: 0 | 1 | 2;
}

export interface CalculationInput {
  method: CalculationMethodCode;
  items: CalculationItem[];
  components?: CalculationComponent[];
  formula?: string;
  rounding?: RoundingOption;
  minScore?: number;
  maxScore?: number;
  expectedTotal?: number;
  allowNormalization?: boolean;
  top?: number;
}

export interface CalculationBreakdownEntry {
  id?: string;
  assessmentId?: string;
  name?: string;
  type?: string;
  label?: string;
  score: number;
  weight?: number;
  normalizedWeight?: number;
  contribution?: number;
  children?: CalculationBreakdownEntry[];
}

export interface CalculationResult {
  method: CalculationMethodCode;
  value: number;
  decimals: number;
  formula?: string;
  breakdown: CalculationBreakdownEntry[];
}

export interface CalculationMethodMeta {
  code: CalculationMethodCode;
  name: string;
  description: string;
  formula: string;
}

export interface CustomFormulaMeta {
  key: string;
  name: string;
  description: string;
  requiresWeights: boolean;
}

const EPSILON = 1e-9;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function display(value: number, decimals: number): number {
  return round(value, decimals);
}

function decimalsOf(input: CalculationInput): number {
  return input.rounding?.decimals ?? CALCULATION_DECIMALS_DEFAULT;
}

function scoreBounds(input: CalculationInput): { minScore: number; maxScore: number } {
  return {
    minScore: input.minScore ?? CALCULATION_MIN_SCORE_DEFAULT,
    maxScore: input.maxScore ?? CALCULATION_MAX_SCORE_DEFAULT,
  };
}

function expectedTotalOf(input: CalculationInput): number {
  return input.expectedTotal ?? CALCULATION_EXPECTED_TOTAL_DEFAULT;
}

function assertScore(value: number, minScore: number, maxScore: number, context: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CalculationError('INVALID_SCORE', `${context}: nota deve ser um número finito`);
  }
  if (value < minScore) {
    throw new CalculationError('INVALID_SCORE', `${context}: nota ${value} é inferior ao mínimo ${minScore}`);
  }
  if (value > maxScore) {
    throw new CalculationError('INVALID_SCORE', `${context}: nota ${value} é superior ao máximo ${maxScore}`);
  }
}

function assertWeight(value: number | undefined, positive: boolean, context: string): void {
  if (value === undefined || typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CalculationError('INVALID_WEIGHT', `${context}: peso deve ser um número finito`);
  }
  if (positive && value <= 0) {
    throw new CalculationError('INVALID_WEIGHT', `${context}: peso deve ser maior que zero`);
  }
  if (!positive && value < 0) {
    throw new CalculationError('INVALID_WEIGHT', `${context}: peso não pode ser negativo`);
  }
}

function itemLabel(item: CalculationItem, index: number): string {
  return item.name ?? item.assessmentId ?? `Item ${index + 1}`;
}

function assertNonEmptyItems(items: CalculationItem[]): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CalculationError('EMPTY_ITEMS', 'A lista de notas não pode estar vazia');
  }
}

function sumOfWeights(items: CalculationItem[]): number {
  return items.reduce((acc: number, item: CalculationItem) => acc + (item.weight ?? 0), 0);
}

function assertWeightSumMatchesExpected(items: CalculationItem[], expected: number): void {
  const total = sumOfWeights(items);
  if (Math.abs(total - expected) >= EPSILON) {
    throw new CalculationError(
      'WEIGHT_TOTAL_MISMATCH',
      `A soma dos pesos (${total}) deve corresponder à configuração (${expected})`,
    );
  }
}

function itemBreakdown(item: CalculationItem, value: number, decimals: number): CalculationBreakdownEntry {
  return {
    assessmentId: item.assessmentId,
    name: item.name,
    type: item.type,
    score: item.score,
    weight: item.weight,
    contribution: display(value, decimals),
  };
}

export function calculateArithmeticMean(input: CalculationInput): CalculationResult {
  const { minScore, maxScore } = scoreBounds(input);
  const decimals = decimalsOf(input);
  assertNonEmptyItems(input.items);
  input.items.forEach((item, index) => {
    assertScore(item.score, minScore, maxScore, itemLabel(item, index));
  });

  const exact = input.items.reduce((acc: number, item: CalculationItem) => acc + item.score, 0) / input.items.length;

  return {
    method: 'ARITHMETIC_MEAN',
    value: round(exact, decimals),
    decimals,
    breakdown: input.items.map((item, index) => itemBreakdown(item, item.score, decimals)),
  };
}

export function calculateWeightedPercentage(input: CalculationInput): CalculationResult {
  const { minScore, maxScore } = scoreBounds(input);
  const decimals = decimalsOf(input);
  const expected = expectedTotalOf(input);
  assertNonEmptyItems(input.items);
  input.items.forEach((item, index) => {
    assertScore(item.score, minScore, maxScore, itemLabel(item, index));
    assertWeight(item.weight, true, itemLabel(item, index));
  });

  const totalWeight = sumOfWeights(input.items);
  assertWeightSumMatchesExpected(input.items, expected);

  const exact =
    input.items.reduce((acc: number, item: CalculationItem) => acc + item.score * (item.weight ?? 0), 0) / totalWeight;

  return {
    method: 'WEIGHTED_PERCENTAGE',
    value: round(exact, decimals),
    decimals,
    breakdown: input.items.map((item, index) =>
      itemBreakdown(item, (item.score * (item.weight ?? 0)) / totalWeight, decimals),
    ),
  };
}

export function calculatePercentageSum(input: CalculationInput): CalculationResult {
  const { minScore, maxScore } = scoreBounds(input);
  const decimals = decimalsOf(input);
  const expected = expectedTotalOf(input);
  const allowNormalization = input.allowNormalization ?? false;
  assertNonEmptyItems(input.items);
  input.items.forEach((item, index) => {
    assertScore(item.score, minScore, maxScore, itemLabel(item, index));
    assertWeight(item.weight, false, itemLabel(item, index));
  });

  const totalWeight = sumOfWeights(input.items);
  const matchesExpected = Math.abs(totalWeight - expected) < EPSILON;
  if (!matchesExpected && !allowNormalization) {
    throw new CalculationError(
      'WEIGHT_TOTAL_MISMATCH',
      `As percentagens devem totalizar ${expected}% (atual: ${totalWeight}%) — ou ative a normalização`,
    );
  }

  const denominator = matchesExpected ? expected : totalWeight;
  const exact =
    input.items.reduce((acc: number, item: CalculationItem) => acc + item.score * (item.weight ?? 0), 0) / denominator;

  return {
    method: 'PERCENTAGE_SUM',
    value: round(exact, decimals),
    decimals,
    breakdown: input.items.map((item) => {
      const contribution = (item.score * (item.weight ?? 0)) / denominator;
      const entry = itemBreakdown(item, contribution, decimals);
      if (!matchesExpected) {
        entry.normalizedWeight = display((item.weight ?? 0) / totalWeight, 6);
      }
      return entry;
    }),
  };
}

export function calculateNormalizedWeightedMean(input: CalculationInput): CalculationResult {
  const { minScore, maxScore } = scoreBounds(input);
  const decimals = decimalsOf(input);
  assertNonEmptyItems(input.items);
  input.items.forEach((item, index) => {
    assertScore(item.score, minScore, maxScore, itemLabel(item, index));
    assertWeight(item.weight, false, itemLabel(item, index));
  });

  const totalWeight = sumOfWeights(input.items);
  if (totalWeight <= EPSILON) {
    throw new CalculationError('WEIGHT_SUM_MUST_BE_POSITIVE', 'A soma dos pesos deve ser maior que zero');
  }

  const normalized: number[] = input.items.map((item) => (item.weight ?? 0) / totalWeight);
  const exact = input.items.reduce(
    (acc: number, item: CalculationItem, index: number) => acc + item.score * normalized[index],
    0,
  );

  return {
    method: 'NORMALIZED_WEIGHTED_MEAN',
    value: round(exact, decimals),
    decimals,
    breakdown: input.items.map((item, index) => {
      const contribution = item.score * normalized[index];
      const entry = itemBreakdown(item, contribution, decimals);
      entry.normalizedWeight = display(normalized[index], 6);
      return entry;
    }),
  };
}

interface ResolvedComponent {
  entry: CalculationBreakdownEntry;
  value: number;
}

function resolveComponent(
  node: CalculationComponent,
  input: CalculationInput,
): ResolvedComponent {
  const { minScore, maxScore } = scoreBounds(input);
  const decimals = decimalsOf(input);
  const expected = expectedTotalOf(input);
  const allowNormalization = input.allowNormalization ?? false;
  const label = node.name ?? node.id ?? node.assessmentId ?? 'Componente';

  if (node.children && node.children.length > 0) {
    node.children.forEach((child, index) => {
      assertWeight(child.weight, true, `${label} › filho ${index + 1}`);
    });
    const childTotal = node.children.reduce((acc: number, child: CalculationComponent) => acc + child.weight, 0);
    if (Math.abs(childTotal - expected) >= EPSILON && !allowNormalization) {
      throw new CalculationError(
        'COMPONENT_WEIGHT_MISMATCH',
        `Os pesos do nível "${label}" devem somar ${expected}% (atual: ${childTotal}%)`,
      );
    }
    const children = node.children.map((child) => resolveComponent(child, input));
    const layerWeight = (weight: number, total: number) =>
      allowNormalization ? (total > EPSILON ? weight / total : 0) : weight / expected;
    const value = node.children.reduce(
      (acc: number, child: CalculationComponent, index: number) =>
        acc + children[index].value * layerWeight(child.weight, childTotal),
      0,
    );
    return {
      entry: {
        id: node.id,
        assessmentId: node.assessmentId,
        name: node.name,
        label,
        score: display(value, decimals),
        weight: node.weight,
        children: children.map((child) => child.entry),
      },
      value,
    };
  }

  if (node.score === undefined || node.score === null) {
    throw new CalculationError('INVALID_COMPONENTS', `O componente "${label}" não possui nota`);
  }
  assertScore(node.score, minScore, maxScore, label);

  return {
    entry: {
      id: node.id,
      assessmentId: node.assessmentId,
      name: node.name,
      label,
      score: node.score,
      weight: node.weight,
      contribution: display(node.score, decimals),
    },
    value: node.score,
  };
}

export function calculateComponentBased(input: CalculationInput): CalculationResult {
  const decimals = decimalsOf(input);
  const expected = expectedTotalOf(input);
  const allowNormalization = input.allowNormalization ?? false;
  const components = input.components;

  if (!components || components.length === 0) {
    throw new CalculationError('INVALID_COMPONENTS', 'Os componentes são obrigatórios para o cálculo por componentes');
  }

  components.forEach((component, index) => {
    assertWeight(component.weight, true, `Componente ${index + 1}`);
  });
  const rootTotal = components.reduce((acc: number, component: CalculationComponent) => acc + component.weight, 0);
  if (Math.abs(rootTotal - expected) >= EPSILON && !allowNormalization) {
    throw new CalculationError(
      'COMPONENT_WEIGHT_MISMATCH',
      `Os pesos do nível superior devem somar ${expected}% (atual: ${rootTotal}%)`,
    );
  }

  const resolved = components.map((component) => resolveComponent(component, input));
  const layerWeight = (weight: number, total: number) =>
    allowNormalization ? (total > EPSILON ? weight / total : 0) : weight / expected;
  const exact = components.reduce(
    (acc: number, component: CalculationComponent, index: number) =>
      acc + resolved[index].value * layerWeight(component.weight, rootTotal),
    0,
  );

  return {
    method: 'COMPONENT_BASED',
    value: round(exact, decimals),
    decimals,
    breakdown: resolved.map((resolvedComponent) => resolvedComponent.entry),
  };
}

export interface CustomFormula {
  meta: CustomFormulaMeta;
  calculate(items: CalculationItem[], input: CalculationInput): number;
}

export const CUSTOM_FORMULAS: Record<string, CustomFormula> = {
  SUM: {
    meta: {
      key: 'SUM',
      name: 'Soma das notas',
      description: 'Devolve a soma direta das notas (os pesos são ignorados).',
      requiresWeights: false,
    },
    calculate: (items) => items.reduce((acc: number, item: CalculationItem) => acc + item.score, 0),
  },
  MAX: {
    meta: {
      key: 'MAX',
      name: 'Maior nota',
      description: 'Devolve a maior nota da lista (os pesos são ignorados).',
      requiresWeights: false,
    },
    calculate: (items) => Math.max(...items.map((item) => item.score)),
  },
  MIN: {
    meta: {
      key: 'MIN',
      name: 'Menor nota',
      description: 'Devolve a menor nota da lista (os pesos são ignorados).',
      requiresWeights: false,
    },
    calculate: (items) => Math.min(...items.map((item) => item.score)),
  },
  WEIGHTED_100: {
    meta: {
      key: 'WEIGHTED_100',
      name: 'Soma ponderada a 100%',
      description: 'Soma das contribuições nota × peso, exigindo que os pesos totalizem 100%.',
      requiresWeights: true,
    },
    calculate: (items, input) => {
      const expected = expectedTotalOf(input);
      assertWeightSumMatchesExpected(items, expected);
      return items.reduce((acc: number, item: CalculationItem) => acc + item.score * (item.weight ?? 0), 0) / expected;
    },
  },
  NORMALIZED_MEAN: {
    meta: {
      key: 'NORMALIZED_MEAN',
      name: 'Média ponderada normalizada',
      description: 'Média ponderada com pesos normalizados pela sua soma.',
      requiresWeights: true,
    },
    calculate: (items) => {
      const totalWeight = sumOfWeights(items);
      if (totalWeight <= EPSILON) {
        throw new CalculationError('WEIGHT_SUM_MUST_BE_POSITIVE', 'A soma dos pesos deve ser maior que zero');
      }
      return items.reduce((acc: number, item: CalculationItem) => acc + item.score * (item.weight ?? 0), 0) / totalWeight;
    },
  },
  MEAN_OF_TOP_K: {
    meta: {
      key: 'MEAN_OF_TOP_K',
      name: 'Média das melhores notas',
      description: 'Média aritmética das k melhores notas (padrão k = 2, configurável).',
      requiresWeights: false,
    },
    calculate: (items, input) => {
      const k = Math.max(1, Math.min(input.top ?? 2, items.length));
      const top = items.map((item) => item.score).sort((a, b) => b - a).slice(0, k);
      return top.reduce((acc: number, score: number) => acc + score, 0) / top.length;
    },
  },
};

export function calculateCustomWeighted(input: CalculationInput): CalculationResult {
  const { minScore, maxScore } = scoreBounds(input);
  const decimals = decimalsOf(input);
  const formulaKey = input.formula;

  if (!formulaKey) {
    throw new CalculationError('FORMULA_NOT_REGISTERED', 'Fórmula é obrigatória para o cálculo personalizado');
  }
  const formula = CUSTOM_FORMULAS[formulaKey];
  if (!formula) {
    throw new CalculationError('FORMULA_NOT_REGISTERED', `Fórmula "${formulaKey}" não está registada no sistema`);
  }

  assertNonEmptyItems(input.items);
  input.items.forEach((item, index) => {
    assertScore(item.score, minScore, maxScore, itemLabel(item, index));
    if (formula.meta.requiresWeights) {
      assertWeight(item.weight, false, itemLabel(item, index));
    }
  });

  const exact = formula.calculate(input.items, input);
  const contributions = input.items.map((item) => item.score);

  return {
    method: 'CUSTOM_WEIGHTED',
    formula: formulaKey,
    value: round(exact, decimals),
    decimals,
    breakdown: input.items.map((item, index) => itemBreakdown(item, contributions[index], decimals)),
  };
}

export function calculate(input: CalculationInput): CalculationResult {
  switch (input.method) {
    case 'ARITHMETIC_MEAN':
      return calculateArithmeticMean(input);
    case 'WEIGHTED_PERCENTAGE':
      return calculateWeightedPercentage(input);
    case 'PERCENTAGE_SUM':
      return calculatePercentageSum(input);
    case 'NORMALIZED_WEIGHTED_MEAN':
      return calculateNormalizedWeightedMean(input);
    case 'COMPONENT_BASED':
      return calculateComponentBased(input);
    case 'CUSTOM_WEIGHTED':
      return calculateCustomWeighted(input);
    default:
      throw new CalculationError('FORMULA_NOT_REGISTERED', `Método "${input.method}" não suportado`);
  }
}

export const CALCULATION_METHODS: CalculationMethodMeta[] = [
  {
    code: 'ARITHMETIC_MEAN',
    name: 'Média aritmética',
    description: 'Média simples das notas: soma dividida pela quantidade.',
    formula: 'Σnota / n',
  },
  {
    code: 'WEIGHTED_PERCENTAGE',
    name: 'Média ponderada percentual',
    description: 'Média por pesos percentuais; a soma dos pesos deve corresponder à configuração (100%).',
    formula: 'Σ(nota × peso) / Σ(peso)',
  },
  {
    code: 'PERCENTAGE_SUM',
    name: 'Soma percentual',
    description: 'Soma das contribuições diretas nota × percentagem (pesos devem totalizar 100%).',
    formula: 'Σ(nota × percentagem)',
  },
  {
    code: 'NORMALIZED_WEIGHTED_MEAN',
    name: 'Média ponderada normalizada',
    description: 'Pesos normalizados pela sua soma; não exige que totalizem 100%.',
    formula: 'Σ(nota × peso/Σpeso)',
  },
  {
    code: 'COMPONENT_BASED',
    name: 'Cálculo por componentes',
    description: 'Cálculo hierárquico por níveis de componentes com pesos percentuais.',
    formula: 'combinação de componentes',
  },
  {
    code: 'CUSTOM_WEIGHTED',
    name: 'Cálculo personalizado',
    description: 'Executa apenas fórmulas registadas e controladas pelo sistema.',
    formula: 'função registada (sem eval)',
  },
];

export const CUSTOM_FORMULA_LIST: CustomFormulaMeta[] = [
  CUSTOM_FORMULAS.SUM.meta,
  CUSTOM_FORMULAS.MAX.meta,
  CUSTOM_FORMULAS.MIN.meta,
  CUSTOM_FORMULAS.WEIGHTED_100.meta,
  CUSTOM_FORMULAS.NORMALIZED_MEAN.meta,
  CUSTOM_FORMULAS.MEAN_OF_TOP_K.meta,
];