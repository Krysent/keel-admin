/**
 * Menu mock handlers — menu tree for dynamic routing.
 *
 * Validates: Requirements 11.1, 11.3, 11.4
 */

import { wrap } from './_utils';

import type { MockMethod } from 'vite-plugin-mock';

const mockMenuTree = [
  {
    id: 'dashboard',
    title: 'menu.dashboard',
    path: '/dashboard',
    icon: 'DashboardOutlined',
    component: 'dashboard/index',
    affix: true,
    children: undefined,
  },
  {
    id: 'system',
    title: 'menu.system',
    path: '/system',
    icon: 'SettingOutlined',
    redirect: '/system/user',
    children: [
      {
        id: 'system-user',
        title: 'menu.system.user',
        path: '/system/user',
        icon: 'UserOutlined',
        component: 'system/user/index',
        permissionCodes: ['user:list'],
      },
      {
        id: 'system-role',
        title: 'menu.system.role',
        path: '/system/role',
        icon: 'TeamOutlined',
        component: 'system/role/index',
        permissionCodes: ['role:list'],
        hidden: true,
      },
    ],
  },
  {
    id: 'order',
    title: 'menu.order',
    path: '/order',
    icon: 'ShoppingCartOutlined',
    redirect: '/order/list',
    children: [
      {
        id: 'order-list',
        title: 'menu.order.list',
        path: '/order/list',
        icon: 'UnorderedListOutlined',
        component: 'order/list',
        permissionCodes: ['order:list'],
      },
      {
        id: 'order-detail',
        title: 'menu.order.detail',
        path: '/order/detail/:id',
        component: 'order/detail',
        permissionCodes: ['order:list'],
        hidden: true,
      },
    ],
  },
];

const mockHandlers: MockMethod[] = [
  {
    url: '/api/user/menus',
    method: 'get',
    response: () => {
      return wrap(mockMenuTree);
    },
  },
];

export default mockHandlers;
