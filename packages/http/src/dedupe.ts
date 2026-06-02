/**
 * Dedupe interceptor — prevents accidental concurrent submission of the
 * same logical request (Requirements 5.6, 5.7).
 *
 * # Contract
 *
 *   5.6 — While a request with fingerprint `F` is in flight and the caller
 *         has NOT opted in via `allowConcurrent: true`, any subsequent
 *         request that hashes to the same `F` SHALL be canceled at the
 *         request-interceptor stage by throwing an axios `CanceledError`.
 *         The original in-flight request is undisturbed.
 *
 *   5.7 — Once a tracked request settles (HTTP success, HTTP error, or any
 *         downstream interceptor throw such as `BizError`), its fingerprint
 *         SHALL be removed from the in-flight map. There must be no leak.
 *
 * # Fingerprint formula
 *
 *   `${METHOD} ${url}?${stableHash(params)}|${stableHash(body)}`
 *
 * Object key order in `params` and `body` does not matter — `stableHash`
 * sorts keys at every level. Array order *does* matter (matching list
 * semantics). See `@keel/utils/stable-hash` for the full canonicalisation
 * rules.
 *
 * # Wiring order (important)
 *
 * The dedupe response cleanup interceptor MUST be registered BEFORE the
 * envelope-unwrap interceptor on the response chain. This is because:
 *
 *   - Axios runs response interceptors in registration order (FIFO). The
 *     envelope interceptor short-circuits the chain by returning
 *     `envelope.data` (a non-AxiosResponse) on the success path. Any
 *     subsequent interceptor would receive raw `data` rather than a
 *     proper `AxiosResponse`, losing access to `response.config` and
 *     therefore to the fingerprint we stamped on it.
 *   - On the BizError path, the envelope interceptor throws a `BizError`
 *     that has no `config` field, so a downstream error handler cannot
 *     recover the fingerprint either.
 *
 * Registering cleanup BEFORE envelope guarantees:
 *   - Success path: cleanup runs first on the still-intact `AxiosResponse`,
 *     removes the fingerprint, then envelope unwraps and the BizError (if
 *     any) propagates without ever re-touching the dedupe state.
 *   - HTTP error path (e.g. 401, 5xx): cleanup's `onRejected` runs first
 *     on the error (which still carries `error.config`), removing the
 *     fingerprint before the 401-retry interceptor decides whether to
 *     replay the request.
 *
 * # 401 retry interaction
 *
 * On a 401 → refresh → retry flow, the retry passes through the request
 * interceptor chain again. The dedupe error handler will have removed the
 * original fingerprint, so the retry simply re-stamps it. A subsequent
 * response cleanup removes it once. Net effect: the map is empty after
 * the retry settles. (Tests in this task focus on the dedupe-only paths;
 * the refresh path is exercised by `token-manager.pbt.test.ts`.)
 */

import {
  AxiosError,
  CanceledError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { stableHash } from '@keel/utils';

/** Internal symbol stamped onto a config so we can correlate response → fingerprint. */
const FP_KEY = '__keelDedupeFingerprint__' as const;

/**
 * Per-request opt-out. Mirrors the `allowConcurrent` field on
 * `RequestExtraConfig` in `./types.ts`. Kept narrow here to avoid coupling
 * `dedupe.ts` to the full factory option surface.
 */
type AnyConfig = InternalAxiosRequestConfig & {
  [FP_KEY]?: string;
  allowConcurrent?: boolean;
};

/**
 * Diagnostic handle exposed on the Axios instance via `__keelDedupe`.
 * Tests assert on `size()` to verify "no leak after settlement"; runtime
 * code should not depend on this surface.
 */
export interface DedupeHandle {
  /** Number of fingerprints currently in flight. */
  size(): number;
  /** True iff `fingerprint` is in flight right now. */
  has(fingerprint: string): boolean;
  /** Drop all tracked fingerprints. Useful for tests / forced reset. */
  clear(): void;
  /**
   * Compute the same fingerprint the request interceptor would stamp.
   * Exposed so tests can correlate without re-implementing the formula.
   */
  fingerprint(spec: {
    method?: string;
    url?: string;
    params?: unknown;
    data?: unknown;
  }): string;
}

/**
 * Build the request fingerprint per Requirement 5.6 spec:
 *   `${METHOD} ${url}?${stableHash(params)}|${stableHash(body)}`
 *
 * - `method` defaults to `'get'` (matches Axios' own default) and is
 *   uppercased so `get` and `GET` collide.
 * - `url` is taken verbatim — Axios resolves baseURL only at adapter time,
 *   so callers using the same relative path always collide.
 * - `params` and `data` go through `stableHash`, which sorts object keys
 *   recursively so `{a:1,b:2}` and `{b:2,a:1}` map to the same fingerprint.
 */
export function computeFingerprint(config: {
  method?: string | undefined;
  url?: string | undefined;
  params?: unknown;
  data?: unknown;
}): string {
  const method = (config.method ?? 'get').toUpperCase();
  const url = config.url ?? '';
  return `${method} ${url}?${stableHash(config.params)}|${stableHash(config.data)}`;
}

/**
 * Install the dedupe request + response cleanup interceptors on `instance`.
 *
 * Returns a `DedupeHandle` that callers (tests, debug surfaces) can use to
 * inspect the in-flight set without poking at internals.
 *
 * Must be called BEFORE any response interceptor that short-circuits the
 * chain (e.g. the envelope unwrap). See module docblock for why.
 */
export function installDedupe(instance: AxiosInstance): DedupeHandle {
  /**
   * Set instead of Map: we don't need to associate any extra metadata with
   * a fingerprint, only "is this currently in flight?". A Set keeps the
   * "no leak after settlement" invariant trivial to verify (Property C in
   * the PBT) — `size === 0` after all promises settle.
   */
  const inflight = new Set<string>();

  // ---- Request interceptor: fingerprint check + tag ----
  instance.interceptors.request.use((config) => {
    const cfg = config as AnyConfig;

    // Per-request opt-out: callers that explicitly want to fan out (e.g.
    // polling several copies of the same endpoint with different intent)
    // pass `allowConcurrent: true`. We DO NOT track them at all so they
    // can never collide with — or be confused with — tracked requests.
    if (cfg.allowConcurrent === true) {
      return cfg;
    }

    const fp = computeFingerprint(cfg);
    if (inflight.has(fp)) {
      // Duplicate detected. Throwing from a request interceptor causes
      // Axios to reject this request's promise BEFORE the adapter is
      // dispatched. The original in-flight request is unaffected.
      //
      // We use `CanceledError` (not BizError or a plain Error) so that
      // `axios.isCancel(err)` returns true for callers that already
      // distinguish cancellations from real errors (Requirement 17.5
      // — "去重器拦截 SHALL 抛 CanceledError 而不弹错误提示").
      throw new CanceledError(
        `Duplicate request canceled by dedupe (fingerprint=${fp})`,
        AxiosError.ERR_CANCELED,
        cfg,
      );
    }

    inflight.add(fp);
    cfg[FP_KEY] = fp;
    return cfg;
  });

  // ---- Response interceptor: cleanup on success AND error ----
  //
  // Registered BEFORE the envelope interceptor (see module docblock) so
  // it observes the still-intact `AxiosResponse` / `AxiosError` and can
  // recover the fingerprint from `response.config[FP_KEY]` /
  // `error.config[FP_KEY]`.
  instance.interceptors.response.use(
    (response) => {
      const cfg = response.config as AnyConfig;
      const fp = cfg[FP_KEY];
      if (fp !== undefined) {
        inflight.delete(fp);
      }
      return response;
    },
    (error: unknown) => {
      // The error came from the network / adapter (HTTP non-2xx, abort,
      // timeout). Its `config` is still our `InternalAxiosRequestConfig`
      // and carries the fingerprint we stamped at request time.
      //
      // Note: a `CanceledError` thrown from OUR OWN request interceptor
      // for a duplicate request will also flow through this branch, but
      // its config does NOT have `FP_KEY` set (we throw before stamping).
      // The `if (fp !== undefined)` guard makes that path a no-op, so
      // duplicates never accidentally remove the original's fingerprint.
      const cfg = (error as { config?: AnyConfig } | null)?.config;
      const fp = cfg?.[FP_KEY];
      if (fp !== undefined) {
        inflight.delete(fp);
      }
      return Promise.reject(error);
    },
  );

  return {
    size: () => inflight.size,
    has: (fp) => inflight.has(fp),
    clear: () => inflight.clear(),
    fingerprint: (spec) => computeFingerprint(spec),
  };
}

/** Property name under which `installDedupe` exposes the handle on the Axios instance. */
export const DEDUPE_HANDLE_KEY = '__keelDedupe' as const;
