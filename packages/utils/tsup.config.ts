import { defineConfig } from 'tsup';

/**
 * `@keel/utils` ships browser- and node-friendly utilities. We emit ESM + CJS
 * + DTS so consumers in any module system get the same API surface.
 *
 * `treeshake: true` plus the `sideEffects: false` flag in package.json lets
 * downstream bundlers drop unused exports — important because
 * `apps/admin` only uses a handful of these per page.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: [/^@keel\//],
});
