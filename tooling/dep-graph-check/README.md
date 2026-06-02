# @keel/dep-graph-check

Tooling-only workspace (private, never published). Two responsibilities:

1. **Property-based test** (`tests/topo.pbt.test.mjs`) that pins down the
   topological-sort ⟺ acyclic equivalence used by our cycle detector. This
   acts as the verification baseline whenever we add a new shared package.
2. **CI scanner** (`bin/check-package-cycles.mjs`) that walks
   `packages/*/package.json`, builds the `@keel/*` workspace dependency graph
   from `dependencies` + `devDependencies` + `peerDependencies`, and exits
   non-zero with a concrete cycle if one is found.

Implements Requirement 1.4 of the `saas-admin-template` spec.

## Run locally

```bash
# from repo root
pnpm --filter @keel/dep-graph-check test          # property-based tests
pnpm ci:check-cycles                              # CI scanner
```

## Files

- `src/topo.mjs` — `topologicalSort` / `findCycle` / `hasCycle` (pure, no deps).
- `src/scan-packages.mjs` — turn `packages/*/package.json` into a graph.
- `bin/check-package-cycles.mjs` — CI entrypoint. Exits 1 on cycle.
- `tests/topo.pbt.test.mjs` — fast-check property tests.
