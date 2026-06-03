/**
 * Pure functions that reconcile the open-tabs strip with route-level events.
 *
 * Implements the data-side of Requirements 7.2 and 7.3:
 *
 *   7.2  WHEN 用户首次访问某个路由 THEN 系统 SHALL 在多页签栈中追加该页签
 *   7.3  WHEN 用户关闭某个页签 IF 页签 `affix` 为 `true` THEN 系统 SHALL 阻止关闭
 *
 * The functions here are deliberately framework-free so they can be unit-
 * tested in node without rendering. The BasicLayout React component glues
 * them onto router events and the Zustand `appStore`.
 *
 * Loop invariants:
 *   - `appendTab(tabs, t)` never produces duplicate keys; the existing
 *     entry wins (so manual edits to `title` made elsewhere aren't lost).
 *   - `removeTab(tabs, k)` keeps the relative order of the surviving
 *     entries and never removes an `affix:true` tab.
 *   - `pickActiveAfterClose` always returns a key that is present in the
 *     post-removal list, or `null` when that list is empty.
 */

import type { MenuNode, TabItem } from '@keel/types';

/**
 * Append a tab unless one with the same `key` is already open.
 *
 * Returns the original array reference when nothing changes, so React
 * `setState` short-circuits the re-render. This matters for the layout
 * because every `<NavLink>` click fires an effect that calls this — we
 * don't want a Tabs strip remount on a re-click of the active tab.
 */
export function appendTab(tabs: readonly TabItem[], next: TabItem): TabItem[] {
  if (tabs.some((t) => t.key === next.key)) {
    // Cast to TabItem[] so callers don't have to widen `readonly`.
    return tabs as TabItem[];
  }
  return [...tabs, next];
}

/**
 * Remove the tab with the given `key` unless it is `affix:true`.
 *
 * Mirrors `appStore.removeTab` so callers that prefer pure-functional
 * reconciliation can stay outside the store. Returns the original
 * array reference when the removal is rejected (key not found OR
 * affixed).
 */
export function removeTab(tabs: readonly TabItem[], key: string): TabItem[] {
  const target = tabs.find((t) => t.key === key);
  if (!target) return tabs as TabItem[];
  if (target.affix) return tabs as TabItem[];
  return tabs.filter((t) => t.key !== key);
}

/**
 * Pick the next active tab key after closing `closingKey`.
 *
 * Strategy (Requirement 22.6):
 *   1. If the closed tab wasn't the active one, keep the active key.
 *   2. Otherwise prefer the tab to the RIGHT of the closed one.
 *   3. Failing that, prefer the tab to the LEFT.
 *   4. If the post-removal list is empty, return `null` (caller should
 *      navigate to `/`).
 *
 * The function operates on the *pre-removal* `tabs` snapshot so callers
 * can decide the next route before mutating the store.
 */
export function pickActiveAfterClose(
  tabs: readonly TabItem[],
  closingKey: string,
  activeKey: string | null,
): string | null {
  if (activeKey !== null && activeKey !== closingKey) {
    return activeKey;
  }
  const idx = tabs.findIndex((t) => t.key === closingKey);
  if (idx < 0) return activeKey;
  // Requirement 22.6: prefer the right neighbor first, then the left.
  const right = tabs[idx + 1];
  if (right) return right.key;
  const left = tabs[idx - 1];
  if (left) return left.key;
  return null;
}

/**
 * Construct a `TabItem` from a matched route's `MenuNode`.
 *
 * The pathname is used as the stable key (Requirement 7.6: "路由变化
 * THEN 系统 SHALL 同步更新当前激活页签"), so two pages that share a
 * MenuNode but live at different URLs (parameterized routes, e.g.
 * `/order/:id`) get distinct tabs.
 *
 * `title` is left as the i18n key so the Tabs strip can re-translate
 * on language change without stashing the translated string.
 */
export function tabFromMenuNode(
  pathname: string,
  node: MenuNode,
): TabItem {
  const tab: TabItem = {
    key: pathname,
    title: node.title,
    path: pathname,
  };
  if (node.icon !== undefined) tab.icon = node.icon;
  if (node.affix) tab.affix = true;
  if (node.meta !== undefined) tab.meta = node.meta;
  return tab;
}

/**
 * Seed the affixed tabs from a menu forest at boot time.
 *
 * `affix:true` menu nodes (typically the home dashboard) are pinned at
 * application start so the strip is never empty and Requirement 7.3 has
 * something to protect.
 *
 * Hidden nodes are skipped because they shouldn't surface in the strip
 * even when affixed; redirect-only nodes are also skipped because the
 * route they point to is the one the user actually lands on.
 */
export function collectAffixedTabs(menus: readonly MenuNode[]): TabItem[] {
  const out: TabItem[] = [];
  const walk = (nodes: readonly MenuNode[]): void => {
    for (const node of nodes) {
      if (node.hidden) continue;
      if (node.affix && !node.redirect) {
        out.push(tabFromMenuNode(node.path, node));
      }
      if (node.children && node.children.length > 0) walk(node.children);
    }
  };
  walk(menus);
  return out;
}
