/**
 * Public types for `@keel/i18n`.
 *
 * The factory keeps i18next as the runtime engine but wraps it in a
 * minimal, opinionated surface so the admin app talks to one shape:
 * `createI18n(options) → KeelI18n`.
 *
 * Task 6.1 only needs `CreateI18nOptions` and `KeelI18n.loadNamespaces`;
 * the remaining fields are forward-declared so the wider task 6 surface
 * (`I18nProvider`, `useT`) can layer on top without reshaping the API.
 *
 * Kept in a separate module so `create-i18n.ts` can import only the types
 * that matter, and so consumers can `import type { ... }` cheaply.
 */

import type { i18n as I18nInstance } from 'i18next';

/**
 * Backend object accepted by `CreateI18nOptions.backend`.
 *
 * Matches the contract i18next expects from a backend module
 * (`{ type: 'backend', read(lng, ns, callback) }`). Declared loosely so
 * tests can pass a `vi.fn()` without pulling in
 * `i18next-http-backend`'s internal types.
 *
 * `type` defaults to `'backend'` if omitted (the wrapper sets it).
 */
export interface I18nBackend {
  type?: 'backend';
  read: (
    language: string,
    namespace: string,
    callback: (
      error: unknown,
      data: Record<string, unknown> | null | false,
    ) => void,
  ) => void;
}

/**
 * Options accepted by `createI18n`.
 *
 * Only `fallbackLng` and `supportedLngs` are required at this point; the
 * rest cover the wiring needed by Requirement 8.x (`detectionOrder`,
 * `loadPath`, etc.) and the test seam (`backend`, `resources`).
 */
export interface CreateI18nOptions {
  /** Default language used when detection fails or the detected one is unsupported. */
  fallbackLng: string;
  /** White-list of languages the app accepts. */
  supportedLngs: readonly string[];
  /**
   * HTTP backend URL template, e.g. `/locales/{{lng}}/{{ns}}.json`.
   * Optional — leave undefined when supplying a custom `backend` (tests).
   */
  loadPath?: string;
  /**
   * Custom backend module. Overrides `loadPath` when provided. Used by
   * tests to count `read` invocations without spinning up a server.
   */
  backend?: I18nBackend;
  /**
   * Detection order for `i18next-browser-languagedetector`.
   * Defaults to `['querystring', 'localStorage', 'navigator']`
   * per Requirement 8.1.
   */
  detectionOrder?: readonly string[];
  /**
   * Pre-loaded resources by language → namespace → key → value.
   * Useful for shipping the `common` bundle inline so the first paint
   * doesn't wait on the backend.
   */
  resources?: Record<string, Record<string, Record<string, string>>>;
  /**
   * Namespaces to load synchronously during `init`.
   * Defaults to `['common']` per Requirement 8.2.
   */
  preloadNamespaces?: readonly string[];
}

/**
 * Public surface returned by `createI18n`.
 *
 * Task 6.1 only consumes `loadNamespaces`; `i18next` is exposed as a
 * deliberate escape hatch (advanced use cases, `Trans` component, etc.)
 * and `changeLanguage` is forwarded so callers don't reach into the
 * underlying instance for the common case.
 */
export interface KeelI18n {
  /** Underlying i18next instance for advanced usage. */
  i18next: I18nInstance;
  /**
   * Pre-load one or more namespaces.
   *
   * Idempotent — calling twice for the same namespace triggers the
   * backend exactly once. Returns once all requested namespaces are
   * available (already-loaded ones resolve immediately).
   */
  loadNamespaces: (namespaces: string | readonly string[]) => Promise<void>;
  /** Change the active language. Resolves once i18next finishes the swap. */
  changeLanguage: (lng: string) => Promise<void>;
}
