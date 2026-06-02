/**
 * React variant of the keel-admin ESLint config.
 * For workspaces consuming React (apps/admin, packages/auth, packages/ui, packages/i18n, ...).
 */
module.exports = {
  root: false,
  extends: [
    './index.js',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  plugins: ['react', 'react-hooks'],
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/jsx-uses-react': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Requirement 18.2 — ban raw dangerouslySetInnerHTML to prevent XSS.
    // All rich-text rendering MUST go through the DOMPurify `sanitize()`
    // utility in `apps/admin/src/utils/sanitize.ts`.
    'react/no-danger': 'error',
  },
};
