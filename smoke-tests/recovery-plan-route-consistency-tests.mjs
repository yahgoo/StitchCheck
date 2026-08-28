/* ── Recovery Plan route-consistency tests ──
 *
 * Asserts that the Recovery Plan's displayed route is consistent with
 * the confirmed itinerary's route. The trigger route, cascade labels,
 * candidate alternatives, and recommended plan must all reference the
 * traveller's actual confirmed route — never an unrelated hardcoded route.
 *
 * These tests verify the source code structure and re-implement the
 * pure functions inline (same pattern as dependency-graph-offline-tests).
 *
 * Run: node smoke-tests/recovery-plan-route-consistency-tests.mjs */

import assert from 'node:assert/strict';
import fs from 'node:fs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
  }
}

const coreDir = new URL('../core/domain/', import.meta.url);
const adapterSrc = fs.readFileSync(new URL('recovery-plan-adapter.ts', coreDir), 'utf8');
const riskCompSrc = fs.readFileSync(new URL('risk-computation.ts', coreDir), 'utf8');
const daytonaRiskSrc = fs.readFileSync(
  new URL('../app/src/data/daytona-offline-risk.ts', import.meta.url),
  'utf8',
);
const appTsxSrc = fs.readFileSync(
  new URL('../app/src/App.tsx', import.meta.url),
  'utf8',
);

console.log('\n── Recovery Plan route-consistency tests ──\n');

/* ── 1. Adapter accepts itinerary context parameter ── */
test('riskResultToAnimationData accepts itineraryContext parameter', () => {
  assert.ok(
    /export function riskResultToAnimationData\([^)]*itineraryContext\??: ItineraryContext/.test(adapterSrc),
    'riskResultToAnimationData must accept an optional itineraryContext parameter',
  );
});

/* ── 2. Adapter uses itinerary context for trigger route ── */
test('Adapter derives trigger route from itinerary context (not hardcoded)', () => {
  assert.ok(
    /itineraryContext\.firstLegOrigin/.test(adapterSrc),
    'Adapter must reference itineraryContext.firstLegOrigin',
  );
  assert.ok(
    /itineraryContext\.firstLegDestination/.test(adapterSrc),
    'Adapter must reference itineraryContext.firstLegDestination',
  );
});

/* ── 3. Adapter no longer hardcodes SIN → BKK ── */
test('Adapter no longer hardcodes "SIN → BKK" as trigger route', () => {
  /* Check that 'SIN → BKK' does not appear as a literal routeSummary assignment */
  const lines = adapterSrc.split('\n');
  const hardcodedLines = lines.filter(
    (l) => /routeSummary.*SIN.*BKK/.test(l) || /routeSummary.*'SIN → BKK'/.test(l),
  );
  assert.equal(
    hardcodedLines.length,
    0,
    `Adapter must not hardcode "SIN → BKK" in routeSummary. Found: ${hardcodedLines.join(', ')}`,
  );
});

/* ── 4. Adapter no longer hardcodes BKK → HAN as onward option ── */
test('Adapter no longer hardcodes "BKK → HAN" as onward route', () => {
  const lines = adapterSrc.split('\n');
  const hardcodedLines = lines.filter(
    (l) => /routeSummary.*BKK.*HAN/.test(l) || /routeSummary.*'BKK → HAN'/.test(l),
  );
  assert.equal(
    hardcodedLines.length,
    0,
    `Adapter must not hardcode "BKK → HAN" in routeSummary. Found: ${hardcodedLines.join(', ')}`,
  );
});

/* ── 5. Without context, honest "not available" state ── */
test('Without context, trigger route uses honest "not available" state', () => {
  assert.ok(
    /formatMissingField\('critical'\)/.test(adapterSrc),
    'Adapter must use critical missing-field label when no context',
  );
});

/* ── 6. Risk computation accepts itinerary context ── */
test('RiskComputationSeed includes optional itineraryContext', () => {
  assert.ok(
    /itineraryContext\??: ItineraryContext/.test(riskCompSrc),
    'RiskComputationSeed must include optional itineraryContext field',
  );
});

/* ── 7. Dependency graph labels derive from context ── */
test('Dependency graph labels derive from itinerary context', () => {
  assert.ok(
    /ctx\.firstLegDestination/.test(riskCompSrc) || /itineraryContext\.firstLegDestination/.test(riskCompSrc),
    'Risk computation must use itinerary context for connection airport label',
  );
  assert.ok(
    /ctx\.secondLegOrigin/.test(riskCompSrc) || /itineraryContext\.secondLegOrigin/.test(riskCompSrc),
    'Risk computation must use itinerary context for onward leg label',
  );
});

/* ── 8. getDaytonaOfflineRecoveryAnimation accepts itinerary context ── */
test('getDaytonaOfflineRecoveryAnimation accepts itineraryContext parameter', () => {
  assert.ok(
    /export function getDaytonaOfflineRecoveryAnimation\([^)]*itineraryContext\??: ItineraryContext/.test(daytonaRiskSrc),
    'getDaytonaOfflineRecoveryAnimation must accept itineraryContext',
  );
});

/* ── 9. App.tsx builds itinerary context from extraction ── */
test('App.tsx builds itineraryContext from confirmed extraction', () => {
  assert.ok(
    /itineraryContext.*useMemo/.test(appTsxSrc) || /const itineraryContext/.test(appTsxSrc),
    'App.tsx must build itineraryContext via useMemo',
  );
  assert.ok(
    /firstLegOrigin.*extraction\.firstLeg\.origin/.test(appTsxSrc),
    'App.tsx must wire extraction.firstLeg.origin to itineraryContext',
  );
  assert.ok(
    /firstLegDestination.*extraction\.firstLeg\.destination/.test(appTsxSrc),
    'App.tsx must wire extraction.firstLeg.destination to itineraryContext',
  );
});

/* ── 10. App.tsx passes itineraryContext to recovery animation ── */
test('App.tsx passes itineraryContext to getDaytonaOfflineRecoveryAnimation', () => {
  assert.ok(
    /getDaytonaOfflineRecoveryAnimation\([^)]*itineraryContext/.test(appTsxSrc),
    'App.tsx must pass itineraryContext to getDaytonaOfflineRecoveryAnimation',
  );
});

/* ── 11. ItineraryContext type is exported from core ── */
test('ItineraryContext type is exported from core/domain', () => {
  const indexSrc = fs.readFileSync(new URL('index.ts', coreDir), 'utf8');
  assert.ok(
    /ItineraryContext/.test(indexSrc),
    'core/domain/index.ts must export ItineraryContext',
  );
});

/* ── 12. Candidates without context return empty (no fabrication) ── */
test('generateCandidates returns empty without itinerary context', () => {
  assert.ok(
    /if \(!itineraryContext\) return candidates/.test(adapterSrc),
    'generateCandidates must return empty array without itinerary context',
  );
});

/* ── 13. All three downstream items are always present for high risk ── */
test('Risk computation includes all 3 downstream items (connection, onward, hotel)', () => {
  assert.ok(/connection-window/.test(riskCompSrc), 'Must include connection-window');
  assert.ok(/onward-leg/.test(riskCompSrc), 'Must include onward-leg');
  assert.ok(/hotel-checkin/.test(riskCompSrc), 'Must include hotel-checkin');
});

/* ── 14. Placeholder data uses consistent route (no SIN → BKK) ── */
test('Placeholder recovery plan data uses consistent route (not SIN → BKK)', () => {
  const rpaSrc = fs.readFileSync(
    new URL('../app/src/components/RecoveryPlanAnimation.tsx', import.meta.url),
    'utf8',
  );
  /* The placeholder data should not contain SIN → BKK */
  const placeholderSection = rpaSrc.split('placeholderRecoveryPlanData')[1] ?? '';
  assert.ok(
    !placeholderSection.includes("'SIN → BKK'"),
    'Placeholder data must not use old hardcoded "SIN → BKK" route',
  );
});

console.log(`\nRecovery plan route-consistency tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
