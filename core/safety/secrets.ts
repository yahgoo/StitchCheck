/* ── Secret handling ──
 *
 * Utilities for ensuring secrets are never logged, serialized,
 * or exposed to the browser bundle. */

/**
 * Checks whether a value looks like a secret (non-empty string
 * matching common secret patterns).
 */
export function looksLikeSecret(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  const patterns = [
    /^sk-/,           // OpenAI-style
    /^ghp_/,          // GitHub PAT
    /^dtn_/,          // Daytona API key
    /^xatp_/,         // Hypothetical Atlas pattern
    /^[A-Za-z0-9_-]{32,}$/,  // Long random token
  ];
  return patterns.some((p) => p.test(value));
}

/**
 * Redacts a value for safe logging. Returns '[REDACTED]' if the
 * value looks like a secret, otherwise returns the value unchanged.
 */
export function redactForLogging(key: string, value: unknown): unknown {
  const sensitiveKeys = [
    'apikey', 'api_key', 'secret', 'password', 'token',
    'authorization', 'bearer', 'credential',
  ];
  if (sensitiveKeys.includes(key.toLowerCase())) {
    return '[REDACTED]';
  }
  if (looksLikeSecret(value)) {
    return '[REDACTED]';
  }
  return value;
}

/**
 * Creates a safe logger that redacts sensitive values before output.
 */
export function createSafeLogger(prefix: string) {
  return {
    info(message: string, data?: Record<string, unknown>): void {
      const safe = data ? redactObject(data) : undefined;
      console.log(`[${prefix}] ${message}`, safe ?? '');
    },
    error(message: string, data?: Record<string, unknown>): void {
      const safe = data ? redactObject(data) : undefined;
      console.error(`[${prefix}] ${message}`, safe ?? '');
    },
    warn(message: string, data?: Record<string, unknown>): void {
      const safe = data ? redactObject(data) : undefined;
      console.warn(`[${prefix}] ${message}`, safe ?? '');
    },
  };
}

/**
 * Recursively redacts sensitive values in an object.
 */
function redactObject(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactObject(value as Record<string, unknown>);
    } else {
      result[key] = redactForLogging(key, value);
    }
  }
  return result;
}

/**
 * Asserts that an object does not contain any secret values.
 * Throws if a forbidden key is found with a non-empty value.
 */
export function assertNoSecrets(
  obj: Record<string, unknown>,
  context: string,
): void {
  const sensitiveKeys = [
    'apikey', 'api_key', 'secret', 'password', 'token',
    'authorization', 'bearer', 'credential',
    'DAYTONA_API_KEY', 'ATLAS_CLIENT_ID', 'ATLAS_CLIENT_SECRET',
    'GEMINI_API_KEY', 'NOSANA_API_KEY', 'OPENROUTER_API_KEY',
  ];
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.includes(key) || sensitiveKeys.includes(key.toLowerCase())) {
      if (typeof value === 'string' && value.length > 0) {
        throw new Error(
          `Secret found in ${context}: key '${key}' must not be present`,
        );
      }
    }
  }
}
