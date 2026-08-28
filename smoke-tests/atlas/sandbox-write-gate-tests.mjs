// Offline gate + execution tests for the completed Atlas Sandbox write
// path (app/server/atlas-sandbox-writes.mjs Item 4 execution seam).
//
// Run:  node smoke-tests/atlas/sandbox-write-gate-tests.mjs
//       (from anywhere; paths are resolved relative to this file)
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//   - The atlas-flight CLI is NEVER executed: every execCliImpl seam is
//     a COUNTING spy that records args + stdin and returns scripted
//     envelopes (or fails loudly when it must never be invoked).
//   - Time is fully controlled via the injected `options.now()` clock.
//   - Evidence files are written to a per-run os.tmpdir() directory and
//     deleted afterwards. No network calls, no dev server, no .env read.
//
// Harness cloned from the PROTECTED root-level test
// smoke-tests/atlas-sandbox-write-gate-tests.mjs (assert/assertEqual/
// section, createMockReq/createMockRes, callHandler/callMiddleware,
// PASS_ENV shape). The protected file is never edited; this file
// re-asserts its invariants AND covers the approved-execution path.
//
// Exit code 0 = all tests passed. Exit code 1 = one or more failures.

import fsSync from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAtlasProxyMiddleware } from '../../app/server/atlas-proxy.mjs';
import {
  createSandboxWriteHandler,
  normalizeSandboxOrderStatus,
  redactForEvidence,
  REQUIRED_SANDBOX_BASE_URL,
} from '../../app/server/atlas-sandbox-writes.mjs';
import {
  transition,
  getInitialState,
  isTerminalState,
  canAttemptWrite,
  mapProviderOutcome,
  SANDBOX_TERMINAL_STATES,
} from '../../core/simulation/sandbox-order-states.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');

/* ── Minimal test harness (cloned from the protected file) ── */

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

/* ── Mock HTTP helpers (cloned from the protected file) ── */

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
      failed += 1;
      failures.push(`handler threw: ${err?.message || err}`);
      console.log(`  ❌  handler threw: ${err?.message || err}`);
      resolve(res);
    });
  });
}

/* ── COUNTING CLI spy (records args + stdin, scripted envelopes) ── */

/**
 * Records every invocation as { args, stdin, opts } and returns
 * scripted results FIFO from `queue`. When the queue is exhausted the
 * spy fails loudly — scripted tests must never reach a live executor.
 */
function createCountingCliSpy(name = 'execCliImpl') {
  const spy = (args, opts = {}) => {
    spy.calls.push({ args: [...args], stdin: opts?.stdin ?? '', opts });
    if (spy.queue.length === 0) {
      throw new Error(`${name} invoked beyond its scripted envelope queue`);
    }
    return spy.queue.shift();
  };
  spy.calls = [];
  spy.queue = [];
  spy.script = (...results) => { spy.queue.push(...results); };
  spy.countFor = (sub) => spy.calls.filter((c) => c.args[1] === sub).length;
  return spy;
}

/** A scripted envelope matching execCliOnceWithStdin's resolve shape.
 *  The real seam always returns a PROMISE (execFile callback style),
 *  and the implementation awaits the seam's return value — so scripted
 *  results are returned as resolved promises to match real behavior. */
function cliEnvelope(parsed, extras = {}) {
  return Promise.resolve({
    parsed,
    exitCode: 0,
    timedOut: false,
    errorCode: null,
    stderr: '',
    ...extras,
  });
}

const CLI_TIMEOUT_RESULT = Object.freeze({
  get value() { return Promise.resolve({ parsed: null, exitCode: 1, timedOut: true, errorCode: 'ETIMEDOUT', stderr: '' }); },
});

/** A CLI result whose promise resolves only when the test chooses —
 *  used to hold a request in flight for idempotency assertions. */
function deferredCliResult() {
  let resolveFn;
  const promise = new Promise((resolve) => { resolveFn = resolve; });
  return { promise, resolve: (v) => resolveFn(v) };
}

/** CLI spy that throws if invoked — for fail-closed path assertions. */
function createFailingCliSpy(name = 'execCliImpl') {
  const spy = (...args) => {
    spy.calls.push(args);
    throw new Error(`${name} must never be invoked here`);
  };
  spy.calls = [];
  return spy;
}

/* ── Environment fixtures ── */

// Fix-round evidence isolation: NOTHING in this suite may write into the
// workspace output/ directory. Middleware-created handlers are steered
// to a module-level os.tmpdir() directory via the ATLAS_SANDBOX_EVIDENCE_DIR
// env seam; every direct createSandboxWriteHandler construction
// additionally injects an explicit no-op evidenceSink.
const MODULE_EVIDENCE_TMPDIR = fsSync.mkdtempSync(
  path.join(os.tmpdir(), 'stitchcheck-atlas-sandbox-tests-ev-'),
);

/** Shared no-op evidence sink injected into direct handler constructions. */
const noopEvidenceSink = () => {};

/** All six gates pass (same shape as the protected file's PASS_ENV). */
const PASS_ENV = Object.freeze({
  ATLAS_SANDBOX_WRITES_ENABLED: 'true',
  DATA_MODE: 'live',
  ATLAS_LIVE_READ_ONLY: 'true',
  ATLAS_ENVIRONMENT: 'sandbox',
  ATLAS_SANDBOX_BASE_URL: REQUIRED_SANDBOX_BASE_URL,
  // Test seam: keep gate-rejection evidence of middleware-created
  // handlers out of the workspace output/ directory.
  ATLAS_SANDBOX_EVIDENCE_DIR: MODULE_EVIDENCE_TMPDIR,
});

/** PASS_ENV + the execution activation flag (integration section only). */
const APPROVED_ENV = Object.freeze({
  ...PASS_ENV,
  ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED: 'true',
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

/** The 7 BLOCKED_PATHS of atlas-proxy.mjs (regression re-assertion). */
const BLOCKED_WRITE_PATHS = [
  '/api/atlas/order',
  '/api/atlas/booking',
  '/api/atlas/reservation',
  '/api/atlas/payment',
  '/api/atlas/ticket',
  '/api/atlas/cancel',
  '/api/atlas/refund',
];

/* ── Fake-clock + flow helpers ── */

function makeClock(start = 1_000_000) {
  const state = { value: start };
  return {
    now: () => state.value,
    advance: (ms) => { state.value += ms; },
  };
}

/** Advance 61s — safely past the 60s issuance-rate window (lazy trim). */
function step(clock) {
  clock.advance(61_000);
}

async function issueOrderToken(handler, bookingId) {
  const res = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
    operation: 'order', bookingId,
  });
  return res.getJson()?.confirmationToken;
}

async function issuePayToken(handler, orderNo) {
  const res = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
    operation: 'pay', orderNo,
  });
  return res.getJson()?.confirmationToken;
}

/** Wait until a file exists and has ≥ minLines lines (evidence chain is
 *  fire-and-forget, so tests poll briefly instead of awaiting fs). */
async function waitForEvidenceFile(filePath, minLines, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const lineCount = content.split('\n').filter(Boolean).length;
      if (lineCount >= minLines) return content;
    } catch { /* not written yet */ }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`evidence file never reached ${minLines} lines: ${filePath}`);
}

/** The evidence writer creates its directory lazily on the first write
 *  (fire & forget) — poll for the JSONL file instead of a synchronous
 *  readdir immediately after the responses. */
async function waitForEvidenceFileName(dir, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const match = fsSync.readdirSync(dir).find((f) => f.endsWith('.jsonl'));
      if (match) return match;
    } catch { /* dir not created yet */ }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

/** Mock read-path CLI executor for the Search→Verify leg (fix-round
 *  coverage): scripts are keyed by argument-prefix and the spy records
 *  every call. Unexpected calls fail loudly — offline only. */
function createReadCliSpy() {
  const spy = (args) => {
    spy.calls.push([...args]);
    const joined = args.join(' ');
    for (const [prefix, result] of spy.scripts) {
      if (joined.startsWith(prefix)) return result;
    }
    throw new Error(`unexpected read CLI call: ${joined}`);
  };
  spy.calls = [];
  spy.scripts = [];
  spy.script = (prefix, parsed) => { spy.scripts.push([prefix, cliEnvelope(parsed)]); };
  return spy;
}

/* ── Tests ── */

async function runTests() {
  console.log('Atlas Sandbox Write Gate + Execution Tests (offline, item 7)\n');
  const tempDirs = [MODULE_EVIDENCE_TMPDIR];

  try {
    /* ══ 1. GATES ══ */
    section('1. Gates — kill switch, environment, flags, base URL, BLOCKED_PATHS');
    {
      const spy = createCountingCliSpy();

      // Kill switch off → every one of the 5 routes 403.
      for (const flagValue of ['false', undefined]) {
        const env = { ...PASS_ENV, ATLAS_SANDBOX_WRITES_ENABLED: flagValue };
        if (flagValue === undefined) delete env.ATLAS_SANDBOX_WRITES_ENABLED;
        const mw = createAtlasProxyMiddleware(env);
        for (const route of SANDBOX_ROUTES) {
          const res = await callMiddleware(mw, 'POST', route, {});
          assertEqual(res._status, 403, `${route} → 403 (writes flag=${JSON.stringify(flagValue)})`);
        }
      }

      // ATLAS_ENVIRONMENT != sandbox → 403.
      {
        const mw = createAtlasProxyMiddleware({ ...PASS_ENV, ATLAS_ENVIRONMENT: 'production' });
        const res = await callMiddleware(mw, 'POST', '/api/atlas/sandbox/capabilities', {});
        assertEqual(res._status, 403, 'ATLAS_ENVIRONMENT=production → 403');
        assertEqual(res.getJson()?.error, 'non_sandbox_environment', 'error non_sandbox_environment');
      }

      // ATLAS_WRITES_ENABLED=true (production flag) → 403.
      {
        const mw = createAtlasProxyMiddleware({ ...PASS_ENV, ATLAS_WRITES_ENABLED: 'true' });
        const res = await callMiddleware(mw, 'POST', '/api/atlas/sandbox/capabilities', {});
        assertEqual(res._status, 403, 'ATLAS_WRITES_ENABLED=true → 403');
        assertEqual(res.getJson()?.error, 'production_writes_flag_conflict', 'error production_writes_flag_conflict');
      }

      // Non-sandbox base URL → 403.
      {
        const mw = createAtlasProxyMiddleware({ ...PASS_ENV, ATLAS_SANDBOX_BASE_URL: NON_SANDBOX_BASE_URL });
        const res = await callMiddleware(mw, 'POST', '/api/atlas/sandbox/capabilities', {});
        assertEqual(res._status, 403, 'non-sandbox base URL → 403');
        assertEqual(res.getJson()?.error, 'non_sandbox_base_url', 'error non_sandbox_base_url');
      }

      // Regression: default-deny — the execution approval flag alone
      // never opens anything; kill switch still dominates.
      {
        const mw = createAtlasProxyMiddleware({
          ...PASS_ENV,
          ATLAS_SANDBOX_WRITES_ENABLED: undefined,
          ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED: 'true',
        });
        const res = await callMiddleware(mw, 'POST', '/api/atlas/sandbox/order', { bookingId: 'bk_x' });
        assertEqual(res._status, 403, 'execution-approved flag cannot bypass the kill switch');
        assertEqual(res.getJson()?.error, 'sandbox_writes_disabled', 'default-deny error code preserved');
      }

      // Regression: the 7 BLOCKED_PATHS stay 404 across env combinations
      // (failing CLI spy proves no executor can ever be reached).
      const envCombos = [
        ['PASS_ENV', PASS_ENV],
        ['APPROVED_ENV', APPROVED_ENV],
        ['offline', { ...PASS_ENV, DATA_MODE: 'offline' }],
        ['empty', {}],
      ];
      for (const [label, env] of envCombos) {
        const mw = createAtlasProxyMiddleware(env);
        for (const p of BLOCKED_WRITE_PATHS) {
          const res = await callMiddleware(mw, 'POST', p, {});
          assertEqual(res._status, 404, `[${label}] ${p} → 404`);
        }
      }

      // Handler-level gate codes with the counting spy (never invoked).
      const handler = createSandboxWriteHandler({ ...PASS_ENV, ATLAS_ENVIRONMENT: 'production' }, spy, { evidenceSink: noopEvidenceSink });
      const gateRes = await callHandler(handler, '/api/atlas/sandbox/order', { bookingId: 'bk_gate_1' });
      assertEqual(gateRes._status, 403, 'handler-level non-sandbox environment → 403');
      assertEqual(spy.calls.length, 0, 'counting CLI spy invoked 0 times by gated paths');
    }

    /* ══ 2. TOKENS ══ */
    section('2. Confirmation tokens — single-use, 120s TTL, binding, rate limit');
    {
      const clock = makeClock();
      const handler = createSandboxWriteHandler(PASS_ENV, createFailingCliSpy(), { now: clock.now, evidenceSink: noopEvidenceSink });

      // Single-use.
      const token = await issueOrderToken(handler, 'bk_tok_single');
      assert(typeof token === 'string' && token.length >= 32, 'confirm-intent issues a ≥32-char token');
      const first = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_tok_single', confirmationToken: token, idempotencyKey: 'idem_tok_1',
      });
      assertEqual(first._status, 503, 'first token use accepted by gates → 503 scaffold');
      const replay = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_tok_single', confirmationToken: token, idempotencyKey: 'idem_tok_2',
      });
      assertEqual(replay._status, 403, 'second use of same token → 403');
      assertEqual(replay.getJson()?.error, 'confirmation_token_invalid_or_expired', 'replay rejected code');

      // 120s TTL via fake clock.
      step(clock);
      const ttlToken = await issueOrderToken(handler, 'bk_tok_ttl');
      const issueRes = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
        operation: 'order', bookingId: 'bk_tok_ttl_advertised',
      });
      assertEqual(issueRes.getJson()?.expiresInSeconds, 120, 'token TTL advertised as 120s');
      clock.advance(121_000);
      const expired = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_tok_ttl', confirmationToken: ttlToken, idempotencyKey: 'idem_tok_3',
      });
      assertEqual(expired._status, 403, 'token used after 120s TTL → 403');
      assertEqual(expired.getJson()?.error, 'confirmation_token_invalid_or_expired', 'expired token rejected');

      // Operation binding + cross-operation misuse destroyed the token.
      step(clock);
      const orderToken = await issueOrderToken(handler, 'bk_tok_bind');
      const misuse = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'bk_tok_bind', confirmationToken: orderToken, idempotencyKey: 'idem_tok_4',
      });
      assertEqual(misuse._status, 403, 'order token used on pay → 403');
      assertEqual(misuse.getJson()?.error, 'confirmation_token_operation_mismatch', 'operation mismatch code');
      const misuseReplay = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'bk_tok_bind', confirmationToken: orderToken, idempotencyKey: 'idem_tok_5',
      });
      assertEqual(misuseReplay.getJson()?.error, 'confirmation_token_invalid_or_expired', 'misused token destroyed (single-use)');

      // Subject binding.
      step(clock);
      const tokenA = await issueOrderToken(handler, 'bk_tok_A');
      const wrongSubject = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_tok_B', confirmationToken: tokenA, idempotencyKey: 'idem_tok_6',
      });
      assertEqual(wrongSubject._status, 403, 'token used with wrong bookingId → 403');
      assertEqual(wrongSubject.getJson()?.error, 'confirmation_token_binding_mismatch', 'binding mismatch code');

      // Fabricated token rejected outright.
      const forged = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_tok_A', confirmationToken: 'forged'.repeat(8), idempotencyKey: 'idem_tok_7',
      });
      assertEqual(forged.getJson()?.error, 'confirmation_token_invalid_or_expired', 'forged token rejected');

      // Rate limit: sliding 60s window, max 10 issuances → 429.
      step(clock);
      let issued = 0;
      for (let i = 0; i < 10; i += 1) {
        const res = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
          operation: 'order', bookingId: `bk_rate_${i}`,
        });
        if (res._status === 200) issued += 1;
      }
      assertEqual(issued, 10, 'first 10 issuances within the window all succeed');
      const limited = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
        operation: 'order', bookingId: 'bk_rate_11',
      });
      assertEqual(limited._status, 429, '11th issuance in the same window → 429');
      assertEqual(limited.getJson()?.error, 'token_rate_limited', 'rate limit error code token_rate_limited');
      clock.advance(61_000);
      const afterWindow = await callHandler(handler, '/api/atlas/sandbox/confirm-intent', {
        operation: 'order', bookingId: 'bk_rate_12',
      });
      assertEqual(afterWindow._status, 200, 'issuance allowed again after the window slides');
    }

    /* ══ 3. IDEMPOTENCY ══ */
    section('3. Idempotency — in-flight 409, replay, duplicate pay, key expiry');
    {
      const clock = makeClock();
      const spy = createCountingCliSpy();
      const handler = createSandboxWriteHandler(APPROVED_ENV, spy, { now: clock.now, evidenceSink: noopEvidenceSink });

      // In-flight detection with a deferred CLI promise (order).
      step(clock);
      const tokA = await issueOrderToken(handler, 'bk_inflight');
      const deferredOrder = deferredCliResult();
      // The seam resolves whatever the spy returns, so script the raw
      // promise itself — the request hangs until the test resolves it.
      spy.queue = [deferredOrder.promise];
      const p1 = callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_inflight', confirmationToken: tokA, idempotencyKey: 'idem_if_1',
      });
      await new Promise((resolve) => setTimeout(resolve, 5)); // let req 1 claim the key
      const second = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_inflight', confirmationToken: 'tok_unused_but_required_padding_x', idempotencyKey: 'idem_if_1',
      });
      assertEqual(second._status, 409, 'second request with same in-flight key → 409');
      assertEqual(second.getJson()?.error, 'idempotency_in_flight', 'in-flight error code');
      deferredOrder.resolve(cliEnvelope({
        status: 'success', code: 'PAYMENT_CONFIRMATION_REQUIRED',
        orderNo: 'ORD-INFLIGHT', confirmationId: 'conf-inflight',
      }));
      const firstRes = await p1;
      assertEqual(firstRes.getJson()?.outcome, 'accepted', 'first in-flight request completes accepted');
      assertEqual(spy.countFor('create'), 1, 'in-flight duplicate caused NO extra order-create CLI call');

      // Completed → replay; CLI invocation count stays exactly 1.
      step(clock);
      const replayRes = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_inflight', confirmationToken: 'tok_padding_replay_request_xxxxxx', idempotencyKey: 'idem_if_1',
      });
      assertEqual(replayRes._status, 200, 'completed key replays the stored 200 response');
      assertEqual(replayRes.getJson()?.replayed, true, 'replay response carries replayed:true');
      assertEqual(replayRes.getJson()?.orderNo, 'ORD-INFLIGHT', 'replayed body matches the original');
      assertEqual(spy.countFor('create'), 1, 'completed replay re-executes NOTHING (count still 1)');

      // Duplicate pay suppressed; N pay retries → exactly 1 CLI call.
      step(clock);
      const payTok1 = await issuePayToken(handler, 'ORD-INFLIGHT');
      // Script an empty envelope (parsed === null) → unknown outcome.
      spy.script(cliEnvelope(null, { exitCode: 0 }));
      const pay1 = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-INFLIGHT', confirmationToken: payTok1, idempotencyKey: 'idem_pay_dup',
      });
      assertEqual(pay1.getJson()?.outcome, 'unknown', 'pay CLI returned no parseable envelope → unknown (never success)');
      assertEqual(spy.countFor('pay'), 1, 'first pay executed exactly once');
      // The scripted queue is empty now — any further pay CLI call would
      // throw, so the following retries can ONLY be answered from the
      // idempotency store / paid index.
      const payTok2 = await issuePayToken(handler, 'ORD-INFLIGHT');
      const pay2 = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-INFLIGHT', confirmationToken: payTok2, idempotencyKey: 'idem_pay_dup',
      });
      assertEqual(pay2._status, 200, 'same-key pay retry replays stored response');
      assertEqual(pay2.getJson()?.replayed, true, 'pay retry marked replayed');
      const payTok3 = await issuePayToken(handler, 'ORD-INFLIGHT');
      const pay3 = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-INFLIGHT', confirmationToken: payTok3, idempotencyKey: 'idem_pay_dup',
      });
      assertEqual(pay3.getJson()?.replayed, true, 'third pay retry also replays');
      assertEqual(spy.countFor('pay'), 1, 'N pay retries → exactly 1 pay CLI call');

      // Pay timeout/unknown → NEVER re-pay (fix-round CRITICAL-2): the
      // confirmation entry was consumed pre-flight by pay1, so a FRESH
      // idempotency key must fail closed WITHOUT re-executing `order pay`.
      step(clock);
      const payTok4 = await issuePayToken(handler, 'ORD-INFLIGHT');
      const cliCallsBeforeRepay = spy.calls.length;
      const pay4 = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-INFLIGHT', confirmationToken: payTok4, idempotencyKey: 'idem_pay_reconcile',
      });
      assertEqual(pay4._status, 502, 'fresh key after an unknown pay → 502 fail closed (never re-pay)');
      assertEqual(pay4.getJson()?.error, 'confirmation_id_already_consumed', 'consumed confirmation id error code');
      assertEqual(spy.calls.length, cliCallsBeforeRepay, 'no second pay CLI call for a consumed confirmation id');
      // Same-key replay of the rejected re-pay still replays the stored response.
      const pay4Replay = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-INFLIGHT', confirmationToken: 'tok_pad_repay_replay_xxxxxxxxxxxxx', idempotencyKey: 'idem_pay_reconcile',
      });
      assertEqual(pay4Replay.getJson()?.replayed, true, 'rejected re-pay replays on same-key follow-up');
      assertEqual(spy.calls.length, cliCallsBeforeRepay, 'replayed re-pay rejection executes nothing');
      // (The duplicate-suppression 409 for a NEW key after an ACCEPTED pay
      // is asserted in section 5a once the paid index is populated.)

      // Idempotency-key expiry via clock advance (30-minute TTL).
      step(clock);
      const tokE = await issueOrderToken(handler, 'bk_keyexpiry');
      spy.script(cliEnvelope({
        status: 'success', code: 'PAYMENT_CONFIRMATION_REQUIRED',
        orderNo: 'ORD-EXPIRY', confirmationId: 'conf-expiry',
      }));
      await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_keyexpiry', confirmationToken: tokE, idempotencyKey: 'idem_expiry',
      });
      clock.advance(31 * 60_000); // past the 30-minute idempotency TTL
      const expiredReplay = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_keyexpiry', confirmationToken: 'tok_padding_expired_replay_xxxxxxx', idempotencyKey: 'idem_expiry',
      });
      assert(
        expiredReplay.getJson()?.replayed !== true,
        'expired idempotency key is NOT replayed (record swept by clock)',
      );
      assertEqual(expiredReplay.getJson()?.error, 'confirmation_token_invalid_or_expired', 'expired-key request fails closed on token');

      // Cross-operation idempotency keys rejected.
      step(clock);
      const payTokX = await issuePayToken(handler, 'ORD-EXPIRY');
      const crossOp = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-EXPIRY', confirmationToken: payTokX, idempotencyKey: 'idem_expiry',
      });
      assertEqual(crossOp._status, 400, 'order idempotency key reused on pay → 400');
      assertEqual(crossOp.getJson()?.error, 'idempotency_key_operation_mismatch', 'idempotency operation mismatch code');
    }

    /* ══ 4. INPUTS ══ */
    section('4. Inputs — forbidden browser fields, oversized ids, travelers');
    {
      const clock = makeClock();
      const handler = createSandboxWriteHandler(APPROVED_ENV, createCountingCliSpy(), { now: clock.now, evidenceSink: noopEvidenceSink });

      const forbiddenBodies = [
        { passengers: [{ given_name: 'Test', surname: 'Person' }] },
        { passenger: { given_name: 'Test' } },
        { cardNumber: '4111111111111111' },
        { pan: '4111111111111111' },
        { cvv: '123' },
        { givenName: 'Test' },
        { surname: 'Person' },
        { email: 'test@example.com' },
        { card: { number: '4111111111111111' } },
        { confirmationId: 'conf_should_be_server_owned' },
        { nested: { deep: { api_key: 'sk-secret1234567890' } } },
      ];
      for (const body of forbiddenBodies) {
        const res = await callHandler(handler, '/api/atlas/sandbox/order', {
          bookingId: 'bk_inputs', confirmationToken: 'tok_pad_inputs_xxxxxxxxxxxxxxxxxx',
          idempotencyKey: 'idem_inputs_x', ...body,
        });
        const key = Object.keys(body)[0];
        assertEqual(res._status, 400, `body with "${key}" → 400`);
        assertEqual(res.getJson()?.error, 'browser_supplied_data_rejected', `body with "${key}" error code`);
      }

      // Oversized traveler_id (>128 cap) → 400.
      const oversized = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_inputs',
        travelers: [{ traveler_id: 'x'.repeat(200), passenger_type: 'ADT' }],
        confirmationToken: 'tok_pad_inputs_xxxxxxxxxxxxxxxxxx',
        idempotencyKey: 'idem_inputs_y',
      });
      assertEqual(oversized._status, 400, 'traveler_id of 200 chars (>128 cap) → 400');
      assertEqual(oversized.getJson()?.error, 'invalid_travelers', 'oversized traveler_id yields invalid_travelers');

      // Tightened traveler validation (fix round): entries must be opaque
      // references ONLY. Passenger-data keys inside travelers[] are caught
      // by the forbidden-key scanner (400 browser_supplied_data_rejected)…
      const passengerDataTravelers = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_inputs',
        travelers: [{ traveler_id: 't1', passenger_type: 'ADT', given_name: 'SMUGGLED', document_number: 'N1234567' }],
        confirmationToken: 'tok_pad_inputs_xxxxxxxxxxxxxxxxxx',
        idempotencyKey: 'idem_inputs_z',
      });
      assertEqual(passengerDataTravelers._status, 400, 'travelers entry carrying passenger-data keys → 400');
      assertEqual(passengerDataTravelers.getJson()?.error, 'browser_supplied_data_rejected', 'passenger-data keys inside travelers[] rejected by the forbidden-key scanner');
      // …and ANY other unexpected traveler-entry key fails closed via
      // isValidTravelers (400 invalid_travelers).
      const extraKeyTravelers = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_inputs',
        travelers: [{ traveler_id: 't1', passenger_type: 'ADT', seat_preference: 'window' }],
        confirmationToken: 'tok_pad_inputs_xxxxxxxxxxxxxxxxxx',
        idempotencyKey: 'idem_inputs_z2',
      });
      assertEqual(extraKeyTravelers._status, 400, 'travelers entry with an unexpected extra key → 400');
      assertEqual(extraKeyTravelers.getJson()?.error, 'invalid_travelers', 'extra traveler-entry key yields invalid_travelers (fail closed)');
      const emptyTravelers = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_inputs', travelers: [],
        confirmationToken: 'tok_pad_inputs_xxxxxxxxxxxxxxxxxx',
        idempotencyKey: 'idem_inputs_w',
      });
      assertEqual(emptyTravelers._status, 400, 'empty travelers array → 400');
      assertEqual(emptyTravelers.getJson()?.error, 'invalid_travelers', 'empty travelers yields invalid_travelers');
    }

    /* ══ 5. INTEGRATION (execution approved) ══ */
    section('5. Integration — approved execution with scripted CLI envelopes');
    {
      const clock = makeClock();
      const spy = createCountingCliSpy();
      const handler = createSandboxWriteHandler(APPROVED_ENV, spy, { now: clock.now, evidenceSink: noopEvidenceSink });

      // 5a. Full Search→Verify→Order→Pay→Status success chain
      // (Search/Verify are the read path that precedes the panel; the
      // write chain under test starts at confirm-intent → order).

      // Fix-round coverage: the mocked Search→Verify leg runs through the
      // real middleware via the execCliRead seam BEFORE the write chain
      // (spec: full Search→Verify→Order→Pay→Status success).
      const readSpy = createReadCliSpy();
      readSpy.script('environment use', { status: 'success' });
      readSpy.script('search --origin', {
        status: 'success', code: 'FLIGHT_SEARCHED',
        data: { search_id: 'srch_sandbox_1' },
      });
      readSpy.script('offer list', {
        status: 'success', code: 'OFFERS_LISTED',
        data: {
          offers: [{
            offer_id: 'off_sandbox_1',
            segments: [
              { departure_airport: 'KUL', arrival_airport: 'HAN' },
            ],
          }],
        },
      });
      readSpy.script('offer verify', {
        status: 'success', code: 'OFFER_VERIFIED',
        data: {
          booking_id: 'bk_happy',
          travelers: [{ traveler_id: 't1', passenger_type: 'ADT' }],
        },
      });
      const readMw = createAtlasProxyMiddleware(APPROVED_ENV, { execCliRead: readSpy });
      const searchRes = await callMiddleware(readMw, 'POST', '/api/atlas/search', {
        origin: 'KUL', destination: 'HAN', depart: '2026-09-15', adults: 1, currency: 'USD',
      });
      assertEqual(searchRes._status, 200, 'mocked Search → 200');
      assertEqual(searchRes.getJson()?.searchId, 'srch_sandbox_1', 'mocked Search surfaces searchId');
      assert((searchRes.getJson()?.offerCount ?? 0) >= 1, 'mocked Search returns at least one route-matched offer');
      assertEqual(searchRes.getJson()?.offers?.[0]?.offer_id, 'off_sandbox_1', 'offer id surfaced through the read path');
      const verifyRes = await callMiddleware(readMw, 'POST', '/api/atlas/verify', { offerId: 'off_sandbox_1' });
      assertEqual(verifyRes._status, 200, 'mocked Verify → 200');
      assertEqual(verifyRes.getJson()?.status, 'success', 'mocked Verify status success');
      assertEqual(verifyRes.getJson()?.data?.booking_id, 'bk_happy', 'mocked Verify yields the booking id used by the write chain');
      assertEqual(readSpy.calls.length, 4, 'Search(3 CLI calls) + Verify(1 CLI call) = 4 read invocations');

      step(clock);
      const tokH = await issueOrderToken(handler, 'bk_happy');
      spy.script(cliEnvelope({
        status: 'success',
        code: 'PAYMENT_CONFIRMATION_REQUIRED',
        orderNo: 'ORD-HAPPY-1',
        confirmationId: 'conf-happy-1',
      }));
      const orderRes = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_happy', confirmationToken: tokH, idempotencyKey: 'idem_happy_order',
      });
      assertEqual(orderRes._status, 200, 'order create → 200');
      assertEqual(orderRes.getJson()?.outcome, 'accepted', 'order outcome accepted (PAYMENT_CONFIRMATION_REQUIRED)');
      assertEqual(orderRes.getJson()?.orderNo, 'ORD-HAPPY-1', 'orderNo extracted via multi-key array');
      assertEqual(orderRes.getJson()?.providerCode, 'PAYMENT_CONFIRMATION_REQUIRED', 'provider code surfaced');
      assert(spy.calls[0].args.join(' ').includes('order create --booking-id bk_happy --passengers-stdin --json'), 'exact order create CLI args');
      assertEqual(spy.calls[0].opts.timeoutMs, 20_000, 'order create 20s timeout');
      const stdinParsed = JSON.parse(spy.calls[0].stdin);
      assertEqual(stdinParsed?.passengers?.[0]?.given_name, 'TESTTRAVELER', 'synthetic passenger delivered via stdin');
      assert(!JSON.stringify(orderRes.getJson()).includes('conf-happy-1'), 'confirmationId NEVER sent to the browser');

      step(clock);
      const payTokH = await issuePayToken(handler, 'ORD-HAPPY-1');
      spy.script(cliEnvelope({ status: 'success', code: 'PAYMENT_ACCEPTED' }));
      const payRes = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-HAPPY-1', confirmationToken: payTokH, idempotencyKey: 'idem_happy_pay',
      });
      assertEqual(payRes.getJson()?.outcome, 'accepted', 'pay outcome accepted (PAYMENT_ACCEPTED)');
      const payArgs = spy.calls[spy.calls.length - 1].args;
      assert(payArgs.join(' ').includes('order pay --confirmation-id conf-happy-1 --json'), 'pay uses the SERVER-held confirmation id');
      const payCallsAfterAccepted = spy.countFor('pay');
      // Fix-round WARNING-5: same-key replay AFTER an accepted pay returns
      // the stored accepted response (the idempotency touch runs BEFORE
      // the paidOrders 409 guard).
      const payReplay = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-HAPPY-1', confirmationToken: 'tok_pad_happy_replay_xxxxxxxxxx', idempotencyKey: 'idem_happy_pay',
      });
      assertEqual(payReplay._status, 200, 'same-key replay after accepted pay → 200 stored response (not 409)');
      assertEqual(payReplay.getJson()?.replayed, true, 'replayed accepted pay marked replayed:true');
      assertEqual(payReplay.getJson()?.outcome, 'accepted', 'replayed body keeps the accepted outcome');
      assertEqual(spy.countFor('pay'), payCallsAfterAccepted, 'same-key replay executes no pay CLI call');
      // A GENUINELY NEW key for the already-paid orderNo → 409 suppressed.
      step(clock);
      const payTokDup = await issuePayToken(handler, 'ORD-HAPPY-1');
      const dupFresh = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-HAPPY-1', confirmationToken: payTokDup, idempotencyKey: 'idem_happy_pay_dup',
      });
      assertEqual(dupFresh._status, 409, 'fresh key after accepted pay → 409 duplicate suppressed');
      assertEqual(dupFresh.getJson()?.error, 'payment_duplicate_suppressed', 'duplicate suppression error code');
      assertEqual(spy.countFor('pay'), payCallsAfterAccepted, 'fresh-key duplicate suppression executes no pay CLI call');

      step(clock);
      // No top-level `status` key here: the status extractor's first
      // candidate key is `status`, which would otherwise shadow the
      // real order-status field during BFS extraction.
      spy.script(cliEnvelope({ order_status: 'TICKETED' }));
      const statusRes = await callHandler(handler, '/api/atlas/sandbox/status', { orderNo: 'ORD-HAPPY-1' });
      assertEqual(statusRes._status, 200, 'status → 200');
      assertEqual(statusRes.getJson()?.status, 'ticketed-simulated', 'raw TICKETED normalized to the AtlasSandboxOrderStatus union');
      assertEqual(statusRes.getJson()?.cliCode, 'TICKETED', 'raw CLI code retained for provenance (cliCode)');
      assertEqual(statusRes.getJson()?.terminal, true, 'TICKETED is terminal');
      assertEqual(spy.calls.length, 3, 'full chain = exactly 3 CLI invocations (order, pay, status)');

      // 5b. PRICE_CONFIRMATION_REQUIRED surfaces as an explicit order rejection.
      step(clock);
      const tokP = await issueOrderToken(handler, 'bk_price');
      spy.script(cliEnvelope({
        status: 'error', code: 'PRICE_CONFIRMATION_REQUIRED',
        message: 'price changed — confirmation required',
      }, { exitCode: 1 }));
      const priceRes = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_price', confirmationToken: tokP, idempotencyKey: 'idem_price',
      });
      assertEqual(priceRes._status, 502, 'PRICE_CONFIRMATION_REQUIRED → 502 order_rejected');
      assertEqual(priceRes.getJson()?.error, 'order_rejected', 'price confirmation error shape');
      assertEqual(priceRes.getJson()?.providerCode, 'PRICE_CONFIRMATION_REQUIRED', 'price confirmation code preserved');

      // 5c. OFFER_EXPIRED → order creation failure.
      step(clock);
      const tokOe = await issueOrderToken(handler, 'bk_offer_expired');
      spy.script(cliEnvelope({
        status: 'error', code: 'OFFER_EXPIRED', message: 'offer expired',
      }, { exitCode: 1 }));
      const oeRes = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_offer_expired', confirmationToken: tokOe, idempotencyKey: 'idem_oe',
      });
      assertEqual(oeRes._status, 502, 'OFFER_EXPIRED → 502');
      assertEqual(oeRes.getJson()?.error, 'order_rejected', 'OFFER_EXPIRED error shape');
      assertEqual(oeRes.getJson()?.providerCode, 'OFFER_EXPIRED', 'OFFER_EXPIRED code preserved');

      // 5d. Invalid bookingId → order creation failure (502 order_rejected).
      step(clock);
      const tokIb = await issueOrderToken(handler, 'bk-invalid-@@');
      spy.script(cliEnvelope({
        status: 'error', code: 'INVALID_BOOKING_ID', message: 'booking not found',
      }, { exitCode: 1 }));
      const ibRes = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk-invalid-@@', confirmationToken: tokIb, idempotencyKey: 'idem_ib',
      });
      assertEqual(ibRes._status, 502, 'invalid bookingId upstream → 502');
      assertEqual(ibRes.getJson()?.error, 'order_rejected', 'invalid bookingId error shape');
      assertEqual(ibRes.getJson()?.providerCode, 'INVALID_BOOKING_ID', 'invalid bookingId code preserved');

      // 5e. PAYMENT_BALANCE_CHECK_REQUIRED → payment-blocked, never re-pay.
      step(clock);
      const tokB5 = await issueOrderToken(handler, 'bk_balance');
      spy.script(cliEnvelope({
        status: 'success', code: 'PAYMENT_CONFIRMATION_REQUIRED',
        order_number: 'ORD-BALANCE', pay_confirmation_id: 'conf-balance',
      }));
      await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_balance', confirmationToken: tokB5, idempotencyKey: 'idem_b5_order',
      });
      step(clock);
      const payTokB = await issuePayToken(handler, 'ORD-BALANCE');
      const payCallsBeforeBalance = spy.countFor('pay');
      spy.script(cliEnvelope({
        status: 'error', code: 'PAYMENT_BALANCE_CHECK_REQUIRED', message: 'balance check required',
      }, { exitCode: 1 }));
      const balanceRes = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-BALANCE', confirmationToken: payTokB, idempotencyKey: 'idem_b5_pay',
      });
      assertEqual(balanceRes._status, 502, 'PAYMENT_BALANCE_CHECK_REQUIRED → 502 pay_rejected');
      assertEqual(balanceRes.getJson()?.error, 'pay_rejected', 'payment-blocked error shape');
      const balanceReplay = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-BALANCE', confirmationToken: 'tok_pad_balance_replay_xxxxxxxxx', idempotencyKey: 'idem_b5_pay',
      });
      assertEqual(balanceReplay.getJson()?.replayed, true, 'blocked pay replays — never re-pay');
      assertEqual(spy.countFor('pay') - payCallsBeforeBalance, 1, 'exactly one pay CLI call for the blocked order');

      // 5f. 3DS-style rejection.
      step(clock);
      const tok3ds = await issueOrderToken(handler, 'bk_3ds');
      spy.script(cliEnvelope({
        status: 'success', code: 'PAYMENT_CONFIRMATION_REQUIRED',
        orderID: 'ORD-3DS', confirmation_id: 'conf-3ds',
      }));
      await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_3ds', confirmationToken: tok3ds, idempotencyKey: 'idem_3ds_order',
      });
      step(clock);
      const payTok3 = await issuePayToken(handler, 'ORD-3DS');
      spy.script(cliEnvelope({
        status: 'error', code: 'THREE_DS_AUTHENTICATION_FAILED', message: '3DS challenge required',
      }, { exitCode: 1 }));
      const tdsRes = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-3DS', confirmationToken: payTok3, idempotencyKey: 'idem_3ds_pay',
      });
      assertEqual(tdsRes._status, 502, '3DS-style rejection → 502');
      assertEqual(tdsRes.getJson()?.error, 'pay_rejected', '3DS rejection error shape');
      assertEqual(tdsRes.getJson()?.providerCode, 'THREE_DS_AUTHENTICATION_FAILED', '3DS code preserved');

      // 5g. Pay timeout → poll-only unknown (never re-pay).
      step(clock);
      const tokPt = await issueOrderToken(handler, 'bk_paytimeout');
      spy.script(cliEnvelope({
        status: 'success', code: 'PAYMENT_CONFIRMATION_REQUIRED',
        order_id: 'ORD-PAYTIMEOUT', payConfirmationId: 'conf-paytimeout',
      }));
      await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_paytimeout', confirmationToken: tokPt, idempotencyKey: 'idem_pt_order',
      });
      step(clock);
      const payTokT = await issuePayToken(handler, 'ORD-PAYTIMEOUT');
      const payCallsBeforeTimeout = spy.countFor('pay');
      spy.script(CLI_TIMEOUT_RESULT.value);
      const ptRes = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-PAYTIMEOUT', confirmationToken: payTokT, idempotencyKey: 'idem_pt_pay',
      });
      assertEqual(ptRes._status, 200, 'pay timeout → 200 unknown (never 500, never success)');
      assertEqual(ptRes.getJson()?.outcome, 'unknown', 'pay timeout outcome unknown');
      assertEqual(ptRes.getJson()?.reason, 'pay_timed_out', 'pay timeout reason');
      const ptReplay = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-PAYTIMEOUT', confirmationToken: 'tok_pad_pt_replay_xxxxxxxxxxxxxx', idempotencyKey: 'idem_pt_pay',
      });
      assertEqual(ptReplay.getJson()?.replayed, true, 'timed-out pay replays on retry — poll-only');
      assertEqual(spy.countFor('pay') - payCallsBeforeTimeout, 1, 'pay timeout never triggers a second pay call');

      // 5h. Duplicate pay (pre-paid index seam).
      step(clock);
      const paidOrders = new Map([['ORD-PREPAID', { payKey: 'pk_pre', paidAt: 0 }]]);
      const dupHandler = createSandboxWriteHandler(APPROVED_ENV, createCountingCliSpy(), { now: clock.now, paidOrders, evidenceSink: noopEvidenceSink });
      const dupTok = await issuePayToken(dupHandler, 'ORD-PREPAID');
      const dupRes = await callHandler(dupHandler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-PREPAID', confirmationToken: dupTok, idempotencyKey: 'idem_dup_paid',
      });
      assertEqual(dupRes._status, 409, 'duplicate pay for a paid orderNo → 409');
      assertEqual(dupRes.getJson()?.error, 'payment_duplicate_suppressed', 'duplicate pay suppressed');

      // 5i. Polling timeout — status reads stay unknown/non-terminal and
      // eventually stop (the panel budget maps unknown → safely-stopped).
      step(clock);
      spy.script(CLI_TIMEOUT_RESULT.value, CLI_TIMEOUT_RESULT.value);
      const poll1 = await callHandler(handler, '/api/atlas/sandbox/status', { orderNo: 'ORD-PAYTIMEOUT' });
      assertEqual(poll1.getJson()?.status, 'unknown', 'status timeout poll 1 → unknown');
      assertEqual(poll1.getJson()?.terminal, false, 'status timeout poll 1 non-terminal');
      assertEqual(poll1.getJson()?.reason, 'status_timed_out', 'status timeout reason');
      const poll2 = await callHandler(handler, '/api/atlas/sandbox/status', { orderNo: 'ORD-PAYTIMEOUT' });
      assertEqual(poll2.getJson()?.status, 'unknown', 'status timeout poll 2 → unknown (budget would stop here)');

      // 5j. ORDER_CANCELLED normalizes to 'cancelled' (terminal) with the
      // raw CLI code retained for provenance (fix-round WARNING-3).
      step(clock);
      spy.script(cliEnvelope({ orderStatus: 'ORDER_CANCELLED' }));
      const cancelRes = await callHandler(handler, '/api/atlas/sandbox/status', { orderNo: 'ORD-PAYTIMEOUT' });
      assertEqual(cancelRes.getJson()?.status, 'cancelled', 'ORDER_CANCELLED normalized to cancelled');
      assertEqual(cancelRes.getJson()?.cliCode, 'ORDER_CANCELLED', 'raw CLI code retained (cliCode)');
      assertEqual(cancelRes.getJson()?.terminal, true, 'ORDER_CANCELLED is terminal');

      // Known non-terminal named codes normalize without becoming terminal.
      spy.script(cliEnvelope({ orderStatus: 'PAYMENT_PENDING' }));
      const unpaidRes = await callHandler(handler, '/api/atlas/sandbox/status', { orderNo: 'ORD-PAYTIMEOUT' });
      assertEqual(unpaidRes.getJson()?.status, 'unpaid', 'PAYMENT_PENDING normalized to unpaid');
      assertEqual(unpaidRes.getJson()?.terminal, false, 'unpaid status non-terminal');
      spy.script(cliEnvelope({ orderStatus: 'TICKETING' }));
      const ticketingRes = await callHandler(handler, '/api/atlas/sandbox/status', { orderNo: 'ORD-PAYTIMEOUT' });
      assertEqual(ticketingRes.getJson()?.status, 'ticketing', 'TICKETING normalized to ticketing');
      assertEqual(ticketingRes.getJson()?.terminal, false, 'ticketing status non-terminal');

      // Numeric status codes stay unknown/non-terminal (BLOCKED semantics).
      spy.script(cliEnvelope({ state: '2' }));
      const numericRes = await callHandler(handler, '/api/atlas/sandbox/status', { orderNo: 'ORD-PAYTIMEOUT' });
      assertEqual(numericRes.getJson()?.status, 'unknown', 'numeric status code normalized to unknown');
      assertEqual(numericRes.getJson()?.terminal, false, 'numeric status code never terminal');

      // 5k. Malformed upstream (unparsable stdout) → unknown.
      step(clock);
      const tokMu = await issueOrderToken(handler, 'bk_malformed');
      // Exit 0 but unparseable stdout: the executor resolves a
      // parseable-but-null envelope, so the result is `unknown`.
      spy.script(cliEnvelope(null, { exitCode: 0, stderr: 'not-json' }));
      const muRes = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_malformed', confirmationToken: tokMu, idempotencyKey: 'idem_mu',
      });
      assertEqual(muRes._status, 200, 'malformed upstream → 200 unknown');
      assertEqual(muRes.getJson()?.outcome, 'unknown', 'malformed outcome unknown');
      assertEqual(muRes.getJson()?.reason, 'order_create_response_unparsable', 'malformed reason');

      // 5l. Upstream config error: CLI THROWS (crash) → 502.
      step(clock);
      const tokCe = await issueOrderToken(handler, 'bk_config_error');
      spy.script(Promise.reject(new Error('atlas-flight: configuration error')));
      const ceRes = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_config_error', confirmationToken: tokCe, idempotencyKey: 'idem_ce',
      });
      assertEqual(ceRes._status, 502, 'upstream config error (CLI crash) → 502');
      assertEqual(ceRes.getJson()?.error, 'order_execution_error', 'CLI crash error shape');
      assert(String(ceRes.getJson()?.message).includes('configuration error'), 'sanitized config error message preserved');

      // Exit-nonzero transport failure with NO provider envelope: the
      // single-shot executor still resolves, and an unparseable outcome
      // stays `unknown` (never success, never retry).
      step(clock);
      const tokTf = await issueOrderToken(handler, 'bk_transport');
      spy.script(cliEnvelope(null, { exitCode: 1, stderr: 'upstream unreachable' }));
      const tfRes = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_transport', confirmationToken: tokTf, idempotencyKey: 'idem_tf',
      });
      assertEqual(tfRes._status, 200, 'transport failure → 200 unknown (fail closed, no retry)');
      assertEqual(tfRes.getJson()?.outcome, 'unknown', 'transport failure outcome unknown');
      assertEqual(tfRes.getJson()?.reason, 'order_create_response_unparsable', 'transport failure reason');

      // Pay without any server-held confirmation id fails closed with no CLI call.
      step(clock);
      const orphanTok = await issuePayToken(handler, 'ORD-NEVER-CREATED');
      const cliBefore = spy.calls.length;
      const orphanRes = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-NEVER-CREATED', confirmationToken: orphanTok, idempotencyKey: 'idem_orphan',
      });
      assertEqual(orphanRes._status, 502, 'pay without server-held confirmation id → 502');
      assertEqual(orphanRes.getJson()?.error, 'confirmation_id_unavailable', 'confirmation id unavailable code');
      assertEqual(spy.calls.length, cliBefore, 'no CLI call for a confirmation-id-less pay');
    }

    /* ══ 6. ZERO-RETRY ASSERTION ══ */
    section('6. Zero-retry — CLI invocation counters per operation === 1');
    {
      const clock = makeClock();
      const spy = createCountingCliSpy();
      const handler = createSandboxWriteHandler(APPROVED_ENV, spy, { now: clock.now, evidenceSink: noopEvidenceSink });

      step(clock);
      const tok = await issueOrderToken(handler, 'bk_zeroretry');
      spy.script(cliEnvelope({
        status: 'success', code: 'PAYMENT_CONFIRMATION_REQUIRED',
        orderNo: 'ORD-ZR', confirmationId: 'conf-zr',
      }));
      await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_zeroretry', confirmationToken: tok, idempotencyKey: 'idem_zr_order',
      });
      step(clock);
      const payTok = await issuePayToken(handler, 'ORD-ZR');
      spy.script(cliEnvelope({ status: 'success', code: 'PAYMENT_ACCEPTED' }));
      await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ORD-ZR', confirmationToken: payTok, idempotencyKey: 'idem_zr_pay',
      });
      step(clock);
      spy.script(cliEnvelope({ order_state: 'TICKET_ISSUED' }));
      await callHandler(handler, '/api/atlas/sandbox/status', { orderNo: 'ORD-ZR' });

      assertEqual(spy.countFor('create'), 1, 'order create invocations === 1 (single shot)');
      assertEqual(spy.countFor('pay'), 1, 'order pay invocations === 1 (single shot)');
      assertEqual(spy.countFor('status'), 1, 'order status invocations === 1 (single flight)');
      assertEqual(spy.calls.length, 3, 'total CLI invocations across the flow === 3');
    }

    /* ══ 7. EVIDENCE REDACTION ══ */
    section('7. Evidence redaction — temp evidenceDir JSONL stays secret-free');
    {
      const evidenceDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'stitchcheck-atlas-ev-'));
      tempDirs.push(evidenceDir);
      const clock = makeClock();
      const spy = createCountingCliSpy();
      const handler = createSandboxWriteHandler(APPROVED_ENV, spy, { now: clock.now, evidenceDir });

      step(clock);
      const tok = await issueOrderToken(handler, 'bk_evidence');
      spy.script(cliEnvelope({
        status: 'success', code: 'PAYMENT_CONFIRMATION_REQUIRED',
        orderNo: 'ORD-EVIDENCE', confirmationId: 'conf-evidence',
      }));
      await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_evidence', confirmationToken: tok, idempotencyKey: 'idem_evidence_ok',
      });
      // A forbidden-field rejection also produces an evidence line.
      await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_evidence', cardNumber: '4111111111111111',
        confirmationToken: 'tok_pad_evidence_xxxxxxxxxxxxxxxxx', idempotencyKey: 'idem_evidence_bad',
      });

      const fileName = await waitForEvidenceFileName(evidenceDir);
      assert(fileName !== null, 'exactly one evidence JSONL file created in the temp dir');
      const content = fileName
        ? await waitForEvidenceFile(path.join(evidenceDir, fileName), 2)
        : '';
      const lines = content.split('\n').filter(Boolean);
      assert(lines.length >= 2, 'evidence drained: one line per outcome (accepted + gate/input rejection)');
      const outcomes = lines.map((l) => JSON.parse(l).outcome);
      assert(outcomes.includes('accepted'), 'accepted order outcome recorded');
      assert(outcomes.includes('browser_input_rejected'), 'browser-input rejection recorded');
      for (const line of lines) {
        assertEqual(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(line), false, 'no email survives redaction');
        assertEqual(/https?:\/\//.test(line), false, 'no URL survives redaction');
        assertEqual(/Bearer\s+/i.test(line), false, 'no Bearer token survives redaction');
        assertEqual(/sk-[a-zA-Z0-9]{10,}/.test(line), false, 'no sk- secret survives redaction');
        assertEqual(/\b(?:\d[ -]?){12,18}\d\b/.test(line), false, 'no PAN-like digit run survives redaction');
        assertEqual(/"(?:cvv|cvc|security_?code)"\s*:\s*"\d+"/i.test(line), false, 'no CVV value survives redaction');
        assertEqual(line.includes('TESTTRAVELER'), false, 'no passenger payload survives redaction');
        assertEqual(line.includes('SYNTHETIC00000001'), false, 'no document number survives redaction');
        assertEqual(line.includes('conf-evidence'), false, 'server-held confirmationId never lands in evidence');
        assertEqual(line.includes('idem_evidence_ok'), false, 'raw idempotency key never lands in evidence (hash only)');
      }
      const acceptedLine = lines.map((l) => JSON.parse(l)).find((r) => r.outcome === 'accepted');
      assert(acceptedLine !== undefined, 'accepted evidence line present');
      assertEqual(typeof acceptedLine?.idempotencyKeyHash, 'string', 'idempotency key present only as hash');
      assertEqual(acceptedLine?.orderNo, 'ORD-EVIDENCE', 'opaque orderNo retained (not sensitive)');
      assertEqual(acceptedLine?.environment, 'sandbox', 'evidence environment sandbox');

      // Fix-round redaction hardening — direct unit assertions on the
      // exported redactor (PAN long runs, unquoted/cvv2 CVV, doc numbers).
      const red20 = redactForEvidence({ n: '411111111111111122223333' });
      assertEqual(JSON.stringify(red20).includes('[REDACTED-PAN]'), true, '24-digit PAN run fully redacted');
      assertEqual(/\d{13,}/.test(JSON.stringify(red20)), false, 'no ≥13-digit run survives PAN redaction');
      const redSpaced = redactForEvidence({ n: '4111 1111 1111 1111' });
      assertEqual(JSON.stringify(redSpaced).includes('[REDACTED-PAN]'), true, 'space-separated 16-digit PAN redacted');
      const redCvvUnquoted = redactForEvidence({ cvv: 123 });
      assertEqual(JSON.stringify(redCvvUnquoted).includes('123'), false, 'unquoted numeric cvv redacted');
      const redCvv2 = redactForEvidence({ cvv2: '999' });
      assertEqual(JSON.stringify(redCvv2).includes('999'), false, 'cvv2-style key redacted');
      const redDoc1 = redactForEvidence({ document_number: 'A1234567' });
      assertEqual(JSON.stringify(redDoc1).includes('A1234567'), false, 'single-letter-prefix document number redacted');
      const redDoc2 = redactForEvidence({ document_number: 'JP12345678' });
      assertEqual(JSON.stringify(redDoc2).includes('JP12345678'), false, 'alphanumeric-prefix document number redacted');

      // Status normalization unit assertions (fix-round WARNING-3).
      assertEqual(normalizeSandboxOrderStatus('TICKETED').status, 'ticketed-simulated', 'TICKETED → ticketed-simulated');
      assertEqual(normalizeSandboxOrderStatus('TICKETED').terminal, true, 'TICKETED terminal');
      assertEqual(normalizeSandboxOrderStatus('TICKET_ISSUED').status, 'ticketed-simulated', 'TICKET_ISSUED → ticketed-simulated');
      assertEqual(normalizeSandboxOrderStatus('ORDER_CANCELLED').status, 'cancelled', 'ORDER_CANCELLED → cancelled');
      assertEqual(normalizeSandboxOrderStatus('ORDER_CANCELLED').terminal, true, 'ORDER_CANCELLED terminal');
      assertEqual(normalizeSandboxOrderStatus('PAYMENT_PENDING').status, 'unpaid', 'PAYMENT_PENDING → unpaid');
      assertEqual(normalizeSandboxOrderStatus('TICKETING').status, 'ticketing', 'TICKETING → ticketing');
      assertEqual(normalizeSandboxOrderStatus('2').status, 'unknown', 'numeric code → unknown');
      assertEqual(normalizeSandboxOrderStatus('2').terminal, false, 'numeric code non-terminal');
      assertEqual(normalizeSandboxOrderStatus(null).status, 'unknown', 'null → unknown');
    }

    /* ══ 8. STATE MACHINE UNIT TESTS (core, direct .ts import) ══ */
    section('8. State machine — core/simulation/sandbox-order-states.ts');
    {
      const CONF = { confirmationToken: 'tok_sm_1', idempotencyKey: 'idem_sm_1' };
      assertEqual(getInitialState(), 'hidden', 'initial state is hidden');
      assertEqual(transition('hidden', { type: 'opt-in' }), 'opt-in', 'hidden + opt-in → opt-in');
      assertEqual(transition('hidden', { type: 'submit-order', ...CONF }), null, 'hidden forbids submit-order (fail closed)');
      assertEqual(transition('opt-in', { type: 'reset' }), 'order-review', 'opt-in + reset → order-review');
      assertEqual(transition('order-review', { type: 'submit-order', ...CONF }), 'order-submitting', 'order-review + submit-order → order-submitting');
      assertEqual(transition('order-submitting', { type: 'order-accepted', orderNo: 'ORD-SM' }), 'order-created-unpaid', 'order-accepted → order-created-unpaid');
      assertEqual(transition('order-created-unpaid', { type: 'review-payment' }), 'payment-review', 'review-payment → payment-review');
      assertEqual(transition('payment-review', { type: 'submit-pay', ...CONF }), 'payment-submitting', 'payment-review + submit-pay → payment-submitting');
      assertEqual(transition('payment-submitting', { type: 'pay-accepted' }), 'pay-accepted', 'pay-accepted outcome');
      assertEqual(transition('pay-accepted', { type: 'start-polling' }), 'status-polling', 'start-polling → status-polling');
      assertEqual(transition('status-polling', { type: 'status-ticketed-simulated' }), 'ticketed-simulated', 'polling → ticketed-simulated');
      assertEqual(transition('status-polling', { type: 'poll-budget-exhausted' }), 'safely-stopped', 'budget exhausted → safely-stopped');

      // Terminal states accept NO write events.
      for (const terminal of SANDBOX_TERMINAL_STATES) {
        assertEqual(isTerminalState(terminal), true, `${terminal} is terminal`);
        assertEqual(transition(terminal, { type: 'submit-order', ...CONF }), null, `${terminal} forbids submit-order`);
        assertEqual(transition(terminal, { type: 'submit-pay', ...CONF }), null, `${terminal} forbids submit-pay`);
      }
      // The hard terminals additionally accept no reset at all.
      for (const terminal of ['ticketed-simulated', 'cancelled']) {
        assertEqual(transition(terminal, { type: 'reset' }), null, `${terminal} forbids reset`);
      }
      // safely-stopped keeps read-only status checks + manual reset only.
      assertEqual(transition('safely-stopped', { type: 'status-check' }), 'safely-stopped', 'safely-stopped manual status re-checks allowed');
      assertEqual(transition('safely-stopped', { type: 'submit-pay', ...CONF }), null, 'safely-stopped never allows a write');

      // Unknown-outcome states: read-only checks + reset only, NO retry.
      for (const s of ['unknown-create', 'unknown-pay']) {
        assertEqual(transition(s, { type: 'status-check' }), s, `${s} + status-check stays (read-only)`);
        assertEqual(transition(s, { type: 'submit-order', ...CONF }), null, `${s} forbids submit-order retry`);
        assertEqual(transition(s, { type: 'submit-pay', ...CONF }), null, `${s} forbids submit-pay retry`);
      }

      // Stale idempotency keys invalidate write events.
      assertEqual(
        transition('order-review', { type: 'submit-order', ...CONF }, { usedIdempotencyKeys: ['idem_sm_1'] }),
        null,
        'reused idempotency key makes a write event stale (null)',
      );

      // canAttemptWrite gating.
      assertEqual(canAttemptWrite('order-review', 'order'), true, 'order writable only from order-review');
      assertEqual(canAttemptWrite('payment-review', 'pay'), true, 'pay writable only from payment-review');
      assertEqual(canAttemptWrite('opt-in', 'order'), false, 'no write from opt-in');
      assertEqual(canAttemptWrite('unknown-pay', 'pay'), false, 'no write from unknown-pay');

      // mapProviderOutcome: numeric/unknown/empty → unknown, never success.
      assertEqual(mapProviderOutcome('order', 'PAYMENT_CONFIRMATION_REQUIRED'), 'accepted', 'known order code → accepted');
      assertEqual(mapProviderOutcome('pay', 'PAYMENT_ACCEPTED'), 'accepted', 'known pay code → accepted');
      assertEqual(mapProviderOutcome('order', 'DUPLICATE_BOOKING_SUSPECTED'), 'accepted', 'duplicate-suspected adopts existing order');
      assertEqual(mapProviderOutcome('order', '1'), 'unknown', 'numeric code → unknown');
      assertEqual(mapProviderOutcome('pay', '-3'), 'unknown', 'negative numeric code → unknown');
      assertEqual(mapProviderOutcome('order', ''), 'unknown', 'empty code → unknown');
      assertEqual(mapProviderOutcome('order', null), 'unknown', 'null code → unknown');
      assertEqual(mapProviderOutcome('order', 2), 'unknown', 'non-string numeric code → unknown');
      assertEqual(mapProviderOutcome('order', 'TOTALLY_UNKNOWN_CODE'), 'unknown', 'unrecognized code → unknown');
    }

    /* ══ 9. REGRESSION PRESERVATION (unapproved env) ══ */
    section('9. Regression — unapproved env stays 503 with CLI spy count 0');
    {
      const clock = makeClock();
      const spy = createCountingCliSpy();
      const handler = createSandboxWriteHandler(PASS_ENV, spy, { now: clock.now, evidenceSink: noopEvidenceSink });

      step(clock);
      const tok = await issueOrderToken(handler, 'bk_regress');
      const orderRes = await callHandler(handler, '/api/atlas/sandbox/order', {
        bookingId: 'bk_regress', confirmationToken: tok, idempotencyKey: 'idem_regress_order',
      });
      assertEqual(orderRes._status, 503, 'unapproved order → 503');
      assertEqual(orderRes.getJson()?.error, 'sandbox_write_not_implemented', 'legacy 503 error code preserved');

      step(clock);
      const payTok = await issuePayToken(handler, 'ord_regress');
      const payRes = await callHandler(handler, '/api/atlas/sandbox/pay', {
        orderNo: 'ord_regress', confirmationToken: payTok, idempotencyKey: 'idem_regress_pay',
      });
      assertEqual(payRes._status, 503, 'unapproved pay → 503');
      assertEqual(payRes.getJson()?.error, 'sandbox_write_not_implemented', 'legacy pay error code preserved');

      const statusRes = await callHandler(handler, '/api/atlas/sandbox/status', { orderNo: 'ord_regress' });
      assertEqual(statusRes._status, 200, 'status scaffold responds 200');
      assertEqual(statusRes.getJson()?.status, 'unknown', 'status scaffold reports unknown');
      assertEqual(statusRes.getJson()?.scaffold, true, 'status scaffold marks scaffold:true');

      assertEqual(spy.calls.length, 0, 'counting CLI spy invoked 0 times under unapproved env');

      // Capabilities report truthfully in both modes.
      const capsRes = await callHandler(handler, '/api/atlas/sandbox/capabilities', {});
      assertEqual(capsRes.getJson()?.executionApproved, false, 'capabilities executionApproved false (unapproved)');
      assertEqual(capsRes.getJson()?.writeExecution, 'disabled_pending_contract_approval', 'legacy writeExecution string preserved');
      const approvedHandler = createSandboxWriteHandler(APPROVED_ENV, createFailingCliSpy(), { now: clock.now, evidenceSink: noopEvidenceSink });
      const approvedCaps = await callHandler(approvedHandler, '/api/atlas/sandbox/capabilities', {});
      assertEqual(approvedCaps.getJson()?.executionApproved, true, 'capabilities executionApproved true (approved)');
      assertEqual(approvedCaps.getJson()?.writeExecution, 'enabled_sandbox_rehearsal', 'approved writeExecution string');
      assert(!/production/i.test(approvedCaps.getJson()?.writeExecution), 'no bare production wording in writeExecution copy');
    }

    /* ══ 10. BROWSER VERIFICATION (static source assertions — no Playwright) ══ */
    section('10. Browser verification — static source assertions');
    {
      const panelSrc = fsSync.readFileSync(
        path.resolve(WORKSPACE_ROOT, 'app/src/components/SandboxOrderPanel.tsx'), 'utf-8');
      const appSrc = fsSync.readFileSync(
        path.resolve(WORKSPACE_ROOT, 'app/src/App.tsx'), 'utf-8');

      // Flag-off invisibility gates present.
      assert(panelSrc.includes('__ATLAS_SANDBOX_WRITES__'), 'panel references the __ATLAS_SANDBOX_WRITES__ compile flag');
      assert(panelSrc.includes("typeof __ATLAS_SANDBOX_WRITES__ !== 'undefined' ? __ATLAS_SANDBOX_WRITES__ : false"), 'compile flag defaults false (fail closed)');
      assert(panelSrc.includes('SANDBOX_WRITES_COMPILE_FLAG === true'), 'eligibility requires compile flag === true');
      assert(panelSrc.includes("DATA_MODE === 'live'"), 'eligibility requires DATA_MODE === live');
      assert(panelSrc.includes("verifyStatus === 'success'"), 'eligibility requires a successful Verify');
      assert(panelSrc.includes("capabilities.sandboxWritesEnabled === true"), 'runtime gate: sandboxWritesEnabled === true');
      assert(panelSrc.includes("capabilities.environment === 'sandbox'"), 'runtime gate: environment === sandbox');
      assert(/if \(!eligible \|\| !runtimeEnabled\)\s*\{\s*return null;\s*\}/.test(panelSrc), 'panel returns null unless every gate passes');
      const guardIndex = panelSrc.indexOf('if (!eligible || !runtimeEnabled)');
      const renderIndex = panelSrc.indexOf('return (\n    <div className="sc-sbx-panel"');
      assert(guardIndex !== -1 && renderIndex !== -1 && guardIndex < renderIndex, 'null-return guard precedes any JSX render');

      // Opt-in checkbox required before any write control unlocks.
      assert(panelSrc.includes('type="checkbox"'), 'an acknowledgement checkbox exists');
      assert(panelSrc.includes('checked={acknowledged}'), 'checkbox bound to acknowledged state');
      assert(panelSrc.includes('if (!acknowledged || busyRef.current) return;'), 'order handler aborts unless acknowledged');

      // Separate Order and Pay confirmations.
      assert(panelSrc.includes("atlasSandboxConfirmIntent({ operation: 'order', bookingId })"), 'order has its own confirm-intent call');
      assert(panelSrc.includes("atlasSandboxConfirmIntent({ operation: 'pay', orderNo })"), 'pay has its own confirm-intent call');
      assert(panelSrc.includes('handleSubmitOrder'), 'dedicated order confirmation handler');
      assert(panelSrc.includes('handleSubmitPay'), 'dedicated pay confirmation handler');

      // No write client call before confirmation handlers.
      const orderCallIndex = panelSrc.indexOf('atlasSandboxOrder(');
      const payCallIndex = panelSrc.indexOf('atlasSandboxPay(');
      const orderHandlerIndex = panelSrc.indexOf('handleSubmitOrder');
      const payHandlerIndex = panelSrc.indexOf('handleSubmitPay');
      assert(orderCallIndex > orderHandlerIndex, 'atlasSandboxOrder invoked only inside its confirmation handler');
      assert(payCallIndex > payHandlerIndex, 'atlasSandboxPay invoked only inside its confirmation handler');
      const effectsRegion = panelSrc.slice(0, orderHandlerIndex);
      assert(!effectsRegion.includes('atlasSandboxOrder(') && !effectsRegion.includes('atlasSandboxPay('), 'no write client call precedes the confirmation handlers');

      // No real-data input controls in the panel.
      assert(!/<input[^>]*type="text"/.test(panelSrc), 'no free-text inputs in the sandbox panel');
      assert(!/<select/.test(panelSrc), 'no select controls in the sandbox panel');
      assert(!/<textarea/.test(panelSrc), 'no textareas in the sandbox panel');

      // Sandbox qualifier copy in every render branch.
      const renderBranches = [
        'hidden', 'opt-in', 'order-review', 'order-submitting', 'order-created-unpaid',
        'payment-review', 'payment-submitting', 'pay-accepted', 'status-polling',
        'ticketed-simulated', 'cancelled', 'gate-rejected', 'cli-error',
        'unknown-create', 'unknown-pay', 'safely-stopped',
      ];
      for (const branch of renderBranches) {
        assert(panelSrc.includes(`state === '${branch}'`), `render branch exists for ${branch}`);
      }
      const renderedRegion = panelSrc.slice(renderIndex);
      assert(/sandbox/i.test(renderedRegion), 'rendered copy carries Sandbox qualifier');
      assert(/test environment only/i.test(renderedRegion), 'rendered copy declares test environment only');
      assert(/simulated/i.test(renderedRegion), 'rendered copy carries simulated qualifier');

      // Refresh-recovery via remount key (App.tsx).
      assert(appSrc.includes('key={`sandbox-panel-${sandboxPanelKey}`}'), 'panel keyed by sandbox-panel- remount key');
      assert(appSrc.includes('const [sandboxPanelKey, setSandboxPanelKey] = useState(0)'), 'sandboxPanelKey state exists');
      assert(appSrc.includes('setSandboxPanelKey((k) => k + 1)'), 'restart bumps the panel remount key');
      assert(panelSrc.includes('cancelledRef.current = true;'), 'unmount cleanup discards in-flight panel work');

      // Disabled-until-activation write buttons.
      assert(panelSrc.includes("disabled={!canAttemptWrite(state, 'order') || !acknowledged || busyRef.current}"), 'order button disabled until activation + acknowledgement');
      assert(panelSrc.includes("disabled={!canAttemptWrite(state, 'pay') || !acknowledged || busyRef.current}"), 'pay button disabled until activation + acknowledgement');

      // No bare "production" wording in the panel copy.
      assert(!/production/i.test(panelSrc), 'panel source contains no bare production wording');

      // Fix-round static assertions: provider-code field alignment and
      // confirm-intent failure surfacing.
      assert(panelSrc.includes("mapProviderOutcome('order', response.providerCode)"), 'order outcome mapped from response.providerCode (fix-round CRITICAL-1)');
      assert(panelSrc.includes("mapProviderOutcome('pay', response.providerCode)"), 'pay outcome mapped from response.providerCode (fix-round CRITICAL-1)');
      assert(panelSrc.includes('try again shortly'), 'confirm-intent failures surface a visible retry note (fix-round WARNING-4)');
    }
  } finally {
    // Drain one macrotask so any fire-and-forget evidence writes to the
    // temp dirs finish before the synchronous cleanup removes them.
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Clean up every temp evidence directory regardless of outcome.
    // Synchronous on purpose: process.exit() below would otherwise
    // truncate the async rm() chain.
    for (const dir of tempDirs) {
      try { fsSync.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
    }
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
