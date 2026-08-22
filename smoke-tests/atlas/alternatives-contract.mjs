// Provider-neutral Atlas alternatives adapter contract for StitchCheck.
//
// This module defines the typed interface that any Atlas alternatives adapter
// must implement. It is purely a contract: no network code, no credentials,
// no provider invocation.
//
// The contract supports read-only search/comparison only. No booking, payment,
// reservation, ticket, order, verification, or other write action is
// representable through this contract.
//
// Labels:
//   - Atlas fallback: "Synthetic local placeholder — not Atlas Sandbox evidence"

/* ── Label constants ── */

export const ATLAS_LABELS = Object.freeze({
  syntheticLocalFallback:
    "Synthetic local placeholder \u2014 not Atlas Sandbox evidence",
  atlasSandboxPlaceholder: "Atlas Sandbox (placeholder)",
});

/* ── Read-only operation allowlist ── */

export const READ_ONLY_OPERATIONS = Object.freeze(["search", "compare"]);

export const FORBIDDEN_OPERATIONS = Object.freeze([
  "book",
  "create_booking",
  "reserve",
  "ticket",
  "issue",
  "pay",
  "purchase",
  "verify",
  "cancel",
  "change",
  "refund",
  "order",
]);

/**
 * Checks whether an operation name is explicitly read-only.
 * @param {string} operation
 * @returns {boolean}
 */
export function isReadOnlyOperation(operation) {
  return READ_ONLY_OPERATIONS.includes(operation);
}

/**
 * Checks whether an operation name is explicitly forbidden.
 * @param {string} operation
 * @returns {boolean}
 */
export function isForbiddenOperation(operation) {
  return FORBIDDEN_OPERATIONS.includes(operation);
}

/* ── Source / status object ── */

/**
 * Creates a source-status record for a disabled or fallback result.
 * @param {string} label
 * @param {boolean} fallbackUsed
 * @returns {AtlasSourceStatus}
 */
export function createDisabledAtlasSourceStatus(label, fallbackUsed) {
  return Object.freeze({
    provider: "atlas",
    label,
    executed: false,
    enabled: false,
    fallbackUsed,
  });
}

/* ── Disabled / fallback result ── */

/**
 * Creates a clearly marked search result for when the adapter is disabled.
 * @param {string} [reason]
 * @returns {AtlasSearchResult}
 */
export function createDisabledAtlasSearchResult(reason) {
  return Object.freeze({
    searchStatus: "disabled",
    correlationId: null,
    sourceEnvironment: "sandbox-placeholder",
    alternatives: [],
    errorCode: "adapter_disabled",
    errorMessage: reason ?? "adapter_not_enabled",
    fallbackUsed: true,
    requiresUserConfirmation: true,
    syntheticDemo: true,
    sourceStatus: createDisabledAtlasSourceStatus(
      ATLAS_LABELS.syntheticLocalFallback,
      true,
    ),
    label: ATLAS_LABELS.syntheticLocalFallback,
  });
}

/* ── Adapter interface (documented as JSDoc) ── */

/**
 * @typedef {Object} AtlasSearchRequest
 * @property {string}  operation    Must be "search" or "compare".
 * @property {string}  correlationId
 * @property {string}  origin       IATA airport code (3 uppercase letters).
 * @property {string}  destination  IATA airport code (3 uppercase letters).
 * @property {string}  departureDate ISO-8601 date (YYYY-MM-DD).
 * @property {string}  [earliestDepartureTime] HH:MM
 * @property {string}  [latestArrivalTime]     HH:MM
 * @property {string}  searchIntent  Must be "safer-alternative".
 * @property {boolean} sandboxOnly   Must be true.
 * @property {boolean} syntheticDemo Must be true.
 * @property {boolean} confirmedItinerary Must be true.
 */

/**
 * @typedef {Object} AtlasAlternative
 * @property {string} offerReference       Display-only reference (not actionable).
 * @property {string} routeSummary
 * @property {string} departureTime        HH:MM
 * @property {string} arrivalTime          HH:MM
 * @property {string} duration
 * @property {string} connectionType
 * @property {number} [connectionDurationMinutes]
 * @property {string} priceDisplay         Informational only.
 * @property {string} currency
 * @property {string} availabilityLabel    Informational only.
 */

/**
 * @typedef {Object} AtlasSourceStatus
 * @property {string}  provider
 * @property {string}  label
 * @property {boolean} executed
 * @property {boolean} enabled
 * @property {boolean} fallbackUsed
 */

/**
 * @typedef {Object} AtlasSearchResult
 * @property {string}              searchStatus  completed|empty|timeout|error|disabled
 * @property {string|null}         correlationId
 * @property {string}              sourceEnvironment
 * @property {AtlasAlternative[]}  alternatives
 * @property {string|null}         errorCode
 * @property {string|null}         errorMessage
 * @property {boolean}             fallbackUsed
 * @property {boolean}             requiresUserConfirmation
 * @property {boolean}             syntheticDemo
 * @property {AtlasSourceStatus}   sourceStatus
 * @property {string}              label
 */

/**
 * @typedef {Object} AtlasAdapter
 * @property {() => boolean} isEnabled
 * @property {(request: AtlasSearchRequest) => Promise<AtlasSearchResult>} execute
 * @property {() => string} getLabel
 */

/* ── Guard: validates that an object satisfies the adapter shape ── */

/**
 * Checks whether a value satisfies the AtlasAdapter interface.
 * Does not invoke any method; shape check only.
 * @param {unknown} adapter
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function validateAtlasAdapterShape(adapter) {
  const issues = [];
  if (adapter === null || adapter === undefined || typeof adapter !== "object") {
    return { ok: false, issues: ["adapter must be an object"] };
  }
  if (typeof adapter.isEnabled !== "function") {
    issues.push("isEnabled must be a function");
  }
  if (typeof adapter.execute !== "function") {
    issues.push("execute must be a function");
  }
  if (typeof adapter.getLabel !== "function") {
    issues.push("getLabel must be a function");
  }
  return { ok: issues.length === 0, issues };
}
