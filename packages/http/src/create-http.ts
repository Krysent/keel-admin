/**
 * `createHttp` — the Axios factory the business app calls once at boot to
 * obtain a fully-wired HTTP client.
 *
 * NOTE on scope: this file currently wires what tasks 4.1, 4.2, 4.3 and 4.4
 * need:
 *   - Single-flight token refresh on 401 (task 4.1 / Requirements 5.2-5.3).
 *     A 401 response triggers `tokenManager.refresh()` and the original
 *     request is replayed with the new token, exactly once.
 *   - Envelope unwrap (task 4.2 / Requirement 5.4). The success branch
 *     turns `{ code, data, message, traceId }` into either `data`
 *     (`code === 0`) or a thrown `BizError` (anything else).
 *   - Dedupe (task 4.3 / Requirements 5.6, 5.7). Concurrent requests with
 *     the same fingerprint (method + url + sorted(params) + stableHash(body))
 *     collapse onto one in-flight call; duplicates are rejected with a
 *     `CanceledError`. The fingerprint map is cleaned on settlement.
 *   - Header injection (task 4.4 / Requirements 5.8, 5.9, 18.4).
 *     `Authorization` (when a token is held), `X-Tenant-Id` and
 *     `Accept-Language` are stamped from the factory-time callbacks on
 *     every outbound request. `baseURL` and `timeout` flow straight
 *     from the factory options so consumers can drive them from
 *     `import.meta.env` per environment (5.8). The tenant header is
 *     FORCED: any business-supplied value is stripped before the
 *     framework's value is written, satisfying the "业务代码不得覆盖"
 *     clause of Requirement 18.4 (and matching the "强制注入" wording in
 *     5.9). Authorization and Accept-Language use cooperative
 *     "framework-wins-when-it-has-a-value" semantics — they are not
 *     subject to the same security override rule.
 *
 * Business-error toast wiring (`onBizError`) is still a placeholder; it
 * lands with the toast/notification surface in a later UI task.
 *
 * Interceptor order is intentional. The envelope interceptor is registered
 * BEFORE the 401-handler so that on the retry path — where the 401 handler
 * recurses through `instance.request(cfg)` — the recursive call already
 * returns the unwrapped `data`, and no further interceptor runs on that
 * value in the outer chain (preventing any double-unwrap).
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { BizError } from './biz-error.ts';
import { DEDUPE_HANDLE_KEY, installDedupe, type DedupeHandle } from './dedupe.ts';

import type { HttpFactoryOptions } from './types.ts';

/** Marker added to a config so we don't infinite-loop on retry. */
const RETRY_FLAG = '__keel_authRetried__' as const;

type AnyConfig = InternalAxiosRequestConfig & {
  [RETRY_FLAG]?: boolean;
  silent?: boolean;
  allowConcurrent?: boolean;
  skipAuthRefresh?: boolean;
};

/**
 * Minimal shape check for the response envelope. We accept anything with
 * a numeric `code` field as an envelope; `data` / `message` / `traceId`
 * are not interrogated because the 5.4 contract only branches on `code`.
 *
 * Anything else (raw blobs, empty 204 bodies, gateway-injected HTML)
 * passes through unchanged so the unwrap never corrupts non-API
 * responses.
 */
type RuntimeEnvelope = {
  code: number;
  data: unknown;
  message?: string;
  traceId?: string;
};

function isEnvelope(value: unknown): value is RuntimeEnvelope {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { code?: unknown }).code === 'number'
  );
}

export function createHttp(options: HttpFactoryOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL,
    timeout: options.timeout ?? 15000,
  });

  // ---- Dedupe (Requirements 5.6, 5.7) ----
  //
  // Installed FIRST in `createHttp` so its response cleanup interceptor is
  // registered ahead of the envelope-unwrap and 401-retry interceptors.
  // Axios runs response interceptors in registration order (FIFO), so this
  // guarantees cleanup observes the still-intact `AxiosResponse` /
  // `AxiosError` and can recover the fingerprint stamped on `config`
  // before any later interceptor short-circuits or transforms it.
  //
  // The request half is also registered first; Axios runs request
  // interceptors in REVERSE order (LIFO), so the request-side dedupe check
  // ends up running LAST in the request chain — i.e. after header
  // stamping. That's intentional: header stamping on a duplicate request
  // is a few cheap field writes and the duplicate is still rejected before
  // the adapter ever runs.
  //
  // The handle is exposed on the instance under `__keelDedupe` for tests
  // and debug surfaces (Property C of the dedupe PBT asserts `size === 0`
  // after settlement). Production code should NOT depend on this surface.
  const dedupeHandle: DedupeHandle = installDedupe(instance);
  Object.defineProperty(instance, DEDUPE_HANDLE_KEY, {
    value: dedupeHandle,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  // ---- Request interceptor: stamp Authorization + tenant + locale ----
  //
  // Wired to satisfy Requirements 5.9 (auto-injection of all three headers
  // on every outbound request) AND Requirement 18.4 (the tenant header is
  // FORCED — business code must not be able to override it). The
  // tenant-header enforcement is implemented by deleting any caller-
  // supplied value FIRST and only then writing the framework's value (if
  // any). This is the correct order for "framework wins": even when the
  // framework has no tenant context (`getTenantId` returns null), a
  // hostile / accidental business override is still scrubbed.
  //
  // For Authorization and Accept-Language we use the standard "framework
  // sets when it has a value" semantics — those headers are cooperative,
  // not security-forced, so a caller experimenting with a custom token or
  // locale on a single request is not stripped silently.
  const tenantHeader = options.tenantHeader ?? 'X-Tenant-Id';

  // CSRF config (Requirement 18.3)
  const csrfEnabled = options.csrf ?? false;
  const csrfCookieName = options.csrfCookieName ?? 'csrf-token';
  const csrfHeaderName = options.csrfHeaderName ?? 'X-CSRF-Token';

  instance.interceptors.request.use((config) => {
    const cfg = config as AnyConfig;
    cfg.headers = cfg.headers ?? ({} as AnyConfig['headers']);

    const accessToken = options.tokenManager.getAccess();
    if (accessToken) {
      cfg.headers.set?.('Authorization', `Bearer ${accessToken}`);
    }

    // Requirement 18.4 — strip any business-supplied tenant header BEFORE
    // applying the framework's value. This guarantees the framework wins
    // even when `getTenantId()` returns null (i.e. there's nothing to
    // overwrite the business value with), closing the override gap.
    cfg.headers.delete?.(tenantHeader);
    const tenantId = options.getTenantId?.() ?? null;
    if (tenantId) {
      cfg.headers.set?.(tenantHeader, tenantId);
    }

    const locale = options.getLocale?.() ?? null;
    if (locale) {
      cfg.headers.set?.('Accept-Language', locale);
    }

    // Requirement 18.3 — read CSRF token from cookie and inject into header
    if (csrfEnabled) {
      const csrfToken = readCookie(csrfCookieName);
      if (csrfToken) {
        cfg.headers.set?.(csrfHeaderName, csrfToken);
      }
    }

    return cfg;
  });

  // ---- Response interceptor (1/2): envelope unwrap (Requirement 5.4) ----
  //
  // Runs FIRST in the response chain so:
  //   - Plain HTTP 200 with `{ code: 0, data, ... }` resolves directly
  //     to `data` (callers `await http.get(...)` and get `T`, not the
  //     `AxiosResponse<ApiEnvelope<T>>`).
  //   - Non-zero `code` becomes a thrown `BizError` carrying the original
  //     `code` / `message` / `traceId` for log correlation and i18n.
  //   - Bodies that are not envelope-shaped (raw 204, blob downloads,
  //     unwrapped responses from edge caches) pass through unchanged
  //     so this interceptor never silently corrupts non-API responses.
  //
  // Registered ahead of the 401-handler so the retry path's recursive
  // `instance.request(cfg)` call returns already-unwrapped data and no
  // outer interceptor runs on that value (no double-unwrap risk).
  instance.interceptors.response.use((response) => {
    if (!isEnvelope(response.data)) {
      return response;
    }
    const envelope = response.data;
    if (envelope.code === 0) {
      // Returning a non-AxiosResponse here intentionally short-circuits
      // the rest of the response chain to the resolved payload. This is
      // the supported pattern for envelope-style APIs in Axios.
      return envelope.data as unknown as AxiosResponse;
    }
    throw new BizError(envelope.code, envelope.message ?? '', envelope.traceId);
  });

  // ---- Response interceptor (2/2): 401 → single-flight refresh → retry ----
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const cfg = (error.config ?? null) as AnyConfig | null;
      const status = error.response?.status;

      // Bail when:
      //   - no config (request never built)
      //   - already retried once (avoid loops)
      //   - caller opted out
      //   - status is anything other than 401
      if (!cfg || cfg[RETRY_FLAG] || cfg.skipAuthRefresh || status !== 401) {
        return Promise.reject(error);
      }

      cfg[RETRY_FLAG] = true;

      try {
        const newAccess = await options.tokenManager.refresh();
        // Stamp the freshly-issued token onto the retry. We rely on the
        // request interceptor running again for tenant / locale headers.
        cfg.headers?.set?.('Authorization', `Bearer ${newAccess}`);
        return await instance.request(cfg as AxiosRequestConfig);
      } catch (_refreshErr) {
        // Refresh failed — the manager already cleared state and called
        // `onAuthExpired`. Propagate the *original* 401 so callers see a
        // consistent error surface (`status === 401`) rather than a more
        // ambiguous refresh-network error.
        return Promise.reject(error);
      }
    },
  );

  return instance;
}

/**
 * Parse a named cookie from `document.cookie`.
 * Returns `null` in non-browser environments (SSR, tests) or when the
 * cookie is absent.
 *
 * Requirement 18.3 — used by the CSRF header injection.
 */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
