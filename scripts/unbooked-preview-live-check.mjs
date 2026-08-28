// Live end-to-end check for per-leg unbooked ticket previews.
//
// Uses real IATA codes from demo assets (KUL→BKK, BKK→HAN).
// Calls Atlas via the same read-only proxy CLI path (search + sequential verify).
//
// Run:
//   node scripts/unbooked-preview-live-check.mjs
//
// Requires atlas-flight CLI configured for sandbox.

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { execCli } from '../app/server/atlas-proxy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const {
  selectOffersForPreview,
  verifyOffersSequentially,
  isPlaceholderLeg,
  VERIFY_DELAY_MS,
  OFFER_SELECTION_RULE,
} = await import(resolve(ROOT, 'app/src/atlas/unbooked-previews-core.mjs'));

const demo = JSON.parse(
  readFileSync(resolve(ROOT, 'app-fixture-contracts/stitchcheck-ui-demo-data.json'), 'utf-8'),
);
const extraction = demo.uiStates.itineraryUnconfirmed.extractionResult;

const legs = [
  {
    name: 'first',
    origin: extraction.firstLeg.origin,
    destination: extraction.firstLeg.destination,
    depart: extraction.firstLeg.departureDate,
  },
  {
    name: 'second',
    origin: extraction.secondLeg.origin,
    destination: extraction.secondLeg.destination,
    depart: extraction.secondLeg.departureDate,
  },
];

async function atlasSearchViaCli({ origin, destination, depart }) {
  await execCli(['environment', 'use', 'sandbox', '--json']);
  const result = await execCli([
    'search',
    '--origin', origin,
    '--destination', destination,
    '--depart', depart,
    '--adults', '1',
    '--currency', 'USD',
    '--json',
  ]);
  if (!result.parsed || result.parsed.status !== 'success') {
    throw new Error(`search failed for ${origin}→${destination}`);
  }
  const data = result.parsed.data ?? result.parsed;
  const offers = data.offers ?? [];
  return {
    searchId: data.search_id ?? `live-${Date.now()}`,
    offerCount: offers.length,
    offers,
    responseCode: result.parsed.code ?? 'OK',
    timestamp: new Date().toISOString(),
  };
}

async function atlasVerifyViaCli(offerId) {
  const result = await execCli(['offer', 'verify', '--offer-id', offerId, '--json']);
  if (!result.parsed) {
    throw new Error(`verify parse failed for ${offerId}`);
  }
  return {
    status: result.parsed.status,
    code: result.parsed.code ?? null,
    message: result.parsed.message ?? null,
    data: result.parsed.data ?? null,
    timestamp: new Date().toISOString(),
  };
}

function mapOfferFromAtlas(offer) {
  const dep = offer.segments?.[0]?.departure_airport ?? '???';
  const arr = offer.segments?.[offer.segments.length - 1]?.arrival_airport ?? '???';
  return {
    offerReference: offer.offer_id,
    routeSummary: `${dep} → ${arr}`,
    departureTime: '—',
    arrivalTime: '—',
    priceDisplay: `${offer.currency} ${offer.total_price}`,
    currency: offer.currency,
    connectionType: (offer.segments?.length ?? 1) <= 1 ? 'nonstop' : `${(offer.segments?.length ?? 1) - 1}-stop`,
  };
}

function mapVerifyFromAtlas(offerId, response) {
  return {
    offerId,
    status: response.status,
    currentPrice: response.data?.current_price != null ? String(response.data.current_price) : undefined,
    currency: response.data?.currency,
  };
}
console.log(`Selection rule: ${OFFER_SELECTION_RULE}`);
console.log(`Verify delay: ${VERIFY_DELAY_MS}ms between calls\n`);

let totalSearchCalls = 0;
let totalVerifyCalls = 0;

for (const leg of legs) {
  console.log(`Leg: ${leg.name} (${leg.origin}→${leg.destination})`);

  if (isPlaceholderLeg(leg.origin, leg.destination)) {
    console.log('  SKIPPED — placeholder/synthetic IATA codes\n');
    continue;
  }

  totalSearchCalls += 1;
  let searchResponse;
  try {
    searchResponse = await atlasSearchViaCli(leg);
  } catch (err) {
    console.log(`  Search failed: ${err.message}\n`);
    continue;
  }

  const offersReturned = searchResponse.offers.length;
  const selected = selectOffersForPreview(searchResponse.offers);
  console.log(`  Offers returned: ${offersReturned}`);
  console.log(`  Offers selected: ${selected.length}`);

  const verifyStarts = [];
  const cards = await verifyOffersSequentially(
    selected,
    async (offerId) => {
      verifyStarts.push(offerId);
      totalVerifyCalls += 1;
      return atlasVerifyViaCli(offerId);
    },
    mapOfferFromAtlas,
    mapVerifyFromAtlas,
    VERIFY_DELAY_MS,
  );

  const successes = cards.filter((c) => c.isLiveVerified).length;
  const failures = cards.filter((c) => c.status === 'verify-failed').length;
  console.log(`  Verify successes: ${successes}`);
  console.log(`  Verify failures: ${failures}`);
  console.log(`  Verify order: ${verifyStarts.join(', ')}\n`);
}

console.log('Totals:');
console.log(`  Search calls: ${totalSearchCalls}`);
console.log(`  Verify calls: ${totalVerifyCalls}`);
console.log('\nLIVE_END_TO_END_CHECK = RUN_WITH_RESULTS\n');
