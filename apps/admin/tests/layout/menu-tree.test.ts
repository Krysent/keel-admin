/**
 * Unit tests for the pure menu/breadcrumb helpers.
 *
 * These cover the data the React Sider/Breadcrumb consume to satisfy
 * Requirements 7.1 (Sider) and 7.6 (Breadcrumb) — the rendering layer
 * itself will be tested with @testing-library/react in task 15.
 */

import { describe, expect, it } from 'vitest';

import { ancestorPaths, buildMenuItems, findMenuPath } from '../../src/layout/lib/menu-tree.ts';

import type { MenuNode } from '@keel/types';

const SYSTEM_TREE: MenuNode[] = [
  {
    id: '1',
    title: 'menu.dashboard',
    path: '/dashboard',
    icon: 'dashboard',
  },
  {
    id: '2',
    title: 'menu.system',
    path: '/system',
    icon: 'setting',
    children: [
      { id: '2-1', title: 'menu.user', path: '/system/user' },
      { id: '2-2', title: 'menu.role', path: '/system/role', hidden: true },
    ],
  },
  {
    id: '3',
    title: 'menu.legacy',
    path: '/legacy',
    redirect: '/dashboard',
  },
];

describe('buildMenuItems', () => {
  it('skips hidden and redirect-only nodes', () => {
    const items = buildMenuItems(SYSTEM_TREE);
    // Top level: dashboard + system (no /legacy because of redirect).
    expect(items.map((i) => i.key)).toEqual(['/dashboard', '/system']);
    // /system has only one visible child (`/system/role` is hidden).
    expect(items[1]?.children?.map((c) => c.key)).toEqual(['/system/user']);
  });

  it('keeps i18n keys verbatim — translation happens in React (Req 7.4)', () => {
    const items = buildMenuItems(SYSTEM_TREE);
    expect(items[0]?.label).toBe('menu.dashboard');
  });

  it('drops empty children arrays so AntD treats the node as a leaf', () => {
    const tree: MenuNode[] = [{ id: 'a', title: 'menu.a', path: '/a', children: [] }];
    expect(buildMenuItems(tree)[0]?.children).toBeUndefined();
  });
});

describe('findMenuPath', () => {
  it('returns the inclusive ancestor chain for a deep node', () => {
    const chain = findMenuPath(SYSTEM_TREE, '/system/user');
    expect(chain?.map((n) => n.path)).toEqual(['/system', '/system/user']);
  });

  it('returns null when the path is unknown', () => {
    expect(findMenuPath(SYSTEM_TREE, '/nope')).toBeNull();
  });

  it('finds top-level paths in a single-element chain', () => {
    expect(findMenuPath(SYSTEM_TREE, '/dashboard')?.map((n) => n.path)).toEqual(['/dashboard']);
  });
});

describe('ancestorPaths', () => {
  it('omits the leaf and returns sub-menu keys for openKeys', () => {
    expect(ancestorPaths(SYSTEM_TREE, '/system/user')).toEqual(['/system']);
  });

  it('returns [] when the path is a top-level leaf', () => {
    expect(ancestorPaths(SYSTEM_TREE, '/dashboard')).toEqual([]);
  });

  it('returns [] when the path is unknown (caller decides UX)', () => {
    expect(ancestorPaths(SYSTEM_TREE, '/missing')).toEqual([]);
  });
});
