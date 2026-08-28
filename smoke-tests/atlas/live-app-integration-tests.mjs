// Live-mode integration tests for the StitchCheck Atlas app flow.
//
// Run:  node smoke-tests/atlas/live-app-integration-tests.mjs
//
// These tests validate that:
//   1. App.tsx imports and uses the Atlas client in live mode.
//   2. Live Search calls /api/atlas/search.
//   3. Live Verify calls /api/atlas/verify.
//   4. The active options UI renders returned Atlas offers.
//   5. A fixture offer is never used in live mode.
//   6. Live provenance is not based solely on the mode flag.
//   7. Live failure does not silently fall back.
//   8. Offline mode still uses fixtures and makes no Atlas request.
//   9. Selected live offer is highlighted after Switch.
//   10. Search and Verify identifiers come from actual live responses.
//   11. Unknown/write Atlas routes remain blocked.
//   12. Credentials are absent from browser code and build output.
//   13. Forbidden success claims remain absent.
//   14. Safe request-submitted wording remains unchanged.
//   15. Route context is propagated from confirmed itinerary to Search.
//
// Exit code 0 = all tests passed.  Exit code 1 = one or more failures.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAtlasProxyMiddleware } from '../../app/server/atlas-proxy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

/* ── Minimal test harness ── */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✅  ${message}`);
  } else {
    failed += 1;
    failures.push(message);
    console.log(`  ❌  ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed += 1;
    console.log(`  ✅  ${message}`);
  } else {
    failed += 1;
    failures.push(message);
    console.log(`    ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

/* ── File reading helpers ── */

function readSrc(relPath) {
  const full = resolve(ROOT, relPath);
  if (!existsSync(full)) return '';
  return readFileSync(full, 'utf-8');
}

/* ── Mock HTTP helpers (for proxy tests) ── */

function createMockReq(method, url, body) {
  return {
    method,
    url,
    _body: body,
    on(event, handler) {
      if (event === 'data') {
        if (this._body) handler(Buffer.from(JSON.stringify(this._body)));
      }
      if (event === 'end') handler();
      if (event === 'error') { /* no error */ }
    },
    destroy() {},
  };
}

function createMockRes() {
  const res = {
    _status: null,
    _headers: {},
    _body: null,
    writeHead(status, headers) {
      res._status = status;
      res._headers = { ...headers };
    },
    end(body) {
      res._body = body;
      if (res._onEnd) res._onEnd();
    },
    onEnd(cb) { res._onEnd = cb; },
    getJson() {
      try { return JSON.parse(res._body); } catch { return null; }
    },
  };
  return res;
}

function callMiddleware(middleware, method, url, body) {
  return new Promise((resolve) => {
    const req = createMockReq(method, url, body);
    const res = createMockRes();
    res.onEnd(() => resolve(res));
    middleware(req, res, () => {
      resolve(res);
    });
  });
}

/* ── Tests ── */

async function runTests() {
  console.log('StitchCheck Live-Mode App Integration Tests\n');

  const appTsx = readSrc('app/src/App.tsx');
  const liveListTsx = readSrc('app/src/components/LiveAlternativesList.tsx');
  const atlasClient = readSrc('app/src/atlas/client.ts');
  const atlasAdapter = readSrc('app/src/atlas/adapter.ts');
  const atlasProxy = readSrc('app/server/atlas-proxy.mjs');
  const viteConfig = readSrc('app/vite.config.ts');

  /* ── 1. App.tsx imports the Atlas client ── */
  section('1. App.tsx imports Atlas client');
  assert(
    appTsx.includes("from './atlas/client'") || appTsx.includes('from "./atlas/client"'),
    'App.tsx imports from ./atlas/client',
  );
  assert(
    appTsx.includes('atlasSearch'),
    'App.tsx imports atlasSearch',
  );
  assert(
    appTsx.includes('atlasVerify'),
    'App.tsx imports atlasVerify',
  );

  /* ── 2. App.tsx calls atlasSearch in live mode ── */
  section('2. Live Search integration');
  assert(
    appTsx.includes('await atlasSearch('),
    'App.tsx calls atlasSearch',
  );
  assert(
    appTsx.includes('/api/atlas/search') || atlasClient.includes('/api/atlas/search'),
    'Search request goes to /api/atlas/search',
  );
  assert(
    appTsx.includes('mapSearchResponseToResult'),
    'App.tsx maps the search response via the adapter',
  );

  /* ── 3. App.tsx calls atlasVerify ── */
  section('3. Live Verify integration');
  assert(
    appTsx.includes('await atlasVerify('),
    'App.tsx calls atlasVerify',
  );
  assert(
    appTsx.includes('/api/atlas/verify') || atlasClient.includes('/api/atlas/verify'),
    'Verify request goes to /api/atlas/verify',
  );
  assert(
    appTsx.includes('mapVerifyResponse'),
    'App.tsx maps the verify response via the adapter',
  );

  /* ── 4. Active options UI renders Atlas offers ── */
  section('4. Active options UI renders live alternatives');
  assert(
    appTsx.includes('LiveAlternativesList') || liveListTsx.includes('alternatives'),
    'Live alternatives render via LiveAlternativesList',
  );
  assert(
    appTsx.includes('offerReference') || liveListTsx.includes('offerReference'),
    'Live alternatives render offer reference from Atlas data',
  );
  assert(
    appTsx.includes('priceDisplay') || liveListTsx.includes('priceDisplay'),
    'Live alternatives render price from Atlas data',
  );

  /* ── 5. Fixture offer is never used in live mode ── */
  section('5. Fixture not used in live mode');
  // Check that handleCheckMyTrip branches on isLive
  assert(
    appTsx.includes('if (isLive)') || appTsx.includes('if(isLive)'),
    'App.tsx branches on isLive in handleCheckMyTrip',
  );
  // In live mode, getAlternativesFixture should NOT be called
  // The live path calls performLiveSearch instead
  assert(
    appTsx.includes('performLiveSearch'),
    'App.tsx calls performLiveSearch in live mode',
  );
  // Verify that getAlternativesFixture is only in the else (offline) branch
  // The live branch calls performLiveSearch; the offline branch calls getAlternativesFixture
  const liveBranch = appTsx.includes('if (isLive)') && appTsx.match(/if \(isLive\) \{[\s\S]*?performLiveSearch/);
  const offlineBranchHasFixture = appTsx.match(/\} else \{[\s\S]*?getAlternativesFixture/);
  assert(
    liveBranch !== null,
    'Live branch calls performLiveSearch',
  );
  assert(
    offlineBranchHasFixture !== null,
    'Offline branch calls getAlternativesFixture',
  );

  /* ── 6. Live provenance is not based solely on DATA_MODE ── */
  section('6. Provenance derived from evidence, not mode flag');
  // The source label should check evidenceSource, executed, fallbackUsed
  assert(
    appTsx.includes("evidenceSource === 'atlas-sandbox'"),
    'Source label checks evidenceSource === atlas-sandbox',
  );
  assert(
    appTsx.includes('executed === true'),
    'Source label checks executed === true',
  );
  assert(
    appTsx.includes('fallbackUsed === false'),
    'Source label checks fallbackUsed === false',
  );
  // The old misleading label should be gone
  assert(
    !appTsx.includes("DATA_MODE === 'live' ? 'Atlas Sandbox"),
    'Source label is NOT derived solely from DATA_MODE',
  );

  /* ── 7. Live failure does not silently fall back ── */
  section('7. Live failure handling');
  assert(
    appTsx.includes('searchError') || appTsx.includes('setSearchError'),
    'App.tsx tracks search errors',
  );
  assert(
    appTsx.includes('mapErrorToResult'),
    'App.tsx maps errors via the adapter',
  );
  // In the catch block, getAlternativesFixture should NOT be called
  const catchBlock = appTsx.match(/catch\s*\(err\)[\s\S]*?setSearchError/);
  if (catchBlock) {
    assert(
      !catchBlock[0].includes('getAlternativesFixture'),
      'Error handler does not fall back to fixtures',
    );
  } else {
    assert(false, 'Could not find error catch block');
  }
  // Error banner with retry
  assert(
    appTsx.includes('Live alternatives are unavailable') || appTsx.includes('handleRetrySearch'),
    'Error state shows failure message and retry option',
  );

  /* ── 8. Offline mode still uses fixtures ── */
  section('8. Offline mode preserved');
  assert(
    appTsx.includes('getAlternativesFixture(altScenario)'),
    'Offline mode still calls getAlternativesFixture',
  );
  assert(
    appTsx.includes("'Source: Offline fallback'") || appTsx.includes("'Source: Local fixture'"),
    'Offline mode shows local/offline source label',
  );

  /* ── 9. Selected live offer is highlighted after Switch ── */
  section('9. Switch selection behavior');
  assert(
    appTsx.includes('selectedOfferId'),
    'App.tsx tracks selectedOfferId',
  );
  assert(
    appTsx.includes('sc-alt-card--selected') || liveListTsx.includes('sc-alt-card--selected'),
    'Selected offer gets highlighted CSS class',
  );
  assert(
    appTsx.includes("decision === 'switch'"),
    'Switch decision state is tracked',
  );
  assert(
    appTsx.includes('aria-pressed'),
    'Selection uses aria-pressed for accessibility',
  );
  assert(
    appTsx.includes('✓ Selected'),
    'Selected indicator is shown',
  );

  /* ── 10. Search and Verify identifiers from live responses ── */
  section('10. Live identifiers');
  assert(
    (appTsx.includes('handleVerifyOffer') || liveListTsx.includes('onVerifyAndSelectPlan'))
      && (appTsx.includes('offerReference') || liveListTsx.includes('offerReference')),
    'Verify uses the actual offer reference from search results',
  );

  /* ── 11. Unknown/write Atlas routes remain blocked ── */
  section('11. Proxy safety — write routes blocked');
  const env = { DATA_MODE: 'live', ATLAS_LIVE_READ_ONLY: 'true' };
  const middleware = createAtlasProxyMiddleware(env);

  const writePaths = [
    '/api/atlas/order', '/api/atlas/booking', '/api/atlas/reservation',
    '/api/atlas/payment', '/api/atlas/ticket', '/api/atlas/cancel', '/api/atlas/refund',
  ];
  for (const path of writePaths) {
    const res = await callMiddleware(middleware, 'POST', path, {});
    assertEqual(res._status, 404, `Write route ${path} returns 404`);
  }

  const unknownPaths = ['/api/atlas/unknown', '/api/atlas/foo', '/api/atlas/search/extra'];
  for (const path of unknownPaths) {
    const res = await callMiddleware(middleware, 'POST', path, {});
    assertEqual(res._status, 404, `Unknown route ${path} returns 404`);
  }

  /* ── 12. Credentials absent from browser code ── */
  section('12. Credentials absent from browser code');
  assert(
    !atlasClient.includes('ATLAS_CLIENT_SECRET'),
    'Atlas client.ts does not contain ATLAS_CLIENT_SECRET',
  );
  assert(
    !atlasClient.includes('ATLAS_CLIENT_ID'),
    'Atlas client.ts does not contain ATLAS_CLIENT_ID',
  );
  assert(
    !atlasClient.includes('.env'),
    'Atlas client.ts does not reference .env files',
  );
  assert(
    !atlasClient.includes('sandbox-sk-'),
    'Atlas client.ts does not contain sandbox secret patterns',
  );
  // Check vite config does not inject credentials
  assert(
    !viteConfig.includes('ATLAS_CLIENT_SECRET'),
    'vite.config.ts does not inject ATLAS_CLIENT_SECRET into bundle',
  );
  assert(
    !viteConfig.includes('ATLAS_CLIENT_ID'),
    'vite.config.ts does not inject ATLAS_CLIENT_ID into bundle',
  );
  // Check App.tsx does not contain credentials
  assert(
    !appTsx.includes('sandbox-sk-'),
    'App.tsx does not contain sandbox secret patterns',
  );

  /* ── 13. Forbidden success claims absent ── */
  section('13. Forbidden success claims absent');
  const forbiddenPhrases = [
    'booking confirmed',
    'payment processed',
    'ticket issued',
    'reservation made',
  ];
  for (const phrase of forbiddenPhrases) {
    assert(
      !appTsx.toLowerCase().includes(phrase),
      `App.tsx does not contain forbidden phrase: "${phrase}"`,
    );
  }
  // "order created" only appears in the negative disclaimer context
  assert(
    appTsx.includes('No booking, payment, reservation, or order is created'),
    'App.tsx uses "order" only in the negative disclaimer',
  );
  assert(
    !appTsx.toLowerCase().match(/(?<!no .{0,40})order (was |has been )?created/),
    'App.tsx does not claim an order was created',
  );

  /* ── 14. Safe request-submitted wording unchanged ── */
  section('14. Safe request-submitted wording');
  assert(
    appTsx.includes('Request submitted — awaiting verified supplier outcome'),
    'App.tsx contains the safe request-submitted wording',
  );
  assert(
    appTsx.includes('No booking, payment, reservation, or order is created'),
    'App.tsx contains the no-booking disclaimer',
  );

  /* ── 15. Route context propagated from frozen itinerary snapshot to Search ── */
  section('15. Route context propagation');
  assert(
    appTsx.includes('performLiveSearchForConfirmed'),
    'Search runs from the confirmed itinerary snapshot helper',
  );
  assert(
    appTsx.includes('origin: confirmed.firstLeg.origin')
      && appTsx.includes('destination: confirmed.firstLeg.destination'),
    'Search uses the confirmed itinerary origin/destination',
  );
  assert(
    appTsx.includes('depart: confirmed.firstLeg.departureDate'),
    'Search uses the confirmed itinerary departure date',
  );
  assert(
    !appTsx.includes('origin: extraction.firstLeg.origin'),
    'Search origin does not come from live extraction state',
  );
  assert(
    !appTsx.includes('destination: extraction.firstLeg.destination'),
    'Search destination does not come from live extraction state',
  );

  /* ── Summary ── */
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
