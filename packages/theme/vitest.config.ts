import { defineConfig } from 'vitest/config';

/**
 * Vitest config for `@keel/theme`.
 *
 * Runs in node — task 7 only ships static design tokens, component
 * overrides and a string global-styles fragment, none of which need a DOM.
 *
 * `testTimeout` matches the policy in sibling `@keel/*` packages.
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
