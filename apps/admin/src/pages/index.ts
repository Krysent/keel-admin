/**
 * Public surface of the admin app's `pages/` module.
 *
 * Strict no-`export *` policy mirroring the rest of the codebase.
 *
 * Task 9.4 ships:
 *   - `resolveLazyPage` / `createLazyPageResolver` — used by `buildRoutes`
 *     in the bootstrap layer to turn `MenuNode.component` keys into
 *     `<React.lazy>` components (Requirement 19.1).
 *   - `LoginPage` / `Forbidden403` / `NotFound404` — the static pages
 *     plumbed into the four required fallback paths
 *     (`/login`, `/exception/403`, `/exception/404`, `*` —
 *     Requirement 4.8).
 *
 * Page components are exported as default-named imports so the bootstrap
 * file can pass them directly to `buildRoutes`'s `fallbackElements`
 * without importing each page individually.
 */

export {
  candidatePathsFor,
  createLazyPageResolver,
  lookupPagePath,
  resolveLazyPage,
  type PageModulesMap,
} from './_async.js';

export { default as LoginPage } from './login/index.js';
export { default as Forbidden403 } from './exception/403.js';
export { default as NotFound404 } from './exception/404.js';
