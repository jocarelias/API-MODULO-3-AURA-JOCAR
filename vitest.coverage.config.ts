import { defineConfig } from 'vitest/config';

/**
 * Cobertura combinedada: unitários + e2e + testes dos serviços.
 *
 * Uma configuração só de unitários mede ~45% porque quase todo o código
 * (service, router, DTOs) só é exercitado através das requisições HTTP. O
 * número que interessa ao guia é a cobertura do módulo inteiro, por isso as
 * três suites correm no mesmo processo de cobertura.
 *
 * Limites: 80% (linhas, funções, ramos e statements), conforme o guia.
 */
const include = [
  'src/**/*.test.ts',
  'src/modules/schedules-assessments/tests/**/*.e2e.test.ts',
  'packages/*/src/**/*.test.ts',
  'services/*/src/**/*.test.ts',
];

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include,
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Os e2e criam dados no PostgreSQL partilhado e cada ficheiro escolhe a
    // própria escola por isso correm em série; os unitários em paralelo
    // deixariam a suite mais lenta sem qualquer benefício.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'packages/*/src/**/*.ts', 'services/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/tests/**',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        'src/main.ts',
        'src/app.ts',
        'services/*/src/main.ts',
        'scripts/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
