/**
 * Tiny typed pub/sub bus.
 *
 * Used by the layout shell to react to cross-module events (logout, theme
 * change, tab close requests) without coupling stores to each other.
 *
 * Events are typed via a string-keyed map so consumers get full payload
 * inference at the call site:
 *
 *   interface Events {
 *     'auth:logout': void;
 *     'tab:close': { key: string };
 *   }
 *   const bus = createEventBus<Events>();
 *   bus.on('tab:close', e => console.log(e.key));
 *
 * Listeners are stored in a `Set` so the same callback registered twice only
 * fires once — matching DOM `EventTarget` semantics. Each `on()` returns an
 * unsubscribe function for ergonomic cleanup inside React effects.
 */

export type EventMap = Record<string, unknown>;

export type Listener<Payload> = (payload: Payload) => void;

export interface EventBus<E extends EventMap> {
  /** Subscribe. Returns an unsubscribe thunk. */
  on<K extends keyof E>(event: K, listener: Listener<E[K]>): () => void;
  /** Subscribe once — listener is removed before invocation. */
  once<K extends keyof E>(event: K, listener: Listener<E[K]>): () => void;
  /** Remove a specific listener. No-op if not registered. */
  off<K extends keyof E>(event: K, listener: Listener<E[K]>): void;
  /** Fan out to all current listeners synchronously. */
  emit<K extends keyof E>(event: K, payload: E[K]): void;
  /** Drop *all* listeners (or all listeners for one event). Useful in tests. */
  clear<K extends keyof E>(event?: K): void;
  /** Listener count for an event, primarily for test introspection. */
  listenerCount<K extends keyof E>(event: K): number;
}

export function createEventBus<E extends EventMap>(): EventBus<E> {
  const registry = new Map<keyof E, Set<Listener<unknown>>>();

  function listenersOf<K extends keyof E>(event: K): Set<Listener<unknown>> {
    let set = registry.get(event);
    if (!set) {
      set = new Set();
      registry.set(event, set);
    }
    return set;
  }

  return {
    on(event, listener) {
      const set = listenersOf(event);
      set.add(listener as Listener<unknown>);
      return () => {
        set.delete(listener as Listener<unknown>);
      };
    },
    once(event, listener) {
      const wrapper: Listener<unknown> = (payload) => {
        // Detach *before* invoking so synchronous re-emits don't loop.
        listenersOf(event).delete(wrapper);
        (listener as Listener<unknown>)(payload);
      };
      listenersOf(event).add(wrapper);
      return () => {
        listenersOf(event).delete(wrapper);
      };
    },
    off(event, listener) {
      registry.get(event)?.delete(listener as Listener<unknown>);
    },
    emit(event, payload) {
      const set = registry.get(event);
      if (!set || set.size === 0) return;
      // Snapshot first: a listener may unsubscribe (or subscribe) during fan-out.
      const snapshot = Array.from(set);
      for (const fn of snapshot) {
        try {
          fn(payload);
        } catch {
          // Swallow listener errors so one rogue subscriber doesn't break the rest.
          // Logging here would create a circular dep with `@keel/utils/logger`,
          // so we deliberately stay silent — the bus is a notification channel,
          // not a transactional pipeline.
        }
      }
    },
    clear(event) {
      if (event === undefined) {
        registry.clear();
      } else {
        registry.delete(event);
      }
    },
    listenerCount(event) {
      return registry.get(event)?.size ?? 0;
    },
  };
}
