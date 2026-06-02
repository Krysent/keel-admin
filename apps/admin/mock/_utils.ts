/**
 * Mock utilities — enforces the backend envelope contract for all mock handlers.
 *
 * Every mock response MUST pass through `wrap()` to guarantee the
 * `{ code, data, message }` shape (Requirement 11.3).
 *
 * Validates: Requirements 11.3, 11.5
 */

import type { ApiEnvelope } from '@keel/types';

/**
 * Wrap arbitrary data in the standard backend envelope.
 *
 * @param data - The payload to wrap (becomes `envelope.data`)
 * @param options - Optional overrides for code/message
 */
export function wrap<T>(
  data: T,
  options?: { code?: number; message?: string },
): ApiEnvelope<T> {
  return {
    code: options?.code ?? 0,
    data,
    message: options?.message ?? 'ok',
  };
}

/**
 * Create an error envelope (code !== 0).
 */
export function wrapError(
  code: number,
  message: string,
  data: unknown = null,
): ApiEnvelope<unknown> {
  return {
    code,
    data,
    message,
  };
}

/**
 * Paginated response helper.
 */
export function wrapPage<T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number,
): ApiEnvelope<{ list: T[]; total: number; page: number; pageSize: number }> {
  return wrap({ list, total, page, pageSize });
}
