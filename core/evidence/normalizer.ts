/* ── Evidence normalization ──
 *
 * Strips forbidden keys (credentials, PII) from any object recursively.
 * Enforces evidence boundaries: every normalized result carries
 * executedAgainstProvider: false and sourceType: "synthetic-local-placeholder"
 * unless it is a verified live result.
 *
 * The forbidden-keys list is consistent with the existing
 * duplicate-booking-guard.mjs module. */

/* ── Forbidden keys — sanitized from all outputs ── */

export const FORBIDDEN_KEYS = Object.freeze([
  'apiKey',
  'api_key',
  'secret',
  'password',
  'token',
  'authorization',
  'bearer',
  'credential',
  'name',
  'firstName',
  'lastName',
  'surname',
  'email',
  'emailAddress',
  'phone',
  'phoneNumber',
  'passenger',
  'passengers',
  'bookingReference',
  'pnr',
  'payment',
  'cardNumber',
  'passport',
  'dateOfBirth',
  'address',
]);

/**
 * Recursively strips forbidden keys from an object.
 * Returns a new object; does not mutate the input.
 */
export function stripForbiddenKeys<T extends Record<string, unknown>>(
  input: T,
): Record<string, unknown> {
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input.map((item) =>
      typeof item === 'object' && item !== null
        ? stripForbiddenKeys(item as Record<string, unknown>)
        : item,
    ) as unknown as Record<string, unknown>;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_KEYS.includes(key)) continue;
    if (typeof value === 'object' && value !== null) {
      result[key] = stripForbiddenKeys(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Checks whether a key matches any forbidden key (case-insensitive).
 */
export function isForbiddenKey(key: string): boolean {
  const lower = key.toLowerCase();
  return FORBIDDEN_KEYS.some((fk) => fk.toLowerCase() === lower);
}

/**
 * Creates a normalized fallback result for when a provider is disabled.
 * The result is frozen and carries explicit evidence boundaries.
 */
export function createNormalizedFallbackResult(
  provider: string,
  reason?: string,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    provider,
    executedAgainstProvider: false,
    sourceType: 'synthetic-local-placeholder',
    fallbackUsed: true,
    syntheticDemo: true,
    errorCode: 'provider_disabled',
    errorMessage: reason ?? 'provider_not_enabled',
  });
}

/**
 * Validates that a result object has correct evidence boundaries.
 * Returns issues found (empty array = valid).
 */
export function validateEvidenceBoundary(
  result: Record<string, unknown>,
): string[] {
  const issues: string[] = [];
  if (result.executedAgainstProvider !== false && result.executedAgainstProvider !== true) {
    issues.push('executedAgainstProvider must be a boolean');
  }
  if (!result.sourceType || typeof result.sourceType !== 'string') {
    issues.push('sourceType must be a non-empty string');
  }
  /* Check for any forbidden keys in the result */
  for (const key of Object.keys(result)) {
    if (isForbiddenKey(key)) {
      issues.push(`forbidden key found: ${key}`);
    }
  }
  return issues;
}
