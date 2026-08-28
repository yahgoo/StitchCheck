// Atlas read-only proxy for the Vite dev server.
//
// Exposes exactly two endpoints:
//   POST /api/atlas/search  — Atlas Sandbox Search (read-only)
//   POST /api/atlas/verify  — Atlas Sandbox Verify (read-only price check)
//
// Safety constraints:
//   - Uses the verified `atlas-flight` CLI via execFile (no shell invocation).
//   - Argument arrays only; no user-controlled strings in shell position.
//   - 8-second timeout per CLI call; up to three attempts with bounded backoff
//     for known transient failures.
//   - No retry on 4xx or 429 responses.
//   - All other /api/atlas/* paths return 404.
//   - Write paths (order, booking, reservation, payment, ticket, cancel,
//     refund) are explicitly rejected with 404.
//   - Five exact /api/atlas/sandbox/* scaffold routes are dispatched to
//     atlas-sandbox-writes.mjs; they fail closed by default and NEVER
//     execute a write in the current scaffolding state.
//   - Credentials are never exposed in responses or logs.
//   - Errors are sanitized before returning to the browser.

import { execFile } from 'node:child_process';
import { createSandboxWriteHandler } from './atlas-sandbox-writes.mjs';

/* ── Constants ── */

const CLI_TIMEOUT_MS = 8_000;
export const ATLAS_MAX_ATTEMPTS = 3;
export const RETRY_BACKOFF_BASE_MS = 1_000;
export const RETRY_BACKOFF_CAP_MS = 8_000;
export const RETRY_TOTAL_BACKOFF_CAP_MS = 8_000;
const RETRYABLE_EXIT_CODES = new Set(['ETIMEDOUT', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER']);
export const RETRYABLE_ATLAS_CODES = new Set([
  'SERVICE_TEMPORARILY_UNAVAILABLE',
  'SECURE_STORE_UNAVAILABLE',
]);

/** Write paths that must never be proxied. */
const BLOCKED_PATHS = new Set([
  '/api/atlas/order',
  '/api/atlas/booking',
  '/api/atlas/reservation',
  '/api/atlas/payment',
  '/api/atlas/ticket',
  '/api/atlas/cancel',
  '/api/atlas/refund',
]);

/** Allowed routes. */
const ALLOWED_ROUTES = new Set(['/api/atlas/search', '/api/atlas/verify']);

/** Atlas Sandbox write-scaffold routes (exact set, fail closed).
 *  No generic /api/atlas/sandbox/* passthrough; no collision with
 *  BLOCKED_PATHS ('/api/atlas/sandbox/order' !== '/api/atlas/order'). */
const SANDBOX_ROUTES = new Set([
  '/api/atlas/sandbox/capabilities',
  '/api/atlas/sandbox/confirm-intent',
  '/api/atlas/sandbox/order',
  '/api/atlas/sandbox/pay',
  '/api/atlas/sandbox/status',
]);

/* ── Helpers ── */

/**
 * Executes the atlas-flight CLI with argument array (no shell).
 * Returns parsed JSON or null on failure.
 */
export function execCli(args) {
  return new Promise((resolve) => {
    execFile(
      'atlas-flight',
      args,
      { timeout: CLI_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const raw = (stdout || '').trim();
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = null;
        }
        resolve({
          parsed,
          exitCode: error ? error.code || 1 : 0,
          timedOut: error && error.killed === true,
          errorCode: error ? error.code : null,
          stderr: (stderr || '').trim(),
        });
      },
    );
  });
}

/**
 * Executes the atlas-flight CLI ONCE with an argument array (no shell)
 * and an optional stdin payload: the string is written to child.stdin,
 * which is then ended. Single attempt — no retries. Used exclusively
 * as the sandbox write execution seam (atlas-sandbox-writes.mjs), which
 * must stay free of any node:child_process import. Resolves the same
 * {parsed, exitCode, timedOut, errorCode, stderr} shape as execCli.
 */
export function execCliOnceWithStdin(args, { stdin = '', timeoutMs = 8_000 } = {}) {
  return new Promise((resolve) => {
    const child = execFile(
      'atlas-flight',
      args,
      { timeout: timeoutMs ?? 8_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const raw = (stdout || '').trim();
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = null;
        }
        resolve({
          parsed,
          exitCode: error ? error.code || 1 : 0,
          timedOut: error && error.killed === true,
          errorCode: error ? error.code : null,
          stderr: (stderr || '').trim(),
        });
      },
    );
    // Deliver the payload via stdin only — never temp files.
    if (child.stdin) {
      child.stdin.on('error', () => {}); // EPIPE-guard: outcome via callback
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

/** Returns true only for bounded, known-safe read-only retry conditions. */
export function isRetryableAtlasResult(result) {
  return Boolean(
    result?.timedOut
    || RETRYABLE_EXIT_CODES.has(result?.errorCode)
    || (result?.parsed === null && result?.exitCode !== 0)
    || RETRYABLE_ATLAS_CODES.has(result?.parsed?.code),
  );
}

/** Exponential backoff with a hard per-delay cap. */
export function retryDelayMs(retryNumber) {
  return Math.min(
    RETRY_BACKOFF_BASE_MS * (2 ** retryNumber),
    RETRY_BACKOFF_CAP_MS,
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a read-only CLI request with bounded exponential backoff.
 * Shared by Search and Verify so transient Sandbox/keychain failures receive
 * the same treatment. Non-retryable Atlas responses return immediately.
 */
export async function execCliWithRetry(
  args,
  { execute = execCli, wait = sleep } = {},
) {
  let result = null;
  let totalBackoffMs = 0;

  for (let attempt = 0; attempt < ATLAS_MAX_ATTEMPTS; attempt += 1) {
    result = await execute(args);
    if (!isRetryableAtlasResult(result) || attempt === ATLAS_MAX_ATTEMPTS - 1) {
      return result;
    }

    const delayMs = Math.min(
      retryDelayMs(attempt),
      RETRY_TOTAL_BACKOFF_CAP_MS - totalBackoffMs,
    );
    if (delayMs <= 0) return result;
    totalBackoffMs += delayMs;
    await wait(delayMs);
  }

  return result;
}

/**
 * Sanitizes a response object by removing credential-like patterns.
 */
export function sanitizeResponse(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const str = JSON.stringify(obj);
  const sanitized = str
    .replace(/sk-[a-zA-Z0-9]{10,}/g, '[REDACTED]')
    .replace(/AIza[a-zA-Z0-9]{20,}/g, '[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, '[REDACTED]')
    .replace(/https?:\/\/[^\s"')]+/g, '[REDACTED]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g, '[REDACTED]');
  try {
    return JSON.parse(sanitized);
  } catch {
    return { error: 'response_sanitization_failed' };
  }
}

/**
 * Sanitizes an error message.
 */
export function sanitizeError(msg) {
  if (typeof msg !== 'string') return 'internal error';
  return msg
    .replace(/sk-[a-zA-Z0-9]{10,}/g, '[REDACTED]')
    .replace(/AIza[a-zA-Z0-9]{20,}/g, '[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, '[REDACTED]')
    .replace(/https?:\/\/[^\s"')]+/g, '[REDACTED]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g, '[REDACTED]')
    .replace(/at\s+[^\n]+/g, '')
    .trim()
    .slice(0, 500) || 'internal error';
}

/**
 * Sends a JSON response.
 */
export function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Reads the request body as JSON.
 */
export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error('request_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Validates IATA airport code (3 uppercase letters).
 */
function isIata(s) {
  return typeof s === 'string' && /^[A-Z]{3}$/.test(s);
}

/**
 * Validates date format YYYY-MM-DD.
 */
function isDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Atlas can include nearby-airport substitutions in a city-pair result. Those
 * are not safe replacements for a self-transfer whose confirmed connection is
 * at specific airports, so keep only offers whose outer endpoints exactly
 * match the requested leg.  Intermediate stops remain valid.
 */
export function filterOffersForRequestedRoute(offers, origin, destination) {
  if (!Array.isArray(offers)) return [];
  return offers.filter((offer) => {
    const segments = offer?.segments;
    if (!Array.isArray(segments) || segments.length === 0) return false;
    const first = segments[0];
    const last = segments[segments.length - 1];
    return first?.departure_airport === origin && last?.arrival_airport === destination;
  });
}

/* ── Route handlers ── */

async function handleSearch(req, res, execRead = execCli) {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    sendJson(res, 400, { error: 'invalid_request', message: sanitizeError(e.message) });
    return;
  }

  const { origin, destination, depart, adults = 1, currency = 'USD' } = body;

  if (!isIata(origin) || !isIata(destination)) {
    sendJson(res, 400, { error: 'invalid_iata', message: 'origin and destination must be 3-letter IATA codes' });
    return;
  }
  if (!isDate(depart)) {
    sendJson(res, 400, { error: 'invalid_date', message: 'depart must be YYYY-MM-DD' });
    return;
  }
  if (typeof adults !== 'number' || adults < 1 || adults > 9) {
    sendJson(res, 400, { error: 'invalid_adults', message: 'adults must be between 1 and 9' });
    return;
  }

  // Step 1: Ensure sandbox environment
  const envResult = await execRead(['environment', 'use', 'sandbox', '--json']);
  if (envResult.parsed?.status !== 'success' && envResult.parsed?.code !== 'CONFIGURATION_UPDATED' && envResult.parsed?.code !== 'ENVIRONMENT_SWITCHED') {
    // Non-fatal: CLI may already be in sandbox mode
  }

  // Step 2: Search
  const searchArgs = [
    'search',
    '--origin', origin,
    '--destination', destination,
    '--depart', depart,
    '--adults', String(adults),
    '--currency', currency,
    '--json',
  ];
  const searchResult = await execCliWithRetry(searchArgs, { execute: execRead });

  if (!searchResult.parsed || searchResult.parsed.status !== 'success') {
    const appCode = searchResult.parsed?.code || null;
    sendJson(res, 502, {
      error: appCode || 'search_failed',
      message: sanitizeError(searchResult.parsed?.message || searchResult.stderr || 'search did not succeed'),
    });
    return;
  }

  const searchId = searchResult.parsed.data?.search_id;
  if (!searchId) {
    sendJson(res, 502, {
      error: 'missing_search_id',
      message: 'search succeeded but no search_id was returned',
    });
    return;
  }

  // Step 3: List offers
  const offerListArgs = ['offer', 'list', '--search-id', searchId, '--json'];
  const offerListResult = await execCliWithRetry(offerListArgs, { execute: execRead });

  if (!offerListResult.parsed || offerListResult.parsed.status !== 'success') {
    sendJson(res, 502, {
      error: offerListResult.parsed?.code || 'offer_list_failed',
      message: sanitizeError(offerListResult.parsed?.message || offerListResult.stderr || 'offer list did not succeed'),
    });
    return;
  }

  // Return only offers that preserve the confirmed airport-to-airport route.
  // Atlas may otherwise return nearby-airport substitutions (for example
  // SZB→DMK for KUL→BKK), which cannot safely replace a self-transfer leg.
  const offers = filterOffersForRequestedRoute(
    offerListResult.parsed.data?.offers,
    origin,
    destination,
  );
  sendJson(res, 200, {
    searchId: searchId,
    offerCount: offers.length,
    offers: sanitizeResponse(offers),
    responseCode: searchResult.parsed.code || 'FLIGHT_SEARCHED',
    timestamp: new Date().toISOString(),
  });
}

async function handleVerify(req, res, execRead = execCli) {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    sendJson(res, 400, { error: 'invalid_request', message: sanitizeError(e.message) });
    return;
  }

  const { offerId } = body;
  if (typeof offerId !== 'string' || !offerId.trim()) {
    sendJson(res, 400, { error: 'invalid_offer_id', message: 'offerId is required' });
    return;
  }

  const verifyArgs = ['offer', 'verify', '--offer-id', offerId.trim(), '--json'];
  const verifyResult = await execCliWithRetry(verifyArgs, { execute: execRead });

  if (!verifyResult.parsed) {
    sendJson(res, 200, {
      status: 'error',
      code: 'verify_failed',
      message: sanitizeError(verifyResult.stderr || 'verify did not return a response'),
      data: null,
    });
    return;
  }

  // Verify may return PRICE_CONFIRMATION_REQUIRED — this is a valid response
  const knownCodes = [
    'PRICE_CONFIRMATION_REQUIRED',
    'PRICE_VERIFICATION_UNAVAILABLE',
    'OFFER_EXPIRED',
    'FLIGHT_UNAVAILABLE',
  ];

  if (verifyResult.parsed.status === 'success') {
    sendJson(res, 200, {
      status: 'success',
      code: verifyResult.parsed.code || 'OFFER_VERIFIED',
      message: verifyResult.parsed.message || 'Offer verified',
      data: sanitizeResponse(verifyResult.parsed.data || {}),
      timestamp: new Date().toISOString(),
    });
  } else if (verifyResult.parsed.code && knownCodes.includes(verifyResult.parsed.code)) {
    sendJson(res, 200, {
      status: 'price_confirmation',
      code: verifyResult.parsed.code,
      message: sanitizeError(verifyResult.parsed.message || ''),
      data: sanitizeResponse(verifyResult.parsed.data || {}),
      timestamp: new Date().toISOString(),
    });
  } else {
    sendJson(res, 200, {
      status: 'error',
      code: verifyResult.parsed.code || 'verify_failed',
      message: sanitizeError(verifyResult.parsed.message || 'verify did not succeed'),
      data: null,
      timestamp: new Date().toISOString(),
    });
  }
}

/* ── Middleware factory ── */

/**
 * Creates the Atlas proxy middleware for the Vite dev server.
 * @param {object} env - Environment variables (process.env).
 * @param {object} [seams] - Optional TEST-ONLY seams. `seams.execCliRead`
 *   replaces the read-path CLI executor (Search/Verify) for offline
 *   tests; when absent the real read-only executor is used, so runtime
 *   behavior is byte-identical.
 * @returns {function} Connect-compatible middleware function.
 */
export function createAtlasProxyMiddleware(env, seams = {}) {
  // Read-path executor seam (offline tests only); defaults to execCli.
  const execRead =
    typeof seams.execCliRead === 'function' ? seams.execCliRead : execCli;
  // Sandbox write handler (fail closed unless the default-false
  // ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED env flag is explicitly set).
  // execCliOnceWithStdin is the single-shot stdin-capable executor
  // seam; it is invoked ONLY when execution approval is active.
  const handleSandboxRoute = createSandboxWriteHandler(env, execCliOnceWithStdin);

  return function atlasProxyMiddleware(req, res, next) {
    const url = req.url || '';

    // Strip query string for route matching
    const pathname = url.split('?')[0];

    // Only handle /api/atlas/* paths
    if (!pathname.startsWith('/api/atlas')) {
      return next();
    }

    // Only allow POST
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }

    // Block write paths explicitly
    if (BLOCKED_PATHS.has(pathname)) {
      sendJson(res, 404, { error: 'not_found', message: 'this endpoint is not available' });
      return;
    }

    // Atlas Sandbox write-scaffold routes (exact set; fail closed)
    if (SANDBOX_ROUTES.has(pathname)) {
      handleSandboxRoute(pathname, req, res).catch((err) => {
        sendJson(res, 500, { error: 'internal_error', message: sanitizeError(err?.message || String(err)) });
      });
      return;
    }

    // Only allow search and verify
    if (!ALLOWED_ROUTES.has(pathname)) {
      sendJson(res, 404, { error: 'not_found', message: 'unknown Atlas route' });
      return;
    }

    // Safety gate: check DATA_MODE
    const dataMode = env.DATA_MODE || env.VITE_DATA_MODE || 'offline';
    if (dataMode !== 'live') {
      sendJson(res, 403, { error: 'live_mode_not_enabled', message: 'Set DATA_MODE=live to enable Atlas live requests' });
      return;
    }

    // Safety gate: check ATLAS_LIVE_READ_ONLY
    const atlasLiveReadOnly = env.ATLAS_LIVE_READ_ONLY;
    if (atlasLiveReadOnly !== 'true') {
      sendJson(res, 403, { error: 'atlas_live_read_only_not_enabled', message: 'Set ATLAS_LIVE_READ_ONLY=true to enable Atlas Sandbox requests' });
      return;
    }

    // Route to handler
    if (pathname === '/api/atlas/search') {
      handleSearch(req, res, execRead).catch((err) => {
        sendJson(res, 500, { error: 'internal_error', message: sanitizeError(err?.message || String(err)) });
      });
    } else if (pathname === '/api/atlas/verify') {
      handleVerify(req, res, execRead).catch((err) => {
        sendJson(res, 500, { error: 'internal_error', message: sanitizeError(err?.message || String(err)) });
      });
    } else {
      sendJson(res, 404, { error: 'not_found' });
    }
  };
}
