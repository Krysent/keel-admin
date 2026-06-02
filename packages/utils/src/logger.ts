/**
 * Lightweight leveled logger.
 *
 * Wraps `console` with a level threshold and an optional namespace prefix
 * so packages and apps share a consistent log format. The level is dynamic
 * (`setLevel`) so tests / runtime toggles can mute output without
 * reconstructing the logger.
 *
 * Why not pull in `pino` / `winston`?  `@keel/utils` is consumed by browser
 * code and we want zero runtime dependencies; the `console` API is
 * universally available and the formatting demands here are minimal.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export interface LoggerOptions {
  /** Prefix tag, shown as `[namespace]` in output. Optional. */
  namespace?: string;
  /** Initial log level. Defaults to `info`. */
  level?: LogLevel;
  /**
   * Sink override — useful for piping to a remote logging service in tests.
   * Defaults to the global `console`.
   */
  sink?: Pick<Console, 'debug' | 'info' | 'warn' | 'error' | 'log'>;
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  /** Switch the threshold at runtime. */
  setLevel(level: LogLevel): void;
  /** Read the current threshold. */
  getLevel(): LogLevel;
  /** Derive a child logger with a sub-namespace, e.g. `logger.child('http')`. */
  child(namespace: string): Logger;
}

/**
 * Build a logger.
 *
 * @example
 *   const log = createLogger({ namespace: 'http', level: 'debug' });
 *   log.info('GET', url);
 *   log.child('refresh').warn('retrying');
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  let currentLevel: LogLevel = options.level ?? 'info';
  const sink = options.sink ?? console;
  const baseNs = options.namespace;

  const enabled = (level: Exclude<LogLevel, 'silent'>): boolean =>
    LEVEL_RANK[level] >= LEVEL_RANK[currentLevel];

  const tag = (level: LogLevel): string =>
    baseNs ? `[${baseNs}] [${level}]` : `[${level}]`;

  return {
    debug(...args) {
      if (enabled('debug')) sink.debug(tag('debug'), ...args);
    },
    info(...args) {
      if (enabled('info')) sink.info(tag('info'), ...args);
    },
    warn(...args) {
      if (enabled('warn')) sink.warn(tag('warn'), ...args);
    },
    error(...args) {
      if (enabled('error')) sink.error(tag('error'), ...args);
    },
    setLevel(level) {
      currentLevel = level;
    },
    getLevel() {
      return currentLevel;
    },
    child(namespace) {
      const composed = baseNs ? `${baseNs}:${namespace}` : namespace;
      // Share the *same* sink and (mutable) level reference is intentional:
      // a parent `setLevel` should not affect children, so we snapshot here.
      return createLogger({
        ...(composed !== undefined ? { namespace: composed } : {}),
        level: currentLevel,
        sink,
      });
    },
  };
}

/**
 * Default shared logger. Apps may import this for ad-hoc logging; library
 * packages should prefer `createLogger({ namespace: '<pkg>' })` so output is
 * tagged.
 */
export const logger = createLogger({ namespace: 'keel' });
