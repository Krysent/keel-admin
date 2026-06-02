/**
 * Public surface of the admin app's layout module.
 *
 * Strict no-`export *` policy mirroring the `@keel/*` packages — only
 * the pieces consumed elsewhere in the app (`main.tsx`,
 * `app/providers.tsx`, future tests) are listed here.
 *
 * Task 9.3 ships:
 *   - `BasicLayout`             — Sider + Header + Breadcrumb + Tabs + Outlet
 *   - `ThemeBridge`             — runtime `<ConfigProvider />` for theme + locale
 *   - `LocaleBridge`            — keeps i18next in sync with `appStore.locale`
 *   - tab-reconciler primitives — pure helpers exported for tests / bootstrap
 *   - menu-tree primitives      — pure helpers (Sider items, breadcrumb chain)
 */

export { BasicLayout } from './BasicLayout.js';
export { ThemeBridge } from './ThemeBridge.js';
export { LocaleBridge } from './LocaleBridge.js';
export { Header } from './Header.js';
export { Sider } from './Sider.js';
export { Tabs } from './Tabs.js';
export { Breadcrumb } from './Breadcrumb.js';

export {
  appendTab,
  collectAffixedTabs,
  pickActiveAfterClose,
  removeTab,
  tabFromMenuNode,
} from './lib/tab-reconciler.js';

export {
  ancestorPaths,
  buildMenuItems,
  findMenuPath,
  type MenuItem,
} from './lib/menu-tree.js';
