// Nosana integration boundary for StitchCheck.
//
// STATUS: OFFLINE-ONLY — NO NOSANA EXECUTION
//
// This module implements a credential-free, network-disabled client boundary
// for the planned Nosana risk-workload integration. It operates entirely in
// offline mode with deterministic local fixtures.
//
// Hard guarantees:
// - Zero network code: no fetch/http/https/net/socket imports or calls.
// - Zero credentials read: no .env or secret file is ever touched.
// - Zero dependencies: Node.js built-ins only.
// - Dependency-injected transport: never imports a live SDK.
// - Offline mode by default: refuses to run with real transport unless an
//   explicit future execution flag is provided.
// - Never logs headers, tokens, credentials, raw responses, or PII.
// - Returns sanitized structured results only.
// - Read-only operations: validate, build envelope, normalize fixture.
// - Rejects mutation operations: submit, deploy, fund, cancel, reserve,
//   purchase, delete.
// - All results carry executedAgainstProvider: false and
//   sourceType: "synthetic-local-placeholder".

import {
  PLACEHOLDER_LABEL,
  HEURISTIC_DISCLAIMER,
  validateRiskRequest,
  validateRiskResult,
} from "./schema-validator.mjs";

// ── Constants ─────────────────────────────────────────────────────────────

const ALLOWED_OPERATIONS = Object.freeze([
  "validateWorkload",
  "buildRequestEnvelope",
  "normalizeFixtureResult",
  "getStatus",
]);

const MUTATION_OPERATIONS = Object.freeze([
  "submit",
  "deploy",
  "fund",
  "cancel",
  "reserve",
  "purchase",
  "delete",
]);

const WORKLOAD_STATUSES = Object.freeze([
  "disabled",
  "blocked",
  "ready",
  "failed",
  "passed",
]);

const SAFETY_LIMITS = Object.freeze({
  requestTimeoutMs: 60000,
  maxRetries: 0,
  maxRequestAttempts: 1,
  maxEnvelopeBytes: 1024 * 1024, // 1 MB
});

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
function sanitizeValue(value, path = "") {
  if (Array.isArray(value)) {
    return value.map((item, i) => sanitizeValue(item, `${path}[${i}]`));
  }
  if (isPlainObject(value)) {
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_KEYS.some((fk) => fk.toLowerCase() === lowerKey)) {
        continue; // Strip forbidden key
      }
      sanitized[key] = sanitizeValue(val, path ? `${path}.${key}` : key);
    }
    return sanitized;
  }
  return value;
}

/**
 * Creates a disabled/blocked result with explicit status and reason.
 */
function createDisabledResult(status, reason) {
  return Object.freeze({
    executedAgainstProvider: false,
    sourceType: "synthetic-local-placeholder",
    placeholderLabel: PLACEHOLDER_LABEL,
    workloadStatus: status,
    jobOrServiceReference: null,
    riskBand: "unavailable",
    riskScore: null,
    heuristicDisclaimer: `${HEURISTIC_DISCLAIMER} ${PLACEHOLDER_LABEL}`,
    failureCascadeExplanation: `Nosana workload not executed: ${reason}`,
    datasetVersion: "not-applicable",
    fallbackUsed: false,
    errorCode: status === "blocked" ? "WORKLOAD_BLOCKED" : "WORKLOAD_DISABLED",
    errorMessage: reason,
  });
}

// ── Client Factory ────────────────────────────────────────────────────────

/**
 * Creates a Nosana client with the given configuration.
 *
 * @param {Object} config
 * @param {string} [config.mode="offline"] - "offline" or "future-execution"
 * @param {Object} [config.transport] - Dependency-injected transport (rejected in offline mode)
 * @param {boolean} [config.allowFutureExecution=false] - Explicit flag to permit real transport
 * @param {number} [config.timeoutMs=60000] - Bounded timeout
 * @param {number} [config.maxRetries=0] - No retry by default
 * @returns {Object} Nosana client with read-only operations
 */
export function createNosanaClient(config = {}) {
  const mode = config.mode || "offline";
  const transport = config.transport || null;
  const allowFutureExecution = config.allowFutureExecution === true;
  const timeoutMs = typeof config.timeoutMs === "number" && config.timeoutMs > 0
    ? Math.min(config.timeoutMs, SAFETY_LIMITS.requestTimeoutMs)
    : SAFETY_LIMITS.requestTimeoutMs;
  const maxRetries = typeof config.maxRetries === "number" && config.maxRetries >= 0
    ? Math.min(config.maxRetries, SAFETY_LIMITS.maxRetries)
    : SAFETY_LIMITS.maxRetries;

  let requestAttemptCount = 0;

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

  if (transport && mode === "future-execution" && !allowFutureExecution) {
    throw new Error(
      "Transport supplied with future-execution mode but allowFutureExecution is false. " +
      "Both must be set to permit any future provider interaction.",
    );
  }

  // ── Read-Only Operations ──────────────────────────────────────────────

  /**
   * Validates a workload description against the contract.
   * Returns { valid: boolean, issues: string[] }.
   */
  function validateWorkload(workload) {
    if (!isPlainObject(workload)) {
      return { valid: false, issues: ["workload must be an object"] };
    }

    const issues = [];

    // Required fields
    if (!isNonEmptyString(workload.correlationId)) {
      issues.push("correlationId must be a non-empty string");
    }
    if (!isNonEmptyString(workload.origin)) {
      issues.push("origin must be a non-empty string");
    }
    if (!isNonEmptyString(workload.connectionAirport)) {
      issues.push("connectionAirport must be a non-empty string");
    }
    if (!isNonEmptyString(workload.destination)) {
      issues.push("destination must be a non-empty string");
    }
    if (
      typeof workload.connectionDurationMinutes !== "number" ||
      !Number.isFinite(workload.connectionDurationMinutes) ||
      workload.connectionDurationMinutes < 0
    ) {
      issues.push("connectionDurationMinutes must be a non-negative finite number");
    }
    if (!isNonEmptyString(workload.staticHistoricalDatasetVersion)) {
      issues.push("staticHistoricalDatasetVersion must be a non-empty string");
    }
    if (workload.syntheticDemo !== true) {
      issues.push("syntheticDemo must be true");
    }
    if (workload.nonPiiDeclaration !== true) {
      issues.push("nonPiiDeclaration must be true");
    }

    // Reject mutation-like fields
    for (const mutOp of MUTATION_OPERATIONS) {
      if (mutOp in workload) {
        issues.push(`mutation-like field rejected: ${mutOp}`);
      }
    }

    // Timeout bounds
    if (workload.timeoutMs !== undefined) {
      if (
        typeof workload.timeoutMs !== "number" ||
        !Number.isFinite(workload.timeoutMs) ||
        workload.timeoutMs <= 0 ||
        workload.timeoutMs > SAFETY_LIMITS.requestTimeoutMs
      ) {
        issues.push(`timeoutMs must be a positive finite number <= ${SAFETY_LIMITS.requestTimeoutMs}`);
      }
    }

    // Retry bound
    if (workload.maxRetries !== undefined) {
      if (
        typeof workload.maxRetries !== "number" ||
        !Number.isFinite(workload.maxRetries) ||
        workload.maxRetries < 0 ||
        workload.maxRetries > SAFETY_LIMITS.maxRetries
      ) {
        issues.push(`maxRetries must be a non-negative finite number <= ${SAFETY_LIMITS.maxRetries}`);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Builds a sanitized request envelope without secrets.
   * Strips forbidden keys (PII, credentials, headers).
   */
  function buildRequestEnvelope(workload) {
    const validation = validateWorkload(workload);
    if (!validation.valid) {
      return {
        valid: false,
        issues: validation.issues,
        envelope: null,
      };
    }

    const sanitized = sanitizeValue(workload);
    const envelope = {
      correlationId: sanitized.correlationId,
      origin: sanitized.origin,
      connectionAirport: sanitized.connectionAirport,
      destination: sanitized.destination,
      connectionDurationMinutes: sanitized.connectionDurationMinutes,
      staticHistoricalDatasetVersion: sanitized.staticHistoricalDatasetVersion,
      syntheticDemo: true,
      nonPiiDeclaration: true,
      placeholderLabel: PLACEHOLDER_LABEL,
      timeoutMs: sanitized.timeoutMs || timeoutMs,
      maxRetries: sanitized.maxRetries ?? maxRetries,
    };

    const envelopeSize = new TextEncoder().encode(JSON.stringify(envelope)).length;
    if (envelopeSize > SAFETY_LIMITS.maxEnvelopeBytes) {
      return {
        valid: false,
        issues: [`envelope size ${envelopeSize} exceeds limit ${SAFETY_LIMITS.maxEnvelopeBytes}`],
        envelope: null,
      };
    }

    return {
      valid: true,
      issues: [],
      envelope: Object.freeze(envelope),
    };
  }

  /**
   * Normalizes a fixture response into a safe result.
   * Strips forbidden keys, enforces evidence boundaries.
   */
  function normalizeFixtureResult(fixtureResult) {
    if (!isPlainObject(fixtureResult)) {
      return createDisabledResult("failed", "fixture result must be an object");
    }

    const sanitized = sanitizeValue(fixtureResult);

    // Validate the inner riskResult if present
    if (sanitized.riskResult) {
      const validation = validateRiskResult(sanitized.riskResult);
      if (!validation.valid) {
        return createDisabledResult("failed", `fixture riskResult invalid: ${validation.issues.join("; ")}`);
      }
    }

    // Enforce evidence boundaries
    const result = {
      executedAgainstProvider: false,
      sourceType: "synthetic-local-placeholder",
      placeholderLabel: PLACEHOLDER_LABEL,
      workloadStatus: sanitized.workloadStatus || "failed",
      jobOrServiceReference: sanitized.jobOrServiceReference || null,
      riskBand: sanitized.riskBand || "unavailable",
      riskScore: sanitized.riskScore ?? null,
      heuristicDisclaimer: sanitized.heuristicDisclaimer || `${HEURISTIC_DISCLAIMER} ${PLACEHOLDER_LABEL}`,
      failureCascadeExplanation: sanitized.failureCascadeExplanation || "No explanation provided.",
      datasetVersion: sanitized.datasetVersion || "not-applicable",
      fallbackUsed: sanitized.fallbackUsed === true,
      errorCode: sanitized.errorCode || null,
      errorMessage: sanitized.errorMessage || null,
    };

    // Validate status
    if (!WORKLOAD_STATUSES.includes(result.workloadStatus)) {
      result.workloadStatus = "failed";
      result.failureCascadeExplanation += ` (Invalid status corrected to "failed".)`;
    }

    return Object.freeze(result);
  }

  /**
   * Returns the current workload status.
   * In offline mode, always returns "disabled".
   */
  function getStatus() {
    return Object.freeze({
      status: "disabled",
      reason: "offline-mode-no-nosana-execution",
      executedAgainstProvider: false,
      sourceType: "synthetic-local-placeholder",
      placeholderLabel: PLACEHOLDER_LABEL,
    });
  }

  /**
   * Rejects mutation operations explicitly.
   */
  function rejectMutation(operation) {
    if (MUTATION_OPERATIONS.includes(operation)) {
      throw new Error(
        `Mutation operation "${operation}" is rejected. ` +
        `Allowed operations: ${ALLOWED_OPERATIONS.join(", ")}.`,
      );
    }
  }

  /**
   * Enforces single-request limit for future execution path.
   */
  function enforceRequestLimit() {
    if (requestAttemptCount >= SAFETY_LIMITS.maxRequestAttempts) {
      throw new Error(
        `Maximum request attempts (${SAFETY_LIMITS.maxRequestAttempts}) exceeded. ` +
        `No retry permitted.`,
      );
    }
    requestAttemptCount += 1;
  }

  // ── Public API ────────────────────────────────────────────────────────

  return Object.freeze({
    validateWorkload,
    buildRequestEnvelope,
    normalizeFixtureResult,
    getStatus,
    rejectMutation,
    enforceRequestLimit,
    _getAttemptCount: () => requestAttemptCount,
    _resetAttemptCount: () => { requestAttemptCount = 0; },
  });
}

// ── Exports ───────────────────────────────────────────────────────────────

export const NOSANA_CLIENT_CONSTANTS = Object.freeze({
  ALLOWED_OPERATIONS,
  MUTATION_OPERATIONS,
  WORKLOAD_STATUSES,
  SAFETY_LIMITS,
  PLACEHOLDER_LABEL,
  HEURISTIC_DISCLAIMER,
});

export default createNosanaClient;
