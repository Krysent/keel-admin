/**
 * Application entry point.
 *
 * Wires together:
 *   - AntD ConfigProvider (iOS-style theme)
 *   - i18n provider
 *   - React Router with static + dynamic routes
 *   - Auth dependency context for the login page
 *   - Global ErrorBoundary
 */

import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from 'react-router-dom';

import { themeConfig } from '@keel/theme';

import { BasicLayout } from './layout/index.js';
import { AuthProvider } from './auth/index.js';
import { LoginPage, Forbidden403, NotFound404 } from './pages/index.js';
import { LoadingPlaceholder } from './components/index.js';
import { tokenManager, authService, userService, menuService } from './services/index.js';
import { useUserStore, useTenantStore } from './stores/index.js';
import type { LoginDeps } from './auth/index.js';

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
