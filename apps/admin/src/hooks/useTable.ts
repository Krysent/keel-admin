/**
 * `useTable` — table data fetching hook with stale-while-revalidate
 * caching semantics.
 *
 * Provides:
 *   - automatic paginated data fetching via a service function
 *   - stale-while-revalidate: returns cached data immediately on
 *     re-mount (or param change), then revalidates in the background
 *   - pagination state management
 *   - loading / refreshing indicators
 *   - manual refresh / reset helpers
 *
 * The SWR cache is keyed by a caller-supplied `cacheKey` string so
 * multiple table instances (different pages) do not collide.
 *
 * Validates: Requirements 19.3, 20.2
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PageResult } from '@keel/types';

/** Parameters passed to the service fetcher. */
export interface TableFetchParams {
  page: number;
  pageSize: number;
  [key: string]: unknown;
}

export interface UseTableOptions<T, P extends TableFetchParams> {
  /** Async service function that returns paginated data. */
  fetchFn: (params: P) => Promise<PageResult<T>>;
  /** Unique cache key for stale-while-revalidate storage. */
  cacheKey: string;
  /** Default page size. Default: 10. */
  defaultPageSize?: number;
  /** Default page number. Default: 1. */
  defaultPage?: number;
  /** Additional default params merged into every request. */
  defaultParams?: Partial<Omit<P, 'page' | 'pageSize'>>;
}

export interface UseTableReturn<T, P extends TableFetchParams> {
  /** Current data list. May be stale (from cache) until revalidation completes. */
  data: T[];
  /** Total count from the most recent successful response. */
  total: number;
  /** Current page number. */
  page: number;
  /** Current page size. */
  pageSize: number;
  /** True during the initial load (no cached data). */
  loading: boolean;
  /** True when revalidating in the background (stale data is displayed). */
  refreshing: boolean;
  /** Change page / pageSize. Triggers a new fetch. */
  setPagination: (page: number, pageSize: number) => void;
  /** Re-fetch with current params. */
  refresh: () => void;
  /** Update search params and reset to page 1. */
  search: (params: Partial<Omit<P, 'page' | 'pageSize'>>) => void;
  /** Reset to initial state (clears search params, back to page 1). */
  reset: () => void;
  /** Current search params (excludes page/pageSize). */
  searchParams: Partial<Omit<P, 'page' | 'pageSize'>>;
}

/**
 * Simple in-memory SWR cache. Keyed by `cacheKey + serialized params`.
 * Entries have no TTL — they're replaced on each successful fetch.
 */
const swr = new Map<string, { data: unknown[]; total: number }>();

function buildCacheId(cacheKey: string, params: Record<string, unknown>): string {
  return `${cacheKey}:${JSON.stringify(params)}`;
}

/**
 * Generic table hook with stale-while-revalidate caching.
 *
 * On mount (or when params change), if a cached result exists for the
 * same params, it's returned immediately (stale), and a background
 * fetch revalidates the data. The UI can show `refreshing` to hint
 * that fresher data is loading.
 */
export function useTable<T, P extends TableFetchParams = TableFetchParams>(
  options: UseTableOptions<T, P>,
): UseTableReturn<T, P> {
  const { fetchFn, cacheKey, defaultPageSize = 10, defaultPage = 1, defaultParams = {} } = options;

  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(defaultPage);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchParams, setSearchParams] = useState<Partial<Omit<P, 'page' | 'pageSize'>>>(
    defaultParams as Partial<Omit<P, 'page' | 'pageSize'>>,
  );

  // Track the latest request to avoid race conditions.
  const seqRef = useRef(0);

  const doFetch = useCallback(
    (p: number, ps: number, sp: Partial<Omit<P, 'page' | 'pageSize'>>) => {
      const params = { ...sp, page: p, pageSize: ps } as P;
      const cid = buildCacheId(cacheKey, params);

      // SWR: serve cached data immediately if available.
      const cached = swr.get(cid);
      if (cached) {
        setData(cached.data as T[]);
        setTotal(cached.total);
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const seq = ++seqRef.current;

      fetchFn(params)
        .then((result) => {
          // Only apply if this is still the latest request.
          if (seq !== seqRef.current) return;
          setData(result.list);
          setTotal(result.total);
          // Update cache.
          swr.set(cid, { data: result.list, total: result.total });
        })
        .catch(() => {
          // On error, keep stale data if available.
          // Could be extended to surface error state.
        })
        .finally(() => {
          if (seq !== seqRef.current) return;
          setLoading(false);
          setRefreshing(false);
        });
    },
    [fetchFn, cacheKey],
  );

  // Fetch on mount and whenever page/pageSize/searchParams change.
  useEffect(() => {
    doFetch(page, pageSize, searchParams);
  }, [page, pageSize, searchParams, doFetch]);

  const setPagination = useCallback((p: number, ps: number) => {
    setPage(p);
    setPageSize(ps);
  }, []);

  const refresh = useCallback(() => {
    doFetch(page, pageSize, searchParams);
  }, [doFetch, page, pageSize, searchParams]);

  const search = useCallback((params: Partial<Omit<P, 'page' | 'pageSize'>>) => {
    setPage(1);
    setSearchParams(params);
  }, []);

  const reset = useCallback(() => {
    setPage(defaultPage);
    setPageSize(defaultPageSize);
    setSearchParams(defaultParams as Partial<Omit<P, 'page' | 'pageSize'>>);
  }, [defaultPage, defaultPageSize, defaultParams]);

  return {
    data,
    total,
    page,
    pageSize,
    loading,
    refreshing,
    setPagination,
    refresh,
    search,
    reset,
    searchParams,
  };
}
