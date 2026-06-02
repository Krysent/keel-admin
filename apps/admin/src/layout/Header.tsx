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

import { Button, Dropdown, Layout, Space, type MenuProps } from 'antd';
import {
  GlobalOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SunOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../stores/app.store.js';
import { useTenantStore } from '../stores/tenant.store.js';
import { useUserStore } from '../stores/user.store.js';
import { Breadcrumb } from './Breadcrumb.js';

const { Header: AntHeader } = Layout;

/** Locales the switcher exposes — kept in sync with `LocaleCode`. */
const LOCALE_OPTIONS = [
  { key: 'zh-CN', label: '简体中文' },
  { key: 'en-US', label: 'English' },
] as const;

export function Header(): JSX.Element {
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

  const { t } = useTranslation();

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

  const userMenu: MenuProps = {
    items: [
      {
        key: 'profile',
        label: t('header.user.profile', { defaultValue: 'Profile' }),
      },
      { type: 'divider' },
      {
        key: 'logout',
        label: t('header.user.logout', { defaultValue: 'Sign out' }),
        // Wiring to /auth/logout lands in task 9.4 along with the
        // login page — see `auth.service.ts` plan in task 9.5.
      },
    ],
  };

  return (
    <AntHeader
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 16px',
        // The frosted-glass styling lives in `@keel/theme/global.css`.
        // The header just sets the correct AntD layout class via being
        // an `<AntHeader>`.
      }}
    >
      <Button
        type="text"
        aria-label="toggle-sider"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={toggleCollapsed}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <Breadcrumb />
      </div>

      <Space size={8}>
        {tenantList.length > 0 && (
          <Dropdown menu={tenantMenu} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<TeamOutlined />}>
              {currentTenant?.name ?? t('header.tenant.placeholder', {
                defaultValue: 'Tenant',
              })}
            </Button>
          </Dropdown>
        )}

        <Dropdown menu={localeMenu} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<GlobalOutlined />} aria-label="locale" />
        </Dropdown>

        <Button
          type="text"
          aria-label="theme"
          icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />

        <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<UserOutlined />}>
            {userInfo?.displayName ?? t('header.user.guest', {
              defaultValue: 'Guest',
            })}
          </Button>
        </Dropdown>
      </Space>
    </AntHeader>
  );
}
