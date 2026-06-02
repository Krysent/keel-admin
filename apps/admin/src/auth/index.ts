/**
 * Public surface of the admin app's auth module.
 *
 * Strict no-`export *` policy mirroring the `@keel/*` packages — only
 * the pieces consumed by other modules (pages, bootstrap, tests) are
 * listed here.
 *
 * Task 9.4 ships:
 *   - `runLoginFlow` / `runHydrateAfterLogin` — pure orchestration
 *   - `AuthProvider` / `useLoginDeps`         — React injection seam
 *   - the supporting type names                — used by tests and 9.5
 */

export {
  runLoginFlow,
  runHydrateAfterLogin,
  type LoginCredentials,
  type LoginDeps,
  type LoginResult,
  type LoginServices,
  type LoginStoreWriters,
} from './login-flow.js';

export {
  runLogoutFlow,
  type LogoutDeps,
  type LogoutServices,
  type LogoutStoreResetters,
} from './logout-flow.js';

export { AuthProvider, useLoginDeps } from './auth-context.js';
