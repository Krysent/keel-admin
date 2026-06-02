/**
 * Property-based tests for `filterColumnsByPermission(columns, ctx)`.
 *
 * **Validates: Requirement 10.2**
 *
 *   10.2 — WHEN `KeelTable` 接收的 `columns[i].permission` 不为空
 *          IF 当前用户不持有该权限
 *          THEN 系统 SHALL 在渲染前过滤掉该列
 *
 * Plus the explicit task-line items from 8.1:
 *
 *   - "列 `permission` 不存在时必渲染"
 *   - "存在时当且仅当权限命中时渲染"
 *
 * # Why test the pure filter (no React renderer)
 *
 * `KeelTable` (task 8) will be a thin wrapper over ProTable that calls
 * `filterColumnsByPermission` once per render. The properties under test
 * are about the SHAPE of the filtered array (which columns survived,
 * in what order), not about ProTable's rendering. Testing the pure
 * function directly means:
 *
 *   - no DOM (faster fast-check shrinks, deterministic counter-examples),
 *   - no ProTable mock (the column array IS the input),
 *   - the same coverage applies to whichever component ends up calling
 *     the filter (KeelTable / KeelDescriptions / KeelForm).
 *
 * # Generator design
 *
 * - `codeArb`         — narrow alphabet so user permissions and column
 *                       requirements collide with non-trivial probability,
 *                       exercising both the hit and miss branches.
 * - `permissionArb`   — three-way: undefined (no gate), single string,
 *                       or string[] (combined under 'some' semantics).
 *                       Covers Requirement 10.2's positive AND negative
 *                       cases.
 * - `columnArb`       — a minimal-but-realistic column object. Includes
 *                       a stable `key` so we can compare output by
 *                       identity (Property 3 — order preservation).
 * - `permsCtxArb`     — a `PermissionContext` with a `Set<string>` of
 *                       held codes. Bounded for shrink readability.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { evaluatePermission, type PermissionContext } from '@keel/auth';

import {
  filterColumnsByPermission,
  type KeelColumn,
} from '../src/index.js';

// ---------------------------------------------------------------------------
//   Generators
// ---------------------------------------------------------------------------

/**
 * Permission-code alphabet. Narrow on purpose: we want the user
 * permission set and the columns' `permission` requirements to overlap
 * with non-trivial probability so the "any-hit" branch and the
 * "filtered" branch BOTH get exercised. Length ≤ 4 keeps shrunk
 * counter-examples readable.
 */
const codeArb = fc.string({
  minLength: 1,
  maxLength: 4,
  unit: fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
});

/**
 * Column-permission generator. Three branches:
 *
 *   - `undefined`        → "no gate" (Requirement 10.2 negative case)
 *   - `string`           → single code (the common business form)
 *   - `string[]`         → multi-code, 'some' semantics
 *
 * The empty-string and empty-array cases are explicitly INCLUDED in the
 * `string`/`string[]` branches because they exercise the vacuous-truth
 * paths in the underlying `evaluatePermission`.
 */
const permissionArb: fc.Arbitrary<KeelColumn['permission']> = fc.oneof(
  // ~⅓ no gate
  fc.constant<string | readonly string[] | undefined>(undefined),
  // ~⅓ single code (incl. '' which is technically a code, see below)
  codeArb,
  // ~⅓ array of codes (incl. [] for vacuous truth)
  fc.array(codeArb, { minLength: 0, maxLength: 4 }),
);

/**
 * Column generator. The `key` is unique-per-run so we can identify
 * survivors when checking order preservation. Other fields are kept
 * minimal — the filter only reads `permission`, so loading up extra
 * fields would just slow shrinks down without exercising new code.
 */
type TestColumn = KeelColumn & { key: string; title: string };

const columnArb: fc.Arbitrary<TestColumn> = fc
  .record({
    key: fc.string({ minLength: 1, maxLength: 6 }),
    title: fc.string({ maxLength: 8 }),
    permission: permissionArb,
  })
  .map((raw): TestColumn => {
    const col: TestColumn = { key: raw.key, title: raw.title };
    if (raw.permission !== undefined) col.permission = raw.permission;
    return col;
  });

/**
 * Column-array generator. We DON'T enforce uniqueness on `key` — duplicate
 * keys are valid input and the filter must handle them identically (it
 * doesn't deduplicate). Bounded at 8 columns to keep counter-examples
 * compact.
 */
const columnsArb = fc.array(columnArb, { maxLength: 8 });

/** Permission set the user holds. Bounded for shrink readability. */
const permsArb = fc
  .uniqueArray(codeArb, { minLength: 0, maxLength: 6 })
  .map((arr) => new Set(arr));

/** A `PermissionContext` built from a permission set. No predicate. */
function ctxOf(perms: Set<string>): PermissionContext {
  return { permissions: perms };
}

/**
 * Joint generator: returns `(P1, P2)` with `P1 ⊆ P2` guaranteed.
 *
 * Used by Property 5 (monotonicity). We start from a unique-array
 * universe (so `P2` has no duplicates), pick a subarray for `P1`, and
 * convert both to Sets. Using `fc.subarray` rather than two independent
 * `permsArb`s + `fc.pre(P1.isSubsetOf(P2))` keeps every generated
 * example inside the precondition — no shrink budget is wasted on
 * non-subset rejections.
 */
const subsetPermsArb = fc
  .uniqueArray(codeArb, { minLength: 0, maxLength: 6 })
  .chain((universe) =>
    fc.tuple(
      fc.subarray(universe).map((arr) => new Set(arr)), // P1
      fc.constant(new Set(universe)), // P2
    ),
  );

// ---------------------------------------------------------------------------
//   Property 1 — `permission === undefined` always renders
//
//   Task 8.1 line: "列 `permission` 不存在时必渲染"
//
//   Stronger form: filtering an array where EVERY column has no
//   permission yields the input unchanged (same length, same identities,
//   same order). We assert identity-equality so any future "always
//   clone" defensive copy doesn't sneak in unnoticed (the function may
//   return a new array, but the column refs must be reused).
// ---------------------------------------------------------------------------

describe('filterColumnsByPermission: permission undefined → always rendered (Requirement 10.2)', () => {
  /** Column generator restricted to the no-permission branch. */
  const noPermColumnArb: fc.Arbitrary<TestColumn> = fc
    .record({
      key: fc.string({ minLength: 1, maxLength: 6 }),
      title: fc.string({ maxLength: 8 }),
    })
    .map((r) => ({ key: r.key, title: r.title }));

  const noPermColumnsArb = fc.array(noPermColumnArb, { maxLength: 8 });

  it('returns every column when none has a permission gate', () => {
    fc.assert(
      fc.property(noPermColumnsArb, permsArb, (cols, perms) => {
        const out = filterColumnsByPermission(cols, ctxOf(perms));
        expect(out).toHaveLength(cols.length);
        // Identity preservation: surviving columns are the SAME refs.
        for (let i = 0; i < cols.length; i++) {
          expect(out[i]).toBe(cols[i]);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 2 — Iff law (the core of Requirement 10.2)
//
//   "存在时当且仅当权限命中时渲染"
//
//   For every input column, the column appears in the output IFF either
//   - its `permission` is undefined, OR
//   - `evaluatePermission(ctx, permission)` is true.
//
//   We tag each generated column with a unique `id` so we can identify
//   it in the output even when other fields collide.
// ---------------------------------------------------------------------------

describe('filterColumnsByPermission: column kept iff permission is undefined or hits (Requirement 10.2)', () => {
  // Tag-id generator — uniquified per array via `fc.uniqueArray` below
  // so we can identify each column by reference comparison.
  const idColumnArb: fc.Arbitrary<TestColumn & { __id: number }> = fc
    .record({
      key: fc.string({ minLength: 1, maxLength: 6 }),
      title: fc.string({ maxLength: 8 }),
      permission: permissionArb,
    })
    .map((raw) => {
      const col = {
        key: raw.key,
        title: raw.title,
        // We assign __id in the array generator below; placeholder here.
        __id: -1,
      } as TestColumn & { __id: number };
      if (raw.permission !== undefined) col.permission = raw.permission;
      return col;
    });

  const idColumnsArb = fc
    .array(idColumnArb, { maxLength: 8 })
    .map((arr) => arr.map((c, i) => ({ ...c, __id: i })));

  it('output contains a column iff (no permission) || evaluatePermission(ctx, permission)', () => {
    fc.assert(
      fc.property(idColumnsArb, permsArb, (cols, perms) => {
        const ctx = ctxOf(perms);
        const out = filterColumnsByPermission(cols, ctx);

        // Build the expected survivor set by id, computed independently
        // from `evaluatePermission` (the single source of truth for
        // permission semantics — see filter-columns.ts).
        const expectedIds = new Set<number>();
        for (const c of cols) {
          const passes =
            c.permission === undefined ||
            evaluatePermission(ctx, c.permission);
          if (passes) expectedIds.add(c.__id);
        }

        const actualIds = new Set(out.map((c) => c.__id));
        expect(actualIds).toStrictEqual(expectedIds);
      }),
      { numRuns: 300 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 3 — Order preservation
//
//   The filter SHOULD remove columns, never reorder them. Stated as:
//   the output is a (length-decreasing, possibly empty) subsequence of
//   the input that preserves relative order.
//
//   We verify this by extracting the indices of survivors (by reference)
//   and asserting they're strictly increasing.
// ---------------------------------------------------------------------------

describe('filterColumnsByPermission: order preservation (task 8.1)', () => {
  it('output is a subsequence of the input — relative order intact', () => {
    fc.assert(
      fc.property(columnsArb, permsArb, (cols, perms) => {
        const out = filterColumnsByPermission(cols, ctxOf(perms));

        // For each survivor, find its position in the input. Since
        // duplicate column references are vanishingly unlikely with
        // `fc.record` (each call mints a fresh object), this is unique.
        const indices: number[] = [];
        for (const c of out) {
          const idx = cols.indexOf(c);
          expect(idx).toBeGreaterThanOrEqual(0); // survivor came from input
          indices.push(idx);
        }

        // Strictly increasing ⇔ same relative order, no duplicates.
        for (let i = 1; i < indices.length; i++) {
          expect(indices[i]!).toBeGreaterThan(indices[i - 1]!);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 4 — Idempotence
//
//   filter(filter(cols, ctx), ctx) === filter(cols, ctx) (structurally)
//
//   Filtering an already-filtered array under the SAME context is a
//   no-op: every survivor of the first pass passes again. This is a
//   useful invariant for callers that re-filter on every render — they
//   can be sure repeated application doesn't drop additional columns.
//
//   We assert structural equality on `__id` arrays (cheaper than
//   deep-equal on full column objects, and refs are preserved anyway).
// ---------------------------------------------------------------------------

describe('filterColumnsByPermission: idempotence (task 8.1)', () => {
  it('filter(filter(cols, ctx), ctx) === filter(cols, ctx)', () => {
    fc.assert(
      fc.property(columnsArb, permsArb, (cols, perms) => {
        const ctx = ctxOf(perms);
        const once = filterColumnsByPermission(cols, ctx);
        const twice = filterColumnsByPermission(once, ctx);
        expect(twice).toStrictEqual(once);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 5 — Monotonicity over the permission set
//
//   ∀ P1 ⊆ P2:  filter(cols, P1) ⊆ filter(cols, P2)
//
//   Adding permissions can only ever ADD survivors, never drop them.
//   This is the visibility analog of `evaluatePermission`'s monotonicity
//   law (already PBT'd in `@keel/auth`) — restated for the filter so we
//   catch any future regression in this layer specifically.
//
//   We compare by reference (column identity), since the filter must
//   preserve refs.
// ---------------------------------------------------------------------------

describe('filterColumnsByPermission: monotonicity in the permission set (task 8.1)', () => {
  it('P1 ⊆ P2 ⟹ survivors_{P1} ⊆ survivors_{P2}', () => {
    fc.assert(
      fc.property(columnsArb, subsetPermsArb, (cols, [p1, p2]) => {
        // Sanity-check the precondition (cheap; prevents silent errors
        // if `subsetPermsArb` ever drifts).
        for (const x of p1) expect(p2.has(x)).toBe(true);

        const survivors1 = new Set(
          filterColumnsByPermission(cols, ctxOf(p1)),
        );
        const survivors2 = new Set(
          filterColumnsByPermission(cols, ctxOf(p2)),
        );

        for (const c of survivors1) {
          expect(survivors2.has(c)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 6 — Empty input degenerates to empty output
//
//   filter([], ctx) === [] for every ctx. A degenerate boundary case
//   that's cheap to guarantee and useful as a smoke test for callers
//   that conditionally render based on `cols.length`.
// ---------------------------------------------------------------------------

describe('filterColumnsByPermission: empty input → empty output (task 8.1)', () => {
  it('returns an empty array for an empty input regardless of context', () => {
    fc.assert(
      fc.property(permsArb, (perms) => {
        const out = filterColumnsByPermission([], ctxOf(perms));
        expect(out).toStrictEqual([]);
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 7 — Input is never mutated
//
//   The filter is pure with respect to its arguments. We verify by
//   snapshotting the input array's length and per-element refs before
//   and after the call — neither should change.
// ---------------------------------------------------------------------------

describe('filterColumnsByPermission: input is not mutated (task 8.1)', () => {
  it('does not mutate the input columns array or its members', () => {
    fc.assert(
      fc.property(columnsArb, permsArb, (cols, perms) => {
        const before = [...cols]; // shallow snapshot of refs
        filterColumnsByPermission(cols, ctxOf(perms));
        expect(cols).toHaveLength(before.length);
        for (let i = 0; i < before.length; i++) {
          expect(cols[i]).toBe(before[i]);
        }
      }),
      { numRuns: 100 },
    );
  });
});
