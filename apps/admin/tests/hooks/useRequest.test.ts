/**
 * Unit tests for `useRequest` — generic stale-while-revalidate hook.
 *
 * Validates: Requirement 19.3
 *   WHERE 列表页 THE 系统 SHALL 通过 `useRequest` 提供
 *   stale-while-revalidate 缓存，切回时优先显示缓存
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRequest, clearRequestCache } from '../../src/hooks/useRequest.js';

beforeEach(() => {
  clearRequestCache();
});

describe('useRequest — basic fetching', () => {
  it('returns data from fetchFn on mount', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ name: 'Alice' });

    const { result } = renderHook(() =>
      useRequest({ fetchFn, cacheKey: 'test-basic' }),
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ name: 'Alice' });
    expect(result.current.error).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sets error on fetch failure while keeping stale data', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() =>
      useRequest({ fetchFn, cacheKey: 'test-error' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error?.message).toBe('network error');
  });

  it('uses initialData when no cache exists', async () => {
    const fetchFn = vi.fn().mockResolvedValue('fresh');

    const { result } = renderHook(() =>
      useRequest({
        fetchFn,
        cacheKey: 'test-initial',
        initialData: 'initial',
      }),
    );

    // Initially shows initial data
    expect(result.current.data).toBe('initial');

    await waitFor(() => {
      expect(result.current.data).toBe('fresh');
    });
  });

  it('does not fetch when enabled=false', async () => {
    const fetchFn = vi.fn().mockResolvedValue('data');

    const { result } = renderHook(() =>
      useRequest({ fetchFn, cacheKey: 'test-disabled', enabled: false }),
    );

    // Wait a tick to ensure no async activity
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });
});

describe('useRequest — stale-while-revalidate', () => {
  it('serves cached data immediately on re-mount and revalidates', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      return `response-${callCount}`;
    });

    // First mount — populates cache
    const { result, unmount } = renderHook(() =>
      useRequest({ fetchFn, cacheKey: 'test-swr' }),
    );

    await waitFor(() => {
      expect(result.current.data).toBe('response-1');
    });

    unmount();

    // Second mount — should serve cached data immediately
    const { result: result2 } = renderHook(() =>
      useRequest({ fetchFn, cacheKey: 'test-swr' }),
    );

    // Immediately has cached data (stale)
    expect(result2.current.data).toBe('response-1');
    expect(result2.current.refreshing).toBe(true);

    // After revalidation, fresh data arrives
    await waitFor(() => {
      expect(result2.current.data).toBe('response-2');
      expect(result2.current.refreshing).toBe(false);
    });
  });

  it('refresh() triggers a new fetch', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      return `v${callCount}`;
    });

    const { result } = renderHook(() =>
      useRequest({ fetchFn, cacheKey: 'test-refresh' }),
    );

    await waitFor(() => {
      expect(result.current.data).toBe('v1');
    });

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.data).toBe('v2');
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('mutate() updates data and cache without a fetch', async () => {
    const fetchFn = vi.fn().mockResolvedValue('original');

    const { result } = renderHook(() =>
      useRequest({ fetchFn, cacheKey: 'test-mutate' }),
    );

    await waitFor(() => {
      expect(result.current.data).toBe('original');
    });

    act(() => {
      result.current.mutate('optimistic');
    });

    expect(result.current.data).toBe('optimistic');
    // No additional fetch was triggered
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('useRequest — params handling', () => {
  it('re-fetches when params change', async () => {
    const fetchFn = vi.fn().mockImplementation(
      async (params: { id: number }) => `item-${params.id}`,
    );

    const { result, rerender } = renderHook(
      ({ id }) =>
        useRequest({
          fetchFn,
          cacheKey: 'test-params',
          params: { id },
        }),
      { initialProps: { id: 1 } },
    );

    await waitFor(() => {
      expect(result.current.data).toBe('item-1');
    });

    rerender({ id: 2 });

    await waitFor(() => {
      expect(result.current.data).toBe('item-2');
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('uses separate cache entries for different params', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(
      async (params: { id: number }) => {
        callCount++;
        return `item-${params.id}-call-${callCount}`;
      },
    );

    // Fetch id=1
    const { result, rerender, unmount } = renderHook(
      ({ id }) =>
        useRequest({
          fetchFn,
          cacheKey: 'test-cache-sep',
          params: { id },
        }),
      { initialProps: { id: 1 } },
    );

    await waitFor(() => {
      expect(result.current.data).toBe('item-1-call-1');
    });

    // Switch to id=2
    rerender({ id: 2 });

    await waitFor(() => {
      expect(result.current.data).toBe('item-2-call-2');
    });

    // Switch back to id=1 — should get cached data immediately
    rerender({ id: 1 });
    // Immediately shows cached data for id=1
    expect(result.current.data).toBe('item-1-call-1');
  });
});
