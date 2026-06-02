# @keel/types

Cross-package shared TypeScript type definitions for keel-admin. This package contains **no runtime code** — only type declarations.

## Installation

```bash
pnpm add @keel/types
```

## Type Exports

### API Types

| Type | Description |
|------|-------------|
| `ApiEnvelope<T>` | Backend response envelope `{ code, data, message, traceId? }` |
| `PageResult<T>` | Paginated list response `{ list, total, page, pageSize }` |
| `PageQuery` | Pagination request params `{ page, pageSize }` |
| `SortDirection` | `'asc' \| 'desc'` |
| `SortDescriptor` | `{ field: string; direction: SortDirection }` |

### User & Auth Types

| Type | Description |
|------|-------------|
| `UserInfo` | Current user profile (id, name, avatar, roles, etc.) |
| `TokenPair` | `{ accessToken, refreshToken }` |
| `Tenant` | Tenant info (id, name, status) |

### Menu & Navigation

| Type | Description |
|------|-------------|
| `MenuNode` | Menu tree node (path, icon, children, permissionCodes, hidden, redirect) |
| `TabItem` | Multi-tab item (key, title, path, affix, closable) |

### Error Types

| Type | Description |
|------|-------------|
| `BizErrorPayload` | Business error shape (code, message, traceId) |
| `HttpErrorKind` | Union of HTTP error categories |

### Locale Types

| Type | Description |
|------|-------------|
| `LocaleCode` | `'zh-CN' \| 'en-US'` |
| `ThemeMode` | `'light' \| 'dark'` |

## Usage

```ts
import type { ApiEnvelope, UserInfo, MenuNode } from '@keel/types';

async function getUser(): Promise<ApiEnvelope<UserInfo>> {
  return http.get('/user/profile');
}
```

## Design Principles

- **Type as contract**: All `@keel/*` packages import shared types from here. Business code must not re-declare `ApiEnvelope`, `UserInfo`, etc.
- **No runtime**: The built `index.js` is an empty module. Only `index.d.ts` carries the contract.
- **Strict exports**: No `export *`. Each type is explicitly listed to keep the API surface controlled.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
