// Offline tests for extraction merge — prevents null-leg blank-screen regression.
//
// Run:
//   node smoke-tests/app-extraction-merge-offline-tests.mjs

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

// Mirror of app/src/extraction/merge-extraction-result.ts (keep in sync)
function mapProviderLeg(leg) {
  if (leg == null) return null;
  const departureDate = (leg.departureDate || leg.date || '').trim();
  return {
    origin: leg.origin ?? '',
    destination: leg.destination ?? '',
    departureDate,
    airline: (leg.airline || leg.carrier || '').trim(),
    flightNumber: leg.flightNumber ?? '',
    departureTime: leg.departureTime ?? '',
    arrivalTime: leg.arrivalTime ?? '',
  };
}

function mergeExtractionResult(prev, incoming) {
  const mappedFirst = mapProviderLeg(incoming.firstLeg);
  const mappedSecond = mapProviderLeg(incoming.secondLeg);
  return {
    ...prev,
    ...incoming,
    firstLeg: mappedFirst ?? prev.firstLeg,
    secondLeg: mappedSecond ?? prev.secondLeg,
  };
}

const { mergeExtractionResult: _unusedCheck } = { mergeExtractionResult };
void _unusedCheck;

const prev = {
  extractionStatus: 'success',
  firstLeg: {
    origin: 'KUL',
    destination: 'BKK',
    departureDate: '2026-09-15',
    airline: 'Sample carrier',
    flightNumber: 'SC-101',
    departureTime: '08:00',
    arrivalTime: '10:30',
  },
  secondLeg: {
    origin: 'BKK',
    destination: 'HAN',
    departureDate: '2026-09-15',
    airline: 'Sample carrier',
    flightNumber: 'SC-202',
    departureTime: '13:00',
    arrivalTime: '15:45',
  },
  connectionDurationMinutes: 150,
  missingFields: [],
  fieldConfidence: { overall: 'high', note: 'fixture' },
  validationMessages: [],
  requiresUserConfirmation: true,
  syntheticDemo: true,
};

console.log('\n── App extraction merge offline tests ──\n');

test('1. disabled live extraction with null legs preserves prior legs', () => {
  const merged = mergeExtractionResult(prev, {
    extractionStatus: 'disabled',
    firstLeg: null,
    secondLeg: null,
    evidenceSource: 'local-fallback',
    provider: 'openrouter',
    executed: false,
    fallbackUsed: true,
    validationOutcome: 'partial',
  });
  assert(merged.firstLeg?.origin === 'KUL', 'firstLeg preserved');
  assert(merged.secondLeg?.destination === 'HAN', 'secondLeg preserved');
  assert(merged.extractionStatus === 'disabled', 'incoming status merged');
});

test('2. itineraryContext-style access does not crash after disabled merge', () => {
  const merged = mergeExtractionResult(prev, {
    extractionStatus: 'disabled',
    firstLeg: null,
    secondLeg: null,
  });
  const ctx = {
    firstLegOrigin: merged.firstLeg.origin,
    firstLegDestination: merged.firstLeg.destination,
    secondLegOrigin: merged.secondLeg.origin,
    secondLegDestination: merged.secondLeg.destination,
  };
  assert(ctx.secondLegDestination === 'HAN', 'context fields readable');
});

test('3. App.tsx uses mergeExtractionResult for live extraction merge', () => {
  const appSrc = readFileSync(resolve(ROOT, 'app/src/App.tsx'), 'utf-8');
  assert(appSrc.includes('mergeExtractionResult(extraction, incoming)'), 'App uses guarded merge');
});

test('4. provider date field maps onto UI departureDate', () => {
  const merged = mergeExtractionResult(prev, {
    extractionStatus: 'success',
    firstLeg: {
      origin: 'KUL',
      destination: 'SIN',
      date: '2026-10-01',
      airline: 'AK',
      flightNumber: 'AK701',
      departureTime: '06:10',
      arrivalTime: '07:15',
    },
    secondLeg: {
      origin: 'SIN',
      destination: 'BKK',
      date: '2026-10-01',
      airline: 'TR',
      flightNumber: 'TR624',
      departureTime: '08:20',
      arrivalTime: '09:55',
    },
  });
  assert(merged.firstLeg.departureDate === '2026-10-01', 'firstLeg.date mapped to departureDate');
  assert(merged.secondLeg.departureDate === '2026-10-01', 'secondLeg.date mapped to departureDate');
  assert(merged.firstLeg.origin === 'KUL', 'origin preserved from provider payload');
});

test('5. provider carrier field maps onto UI airline', () => {
  const merged = mergeExtractionResult(prev, {
    extractionStatus: 'success',
    firstLeg: {
      origin: 'KUL',
      destination: 'SIN',
      date: '2026-10-01',
      carrier: 'AK',
      flightNumber: 'AK701',
      departureTime: '06:10',
      arrivalTime: '07:15',
    },
    secondLeg: {
      origin: 'SIN',
      destination: 'BKK',
      date: '2026-10-01',
      carrier: 'TR',
      flightNumber: 'TR624',
      departureTime: '08:20',
      arrivalTime: '09:55',
    },
  });
  assert(merged.firstLeg.airline === 'AK', 'firstLeg.carrier mapped to airline');
  assert(merged.secondLeg.airline === 'TR', 'secondLeg.carrier mapped to airline');
});

console.log(`\nApp extraction merge offline tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
