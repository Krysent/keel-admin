/**
 * User service — profile and user management API calls.
 *
 * `fetchProfile` and `fetchPermissions` are consumed by the login flow
 * (task 9.4's `LoginServices` interface) and by the bootstrap layer to
 * hydrate `userStore` on page reload.
 *
 * Validates: Requirements 4.1, 5.4
 */

import type { PageQuery, PageResult, UserInfo } from '@keel/types';

import { http } from './http';

export interface UserListQuery extends PageQuery {
  keyword?: string;
  status?: string;
}

export interface CreateUserParams {
  username: string;
  displayName: string;
  email?: string;
  password: string;
  roles?: string[];
}

export interface UpdateUserParams {
  displayName?: string;
  email?: string;
  avatar?: string;
  roles?: string[];
}

export const userService = {
  /**
   * GET /user/profile — currently authenticated user's profile.
   */
  fetchProfile: (): Promise<UserInfo> =>
    http.get('/user/profile') as unknown as Promise<UserInfo>,

  /**
   * GET /user/permissions — permission codes the current user holds.
   */
  fetchPermissions: (): Promise<string[]> =>
    http.get('/user/permissions') as unknown as Promise<string[]>,

  /**
   * GET /users — paginated user list (admin management).
   */
  list: (params: UserListQuery): Promise<PageResult<UserInfo>> =>
    http.get('/users', { params }) as unknown as Promise<PageResult<UserInfo>>,

  /**
   * POST /users — create a new user.
   */
  create: (data: CreateUserParams): Promise<UserInfo> =>
    http.post('/users', data) as unknown as Promise<UserInfo>,

  /**
   * PUT /users/:id — update an existing user.
   */
  update: (id: string, data: UpdateUserParams): Promise<UserInfo> =>
    http.put(`/users/${id}`, data) as unknown as Promise<UserInfo>,

  /**
   * DELETE /users/:id — remove a user.
   */
  remove: (id: string): Promise<void> =>
    http.delete(`/users/${id}`) as unknown as Promise<void>,
};
