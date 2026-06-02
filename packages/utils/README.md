# @keel/utils

Framework-agnostic utility functions shared across all `@keel/*` packages and business applications.

## Installation

```bash
pnpm add @keel/utils
```

## API

### `createStorage(kind: StorageKind): Storage`

Creates a typed key-value storage adapter.

```ts
import { createStorage } from '@keel/utils';

const storage = createStorage('localStorage');
storage.set('token', 'abc123');
storage.get<string>('token'); // 'abc123'
storage.remove('token');
```

Supports `'localStorage'`, `'sessionStorage'`, and `'memory'`.

### `createMemoryStorage(): StorageLike`

In-memory storage (useful for SSR or testing).

### `createLogger(options?: LoggerOptions): Logger`

Structured logger with level control.

```ts
import { logger } from '@keel/utils';

logger.info('User logged in', { userId: 123 });
logger.warn('Slow request', { duration: 5000 });
logger.error('Failed', error);
```

### `createEventBus<T extends EventMap>(): EventBus<T>`

Type-safe event emitter.

```ts
import { createEventBus } from '@keel/utils';

type Events = { logout: void; themeChange: 'light' | 'dark' };
const bus = createEventBus<Events>();

bus.on('logout', () => { /* ... */ });
bus.emit('themeChange', 'dark');
```

### `debounce<T>(fn: T, ms: number): DebouncedFunction<T>`

Standard debounce with cancel support.

```ts
import { debounce } from '@keel/utils';

const search = debounce((q: string) => fetch(`/search?q=${q}`), 300);
search('hello');
search.cancel();
```

### `stableHash(value: unknown): string`

Deterministic hash of any JSON-serializable value. Used internally for request fingerprinting.

```ts
import { stableHash } from '@keel/utils';

stableHash({ b: 2, a: 1 }) === stableHash({ a: 1, b: 2 }); // true
```

### `canonicalize(value: unknown): string`

Deterministic JSON stringification (sorted keys).

## Exports

| Export | Description |
|--------|-------------|
| `createStorage` | Storage adapter factory |
| `createMemoryStorage` | In-memory storage |
| `resolveBackend` | Resolve storage kind string to implementation |
| `createLogger` / `logger` | Logger factory + default instance |
| `createEventBus` | Type-safe event bus |
| `debounce` | Debounce utility |
| `stableHash` / `canonicalize` | Deterministic hashing |

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
