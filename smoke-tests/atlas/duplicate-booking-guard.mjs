// Atlas duplicate-booking protection boundary for StitchCheck.
//
// STATUS: OFFLINE-ONLY — NO ATLAS EXECUTION
//
// This module implements a pure, dependency-injected state machine for
// preventing blind retries after Atlas duplicate-booking response 318.
// It operates entirely offline with deterministic local state.
//
// Core rule: Query first, retry second.
//
// Hard guarantees:
// - Zero network code: no fetch/http/https/net/socket imports or calls.
// - Zero credentials read: no .env or secret file is ever touched.
// - Zero dependencies: Node.js built-ins only.
// - Dependency-injected transport: never imports a live SDK.
// - Offline mode by default: refuses to execute unless explicitly authorized.
// - Never logs headers, tokens, credentials, raw responses, or PII.
// - Returns sanitized structured results only.
// - All results carry executedAgainstProvider: false and
//   sourceType: "synthetic-local-placeholder".
// - Frozen or otherwise immutable returned results.
// - No automatic retries or loops.

import { DISCLAIMER_LABEL } from "./schema-validator.mjs";

// ── Constants ─────────────────────────────────────────────────────────────

const GUARD_STATES = Object.freeze([
  "attempt-created",
  "awaiting-authoritative-status",
  "query-existing-order",
  "recovered-existing-order",
  "existing-order-processing",
  "paid-awaiting-ticketing",
  "retry-review-required",
  "safely-stopped",
]);

const EXISTING_ORDER_STATUSES = Object.freeze([
  "ticketed",
  "processing",
  "paid-awaiting-ticketing",
  "failed",
  "cancelled",
  "unknown",
]);

// Keys that would indicate PII or credentials if present.
const FORBIDDEN_KEYS = Object.freeze([
  "apiKey",
  "api_key",
  "secret",
  "password",
  "token",
  "authorization",
  "bearer",
  "credential",
  "name",
  "firstName",
  "lastName",
  "surname",
  "email",
  "emailAddress",
  "phone",
  "phoneNumber",
  "passenger",
  "passengers",
  "bookingReference",
  "pnr",
  "payment",
  "cardNumber",
  "passport",
  "dateOfBirth",
  "address",
]);

// ── Helpers ───────────────────────────────────────────────────────────────

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Sanitizes a value by removing forbidden keys (PII, credentials, headers).
 * Returns a new object; never mutates input.
 */
function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (isPlainObject(value)) {
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_KEYS.some((fk) => fk.toLowerCase() === lowerKey)) {
        continue; // Strip forbidden key
      }
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  return value;
}

/**
 * Creates a deterministic fingerprint from a candidate object.
 * Strips PII, credentials, and raw itinerary text.
 */
function createCandidateFingerprint(candidate) {
  if (!isPlainObject(candidate)) {
    throw new Error("candidate must be an object");
  }
  const sanitized = sanitizeValue(candidate);
  // Create a deterministic hash-like string from sorted keys
  const keys = Object.keys(sanitized).sort();
  const parts = keys.map((k) => `${k}:${JSON.stringify(sanitized[k])}`);
  return parts.join("|");
}

/**
 * Creates a disabled result with explicit status and reason.
 */
function createDisabledResult(status, reason) {
  return Object.freeze({
    executedAgainstProvider: false,
    sourceType: "synthetic-local-placeholder",
    placeholderLabel: DISCLAIMER_LABEL,
    guardStatus: status,
    reason,
    attemptId: null,
    existingOrderId: null,
    recoveryOutcome: null,
  });
}

// ── Guard Factory ─────────────────────────────────────────────────────────

/**
 * Creates a duplicate-booking guard with the given configuration.
 *
 * @param {Object} config
 * @param {string} [config.mode="offline"] - "offline" or "future-execution"
 * @param {Object} [config.transport] - Dependency-injected transport (rejected in offline mode)
 * @param {boolean} [config.allowFutureExecution=false] - Explicit flag to permit real transport
 * @returns {Object} Duplicate-booking guard with state machine operations
 */
export function createDuplicateBookingGuard(config = {}) {
  const mode = config.mode || "offline";
  const transport = config.transport || null;
  const allowFutureExecution = config.allowFutureExecution === true;

  let currentState = null;
  let currentAttemptId = null;
  let currentExistingOrderId = null;
  let candidateFingerprints = new Set();
  let recoveryOutcome = null;

  // Validate configuration
  if (mode !== "offline" && mode !== "future-execution") {
    throw new Error(`Invalid mode: ${mode}. Must be "offline" or "future-execution".`);
  }

  if (transport && mode === "offline" && !allowFutureExecution) {
    throw new Error(
      "Transport supplied in offline mode without allowFutureExecution flag. " +
      "Refusing to run. Set mode to 'future-execution' and allowFutureExecution to true " +
      "only when explicit human authorization has been obtained.",
    );
  }

  // ── State Machine Operations ──────────────────────────────────────────

  /**
   * Creates a deterministic attempt record from a sanitized candidate fingerprint.
   * Requires an explicit user-confirmation flag.
   * Rejects empty or unsafe candidate input.
   */
  function createAttempt(candidate, userConfirmed) {
    if (userConfirmed !== true) {
      return createDisabledResult("blocked", "user confirmation required");
    }

    if (!isPlainObject(candidate)) {
      return createDisabledResult("blocked", "candidate must be an object");
    }

    // Check for forbidden content
    const sanitized = sanitizeValue(candidate);
    if (Object.keys(sanitized).length === 0) {
      return createDisabledResult("blocked", "candidate contains only forbidden fields");
    }

    const fingerprint = createCandidateFingerprint(candidate);
    if (candidateFingerprints.has(fingerprint)) {
      return createDisabledResult("blocked", "duplicate candidate fingerprint");
    }

    const attemptId = `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    currentAttemptId = attemptId;
    candidateFingerprints.add(fingerprint);
    currentState = "attempt-created";

    return Object.freeze({
      executedAgainstProvider: false,
      sourceType: "synthetic-local-placeholder",
      placeholderLabel: DISCLAIMER_LABEL,
      guardStatus: currentState,
      attemptId,
      existingOrderId: null,
      recoveryOutcome: null,
    });
  }

  /**
   * Records that an order request was accepted for follow-up.
   * Does not treat acceptance as ticket issuance.
   * Transitions to awaiting-authoritative-status state.
   */
  function recordOrderAccepted() {
    if (currentState !== "attempt-created") {
      return createDisabledResult("blocked", "invalid state transition");
    }

    currentState = "awaiting-authoritative-status";

    return Object.freeze({
      executedAgainstProvider: false,
      sourceType: "synthetic-local-placeholder",
      placeholderLabel: DISCLAIMER_LABEL,
      guardStatus: currentState,
      attemptId: currentAttemptId,
      existingOrderId: null,
      recoveryOutcome: null,
    });
  }

  /**
   * Handles Atlas 318 response (existing booking/order must be checked).
   * Never transitions directly to a retry state.
   * Requires an existing order identifier or original attempt reference.
   * Transitions to query-existing-order.
   */
  function handleDuplicate318(existingOrderId) {
    if (currentState !== "awaiting-authoritative-status") {
      return createDisabledResult("blocked", "invalid state transition");
    }

    if (!isNonEmptyString(existingOrderId)) {
      return createDisabledResult("blocked", "existing order identifier required");
    }

    currentExistingOrderId = existingOrderId;
    currentState = "query-existing-order";

    return Object.freeze({
      executedAgainstProvider: false,
      sourceType: "synthetic-local-placeholder",
      placeholderLabel: DISCLAIMER_LABEL,
      guardStatus: currentState,
      attemptId: currentAttemptId,
      existingOrderId: currentExistingOrderId,
      recoveryOutcome: null,
    });
  }

  /**
   * Records the status of an existing order.
   * Accepts only sanitized terminal categories.
   */
  function recordExistingOrderStatus(status) {
    if (currentState !== "query-existing-order") {
      return createDisabledResult("blocked", "invalid state transition");
    }

    if (!EXISTING_ORDER_STATUSES.includes(status)) {
      return createDisabledResult("blocked", `invalid status: ${status}`);
    }

    let nextState;
    let outcome;

    switch (status) {
      case "ticketed":
        nextState = "recovered-existing-order";
        outcome = "recovered";
        break;
      case "processing":
        nextState = "existing-order-processing";
        outcome = "polling-required";
        break;
      case "paid-awaiting-ticketing":
        nextState = "paid-awaiting-ticketing";
        outcome = "authoritative-followup-required";
        break;
      case "failed":
      case "cancelled":
        nextState = "retry-review-required";
        outcome = "retry-permitted-with-confirmation";
        break;
      case "unknown":
        nextState = "safely-stopped";
        outcome = "stop-safely";
        break;
    }

    currentState = nextState;
    recoveryOutcome = outcome;

    return Object.freeze({
      executedAgainstProvider: false,
      sourceType: "synthetic-local-placeholder",
      placeholderLabel: DISCLAIMER_LABEL,
      guardStatus: currentState,
      attemptId: currentAttemptId,
      existingOrderId: currentExistingOrderId,
      recoveryOutcome,
    });
  }

  /**
   * Authorizes a retry after failed/cancelled status.
   * Requires explicit human confirmation.
   * Requires a genuinely different candidate fingerprint.
   * Rejects reuse of the same candidate fingerprint.
   * Permits only a new local attempt record; never submits an order.
   */
  function authorizeRetry(newCandidate, userConfirmed) {
    if (currentState !== "retry-review-required") {
      return createDisabledResult("blocked", "retry not permitted in current state");
    }

    if (userConfirmed !== true) {
      return createDisabledResult("blocked", "user confirmation required");
    }

    if (!isPlainObject(newCandidate)) {
      return createDisabledResult("blocked", "candidate must be an object");
    }

    const fingerprint = createCandidateFingerprint(newCandidate);
    if (candidateFingerprints.has(fingerprint)) {
      return createDisabledResult("blocked", "duplicate candidate fingerprint");
    }

    const attemptId = `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    currentAttemptId = attemptId;
    candidateFingerprints.add(fingerprint);
    currentState = "attempt-created";
    recoveryOutcome = null;

    return Object.freeze({
      executedAgainstProvider: false,
      sourceType: "synthetic-local-placeholder",
      placeholderLabel: DISCLAIMER_LABEL,
      guardStatus: currentState,
      attemptId,
      existingOrderId: null,
      recoveryOutcome: null,
    });
  }

  /**
   * Builds a sanitized recovery receipt.
   * Returns structured state only.
   * Never includes raw provider output, card data, PII, or credentials.
   */
  function buildRecoveryReceipt() {
    return Object.freeze({
      executedAgainstProvider: false,
      sourceType: "synthetic-local-placeholder",
      placeholderLabel: DISCLAIMER_LABEL,
      guardStatus: currentState,
      attemptId: currentAttemptId,
      existingOrderId: currentExistingOrderId,
      recoveryOutcome,
      receiptGenerated: true,
    });
  }

  /**
   * Returns the current guard status.
   */
  function getStatus() {
    return Object.freeze({
      executedAgainstProvider: false,
      sourceType: "synthetic-local-placeholder",
      placeholderLabel: DISCLAIMER_LABEL,
      guardStatus: currentState,
      attemptId: currentAttemptId,
      existingOrderId: currentExistingOrderId,
      recoveryOutcome,
    });
  }

  // ── Public API ────────────────────────────────────────────────────────

  return Object.freeze({
    createAttempt,
    recordOrderAccepted,
    handleDuplicate318,
    recordExistingOrderStatus,
    authorizeRetry,
    buildRecoveryReceipt,
    getStatus,
  });
}

// ── Exports ───────────────────────────────────────────────────────────────

export const DUPLICATE_BOOKING_GUARD_CONSTANTS = Object.freeze({
  GUARD_STATES,
  EXISTING_ORDER_STATUSES,
  DISCLAIMER_LABEL,
});

export default createDuplicateBookingGuard;
