import { defineConfig } from 'tsup';

/**
 * `@keel/auth` ships the permission *mechanism* (no business permission codes).
 *
 * For task 5.1 the public surface is the pure `evaluatePermission` function
 * plus its supporting types — no React imports yet. Once task 5 lands the
 * full `createAuth` factory, `react` and `react-router-dom` will be picked
 * up as peer dependencies (already declared in `package.json`) and
 * preserved as externals here so the consumer's copy resolves correctly.
 *
 * `@keel/*` packages are kept external so internal versions resolve via the
 * workspace, mirroring the policy in `@keel/http`.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ['react', 'react-dom', 'react-router-dom', /^@keel\//],
});
