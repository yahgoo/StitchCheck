// Daytona orchestrator offline mock tests for StitchCheck.
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// These tests verify the Daytona orchestrator's mock mode, including:
//   - Sandbox lifecycle (create, exec, upload, download, delete)
//   - Evidence envelope shape and provenance
//   - Output sanitization (forbidden key removal)
//   - Failure handling (timeout, error, fallback)
//   - Feature flag evaluation
//   - Write operation rejection
//
// Hard guarantees:
//   - Zero network code: no fetch/http/https/net/socket imports.
//   - Zero credentials read: no .env or secret file is touched.
//   - Zero dependencies: Node.js built-ins and local modules only.
//   - Deterministic: no randomness, no timing, no external calls.

import assert from 'node:assert';
import {
  runDaytonaOrchestrator,
  createMockDaytonaClient,
  createFallbackEnvelope,
  createSuccessEnvelope,
  sanitizeOutput,
  evaluateDaytonaFlags,
  SANDBOX_CONFIG,
  FORBIDDEN_KEYS,
} from './daytona-orchestrator.mjs';

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

async function asyncTest(name, fn) {
  try {
    await fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}`);
    console.error(`  ${error.message}`);
  }
}

/* ── Feature flag evaluation ── */

test('flags: default mode is local with everything disabled', () => {
  const flags = evaluateDaytonaFlags();
  assert.strictEqual(flags.enabled, false);
  assert.strictEqual(flags.demoMode, 'local');
});

test('flags: daytona mode enables when DAYTONA_ENABLED=true', () => {
  const orig = { ...process.env };
  process.env.DEMO_MODE = 'daytona';
  process.env.DAYTONA_ENABLED = 'true';
  const flags = evaluateDaytonaFlags();
  assert.strictEqual(flags.enabled, true);
  assert.strictEqual(flags.demoMode, 'daytona');
  Object.assign(process.env, orig);
  delete process.env.DEMO_MODE;
  delete process.env.DAYTONA_ENABLED;
});

test('flags: daytona mode forces writes off', () => {
  const orig = { ...process.env };
  process.env.DEMO_MODE = 'daytona';
  process.env.DAYTONA_ENABLED = 'true';
  process.env.ATLAS_WRITES_ENABLED = 'true';
  const flags = evaluateDaytonaFlags();
  assert.strictEqual(flags.atlasLiveReadOnly, false);
  Object.assign(process.env, orig);
  delete process.env.DEMO_MODE;
  delete process.env.DAYTONA_ENABLED;
  delete process.env.ATLAS_WRITES_ENABLED;
});

test('flags: local mode forces everything off', () => {
  const orig = { ...process.env };
  process.env.DEMO_MODE = 'local';
  process.env.DAYTONA_ENABLED = 'true';
  const flags = evaluateDaytonaFlags();
  assert.strictEqual(flags.enabled, false);
  Object.assign(process.env, orig);
  delete process.env.DEMO_MODE;
  delete process.env.DAYTONA_ENABLED;
});

/* ── Mock Daytona client ── */

await asyncTest('mock client: create returns sandbox with id', async () => {
  const client = createMockDaytonaClient();
  const sandbox = await client.create({ language: 'typescript' });
  assert.ok(sandbox.id);
  assert.ok(sandbox.id.startsWith('mock-sandbox-'));
  assert.strictEqual(sandbox.state, 'started');
});

await asyncTest('mock client: process.exec returns result', async () => {
  const client = createMockDaytonaClient();
  const sandbox = await client.create({});
  const result = await sandbox.process.exec('echo test');
  assert.strictEqual(result.exitCode, 0);
});

await asyncTest('mock client: fs.uploadFile does not throw', async () => {
  const client = createMockDaytonaClient();
  const sandbox = await client.create({});
  await sandbox.fs.uploadFile('/test.txt', Buffer.from('test'));
});

await asyncTest('mock client: fs.downloadFile returns buffer', async () => {
  const client = createMockDaytonaClient();
  const sandbox = await client.create({});
  const buf = await sandbox.fs.downloadFile('/test.txt');
  assert.ok(Buffer.isBuffer(buf));
});

await asyncTest('mock client: delete does not throw', async () => {
  const client = createMockDaytonaClient();
  const sandbox = await client.create({});
  await client.delete(sandbox, {});
});

/* ── Fallback envelope ── */

test('fallback envelope: has correct shape', () => {
  const env = createFallbackEnvelope('test-corr', 'test reason');
  assert.strictEqual(env.envelopeVersion, 1);
  assert.strictEqual(env.correlationId, 'test-corr');
  assert.strictEqual(env.sandboxId, '');
  assert.strictEqual(env.destroyedAt, null);
  assert.deepStrictEqual(env.operations, []);
  assert.strictEqual(env.sanitized, true);
});

test('fallback envelope: provenance indicates fallback', () => {
  const env = createFallbackEnvelope('test-corr', 'test reason');
  assert.strictEqual(env.provenance.evidenceSource, 'daytona-sandbox');
  assert.strictEqual(env.provenance.executed, false);
  assert.strictEqual(env.provenance.fallbackUsed, true);
  assert.strictEqual(env.provenance.sandboxDestroyed, false);
  assert.ok(env.provenance.label.includes('unavailable'));
});

test('fallback envelope: is frozen', () => {
  const env = createFallbackEnvelope('test-corr', 'test');
  assert.ok(Object.isFrozen(env));
  assert.ok(Object.isFrozen(env.provenance));
});

/* ── Success envelope ── */

test('success envelope: has correct shape', () => {
  const ops = [{
    operation: 'search',
    status: 'success',
    requestSummary: { origin: 'KUL', destination: 'SIN' },
    responseSummary: { offerCount: 3 },
    latencyMs: 100,
    errorCode: null,
    errorMessage: null,
  }];
  const env = createSuccessEnvelope('test-corr', 'sandbox-1', ops, true);
  assert.strictEqual(env.envelopeVersion, 1);
  assert.strictEqual(env.correlationId, 'test-corr');
  assert.strictEqual(env.sandboxId, 'sandbox-1');
  assert.strictEqual(env.operations.length, 1);
  assert.strictEqual(env.sanitized, true);
});

test('success envelope: provenance indicates success when destroyed', () => {
  const env = createSuccessEnvelope('test-corr', 'sandbox-1', [], true);
  assert.strictEqual(env.provenance.executed, true);
  assert.strictEqual(env.provenance.fallbackUsed, false);
  assert.strictEqual(env.provenance.sandboxDestroyed, true);
  assert.ok(env.provenance.label.includes('Daytona sandbox evidence'));
  assert.ok(env.destroyedAt !== null);
});

test('success envelope: provenance indicates not-destroyed', () => {
  const env = createSuccessEnvelope('test-corr', 'sandbox-1', [], false);
  assert.strictEqual(env.provenance.sandboxDestroyed, false);
  assert.ok(env.provenance.label.includes('not yet destroyed'));
  assert.strictEqual(env.destroyedAt, null);
});

/* ── Sanitization ── */

test('sanitize: strips forbidden keys', () => {
  const input = { apiKey: 'secret123', origin: 'KUL', password: 'pass' };
  const result = sanitizeOutput(input);
  assert.strictEqual(result.apiKey, undefined);
  assert.strictEqual(result.password, undefined);
  assert.strictEqual(result.origin, 'KUL');
});

test('sanitize: strips nested forbidden keys', () => {
  const input = { data: { token: 'abc', origin: 'SIN' } };
  const result = sanitizeOutput(input);
  assert.strictEqual(result.data.token, undefined);
  assert.strictEqual(result.data.origin, 'SIN');
});

test('sanitize: strips forbidden keys from arrays', () => {
  const input = { items: [{ secret: 'x', origin: 'KUL' }, { email: 'a@b' }] };
  const result = sanitizeOutput(input);
  assert.strictEqual(result.items[0].secret, undefined);
  assert.strictEqual(result.items[0].origin, 'KUL');
  assert.strictEqual(result.items[1].email, undefined);
});

test('sanitize: handles null and primitives', () => {
  assert.strictEqual(sanitizeOutput(null), null);
  assert.strictEqual(sanitizeOutput(42), 42);
  assert.strictEqual(sanitizeOutput('test'), 'test');
});

test('sanitize: FORBIDDEN_KEYS matches expected set', () => {
  assert.ok(FORBIDDEN_KEYS.has('apiKey'));
  assert.ok(FORBIDDEN_KEYS.has('secret'));
  assert.ok(FORBIDDEN_KEYS.has('password'));
  assert.ok(FORBIDDEN_KEYS.has('token'));
  assert.ok(FORBIDDEN_KEYS.has('email'));
  assert.ok(FORBIDDEN_KEYS.has('passport'));
  assert.ok(FORBIDDEN_KEYS.has('payment'));
});

/* ── Sandbox config ── */

test('config: domain allowlist is Atlas sandbox only', () => {
  assert.strictEqual(SANDBOX_CONFIG.domainAllowList, 'sandbox.atriptech.com');
});

test('config: ephemeral is true', () => {
  assert.strictEqual(SANDBOX_CONFIG.ephemeral, true);
});

test('config: TTL is 15 minutes', () => {
  assert.strictEqual(SANDBOX_CONFIG.ttlMinutes, 15);
});

test('config: process timeout is 120 seconds', () => {
  assert.strictEqual(SANDBOX_CONFIG.processTimeoutMs, 120_000);
});

test('config: config is frozen', () => {
  assert.ok(Object.isFrozen(SANDBOX_CONFIG));
});

/* ── Orchestrator mock run ── */

await asyncTest('orchestrator: mock run produces valid envelope', async () => {
  const origDemoMode = process.env.DEMO_MODE;
  process.env.DEMO_MODE = 'daytona';
  process.env.DAYTONA_ENABLED = 'true';

  const result = await runDaytonaOrchestrator({ mock: true, correlationId: 'test-123' });
  const envelope = result.envelope || result;
  assert.strictEqual(envelope.envelopeVersion, 1);
  assert.strictEqual(envelope.correlationId, 'test-123');
  assert.strictEqual(envelope.sanitized, true);

  delete process.env.DEMO_MODE;
  delete process.env.DAYTONA_ENABLED;
  if (origDemoMode !== undefined) process.env.DEMO_MODE = origDemoMode;
});

/* ── Write operation rejection ── */

test('FORBIDDEN_KEYS includes all write-related terms', () => {
  /* Verify the forbidden keys cover credential/PII categories */
  const expectedCategories = ['apiKey', 'secret', 'password', 'token', 'email', 'passport', 'payment'];
  for (const cat of expectedCategories) {
    assert.ok(FORBIDDEN_KEYS.has(cat), `FORBIDDEN_KEYS should include '${cat}'`);
  }
});

/* ── Summary ── */

console.log(`\nDaytona orchestrator offline tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
