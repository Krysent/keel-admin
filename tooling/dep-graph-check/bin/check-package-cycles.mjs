#!/usr/bin/env node
/**
 * CI entrypoint: walk packages/* and assert the @keel/* workspace dependency
 * graph contains no cycles. Implements Requirement 1.4.
 *
 * Exit codes:
 *   0  — no cycles
 *   1  — cycle detected (a concrete cycle is printed for diagnostics)
 *   2  — internal error (failed to parse a package.json, etc.)
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findCycle } from '../src/topo.mjs';
import { scanPackages } from '../src/scan-packages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// repo root = three levels up from this file (tooling/dep-graph-check/bin)
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

function main() {
  let scan;
  try {
    scan = scanPackages(REPO_ROOT, ['packages']);
  } catch (err) {
    console.error(`[check-package-cycles] failed to scan packages: ${err.message ?? err}`);
    process.exit(2);
  }

  const { nodes, edges, packagesByName } = scan;

  if (nodes.length === 0) {
    console.warn('[check-package-cycles] no @keel/* packages found under packages/*; nothing to check.');
    process.exit(0);
  }

  console.log(
    `[check-package-cycles] scanned ${nodes.length} @keel/* package(s) with ${edges.length} intra-workspace edge(s).`,
  );

  const cycle = findCycle(nodes, edges);
  if (cycle === null) {
    console.log('[check-package-cycles] OK — no cycles detected.');
    process.exit(0);
  }

  console.error('\n[check-package-cycles] FAIL — cycle detected in the @keel/* dependency graph:\n');
  console.error('  ' + cycle.join(' → '));
  console.error('\nInvolved packages:');
  for (const name of new Set(cycle)) {
    const info = packagesByName.get(name);
    if (info) console.error(`  - ${name}  (${info.packageJsonPath})`);
  }
  console.error(
    '\nFix: remove or invert one of the edges above. If the dependency is genuinely\n' +
      'one-directional, double-check it is not also listed in devDependencies on the\n' +
      'reverse side.',
  );
  process.exit(1);
}

main();
