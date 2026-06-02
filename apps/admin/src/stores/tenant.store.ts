/**
 * `tenantStore` — current tenant + the list of tenants the user can switch to.
 *
 * Maps to Requirements 4.5 (switching a tenant must trigger menu / permission
 * reload and rebuild the route tree) and 6.5 (persisted to localStorage so a
 * page reload remembers the last tenant). The reload-and-rebuild side-effect
 * is intentionally *not* expressed inside the store — `switchTenant` is kept
 * as a pure state mutation here, and the bootstrap layer (task 9) wires it
 * up to the HTTP services and `userStore.setMenus / setPermissions`.
 *
 * Keeping the orchestration outside the store has two benefits:
 *   1. The store stays unit-testable without mocking HTTP / router.
 *   2. The orchestration is run once during bootstrap and once per
 *      switch — no risk of double-fetch caused by hot-reload subscriptions.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Tenant } from '@keel/types';

export interface TenantState {
  current: Tenant | null;
  list: Tenant[];
}

export interface TenantActions {
  /** Replace the available tenant list (called after `/user/profile`). */
  setList: (list: Tenant[]) => void;
  /** Set the current tenant directly (used by bootstrap). */
  setCurrent: (tenant: Tenant | null) => void;
  /**
   * Move `current` to the tenant whose `id` matches.
   *
   * - When the id is unknown (not in `list`) the action is a no-op so the
   *   UI doesn't end up in a half-switched state. The bootstrap layer
   *   wraps this with the menu/permission reload required by Req 4.5.
   * - When the id matches the current tenant, this is a no-op too — same
   *   reasoning as above.
   */
  switchTenant: (id: string) => void;
  /** Restore initial values. Idempotent — see Requirement 6.3 / task 9.2. */
  reset: () => void;
}

export type TenantStore = TenantState & TenantActions;

export const INITIAL_TENANT_STATE: Readonly<TenantState> = Object.freeze({
  current: null,
  list: [] as Tenant[],
});

function freshInitial(): TenantState {
  return { current: null, list: [] };
}

export const useTenantStore = create<TenantStore>()(
  persist(
    (set, get) => ({
      ...freshInitial(),
      setList: (list) => set({ list }),
      setCurrent: (current) => set({ current }),
      switchTenant: (id) => {
        const { list, current } = get();
        if (current?.id === id) return;
        const next = list.find((t) => t.id === id);
        if (!next) return;
        set({ current: next });
      },
      reset: () => set(freshInitial()),
    }),
    {
      name: 'keel-tenant',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): TenantState => ({
        current: state.current,
        list: state.list,
      }),
    },
  ),
);
