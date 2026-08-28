// Missing-field label copy tests — single source of truth for traveller-facing gaps.
//
// Run: node smoke-tests/missing-field-labels-offline-tests.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { MISSING_FIELD_LABELS, formatMissingField } = await import(
  resolve(ROOT, 'core/copy/missing-field-labels.mjs')
);

const componentsDir = resolve(ROOT, 'app/src/components');
const componentFiles = readdirSync(componentsDir)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => readFileSync(join(componentsDir, name), 'utf-8'));

console.log('\n── Missing field label offline tests ──\n');

test('1. shared helper defines critical and non-critical variants', () => {
  assert(MISSING_FIELD_LABELS.critical.includes("don't have this yet"), 'critical copy');
  assert(MISSING_FIELD_LABELS.nonCritical === '—', 'non-critical em dash');
  assert(formatMissingField('critical') === MISSING_FIELD_LABELS.critical, 'formatMissingField critical');
});

test('2. old hardcoded phrase absent from component JSX (uses helper instead)', () => {
  const legacy = 'Not available from the current evidence';
  for (const src of componentFiles) {
    assert(
      !src.includes(legacy),
      `legacy phrase must not appear directly in components: ${legacy}`,
    );
  }
});

test('3. RecoveryPlanAnimation imports formatMissingField helper', () => {
  const src = readFileSync(resolve(ROOT, 'app/src/components/RecoveryPlanAnimation.tsx'), 'utf-8');
  assert(src.includes("from '../../../core/copy/missing-field-labels'"), 'helper import');
  assert(src.includes('formatMissingField'), 'uses formatMissingField');
});

console.log(`\nMissing field label offline tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
