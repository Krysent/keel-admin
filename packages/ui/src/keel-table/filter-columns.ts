/**
 * `filterColumnsByPermission` — the pure permission filter that powers
 * `KeelTable`'s column visibility logic.
 *
 * **Implements: Requirement 10.2**
 *
 *   10.2 — WHEN `KeelTable` 接收的 `columns[i].permission` 不为空
 *          IF 当前用户不持有该权限
 *          THEN 系统 SHALL 在渲染前过滤掉该列
 *
 * # Why a separate pure function (not just inlined in <KeelTable>)
 *
 * The React component shipping in task 8 is a thin shell over
 * `@ant-design/pro-components`'s ProTable. The *interesting* behaviour
 * — "given a list of columns and a permission context, return only the
 * visible columns" — is purely data-in / data-out, independent of any
 * renderer. Splitting it out means:
 *
 *   - the property tests in `tests/filter-columns.pbt.test.ts` can run
 *     in node without jsdom or testing-library,
 *   - fast-check shrinks counter-examples on plain arrays (small,
 *     readable) instead of React trees,
 *   - the same logic can be reused later by other components that need
 *     "permission-gated config arrays" (`KeelDescriptions` items,
 *     `KeelForm` fields, etc.) without extracting it from a hook.
 *
 * The forthcoming `<KeelTable>` will call this function once per render
 * with `useMemo` keyed on `(columns, ctx)` to keep ProTable's column
 * identity stable.
 *
 * # Semantics (single source of truth)
 *
 * - `permission === undefined`         → render (the common, opt-in case)
 * - `permission === ''` / `[]`         → render (vacuous truth, mirrors
 *                                        the empty-array degenerate path
 *                                        in `evaluatePermission`)
 * - `permission` non-empty string      → render iff the user holds it
 * - `permission` non-empty `string[]`  → 'some' semantics by default,
 *                                        matching `<Auth code={...}>`
 *
 * The semantics are delegated to `evaluatePermission` so this filter and
 * the rest of the auth surface (`usePermission`, `<Auth />`, route guard)
 * agree by construction. If we changed the array-mode default later, both
 * call sites would move together.
 */

import { evaluatePermission, type PermissionContext } from '@keel/auth';

/**
 * Loose subset of `@ant-design/pro-components`'s `ProColumns<T>[number]`.
 *
 * We deliberately keep this open-shaped (`extra: unknown`) so callers can
 * pass full ProColumns objects (with `render`, `valueType`, etc.) without
 * needing a cast. The filter only inspects `permission`; everything else
 * is preserved by reference.
 *
 * `permission` is either:
 *   - a single permission code string (the common form), or
 *   - an array of codes (combined under 'some' semantics), or
 *   - `undefined` (no permission required).
 *
 * `readonly string[]` is accepted on input so callers can pass tuples or
 * `as const` arrays without an explicit cast.
 */
export interface KeelColumn {
  /** Permission code(s) gating this column. Optional. */
  permission?: string | readonly string[];
  /** Anything else (key, dataIndex, title, render, …) is preserved as-is. */
  [extra: string]: unknown;
}

/**
 * Filter a list of column definitions by their `permission` field.
 *
 * The output is a NEW array containing only columns the user is allowed
 * to see. Order is preserved, references to retained columns are
 * preserved, and the input array is never mutated.
 *
 * @param columns Column definitions (typically `ProColumns<T>`).
 * @param ctx     Permission context — same shape as the one consumed by
 *                `usePermission()` / `<Auth />` / `buildRoutes`.
 * @returns       A new array containing only columns that pass the
 *                permission check.
 */
export function filterColumnsByPermission<C extends KeelColumn>(
  columns: readonly C[],
  ctx: PermissionContext,
): C[] {
  // We avoid `Array.prototype.filter` on a readonly tuple to keep the
  // type narrowing straightforward (readonly arrays infer poorly here).
  const out: C[] = [];
  for (const col of columns) {
    // `permission === undefined` short-circuits to "always render", per
    // Requirement 10.2's negative case ("不为空" is the gating condition).
    // We could equivalently let `evaluatePermission(ctx, undefined)`
    // return `true`, but the explicit fast-path saves one function call
    // per column on the common path.
    if (col.permission === undefined) {
      out.push(col);
      continue;
    }
    // For string and string[] alike, defer to the shared evaluator with
    // the default 'some' semantics (matches `<Auth code={...}>`).
    if (evaluatePermission(ctx, col.permission)) {
      out.push(col);
    }
  }
  return out;
}
