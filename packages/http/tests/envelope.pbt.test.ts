/**
 * Property-based tests for the response-envelope interceptor contract.
 *
 * **Validates: Requirements 5.4**
 *
 *   5.4 — WHEN response envelope `code === 0` THEN the system SHALL return
 *         `envelope.data` as the resolved value of the request; WHEN
 *         `code !== 0` THEN the system SHALL throw
 *         `BizError(code, message, traceId)` whose fields exactly mirror
 *         the envelope.
 *
 * # Why a property test (rather than examples)
 *
 * The envelope contract is a *universal* statement: for every well-formed
 * envelope and every payload shape, the interceptor MUST either pass
 * `data` straight through (success branch) or throw a `BizError` carrying
 * the original `code` / `message` / `traceId` (failure branch). An
 * example-based test could only nail down a handful of payloads;
 * fast-check spans the input space (data shape, code value, traceId
 * presence) and shrinks failures to a minimal counter-example.
 *
 * # Test setup
 *
 * The interceptor lives inside the Axios instance returned by
 * `createHttp(...)`. We exercise it without real network I/O by
 * installing an in-memory `axios.AxiosAdapter` that synchronously
 * resolves with a chosen envelope. This isolates the test to the
 * interceptor's behaviour and keeps fast-check shrinks deterministic.
 *
 * # Expected status while task 4 (parent) is in flight
 *
 * Task 4.2 (this PBT) is intentionally written *before* the envelope
 * interceptor lands in `createHttp`. Until task 4 wires the interceptor,
 * `http.get(...)` resolves with the full `AxiosResponse` — i.e. the
 * resolved value is the envelope, not `envelope.data`, and `code !== 0`
 * does not reject. The properties below will therefore fail and pin
 * down the missing behaviour. Once the interceptor is implemented, the
 * same tests should pass without modification.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { AxiosAdapter, AxiosResponse } from 'axios';

import {
  BizError,
  createHttp,
  createTokenManager,
  type RefreshFn,
} from '../src/index.js';

/** Envelope shape used by `@keel/types` (`ApiEnvelope`). */
interface Envelope {
  code: number;
  data: unknown;
  message: string;
  traceId?: string;
}

/**
 * No-op refresh — the envelope interceptor lives on the success path of
 * the response chain (HTTP 200), so no refresh round-trip ever fires in
 * these tests. Provided only because `createTokenManager` requires it.
 */
const noopRefresh: RefreshFn = async () => ({
  accessToken: 'never',
  refreshToken: 'never',
});

/**
 * Build an Axios instance whose adapter returns `envelope` as the body
 * of every request, with HTTP 200. This lets us exercise the envelope
 * interceptor without a real server while keeping the request →
 * response → interceptor pipeline identical to production.
 */
function makeClient(envelope: Envelope) {
  const adapter: AxiosAdapter = async (config) =>
    ({
      data: envelope,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }) as AxiosResponse;

  const tokenManager = createTokenManager({
    refreshFn: noopRefresh,
    storageKind: 'memory',
  });

  const http = createHttp({
    baseURL: 'http://localhost',
    tokenManager,
  });

  // Adapter overrides Axios' default network transport. We attach it on
  // the instance (not globally) so parallel test runs stay isolated.
  http.defaults.adapter = adapter;

  return http;
}

// ---------------------------------------------------------------------------
//   Generators
// ---------------------------------------------------------------------------

/**
 * Success envelopes: `code === 0` is the only success signal — every
 * other field is unconstrained.
 *
 * `data` uses `fc.anything()` to span the full payload shape space
 * (primitives, arrays, nested objects, null, undefined, etc.). The
 * adapter passes the value through by reference, so deep-equality
 * comparisons in the property body do not depend on JSON
 * round-tripping.
 *
 * `traceId` is `fc.option(..., { nil: undefined })` to mirror the
 * `traceId?: string` field in `ApiEnvelope` — `null` would not match
 * the type and the optionality of the field is part of the contract.
 */
const successEnvelopeArb = fc.record<Envelope>({
  code: fc.constant(0),
  data: fc.anything(),
  message: fc.string(),
  traceId: fc.option(fc.string(), { nil: undefined }),
});

/**
 * Error envelopes: any non-zero code triggers the `BizError` branch.
 *
 * We use `fc.integer().filter(c => c !== 0)` rather than splitting into
 * positive / negative so fast-check can shrink towards small magnitudes
 * on either side and surface boundary bugs around `code === 0`.
 */
const errorEnvelopeArb = fc.record<Envelope>({
  code: fc.integer().filter((c) => c !== 0),
  data: fc.anything(),
  message: fc.string(),
  traceId: fc.option(fc.string(), { nil: undefined }),
});

// ---------------------------------------------------------------------------
//   Properties
// ---------------------------------------------------------------------------

describe('Envelope interceptor transparency (PBT)', () => {
  // -----------------------------------------------------------------
  //   Property A: code === 0 → resolved value equals envelope.data
  //
  //   This is the "happy path" of Requirement 5.4. Once the interceptor
  //   unwraps the envelope, `request<T>` (and its underlying
  //   `instance.get(...)`) should resolve with `envelope.data` directly,
  //   not the full AxiosResponse and not the full envelope. We compare
  //   with `toStrictEqual` so structural equality holds even if the
  //   interceptor clones the value before returning it.
  // -----------------------------------------------------------------
  it('code === 0 → request resolves to envelope.data (Requirement 5.4)', async () => {
    await fc.assert(
      fc.asyncProperty(successEnvelopeArb, async (envelope) => {
        const http = makeClient(envelope);
        const resolved = await http.get('/test');
        expect(resolved).toStrictEqual(envelope.data);
      }),
      { numRuns: 100 },
    );
  });

  // -----------------------------------------------------------------
  //   Property B: code !== 0 → request rejects with a BizError whose
  //   `code` / `message` / `traceId` mirror the envelope exactly.
  //
  //   This is the "business error" branch of Requirement 5.4. The
  //   thrown error must (a) be an instance of `BizError` so consumers
  //   can `instanceof`-discriminate, and (b) carry the original tuple
  //   for log correlation (`traceId`) and i18n / toast (`message`).
  // -----------------------------------------------------------------
  it('code !== 0 → request rejects with BizError carrying original code/message/traceId (Requirement 5.4)', async () => {
    await fc.assert(
      fc.asyncProperty(errorEnvelopeArb, async (envelope) => {
        const http = makeClient(envelope);
        let thrown: unknown;
        try {
          await http.get('/test');
        } catch (e) {
          thrown = e;
        }
        // The interceptor MUST throw — falling through silently would
        // let business errors masquerade as success values, the very
        // bug Requirement 5.4 prevents.
        expect(thrown).toBeInstanceOf(BizError);
        const err = thrown as BizError;
        expect(err.code).toBe(envelope.code);
        expect(err.message).toBe(envelope.message);
        expect(err.traceId).toBe(envelope.traceId);
      }),
      { numRuns: 100 },
    );
  });
});
