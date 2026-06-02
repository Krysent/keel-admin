/**
 * Scan `packages/* /package.json` and build the @keel/* workspace dependency
 * graph from `dependencies` + `devDependencies` + `peerDependencies`.
 *
 * Returns:
 *   {
 *     nodes: string[],                       // every @keel/* package name we found
 *     edges: [string, string][],             // u -> v means "u depends on v"
 *     packagesByName: Map<string, {          // metadata for diagnostics
 *       name: string,
 *       dir: string,
 *       packageJsonPath: string,
 *     }>
 *   }
 *
 * Only intra-workspace edges (both endpoints are @keel/*) are recorded; this
 * is what Requirement 1.4 asks us to police.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** @typedef {{ name: string, dir: string, packageJsonPath: string }} PackageInfo */

/**
 * @param {string} repoRoot absolute path to repo root
 * @param {string[]} [extraDirs] additional workspace globs to scan, defaults
 *                                to `["packages"]`. Pass `["packages","apps"]`
 *                                to also include consumers (we don't, by
 *                                default — Requirement 1.4 specifically
 *                                targets `packages/*`).
 */
export function scanPackages(repoRoot, extraDirs = ['packages']) {
  /** @type {Map<string, PackageInfo>} */
  const packagesByName = new Map();
  /** @type {[string, string][]} */
  const edges = [];

  for (const sub of extraDirs) {
    const dir = resolve(repoRoot, sub);
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const pkgDir = join(dir, entry);
      let stat;
      try {
        stat = statSync(pkgDir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      const pkgJsonPath = join(pkgDir, 'package.json');
      let raw;
      try {
        raw = readFileSync(pkgJsonPath, 'utf8');
      } catch {
        continue;
      }
      /** @type {Record<string, unknown>} */
      let json;
      try {
        json = JSON.parse(raw);
      } catch (err) {
        throw new Error(`Failed to parse ${pkgJsonPath}: ${(err && err.message) || err}`);
      }

      const name = typeof json.name === 'string' ? json.name : null;
      // We only model intra-workspace cycles, and our workspace scope is @keel/*.
      // Anything else (build tooling, lockfile) is ignored.
      if (!name || !name.startsWith('@keel/')) continue;

      packagesByName.set(name, {
        name,
        dir: pkgDir,
        packageJsonPath: pkgJsonPath,
      });
    }
  }

  // Second pass: now that we know all @keel/* nodes, walk each package's
  // dep buckets and record edges that point to a known node.
  for (const info of packagesByName.values()) {
    const json = JSON.parse(readFileSync(info.packageJsonPath, 'utf8'));
    for (const bucket of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const deps = json[bucket];
      if (!deps || typeof deps !== 'object') continue;
      for (const dep of Object.keys(deps)) {
        if (!packagesByName.has(dep)) continue;
        if (dep === info.name) continue; // ignore self-decls (rare but harmless)
        edges.push([info.name, dep]);
      }
    }
  }

  return {
    nodes: [...packagesByName.keys()],
    edges,
    packagesByName,
  };
}
