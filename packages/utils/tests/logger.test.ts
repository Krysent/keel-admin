import { describe, expect, it, vi } from 'vitest';

import { createLogger, type LogLevel } from '../src/logger.js';

function fakeSink() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  };
}

describe('createLogger', () => {
  it('respects the level threshold', () => {
    const sink = fakeSink();
    const log = createLogger({ namespace: 'test', level: 'warn', sink });
    log.debug('skip');
    log.info('skip');
    log.warn('keep');
    log.error('keep');
    expect(sink.debug).not.toHaveBeenCalled();
    expect(sink.info).not.toHaveBeenCalled();
    expect(sink.warn).toHaveBeenCalledTimes(1);
    expect(sink.error).toHaveBeenCalledTimes(1);
  });

  it('embeds the namespace in every emitted entry', () => {
    const sink = fakeSink();
    const log = createLogger({ namespace: 'http', level: 'debug', sink });
    log.info('hello');
    expect(sink.info).toHaveBeenCalledWith('[http] [info]', 'hello');
  });

  it('omits namespace tagging when none is provided', () => {
    const sink = fakeSink();
    const log = createLogger({ level: 'debug', sink });
    log.info('hello');
    expect(sink.info).toHaveBeenCalledWith('[info]', 'hello');
  });

  it('updates threshold via setLevel', () => {
    const sink = fakeSink();
    const log = createLogger({ level: 'silent', sink });
    log.error('muted');
    expect(sink.error).not.toHaveBeenCalled();
    log.setLevel('debug');
    log.error('audible');
    expect(sink.error).toHaveBeenCalledTimes(1);
  });

  it('child() composes namespaces and inherits the current level', () => {
    const sink = fakeSink();
    const parent = createLogger({ namespace: 'pkg', level: 'warn', sink });
    const child = parent.child('http');
    child.warn('boom');
    expect(sink.warn).toHaveBeenCalledWith('[pkg:http] [warn]', 'boom');
    // After parent changes level, the *existing* child's level is independent (snapshot semantics).
    parent.setLevel('debug');
    child.debug('not visible');
    expect(sink.debug).not.toHaveBeenCalled();
  });

  it('exposes the current level via getLevel', () => {
    const log = createLogger({ level: 'info' });
    expect(log.getLevel()).toBe('info');
    const next: LogLevel = 'error';
    log.setLevel(next);
    expect(log.getLevel()).toBe(next);
  });
});
