/**
 * Unit tests for `pages/_async.ts` — the lazy page resolver factory.
 *
 * The function under test is the *path resolution* layer (which glob
 * key wins for a given component string) plus the React.lazy caching
 * behaviour. The actual rendering is left to integration tests in
 * task 15 because it requires a DOM.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  candidatePathsFor,
  createLazyPageResolver,
  lookupPagePath,
  type PageModulesMap,
} from '../../src/pages/_async.ts';

describe('candidatePathsFor', () => {
  it('produces the two recognised forms for a bare key', () => {
    expect(candidatePathsFor('system/user')).toEqual([
      '/src/pages/system/user.tsx',
      '/src/pages/system/user/index.tsx',
    ]);
  });

  it('strips leading slashes the menu authors might add', () => {
    expect(candidatePathsFor('/system/user')).toEqual([
      '/src/pages/system/user.tsx',
      '/src/pages/system/user/index.tsx',
    ]);
  });
});

describe('lookupPagePath', () => {
  const dummy: PageModulesMap = {
    '/src/pages/system/user/index.tsx': () =>
      Promise.resolve({ default: () => null as unknown as JSX.Element }),
    '/src/pages/order.tsx': () =>
      Promise.resolve({ default: () => null as unknown as JSX.Element }),
  };

  it('matches the index form when only that file exists', () => {
    expect(lookupPagePath(dummy, 'system/user')).toBe('/src/pages/system/user/index.tsx');
  });

  it('matches the exact-file form when only that file exists', () => {
    expect(lookupPagePath(dummy, 'order')).toBe('/src/pages/order.tsx');
  });

  it('prefers the exact-file form when both candidates exist', () => {
    const both: PageModulesMap = {
      '/src/pages/order.tsx': () =>
        Promise.resolve({ default: () => null as unknown as JSX.Element }),
      '/src/pages/order/index.tsx': () =>
        Promise.resolve({ default: () => null as unknown as JSX.Element }),
    };
    expect(lookupPagePath(both, 'order')).toBe('/src/pages/order.tsx');
  });

  it('returns null when neither candidate exists', () => {
    expect(lookupPagePath(dummy, 'missing')).toBeNull();
  });
});

describe('createLazyPageResolver', () => {
  it('returns null for unresolved keys', () => {
    const resolve = createLazyPageResolver({});
    expect(resolve('nope')).toBeNull();
  });

  it('caches the lazy component per key (no duplicate import on second resolve)', () => {
    const loader = vi.fn(() => Promise.resolve({ default: () => null as unknown as JSX.Element }));
    const modules: PageModulesMap = {
      '/src/pages/sample/index.tsx': loader,
    };
    const resolve = createLazyPageResolver(modules);

    const first = resolve('sample');
    const second = resolve('sample');

    // Identity equality — same `LazyExoticComponent` returned both times.
    expect(first).not.toBeNull();
    expect(second).toBe(first);

    // The loader function itself is referenced lazily by `React.lazy`, so
    // we don't expect it to have been *invoked* yet — but the resolver
    // should not have materialised two different lazy wrappers.
    // (Calling React.lazy doesn't invoke the loader.)
    expect(loader).not.toHaveBeenCalled();
  });
});
