/**
 * Base ESLint config shared by all keel-admin workspaces.
 * Targets TypeScript codebases that are framework-agnostic (utils, types, http core, etc.).
 */
module.exports = {
  root: false,
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['tsconfig.json', 'apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
      },
      node: { extensions: ['.js', '.cjs', '.mjs', '.ts', '.tsx'] },
    },
  },
  rules: {
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-default-export': 'off',
    // i18next / axios export both default and named bindings — the
    // resulting "named-as-default-member" warnings are false positives
    // for our use sites.
    'import/no-named-as-default-member': 'off',
    'import/no-named-as-default': 'off',
    // `eslint-plugin-import` cannot reliably introspect the ESM/CJS
    // interop default exports of `react` / `react-dom` / DOMPurify and
    // similar packages. TypeScript already validates these imports.
    'import/default': 'off',
    // Path resolution is fully handled by TypeScript (tsconfig has
    // `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`,
    // so `.ts` may legitimately resolve to `.tsx`). Avoid duplicating
    // module-resolution checks in ESLint where the TS resolver lacks
    // the cross-extension fallback.
    'import/no-unresolved': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      // Test files have looser conventions (mocks may use dynamic imports,
      // unused setup variables are common, ad-hoc import order is OK).
      files: [
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
        '**/tests/**/*.{ts,tsx,js,jsx}',
      ],
      rules: {
        '@typescript-eslint/consistent-type-imports': 'off',
        'import/order': 'off',
      },
    },
    {
      // Ambient declaration files commonly use `import()` inline types
      // for forward references. The `consistent-type-imports` rule's
      // auto-fix produces invalid syntax in `.d.ts` contexts.
      files: ['**/*.d.ts'],
      rules: {
        '@typescript-eslint/consistent-type-imports': 'off',
      },
    },
    {
      // Plain CJS config files (`.eslintrc.cjs`, `*.config.cjs`, etc.).
      files: ['*.cjs', '**/*.cjs'],
      parserOptions: { sourceType: 'script' },
    },
  ],
  ignorePatterns: [
    'dist',
    'build',
    'coverage',
    '.turbo',
    'node_modules',
    '*.config.js',
    '*.config.mjs',
  ],
};
