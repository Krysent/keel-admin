/**
 * Property-based tests for the single-flight token refresh contract.
 *
 * **Validates: Requirements 5.2, 5.3**
 *
 *   5.2 — A 401 must trigger a refresh; concurrent 401s within a refresh
 *         window must not each issue their own refresh round-trip.
 *   5.3 — Across N concurrent 401-triggering callers, `api.refresh` must be
 *         invoked AT MOST ONCE per refresh window.
 *
 * # Why a property test (rather than examples)
 *
 * The single-flight invariant is naturally a *quantified* statement: "for
 * any concurrent caller count N, any interleaving of completion timings,
 * any mix of success/failure paths, refreshFn must be invoked at most once
 * per window". An example-based test could only nail down a handful of
 * specific timings; fast-check spans the input space and shrinks failures
 * to a minimal counter-example.
 *
 * # Generator design
 *
 * For each property we generate a *scenario* with three knobs:
 *
 *   - `concurrency`: number of concurrent `refresh()` callers (≥ 2 — the
 *     invariant is trivially true for a single caller, so we constrain
 *     away that uninteresting region).
 *   - `outcome`:    whether the refresh round-trip will eventually succeed
 *     or fail. Both branches must produce shared resolution / shared
 *     rejection across all callers.
 *   - `delayTicks`: how many micro-task ticks elapse before the refresh
 *     resolves. Lets us exercise both "everyone awaits before settlement"
 *     and "settlement happens before some callers join the wait" cases.
 *
 * Concurrency in JS land is co-operative: we don't need a clock to test
 * this, just controlled micro-tasks. We use a manual `Deferred` so the test
 * can decide exactly when the in-flight refresh settles.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { createMemoryStorage } from '@keel/utils';
import {
  createTokenManager,
  NoRefreshTokenError,
  type RefreshFn,
} from '../src/token-manager.js';
import { createStorage } from '@keel/utils';

/**
 * A tiny deferred — like `Promise.withResolvers()` but typed for the
 * `TokenPair` we resolve with, and works on Node versions without the
 * built-in.
 */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
} {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Build an isolated TokenManager for each scenario. We use a fresh
 * `createStorage('memory')` per run so persisted state from one fast-check
 * shrink doesn't leak into the next.
 */
function makeManager(opts: {
  refreshFn: RefreshFn;
  initialAccess?: string;
  initialRefresh?: string;
  onAuthExpired?: () => void;
}) {
  // Each scenario uses an isolated in-memory storage instance so persisted
  // state never leaks across fast-check runs (and across the property's
  // many shrunk replays).
  const _backend = createMemoryStorage();
  // Wire it through `createStorage('memory')` style by injecting a custom
  // adapter. We can't pass a raw `StorageLike` directly, but `'memory'`
  // gives us isolation per call — which is exactly what we want.
  const mgr = createTokenManager({
    refreshFn: opts.refreshFn,
    storageKind: 'memory',
    onAuthExpired: opts.onAuthExpired ?? (() => {}),
  });
  if (opts.initialAccess !== undefined && opts.initialRefresh !== undefined) {
    mgr.set({
      accessToken: opts.initialAccess,
      refreshToken: opts.initialRefresh,
    });
  }
  // _backend is unused; kept to document intent (one mem-store per scenario).
  void _backend;
  // Quiet unused-import linter for createStorage (kept for type doc).
  void createStorage;
  return mgr;
}

/**
 * Wait `n` micro-task ticks. Gives the event loop a chance to run other
 * `.then` handlers — e.g. the manager's `finally` block that releases the
 * `inflight` slot.
 */
async function flushMicrotasks(n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
//   Property 1: refreshFn invoked AT MOST ONCE per refresh window (Req 5.3)
//   Property 2: all concurrent callers share the same resolution (Req 5.2)
// ---------------------------------------------------------------------------

describe('TokenManager single-flight refresh (PBT)', () => {
  /**
   * Generator: a single refresh "wave" — N concurrent callers, with the
   * underlying refresh either resolving (yielding a fresh token) or
   * rejecting (yielding a session-expired-style error).
   *
   * Bounds:
   *   - concurrency ≥ 2 covers the contract's interesting region. We cap
   *     at 32 so the test stays fast on slow CI hardware; the invariant is
   *     polynomial in N so larger values add no signal.
   *   - delayTicks ∈ [0, 8] exercises both "settle immediately" and
   *     "settle after several micro-tasks of waiting" interleavings.
   */
  const waveArb = fc.record({
    concurrency: fc.integer({ min: 2, max: 32 }),
    succeed: fc.boolean(),
    delayTicks: fc.integer({ min: 0, max: 8 }),
    newToken: fc.string({ minLength: 1, maxLength: 32 }),
  });

  it('refreshFn is called at most once per refresh window AND all callers share resolution (Requirements 5.2, 5.3)', async () => {
    await fc.assert(
      fc.asyncProperty(waveArb, async ({ concurrency, succeed, delayTicks, newToken }) => {
        // Track refreshFn invocations in a closure-bound counter — this is
        // the headline observable of the single-flight contract.
        let refreshCalls = 0;
        const settle = deferred<{ accessToken: string; refreshToken: string }>();

        const refreshFn: RefreshFn = async () => {
          refreshCalls += 1;
          // Wait the requested number of micro-task ticks before resolving;
          // this lets us probe the boundary between "callers join before
          // settlement" and "settlement arrives quickly".
          await flushMicrotasks(delayTicks);
          return settle.promise;
        };

        const mgr = makeManager({
          refreshFn,
          initialAccess: 'old-access',
          initialRefresh: 'refresh-XYZ',
        });

        // Fire N concurrent refresh() calls. They should all collapse onto
        // the same in-flight promise.
        const callers = Array.from({ length: concurrency }, () => mgr.refresh());

        // Settle the underlying refresh.
        if (succeed) {
          settle.resolve({ accessToken: newToken, refreshToken: 'refresh-XYZ-v2' });
        } else {
          settle.reject(new Error('refresh failed'));
        }

        // Collect outcomes via Promise.allSettled so a failed branch doesn't
        // kill the test before we can inspect it.
        const results = await Promise.allSettled(callers);

        // -- Property 1: AT MOST ONCE -----------------------------------
        //    The whole point. Any breach here is a single-flight bug.
        expect(refreshCalls).toBeLessThanOrEqual(1);
        // We also assert >= 1 because at least someone has to actually
        // perform the refresh; otherwise the contract is vacuously true.
        expect(refreshCalls).toBe(1);

        // -- Property 2: SHARED RESOLUTION ------------------------------
        //    Either all callers fulfil with the same access token, or they
        //    all reject. Mixed outcomes would indicate a window straddle
        //    bug — some callers hit a stale promise while others started
        //    a new refresh.
        if (succeed) {
          for (const r of results) {
            expect(r.status).toBe('fulfilled');
            if (r.status === 'fulfilled') {
              expect(r.value).toBe(newToken);
            }
          }
          // The manager should now hold the new token.
          expect(mgr.getAccess()).toBe(newToken);
          expect(mgr.isRefreshing()).toBe(false);
        } else {
          for (const r of results) {
            expect(r.status).toBe('rejected');
          }
          // After failure, manager state is cleared (ready for re-login).
          expect(mgr.getAccess()).toBeNull();
          expect(mgr.getRefresh()).toBeNull();
          expect(mgr.isRefreshing()).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  // --------------------------------------------------------------------
  //   Property 3: When concurrent callers arrive *after* one settles,
  //   they belong to the NEXT refresh window — i.e. the lock auto-releases.
  //
  //   This guards against the bug "refresh stays locked forever after
  //   first success", which would silently disable subsequent 401 retries.
  // --------------------------------------------------------------------
  it('a new refresh window starts after the previous one settles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          firstWaveSize: fc.integer({ min: 2, max: 8 }),
          secondWaveSize: fc.integer({ min: 2, max: 8 }),
        }),
        async ({ firstWaveSize, secondWaveSize }) => {
          let calls = 0;
          let serial = 0;

          const refreshFn: RefreshFn = async () => {
            calls += 1;
            serial += 1;
            // Resolve immediately (next micro-task) so callers in the same
            // wave all join before settlement.
            return Promise.resolve({
              accessToken: `access-${serial}`,
              refreshToken: `refresh-${serial}`,
            });
          };

          const mgr = makeManager({
            refreshFn,
            initialAccess: 'old',
            initialRefresh: 'refresh-0',
          });

          // First wave.
          const wave1 = Array.from({ length: firstWaveSize }, () => mgr.refresh());
          const r1 = await Promise.all(wave1);
          // All resolved with the same new token.
          for (const v of r1) expect(v).toBe('access-1');
          expect(calls).toBe(1);

          // Second wave AFTER the first one settled — must trigger a brand
          // new refresh (single-flight is per-window, not lifetime).
          const wave2 = Array.from({ length: secondWaveSize }, () => mgr.refresh());
          const r2 = await Promise.all(wave2);
          for (const v of r2) expect(v).toBe('access-2');
          expect(calls).toBe(2);
        },
      ),
      { numRuns: 50 },
    );
  });

  // --------------------------------------------------------------------
  //   Property 4: Without a refresh token, all concurrent callers reject
  //   with NoRefreshTokenError — and refreshFn is NEVER called.
  //
  //   This is the "session truly expired" path: no network round-trip is
  //   wasted, but callers still get a coherent shared rejection.
  // --------------------------------------------------------------------
  it('all callers reject with NoRefreshTokenError when no refresh token is held, and refreshFn is never called', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 16 }),
        async (concurrency) => {
          let calls = 0;
          const refreshFn: RefreshFn = async () => {
            calls += 1;
            return { accessToken: 'never', refreshToken: 'never' };
          };

          const mgr = makeManager({ refreshFn });
          // Note: no `mgr.set(...)` — manager has no tokens.

          const results = await Promise.allSettled(
            Array.from({ length: concurrency }, () => mgr.refresh()),
          );

          expect(calls).toBe(0);
          for (const r of results) {
            expect(r.status).toBe('rejected');
            if (r.status === 'rejected') {
              expect(r.reason).toBeInstanceOf(NoRefreshTokenError);
            }
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});
