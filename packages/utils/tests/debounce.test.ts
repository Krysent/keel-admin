import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { debounce } from '../src/debounce.ts';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes once after the wait window elapses', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    d('b');
    d('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c'); // most-recent-wins
  });

  it('flush() fires immediately and clears pending state', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('x');
    expect(d.pending()).toBe(true);
    d.flush();
    expect(fn).toHaveBeenCalledWith('x');
    expect(d.pending()).toBe(false);
    // Subsequent timer tick should NOT trigger another invocation.
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel() drops pending invocation', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('x');
    d.cancel();
    expect(d.pending()).toBe(false);
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush() with no pending call is a no-op', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('clamps negative wait to zero', () => {
    const fn = vi.fn();
    const d = debounce(fn, -50);
    d('x');
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
