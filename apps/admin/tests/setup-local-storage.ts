/**
 * Test helper: install an in-memory `localStorage` / `sessionStorage` shim
 * on `globalThis` before the store modules are imported.
 *
 * Why a setup file instead of `environment: 'jsdom'`?
 *   - Task 9.1 only ships pure data slices; pulling in jsdom is a
 *     150ms+ per-test cost we don't need yet.
 *   - The stores rely on web-storage *semantics* (string in, string out,
 *     `JSON.parse` validity), which `createMemoryStorage` from
 *     `@keel/utils` already implements.
 *
 * The shim is installed exactly **once** by `tests/setup.ts` (referenced
 * via `vitest.config.ts > setupFiles`). Reinstalling between tests would
 * desync from Zustand's persist middleware, which captures the storage
 * reference at module-load time inside `createJSONStorage`.
 *
 * Per-test isolation is achieved by `clearLocalStorage()` instead — it
 * wipes the same backing map without replacing the reference.
 */

import { createMemoryStorage, type StorageLike } from '@keel/utils';

let installedBackend: StorageLike | null = null;

/**
 * Install the in-memory storage shim. Idempotent — calling it more than
 * once returns the same backing instance, so persisted state survives
 * the call. Use `clearLocalStorage()` between tests for isolation.
 */
export function installLocalStorage(): StorageLike {
  if (installedBackend) return installedBackend;
  installedBackend = createMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: installedBackend,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: installedBackend,
    configurable: true,
    writable: true,
  });
  return installedBackend;
}

/**
 * Wipe the installed shim's contents without replacing the reference.
 * This is the right primitive to call from `beforeEach` so persist
 * middleware that captured the reference at module-load time keeps
 * working while the test gets a clean storage state.
 */
export function clearLocalStorage(): void {
  if (!installedBackend) {
    installLocalStorage();
    return;
  }
  installedBackend.clear();
}

/** Read the underlying installed backend for direct assertions. */
export function getInstalledStorage(): StorageLike {
  return installLocalStorage();
}
