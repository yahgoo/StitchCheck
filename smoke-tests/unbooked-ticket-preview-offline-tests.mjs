// Offline tests for per-leg unbooked ticket previews (up to 5 Search + Verify per leg).
//
// Run:
//   node smoke-tests/unbooked-ticket-preview-offline-tests.mjs
//
// Exit code 0 = all passed. Exit code 1 = one or more failures.

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

async function testAsync(name, fn) {
  try {
    await fn();
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

const {
  selectOffersForPreview,
  selectBestOptionCard,
  splitPreviewCardsForDisplay,
  verifyOffersSequentially,
  isPlaceholderLeg,
  buildSectionLiveSourceLabel,
  MAX_PREVIEWS_PER_LEG,
  UNBOOKED_PREVIEW_DISCLOSURE,
  OFFER_SELECTION_RULE,
  BEST_OPTION_SELECTION_RULE,
  VERIFY_DELAY_MS,
  createEmptyLegSection,
} = await import(resolve(ROOT, 'app/src/atlas/unbooked-previews-core.mjs'));

const { formatMissingField } = await import(resolve(ROOT, 'core/copy/missing-field-labels.mjs'));

const NOT_AVAILABLE = formatMissingField('critical');

function mapOfferStub(offer) {
  return {
    offerReference: offer.offer_id || NOT_AVAILABLE,
    routeSummary: `${offer.offer_id} route`,
    departureTime: '08:00',
    arrivalTime: '10:00',
    priceDisplay: `USD ${offer.total_price}`,
    currency: 'USD',
    connectionType: 'nonstop',
  };
}

function mapVerifyStub(offerId, response) {
  return {
    offerId,
    status: response.status,
    currentPrice: '10',
    currency: 'USD',
  };
}

async function verifyOffersSequentiallyForTests(offers, verifyFn, delayMs, onVerifyStart) {
  return verifyOffersSequentially(offers, verifyFn, mapOfferStub, mapVerifyStub, delayMs, onVerifyStart);
}

async function loadLegUnbookedPreviewsStub(params) {
  const section = createEmptyLegSection(params.legKey, params.origin, params.destination, false);
  if (isPlaceholderLeg(params.origin, params.destination)) {
    return {
      ...section,
      placeholderBlocked: true,
      fallbackMessage: NOT_AVAILABLE,
    };
  }
  throw new Error('unexpected');
}

console.log('\n── Unbooked ticket preview offline tests ──\n');

test('1. selection rule is documented as lowest price with offer_id tie-break', () => {
  assert(
    OFFER_SELECTION_RULE.includes('lowest total_price'),
    'selection rule must describe lowest total_price',
  );
});

test('2. selectOffersForPreview returns at most 5 offers', () => {
  const offers = Array.from({ length: 12 }, (_, i) => ({
    offer_id: `offer-${String(i).padStart(2, '0')}`,
    total_price: 100 + i,
  }));
  const selected = selectOffersForPreview(offers);
  assert(selected.length === MAX_PREVIEWS_PER_LEG, 'must cap at 5');
});

test('3. selectOffersForPreview does not pad when fewer than 5 offers exist', () => {
  const offers = [
    { offer_id: 'a', total_price: 50 },
    { offer_id: 'b', total_price: 40 },
  ];
  const selected = selectOffersForPreview(offers);
  assert(selected.length === 2, 'must not pad to 5');
});

test('4. selectOffersForPreview is deterministic (lowest price first)', () => {
  const offers = [
    { offer_id: 'z', total_price: 200 },
    { offer_id: 'a', total_price: 100 },
    { offer_id: 'm', total_price: 150 },
    { offer_id: 'b', total_price: 100 },
  ];
  const selected = selectOffersForPreview(offers);
  assert(selected[0].offer_id === 'a', 'lowest price a before b tie-break');
  assert(selected[1].offer_id === 'b', 'lexicographic tie-break on offer_id');
});

await testAsync('5. verifyOffersSequentially calls Verify one at a time (no overlap)', async () => {
  const offers = [
    { offer_id: 'o1', total_price: 10, currency: 'USD', segments: [], bookable: true, price_status: 'current' },
    { offer_id: 'o2', total_price: 20, currency: 'USD', segments: [], bookable: true, price_status: 'current' },
    { offer_id: 'o3', total_price: 30, currency: 'USD', segments: [], bookable: true, price_status: 'current' },
  ];

  let inFlight = 0;
  let maxInFlight = 0;
  const order = [];

  const verifyFn = async (offerId) => {
    order.push(`start-${offerId}`);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    order.push(`end-${offerId}`);
    return {
      status: 'success',
      code: 'OFFER_VERIFIED',
      message: 'ok',
      data: { current_price: 10, currency: 'USD' },
      timestamp: new Date().toISOString(),
    };
  };

  await verifyOffersSequentiallyForTests(offers, verifyFn, 0, (id) => order.push(`hook-${id}`));

  assert(maxInFlight === 1, 'Verify must never run in parallel');
  assert(order.filter((x) => x.startsWith('start-')).length === 3, 'three verify starts');
  assert(order.indexOf('end-o1') < order.indexOf('start-o2'), 'o2 starts after o1 ends');
});

await testAsync('6. one failed Verify does not block other cards in the leg', async () => {
  const offers = [
    { offer_id: 'good-1', total_price: 10, currency: 'USD', segments: [], bookable: true, price_status: 'current' },
    { offer_id: 'bad-2', total_price: 20, currency: 'USD', segments: [], bookable: true, price_status: 'current' },
    { offer_id: 'good-3', total_price: 30, currency: 'USD', segments: [], bookable: true, price_status: 'current' },
  ];

  const verifyFn = async (offerId) => {
    if (offerId === 'bad-2') {
      throw new Error('verify failed');
    }
    return {
      status: 'success',
      code: 'OFFER_VERIFIED',
      message: 'ok',
      data: { current_price: 10, currency: 'USD' },
      timestamp: new Date().toISOString(),
    };
  };

  const cards = await verifyOffersSequentiallyForTests(offers, verifyFn, 0);
  assert(cards.length === 3, 'all three cards attempted');
  assert(cards[0].isLiveVerified === true, 'first card verified');
  assert(cards[1].status === 'verify-failed', 'middle card failed');
  assert(cards[2].isLiveVerified === true, 'third card still verified');
});

test('7. disclosure banner renders once per leg section, not on each card by default', () => {
  const legSrc = readFileSync(resolve(ROOT, 'app/src/components/UnbookedTicketPreviewLegSection.tsx'), 'utf-8');
  const cardSrc = readFileSync(resolve(ROOT, 'app/src/components/UnbookedTicketPreview.tsx'), 'utf-8');
  assert(legSrc.includes('UNBOOKED_PREVIEW_DISCLOSURE'), 'leg section must import disclosure constant');
  assert(legSrc.includes('sc-unbooked-preview-leg__disclosure'), 'leg section must render disclosure once');
  assert(cardSrc.includes('showDisclosureBanner'), 'card must gate disclosure via prop');
  assert(cardSrc.includes('showDisclosureBanner = false'), 'card defaults to no per-card disclosure');
  const disclosureMatches = legSrc.match(/sc-unbooked-preview-leg__disclosure/g) ?? [];
  assert(disclosureMatches.length === 1, 'leg section must render disclosure element exactly once');
});

test('8. per-card live tag only when isLiveVerified is true', () => {
  const src = readFileSync(resolve(ROOT, 'app/src/components/UnbookedTicketPreview.tsx'), 'utf-8');
  assert(src.includes('card.isLiveVerified'), 'live tag gated on isLiveVerified');
});

test('9. section live source label only when liveVerifiedCount >= 1', () => {
  assert(buildSectionLiveSourceLabel(0) === null, 'no label at zero successes');
  const label = buildSectionLiveSourceLabel(2);
  assert(label.includes('2 offers verified individually'), 'label reflects verified count');
});

test('10. placeholder AAA/BBB/CCC legs use honest fallback (no fabricated cards)', async () => {
  const section = await loadLegUnbookedPreviewsStub({
    legKey: 'first',
    origin: 'AAA',
    destination: 'BBB',
    depart: '2026-09-15',
    searchFn: async () => {
      throw new Error('search must not run for placeholder leg');
    },
    verifyFn: async () => {
      throw new Error('verify must not run for placeholder leg');
    },
  });

  assert(section.placeholderBlocked === true, 'placeholder leg blocked');
  assert(section.cards.length === 0, 'no fabricated cards');
  assert(
    section.fallbackMessage === formatMissingField('critical'),
    'honest fallback message',
  );
});

test('11. isPlaceholderLeg detects synthetic extraction codes', () => {
  assert(isPlaceholderLeg('AAA', 'BKK') === true, 'AAA origin blocked');
  assert(isPlaceholderLeg('KUL', 'BBB') === true, 'BBB destination blocked');
  assert(isPlaceholderLeg('KUL', 'BKK') === false, 'real route allowed');
});

test('12. only /api/atlas/search and /api/atlas/verify are used (no new Atlas route)', () => {
  const clientSrc = readFileSync(resolve(ROOT, 'app/src/atlas/client.ts'), 'utf-8');
  const previewsSrc = readFileSync(resolve(ROOT, 'app/src/atlas/unbooked-previews.ts'), 'utf-8');
  assert(previewsSrc.includes("from './client'"), 'previews import atlas client');
  assert(!previewsSrc.includes('/api/atlas/order'), 'no order route in previews module');
  assert(clientSrc.includes("'/api/atlas/search'"), 'search route exists');
  assert(clientSrc.includes("'/api/atlas/verify'"), 'verify route exists');
});

test('13. VERIFY_DELAY_MS defaults to 300ms sequential spacing', () => {
  assert(VERIFY_DELAY_MS >= 200 && VERIFY_DELAY_MS <= 500, 'delay within requested range');
  const src = readFileSync(resolve(ROOT, 'app/src/atlas/unbooked-previews.ts'), 'utf-8');
  assert(src.includes('await sleep(delayMs)'), 'delay between sequential verify calls');
});

test('14. App.tsx mounts per-leg preview sections on options screen in live mode', () => {
  const appSrc = readFileSync(resolve(ROOT, 'app/src/App.tsx'), 'utf-8');
  const pipelineSrc = readFileSync(resolve(ROOT, 'app/src/atlas/unbooked-previews.ts'), 'utf-8');
  assert(appSrc.includes('UnbookedTicketPreviewLegSection'), 'leg section component used');
  assert(appSrc.includes('loadLegUnbookedPreviews'), 'pipeline invoked from App');
  assert(pipelineSrc.includes('First flight — unbooked previews'), 'first leg title defined in pipeline');
});

test('15. BEST_OPTION_SELECTION_RULE is documented', () => {
  assert(
    BEST_OPTION_SELECTION_RULE.includes('lowest total_price'),
    'best option rule must reference lowest total_price',
  );
  assert(
    BEST_OPTION_SELECTION_RULE.includes('successful Verify'),
    'best option rule must prefer successful verify',
  );
});

test('16. selectBestOptionCard picks lowest-priced verified offer when mix of outcomes', () => {
  const cards = [
    { offerReference: 'cheap-fail', status: 'verify-failed', isLiveVerified: false, priceDisplay: 'USD 50' },
    { offerReference: 'mid-ok', status: 'verified', isLiveVerified: true, priceDisplay: 'USD 80' },
    { offerReference: 'high-ok', status: 'verified', isLiveVerified: true, priceDisplay: 'USD 120' },
  ];
  const best = selectBestOptionCard(cards);
  assert(best?.offerReference === 'mid-ok', 'must pick lowest-priced verified offer, not first card');
});

test('17. selectBestOptionCard falls back to lowest-priced attempted offer when all verify failed', () => {
  const cards = [
    { offerReference: 'a', status: 'verify-failed', isLiveVerified: false, failureMessage: 'Could not verify this offer' },
    { offerReference: 'b', status: 'verify-failed', isLiveVerified: false, failureMessage: 'Could not verify this offer' },
  ];
  const best = selectBestOptionCard(cards);
  assert(best?.offerReference === 'a', 'must show lowest-priced attempted offer with failed status');
  assert(best?.status === 'verify-failed', 'featured card must remain honestly unverified');
});

test('18. splitPreviewCardsForDisplay keeps remaining count for See more link', () => {
  const cards = [
    { offerReference: 'a', status: 'verify-failed', isLiveVerified: false },
    { offerReference: 'b', status: 'verified', isLiveVerified: true },
    { offerReference: 'c', status: 'verified', isLiveVerified: true },
  ];
  const { best, remaining } = splitPreviewCardsForDisplay(cards);
  assert(best?.offerReference === 'b', 'best is lowest verified');
  assert(remaining.length === 2, 'remaining count must be cards.length - 1');
});

test('19. leg section shows one featured card by default with expand affordance', () => {
  const legSrc = readFileSync(resolve(ROOT, 'app/src/components/UnbookedTicketPreviewLegSection.tsx'), 'utf-8');
  assert(legSrc.includes('useState(false)'), 'expanded defaults to collapsed');
  assert(legSrc.includes('sc-unbooked-preview-leg__featured'), 'featured card container exists');
  assert(legSrc.includes('See more verified options'), 'expand affordance copy present');
  assert(legSrc.includes('!expanded'), 'remaining cards hidden until expanded');
});

test('20. each card shows short status line only (Verified just now / Could not verify)', () => {
  const cardSrc = readFileSync(resolve(ROOT, 'app/src/components/UnbookedTicketPreview.tsx'), 'utf-8');
  assert(cardSrc.includes('Verified just now'), 'verified short status present');
  assert(cardSrc.includes('Could not verify this offer'), 'failed short status present');
  assert(cardSrc.includes('sc-unbooked-preview__status'), 'short status element class present');
});

console.log(`\nUnbooked ticket preview offline tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
