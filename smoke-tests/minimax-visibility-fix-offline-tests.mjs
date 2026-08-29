// MiniMax M3 visibility fix offline tests (Option A spec).
//
// Run: node smoke-tests/minimax-visibility-fix-offline-tests.mjs

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

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

const appSrc = readFileSync(resolve(ROOT, 'app/src/App.tsx'), 'utf-8');
const appCss = readFileSync(resolve(ROOT, 'app/src/App.css'), 'utf-8');
const copySrc = readFileSync(resolve(ROOT, 'app/src/data/minimax-visibility-copy.ts'), 'utf-8');
const providerBarSrc = readFileSync(resolve(ROOT, 'app/src/components/ProviderStatusBar.tsx'), 'utf-8');
const provenanceSrc = readFileSync(resolve(ROOT, 'app/src/components/MiniMaxProvenanceTag.tsx'), 'utf-8');
const offlineSrc = readFileSync(resolve(ROOT, 'app/src/components/MiniMaxOfflineNotice.tsx'), 'utf-8');

const SPEC = {
  screenshotCta: 'Extract with MiniMax M3',
  screenshotHelper:
    'Use a sample itinerary screenshot. MiniMax M3 will extract your flights and dates.',
  readyMadeCta: 'Use sample — no extraction',
  readyMadeHelper: 'Fast preview with itinerary data already loaded.',
  loading: 'MiniMax M3 is reading your itinerary…',
  provenance: 'Extracted by MiniMax M3',
  offlineStatus: 'MiniMax M3: offline',
  offlineExplanation:
    'Expected for this fast path — a ready-made itinerary was loaded directly, so no MiniMax M3 extraction request was made.',
  providerSummary: 'Provider checks:',
};

console.log('\n── MiniMax visibility fix offline tests ──\n');

test('1. Welcome screen button order and exact copy strings', () => {
  const welcomeBlock = appSrc.slice(appSrc.indexOf('sc-welcome-actions'), appSrc.indexOf('sc-screen--trip'));
  const uploadIdx = welcomeBlock.indexOf('Upload itinerary');
  const screenshotIdx = welcomeBlock.indexOf('WELCOME_SCREENSHOT_SAMPLE_CTA');
  const readyMadeIdx = welcomeBlock.indexOf('WELCOME_READY_MADE_CTA');
  assert.ok(uploadIdx >= 0 && screenshotIdx > uploadIdx && readyMadeIdx > screenshotIdx, 'CTA order: upload, screenshot, ready-made');
  assert.equal(copySrc.includes(SPEC.screenshotCta), true);
  assert.equal(copySrc.includes(SPEC.screenshotHelper), true);
  assert.equal(copySrc.includes(SPEC.readyMadeCta), true);
  assert.equal(copySrc.includes(SPEC.readyMadeHelper), true);
  assert.ok(welcomeBlock.includes('WELCOME_SCREENSHOT_SAMPLE_HELPER'));
  assert.ok(welcomeBlock.includes('WELCOME_READY_MADE_HELPER'));
});

test('2. Welcome styling tiers — primary, emphasized-secondary, tertiary-secondary', () => {
  const welcomeBlock = appSrc.slice(appSrc.indexOf('sc-welcome-actions'), appSrc.indexOf('sc-screen--trip'));
  assert.match(welcomeBlock, /sc-btn--primary[\s\S]*Upload itinerary/);
  assert.match(welcomeBlock, /sc-btn--emphasized-secondary[\s\S]*handleTrySampleScreenshot/);
  assert.match(welcomeBlock, /sc-btn--tertiary-secondary[\s\S]*handleTrySampleItinerary/);
  assert.ok(!welcomeBlock.includes('sc-btn--primary sc-btn--large sc-btn--emphasized-secondary'), 'screenshot is not primary');
  assert.ok(appCss.includes('.sc-btn--emphasized-secondary'));
  assert.ok(appCss.includes('.sc-btn--tertiary-secondary'));
  assert.ok(appCss.includes('#533afd'));
});

test('3. Sample buttons still route to existing handlers', () => {
  assert.ok(appSrc.includes('onClick={handleTrySampleScreenshot}'));
  assert.ok(appSrc.includes('onClick={handleTrySampleItinerary}'));
  assert.ok(appSrc.includes("itineraryInputMode === 'sample-screenshot'"));
  assert.ok(appSrc.includes("setItineraryInputMode('sample')") || appSrc.includes("itineraryInputMode = 'sample'"));
});

test('4. MiniMax loading tied to real extractionLoading for the in-flight request', () => {
  assert.ok(copySrc.includes(SPEC.loading));
  assert.ok(appSrc.includes('MINIMAX_EXTRACTION_LOADING'));
  assert.match(
    appSrc,
    /\{extractionLoading && \(/,
    'loading copy gated on real extractionLoading',
  );
  assert.ok(appSrc.includes('setExtractionLoading(true)'));
  assert.ok(appSrc.includes('await extractItinerary'));
  const extractionBlock = appSrc.slice(appSrc.indexOf('setExtractionLoading(true)'), appSrc.indexOf('setExtractionLoading(false)'));
  assert.ok(!extractionBlock.includes('setTimeout'), 'no artificial dwell in extraction block');
  assert.ok(appSrc.includes('extractionError && !extractionLoading'), 'extraction errors are visible');
  assert.ok(appSrc.includes('Extraction failed:'), 'traveller-visible extraction error copy');
  assert.ok(appSrc.includes('Continue to alternatives'), 'post-extract continue CTA');
  assert.ok(appSrc.includes('setLiveExtractionReviewed(true)'), 'successful extract stays on review');
});

test('5. Provenance tag only on genuine live-success extraction', () => {
  assert.ok(copySrc.includes(SPEC.provenance));
  assert.ok(provenanceSrc.includes('MINIMAX_PROVENANCE_TAG'));
  assert.match(
    appSrc,
    /showMiniMaxProvenance[\s\S]*extractionProviderStatus\?\.status === 'live-success'[\s\S]*executed[\s\S]*!extractionProviderStatus\.fallbackUsed/,
    'provenance requires live-success with executed and no fallback',
  );
  assert.ok(appSrc.includes('<MiniMaxProvenanceTag'));
});

test('6. Ready-made path pairs offline status with explanatory note', () => {
  assert.ok(copySrc.includes(SPEC.offlineStatus));
  assert.ok(copySrc.includes(SPEC.offlineExplanation));
  assert.ok(offlineSrc.includes('MINIMAX_OFFLINE_STATUS'));
  assert.ok(offlineSrc.includes('MINIMAX_OFFLINE_EXPLANATION'));
  assert.ok(appSrc.includes('showMiniMaxOfflineExplanation'));
  assert.match(
    appSrc,
    /itineraryInputMode === 'sample' \|\| confirmedItinerary\?\.inputMode === 'sample'/,
    'offline explanation shown on ready-made path',
  );
});

test('7. Provider bar hidden before checks; uses complete not passed', () => {
  assert.ok(providerBarSrc.includes('providerChecksStarted'));
  assert.ok(providerBarSrc.includes('countCompletedChecks'));
  assert.ok(copySrc.includes('Provider checks:'));
  assert.ok(copySrc.includes('complete'));
  assert.ok(!providerBarSrc.includes(' passed'), 'must not use passed in provider bar');
  assert.ok(!providerBarSrc.includes('Live checks'), 'must not use Live checks label');
});

test('8. Provider completion count increments per resolved check', () => {
  assert.match(
    providerBarSrc,
    /if \(extraction !== null && !extractionLoading\) count \+= 1/,
    'extraction complete only when settled',
  );
  assert.match(providerBarSrc, /if \(nosana !== null\) count \+= 1/);
  assert.match(providerBarSrc, /if \(atlas !== null\) count \+= 1/);
});

console.log(`\nMiniMax visibility fix offline tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
