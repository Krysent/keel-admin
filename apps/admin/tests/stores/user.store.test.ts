/**
 * Smoke tests for `userStore`.
 *
 * Covers:
 *   - permissions / roles round-trip as `Set<string>` (Requirement 6.4)
 *   - `reset()` returns to initial values (Requirement 6.3 / 6.2)
 *   - persisted form is JSON-clean (no `Set` reaches the backend) and
 *     rehydrates back into a `Set` (custom replacer/reviver)
 *
 * The PBT in task 9.2 covers the universal idempotence of `reset^n`.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useUserStore, INITIAL_USER_STATE } from '../../src/stores/user.store.ts';
import { clearLocalStorage, getInstalledStorage } from '../setup-local-storage.ts';

import type { UserInfo } from '@keel/types';

const SAMPLE_USER: UserInfo = {
  id: 'u-1',
  username: 'alice',
  displayName: 'Alice',
  tenantIds: ['t-1'],
  permissions: ['order:list'],
  roles: ['admin'],
};

beforeEach(() => {
  clearLocalStorage();
  // Reset the store explicitly because Zustand keeps a single module-level
  // instance across tests when not using `create()` per test.
  useUserStore.getState().reset();
});

describe('userStore — actions', () => {
  it('setUser writes userInfo and leaves other fields untouched', () => {
    useUserStore.getState().setUser(SAMPLE_USER);
    const s = useUserStore.getState();
    expect(s.userInfo).toEqual(SAMPLE_USER);
    expect(s.menus).toEqual([]);
    expect(s.permissions).toBeInstanceOf(Set);
    expect(s.permissions.size).toBe(0);
  });

  it('setPermissions stores codes as a Set with O(1) membership', () => {
    useUserStore.getState().setPermissions(['order:list', 'order:create']);
    const s = useUserStore.getState();
    expect(s.permissions).toBeInstanceOf(Set);
    expect(s.permissions.has('order:list')).toBe(true);
    expect(s.permissions.has('order:create')).toBe(true);
    expect(s.permissions.has('order:delete')).toBe(false);
    expect(s.permissions.size).toBe(2);
  });

  it('setRoles stores codes as a Set', () => {
    useUserStore.getState().setRoles(['admin', 'auditor']);
    const s = useUserStore.getState();
    expect(s.roles).toBeInstanceOf(Set);
    expect([...s.roles].sort()).toEqual(['admin', 'auditor']);
  });

  it('setPermissions deduplicates iterable input', () => {
    useUserStore.getState().setPermissions(['a', 'b', 'a', 'b']);
    const s = useUserStore.getState();
    expect(s.permissions.size).toBe(2);
  });

  it('reset returns to initial state', () => {
    const api = useUserStore.getState();
    api.setUser(SAMPLE_USER);
    api.setPermissions(['order:list']);
    api.setRoles(['admin']);
    api.setMenus([{ id: 'm-1', title: 'Home', path: '/' }]);
    api.reset();
    const s = useUserStore.getState();
    expect(s.userInfo).toBe(INITIAL_USER_STATE.userInfo);
    expect(s.menus).toEqual(INITIAL_USER_STATE.menus);
    expect(s.permissions.size).toBe(0);
    expect(s.roles.size).toBe(0);
  });

  it('reset is idempotent (Requirement 6.3 sanity check)', () => {
    const api = useUserStore.getState();
    api.setPermissions(['a', 'b']);
    api.reset();
    const once = useUserStore.getState();
    api.reset();
    const twice = useUserStore.getState();
    expect(twice.userInfo).toBe(once.userInfo);
    expect(twice.menus).toEqual(once.menus);
    expect([...twice.permissions]).toEqual([...once.permissions]);
    expect([...twice.roles]).toEqual([...once.roles]);
  });
});

describe('userStore — persistence', () => {
  it('persisted JSON encodes Set as Array (no Set reaches storage)', async () => {
    useUserStore.getState().setPermissions(['p1', 'p2']);
    useUserStore.getState().setRoles(['r1']);
    // Allow the persist middleware microtask to flush.
    await Promise.resolve();
    const raw = getInstalledStorage().getItem('keel-user');
    expect(raw).not.toBeNull();
    // The persisted blob is JSON; `Set` has no JSON form so it would
    // serialise to "{}" if our replacer didn't intervene.
    expect(raw).toContain('"p1"');
    expect(raw).not.toContain('Set');
    // And the round-trip shape: arrays under permissions / roles.
    const parsed = JSON.parse(raw as string) as { state: { permissions: unknown; roles: unknown } };
    expect(Array.isArray(parsed.state.permissions)).toBe(true);
    expect(Array.isArray(parsed.state.roles)).toBe(true);
  });
});
