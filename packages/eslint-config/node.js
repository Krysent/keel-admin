/**
 * Node variant of the keel-admin ESLint config.
 * For tooling/scripts and Node-only utilities (e.g., vite plugins, build scripts).
 */
module.exports = {
  root: false,
  extends: ['./index.js'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    'no-console': 'off',
  },
};
