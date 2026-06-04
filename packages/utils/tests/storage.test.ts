import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStorage, resolveBackend } from '../src/storage.ts';

describe('createStorage', () => {
  describe('memory backend', () => {
    it('round-trips primitive and object values', () => {
      const s = createStorage('memory');
      expect(s.kind).toBe('memory');
      s.set('a', 1);
      s.set('b', { nested: true, list: [1, 2] });
      expect(s.get<number>('a')).toBe(1);
      expect(s.get('b')).toEqual({ nested: true, list: [1, 2] });
    });

    it('returns null for missing keys', () => {
      const s = createStorage('memory');
      expect(s.get('missing')).toBeNull();
      expect(s.has('missing')).toBe(false);
    });

    it('returns false when JSON.stringify fails (e.g. circular structure)', () => {
      const circular: { self?: unknown } = {};
      circular.self = circular;
      const s = createStorage('memory');
      const ok = s.set('circular', circular);
      expect(ok).toBe(false);
    });

    it('remove deletes a single key without affecting others', () => {
      const s = createStorage('memory');
      s.set('keep', 'yes');
      s.set('drop', 'no');
      s.remove('drop');
      expect(s.get('keep')).toBe('yes');
      expect(s.get('drop')).toBeNull();
    });

    it('clear wipes all entries', () => {
      const s = createStorage('memory');
      s.set('a', 1);
      s.set('b', 2);
      s.clear();
      expect(s.get('a')).toBeNull();
      expect(s.get('b')).toBeNull();
    });
  });

  describe('local backend resolution', () => {
    const realLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;

    afterEach(() => {
      if (realLocalStorage === undefined) {
        delete (globalThis as { localStorage?: unknown }).localStorage;
      } else {
        (globalThis as { localStorage?: unknown }).localStorage = realLocalStorage;
      }
    });

    it('falls back to memory when localStorage is absent', () => {
      delete (globalThis as { localStorage?: unknown }).localStorage;
      const s = createStorage('local');
      expect(s.kind).toBe('memory');
      s.set('x', 1);
      expect(s.get('x')).toBe(1);
    });

    it('falls back to memory when localStorage rejects writes (private mode)', () => {
      const throwing = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          throw new Error('quota exceeded');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      (globalThis as { localStorage?: unknown }).localStorage = throwing;
      const { effective } = resolveBackend('local');
      expect(effective).toBe('memory');
    });

    it('uses localStorage when usable', () => {
      // Simulate a working localStorage with a Map under the hood.
      const map = new Map<string, string>();
      const fake = {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => {
          map.set(k, v);
        },
        removeItem: (k: string) => {
          map.delete(k);
        },
        clear: () => {
          map.clear();
        },
      };
      (globalThis as { localStorage?: unknown }).localStorage = fake;
      const s = createStorage('local');
      expect(s.kind).toBe('local');
      s.set('hello', 'world');
      expect(map.get('hello')).toBe(JSON.stringify('world'));
    });
  });
});
