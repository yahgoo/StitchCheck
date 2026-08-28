// Daytona risk worker — input schema and validation.
//
// Defines the anonymized itinerary/risk input shape and validates
// incoming requests. Rejects oversized input, missing fields,
// forbidden operations, PII, and out-of-range values.
//
// This module runs INSIDE the Daytona sandbox (offline mode).
// No network calls, no credentials, no side effects.

/* ── Constants ── */

export const MAX_INPUT_BYTES = 64 * 1024; // 64 KB
export const MAX_SCENARIO_LIMIT = 20;
export const MAX_REPLAN_ATTEMPTS = 2;
export const MAX_FLIGHT_LEGS = 4;
export const MAX_DOWNSTREAM_COMMITMENTS = 10;
export const MAX_CANDIDATE_OPTIONS = 6;

/**
 * Forbidden operation keywords.
 * If any appear in the input, the request is rejected.
 */
export const FORBIDDEN_OPERATIONS = Object.freeze([
  'book', 'booking', 'order', 'pay', 'payment',
  'ticket', 'ticketing', 'refund',
  'cancel', 'cancellation',
  'change', 'confirm supplier', 'settle fare',
  'supplier write', 'fare settlement',
]);

/**
 * Forbidden PII / secret key patterns (case-insensitive).
 */
export const FORBIDDEN_INPUT_KEYS = Object.freeze([
  'name', 'firstname', 'lastname', 'surname',
  'email', 'emailaddress', 'phone', 'phonenumber',
  'passport', 'dateofbirth', 'address',
  'payment', 'cardnumber', 'creditcard',
  'bookingreference', 'pnr',
  'apikey', 'api_key', 'secret', 'password', 'token',
  'authorization', 'bearer', 'credential',
]);

/* ── Input schema (JSDoc) ── */

/**
 * @typedef {Object} FlightLegInput
 * @property {string} legId - Anonymized leg identifier (e.g. "leg-1").
 * @property {string} origin - IATA origin code (3 letters).
 * @property {string} destination - IATA destination code (3 letters).
 * @property {string|null} scheduledDeparture - ISO-8601 or null.
 * @property {string|null} scheduledArrival - ISO-8601 or null.
 */

/**
 * @typedef {Object} CandidateRecoveryOption
 * @property {string} optionId - Anonymized option identifier.
 * @property {string} routeSummary - e.g. "SIN → BKK".
 * @property {string|null} departureTime - ISO-8601 or null.
 * @property {string|null} arrivalTime - ISO-8601 or null.
 * @property {string|null} connectionType - "nonstop" | "1-stop" | etc.
 */

/**
 * @typedef {Object} RiskWorkerInput
 * @property {string} itineraryId - Anonymized itinerary identifier.
 * @property {FlightLegInput[]} flightLegs - 1–4 anonymized flight legs.
 * @property {number|null} connectionDurationMinutes - Connection window.
 * @property {string[]} downstreamCommitments - Labels like "hotel-checkin".
 * @property {string|null} hotelCheckinCutoff - ISO-8601 or null.
 * @property {CandidateRecoveryOption[]} [candidateRecoveryOptions] - Optional candidates.
 * @property {string} deterministicSeed - Seed for reproducibility.
 * @property {number} scenarioLimit - Max scenarios to evaluate (1–20).
 */

/* ── Validation result ── */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {string|null} errorCode
 * @property {string|null} errorMessage
 */

/* ── Helpers ── */

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function containsForbiddenOperation(input) {
  const haystack = JSON.stringify(input).toLowerCase();
  for (const op of FORBIDDEN_OPERATIONS) {
    // Match as a whole word boundary to avoid false positives
    const pattern = new RegExp(`(?:^|[^a-z])${op.replace(/\s+/g, '\\s+')}(?:[^a-z]|$)`);
    if (pattern.test(haystack)) return op;
  }
  return null;
}

function containsForbiddenKey(obj, path = '$') {
  if (obj === null || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const found = containsForbiddenKey(obj[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (FORBIDDEN_INPUT_KEYS.includes(key.toLowerCase())) {
      return { key, path };
    }
    if (typeof value === 'object' && value !== null) {
      const found = containsForbiddenKey(value, `${path}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

/* ── Validators ── */

function validateFlightLeg(leg, index) {
  if (!isPlainObject(leg)) return `flightLegs[${index}] is not an object`;
  if (typeof leg.legId !== 'string' || leg.legId.length === 0) {
    return `flightLegs[${index}].legId must be a non-empty string`;
  }
  if (typeof leg.origin !== 'string' || !/^[A-Z]{3}$/.test(leg.origin)) {
    return `flightLegs[${index}].origin must be a 3-letter IATA code`;
  }
  if (typeof leg.destination !== 'string' || !/^[A-Z]{3}$/.test(leg.destination)) {
    return `flightLegs[${index}].destination must be a 3-letter IATA code`;
  }
  if (leg.scheduledDeparture !== null && typeof leg.scheduledDeparture !== 'string') {
    return `flightLegs[${index}].scheduledDeparture must be string or null`;
  }
  if (leg.scheduledArrival !== null && typeof leg.scheduledArrival !== 'string') {
    return `flightLegs[${index}].scheduledArrival must be string or null`;
  }
  return null;
}

function validateCandidateOption(opt, index) {
  if (!isPlainObject(opt)) return `candidateRecoveryOptions[${index}] is not an object`;
  if (typeof opt.optionId !== 'string' || opt.optionId.length === 0) {
    return `candidateRecoveryOptions[${index}].optionId must be a non-empty string`;
  }
  if (typeof opt.routeSummary !== 'string') {
    return `candidateRecoveryOptions[${index}].routeSummary must be a string`;
  }
  return null;
}

/* ── Main validation ── */

/**
 * Validates the raw input object.
 * Returns a ValidationResult.
 *
 * @param {*} input - The parsed JSON input.
 * @param {number} rawByteLength - The byte length of the raw JSON string.
 * @returns {ValidationResult}
 */
export function validateInput(input, rawByteLength) {
  // 1. Size check
  if (typeof rawByteLength === 'number' && rawByteLength > MAX_INPUT_BYTES) {
    return {
      valid: false,
      errorCode: 'input_oversized',
      errorMessage: `Input exceeds maximum size of ${MAX_INPUT_BYTES} bytes (${rawByteLength} bytes received)`,
    };
  }

  // 2. Type check
  if (!isPlainObject(input)) {
    return {
      valid: false,
      errorCode: 'malformed_input',
      errorMessage: 'Input must be a JSON object',
    };
  }

  // 3. Forbidden key (PII / secret) check
  const forbiddenKey = containsForbiddenKey(input);
  if (forbiddenKey) {
    return {
      valid: false,
      errorCode: 'forbidden_key',
      errorMessage: `Input contains forbidden key "${forbiddenKey.key}" at ${forbiddenKey.path}`,
    };
  }

  // 4. Forbidden operation check
  const forbiddenOp = containsForbiddenOperation(input);
  if (forbiddenOp) {
    return {
      valid: false,
      errorCode: 'unsupported_operation',
      errorMessage: `Input contains forbidden operation: "${forbiddenOp}"`,
    };
  }

  // 5. Required fields
  if (typeof input.itineraryId !== 'string' || input.itineraryId.length === 0) {
    return { valid: false, errorCode: 'missing_field', errorMessage: 'itineraryId is required' };
  }
  if (!Array.isArray(input.flightLegs) || input.flightLegs.length === 0) {
    return { valid: false, errorCode: 'missing_field', errorMessage: 'flightLegs must be a non-empty array' };
  }
  if (typeof input.deterministicSeed !== 'string' || input.deterministicSeed.length === 0) {
    return { valid: false, errorCode: 'missing_field', errorMessage: 'deterministicSeed is required' };
  }
  if (typeof input.scenarioLimit !== 'number' || !Number.isFinite(input.scenarioLimit)) {
    return { valid: false, errorCode: 'missing_field', errorMessage: 'scenarioLimit must be a finite number' };
  }

  // 6. Bounds
  if (input.flightLegs.length > MAX_FLIGHT_LEGS) {
    return {
      valid: false,
      errorCode: 'invalid_scenario_count',
      errorMessage: `flightLegs exceeds maximum of ${MAX_FLIGHT_LEGS}`,
    };
  }
  if (input.scenarioLimit < 1 || input.scenarioLimit > MAX_SCENARIO_LIMIT) {
    return {
      valid: false,
      errorCode: 'invalid_scenario_count',
      errorMessage: `scenarioLimit must be between 1 and ${MAX_SCENARIO_LIMIT}`,
    };
  }
  if (typeof input.rePlanAttempts === 'number' && input.rePlanAttempts > MAX_REPLAN_ATTEMPTS) {
    return {
      valid: false,
      errorCode: 'replan_limit_exceeded',
      errorMessage: `rePlanAttempts exceeds maximum of ${MAX_REPLAN_ATTEMPTS}`,
    };
  }

  // 7. Validate each flight leg
  for (let i = 0; i < input.flightLegs.length; i++) {
    const err = validateFlightLeg(input.flightLegs[i], i);
    if (err) {
      return { valid: false, errorCode: 'malformed_input', errorMessage: err };
    }
  }

  // 8. Optional fields
  if (input.connectionDurationMinutes !== undefined &&
      input.connectionDurationMinutes !== null &&
      typeof input.connectionDurationMinutes !== 'number') {
    return { valid: false, errorCode: 'malformed_input', errorMessage: 'connectionDurationMinutes must be number or null' };
  }

  if (input.downstreamCommitments !== undefined) {
    if (!Array.isArray(input.downstreamCommitments)) {
      return { valid: false, errorCode: 'malformed_input', errorMessage: 'downstreamCommitments must be an array' };
    }
    if (input.downstreamCommitments.length > MAX_DOWNSTREAM_COMMITMENTS) {
      return {
        valid: false,
        errorCode: 'invalid_scenario_count',
        errorMessage: `downstreamCommitments exceeds maximum of ${MAX_DOWNSTREAM_COMMITMENTS}`,
      };
    }
  }

  if (input.candidateRecoveryOptions !== undefined) {
    if (!Array.isArray(input.candidateRecoveryOptions)) {
      return { valid: false, errorCode: 'malformed_input', errorMessage: 'candidateRecoveryOptions must be an array' };
    }
    if (input.candidateRecoveryOptions.length > MAX_CANDIDATE_OPTIONS) {
      return {
        valid: false,
        errorCode: 'invalid_scenario_count',
        errorMessage: `candidateRecoveryOptions exceeds maximum of ${MAX_CANDIDATE_OPTIONS}`,
      };
    }
    for (let i = 0; i < input.candidateRecoveryOptions.length; i++) {
      const err = validateCandidateOption(input.candidateRecoveryOptions[i], i);
      if (err) {
        return { valid: false, errorCode: 'malformed_input', errorMessage: err };
      }
    }
  }

  return { valid: true, errorCode: null, errorMessage: null };
}
