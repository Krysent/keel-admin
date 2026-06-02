/**
 * Stable, deterministic hashing of arbitrary JSON-like values.
 *
 * Used by `@keel/http` to build the request fingerprint
 * `method + url + sorted(params) + stableHash(body)` (Requirements 5.6, 5.7).
 *
 * Properties we deliberately guarantee:
 *   - **Object key order is irrelevant.** `{a:1,b:2}` and `{b:2,a:1}` hash
 *     to the same value. This is what makes "same body, different field
 *     order" requests collapse into one fingerprint.
 *   - **Array order *is* significant.** Arrays preserve order — swapping
 *     elements produces a different hash, matching list semantics.
 *   - **Cycles are tolerated.** A back-edge is replaced with a `[Cycle]`
 *     marker so we never blow the stack on circular structures.
 *   - **`undefined` and functions are skipped** in objects (matching
 *     `JSON.stringify`), but `null` is preserved so it's distinct from
 *     "absent".
 *
 * The output is a deterministic string suitable for use as a Map key.
 * It's *not* cryptographically secure — collisions are vanishingly unlikely
 * for our inputs but not adversary-proof. That's fine: a deduper that
 * occasionally lets a collision slip through is no worse than a cache miss.
 */

/**
 * Build a canonical string representation of a JSON-like value, where
 * object keys are sorted alphabetically at every level.
 */
export function canonicalize(value: unknown): string {
  const seen = new WeakSet<object>();
  return walk(value, seen);
}

function walk(value: unknown, seen: WeakSet<object>): string {
  if (value === null) return 'null';

  // Primitives: rely on the JS string coercion of typeof + value.
  // We tag with type so number 1 doesn't collide with string '1'.
  switch (typeof value) {
    case 'string':
      return `s:${JSON.stringify(value)}`;
    case 'number':
      return Number.isFinite(value) ? `n:${value}` : `n:${String(value)}`; // covers NaN/±Infinity
    case 'boolean':
      return `b:${value}`;
    case 'bigint':
      return `bi:${value.toString()}`;
    case 'undefined':
      return 'u';
    case 'function':
    case 'symbol':
      // Non-serialisable — stringify enough info that swapping symbols
      // changes the hash, but don't attempt round-trippable encoding.
      return `${typeof value}:${String(value)}`;
  }

  // From here on, value is an object (incl. arrays).
  const obj = value as object;
  if (seen.has(obj)) return '[Cycle]';
  seen.add(obj);

  if (Array.isArray(value)) {
    return `a:[${value.map((v) => walk(v, seen)).join(',')}]`;
  }

  // Date / RegExp special cases — without them they'd serialise as `{}`.
  if (value instanceof Date) return `d:${value.getTime()}`;
  if (value instanceof RegExp) return `r:${value.toString()}`;

  // Plain object: sort keys for canonical order.
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = record[k];
    // Match JSON.stringify: skip undefined / functions / symbols at top level.
    if (v === undefined) continue;
    if (typeof v === 'function' || typeof v === 'symbol') continue;
    parts.push(`${JSON.stringify(k)}:${walk(v, seen)}`);
  }
  return `o:{${parts.join(',')}}`;
}

/**
 * Compute a 32-bit FNV-1a hash of the canonical form, returned as a
 * lowercase hex string. Cheap, deterministic, no dependencies.
 *
 * For request-fingerprint use, returning hex (not the raw canonical string)
 * keeps the resulting Map key short and avoids accidentally embedding
 * sensitive request bodies into log messages.
 */
export function stableHash(value: unknown): string {
  const input = canonicalize(value);
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply, kept inside Math.imul to avoid float drift.
    hash = Math.imul(hash, 0x01000193);
  }
  // Coerce to unsigned 32-bit, then hex.
  return (hash >>> 0).toString(16).padStart(8, '0');
}
