import { defineConfig } from 'tsup';

/**
 * `@keel/theme` ships AntD 5 design tokens, component overrides and the
 * dark-algorithm wiring for the iOS-style admin shell.
 *
 * `antd` is the only peer dependency (the tokens import its `ThemeConfig`
 * type and `theme.darkAlgorithm` reference). Marking it external keeps the
 * consumer's copy authoritative and avoids duplicate AntD bundles.
 *
 * `@keel/*` packages are kept external so internal versions resolve via
 * the workspace, mirroring the policy in `@keel/http` and `@keel/auth`.
 *
 * The package also exports `./global.css` directly from the package root
 * (see `package.json#exports`) so consumers can do
 * `import '@keel/theme/global.css'` without going through the bundle.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ['antd', 'react', 'react-dom', /^@keel\//],
});
