/**
 * Multi-tab strip — one tab per visited route, persisted in `appStore`.
 *
 * Implements Requirements 7.2, 7.3, 7.4 and 7.6 around the tab strip:
 *
 *   - 7.2  WHEN 用户首次访问某个路由 THEN 系统 SHALL 在多页签栈中追加该页签
 *   - 7.3  WHEN 用户关闭某个页签 IF 页签 `affix` 为 `true` THEN 系统 SHALL 阻止关闭
 *   - 7.4  WHEN 用户切换语言 THEN 系统 SHALL ... 同步更新多页签标题
 *   - 7.6  WHEN 路由变化 THEN 系统 SHALL 同步更新当前激活页签
 *
 * The pure logic (`appendTab`, `removeTab`, `pickActiveAfterClose`,
 * `tabFromMenuNode`, `collectAffixedTabs`) lives in
 * `layout/lib/tab-reconciler.ts`; this module is the React+router glue.
 *
 * Why use `useLocation()` + matched-route handle instead of subscribing
 * to a router event:
 *   - `useLocation` triggers on every URL change (push/replace/back).
 *   - The matched route's `handle.menu` (set by `@keel/auth/buildRoutes`)
 *     gives us the originating MenuNode without re-walking the menu
 *     forest, which is the official "carry data along the route" path
 *     in React Router v6.
 */

import { useEffect, useMemo } from 'react';
import { Tabs as AntTabs } from 'antd';
import {
  useLocation,
  useMatches,
  useNavigate,
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { MenuNode } from '@keel/types';

import { useAppStore } from '../stores/app.store.js';
import { useUserStore } from '../stores/user.store.js';
import {
  appendTab,
  collectAffixedTabs,
  pickActiveAfterClose,
  removeTab,
  tabFromMenuNode,
} from './lib/tab-reconciler.js';

/**
 * Pull the deepest matched route's `handle.menu` (set by
 * `@keel/auth/buildRoutes`) out of the matches array.
 *
 * `useMatches` returns matches root-to-leaf; we want the leaf because
 * it carries the most specific menu metadata. Returns `null` when no
 * match has a `handle.menu` (typical for fallback routes like /login).
 */
function useActiveMenuNode(): MenuNode | null {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i];
    const handle = match?.handle;
    if (handle && typeof handle === 'object' && 'menu' in handle) {
      const menu = (handle as { menu?: MenuNode }).menu;
      if (menu) return menu;
    }
  }
  return null;
}

export function Tabs(): JSX.Element | null {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const tabs = useAppStore((s) => s.tabs);
  const setTabs = useAppStore((s) => s.setTabs);
  const removeTabAction = useAppStore((s) => s.removeTab);

  const menus = useUserStore((s) => s.menus);
  const activeMenu = useActiveMenuNode();

  // Seed the affixed tabs once per `menus` change. Without this the
  // strip would be empty until the user actively visits an affixed
  // route, breaking Requirement 7.3's "affixed tabs cannot be closed"
  // (because there's nothing there to protect).
  //
  // The reconciliation is done *additively* against the current strip
  // — affixed tabs we already have stay; new ones are appended. This
  // matters when the user navigates between menu reloads (e.g. tenant
  // switch refetches `/user/menus` mid-session).
  useEffect(() => {
    const wanted = collectAffixedTabs(menus);
    if (wanted.length === 0) return;
    let next = tabs;
    for (const tab of wanted) {
      next = appendTab(next, tab);
    }
    if (next !== tabs) setTabs(next);
    // We intentionally only depend on `menus` — running this on every
    // `tabs` change would loop. The reconciler is idempotent so the
    // missing dep is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menus]);

  // Append a tab on every route change that resolves to a known menu.
  // Routes outside the menu (login, 403, 404) are intentionally NOT
  // tabbed — the strip is for the user's working set inside the
  // protected layout.
  useEffect(() => {
    if (!activeMenu) return;
    if (activeMenu.hidden) return; // Hidden detail routes don't tab.
    const next = appendTab(tabs, tabFromMenuNode(location.pathname, activeMenu));
    if (next !== tabs) setTabs(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, activeMenu]);

  // The active tab follows the URL exactly (Req 7.6).
  const activeKey = location.pathname;

  // Translate titles at render time so language switches re-render
  // labels without rewriting the persisted tab list (Req 7.4).
  const items = useMemo(
    () =>
      tabs.map((tab) => ({
        key: tab.key,
        label: t(tab.title, { defaultValue: tab.title }),
        // AntD allows hiding the close button per item; affixed tabs
        // get `closable: false`. The reconciler also blocks removal
        // server-side so a misbehaving caller can't remove them.
        closable: !tab.affix,
      })),
    [tabs, t],
  );

  if (tabs.length === 0) return null;

  return (
    <AntTabs
      type="editable-card"
      hideAdd
      activeKey={activeKey}
      items={items}
      onChange={(key) => navigate(key)}
      onEdit={(key, action) => {
        if (action !== 'remove' || typeof key !== 'string') return;
        // Look up affix BEFORE we mutate, then ask the store to remove
        // (the store also enforces the affix protection — belt and
        // braces). If the active tab is the one being closed, navigate
        // to the picked next tab so the visible content matches the
        // strip.
        const target = tabs.find((tab) => tab.key === key);
        if (!target || target.affix) return;
        const nextActive = pickActiveAfterClose(tabs, key, activeKey);
        const updated = removeTab(tabs, key);
        if (updated === tabs) return;
        removeTabAction(key);
        if (nextActive && nextActive !== activeKey) {
          navigate(nextActive);
        }
      }}
      style={{ padding: '0 16px', background: 'transparent' }}
    />
  );
}
