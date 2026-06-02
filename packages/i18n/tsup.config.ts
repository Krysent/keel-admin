import { defineConfig } from 'tsup';

/**
 * `@keel/i18n` packages the i18n factory plus React glue for the admin app.
 *
 * Task 6.1 only exercises the namespace lazy-load contract through
 * `createI18n`, but the full task 6 surface (`I18nProvider`, `useT`) will
 * land here too — `react`, `react-i18next` and `i18next` are declared as
 * peer dependencies (see `package.json`) so consumers control the version,
 * and we mark them external here so tree-shaking + dual ESM/CJS work.
 *
 * `@keel/*` packages are also kept external so internal versions resolve
 * via the workspace, mirroring the policy in `@keel/http` and `@keel/auth`.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: [
    'react',
    'react-dom',
    'react-i18next',
    'i18next',
    'i18next-http-backend',
    'i18next-browser-languagedetector',
    /^@keel\//,
  ],
});
