# @keel/http

HTTP factory for keel-admin: configurable Axios instance with single-flight token refresh, request deduplication, business envelope unwrap, and automatic header injection.

## Installation

```bash
pnpm add @keel/http
# peer dependency
pnpm add axios
```

## API

### `createHttp(options: HttpFactoryOptions): AxiosInstance`

Creates a configured Axios instance with all interceptors attached.

```ts
import { createHttp, createTokenManager } from '@keel/http';

const tokenManager = createTokenManager({
  storage: localStorage,
  refreshFn: async (refreshToken) => {
    const res = await fetch('/auth/refresh', { ... });
    return res.json(); // { accessToken, refreshToken }
  },
});

const http = createHttp({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  tokenManager,
  tenantId: () => currentTenantId,
  locale: () => currentLocale,
});
```

### `createTokenManager(options: TokenManagerOptions): TokenManager`

Token lifecycle manager with single-flight refresh guarantee.

- Persists `accessToken` / `refreshToken` to the configured storage backend
- On 401: triggers refresh exactly once (single-flight), queues concurrent requests
- `onAuthExpired` callback for redirect-to-login handling

```ts
const tm = createTokenManager({
  storage: localStorage,
  refreshFn: async (rt) => ({ accessToken: '...', refreshToken: '...' }),
  onAuthExpired: () => router.push('/login'),
});

tm.getAccessToken();   // string | null
tm.setTokens({ accessToken, refreshToken });
tm.clear();
```

### `BizError`

Thrown when the backend envelope returns `code !== 0`.

```ts
import { BizError, isBizError } from '@keel/http';

try {
  await http.get('/orders');
} catch (e) {
  if (isBizError(e)) {
    console.log(e.code, e.message, e.traceId);
  }
}
```

### `computeFingerprint(config: AxiosRequestConfig): string`

Generates a deduplication fingerprint from `method + url + sorted(params) + stableHash(body)`.

### Request Deduplication

Enabled by default. Same-fingerprint requests in-flight are cancelled with `CanceledError`. Opt out per-request:

```ts
http.get('/data', { allowConcurrent: true });
```

### Automatic Headers

Every outbound request automatically receives:

- `Authorization: Bearer <token>` (if token available)
- `X-Tenant-Id: <tenantId>`
- `Accept-Language: <locale>`

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
