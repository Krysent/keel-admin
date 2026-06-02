/**
 * `orderStore` — example *business module* slice.
 *
 * Demonstrates the convention from design.md: business slices live under
 * `stores/modules/` and stay deliberately small. They typically cache only
 * what the user expects to be stable across remounts (search filters,
 * pagination, currently-selected row keys) — *not* server data, which the
 * `useRequest` cache layer (Requirement 19.3) takes care of.
 *
 * No persist middleware here on purpose — filters are session-scoped, and
 * carrying them across reloads would surprise the user.
 */

import { create } from 'zustand';

/** Filter state shared between the search form and the list page. */
export interface OrderFilters {
  /** Free-text search keyword. */
  keyword?: string;
  /** Backend-defined order status code, e.g. 'PAID' / 'REFUNDED'. */
  status?: string;
  /** ISO-8601 inclusive date range start. */
  dateFrom?: string;
  /** ISO-8601 inclusive date range end. */
  dateTo?: string;
  /** 1-indexed page number, mirrors `PageQuery` from `@keel/types`. */
  page: number;
  pageSize: number;
}

export interface OrderState {
  filters: OrderFilters;
  /** Currently-selected order ids (e.g. for batch operations). */
  selectedIds: string[];
}

export interface OrderActions {
  /** Patch the filters. Resets page to 1 when any non-page field changes. */
  setFilters: (patch: Partial<OrderFilters>) => void;
  /** Replace selection. */
  setSelectedIds: (ids: string[]) => void;
  /** Clear filters back to defaults but keep the selection. */
  resetFilters: () => void;
  /** Restore initial values. Idempotent — see Requirement 6.3 / task 9.2. */
  reset: () => void;
}

export type OrderStore = OrderState & OrderActions;

const INITIAL_FILTERS: Readonly<OrderFilters> = Object.freeze({
  page: 1,
  pageSize: 10,
});

export const INITIAL_ORDER_STATE: Readonly<OrderState> = Object.freeze({
  filters: { ...INITIAL_FILTERS },
  selectedIds: [] as string[],
});

function freshInitial(): OrderState {
  return {
    filters: { ...INITIAL_FILTERS },
    selectedIds: [],
  };
}

/** Set of filter keys that, when changed, should reset `page` to 1. */
const PAGE_RESETTING_KEYS: ReadonlySet<keyof OrderFilters> = new Set<keyof OrderFilters>([
  'keyword',
  'status',
  'dateFrom',
  'dateTo',
  'pageSize',
]);

export const useOrderStore = create<OrderStore>()((set) => ({
  ...freshInitial(),
  setFilters: (patch) =>
    set((s) => {
      const touchesPageReset = (Object.keys(patch) as Array<keyof OrderFilters>).some((k) =>
        PAGE_RESETTING_KEYS.has(k),
      );
      const next: OrderFilters = { ...s.filters, ...patch };
      if (touchesPageReset && patch.page === undefined) {
        next.page = 1;
      }
      return { filters: next };
    }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  resetFilters: () => set((s) => ({ filters: { ...INITIAL_FILTERS }, selectedIds: s.selectedIds })),
  reset: () => set(freshInitial()),
}));
