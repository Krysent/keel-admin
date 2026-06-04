/**
 * Smoke tests for `tenantStore`.
 *
 * The orchestration side-effect required by Requirement 4.5 (reload
 * menus / permissions / route tree on switch) is *not* part of this
 * store — it lives in the bootstrap layer (task 9). Here we only assert
 * the store's own state-mutation contract.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useTenantStore, INITIAL_TENANT_STATE } from '../../src/stores/tenant.store.ts';
import { clearLocalStorage } from '../setup-local-storage.ts';

import type { Tenant } from '@keel/types';

const T1: Tenant = { id: 't-1', name: 'Acme' };
const T2: Tenant = { id: 't-2', name: 'Globex' };

beforeEach(() => {
  clearLocalStorage();
  useTenantStore.getState().reset();
});

describe('tenantStore', () => {
  it('starts empty', () => {
    expect(useTenantStore.getState().current).toBe(INITIAL_TENANT_STATE.current);
    expect(useTenantStore.getState().list).toEqual(INITIAL_TENANT_STATE.list);
  });

  it('setList replaces the list reference', () => {
    useTenantStore.getState().setList([T1, T2]);
    expect(useTenantStore.getState().list).toEqual([T1, T2]);
  });

  it('switchTenant updates current when id matches a known tenant', () => {
    const api = useTenantStore.getState();
    api.setList([T1, T2]);
    api.switchTenant('t-2');
    expect(useTenantStore.getState().current).toEqual(T2);
  });

  it('switchTenant is a no-op when id is unknown', () => {
    const api = useTenantStore.getState();
    api.setList([T1]);
    api.setCurrent(T1);
    api.switchTenant('t-does-not-exist');
    expect(useTenantStore.getState().current).toEqual(T1);
  });

  it('switchTenant is a no-op when id matches the current tenant', () => {
    const api = useTenantStore.getState();
    api.setList([T1]);
    api.setCurrent(T1);
    const prev = useTenantStore.getState().current;
    api.switchTenant('t-1');
    expect(useTenantStore.getState().current).toBe(prev);
  });

  it('reset clears current and list', () => {
    const api = useTenantStore.getState();
    api.setList([T1, T2]);
    api.setCurrent(T1);
    api.reset();
    const s = useTenantStore.getState();
    expect(s.current).toBeNull();
    expect(s.list).toEqual([]);
  });
});
