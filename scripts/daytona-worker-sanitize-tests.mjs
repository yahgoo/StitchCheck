// Daytona worker sanitization offline tests.
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// Tests the sanitize.mjs module that runs inside the Daytona sandbox.
// Verifies forbidden key removal, nested object handling, and validation.

import assert from 'node:assert';
import {
  sanitizeOutput,
  isForbiddenKey,
  validateSanitized,
  FORBIDDEN_KEYS,
} from '../workers/daytona-atlas-worker/sanitize.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}`);
    console.error(`  ${error.message}`);
  }
}

/* ── sanitizeOutput ── */

test('sanitizeOutput: strips credential keys', () => {
  const input = { apiKey: 'sk-123', origin: 'KUL', token: 'abc' };
  const result = sanitizeOutput(input);
  assert.strictEqual(result.apiKey, undefined);
  assert.strictEqual(result.token, undefined);
  assert.strictEqual(result.origin, 'KUL');
});

test('sanitizeOutput: strips PII keys', () => {
  const input = { name: 'John', email: 'john@test.com', origin: 'SIN' };
  const result = sanitizeOutput(input);
  assert.strictEqual(result.name, undefined);
  assert.strictEqual(result.email, undefined);
  assert.strictEqual(result.origin, 'SIN');
});

test('sanitizeOutput: strips nested forbidden keys', () => {
  const input = {
    data: {
      offers: [{ secret: 'x', price: '100' }],
      passenger: { firstName: 'Jane' },
    },
  };
  const result = sanitizeOutput(input);
  assert.strictEqual(result.data.offers[0].secret, undefined);
  assert.strictEqual(result.data.offers[0].price, '100');
  /* 'passenger' is itself a forbidden key, so the entire field is stripped */
  assert.strictEqual(result.data.passenger, undefined);
});

test('sanitizeOutput: handles arrays', () => {
  const input = [{ apiKey: 'x' }, { origin: 'KUL' }];
  const result = sanitizeOutput(input);
  assert.strictEqual(result[0].apiKey, undefined);
  assert.strictEqual(result[1].origin, 'KUL');
});

test('sanitizeOutput: handles null', () => {
  assert.strictEqual(sanitizeOutput(null), null);
});

test('sanitizeOutput: handles primitives', () => {
  assert.strictEqual(sanitizeOutput(42), 42);
  assert.strictEqual(sanitizeOutput('hello'), 'hello');
  assert.strictEqual(sanitizeOutput(true), true);
});

test('sanitizeOutput: returns new object (no mutation)', () => {
  const input = { apiKey: 'x', origin: 'KUL' };
  const result = sanitizeOutput(input);
  assert.notStrictEqual(result, input);
  assert.strictEqual(input.apiKey, 'x');  // original unchanged
});

/* ── isForbiddenKey ── */

test('isForbiddenKey: recognizes forbidden keys', () => {
  assert.strictEqual(isForbiddenKey('apiKey'), true);
  assert.strictEqual(isForbiddenKey('secret'), true);
  assert.strictEqual(isForbiddenKey('password'), true);
  assert.strictEqual(isForbiddenKey('token'), true);
  assert.strictEqual(isForbiddenKey('email'), true);
  assert.strictEqual(isForbiddenKey('passport'), true);
});

test('isForbiddenKey: allows safe keys', () => {
  assert.strictEqual(isForbiddenKey('origin'), false);
  assert.strictEqual(isForbiddenKey('destination'), false);
  assert.strictEqual(isForbiddenKey('price'), false);
  assert.strictEqual(isForbiddenKey('offerCount'), false);
});

test('isForbiddenKey: case-insensitive', () => {
  assert.strictEqual(isForbiddenKey('APIKEY'), true);
  assert.strictEqual(isForbiddenKey('SECRET'), true);
  assert.strictEqual(isForbiddenKey('Password'), true);
});

/* ── validateSanitized ── */

test('validateSanitized: returns no issues for clean object', () => {
  const clean = { origin: 'KUL', destination: 'SIN', offerCount: 3 };
  const issues = validateSanitized(clean);
  assert.strictEqual(issues.length, 0);
});

test('validateSanitized: detects forbidden keys', () => {
  const dirty = { origin: 'KUL', apiKey: 'secret' };
  const issues = validateSanitized(dirty);
  assert.ok(issues.length > 0);
  assert.ok(issues[0].includes('apiKey'));
});

test('validateSanitized: detects nested forbidden keys', () => {
  const dirty = { data: { token: 'abc' } };
  const issues = validateSanitized(dirty);
  assert.ok(issues.length > 0);
  assert.ok(issues[0].includes('token'));
});

test('validateSanitized: handles arrays', () => {
  const dirty = [{ secret: 'x' }];
  const issues = validateSanitized(dirty);
  assert.ok(issues.length > 0);
});

/* ── FORBIDDEN_KEYS completeness ── */

test('FORBIDDEN_KEYS: contains all expected categories', () => {
  const expected = [
    'apiKey', 'api_key', 'secret', 'password', 'token',
    'authorization', 'bearer', 'credential',
    'name', 'firstName', 'lastName', 'surname',
    'email', 'emailAddress', 'phone', 'phoneNumber',
    'passenger', 'passengers', 'bookingReference', 'pnr',
    'payment', 'cardNumber', 'passport', 'dateOfBirth', 'address',
  ];
  for (const key of expected) {
    assert.ok(FORBIDDEN_KEYS.has(key), `FORBIDDEN_KEYS should include '${key}'`);
  }
});

test('FORBIDDEN_KEYS: is a Set', () => {
  assert.ok(FORBIDDEN_KEYS instanceof Set);
});

/* ── Summary ── */

console.log(`\nDaytona worker sanitize tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
