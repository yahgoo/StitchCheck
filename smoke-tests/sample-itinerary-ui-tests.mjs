// Sample-itinerary shortcut UI tests.
//
// Run: node smoke-tests/sample-itinerary-ui-tests.mjs

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
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

const appSrc = readFileSync(resolve(ROOT, 'app/src/App.tsx'), 'utf-8');
const sampleSrc = readFileSync(resolve(ROOT, 'app/src/data/sample-itinerary.ts'), 'utf-8');

console.log('\n── Sample itinerary UI tests ──\n');

test('1. Welcome screen shows secondary sample-itinerary option', () => {
  assert(appSrc.includes('WELCOME_READY_MADE_CTA'), 'ready-made CTA constant');
  assert(appSrc.includes('sc-btn--tertiary-secondary') && appSrc.includes('handleTrySampleItinerary'), 'tertiary ready-made button');
  assert(appSrc.includes('Upload itinerary'), 'primary upload CTA on welcome');
  assert(appSrc.includes('WELCOME_SCREENSHOT_SAMPLE_CTA'), 'screenshot CTA first among samples');
});

test('2. Sample click populates both legs and skips extraction on confirm', () => {
  assert(appSrc.includes('getSampleItineraryExtraction'), 'sample extraction helper');
  assert(appSrc.includes("itineraryInputMode === 'sample'"), 'sample mode gate');
  assert(appSrc.includes('skipLiveExtraction'), 'extraction skipped for sample path');
});

test('3. Sample banner label on review screen', () => {
  assert(
    appSrc.includes('Sample itinerary — not uploaded. Edit or replace it with your own.'),
    'honest sample banner',
  );
});

test('4. Preflight-confirmed route uses KUL→SIN→BKK', () => {
  assert(sampleSrc.includes("origin: 'KUL'") && sampleSrc.includes("destination: 'SIN'"), 'leg1 KUL→SIN');
  assert(sampleSrc.includes("origin: 'SIN'") && sampleSrc.includes("destination: 'BKK'"), 'leg2 SIN→BKK');
  assert(sampleSrc.includes('2026-10-01'), 'near-term preflight date');
});

test('5. Downstream uses confirmedItinerary snapshot (same path as upload)', () => {
  assert(appSrc.includes('performLiveSearchForConfirmed(snapshot)'), 'Atlas search from snapshot');
  assert(appSrc.includes('confirmedItineraryToContext(confirmedItinerary)'), 'recovery from snapshot');
  assert(!appSrc.includes('performLiveSearchForConfirmed(extraction'), 'must not search from live extraction');
});

test('6. Editing sample clears sample mode before re-confirm', () => {
  assert(
    appSrc.includes("itineraryInputMode === 'sample'") && appSrc.includes("setItineraryInputMode('default')"),
    'edit clears sample label path',
  );
  assert(
    appSrc.includes("'sample-screenshot'") && appSrc.includes("setItineraryInputMode('default')"),
    'edit clears sample-screenshot label path',
  );
});

console.log(`\nSample itinerary UI tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
