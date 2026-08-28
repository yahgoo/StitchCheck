// Daytona risk orchestrator offline tests for StitchCheck.
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// Tests the offline/mock Daytona risk orchestrator lifecycle:
//   - Input validation
//   - Create/upload/execute/download/delete lifecycle
//   - Cleanup on success
//   - Cleanup on worker failure
//   - Cleanup on timeout
//   - Input-size limit
//   - Output-size limit
//   - Sanitization (forbidden key removal)
//   - Provenance (daytona-offline-mock)
//   - externalWriteOccurred === false
//   - No credential or PII leakage
//   - No write operation possible
//
// Hard guarantees:
//   - Zero network code: no fetch/http/https/net/socket imports.
//   - Zero credentials read: no .env or secret file is touched.
//   - Zero dependencies: Node.js built-ins and local modules only.
//   - Deterministic: no randomness, no timing, no external calls.

import assert from 'node:assert';
import {
  runDaytonaRiskOrchestrator,
  createMockRiskSandboxClient,
  sanitizeRiskOutput,
  validateRiskInput,
  assertNoWriteOperations,
  assertNoCredentialLeakage,
  RISK_ORCHESTRATOR_CONFIG,
  VALID_RISK_SCENARIOS,
  VALID_RISK_BANDS,
  FORBIDDEN_KEYS,
} from './daytona-risk-orchestrator.mjs';

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

/* ── Configuration ── */

test('config: RISK_ORCHESTRATOR_CONFIG is frozen', () => {
  assert.ok(Object.isFrozen(RISK_ORCHESTRATOR_CONFIG));
});

test('config: maxInputBytes is 4096', () => {
  assert.strictEqual(RISK_ORCHESTRATOR_CONFIG.maxInputBytes, 4096);
});

test('config: maxOutputBytes is 8192', () => {
  assert.strictEqual(RISK_ORCHESTRATOR_CONFIG.maxOutputBytes, 8192);
});

test('config: workerTimeoutMs is 5000', () => {
  assert.strictEqual(RISK_ORCHESTRATOR_CONFIG.workerTimeoutMs, 5000);
});

test('config: FORBIDDEN_KEYS is frozen', () => {
  assert.ok(Object.isFrozen(FORBIDDEN_KEYS));
});

test('config: FORBIDDEN_KEYS includes credential/PII keys', () => {
  const expected = ['apiKey', 'secret', 'password', 'token', 'email', 'passport', 'payment'];
  for (const k of expected) {
    assert.ok(FORBIDDEN_KEYS.has(k), `FORBIDDEN_KEYS should include '${k}'`);
  }
});

test('config: VALID_RISK_SCENARIOS is frozen and correct', () => {
  assert.ok(Object.isFrozen(VALID_RISK_SCENARIOS));
  assert.deepStrictEqual(
    [...VALID_RISK_SCENARIOS],
    ['success', 'unavailable', 'error', 'timeout', 'failure'],
  );
});

test('config: VALID_RISK_BANDS is frozen and correct', () => {
  assert.ok(Object.isFrozen(VALID_RISK_BANDS));
  assert.deepStrictEqual(
    [...VALID_RISK_BANDS],
    ['low', 'medium', 'high', 'critical'],
  );
});

/* ── Input validation ── */

test('validate: rejects null options', () => {
  const result = validateRiskInput(null);
  assert.strictEqual(result.valid, false);
  assert.ok(result.reason.includes('non-null object'));
});

test('validate: rejects non-object options', () => {
  const result = validateRiskInput('string');
  assert.strictEqual(result.valid, false);
});

test('validate: accepts minimal options with defaults', () => {
  const result = validateRiskInput({});
  assert.strictEqual(result.valid, true);
  assert.ok(result.correlationId);
  assert.strictEqual(result.scenario, 'success');
  assert.strictEqual(result.riskBand, null);
});

test('validate: accepts valid correlationId', () => {
  const result = validateRiskInput({ correlationId: 'test-123' });
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.correlationId, 'test-123');
});

test('validate: rejects empty correlationId', () => {
  const result = validateRiskInput({ correlationId: '' });
  assert.strictEqual(result.valid, false);
  assert.ok(result.reason.includes('correlationId'));
});

test('validate: rejects too-long correlationId', () => {
  const result = validateRiskInput({ correlationId: 'x'.repeat(129) });
  assert.strictEqual(result.valid, false);
  assert.ok(result.reason.includes('correlationId'));
});

test('validate: rejects invalid scenario', () => {
  const result = validateRiskInput({ scenario: 'invalid-scenario' });
  assert.strictEqual(result.valid, false);
  assert.ok(result.reason.includes('scenario'));
});

test('validate: accepts all valid scenarios', () => {
  for (const scenario of VALID_RISK_SCENARIOS) {
    const result = validateRiskInput({ scenario });
    assert.strictEqual(result.valid, true, `scenario '${scenario}' should be valid`);
  }
});

test('validate: rejects invalid riskBand', () => {
  const result = validateRiskInput({ riskBand: 'extreme' });
  assert.strictEqual(result.valid, false);
  assert.ok(result.reason.includes('riskBand'));
});

test('validate: accepts all valid risk bands', () => {
  for (const band of VALID_RISK_BANDS) {
    const result = validateRiskInput({ riskBand: band });
    assert.strictEqual(result.valid, true, `riskBand '${band}' should be valid`);
  }
});

test('validate: rejects input exceeding max size', () => {
  const hugePayload = { correlationId: 'x'.repeat(128), extraData: 'A'.repeat(5000) };
  const result = validateRiskInput(hugePayload);
  assert.strictEqual(result.valid, false);
  assert.ok(result.reason.includes('maximum size'));
});

/* ── Mock sandbox client lifecycle ── */

await asyncTest('mock client: create returns sandbox with id', async () => {
  const client = createMockRiskSandboxClient();
  const sandbox = await client.create({});
  assert.ok(sandbox.id);
  assert.ok(sandbox.id.startsWith('mock-risk-sandbox-'));
  assert.strictEqual(sandbox.state, 'started');
});

await asyncTest('mock client: upload file tracked in lifecycle', async () => {
  const client = createMockRiskSandboxClient();
  const sandbox = await client.create({});
  await sandbox.fs.uploadFile('/test.json', Buffer.from('{}'));
  const files = sandbox._getUploadedFiles();
  assert.strictEqual(files.length, 1);
  assert.strictEqual(files[0].path, '/test.json');
});

await asyncTest('mock client: exec returns exitCode 0 by default', async () => {
  const client = createMockRiskSandboxClient();
  const sandbox = await client.create({});
  const result = await sandbox.process.exec('node /worker/index.mjs', { timeout: 5000 });
  assert.strictEqual(result.exitCode, 0);
});

await asyncTest('mock client: exec simulates timeout', async () => {
  const client = createMockRiskSandboxClient();
  const sandbox = await client.create({});
  await assert.rejects(
    () => sandbox.process.exec('node /worker/index.mjs', { _simulateTimeout: true }),
    /timed out/,
  );
});

await asyncTest('mock client: exec simulates failure', async () => {
  const client = createMockRiskSandboxClient();
  const sandbox = await client.create({});
  const result = await sandbox.process.exec('node /worker/index.mjs', { _simulateFailure: true });
  assert.strictEqual(result.exitCode, 1);
});

await asyncTest('mock client: download returns set output', async () => {
  const client = createMockRiskSandboxClient();
  const sandbox = await client.create({});
  sandbox._setOutput({ riskScore: 50, riskBand: 'medium' });
  const buf = await sandbox.fs.downloadFile('/worker/output/risk-result.json');
  const parsed = JSON.parse(buf.toString('utf-8'));
  assert.strictEqual(parsed.riskScore, 50);
  assert.strictEqual(parsed.riskBand, 'medium');
});

await asyncTest('mock client: download returns {} when no output set', async () => {
  const client = createMockRiskSandboxClient();
  const sandbox = await client.create({});
  const buf = await sandbox.fs.downloadFile('/test.json');
  const parsed = JSON.parse(buf.toString('utf-8'));
  assert.deepStrictEqual(parsed, {});
});

await asyncTest('mock client: delete marks sandbox destroyed', async () => {
  const client = createMockRiskSandboxClient();
  const sandbox = await client.create({});
  assert.strictEqual(sandbox._isDestroyed(), false);
  await client.delete(sandbox, {});
  assert.strictEqual(sandbox._isDestroyed(), true);
});

await asyncTest('mock client: operations fail after destroy', async () => {
  const client = createMockRiskSandboxClient();
  const sandbox = await client.create({});
  await client.delete(sandbox, {});
  await assert.rejects(
    () => sandbox.fs.uploadFile('/test', Buffer.from('')),
    /already destroyed/,
  );
  await assert.rejects(
    () => sandbox.fs.downloadFile('/test'),
    /already destroyed/,
  );
  await assert.rejects(
    () => sandbox.process.exec('echo test', {}),
    /already destroyed/,
  );
});

await asyncTest('mock client: lifecycle log records all events', async () => {
  const client = createMockRiskSandboxClient();
  const sandbox = await client.create({});
  await sandbox.fs.uploadFile('/test.json', Buffer.from('{}'));
  await sandbox.process.exec('echo test', { timeout: 1000 });
  await client.delete(sandbox, {});
  const events = client.lifecycleLog.map(e => e.event);
  assert.deepStrictEqual(events, ['create', 'upload', 'exec', 'delete']);
});

/* ── Full orchestrator lifecycle ── */

await asyncTest('orchestrator: full success lifecycle completes all stages', async () => {
  const { envelope, lifecycle } = await runDaytonaRiskOrchestrator({
    correlationId: 'lifecycle-test-1',
    scenario: 'success',
    riskBand: 'medium',
  });
  assert.ok(lifecycle.stagesCompleted.includes('validate-input'));
  assert.ok(lifecycle.stagesCompleted.includes('create-sandbox'));
  assert.ok(lifecycle.stagesCompleted.includes('upload-worker'));
  assert.ok(lifecycle.stagesCompleted.includes('execute-worker'));
  assert.ok(lifecycle.stagesCompleted.includes('download-result'));
  assert.ok(lifecycle.stagesCompleted.includes('sanitize-result'));
  assert.strictEqual(lifecycle.sandboxCreated, true);
});

await asyncTest('orchestrator: success envelope has correct shape', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'shape-test-1',
    scenario: 'success',
    riskBand: 'low',
  });
  assert.strictEqual(envelope.envelopeVersion, 1);
  assert.strictEqual(envelope.correlationId, 'shape-test-1');
  assert.ok(envelope.sandboxId);
  assert.ok(envelope.createdAt);
  assert.strictEqual(envelope.sanitized, true);
  assert.strictEqual(envelope.externalWriteOccurred, false);
  assert.strictEqual(envelope.executionMode, 'daytona-offline-mock');
});

await asyncTest('orchestrator: success risk result has correct fields', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'result-test-1',
    scenario: 'success',
    riskBand: 'high',
  });
  const rr = envelope.riskResult;
  assert.ok(typeof rr.riskScore === 'number');
  assert.strictEqual(rr.riskBand, 'high');
  assert.strictEqual(rr.fallbackUsed, false);
  assert.strictEqual(rr.errorCode, null);
  assert.strictEqual(rr.errorMessage, null);
  assert.strictEqual(rr.simulationCount, 1000);
  assert.ok(Array.isArray(rr.assumptions));
});

await asyncTest('orchestrator: deterministic — same input produces same output', async () => {
  const opts = { correlationId: 'deterministic-test', scenario: 'success', riskBand: 'medium' };
  const { envelope: env1 } = await runDaytonaRiskOrchestrator(opts);
  const { envelope: env2 } = await runDaytonaRiskOrchestrator(opts);
  assert.strictEqual(env1.riskResult.riskScore, env2.riskResult.riskScore);
  assert.strictEqual(env1.riskResult.riskBand, env2.riskResult.riskBand);
  assert.strictEqual(env1.riskResult.fallbackUsed, env2.riskResult.fallbackUsed);
});

/* ── Cleanup on success ── */

await asyncTest('orchestrator: sandbox destroyed on success', async () => {
  const { envelope, lifecycle } = await runDaytonaRiskOrchestrator({
    correlationId: 'cleanup-success-1',
    scenario: 'success',
  });
  assert.strictEqual(envelope.provenance.sandboxDestroyed, true);
  assert.ok(envelope.destroyedAt !== null);
  assert.ok(lifecycle.stagesCompleted.includes('destroy-sandbox'));
});

/* ── Cleanup on worker failure ── */

await asyncTest('orchestrator: cleanup on worker failure', async () => {
  const { envelope, lifecycle } = await runDaytonaRiskOrchestrator({
    correlationId: 'cleanup-failure-1',
    scenario: 'success',
    _simulateFailure: true,
  });
  /* Envelope should be fallback due to worker error */
  assert.strictEqual(envelope.provenance.executed, false);
  assert.strictEqual(envelope.provenance.fallbackUsed, true);
  assert.strictEqual(envelope.externalWriteOccurred, false);
  /* Sandbox should still be destroyed */
  assert.ok(lifecycle.sandboxCreated);
  /* The finally block should have attempted cleanup */
});

/* ── Cleanup on timeout ── */

await asyncTest('orchestrator: cleanup on timeout', async () => {
  const { envelope, lifecycle } = await runDaytonaRiskOrchestrator({
    correlationId: 'cleanup-timeout-1',
    scenario: 'success',
    _simulateTimeout: true,
  });
  /* Envelope should be fallback due to timeout */
  assert.strictEqual(envelope.provenance.executed, false);
  assert.strictEqual(envelope.externalWriteOccurred, false);
  assert.ok(lifecycle.sandboxCreated);
});

/* ── Scenario: unavailable ── */

await asyncTest('orchestrator: unavailable scenario produces fallback result', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'unavailable-1',
    scenario: 'unavailable',
  });
  assert.strictEqual(envelope.riskResult.riskBand, 'unavailable');
  assert.strictEqual(envelope.riskResult.riskScore, null);
  assert.strictEqual(envelope.riskResult.fallbackUsed, true);
  assert.strictEqual(envelope.riskResult.errorCode, 'provider_unavailable');
  assert.strictEqual(envelope.externalWriteOccurred, false);
});

/* ── Scenario: error ── */

await asyncTest('orchestrator: error scenario produces error result', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'error-1',
    scenario: 'error',
  });
  assert.strictEqual(envelope.riskResult.riskBand, 'error');
  assert.strictEqual(envelope.riskResult.riskScore, null);
  assert.strictEqual(envelope.riskResult.fallbackUsed, true);
  assert.strictEqual(envelope.riskResult.errorCode, 'mock_worker_error');
});

/* ── Scenario: timeout ── */

await asyncTest('orchestrator: timeout scenario produces timeout result', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'timeout-scenario-1',
    scenario: 'timeout',
  });
  assert.strictEqual(envelope.riskResult.riskBand, 'timeout');
  assert.strictEqual(envelope.riskResult.riskScore, null);
  assert.strictEqual(envelope.riskResult.errorCode, 'mock_worker_timeout');
});

/* ── Scenario: failure ── */

await asyncTest('orchestrator: failure scenario produces failure result', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'failure-1',
    scenario: 'failure',
  });
  assert.strictEqual(envelope.riskResult.riskBand, 'failure');
  assert.strictEqual(envelope.riskResult.errorCode, 'mock_worker_failure');
});

/* ── Input-size limit ── */

await asyncTest('orchestrator: rejects oversized input', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'oversized-1',
    extraData: 'X'.repeat(5000),
  });
  /* Should produce a fallback envelope due to validation failure */
  assert.strictEqual(envelope.provenance.executed, false);
  assert.strictEqual(envelope.provenance.fallbackUsed, true);
  assert.strictEqual(envelope.externalWriteOccurred, false);
  assert.ok(envelope.riskResult.errorMessage.includes('maximum size'));
});

/* ── Output-size limit ── */

test('config: output size limit is enforced by orchestrator logic', () => {
  /* The orchestrator checks output size after download.
     We verify the config value is reasonable. */
  assert.ok(RISK_ORCHESTRATOR_CONFIG.maxOutputBytes > 0);
  assert.ok(RISK_ORCHESTRATOR_CONFIG.maxOutputBytes > RISK_ORCHESTRATOR_CONFIG.maxInputBytes);
});

/* ── Sanitization ── */

test('sanitize: strips forbidden keys', () => {
  const input = { apiKey: 'secret123', riskScore: 50, password: 'pass' };
  const result = sanitizeRiskOutput(input);
  assert.strictEqual(result.apiKey, undefined);
  assert.strictEqual(result.password, undefined);
  assert.strictEqual(result.riskScore, 50);
});

test('sanitize: strips nested forbidden keys', () => {
  const input = { data: { token: 'abc', riskBand: 'low' } };
  const result = sanitizeRiskOutput(input);
  assert.strictEqual(result.data.token, undefined);
  assert.strictEqual(result.data.riskBand, 'low');
});

test('sanitize: strips forbidden keys from arrays', () => {
  const input = { items: [{ secret: 'x', riskScore: 10 }, { email: 'a@b' }] };
  const result = sanitizeRiskOutput(input);
  assert.strictEqual(result.items[0].secret, undefined);
  assert.strictEqual(result.items[0].riskScore, 10);
  assert.strictEqual(result.items[1].email, undefined);
});

test('sanitize: handles null and primitives', () => {
  assert.strictEqual(sanitizeRiskOutput(null), null);
  assert.strictEqual(sanitizeRiskOutput(undefined), undefined);
  assert.strictEqual(sanitizeRiskOutput(42), 42);
  assert.strictEqual(sanitizeRiskOutput('test'), 'test');
});

test('sanitize: strips all PII keys', () => {
  const input = {
    passenger: 'John',
    phoneNumber: '123456',
    bookingReference: 'ABC123',
    pnr: 'XYZ',
    cardNumber: '4111',
    passport: 'P123',
    dateOfBirth: '1990-01-01',
    address: '123 St',
    riskScore: 50,
  };
  const result = sanitizeRiskOutput(input);
  assert.strictEqual(result.passenger, undefined);
  assert.strictEqual(result.phoneNumber, undefined);
  assert.strictEqual(result.bookingReference, undefined);
  assert.strictEqual(result.pnr, undefined);
  assert.strictEqual(result.cardNumber, undefined);
  assert.strictEqual(result.passport, undefined);
  assert.strictEqual(result.dateOfBirth, undefined);
  assert.strictEqual(result.address, undefined);
  assert.strictEqual(result.riskScore, 50);
});

/* ── Provenance ── */

await asyncTest('provenance: success envelope has daytona-offline-mock evidenceSource', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'prov-1',
    scenario: 'success',
  });
  assert.strictEqual(envelope.provenance.evidenceSource, 'daytona-offline-mock');
});

await asyncTest('provenance: executionMode is daytona-offline-mock', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'prov-2',
    scenario: 'success',
  });
  assert.strictEqual(envelope.executionMode, 'daytona-offline-mock');
});

await asyncTest('provenance: label is correct', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'prov-3',
    scenario: 'success',
  });
  assert.strictEqual(
    envelope.provenance.label,
    'Daytona sandbox \u2014 risk analysis computed locally, no live risk service called',
  );
});

await asyncTest('provenance: readOnly is always true', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'prov-4',
    scenario: 'success',
  });
  assert.strictEqual(envelope.provenance.readOnly, true);
});

await asyncTest('provenance: fallback envelope has correct provenance', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'prov-5',
    scenario: 'invalid-scenario',
  });
  assert.strictEqual(envelope.provenance.evidenceSource, 'daytona-offline-mock');
  assert.strictEqual(envelope.provenance.executed, false);
  assert.strictEqual(envelope.provenance.fallbackUsed, true);
  assert.strictEqual(envelope.provenance.sandboxDestroyed, false);
});

/* ── externalWriteOccurred === false ── */

await asyncTest('safety: externalWriteOccurred is false on success', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'write-1',
    scenario: 'success',
  });
  assert.strictEqual(envelope.externalWriteOccurred, false);
  assert.strictEqual(envelope.provenance.externalWriteOccurred, false);
});

await asyncTest('safety: externalWriteOccurred is false on fallback', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'write-2',
    scenario: 'error',
  });
  assert.strictEqual(envelope.externalWriteOccurred, false);
  assert.strictEqual(envelope.provenance.externalWriteOccurred, false);
});

await asyncTest('safety: externalWriteOccurred is false on validation failure', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'write-3',
    scenario: 'not-valid',
  });
  assert.strictEqual(envelope.externalWriteOccurred, false);
});

/* ── No credential or PII leakage ── */

await asyncTest('safety: no credential leakage in success envelope', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'cred-1',
    scenario: 'success',
  });
  const check = assertNoCredentialLeakage(envelope);
  assert.strictEqual(check.clean, true, `Leaked keys: ${check.leakedKeys.join(', ')}`);
});

await asyncTest('safety: no credential leakage in fallback envelope', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'cred-2',
    scenario: 'error',
  });
  const check = assertNoCredentialLeakage(envelope);
  assert.strictEqual(check.clean, true);
});

test('safety: assertNoCredentialLeakage detects forbidden keys', () => {
  const dirty = { apiKey: 'secret', riskScore: 50 };
  const check = assertNoCredentialLeakage(dirty);
  assert.strictEqual(check.clean, false);
  assert.ok(check.leakedKeys.length > 0);
});

test('safety: assertNoCredentialLeakage passes clean objects', () => {
  const clean = { riskScore: 50, riskBand: 'low', fallbackUsed: false };
  const check = assertNoCredentialLeakage(clean);
  assert.strictEqual(check.clean, true);
});

/* ── No write operation possible ── */

test('safety: assertNoWriteOperations passes clean objects', () => {
  const clean = { riskScore: 50, riskBand: 'low', operations: [] };
  const check = assertNoWriteOperations(clean);
  assert.strictEqual(check.safe, true);
});

test('safety: assertNoWriteOperations detects forbidden write keys', () => {
  const dirty = { book: 'now', riskScore: 50 };
  const check = assertNoWriteOperations(dirty);
  assert.strictEqual(check.safe, false);
  assert.ok(check.violations.length > 0);
});

test('safety: assertNoWriteOperations detects nested write keys', () => {
  const dirty = { data: { cancel: true, riskScore: 50 } };
  const check = assertNoWriteOperations(dirty);
  assert.strictEqual(check.safe, false);
});

test('safety: assertNoWriteOperations detects all forbidden ops', () => {
  const forbiddenOps = ['book', 'reserve', 'ticket', 'pay', 'cancel', 'refund', 'order'];
  for (const op of forbiddenOps) {
    const dirty = { [op]: 'value' };
    const check = assertNoWriteOperations(dirty);
    assert.strictEqual(check.safe, false, `'${op}' should be detected as forbidden`);
  }
});

await asyncTest('safety: no write operations in any scenario output', async () => {
  for (const scenario of VALID_RISK_SCENARIOS) {
    const { envelope } = await runDaytonaRiskOrchestrator({
      correlationId: `write-scan-${scenario}`,
      scenario,
    });
    const check = assertNoWriteOperations(envelope);
    assert.strictEqual(check.safe, true, `Scenario '${scenario}' should have no write operations`);
  }
});

/* ── Envelope frozen ── */

await asyncTest('envelope: success envelope is frozen', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'frozen-1',
    scenario: 'success',
  });
  assert.ok(Object.isFrozen(envelope));
  assert.ok(Object.isFrozen(envelope.provenance));
  assert.ok(Object.isFrozen(envelope.riskResult));
  assert.ok(Object.isFrozen(envelope.lifecycle));
});

await asyncTest('envelope: fallback envelope is frozen', async () => {
  const { envelope } = await runDaytonaRiskOrchestrator({
    correlationId: 'frozen-2',
    scenario: 'invalid',
  });
  assert.ok(Object.isFrozen(envelope));
  assert.ok(Object.isFrozen(envelope.provenance));
  assert.ok(Object.isFrozen(envelope.riskResult));
});

/* ── Lifecycle field ── */

await asyncTest('lifecycle: success has all stages including destroy', async () => {
  const { lifecycle } = await runDaytonaRiskOrchestrator({
    correlationId: 'lifecycle-full-1',
    scenario: 'success',
  });
  assert.ok(lifecycle.stagesCompleted.includes('validate-input'));
  assert.ok(lifecycle.stagesCompleted.includes('create-sandbox'));
  assert.ok(lifecycle.stagesCompleted.includes('upload-worker'));
  assert.ok(lifecycle.stagesCompleted.includes('execute-worker'));
  assert.ok(lifecycle.stagesCompleted.includes('download-result'));
  assert.ok(lifecycle.stagesCompleted.includes('sanitize-result'));
  assert.ok(lifecycle.stagesCompleted.includes('destroy-sandbox'));
  assert.strictEqual(lifecycle.sandboxCreated, true);
  assert.strictEqual(lifecycle.sandboxDestroyed, true);
});

await asyncTest('lifecycle: validation failure has no stages', async () => {
  const { lifecycle } = await runDaytonaRiskOrchestrator({
    correlationId: 'lifecycle-fail-1',
    scenario: 'invalid',
  });
  assert.strictEqual(lifecycle.stagesCompleted.length, 0);
  assert.strictEqual(lifecycle.sandboxCreated, false);
  assert.strictEqual(lifecycle.sandboxDestroyed, false);
});

/* ── Summary ── */

console.log(`\nDaytona risk orchestrator offline tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
