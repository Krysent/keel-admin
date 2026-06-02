import { defineConfig } from 'vitest/config';

/**
 * Vitest config for `@keel/http`. Runs in node — none of the tests rely on
 * a real DOM (the token manager and interceptors are pure functions over
 * Axios primitives, and we exercise them with mocked adapters).
 *
 * `testTimeout` is bumped slightly so the property-based tests in
 * `tests/token-manager.pbt.test.ts` have headroom for fast-check shrinking
 * on slow CI hardware without hitting the default 5s ceiling.
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
