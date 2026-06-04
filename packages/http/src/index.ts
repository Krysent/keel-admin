/**
 * Public surface of `@keel/http`.
 *
 * Strict no-`export *` policy (Requirement 2.6) so the API surface stays
 * curated as the package grows across tasks 4.1–4.4.
 */

export { createHttp } from './create-http.ts';
export type { HttpFactoryOptions, RequestExtraConfig } from './types.ts';

export {
  createTokenManager,
  NoRefreshTokenError,
  type RefreshFn,
  type TokenManager,
  type TokenManagerOptions,
} from './token-manager.ts';

export { BizError, isBizError } from './biz-error.ts';

export { computeFingerprint, DEDUPE_HANDLE_KEY, type DedupeHandle } from './dedupe.ts';
