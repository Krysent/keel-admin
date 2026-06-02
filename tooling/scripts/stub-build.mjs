#!/usr/bin/env node
/**
 * Minimal "build" stub for placeholder packages.
 *
 * Until each package is wired up to tsup (task 2), this script just emits an
 * empty `dist/` directory with a marker file so Turborepo can cache the output
 * and downstream packages' `dependsOn: ['^build']` is honoured.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();
const distDir = resolve(cwd, 'dist');

mkdirSync(distDir, { recursive: true });

const marker = {
  package: cwd.split('/').slice(-2).join('/'),
  builtAt: new Date().toISOString(),
  note: 'Stub build artifact. Replace with tsup output in task 2.',
};

writeFileSync(resolve(distDir, 'index.js'), `export {};\n`, 'utf8');
writeFileSync(resolve(distDir, 'index.cjs'), `module.exports = {};\n`, 'utf8');
writeFileSync(resolve(distDir, 'index.d.ts'), `export {};\n`, 'utf8');
writeFileSync(resolve(distDir, '.stub.json'), JSON.stringify(marker, null, 2), 'utf8');

console.log(`[stub-build] wrote ${distDir} (${marker.package}) — relative to ${__dirname}`);
