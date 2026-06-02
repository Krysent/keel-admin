/**
 * Identity and authentication-related shared types.
 *
 * These are the *contract* that `apps/admin` and `@keel/auth` agree on. The
 * concrete permission codes / role codes themselves stay in the business
 * application (see `apps/admin/src/config/permissions.ts`) — only the shapes
 * live here (Requirements 3.1, 3.2).
 */

/**
 * Authenticated user profile returned by `/user/profile`.
 *
 * `permissions` and `roles` are kept as plain `string[]` on the wire and
 * promoted to `Set<string>` by the user store at boot time (Requirement 6.4).
 */
export interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatar?: string;
  /** Tenant ids the user can switch to. Empty array = single-tenant. */
  tenantIds: string[];
  /** Permission codes the user holds (e.g. 'order:delete'). */
  permissions: string[];
  /** Role codes the user holds (RBAC). */
  roles: string[];
}

/**
 * Token pair returned by `/auth/login` and `/auth/refresh`.
 *
 * `expiresAt` is an absolute UNIX-millis timestamp; the HTTP factory uses it
 * to schedule preemptive refreshes (Requirements 5.2, 5.3).
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Absolute expiry of `accessToken`, in unix-millis. Optional for opaque tokens. */
  expiresAt?: number;
}

/**
 * Tenant descriptor returned by the tenant list / current-tenant endpoints
 * (Requirement 4.5: switching tenants triggers menu/permission reload).
 */
export interface Tenant {
  id: string;
  name: string;
  /** Optional logo url shown in the tenant switcher. */
  logo?: string;
}
