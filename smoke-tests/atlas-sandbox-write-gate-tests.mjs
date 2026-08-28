// Offline gate tests for the Atlas Sandbox write scaffolding
// (app/server/atlas-sandbox-writes.mjs + app/server/atlas-proxy.mjs).
//
// Run:  node atlas-sandbox-write-gate-tests.mjs
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//   - No atlas-flight CLI is ever executed: every execCli injection
//     point is a spy that records calls and fails loudly if invoked.
//   - No network calls, no dev server, no .env file is read.
//   - Follows the hand-rolled harness pattern of
//     smoke-tests/atlas/atlas-live-proxy-tests.mjs (self-contained copy).
//
// Covers the 20 required cases of the Step 8 offline gate-test brief,
// plus regression cases 21–22 for the consolidated code-review fixes
// (cross-request store persistence, fail-closed depth limit, evidence
// shape, oversized traveler id).
//
// Exit code 0 = all tests passed. Exit code 1 = one or more failures.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAtlasProxyMiddleware } from '../app/server/atlas-proxy.mjs';
import {
  createSandboxWriteHandler,
  createSandboxEvidenceRecord,
  PASSENGER_CONTRACT_STATUS,
  REQUIRED_SANDBOX_BASE_URL,
} from '../app/server/atlas-sandbox-writes.mjs';
import { mapProviderOutcome } from '../core/simulation/sandbox-order-states.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

/* ── Minimal test harness (same pattern as atlas-live-proxy-tests.mjs) ── */

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

/* ── Mock HTTP helpers ── */

function createMockReq(method, url, body) {
  return {
    method,
    url,
    _body: body,
    on(event, handler) {
      if (event === 'data') {
        if (this._body !== undefined && this._body !== null) {
          handler(Buffer.from(JSON.stringify(this._body)));
        }
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
      // next() called — middleware passed through
      resolve(res);
    });
  });
}

/** Calls a sandbox write handler (pathname, req, res) directly. */
function callHandler(handler, pathname, body) {
  return new Promise((resolve) => {
    const req = createMockReq('POST', pathname, body);
    const res = createMockRes();
    res.onEnd(() => resolve(res));
    handler(pathname, req, res).catch((err) => {
      // A thrown error is itself a fail-closed outcome, but the spy
      // CLI must never be the cause — surface it as a failure.
      failed += 1;
      failures.push(`handler threw: ${err?.message || err}`);
      console.log(`  ❌  handler threw: ${err?.message || err}`);
      resolve(res);
    });
  });
}

/* ── CLI spy: records calls and ALWAYS fails if invoked ── */

function createFailingCliSpy(name = 'execCli') {
  const spy = (...args) => {
    spy.calls.push(args);
    throw new Error(`${name} must never be invoked by the scaffold`);
  };
  spy.calls = [];
  return spy;
}

/* ── Environment fixtures ── */

/** All six gates pass. The sandbox base URL comes from the server
 *  module's exported constant — never a hardcoded literal (spec §16). */
const PASS_ENV = Object.freeze({
  ATLAS_SANDBOX_WRITES_ENABLED: 'true',
  DATA_MODE: 'live',
  ATLAS_LIVE_READ_ONLY: 'true',
  ATLAS_ENVIRONMENT: 'sandbox',
  ATLAS_SANDBOX_BASE_URL: REQUIRED_SANDBOX_BASE_URL,
});

/** Negative-case URL built by mutation of the approved constant. */
const NON_SANDBOX_BASE_URL = REQUIRED_SANDBOX_BASE_URL.replace('sandbox.', 'api.');

const SANDBOX_ROUTES = [
  '/api/atlas/sandbox/order',
  '/api/atlas/sandbox/pay',
  '/api/atlas/sandbox/capabilities',
  '/api/atlas/sandbox/confirm-intent',
  '/api/atlas/sandbox/status',
];

const BLOCKED_WRITE_PATHS = [
  '/api/atlas/order',
  '/api/atlas/booking',
  '/api/atlas/reservation',
  '/api/atlas/payment',
  '/api/atlas/ticket',
  '/api/atlas/cancel',
  '/api/atlas/refund',
];

/* ── Tests ── */

async function runTests() {
  console.log('Atlas Sandbox Write Gate Tests (offline)\n');

  /* ── Case 1: kill switch — ATLAS_SANDBOX_WRITES_ENABLED !== 'true' ── */
  section('1. Write routes 403 when ATLAS_SANDBOX_WRITES_ENABLED !== true');
  for (const flagValue of ['false', undefined]) {
    const env = { ...PASS_ENV, ATLAS_SANDBOX_WRITES_ENABLED: flagValue };
    if (flagValue === undefined) delete env.ATLAS_SANDBOX_WRITES_ENABLED;
    const middleware = createAtlasProxyMiddleware(env);
    for (const route of SANDBOX_ROUTES) {
      const res = await callMiddleware(middleware, 'POST', route, {});
      assertEqual(res._status, 403, `${route} → 403 (writes flag=${JSON.stringify(flagValue)})`);
      assertEqual(res.getJson()?.error, 'sandbox_writes_disabled', `${route} error code sandbox_writes_disabled`);
    }
  }

  /* ── Case 2: non-sandbox ATLAS_ENVIRONMENT rejected ── */
  section('2. Non-sandbox ATLAS_ENVIRONMENT rejected');
  {
    const env = { ...PASS_ENV, ATLAS_ENVIRONMENT: 'production' };
    const middleware = createAtlasProxyMiddleware(env);
    const res = await callMiddleware(middleware, 'POST', '/api/atlas/sandbox/capabilities', {});
    assertEqual(res._status, 403, 'ATLAS_ENVIRONMENT=production → 403');
    assertEqual(res.getJson()?.error, 'non_sandbox_environment', 'error code non_sandbox_environment');
  }

  /* ── Case 3: ATLAS_WRITES_ENABLED=true (production flag) rejected ── */
  section('3. ATLAS_WRITES_ENABLED=true rejected (production flag exclusion)');
  {
    const env = { ...PASS_ENV, ATLAS_WRITES_ENABLED: 'true' };
    const middleware = createAtlasProxyMiddleware(env);
    const res = await callMiddleware(middleware, 'POST', '/api/atlas/sandbox/capabilities', {});
    assertEqual(res._status, 403, 'ATLAS_WRITES_ENABLED=true → 403');
    assertEqual(res.getJson()?.error, 'production_writes_flag_conflict', 'error code production_writes_flag_conflict');
  }

  /* ── Case 4: non-sandbox ATLAS_SANDBOX_BASE_URL rejected ── */
  section('4. Non-sandbox ATLAS_SANDBOX_BASE_URL rejected');
  {
    const env = { ...PASS_ENV, ATLAS_SANDBOX_BASE_URL: NON_SANDBOX_BASE_URL };
    const middleware = createAtlasProxyMiddleware(env);
    const res = await callMiddleware(middleware, 'POST', '/api/atlas/sandbox/capabilities', {});
    assertEqual(res._status, 403, 'non-sandbox base URL → 403');
    assertEqual(res.getJson()?.error, 'non_sandbox_base_url', 'error code non_sandbox_base_url');
  }

  /* ── Case 5: unknown sandbox route → 404 ── */
  section('5. Unknown sandbox route returns 404');
  {
    const middleware = createAtlasProxyMiddleware(PASS_ENV);
    const res = await callMiddleware(middleware, 'POST', '/api/atlas/sandbox/other', {});
    assertEqual(res._status, 404, '/api/atlas/sandbox/other → 404 (no generic sandbox passthrough)');
    const res2 = await callMiddleware(middleware, 'POST', '/api/atlas/sandbox/order/create', {});
    assertEqual(res2._status, 404, '/api/atlas/sandbox/order/create → 404 (exact-set dispatch only)');
  }

  /* ── Case 6: existing Search/Verify route recognition unchanged ── */
  section('6. Search/Verify route recognition unchanged');
  {
    // DATA_MODE=offline gates BEFORE any CLI call: a 403
    // live_mode_not_enabled proves the route was recognized and
    // dispatched (not 404'd by the sandbox logic), with zero CLI use.
    const env = { DATA_MODE: 'offline', ATLAS_LIVE_READ_ONLY: 'true' };
    const middleware = createAtlasProxyMiddleware(env);
    const searchRes = await callMiddleware(middleware, 'POST', '/api/atlas/search', {
      origin: 'KUL', destination: 'SIN', depart: '2026-09-15', adults: 1, currency: 'USD',
    });
    assertEqual(searchRes._status, 403, '/api/atlas/search recognized (403 live_mode, not 404)');
    assertEqual(searchRes.getJson()?.error, 'live_mode_not_enabled', 'search error live_mode_not_enabled');
    const verifyRes = await callMiddleware(middleware, 'POST', '/api/atlas/verify', { offerId: 'off_test' });
    assertEqual(verifyRes._status, 403, '/api/atlas/verify recognized (403 live_mode, not 404)');
    assertEqual(verifyRes.getJson()?.error, 'live_mode_not_enabled', 'verify error live_mode_not_enabled');
  }

  /* ── Case 7: blocked write paths stay blocked; sandbox/order no collision ── */
  section('7. Blocked paths remain 404; sandbox/order does not collide');
  {
    // Even with sandbox writes fully gated on, top-level write paths 404.
    const middleware = createAtlasProxyMiddleware(PASS_ENV);
    for (const p of BLOCKED_WRITE_PATHS) {
      const res = await callMiddleware(middleware, 'POST', p, {});
      assertEqual(res._status, 404, `${p} → 404`);
    }
    // /api/atlas/sandbox/order must NOT be caught by the blocked set:
    // with all gates passing it reaches the scaffold handler and fails
    // on input validation (400), proving it was dispatched, not blocked.
    const sandboxOrderRes = await callMiddleware(middleware, 'POST', '/api/atlas/sandbox/order', {});
    assertEqual(sandboxOrderRes._status, 400, '/api/atlas/sandbox/order reaches scaffold handler (400 input, not 404)');
    assertEqual(sandboxOrderRes.getJson()?.error, 'invalid_booking_id', 'sandbox/order input validation reached');
  }

  /* ── Case 8: forbidden browser-supplied fields → 400 ── */
  section('8. Forbidden browser fields rejected (browser_supplied_data_rejected)');
  {
    const handler = createSandboxWriteHandler(PASS_ENV, createFailingCliSpy());
    const forbiddenBodies = [
      { client_secret: 'sk-abcdef123456' },
      { authorization: 'Bearer abc.def.ghi' },
      { baseUrl: NON_SANDBOX_BASE_URL },
      { environment: 'production' },
      { passenger: { given_name: 'Test' } },
      { passengers: [{ given_name: 'Test', surname: 'Person' }] },
      { givenName: 'Test' },
      { email: 'test@example.com' },
      { phone: '+60123456789' },
      { cardNumber: '4111111111111111' },
      { pan: '4111111111111111' },
      { cvv: '123' },
      { nested: { deep: { api_key: 'sk-secret1234567890' } } },
    ];
    for (const body of forbiddenBodies) {
      const res = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', body);
      const key = Object.keys(body)[0];
      assertEqual(res._status, 400, `body with "${key}" → 400`);
      assertEqual(res.getJson()?.error, 'browser_supplied_data_rejected', `body with "${key}" error code`);
    }
    // Clean bodies are not rejected by the field scanner.
    const cleanRes = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
      operation: 'order', bookingId: 'bk_clean_1',
    });
    assertEqual(cleanRes._status, 200, 'clean confirm-intent body passes field scan');

    // FAIL CLOSED depth limit: a forbidden key nested >8 levels deep
    // must still be rejected — the scanner never fails open.
    let deepBody = { cvv: '123' };
    for (let i = 0; i < 10; i += 1) deepBody = { level: deepBody };
    const deepRes = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', deepBody);
    assertEqual(deepRes._status, 400, 'cvv nested >8 levels deep → 400');
    assertEqual(deepRes.getJson()?.error, 'browser_supplied_data_rejected', 'deep-nested forbidden key error code');
  }

  /* ── Case 9: confirmation tokens are single-use ── */
  section('9. Confirmation tokens single-use');
  {
    const handler = createSandboxWriteHandler(PASS_ENV, createFailingCliSpy());
    const issueRes = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
      operation: 'order', bookingId: 'bk_single_1',
    });
    const token = issueRes.getJson()?.confirmationToken;
    assert(typeof token === 'string' && token.length >= 32, 'confirm-intent issues a token');

    const first = await callHandler(handler, '/api/atlas/sandbox/order', {
      bookingId: 'bk_single_1', confirmationToken: token, idempotencyKey: 'idem_su_1',
    });
    assertEqual(first._status, 503, 'first use accepted by gates → 503 sandbox_write_not_implemented');
    assertEqual(first.getJson()?.error, 'sandbox_write_not_implemented', 'first use error code');

    const second = await callHandler(handler, '/api/atlas/sandbox/order', {
      bookingId: 'bk_single_1', confirmationToken: token, idempotencyKey: 'idem_su_2',
    });
    assertEqual(second._status, 403, 'second use of same token → 403');
    assertEqual(second.getJson()?.error, 'confirmation_token_invalid_or_expired', 'second use rejected as invalid/expired');
  }

  /* ── Case 10: tokens operation-bound and subject-bound ── */
  section('10. Tokens operation-bound and subject-bound');
  {
    const handler = createSandboxWriteHandler(PASS_ENV, createFailingCliSpy());
    // Issue an ORDER token bound to bookingId bk_bound_1.
    const issueRes = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
      operation: 'order', bookingId: 'bk_bound_1',
    });
    const orderToken = issueRes.getJson()?.confirmationToken;

    // Wrong operation: use the order token on /pay → operation mismatch.
    const payRes = await callHandler(handler, '/api/atlas/sandbox/pay', {
      orderNo: 'bk_bound_1', confirmationToken: orderToken, idempotencyKey: 'idem_op_1',
    });
    assertEqual(payRes._status, 403, 'order token used on pay → 403');
    assertEqual(payRes.getJson()?.error, 'confirmation_token_operation_mismatch', 'operation mismatch error code');

    // Single-use even on misuse: replay of the same token fails too.
    const replayRes = await callHandler(handler, '/api/atlas/sandbox/pay', {
      orderNo: 'bk_bound_1', confirmationToken: orderToken, idempotencyKey: 'idem_op_2',
    });
    assertEqual(replayRes.getJson()?.error, 'confirmation_token_invalid_or_expired', 'misused token destroyed (single-use)');

    // Wrong subject: fresh order token, different bookingId → binding mismatch.
    const issue2 = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
      operation: 'order', bookingId: 'bk_bound_A',
    });
    const tokenA = issue2.getJson()?.confirmationToken;
    const wrongSubjectRes = await callHandler(handler, '/api/atlas/sandbox/order', {
      bookingId: 'bk_bound_B', confirmationToken: tokenA, idempotencyKey: 'idem_sub_1',
    });
    assertEqual(wrongSubjectRes._status, 403, 'token used with wrong bookingId → 403');
    assertEqual(wrongSubjectRes.getJson()?.error, 'confirmation_token_binding_mismatch', 'binding mismatch error code');
  }

  /* ── Case 11: token replay + TTL expiry rejected ── */
  section('11. Token replay rejected; 120s TTL enforced');
  {
    let clock = 1_000_000;
    const handler = createSandboxWriteHandler(PASS_ENV, createFailingCliSpy(), { now: () => clock });
    const issueRes = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
      operation: 'order', bookingId: 'bk_replay_1',
    });
    const token = issueRes.getJson()?.confirmationToken;
    assertEqual(issueRes.getJson()?.expiresInSeconds, 120, 'token TTL advertised as 120s');

    clock += 121_000; // advance past the 120s TTL
    const expiredRes = await callHandler(handler, '/api/atlas/sandbox/order', {
      bookingId: 'bk_replay_1', confirmationToken: token, idempotencyKey: 'idem_ttl_1',
    });
    assertEqual(expiredRes._status, 403, 'token used after TTL → 403');
    assertEqual(expiredRes.getJson()?.error, 'confirmation_token_invalid_or_expired', 'expired token rejected');

    // Replay of a consumed token within TTL was already covered in case 9;
    // additionally a fabricated token is rejected outright.
    const fakeRes = await callHandler(handler, '/api/atlas/sandbox/order', {
      bookingId: 'bk_replay_1', confirmationToken: 'forged'.repeat(8), idempotencyKey: 'idem_ttl_2',
    });
    assertEqual(fakeRes.getJson()?.error, 'confirmation_token_invalid_or_expired', 'forged token rejected');
  }

  /* ── Case 12: idempotency duplicates suppressed (replay shape) ── */
  section('12. Idempotency duplicates suppressed (replay shape)');
  {
    const handler = createSandboxWriteHandler(PASS_ENV, createFailingCliSpy());
    const issueRes = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
      operation: 'order', bookingId: 'bk_idem_1',
    });
    const token = issueRes.getJson()?.confirmationToken;

    const first = await callHandler(handler, '/api/atlas/sandbox/order', {
      bookingId: 'bk_idem_1', confirmationToken: token, idempotencyKey: 'idem_dup_1',
    });
    assertEqual(first._status, 503, 'first order attempt → 503 (execution disabled)');

    const replay = await callHandler(handler, '/api/atlas/sandbox/order', {
      bookingId: 'bk_idem_1', confirmationToken: token, idempotencyKey: 'idem_dup_1',
    });
    assertEqual(replay._status, 503, 'duplicate idempotency key → stored response replayed (503)');
    assertEqual(replay.getJson()?.replayed, true, 'replay response carries replayed:true');
    assertEqual(replay.getJson()?.error, 'sandbox_write_not_implemented', 'replayed body matches original');

    // Operation-bound keys: reusing an order idempotency key on pay → 400.
    const payIssue = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
      operation: 'pay', orderNo: 'ord_idem_1',
    });
    const payToken = payIssue.getJson()?.confirmationToken;
    const crossOp = await callHandler(handler, '/api/atlas/sandbox/pay', {
      orderNo: 'ord_idem_1', confirmationToken: payToken, idempotencyKey: 'idem_dup_1',
    });
    assertEqual(crossOp._status, 400, 'order idempotency key reused on pay → 400');
    assertEqual(crossOp.getJson()?.error, 'idempotency_key_operation_mismatch', 'idempotency operation mismatch code');
  }

  /* ── Case 13: paid-order duplicate guard suppresses second pay ── */
  section('13. Paid-order duplicate guard works');
  {
    // Test seam: the paid-order index is only ever populated by an
    // approved execution path; injecting a pre-paid orderNo proves the
    // suppression branch itself.
    const paidOrders = new Map([['ord_paid_1', { payKey: 'pk_1', paidAt: 0 }]]);
    const handler = createSandboxWriteHandler(PASS_ENV, createFailingCliSpy(), { paidOrders });
    const issueRes = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
      operation: 'pay', orderNo: 'ord_paid_1',
    });
    const token = issueRes.getJson()?.confirmationToken;
    const res = await callHandler(handler, '/api/atlas/sandbox/pay', {
      orderNo: 'ord_paid_1', confirmationToken: token, idempotencyKey: 'idem_paid_1',
    });
    assertEqual(res._status, 409, 'second pay for a paid orderNo → 409');
    assertEqual(res.getJson()?.error, 'payment_duplicate_suppressed', 'duplicate payment suppressed code');
    // Unpaid orders are not affected by the guard.
    const issue2 = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
      operation: 'pay', orderNo: 'ord_unpaid_1',
    });
    const okRes = await callHandler(handler, '/api/atlas/sandbox/pay', {
      orderNo: 'ord_unpaid_1', confirmationToken: issue2.getJson()?.confirmationToken, idempotencyKey: 'idem_paid_2',
    });
    assertEqual(okRes._status, 503, 'first pay for an unpaid orderNo proceeds to scaffold 503');
  }

  /* ── Case 14: order/pay NEVER invoke the CLI ── */
  section('14. Order/pay never invoke the CLI (spy count 0)');
  {
    const spy = createFailingCliSpy();
    const handler = createSandboxWriteHandler(PASS_ENV, spy);
    const issueRes = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
      operation: 'order', bookingId: 'bk_cli_1',
    });
    const orderToken = issueRes.getJson()?.confirmationToken;
    await callHandler(handler, '/api/atlas/sandbox/order', {
      bookingId: 'bk_cli_1', confirmationToken: orderToken, idempotencyKey: 'idem_cli_1',
    });
    const payIssue = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
      operation: 'pay', orderNo: 'ord_cli_1',
    });
    await callHandler(handler, '/api/atlas/sandbox/pay', {
      orderNo: 'ord_cli_1', confirmationToken: payIssue.getJson()?.confirmationToken, idempotencyKey: 'idem_cli_2',
    });
    // Also exercise gate-rejected paths through the middleware factory.
    const mw = createAtlasProxyMiddleware(PASS_ENV);
    await callMiddleware(mw, 'POST', '/api/atlas/sandbox/order', { bookingId: 'bk_cli_1' });
    await callMiddleware(mw, 'POST', '/api/atlas/sandbox/pay', { orderNo: 'ord_cli_1' });
    assertEqual(spy.calls.length, 0, 'injected CLI seam invoked 0 times by order/pay paths');
  }

  /* ── Case 15: status scaffolding never invokes the real CLI ── */
  section('15. Status scaffolding never invokes the real CLI');
  {
    const spy = createFailingCliSpy();
    const handler = createSandboxWriteHandler(PASS_ENV, spy);
    const res = await callHandler(handler, '/api/atlas/sandbox/status', { orderNo: 'ord_status_1' });
    assertEqual(res._status, 200, 'status scaffold responds 200');
    const body = res.getJson();
    assertEqual(body?.status, 'unknown', 'status scaffold reports unknown (fail closed)');
    assertEqual(body?.terminal, false, 'status scaffold is non-terminal');
    assertEqual(body?.scaffold, true, 'status scaffold marks scaffold:true');
    assertEqual(spy.calls.length, 0, 'injected CLI seam invoked 0 times by status');
    const badRes = await callHandler(handler, '/api/atlas/sandbox/status', {});
    assertEqual(badRes._status, 400, 'status without orderNo → 400');
  }

  /* ── Case 16: evidence record shape excludes secrets/sensitive fields ── */
  section('16. Evidence record excludes secrets/sensitive fields');
  {
    const rawIdempotencyKey = 'idem_evidence_raw_key_1';
    const record = createSandboxEvidenceRecord({
      correlationId: 'corr_1',
      operation: 'order',
      route: '/api/atlas/sandbox/order',
      searchId: 'srch_1',
      offerId: 'off_1',
      bookingId: 'bk_ev_1',
      orderNo: null,
      providerResponseCode: null,
      outcome: 'unknown',
      idempotencyKey: rawIdempotencyKey,
      gateEvaluation: { kill_switch: true, live_mode: true },
    });
    // New spec §13 fields exist; providerCode renamed to providerResponseCode.
    assert('providerResponseCode' in record, 'evidence has providerResponseCode (renamed from providerCode)');
    assert(!('providerCode' in record), 'evidence no longer carries the old providerCode key');
    assert('idempotencyKeyHash' in record, 'evidence has idempotencyKeyHash');
    assert('latencyMs' in record, 'evidence has latencyMs placeholder');
    assert('gateEvaluation' in record, 'evidence has gateEvaluation summary');
    assert('orderStatusCode' in record, 'evidence has orderStatusCode placeholder');
    assertEqual(typeof record.idempotencyKeyHash, 'string', 'idempotencyKeyHash is a string when key provided');
    assert(/^[0-9a-f]{16}$/.test(record.idempotencyKeyHash || ''), 'idempotencyKeyHash is a sha256 hex prefix');
    assertEqual(
      createSandboxEvidenceRecord({ operation: 'order', route: '/x', outcome: 'unknown' }).idempotencyKeyHash,
      null,
      'idempotencyKeyHash is null when no key provided',
    );
    const forbiddenRecordKeys = [
      'clientsecret', 'clientid', 'secret', 'authorization', 'authtoken',
      'accesstoken', 'token', 'confirmtoken', 'confirmationtoken',
      'confirmationid', 'apikey', 'password', 'card', 'cardnumber', 'pan',
      'cvv', 'cvc', 'email', 'phone', 'passenger', 'passengers',
      'documentnumber', 'passport', 'rawoutput', 'stdout', 'stderr',
      'idempotencykey',
    ];
    const actualKeys = Object.keys(record).map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const leaked = actualKeys.filter((k) => forbiddenRecordKeys.includes(k));
    assertEqual(leaked.length, 0, `no sensitive keys in evidence record (keys: ${actualKeys.join(',')})`);
    assertEqual(record.noRealBooking, true, 'evidence noRealBooking === true');
    assertEqual(record.noRealCharge, true, 'evidence noRealCharge === true');
    assertEqual(record.noAirlineTicketIssued, true, 'evidence noAirlineTicketIssued === true');
    assertEqual(record.scaffoldOnly, true, 'evidence scaffoldOnly === true');
    assertEqual(record.environment, 'sandbox', 'evidence environment === sandbox');
    const serialized = JSON.stringify(record);
    assert(!/sk-[a-zA-Z0-9]{10,}/.test(serialized), 'evidence serialization contains no secret-like material');
    assert(!/Bearer\s+/i.test(serialized), 'evidence serialization contains no bearer tokens');
    assert(!serialized.includes(rawIdempotencyKey), 'evidence serialization never contains the raw idempotency key');
  }

  /* ── Case 17: unknown provider status never treated as success ── */
  section('17. Unknown provider status not treated as success');
  {
    assertEqual(mapProviderOutcome('order', 'TOTALLY_UNKNOWN_CODE'), 'unknown', 'unknown named code → unknown');
    assertEqual(mapProviderOutcome('pay', 'PAYMENT_WEIRD'), 'unknown', 'unknown pay code → unknown');
    assertEqual(mapProviderOutcome('order', '1'), 'unknown', 'numeric code "1" → unknown (never success)');
    assertEqual(mapProviderOutcome('pay', '-3'), 'unknown', 'numeric code "-3" → unknown (never success)');
    assertEqual(mapProviderOutcome('order', ''), 'unknown', 'empty code → unknown');
    assertEqual(mapProviderOutcome('order', null), 'unknown', 'null code → unknown');
    assertEqual(mapProviderOutcome('order', 2), 'unknown', 'numeric (non-string) code → unknown');
    // Known accepted codes still map correctly (regression guard).
    assertEqual(mapProviderOutcome('order', 'PAYMENT_CONFIRMATION_REQUIRED'), 'accepted', 'known order code → accepted');
    assertEqual(mapProviderOutcome('pay', 'PAYMENT_ACCEPTED'), 'accepted', 'known pay code → accepted');
    // The /status scaffold default also never claims success (case 15
    // asserts status:'unknown'); duplicate order codes stay fail-closed.
    assertEqual(mapProviderOutcome('order', 'DUPLICATE_BOOKING_SUSPECTED'), 'accepted', 'duplicate-suspected adopts existing order (accepted, not recreated)');
  }

  /* ── Case 18: UI hidden when compile-time flag false (static source) ── */
  section('18. SandboxOrderPanel gates on __ATLAS_SANDBOX_WRITES__');
  {
    const panelSrc = fs.readFileSync(
      path.resolve(WORKSPACE_ROOT, 'app/src/components/SandboxOrderPanel.tsx'),
      'utf-8',
    );
    assert(panelSrc.includes('__ATLAS_SANDBOX_WRITES__'), 'panel references the __ATLAS_SANDBOX_WRITES__ compile flag');
    assert(
      panelSrc.includes("typeof __ATLAS_SANDBOX_WRITES__ !== 'undefined' ? __ATLAS_SANDBOX_WRITES__ : false"),
      'compile flag defaults to false when undefined (fail closed)',
    );
    assert(panelSrc.includes('SANDBOX_WRITES_COMPILE_FLAG === true'), 'render eligibility requires compile flag === true');
    assert(panelSrc.includes("DATA_MODE === 'live'"), 'render eligibility requires DATA_MODE === live');
    assert(/if \(!eligible \|\| !runtimeEnabled\)\s*\{\s*return null;\s*\}/.test(panelSrc), 'panel returns null unless every gate passes');
    // The JSX render return (not the useEffect cleanup `return () =>`).
    const renderIndex = panelSrc.indexOf('return (\n    <div className="sc-sbx-panel"');
    const guardIndex = panelSrc.indexOf('if (!eligible || !runtimeEnabled)');
    assert(guardIndex !== -1 && renderIndex !== -1 && guardIndex < renderIndex, 'null-return guard precedes any JSX render');
  }

  /* ── Case 19: existing banned-word tests remain compatible ── */
  section('19. live-mode-banned-words-tests still pass (subprocess)');
  {
    let exitCode = 0;
    let output = '';
    try {
      output = execFileSync(process.execPath, [
        path.resolve(WORKSPACE_ROOT, 'smoke-tests/live-mode-banned-words-tests.mjs'),
      ], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      exitCode = err.status ?? 1;
      output = `${err.stdout || ''}${err.stderr || ''}`;
    }
    assertEqual(exitCode, 0, 'live-mode-banned-words-tests exit code 0');
    const summary = (output.match(/Results:\s*\d+ passed,\s*\d+ failed/) || ['(no summary line)'])[0];
    console.log(`    ↳ ${summary}`);
  }

  /* ── Case 20: offline mode unaffected ── */
  section('20. Offline mode unaffected');
  {
    // Sandbox routes in offline mode fail closed at the live_mode gate.
    const offlineSandboxEnv = { ...PASS_ENV, DATA_MODE: 'offline' };
    const mw = createAtlasProxyMiddleware(offlineSandboxEnv);
    for (const route of ['/api/atlas/sandbox/order', '/api/atlas/sandbox/pay', '/api/atlas/sandbox/capabilities']) {
      const res = await callMiddleware(mw, 'POST', route, {});
      assertEqual(res._status, 403, `offline: ${route} → 403`);
      assertEqual(res.getJson()?.error, 'live_mode_not_enabled', `offline: ${route} error live_mode_not_enabled`);
    }
    // Search route unchanged in offline mode (same 403 as before).
    const offlineEnv = { DATA_MODE: 'offline' };
    const offlineMw = createAtlasProxyMiddleware(offlineEnv);
    const searchRes = await callMiddleware(offlineMw, 'POST', '/api/atlas/search', {
      origin: 'KUL', destination: 'SIN', depart: '2026-09-15', adults: 1, currency: 'USD',
    });
    assertEqual(searchRes._status, 403, 'offline: /api/atlas/search still 403 live_mode_not_enabled');
    assertEqual(searchRes.getJson()?.error, 'live_mode_not_enabled', 'offline search error code unchanged');

    // Sandbox copy never leaks into offline provenance labels: the
    // sandbox label lives behind its own evidenceSource branch and the
    // panel requires DATA_MODE === 'live' before rendering anything.
    const labelsSrc = fs.readFileSync(path.resolve(WORKSPACE_ROOT, 'core/provenance/labels.ts'), 'utf-8');
    assert(labelsSrc.includes('sandboxWrites'), 'labels map keeps sandbox label under its own key');
    assert(labelsSrc.includes("evidenceSource === 'atlas-sandbox-writes'"), 'sandbox label only rendered for sandbox evidenceSource');
    const panelSrc = fs.readFileSync(path.resolve(WORKSPACE_ROOT, 'app/src/components/SandboxOrderPanel.tsx'), 'utf-8');
    assert(panelSrc.includes("DATA_MODE === 'live'"), 'panel copy unreachable in offline builds');
  }

  /* ── Case 21: regression — cross-request state persistence ──
   * Simulates the fixed vite-plugin pattern: the middleware is built
   * ONCE, and the token/idempotency stores must persist across
   * separate requests through the same instance. */
  section('21. Regression: single middleware instance persists stateful stores');
  {
    const middleware = createAtlasProxyMiddleware(PASS_ENV);

    // Request 1: issue a confirm-intent token.
    const issueRes = await callMiddleware(middleware, 'POST', '/api/atlas/sandbox/confirm-intent', {
      operation: 'order', bookingId: 'bk_regress_1',
    });
    assertEqual(issueRes._status, 200, 'confirm-intent issues token via middleware');
    const token = issueRes.getJson()?.confirmationToken;
    assert(typeof token === 'string' && token.length >= 32, 'token issued through shared middleware instance');

    // Request 2: consume the token on a SEPARATE request through the
    // SAME middleware instance. Accepted ⇒ stores persist (NOT
    // confirmation_token_invalid_or_expired).
    const orderRes = await callMiddleware(middleware, 'POST', '/api/atlas/sandbox/order', {
      bookingId: 'bk_regress_1', confirmationToken: token, idempotencyKey: 'idem_regress_1',
    });
    assert(
      orderRes.getJson()?.error !== 'confirmation_token_invalid_or_expired',
      'token accepted on follow-up request through same middleware (cross-request persistence)',
    );
    assertEqual(orderRes._status, 503, 'consumed token reaches fail-closed scaffold → 503');
    assertEqual(orderRes.getJson()?.error, 'sandbox_write_not_implemented', 'order fails closed, not on token validation');

    // Request 3: replay the same token — must be rejected (single-use).
    const replayRes = await callMiddleware(middleware, 'POST', '/api/atlas/sandbox/order', {
      bookingId: 'bk_regress_1', confirmationToken: token, idempotencyKey: 'idem_regress_2',
    });
    assertEqual(replayRes._status, 403, 'replayed token → 403');
    assertEqual(replayRes.getJson()?.error, 'confirmation_token_invalid_or_expired', 'replayed token rejected (single-use enforced)');
  }

  /* ── Case 22: regression — oversized traveler_id rejected ── */
  section('22. Regression: oversized traveler_id rejected 400');
  {
    const handler = createSandboxWriteHandler(PASS_ENV, createFailingCliSpy());
    const res = await callHandler(handler, '/api/atlas/sandbox/order', {
      bookingId: 'bk_oversized_1',
      travelers: [{ traveler_id: 'x'.repeat(200), passenger_type: 'ADT' }],
      confirmationToken: 'tok_placeholder',
      idempotencyKey: 'idem_oversized_1',
    });
    assertEqual(res._status, 400, 'traveler_id of 200 chars (>128 cap) → 400');
    assertEqual(res.getJson()?.error, 'invalid_travelers', 'oversized traveler_id yields invalid_travelers');
  }

  /* ── Bonus invariants: scaffold constants stay fail closed ── */
  section('Bonus: scaffold constants remain fail closed');
  {
    assertEqual(
      PASSENGER_CONTRACT_STATUS,
      'BLOCKED_PENDING_SUPERVISED_REHEARSAL',
      'passenger contract still BLOCKED_PENDING_SUPERVISED_REHEARSAL',
    );
    // Capabilities endpoint reports execution NOT approved.
    const handler = createSandboxWriteHandler(PASS_ENV, createFailingCliSpy());
    const res = await callHandler(handler, '/api/atlas/sandbox/capabilities', {});
    assertEqual(res._status, 200, 'capabilities responds 200 with gates passing');
    const caps = res.getJson();
    assertEqual(caps?.executionApproved, false, 'capabilities executionApproved === false');
    assertEqual(caps?.writeExecution, 'disabled_pending_contract_approval', 'capabilities writeExecution disabled');
    assertEqual(caps?.passengerContract, 'BLOCKED_PENDING_SUPERVISED_REHEARSAL', 'capabilities passenger contract blocked');
  }

  /* ── Summary ─ */
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
