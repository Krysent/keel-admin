/**
 * Root ESLint config for the keel-admin monorepo.
 *
 * Consumed by lint-staged (husky pre-commit) when invoked at the repo root.
 * Workspaces can either rely on this config or define their own
 * `.eslintrc.cjs` extending `@keel/eslint-config` / `@keel/eslint-config/react`.
 */
module.exports = {
  root: true,
  extends: ['@keel/eslint-config/react'],
  ignorePatterns: [
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.turbo/**',
    '**/node_modules/**',
    '**/playwright-report/**',
    '**/test-results/**',
  ],
};
