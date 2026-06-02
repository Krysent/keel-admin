/**
 * Public surface of `@keel/theme`.
 *
 * Strict no-`export *` policy (Requirement 2.6) so the API stays curated.
 *
 * Task 7 — iOS-style theme:
 *   - `tokens` / `darkTokens`             — design.md-sourced AntD 5 tokens
 *   - `componentOverrides`                — per-component tweaks (Button,
 *     Card, Modal, Table, Input, Menu, Tabs, Tag, Tooltip)
 *   - `themeConfig` / `darkThemeConfig`   — bundled `ThemeConfig` ready
 *     for `<ConfigProvider theme={...}>`
 *   - `globalStyles`                      — header / modal mask blur,
 *     soft card shadow, iOS scrollbar (also shipped as `./global.css`)
 */

export { tokens, darkTokens } from './tokens.js';
export { componentOverrides } from './components.js';
export { themeConfig, darkThemeConfig } from './theme-config.js';
export { globalStyles } from './global-styles.js';
