/**
 * Token manager — the single source of truth for access / refresh tokens
 * during the application's lifetime.
 *
 * Validates: Requirements 5.2 ("WHEN a request gets a 401 the system SHALL
 * refresh, queueing concurrent requests") and 5.3 ("WHILE multiple 401s
 * arrive in the same window THE system SHALL call `api.refresh` AT MOST
 * ONCE").
 *
 * # The single-flight contract
 *
 * The manager exposes one externally observable method, `refresh()`, with
 * the following guarantees:
 *
 *   1. **At most one in-flight refresh.** If a refresh is already in flight
 *      when `refresh()` is called again, the *same* promise is returned.
 *      This is the "single-flight" property the property-based test in
 *      `tests/token-manager.pbt.test.ts` pins down — under any number of
 *      concurrent callers, `refreshFn` is invoked exactly once per refresh
 *      *window*.
 *
 *   2. **Shared resolution.** All callers in a window resolve with the same
 *      `accessToken` value (or all reject with the same error). This is
 *      what allows the response interceptor to safely retry every queued
 *      401 request after a single refresh round-trip.
 *
 *   3. **Window boundary on settlement.** Once the in-flight promise
 *      settles, the next `refresh()` call starts a *new* window — i.e. the
 *      "single-flight" lock is auto-released. This is essential because a
 *      subsequent 401 wave (e.g. after another hour) must be allowed to
 *      trigger a fresh refresh.
 *
 * # Persistence
 *
 * The token pair is mirrored to a `Storage` from `@keel/utils` so refreshes
 * survive page reloads. The store key is configurable; default is
 * `keel.auth.tokens`. We deliberately do *not* persist the in-flight
 * promise — it's process-local by design.
 *
 * # Auth-expired callback
 *
 * If `refresh()` rejects, the manager clears its in-memory + persisted
 * state, then notifies the caller via `onAuthExpired`. The caller (typically
 * `apps/admin/bootstrap`) is responsible for redirecting to `/login` and
 * resetting stores (Requirement 17.2).
 */

import { createStorage, type Storage, type StorageKind } from '@keel/utils';

import type { TokenPair } from '@keel/types';

/** Function the consumer provides to perform the actual refresh round-trip. */
export type RefreshFn = (refreshToken: string) => Promise<TokenPair>;

export interface TokenManagerOptions {
  /**
   * Hits the backend's refresh endpoint and resolves with a fresh pair.
   * Throw / reject to signal the refresh failed (e.g. refresh token expired);
   * the manager will then call `onAuthExpired` and require a fresh login.
   */
  refreshFn: RefreshFn;

  /**
   * Notified once when the manager transitions to an "auth expired" state:
   *   - `refresh()` rejected with a non-recoverable error, OR
   *   - `refresh()` was called with no refresh token available.
   *
   * The callback should reset application state and route to /login.
   * It is fired at most once per `clear()` cycle so callers do not need to
   * de-duplicate themselves.
   */
  onAuthExpired?: () => void;

  /**
   * Persistence backend kind, forwarded to `createStorage`.
   * Defaults to `'local'`. Pass `'memory'` for tests.
   */
  storageKind?: StorageKind;

  /** Override the persistence key. Default `'keel.auth.tokens'`. */
  storageKey?: string;

  /**
   * Inject a pre-built storage (handy for tests / SSR). Takes precedence
   * over `storageKind`.
   */
  storage?: Storage;
}

export interface TokenManager {
  /** Currently held access token, or null if not authenticated. */
  getAccess(): string | null;
  /** Currently held refresh token, or null if not authenticated. */
  getRefresh(): string | null;
  /** Replace the in-memory + persisted token pair. Resets the auth-expired latch. */
  set(pair: TokenPair): void;
  /** Wipe in-memory + persisted state. Idempotent. */
  clear(): void;

  /**
   * Single-flight refresh. Concurrent callers within a refresh window share
   * the same promise; once it settles, a new window is allowed.
   *
   * Rejects with the error returned by `refreshFn`, *after* invoking
   * `onAuthExpired` and clearing local state.
   */
  refresh(): Promise<string>;

  /**
   * Diagnostic — true while a refresh is in flight. Exposed for tests; the
   * response interceptor should not branch on this directly (it should just
   * `await refresh()`).
   */
  isRefreshing(): boolean;
}

const DEFAULT_KEY = 'keel.auth.tokens';

/**
 * No-refresh-token sentinel. Distinguished from `refreshFn` errors so the
 * caller can render a different message ("session expired, please log in"
 * vs. "refresh failed, please try again").
 */
export class NoRefreshTokenError extends Error {
  constructor() {
    super('No refresh token available');
    this.name = 'NoRefreshTokenError';
    Object.setPrototypeOf(this, NoRefreshTokenError.prototype);
  }
}

export function createTokenManager(options: TokenManagerOptions): TokenManager {
  const storage = options.storage ?? createStorage(options.storageKind ?? 'local');
  const storageKey = options.storageKey ?? DEFAULT_KEY;
  const onAuthExpired = options.onAuthExpired;

  // Hydrate from persistence eagerly so subsequent `getAccess()` calls are
  // synchronous. A malformed payload is treated as "no tokens".
  let pair: TokenPair | null = readPair(storage, storageKey);

  /**
   * The single-flight handle. While non-null, every concurrent caller of
   * `refresh()` receives this exact promise. Cleared in the settlement
   * `finally` block to open a fresh window for the next 401 wave.
   */
  let inflight: Promise<string> | null = null;

  /**
   * `onAuthExpired` may be expensive (state resets, navigation). We fire it
   * exactly once per "expired" transition by gating on this latch. The
   * latch resets when `set()` re-establishes valid tokens.
   */
  let authExpiredFired = false;

  function persist(): void {
    if (pair === null) {
      storage.remove(storageKey);
    } else {
      storage.set(storageKey, pair);
    }
  }

  function fireAuthExpired(): void {
    if (authExpiredFired) return;
    authExpiredFired = true;
    // Defer to avoid running consumer code mid-await. We don't `await` it —
    // the caller's redirect / reset is fire-and-forget.
    if (onAuthExpired) {
      // We intentionally do not catch here: any throw should surface in the
      // host's unhandled-rejection channel rather than be silently swallowed.
      Promise.resolve().then(onAuthExpired);
    }
  }

  return {
    getAccess() {
      return pair?.accessToken ?? null;
    },
    getRefresh() {
      return pair?.refreshToken ?? null;
    },
    set(next: TokenPair) {
      pair = next;
      authExpiredFired = false;
      persist();
    },
    clear() {
      pair = null;
      // `inflight` deliberately left alone: if a refresh is in flight, its
      // settlement handler will see `pair === null` and behave correctly.
      persist();
    },
    isRefreshing() {
      return inflight !== null;
    },
    refresh(): Promise<string> {
      // Single-flight gate: if a refresh is in flight, return *the exact
      // same* promise so all concurrent callers share its resolution.
      // This is the property-based test's headline invariant.
      if (inflight !== null) return inflight;

      const refreshToken = pair?.refreshToken ?? null;
      if (refreshToken === null) {
        // No refresh token to use — go straight to expired without burning
        // a network round-trip. Note: we still produce a *Promise* (not a
        // synchronous throw) so callers can treat `refresh()` uniformly.
        const err = new NoRefreshTokenError();
        // Defer the auth-expired notification so it fires consistently
        // through the same Promise micro-task channel as the success path.
        inflight = Promise.reject(err).catch((e: unknown) => {
          fireAuthExpired();
          throw e;
        });
        // Open the next window once this micro-task settles, mirroring the
        // success branch below. `.finally` returns a *derivative* promise
        // that inherits the rejection of `inflight`; we append a no-op
        // `.catch` so that derivative is observed and does not surface as
        // an unhandled rejection. The promise returned to the caller is
        // still `inflight`, so callers see the rejection unchanged.
        const handle = inflight;
        inflight
          .finally(() => {
            if (inflight === handle) inflight = null;
          })
          .catch(() => {});
        return inflight;
      }

      // The success / failure split is wrapped in its own promise so we
      // can keep `inflight` strictly typed as `Promise<string>` (callers
      // get the access token directly, mirroring the field they need most).
      const handle: Promise<string> = (async () => {
        try {
          const next = await options.refreshFn(refreshToken);
          // Note: we read `pair` again here in case `clear()` was called
          // mid-flight. If the manager was cleared we discard the result —
          // the user's session is already considered terminated.
          if (pair === null) {
            // We were cleared during the round-trip. Treat as auth-expired.
            fireAuthExpired();
            throw new NoRefreshTokenError();
          }
          pair = next;
          authExpiredFired = false;
          persist();
          return next.accessToken;
        } catch (err) {
          // Refresh failed → drop tokens, signal expired, propagate the
          // original error (callers may want to log the network detail).
          pair = null;
          persist();
          fireAuthExpired();
          throw err;
        }
      })();

      inflight = handle;

      // Open the next refresh window once this one settles. Done in a
      // separate `.finally` so we don't accidentally swallow the settlement
      // value/error chain that callers are awaiting.
      //
      // `.finally` returns a *derivative* promise that inherits the
      // rejection of `handle`. Without observing that derivative, a failed
      // refresh would surface as an unhandled rejection (the caller's
      // `await` only attaches a handler to `handle` itself, not to this
      // sibling chain). We append a no-op `.catch` so the side derivative
      // is observed; the promise returned to the caller is still `handle`,
      // so callers continue to see the rejection unchanged.
      handle
        .finally(() => {
          // Guard against a stray re-entry that already replaced inflight.
          if (inflight === handle) inflight = null;
        })
        .catch(() => {});

      return handle;
    },
  };
}

function readPair(storage: Storage, key: string): TokenPair | null {
  const value = storage.get<TokenPair>(key);
  if (!value || typeof value.accessToken !== 'string' || typeof value.refreshToken !== 'string') {
    return null;
  }
  return value;
}
