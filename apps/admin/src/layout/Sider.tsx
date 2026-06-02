/**
 * Sider — left-hand collapsible navigation tree.
 *
 * Implements the Sider half of Requirement 7.1 (BasicLayout = Sider +
 * Header + Breadcrumb + Tabs + Outlet) and the menu-translation half
 * of Requirement 7.4 (switching language must re-translate the menu).
 *
 * Rendering rules:
 *   - Items come from `userStore.menus`, processed by `buildMenuItems`
 *     which drops `hidden:true` and redirect-only nodes (Req 4.7).
 *   - Selected key follows the current pathname so deep-linking keeps
 *     the active item highlighted.
 *   - Open keys are seeded from the active path's ancestor chain so the
 *     containing sub-menu opens automatically on first paint, then are
 *     fully user-controllable from there on.
 *   - Click → `navigate(key)`, where the key IS the route path (we set
 *     it that way in `buildMenuItems`).
 *
 * Translation:
 *   `MenuNode.title` carries an i18n key ("menu.system.user"). The
 *   sider does not translate during the data transform — it stores the
 *   raw key on the AntD `MenuItem.label` and translates inside the
 *   component using `useTranslation`. That way, switching language
 *   triggers a re-render of the labels without needing to invalidate
 *   the upstream menu data.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { Layout, Menu } from 'antd';
import * as AntIcons from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../stores/app.store.js';
import { useUserStore } from '../stores/user.store.js';
import {
  ancestorPaths,
  buildMenuItems,
  type MenuItem,
} from './lib/menu-tree.js';

const { Sider: AntSider } = Layout;

/**
 * Best-effort icon lookup — `MenuNode.icon` is a free-form string
 * and AntD icons are consumed by name. Missing icons render as no
 * icon at all (the menu still works fine without one).
 */
function resolveIcon(name: string | undefined): ReactNode {
  if (!name) return undefined;
  const Icon = (AntIcons as unknown as Record<string, React.ComponentType>)[
    name
  ];
  return Icon ? <Icon /> : undefined;
}

/**
 * Translate the i18n keys we put in `label` and resolve icons. Done at
 * render time so a `changeLanguage` re-render walks the same tree shape
 * and only swaps the leaf strings (Req 7.4).
 */
type AntMenuItems = NonNullable<React.ComponentProps<typeof Menu>['items']>;
type AntMenuItem = AntMenuItems[number];

function translateItems(
  items: readonly MenuItem[],
  t: (key: string) => string,
): AntMenuItems {
  return items.map((it): AntMenuItem => {
    // Build the node incrementally so `exactOptionalPropertyTypes` is
    // happy — AntD's `MenuItem` shape rejects literal `undefined` for
    // `icon` / `children`, only the *absent* property.
    const base: { key: string; label: string; icon?: ReactNode; children?: AntMenuItems } = {
      key: it.key,
      label: t(it.label),
    };
    const icon = resolveIcon(it.icon);
    if (icon !== undefined) base.icon = icon;
    if (it.children !== undefined && it.children.length > 0) {
      base.children = translateItems(it.children, t);
    }
    return base as AntMenuItem;
  });
}

export function Sider(): JSX.Element {
  const collapsed = useAppStore((s) => s.collapsed);
  const setCollapsed = useAppStore((s) => s.setCollapsed);
  const menus = useUserStore((s) => s.menus);

  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Build the AntD-shaped item tree once per `menus` change. The
  // translation pass below is cheap and re-runs on language change.
  const baseItems = useMemo(() => buildMenuItems(menus), [menus]);
  const translatedItems = useMemo(
    () => translateItems(baseItems, t),
    [baseItems, t],
  );

  // Default open keys: ancestors of the current path. Stored as state
  // so the user can collapse/expand sub-menus freely after first paint
  // without us forcing them open again on every re-render.
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    ancestorPaths(menus, location.pathname),
  );

  // Selected key tracks the URL exactly so deep-linking highlights the
  // right leaf even when the user navigates by typing.
  const selectedKeys = [location.pathname];

  return (
    <AntSider
      width={240}
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      breakpoint="lg"
      style={{ background: 'transparent' }}
    >
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        {collapsed ? 'K' : 'Keel Admin'}
      </div>
      <Menu
        mode="inline"
        items={translatedItems}
        selectedKeys={selectedKeys}
        openKeys={openKeys}
        onOpenChange={setOpenKeys}
        onClick={(info) => navigate(info.key)}
        style={{ borderInlineEnd: 'none', background: 'transparent' }}
      />
    </AntSider>
  );
}
