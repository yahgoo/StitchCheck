// Atlas Sandbox write scaffolding (approved spec Sections 3, 4, 7, 8, 13).
//
// FAIL CLOSED BY DESIGN:
//   - This module NEVER spawns the atlas-flight CLI. It does not import
//     node:child_process at all. Order/Pay execution is NOT IMPLEMENTED.
//   - /order and /pay always respond 503 `sandbox_write_not_implemented`
//     even after passing every gate — execution is disabled pending the
//     spec Section 22 contract approval gates.
//   - Every route is gated by a layered gate chain; any failure → 403.
//   - Passenger/payment data is entirely server-owned. Browser-supplied
//     credential/environment/passenger/payment fields are rejected 400.
//
// `execCliImpl` is accepted in the factory signature ONLY as a future /
// test injection seam. The shipped scaffold handlers never call it.
//
// Node built-ins only (node:crypto). Zero new dependencies.

import { createHash, randomBytes } from 'node:crypto';
import { readBody, sendJson, sanitizeError } from './atlas-proxy.mjs';

/* ── Blocked-contract placeholders (spec Section 22 — DO NOT IMPLEMENT) ── */

/** Synthetic passenger stdin contract is BLOCKED pending the first
 *  supervised rehearsal. Nothing may consume passenger data until then. */
export const PASSENGER_CONTRACT_STATUS =
  'BLOCKED_PENDING_SUPERVISED_REHEARSAL';

// Placeholder for the exact synthetic-passenger stdin field names
// (given_name/surname/...). The Skill's passenger-input.md has no
// machine-readable local copy, so field names are intentionally NOT
// finalized here (spec §7 BLOCKED item). When the contract is approved
// after the first supervised rehearsal, only this constant changes.
const PASSENGER_STDIN_FIELD_NAMES = Object.freeze({
  status: PASSENGER_CONTRACT_STATUS,
  fields: null, // BLOCKED — no field names until supervised rehearsal
});

/** ATRIP ticketing activation requires human action in the ATRIP
 *  workspace and is still BLOCKED (spec §22). */
export const ATRIP_TICKETING_ACTIVATION_STATUS =
  'BLOCKED_PENDING_HUMAN_ACTIVATION';

// Placeholder: the payment confirmation-id response field key is BLOCKED
// until the first supervised rehearsal locks it (spec §3.3). Defensive
// extraction keys are intentionally left empty — execution is disabled
// anyway, so nothing ever reads a confirmation id in this scaffolding.
const PAYMENT_CONFIRMATION_ID_FIELD_KEYS = Object.freeze([]);

// Placeholder: numeric status-code semantics (0/1/2/-3) are unverified
// and BLOCKED (spec §3.5). Named codes are authoritative; unknown and
// numeric codes must map to `unknown`, never to a success state.
const NUMERIC_STATUS_CODE_MAPPING = Object.freeze({});

/* ── Constants ── */

/** The only acceptable sandbox base URL (spec §4 gate 4). Exported so
 *  tests reference the constant instead of hardcoding the literal. */
export const REQUIRED_SANDBOX_BASE_URL = 'https://sandbox.atriptech.com/';

/** Confirmation tokens: 120s TTL, single-use, operation+subject bound. */
const TOKEN_TTL_MS = 120_000;
const TOKEN_STORE_CAP = 100;

/** Idempotency records: 30-minute TTL, bounded. */
const IDEMPOTENCY_TTL_MS = 30 * 60_000;
const IDEMPOTENCY_STORE_CAP = 200;

/** Opaque identifiers (bookingId/orderNo/traveler_id/token/key) cap. */
const MAX_ID_LENGTH = 128;
const MAX_TRAVELERS = 9;

/**
 * Execution seam guard. MUST remain `false`. Flipping this constant is
 * out of scope for the scaffolding task and requires the spec §22
 * approval gates (passenger contract, confirmation-id field key, ATRIP
 * ticketing activation, supervised rehearsal) to pass first.
 */
const WRITE_EXECUTION_APPROVED = false;

/** Machine-readable fail-closed response for order/pay. */
const WRITE_NOT_IMPLEMENTED = Object.freeze({
  error: 'sandbox_write_not_implemented',
  message: 'Sandbox write execution is disabled pending contract approval.',
});

/* ── Browser forbidden-field rejection (spec §4 gate 5 / §7) ──
 *
 * The browser must never supply credentials, environment overrides,
 * passenger identity data, contact data, or payment data. Keys are
 * normalized (lowercase, non-alphanumerics stripped) before matching,
 * so `clientId`, `client_id`, and `CLIENT-ID` all match. */

const FORBIDDEN_REQUEST_KEY_PATTERNS = new Set([
  // Credentials / auth
  'clientid', 'clientsecret', 'clientsigningkey', 'apikey', 'apikeys',
  'secret', 'secretkey', 'authorization', 'authheader', 'authtoken',
  'accesstoken', 'token', 'credential', 'credentials',
  // Environment / base URL overrides
  'baseurl', 'environment', 'profile', 'envoverride',
  // Passenger identity
  'passenger', 'passengers', 'passengerdetails', 'passengerinfo',
  'name', 'fullname', 'firstname', 'lastname', 'givenname', 'surname',
  'middlename', 'birthday', 'dateofbirth', 'dob', 'nationality', 'gender',
  'document', 'documentnumber', 'documentno', 'documenttype', 'passport',
  'idcard', 'idnumber',
  // Contact
  'email', 'emailaddress', 'phone', 'phonenumber', 'mobile',
  'mobilenumber', 'contact', 'contactinfo',
  // Payment / card
  'card', 'cardnumber', 'cardno', 'pan', 'cvv', 'cvc', 'cardexpiry',
  'expirydate', 'billingaddress', 'payment', 'paymentmethod',
  'paymentmethodoverride', 'paymenttoken', 'paymentconfirmationid',
  'confirmationid',
]);

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Depth limit sentinel: bodies nested beyond the scan limit are
 *  rejected rather than skipped — the scanner must never fail open. */
const FORBIDDEN_KEY_DEPTH_LIMIT_EXCEEDED = '__depth_limit_exceeded__';

/**
 * Recursively scans a request body for forbidden keys.
 * Returns the offending key name (or the depth-limit sentinel), or null
 * when the body is clean. FAIL CLOSED: content deeper than the scan
 * limit yields the sentinel, so deeply nested forbidden keys (or any
 * unscannable depth) trigger browser_supplied_data_rejected.
 */
function findForbiddenKey(value, depth = 0) {
  if (value === null || typeof value !== 'object') return null;
  if (depth > 8) return FORBIDDEN_KEY_DEPTH_LIMIT_EXCEEDED;
  const isArray = Array.isArray(value);
  const entries = isArray
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value);
  for (const [key, child] of entries) {
    if (!isArray && FORBIDDEN_REQUEST_KEY_PATTERNS.has(normalizeKey(key))) {
      return key;
    }
    const nested = findForbiddenKey(child, depth + 1);
    if (nested) return nested;
  }
  return null;
}

/* ── Gate chain (spec §4, task step order 1–6; input gate per route) ── */

/**
 * Evaluates the environment gates in order. Any failure fails closed.
 * Route/input validation (gate 7) happens inside each handler.
 * @returns {{ ok: boolean, gates: Array<{name:string, ok:boolean, error:string, message:string}>, firstFailure: object|null }}
 */
function evaluateGates(env) {
  const dataMode = env.DATA_MODE || env.VITE_DATA_MODE || 'offline';
  const baseUrl = env.ATLAS_SANDBOX_BASE_URL;

  const gates = [
    {
      name: 'kill_switch',
      ok: env.ATLAS_SANDBOX_WRITES_ENABLED === 'true',
      error: 'sandbox_writes_disabled',
      message: 'Sandbox writes are disabled (ATLAS_SANDBOX_WRITES_ENABLED != true).',
    },
    {
      name: 'live_mode',
      ok: dataMode === 'live',
      error: 'live_mode_not_enabled',
      message: 'Sandbox routes require DATA_MODE=live.',
    },
    {
      name: 'read_only',
      ok: env.ATLAS_LIVE_READ_ONLY === 'true',
      error: 'atlas_live_read_only_not_enabled',
      message: 'Sandbox routes require ATLAS_LIVE_READ_ONLY=true.',
    },
    {
      name: 'sandbox_environment',
      ok: env.ATLAS_ENVIRONMENT === 'sandbox',
      error: 'non_sandbox_environment',
      message: 'Sandbox routes require ATLAS_ENVIRONMENT=sandbox.',
    },
    {
      name: 'production_flag_exclusion',
      ok: env.ATLAS_WRITES_ENABLED !== 'true',
      error: 'production_writes_flag_conflict',
      message: 'Sandbox routes refuse to run while ATLAS_WRITES_ENABLED=true.',
    },
    {
      name: 'sandbox_base_url',
      ok: !baseUrl || baseUrl === REQUIRED_SANDBOX_BASE_URL,
      error: 'non_sandbox_base_url',
      message: 'ATLAS_SANDBOX_BASE_URL must equal the approved sandbox URL exactly.',
    },
  ];

  const firstFailure = gates.find((gate) => !gate.ok) || null;
  return { ok: !firstFailure, gates, firstFailure };
}

/* ── Confirmation-token store (spec §3.2) ──
 *
 * 120s TTL, single-use, bound to operation ('order'|'pay') and subject
 * (bookingId for order, orderNo for pay). Replays and cross-operation
 * misuse are rejected. Bounded with FIFO eviction of the oldest entry. */

function createTokenStore(now) {
  const tokens = new Map();

  function sweep() {
    const t = now();
    for (const [key, entry] of tokens) {
      if (entry.expiresAt <= t) tokens.delete(key);
    }
  }

  function issue(operation, bindingRef) {
    sweep();
    // Bounded storage: evict oldest entries first (Map insertion order).
    while (tokens.size >= TOKEN_STORE_CAP) {
      tokens.delete(tokens.keys().next().value);
    }
    const token = randomBytes(32).toString('hex');
    tokens.set(token, {
      operation,
      bindingRef,
      issuedAt: now(),
      expiresAt: now() + TOKEN_TTL_MS,
    });
    return token;
  }

  function consume(token, operation, bindingRef) {
    sweep();
    const entry = tokens.get(token);
    if (!entry) {
      return { ok: false, error: 'confirmation_token_invalid_or_expired' };
    }
    // Single-use: the token is destroyed on first use, even on misuse,
    // so replays and cross-operation probing cannot succeed.
    tokens.delete(token);
    if (entry.operation !== operation) {
      return { ok: false, error: 'confirmation_token_operation_mismatch' };
    }
    if (entry.bindingRef !== bindingRef) {
      return { ok: false, error: 'confirmation_token_binding_mismatch' };
    }
    return { ok: true };
  }

  /** Stale-Verify invalidation hook (spec §3.2 / §5). */
  function invalidateAll() {
    tokens.clear();
  }

  function size() {
    return tokens.size;
  }

  return { issue, consume, invalidateAll, size };
}

/* ── Idempotency-key store (spec §8) ──
 *
 * Operation-bound keys, in-flight detection, completed-result replay
 * shape, TTL expiration, bounded storage. NO automatic retry semantics:
 * a completed/unknown record is replayed, never re-executed. */

function createIdempotencyStore(now) {
  const records = new Map();

  function sweep() {
    const t = now();
    for (const [key, record] of records) {
      if (record.expiresAt <= t) records.delete(key);
    }
  }

  /**
   * Claims a key for an operation.
   * @returns {{status:'new'|'in_flight'|'operation_mismatch'|'replay', record:object}}
   */
  function touch(key, operation) {
    sweep();
    const existing = records.get(key);
    if (existing) {
      if (existing.operation !== operation) {
        return { status: 'operation_mismatch', record: existing };
      }
      if (existing.state === 'in-flight') {
        return { status: 'in_flight', record: existing };
      }
      return { status: 'replay', record: existing };
    }
    while (records.size >= IDEMPOTENCY_STORE_CAP) {
      records.delete(records.keys().next().value);
    }
    const record = {
      operation,
      state: 'in-flight',
      response: null, // { status, body } once finished
      orderNo: null,
      createdAt: now(),
      expiresAt: now() + IDEMPOTENCY_TTL_MS,
    };
    records.set(key, record);
    return { status: 'new', record };
  }

  function finish(key, state, response, orderNo = null) {
    const record = records.get(key);
    if (record) {
      record.state = state;
      record.response = response;
      record.orderNo = orderNo;
    }
  }

  function size() {
    return records.size;
  }

  return { touch, finish, size };
}

/* ── Evidence record shape builder (spec §13) ──
 *
 * Builds a SAFE synthetic object only — never from a real operation in
 * this scaffolding (no real operation can occur). The parameter list is
 * an explicit allowlist: this builder can NEVER include secrets, auth
 * headers, confirmation tokens, confirmation ids, PAN, CVV, document
 * numbers, passenger payloads, or raw upstream output. */

export function createSandboxEvidenceRecord({
  correlationId = null,
  operation,
  route,
  searchId = null,
  offerId = null,
  bookingId = null,
  orderNo = null,
  providerResponseCode = null,
  outcome,
  idempotencyKey = null,
  latencyMs = 0,
  gateEvaluation = null,
  orderStatusCode = null,
}) {
  return {
    envelopeVersion: 1,
    scaffoldOnly: true,
    correlationId,
    operation,
    route,
    environment: 'sandbox',
    searchId,
    offerId,
    bookingId,
    orderNo,
    providerResponseCode,
    outcome,
    // Hashed only — the raw idempotency key is never stored (spec §13).
    idempotencyKeyHash:
      idempotencyKey === null || idempotencyKey === undefined
        ? null
        : createHash('sha256').update(String(idempotencyKey)).digest('hex').slice(0, 16),
    // Placeholder: the scaffold performs no real upstream call.
    latencyMs,
    // Compact gate result summary (name→ok); never carries secrets.
    gateEvaluation,
    // Placeholder: numeric status-code semantics remain BLOCKED (§3.5).
    orderStatusCode,
    timestamp: new Date().toISOString(),
    noRealBooking: true,
    noRealCharge: true,
    noAirlineTicketIssued: true,
  };
}

/* ── Input validation helpers ── */

function isOpaqueId(value) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= MAX_ID_LENGTH
  );
}

function isValidTravelers(travelers) {
  if (!Array.isArray(travelers)) return false;
  if (travelers.length === 0 || travelers.length > MAX_TRAVELERS) return false;
  return travelers.every(
    (t) =>
      t &&
      typeof t === 'object' &&
      isOpaqueId(t.traveler_id) &&
      typeof t.passenger_type === 'string' &&
      t.passenger_type.trim().length > 0 &&
      t.passenger_type.trim().length <= 32,
  );
}

/* ── Handler factory ── */

/**
 * Creates the Atlas Sandbox write-scaffold route handler.
 *
 * FAIL CLOSED: the returned handler never executes any CLI command.
 * Order/Pay always answer 503 `sandbox_write_not_implemented`.
 *
 * @param {object} env - Environment variables (process.env).
 * @param {Function|null} [execCliImpl] - Future/test injection seam ONLY.
 *   The shipped scaffold handlers never call it.
 * @param {object} [options] - Test seams: `now()` clock, `statusImpl`,
 *   and `paidOrders` (Map injected so offline tests can exercise the
 *   duplicate-payment guard; the scaffold itself never populates it).
 * @returns {Function} (pathname, req, res) => Promise<void>
 */
export function createSandboxWriteHandler(env, execCliImpl = null, options = {}) {
  const now = options.now || (() => Date.now());
  const tokenStore = createTokenStore(now);
  const idempotencyStore = createIdempotencyStore(now);
  const paidOrders = options.paidOrders || new Map(); // orderNo -> { payKey, paidAt }
  const statusImpl = options.statusImpl || null;

  // Deliberately unused by every shipped handler below. Present only so
  // the factory signature reserves the future/test injection seam.
  void execCliImpl;
  void PASSENGER_STDIN_FIELD_NAMES;
  void PAYMENT_CONFIRMATION_ID_FIELD_KEYS;
  void NUMERIC_STATUS_CODE_MAPPING;

  /* ── /capabilities ── */
  function handleCapabilities(res, gateResult) {
    sendJson(res, 200, {
      sandboxWritesEnabled: true, // kill switch already passed above
      environment: 'sandbox',
      writeExecution: 'disabled_pending_contract_approval',
      executionApproved: WRITE_EXECUTION_APPROVED, // always false
      passengerContract: PASSENGER_CONTRACT_STATUS,
      ticketingActivation: ATRIP_TICKETING_ACTIVATION_STATUS,
      gates: Object.fromEntries(gateResult.gates.map((g) => [g.name, g.ok])),
      timestamp: new Date().toISOString(),
    });
  }

  /* ── /confirm-intent ── */
  function handleConfirmIntent(res, body) {
    const { operation, bookingId, orderNo } = body || {};
    if (operation !== 'order' && operation !== 'pay') {
      sendJson(res, 400, {
        error: 'invalid_operation',
        message: "operation must be 'order' or 'pay'",
      });
      return;
    }
    const bindingRef = operation === 'order' ? bookingId : orderNo;
    if (!isOpaqueId(bindingRef)) {
      sendJson(res, 400, {
        error: 'invalid_binding_ref',
        message:
          operation === 'order'
            ? 'bookingId is required (opaque string ≤128 chars)'
            : 'orderNo is required (opaque string ≤128 chars)',
      });
      return;
    }
    // Issuance only — execution remains disabled regardless.
    const confirmationToken = tokenStore.issue(operation, bindingRef.trim());
    sendJson(res, 200, {
      confirmationToken,
      expiresInSeconds: TOKEN_TTL_MS / 1000,
    });
  }

  /* ── /order (fail closed — execution NOT IMPLEMENTED) ── */
  function handleOrder(res, body) {
    const { bookingId, travelers, confirmationToken, idempotencyKey } = body || {};

    if (!isOpaqueId(bookingId)) {
      sendJson(res, 400, {
        error: 'invalid_booking_id',
        message: 'bookingId is required (opaque string ≤128 chars)',
      });
      return;
    }
    if (travelers !== undefined && !isValidTravelers(travelers)) {
      sendJson(res, 400, {
        error: 'invalid_travelers',
        message: 'travelers must be a non-empty array of { traveler_id, passenger_type }',
      });
      return;
    }
    if (!isOpaqueId(confirmationToken)) {
      sendJson(res, 400, {
        error: 'invalid_confirmation_token',
        message: 'confirmationToken is required',
      });
      return;
    }
    if (!isOpaqueId(idempotencyKey)) {
      sendJson(res, 400, {
        error: 'invalid_idempotency_key',
        message: 'idempotencyKey is required',
      });
      return;
    }

    const cleanBookingId = bookingId.trim();

    // Idempotency (operation-bound; no automatic retry semantics).
    const claim = idempotencyStore.touch(idempotencyKey, 'order');
    if (claim.status === 'operation_mismatch') {
      sendJson(res, 400, {
        error: 'idempotency_key_operation_mismatch',
        message: 'idempotency key was issued for a different operation',
      });
      return;
    }
    if (claim.status === 'in_flight') {
      sendJson(res, 409, {
        error: 'idempotency_in_flight',
        message: 'a request with this idempotency key is already in flight',
      });
      return;
    }
    if (claim.status === 'replay') {
      const stored = claim.record.response;
      sendJson(res, stored ? stored.status : 503, {
        ...(stored ? stored.body : WRITE_NOT_IMPLEMENTED),
        replayed: true,
      });
      return;
    }

    // Confirmation token: single-use, bound to operation + bookingId.
    const consumed = tokenStore.consume(confirmationToken, 'order', cleanBookingId);
    if (!consumed.ok) {
      idempotencyStore.finish(idempotencyKey, 'failed', { status: 403, body: { error: consumed.error } });
      sendJson(res, 403, {
        error: consumed.error,
        message: 'confirmation token rejected (expired, replayed, or mismatched)',
      });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // EXECUTION SEAM — BLOCKED: DO NOT IMPLEMENT (spec §22).
    // A future, explicitly approved `atlas-flight order create` call
    // (zero retries, server-owned synthetic passenger via stdin, 20s
    // timeout) would live here. Until every Section 22 gate passes and
    // WRITE_EXECUTION_APPROVED is deliberately flipped by an approved
    // change, this scaffold fails closed and NEVER invokes any CLI.
    // ──────────────────────────────────────────────────────────────────
    if (WRITE_EXECUTION_APPROVED) {
      // Intentionally unreachable in this scaffolding task.
      throw new Error('sandbox_write_execution_not_approved');
    }

    idempotencyStore.finish(idempotencyKey, 'unknown', { status: 503, body: WRITE_NOT_IMPLEMENTED });
    sendJson(res, 503, WRITE_NOT_IMPLEMENTED);
  }

  /* ── /pay (fail closed — execution NOT IMPLEMENTED) ── */
  function handlePay(res, body) {
    const { orderNo, confirmationToken, idempotencyKey } = body || {};

    if (!isOpaqueId(orderNo)) {
      sendJson(res, 400, {
        error: 'invalid_order_no',
        message: 'orderNo is required (opaque string ≤128 chars)',
      });
      return;
    }
    if (!isOpaqueId(confirmationToken)) {
      sendJson(res, 400, {
        error: 'invalid_confirmation_token',
        message: 'confirmationToken is required',
      });
      return;
    }
    if (!isOpaqueId(idempotencyKey)) {
      sendJson(res, 400, {
        error: 'invalid_idempotency_key',
        message: 'idempotencyKey is required',
      });
      return;
    }

    const cleanOrderNo = orderNo.trim();

    // Paid-order duplicate guard: any second pay for the same orderNo
    // is suppressed regardless of prior outcome (spec §3.4). The index
    // is only ever populated by an approved execution path (never here).
    if (paidOrders.has(cleanOrderNo)) {
      sendJson(res, 409, {
        error: 'payment_duplicate_suppressed',
        message: 'duplicate payment suppressed — no second request was sent',
      });
      return;
    }

    // Idempotency (operation-bound; no automatic retry semantics).
    const claim = idempotencyStore.touch(idempotencyKey, 'pay');
    if (claim.status === 'operation_mismatch') {
      sendJson(res, 400, {
        error: 'idempotency_key_operation_mismatch',
        message: 'idempotency key was issued for a different operation',
      });
      return;
    }
    if (claim.status === 'in_flight') {
      sendJson(res, 409, {
        error: 'idempotency_in_flight',
        message: 'a request with this idempotency key is already in flight',
      });
      return;
    }
    if (claim.status === 'replay') {
      const stored = claim.record.response;
      sendJson(res, stored ? stored.status : 503, {
        ...(stored ? stored.body : WRITE_NOT_IMPLEMENTED),
        replayed: true,
      });
      return;
    }

    // Confirmation token: single-use, bound to operation + orderNo.
    const consumed = tokenStore.consume(confirmationToken, 'pay', cleanOrderNo);
    if (!consumed.ok) {
      idempotencyStore.finish(idempotencyKey, 'failed', { status: 403, body: { error: consumed.error } });
      sendJson(res, 403, {
        error: consumed.error,
        message: 'confirmation token rejected (expired, replayed, or mismatched)',
      });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // EXECUTION SEAM — BLOCKED: DO NOT IMPLEMENT (spec §22).
    // A future, explicitly approved `atlas-flight order pay` call
    // (exactly once, zero retries, server-held confirmation id marked
    // consumed before the call) would live here. The scaffolding fails
    // closed and NEVER invokes any CLI. A same-key follow-up after an
    // unknown outcome reconciles via /status, never re-pays.
    // ──────────────────────────────────────────────────────────────────
    if (WRITE_EXECUTION_APPROVED) {
      // Intentionally unreachable in this scaffolding task.
      throw new Error('sandbox_write_execution_not_approved');
    }

    idempotencyStore.finish(idempotencyKey, 'unknown', { status: 503, body: WRITE_NOT_IMPLEMENTED });
    sendJson(res, 503, WRITE_NOT_IMPLEMENTED);
  }

  /* ── /status (read-only scaffold seam; never invokes the CLI) ── */
  async function handleStatus(res, body) {
    const { orderNo } = body || {};
    if (!isOpaqueId(orderNo)) {
      sendJson(res, 400, {
        error: 'invalid_order_no',
        message: 'orderNo is required (opaque string ≤128 chars)',
      });
      return;
    }
    const cleanOrderNo = orderNo.trim();

    // Typed mock/test seam: tests may inject a deterministic result.
    if (typeof statusImpl === 'function') {
      const result = await statusImpl(cleanOrderNo);
      sendJson(res, 200, result);
      return;
    }

    // Default scaffold response. A future approved implementation would
    // use execCliWithRetry-style read semantics with a per-orderNo
    // single-flight Map here; numeric codes stay BLOCKED placeholders
    // (NUMERIC_STATUS_CODE_MAPPING) and unknown codes yield
    // terminal:false, status:'unknown'.
    sendJson(res, 200, {
      orderNo: cleanOrderNo,
      status: 'unknown',
      cliCode: null,
      rawCode: null,
      terminal: false,
      scaffold: true,
      reason: 'status_execution_disabled_pending_approval',
      timestamp: new Date().toISOString(),
    });
  }

  /* ── Dispatch (exact routes only) ── */
  return async function handleSandboxRoute(pathname, req, res) {
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      sendJson(res, 400, { error: 'invalid_request', message: sanitizeError(e.message) });
      return;
    }

    // Gates 1–6 (fail closed). Gate 7 (route/input validation) follows.
    const gateResult = evaluateGates(env);
    if (!gateResult.ok) {
      sendJson(res, 403, {
        error: gateResult.firstFailure.error,
        message: gateResult.firstFailure.message,
      });
      return;
    }

    // Browser forbidden-field rejection (credentials, environment
    // overrides, passenger identity, contact, payment data).
    const forbiddenKey = findForbiddenKey(body);
    if (forbiddenKey) {
      sendJson(res, 400, {
        error: 'browser_supplied_data_rejected',
        message: 'sandbox routes do not accept this request field',
      });
      return;
    }

    switch (pathname) {
      case '/api/atlas/sandbox/capabilities':
        handleCapabilities(res, gateResult);
        return;
      case '/api/atlas/sandbox/confirm-intent':
        handleConfirmIntent(res, body);
        return;
      case '/api/atlas/sandbox/order':
        handleOrder(res, body);
        return;
      case '/api/atlas/sandbox/pay':
        handlePay(res, body);
        return;
      case '/api/atlas/sandbox/status':
        await handleStatus(res, body);
        return;
      default:
        sendJson(res, 404, { error: 'not_found', message: 'unknown Atlas sandbox route' });
    }
  };
}
