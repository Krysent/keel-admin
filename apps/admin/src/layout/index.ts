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

export { BasicLayout } from './BasicLayout';
export { ThemeBridge } from './ThemeBridge';
export { LocaleBridge } from './LocaleBridge';
export { Header } from './Header';
export { Sider } from './Sider';
export { Tabs } from './Tabs';
export { Breadcrumb } from './Breadcrumb';

export {
  appendTab,
  collectAffixedTabs,
  pickActiveAfterClose,
  removeTab,
  tabFromMenuNode,
} from './lib/tab-reconciler';

export {
  ancestorPaths,
  buildMenuItems,
  findMenuPath,
  type MenuItem,
} from './lib/menu-tree';
