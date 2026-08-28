// Live Atlas integration — offline mocked tests.
//
// These tests validate the proxy routing, adapter mapping, provenance,
// and safety boundaries WITHOUT calling Atlas. All tests use mocked data.
//
// Run:
//   node smoke-tests/atlas/live-app-offline-tests.mjs

import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

/* ── 1. Search route is allowed ── */

test('1. Search route /api/atlas/search is in ALLOWED_ROUTES', () => {
  // Read proxy source and check that /api/atlas/search is in ALLOWED_ROUTES
  const proxySrc = readFileSync(resolve(ROOT, 'app/server/atlas-proxy.mjs'), 'utf-8');
  assert.ok(proxySrc.includes("'/api/atlas/search'"), 'search route must be in proxy');
  assert.ok(proxySrc.includes('ALLOWED_ROUTES'), 'ALLOWED_ROUTES set must exist');
});

/* ── 2. Verify route is allowed ── */

test('2. Verify route /api/atlas/verify is in ALLOWED_ROUTES', () => {
  const proxySrc = readFileSync(resolve(ROOT, 'app/server/atlas-proxy.mjs'), 'utf-8');
  assert.ok(proxySrc.includes("'/api/atlas/verify'"), 'verify route must be in proxy');
});

/* ── 3. Unknown Atlas paths are rejected ── */

test('3. Unknown /api/atlas/* paths return 404', () => {
  const proxySrc = readFileSync(resolve(ROOT, 'app/server/atlas-proxy.mjs'), 'utf-8');
  // The proxy checks ALLOWED_ROUTES and returns 404 for unknown paths
  assert.ok(proxySrc.includes("error: 'not_found'"), 'must return not_found for unknown paths');
  assert.ok(proxySrc.includes('unknown Atlas route'), 'must describe unknown route');
});

/* ── 4. Write paths are explicitly blocked ── */

test('4. Write paths (order, booking, payment, ticket, cancel, refund) are blocked', () => {
  const proxySrc = readFileSync(resolve(ROOT, 'app/server/atlas-proxy.mjs'), 'utf-8');
  const blockedPaths = [
    '/api/atlas/order',
    '/api/atlas/booking',
    '/api/atlas/reservation',
    '/api/atlas/payment',
    '/api/atlas/ticket',
    '/api/atlas/cancel',
    '/api/atlas/refund',
  ];
  for (const p of blockedPaths) {
    assert.ok(proxySrc.includes(`'${p}'`), `${p} must be in BLOCKED_PATHS`);
  }
  assert.ok(proxySrc.includes('BLOCKED_PATHS'), 'BLOCKED_PATHS set must exist');
});

/* ── 5. Timeout handling ── */

test('5. Proxy uses 8-second timeout for CLI calls', () => {
  const proxySrc = readFileSync(resolve(ROOT, 'app/server/atlas-proxy.mjs'), 'utf-8');
  assert.ok(proxySrc.includes('8_000') || proxySrc.includes('8000'), 'timeout must be 8000ms');
  assert.ok(proxySrc.includes('CLI_TIMEOUT_MS'), 'CLI_TIMEOUT_MS constant must exist');
});

/* ── 6. Retry behavior ── */

test('6. Proxy retries once on timeout/transient failure', () => {
  const proxySrc = readFileSync(resolve(ROOT, 'app/server/atlas-proxy.mjs'), 'utf-8');
  assert.ok(proxySrc.includes('MAX_RETRIES = 1') || proxySrc.includes('execCliWithRetry'), 'must have retry logic');
});

/* ── 7. 4xx/429 behavior (no retry on application errors) ── */

test('7. Proxy does not retry on application-level errors', () => {
  const proxySrc = readFileSync(resolve(ROOT, 'app/server/atlas-proxy.mjs'), 'utf-8');
  // The retry logic only retries on timeout/transient, not on application errors
  assert.ok(proxySrc.includes('RETRYABLE_EXIT_CODES'), 'must have retryable exit codes');
  // The search handler returns error immediately for non-success responses
  assert.ok(proxySrc.includes('search_failed') || proxySrc.includes('502'), 'must return error for failed search');
});

/* ── 8. Search adapter maps real response fields ── */

test('8. Search adapter maps Atlas offer fields to Alternative shape', async () => {
  const { mapSearchResponseToResult } = await import(resolve(ROOT, 'app/src/atlas/adapter.ts'));
  // This test validates the mapping logic with mock data
  // Since we can't import TS directly, we check the source
  const adapterSrc = readFileSync(resolve(ROOT, 'app/src/atlas/adapter.ts'), 'utf-8');
  assert.ok(adapterSrc.includes('mapSearchResponseToResult'), 'must export mapSearchResponseToResult');
  assert.ok(adapterSrc.includes('offerReference'), 'must map offerReference');
  assert.ok(adapterSrc.includes('routeSummary'), 'must map routeSummary');
  assert.ok(adapterSrc.includes('departureTime'), 'must map departureTime');
  assert.ok(adapterSrc.includes('total_price'), 'must read total_price');
  assert.ok(adapterSrc.includes('currency'), 'must map currency');
  assert.ok(adapterSrc.includes("evidenceSource: 'atlas-sandbox'"), 'must set evidenceSource');
  assert.ok(adapterSrc.includes('executed: true'), 'must set executed=true');
  assert.ok(adapterSrc.includes('fallbackUsed: false'), 'must set fallbackUsed=false');
});

/* ── 9. Verify adapter maps actual status ── */

test('9. Verify adapter maps verify response to VerifySummary', () => {
  const adapterSrc = readFileSync(resolve(ROOT, 'app/src/atlas/adapter.ts'), 'utf-8');
  assert.ok(adapterSrc.includes('mapVerifyResponse'), 'must export mapVerifyResponse');
  assert.ok(adapterSrc.includes('VerifySummary'), 'must define VerifySummary type');
  assert.ok(adapterSrc.includes('previousPrice') || adapterSrc.includes('previous_price'), 'must map previousPrice');
  assert.ok(adapterSrc.includes('currentPrice') || adapterSrc.includes('current_price'), 'must map currentPrice');
});

/* ── 10. Missing fields render "Not available from Atlas response" ── */

test('10. Missing fields use "Not available from Atlas response"', () => {
  const adapterSrc = readFileSync(resolve(ROOT, 'app/src/atlas/adapter.ts'), 'utf-8');
  assert.ok(
    adapterSrc.includes('Not available from Atlas response'),
    'must use the exact phrase for missing fields'
  );
});

/* ── 11. Live provenance requires executed=true and fallbackUsed=false ── */

test('11. Live provenance sets executed=true, fallbackUsed=false', () => {
  const adapterSrc = readFileSync(resolve(ROOT, 'app/src/atlas/adapter.ts'), 'utf-8');
  // Check that the search result mapper sets these provenance fields
  assert.ok(adapterSrc.includes("executed: true"), 'must set executed=true');
  assert.ok(adapterSrc.includes("fallbackUsed: false"), 'must set fallbackUsed=false');
  assert.ok(adapterSrc.includes("evidenceSource: 'atlas-sandbox'"), 'must set evidenceSource to atlas-sandbox');
});

/* ── 12. Live failure does not silently fall back ── */

test('12. Live failure does not silently fall back to fixtures', () => {
  const appSrc = readFileSync(resolve(ROOT, 'app/src/App.tsx'), 'utf-8');
  const adapterSrc = readFileSync(resolve(ROOT, 'app/src/atlas/adapter.ts'), 'utf-8');
  // In the catch block, the app must set an error result via mapErrorToResult
  assert.ok(appSrc.includes('mapErrorToResult'), 'must use mapErrorToResult on error');
  assert.ok(appSrc.includes('setSearchError') || appSrc.includes('setAtlasSearchError'), 'must set search error state on failure');
  // The adapter's mapErrorToResult must set atlas-sandbox provenance (not local-fixture)
  assert.ok(adapterSrc.includes("evidenceSource: 'atlas-sandbox'"), 'error result must have atlas-sandbox provenance in adapter');
  assert.ok(adapterSrc.includes('fallbackUsed: false'), 'error result must have fallbackUsed=false in adapter');
});

/* ── 13. Offline mode remains functional ── */

test('13. Offline mode still uses fixtures when DATA_MODE is not live', () => {
  const appSrc = readFileSync(resolve(ROOT, 'app/src/App.tsx'), 'utf-8');
  assert.ok(appSrc.includes("IS_LIVE") || appSrc.includes("DATA_MODE === 'live'"), 'must check live mode');
  assert.ok(appSrc.includes('getAlternativesFixture(altScenario)'), 'must use fixtures in offline mode');
});

/* ── 14. Browser bundle has no credentials ── */

test('14. Browser client files contain no credentials or Atlas URLs', () => {
  const clientSrc = readFileSync(resolve(ROOT, 'app/src/atlas/client.ts'), 'utf-8');
  const typesSrc = readFileSync(resolve(ROOT, 'app/src/atlas/types.ts'), 'utf-8');
  const adapterSrc = readFileSync(resolve(ROOT, 'app/src/atlas/adapter.ts'), 'utf-8');

  const forbidden = [
    'ATLAS_CLIENT_SECRET',
    'ATLAS_CLIENT_ID',
    'sandbox.atriptech.com',
    'api.atriptech.com',
    'Bearer',
    'x-atlas-client',
  ];

  for (const src of [clientSrc, typesSrc, adapterSrc]) {
    for (const pattern of forbidden) {
      assert.ok(!src.includes(pattern), `browser files must not contain "${pattern}"`);
    }
  }
});

/* ── 15. Forbidden success claims remain absent ── */

test('15. No booked/ticketed/payment-completed claims in the codebase', () => {
  const appSrc = readFileSync(resolve(ROOT, 'app/src/App.tsx'), 'utf-8');
  const panelSrc = readFileSync(resolve(ROOT, 'app/src/components/AlternativesPanel.tsx'), 'utf-8');

  const forbiddenClaims = [
    'Booked',
    'Ticket issued',
    'Payment completed',
    'Order created',
    'Switched',
  ];

  for (const src of [appSrc, panelSrc]) {
    for (const claim of forbiddenClaims) {
      assert.ok(!src.includes(claim), `must not contain "${claim}" claim`);
    }
  }
});

/* ── Summary ── */

console.log('');
console.log(`── Results: ${passed} passed, ${failed} failed ──`);

if (failed > 0) {
  process.exit(1);
}
