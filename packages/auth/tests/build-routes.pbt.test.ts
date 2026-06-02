/**
 * Property-based tests for `buildRoutes(menus, ctx)`.
 *
 * **Validates: Requirements 3.5, 4.2, 4.6, 4.7, 4.8**
 *
 *   - 3.5 — permission filter: nodes with non-empty `permissionCodes`
 *           that share no member with `ctx.permissions` are dropped.
 *   - 4.2 — output is a `RouteObject[]` (we just rely on the type, no
 *           runtime assertion needed; structural shape is exercised
 *           by the determinism property).
 *   - 4.6 — `redirect` nodes render `<Navigate to=redirect replace />`
 *           and have no `children` even if the source MenuNode did.
 *   - 4.7 — `hidden: true` nodes still produce a route (the flag is a
 *           UI hint for the sider, not a route-generation gate).
 *   - 4.8 — `/login`, `/exception/403`, `/exception/404`, `*` always
 *           appear in the output, even for an empty `menus` input.
 *
 * Plus the explicit task-line items:
 *
 *   - "断言相同输入多次构建结构等价（确定性）" — same input → same
 *     structural output.
 *
 * # Why test the pure transform (no React renderer)
 *
 * `buildRoutes` produces React elements but the *properties* under
 * test are about the SHAPE of the route tree (paths, children,
 * element type, redirect target). We can read all of that off the
 * returned `RouteObject[]` directly — there's nothing to render, so
 * we stay in node, no jsdom, no testing-library.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { ReactElement } from 'react';

import type { MenuNode } from '@keel/types';

import { buildRoutes, STATIC_FALLBACK_PATHS } from '../src/index.js';

// ---------------------------------------------------------------------------
//   Generators
// ---------------------------------------------------------------------------

/**
 * Permission-code alphabet. Narrow on purpose: we want the user
 * permission set and the menu nodes' `permissionCodes` to overlap
 * with non-trivial probability, so the "any-hit" branch and the
 * "filtered" branch BOTH get exercised.
 *
 * Length ≤ 4 keeps shrunk counter-examples readable.
 */
const codeArb = fc.string({
  minLength: 1,
  maxLength: 4,
  unit: fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
});

/**
 * Path generator. Always begins with `/` (Requirement notes say menu
 * nodes use absolute paths). The trailing segment is small so paths
 * shrink to short, readable strings on counter-examples.
 *
 * NOTE: we deliberately allow path collisions across nodes — react-router
 * tolerates it (last match wins) and the properties under test don't
 * require uniqueness. Forcing uniqueness would shrink poorly.
 */
const pathArb = fc
  .string({ minLength: 1, maxLength: 4, unit: fc.constantFrom('a', 'b', 'c') })
  .map((s) => '/' + s);

const idArb = fc.string({ minLength: 1, maxLength: 4 });
const nameArb = fc.string({ maxLength: 4 });

/**
 * `permissionCodes` field generator. Can be:
 *   - undefined          (no permission required → always passes)
 *   - empty array        (also vacuous truth → always passes)
 *   - non-empty array    (any-hit semantics)
 *
 * We expose all three branches so the property covers the "passes
 * because empty" path AND the "passes because hit" path AND the
 * "filtered because miss" path.
 */
const permissionCodesArb = fc.option(
  fc.array(codeArb, { minLength: 0, maxLength: 3 }),
  { nil: undefined },
);

/**
 * Recursive menu-node generator using `fc.letrec` with a depth bound
 * baked into the recursion. Without a depth bound, fast-check happily
 * generates pathologically deep trees and counter-examples become
 * unreadable.
 *
 * `maxChildrenPerLevel` is intentionally small (≤2) so the total
 * forest size stays under ~20 nodes even at max depth, keeping each
 * `numRuns` cheap.
 */
const MAX_DEPTH = 3;
const MAX_CHILDREN = 2;

function menuNodeArb(depth: number): fc.Arbitrary<MenuNode> {
  // Children only generated below the depth bound. At depth 0 leaves
  // never have children, which prevents the recursion blowing up.
  const childrenArb: fc.Arbitrary<MenuNode[] | undefined> =
    depth <= 0
      ? fc.constant(undefined)
      : fc.option(fc.array(menuNodeArb(depth - 1), { maxLength: MAX_CHILDREN }), {
          nil: undefined,
        });

  // We assemble the record with `string | undefined` fields for
  // optional keys (fast-check's natural shape) and then prune the
  // `undefined` entries before returning a `MenuNode`. This keeps
  // the resulting object compatible with `exactOptionalPropertyTypes`
  // (a key is either absent or carries a defined value).
  return fc
    .record({
      id: idArb,
      title: nameArb,
      path: pathArb,
      // `redirect` is generated rarely (~25%) so most nodes still
      // exercise the component / children branch.
      redirect: fc.oneof(
        { weight: 3, arbitrary: fc.constant<string | undefined>(undefined) },
        { weight: 1, arbitrary: pathArb },
      ),
      // `hidden` cycles through undefined / true / false roughly
      // evenly, so we cover both the "hidden" code path and the
      // "not hidden" one.
      hidden: fc.option(fc.boolean(), { nil: undefined }),
      // `component` is a logical key — we never resolve it in the
      // tests below, but keeping a non-trivial value present
      // exercises the branch in `buildRoutes` that checks
      // `node.component !== undefined`.
      component: fc.option(fc.string({ maxLength: 4 }), { nil: undefined }),
      permissionCodes: permissionCodesArb,
      children: childrenArb,
    })
    .map((raw): MenuNode => {
      const node: MenuNode = { id: raw.id, title: raw.title, path: raw.path };
      if (raw.redirect !== undefined) node.redirect = raw.redirect;
      if (raw.hidden !== undefined) node.hidden = raw.hidden;
      if (raw.component !== undefined) node.component = raw.component;
      if (raw.permissionCodes !== undefined)
        node.permissionCodes = raw.permissionCodes;
      if (raw.children !== undefined) node.children = raw.children;
      return node;
    });
}

const forestArb = fc.array(menuNodeArb(MAX_DEPTH), { maxLength: 4 });

/** Permission set the user holds. Bounded for shrink readability. */
const permsArb = fc
  .uniqueArray(codeArb, { minLength: 0, maxLength: 6 })
  .map((arr) => new Set(arr));

// ---------------------------------------------------------------------------
//   Helpers
// ---------------------------------------------------------------------------

/**
 * Walk a route tree, yielding every route. Used by the closure
 * property: we need to inspect every emitted route, not just leaves
 * (a redirect node may be a non-leaf in the forest but a leaf in the
 * route tree because we don't expand its children).
 */
function* walkRoutes(routes: RouteObject[]): Generator<RouteObject> {
  for (const r of routes) {
    yield r;
    if (r.children) yield* walkRoutes(r.children);
  }
}

/**
 * Extract the source MenuNode we attached under `route.handle.menu`.
 * Returns `undefined` for the static fallback routes (which have no
 * `handle.menu` — they aren't sourced from a MenuNode).
 */
function menuOf(route: RouteObject): MenuNode | undefined {
  const handle = route.handle as { menu?: MenuNode } | undefined;
  return handle?.menu;
}

/**
 * "Does this menu node pass Requirement 3.5's filter under `perms`?"
 *
 * Definition: empty/undefined `permissionCodes` always passes; a
 * non-empty array passes iff at least one member is in `perms`.
 *
 * Defined locally (rather than re-imported from the source) so the
 * property is genuinely independent of the implementation under test.
 */
function nodePasses(node: MenuNode, perms: ReadonlySet<string>): boolean {
  const codes = node.permissionCodes;
  if (codes === undefined || codes.length === 0) return true;
  return codes.some((c) => perms.has(c));
}

/**
 * Strip a route tree down to its structural projection so we can
 * compare two builds for equality without choking on element identity.
 *
 * We retain:
 *   - `path`
 *   - `handle.menu.id` (stable identity of the source node)
 *   - `redirect` flag (`element.type === Navigate`) and the redirect target
 *   - `children` recursively
 *
 * We drop:
 *   - element identity (different across runs even for the same input)
 *   - `handle.menu` reference comparison (same input ⇒ same MenuNode
 *     reference, but we don't need to compare references — id suffices)
 */
type StructuralRoute = {
  path: string | undefined;
  menuId: string | undefined;
  redirectTo: string | undefined;
  hasElement: boolean;
  children?: StructuralRoute[];
};

function structuralOf(route: RouteObject): StructuralRoute {
  const menu = menuOf(route);
  const el = route.element as ReactElement | null | undefined;
  const isNavigate =
    el !== null && el !== undefined && el.type === Navigate;
  const redirectTo = isNavigate
    ? ((el!.props as { to?: string }).to ?? undefined)
    : undefined;

  const out: StructuralRoute = {
    path: route.path,
    menuId: menu?.id,
    redirectTo,
    hasElement: route.element !== undefined && route.element !== null,
  };
  if (route.children) {
    out.children = route.children.map(structuralOf);
  }
  return out;
}

function structuralTreeOf(routes: RouteObject[]): StructuralRoute[] {
  return routes.map(structuralOf);
}

// ---------------------------------------------------------------------------
//   Property 1 — Permission closure (Requirement 3.5)
// ---------------------------------------------------------------------------

describe('buildRoutes: permission closure (Requirement 3.5)', () => {
  it('every emitted MenuNode-backed route passes the permission check', () => {
    fc.assert(
      fc.property(forestArb, permsArb, (menus, perms) => {
        const routes = buildRoutes(menus, { permissions: perms });

        for (const r of walkRoutes(routes)) {
          const m = menuOf(r);
          // Static fallbacks have no menu handle — skip them; they're
          // covered by Property 2.
          if (m === undefined) continue;
          expect(nodePasses(m, perms)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 2 — Static fallbacks always present (Requirement 4.8)
// ---------------------------------------------------------------------------

describe('buildRoutes: static fallbacks always emitted (Requirement 4.8)', () => {
  it('output contains /login, /exception/403, /exception/404, * for every input', () => {
    fc.assert(
      fc.property(forestArb, permsArb, (menus, perms) => {
        const routes = buildRoutes(menus, { permissions: perms });
        const topLevelPaths = new Set(routes.map((r) => r.path));
        for (const fallback of STATIC_FALLBACK_PATHS) {
          expect(topLevelPaths.has(fallback)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('emits the four fallbacks even when menus is empty', () => {
    const routes = buildRoutes([], { permissions: new Set() });
    const paths = routes.map((r) => r.path);
    for (const fallback of STATIC_FALLBACK_PATHS) {
      expect(paths).toContain(fallback);
    }
  });
});

// ---------------------------------------------------------------------------
//   Property 3 — Determinism (task line "确定性")
// ---------------------------------------------------------------------------

describe('buildRoutes: determinism (task 5.2)', () => {
  it('two builds of the same input produce structurally equivalent output', () => {
    fc.assert(
      fc.property(forestArb, permsArb, (menus, perms) => {
        const ctx = { permissions: perms };
        const a = buildRoutes(menus, ctx);
        const b = buildRoutes(menus, ctx);
        expect(structuralTreeOf(a)).toStrictEqual(structuralTreeOf(b));
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 4 — Redirect handling (Requirement 4.6)
// ---------------------------------------------------------------------------

describe('buildRoutes: redirect nodes (Requirement 4.6)', () => {
  it('a node with redirect emits a Navigate element and no children', () => {
    fc.assert(
      fc.property(forestArb, permsArb, (menus, perms) => {
        const routes = buildRoutes(menus, { permissions: perms });

        for (const r of walkRoutes(routes)) {
          const m = menuOf(r);
          if (m === undefined) continue;
          if (m.redirect === undefined) continue;

          const el = r.element as ReactElement | null | undefined;
          // Element MUST be a Navigate element pointing at the
          // node's redirect target.
          expect(el).toBeTruthy();
          expect(el!.type).toBe(Navigate);
          expect((el!.props as { to: string }).to).toBe(m.redirect);
          expect((el!.props as { replace?: boolean }).replace).toBe(true);

          // Redirect supersedes children — even if the source MenuNode
          // had a `children` array, the route MUST NOT enumerate them
          // (Algorithm 2 from design.md).
          expect(r.children).toBeUndefined();
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
//   Property 5 — Hidden nodes still produce routes (Requirement 4.7)
// ---------------------------------------------------------------------------

describe('buildRoutes: hidden nodes (Requirement 4.7)', () => {
  it('a hidden node that passes the permission check still appears in the output', () => {
    fc.assert(
      fc.property(forestArb, permsArb, (menus, perms) => {
        const routes = buildRoutes(menus, { permissions: perms });
        const emittedMenuIds = new Set<string>();
        for (const r of walkRoutes(routes)) {
          const m = menuOf(r);
          if (m !== undefined) emittedMenuIds.add(m.id);
        }

        // Walk the source forest; for any hidden node whose ENTIRE
        // ancestor chain (including itself) passes the permission
        // check, its id MUST be in the emitted set. We need the
        // ancestor-chain check because Requirement 3.5 drops the
        // whole subtree of a filtered parent — that takes precedence
        // over Requirement 4.7's "still emit hidden routes" rule.
        function check(nodes: MenuNode[], ancestorsOk: boolean): void {
          for (const n of nodes) {
            const selfOk = ancestorsOk && nodePasses(n, perms);
            if (selfOk && n.hidden === true) {
              expect(emittedMenuIds.has(n.id)).toBe(true);
            }
            // A redirect node's children are dropped by buildRoutes,
            // so we shouldn't expect their ids in the emitted set
            // even if they're hidden.
            if (n.redirect === undefined && n.children) {
              check(n.children, selfOk);
            }
          }
        }
        check(menus, true);
      }),
      { numRuns: 200 },
    );
  });
});
