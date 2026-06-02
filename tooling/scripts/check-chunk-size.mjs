#!/usr/bin/env node
/**
 * check-chunk-size.mjs
 *
 * Scans the production build output in `apps/admin/dist/assets/` and asserts
 * that every JS/CSS chunk, once gzipped, is smaller than 250 KB.
 *
 * This enforces Requirement 19.4:
 *   WHERE 构建产物 THE 系统 SHALL 通过 `manualChunks` 让单个 chunk gzip 后 < 250KB
 *
 * Usage:
 *   node tooling/scripts/check-chunk-size.mjs
 *
 * Typically run after a production build:
 *   pnpm --filter @keel/admin run build && node tooling/scripts/check-chunk-size.mjs
 *
 * Environment variables:
 *   CHUNK_SIZE_LIMIT_KB  — override the default 250 KB threshold
 *   DIST_DIR             — override the default dist/assets path
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMIT_KB = Number(process.env.CHUNK_SIZE_LIMIT_KB ?? '250');
const LIMIT_BYTES = LIMIT_KB * 1024;

const REPO_ROOT = process.cwd();
const DIST_DIR = process.env.DIST_DIR
  ? resolve(process.env.DIST_DIR)
  : resolve(REPO_ROOT, 'apps', 'admin', 'dist', 'assets');

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function collectAssets(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { recursive: true })
    .filter((f) => /\.(js|css)$/.test(f))
    .map((f) => join(dir, f));
}

function main() {
  console.log(`[check-chunk-size] Scanning: ${DIST_DIR}`);
  console.log(`[check-chunk-size] Threshold: ${LIMIT_KB} KB gzipped\n`);

  if (!existsSync(DIST_DIR)) {
    console.error(
      `[check-chunk-size] ERROR: dist directory not found at ${DIST_DIR}\n` +
        `  Run the build first: pnpm --filter @keel/admin run build`,
    );
    process.exit(1);
  }

  const files = collectAssets(DIST_DIR);

  if (files.length === 0) {
    console.error(
      `[check-chunk-size] ERROR: no JS/CSS files found in ${DIST_DIR}\n` +
        `  Ensure the build produced output in the expected location.`,
    );
    process.exit(1);
  }

  const results = [];
  const violations = [];

  for (const filePath of files) {
    const raw = readFileSync(filePath);
    const gzipped = gzipSync(raw, { level: 9 });
    const relativePath = filePath.replace(DIST_DIR + '/', '');

    const entry = {
      file: relativePath,
      rawSize: raw.length,
      gzipSize: gzipped.length,
    };

    results.push(entry);

    if (gzipped.length > LIMIT_BYTES) {
      violations.push(entry);
    }
  }

  // Sort by gzip size descending for readability
  results.sort((a, b) => b.gzipSize - a.gzipSize);

  // Print summary table
  console.log('  File'.padEnd(60) + 'Raw'.padStart(12) + 'Gzip'.padStart(12) + '  Status');
  console.log('  ' + '─'.repeat(90));

  for (const r of results) {
    const status = r.gzipSize > LIMIT_BYTES ? '❌ OVER' : '✅ OK';
    const line =
      `  ${r.file.padEnd(58)}` +
      `${formatSize(r.rawSize).padStart(12)}` +
      `${formatSize(r.gzipSize).padStart(12)}` +
      `  ${status}`;
    console.log(line);
  }

  console.log('  ' + '─'.repeat(90));
  console.log(`  Total files: ${results.length}`);

  if (violations.length > 0) {
    console.error(
      `\n[check-chunk-size] FAIL: ${violations.length} chunk(s) exceed ${LIMIT_KB} KB gzipped:\n`,
    );
    for (const v of violations) {
      console.error(`  ❌ ${v.file} — ${formatSize(v.gzipSize)} gzipped (limit: ${LIMIT_KB} KB)`);
    }
    console.error(
      `\n  Consider splitting large chunks via \`manualChunks\` in vite.config.ts.`,
    );
    process.exit(1);
  }

  console.log(
    `\n[check-chunk-size] OK — all ${results.length} chunks are under ${LIMIT_KB} KB gzipped.`,
  );
  process.exit(0);
}

main();
