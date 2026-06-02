/**
 * Pure topological-sort and cycle-detection utilities for directed graphs.
 *
 * Used by:
 *   - the property-based test in tests/topo.pbt.test.mjs (validates the
 *     equivalence "topological order exists" ⟺ "graph is acyclic")
 *   - the CI scanner that walks `packages/* /package.json` and flags any
 *     cycle in the @keel/* workspace dependency graph
 *
 * The implementations are deliberately small and dependency-free so this
 * file can be `import`ed from both vitest and a plain `node` script.
 */

/**
 * Kahn's algorithm. Returns a topological order if one exists, otherwise
 * `null` (which means the graph contains at least one cycle, including any
 * self-loop).
 *
 * @param {ReadonlyArray<string>} nodes  unique node identifiers
 * @param {ReadonlyArray<readonly [string, string]>} edges directed edges (u → v)
 * @returns {string[] | null}
 */
export function topologicalSort(nodes, edges) {
  const inDegree = new Map();
  const adj = new Map();
  for (const n of nodes) {
    inDegree.set(n, 0);
    adj.set(n, []);
  }

  for (const [u, v] of edges) {
    if (!inDegree.has(u) || !inDegree.has(v)) continue;
    adj.get(u).push(v);
    inDegree.set(v, inDegree.get(v) + 1);
  }

  // We use a plain array as a FIFO queue; graphs are tiny so O(n) shift is fine.
  const queue = [];
  for (const n of nodes) {
    if (inDegree.get(n) === 0) queue.push(n);
  }

  const order = [];
  while (queue.length > 0) {
    const u = queue.shift();
    order.push(u);
    for (const v of adj.get(u)) {
      const next = inDegree.get(v) - 1;
      inDegree.set(v, next);
      if (next === 0) queue.push(v);
    }
  }

  return order.length === nodes.length ? order : null;
}

/**
 * Iterative DFS-based cycle detection. Returns one concrete cycle (with the
 * starting node repeated at both ends, e.g. `["A","B","A"]`) if any exists,
 * otherwise `null`. Detects self-loops as length-2 cycles `["A","A"]`.
 *
 * Iterative because the test sometimes generates graphs with chains of a
 * couple dozen nodes; iterative form keeps the call stack constant.
 *
 * @param {ReadonlyArray<string>} nodes
 * @param {ReadonlyArray<readonly [string, string]>} edges
 * @returns {string[] | null}
 */
export function findCycle(nodes, edges) {
  const adj = new Map();
  for (const n of nodes) adj.set(n, []);
  for (const [u, v] of edges) {
    if (adj.has(u) && adj.has(v)) adj.get(u).push(v);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(nodes.map((n) => [n, WHITE]));
  const parent = new Map();

  for (const start of nodes) {
    if (color.get(start) !== WHITE) continue;

    /** @type {{ node: string, idx: number }[]} */
    const stack = [{ node: start, idx: 0 }];
    color.set(start, GRAY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = adj.get(frame.node);

      if (frame.idx >= neighbors.length) {
        color.set(frame.node, BLACK);
        stack.pop();
        continue;
      }

      const v = neighbors[frame.idx++];
      const c = color.get(v);
      if (c === WHITE) {
        parent.set(v, frame.node);
        color.set(v, GRAY);
        stack.push({ node: v, idx: 0 });
      } else if (c === GRAY) {
        // Reconstruct cycle from v back through parents to frame.node.
        const cycle = [v];
        for (let cur = frame.node; cur !== v; cur = parent.get(cur)) {
          cycle.push(cur);
        }
        cycle.push(v);
        return cycle.reverse();
      }
      // BLACK -> already fully explored, no cycle through this edge.
    }
  }

  return null;
}

/**
 * Convenience predicate.
 * @param {ReadonlyArray<string>} nodes
 * @param {ReadonlyArray<readonly [string, string]>} edges
 * @returns {boolean}
 */
export function hasCycle(nodes, edges) {
  return findCycle(nodes, edges) !== null;
}
