// Sample itinerary screenshot entry-point tests.
//
// Run: node smoke-tests/sample-itinerary-screenshot-tests.mjs

import { readFileSync, existsSync } from 'node:fs';
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
const screenshotData = JSON.parse(
  readFileSync(resolve(ROOT, 'app-fixture-contracts/sample-itinerary-screenshot-data.json'), 'utf-8'),
);
const screenshotModule = readFileSync(resolve(ROOT, 'app/src/data/sample-itinerary-screenshot.ts'), 'utf-8');
const confirmedSrc = readFileSync(resolve(ROOT, 'app/src/domain/confirmed-itinerary.ts'), 'utf-8');

console.log('\n── Sample itinerary screenshot tests ──\n');

const copyModule = readFileSync(resolve(ROOT, 'app/src/data/minimax-visibility-copy.ts'), 'utf-8');

test('1. Welcome screen shows sample screenshot entry point distinct from structured sample', () => {
  assert(copyModule.includes('Extract with MiniMax M3'), 'screenshot CTA text');
  assert(copyModule.includes('Use sample — no extraction'), 'structured sample CTA preserved');
  assert(appSrc.includes('handleTrySampleScreenshot'), 'screenshot handler');
  assert(appSrc.includes('handleTrySampleItinerary'), 'structured sample handler preserved');
  const welcomeBlock = appSrc.slice(appSrc.indexOf('sc-welcome-actions'), appSrc.indexOf('sc-screen--trip'));
  const uploadIdx = welcomeBlock.indexOf('Upload itinerary');
  const screenshotIdx = welcomeBlock.indexOf('WELCOME_SCREENSHOT_SAMPLE_CTA');
  const readyMadeIdx = welcomeBlock.indexOf('WELCOME_READY_MADE_CTA');
  assert(screenshotIdx > uploadIdx && readyMadeIdx > screenshotIdx, 'screenshot sample listed before ready-made');
});

test('2. Screenshot path invokes extractItinerary with sample image, not structured shortcut', () => {
  assert(appSrc.includes("itineraryInputMode === 'sample-screenshot'"), 'sample-screenshot mode');
  assert(appSrc.includes('sampleItineraryScreenshot'), 'inline sample screenshot import');
  assert(appSrc.includes('extractItinerary'), 'extraction client used');
  assert(appSrc.includes("skipLiveExtraction = itineraryInputMode === 'sample'"), 'only structured sample skips extraction');
  assert(
    appSrc.includes("itineraryInputMode === 'sample-screenshot'")
      && appSrc.includes('sampleItineraryScreenshot'),
    'screenshot image wired into extraction path',
  );
  const handlerBlock = appSrc.slice(
    appSrc.indexOf('handleTrySampleScreenshot'),
    appSrc.indexOf('const isLive'),
  );
  assert(!handlerBlock.includes('getSampleItineraryExtraction'), 'screenshot handler must not load structured sample');
  assert(handlerBlock.includes('getSampleScreenshotExtraction'), 'screenshot handler seeds screenshot itinerary');
  assert(!handlerBlock.includes('getDefaultExtraction'), 'screenshot handler must not seed KUL→BKK→HAN default');
});

test('3. Generated image exists and flight data matches Atlas-sourced fixture JSON', () => {
  const publicPath = resolve(ROOT, 'app/public/sample-itinerary-screenshot.png');
  const assetPath = resolve(ROOT, 'app/src/assets/sample-itinerary-screenshot.png');
  assert(existsSync(publicPath), 'public PNG exists');
  assert(existsSync(assetPath), 'bundled asset PNG exists');
  assert(screenshotData.firstLeg.flightNumber === 'AK701', 'leg1 flight from Atlas sandbox capture');
  assert(screenshotData.secondLeg.flightNumber === 'TR624', 'leg2 flight from live walkthrough capture');
  assert(screenshotData.meta.sources.length === 2, 'Atlas source citations recorded');
});

test('4. Review/correction screen remains editable (same upload path controls)', () => {
  assert(appSrc.includes('Edit itinerary'), 'edit control on trip screen');
  assert(appSrc.includes('setIsEditing(true)'), 'edit mode toggle');
  assert(appSrc.includes('handleFieldChange'), 'field change handler');
  assert(appSrc.includes('sc-edit-form'), 'edit form markup');
});

test('5. Route continuity uses confirmed snapshot after extraction merge, not pre-extract fixture', () => {
  assert(appSrc.includes('createConfirmedItinerarySnapshot'), 'snapshot at confirm');
  assert(appSrc.includes('performLiveSearchForConfirmed(snapshot)'), 'Atlas from snapshot');
  const handler = appSrc.slice(appSrc.indexOf('const handleCheckMyTrip'), appSrc.indexOf('const handleRestart'));
  const extractIdx = handler.indexOf('await extractItinerary');
  const snapshotIdx = handler.indexOf('createConfirmedItinerarySnapshot');
  assert(extractIdx >= 0 && snapshotIdx > extractIdx, 'extract runs before snapshot');
  assert(handler.includes('createConfirmedItinerarySnapshot(merged'), 'snapshot uses merged MiniMax legs');
  assert(handler.includes('setLiveExtractionReviewed(true)'), 'successful extract stays on review before confirm');
  assert(appSrc.includes('Continue to alternatives'), 'post-extract CTA advances to Options');
  assert(confirmedSrc.includes("'sample-screenshot'"), 'input mode type includes screenshot');
  assert(appSrc.includes("'sample-screenshot'"), 'App uses sample-screenshot mode');
});

test('6. Demo labeling — not a real ticket', () => {
  assert(appSrc.includes('not a real ticket'), 'honest screenshot copy in UI');
  assert(screenshotModule.includes('not a real ticket'), 'banner module copy');
  assert(screenshotData.watermarkLines.some((l) => /not a real ticket/i.test(l)), 'watermark in image data');
});

test('7. Generation script is checked in and references Atlas data file', () => {
  const genScript = readFileSync(resolve(ROOT, 'scripts/generate-sample-itinerary-image.mjs'), 'utf-8');
  assert(genScript.includes('sample-itinerary-screenshot-data.json'), 'generator reads Atlas-sourced data');
  assert(genScript.includes('encodePng'), 'reproducible PNG output');
});

console.log(`\nSample itinerary screenshot tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
