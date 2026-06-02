import { defineConfig } from 'vitest/config';

/**
 * Vitest config for `@keel/ui`.
 *
 * Runs in node — task 8.1 only exercises the pure
 * `filterColumnsByPermission` function (no React rendering). When the
 * full KeelTable / KeelForm components land with task 8 this will switch
 * to `environment: 'jsdom'` and pull in `@testing-library/react`.
 *
 * `testTimeout` is bumped to give fast-check shrinking enough headroom on
 * slow CI hardware, matching the policy in sibling `@keel/*` packages.
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
