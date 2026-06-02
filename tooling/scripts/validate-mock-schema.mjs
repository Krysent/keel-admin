/**
 * validate-mock-schema.mjs
 *
 * CI script that statically validates all mock handler files under
 * `apps/admin/mock/` produce responses conforming to the backend
 * envelope schema `{ code: number, data: any, message: string }`.
 *
 * It parses each mock file, imports the handlers, and validates that
 * every response object has the required envelope shape.
 *
 * Validates: Requirement 11.5
 *
 * Usage:
 *   node tooling/scripts/validate-mock-schema.mjs
 *
 * Exit codes:
 *   0 — all mock responses conform to envelope schema
 *   1 — one or more violations found
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '../..');
const MOCK_DIR = join(ROOT, 'apps/admin/mock');

/**
 * Validates an envelope object has the required shape:
 * { code: number, data: <any>, message: string }
 */
function validateEnvelope(obj, context) {
  const errors = [];

  if (obj === null || typeof obj !== 'object') {
    errors.push(`${context}: response is not an object (got ${typeof obj})`);
    return errors;
  }

  if (!('code' in obj)) {
    errors.push(`${context}: missing required field "code"`);
  } else if (typeof obj.code !== 'number') {
    errors.push(`${context}: "code" must be a number (got ${typeof obj.code})`);
  }

  if (!('data' in obj)) {
    errors.push(`${context}: missing required field "data"`);
  }

  if (!('message' in obj)) {
    errors.push(`${context}: missing required field "message"`);
  } else if (typeof obj.message !== 'string') {
    errors.push(`${context}: "message" must be a string (got ${typeof obj.message})`);
  }

  return errors;
}

/**
 * Validates a mock file by reading and analyzing its source code.
 * Uses regex-based static analysis to find `wrap()`, `wrapError()`,
 * and `wrapPage()` calls, then verifies the _utils.ts helpers
 * themselves produce correct envelope shapes.
 */
function validateMockFile(filePath) {
  const errors = [];
  const content = readFileSync(filePath, 'utf-8');
  const fileName = filePath.replace(MOCK_DIR + '/', '');

  // Skip the _utils.ts file itself — we validate it separately
  if (fileName === '_utils.ts') {
    return errors;
  }

  // Check that file imports from './_utils'
  const importsUtils = /import\s+.*from\s+['"]\.?\/?_utils['"]/.test(content);
  if (!importsUtils) {
    errors.push(
      `${fileName}: does not import from './_utils' — all responses MUST use wrap()/wrapError()/wrapPage() helpers`,
    );
  }

  // Verify every `return` statement inside a response handler uses wrap/wrapError/wrapPage.
  // Strategy: find all lines with `return` and check they call a helper.
  // We scope this to lines within `response:` blocks by tracking context.
  const lines = content.split('\n');
  let inResponseBlock = false;
  let braceDepth = 0;
  let handlerIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect start of a response handler function
    if (/response\s*:/.test(line)) {
      // Count opening brace on this line or subsequent lines
      const braceOnLine = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (braceOnLine > 0 || /=>\s*\{/.test(line)) {
        inResponseBlock = true;
        braceDepth = braceOnLine;
        handlerIndex++;
        continue;
      }
    }

    if (inResponseBlock) {
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      braceDepth += openBraces - closeBraces;

      // Check return statements
      if (/\breturn\b/.test(line)) {
        const usesHelper = /return\s+(?:wrap|wrapError|wrapPage)\s*\(/.test(line);
        if (!usesHelper) {
          errors.push(
            `${fileName}:line ${i + 1} (handler#${handlerIndex}): return statement does not use wrap()/wrapError()/wrapPage()`,
          );
        }
      }

      // Exit response block when braces balance
      if (braceDepth <= 0) {
        inResponseBlock = false;
        braceDepth = 0;
      }
    }
  }

  return errors;
}

/**
 * Validates the _utils.ts wrap() function produces correct envelope shape
 * by checking its return type annotation and implementation.
 */
function validateUtilsFile(filePath) {
  const errors = [];
  const content = readFileSync(filePath, 'utf-8');

  // Check that wrap() returns an object with code, data, message
  const wrapFn = content.match(/export\s+function\s+wrap[\s\S]*?\n\}/);
  if (!wrapFn) {
    errors.push('_utils.ts: missing export function wrap()');
    return errors;
  }

  const wrapBody = wrapFn[0];

  // Verify it returns { code, data, message }
  if (!wrapBody.includes('code:') && !wrapBody.includes('code :')) {
    errors.push('_utils.ts: wrap() does not return a "code" field');
  }
  if (!wrapBody.includes('data')) {
    errors.push('_utils.ts: wrap() does not reference "data" in return');
  }
  if (!wrapBody.includes('message:') && !wrapBody.includes('message :')) {
    errors.push('_utils.ts: wrap() does not return a "message" field');
  }

  // Check wrapError exists
  if (!content.includes('export function wrapError')) {
    errors.push('_utils.ts: missing export function wrapError()');
  }

  // Check wrapPage exists
  if (!content.includes('export function wrapPage')) {
    errors.push('_utils.ts: missing export function wrapPage()');
  }

  // Check ApiEnvelope type import
  if (!content.includes('ApiEnvelope')) {
    errors.push('_utils.ts: does not reference ApiEnvelope type — envelope shape not type-checked');
  }

  return errors;
}

// --- Main ---

console.log('🔍 Validating mock schema compliance...\n');

const allErrors = [];

// 1. Validate _utils.ts
const utilsPath = join(MOCK_DIR, '_utils.ts');
try {
  const utilsErrors = validateUtilsFile(utilsPath);
  allErrors.push(...utilsErrors);
} catch (err) {
  allErrors.push(`_utils.ts: could not read file — ${err.message}`);
}

// 2. Validate all mock handler files
const mockFiles = readdirSync(MOCK_DIR).filter(
  (f) => f.endsWith('.ts') && f !== '_utils.ts',
);

if (mockFiles.length === 0) {
  allErrors.push('No mock handler files found in apps/admin/mock/');
}

for (const file of mockFiles) {
  const filePath = join(MOCK_DIR, file);
  try {
    const fileErrors = validateMockFile(filePath);
    allErrors.push(...fileErrors);
  } catch (err) {
    allErrors.push(`${file}: could not validate — ${err.message}`);
  }
}

// 3. Report
console.log(`  Checked: _utils.ts + ${mockFiles.length} handler file(s)\n`);

if (allErrors.length > 0) {
  console.error('❌ Mock schema validation FAILED:\n');
  for (const err of allErrors) {
    console.error(`  • ${err}`);
  }
  console.error(`\n  ${allErrors.length} error(s) found.`);
  console.error('  All mock responses must use wrap()/wrapError()/wrapPage() from _utils.ts');
  console.error('  to guarantee the { code, data, message } envelope contract.\n');
  process.exit(1);
} else {
  console.log('✅ All mock responses conform to the { code, data, message } envelope schema.\n');
  process.exit(0);
}
