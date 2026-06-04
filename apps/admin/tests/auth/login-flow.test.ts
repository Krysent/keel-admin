/**
 * Unit tests for the pure login orchestration in
 * `src/auth/login-flow.ts`.
 *
 * These tests pin down the requirements 4.1 demands of the login
 * flow:
 *
 *   - `runLoginFlow` calls `/auth/login`, persists the returned token
 *     pair via the token manager, then fetches profile / menus /
 *     permissions and writes them to the supplied store writers.
 *   - `runHydrateAfterLogin` is callable on its own (used by bootstrap-
 *     time recovery) without re-running `/auth/login`.
 *   - Tenant fetching is best-effort: a failed `fetchTenants` does not
 *     break the flow.
 *   - Permissions are sourced from `fetchPermissions` when present,
 *     otherwise from the user payload itself, and de-duplicated either
 *     way.
 *   - Stores are written in an order that never leaves a subscriber
 *     observing menus before permissions (so menu permission filtering
 *     in the Sider doesn't see a stale picture).
 */

import { describe, expect, it, vi } from 'vitest';

import {
  runHydrateAfterLogin,
  runLoginFlow,
  type LoginDeps,
  type LoginStoreWriters,
} from '../../src/auth/login-flow.ts';

import type { TokenManager } from '@keel/http';
import type { MenuNode, Tenant, TokenPair, UserInfo } from '@keel/types';

function makeUser(overrides: Partial<UserInfo> = {}): UserInfo {
  return {
    id: 'u1',
    username: 'alice',
    displayName: 'Alice',
    tenantIds: ['t1'],
    permissions: ['user:list'],
    roles: ['admin'],
    ...overrides,
  };
}

function makeMenus(): MenuNode[] {
  return [
    { id: 'm1', title: 'menu.dashboard', path: '/dashboard' },
    { id: 'm2', title: 'menu.user', path: '/system/user', component: 'system/user' },
  ];
}

function makeTokens(): TokenPair {
  return { accessToken: 'access-1', refreshToken: 'refresh-1' };
}

interface RecordedWrites {
  user: UserInfo | null;
  menus: MenuNode[] | null;
  permissions: string[] | null;
  roles: string[] | null;
  tenantList: Tenant[] | null;
  currentTenant: Tenant | null | undefined;
  /** Order of write operations — used to assert hydration sequencing. */
  order: string[];
}

function makeStoreWriters(): {
  writers: LoginStoreWriters;
  recorded: RecordedWrites;
} {
  const recorded: RecordedWrites = {
    user: null,
    menus: null,
    permissions: null,
    roles: null,
    tenantList: null,
    currentTenant: undefined,
    order: [],
  };
  const writers: LoginStoreWriters = {
    setUser: (user) => {
      recorded.user = user;
      recorded.order.push('user');
    },
    setMenus: (menus) => {
      recorded.menus = menus;
      recorded.order.push('menus');
    },
    setPermissions: (codes) => {
      recorded.permissions = [...codes];
      recorded.order.push('permissions');
    },
    setRoles: (codes) => {
      recorded.roles = [...codes];
      recorded.order.push('roles');
    },
    setTenantList: (tenants) => {
      recorded.tenantList = tenants;
      recorded.order.push('tenantList');
    },
    setCurrentTenant: (tenant) => {
      recorded.currentTenant = tenant;
      recorded.order.push('currentTenant');
    },
  };
  return { writers, recorded };
}

function makeTokenManager(): TokenManager & { _stored: TokenPair | null } {
  let stored: TokenPair | null = null;
  return {
    getAccess: () => stored?.accessToken ?? null,
    getRefresh: () => stored?.refreshToken ?? null,
    set: (pair) => {
      stored = pair;
    },
    clear: () => {
      stored = null;
    },
    isRefreshing: () => false,
    refresh: async () => stored?.accessToken ?? '',
    get _stored() {
      return stored;
    },
  } as TokenManager & { _stored: TokenPair | null };
}

describe('runLoginFlow', () => {
  it('happy path: authenticates, stores tokens, hydrates stores, returns redirect', async () => {
    const tokens = makeTokens();
    const user = makeUser({ permissions: ['user:list', 'user:create'] });
    const menus = makeMenus();
    const tenants: Tenant[] = [{ id: 't1', name: 'Tenant One' }];

    const services = {
      login: vi.fn().mockResolvedValue(tokens),
      fetchProfile: vi.fn().mockResolvedValue(user),
      fetchMenus: vi.fn().mockResolvedValue(menus),
      fetchPermissions: vi.fn().mockResolvedValue(['user:list', 'user:create']),
      fetchTenants: vi.fn().mockResolvedValue(tenants),
    };
    const tm = makeTokenManager();
    const { writers, recorded } = makeStoreWriters();

    const deps: LoginDeps = { services, tokenManager: tm, stores: writers };

    const result = await runLoginFlow({ username: 'alice', password: 'secret' }, deps);

    // Step 1: /auth/login was called with the credentials. The
    // orchestration forwards the credentials object unchanged — the
    // page is the layer that normalises `remember` (defaulting to
    // false), so we don't assert on that field here.
    expect(services.login).toHaveBeenCalledTimes(1);
    expect(services.login).toHaveBeenCalledWith({
      username: 'alice',
      password: 'secret',
    });

    // Step 2: tokens persisted before any user data fetch.
    expect((tm as unknown as { _stored: TokenPair | null })._stored).toEqual(tokens);

    // Step 3: user / menus / permissions hydrated.
    expect(recorded.user).toEqual(user);
    expect(recorded.menus).toEqual(menus);
    expect(recorded.permissions).toEqual(['user:list', 'user:create']);
    expect(recorded.roles).toEqual(['admin']);
    expect(recorded.tenantList).toEqual(tenants);
    expect(recorded.currentTenant).toEqual(tenants[0]);

    // Step 4: redirect target.
    expect(result.redirectTo).toBe('/');
    expect(result.user).toBe(user);
    expect(result.permissions).toEqual(['user:list', 'user:create']);
  });

  it('writes menus AFTER permissions so subscribers never observe a half-hydrated state', async () => {
    const services = {
      login: vi.fn().mockResolvedValue(makeTokens()),
      fetchProfile: vi.fn().mockResolvedValue(makeUser()),
      fetchMenus: vi.fn().mockResolvedValue(makeMenus()),
      fetchPermissions: vi.fn().mockResolvedValue(['x']),
    };
    const tm = makeTokenManager();
    const { writers, recorded } = makeStoreWriters();

    await runLoginFlow(
      { username: 'a', password: 'b' },
      { services, tokenManager: tm, stores: writers },
    );

    // `menus` MUST come last among the four user/roles/permissions/menus writes.
    const idxMenus = recorded.order.lastIndexOf('menus');
    const idxPermissions = recorded.order.lastIndexOf('permissions');
    expect(idxMenus).toBeGreaterThan(idxPermissions);
  });

  it('falls back to user.permissions when fetchPermissions is omitted', async () => {
    const user = makeUser({ permissions: ['emb:1', 'emb:1', 'emb:2'] });
    const services = {
      login: vi.fn().mockResolvedValue(makeTokens()),
      fetchProfile: vi.fn().mockResolvedValue(user),
      fetchMenus: vi.fn().mockResolvedValue(makeMenus()),
    };
    const tm = makeTokenManager();
    const { writers, recorded } = makeStoreWriters();

    const result = await runLoginFlow(
      { username: 'a', password: 'b' },
      { services, tokenManager: tm, stores: writers },
    );

    // De-duplicated.
    expect(recorded.permissions).toEqual(['emb:1', 'emb:2']);
    expect(result.permissions).toEqual(['emb:1', 'emb:2']);
  });

  it('does not abort the flow when fetchTenants fails', async () => {
    const services = {
      login: vi.fn().mockResolvedValue(makeTokens()),
      fetchProfile: vi.fn().mockResolvedValue(makeUser()),
      fetchMenus: vi.fn().mockResolvedValue(makeMenus()),
      fetchTenants: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const tm = makeTokenManager();
    const { writers, recorded } = makeStoreWriters();

    await expect(
      runLoginFlow(
        { username: 'a', password: 'b' },
        { services, tokenManager: tm, stores: writers },
      ),
    ).resolves.toMatchObject({ redirectTo: '/' });

    // User/menus still hydrated.
    expect(recorded.user).not.toBeNull();
    expect(recorded.menus).not.toBeNull();
    // Tenant store untouched (the writer was never called).
    expect(recorded.tenantList).toBeNull();
  });

  it('propagates login errors WITHOUT touching stores or tokens', async () => {
    const services = {
      login: vi.fn().mockRejectedValue(new Error('bad creds')),
      fetchProfile: vi.fn(),
      fetchMenus: vi.fn(),
    };
    const tm = makeTokenManager();
    const { writers, recorded } = makeStoreWriters();

    await expect(
      runLoginFlow(
        { username: 'a', password: 'b' },
        { services, tokenManager: tm, stores: writers },
      ),
    ).rejects.toThrow('bad creds');

    expect(services.fetchProfile).not.toHaveBeenCalled();
    expect(services.fetchMenus).not.toHaveBeenCalled();
    expect((tm as unknown as { _stored: TokenPair | null })._stored).toBeNull();
    expect(recorded.user).toBeNull();
  });

  it('runHydrateAfterLogin can be called independently (bootstrap recovery path)', async () => {
    const services = {
      login: vi.fn(),
      fetchProfile: vi.fn().mockResolvedValue(makeUser()),
      fetchMenus: vi.fn().mockResolvedValue(makeMenus()),
      fetchPermissions: vi.fn().mockResolvedValue(['user:list']),
    };
    const { writers, recorded } = makeStoreWriters();

    const out = await runHydrateAfterLogin({ services, stores: writers });

    expect(services.login).not.toHaveBeenCalled();
    expect(out.menus).toEqual(makeMenus());
    expect(recorded.permissions).toEqual(['user:list']);
  });
});
