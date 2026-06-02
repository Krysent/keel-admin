/**
 * `useRequest` — generic data-fetching hook with stale-while-revalidate
 * (SWR) caching semantics.
 *
 * Unlike `useTable` (which is paginated-table-specific), `useRequest` is
 * a general-purpose hook for any async API call. It works like this:
 *
 *   1. On mount (or when `params` / `cacheKey` change), if a cached
 *      result exists for the same cache key, return it immediately
 *      (stale) while triggering a background revalidation.
 *   2. Once the fresh response arrives, update both the cache and the
 *      returned data.
 *   3. On error, keep stale data if available and surface the error.
 *
 * This gives list pages an instant "switch-back" feel — the user sees
 * cached data immediately when navigating back to a previously visited
 * page, and the data refreshes silently in the background.
 *
 * Validates: Requirement 19.3
 *   WHERE 列表页 THE 系统 SHALL 通过 `useRequest` 提供
 *   stale-while-revalidate 缓存，切回时优先显示缓存
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseRequestOptions<T, P = void> {
  /**
   * Async function that fetches data. Receives `params` as its argument.
   */
  fetchFn: (params: P) => Promise<T>;

  /**
   * Unique key used for the SWR cache. Changing this key clears the
   * hook's association with the previous cached entry and triggers a
   * fresh fetch for the new key.
   */
  cacheKey: string;

  /**
   * Parameters passed to `fetchFn`. When these change (by shallow
   * serialization), a new fetch is triggered.
   */
  params?: P;

  /**
   * If `false`, the hook will not fetch on mount or on params change.
   * Useful for conditional fetching (e.g. wait until some dependency is
   * ready). Default: `true`.
   */
  enabled?: boolean;

  /**
   * Initial data to use before the first successful fetch.
   * If provided AND no cache entry exists, this is returned as `data`.
   */
  initialData?: T;
}

export interface UseRequestReturn<T> {
  /** Current data (may be stale until revalidation completes). */
  data: T | undefined;
  /** True during the initial load (no cached or initial data). */
  loading: boolean;
  /** True when revalidating in the background while stale data is shown. */
  refreshing: boolean;
  /** The most recent error, or `null` if the last fetch succeeded. */
  error: Error | null;
  /** Manually trigger a refetch with the current params. */
  refresh: () => void;
  /** Manually mutate the cached data (optimistic update). */
  mutate: (data: T) => void;
}

// ---------------------------------------------------------------------------
// Global in-memory SWR cache (module-scoped, never persisted)
// ---------------------------------------------------------------------------

const swrCache = new Map<string, unknown>();

/**
 * Build a deterministic cache identifier from the cacheKey + params.
 */
function buildCacheId<P>(cacheKey: string, params: P): string {
  if (params === undefined || params === null) return cacheKey;
  try {
    return `${cacheKey}:${JSON.stringify(params)}`;
  } catch {
    return cacheKey;
  }
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * Generic stale-while-revalidate data fetching hook.
 *
 * @example
 * ```tsx
 * const { data, loading, refresh } = useRequest({
 *   fetchFn: () => userService.getProfile(),
 *   cacheKey: 'user-profile',
 * });
 * ```
 *
 * @example
 * ```tsx
 * const { data, loading } = useRequest({
 *   fetchFn: (params) => orderService.getDetail(params.id),
 *   cacheKey: 'order-detail',
 *   params: { id: orderId },
 * });
 * ```
 */
export function useRequest<T, P = void>(
  options: UseRequestOptions<T, P>,
): UseRequestReturn<T> {
  const {
    fetchFn,
    cacheKey,
    params,
    enabled = true,
    initialData,
  } = options;

  const cid = buildCacheId(cacheKey, params);
  const cached = swrCache.get(cid) as T | undefined;

  const [data, setData] = useState<T | undefined>(
    cached ?? initialData,
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Sequence counter to discard stale responses.
  const seqRef = useRef(0);
  // Keep latest options in a ref so callbacks always have fresh values.
  const optRef = useRef(options);
  optRef.current = options;

  const doFetch = useCallback(() => {
    const currentCid = buildCacheId(
      optRef.current.cacheKey,
      optRef.current.params,
    );
    const existingCache = swrCache.get(currentCid) as T | undefined;

    if (existingCache !== undefined) {
      setData(existingCache);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const seq = ++seqRef.current;

    optRef.current
      .fetchFn(optRef.current.params as P)
      .then((result) => {
        if (seq !== seqRef.current) return;
        setData(result);
        setError(null);
        swrCache.set(currentCid, result);
      })
      .catch((err: unknown) => {
        if (seq !== seqRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        // Keep stale data on error so the UI doesn't flash empty.
      })
      .finally(() => {
        if (seq !== seqRef.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  // Fetch when enabled and when cid changes.
  useEffect(() => {
    if (!enabled) return;
    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, enabled]);

  const refresh = useCallback(() => {
    doFetch();
  }, [doFetch]);

  const mutate = useCallback(
    (newData: T) => {
      setData(newData);
      const currentCid = buildCacheId(
        optRef.current.cacheKey,
        optRef.current.params,
      );
      swrCache.set(currentCid, newData);
    },
    [],
  );

  return { data, loading, refreshing, error, refresh, mutate };
}

/**
 * Clear all entries from the SWR cache. Useful for testing or on logout.
 */
export function clearRequestCache(): void {
  swrCache.clear();
}
