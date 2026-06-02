import { defineConfig } from 'tsup';

/**
 * `@keel/types` is a *types-only* package — there is no runtime code to ship.
 * We still emit empty `index.js` / `index.cjs` stubs so downstream packages
 * can `require('@keel/types')` without a resolution error, and we emit
 * `index.d.ts` which is the package's actual contract.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
});
