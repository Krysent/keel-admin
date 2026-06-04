/**
 * Example-based tests for the request-header injection contract.
 *
 * Validates: Requirements 5.9, 18.4
 *
 *   5.9  — WHEN HTTP 请求发出 THEN 系统 SHALL 自动注入 `Authorization`（若有
 *          token）、`X-Tenant-Id`、`Accept-Language` 三个头.
 *   18.4 — WHEN HTTP 请求发出 THEN 系统 SHALL 强制注入 `X-Tenant-Id` 头，
 *          业务代码不得覆盖；该规则适用于所有出站请求，不存在豁免清单.
 *
 * # Why example-based (not PBT)
 *
 * Header injection is an "if X then Y" mapping with a small, finite set
 * of inputs (token present / absent, tenant present / absent, locale
 * present / absent, custom tenant header name, business override
 * attempt). The contract is deterministic per case, so concrete examples
 * are clearer to read and faster to fail-debug than a fast-check
 * generator. PBT shines on quantified universal properties — for header
 * injection there is no productive input space to span beyond what's
 * enumerated here.
 *
 * # Test scaffolding
 *
 * We use an inspecting Axios adapter that captures the final
 * `config.headers` reaching the transport layer. This is the most
 * faithful place to assert because:
 *
 *   - It runs AFTER all request interceptors (so we observe the headers
 *     the framework actually sent).
 *   - It runs BEFORE the response chain (so envelope unwrap and dedupe
 *     cleanup don't get a chance to mutate `response.config`).
 *
 * `tokenManager` is built with `storageKind: 'memory'` so each test gets
 * an isolated state; the refresh callback is a no-op because none of
 * these tests trigger 401 paths.
 */

import { describe, expect, it } from 'vitest';

import { createHttp, createTokenManager, type RefreshFn } from '../src/index.ts';

import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

/**
 * Refresh function never invoked in these tests. Provided only because
 * `createTokenManager` requires one.
 */
const noopRefresh: RefreshFn = async () => ({
  accessToken: 'never',
  refreshToken: 'never',
});

/**
 * Build an Axios instance whose adapter records the final outbound
 * `InternalAxiosRequestConfig` and resolves with an envelope-unwrappable
 * `{ code: 0, ... }` body so the request resolves cleanly and we don't
 * have to interleave error-path assertions with header assertions.
 *
 * The captured config is exposed on the `seen` array — consumers
 * inspect `seen[0].headers` to verify what the framework stamped.
 */
function makeClient(options: {
  baseURL?: string;
  tenantHeader?: string;
  getTenantId?: () => string | null;
  getLocale?: () => 'zh-CN' | 'en-US' | null;
  initialAccess?: string | null;
}) {
  const seen: InternalAxiosRequestConfig[] = [];

  const adapter: AxiosAdapter = async (config) => {
    seen.push(config);
    return {
      data: { code: 0, data: { ok: true }, message: 'ok' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse;
  };

  const tokenManager = createTokenManager({
    refreshFn: noopRefresh,
    storageKind: 'memory',
  });
  if (options.initialAccess) {
    // `set` requires a refreshToken too; supply a placeholder. None of
    // these tests trigger refresh, so the placeholder is never read.
    tokenManager.set({
      accessToken: options.initialAccess,
      refreshToken: 'refresh-placeholder',
    });
  }

  const http = createHttp({
    baseURL: options.baseURL ?? 'http://localhost',
    tokenManager,
    ...(options.tenantHeader !== undefined ? { tenantHeader: options.tenantHeader } : {}),
    ...(options.getTenantId !== undefined ? { getTenantId: options.getTenantId } : {}),
    ...(options.getLocale !== undefined ? { getLocale: options.getLocale } : {}),
  });
  http.defaults.adapter = adapter;

  return { http, seen };
}

/**
 * Helper: read a header off an AxiosHeaders-shaped object. The captured
 * config's `headers` is an `AxiosHeaders` instance at adapter time, so
 * `.get(name)` is the documented accessor; we fall back to a property
 * read for older versions or stub-shaped headers in case of regression.
 */
function readHeader(
  headers: InternalAxiosRequestConfig['headers'],
  name: string,
): string | undefined {
  const fromGet = (headers as { get?: (n: string) => unknown }).get?.(name);
  if (typeof fromGet === 'string') return fromGet;
  const direct = (headers as unknown as Record<string, unknown>)[name];
  return typeof direct === 'string' ? direct : undefined;
}

// ---------------------------------------------------------------------------
//   Authorization header
// ---------------------------------------------------------------------------

describe('header injection — Authorization (Requirement 5.9)', () => {
  it('stamps `Bearer <access>` when the token manager holds an access token', async () => {
    const { http, seen } = makeClient({ initialAccess: 'access-AAA' });
    await http.get('/me');
    expect(readHeader(seen[0]!.headers, 'Authorization')).toBe('Bearer access-AAA');
  });

  it('omits Authorization when no access token is held', async () => {
    const { http, seen } = makeClient({ initialAccess: null });
    await http.get('/public');
    // The framework MUST NOT stamp a header when no token exists. Anything
    // other than `undefined` here would silently authenticate anonymous
    // requests with a stale or empty token.
    expect(readHeader(seen[0]!.headers, 'Authorization')).toBeUndefined();
  });

  it('reflects token rotation between calls (re-reads on every request)', async () => {
    const tokenManager = createTokenManager({
      refreshFn: noopRefresh,
      storageKind: 'memory',
    });
    tokenManager.set({ accessToken: 'first', refreshToken: 'r' });

    const seen: InternalAxiosRequestConfig[] = [];
    const adapter: AxiosAdapter = async (config) => {
      seen.push(config);
      return {
        data: { code: 0, data: null, message: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    };
    const http = createHttp({
      baseURL: 'http://localhost',
      tokenManager,
    });
    http.defaults.adapter = adapter;

    await http.get('/a');
    tokenManager.set({ accessToken: 'second', refreshToken: 'r' });
    await http.get('/b');

    // Per Requirement 5.9 the interceptor must read the token at request
    // time (not bind it once at factory time). This catches the "stale
    // closure" regression.
    expect(readHeader(seen[0]!.headers, 'Authorization')).toBe('Bearer first');
    expect(readHeader(seen[1]!.headers, 'Authorization')).toBe('Bearer second');
  });
});

// ---------------------------------------------------------------------------
//   X-Tenant-Id header (and custom tenant header name)
// ---------------------------------------------------------------------------

describe('header injection — X-Tenant-Id (Requirements 5.9, 18.4)', () => {
  it('uses default header name `X-Tenant-Id` when no override given', async () => {
    const { http, seen } = makeClient({
      getTenantId: () => 'tenant-001',
    });
    await http.get('/orders');
    expect(readHeader(seen[0]!.headers, 'X-Tenant-Id')).toBe('tenant-001');
  });

  it('respects a custom tenantHeader option (e.g. `X-Org-Id`)', async () => {
    const { http, seen } = makeClient({
      tenantHeader: 'X-Org-Id',
      getTenantId: () => 'org-42',
    });
    await http.get('/orders');
    expect(readHeader(seen[0]!.headers, 'X-Org-Id')).toBe('org-42');
    // The default name MUST NOT be stamped when a custom name is in use,
    // otherwise the request would carry both — confusing the gateway.
    expect(readHeader(seen[0]!.headers, 'X-Tenant-Id')).toBeUndefined();
  });

  it('omits the tenant header when getTenantId returns null', async () => {
    const { http, seen } = makeClient({
      getTenantId: () => null,
    });
    await http.get('/health');
    expect(readHeader(seen[0]!.headers, 'X-Tenant-Id')).toBeUndefined();
  });

  it('omits the tenant header when no getTenantId callback is provided', async () => {
    const { http, seen } = makeClient({});
    await http.get('/health');
    expect(readHeader(seen[0]!.headers, 'X-Tenant-Id')).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  //   Requirement 18.4 — framework wins, business cannot override.
  //
  // Two cases matter:
  //   (a) Framework HAS a tenant: an override attempt must be replaced.
  //   (b) Framework has NO tenant: an override attempt must still be
  //       stripped — otherwise a hostile / accidental call could spoof
  //       the tenant by simply passing a header in its config.
  //
  // (a) is the obvious "framework value wins" case; (b) is the easy gap
  // to leave open (pre-task-4.4 implementation only set headers when it
  // had a value, leaving caller-supplied headers intact). Both branches
  // are covered here.
  // -----------------------------------------------------------------------
  it('strips business-supplied X-Tenant-Id and replaces with framework value (Requirement 18.4)', async () => {
    const { http, seen } = makeClient({
      getTenantId: () => 'tenant-real',
    });
    await http.get('/orders', {
      headers: { 'X-Tenant-Id': 'tenant-evil' },
    });
    expect(readHeader(seen[0]!.headers, 'X-Tenant-Id')).toBe('tenant-real');
  });

  it('strips business-supplied X-Tenant-Id even when framework has no tenant (Requirement 18.4)', async () => {
    const { http, seen } = makeClient({
      // No getTenantId — framework has nothing to inject. The override
      // attempt MUST still be removed; this is the "no豁免清单" clause.
    });
    await http.get('/health', {
      headers: { 'X-Tenant-Id': 'tenant-evil' },
    });
    expect(readHeader(seen[0]!.headers, 'X-Tenant-Id')).toBeUndefined();
  });

  it('strips business override when a custom tenantHeader is configured', async () => {
    const { http, seen } = makeClient({
      tenantHeader: 'X-Org-Id',
      getTenantId: () => 'org-99',
    });
    await http.get('/orders', {
      headers: { 'X-Org-Id': 'org-evil' },
    });
    expect(readHeader(seen[0]!.headers, 'X-Org-Id')).toBe('org-99');
  });
});

// ---------------------------------------------------------------------------
//   Accept-Language header
// ---------------------------------------------------------------------------

describe('header injection — Accept-Language (Requirement 5.9)', () => {
  it('stamps the locale returned by getLocale', async () => {
    const { http, seen } = makeClient({
      getLocale: () => 'zh-CN',
    });
    await http.get('/me');
    expect(readHeader(seen[0]!.headers, 'Accept-Language')).toBe('zh-CN');
  });

  it('reflects locale changes between calls (re-reads on every request)', async () => {
    let current: 'zh-CN' | 'en-US' = 'zh-CN';
    const { http, seen } = makeClient({
      getLocale: () => current,
    });
    await http.get('/a');
    current = 'en-US';
    await http.get('/b');
    expect(readHeader(seen[0]!.headers, 'Accept-Language')).toBe('zh-CN');
    expect(readHeader(seen[1]!.headers, 'Accept-Language')).toBe('en-US');
  });

  it('omits Accept-Language when getLocale returns null', async () => {
    const { http, seen } = makeClient({
      getLocale: () => null,
    });
    await http.get('/me');
    expect(readHeader(seen[0]!.headers, 'Accept-Language')).toBeUndefined();
  });

  it('omits Accept-Language when no getLocale callback is provided', async () => {
    const { http, seen } = makeClient({});
    await http.get('/me');
    expect(readHeader(seen[0]!.headers, 'Accept-Language')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
//   All-three combined (smoke)
// ---------------------------------------------------------------------------

describe('header injection — combined Authorization + tenant + locale', () => {
  it('stamps all three headers in a single request when all sources are populated', async () => {
    const { http, seen } = makeClient({
      initialAccess: 'access-XYZ',
      getTenantId: () => 'tenant-7',
      getLocale: () => 'en-US',
    });
    await http.get('/dashboard');
    const h = seen[0]!.headers;
    expect(readHeader(h, 'Authorization')).toBe('Bearer access-XYZ');
    expect(readHeader(h, 'X-Tenant-Id')).toBe('tenant-7');
    expect(readHeader(h, 'Accept-Language')).toBe('en-US');
  });
});
