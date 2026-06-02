/**
 * Vitest setup file — runs before any test module is imported.
 *
 * Installs a default in-memory `localStorage` / `sessionStorage` shim so the
 * Zustand stores' persist middleware can resolve `() => localStorage`
 * without a `ReferenceError` when running in node. Individual test files
 * still call `installLocalStorage()` in `beforeEach` to get a fresh
 * backend per case (state isolation).
 */

import { installLocalStorage } from './setup-local-storage.js';

installLocalStorage();
