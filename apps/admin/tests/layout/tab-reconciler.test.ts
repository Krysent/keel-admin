/**
 * Unit tests for the pure tab reconciler helpers.
 *
 * The tab reconciler is the data half of Requirements 7.2 / 7.3:
 * route navigation appends a tab, closing a tab respects `affix:true`,
 * and the active-key picker survives the transition.
 *
 * The corresponding behavioral tests against the React `<BasicLayout />`
 * shell will land with task 15 once jsdom + testing-library are wired up
 * at the workspace level. For now, locking down the pure logic here
 * gives us most of the safety net.
 */

import { describe, expect, it } from 'vitest';
import type { MenuNode, TabItem } from '@keel/types';

import {
  appendTab,
  collectAffixedTabs,
  pickActiveAfterClose,
  removeTab,
  tabFromMenuNode,
} from '../../src/layout/lib/tab-reconciler.js';

const HOME: TabItem = { key: '/home', title: 'menu.home', path: '/home', affix: true };
const USER: TabItem = { key: '/system/user', title: 'menu.user', path: '/system/user' };
const ORDER: TabItem = { key: '/order', title: 'menu.order', path: '/order' };

describe('appendTab', () => {
  it('appends when key is new', () => {
    expect(appendTab([HOME], USER)).toEqual([HOME, USER]);
  });

  it('returns the original array reference on duplicate key', () => {
    const before = [HOME, USER];
    const after = appendTab(before, { ...USER, title: 'changed' });
    // Same reference → React setState short-circuits.
    expect(after).toBe(before);
  });
});

describe('removeTab', () => {
  it('removes a non-affixed tab', () => {
    expect(removeTab([HOME, USER, ORDER], USER.key)).toEqual([HOME, ORDER]);
  });

  it('refuses to remove an affixed tab (Requirement 7.3)', () => {
    const before = [HOME, USER];
    expect(removeTab(before, HOME.key)).toBe(before);
  });

  it('returns the original array on unknown key', () => {
    const before = [HOME, USER];
    expect(removeTab(before, '/missing')).toBe(before);
  });
});

describe('pickActiveAfterClose', () => {
  it('keeps active when a different tab is closed', () => {
    expect(pickActiveAfterClose([HOME, USER, ORDER], USER.key, ORDER.key)).toBe(ORDER.key);
  });

  it('falls back to the left neighbor when closing the active tab', () => {
    expect(pickActiveAfterClose([HOME, USER, ORDER], USER.key, USER.key)).toBe(HOME.key);
  });

  it('falls back to the right neighbor when closing the leftmost active tab', () => {
    expect(pickActiveAfterClose([HOME, USER, ORDER], HOME.key, HOME.key)).toBe(USER.key);
  });

  it('returns null when only the active tab existed', () => {
    expect(pickActiveAfterClose([USER], USER.key, USER.key)).toBeNull();
  });
});

describe('tabFromMenuNode', () => {
  it('keeps the i18n key in `title` (Requirement 7.4)', () => {
    const node: MenuNode = {
      id: '1',
      title: 'menu.system.user',
      path: '/system/user',
    };
    expect(tabFromMenuNode('/system/user', node).title).toBe('menu.system.user');
  });

  it('preserves the icon and affix flag', () => {
    const node: MenuNode = {
      id: '1',
      title: 'menu.home',
      path: '/home',
      icon: 'home',
      affix: true,
    };
    const tab = tabFromMenuNode('/home', node);
    expect(tab.icon).toBe('home');
    expect(tab.affix).toBe(true);
  });

  it('uses the pathname as key, not the menu node path', () => {
    // Parameterized routes (e.g. `/order/:id` matched as `/order/42`)
    // should produce a tab keyed by the concrete pathname.
    const node: MenuNode = { id: '2', title: 'menu.order', path: '/order/:id' };
    expect(tabFromMenuNode('/order/42', node).key).toBe('/order/42');
  });
});

describe('collectAffixedTabs', () => {
  it('picks affixed leaves and skips hidden / redirect-only nodes', () => {
    const menus: MenuNode[] = [
      { id: '1', title: 'menu.home', path: '/home', affix: true },
      // Hidden affixed tab is intentionally not surfaced.
      { id: '2', title: 'menu.hidden', path: '/hidden', affix: true, hidden: true },
      // Redirect-only nodes don't render content; the redirect target itself
      // (if affixed) would be picked up via children, not here.
      { id: '3', title: 'menu.redirect', path: '/r', redirect: '/home', affix: true },
    ];
    const out = collectAffixedTabs(menus);
    expect(out.map((t) => t.key)).toEqual(['/home']);
  });

  it('walks into children', () => {
    const menus: MenuNode[] = [
      {
        id: '1',
        title: 'menu.system',
        path: '/system',
        children: [
          { id: '2', title: 'menu.user', path: '/system/user', affix: true },
        ],
      },
    ];
    expect(collectAffixedTabs(menus).map((t) => t.key)).toEqual(['/system/user']);
  });
});
