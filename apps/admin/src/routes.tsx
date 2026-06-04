/**
 * @file 路由配置
 */
import { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { LoadingPlaceholder } from './components/index';
import { BasicLayout } from './layout/index';
import DashboardPage from './pages/dashboard/index';
import { LoginPage, Forbidden403, NotFound404 } from './pages/index';
import UserManagementPage from './pages/system/user/index';

const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
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

export default router;
