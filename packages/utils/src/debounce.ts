/**
 * `debounce(fn, wait)` — defer execution until `wait` ms have elapsed since
 * the last invocation. Used by the search form, layout resize listeners, and
 * any place where we'd otherwise fire-hose downstream code.
 *
 * Choices that differ from naive implementations:
 *   - `flush()` invokes immediately with the most recent args, useful for
 *     "blur" handlers that should commit pending input.
 *   - `cancel()` discards a pending call without firing.
 *   - `pending()` is provided so React effects can coordinate cleanup.
 *   - The trailing call uses the *last* args (most-recent-wins), matching
 *     lodash semantics that users already expect.
 */

export interface DebouncedFunction<Args extends unknown[]> {
  (...args: Args): void;
  /** Fire any pending invocation immediately. No-op if none queued. */
  flush(): void;
  /** Discard any pending invocation. No-op if none queued. */
  cancel(): void;
  /** True while a trailing call is queued. */
  pending(): boolean;
}

/**
 * @param fn   the function to wrap
 * @param wait debounce window in milliseconds (must be ≥ 0)
 *
 * Negative `wait` is clamped to `0`, which degrades to "next tick" behaviour
 * — preferred over throwing because most callers compute `wait` from
 * config and a misconfigured `0` is safer than a runtime crash.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait: number,
): DebouncedFunction<Args> {
  const safeWait = Math.max(0, wait);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;

  function invoke(): void {
    const args = lastArgs;
    timer = null;
    lastArgs = null;
    if (args !== null) fn(...args);
  }

  const debounced = ((...args: Args) => {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(invoke, safeWait);
  }) as DebouncedFunction<Args>;

  debounced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      invoke();
    }
  };
  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      lastArgs = null;
    }
  };
  debounced.pending = () => timer !== null;

  return debounced;
}
