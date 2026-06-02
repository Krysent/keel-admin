/**
 * Property-based tests for the request-dedupe interceptor contract.
 *
 * **Validates: Requirements 5.6, 5.7**
 *
 *   5.6 — While a request with fingerprint
 *         `${METHOD} ${url}?${stableHash(params)}|${stableHash(body)}`
 *         is in flight, any subsequent request that hashes to the same
 *         fingerprint AND is NOT marked `allowConcurrent: true` SHALL
 *         be cancelled — i.e. rejected with an axios `CanceledError`
 *         (`axios.isCancel(err) === true`). The original in-flight
 *         request must be unaffected.
 *
 *   5.7 — Once a tracked request settles (HTTP success, HTTP error, or
 *         a `BizError` thrown by the envelope interceptor), its
 *         fingerprint SHALL be removed from the in-flight map. There
 *         must be no leak — `__keelDedupe.size()` returns to 0.
 *
 * # Why a property test (rather than examples)
 *
 * "No leak" and "exactly one survivor among K duplicates" are quantified
 * statements over arbitrary request fingerprint sets. An example test
 * could only check a handful of shapes; fast-check spans the input space
 * (request count, duplicate group counts, success / failure mix) and
 * shrinks failures to a minimal counter-example.
 *
 * # Generator design
 *
 * For each scenario we generate a list of `requestSpecs`. Each spec has:
 *   - `key`: a small integer (0..maxKey). Specs with the same key share a
 *     fingerprint — they're duplicates. Specs with different keys are
 *     pairwise distinct.
 *   - `outcome`: success or failure. Lets us exercise both response
 *     branches of the cleanup interceptor.
 *
 * # Controllable adapter (Deferred-based)
 *
 * The dedupe interceptor cancels duplicates at the REQUEST stage — that
 * means the first request must still be "in flight" when the duplicate
 * arrives. We model that by giving each unique key its own `Deferred`:
 * the adapter parks the first request for that key on `def.promise`.
 * After we've fired all requests, we resolve / reject every Deferred,
 * which lets the dedupe map drain. This is the only reliable way to
 * keep multiple requests genuinely concurrent in a single-threaded test
 * — otherwise each request would settle synchronously between fires
 * and no duplicates would ever be detected.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import {
  createHttp,
  createTokenManager,
  DEDUPE_HANDLE_KEY,
  type DedupeHandle,
  type RefreshFn,
} from '../src/index.js';

// ---------------------------------------------------------------------------
//   Test scaffolding
// ---------------------------------------------------------------------------

/**
 * Tiny deferred — like `Promise.withResolvers()` but typed for the response
 * payload we'll resolve with. Used to control adapter settlement timing.
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
 * Wait `n` micro-task ticks. Axios runs request interceptors and the
 * adapter on a `.then(...)` chain, so a synchronously-issued `http.request`
 * does not actually invoke the adapter until at least a few micro-tasks
 * have elapsed. The tests synchronously fire a burst of requests (so
 * duplicates collide while the original is still queued) and then
 * `await flushMicrotasks(...)` before inspecting the adapter's pool.
 *
 * Empirically the request interceptor + adapter invocation costs ~3
 * micro-tasks; we use 16 to leave ample headroom across Axios versions
 * and Node event-loop variations.
 */
async function flushMicrotasks(n = 16): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await Promise.resolve();
  }
}

/**
 * Wrap an in-flight axios promise so its rejection is observed
 * immediately. The dedupe request interceptor rejects duplicates
 * synchronously (within a micro-task), and Vitest reports any rejection
 * not observed in the same micro-task tick as an "unhandled rejection".
 * We attach `.then` handlers right away so the test driver always sees
 * the outcome through this single `Promise<Result>` instead of relying
 * on a downstream `Promise.allSettled` to attach handlers later.
 */
type Result = { ok: true; value: unknown } | { ok: false; error: unknown };
function observed(p: Promise<unknown>): Promise<Result> {
  return p.then(
    (value): Result => ({ ok: true, value }),
    (error): Result => ({ ok: false, error }),
  );
}

/** No-op refresh — none of these tests trigger 401 paths. */
const noopRefresh: RefreshFn = async () => ({
  accessToken: 'never',
  refreshToken: 'never',
});

/**
 * Build an Axios instance + a pool of Deferreds, one per unique URL. The
 * adapter waits on the corresponding Deferred so the dedupe interceptor
 * sees all requests as concurrently in-flight when they're fired in a
 * synchronous burst.
 *
 * # Why URL-keyed (not fingerprint-keyed)
 *
 * Axios runs `transformRequest` between the request interceptors and the
 * adapter — by default it serialises a plain-object `data` field to its
 * JSON-string form. That means the dedupe interceptor and the adapter see
 * `config.data` in DIFFERENT shapes (object vs string), and hashing them
 * with `stableHash` would produce different fingerprints. We sidestep
 * that here by using `config.url` as the pool key. Each test scenario
 * uses a unique URL per "intended fingerprint group" (the dedupe contract
 * collapses them by design), so URL-keying is sufficient to settle each
 * group's in-flight original from the test driver. The dedupe
 * interceptor itself still uses the full method+url+params+body
 * fingerprint internally — that's what's actually under test.
 *
 * Returns the http instance, the dedupe handle (for size assertions), and
 * a `pool` keyed by URL that the test harness uses to settle requests on
 * demand.
 */
function makeClientWithDeferredPool() {
  const pool = new Map<
    string, // config.url
    {
      def: ReturnType<typeof deferred<AxiosResponse>>;
      hits: number; // how many times the adapter saw this URL
    }
  >();

  const adapter: AxiosAdapter = (config) => {
    const url = config.url ?? '';
    let entry = pool.get(url);
    if (entry === undefined) {
      entry = { def: deferred<AxiosResponse>(), hits: 0 };
      pool.set(url, entry);
    }
    entry.hits += 1;
    return entry.def.promise.then(
      (response) => ({ ...response, config }),
      (rawError) => {
        // Real axios adapters always emit `AxiosError` instances with
        // `config` populated. The dedupe response cleanup interceptor
        // reads `error.config[FP_KEY]` to identify which fingerprint to
        // free, so a plain `Error` here would leak the fingerprint
        // (NOT a bug in dedupe — a fidelity gap in the test adapter).
        // We rewrap rejections as `AxiosError` to match production.
        const message =
          rawError instanceof Error ? rawError.message : String(rawError);
        throw new AxiosError(message, AxiosError.ERR_BAD_RESPONSE, config);
      },
    );
  };

  const tokenManager = createTokenManager({
    refreshFn: noopRefresh,
    storageKind: 'memory',
  });

  const http = createHttp({
    baseURL: 'http://localhost',
    tokenManager,
  });
  http.defaults.adapter = adapter;

  // The dedupe handle is exposed on the instance under a non-enumerable
  // property (DEDUPE_HANDLE_KEY === '__keelDedupe'). We cast through
  // Record because the augmentation is intentionally not on the public
  // AxiosInstance type — it's an internal debug surface.
  const handle = (http as unknown as Record<string, DedupeHandle>)[
    DEDUPE_HANDLE_KEY
  ];
  if (handle === undefined) {
    throw new Error('dedupe handle was not installed on the Axios instance');
  }

  return { http, handle, pool };
}

/**
 * Build a synthetic AxiosResponse for the adapter to resolve with. The
 * envelope interceptor inside `createHttp` will unwrap `data` on
 * `code === 0` so the caller's `await http.request(...)` resolves to
 * the inner payload. Errors are produced by REJECTING the deferred
 * with a fresh `Error` instead.
 */
function makeOkEnvelopeResponse(
  config: InternalAxiosRequestConfig,
  payload: unknown,
): AxiosResponse {
  return {
    data: { code: 0, data: payload, message: 'ok' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  } as AxiosResponse;
}

// ---------------------------------------------------------------------------
//   Generators
// ---------------------------------------------------------------------------

/**
 * Spec for a single request firing.
 *
 *   - `key` collapses requests onto shared fingerprints when it repeats.
 *     Range 0..7 keeps the duplicate-vs-distinct mix interesting at small
 *     scenario sizes.
 *   - `succeed` toggles the outcome so cleanup is exercised on both
 *     success and failure paths (Requirement 5.7).
 */
const requestSpecArb = fc.record({
  key: fc.integer({ min: 0, max: 7 }),
  succeed: fc.boolean(),
});

/**
 * A scenario: 1..16 concurrent request firings. We allow length 1 because
 * even a single request must still get cleaned up (the "no leak" property
 * is meaningful at any scale).
 */
const scenarioArb = fc.array(requestSpecArb, { minLength: 1, maxLength: 16 });

/**
 * URL key used by the test harness to settle a specific in-flight
 * request from the pool. Mirrors the URL used to issue requests for
 * `key` so the test can drive originals from the outside.
 */
function urlForKey(key: number): string {
  return `/items/${key}`;
}

// ---------------------------------------------------------------------------
//   Properties
// ---------------------------------------------------------------------------

describe('Dedupe interceptor (PBT)', () => {
  // -----------------------------------------------------------------
  //   Property A: pairwise-distinct fingerprints → all resolve.
  //
  //   When every request has a unique fingerprint, the dedupe interceptor
  //   must NOT cancel anyone. All requests should fulfil with their
  //   payload. This is the "no false positives" guarantee.
  // -----------------------------------------------------------------
  it('pairwise-distinct fingerprints → no request is cancelled (Requirement 5.6)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Each key in the array becomes a unique request. Use a Set to
        // de-duplicate, then turn back into an array of distinct keys.
        fc.uniqueArray(fc.integer({ min: 0, max: 1000 }), {
          minLength: 1,
          maxLength: 12,
        }),
        async (keys) => {
          const { http, handle, pool } = makeClientWithDeferredPool();

          // Fire all requests synchronously — they all stamp their
          // distinct fingerprints into the in-flight set in the same
          // burst. We immediately wrap each with `observed` so any
          // synchronous rejection from the dedupe interceptor is caught
          // before Vitest's unhandled-rejection watcher fires.
          const callers = keys.map((key) =>
            observed(
              http.request({
                method: 'POST',
                url: `/items/${key}`,
                data: { key },
              }),
            ),
          );

          // Axios runs request interceptors + the adapter on a
          // micro-task chain — let those drain so the pool's Deferreds
          // exist before we try to settle them.
          await flushMicrotasks();

          // Drain the pool in order. Each unique key has exactly one
          // request waiting on its Deferred (keyed by URL).
          for (const key of keys) {
            const entry = pool.get(urlForKey(key));
            expect(entry).toBeDefined();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            entry!.def.resolve(
              // Config will be re-attached by the adapter wrapper.
              makeOkEnvelopeResponse(
                {} as InternalAxiosRequestConfig,
                { key },
              ),
            );
          }

          const settled = await Promise.all(callers);

          // -- Every caller fulfilled --
          for (const r of settled) {
            expect(r.ok).toBe(true);
          }
          // -- Cleanup leaves no fingerprints (Requirement 5.7) --
          expect(handle.size()).toBe(0);
        },
      ),
      { numRuns: 60 },
    );
  });

  // -----------------------------------------------------------------
  //   Property B: K duplicates of the same fingerprint →
  //               exactly 1 fulfils, K-1 reject with CanceledError.
  //
  //   This is the headline dedupe contract (Requirement 5.6). The first
  //   firing claims the fingerprint slot; every subsequent firing of
  //   the same fingerprint is rejected synchronously by the request
  //   interceptor with a `CanceledError`, which `axios.isCancel`
  //   discriminates against any other error class.
  // -----------------------------------------------------------------
  it('K duplicates → exactly one survives, the rest are CanceledError (Requirement 5.6)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          key: fc.integer({ min: 0, max: 100 }),
          duplicates: fc.integer({ min: 2, max: 10 }),
          succeed: fc.boolean(),
        }),
        async ({ key, duplicates, succeed }) => {
          const { http, handle, pool } = makeClientWithDeferredPool();

          // Fire `duplicates` synchronously-issued requests with the
          // SAME url + body. The first one's request interceptor stamps
          // the fingerprint; subsequent ones synchronously hit the
          // duplicate-detected branch and reject. We wrap each call in
          // `observed` so duplicate rejections are caught immediately.
          const callers = Array.from({ length: duplicates }, () =>
            observed(
              http.request({
                method: 'POST',
                url: `/items/${key}`,
                data: { key },
              }),
            ),
          );

          // Let request interceptors and the adapter run before we
          // try to settle the lone in-flight request.
          await flushMicrotasks();

          // Settle the lone in-flight request. Use `succeed` to also
          // exercise the error-side cleanup path (Requirement 5.7).
          const entry = pool.get(urlForKey(key));
          expect(entry).toBeDefined();
          // The adapter must have been invoked exactly once — duplicates
          // never reach it because they're rejected at request-interceptor
          // time.
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          expect(entry!.hits).toBe(1);

          if (succeed) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            entry!.def.resolve(
              makeOkEnvelopeResponse(
                {} as InternalAxiosRequestConfig,
                { key },
              ),
            );
          } else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            entry!.def.reject(new Error('network blew up'));
          }

          const settled = await Promise.all(callers);

          // -- Survivor count: exactly one should succeed/fail per the
          //    chosen outcome; everyone else must be a CanceledError.
          let survivorCount = 0;
          let cancelCount = 0;
          for (const r of settled) {
            if (r.ok) {
              // A fulfilled caller is the in-flight survivor.
              survivorCount += 1;
            } else if (axios.isCancel(r.error)) {
              cancelCount += 1;
            } else {
              // A non-cancel rejection IS the in-flight request's
              // network failure — the survivor on the failure path.
              survivorCount += 1;
            }
          }
          expect(survivorCount).toBe(1);
          expect(cancelCount).toBe(duplicates - 1);

          // -- Cleanup: map is empty (Requirement 5.7) --
          expect(handle.size()).toBe(0);
        },
      ),
      { numRuns: 80 },
    );
  });

  // -----------------------------------------------------------------
  //   Property C: arbitrary mix of unique + duplicate fingerprints,
  //               arbitrary success / failure outcomes →
  //               after all settle, the dedupe map is empty.
  //
  //   This is the "no leak" generalisation of Requirement 5.7 across
  //   all interleavings of request shapes and outcomes. It also covers
  //   the dedupe-only edge case where every request is a duplicate of
  //   the same in-flight original.
  // -----------------------------------------------------------------
  it('mixed scenario → fingerprint map fully drains after settlement (Requirement 5.7)', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async (specs) => {
        const { http, handle, pool } = makeClientWithDeferredPool();

        // Fire all requests synchronously so duplicates collide while
        // the original is still in flight. `observed` catches both the
        // synchronous duplicate rejections and the eventual originals'
        // outcomes.
        const callers = specs.map((spec) =>
          observed(
            http.request({
              method: 'POST',
              url: `/items/${spec.key}`,
              data: { key: spec.key },
            }),
          ),
        );

        // Wait for axios to drain its request-interceptor / adapter
        // micro-task chain before we try to settle anything.
        await flushMicrotasks();

        // For each unique key in the spec list, settle the originating
        // request once. Subsequent specs that share the key were already
        // rejected synchronously by the dedupe interceptor and aren't
        // waiting on any Deferred. We use the FIRST occurrence of each
        // key to decide success/failure, which matches "the original
        // request's outcome drives cleanup".
        const seenKeys = new Set<number>();
        for (const spec of specs) {
          if (seenKeys.has(spec.key)) continue;
          seenKeys.add(spec.key);
          const entry = pool.get(urlForKey(spec.key));
          // The in-flight request for this fingerprint should have
          // reached the adapter (the dedupe interceptor only blocks
          // duplicates, not originals).
          expect(entry).toBeDefined();
          if (spec.succeed) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            entry!.def.resolve(
              makeOkEnvelopeResponse(
                {} as InternalAxiosRequestConfig,
                { key: spec.key },
              ),
            );
          } else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            entry!.def.reject(new Error(`fail-${spec.key}`));
          }
        }

        // Wait for everyone to settle (both originals and duplicates).
        await Promise.all(callers);

        // The headline invariant: no leak.
        expect(handle.size()).toBe(0);
      }),
      { numRuns: 60 },
    );
  });

  // -----------------------------------------------------------------
  //   Property D (sanity): allowConcurrent: true is NOT tracked.
  //
  //   When the caller opts out via `allowConcurrent: true`, the dedupe
  //   interceptor must (a) never cancel the call and (b) never put it
  //   into the in-flight map — otherwise an opt-out request could
  //   block a normal request with the same fingerprint or leak its
  //   fingerprint into the map. This isn't strictly listed in 5.6 but
  //   is the explicit per-request escape hatch in
  //   `RequestExtraConfig.allowConcurrent` and matches the wording
  //   "IF 未传 `allowConcurrent: true`" in the requirement.
  // -----------------------------------------------------------------
  it('allowConcurrent:true bypasses the dedupe map entirely (Requirement 5.6 escape hatch)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          key: fc.integer({ min: 0, max: 100 }),
          duplicates: fc.integer({ min: 2, max: 6 }),
        }),
        async ({ key, duplicates }) => {
          const { http, handle, pool } = makeClientWithDeferredPool();

          const callers = Array.from({ length: duplicates }, () =>
            observed(
              http.request({
                method: 'POST',
                url: `/items/${key}`,
                data: { key },
                // allowConcurrent is consumed by the dedupe interceptor;
                // we cast through Record because it's an extension on the
                // axios config surface (mirrors RequestExtraConfig).
                ...({ allowConcurrent: true } as Record<string, unknown>),
              }),
            ),
          );

          await flushMicrotasks();

          // Each opt-out request reaches the adapter. They all share
          // the same URL pool entry though, so we can settle them in
          // one shot.
          const entry = pool.get(urlForKey(key));
          expect(entry).toBeDefined();
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          expect(entry!.hits).toBe(duplicates);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          entry!.def.resolve(
            makeOkEnvelopeResponse(
              {} as InternalAxiosRequestConfig,
              { key },
            ),
          );

          const settled = await Promise.all(callers);
          for (const r of settled) {
            expect(r.ok).toBe(true);
          }
          // Map is empty because we never tracked these.
          expect(handle.size()).toBe(0);
        },
      ),
      { numRuns: 30 },
    );
  });
});
