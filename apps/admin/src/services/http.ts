/**
 * Configured HTTP instance for the admin application.
 *
 * Uses `@keel/http`'s `createHttp` factory wired with:
 *   - `createTokenManager` for single-flight token refresh
 *   - tenant / locale header injection from the relevant stores
 *   - `onAuthExpired` callback that clears stores and redirects to /login
 *
 * All service modules (`auth.service.ts`, `user.service.ts`, etc.) import
 * this instance so they automatically inherit envelope unwrap, dedupe,
 * and 401 → refresh → retry behaviour.
 *
 * Validates: Requirements 5.1, 5.8, 5.9
 */

import { createHttp, createTokenManager, type TokenManager } from '@keel/http';
import type { TokenPair } from '@keel/types';
import type { StorageKind } from '@keel/utils';

import { useUserStore } from '../stores/user.store';
import { useTenantStore } from '../stores/tenant.store';
import { useAppStore } from '../stores/app.store';

/**
 * Resolve Token storage backend from VITE_AUTH_STORAGE env variable.
 * Accepts 'localStorage', 'sessionStorage', or 'memory'.
 * Maps to the @keel/utils StorageKind ('local' | 'session' | 'memory').
 * Defaults to 'local' if the variable is unset or unrecognised.
 *
 * Validates: Requirement 18.1
 */
function resolveStorageKind(): StorageKind {
  const raw = import.meta.env?.VITE_AUTH_STORAGE as string | undefined;
  switch (raw) {
    case 'sessionStorage':
      return 'session';
    case 'memory':
      return 'memory';
    case 'localStorage':
    default:
      return 'local';
  }
}

/**
 * The token manager handles persistence and single-flight refresh.
 *
 * `refreshFn` hits the backend refresh endpoint; the response is
 * already envelope-unwrapped by the interceptors on the Axios instance
 * that triggered the refresh, so we receive the raw `TokenPair`.
 *
 * We use a lazy initializer pattern: the `refreshFn` calls the HTTP
 * instance itself (via a module-level reference) so the refresh request
 * goes through the same interceptor chain (minus the 401 retry, which
 * the token manager short-circuits internally).
 */
export const tokenManager: TokenManager = createTokenManager({
  refreshFn: async (refreshToken: string): Promise<TokenPair> => {
    // Use the http instance directly. The request is tagged with
    // `skipAuthRefresh` by the factory's 401 interceptor so we don't
    // loop. We POST the refresh token in the body.
    const result = await http.post<TokenPair>(
      '/auth/refresh',
      { refreshToken },
      { skipAuthRefresh: true } as never,
    );
    return result as unknown as TokenPair;
  },
  onAuthExpired: () => {
    // Clear all stores and redirect to login.
    useUserStore.getState().reset();
    useTenantStore.getState().reset();
    // Navigation to /login — since we might not be inside React here, use
    // a direct location replace as a last resort. Bootstrap / AuthGuard
    // will handle the re-render.
    window.location.replace('/login');
  },
  storageKind: resolveStorageKind(),
  storageKey: 'keel.auth.tokens',
});

/**
 * The main Axios instance, fully wired with all interceptors from
 * `@keel/http`. Service modules should import `http` and call it
 * directly — the envelope unwrap means the return type is already `T`
 * (the `data` field of the envelope), not `AxiosResponse<ApiEnvelope<T>>`.
 */
export const http = createHttp({
  baseURL: import.meta.env?.VITE_API_BASE_URL ?? '/api',
  timeout: Number(import.meta.env?.VITE_API_TIMEOUT ?? 15000),
  tokenManager,
  getTenantId: () => useTenantStore.getState().current?.id ?? null,
  getLocale: () => useAppStore.getState().locale ?? null,
  csrf: true,
});
