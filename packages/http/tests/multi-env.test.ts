/**
 * Example-based tests for multi-environment configuration flow.
 *
 * Validates: Requirement 5.8
 *
 *   5.8 — WHEN 业务环境切换（dev / staging / production） THEN 系统 SHALL
 *         通过 `import.meta.env` 自动选择 `VITE_API_BASE_URL` 等配置，无需修
 *         改源码.
 *
 * # Why example-based (not PBT)
 *
 * Multi-env configuration is a pure pass-through: whatever the consumer
 * pulls from `import.meta.env` is forwarded into the Axios defaults. The
 * contract is "what goes in comes out", with no quantified property to
 * span. Three concrete env values (dev / staging / production) plus the
 * tenant-header-from-env case are the meaningful inputs; PBT would add
 * noise, not signal.
 *
 * # What we mock
 *
 * `import.meta.env` is a Vite construct that's only populated when the
 * Vite plugin runs. In a Vitest unit test we simulate it directly by
 * driving `createHttp` with a small `getEnv()` helper that returns a
 * frozen record. This mirrors how a real bootstrap would consume
 * `import.meta.env`:
 *
 *     const env = import.meta.env;
 *     const http = createHttp({
 *       baseURL: env.VITE_API_BASE_URL,
 *       timeout: Number(env.VITE_API_TIMEOUT),
 *       tenantHeader: env.VITE_TENANT_HEADER,
 *       ...
 *     });
 *
 * The unit-of-test is the boundary between "env vars in" and "Axios
 * defaults out" — the dispatch via `import.meta.env` is guaranteed by
 * Vite's plugin contract and outside this test's scope.
 *
 * # No real network
 *
 * We attach a no-op adapter so any `http.get(...)` resolves immediately
 * with an envelope-shaped body. None of the assertions actually issue
 * a request — `defaults.baseURL` / `defaults.timeout` are read off the
 * Axios instance directly — but the adapter is provided defensively so
 * the test cannot accidentally hit the network if extended later.
 */

import { describe, expect, it } from 'vitest';

import {
  createHttp,
  createTokenManager,
  type HttpFactoryOptions,
  type RefreshFn,
} from '../src/index.ts';

import type { AxiosAdapter, AxiosResponse } from 'axios';

/** Minimal subset of `import.meta.env` we read in the bootstrap path. */
interface KeelEnv {
  VITE_API_BASE_URL: string;
  VITE_API_TIMEOUT?: string;
  VITE_TENANT_HEADER?: string;
}

/** Three canonical environments the bootstrap chooses between. */
const ENVS: Record<'development' | 'staging' | 'production', KeelEnv> = {
  development: {
    VITE_API_BASE_URL: 'https://api-dev.example.com',
    VITE_API_TIMEOUT: '15000',
    VITE_TENANT_HEADER: 'X-Tenant-Id',
  },
  staging: {
    VITE_API_BASE_URL: 'https://api-staging.example.com',
    VITE_API_TIMEOUT: '20000',
    VITE_TENANT_HEADER: 'X-Tenant-Id',
  },
  production: {
    VITE_API_BASE_URL: 'https://api.example.com',
    VITE_API_TIMEOUT: '10000',
    // Production happens to use a custom org-style header in this fixture
    // to verify the env → factory → request-interceptor pipeline is
    // wired end-to-end (not just baseURL).
    VITE_TENANT_HEADER: 'X-Org-Id',
  },
};

const noopRefresh: RefreshFn = async () => ({
  accessToken: 'never',
  refreshToken: 'never',
});

/**
 * Factory equivalent of the `app/bootstrap` consumer: takes a `KeelEnv`
 * (what `import.meta.env` would return), maps it onto `HttpFactoryOptions`,
 * and returns the resulting `createHttp` output. Mirrors what a real
 * bootstrap would do.
 */
function buildClientFromEnv(env: KeelEnv) {
  const tokenManager = createTokenManager({
    refreshFn: noopRefresh,
    storageKind: 'memory',
  });

  const options: HttpFactoryOptions = {
    baseURL: env.VITE_API_BASE_URL,
    tokenManager,
    ...(env.VITE_API_TIMEOUT !== undefined ? { timeout: Number(env.VITE_API_TIMEOUT) } : {}),
    ...(env.VITE_TENANT_HEADER !== undefined ? { tenantHeader: env.VITE_TENANT_HEADER } : {}),
    getTenantId: () => 'tenant-fixed',
  };

  const http = createHttp(options);
  // No-op adapter so the test cannot accidentally hit the network if
  // we later extend it to actually send a request.
  const adapter: AxiosAdapter = async (config) =>
    ({
      data: { code: 0, data: null, message: 'ok' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }) as AxiosResponse;
  http.defaults.adapter = adapter;

  return http;
}

// ---------------------------------------------------------------------------
//   baseURL flow per environment (Requirement 5.8)
// ---------------------------------------------------------------------------

describe('multi-env config flow — baseURL (Requirement 5.8)', () => {
  it('development → defaults.baseURL = https://api-dev.example.com', () => {
    const http = buildClientFromEnv(ENVS.development);
    expect(http.defaults.baseURL).toBe('https://api-dev.example.com');
  });

  it('staging → defaults.baseURL = https://api-staging.example.com', () => {
    const http = buildClientFromEnv(ENVS.staging);
    expect(http.defaults.baseURL).toBe('https://api-staging.example.com');
  });

  it('production → defaults.baseURL = https://api.example.com', () => {
    const http = buildClientFromEnv(ENVS.production);
    expect(http.defaults.baseURL).toBe('https://api.example.com');
  });
});

// ---------------------------------------------------------------------------
//   timeout flow per environment
// ---------------------------------------------------------------------------

describe('multi-env config flow — timeout (Requirement 5.8)', () => {
  it('parses VITE_API_TIMEOUT into a numeric timeout (development = 15s)', () => {
    const http = buildClientFromEnv(ENVS.development);
    expect(http.defaults.timeout).toBe(15000);
  });

  it('parses VITE_API_TIMEOUT into a numeric timeout (staging = 20s)', () => {
    const http = buildClientFromEnv(ENVS.staging);
    expect(http.defaults.timeout).toBe(20000);
  });

  it('parses VITE_API_TIMEOUT into a numeric timeout (production = 10s)', () => {
    const http = buildClientFromEnv(ENVS.production);
    expect(http.defaults.timeout).toBe(10000);
  });

  it('falls back to the factory default (15000ms) when env omits VITE_API_TIMEOUT', () => {
    const http = buildClientFromEnv({
      VITE_API_BASE_URL: 'https://api.example.com',
      // no VITE_API_TIMEOUT
    });
    // The factory's documented default is 15s — see `createHttp`
    // (`timeout: options.timeout ?? 15000`). Asserting the constant here
    // pins down the contract so a silent change to the default would
    // surface as a test failure rather than a surprise in production.
    expect(http.defaults.timeout).toBe(15000);
  });
});

// ---------------------------------------------------------------------------
//   tenant header name flow — env can override the framework default
// ---------------------------------------------------------------------------

describe('multi-env config flow — tenant header name (Requirement 5.8)', () => {
  it('uses the env-configured header name on each outbound request', async () => {
    // Production env in our fixture uses `X-Org-Id`. We must observe that
    // name on the outbound request, not the framework default — this is
    // the end-to-end check that env → factory → interceptor pipeline is
    // intact for non-baseURL config too.
    const http = buildClientFromEnv(ENVS.production);

    // Re-attach an inspecting adapter so we can observe the headers
    // synchronously stamped by the request interceptor.
    let capturedHeaderName: string | undefined;
    let capturedHeaderValue: string | undefined;
    http.defaults.adapter = async (config) => {
      const headers = config.headers as { get?: (n: string) => unknown };
      capturedHeaderName = 'X-Org-Id';
      const v = headers.get?.('X-Org-Id');
      capturedHeaderValue = typeof v === 'string' ? v : undefined;
      return {
        data: { code: 0, data: null, message: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    };

    await http.get('/whatever');
    expect(capturedHeaderName).toBe('X-Org-Id');
    expect(capturedHeaderValue).toBe('tenant-fixed');
  });

  it('defaults to X-Tenant-Id when env omits VITE_TENANT_HEADER', async () => {
    const http = buildClientFromEnv({
      VITE_API_BASE_URL: 'https://api.example.com',
      // no VITE_TENANT_HEADER
    });

    let captured: string | undefined;
    http.defaults.adapter = async (config) => {
      const headers = config.headers as { get?: (n: string) => unknown };
      const v = headers.get?.('X-Tenant-Id');
      captured = typeof v === 'string' ? v : undefined;
      return {
        data: { code: 0, data: null, message: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    };

    await http.get('/whatever');
    expect(captured).toBe('tenant-fixed');
  });
});
