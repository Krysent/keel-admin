/**
 * Public surface of `@keel/utils`.
 *
 * Framework-agnostic utilities shared across `@keel/*` packages and the
 * business app. Strict no-`export *` policy (Requirement 2.6) so the API
 * surface stays curated.
 */

export {
  createStorage,
  createMemoryStorage,
  resolveBackend,
  type Storage,
  type StorageKind,
  type StorageLike,
} from './storage.js';

export { createLogger, logger, type Logger, type LoggerOptions, type LogLevel } from './logger.js';

export {
  createEventBus,
  type EventBus,
  type EventMap,
  type Listener,
} from './event-bus.js';

export { debounce, type DebouncedFunction } from './debounce.js';

export { stableHash, canonicalize } from './stable-hash.js';
