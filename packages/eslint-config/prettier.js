/**
 * Shared Prettier config for keel-admin workspaces. Mirrors the root .prettierrc.cjs
 * so that other workspaces can `extends: '@keel/eslint-config/prettier'` cleanly.
 *
 * @type {import('prettier').Config}
 */
module.exports = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
  endOfLine: 'lf',
};
