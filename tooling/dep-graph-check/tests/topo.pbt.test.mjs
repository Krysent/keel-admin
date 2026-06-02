/**
 * Property-based tests for the dependency-graph utilities.
 *
 * Validates: Requirements 1.4 — "IF any cycle exists between packages/* THEN
 * the system SHALL detect it in CI and block the merge". The CI scanner relies
 * on `topologicalSort` / `findCycle` being correct on arbitrary graphs, so we
 * pin down their core invariant here:
 *
 *   topologicalSort(nodes, edges) !== null    ⟺    !hasCycle(nodes, edges)
 *
 * Plus three supporting properties that any future refactor must preserve:
 *
 *   - the returned order is a valid linearisation (every edge u→v has u before v)
 *   - the returned order is a permutation of `nodes`
 *   - findCycle, when it returns a cycle, returns one whose every consecutive
 *     pair is an actual edge (so callers can print a meaningful error)
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { topologicalSort, findCycle, hasCycle } from '../src/topo.mjs';

/**
 * Smart generator: produces a graph (nodes + edges) with a controllable
 * probability of being acyclic. We achieve this by:
 *   1. picking N unique node ids,
 *   2. picking a random permutation of those nodes (the "DAG axis"),
 *   3. for each candidate ordered pair (i, j), independently deciding to
 *      include an edge — and independently deciding whether to make it a
 *      *forward* edge (i → j by the permutation, which preserves acyclicity)
 *      or a *back* edge (j → i, which can introduce a cycle).
 *
 * The `backEdgeProbability` knob lets shrinking explore both regimes:
 *   p = 0   → guaranteed DAG
 *   p > 0   → cycles possible
 */
const graphArb = fc
  .record({
    nodeCount: fc.integer({ min: 1, max: 10 }),
    seed: fc.integer({ min: 0, max: 0xffffffff }),
    edgeBits: fc.array(fc.boolean(), { minLength: 100, maxLength: 100 }),
    backBits: fc.array(fc.boolean(), { minLength: 100, maxLength: 100 }),
    backEdgeProbability: fc.constantFrom(0, 0.1, 0.3, 0.5),
  })
  .map(({ nodeCount, seed, edgeBits, backBits, backEdgeProbability }) => {
    const nodes = Array.from({ length: nodeCount }, (_, i) => `n${i}`);

    // Deterministic shuffle from `seed` (xorshift) — gives us a "DAG axis".
    const order = nodes.slice();
    let s = seed || 1;
    for (let i = order.length - 1; i > 0; i--) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      const j = Math.abs(s) % (i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    const rank = new Map(order.map((n, i) => [n, i]));

    const edges = [];
    let bitIdx = 0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const includeBit = edgeBits[bitIdx % edgeBits.length];
        const backBit = backBits[bitIdx % backBits.length];
        bitIdx++;
        // Use ~25% include rate so we exercise sparse graphs more often.
        if (!includeBit) continue;
        const a = nodes[i];
        const b = nodes[j];
        const forward = rank.get(a) < rank.get(b);
        const wantBack = backBit && Math.random() < backEdgeProbability;
        if (forward !== wantBack) {
          edges.push([a, b]);
        }
      }
    }

    return { nodes, edges };
  });

/**
 * Specialised generator that always produces a DAG by construction
 * (only forward edges along the permutation). Useful as a sanity-check leg
 * to ensure topologicalSort always returns a valid order on guaranteed DAGs.
 */
const dagOnlyArb = fc
  .record({
    nodeCount: fc.integer({ min: 1, max: 10 }),
    bits: fc.array(fc.boolean(), { minLength: 100, maxLength: 100 }),
  })
  .map(({ nodeCount, bits }) => {
    const nodes = Array.from({ length: nodeCount }, (_, i) => `n${i}`);
    const edges = [];
    let bitIdx = 0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (bits[bitIdx++ % bits.length]) {
          edges.push([nodes[i], nodes[j]]);
        }
      }
    }
    return { nodes, edges };
  });

function isValidLinearisation(order, edges) {
  const pos = new Map(order.map((n, i) => [n, i]));
  for (const [u, v] of edges) {
    const pu = pos.get(u);
    const pv = pos.get(v);
    if (pu === undefined || pv === undefined) continue;
    if (pu >= pv) return false;
  }
  return true;
}

describe('dependency-graph topological-sort properties (Requirement 1.4)', () => {
  it('topological order exists ⟺ graph is acyclic', () => {
    fc.assert(
      fc.property(graphArb, ({ nodes, edges }) => {
        const order = topologicalSort(nodes, edges);
        const cyclic = hasCycle(nodes, edges);
        // The headline equivalence:
        expect(order === null).toBe(cyclic);

        if (order !== null) {
          // When a sort exists it must be a valid linearisation...
          expect(isValidLinearisation(order, edges)).toBe(true);
          // ...and it must contain exactly the input nodes (no dupes / drops).
          expect(order.slice().sort()).toEqual(nodes.slice().sort());
        }
      }),
      { numRuns: 200 },
    );
  });

  it('on guaranteed DAGs topologicalSort always succeeds', () => {
    fc.assert(
      fc.property(dagOnlyArb, ({ nodes, edges }) => {
        const order = topologicalSort(nodes, edges);
        expect(order).not.toBeNull();
        expect(isValidLinearisation(order, edges)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('findCycle, when it returns a cycle, returns one whose consecutive pairs are real edges', () => {
    fc.assert(
      fc.property(graphArb, ({ nodes, edges }) => {
        const cycle = findCycle(nodes, edges);
        if (cycle === null) return; // covered by the equivalence above
        expect(cycle.length).toBeGreaterThanOrEqual(2);
        // First and last node must coincide so the cycle is closed.
        expect(cycle[0]).toBe(cycle[cycle.length - 1]);

        const edgeSet = new Set(edges.map(([u, v]) => `${u}\u0000${v}`));
        for (let i = 0; i < cycle.length - 1; i++) {
          expect(edgeSet.has(`${cycle[i]}\u0000${cycle[i + 1]}`)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('dependency-graph topological-sort: example-based regression cases', () => {
  it('detects a self-loop as a cycle', () => {
    expect(topologicalSort(['a'], [['a', 'a']])).toBeNull();
    const cycle = findCycle(['a'], [['a', 'a']]);
    expect(cycle).toEqual(['a', 'a']);
  });

  it('detects a simple two-node cycle', () => {
    expect(topologicalSort(['a', 'b'], [['a', 'b'], ['b', 'a']])).toBeNull();
  });

  it('returns a valid order for a linear chain', () => {
    const order = topologicalSort(
      ['a', 'b', 'c'],
      [['a', 'b'], ['b', 'c']],
    );
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('handles isolated nodes', () => {
    const order = topologicalSort(['a', 'b', 'c'], []);
    expect(order).not.toBeNull();
    expect(order.slice().sort()).toEqual(['a', 'b', 'c']);
  });
});
