/**
 * Ambient typing for the Vite-only `import.meta.glob` API used by
 * `src/pages/_async.ts` (task 9.4).
 *
 * Why a hand-rolled declaration instead of `vite/client`:
 *   The `apps/admin` package currently does not depend on Vite — task 12
 *   wires the build pipeline. Pulling `vite/client` into the type root just
 *   to satisfy `import.meta.glob` would force vite into devDependencies
 *   ahead of when the rest of the build setup lands. A minimal local
 *   declaration keeps the type surface tight; once task 12 introduces
 *   Vite the file can be deleted in favor of `/// <reference types="vite/client" />`.
 *
 * Shape mirrors Vite's runtime behaviour for the *lazy* form (no `eager`)
 * which is the only one task 9.4 uses:
 *   `import.meta.glob('/src/pages/**\/*.tsx')` → `{ [path]: () => Promise<Module> }`
 */

interface ImportGlobLazyModule {
  default: import('react').ComponentType;
  [key: string]: unknown;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT?: string;
  readonly VITE_USE_MOCK?: string;
  readonly VITE_AUTH_STORAGE?: string;
  readonly VITE_TENANT_HEADER?: string;
  readonly VITE_APP_NAME?: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  /** Lazy form: returns `{ path → () => Promise<Module> }`. */
  glob(
    pattern: string | readonly string[],
  ): Record<string, () => Promise<ImportGlobLazyModule>>;
}
