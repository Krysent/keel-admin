import { defineConfig } from 'vitest/config';

/**
 * Vitest config for `@keel/auth`.
 *
 * Runs in node — task 5.1 only exercises the pure `evaluatePermission`
 * function so a DOM is not needed. When the React-bound factory (task 5)
 * lands its tests will either run in node via direct hook invocation or
 * switch this to `environment: 'jsdom'` once `@testing-library/react`
 * is added at the workspace level.
 *
 * `testTimeout` is bumped to give fast-check shrinking enough headroom on
 * slow CI hardware, matching the policy in `@keel/http`.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    reporters: ['default'],
    watch: false,
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
