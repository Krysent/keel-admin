/**
 * Business permission code constants dictionary.
 *
 * This file is the authoritative source of truth for all permission codes
 * used in the admin application. Per the design doc's "机制 vs 数据" split:
 *
 *   - `@keel/auth` provides the *mechanism* (usePermission, Auth, buildRoutes)
 *   - This file provides the *data* (the concrete `'order:delete'` etc. strings)
 *
 * Each SaaS product defines its own permission codes here; the shared auth
 * package never imports this file and remains generic.
 *
 * Convention: `DOMAIN:ACTION` format, lowercase, colon-separated.
 *
 * Validates: Requirement 3.2
 */

export const PERMISSIONS = {
  ORDER: {
    LIST: 'order:list',
    CREATE: 'order:create',
    UPDATE: 'order:update',
    DELETE: 'order:delete',
    EXPORT: 'order:export',
  },
  USER: {
    LIST: 'user:list',
    CREATE: 'user:create',
    UPDATE: 'user:update',
    DELETE: 'user:delete',
  },
  MENU: {
    LIST: 'menu:list',
    CREATE: 'menu:create',
    UPDATE: 'menu:update',
    DELETE: 'menu:delete',
  },
  TENANT: {
    SWITCH: 'tenant:switch',
    LIST: 'tenant:list',
  },
  SYSTEM: {
    SETTINGS: 'system:settings',
  },
} as const;

/**
 * Utility type: extracts the literal union of all permission code values.
 * Useful for exhaustive type checks in tests and mock data.
 */
export type PermissionCode =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS][keyof (typeof PERMISSIONS)[keyof typeof PERMISSIONS]];
