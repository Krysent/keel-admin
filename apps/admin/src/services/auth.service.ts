/**
 * Auth service — login, refresh, and logout API calls.
 *
 * All methods return envelope-unwrapped data (the `@keel/http` interceptors
 * handle `code === 0` → `data` and `code !== 0` → `BizError` transparently).
 *
 * Validates: Requirements 4.1, 5.4
 */

import type { TokenPair } from '@keel/types';

import { http } from './http.js';

export interface LoginParams {
  username: string;
  password: string;
  remember?: boolean;
}

export const authService = {
  /**
   * POST /auth/login — authenticate and obtain a token pair.
   */
  login: (params: LoginParams): Promise<TokenPair> =>
    http.post('/auth/login', params) as unknown as Promise<TokenPair>,

  /**
   * POST /auth/refresh — exchange a refresh token for a new pair.
   * Normally called internally by the token manager; exposed here for
   * completeness and testing.
   */
  refresh: (refreshToken: string): Promise<TokenPair> =>
    http.post('/auth/refresh', { refreshToken }, {
      skipAuthRefresh: true,
    } as never) as unknown as Promise<TokenPair>,

  /**
   * POST /auth/logout — revoke the current refresh token server-side.
   * Errors are swallowed by the logout flow (best-effort revocation).
   */
  logout: (): Promise<void> =>
    http.post('/auth/logout') as unknown as Promise<void>,
};
