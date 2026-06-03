/**
 * Auth dependency context — the bridge between the bootstrap layer
 * (which knows the concrete `@keel/http` instance, token manager, and
 * service modules) and the login / exception pages, which only need
 * the abstract dependencies declared by `runLoginFlow`.
 *
 * Why a context instead of importing services directly:
 *
 *   - the concrete services live in `apps/admin/src/services/*`
 *     (task 9.5). They depend on a configured `@keel/http` instance
 *     which itself is built at bootstrap time with environment-driven
 *     options. That dependency chain (env → http → services → page)
 *     is awkward to express as a pure import graph because the http
 *     instance is *parametric* over runtime config.
 *   - injecting via context lets the login page render under a stub
 *     provider in tests / Storybook / Playwright without standing up
 *     a real backend.
 *
 * The context value mirrors `LoginDeps` exactly. Pages call
 * `useLoginDeps()` to obtain it and pass it straight through to the
 * orchestration helpers.
 *
 * # Default value
 *
 * The context defaults to `null` so that calling `useLoginDeps()`
 * outside a provider throws a descriptive error rather than silently
 * dispatching against an undefined service. This is the standard
 * "must be inside a provider" guard.
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';

import type { LoginDeps } from './login-flow';

const AuthContext = createContext<LoginDeps | null>(null);

export interface AuthProviderProps {
  /** Bound `LoginDeps` value, typically built once at bootstrap. */
  value: LoginDeps;
  children: ReactNode;
}

/**
 * Provider component for the login dependency bag. Consumers obtain
 * the value via `useLoginDeps()`.
 *
 * Wired into the React tree at bootstrap time:
 *
 *   <AuthProvider value={loginDeps}>
 *     <RouterProvider router={router} />
 *   </AuthProvider>
 */
export function AuthProvider({
  value,
  children,
}: AuthProviderProps): JSX.Element {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * React hook used by the login page (and any other consumer that
 * needs to drive the auth flow programmatically). Throws when used
 * outside an `<AuthProvider />` so a misconfiguration fails fast in
 * development rather than at the first network call.
 */
export function useLoginDeps(): LoginDeps {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      '[auth] useLoginDeps was called outside <AuthProvider>. ' +
        'Wrap your application root in <AuthProvider value={loginDeps}> at bootstrap.',
    );
  }
  return ctx;
}
