/**
 * `runLogoutFlow` — counterpart to `runLoginFlow`.
 *
 * Implements the cleanup half referenced by Requirement 17.2 and the
 * "登出时统一清理" line of Requirement 6.2 / 6.3:
 *
 *   1. Best-effort POST /auth/logout to revoke the refresh token
 *      server-side. Failures here are *not* fatal — we still clear the
 *      local session because the user has expressed intent to log out.
 *   2. `tokenManager.clear()` removes the persisted token pair so the
 *      next request would fail authentication.
 *   3. Each store slice's `reset()` returns its state to the initial
 *      value (Requirement 6.2 — "登出 THEN 系统 SHALL 调用所有切片的
 *      reset() 方法").
 *
 * The page caller is responsible for navigation (`navigate('/login',
 * { replace: true })`).
 */

import type { TokenManager } from '@keel/http';

export interface LogoutServices {
  /** Optional POST /auth/logout. Errors are swallowed by the flow. */
  logout?: () => Promise<void>;
}

export interface LogoutStoreResetters {
  /** Reset the user store. */
  resetUser: () => void;
  /** Reset the tenant store. Optional for single-tenant apps. */
  resetTenant?: () => void;
  /**
   * Reset the app store (UI shell — collapsed flag, theme, locale,
   * tabs). Optional because some apps want to keep theme / locale
   * across the login boundary; provide it when full cleanup is wanted.
   */
  resetApp?: () => void;
  /** Reset business module stores. Pass an array for forward-compat. */
  resetModules?: ReadonlyArray<() => void>;
}

export interface LogoutDeps {
  services: LogoutServices;
  tokenManager: TokenManager;
  stores: LogoutStoreResetters;
}

/**
 * Run the logout sequence. Always succeeds — server-side revocation
 * failures are intentionally swallowed because the local cleanup
 * still needs to happen for the user's session to actually end.
 */
export async function runLogoutFlow(deps: LogoutDeps): Promise<void> {
  const { services, tokenManager, stores } = deps;

  if (services.logout) {
    try {
      await services.logout();
    } catch {
      // Server-side revocation failed (network error, server already
      // garbage-collected the refresh token, etc.). The user's intent
      // is unambiguous — proceed with local cleanup.
    }
  }

  tokenManager.clear();

  stores.resetUser();
  stores.resetTenant?.();
  stores.resetApp?.();
  if (stores.resetModules) {
    for (const reset of stores.resetModules) {
      reset();
    }
  }
}
