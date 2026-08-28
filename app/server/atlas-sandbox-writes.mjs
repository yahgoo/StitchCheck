// Atlas Sandbox write scaffolding (approved spec Sections 3, 4, 7, 8, 13)
// + Item 4 execution completion behind a default-false activation flag.
//
// FAIL CLOSED BY DESIGN:
//   - This module NEVER spawns the atlas-flight CLI itself. It does not
//     import node:child_process at all. CLI execution happens ONLY
//     through the injected `execCliImpl` seam, and ONLY when the
//     env-derived flag ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED === 'true'
//     (absent everywhere by default → execution stays disabled).
//   - Without approval, /order and /pay always respond 503
//     `sandbox_write_not_implemented` even after passing every gate —
//     byte-identical legacy behavior, finish-before-send ordering.
//   - Every route is gated by a layered gate chain; any failure → 403.
//   - Passenger/payment data is entirely server-owned. Browser-supplied
//     credential/environment/passenger/payment fields are rejected 400.
//   - Approved execution is ZERO-RETRY: exactly one CLI attempt per
//     operation request; unknown outcomes reconcile via /status only.
//
// Node built-ins only (node:crypto, node:fs/promises, node:path).
// Zero new dependencies. No fetch, no child_process, no live network.

import { createHash, randomBytes } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBody, sendJson, sanitizeError, sanitizeResponse } from './atlas-proxy.mjs';

/* ── Blocked-contract placeholders (spec Section 22) ── */

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
void PASSENGER_STDIN_FIELD_NAMES;

/** ATRIP ticketing activation requires human action in the ATRIP
 *  workspace and is still BLOCKED (spec §22). */
export const ATRIP_TICKETING_ACTIVATION_STATUS =
  'BLOCKED_PENDING_HUMAN_ACTIVATION';

/* ── Defensive multi-key extraction (Item 4 §4) ──
 *
 * ATRIP response field names are unconfirmed until the first supervised
 * rehearsal locks them. Named frozen key arrays live in one place; the
 * extractor walks the parsed CLI response and returns the first usable
 * value. Unknown/numeric codes fail closed to `unknown`, never success. */

/** Candidate keys carrying the created order number. */
const ORDER_NO_FIELD_KEYS = Object.freeze([
  'orderNo', 'order_no', 'orderNumber', 'order_number', 'orderID', 'order_id',
]);

/** Candidate keys carrying the payment confirmation id. The value is
 *  stored server-side per orderNo and NEVER sent to the browser. */
const PAYMENT_CONFIRMATION_ID_FIELD_KEYS = Object.freeze([
  'confirmationId', 'confirmation_id', 'paymentConfirmationId',
  'payment_confirmation_id', 'payConfirmationId', 'pay_confirmation_id',
]);

/** Candidate keys carrying the provider response code. */
const PROVIDER_CODE_FIELD_KEYS = Object.freeze([
  'code', 'responseCode', 'response_code', 'resultCode', 'result_code',
  'errorCode', 'error_code',
]);

/** Candidate keys carrying the order status (for /status reads). */
const ORDER_STATUS_FIELD_KEYS = Object.freeze([
  'status', 'orderStatus', 'order_status', 'state', 'orderState', 'order_state',
]);

/** Numeric status-code semantics (0/1/2/-3) remain unverified and
 *  BLOCKED (spec §3.5): numeric codes NEVER map to a success or
 *  terminal state — they stay `unknown` everywhere. */
const NUMERIC_STATUS_CODE_MAPPING = Object.freeze({});
void NUMERIC_STATUS_CODE_MAPPING;

/** Named order-status values verified as terminal. Anything else —
 *  including every numeric code — stays non-terminal (fail closed). */
const TERMINAL_ORDER_STATUS_CODES = new Set([
  'ORDER_CANCELLED',
  'TICKETED',
  'TICKET_ISSUED',
]);

/** Known non-terminal named statuses that mean "awaiting payment". */
const UNPAID_ORDER_STATUS_CODES = new Set([
  'UNPAID',
  'AWAITING_PAYMENT',
  'PAYMENT_PENDING',
  'PAYMENT_REQUIRED',
]);

/** Known non-terminal named statuses that mean "ticket in progress". */
const TICKETING_ORDER_STATUS_CODES = new Set([
  'TICKETING',
  'TICKET_PROCESSING',
  'TICKET_IN_PROGRESS',
  'TICKET_ISSUING',
  'ISSUING',
]);

/**
 * Normalizes a raw CLI order-status code to the AtlasSandboxOrderStatus
 * union consumed by the panel (fix round WARNING-3). The raw code is
 * preserved separately (cliCode/rawCode) for provenance. Fail closed:
 * numeric, empty, and unrecognized codes NEVER claim a terminal or
 * success state — they normalize to `unknown`.
 * @param {string|null|undefined} rawCode
 * @returns {{ status: 'unpaid'|'ticketing'|'ticketed-simulated'|'cancelled'|'unknown', terminal: boolean }}
 */
export function normalizeSandboxOrderStatus(rawCode) {
  const normalized = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (normalized.length === 0) return { status: 'unknown', terminal: false };
  // Numeric codes are unverified placeholders — never terminal.
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return { status: 'unknown', terminal: false };
  if (TERMINAL_ORDER_STATUS_CODES.has(normalized)) {
    return normalized === 'ORDER_CANCELLED'
      ? { status: 'cancelled', terminal: true }
      : { status: 'ticketed-simulated', terminal: true };
  }
  if (UNPAID_ORDER_STATUS_CODES.has(normalized)) return { status: 'unpaid', terminal: false };
  if (TICKETING_ORDER_STATUS_CODES.has(normalized)) return { status: 'ticketing', terminal: false };
  return { status: 'unknown', terminal: false };
}

/* ── Constants ── */

/** The only acceptable sandbox base URL (spec §4 gate 4). Exported so
 *  tests reference the constant instead of hardcoding the literal. */
export const REQUIRED_SANDBOX_BASE_URL = 'https://sandbox.atriptech.com/';

/** Confirmation tokens: 120s TTL, single-use, operation+subject bound. */
const TOKEN_TTL_MS = 120_000;
const TOKEN_STORE_CAP = 100;

/** Token-issuance rate limit: sliding 60s window, max 10, lazy trim. */
const TOKEN_RATE_WINDOW_MS = 60_000;
const TOKEN_RATE_MAX = 10;

/** Idempotency records: 30-minute TTL, bounded. */
const IDEMPOTENCY_TTL_MS = 30 * 60_000;
const IDEMPOTENCY_STORE_CAP = 200;

/** Opaque identifiers (bookingId/orderNo/traveler_id/token/key) cap. */
const MAX_ID_LENGTH = 128;
const MAX_TRAVELERS = 9;

/** Single-shot CLI timeouts for approved write execution. */
const WRITE_CLI_TIMEOUT_MS = 20_000;
const STATUS_CLI_TIMEOUT_MS = 20_000;

/**
 * Execution activation flag. Read from the environment INSIDE
 * `createSandboxWriteHandler` (never from process.env here): absent or
 * any value other than the exact string 'true' keeps execution disabled.
 * The flag is intentionally NOT present in `.env.local`, `.env.example`,
 * or any test PASS_ENV — the kill switch defaults to false everywhere.
 */
const EXECUTION_APPROVED_ENV_KEY = 'ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED';

/** Machine-readable fail-closed response for order/pay. */
const WRITE_NOT_IMPLEMENTED = Object.freeze({
  error: 'sandbox_write_not_implemented',
  message: 'Sandbox write execution is disabled pending contract approval.',
});

/* ── Server-owned synthetic passenger (Item 4 §3) ──
 *
 * Frozen, server-owned constant. The browser can never override any of
 * these fields: FORBIDDEN_REQUEST_KEY_PATTERNS rejects passenger,
 * contact, and document keys in request bodies (400). Only the opaque,
 * validated traveler_id / passenger_type pairs from the request are
 * merged in. Delivered to the CLI via stdin ONLY — never temp files. */

export const SYNTHETIC_PASSENGER = Object.freeze({
  given_name: 'TESTTRAVELER',
  surname: 'TESTTRAVELER',
  gender: 'M',
  date_of_birth: '1990-01-01',
  nationality: 'JP',
  document_type: 'PP',
  document_number: 'SYNTHETIC00000001',
  document_country: 'JP',
  email: 'test@example.com',
  phone: '0000000000',
});

/**
 * Builds the `--passengers-stdin` payload: the frozen synthetic
 * passenger merged with the validated traveler_id/passenger_type of
 * each requested traveler. Purely server-owned identity data.
 */
function buildPassengersStdinPayload(travelers) {
  const list =
    Array.isArray(travelers) && travelers.length > 0
      ? travelers
      : [{ traveler_id: 'synthetic-traveler-1', passenger_type: 'ADT' }];
  return {
    passengers: list.map((t) => ({
      ...SYNTHETIC_PASSENGER,
      traveler_id: String(t.traveler_id).trim(),
      passenger_type: String(t.passenger_type).trim(),
    })),
  };
}

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

/* ── Token-issuance rate limiter (Item 4 §1) ──
 *
 * Sliding 60-second window, max 10 issuances, LAZY trim only — no
 * timers are ever created. Uses the injected `now()` clock so offline
 * tests control time explicitly. */

function createIssuanceRateLimiter(now) {
  const issuanceTimes = []; // ascending timestamps of recent issuances

  /** @returns {boolean} true when an issuance is allowed right now. */
  function allow() {
    const t = now();
    const cutoff = t - TOKEN_RATE_WINDOW_MS;
    // Lazy trim of entries that fell out of the sliding window.
    while (issuanceTimes.length > 0 && issuanceTimes[0] <= cutoff) {
      issuanceTimes.shift();
    }
    return issuanceTimes.length < TOKEN_RATE_MAX;
  }

  function record() {
    issuanceTimes.push(now());
  }

  return { allow, record };
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
 * Builds a SAFE synthetic object only. The parameter list is an
 * explicit allowlist: this builder can NEVER include secrets, auth
 * headers, confirmation tokens, confirmation ids, PAN, CVV, document
 * numbers, passenger payloads, or raw upstream output. Its output shape
 * is PROTECTED — the evidence writer merges extra fields (latencyMs,
 * terminal) EXTERNALLY instead of changing this function. */

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

/* ── Evidence redaction (Item 4 §6) ──
 *
 * Local wrapper: sanitizeResponse semantics (URLs, emails, Bearer,
 * sk-*, AIza*) PLUS PAN (13–19 digit runs), CVV-style fields, and
 * document-number redaction. Applied to every evidence line before it
 * is serialized; CLI stderr is separately reduced via sanitizeError
 * (≤500 chars) at the call site and never embedded raw. */

export function redactForEvidence(value) {
  let sanitized = value;
  if (sanitized && typeof sanitized === 'object') {
    sanitized = sanitizeResponse(sanitized);
  }
  let str;
  try {
    str = typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
  } catch {
    str = '{"error":"evidence_serialization_failed"}';
  }
  if (typeof str !== 'string') str = String(str ?? '');
  str = str
    // PAN: ANY contiguous run of ≥13 digits (optionally space/dash
    // separated). Negative lookarounds anchor the run so sequences LONGER
    // than 19 digits are redacted entirely instead of being skipped by
    // the old bounded {12,18} match (fix-round redaction hardening).
    .replace(/(?<!\d)(?:\d[ -]?){12,}\d(?!\d)/g, '[REDACTED-PAN]')
    // CVV/CVC/security-code values: quoted strings AND bare numeric
    // values; cvv2/cvc2-style keys included.
    .replace(/"(?:cvv2?|cvc2?|security_?code|card_?security_?code)"\s*:\s*"[^"]*"/gi, '"cvv":"[REDACTED]"')
    .replace(/"(?:cvv2?|cvc2?|security_?code|card_?security_?code)"\s*:\s*\d+/gi, '"cvv":"[REDACTED]"')
    // Travel/passport/document numbers: single-letter AND alphanumeric
    // prefixes (1–4 chars total) followed by 6–9 digits.
    .replace(/\b[A-Z][A-Z0-9]{0,3}\d{6,9}\b/g, '[REDACTED-DOC]')
    .replace(/"(?:document_?number|document_?no|passport_?number)"\s*:\s*"[^"]*"/gi, '"document_number":"[REDACTED]"');
  try {
    return JSON.parse(str);
  } catch {
    return { redacted: str };
  }
}

/* ── Evidence writer (Item 4 §6) ──
 *
 * Append-only JSONL: one line per operation outcome, including gate
 * rejections. Default location `output/atlas-sandbox-evidence-<UTC
 * YYYY-MM-DD>.jsonl` relative to the workspace root. Rules:
 *   - node:fs/promises only; `mkdir` recursive lazily ONCE;
 *   - serialized append chain → line order is preserved;
 *   - the HTTP response path NEVER awaits the fs chain (fire & forget,
 *     failures swallowed — evidence must never break a response).
 * Injectable seams for tests: `options.evidenceSink(record)` (fully
 * replaces file IO) and `options.evidenceDir` (alternate directory). */

const DEFAULT_EVIDENCE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'output',
);

function evidenceFileName(date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `atlas-sandbox-evidence-${yyyy}-${mm}-${dd}.jsonl`;
}

function createEvidenceWriter(options = {}) {
  // Test seam: a sink function fully replaces file IO.
  if (typeof options.evidenceSink === 'function') {
    const sink = options.evidenceSink;
    return function writeEvidence(record) {
      try {
        const result = sink(record);
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch { /* evidence must never throw into the response path */ }
    };
  }

  const dir = options.evidenceDir || DEFAULT_EVIDENCE_DIR;
  let dirReady = false;
  let chain = Promise.resolve();

  return function writeEvidence(record) {
    const line = `${JSON.stringify(redactForEvidence(record))}\n`;
    chain = chain
      .then(async () => {
        if (!dirReady) {
          await mkdir(dir, { recursive: true }); // lazily, exactly once
          dirReady = true;
        }
        await appendFile(path.join(dir, evidenceFileName()), line, 'utf-8');
      })
      .catch(() => {}); // evidence IO failures never surface upstream
  };
}

/* ── Provider outcome mapping (mirrors core mapProviderOutcome) ──
 *
 * Server-side mirror of `mapProviderOutcome` in
 * core/simulation/sandbox-order-states.ts: unknown/numeric/empty codes
 * map to `unknown`, NEVER to a success outcome. */

const KNOWN_ORDER_ACCEPTED_CODES = new Set([
  'PAYMENT_CONFIRMATION_REQUIRED',
  // Adopt the returned existing order number; never recreate.
  'DUPLICATE_BOOKING_SUSPECTED',
]);
const KNOWN_PAY_ACCEPTED_CODES = new Set(['PAYMENT_ACCEPTED']);

function mapSandboxProviderOutcome(operation, code) {
  if (typeof code !== 'string' || code.trim().length === 0) return 'unknown';
  // Numeric codes are unverified placeholders — never success.
  if (/^-?\d+(\.\d+)?$/.test(code.trim())) return 'unknown';
  const normalized = code.trim();
  const accepted =
    operation === 'order' ? KNOWN_ORDER_ACCEPTED_CODES : KNOWN_PAY_ACCEPTED_CODES;
  return accepted.has(normalized) ? 'accepted' : 'unknown';
}

/* ── Defensive extraction helper ── */

function extractFieldValue(parsed, keys) {
  if (!parsed || typeof parsed !== 'object') return null;
  const queue = [parsed];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== 'object') continue;
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const v = node[key];
        if (typeof v === 'string' && v.trim().length > 0) return v.trim();
        if (typeof v === 'number' && Number.isFinite(v)) return String(v);
      }
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === 'object') queue.push(v);
    }
  }
  return null;
}

/** Maps a sandbox route pathname to its evidence operation name. */
function routeOperation(pathname) {
  switch (pathname) {
    case '/api/atlas/sandbox/order': return 'order';
    case '/api/atlas/sandbox/pay': return 'pay';
    case '/api/atlas/sandbox/status': return 'status';
    case '/api/atlas/sandbox/confirm-intent': return 'confirm-intent';
    case '/api/atlas/sandbox/capabilities': return 'capabilities';
    default: return 'unknown';
  }
}

/* ── Input validation helpers ── */

function isOpaqueId(value) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= MAX_ID_LENGTH
  );
}

/** Traveler entries must be opaque references ONLY — exactly
 *  traveler_id + passenger_type. Any unexpected extra key (passenger
 *  data or otherwise) fails closed with 400 invalid_travelers; classic
 *  passenger-data keys are additionally caught earlier by the
 *  forbidden-key scanner (400 browser_supplied_data_rejected). */
const ALLOWED_TRAVELER_KEYS = Object.freeze(['traveler_id', 'passenger_type']);

function isValidTravelers(travelers) {
  if (!Array.isArray(travelers)) return false;
  if (travelers.length === 0 || travelers.length > MAX_TRAVELERS) return false;
  return travelers.every((t) => {
    if (!t || typeof t !== 'object' || Array.isArray(t)) return false;
    const keys = Object.keys(t);
    // Fail closed on ANY unexpected traveler-entry key.
    if (keys.length !== ALLOWED_TRAVELER_KEYS.length) return false;
    if (!ALLOWED_TRAVELER_KEYS.every((k) => keys.includes(k))) return false;
    return (
      isOpaqueId(t.traveler_id) &&
      typeof t.passenger_type === 'string' &&
      t.passenger_type.trim().length > 0 &&
      t.passenger_type.trim().length <= 32
    );
  });
}

/* ── Handler factory ── */

/**
 * Creates the Atlas Sandbox write route handler.
 *
 * FAIL CLOSED: unless `env.ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED`
 * is exactly 'true', order/pay answer 503 `sandbox_write_not_implemented`
 * and the CLI seam is never invoked (byte-identical legacy behavior).
 * When approved, execution is single-shot/zero-retry through the
 * injected `execCliImpl` seam only — this module never imports
 * child_process or calls fetch itself.
 *
 * @param {object} env - Environment variables (process.env).
 * @param {Function|null} [execCliImpl] - CLI execution seam. Invoked
 *   ONLY when execution is approved; single attempt per operation.
 * @param {object} [options] - Test seams: `now()` clock, `statusImpl`,
 *   `paidOrders` Map, `evidenceDir`, and `evidenceSink`.
 * @returns {Function} (pathname, req, res) => Promise<void>
 */
export function createSandboxWriteHandler(env, execCliImpl = null, options = {}) {
  const now = options.now || (() => Date.now());
  const tokenStore = createTokenStore(now);
  const idempotencyStore = createIdempotencyStore(now);
  const rateLimiter = createIssuanceRateLimiter(now);
  const paidOrders = options.paidOrders || new Map(); // orderNo -> { payKey, paidAt }
  const statusImpl = options.statusImpl || null;
  // Evidence location precedence: options.evidenceDir > env override
  // (ATLAS_SANDBOX_EVIDENCE_DIR — test seam for middleware-created
  // handlers; absent everywhere by default) > workspace output/.
  const writeEvidence = createEvidenceWriter({
    ...options,
    evidenceDir:
      options.evidenceDir || env.ATLAS_SANDBOX_EVIDENCE_DIR || DEFAULT_EVIDENCE_DIR,
  });

  // Env-derived execution approval (default false; kill switch).
  const executionApproved = env[EXECUTION_APPROVED_ENV_KEY] === 'true';

  // Server-side confirmation-id registry: orderNo -> { confirmationId,
  // consumed }. NEVER sent to the browser; marked consumed pre-flight
  // before any `order pay` call.
  const confirmationIds = new Map();

  // Per-orderNo single-flight map for /status reads.
  const statusFlights = new Map();

  /* ── Evidence helpers (fire & forget; never awaited by responses) ── */

  function gatesSummary(gateResult) {
    return gateResult
      ? Object.fromEntries(gateResult.gates.map((g) => [g.name, g.ok]))
      : null;
  }

  function recordEvidence({
    operation, route, correlationId = null, bookingId = null, orderNo = null,
    providerResponseCode = null, outcome, idempotencyKey = null, latencyMs = 0,
    gateEvaluation = null, orderStatusCode = null, terminal = false,
  }) {
    // createSandboxEvidenceRecord's shape is protected; `latencyMs`
    // (real value) and `terminal` are merged EXTERNALLY here.
    const record = {
      ...createSandboxEvidenceRecord({
        correlationId,
        operation,
        route,
        bookingId,
        orderNo,
        providerResponseCode,
        outcome,
        idempotencyKey,
        latencyMs,
        gateEvaluation,
        orderStatusCode,
      }),
      terminal,
    };
    writeEvidence(record);
  }

  /* ── Approved execution internals (zero retries; single shot) ── */

  async function executeOrderCreate(cleanBookingId, travelers) {
    const startedAt = now();
    let result = { parsed: null, exitCode: 1, timedOut: false, errorCode: 'no_executor', stderr: '' };
    if (typeof execCliImpl === 'function') {
      const stdinPayload = JSON.stringify(buildPassengersStdinPayload(travelers));
      result = await execCliImpl(
        ['order', 'create', '--booking-id', cleanBookingId, '--passengers-stdin', '--json'],
        { stdin: stdinPayload, timeoutMs: WRITE_CLI_TIMEOUT_MS },
      );
    }
    return { result, latencyMs: Math.max(0, now() - startedAt) };
  }

  async function executeOrderPay(confirmationId) {
    const startedAt = now();
    let result = { parsed: null, exitCode: 1, timedOut: false, errorCode: 'no_executor', stderr: '' };
    if (typeof execCliImpl === 'function') {
      result = await execCliImpl(
        ['order', 'pay', '--confirmation-id', confirmationId, '--json'],
        { timeoutMs: WRITE_CLI_TIMEOUT_MS },
      );
    }
    return { result, latencyMs: Math.max(0, now() - startedAt) };
  }

  async function executeOrderStatus(cleanOrderNo) {
    const startedAt = now();
    let result = { parsed: null, exitCode: 1, timedOut: false, errorCode: 'no_executor', stderr: '' };
    if (typeof execCliImpl === 'function') {
      result = await execCliImpl(
        ['order', 'status', '--order-no', cleanOrderNo, '--json'],
        { timeoutMs: STATUS_CLI_TIMEOUT_MS },
      );
    }
    return { result, latencyMs: Math.max(0, now() - startedAt) };
  }

  /* ── /capabilities ── */
  function handleCapabilities(res, gateResult) {
    sendJson(res, 200, {
      sandboxWritesEnabled: true, // kill switch already passed above
      environment: 'sandbox',
      // Truthful reporting; exact legacy strings while unapproved.
      writeExecution: executionApproved
        ? 'enabled_sandbox_rehearsal'
        : 'disabled_pending_contract_approval',
      executionApproved,
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
    // Sliding-window rate limit on token issuance (60s / max 10).
    if (!rateLimiter.allow()) {
      sendJson(res, 429, {
        error: 'token_rate_limited',
        message: 'too many confirmation-token requests; retry after the window elapses',
      });
      return;
    }
    // Issuance only — execution approval is enforced at order/pay.
    rateLimiter.record();
    const confirmationToken = tokenStore.issue(operation, bindingRef.trim());
    sendJson(res, 200, {
      confirmationToken,
      expiresInSeconds: TOKEN_TTL_MS / 1000,
    });
  }

  /* ── /order ── */
  async function handleOrder(res, body, gateResult) {
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
      recordEvidence({
        operation: 'order',
        route: '/api/atlas/sandbox/order',
        bookingId: cleanBookingId,
        outcome: 'token_rejected',
        idempotencyKey,
        gateEvaluation: gatesSummary(gateResult),
        terminal: true,
      });
      sendJson(res, 403, {
        error: consumed.error,
        message: 'confirmation token rejected (expired, replayed, or mismatched)',
      });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // EXECUTION SEAM — live ONLY behind the default-false env flag
    // ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED. Zero retries: exactly one
    // `atlas-flight order create` attempt (server-owned synthetic
    // passenger via stdin, 20s timeout). Unknown outcomes reconcile via
    // /status; this path NEVER re-submits.
    // ──────────────────────────────────────────────────────────────────
    if (executionApproved) {
      const correlationId = randomBytes(8).toString('hex');
      const evidenceBase = {
        operation: 'order',
        route: '/api/atlas/sandbox/order',
        correlationId,
        bookingId: cleanBookingId,
        idempotencyKey,
        gateEvaluation: gatesSummary(gateResult),
      };

      let exec;
      try {
        exec = await executeOrderCreate(cleanBookingId, travelers);
      } catch (e) {
        const errorBody = {
          error: 'order_execution_error',
          message: sanitizeError(e?.message || String(e)),
        };
        idempotencyStore.finish(idempotencyKey, 'failed', { status: 502, body: errorBody });
        recordEvidence({ ...evidenceBase, outcome: 'cli_error', terminal: true });
        sendJson(res, 502, errorBody);
        return;
      }
      const { result, latencyMs } = exec;

      // Timeout / unparsable output → UNKNOWN. Never success, never retry.
      if (!result || result.parsed === null || result.timedOut) {
        idempotencyStore.finish(idempotencyKey, 'unknown', {
          status: 200,
          body: { outcome: 'unknown', reason: result?.timedOut ? 'timeout' : 'unparsable_response' },
        });
        recordEvidence({
          ...evidenceBase,
          outcome: result?.timedOut ? 'timeout' : 'unknown',
          latencyMs,
          terminal: false,
        });
        sendJson(res, 200, {
          operation: 'order',
          outcome: 'unknown',
          orderNo: null,
          providerCode: null,
          reason: result?.timedOut
            ? 'order_create_timed_out'
            : 'order_create_response_unparsable',
          message: 'Result unknown — do not resubmit; reconcile via status.',
          correlationId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const providerCode = extractFieldValue(result.parsed, PROVIDER_CODE_FIELD_KEYS);
      const outcome = mapSandboxProviderOutcome('order', providerCode);

      if (outcome !== 'accepted') {
        // Fail closed. An EXPLICIT upstream rejection (parseable envelope
        // with a non-success status or error code) → 502 with the code.
        // Numeric/unknown codes inside an otherwise successful envelope
        // are NOT rejections and NOT successes: they stay `unknown`.
        const hasProviderCode = typeof providerCode === 'string' && providerCode.length > 0;
        const explicitRejection =
          (typeof result.parsed.status === 'string' && result.parsed.status !== 'success')
          || (hasProviderCode && /^-?\d+(\.\d+)?$/.test(providerCode) === false && result.parsed.error);
        if (explicitRejection) {
          const body = {
            error: 'order_rejected',
            providerCode,
            message: sanitizeError(result.parsed.message || 'order creation was rejected by the provider'),
          };
          idempotencyStore.finish(idempotencyKey, 'failed', { status: 502, body });
          recordEvidence({
            ...evidenceBase,
            providerResponseCode: providerCode,
            outcome: 'rejected',
            latencyMs,
            terminal: true,
          });
          sendJson(res, 502, body);
          return;
        }
        if (!hasProviderCode && result.exitCode !== 0) {
          // Transport-level failure with no provider envelope.
          const body = {
            error: 'order_execution_failed',
            message: sanitizeError(result.stderr || 'order creation did not succeed'),
          };
          idempotencyStore.finish(idempotencyKey, 'failed', { status: 502, body });
          recordEvidence({ ...evidenceBase, outcome: 'cli_error', latencyMs, terminal: true });
          sendJson(res, 502, body);
          return;
        }
        // Ambiguous (numeric/unknown code, no explicit rejection):
        // outcome UNKNOWN — never success, never retried.
        const unknownBody = {
          operation: 'order',
          outcome: 'unknown',
          orderNo: null,
          providerCode,
          reason: 'provider_code_unrecognized',
          message: 'Result unknown — do not resubmit; reconcile via status.',
          correlationId,
          timestamp: new Date().toISOString(),
        };
        idempotencyStore.finish(idempotencyKey, 'unknown', { status: 200, body: unknownBody });
        recordEvidence({
          ...evidenceBase,
          providerResponseCode: providerCode,
          outcome: 'unknown',
          latencyMs,
          terminal: false,
        });
        sendJson(res, 200, unknownBody);
        return;
      }

      // Accepted. Defensive multi-key extraction of the order number.
      const orderNo = extractFieldValue(result.parsed, ORDER_NO_FIELD_KEYS);
      if (!orderNo) {
        // Accepted code but no extractable orderNo → fail closed unknown.
        idempotencyStore.finish(idempotencyKey, 'unknown', {
          status: 200,
          body: { outcome: 'unknown', reason: 'order_no_not_extractable' },
        });
        recordEvidence({
          ...evidenceBase,
          providerResponseCode: providerCode,
          outcome: 'unknown',
          latencyMs,
          terminal: false,
        });
        sendJson(res, 200, {
          operation: 'order',
          outcome: 'unknown',
          orderNo: null,
          providerCode,
          reason: 'order_no_not_extractable',
          message: 'Result unknown — do not resubmit; reconcile via status.',
          correlationId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Confirmation id is stored server-side ONLY — never to the browser.
      const confirmationId = extractFieldValue(result.parsed, PAYMENT_CONFIRMATION_ID_FIELD_KEYS);
      if (confirmationId) {
        confirmationIds.set(orderNo, { confirmationId, consumed: false });
      }

      const okBody = {
        operation: 'order',
        outcome: 'accepted',
        orderNo,
        providerCode,
        correlationId,
        timestamp: new Date().toISOString(),
      };
      idempotencyStore.finish(idempotencyKey, 'completed', { status: 200, body: okBody }, orderNo);
      recordEvidence({
        ...evidenceBase,
        orderNo,
        providerResponseCode: providerCode,
        outcome: 'accepted',
        latencyMs,
        terminal: false,
      });
      sendJson(res, 200, okBody);
      return;
    }

    // Legacy fail-closed path (behavior byte-identical to the scaffold):
    // finish the idempotency record BEFORE sending the response.
    if (executionApproved) {
      // Intentionally unreachable: the approved branch above returns.
      throw new Error('sandbox_write_execution_not_approved');
    }

    idempotencyStore.finish(idempotencyKey, 'unknown', { status: 503, body: WRITE_NOT_IMPLEMENTED });
    recordEvidence({
      operation: 'order',
      route: '/api/atlas/sandbox/order',
      bookingId: cleanBookingId,
      idempotencyKey,
      outcome: 'not_implemented',
      gateEvaluation: gatesSummary(gateResult),
      terminal: true,
    });
    sendJson(res, 503, WRITE_NOT_IMPLEMENTED);
  }

  /* ── /pay ── */
  async function handlePay(res, body, gateResult) {
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

    // Idempotency FIRST (fix-round WARNING-5 ordering): the touch runs
    // BEFORE the paid-order guard so a SAME-key replay after an accepted
    // pay returns the stored accepted response (replayed:true) instead
    // of a duplicate-suppression 409. No automatic retry semantics.
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

    // Paid-order duplicate guard: applies ONLY to genuinely NEW keys
    // (replays were answered above). Any second pay for the same orderNo
    // is suppressed regardless of prior outcome (spec §3.4). The index
    // is populated ONLY after an accepted pay outcome.
    if (paidOrders.has(cleanOrderNo)) {
      const dupBody = {
        error: 'payment_duplicate_suppressed',
        message: 'duplicate payment suppressed — no second request was sent',
      };
      idempotencyStore.finish(idempotencyKey, 'failed', { status: 409, body: dupBody });
      recordEvidence({
        operation: 'pay',
        route: '/api/atlas/sandbox/pay',
        orderNo: cleanOrderNo,
        outcome: 'duplicate_pay_suppressed',
        idempotencyKey,
        gateEvaluation: gatesSummary(gateResult),
        terminal: true,
      });
      sendJson(res, 409, dupBody);
      return;
    }

    // Confirmation token: single-use, bound to operation + orderNo.
    const consumed = tokenStore.consume(confirmationToken, 'pay', cleanOrderNo);
    if (!consumed.ok) {
      idempotencyStore.finish(idempotencyKey, 'failed', { status: 403, body: { error: consumed.error } });
      recordEvidence({
        operation: 'pay',
        route: '/api/atlas/sandbox/pay',
        orderNo: cleanOrderNo,
        outcome: 'token_rejected',
        idempotencyKey,
        gateEvaluation: gatesSummary(gateResult),
        terminal: true,
      });
      sendJson(res, 403, {
        error: consumed.error,
        message: 'confirmation token rejected (expired, replayed, or mismatched)',
      });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // EXECUTION SEAM — live ONLY behind the default-false env flag
    // ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED. Exactly one
    // `atlas-flight order pay` attempt (zero retries). The server-held
    // confirmation id is marked consumed PRE-FLIGHT, before the call.
    // Same-key follow-ups replay; reconciliation happens via /status.
    // ──────────────────────────────────────────────────────────────────
    if (executionApproved) {
      const correlationId = randomBytes(8).toString('hex');
      const evidenceBase = {
        operation: 'pay',
        route: '/api/atlas/sandbox/pay',
        correlationId,
        orderNo: cleanOrderNo,
        idempotencyKey,
        gateEvaluation: gatesSummary(gateResult),
      };

      const entry = confirmationIds.get(cleanOrderNo);
      if (!entry || !entry.confirmationId) {
        // No server-held confirmation id for this orderNo (order create
        // never succeeded here) — fail closed without invoking the CLI.
        const body = {
          error: 'confirmation_id_unavailable',
          message: 'no server-held payment confirmation id exists for this orderNo',
        };
        idempotencyStore.finish(idempotencyKey, 'failed', { status: 502, body });
        recordEvidence({ ...evidenceBase, outcome: 'confirmation_id_missing', terminal: true });
        sendJson(res, 502, body);
        return;
      }

      // Enforce the consumed flag (fix-round CRITICAL-2): once the
      // server-held confirmation id has been used for ANY `order pay`
      // attempt, no later request — even with a fresh idempotency key —
      // may re-execute the payment. Reconciliation happens via /status.
      if (entry.consumed) {
        const body = {
          error: 'confirmation_id_already_consumed',
          message: 'sandbox payment confirmation id already consumed — never re-pay; reconcile via status',
        };
        idempotencyStore.finish(idempotencyKey, 'failed', { status: 502, body });
        recordEvidence({ ...evidenceBase, outcome: 'confirmation_id_consumed', terminal: true });
        sendJson(res, 502, body);
        return;
      }

      // Mark consumed PRE-FLIGHT, before any `order pay` call.
      entry.consumed = true;

      let exec;
      try {
        exec = await executeOrderPay(entry.confirmationId);
      } catch (e) {
        const errorBody = {
          error: 'pay_execution_error',
          message: sanitizeError(e?.message || String(e)),
        };
        idempotencyStore.finish(idempotencyKey, 'failed', { status: 502, body: errorBody });
        recordEvidence({ ...evidenceBase, outcome: 'cli_error', terminal: true });
        sendJson(res, 502, errorBody);
        return;
      }
      const { result, latencyMs } = exec;

      // Timeout / unparsable output → UNKNOWN. NEVER auto-retry; the
      // same-key follow-up replays and /status reconciles.
      if (!result || result.parsed === null || result.timedOut) {
        idempotencyStore.finish(idempotencyKey, 'unknown', {
          status: 200,
          body: { outcome: 'unknown', reason: result?.timedOut ? 'timeout' : 'unparsable_response' },
        });
        recordEvidence({
          ...evidenceBase,
          outcome: result?.timedOut ? 'timeout' : 'unknown',
          latencyMs,
          terminal: false,
        });
        sendJson(res, 200, {
          operation: 'pay',
          outcome: 'unknown',
          orderNo: cleanOrderNo,
          providerCode: null,
          reason: result?.timedOut ? 'pay_timed_out' : 'pay_response_unparsable',
          message: 'Result unknown — do not resubmit; reconcile via status.',
          correlationId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const providerCode = extractFieldValue(result.parsed, PROVIDER_CODE_FIELD_KEYS);
      const outcome = mapSandboxProviderOutcome('pay', providerCode);

      if (outcome !== 'accepted') {
        // Fail closed. An EXPLICIT upstream rejection (parseable envelope
        // with a non-success status or error code) → 502 with the code.
        // Numeric/unknown codes inside an otherwise successful envelope
        // are NOT rejections and NOT successes: they stay `unknown`.
        const hasProviderCode = typeof providerCode === 'string' && providerCode.length > 0;
        const explicitRejection =
          (typeof result.parsed.status === 'string' && result.parsed.status !== 'success')
          || (hasProviderCode && /^-?\d+(\.\d+)?$/.test(providerCode) === false && result.parsed.error);
        if (explicitRejection) {
          const body = {
            error: 'pay_rejected',
            providerCode,
            message: sanitizeError(result.parsed.message || 'payment was rejected by the provider'),
          };
          idempotencyStore.finish(idempotencyKey, 'failed', { status: 502, body });
          recordEvidence({
            ...evidenceBase,
            providerResponseCode: providerCode,
            outcome: 'rejected',
            latencyMs,
            terminal: true,
          });
          sendJson(res, 502, body);
          return;
        }
        if (!hasProviderCode && result.exitCode !== 0) {
          // Transport-level failure with no provider envelope.
          const body = {
            error: 'pay_execution_failed',
            message: sanitizeError(result.stderr || 'payment did not succeed'),
          };
          idempotencyStore.finish(idempotencyKey, 'failed', { status: 502, body });
          recordEvidence({ ...evidenceBase, outcome: 'cli_error', latencyMs, terminal: true });
          sendJson(res, 502, body);
          return;
        }
        // Ambiguous (numeric/unknown code, no explicit rejection):
        // outcome UNKNOWN — never re-pay; reconcile via /status.
        const unknownBody = {
          operation: 'pay',
          outcome: 'unknown',
          orderNo: cleanOrderNo,
          providerCode,
          reason: 'provider_code_unrecognized',
          message: 'Result unknown — do not resubmit; reconcile via status.',
          correlationId,
          timestamp: new Date().toISOString(),
        };
        idempotencyStore.finish(idempotencyKey, 'unknown', { status: 200, body: unknownBody });
        recordEvidence({
          ...evidenceBase,
          providerResponseCode: providerCode,
          outcome: 'unknown',
          latencyMs,
          terminal: false,
        });
        sendJson(res, 200, unknownBody);
        return;
      }

      // Accepted: populate the paid index ONLY now (spec §5).
      paidOrders.set(cleanOrderNo, { payKey: idempotencyKey, paidAt: now() });
      const okBody = {
        operation: 'pay',
        outcome: 'accepted',
        orderNo: cleanOrderNo,
        providerCode,
        correlationId,
        timestamp: new Date().toISOString(),
      };
      idempotencyStore.finish(idempotencyKey, 'completed', { status: 200, body: okBody }, cleanOrderNo);
      recordEvidence({
        ...evidenceBase,
        providerResponseCode: providerCode,
        outcome: 'accepted',
        latencyMs,
        terminal: false,
      });
      sendJson(res, 200, okBody);
      return;
    }

    // Legacy fail-closed path (behavior byte-identical to the scaffold):
    // finish the idempotency record BEFORE sending the response.
    if (executionApproved) {
      // Intentionally unreachable: the approved branch above returns.
      throw new Error('sandbox_write_execution_not_approved');
    }

    idempotencyStore.finish(idempotencyKey, 'unknown', { status: 503, body: WRITE_NOT_IMPLEMENTED });
    recordEvidence({
      operation: 'pay',
      route: '/api/atlas/sandbox/pay',
      orderNo: cleanOrderNo,
      idempotencyKey,
      outcome: 'not_implemented',
      gateEvaluation: gatesSummary(gateResult),
      terminal: true,
    });
    sendJson(res, 503, WRITE_NOT_IMPLEMENTED);
  }

  /* ── /status ── */
  async function handleStatus(res, body, gateResult) {
    const { orderNo } = body || {};
    if (!isOpaqueId(orderNo)) {
      sendJson(res, 400, {
        error: 'invalid_order_no',
        message: 'orderNo is required (opaque string ≤128 chars)',
      });
      return;
    }
    const cleanOrderNo = orderNo.trim();

    // Typed mock/test seam takes precedence over any execution path.
    if (typeof statusImpl === 'function') {
      const result = await statusImpl(cleanOrderNo);
      sendJson(res, 200, result);
      return;
    }

    // Approved execution: single `order status` read, deduplicated by a
    // per-orderNo single-flight Map (entry deleted on settle).
    if (executionApproved && typeof execCliImpl === 'function') {
      const correlationId = randomBytes(8).toString('hex');
      let flight = statusFlights.get(cleanOrderNo);
      if (!flight) {
        flight = executeOrderStatus(cleanOrderNo);
        statusFlights.set(cleanOrderNo, flight);
      }
      let exec;
      try {
        exec = await flight;
      } finally {
        // Delete the entry once settled (regardless of outcome).
        if (statusFlights.get(cleanOrderNo) === flight) {
          statusFlights.delete(cleanOrderNo);
        }
      }
      const { result, latencyMs } = exec;

      if (!result || result.parsed === null || result.timedOut) {
        recordEvidence({
          operation: 'status',
          route: '/api/atlas/sandbox/status',
          correlationId,
          orderNo: cleanOrderNo,
          outcome: result?.timedOut ? 'timeout' : 'unknown',
          latencyMs,
          gateEvaluation: gatesSummary(gateResult),
          terminal: false,
        });
        sendJson(res, 200, {
          orderNo: cleanOrderNo,
          status: 'unknown',
          cliCode: null,
          rawCode: null,
          terminal: false,
          correlationId,
          reason: result?.timedOut ? 'status_timed_out' : 'status_response_unparsable',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const rawCode = extractFieldValue(result.parsed, ORDER_STATUS_FIELD_KEYS);
      const normalized = typeof rawCode === 'string' ? rawCode.trim() : null;
      // Normalize raw CLI codes to the AtlasSandboxOrderStatus union
      // (fix-round WARNING-3); numeric/unknown codes stay `unknown` and
      // non-terminal (fail closed). Raw code kept for provenance.
      const { status, terminal } = normalizeSandboxOrderStatus(normalized);
      recordEvidence({
        operation: 'status',
        route: '/api/atlas/sandbox/status',
        correlationId,
        orderNo: cleanOrderNo,
        outcome: normalized ? 'observed' : 'unknown',
        orderStatusCode: normalized,
        latencyMs,
        gateEvaluation: gatesSummary(gateResult),
        terminal,
      });
      sendJson(res, 200, {
        orderNo: cleanOrderNo,
        status,
        cliCode: normalized,
        rawCode,
        terminal,
        correlationId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Default scaffold response (execution disabled or no seam).
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
    const routeStart = now();
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
      // Evidence: one line per gate rejection (fire & forget).
      recordEvidence({
        operation: routeOperation(pathname),
        route: pathname,
        outcome: 'gate_rejected',
        gateEvaluation: gatesSummary(gateResult),
        latencyMs: Math.max(0, now() - routeStart),
        terminal: true,
      });
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
      recordEvidence({
        operation: routeOperation(pathname),
        route: pathname,
        outcome: 'browser_input_rejected',
        gateEvaluation: gatesSummary(gateResult),
        latencyMs: Math.max(0, now() - routeStart),
        terminal: true,
      });
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
        await handleOrder(res, body, gateResult);
        return;
      case '/api/atlas/sandbox/pay':
        await handlePay(res, body, gateResult);
        return;
      case '/api/atlas/sandbox/status':
        await handleStatus(res, body, gateResult);
        return;
      default:
        sendJson(res, 404, { error: 'not_found', message: 'unknown Atlas sandbox route' });
    }
  };
}
