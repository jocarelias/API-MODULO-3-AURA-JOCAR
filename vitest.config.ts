import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'packages/auth/src/**/*.test.ts'],
    exclude: ['src/**/*.e2e.test.ts', '**/node_modules/**', '**/dist/**'],
    environment: 'node',
    fileParallelism: true,
  },
});