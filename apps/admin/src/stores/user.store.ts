/**
 * `userStore` — identity, menu tree, permission codes, and roles.
 *
 * Owns the data half of the permission boundary documented in design.md
 * "关于 @keel/auth 的边界（机制 vs 数据）" and Requirements 3 / 4.5 / 6.x:
 *
 *  - business permission codes / roles live in this store as `Set<string>`
 *    (Requirement 6.4: O(1) membership for `usePermission`)
 *  - `@keel/auth`'s `createAuth` adapter reads from here via a selector
 *    (see `apps/admin/src/auth.ts` once task 9 wires it up)
 *  - the entire slice is persisted to localStorage so a page reload does
 *    not blank the user (Requirement 6.5); custom Set <-> Array
 *    serialisation keeps the persisted form JSON-friendly while the
 *    in-memory form keeps `Set` semantics.
 *
 * `reset()` is the canonical "logout + cleanup" hook (Requirement 6.2 /
 * 6.3). The PBT in task 9.2 asserts `reset^n === reset` (idempotence).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MenuNode, UserInfo } from '@keel/types';

/** Public state shape — exported so selectors and tests can type against it. */
export interface UserState {
  userInfo: UserInfo | null;
  menus: MenuNode[];
  /** Permission codes the user holds. `Set` for O(1) `has()` (Req 6.4). */
  permissions: Set<string>;
  /** Role codes the user holds. `Set` mirrors permissions for symmetry. */
  roles: Set<string>;
}

export interface UserActions {
  setUser: (user: UserInfo | null) => void;
  setMenus: (menus: MenuNode[]) => void;
  setPermissions: (codes: Iterable<string>) => void;
  setRoles: (codes: Iterable<string>) => void;
  /** Restore initial values. Idempotent — see Requirement 6.3 / task 9.2. */
  reset: () => void;
}

export type UserStore = UserState & UserActions;

/**
 * Initial state — frozen reference so `reset()` always returns the same
 * fields and never accidentally mutates a shared object. Exported for
 * the PBT in task 9.2 to compare against.
 */
export const INITIAL_USER_STATE: Readonly<UserState> = Object.freeze({
  userInfo: null,
  menus: [] as MenuNode[],
  // Each `reset()` builds *fresh* Sets (see `freshInitial`) so persist's
  // shallow merge cannot leak references between resets.
  permissions: new Set<string>(),
  roles: new Set<string>(),
});

/** Build a brand-new initial state with fresh Set / array references. */
function freshInitial(): UserState {
  return {
    userInfo: null,
    menus: [],
    permissions: new Set<string>(),
    roles: new Set<string>(),
  };
}

/**
 * Persist Set<string> as Array<string> so JSON.stringify stays valid; the
 * reviver walks the rehydrated tree and converts the two known Set fields
 * back. We key by field name to avoid being too clever — there are exactly
 * two Sets in this slice and they are intentionally listed.
 */
const SET_FIELDS = new Set(['permissions', 'roles']);

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      ...freshInitial(),
      setUser: (userInfo) => set({ userInfo }),
      setMenus: (menus) => set({ menus }),
      setPermissions: (codes) => set({ permissions: new Set(codes) }),
      setRoles: (codes) => set({ roles: new Set(codes) }),
      reset: () => set(freshInitial()),
    }),
    {
      name: 'keel-user',
      storage: createJSONStorage(() => localStorage, {
        replacer: (key, value) => {
          if (SET_FIELDS.has(key) && value instanceof Set) {
            return [...value];
          }
          return value;
        },
        reviver: (key, value) => {
          if (SET_FIELDS.has(key) && Array.isArray(value)) {
            return new Set(value as string[]);
          }
          return value;
        },
      }),
      // Persist the full slice — actions are added back on rehydrate by
      // the persist middleware itself.
      partialize: (state): UserState => ({
        userInfo: state.userInfo,
        menus: state.menus,
        permissions: state.permissions,
        roles: state.roles,
      }),
    },
  ),
);
