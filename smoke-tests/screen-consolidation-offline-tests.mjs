// Screen consolidation offline tests — rushed path Welcome → Review → Answer/Options → Done.
//
// Run: node smoke-tests/screen-consolidation-offline-tests.mjs

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

console.log('\n── Screen consolidation offline tests ──\n');

test('1. confirm goes directly to options (no separate risk step)', () => {
  assert(appSrc.includes("setStep('options')"), 'options step used');
  assert(!appSrc.includes("setStep('risk')"), 'risk step removed from navigation');
  assert(!appSrc.includes('sc-screen--risk'), 'dedicated risk screen removed');
});

test('2. no See safer options bridge button', () => {
  assert(!appSrc.includes('See safer options'), 'bridge button removed');
});

test('3. recovery animation collapsed under See why this is risky', () => {
  const optionsIdx = appSrc.indexOf('sc-screen--options');
  const riskDetailIdx = appSrc.indexOf('sc-risk-detail', optionsIdx);
  const animIdx = appSrc.indexOf('RecoveryPlanAnimation', optionsIdx);
  assert(riskDetailIdx > 0 && animIdx > riskDetailIdx, 'animation nested in risk detail panel');
  assert(appSrc.includes('See why this is risky'), 'expand affordance present');
});

test('4. recommendation renders before expandable risk detail', () => {
  const optionsIdx = appSrc.indexOf('sc-screen--options');
  const optionsBody = appSrc.slice(optionsIdx, appSrc.indexOf('sc-screen--done', optionsIdx));
  const recommendedIdx = optionsBody.indexOf('sc-recommended-option');
  const riskDetailIdx = optionsBody.indexOf('sc-risk-detail');
  assert(recommendedIdx > 0 && riskDetailIdx > recommendedIdx, 'recommended card above risk detail');
});

test('5. loading state copy while live alternatives in flight', () => {
  assert(appSrc.includes('Checking live alternatives…'), 'loading banner copy');
});

test('6. Keep/Switch remain explicit decision actions', () => {
  assert(appSrc.includes('Keep current itinerary'), 'keep action present');
  assert(appSrc.includes("setDecision('switch')"), 'switch action present');
  assert(appSrc.includes('useState<Decision>(null)'), 'decision defaults to null');
});

console.log(`\nScreen consolidation offline tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
