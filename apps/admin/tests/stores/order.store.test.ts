/**
 * Smoke tests for the example business store `orderStore`.
 *
 * Asserts the small but useful behaviours documented inline:
 *   - changing a non-page filter resets `page` to 1
 *   - explicit `page` patches are honoured
 *   - resetFilters keeps the selection
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  useOrderStore,
  INITIAL_ORDER_STATE,
} from '../../src/stores/modules/order.store.js';

beforeEach(() => {
  useOrderStore.getState().reset();
});

describe('orderStore', () => {
  it('starts with page 1 / pageSize 10 and empty selection', () => {
    const s = useOrderStore.getState();
    expect(s.filters).toEqual(INITIAL_ORDER_STATE.filters);
    expect(s.selectedIds).toEqual([]);
  });

  it('setFilters({ keyword }) resets page to 1', () => {
    useOrderStore.getState().setFilters({ page: 5 });
    useOrderStore.getState().setFilters({ keyword: 'foo' });
    expect(useOrderStore.getState().filters.page).toBe(1);
    expect(useOrderStore.getState().filters.keyword).toBe('foo');
  });

  it('setFilters({ page: 3 }) is honoured without resetting', () => {
    useOrderStore.getState().setFilters({ page: 3 });
    expect(useOrderStore.getState().filters.page).toBe(3);
  });

  it('setFilters({ pageSize }) resets page (size change invalidates page index)', () => {
    useOrderStore.getState().setFilters({ page: 4 });
    useOrderStore.getState().setFilters({ pageSize: 50 });
    expect(useOrderStore.getState().filters.page).toBe(1);
    expect(useOrderStore.getState().filters.pageSize).toBe(50);
  });

  it('setSelectedIds replaces the selection', () => {
    useOrderStore.getState().setSelectedIds(['o-1', 'o-2']);
    expect(useOrderStore.getState().selectedIds).toEqual(['o-1', 'o-2']);
  });

  it('resetFilters clears filters but keeps selection', () => {
    const api = useOrderStore.getState();
    api.setFilters({ keyword: 'foo' });
    api.setSelectedIds(['o-1']);
    api.resetFilters();
    const s = useOrderStore.getState();
    expect(s.filters).toEqual(INITIAL_ORDER_STATE.filters);
    expect(s.selectedIds).toEqual(['o-1']);
  });

  it('reset returns to full initial state', () => {
    const api = useOrderStore.getState();
    api.setFilters({ keyword: 'x' });
    api.setSelectedIds(['o-1']);
    api.reset();
    const s = useOrderStore.getState();
    expect(s.filters).toEqual(INITIAL_ORDER_STATE.filters);
    expect(s.selectedIds).toEqual([]);
  });
});
