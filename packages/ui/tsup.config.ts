import { defineConfig } from 'tsup';

/**
 * `@keel/ui` ships business component thin wrappers around AntD 5 +
 * `@ant-design/pro-components` (PageContainer, SearchForm, KeelTable,
 * KeelForm, KeelDescriptions, KeelCard — see design.md → "Pro-Components
 * 组件策略").
 *
 * Task 8.1 is a slice of the table封装 — only the pure column permission
 * filter (`filterColumnsByPermission`) — so the bundle currently has no
 * React imports. We keep `react`, `react-dom`, `antd` and
 * `@ant-design/pro-components` declared as externals up front so the
 * peer-dep contract is stable when the React surface lands with task 8.
 *
 * `@keel/*` packages are kept external so internal versions resolve via
 * the workspace, mirroring the policy in `@keel/http`, `@keel/auth` and
 * `@keel/theme`.
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
    'antd',
    '@ant-design/pro-components',
    /^@keel\//,
  ],
});
