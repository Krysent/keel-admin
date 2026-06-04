/**
 * Property-based tests for the `usePermission().has(...)` semantic core.
 *
 * **Validates: Requirement 3.4**
 *
 *   3.4 — `usePermission().has(code, mode)` SHALL return:
 *     - `permissions.has(code)`            when code is a string
 *     - any-hit                            when code is string[] + mode='some'
 *     - all-hit                            when code is string[] + mode='every'
 *     - `true`                             when code is undefined (default-allow)
 *
 * Plus the task 5.1 line item not spelled out word-for-word in the
 * requirement but explicitly stated in the task spec:
 *
 *     "数组 + some：任一命中为真；数组 + every：全部命中为真；空数组退化为 true"
 *     "单调性：P1 ⊆ P2 ⟹ ∀ c, has_{P1}(c) ⟹ has_{P2}(c)"
 *
 * # Why test the pure evaluator (not a React Hook)
 *
 * `usePermission` (task 5) will be a thin React wrapper that reads
 * `PermissionContext` via the adapter and delegates to
 * `evaluatePermission`. The semantic laws being verified here are
 * properties of the latter — there's no behaviour the Hook adds that
 * isn't already in the pure function. Testing the function directly
 * means:
 *   - no renderer (faster fast-check shrinks, deterministic counter-examples),
 *   - no mocked store (the `PermissionContext` *is* the input),
 *   - the same coverage applies to whichever of Hook / `<Auth />` / the
 *     route guard ends up calling the evaluator.
 *
 * # Generator design
 *
 * - `permSetArb`        — a `Set<string>` of known codes (the "universe of
 *                         held permissions"). We bound code shape to keep
 *                         shrinking tractable; the laws are scale-invariant
 *                         so a small, dense universe is sufficient.
 * - `codeArb`           — a string drawn from a wider alphabet so we get
 *                         a healthy mix of "in the set" and "not in the set"
 *                         queries. We DON'T constrain it to be a member of
 *                         the set: the reflexivity property must work both
 *                         ways (true and false).
 * - `modeArb`           — `'some' | 'every'`.
 * - `subsetArb`         — for the monotonicity property: given a permission
 *                         universe, generate a (possibly empty) subset to
 *                         use as the "smaller" side `P1`.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { evaluatePermission, type PermissionContext, type PermissionMode } from '../src/index.ts';

// ---------------------------------------------------------------------------
//   Generators
// ---------------------------------------------------------------------------

/**
 * Permission code alphabet. We use a narrow alphabet (lowercase a–h plus
 * a colon) so distinct generated strings are likely to collide on the
 * `codeArb`/`permSetArb` overlap, exercising both the hit and miss
 * branches with high probability. Length ≤ 6 keeps shrunk counter-examples
 * readable.
 */
const codeArb = fc.string({
  minLength: 1,
  maxLength: 6,
  unit: fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', ':'),
});

/**
 * A permission universe — a Set of known codes. Bounded at 12 to keep
 * fast-check shrinks small; the laws don't depend on scale.
 *
 * `fc.uniqueArray` on `codeArb` ensures we don't waste shrink steps on
 * duplicate elements that get collapsed by `new Set(...)` anyway.
 */
const permSetArb = fc
  .uniqueArray(codeArb, { minLength: 0, maxLength: 12 })
  .map((arr) => new Set(arr));

const modeArb: fc.Arbitrary<PermissionMode> = fc.constantFrom('some', 'every');

/**
 * An array of codes to query against. Empty arrays are deliberately
 * INCLUDED — they exercise the "vacuous truth" branch of the evaluator.
 */
const codesArrArb = fc.array(codeArb, { minLength: 0, maxLength: 8 });

/**
 * Like `codesArrArb` but with `minLength: 1` for properties that talk
 * about the per-element semantics of `'some'` / `'every'` (where the
 * empty case is handled separately).
 */
const nonEmptyCodesArrArb = fc.array(codeArb, { minLength: 1, maxLength: 8 });

/**
 * Build a context from a Set of permission codes. We pin `roles` and
 * `predicate` to undefined here so this generator exercises only the
 * default `permissions.has` path — the ABAC predicate is covered
 * separately below.
 */
function ctxOf(permissions: Set<string>): PermissionContext {
  return { permissions };
}

// ---------------------------------------------------------------------------
//   Property 1 — Reflexivity (single value)
//   has(c) ↔ permissions.has(c)
// ---------------------------------------------------------------------------

describe('evaluatePermission: single-value reflexivity (Requirement 3.4)', () => {
  it('matches `permissions.has(code)` for any string code and any permission set', () => {
    fc.assert(
      fc.property(permSetArb, codeArb, (perms, code) => {
        const ctx = ctxOf(perms);
        // Both modes default-collapse to the same thing for a single
        // string, but we sanity-check both to confirm the mode arg is
        // a no-op on string input.
        expect(evaluatePermission(ctx, code)).toBe(perms.has(code));
        expect(evaluatePermission(ctx, code, 'some')).toBe(perms.has(code));
        expect(evaluatePermission(ctx, code, 'every')).toBe(perms.has(code));
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 2 — Array + 'some' semantics
//   evaluate(P, codes, 'some') ↔ codes.some(c => P.has(c))
// ---------------------------------------------------------------------------

describe("evaluatePermission: array + 'some' semantics (Requirement 3.4)", () => {
  it('returns true iff at least one code is in the permission set', () => {
    fc.assert(
      fc.property(permSetArb, nonEmptyCodesArrArb, (perms, codes) => {
        const ctx = ctxOf(perms);
        const expected = codes.some((c) => perms.has(c));
        expect(evaluatePermission(ctx, codes, 'some')).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 3 — Array + 'every' semantics
//   evaluate(P, codes, 'every') ↔ codes.every(c => P.has(c))
// ---------------------------------------------------------------------------

describe("evaluatePermission: array + 'every' semantics (Requirement 3.4)", () => {
  it('returns true iff all codes are in the permission set', () => {
    fc.assert(
      fc.property(permSetArb, nonEmptyCodesArrArb, (perms, codes) => {
        const ctx = ctxOf(perms);
        const expected = codes.every((c) => perms.has(c));
        expect(evaluatePermission(ctx, codes, 'every')).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 4 — Empty array degenerates to true (vacuous truth)
//   evaluate(P, [], 'some') === true
//   evaluate(P, [], 'every') === true
//
//   Per the task 5.1 spec: "空数组退化为 true". We assert this for BOTH
//   modes — the requirement explicitly degenerates 'some' away from its
//   `Array.prototype.some` default (which would be false for []).
// ---------------------------------------------------------------------------

describe('evaluatePermission: empty array → true regardless of mode (task 5.1)', () => {
  it('returns true for [] under either mode, for any permission set', () => {
    fc.assert(
      fc.property(permSetArb, modeArb, (perms, mode) => {
        const ctx = ctxOf(perms);
        expect(evaluatePermission(ctx, [], mode)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 5 — Default-allow when code is undefined
//   evaluate(ctx, undefined) === true
//
//   Requirement 3.4: "IF 调用方未传 `code`（即未显式发起权限校验）
//   THEN 系统 SHALL 默认放行（返回 `true`）".
// ---------------------------------------------------------------------------

describe('evaluatePermission: default-allow on undefined code (Requirement 3.4)', () => {
  it('returns true when code is undefined, regardless of permission set or mode', () => {
    fc.assert(
      fc.property(permSetArb, modeArb, (perms, mode) => {
        const ctx = ctxOf(perms);
        // Both with and without an explicit mode arg.
        expect(evaluatePermission(ctx, undefined, mode)).toBe(true);
        expect(evaluatePermission(ctx)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 6 — Monotonicity over the permission set
//
//   ∀ P1, P2 with P1 ⊆ P2:  ∀ c, evaluate(P1, c, mode) ⟹ evaluate(P2, c, mode)
//
//   Adding permissions can only ever make `has` MORE permissive, never
//   less. This is the "growth-only" law called out in task 5.1.
//
//   # Subset construction
//
//   We generate a "universe" Set, then pick a subset of its members for
//   the smaller side. Using `fc.subarray` over the unique array form
//   guarantees `P1 ⊆ P2` by construction — fast-check doesn't have to
//   discover the relationship through filtering, which would waste runs.
//   We test for both single-string and array codes, and both modes.
// ---------------------------------------------------------------------------

describe('evaluatePermission: monotonicity in the permission set (task 5.1)', () => {
  /**
   * Joint generator: returns `(P1, P2)` with `P1 ⊆ P2` guaranteed.
   * We start from a unique-array universe (so `P2` has no duplicates),
   * pick a subarray for `P1`, and convert both to Sets.
   *
   * Using `fc.uniqueArray + fc.subarray` (rather than two independent
   * Set generators + a `fc.pre` filter) keeps every generated example
   * inside the property's precondition — no shrink budget is wasted on
   * non-subset rejections.
   */
  const subsetPairArb = fc.uniqueArray(codeArb, { minLength: 0, maxLength: 12 }).chain((universe) =>
    fc.tuple(
      fc.subarray(universe).map((arr) => new Set(arr)), // P1
      fc.constant(new Set(universe)), // P2
    ),
  );

  it('single-value: has_{P1}(c) ⟹ has_{P2}(c) when P1 ⊆ P2', () => {
    fc.assert(
      fc.property(subsetPairArb, codeArb, ([p1, p2], code) => {
        // P1 ⊆ P2 is guaranteed by the generator; assert as a sanity check.
        for (const x of p1) expect(p2.has(x)).toBe(true);

        const r1 = evaluatePermission(ctxOf(p1), code);
        const r2 = evaluatePermission(ctxOf(p2), code);
        // The implication: r1 ⟹ r2. Equivalent to "not r1 || r2".
        expect(!r1 || r2).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("array + 'some': has_{P1}(codes) ⟹ has_{P2}(codes) when P1 ⊆ P2", () => {
    fc.assert(
      fc.property(subsetPairArb, codesArrArb, ([p1, p2], codes) => {
        const r1 = evaluatePermission(ctxOf(p1), codes, 'some');
        const r2 = evaluatePermission(ctxOf(p2), codes, 'some');
        expect(!r1 || r2).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("array + 'every': has_{P1}(codes) ⟹ has_{P2}(codes) when P1 ⊆ P2", () => {
    fc.assert(
      fc.property(subsetPairArb, codesArrArb, ([p1, p2], codes) => {
        const r1 = evaluatePermission(ctxOf(p1), codes, 'every');
        const r2 = evaluatePermission(ctxOf(p2), codes, 'every');
        expect(!r1 || r2).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
