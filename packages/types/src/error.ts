/**
 * HTTP / business error shapes shared between `@keel/http` and consumers.
 *
 * The concrete `BizError` *class* (which extends `Error`) lives in
 * `@keel/http` — but the *shape* of its serialised form is declared here so
 * other packages can pattern-match on it without taking a runtime dependency
 * on http.
 */
export interface BizErrorPayload {
  code: number;
  message: string;
  traceId?: string;
}

/**
 * A coarse classification of fatal errors emitted by the HTTP layer.
 *
 * Useful for global error boundaries that want to render different fallback
 * UI per category (Requirement 17.4).
 */
export type HttpErrorKind =
  | 'network'
  | 'timeout'
  | 'business'
  | 'auth'
  | 'forbidden'
  | 'canceled'
  | 'unknown';
