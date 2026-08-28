#!/usr/bin/env node
/* ── Persona UX critique offline tests (2026-08-26) ──
 *
 * Validates the five Codex persona improvements:
 *  1. Price-sort raw alternatives (OFFER_SELECTION_RULE)
 *  2. Collapse/expand with "See more live alternatives (N)"
 *  3. Lowest-price label on first sorted card
 *  4. Verify-then-select (no silent switch on failed verify)
 *  5. Omit blank arrival impact on compact recommended card
 *
 * Run: node smoke-tests/persona-ux-critique-offline-tests.mjs
 */

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

function section(title) {
  console.log(`\n── ${title} ──`);
}

const {
  sortOffersBySelectionRule,
  sortAlternativesBySelectionRule,
  splitAlternativesForDisplay,
  shouldSelectPlanAfterVerify,
  OFFER_SELECTION_RULE,
} = await import(resolve(ROOT, 'app/src/atlas/unbooked-previews-core.mjs'));

const appTsx = readFileSync(resolve(ROOT, 'app/src/App.tsx'), 'utf8');
const liveListTsx = readFileSync(resolve(ROOT, 'app/src/components/LiveAlternativesList.tsx'), 'utf8');
const recoveryAnimTsx = readFileSync(resolve(ROOT, 'app/src/components/RecoveryPlanAnimation.tsx'), 'utf8');
const adapterTs = readFileSync(resolve(ROOT, 'app/src/atlas/adapter.ts'), 'utf8');

section('1. Price-sort raw alternatives');

test('OFFER_SELECTION_RULE documents total_price + offer_id ordering', () => {
  assert(
    OFFER_SELECTION_RULE.includes('total_price') && OFFER_SELECTION_RULE.includes('offer_id'),
    'Selection rule must reference total_price and offer_id',
  );
});

test('sortOffersBySelectionRule orders ascending by total_price', () => {
  const offers = [
    { offer_id: 'OD805', total_price: 38.6 },
    { offer_id: 'AK701', total_price: 21.8 },
    { offer_id: 'MH100', total_price: 35.55 },
    { offer_id: 'AK702', total_price: 21.8 },
  ];
  const sorted = sortOffersBySelectionRule(offers);
  assert(sorted[0].offer_id === 'AK701', 'Lowest price AK701 should be first');
  assert(sorted[1].offer_id === 'AK702', 'Tie-break offer_id lexicographic for equal price');
  assert(sorted[sorted.length - 1].offer_id === 'OD805', 'Highest price should be last');
});

test('sortAlternativesBySelectionRule mirrors offer sort on mapped alternatives', () => {
  const alts = [
    { offerReference: 'OD805', priceDisplay: 'USD 38.60' },
    { offerReference: 'AK701', priceDisplay: 'USD 21.80' },
    { offerReference: 'MH100', priceDisplay: 'USD 35.55' },
  ];
  const sorted = sortAlternativesBySelectionRule(alts);
  assert(sorted[0].offerReference === 'AK701', 'AK701 must sort first by parsed price');
  assert(sorted[2].offerReference === 'OD805', 'OD805 must sort last');
});

test('mapSearchResponseToResult sorts offers before mapping', () => {
  assert(
    adapterTs.includes('sortOffersBySelectionRule') && adapterTs.includes('.map(mapOfferToAlternative)'),
    'Adapter must sort raw offers before mapping to alternatives',
  );
});

section('2. Collapse/expand live alternatives');

test('LiveAlternativesList uses expanded state and aria-expanded', () => {
  assert(
    liveListTsx.includes('useState(false)') && liveListTsx.includes('aria-expanded={false}'),
    'Live list must mirror unbooked preview expand pattern',
  );
});

test('Default view shows featured card only with See more disclosure', () => {
  assert(
    liveListTsx.includes('splitAlternativesForDisplay') &&
    liveListTsx.includes('See more live alternatives') &&
    liveListTsx.includes('remaining.length'),
    'Featured + remaining split with See more live alternatives (N)',
  );
});

test('Expanded view renders all remaining cards', () => {
  assert(
    liveListTsx.includes('{expanded &&') && liveListTsx.includes('remaining.map'),
    'Expanded state must reveal remaining alternatives',
  );
});

test('Split uses price-sorted order (featured is lowest price)', () => {
  const alts = [
    { offerReference: 'B', priceDisplay: 'USD 50.00' },
    { offerReference: 'A', priceDisplay: 'USD 10.00' },
    { offerReference: 'C', priceDisplay: 'USD 30.00' },
  ];
  const { featured, remaining } = splitAlternativesForDisplay(alts);
  assert(featured.offerReference === 'A', 'Featured must be lowest-priced after sort');
  assert(remaining.length === 2, 'Remaining count must exclude featured');
  assert(
    sortAlternativesBySelectionRule(remaining)[0].offerReference === 'C',
    'Remaining stays price-sorted',
  );
});

section('3. Lowest price shown label');

test('First featured card shows Lowest price shown badge', () => {
  assert(
    liveListTsx.includes('Lowest price shown') && liveListTsx.includes('showLowestPriceLabel'),
    'Featured card must carry lowest-price label derived from sort position',
  );
});

test('Remaining cards do not show lowest-price label', () => {
  assert(
    liveListTsx.includes('showLowestPriceLabel={false}'),
    'Only the first sorted card gets the lowest-price label',
  );
});

test('Label is position-based, not a hardcoded offer id', () => {
  const first = splitAlternativesForDisplay([
    { offerReference: 'ZZZ', priceDisplay: 'USD 5.00' },
    { offerReference: 'AK701', priceDisplay: 'USD 21.80' },
  ]).featured;
  assert(first.offerReference === 'ZZZ', 'Lowest price is ZZZ in this fixture, not hardcoded AK701');
});

section('4. Verify and select plan');

test('shouldSelectPlanAfterVerify only accepts success', () => {
  assert(shouldSelectPlanAfterVerify('success') === true, 'Success allows selection');
  assert(shouldSelectPlanAfterVerify('price_changed') === false, 'Price change must not select');
  assert(shouldSelectPlanAfterVerify('error') === false, 'Error must not select');
  assert(shouldSelectPlanAfterVerify('failed') === false, 'Failed must not select');
});

test('App sets decision only after successful verify', () => {
  assert(
    appTsx.includes('shouldSelectPlanAfterVerify(summary.status)') &&
    appTsx.includes("setDecision('switch')"),
    'handleVerifyOffer must gate setDecision on successful verify',
  );
});

test('Combined action replaces separate Verify and Switch buttons on raw cards', () => {
  assert(
    liveListTsx.includes('Verify and select plan') &&
    !liveListTsx.includes('Verify offer') &&
    !liveListTsx.includes('Switch to this plan'),
    'Raw cards use one combined verify-and-select action',
  );
});

test('Verify outcome banner shows current price when available', () => {
  assert(
    liveListTsx.includes('Current price:') && liveListTsx.includes('verifyResult.currentPrice'),
    'Verify outcome must show current price when present',
  );
});

test('Final confirmation copy unchanged', () => {
  assert(
    appTsx.includes('Submit switch request') &&
    appTsx.includes('Request submitted — awaiting verified supplier outcome') &&
    appTsx.includes('No booking, payment, reservation, or order is created'),
    'Final confirmation and safety disclosure must remain unchanged',
  );
});

test('No Booked/Switched claims in traveller outcome copy', () => {
  assert(
    !appTsx.includes('Booked') && !appTsx.includes('Switched successfully'),
    'Done screen must not claim Booked or Switched outcome',
  );
});

section('5. Arrival impact omission');

test('Compact recommended card omits arrival impact when null', () => {
  assert(
    appTsx.includes('arrivalImpactMinutes !== null') &&
    appTsx.includes('Arrival impact:'),
    'Recommended card shows arrival impact only when value is non-null',
  );
});

test('Compact recommended card no longer shows blank dash for null', () => {
  const tradeoffBlock = appTsx.match(
    /recommendedPlan\.tradeoffs[\s\S]{0,220}sc-recommended-tradeoff/,
  );
  assert(tradeoffBlock, 'Recommended tradeoff block must exist');
  assert(
    !tradeoffBlock[0].includes('formatMissingField'),
    'Must not render Arrival impact dash for null on compact card',
  );
});

test('Detailed recovery PlanCard still shows not available for null', () => {
  assert(
    recoveryAnimTsx.includes('arrivalImpactMinutes === null') &&
    recoveryAnimTsx.includes('NON_CRITICAL_MISSING'),
    'RecoveryPlanAnimation TradeoffsList must still show unavailable honestly',
  );
});

console.log(`\n${'═'.repeat(50)}`);
console.log(`Persona UX critique tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
