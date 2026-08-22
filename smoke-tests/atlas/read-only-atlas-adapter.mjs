// Read-only Atlas Sandbox adapter boundary for StitchCheck.
//
// STATUS: DISABLED BY DEFAULT — PROVIDER CALL BOUNDARY IMPLEMENTED
//
// This adapter implements the AtlasAdapter interface for read-only
// search/comparison of flight alternatives. The provider-call boundary
// is implemented but unreachable unless every explicit safety condition
// is satisfied:
//   1. Atlas capability approval is granted
//   2. A target environment is explicitly configured
//   3. An SDK client is explicitly injected via dependency injection
//   4. A runtime credential is available via secure mechanism
//   5. The requested operation is explicitly read-only (search/compare)
//   6. A single bounded request is explicitly invoked by a future command
//
// Until then, all search requests return a clearly marked local fallback.
//
// Safety rules:
//   - No network calls are made unless the adapter is enabled AND a client is injected.
//   - No credentials are hard-coded, logged, or serialized.
//   - No automatic retries, polling, or background calls.
//   - Single-request limit per execution.
//   - Safe timeout and bounded response size.
//   - Sanitized error handling excludes headers, keys, raw responses, PII.
//   - Only read-only operations (search, compare) are permitted.
//   - All booking/payment/reservation/ticket/order/verification operations are rejected.
//   - Offline tests use fake clients; no real SDK or provider is invoked.
//
// Label:
//   "Synthetic local placeholder — not Atlas Sandbox evidence"

import {
  ATLAS_LABELS,
  READ_ONLY_OPERATIONS,
  FORBIDDEN_OPERATIONS,
  isReadOnlyOperation,
  isForbiddenOperation,
  createDisabledAtlasSearchResult,
  createDisabledAtlasSourceStatus,
} from "./alternatives-contract.mjs";

const SAFETY_LIMITS = Object.freeze({
  requestTimeoutMs: 60000,
  maxResponseBytes: 10 * 1024 * 1024, // 10 MB
  maxRetries: 0, // single request only
  maxCalls: 1, // one request per execution
});

/* ── Module state ── */

let _callCount = 0;
let _atlasClient = null;
let _credentialLoader = null;
let _capabilityApproved = false;
let _targetEnvironment = null;

/* ── Test / execution hooks ── */

/**
 * Injects an SDK client for future Atlas calls.
 * The client must implement the MinimalAtlasClient interface.
 * @param {Object|null} client
 */
export function _setAtlasClient(client) {
  _atlasClient = client;
}

/**
 * Injects a credential loader for future execution or testing.
 * The loader must return a non-empty string or null.
 * @param {Function|null} loader
 */
export function _setCredentialLoader(loader) {
  _credentialLoader = typeof loader === "function" ? loader : null;
}

/**
 * Sets the capability approval status.
 * @param {boolean} approved
 */
export function _setCapabilityApproval(approved) {
  _capabilityApproved = approved === true;
}

/**
 * Sets the target environment identifier.
 * @param {string|null} environment
 */
export function _setTargetEnvironment(environment) {
  _targetEnvironment = typeof environment === "string" && environment.trim()
    ? environment.trim()
    : null;
}

/**
 * Resets module state (call counter, client, credential loader, approvals).
 * Used between offline tests to ensure deterministic isolation.
 */
export function _resetModuleState() {
  _callCount = 0;
  _atlasClient = null;
  _credentialLoader = null;
  _capabilityApproved = false;
  _targetEnvironment = null;
}

/**
 * Resolves the runtime credential without exposing its value.
 * Returns null if no credential loader is injected.
 * @returns {string|null}
 */
function _resolveCredential() {
  if (typeof _credentialLoader === "function") {
    try {
      const cred = _credentialLoader();
      if (typeof cred === "string" && cred.trim().length > 0) {
        return cred;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/* ── Authorization check ── */

/**
 * Checks whether all authorization prerequisites are met.
 * @returns {{ enabled: boolean, reason: string|null }}
 */
export function checkAuthorization() {
  if (!_capabilityApproved) {
    return { enabled: false, reason: "atlas_capability_not_approved" };
  }
  if (!_targetEnvironment) {
    return { enabled: false, reason: "no_target_environment_configured" };
  }
  if (!_atlasClient) {
    return { enabled: false, reason: "no_atlas_client_injected" };
  }
  return { enabled: true, reason: null };
}

/* ── Request / response helpers ── */

/**
 * Validates that a search request has required fields.
 * @param {import("./alternatives-contract.mjs").AtlasSearchRequest} request
 * @returns {{ valid: boolean, issues: string[] }}
 */
export function validateSearchRequest(request) {
  const issues = [];
  if (!request || typeof request !== "object") {
    return { valid: false, issues: ["request must be an object"] };
  }
  if (!isReadOnlyOperation(request.operation)) {
    if (isForbiddenOperation(request.operation)) {
      issues.push(`operation "${request.operation}" is forbidden (write action)`);
    } else {
      issues.push(`operation "${request.operation}" is not read-only`);
    }
  }
  if (typeof request.correlationId !== "string" || !request.correlationId) {
    issues.push("correlationId must be a non-empty string");
  }
  if (typeof request.origin !== "string" || !/^[A-Z]{3}$/.test(request.origin)) {
    issues.push("origin must be a 3-letter IATA code");
  }
  if (typeof request.destination !== "string" || !/^[A-Z]{3}$/.test(request.destination)) {
    issues.push("destination must be a 3-letter IATA code");
  }
  if (typeof request.departureDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(request.departureDate)) {
    issues.push("departureDate must match YYYY-MM-DD");
  }
  if (request.searchIntent !== "safer-alternative") {
    issues.push("searchIntent must be 'safer-alternative'");
  }
  if (request.sandboxOnly !== true) {
    issues.push("sandboxOnly must be true");
  }
  if (request.confirmedItinerary !== true) {
    issues.push("confirmedItinerary must be true");
  }
  return { valid: issues.length === 0, issues };
}

/**
 * Validates date and time formats in alternatives.
 * @param {Object} alternative
 * @returns {{ valid: boolean, issues: string[] }}
 */
export function validateAlternativeDates(alternative) {
  const issues = [];
  if (!/^\d{2}:\d{2}$/.test(alternative.departureTime)) {
    issues.push("departureTime must match HH:MM");
  } else {
    const [hours, minutes] = alternative.departureTime.split(":").map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      issues.push("departureTime must be a valid time (00:00 to 23:59)");
    }
  }
  if (!/^\d{2}:\d{2}$/.test(alternative.arrivalTime)) {
    issues.push("arrivalTime must match HH:MM");
  } else {
    const [hours, minutes] = alternative.arrivalTime.split(":").map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      issues.push("arrivalTime must be a valid time (00:00 to 23:59)");
    }
  }
  if (alternative.connectionDurationMinutes !== undefined) {
    if (
      typeof alternative.connectionDurationMinutes !== "number" ||
      !Number.isFinite(alternative.connectionDurationMinutes) ||
      alternative.connectionDurationMinutes < 0
    ) {
      issues.push("connectionDurationMinutes must be a non-negative number");
    }
  }
  return { valid: issues.length === 0, issues };
}

/**
 * Builds the request payload for the injected Atlas client.
 * @param {import("./alternatives-contract.mjs").AtlasSearchRequest} request
 * @returns {Object}
 */
export function _buildProviderRequest(request) {
  return {
    operation: request.operation,
    correlationId: request.correlationId,
    origin: request.origin,
    destination: request.destination,
    departureDate: request.departureDate,
    earliestDepartureTime: request.earliestDepartureTime || null,
    latestArrivalTime: request.latestArrivalTime || null,
    searchIntent: request.searchIntent,
    sandboxOnly: request.sandboxOnly,
    syntheticDemo: request.syntheticDemo,
    confirmedItinerary: request.confirmedItinerary,
  };
}

/**
 * Normalizes provider output into the AtlasSearchResult contract.
 * Never returns raw provider output; strips internal fields.
 * @param {Object} providerOutput
 * @returns {Object}
 */
export function _normalizeProviderResult(providerOutput) {
  const alternatives = Array.isArray(providerOutput?.alternatives)
    ? providerOutput.alternatives.map((alt) => {
        const dateValidation = validateAlternativeDates(alt);
        if (!dateValidation.valid) {
          return null; // Skip invalid alternatives
        }
        return Object.freeze({
          offerReference: typeof alt.offerReference === "string" ? alt.offerReference : "",
          routeSummary: typeof alt.routeSummary === "string" ? alt.routeSummary : "",
          departureTime: alt.departureTime,
          arrivalTime: alt.arrivalTime,
          duration: typeof alt.duration === "string" ? alt.duration : "",
          connectionType: typeof alt.connectionType === "string" ? alt.connectionType : "",
          connectionDurationMinutes: alt.connectionDurationMinutes ?? null,
          priceDisplay: typeof alt.priceDisplay === "string" ? alt.priceDisplay : "",
          currency: typeof alt.currency === "string" ? alt.currency : "",
          availabilityLabel: typeof alt.availabilityLabel === "string" ? alt.availabilityLabel : "",
        });
      }).filter(Boolean)
    : [];

  return Object.freeze({
    searchStatus: providerOutput?.searchStatus || "empty",
    correlationId: providerOutput?.correlationId || null,
    sourceEnvironment: providerOutput?.sourceEnvironment || "sandbox-placeholder",
    alternatives,
    errorCode: providerOutput?.errorCode || null,
    errorMessage: providerOutput?.errorMessage || null,
    fallbackUsed: false,
    requiresUserConfirmation: true,
    syntheticDemo: true,
    sourceStatus: Object.freeze({
      provider: "atlas",
      label: ATLAS_LABELS.syntheticLocalFallback,
      executed: true,
      enabled: true,
      fallbackUsed: false,
    }),
    label: ATLAS_LABELS.syntheticLocalFallback,
  });
}

/**
 * Sanitizes an error message to exclude credentials, URLs, headers, PII.
 * @param {*} error
 * @returns {string}
 */
export function _sanitizeError(error) {
  let msg = error instanceof Error ? error.message : String(error);
  msg = msg.replace(/sk-[a-zA-Z0-9]{10,}/g, "[REDACTED]");
  msg = msg.replace(/AIza[a-zA-Z0-9]{20,}/g, "[REDACTED]");
  msg = msg.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "[REDACTED]");
  msg = msg.replace(/https?:\/\/[^\s"')]+/g, "[REDACTED]");
  msg = msg.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED]");
  msg = msg.replace(/at\s+[^\n]+/g, "");
  msg = msg.replace(/\n{3,}/g, "\n\n").trim();
  return msg || "provider error (details redacted)";
}

/**
 * Creates a provider-call function using the injected Atlas client.
 * The client must implement: searchAlternates({ operation, origin, destination, ... }) -> { alternatives, ... }
 * Enforces: one-request limit, timeout, response size bound, error sanitization.
 * @param {Object} client - Injected Atlas client
 * @returns {Function} async (request, credential) => AtlasSearchResult
 */
export function createProviderCallFunction(client) {
  return async function callProvider(request, credential) {
    if (_callCount >= SAFETY_LIMITS.maxCalls) {
      return createDisabledAtlasSearchResult("call_limit_exceeded");
    }
    _callCount += 1;

    const providerReq = _buildProviderRequest(request);
    let rawResult;

    try {
      const timeoutMs = SAFETY_LIMITS.requestTimeoutMs;
      const timer = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("request_timeout")), timeoutMs)
      );
      rawResult = await Promise.race([
        client.searchAlternates(providerReq),
        timer,
      ]);
    } catch (error) {
      const sanitized = _sanitizeError(error);
      return Object.freeze({
        searchStatus: "error",
        correlationId: request.correlationId || null,
        sourceEnvironment: "sandbox-placeholder",
        alternatives: [],
        errorCode: "provider_error",
        errorMessage: sanitized,
        fallbackUsed: true,
        requiresUserConfirmation: true,
        syntheticDemo: true,
        sourceStatus: Object.freeze({
          provider: "atlas",
          label: ATLAS_LABELS.syntheticLocalFallback,
          executed: true,
          enabled: true,
          fallbackUsed: true,
        }),
        label: ATLAS_LABELS.syntheticLocalFallback,
      });
    }

    // Check response size
    const responseText = JSON.stringify(rawResult);
    const byteSize = new TextEncoder().encode(responseText).length;
    if (byteSize > SAFETY_LIMITS.maxResponseBytes) {
      return Object.freeze({
        searchStatus: "error",
        correlationId: request.correlationId || null,
        sourceEnvironment: "sandbox-placeholder",
        alternatives: [],
        errorCode: "response_too_large",
        errorMessage: "response exceeded maximum size",
        fallbackUsed: true,
        requiresUserConfirmation: true,
        syntheticDemo: true,
        sourceStatus: Object.freeze({
          provider: "atlas",
          label: ATLAS_LABELS.syntheticLocalFallback,
          executed: true,
          enabled: true,
          fallbackUsed: true,
        }),
        label: ATLAS_LABELS.syntheticLocalFallback,
      });
    }

    return _normalizeProviderResult(rawResult);
  };
}

/* ── Adapter implementation ── */

/**
 * Read-only Atlas Sandbox adapter.
 * Implements AtlasAdapter interface.
 */
export const readOnlyAtlasAdapter = {
  /**
   * Returns true only when all authorization prerequisites are met.
   * @returns {boolean}
   */
  isEnabled() {
    const auth = checkAuthorization();
    return auth.enabled === true;
  },

  /**
   * Performs one read-only search/comparison request.
   * Currently always returns a disabled fallback.
   * Future implementation will call Atlas SDK when enabled.
   *
   * @param {import("./alternatives-contract.mjs").AtlasSearchRequest} request
   * @returns {Promise<import("./alternatives-contract.mjs").AtlasSearchResult>}
   */
  async execute(request) {
    // Validate operation is read-only
    if (!isReadOnlyOperation(request?.operation)) {
      if (isForbiddenOperation(request?.operation)) {
        return createDisabledAtlasSearchResult(
          `forbidden_operation_${request.operation}`
        );
      }
      return createDisabledAtlasSearchResult(
        `invalid_operation_${request?.operation}`
      );
    }

    // Validate request shape
    const validation = validateSearchRequest(request);
    if (!validation.valid) {
      return createDisabledAtlasSearchResult("invalid_request_shape");
    }

    // Check authorization
    const auth = checkAuthorization();
    if (!auth.enabled) {
      return createDisabledAtlasSearchResult(auth.reason);
    }

    // Resolve credential
    const credential = _resolveCredential();
    if (!credential) {
      return createDisabledAtlasSearchResult("credential_not_available");
    }

    // Execute provider call
    const callProvider = createProviderCallFunction(_atlasClient);
    return callProvider(request, credential);
  },

  /**
   * Returns the evidence-boundary label for this adapter.
   * @returns {string}
   */
  getLabel() {
    const auth = checkAuthorization();
    return auth.enabled
      ? ATLAS_LABELS.atlasSandboxPlaceholder
      : ATLAS_LABELS.syntheticLocalFallback;
  },
};

/* ── Readiness report ── */

/**
 * Returns a readiness report for the Atlas adapter.
 * Does not expose credentials or secrets.
 * @returns {Object}
 */
export function getAtlasReadiness() {
  const auth = checkAuthorization();

  return {
    adapter: "read-only-atlas",
    enabled: auth.enabled,
    reason: auth.reason,
    label: auth.enabled
      ? ATLAS_LABELS.atlasSandboxPlaceholder
      : ATLAS_LABELS.syntheticLocalFallback,
    capabilityApproved: _capabilityApproved,
    targetEnvironment: _targetEnvironment,
    clientInjected: _atlasClient !== null,
    safetyLimits: SAFETY_LIMITS,
    readOnlyOperations: READ_ONLY_OPERATIONS,
    forbiddenOperations: FORBIDDEN_OPERATIONS,
    prerequisites: [
      "Atlas capability review and approval",
      "Target environment explicitly configured",
      "Atlas SDK/client reviewed and injected",
      "ATLAS_CREDENTIAL available via secure runtime mechanism",
      "Explicit human authorization recorded",
    ],
    note: "Adapter is disabled by default. Atlas Sandbox integration requires separate human authorization, SDK review, and credentials supplied through a secure runtime mechanism.",
  };
}

/* ── Exports ── */

export default readOnlyAtlasAdapter;

/* ── Test hooks (for offline testing only) ── */

export const _testHooks = {
  validateSearchRequest,
  validateAlternativeDates,
  buildProviderRequest: _buildProviderRequest,
  normalizeProviderResult: _normalizeProviderResult,
  sanitizeError: _sanitizeError,
  createProviderCallFunction,
  resetCallCount: _resetModuleState,
  setAtlasClient: _setAtlasClient,
  setCredentialLoader: _setCredentialLoader,
  setCapabilityApproval: _setCapabilityApproval,
  setTargetEnvironment: _setTargetEnvironment,
  resolveCredential: _resolveCredential,
  checkAuthorization,
};
