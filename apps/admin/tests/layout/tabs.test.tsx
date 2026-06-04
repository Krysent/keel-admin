/**
 * Unit tests for the Tabs Bar page management — task 20.5.
 *
 * Tests cover Requirements 22.5 and 22.6:
 *
 *   22.5  WHEN 用户首次访问某个路由 IF 该路由在 Tabs_Bar 中不存在对应页签
 *         THEN Tabs_Bar SHALL 在末尾追加该路由的页签并将其设为激活态；
 *         IF 该路由已存在对应页签 THEN Tabs_Bar SHALL 直接激活已有页签，不追加重复项
 *
 *   22.6  WHEN 用户点击 Tabs_Bar 中的关闭按钮
 *         IF 页签的 `affix` 属性为 `true` THEN Tabs_Bar SHALL 不渲染该页签的关闭按钮；
 *         IF `affix` 为 `false` THEN Tabs_Bar SHALL 关闭该页签并优先激活其右侧相邻页签，
 *         若不存在右侧页签则激活左侧相邻页签，若关闭后 Tabs_Bar 为空则跳转到 `/`
 *
 * Note: The `Tabs` React component uses `useMatches()` which requires a full
 * data router context (createBrowserRouter / createMemoryRouter). Component-level
 * DOM rendering tests live in E2E (Playwright). Here we cover the store-level
 * and pure-logic behaviour that underpins requirements 22.5 and 22.6.
 *
 * Validates: Requirements 22.5, 22.6
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { appendTab, pickActiveAfterClose, removeTab } from '../../src/layout/lib/tab-reconciler.ts';
import { useAppStore } from '../../src/stores/app.store.ts';
import { clearLocalStorage } from '../setup-local-storage.ts';

import type { TabItem } from '@keel/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HOME_TAB: TabItem = {
  key: '/dashboard',
  title: 'menu.home',
  path: '/dashboard',
  affix: true,
};
const USER_TAB: TabItem = {
  key: '/system/user',
  title: 'menu.user',
  path: '/system/user',
};
const ORDER_TAB: TabItem = {
  key: '/order',
  title: 'menu.order',
  path: '/order',
};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearLocalStorage();
  useAppStore.getState().reset();
});

// ---------------------------------------------------------------------------
// Requirement 22.5: No-duplicate append
// ---------------------------------------------------------------------------

describe('Tabs — no-duplicate append (Req 22.5)', () => {
  it('appends a new tab at the end when the route is not yet in the strip', () => {
    // Simulates: user visits /system/user for the first time.
    const tabs = appendTab([HOME_TAB], USER_TAB);
    expect(tabs).toHaveLength(2);
    expect(tabs[0]!.key).toBe('/dashboard');
    expect(tabs[1]!.key).toBe('/system/user');
  });

  it('does not append a duplicate: returns the same array reference', () => {
    const before = [HOME_TAB, USER_TAB];
    // Simulates: user clicks an already-open tab (re-navigates to same route).
    const after = appendTab(before, { ...USER_TAB, title: 'changed' });
    expect(after).toBe(before); // Same reference ⟹ no state change, no re-render.
  });

  it('preserves the original title when a duplicate key is added', () => {
    const before = [HOME_TAB, USER_TAB];
    const after = appendTab(before, { ...USER_TAB, title: 'new title' });
    // The existing entry wins — title must be unchanged.
    expect(after.find((t) => t.key === '/system/user')?.title).toBe('menu.user');
  });

  it('appending multiple distinct routes accumulates them in insertion order', () => {
    let tabs: TabItem[] = [HOME_TAB];
    tabs = appendTab(tabs, USER_TAB);
    tabs = appendTab(tabs, ORDER_TAB);
    expect(tabs.map((t) => t.key)).toEqual(['/dashboard', '/system/user', '/order']);
  });

  it('store addTab mirrors appendTab idempotency (Req 22.5 store layer)', () => {
    useAppStore.getState().setTabs([HOME_TAB]);
    useAppStore.getState().addTab(USER_TAB);
    // Second call with same key → no-op.
    useAppStore.getState().addTab({ ...USER_TAB, title: 'mutated' });
    const tabs = useAppStore.getState().tabs;
    expect(tabs).toHaveLength(2);
    expect(tabs[1]!.title).toBe('menu.user'); // original preserved
  });
});

// ---------------------------------------------------------------------------
// Requirement 22.6: affix hides close button (store protection layer)
// ---------------------------------------------------------------------------

describe('Tabs — affix:true tab cannot be removed (Req 22.6)', () => {
  it('removeTab (reconciler) refuses to remove an affixed tab', () => {
    const before = [HOME_TAB, USER_TAB];
    const after = removeTab(before, HOME_TAB.key);
    expect(after).toBe(before); // Same reference ⟹ nothing removed.
  });

  it('removeTab (reconciler) removes a non-affixed tab', () => {
    const after = removeTab([HOME_TAB, USER_TAB], USER_TAB.key);
    expect(after).toEqual([HOME_TAB]);
  });

  it('store removeTab refuses to remove an affixed tab', () => {
    useAppStore.getState().setTabs([HOME_TAB, USER_TAB]);
    useAppStore.getState().removeTab(HOME_TAB.key);
    const tabs = useAppStore.getState().tabs;
    expect(tabs.some((t) => t.key === HOME_TAB.key)).toBe(true);
  });

  it('store removeTab removes a non-affixed tab', () => {
    useAppStore.getState().setTabs([HOME_TAB, USER_TAB]);
    useAppStore.getState().removeTab(USER_TAB.key);
    expect(useAppStore.getState().tabs).toEqual([HOME_TAB]);
  });
});

// ---------------------------------------------------------------------------
// Requirement 22.6: close prefers RIGHT neighbor, then LEFT, then navigate /
// ---------------------------------------------------------------------------

describe('Tabs — close activates right neighbor first (Req 22.6)', () => {
  it('prefers the right neighbor when closing an active tab in the middle', () => {
    // [HOME, USER*, ORDER] → close USER → activate ORDER
    const result = pickActiveAfterClose(
      [HOME_TAB, USER_TAB, ORDER_TAB],
      USER_TAB.key,
      USER_TAB.key,
    );
    expect(result).toBe(ORDER_TAB.key);
  });

  it('falls back to the left neighbor when closing the rightmost active tab', () => {
    // [HOME, USER, ORDER*] → close ORDER → activate USER (no right exists)
    const result = pickActiveAfterClose(
      [HOME_TAB, USER_TAB, ORDER_TAB],
      ORDER_TAB.key,
      ORDER_TAB.key,
    );
    expect(result).toBe(USER_TAB.key);
  });

  it('activates the right neighbor when closing the leftmost tab', () => {
    // [HOME*, USER, ORDER] → close HOME → activate USER (right)
    const result = pickActiveAfterClose(
      [HOME_TAB, USER_TAB, ORDER_TAB],
      HOME_TAB.key,
      HOME_TAB.key,
    );
    expect(result).toBe(USER_TAB.key);
  });

  it('returns null when the only tab is closed (caller should navigate to /)', () => {
    // One tab, close it → null → Tabs.tsx must navigate('/')
    const result = pickActiveAfterClose([USER_TAB], USER_TAB.key, USER_TAB.key);
    expect(result).toBeNull();
  });

  it('keeps the active key unchanged when a non-active tab is closed', () => {
    // Active=HOME, close USER → HOME still active (unchanged)
    const result = pickActiveAfterClose([HOME_TAB, USER_TAB], USER_TAB.key, HOME_TAB.key);
    expect(result).toBe(HOME_TAB.key);
  });

  it('right-preference holds with two tabs: closing left activates right', () => {
    // [USER, ORDER] → close USER → activate ORDER (right)
    const result = pickActiveAfterClose([USER_TAB, ORDER_TAB], USER_TAB.key, USER_TAB.key);
    expect(result).toBe(ORDER_TAB.key);
  });

  it('left-fallback holds with two tabs: closing right activates left', () => {
    // [USER, ORDER] → close ORDER → activate USER (left)
    const result = pickActiveAfterClose([USER_TAB, ORDER_TAB], ORDER_TAB.key, ORDER_TAB.key);
    expect(result).toBe(USER_TAB.key);
  });
});
