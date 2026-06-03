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

import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from 'react-router-dom';

import { themeConfig } from '@keel/theme';
// iOS-style global CSS fragment: frosted-glass header, adaptive surfaces,
// and scrollbar styling. Imported here so it applies app-wide. Color values
// reference AntD CSS token variables, so they follow light ↔ dark swaps.
import '@keel/theme/global.css';

import { BasicLayout } from './layout/index';
import { AuthProvider } from './auth/index';
import { LoginPage, Forbidden403, NotFound404 } from './pages/index';
import { LoadingPlaceholder } from './components/index';
import DashboardPage from './pages/dashboard/index';
import UserManagementPage from './pages/system/user/index';
import { tokenManager, authService, userService, menuService } from './services/index';
import { useUserStore, useTenantStore } from './stores/index';
import type { LoginDeps } from './auth/index';
import "./index.less"

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
// Router
// ---------------------------------------------------------------------------

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/exception/403',
    element: <Forbidden403 />,
  },
  {
    path: '/exception/404',
    element: <NotFound404 />,
  },
  {
    path: '/',
    element: (
      <Suspense fallback={<LoadingPlaceholder />}>
        <BasicLayout />
      </Suspense>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      // System management
      {
        path: 'system',
        element: <Navigate to="/system/user" replace />,
      },
      {
        path: 'system/user',
        element: <UserManagementPage />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFound404 />,
  },
]);

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
