/**
 * Shared types for the `@keel/http` factory and its interceptors.
 *
 * Kept in their own module so the public surface in `index.ts` stays a thin
 * re-export and the interceptor implementations can pull only what they
 * need without circular imports.
 */

import type { LocaleCode } from '@keel/types';

import type { TokenManager } from './token-manager.js';

/**
 * Options accepted by `createHttp`. The factory will be filled out across
 * tasks 4.1–4.4; for the single-flight refresh task we only commit to the
 * shape of the auth-related fields. Other interceptors (dedupe, envelope,
 * headers) are wired in later sub-tasks.
 *
 * Field semantics:
 *   - `baseURL` / `timeout` are forwarded straight to Axios.
 *   - `tokenManager` provides single-flight refresh + persistence.
 *   - `getTenantId` / `getLocale` are read on every request and stamped
 *     into the headers (Requirement 5.9).
 *   - `tenantHeader` defaults to `'X-Tenant-Id'` per the design doc.
 *   - `onAuthExpired` is a convenience pass-through that re-exposes the
 *     manager's expiry callback at the factory level.
 */
export interface HttpFactoryOptions {
  baseURL: string;
  timeout?: number;
  tokenManager: TokenManager;
  getTenantId?: () => string | null;
  getLocale?: () => LocaleCode | null;
  tenantHeader?: string;
  onBizError?: (code: number, message: string) => void;
  onAuthExpired?: () => void;

  /**
   * When set to `true`, the request interceptor will read the `csrf-token`
   * cookie (name configurable via `csrfCookieName`) and inject it as the
   * `X-CSRF-Token` header (configurable via `csrfHeaderName`) on every
   * outgoing request.
   *
   * Requirement 18.3.
   */
  csrf?: boolean;

  /**
   * Name of the cookie holding the CSRF token.
   * Defaults to `'csrf-token'`.
   */
  csrfCookieName?: string;

  /**
   * Name of the header to inject.
   * Defaults to `'X-CSRF-Token'`.
   */
  csrfHeaderName?: string;
}

/**
 * Per-request opt-outs. Forwarded through Axios' config so interceptors can
 * read them off `config.silent`, `config.allowConcurrent`, etc.
 *
 * `Requirements 5.5/5.6/4.4` are implemented by inspecting these flags.
 */
export interface RequestExtraConfig {
  /** Skip the global business-error toast for this request. */
  silent?: boolean;
  /** Skip the dedupe interceptor for this request. */
  allowConcurrent?: boolean;
  /** Skip the 401 → refresh → retry flow. */
  skipAuthRefresh?: boolean;
}
