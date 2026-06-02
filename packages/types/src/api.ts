/**
 * Backend response envelope (Requirements 5.4, 11.3, 17.2).
 *
 * The backend wraps every response in this shape:
 *   - `code === 0`  → success, payload is in `data`
 *   - `code !== 0`  → business error; `@keel/http` will throw a `BizError`
 *
 * `traceId` is propagated end-to-end for log correlation; `message` is the
 * human-readable error description (already localised by the backend in most
 * cases, but the frontend still resolves a fallback via i18n when missing).
 */
export interface ApiEnvelope<T = unknown> {
  code: number;
  data: T;
  message: string;
  traceId?: string;
}

/**
 * Generic paginated payload returned by list-style endpoints.
 *
 * Kept separate from `ApiEnvelope` so it composes naturally as
 * `ApiEnvelope<PageResult<User>>`.
 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Pagination request parameters expected by list endpoints.
 *
 * The HTTP layer converts these into query parameters; defaults are owned
 * by the consumer (typically a `useTable` hook) rather than this type.
 */
export interface PageQuery {
  page: number;
  pageSize: number;
}

/**
 * Sort direction enum used by list endpoints.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort descriptor used inside list queries: `{ field: 'createdAt', direction: 'desc' }`.
 */
export interface SortDescriptor {
  field: string;
  direction: SortDirection;
}
