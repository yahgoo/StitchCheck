// Daytona Atlas worker — output sanitization module.
//
// This module runs INSIDE the Daytona sandbox. It sanitizes worker
// output before writing to the evidence file, ensuring no credentials,
// PII, or forbidden keys leak into the output.
//
// The orchestrator performs a second sanitization pass after download.

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
 * Validates that an object contains no forbidden keys.
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

export { FORBIDDEN_KEYS };
