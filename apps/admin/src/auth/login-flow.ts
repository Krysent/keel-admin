/**
 * `runLoginFlow` — the canonical "login → tokens → user/menus/permissions
 * → store hydration" orchestration extracted as a pure async function.
 *
 * Implements the operational core of Requirement 4.1 ("用户登录成功并加载
 * 完用户信息 THEN 系统 SHALL 调用 /user/menus 与 /user/permissions，并把
 * 结果写入 userStore") and the corresponding bullet from task 9.4:
 *
 *   > pages/login：表单 + 提交 → 调 `/auth/login` → setTokens → 拉用户
 *   >   /菜单/权限 → 跳转首页
 *
 * The page component layer (`pages/login/index.tsx`) is left as a thin
 * shell over this function so:
 *
 *   - the orchestration is unit-testable in node without rendering React;
 *   - bootstrap-time recovery (task 9 main wiring) can re-use the
 *     "fetch profile + menus + permissions" half by calling
 *     `runHydrateAfterLogin` directly;
 *   - the "what services do I need" contract is anchored in one place
 *     (the `LoginDeps` interface), which is what task 9.5 will fill in
 *     with concrete service modules.
 *
 * # The contract
 *
 * The caller provides:
 *
 *   - `services` — the auth/user/menu/permission API surface (task 9.5
 *     supplies the real implementation; the login page injects whatever
 *     wiring is in scope, including a unit-test stub).
 *   - `tokenManager` — `@keel/http`'s token manager; we call `set()` after
 *     login so subsequent requests carry the new access token.
 *   - `stores` — narrow "writer" facade onto `userStore` and (optionally)
 *     `tenantStore`. Typed as plain functions so tests don't have to
 *     stand up real Zustand stores.
 *
 * The function returns a `LoginResult` describing the user's preferred
 * landing path. The login page component is responsible for the actual
 * navigation (it owns the router handle).
 */

import type { TokenManager } from '@keel/http';
import type { MenuNode, Tenant, TokenPair, UserInfo } from '@keel/types';

/**
 * Credentials accepted by `/auth/login`. Kept as an open interface so
 * specific tenants can extend it (e.g. with a verification code) without
 * changing the orchestration.
 */
export interface LoginCredentials {
  username: string;
  password: string;
  /** Optional remember-me hint forwarded to the backend. */
  remember?: boolean;
}

/**
 * Service surface required by the login flow.
 *
 * Each method returns *unwrapped* domain data; the envelope is opened
 * by the `@keel/http` interceptors so this layer never sees the raw
 * `{ code, data, message }` shape.
 *
 * `fetchTenants` is optional because single-tenant deployments don't
 * need it — the orchestration falls back to `userInfo.tenantIds` for
 * those cases.
 */
export interface LoginServices {
  /** POST /auth/login → fresh token pair. */
  login: (credentials: LoginCredentials) => Promise<TokenPair>;
  /** GET /user/profile → currently authenticated user. */
  fetchProfile: () => Promise<UserInfo>;
  /** GET /user/menus → menu forest for the current user/tenant. */
  fetchMenus: () => Promise<MenuNode[]>;
  /**
   * GET /user/permissions → permission codes the user holds.
   *
   * Optional: when omitted the orchestration uses `userInfo.permissions`
   * as the source of truth, which matches the "/auth/login returns user
   * with embedded permissions" pattern some backends prefer.
   */
  fetchPermissions?: () => Promise<string[]>;
  /** GET /tenants/me → tenants the user can switch between. */
  fetchTenants?: () => Promise<Tenant[]>;
}

/**
 * Narrow writer facade over the Zustand stores. The shape is bound to
 * the union of methods `userStore` / `tenantStore` already expose
 * (`setUser`, `setMenus`, `setPermissions`, `setRoles`, `setList`,
 * `setCurrent`) so the page code passes them in directly without
 * adapter glue.
 */
export interface LoginStoreWriters {
  setUser: (user: UserInfo) => void;
  setMenus: (menus: MenuNode[]) => void;
  setPermissions: (codes: Iterable<string>) => void;
  setRoles: (codes: Iterable<string>) => void;
  /** Optional — single-tenant deployments can omit. */
  setTenantList?: (tenants: Tenant[]) => void;
  /** Optional — single-tenant deployments can omit. */
  setCurrentTenant?: (tenant: Tenant | null) => void;
}

/** Aggregate dependency bag — keeps the call site readable. */
export interface LoginDeps {
  services: LoginServices;
  tokenManager: TokenManager;
  stores: LoginStoreWriters;
}

/**
 * Result returned to the caller — the page navigates to `redirectTo`
 * after the promise resolves. We do not navigate from here because the
 * router handle lives in React land and we want this function to stay
 * pure-ish (only depends on its arguments).
 */
export interface LoginResult {
  user: UserInfo;
  menus: MenuNode[];
  permissions: string[];
  /** Path the caller should `navigate(...)` to. Defaults to `/`. */
  redirectTo: string;
}

/**
 * Pick the user's first matching tenant from the fetched list. If
 * `fetchTenants` was not provided we fall back to the user's own
 * `tenantIds`. The tenant orchestration is intentionally minimal here
 * — task 4.5's "switching tenant rebuilds menus" lives in the
 * tenant-switch wiring (a different code path).
 */
function pickInitialTenant(user: UserInfo, tenants: Tenant[] | null): Tenant | null {
  if (!tenants || tenants.length === 0) return null;
  // Prefer a tenant the user is allowed to use; fall back to the first.
  const owned =
    user.tenantIds.length > 0 ? tenants.find((t) => user.tenantIds.includes(t.id)) : undefined;
  return owned ?? tenants[0] ?? null;
}

/**
 * Hydrate `userStore` (and optionally `tenantStore`) from the backend
 * after a successful authentication. Extracted so bootstrap-time
 * recovery (task 9.x) can call it without re-running `/auth/login`.
 *
 * Errors propagate to the caller; we never swallow them here because
 * a failed `fetchMenus` should surface to the login page so the user
 * sees a meaningful error message rather than a half-hydrated session.
 */
export async function runHydrateAfterLogin(
  deps: Pick<LoginDeps, 'services' | 'stores'>,
): Promise<{ user: UserInfo; menus: MenuNode[]; permissions: string[] }> {
  const { services, stores } = deps;

  // Run the three independent fetches in parallel. `fetchPermissions`
  // is optional; we materialise it as a resolved promise when absent
  // so the `Promise.all` shape stays uniform.
  const [user, menus, fetchedPermissions] = await Promise.all([
    services.fetchProfile(),
    services.fetchMenus(),
    services.fetchPermissions
      ? services.fetchPermissions()
      : Promise.resolve(null as string[] | null),
  ]);

  // If the backend doesn't expose a separate permissions endpoint, take
  // the codes from the user payload (a common pattern). De-duplicate
  // either way — we promote them to a Set in the store anyway so
  // duplicates are harmless, but trimming early keeps the wire trace
  // honest.
  const permissions = Array.from(new Set(fetchedPermissions ?? user.permissions ?? []));

  // Tenants are best-effort: failure here should NOT block login (the
  // user can still see at least their default tenant's menu). We log
  // instead of throwing.
  let tenants: Tenant[] | null = null;
  if (services.fetchTenants && stores.setTenantList) {
    try {
      tenants = await services.fetchTenants();
      stores.setTenantList(tenants);
      if (stores.setCurrentTenant) {
        stores.setCurrentTenant(pickInitialTenant(user, tenants));
      }
    } catch {
      // Intentionally swallowed: tenant list is auxiliary data; the
      // caller already has a working session without it.
    }
  }

  // Order: user → roles/permissions → menus. Subscribers that depend
  // on permissions to filter the menu won't see a half-hydrated state
  // because `setMenus` is the *last* write — the menu Sider will
  // re-render once with a complete picture.
  stores.setUser(user);
  stores.setRoles(user.roles ?? []);
  stores.setPermissions(permissions);
  stores.setMenus(menus);

  return { user, menus, permissions };
}

/**
 * The full login flow. Calls `/auth/login`, persists the token pair via
 * the token manager, then delegates to `runHydrateAfterLogin` for the
 * user/menus/permissions hydration.
 *
 * Returns the recommended `redirectTo` so the page component can
 * navigate. We default to `/` and let bootstrap pick the actual home
 * route from the menu tree (Requirement 4.1 only mandates "跳转首页",
 * not a specific URL).
 */
export async function runLoginFlow(
  credentials: LoginCredentials,
  deps: LoginDeps,
): Promise<LoginResult> {
  const { services, tokenManager, stores } = deps;

  // Step 1: authenticate. Errors here surface as the page-level
  // "credentials wrong" message; we don't try/catch — let them bubble.
  const tokenPair = await services.login(credentials);

  // Step 2: persist tokens BEFORE the hydration calls so the request
  // interceptor stamps the new Authorization header on them.
  tokenManager.set(tokenPair);

  // Step 3: hydrate stores. If this throws, we leave the new token in
  // place — the user is technically authenticated; bootstrap can retry
  // the hydration on next page load.
  const hydrated = await runHydrateAfterLogin({ services, stores });

  return {
    ...hydrated,
    redirectTo: '/',
  };
}
