import { defineConfig } from 'vitest/config';

/**
 * Vitest config for `@keel/utils`. We run in node by default — none of these
 * utilities rely on a real DOM, and the storage adapter intentionally
 * exercises its in-memory fallback when web storage is missing.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    reporters: ['default'],
    watch: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
