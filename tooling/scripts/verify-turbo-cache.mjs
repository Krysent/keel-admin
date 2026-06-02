#!/usr/bin/env node
/**
 * verify-turbo-cache.mjs
 *
 * Used by the CI workflow (and locally during task 1.1) to assert that
 * Turborepo's incremental cache is actually working.
 *
 * Strategy:
 *   1. Run `turbo run lint typecheck test build --summarize` once (cold) and
 *      read the resulting summary from `.turbo/runs/<id>.json`.
 *   2. Run the same pipeline again (warm). Every task in the second run MUST
 *      come from the local cache (cache.status === 'HIT'), otherwise the
 *      pipeline is mis-configured (missing `outputs` / wrong `inputs` / etc.)
 *      and CI fails.
 *
 * The minimum cache hit ratio is configurable via TURBO_MIN_HIT_RATIO
 * (defaults to 1.0, i.e. 100% on the warm run).
 *
 * Usage:
 *   node tooling/scripts/verify-turbo-cache.mjs
 *   TURBO_MIN_HIT_RATIO=0.9 node tooling/scripts/verify-turbo-cache.mjs
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PIPELINE = ['lint', 'typecheck', 'test', 'build'];
const MIN_HIT_RATIO = Number(process.env.TURBO_MIN_HIT_RATIO ?? '1.0');
const REPO_ROOT = process.cwd();
const RUNS_DIR = resolve(REPO_ROOT, '.turbo', 'runs');

function listRunFiles() {
  if (!existsSync(RUNS_DIR)) return [];
  return readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const p = join(RUNS_DIR, f);
      return { path: p, mtimeMs: statSync(p).mtimeMs };
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs);
}

function newestRunSinceBaseline(baseline) {
  const all = listRunFiles();
  const baselineSet = new Set(baseline.map((r) => r.path));
  const fresh = all.filter((r) => !baselineSet.has(r.path));
  if (fresh.length === 0) return null;
  return fresh[fresh.length - 1].path;
}

function runTurbo(label) {
  const baseline = listRunFiles();

  const result = spawnSync(
    'pnpm',
    ['exec', 'turbo', 'run', ...PIPELINE, '--summarize'],
    { stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '1' } },
  );

  if (result.status !== 0) {
    console.error(`\n[verify-turbo-cache] turbo run (${label}) failed with status ${result.status}.`);
    process.exit(result.status ?? 1);
  }

  const summaryPath = newestRunSinceBaseline(baseline);
  if (!summaryPath) {
    console.error(`\n[verify-turbo-cache] could not locate a fresh summary in ${RUNS_DIR}`);
    process.exit(1);
  }

  return JSON.parse(readFileSync(summaryPath, 'utf8'));
}

function readCacheStatus(task) {
  // Turbo 2 summary shape: task.cache = { status: 'HIT' | 'MISS', ... }
  // Older shapes used cacheState; keep both for safety.
  return task.cache?.status ?? task.cacheState?.status ?? null;
}

function describeRun(label, summary) {
  const tasks = summary.tasks ?? [];
  const total = tasks.length;
  const cached = tasks.filter((t) => readCacheStatus(t) === 'HIT').length;
  const ratio = total === 0 ? 0 : cached / total;

  console.log(
    `[verify-turbo-cache] ${label}: ${cached}/${total} tasks cached (hit ratio = ${(ratio * 100).toFixed(1)}%)`,
  );

  return { total, cached, ratio, tasks };
}

function assertOrdering(tasks) {
  // Each task in the pipeline must appear at least once across packages.
  const seen = new Set(tasks.map((t) => t.task));
  const missing = PIPELINE.filter((task) => !seen.has(task));
  if (missing.length > 0) {
    console.error(
      `[verify-turbo-cache] expected pipeline tasks to be discovered, missing: ${missing.join(', ')}`,
    );
    process.exit(1);
  }

  // For every task, all of its declared dependencies must have a recorded
  // execution end time that is <= this task's start time. Turbo 2 records
  // both fields on `task.execution`. Cached tasks may omit timings; skip
  // them, the ordering check focuses on tasks that actually executed.
  const byKey = new Map(tasks.map((t) => [t.taskId ?? `${t.package}#${t.task}`, t]));

  for (const task of tasks) {
    const startedAt = task.execution?.startTime;
    if (typeof startedAt !== 'number') continue;
    const deps = task.dependencies ?? [];
    for (const depKey of deps) {
      const dep = byKey.get(depKey);
      const depEnd = dep?.execution?.endTime;
      if (typeof depEnd === 'number' && depEnd > startedAt) {
        console.error(
          `[verify-turbo-cache] ordering violation: ${task.taskId} started at ${startedAt} ` +
            `before its dependency ${depKey} finished at ${depEnd}`,
        );
        process.exit(1);
      }
    }
  }
}

console.log('[verify-turbo-cache] cold run (clearing local cache)...');
spawnSync('pnpm', ['exec', 'turbo', 'run', ...PIPELINE, '--force', '--summarize'], {
  stdio: 'inherit',
  env: { ...process.env, FORCE_COLOR: '1' },
});

const cold = (() => {
  const all = listRunFiles();
  if (all.length === 0) {
    console.error('[verify-turbo-cache] no summary produced after cold run');
    process.exit(1);
  }
  return JSON.parse(readFileSync(all[all.length - 1].path, 'utf8'));
})();
const coldStats = describeRun('cold', cold);
assertOrdering(coldStats.tasks);

console.log('\n[verify-turbo-cache] warm run...');
const warm = runTurbo('warm');
const warmStats = describeRun('warm', warm);

if (warmStats.ratio < MIN_HIT_RATIO) {
  console.error(
    `\n[verify-turbo-cache] FAIL: warm-run cache hit ratio ${(warmStats.ratio * 100).toFixed(1)}% ` +
      `is below required ${(MIN_HIT_RATIO * 100).toFixed(1)}%.`,
  );
  console.error('Likely causes: missing `outputs` in turbo.json, non-deterministic build, or unhashed inputs.');
  process.exit(1);
}

console.log(
  `\n[verify-turbo-cache] OK — pipeline order verified, warm cache hit ratio ${(warmStats.ratio * 100).toFixed(1)}% >= ${(MIN_HIT_RATIO * 100).toFixed(1)}%.`,
);
