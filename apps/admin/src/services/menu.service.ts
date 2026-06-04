/**
 * Menu service — fetch the user's menu tree and related data.
 *
 * `fetchMenus` is consumed by the login flow (task 9.4's `LoginServices`
 * interface) and by bootstrap to drive dynamic route generation.
 *
 * Validates: Requirements 4.1, 5.4
 */

import { http } from './http';

import type { MenuNode } from '@keel/types';

export const menuService = {
  /**
   * GET /user/menus — the menu forest for the currently authenticated user.
   * Filtered by backend based on the user's roles / tenant.
   */
  fetchMenus: (): Promise<MenuNode[]> => http.get('/user/menus') as unknown as Promise<MenuNode[]>,
};
