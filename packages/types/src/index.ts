/**
 * Public surface of `@keel/types`.
 *
 * This package contains *only* type declarations — no runtime values. Once the
 * `tsup` build runs the emitted `index.js` / `index.cjs` are empty modules and
 * `index.d.ts` carries the contract.
 *
 * Re-exports are explicit (no `export *`) so we can curate the API surface
 * over time — see Requirement 2.6 ("Type as contract").
 */

export type {
  ApiEnvelope,
  PageResult,
  PageQuery,
  SortDirection,
  SortDescriptor,
} from './api.js';

export type { UserInfo, TokenPair, Tenant } from './user.js';

export type { MenuNode, TabItem } from './menu.js';

export type { BizErrorPayload, HttpErrorKind } from './error.js';

export type { LocaleCode, ThemeMode } from './locale.js';
