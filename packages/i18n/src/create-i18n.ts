import i18next, { type i18n as I18nInstance } from 'i18next';

import type {
  CreateI18nOptions,
  I18nBackend,
  KeelI18n,
} from './types.js';

/**
 * Default detection order per Requirement 8.1: query > localStorage > navigator.
 *
 * Exported for unit-test introspection only; the factory inlines this when
 * the caller does not supply `options.detectionOrder`.
 */
export const DEFAULT_DETECTION_ORDER: readonly string[] = [
  'querystring',
  'localStorage',
  'navigator',
];

/** Default preload set per Requirement 8.2 — only `common` is synchronous. */
const DEFAULT_PRELOAD_NAMESPACES: readonly string[] = ['common'];

/**
 * Normalize `string | readonly string[]` into a `string[]` we can iterate
 * without re-typing it everywhere. Caller is responsible for not mutating
 * the result if they passed `as const`.
 */
function toArray(ns: string | readonly string[]): string[] {
  return Array.isArray(ns) ? [...ns] : [ns as string];
}

/**
 * Build a minimal i18next-compatible backend module from the loose
 * `I18nBackend` shape consumers (and tests) supply.
 *
 * i18next expects the module to be installed via `i18n.use(...)` *before*
 * `init`, with `type: 'backend'` set so the plugin registry can pick it
 * up. Leaving `read` as a thin pass-through keeps the test seam simple
 * (callers can hand us a `vi.fn()` directly).
 */
function asI18nextBackendModule(
  backend: I18nBackend,
): {
  type: 'backend';
  read: I18nBackend['read'];
} {
  return {
    type: 'backend',
    read: backend.read,
  };
}

/**
 * Create a configured i18next instance plus the `KeelI18n` wrapper.
 *
 * The wrapper layers two pieces of behavior on top of i18next:
 *
 *   1. Idempotent `loadNamespaces`. i18next is already idempotent at the
 *      "don't re-fetch already-loaded resource" level, but tracking the
 *      set explicitly here gives task 6.1's example test a clean,
 *      deterministic signal: "exactly one backend `read` call per
 *      namespace, regardless of how many times we ask for it".
 *
 *   2. A consistent `init` story: if `options.backend` is provided we use
 *      it directly (tests); otherwise the caller must supply `loadPath`
 *      so the HTTP backend can fetch language packs over the network.
 *      Wiring `i18next-http-backend` is deferred to the wider task 6 work
 *      — task 6.1 only needs the lazy-load contract.
 *
 * The returned promise resolves once `init` (and any preload) has
 * completed, so callers can `await createI18n(...)` and immediately
 * trust `t(...)` for preloaded namespaces.
 */
export async function createI18n(
  options: CreateI18nOptions,
): Promise<KeelI18n> {
  const preload =
    options.preloadNamespaces && options.preloadNamespaces.length > 0
      ? [...options.preloadNamespaces]
      : [...DEFAULT_PRELOAD_NAMESPACES];

  // Use a dedicated instance so multiple `createI18n` calls (e.g. one per
  // test) don't fight over the global singleton.
  const instance: I18nInstance = i18next.createInstance();

  if (options.backend) {
    instance.use(asI18nextBackendModule(options.backend));
  }

  await instance.init({
    // Pin the active language to the fallback at init time. The
    // language detector — wired by the wider task 6 work — will swap
    // this on first paint via `changeLanguage`. Without an explicit
    // `lng`, i18next does not seed any namespace because it has no
    // resolved language yet, so `loadNamespaces` for the preload set
    // would silently no-op.
    lng: options.fallbackLng,
    fallbackLng: options.fallbackLng,
    supportedLngs: [...options.supportedLngs],
    ns: preload,
    defaultNS: 'common',
    // Disable Suspense so callers can `await loadNamespaces` and decide
    // when to render — matches the design's "no Suspense in i18n boundary"
    // posture (will be revisited in the React-bound part of task 6).
    react: { useSuspense: false },
    // Inline resources first; the backend (if any) fills in the gaps and
    // future namespaces.
    resources: options.resources ?? {},
    // Without this, supplying any (even empty) `resources` tells i18next
    // the language is fully bundled and the backend is skipped entirely
    // — defeating the lazy-load contract this package is built around.
    // Setting it true makes inline resources additive: anything not
    // already present falls through to the backend.
    partialBundledLanguages: true,
    // The detector is wired up in the wider task 6 work. Stash the value
    // on `init` so it's available to that follow-up without forcing a
    // second `init` call here. i18next ignores unknown keys, so this is
    // a safe forward declaration.
    detection: {
      order: [...(options.detectionOrder ?? DEFAULT_DETECTION_ORDER)],
    },
    // The HTTP backend is wired in the wider task 6 work; for now we just
    // forward the path so a future `instance.use(HttpBackend)` can pick it
    // up without a re-init.
    backend: options.loadPath ? { loadPath: options.loadPath } : undefined,
    // Quiet by default so test output isn't noisy. Apps can flip this on
    // by reaching into `i18next` directly.
    debug: false,
    // Avoid initImmediate so the returned promise truly reflects readiness.
    initImmediate: false,
  });

  // Track which namespaces we've explicitly fetched. Seeded with the
  // preloaded set because i18next has already loaded them as part of init.
  const loaded = new Set<string>(preload);

  const loadNamespaces = async (
    namespaces: string | readonly string[],
  ): Promise<void> => {
    const requested = toArray(namespaces);
    const fresh = requested.filter((ns) => !loaded.has(ns));
    if (fresh.length === 0) {
      return;
    }
    await instance.loadNamespaces(fresh);
    for (const ns of fresh) {
      loaded.add(ns);
    }
  };

  const changeLanguage = async (lng: string): Promise<void> => {
    await instance.changeLanguage(lng);
  };

  return {
    i18next: instance,
    loadNamespaces,
    changeLanguage,
  };
}
