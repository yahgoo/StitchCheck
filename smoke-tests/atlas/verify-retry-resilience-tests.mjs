// Deterministic retry and selection-gate tests for Atlas Verify.
// No network, credentials, or real CLI calls are used.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ATLAS_MAX_ATTEMPTS,
  RETRYABLE_ATLAS_CODES,
  execCliWithRetry,
  isRetryableAtlasResult,
} from '../../app/server/atlas-proxy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${message}`);
  }
}

function transient(code) {
  return {
    parsed: { status: 'terminal_error', code, message: 'transient failure' },
    exitCode: 1,
    timedOut: false,
    errorCode: null,
    stderr: '',
  };
}

function success() {
  return {
    parsed: { status: 'success', code: 'OFFER_VERIFIED', data: {} },
    exitCode: 0,
    timedOut: false,
    errorCode: null,
    stderr: '',
  };
}

console.log('Atlas Verify retry resilience tests\n');

assert(ATLAS_MAX_ATTEMPTS === 3, 'retry budget is exactly three attempts');
assert(RETRYABLE_ATLAS_CODES.has('SERVICE_TEMPORARILY_UNAVAILABLE'), 'service-unavailable is explicitly retryable');
assert(RETRYABLE_ATLAS_CODES.has('SECURE_STORE_UNAVAILABLE'), 'secure-store-unavailable is explicitly retryable');
assert(isRetryableAtlasResult(transient('SERVICE_TEMPORARILY_UNAVAILABLE')), 'service-unavailable response retries');
assert(isRetryableAtlasResult(transient('SECURE_STORE_UNAVAILABLE')), 'secure-store response retries');
assert(!isRetryableAtlasResult(transient('OFFER_EXPIRED')), 'non-transient offer failure does not retry');

{
  const responses = [
    transient('SERVICE_TEMPORARILY_UNAVAILABLE'),
    transient('SECURE_STORE_UNAVAILABLE'),
    success(),
  ];
  const delays = [];
  let calls = 0;
  const result = await execCliWithRetry(['offer', 'verify'], {
    execute: async () => responses[calls++],
    wait: async (ms) => { delays.push(ms); },
  });
  assert(calls === 3, 'transient Verify retries without a manual click');
  assert(delays.join(',') === '1000,2000', 'retry delays use bounded exponential backoff');
  assert(result.parsed.status === 'success', 'eventual genuine Verify success is returned');
}

{
  const delays = [];
  let calls = 0;
  const result = await execCliWithRetry(['offer', 'verify'], {
    execute: async () => {
      calls += 1;
      return transient('SERVICE_TEMPORARILY_UNAVAILABLE');
    },
    wait: async (ms) => { delays.push(ms); },
  });
  assert(calls === ATLAS_MAX_ATTEMPTS, 'sustained transient failure stops at the bounded attempt limit');
  assert(delays.length === ATLAS_MAX_ATTEMPTS - 1, 'no backoff occurs after the final failed attempt');
  assert(result.parsed.code === 'SERVICE_TEMPORARILY_UNAVAILABLE', 'final transient error remains honest after retries exhaust');
}

{
  const appSource = readFileSync(resolve(ROOT, 'app/src/App.tsx'), 'utf8');
  const gateSource = readFileSync(resolve(ROOT, 'app/src/atlas/unbooked-previews.ts'), 'utf8');
  const listSource = readFileSync(resolve(ROOT, 'app/src/components/LiveAlternativesList.tsx'), 'utf8');
  assert(gateSource.includes("return status === 'success'"), 'selection gate remains success-only');
  assert(appSource.includes('if (shouldSelectPlanAfterVerify(summary.status))'), 'App applies selection only through the success gate');
  assert(listSource.includes("isVerifying ? 'Verifying…' : 'Verify and select plan'"), 'Verify UI remains honestly in progress across proxy retries');
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
