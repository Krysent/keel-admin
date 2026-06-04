/**
 * Menu tree → React Router v6 `RouteObject[]` transform.
 *
 * Implements Algorithm 2 from `design.md` and the EARS clauses:
 *
 *   - **3.5** Permission filter — drop a node when its `permissionCodes`
 *             is non-empty and shares no member with `ctx.permissions`.
 *   - **4.2** Output shape — `RouteObject[]` from `react-router-dom` v6.
 *   - **4.6** `redirect` nodes render `<Navigate to=redirect replace />`
 *             instead of loading a component (and never expand children —
 *             a Navigate redirect supersedes any nested layout).
 *   - **4.7** `hidden: true` does NOT skip the route — it only suppresses
 *             the sider rendering, which is a UI concern handled by the
 *             layout. The route is still emitted here.
 *   - **4.8** Static fallbacks `/login`, `/exception/403`, `/exception/404`,
 *             `*` are ALWAYS appended to the root call, even when `menus`
 *             is empty.
 *
 * # Determinism
 *
 * The transform is referentially transparent over `(menus, ctx)`:
 *   - Same input → same output structure (paths, children shape,
 *     `handle.menu` refs are stable across calls).
 *   - Element values may differ across calls because `React.createElement`
 *     produces fresh element objects, but their `type` / `props` are
 *     identical — the determinism property in the PBT compares the
 *     structural projection rather than element identity.
 *
 * # Why `handle.menu`
 *
 * The transform attaches the source `MenuNode` reference under
 * `route.handle.menu`. This gives downstream code (breadcrumbs, tabs,
 * permission re-checks, the PBT in `tests/build-routes.pbt.test.ts`)
 * a way to recover the originating menu node from a matched route
 * without re-walking the tree.
 */

import { createElement } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

import { evaluatePermission } from './evaluate.ts';

import type { PermissionContext } from './types.ts';
import type { MenuNode } from '@keel/types';

/**
 * The four required fallback paths. Listed here as a `readonly` tuple so
 * the test (and any consumer wanting to override) can iterate over the
 * canonical list without hard-coding strings in two places.
 */
export const STATIC_FALLBACK_PATHS = ['/login', '/exception/403', '/exception/404', '*'] as const;

export type StaticFallbackPath = (typeof STATIC_FALLBACK_PATHS)[number];

/**
 * Context object passed to `buildRoutes`.
 *
 * Designed so the *mechanism* (this file) stays decoupled from the
 * *data* (page modules, login/error pages live in `apps/admin`).
 *
 * - `permissions`        — RBAC code set used by Requirement 3.5's filter.
 * - `predicate`          — optional ABAC escape hatch, forwarded into
 *                          `evaluatePermission` so the same predicate that
 *                          governs `usePermission().has(...)` also drives
 *                          route filtering. (Requirement 3.6)
 * - `resolveComponent`   — turns a `MenuNode.component` logical key into
 *                          a route element. Returning `null` means the
 *                          page didn't resolve (caller decides UX).
 * - `guard`              — optional wrapper applied to component-bearing
 *                          routes (e.g. `<AuthGuard codes>`). Skipped for
 *                          redirect nodes since the redirect is the entire
 *                          render output.
 * - `fallbackElements`   — overrides for the four required fallback paths.
 *                          Keys not provided default to `null` (renders
 *                          nothing) — the PBT only cares the four paths
 *                          exist, while `apps/admin` will inject real
 *                          login / 403 / 404 / NotFound components.
 */
export interface BuildRoutesContext {
  permissions: ReadonlySet<string>;
  predicate?: PermissionContext['predicate'];
  resolveComponent?: (componentKey: string) => RouteObject['element'] | null;
  guard?: (
    element: RouteObject['element'],
    permissionCodes?: readonly string[],
  ) => RouteObject['element'];
  fallbackElements?: Partial<Record<StaticFallbackPath, RouteObject['element']>>;
}

/**
 * `evaluatePermission` over a single MenuNode's `permissionCodes`.
 *
 * - Empty / undefined `permissionCodes` → vacuous truth (always passes).
 * - Non-empty array → `'some'` semantics (any-hit) per Requirement 3.5
 *   ("无任一命中权限码的节点" is filtered).
 *
 * We thread `predicate` through so route filtering and `<Auth>` checks
 * agree on what "having a code" means in ABAC mode.
 */
function passesPermission(node: MenuNode, ctx: BuildRoutesContext): boolean {
  // Build the PermissionContext narrowly so `exactOptionalPropertyTypes`
  // doesn't object to `predicate: undefined` on a property whose type
  // is "function only" (vs "function | undefined"). Same rule applies
  // for `roles` — only set keys when we have a value.
  const permCtx: PermissionContext =
    ctx.predicate !== undefined
      ? { permissions: ctx.permissions, predicate: ctx.predicate }
      : { permissions: ctx.permissions };
  return evaluatePermission(permCtx, node.permissionCodes, 'some');
}

/**
 * Recursive worker. The `isRoot` flag lets us append static fallbacks
 * exactly once, at the top of the recursion tree.
 *
 * Loop invariant: every entry in `out` is a route whose source
 * `MenuNode` passed the permission check at the time of insertion.
 */
function buildRecursive(
  menus: MenuNode[],
  ctx: BuildRoutesContext,
  isRoot: boolean,
): RouteObject[] {
  const out: RouteObject[] = [];

  for (const node of menus) {
    // Requirement 3.5 — permission gate. Drop the entire subtree when
    // a parent fails; the spec phrasing is "无任一命中权限码的节点 [...]
    // 过滤掉", which targets the node itself, and the absence of a parent
    // route makes its children unreachable in any reasonable router setup
    // anyway.
    if (!passesPermission(node, ctx)) continue;

    const route: RouteObject = {
      path: node.path,
      // Stash the originating MenuNode so consumers (breadcrumb, tabs,
      // PBT) can recover it without re-walking. The reference is stable
      // across multiple `buildRoutes` calls with the same input — that's
      // the basis of the determinism property.
      handle: { menu: node },
    };

    if (node.redirect !== undefined) {
      // Requirement 4.6 — redirect supersedes component AND children.
      // We use `createElement(Navigate, {...})` (not JSX) so this file
      // can stay `.ts` instead of `.tsx`; the resulting element is
      // identical to `<Navigate to={...} replace />`.
      route.element = createElement(Navigate, {
        to: node.redirect,
        replace: true,
      });
    } else {
      // Component-bearing path — only set `element` if we can actually
      // resolve something, so the consumer can distinguish "no component
      // configured" from "component failed to resolve".
      if (node.component !== undefined && ctx.resolveComponent) {
        const element = ctx.resolveComponent(node.component) ?? null;
        route.element = ctx.guard ? ctx.guard(element, node.permissionCodes) : element;
      }

      // Requirement 4.7 — `hidden` is a UI concern; we still recurse and
      // emit the route so the URL keeps working even though the sider
      // doesn't show it. No special branch needed here: `hidden` simply
      // does not affect route generation.
      if (node.children !== undefined && node.children.length > 0) {
        route.children = buildRecursive(node.children, ctx, false);
      }
    }

    out.push(route);
  }

  if (isRoot) {
    // Requirement 4.8 — append the four fallback routes unconditionally.
    // Order matches the requirement listing; the catch-all `*` goes last
    // so React Router's matching prefers the more specific paths.
    for (const path of STATIC_FALLBACK_PATHS) {
      out.push({
        path,
        element: ctx.fallbackElements?.[path] ?? null,
      });
    }
  }

  return out;
}

/**
 * Transform a backend menu forest into a React Router v6 route table.
 *
 * Always returns a non-empty array containing at minimum the four
 * static fallback routes (Requirement 4.8). Pure: no side effects on
 * `menus`, `ctx`, or any contained set.
 */
export function buildRoutes(menus: MenuNode[], ctx: BuildRoutesContext): RouteObject[] {
  return buildRecursive(menus, ctx, true);
}
