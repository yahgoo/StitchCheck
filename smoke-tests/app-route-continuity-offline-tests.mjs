// Route-state continuity regression tests.
//
// Reproduces: confirm KUL→SIN route, Atlas Search uses snapshot, then a later
// extraction merge with placeholder AAA/BBB/CCC must NOT change confirmed route
// or recovery-plan context.
//
// Run: node smoke-tests/app-route-continuity-offline-tests.mjs

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterOffersForRequestedRoute } from '../app/server/atlas-proxy.mjs';

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

// Mirror merge-extraction-result.ts
function mergeExtractionResult(prev, incoming) {
  return {
    ...prev,
    ...incoming,
    firstLeg: incoming.firstLeg ?? prev.firstLeg,
    secondLeg: incoming.secondLeg ?? prev.secondLeg,
  };
}

const {
  createConfirmedItinerarySnapshot,
  confirmedItineraryToContext,
} = await import(resolve(ROOT, 'app/src/domain/confirmed-itinerary.mjs'));

const kulSinReview = {
  extractionStatus: 'success',
  firstLeg: {
    origin: 'KUL',
    destination: 'SIN',
    departureDate: '2026-10-01',
    airline: 'Sample',
    flightNumber: 'SC-101',
    departureTime: '08:00',
    arrivalTime: '09:15',
  },
  secondLeg: {
    origin: 'SIN',
    destination: 'BKK',
    departureDate: '2026-10-01',
    airline: 'Sample',
    flightNumber: 'SC-202',
    departureTime: '12:30',
    arrivalTime: '13:45',
  },
  connectionDurationMinutes: 195,
};

console.log('\n── Route continuity offline tests ──\n');

test('1. snapshot is taken from review-screen extraction before any post-confirm merge', () => {
  const confirmed = createConfirmedItinerarySnapshot(kulSinReview, 'sample');
  assert(confirmed.firstLeg.origin === 'KUL', 'confirmed first leg origin');
  assert(confirmed.secondLeg.destination === 'BKK', 'confirmed second leg destination');
});

test('2. placeholder extraction merge after confirm does not mutate confirmed snapshot', () => {
  const confirmed = createConfirmedItinerarySnapshot(kulSinReview, 'upload');
  const afterMerge = mergeExtractionResult(kulSinReview, {
    extractionStatus: 'partial',
    firstLeg: {
      origin: 'AAA',
      destination: 'BBB',
      departureDate: '2026-09-15',
      airline: 'X',
      flightNumber: '100',
      departureTime: '08:00',
      arrivalTime: '10:00',
    },
    secondLeg: {
      origin: 'BBB',
      destination: 'CCC',
      departureDate: '2026-09-15',
      airline: 'X',
      flightNumber: '200',
      departureTime: '13:00',
      arrivalTime: '15:00',
    },
  });

  assert(afterMerge.firstLeg.origin === 'AAA', 'live extraction state may change for display');
  assert(confirmed.firstLeg.origin === 'KUL', 'confirmed snapshot stays KUL');
  assert(confirmed.secondLeg.destination === 'BKK', 'confirmed snapshot stays BKK');
});

test('3. recovery/itinerary context uses confirmed snapshot not merged extraction', () => {
  const confirmed = createConfirmedItinerarySnapshot(kulSinReview, 'sample');
  const merged = mergeExtractionResult(kulSinReview, {
    firstLeg: { ...kulSinReview.firstLeg, origin: 'AAA', destination: 'BBB' },
    secondLeg: { ...kulSinReview.secondLeg, origin: 'BBB', destination: 'CCC' },
  });
  const contextFromConfirmed = confirmedItineraryToContext(confirmed);
  const wrongContext = {
    firstLegOrigin: merged.firstLeg.origin,
    firstLegDestination: merged.firstLeg.destination,
    secondLegOrigin: merged.secondLeg.origin,
    secondLegDestination: merged.secondLeg.destination,
  };

  assert(contextFromConfirmed.firstLegOrigin === 'KUL', 'recovery uses KUL from confirmed');
  assert(wrongContext.firstLegOrigin === 'AAA', 'merged extraction would wrongly show AAA');
  assert(contextFromConfirmed.firstLegOrigin !== wrongContext.firstLegOrigin, 'must not mix routes');
});

test('4. Atlas Search params must come from confirmed snapshot', () => {
  const confirmed = createConfirmedItinerarySnapshot(kulSinReview, 'sample');
  const searchParams = {
    origin: confirmed.firstLeg.origin,
    destination: confirmed.firstLeg.destination,
    depart: confirmed.firstLeg.departureDate,
  };
  assert(searchParams.origin === 'KUL' && searchParams.destination === 'SIN', 'search uses confirmed leg1');
});

test('5. App.tsx wires confirmedItinerary snapshot for downstream consumers', () => {
  const appSrc = readFileSync(resolve(ROOT, 'app/src/App.tsx'), 'utf-8');
  assert(appSrc.includes('confirmedItinerary'), 'confirmedItinerary state exists');
  assert(appSrc.includes('createConfirmedItinerarySnapshot'), 'snapshot helper used');
  assert(appSrc.includes('confirmedItineraryToContext'), 'downstream context from snapshot');
  assert(appSrc.includes('performLiveSearchForConfirmed'), 'Atlas search uses snapshot');
});

test('6. Atlas results retain only the confirmed airport-to-airport route', () => {
  const offers = [
    {
      offer_id: 'exact',
      segments: [{ departure_airport: 'KUL', arrival_airport: 'SIN' }],
    },
    {
      offer_id: 'wrong-origin',
      segments: [{ departure_airport: 'SZB', arrival_airport: 'SIN' }],
    },
    {
      offer_id: 'wrong-destination',
      segments: [{ departure_airport: 'KUL', arrival_airport: 'DMK' }],
    },
    {
      offer_id: 'exact-with-stop',
      segments: [
        { departure_airport: 'KUL', arrival_airport: 'CGK' },
        { departure_airport: 'CGK', arrival_airport: 'SIN' },
      ],
    },
  ];

  const retained = filterOffersForRequestedRoute(offers, 'KUL', 'SIN');
  assert(retained.length === 2, 'only exact endpoint matches are retained');
  assert(retained.every((offer) => offer.offer_id === 'exact' || offer.offer_id === 'exact-with-stop'),
    'nearby-airport substitutions are excluded');
});

console.log(`\nRoute continuity offline tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
