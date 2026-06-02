/**
 * Public types for `@keel/auth`.
 *
 * The permission mechanism is intentionally framework-agnostic at this
 * layer — `PermissionContext` is just a plain bag of `Set<string>` plus
 * an optional ABAC-style predicate. The React-bound surface (task 5)
 * adapts this contract via `AuthAdapter.useContext`.
 *
 * Kept in a separate module so `evaluate.ts` (the pure function exercised
 * by task 5.1's PBT) can pull only the type shapes without dragging React.
 */

/**
 * Permission codes a caller can ask `evaluatePermission` about.
 *
 * - `string`  → "do I have this single code?"
 * - `string[]` → "do I have all/any of these codes?" (combined with `mode`)
 *
 * `readonly string[]` is accepted on input so callers can pass tuples and
 * `as const` literal arrays without an explicit cast.
 */
export type PermissionCode = string | readonly string[];

/**
 * How an array of permission codes is collapsed into a single boolean.
 *
 * - `'some'`  → at least one code is held (default; matches Requirement 3.4)
 * - `'every'` → all codes are held
 *
 * The empty-array case is handled outside the mode collapse: it always
 * resolves to `true` (vacuous truth — see comments in `evaluatePermission`).
 */
export type PermissionMode = 'some' | 'every';

/**
 * The data the evaluator reads when judging a permission code.
 *
 * Shape matches the design doc's "@keel/auth boundary" section:
 *   - `permissions` — RBAC-style code set (the primary input)
 *   - `roles`       — optional, used by the React `hasRole` helper later
 *   - `predicate`   — ABAC escape hatch; if present, it fully replaces the
 *                     default `permissions.has(code)` check, including any
 *                     mode-collapse logic at the per-element level
 *                     (each individual code passes through the predicate).
 */
export interface PermissionContext {
  permissions: ReadonlySet<string>;
  roles?: ReadonlySet<string>;
  predicate?: (code: string, ctx: PermissionContext) => boolean;
}

/**
 * Adapter the business app provides to bridge its store into the
 * permission mechanism. Used by `createAuth` (task 5); declared here
 * so the contract is anchored next to `PermissionContext`.
 */
export interface AuthAdapter {
  /** Read the current permission context (typically a Zustand selector). */
  useContext: () => PermissionContext;
}
