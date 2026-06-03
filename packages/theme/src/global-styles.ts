/**
 * Global CSS fragment for the iOS-themed admin shell.
 *
 * Requirement 9.3 / 9.4 mandate header + modal-mask blur, soft card shadow
 * and an iOS-flavoured scrollbar. AntD's component tokens can't express
 * `backdrop-filter`, so this CSS is layered on top of the ConfigProvider.
 *
 * Two equivalent ways to consume it from the admin app:
 *
 *   1. Import the CSS file directly (preferred, ships verbatim):
 *        import '@keel/theme/global.css';
 *
 *   2. Inject the same string at runtime, e.g. via a `<style>` element:
 *        import { globalStyles } from '@keel/theme';
 *        const tag = document.createElement('style');
 *        tag.textContent = globalStyles;
 *        document.head.appendChild(tag);
 *
 * Both paths must stay in sync with `packages/theme/global.css`. Tests in
 * this package cover the string export; the `.css` file is shipped via
 * `package.json#files` so external consumers can import it directly.
 *
 * Color values use AntD 5 CSS token variables (available because both
 * themeConfig and darkThemeConfig set `cssVar: true`). This ensures
 * light ↔ dark mode swaps update every surface without hardcoded colors.
 */
export const globalStyles = `:root {
  --keel-radius-card: 16px;
  --keel-blur: blur(20px) saturate(180%);
}

body {
  /* Use the AntD layout background token so dark mode flips automatically. */
  background: var(--ant-color-bg-layout, #F2F2F7);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Header: frosted-glass surface that adapts to light / dark mode.
 *
 * Light: white-72% translucent backdrop (iOS design spec).
 * Dark:  dark elevated surface (iOS dark: #1C1C1E at 72% opacity).
 *
 * We can't use a single rgba() for both modes, so we rely on the AntD
 * colorBgElevated CSS variable which is already set to the correct
 * translucent value for each mode in tokens.ts. The color property
 * is explicitly set to colorText so it never inherits the wrong shade
 * regardless of what the outer Layout sets.
 */
.ant-layout-header {
  background: var(--ant-color-bg-elevated);
  backdrop-filter: var(--keel-blur);
  -webkit-backdrop-filter: var(--keel-blur);
  border-bottom: 1px solid var(--ant-color-border-secondary);
  /* Fallback foreground for any raw text directly in the header. AntD's
   * text buttons, breadcrumb, and icons already use their own token colors
   * (colorText / colorTextDescription), which track light ↔ dark correctly,
   * so we don't force inherit here — that would clobber hover/disabled
   * states. This just guarantees stray text is readable. */
  color: var(--ant-color-text);
}

/* Sider: transparent background so the layout background shows through.
 * The logo text follows the same token so it's readable in both modes. */
.ant-layout-sider {
  background: transparent !important;
}

.ant-layout-sider .ant-layout-sider-children {
  background: var(--ant-color-bg-container);
  border-right: 1px solid var(--ant-color-border-secondary);
}

.ant-modal-mask {
  background: rgba(0, 0, 0, 0.30);
  backdrop-filter: blur(8px);
}

.ant-card {
  border: none;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 24px rgba(15, 23, 42, 0.04);
}

*::-webkit-scrollbar { width: 6px; height: 6px; }
*::-webkit-scrollbar-thumb {
  background: var(--ant-color-border-secondary, rgba(60, 60, 67, 0.18));
  border-radius: 3px;
}
`;
