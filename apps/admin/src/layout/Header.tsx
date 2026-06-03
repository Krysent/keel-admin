/**
 * Header — top bar with sider toggle, breadcrumb host, and the user /
 * tenant / locale / theme switchers.
 *
 * Implements the Header half of Requirement 7.1 plus the runtime
 * switchers Requirements 7.4 / 7.5 expect to live somewhere visible.
 *
 * The header itself stays presentation-only:
 *   - locale switching delegates to `i18next.changeLanguage` and the
 *     parent `<I18nProviderBridge />` keeps `<ConfigProvider locale>`
 *     in sync (the bridge is wired in `BasicLayout.tsx`).
 *   - theme switching writes to `appStore.theme` and the upstream
 *     `<ThemeBridge />` swaps the AntD `ThemeConfig` (no reload).
 *   - tenant switching mutates `tenantStore.current`; the orchestration
 *     side-effects (refetch menus / permissions / rebuild routes) are
 *     scheduled for the broader task 9 work and aren't part of 9.3.
 *   - user menu's "logout" is a placeholder — wiring it up to the auth
 *     service belongs in task 9.4.
 */

import { Button, Dropdown, Input, Layout, Space, type MenuProps } from 'antd';
import {
  BellOutlined,
  GlobalOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SearchOutlined,
  SunOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';

import { useAppStore } from '../stores/app.store';
import { useTenantStore } from '../stores/tenant.store';
import { useUserStore } from '../stores/user.store';
import { Breadcrumb } from './Breadcrumb';
import { useUserMenu } from './lib/use-user-menu';

const { Header: AntHeader } = Layout;

/** Locales the switcher exposes — kept in sync with `LocaleCode`. */
const LOCALE_OPTIONS = [
  { key: 'zh-CN', label: '简体中文' },
  { key: 'en-US', label: 'English' },
] as const;

export interface HeaderProps {
  /** Extra inline styles merged onto the AntD Header element. Used by
   * `BasicLayout` to inject sticky positioning (Requirement 22.14). */
  style?: CSSProperties;
}

export function Header({ style }: HeaderProps = {}): JSX.Element {
  const collapsed = useAppStore((s) => s.collapsed);
  const toggleCollapsed = useAppStore((s) => s.toggleCollapsed);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  const tenantList = useTenantStore((s) => s.list);
  const currentTenant = useTenantStore((s) => s.current);
  const switchTenant = useTenantStore((s) => s.switchTenant);

  const userInfo = useUserStore((s) => s.userInfo);

  const { t, i18n } = useTranslation();
  const userMenu = useUserMenu();

  /** True when the active language is Chinese (zh-CN or any zh-* variant). */
  const isZhCN = i18n.language === 'zh-CN' || i18n.language?.startsWith('zh');

  // Build dropdown items for each switcher. Kept inline because they're
  // tiny and rebuilding on every render is cheaper than the memo logic
  // would be (each menu uses the live store value as `selectedKeys`).
  const localeMenu: MenuProps = {
    selectedKeys: [locale],
    items: LOCALE_OPTIONS.map((o) => ({ key: o.key, label: o.label })),
    onClick: (info) => {
      const next = info.key as (typeof LOCALE_OPTIONS)[number]['key'];
      // Only mutate the store — `LocaleBridge` watches `appStore.locale`
      // and forwards the change to i18next. Doing both here would race
      // with the bridge on the next render.
      setLocale(next);
    },
  };

  const tenantMenu: MenuProps = {
    selectedKeys: currentTenant ? [currentTenant.id] : [],
    items: tenantList.map((tenant) => ({
      key: tenant.id,
      label: tenant.name,
    })),
    onClick: (info) => switchTenant(info.key),
  };

  const searchPlaceholder = t('header.search.placeholder', {
    defaultValue: isZhCN ? '搜索菜单、页面…' : 'Search…',
  });

  return (
    <AntHeader
      data-testid="basic-layout-header"
      className="keel-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 20px',
        height: 56,
        lineHeight: '56px',
        // Background, border, and text color are handled by `.keel-header`
        // in index.less using AntD CSS token variables, so they respond
        // correctly to light ↔ dark mode switches without inline overrides.
        // Sticky positioning is injected by BasicLayout (Req 22.14).
        ...style,
      }}
    >
      <Button
        type="text"
        aria-label="toggle-sider"
        className="keel-header__icon-btn"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={toggleCollapsed}
      />

      <div className="keel-header__crumb">
        <Breadcrumb />
      </div>

      {/* Search box — purely presentational for now; wiring a real command
       * palette / global search belongs to a later task. */}
      <Input
        className="keel-header__search"
        prefix={<SearchOutlined />}
        placeholder={searchPlaceholder}
        allowClear
        variant="filled"
      />

      <Space size={4} className="keel-header__actions">
        {tenantList.length > 0 && (
          <Dropdown menu={tenantMenu} trigger={['click']} placement="bottomRight">
            <Button type="text" className="keel-header__tenant" icon={<TeamOutlined />}>
              {currentTenant?.name ?? t('header.tenant.placeholder', {
                defaultValue: isZhCN ? '切换租户' : 'Tenant',
              })}
            </Button>
          </Dropdown>
        )}

        <Button
          type="text"
          aria-label="notifications"
          className="keel-header__icon-btn"
          icon={<BellOutlined />}
        />

        <Dropdown menu={localeMenu} trigger={['click']} placement="bottomRight">
          <Button
            type="text"
            className="keel-header__icon-btn"
            icon={<GlobalOutlined />}
            aria-label="locale"
          />
        </Dropdown>

        <Button
          type="text"
          aria-label="theme"
          className="keel-header__icon-btn"
          icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />

        <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
          <Button type="text" className="keel-header__user" icon={<UserOutlined />}>
            {userInfo?.displayName ?? t('header.user.guest', {
              defaultValue: isZhCN ? '访客' : 'Guest',
            })}
          </Button>
        </Dropdown>
      </Space>
    </AntHeader>
  );
}
