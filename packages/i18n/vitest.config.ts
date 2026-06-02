import { defineConfig } from 'vitest/config';

/**
 * Vitest config for `@keel/i18n`.
 *
 * Runs in node — task 6.1 only exercises `createI18n.loadNamespaces` against
 * a fake i18next backend (no DOM needed). Once the React-bound `useT` /
 * `I18nProvider` surface lands in task 6 proper, this can switch to
 * `environment: 'jsdom'`.
 *
 * `testTimeout` matches the policy in `@keel/auth` and `@keel/http`.
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
