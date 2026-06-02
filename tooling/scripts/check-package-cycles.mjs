#!/usr/bin/env node
/**
 * Thin re-export so the cycle scanner can be invoked from a stable path:
 *
 *   node tooling/scripts/check-package-cycles.mjs
 *
 * The real implementation lives in `tooling/dep-graph-check`, which is also
 * where the property-based tests for the underlying graph utilities live.
 */
import('../dep-graph-check/bin/check-package-cycles.mjs');
