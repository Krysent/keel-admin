import { describe, expect, it } from 'vitest';

import { canonicalize, stableHash } from '../src/stable-hash.ts';

describe('stableHash', () => {
  it('is stable for primitive equality', () => {
    expect(stableHash(1)).toBe(stableHash(1));
    expect(stableHash('a')).toBe(stableHash('a'));
    expect(stableHash(true)).toBe(stableHash(true));
    expect(stableHash(null)).toBe(stableHash(null));
  });

  it('separates by type so 1 !== "1"', () => {
    expect(stableHash(1)).not.toBe(stableHash('1'));
  });

  it('is invariant to object key order', () => {
    const a = stableHash({ a: 1, b: 2, c: 3 });
    const b = stableHash({ c: 3, a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('is sensitive to array order', () => {
    expect(stableHash([1, 2, 3])).not.toBe(stableHash([3, 2, 1]));
  });

  it('treats deeply equal but key-shuffled objects as identical', () => {
    const a = stableHash({ x: { p: 1, q: [1, 2] }, y: 'hello' });
    const b = stableHash({ y: 'hello', x: { q: [1, 2], p: 1 } });
    expect(a).toBe(b);
  });

  it('treats different content as different (high-confidence sanity check)', () => {
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
    expect(stableHash([1, 2, 3])).not.toBe(stableHash([1, 2]));
  });

  it('does not throw on cyclic structures', () => {
    const obj: { self?: unknown; data: number } = { data: 42 };
    obj.self = obj;
    expect(() => stableHash(obj)).not.toThrow();
  });

  it('skips undefined values in objects (matching JSON.stringify)', () => {
    expect(stableHash({ a: 1, b: undefined })).toBe(stableHash({ a: 1 }));
  });

  it('preserves null vs undefined vs missing distinction at the value level', () => {
    expect(stableHash({ a: null })).not.toBe(stableHash({}));
    expect(stableHash({ a: undefined })).toBe(stableHash({})); // undefined is dropped
  });

  it('canonicalize emits a deterministic string usable as a Map key', () => {
    const k1 = canonicalize({ a: 1, b: 2 });
    const k2 = canonicalize({ b: 2, a: 1 });
    expect(k1).toBe(k2);
  });

  it('returns an 8-character lowercase hex digest', () => {
    expect(stableHash({ a: 1 })).toMatch(/^[0-9a-f]{8}$/);
  });

  it('differentiates Date and RegExp from plain objects', () => {
    const d1 = stableHash(new Date(0));
    const d2 = stableHash(new Date(1));
    expect(d1).not.toBe(d2);
    const r1 = stableHash(/foo/i);
    const r2 = stableHash(/foo/g);
    expect(r1).not.toBe(r2);
  });
});
