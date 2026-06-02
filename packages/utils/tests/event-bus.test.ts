import { describe, expect, it, vi } from 'vitest';

import { createEventBus } from '../src/event-bus.js';

interface Events extends Record<string, unknown> {
  'auth:logout': void;
  'tab:close': { key: string };
  ping: number;
}

describe('createEventBus', () => {
  it('delivers payloads to listeners synchronously', () => {
    const bus = createEventBus<Events>();
    const spy = vi.fn();
    bus.on('tab:close', spy);
    bus.emit('tab:close', { key: 'home' });
    expect(spy).toHaveBeenCalledWith({ key: 'home' });
  });

  it('returns an unsubscribe thunk from on()', () => {
    const bus = createEventBus<Events>();
    const spy = vi.fn();
    const off = bus.on('ping', spy);
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('once() fires exactly one time and detaches before invoking', () => {
    const bus = createEventBus<Events>();
    const spy = vi.fn();
    bus.once('ping', () => {
      spy();
      // Re-emit while inside the handler — should not loop.
      bus.emit('ping', 99);
    });
    bus.emit('ping', 1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('off() removes a specific listener without affecting others', () => {
    const bus = createEventBus<Events>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('ping', a);
    bus.on('ping', b);
    bus.off('ping', a);
    bus.emit('ping', 7);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith(7);
  });

  it('clear() with no args wipes everything; with an event arg wipes one', () => {
    const bus = createEventBus<Events>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('ping', a);
    bus.on('auth:logout', b);
    bus.clear('ping');
    bus.emit('ping', 1);
    bus.emit('auth:logout', undefined);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);

    bus.clear();
    bus.emit('auth:logout', undefined);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('snapshots listeners at emit-time so subscribe-during-emit does not fire same emit', () => {
    const bus = createEventBus<Events>();
    const newcomer = vi.fn();
    bus.on('ping', () => {
      bus.on('ping', newcomer);
    });
    bus.emit('ping', 1);
    expect(newcomer).not.toHaveBeenCalled();
    bus.emit('ping', 2);
    expect(newcomer).toHaveBeenCalledWith(2);
  });

  it('isolates listener errors so siblings still run', () => {
    const bus = createEventBus<Events>();
    const survivor = vi.fn();
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', survivor);
    expect(() => bus.emit('ping', 42)).not.toThrow();
    expect(survivor).toHaveBeenCalledWith(42);
  });

  it('listenerCount reflects active subscriptions', () => {
    const bus = createEventBus<Events>();
    expect(bus.listenerCount('ping')).toBe(0);
    const off1 = bus.on('ping', () => {});
    bus.on('ping', () => {});
    expect(bus.listenerCount('ping')).toBe(2);
    off1();
    expect(bus.listenerCount('ping')).toBe(1);
  });
});
