/**
 * Public surface of `@keel/auth`.
 *
 * Strict no-`export *` policy (Requirement 2.6) so the API surface stays
 * curated as the package grows.
 *
 * Task 5.1 — pure semantic evaluator + supporting types.
 * Task 5   — adds `createAuth`, `usePermission`, `Auth`, `AuthGuard`,
 *            `buildRoutes` (React-bound; layered on top of the same
 *            `evaluatePermission` exported here).
 */

export { evaluatePermission } from './evaluate.js';

export {
  buildRoutes,
  STATIC_FALLBACK_PATHS,
} from './build-routes.js';

export type {
  AuthAdapter,
  PermissionCode,
  PermissionContext,
  PermissionMode,
} from './types.js';

export type {
  BuildRoutesContext,
  StaticFallbackPath,
} from './build-routes.js';
