import { defineConfig } from 'tsup';

/**
 * `@keel/http` ships an Axios factory plus a few framework-agnostic helpers.
 * We emit ESM + CJS + DTS so consumers in any module system get the same
 * API. `axios` is a peer dependency (Requirement 2.6) and `@keel/*` packages
 * are kept external so internal versions resolve correctly.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ['axios', /^@keel\//],
});
