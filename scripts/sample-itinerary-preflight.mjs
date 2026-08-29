// Fresh Search→Verify preflight for sample-itinerary two-leg pair.
//
// Run: node scripts/sample-itinerary-preflight.mjs

import { execCli } from '../app/server/atlas-proxy.mjs';
import {
  selectOffersForPreview,
  VERIFY_DELAY_MS,
} from '../app/src/atlas/unbooked-previews-core.mjs';

const DEPART = '2026-10-01';

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
    throw new Error(`search failed ${origin}→${destination}`);
  }
  const data = result.parsed.data ?? result.parsed;
  return data.offers ?? [];
}

async function verifyFirstSuccess(offers) {
  const selected = selectOffersForPreview(offers, 5);
  for (const offer of selected) {
    const result = await execCli(['offer', 'verify', '--offer-id', offer.offer_id, '--json']);
    const status = result.parsed?.status;
    if (status === 'success') {
      return { offerId: offer.offer_id, status };
    }
    await new Promise((r) => setTimeout(r, VERIFY_DELAY_MS));
  }
  return null;
}

const pairs = [
  { name: 'CGK→DPS then DPS→CGK', leg1: ['CGK', 'DPS'], leg2: ['DPS', 'CGK'] },
  { name: 'KUL→SIN then SIN→BKK', leg1: ['KUL', 'SIN'], leg2: ['SIN', 'BKK'] },
  { name: 'KUL→BKK then BKK→HAN', leg1: ['KUL', 'BKK'], leg2: ['BKK', 'HAN'] },
  { name: 'KUL→BKK then BKK→SIN', leg1: ['KUL', 'BKK'], leg2: ['BKK', 'SIN'] },
];

console.log(`\n── Sample itinerary preflight (depart ${DEPART}) ──\n`);

for (const pair of pairs) {
  console.log(`Trying ${pair.name}...`);
  try {
    const offers1 = await atlasSearchViaCli({ origin: pair.leg1[0], destination: pair.leg1[1], depart: DEPART });
    console.log(`  Leg1 offers: ${offers1.length}`);
    const v1 = await verifyFirstSuccess(offers1);
    console.log(`  Leg1 verify: ${v1 ? `success (${v1.offerId})` : 'none in top 5'}`);

    const offers2 = await atlasSearchViaCli({ origin: pair.leg2[0], destination: pair.leg2[1], depart: DEPART });
    console.log(`  Leg2 offers: ${offers2.length}`);
    const v2 = await verifyFirstSuccess(offers2);
    console.log(`  Leg2 verify: ${v2 ? `success (${v2.offerId})` : 'none in top 5'}`);

    if (v1 && v2) {
      console.log(`\nCONFIRMED_PAIR=${pair.leg1[0]}→${pair.leg1[1]}→${pair.leg2[1]}`);
      console.log(`CONFIRMED_DATE=${DEPART}`);
      process.exit(0);
    }
  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }
  console.log('');
}

console.log('No pair achieved verify success on both legs in this run.');
process.exit(1);
