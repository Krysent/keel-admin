/**
 * Property-based test for the four Zustand stores' `reset()` action.
 *
 * **Validates: Requirement 6.3** (登出/重置幂等)
 *
 *   6.3 — WHEN 调用 `userStore.reset()` 多次 THEN 最终状态 SHALL
 *         与调用一次等价（幂等）
 *
 * design.md "Property 2: 登出幂等" formalises this as
 *
 *     ∀ random store state, ∀ n ≥ 1 :  reset^n(state) ≡ reset(state)
 *
 * which we strengthen here to the operationally-equivalent claim
 *
 *     ∀ ops, ∀ n ≥ 1 :
 *        applyOps(reset(s0), ops) followed by `reset()` n times
 *        ≡ s0
 *
 * i.e. *however* the store was mutated, calling `reset` one or more
 * times must always yield the documented `INITIAL_<STORE>_STATE`.
 *
 * # Why "operations + N resets" is the right formulation
 *
 * Phrasing the property as "generate any state, reset n times" would
 * tempt a generator that hand-builds raw store objects — but that path
 * leaks store internals (custom `Set` reviver, persist middleware) into
 * the test. Instead we drive the store through its **public actions**,
 * the same surface the rest of the app uses. This means:
 *   - the property holds against the actual middleware stack (persist,
 *     subscriptions, future middleware in task 9.x);
 *   - any future action added without an idempotence story will fail
 *     this test as soon as a generator branch picks it up.
 *
 * # Per-run isolation
 *
 * Zustand keeps a single module-level store instance, so back-to-back
 * fast-check runs would otherwise see leaked state from the previous
 * run. We explicitly call `reset()` *at the top* of every property body
 * so each run starts from `INITIAL_*_STATE` regardless of what the
 * previous run did.
 *
 * The outer `beforeEach` still clears localStorage and does an extra
 * reset for cross-test hygiene (see `tests/stores/*.store.test.ts`).
 *
 * # Set-aware snapshot comparison
 *
 * `userStore` stores `permissions` / `roles` as `Set<string>`. Vitest's
 * `toStrictEqual` does compare `Set` contents, but to keep failures
 * legible (and to avoid relying on iteration-order coincidences in
 * shrunk counter-examples) we compare via sorted arrays.
 */

import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAppStore, INITIAL_APP_STATE, type AppStore } from '../../src/stores/app.store.ts';
import {
  useOrderStore,
  INITIAL_ORDER_STATE,
  type OrderStore,
  type OrderFilters,
} from '../../src/stores/modules/order.store.ts';
import {
  useTenantStore,
  INITIAL_TENANT_STATE,
  type TenantStore,
} from '../../src/stores/tenant.store.ts';
import { useUserStore, INITIAL_USER_STATE, type UserStore } from '../../src/stores/user.store.ts';
import { clearLocalStorage } from '../setup-local-storage.ts';

import type { MenuNode, Tenant, TabItem, UserInfo } from '@keel/types';

// ---------------------------------------------------------------------------
//   Shared helpers
// ---------------------------------------------------------------------------

/**
 * Number-of-resets generator. Requirement 6.3 / design Property 2 quantify
 * over `n ≥ 1`; we cap at 5 since the property is structural — additional
 * iterations only inflate the run cost without exercising new code paths.
 */
const resetCountArb = fc.integer({ min: 1, max: 5 });

/** Cap operation sequence length so shrunk counter-examples stay readable. */
const MAX_OPS_PER_RUN = 8;

// `fc.string` with a tight alphabet keeps shrinks small and mirrors the
// alphabet used by `packages/auth/tests/use-permission.pbt.test.ts`.
const codeArb = fc.string({
  minLength: 1,
  maxLength: 6,
  unit: fc.constantFrom('a', 'b', 'c', 'd', ':'),
});

// ---------------------------------------------------------------------------
//   userStore — generators + property
// ---------------------------------------------------------------------------

const userInfoArb: fc.Arbitrary<UserInfo> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 4 }),
  username: fc.string({ minLength: 1, maxLength: 4 }),
  displayName: fc.string({ minLength: 0, maxLength: 4 }),
  tenantIds: fc.array(fc.string({ minLength: 1, maxLength: 3 }), { maxLength: 3 }),
  permissions: fc.array(codeArb, { maxLength: 3 }),
  roles: fc.array(codeArb, { maxLength: 3 }),
});

const menuNodeArb: fc.Arbitrary<MenuNode> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 4 }),
  title: fc.string({ minLength: 0, maxLength: 4 }),
  path: fc.string({ minLength: 0, maxLength: 4 }),
});

type UserOp = (s: UserStore) => void;

const userOpArb: fc.Arbitrary<UserOp> = fc.oneof(
  fc.option(userInfoArb, { nil: null }).map((u) => (s: UserStore) => s.setUser(u)),
  fc.array(menuNodeArb, { maxLength: 3 }).map((ms) => (s: UserStore) => s.setMenus(ms)),
  fc.array(codeArb, { maxLength: 4 }).map((codes) => (s: UserStore) => s.setPermissions(codes)),
  fc.array(codeArb, { maxLength: 4 }).map((codes) => (s: UserStore) => s.setRoles(codes)),
  // Calling `reset` mid-sequence is also a valid mutation — including it
  // here gives the property extra coverage of `reset` interleavings.
  fc.constant<UserOp>((s) => s.reset()),
);

interface UserSnapshot {
  userInfo: UserInfo | null;
  menus: MenuNode[];
  permissions: string[];
  roles: string[];
}

function snapshotUser(s: {
  userInfo: UserInfo | null;
  menus: MenuNode[];
  permissions: Set<string>;
  roles: Set<string>;
}): UserSnapshot {
  return {
    userInfo: s.userInfo,
    menus: s.menus,
    permissions: [...s.permissions].sort(),
    roles: [...s.roles].sort(),
  };
}

// ---------------------------------------------------------------------------
//   tenantStore — generators + property
// ---------------------------------------------------------------------------

const tenantArb: fc.Arbitrary<Tenant> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 3 }),
  name: fc.string({ minLength: 1, maxLength: 4 }),
});

type TenantOp = (s: TenantStore) => void;

const tenantOpArb: fc.Arbitrary<TenantOp> = fc.oneof(
  fc.array(tenantArb, { maxLength: 3 }).map((list) => (s: TenantStore) => s.setList(list)),
  fc.option(tenantArb, { nil: null }).map((t) => (s: TenantStore) => s.setCurrent(t)),
  // `switchTenant` only mutates when the id is in the current `list`; the
  // generator emits arbitrary ids on purpose so we exercise the no-op
  // branch as well as the hit branch.
  fc.string({ minLength: 1, maxLength: 3 }).map((id) => (s: TenantStore) => s.switchTenant(id)),
  fc.constant<TenantOp>((s) => s.reset()),
);

// ---------------------------------------------------------------------------
//   appStore — generators + property
// ---------------------------------------------------------------------------

const tabArb: fc.Arbitrary<TabItem> = fc.record(
  {
    key: fc.string({ minLength: 1, maxLength: 4 }),
    title: fc.string({ minLength: 0, maxLength: 4 }),
    path: fc.string({ minLength: 1, maxLength: 4 }),
    affix: fc.boolean(),
  },
  { requiredKeys: ['key', 'title', 'path'] },
);

type AppOp = (s: AppStore) => void;

const appOpArb: fc.Arbitrary<AppOp> = fc.oneof(
  fc.boolean().map((v) => (s: AppStore) => s.setCollapsed(v)),
  fc.constant<AppOp>((s) => s.toggleCollapsed()),
  fc.constantFrom('light' as const, 'dark' as const).map((m) => (s: AppStore) => s.setTheme(m)),
  fc.constantFrom('zh-CN' as const, 'en-US' as const).map((l) => (s: AppStore) => s.setLocale(l)),
  tabArb.map((t) => (s: AppStore) => s.addTab(t)),
  fc.string({ minLength: 1, maxLength: 4 }).map((k) => (s: AppStore) => s.removeTab(k)),
  fc.array(tabArb, { maxLength: 3 }).map((ts) => (s: AppStore) => s.setTabs(ts)),
  fc.constant<AppOp>((s) => s.reset()),
);

// ---------------------------------------------------------------------------
//   orderStore — generators + property
// ---------------------------------------------------------------------------

const orderFiltersPatchArb: fc.Arbitrary<Partial<OrderFilters>> = fc.record(
  {
    keyword: fc.string({ maxLength: 4 }),
    status: fc.string({ maxLength: 4 }),
    dateFrom: fc.string({ maxLength: 4 }),
    dateTo: fc.string({ maxLength: 4 }),
    page: fc.integer({ min: 1, max: 50 }),
    pageSize: fc.integer({ min: 1, max: 100 }),
  },
  { requiredKeys: [] },
);

type OrderOp = (s: OrderStore) => void;

const orderOpArb: fc.Arbitrary<OrderOp> = fc.oneof(
  orderFiltersPatchArb.map((p) => (s: OrderStore) => s.setFilters(p)),
  fc
    .array(fc.string({ minLength: 1, maxLength: 3 }), { maxLength: 4 })
    .map((ids) => (s: OrderStore) => s.setSelectedIds(ids)),
  fc.constant<OrderOp>((s) => s.resetFilters()),
  fc.constant<OrderOp>((s) => s.reset()),
);

// ---------------------------------------------------------------------------
//   Properties
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Cross-test hygiene: clear persisted JSON and snap each store back to
  // its initial value before the property kicks in.
  clearLocalStorage();
  useUserStore.getState().reset();
  useTenantStore.getState().reset();
  useAppStore.getState().reset();
  useOrderStore.getState().reset();
});

describe('reset() idempotence (Requirement 6.3 / design Property 2)', () => {
  it('userStore: reset^n(applyOps(s0, ops)) === INITIAL_USER_STATE for any ops, n ≥ 1', () => {
    fc.assert(
      fc.property(fc.array(userOpArb, { maxLength: MAX_OPS_PER_RUN }), resetCountArb, (ops, n) => {
        // Per-run isolation.
        useUserStore.getState().reset();

        // Apply arbitrary mutations via the public action surface.
        for (const op of ops) op(useUserStore.getState());

        // Reset n ≥ 1 times.
        for (let i = 0; i < n; i++) useUserStore.getState().reset();

        // The final state must equal INITIAL_USER_STATE — that's the
        // "≡ reset(state) (called once)" half of Requirement 6.3.
        expect(snapshotUser(useUserStore.getState())).toStrictEqual(
          snapshotUser(INITIAL_USER_STATE),
        );
      }),
      { numRuns: 100 },
    );
  });

  it('tenantStore: reset^n is equivalent to reset', () => {
    fc.assert(
      fc.property(
        fc.array(tenantOpArb, { maxLength: MAX_OPS_PER_RUN }),
        resetCountArb,
        (ops, n) => {
          useTenantStore.getState().reset();
          for (const op of ops) op(useTenantStore.getState());
          for (let i = 0; i < n; i++) useTenantStore.getState().reset();

          const s = useTenantStore.getState();
          expect(s.current).toBe(INITIAL_TENANT_STATE.current);
          expect(s.list).toStrictEqual(INITIAL_TENANT_STATE.list);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('appStore: reset^n is equivalent to reset', () => {
    fc.assert(
      fc.property(fc.array(appOpArb, { maxLength: MAX_OPS_PER_RUN }), resetCountArb, (ops, n) => {
        useAppStore.getState().reset();
        for (const op of ops) op(useAppStore.getState());
        for (let i = 0; i < n; i++) useAppStore.getState().reset();

        const s = useAppStore.getState();
        expect(s.collapsed).toBe(INITIAL_APP_STATE.collapsed);
        expect(s.theme).toBe(INITIAL_APP_STATE.theme);
        expect(s.locale).toBe(INITIAL_APP_STATE.locale);
        expect(s.tabs).toStrictEqual(INITIAL_APP_STATE.tabs);
      }),
      { numRuns: 100 },
    );
  });

  it('orderStore: reset^n is equivalent to reset', () => {
    fc.assert(
      fc.property(fc.array(orderOpArb, { maxLength: MAX_OPS_PER_RUN }), resetCountArb, (ops, n) => {
        useOrderStore.getState().reset();
        for (const op of ops) op(useOrderStore.getState());
        for (let i = 0; i < n; i++) useOrderStore.getState().reset();

        const s = useOrderStore.getState();
        expect(s.filters).toStrictEqual(INITIAL_ORDER_STATE.filters);
        expect(s.selectedIds).toStrictEqual(INITIAL_ORDER_STATE.selectedIds);
      }),
      { numRuns: 100 },
    );
  });
});
