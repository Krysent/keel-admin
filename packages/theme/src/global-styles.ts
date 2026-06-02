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
 */
export const globalStyles = `:root {
  --keel-radius-card: 16px;
  --keel-blur: blur(20px) saturate(180%);
}

body {
  background: #F2F2F7;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.ant-layout-header {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: var(--keel-blur);
  border-bottom: 1px solid rgba(60, 60, 67, 0.10);
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
  background: rgba(60, 60, 67, 0.18);
  border-radius: 3px;
}
`;
