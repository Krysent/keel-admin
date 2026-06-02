/**
 * Lazy page loader factory backed by `import.meta.glob`.
 *
 * Implements the loader half of Requirement 4.1 ("登录后由后端菜单驱动
 * 动态路由"), Requirement 17.3 (Suspense fallback for protected routes)
 * and Requirement 19.1 (route-level lazy loading). Specifically the
 * task 9.4 line item:
 *
 *   > pages/_async.ts：基于 `import.meta.glob('/src/pages/\*\*\/\*.tsx')` 的
 *   > 懒加载工厂
 *
 * # Contract
 *
 * `MenuNode.component` carries a logical key like `'system/user'` or
 * `'system/user/index'`. `resolveLazyPage(key)` returns either:
 *
 *   - a `LazyExoticComponent` ready to render under `<Suspense>`, OR
 *   - `null` when no module matches the key.
 *
 * The match rules are deliberately forgiving so the menu seed (a
 * backend concern) doesn't have to mirror our on-disk layout exactly:
 *
 *   1. Exact match: `<key>.tsx`
 *   2. Index match: `<key>/index.tsx`
 *
 * Rule precedence is "exact wins"; this keeps the resolver
 * deterministic when both files happen to exist.
 *
 * # Why a tiny in-memory cache
 *
 * `React.lazy` itself memoizes the import promise, but it does so per
 * `lazy(...)` call. Calling `resolveLazyPage('system/user')` from two
 * different routes would otherwise produce two separate `LazyExotic`
 * components, causing a duplicate fetch on the second navigation.
 * Caching the lazy component by key collapses that down to one fetch
 * shared across every consumer.
 *
 * The cache is process-local (no globals reach into it from outside)
 * and never grows beyond the number of distinct page modules in the
 * bundle, so we don't bother with eviction.
 *
 * # Test seam
 *
 * The factory accepts an optional `modules` map so tests can drive it
 * with stub loaders. Production code calls `resolveLazyPage(key)` which
 * uses the default glob.
 */

import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

/**
 * Result of `import.meta.glob(...)` for the `pages` tree, narrowed to
 * the lazy form. Each value is a thunk that returns `{ default: Page }`.
 */
export type PageModulesMap = Record<
  string,
  () => Promise<{ default: ComponentType<unknown> }>
>;

/**
 * Default module map. Vite walks the file system at build time and
 * inlines this expression into a static object whose keys are the
 * matched paths, e.g.
 *   `'/src/pages/system/user/index.tsx': () => import('./system/user/index.tsx')`.
 *
 * In a test environment without Vite, `import.meta.glob` may be
 * undefined; the factory below handles that by accepting a custom
 * `modules` argument.
 */
function defaultModules(): PageModulesMap {
  // `import.meta.glob` is only present under Vite. The optional-chain
  // keeps the file evaluable in plain Node (Vitest with no Vite plugin).
  const glob = (
    import.meta as unknown as { glob?: ImportMeta['glob'] }
  ).glob;
  if (!glob) return {};
  return glob('/src/pages/**/*.tsx') as PageModulesMap;
}

/** Cache of `key -> LazyExoticComponent` to dedupe across consumers. */
const lazyCache = new WeakMap<PageModulesMap, Map<string, LazyExoticComponent<ComponentType<unknown>>>>();

function getCache(modules: PageModulesMap): Map<string, LazyExoticComponent<ComponentType<unknown>>> {
  let cache = lazyCache.get(modules);
  if (!cache) {
    cache = new Map();
    lazyCache.set(modules, cache);
  }
  return cache;
}

/**
 * Build the two candidate paths a `MenuNode.component` key can map to.
 *
 * Exposed for testing — the resolver itself is the public surface.
 */
export function candidatePathsFor(componentKey: string): readonly string[] {
  // Strip leading slashes the menu authors might add by accident; the
  // glob keys always start with `/src/pages/`.
  const trimmed = componentKey.replace(/^\/+/, '');
  return [
    `/src/pages/${trimmed}.tsx`,
    `/src/pages/${trimmed}/index.tsx`,
  ];
}

/**
 * Internal lookup. Pure, no `lazy()` involved — easy to unit test.
 *
 * Returns the matched glob key (so tests can assert which rule fired)
 * or `null` when neither candidate exists.
 */
export function lookupPagePath(
  modules: PageModulesMap,
  componentKey: string,
): string | null {
  for (const candidate of candidatePathsFor(componentKey)) {
    if (Object.prototype.hasOwnProperty.call(modules, candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Build a factory bound to a specific `modules` map. Production code
 * uses the default-bound `resolveLazyPage` below; tests inject their
 * own map.
 */
export function createLazyPageResolver(
  modules: PageModulesMap = defaultModules(),
): (componentKey: string) => LazyExoticComponent<ComponentType<unknown>> | null {
  const cache = getCache(modules);
  return (componentKey) => {
    const cached = cache.get(componentKey);
    if (cached) return cached;

    const path = lookupPagePath(modules, componentKey);
    if (!path) return null;

    const loader = modules[path];
    if (!loader) return null;

    const Lazy = lazy(loader);
    cache.set(componentKey, Lazy);
    return Lazy;
  };
}

/**
 * Default-bound resolver. Pass a `componentKey` from `MenuNode.component`
 * and receive a `<Lazy />` component or `null` if unresolved.
 *
 * Wire into `buildRoutes` via `resolveComponent` so the route's
 * `element` is `<Suspense fallback=...><Lazy /></Suspense>` (the
 * Suspense boundary is set up by the caller — typically the router
 * configuration in `bootstrap`).
 */
export const resolveLazyPage = createLazyPageResolver();
