import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest config for `@keel/admin`.
 *
 * Uses jsdom environment for React component tests alongside pure store tests.
 * Coverage thresholds enforce quality gates per Requirement 15.1:
 *   - lines ≥ 80%
 *   - branches ≥ 90%
 *
 * CI runs with `vitest --run` (single-run mode, Requirement 15.5).
 *
 * Validates: Requirements 15.1, 15.5
 */
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    reporters: ['default'],
    watch: false,
    testTimeout: 15000,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/index.ts',
        'src/**/*.d.ts',
        'src/vite-env.d.ts',
        'src/types/**',
      ],
      thresholds: {
        lines: 80,
        branches: 90,
        functions: 80,
        statements: 80,
      },
    },
  },
});
