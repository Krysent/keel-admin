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
 *
 * Responsive collapse (Req 22.1–22.3):
 *   - Sider is 240px wide, collapses to 80px with `transition: width
 *     200ms ease` on the inner element.
 *   - A ResizeObserver watches the document root; the first time the
 *     viewport drops below 1024px it forces `collapsed: true`. When the
 *     viewport grows back above 1024px, the pre-collapse state is
 *     restored.
 *
 * Empty menus (Req 22.13):
 *   When `userStore.menus` is empty, the menu region renders a
 *   localised placeholder instead of an empty AntD Menu, so no
 *   JS exception is thrown and the user gets useful feedback.
 */

import { useEffect, useRef, useMemo, useState, type ReactNode } from 'react';
import { Avatar, Dropdown, Layout, Menu } from 'antd';
import * as AntIcons from '@ant-design/icons';
import { RightOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../stores/app.store';
import { useUserStore } from '../stores/user.store';
import {
  ancestorPaths,
  buildMenuItems,
  type MenuItem,
} from './lib/menu-tree';
import { useUserMenu } from './lib/use-user-menu';

const { Sider: AntSider } = Layout;

/** Viewport breakpoint for auto-collapse (Req 22.3). */
const COLLAPSE_BREAKPOINT = 1024;

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

export interface SiderProps {
  /** Extra inline styles merged onto the AntD Sider element. Used by
   * `BasicLayout` to inject sticky positioning (Requirement 22.14). */
  style?: import('react').CSSProperties;
}

export function Sider({ style }: SiderProps = {}): JSX.Element {
  const collapsed = useAppStore((s) => s.collapsed);
  const setCollapsed = useAppStore((s) => s.setCollapsed);
  const menus = useUserStore((s) => s.menus);
  const userInfo = useUserStore((s) => s.userInfo);

  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const userMenu = useUserMenu();

  /**
   * Track the collapsed state that was in place *before* a viewport-triggered
   * auto-collapse. When the viewport grows back above the breakpoint we restore
   * this value instead of always uncollapsing, so a user who had manually
   * collapsed before narrowing the window keeps their preference (Req 22.3).
   */
  const collapsedBeforeBreakpoint = useRef<boolean | null>(null);

  /**
   * Whether the viewport is currently below the breakpoint. We start by
   * measuring on mount so that SSR / test environments don't get a wrong
   * initial read.
   */
  const isBelowBreakpoint = useRef(
    typeof window !== 'undefined' && window.innerWidth < COLLAPSE_BREAKPOINT,
  );

  // Responsive auto-collapse via ResizeObserver (Req 22.3).
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const below = window.innerWidth < COLLAPSE_BREAKPOINT;

      if (below && !isBelowBreakpoint.current) {
        // Crossing the breakpoint downward for the first time — save state
        // and force collapse.
        isBelowBreakpoint.current = true;
        collapsedBeforeBreakpoint.current = collapsed;
        setCollapsed(true);
      } else if (!below && isBelowBreakpoint.current) {
        // Crossing back upward — restore the pre-collapse state.
        isBelowBreakpoint.current = false;
        if (collapsedBeforeBreakpoint.current !== null) {
          setCollapsed(collapsedBeforeBreakpoint.current);
          collapsedBeforeBreakpoint.current = null;
        }
      }
    };

    // Use ResizeObserver on document.documentElement for reliable viewport
    // width tracking without layout-thrash polling.
    const observer = new ResizeObserver(handleResize);
    observer.observe(document.documentElement);

    // Run once on mount to apply the initial breakpoint state.
    handleResize();

    return () => {
      observer.disconnect();
    };
    // `collapsed` is intentionally excluded from the deps — we only want
    // to read it at the moment the breakpoint is first crossed, not re-run
    // the effect every time the user manually toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCollapsed]);

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

  /**
   * Empty-menu placeholder text (Req 22.13).
   * zh-CN: "暂无菜单", en-US: "No menu".
   * Uses a dedicated i18n key with locale-aware defaultValue fallbacks so the
   * placeholder is correct even before the translation bundle loads.
   */
  const isZhCN = i18n.language === 'zh-CN' || i18n.language?.startsWith('zh');
  const emptyMenuText = t('sider.noMenu', {
    defaultValue: isZhCN ? '暂无菜单' : 'No menu',
  });

  // Profile-card labels — small enough to build inline. The card shows the
  // logged-in user's display name + email (or a localised "Guest"
  // fallback when the profile hasn't loaded yet).
  const displayName =
    userInfo?.displayName ??
    t('header.user.guest', { defaultValue: isZhCN ? '访客' : 'Guest' });
  const subtitle = userInfo?.email ?? userInfo?.username ?? '';

  return (
    <AntSider
      width={240}
      collapsedWidth={80}
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      trigger={null}
      className="keel-sider"
      style={{
        // The collapse transition is defined in index.less so it can
        // animate all of AntD's width-driving properties (width / flex /
        // min-width / max-width) together with the iOS easing curve — an
        // inline `transition: width` alone makes the other three snap and
        // produces the stutter we're fixing here.
        overflow: 'hidden',
        // Sticky positioning injected by BasicLayout (Req 22.14).
        // Background is handled by .ant-layout-sider-children in index.less
        // so the border aligns with the sider content area, not the outer wrapper.
        ...style,
      }}
    >
      {/* Vertical shell: brand (fixed) · menu (scrolls) · profile (pinned). */}
      <div className="keel-sider__inner">
        {/* Brand area — logo badge + wordmark, collapses to the badge only. */}
        <div className="keel-sider__brand">
          <span className="keel-sider__brand-logo" aria-hidden>
            <img src="/keel-admin-logo.png" alt="" />
          </span>
          {!collapsed && (
            <span className="keel-sider__brand-name">Keel Admin</span>
          )}
        </div>

        {/* Menu region — the only scrollable part of the sider. */}
        <div className="keel-sider__menu">
          {translatedItems.length === 0 ? (
            /* Empty-menus placeholder — Req 22.13. */
            <div
              className="keel-sider__empty"
              style={{ whiteSpace: collapsed ? 'nowrap' : 'normal' }}
            >
              {collapsed ? null : emptyMenuText}
            </div>
          ) : (
            <Menu
              mode="inline"
              items={translatedItems}
              selectedKeys={selectedKeys}
              openKeys={collapsed ? [] : openKeys}
              onOpenChange={setOpenKeys}
              onClick={(info) => navigate(info.key)}
              style={{ borderInlineEnd: 'none', background: 'transparent' }}
            />
          )}
        </div>

        {/* Profile card — pinned to the bottom; opens the user menu on click. */}
        <Dropdown menu={userMenu} trigger={['click']} placement="topRight">
          <button type="button" className="keel-sider__profile" aria-label={displayName}>
            <Avatar
              size={collapsed ? 32 : 40}
              src={userInfo?.avatar}
              icon={<UserOutlined />}
              className="keel-sider__profile-avatar"
            />
            {!collapsed && (
              <>
                <span className="keel-sider__profile-meta">
                  <span className="keel-sider__profile-name">{displayName}</span>
                  {subtitle && (
                    <span className="keel-sider__profile-sub">{subtitle}</span>
                  )}
                </span>
                <RightOutlined className="keel-sider__profile-arrow" />
              </>
            )}
          </button>
        </Dropdown>
      </div>
    </AntSider>
  );
}
