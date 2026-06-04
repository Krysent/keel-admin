/**
 * Vitest setup file — runs before any test module is imported.
 *
 * Installs a default in-memory `localStorage` / `sessionStorage` shim so the
 * Zustand stores' persist middleware can resolve `() => localStorage`
 * without a `ReferenceError` when running in node. Individual test files
 * still call `installLocalStorage()` in `beforeEach` to get a fresh
 * backend per case (state isolation).
 *
 * Also imports `@testing-library/jest-dom` to register custom matchers
 * (e.g. `toBeInTheDocument`) used in component tests. This must be
 * imported here (not per-test-file) so that Vitest picks up the extended
 * `expect` before any assertion runs.
 */

import '@testing-library/jest-dom';
import { installLocalStorage } from './setup-local-storage.ts';

installLocalStorage();
