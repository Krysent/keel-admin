/**
 * Storage adapter — a thin abstraction over `localStorage` / `sessionStorage`
 * with an in-memory fallback for environments where neither is available
 * (SSR, web workers without storage access, sandboxed iframes, tests).
 *
 * Drives Requirement 18.1 (`VITE_AUTH_STORAGE` switch between
 * localStorage / sessionStorage / memory) and Requirement 6.5/6.6 (only
 * persist explicitly opted-in slices).
 *
 * Values are JSON-serialised. Reads validate JSON and silently fall back to
 * `null` on parse errors so a malformed entry from a previous app version
 * cannot crash boot — we treat the entry as "absent" and let the caller
 * re-hydrate from defaults.
 */

export type StorageKind = 'local' | 'session' | 'memory';

/** Minimal interface implemented by `localStorage`, `sessionStorage`, and our memory fallback. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

/** A typed key/value store layered on top of a `StorageLike` backend. */
export interface Storage {
  /** Underlying backend (useful for debug). */
  readonly kind: StorageKind;
  /** Read and JSON-parse a value. Returns `null` on miss or parse error. */
  get<T = unknown>(key: string): T | null;
  /** JSON-serialise and write a value. Returns `false` if the backend rejected the write (e.g. quota). */
  set<T = unknown>(key: string, value: T): boolean;
  /** Remove a single key. */
  remove(key: string): void;
  /** Wipe the entire backend (memory: only this instance; web: shared across tabs!). */
  clear(): void;
  /** True iff the key exists with a syntactically valid value. */
  has(key: string): boolean;
}

/**
 * Build an in-memory `StorageLike`. Each call returns a fresh map, useful
 * for tests so storage state doesn't leak between cases.
 */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

/**
 * Resolve a `StorageLike` for the requested kind, falling back to memory if
 * the platform doesn't expose web storage (SSR / tests / privacy-locked
 * browsers). The fallback is deliberate — callers must not assume
 * persistence; `Storage.kind` lets them detect downgrades when needed.
 */
export function resolveBackend(kind: StorageKind): { backend: StorageLike; effective: StorageKind } {
  if (kind === 'memory') {
    return { backend: createMemoryStorage(), effective: 'memory' };
  }
  // `globalThis` is used so this works in both the DOM and Node-like envs.
  const g = globalThis as { localStorage?: StorageLike; sessionStorage?: StorageLike };
  const candidate = kind === 'local' ? g.localStorage : g.sessionStorage;
  if (candidate && isUsable(candidate)) {
    return { backend: candidate, effective: kind };
  }
  return { backend: createMemoryStorage(), effective: 'memory' };
}

/**
 * Some browsers (Safari private mode, iframe sandboxes) expose `localStorage`
 * but throw on `setItem`. We probe with a no-op write to detect this.
 */
function isUsable(storage: StorageLike): boolean {
  const probe = '__keel_probe__';
  try {
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a typed `Storage` instance backed by the chosen kind.
 *
 * @example
 *   const auth = createStorage('local');
 *   auth.set('tokens', { accessToken, refreshToken });
 *   const tokens = auth.get<TokenPair>('tokens');
 */
export function createStorage(kind: StorageKind = 'local'): Storage {
  const { backend, effective } = resolveBackend(kind);

  return {
    kind: effective,
    get<T = unknown>(key: string): T | null {
      const raw = backend.getItem(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        // Malformed value — treat as missing rather than crashing the caller.
        return null;
      }
    },
    set<T = unknown>(key: string, value: T): boolean {
      try {
        backend.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        // Quota exceeded, disabled storage, etc. Caller can fall back.
        return false;
      }
    },
    remove(key: string): void {
      backend.removeItem(key);
    },
    clear(): void {
      backend.clear();
    },
    has(key: string): boolean {
      const raw = backend.getItem(key);
      if (raw === null) return false;
      try {
        JSON.parse(raw);
        return true;
      } catch {
        return false;
      }
    },
  };
}
