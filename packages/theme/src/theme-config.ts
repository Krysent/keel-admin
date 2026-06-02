/**
 * Bundled `ThemeConfig` values for AntD 5's `<ConfigProvider theme={...}>`.
 *
 * Two configs ship:
 *   - `themeConfig`     — light mode, default for the admin shell
 *   - `darkThemeConfig` — same tokens + iOS dark surfaces, plus
 *                          `theme.algorithm = darkAlgorithm`
 *
 * Requirement 9.5: switching between the two at runtime through
 * ConfigProvider must not reload the page. Because both configs already
 * carry `cssVar: true`, AntD writes CSS variables under the document root
 * and the swap is purely a style update.
 *
 * Requirement 9.6: business code only sees these two named exports — when
 * `@keel/theme` upgrades the visual language, host apps just bump the
 * package version.
 */
import { theme as antdTheme, type ThemeConfig } from 'antd';
import { tokens, darkTokens } from './tokens.js';
import { componentOverrides } from './components.js';

export const themeConfig: ThemeConfig = {
  token: tokens,
  components: componentOverrides,
  // CSS variables let downstream styles (e.g. global.css below) reference
  // tokens via `var(--ant-...)` and avoid recomputing styles on theme swap.
  cssVar: true,
  // `hashed: false` keeps class names stable so global selectors in
  // `global.css` (e.g. `.ant-layout-header`) keep matching.
  hashed: false,
};

export const darkThemeConfig: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: darkTokens,
  components: componentOverrides,
  cssVar: true,
  hashed: false,
};
