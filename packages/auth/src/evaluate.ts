import type { PermissionCode, PermissionContext, PermissionMode } from './types.ts';

/**
 * Pure permission evaluator — the semantic core of `usePermission().has(...)`.
 *
 * Implements **Requirement 3.4** in full:
 *
 *   1. `code === undefined` → `true` (default-allow when no check is asked).
 *   2. `code` is a string   → `permissions.has(code)` (or `predicate(code, ctx)`
 *                              if a custom predicate was provided).
 *   3. `code` is an array, length === 0 → `true` (vacuous truth: no checks
 *      means nothing failed). This matches the task 5.1 spec line "空数组
 *      退化为 true" and aligns with `Array.prototype.every`'s vacuous-truth
 *      semantics. `'some'` over an empty array would normally be `false`,
 *      but the requirement explicitly degenerates BOTH modes to `true` for
 *      the empty-array case so callers don't have to special-case it.
 *   4. `code` is an array, mode === 'some'  → `code.some(check)`.
 *   5. `code` is an array, mode === 'every' → `code.every(check)`.
 *
 * # ABAC predicate hook (Requirement 3.6)
 *
 * If `ctx.predicate` is set, `check(c)` defers to it on a per-element basis:
 * the predicate sees the same code+ctx the default check would, and its
 * boolean result drives the rest of the evaluator unchanged. This means a
 * predicate that returns `true` for "ALL but never NONE" is observable
 * through `mode='every'` vs `'some'` exactly the same way the default
 * `permissions.has` check is.
 *
 * # Determinism / immutability
 *
 * The function is referentially transparent over its inputs:
 *   - It does not read or mutate any module-level state.
 *   - It does not mutate `ctx`, `code`, or any contained set.
 *   - For the same `(ctx, code, mode)` it always returns the same boolean
 *     (assuming `ctx.predicate` is itself pure).
 *
 * This is what lets the PBTs in `tests/use-permission.pbt.test.ts` make
 * universal claims (reflexivity, monotonicity, etc.) cheaply — there's
 * nothing to mock or reset between runs.
 */
export function evaluatePermission(
  ctx: PermissionContext,
  code?: PermissionCode,
  mode: PermissionMode = 'some',
): boolean {
  // (1) Default-allow when no code is provided.
  //
  // The requirement is "IF 调用方未传 `code`（即未显式发起权限校验）
  // THEN 系统 SHALL 默认放行（返回 `true`）". We check `=== undefined`
  // (not `!code`) so an explicit empty string is treated as a real code
  // and falls through to the per-element check, where it'll fail unless
  // the user actually has a permission named "" — which is a question
  // for the caller to answer, not the evaluator.
  if (code === undefined) return true;

  // The per-element predicate. `ctx.predicate` (if any) wins over the
  // default `permissions.has` check; this is the ABAC extension point.
  // We arrow-bind `ctx` in once so each call site below stays readable.
  const check = (c: string): boolean =>
    ctx.predicate !== undefined ? ctx.predicate(c, ctx) : ctx.permissions.has(c);

  // (2) Single string — the most common case in business code.
  if (typeof code === 'string') return check(code);

  // (3) Empty array — vacuous truth, regardless of mode.
  //
  // We handle this before dispatching on mode because `Array.prototype.some`
  // would return `false` for `[]` (no element to satisfy the predicate),
  // which contradicts the requirement. Bailing out early also dodges the
  // (cheap) `mode` comparison.
  if (code.length === 0) return true;

  // (4) / (5) — Mode-driven array collapse.
  //
  // We compare `mode === 'every'` rather than switching on `mode === 'some'`
  // so the default branch is `'some'`, matching the parameter default.
  return mode === 'every' ? code.every(check) : code.some(check);
}
