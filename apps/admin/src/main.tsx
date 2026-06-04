/**
 * Application entry point.
 *
 * Wires together:
 *   - AntD ConfigProvider (iOS-style theme)
 *   - i18n (initialized before the React tree mounts)
 *   - React Router with static + dynamic routes
 *   - Auth dependency context for the login page
 *   - Global ErrorBoundary
 */

// i18n MUST be imported first — the side-effect initializes the global
// i18next instance that every useTranslation() hook relies on.
import './i18n.ts';

import { themeConfig } from '@keel/theme';
import { App as AntApp, ConfigProvider } from 'antd';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

// iOS-style global CSS fragment: frosted-glass header, adaptive surfaces,
// and scrollbar styling. Imported here so it applies app-wide. Color values
// reference AntD CSS token variables, so they follow light ↔ dark swaps.
import '@keel/theme/global.css';
import { AuthProvider } from './auth/index';
import router from './routes';
import { tokenManager, authService, userService, menuService } from './services/index';
import { useUserStore, useTenantStore } from './stores/index';

import type { LoginDeps } from './auth/index';
import './index.less';

// ---------------------------------------------------------------------------
// Auth deps (injected into the login page via context)
// ---------------------------------------------------------------------------

const loginDeps: LoginDeps = {
  services: {
    login: authService.login.bind(authService),
    fetchProfile: userService.fetchProfile.bind(userService),
    fetchMenus: menuService.fetchMenus.bind(menuService),
    fetchPermissions: userService.fetchPermissions.bind(userService),
  },
  tokenManager,
  stores: {
    setUser: (user) => useUserStore.getState().setUser(user),
    setMenus: (menus) => useUserStore.getState().setMenus(menus),
    setPermissions: (codes) => useUserStore.getState().setPermissions(codes),
    setRoles: (codes) => useUserStore.getState().setRoles(codes),
    setTenantList: (tenants) => useTenantStore.getState().setList(tenants),
    setCurrentTenant: (tenant) => useTenantStore.getState().setCurrent(tenant),
  },
};

// ---------------------------------------------------------------------------
// Root render
// ---------------------------------------------------------------------------

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={themeConfig}>
      <AntApp>
        <AuthProvider value={loginDeps}>
          <RouterProvider router={router} />
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
