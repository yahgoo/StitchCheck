// Daytona risk worker — output sanitization module.
//
// Sanitizes the worker output before writing to the result file.
// Ensures no credentials, PII, raw provider payloads, environment
// variables, process arguments, or filesystem paths leak into output.
//
// The orchestrator performs a second sanitization pass after download.
//
// This module runs INSIDE the Daytona sandbox (offline mode).

/* ── Forbidden keys — consistent with core/evidence/normalizer ── */

const FORBIDDEN_KEYS = new Set([
  'apiKey', 'api_key', 'secret', 'password', 'token',
  'authorization', 'bearer', 'credential',
  'name', 'firstName', 'lastName', 'surname',
  'email', 'emailAddress', 'phone', 'phoneNumber',
  'passenger', 'passengers', 'bookingReference', 'pnr',
  'payment', 'cardNumber', 'passport', 'dateOfBirth', 'address',
]);

/**
 * Recursively strips forbidden keys from an object.
 * Returns a new object; does not mutate the input.
 */
export function sanitizeOutput(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeOutput);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    result[key] = typeof value === 'object' && value !== null
      ? sanitizeOutput(value)
      : value;
  }
  return result;
}

/**
 * Checks whether a key is forbidden (case-insensitive).
 */
export function isForbiddenKey(key) {
  return FORBIDDEN_KEYS.has(key) ||
    Array.from(FORBIDDEN_KEYS).some(fk => fk.toLowerCase() === key.toLowerCase());
}

/**
 * Validates that a sanitized object contains no forbidden keys.
 * Returns an array of issues found (empty = clean).
 */
export function validateSanitized(obj, path = '$') {
  const issues = [];
  if (obj === null || typeof obj !== 'object') return issues;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      issues.push(...validateSanitized(item, `${path}[${i}]`));
    });
    return issues;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (isForbiddenKey(key)) {
      issues.push(`forbidden key '${key}' found at ${path}`);
    }
    if (typeof value === 'object' && value !== null) {
      issues.push(...validateSanitized(value, `${path}.${key}`));
    }
  }
  return issues;
}

/**
 * Checks that the output contains no raw provider payloads,
 * environment variables, filesystem paths, or live-data claims.
 *
 * @param {Object} obj - The sanitized output object.
 * @returns {string[]} Array of issues found (empty = clean).
 */
export function validateOutputSafety(obj) {
  const issues = [];
  const serialized = JSON.stringify(obj);

  // Check for environment variable patterns
  if (/process\.env\./.test(serialized)) {
    issues.push('Output contains process.env reference');
  }

  // Check for filesystem path patterns (Unix-style absolute paths)
  if (/\/(?:Users|home|tmp|var|etc|worker)\//.test(serialized)) {
    issues.push('Output contains filesystem path');
  }

  // Check for raw provider response patterns
  const rawProviderKeys = ['rawResponse', 'rawBody', 'rawPayload', 'httpResponse'];
  for (const key of rawProviderKeys) {
    if (serialized.includes(`"${key}"`)) {
      issues.push(`Output contains raw provider key: ${key}`);
    }
  }

  // Check for live-data claims (must not claim live if offline)
  const liveClaimPatterns = [
    'live-validated',
    'live evidence',
    'live data from',
    'real-time provider',
  ];
  for (const pattern of liveClaimPatterns) {
    if (serialized.toLowerCase().includes(pattern.toLowerCase())) {
      issues.push(`Output contains live-data claim: "${pattern}"`);
    }
  }

  return issues;
}

export { FORBIDDEN_KEYS };
