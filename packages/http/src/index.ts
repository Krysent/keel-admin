/**
 * Public surface of `@keel/http`.
 *
 * Strict no-`export *` policy (Requirement 2.6) so the API surface stays
 * curated as the package grows across tasks 4.1–4.4.
 */

export { createHttp } from './create-http.js';
export type { HttpFactoryOptions, RequestExtraConfig } from './types.js';

export {
  createTokenManager,
  NoRefreshTokenError,
  type RefreshFn,
  type TokenManager,
  type TokenManagerOptions,
} from './token-manager.js';

export { BizError, isBizError } from './biz-error.js';

export {
  computeFingerprint,
  DEDUPE_HANDLE_KEY,
  type DedupeHandle,
} from './dedupe.js';
