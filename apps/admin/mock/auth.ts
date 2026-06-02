/**
 * Auth mock handlers — login, refresh, logout.
 *
 * Validates: Requirements 11.1, 11.3, 11.4
 */

import type { MockMethod } from 'vite-plugin-mock';

import { wrap, wrapError } from './_utils';

const MOCK_ACCESS_TOKEN = 'mock-access-token-abc123';
const MOCK_REFRESH_TOKEN = 'mock-refresh-token-xyz789';

const mockHandlers: MockMethod[] = [
  {
    url: '/api/auth/login',
    method: 'post',
    response: ({ body }: { body: { username: string; password: string } }) => {
      const { username, password } = body ?? {};

      if (username === 'admin' && password === 'admin123') {
        return wrap({
          accessToken: MOCK_ACCESS_TOKEN,
          refreshToken: MOCK_REFRESH_TOKEN,
          expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
        });
      }

      return wrapError(40100, 'Invalid username or password');
    },
  },
  {
    url: '/api/auth/refresh',
    method: 'post',
    response: () => {
      return wrap({
        accessToken: `mock-access-token-refreshed-${Date.now()}`,
        refreshToken: `mock-refresh-token-refreshed-${Date.now()}`,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      });
    },
  },
  {
    url: '/api/auth/logout',
    method: 'post',
    response: () => {
      return wrap(null);
    },
  },
];

export default mockHandlers;
