/**
 * Unit tests for CSRF token injection in the request interceptor.
 *
 * Validates: Requirement 18.3 — when the backend requires CSRF the system
 * SHALL read the `csrf-token` cookie and inject it as the `X-CSRF-Token`
 * header on every outgoing request.
 *
 * Uses the same inspecting-adapter pattern as headers.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

import { createHttp, createTokenManager, type RefreshFn } from '../src/index.js';

const noopRefresh: RefreshFn = async () => ({
  accessToken: 'never',
  refreshToken: 'never',
});

/**
 * Helper: read a header off an AxiosHeaders-shaped object.
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

function makeClient(options: {
  csrf?: boolean;
  csrfCookieName?: string;
  csrfHeaderName?: string;
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

  const http = createHttp({
    baseURL: 'http://localhost',
    tokenManager,
    csrf: options.csrf,
    csrfCookieName: options.csrfCookieName,
    csrfHeaderName: options.csrfHeaderName,
  });
  http.defaults.adapter = adapter;

  return { http, seen };
}

// Store original document.cookie descriptor so we can restore it
const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis.document ?? {}, 'cookie') ??
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(globalThis.document ?? {}), 'cookie');

describe('CSRF token injection (Requirement 18.3)', () => {
  afterEach(() => {
    // Restore document.cookie to its default behaviour.
    // In jsdom/node test environments document may not exist; we just
    // need to ensure our overrides don't leak between tests.
    if (typeof globalThis.document !== 'undefined' && originalDescriptor) {
      Object.defineProperty(globalThis.document, 'cookie', originalDescriptor);
    }
  });

  function setCookie(value: string) {
    Object.defineProperty(globalThis, 'document', {
      value: { cookie: value },
      writable: true,
      configurable: true,
    });
  }

  it('injects X-CSRF-Token header from csrf-token cookie when csrf=true', async () => {
    setCookie('other=abc; csrf-token=my-csrf-value; session=xyz');

    const { http, seen } = makeClient({ csrf: true });
    await http.get('/test');

    expect(readHeader(seen[0]!.headers, 'X-CSRF-Token')).toBe('my-csrf-value');
  });

  it('uses custom cookie and header names', async () => {
    setCookie('my-csrf=custom-value');

    const { http, seen } = makeClient({
      csrf: true,
      csrfCookieName: 'my-csrf',
      csrfHeaderName: 'X-My-Csrf',
    });
    await http.get('/test');

    expect(readHeader(seen[0]!.headers, 'X-My-Csrf')).toBe('custom-value');
  });

  it('does not inject CSRF header when csrf=false (default)', async () => {
    setCookie('csrf-token=should-not-appear');

    const { http, seen } = makeClient({ csrf: false });
    await http.get('/test');

    expect(readHeader(seen[0]!.headers, 'X-CSRF-Token')).toBeUndefined();
  });

  it('does not inject CSRF header when csrf option is not provided', async () => {
    setCookie('csrf-token=should-not-appear');

    const { http, seen } = makeClient({});
    await http.get('/test');

    expect(readHeader(seen[0]!.headers, 'X-CSRF-Token')).toBeUndefined();
  });

  it('does not inject CSRF header when cookie is absent', async () => {
    setCookie('other=value');

    const { http, seen } = makeClient({ csrf: true });
    await http.get('/test');

    expect(readHeader(seen[0]!.headers, 'X-CSRF-Token')).toBeUndefined();
  });

  it('handles URL-encoded cookie values', async () => {
    setCookie('csrf-token=value%20with%20spaces');

    const { http, seen } = makeClient({ csrf: true });
    await http.get('/test');

    expect(readHeader(seen[0]!.headers, 'X-CSRF-Token')).toBe('value with spaces');
  });

  it('handles absent document (SSR/non-browser) gracefully', async () => {
    // Temporarily remove document
    const savedDoc = globalThis.document;
    // @ts-expect-error -- intentionally removing for test
    delete globalThis.document;

    try {
      const { http, seen } = makeClient({ csrf: true });
      await http.get('/test');

      expect(readHeader(seen[0]!.headers, 'X-CSRF-Token')).toBeUndefined();
    } finally {
      globalThis.document = savedDoc;
    }
  });
});
