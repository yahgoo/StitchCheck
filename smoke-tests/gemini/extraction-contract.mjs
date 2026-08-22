// Provider-neutral extraction adapter contract for StitchCheck.
//
// This module defines the typed interface that any itinerary-extraction
// adapter must implement. It is purely a contract: no network code, no
// credentials, no provider invocation.
//
// Two adapters exist or are planned:
//   - openrouter-adapter.mjs: temporary phase path (executed once for GEM-01).
//   - direct-gemini-adapter.mjs: future direct Gemini path (disabled).
//
// Labels:
//   - OpenRouter path: "OpenRouter temporary path — not direct Gemini validation"
//   - Direct Gemini:   "Direct Gemini validation"
//   - Local fallback:  "Synthetic local placeholder — not direct Gemini evidence"

/* ── Label constants ── */

export const EXTRACTION_LABELS = Object.freeze({
  openRouterTemporaryPath:
    "OpenRouter temporary path \u2014 not direct Gemini validation",
  directGeminiValidation: "Direct Gemini validation",
  syntheticLocalFallback:
    "Synthetic local placeholder \u2014 not direct Gemini evidence",
});

/* ── Source / status object ── */
//
// Every extraction result includes a source status that records:
//   - provider:        the adapter that produced the result
//   - label:           the human-readable evidence-boundary label
//   - executed:        whether a real provider call was made
//   - enabled:         whether the adapter is currently authorized
//   - authorizationKey: which config key must be set to enable it
//   - fallbackUsed:    whether a local placeholder was returned instead

/**
 * Creates a source-status record for a disabled or fallback result.
 * @param {string} provider
 * @param {string} label
 * @param {boolean} fallbackUsed
 * @returns {SourceStatus}
 */
export function createDisabledSourceStatus(provider, label, fallbackUsed) {
  return Object.freeze({
    provider,
    label,
    executed: false,
    enabled: false,
    authorizationKey: provider === "gemini" ? "GEMINI_API_KEY" : "OPENROUTER_API_KEY",
    fallbackUsed,
  });
}

/* ── Disabled / fallback result ── */

/**
 * Creates a clearly marked extraction result for when the adapter is
 * disabled or unavailable. The result is not live provider evidence.
 * @param {string} [reason]  Machine-readable reason for the fallback.
 * @returns {ExtractionResult}
 */
export function createDisabledExtractionResult(reason) {
  return Object.freeze({
    extractionStatus: "disabled",
    firstLeg: null,
    secondLeg: null,
    connectionDurationMinutes: null,
    missingFields: ["all — adapter disabled"],
    fieldConfidence: { overall: "none", note: "adapter not enabled" },
    validationMessages: [],
    requiresUserConfirmation: true,
    syntheticDemo: true,
    sourceStatus: createDisabledSourceStatus(
      "gemini",
      EXTRACTION_LABELS.syntheticLocalFallback,
      true,
    ),
    fallbackReason: reason ?? "adapter_disabled",
    label: EXTRACTION_LABELS.syntheticLocalFallback,
  });
}

/* ── Adapter interface (documented as JSDoc) ── */

/**
 * @typedef {Object} ExtractionRequest
 * @property {string}  fixtureId     Identifier for the synthetic fixture.
 * @property {Uint8Array|string} image  Image bytes or data-URL.
 * @property {string}  mediaType     MIME type (e.g. "image/png").
 * @property {string}  [instruction] Optional extraction instruction text.
 */

/**
 * @typedef {Object} FlightLeg
 * @property {string} origin
 * @property {string} destination
 * @property {string} date           ISO-8601 date (YYYY-MM-DD).
 * @property {string} departureTime  24-hour time (HH:MM).
 * @property {string} arrivalTime    24-hour time (HH:MM).
 * @property {string|null} [airline]
 * @property {string|null} [flightNumber]
 */

/**
 * @typedef {Object} SourceStatus
 * @property {string}  provider
 * @property {string}  label
 * @property {boolean} executed
 * @property {boolean} enabled
 * @property {string}  authorizationKey
 * @property {boolean} fallbackUsed
 */

/**
 * @typedef {Object} ExtractionResult
 * @property {string}       extractionStatus   success|partial|invalid|error|disabled
 * @property {FlightLeg|null} firstLeg
 * @property {FlightLeg|null} secondLeg
 * @property {number|null}  connectionDurationMinutes
 * @property {string[]}     missingFields
 * @property {Object}       fieldConfidence
 * @property {string[]}     validationMessages
 * @property {boolean}      requiresUserConfirmation
 * @property {boolean}      syntheticDemo
 * @property {SourceStatus} sourceStatus
 * @property {string}       [fallbackReason]
 * @property {string}       [label]
 */

/**
 * @typedef {Object} ExtractionAdapter
 * @property {() => boolean} isEnabled
 *   Returns true only when the adapter is explicitly authorized.
 * @property {(request: ExtractionRequest) => Promise<ExtractionResult>} extract
 *   Perform one extraction. Rejects if the adapter is disabled.
 * @property {() => string} getLabel
 *   Returns the evidence-boundary label for this adapter.
 */

/* ── Guard: validates that an object satisfies the adapter shape ── */

/**
 * Checks whether a value satisfies the ExtractionAdapter interface.
 * Does not invoke any method; shape check only.
 * @param {unknown} adapter
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function validateAdapterShape(adapter) {
  const issues = [];
  if (adapter === null || adapter === undefined || typeof adapter !== "object") {
    return { ok: false, issues: ["adapter must be an object"] };
  }
  if (typeof adapter.isEnabled !== "function") {
    issues.push("isEnabled must be a function");
  }
  if (typeof adapter.extract !== "function") {
    issues.push("extract must be a function");
  }
  if (typeof adapter.getLabel !== "function") {
    issues.push("getLabel must be a function");
  }
  return { ok: issues.length === 0, issues };
}
