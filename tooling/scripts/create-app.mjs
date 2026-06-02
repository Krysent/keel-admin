#!/usr/bin/env node

/**
 * create-app.mjs — Scaffold a new SaaS application from the apps/admin skeleton.
 *
 * Usage:
 *   node tooling/scripts/create-app.mjs <app-name>
 *
 * Example:
 *   node tooling/scripts/create-app.mjs my-saas-app
 *
 * This will:
 *   1. Copy apps/admin into apps/<app-name>
 *   2. Replace package name and description
 *   3. Reset version to 0.0.0
 *   4. Clear app-specific mock data (keep structure)
 *   5. Update .env files with placeholder values
 *
 * The new app will have all @keel/* workspace dependencies pre-configured
 * and is ready for `pnpm install && pnpm dev`.
 */

import { existsSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const TEMPLATE_DIR = join(ROOT, 'apps/admin');
const APPS_DIR = join(ROOT, 'apps');

function main() {
  const appName = process.argv[2];

  if (!appName) {
    console.error('Usage: node tooling/scripts/create-app.mjs <app-name>');
    console.error('');
    console.error('Example:');
    console.error('  node tooling/scripts/create-app.mjs my-saas-app');
    process.exit(1);
  }

  // Validate app name
  if (!/^[a-z][a-z0-9-]*$/.test(appName)) {
    console.error(`Error: app name must match /^[a-z][a-z0-9-]*$/, got: "${appName}"`);
    process.exit(1);
  }

  if (appName === 'admin') {
    console.error('Error: cannot overwrite the template app "admin".');
    process.exit(1);
  }

  const targetDir = join(APPS_DIR, appName);

  if (existsSync(targetDir)) {
    console.error(`Error: directory already exists: ${targetDir}`);
    process.exit(1);
  }

  if (!existsSync(TEMPLATE_DIR)) {
    console.error(`Error: template directory not found: ${TEMPLATE_DIR}`);
    process.exit(1);
  }

  console.log(`\n🚀 Creating new app: ${appName}\n`);

  // Step 1: Copy template
  console.log('  ▸ Copying apps/admin skeleton...');
  cpSync(TEMPLATE_DIR, targetDir, {
    recursive: true,
    filter: (src) => {
      // Skip node_modules, .turbo, dist, coverage, playwright-report
      const rel = src.replace(TEMPLATE_DIR, '');
      if (rel.includes('node_modules')) return false;
      if (rel.includes('.turbo')) return false;
      if (rel.includes('/dist')) return false;
      if (rel.includes('/coverage')) return false;
      if (rel.includes('playwright-report')) return false;
      return true;
    },
  });

  // Step 2: Update package.json
  console.log('  ▸ Updating package.json...');
  const pkgPath = join(targetDir, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    pkg.name = `@keel/${appName}`;
    pkg.version = '0.0.0';
    pkg.description = `SaaS application: ${appName}`;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  // Step 3: Update .env files with placeholders
  console.log('  ▸ Resetting environment files...');
  const envFiles = ['.env.development', '.env.production'];
  for (const envFile of envFiles) {
    const envPath = join(targetDir, envFile);
    if (existsSync(envPath)) {
      let content = readFileSync(envPath, 'utf-8');
      content = content.replace(
        /VITE_APP_NAME=.*/,
        `VITE_APP_NAME=${appName}`,
      );
      writeFileSync(envPath, content);
    }
  }

  // Step 4: Clean up app-specific test results
  console.log('  ▸ Cleaning build artifacts...');
  const cleanDirs = ['playwright-report', '.turbo'];
  for (const dir of cleanDirs) {
    const dirPath = join(targetDir, dir);
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  }

  console.log('');
  console.log(`✅ Created apps/${appName}`);
  console.log('');
  console.log('Next steps:');
  console.log(`  cd ${targetDir}`);
  console.log('  pnpm install');
  console.log('  pnpm dev');
  console.log('');
  console.log('The new app inherits all @keel/* workspace packages.');
  console.log('Customize pages, stores, services, and mock data for your business.');
}

main();
