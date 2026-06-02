/**
 * User mock handlers — profile, permissions, CRUD.
 *
 * Validates: Requirements 11.1, 11.3, 11.4
 */

import type { MockMethod } from 'vite-plugin-mock';

import { wrap, wrapError, wrapPage } from './_utils';

const mockUsers = [
  {
    id: '1',
    username: 'admin',
    displayName: 'Admin User',
    email: 'admin@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    tenantIds: ['tenant-1', 'tenant-2'],
    permissions: [
      'user:list', 'user:create', 'user:update', 'user:delete',
      'order:list', 'order:create', 'order:update', 'order:delete', 'order:export',
      'tenant:switch',
    ],
    roles: ['admin'],
  },
  {
    id: '2',
    username: 'editor',
    displayName: 'Editor User',
    email: 'editor@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=editor',
    tenantIds: ['tenant-1'],
    permissions: ['user:list', 'order:list', 'order:create', 'order:update'],
    roles: ['editor'],
  },
  {
    id: '3',
    username: 'viewer',
    displayName: 'Viewer User',
    email: 'viewer@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=viewer',
    tenantIds: ['tenant-1'],
    permissions: ['user:list', 'order:list'],
    roles: ['viewer'],
  },
];

const mockHandlers: MockMethod[] = [
  {
    url: '/api/user/profile',
    method: 'get',
    response: () => {
      const user = mockUsers[0]!;
      return wrap({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        tenantIds: user.tenantIds,
        permissions: user.permissions,
        roles: user.roles,
      });
    },
  },
  {
    url: '/api/user/permissions',
    method: 'get',
    response: () => {
      return wrap(mockUsers[0]!.permissions);
    },
  },
  {
    url: '/api/users',
    method: 'get',
    response: ({ query }: { query: { page?: string; pageSize?: string; keyword?: string } }) => {
      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 10;
      const keyword = query.keyword?.toLowerCase() ?? '';

      let filtered = mockUsers;
      if (keyword) {
        filtered = mockUsers.filter(
          (u) =>
            u.username.toLowerCase().includes(keyword) ||
            u.displayName.toLowerCase().includes(keyword),
        );
      }

      const start = (page - 1) * pageSize;
      const list = filtered.slice(start, start + pageSize).map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        avatar: u.avatar,
        tenantIds: u.tenantIds,
        permissions: u.permissions,
        roles: u.roles,
      }));

      return wrapPage(list, filtered.length, page, pageSize);
    },
  },
  {
    url: '/api/users',
    method: 'post',
    response: ({ body }: { body: { username: string; displayName: string; email?: string; password: string; roles?: string[] } }) => {
      const newUser = {
        id: String(mockUsers.length + 1),
        username: body.username,
        displayName: body.displayName,
        email: body.email ?? '',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${body.username}`,
        tenantIds: ['tenant-1'],
        permissions: [] as string[],
        roles: body.roles ?? [],
      };
      return wrap(newUser);
    },
  },
  {
    url: '/api/users/:id',
    method: 'put',
    response: ({ body, query }: { body: { displayName?: string; email?: string; avatar?: string; roles?: string[] }; query: { id?: string } }) => {
      const user = mockUsers[0]!;
      return wrap({
        ...user,
        ...body,
      });
    },
  },
  {
    url: '/api/users/:id',
    method: 'delete',
    response: () => {
      return wrap(null);
    },
  },
];

export default mockHandlers;
