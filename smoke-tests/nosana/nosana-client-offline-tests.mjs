// Offline tests for the Nosana client boundary.
//
// These tests verify:
// - Valid workload acceptance.
// - Missing required fields rejection.
// - Mutation-like operations rejection.
// - Offline mode never calls transport.
// - Transport rejection without explicit future execution flag.
// - Fixture results retain executedAgainstProvider: false.
// - Fixture results retain sourceType: "synthetic-local-placeholder".
// - Sanitization of raw headers, tokens, credentials, PII, unknown fields.
// - Timeout and retry bounds enforcement.
// - Single request attempt limit.
// - Existing Nosana fixtures remain valid.
//
// Zero network, zero credentials, zero dependencies.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createNosanaClient,
  NOSANA_CLIENT_CONSTANTS,
} from "./nosana-client.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(here, "fixtures");

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

function section(name) {
  console.log(`\n${name}`);
}

// ── Test 1: Valid workload is accepted ────────────────────────────────────

section("Test 1: Valid workload is accepted");

const client1 = createNosanaClient({ mode: "offline" });
const validWorkload = {
  correlationId: "test-valid-001",
  origin: "AAA",
  connectionAirport: "BBB",
  destination: "CCC",
  connectionDurationMinutes: 75,
  staticHistoricalDatasetVersion: "synthetic-demo-v0",
  syntheticDemo: true,
  nonPiiDeclaration: true,
};

const validation1 = client1.validateWorkload(validWorkload);
assert(validation1.valid === true, "valid workload passes validation");
assert(validation1.issues.length === 0, "no validation issues");

const envelope1 = client1.buildRequestEnvelope(validWorkload);
assert(envelope1.valid === true, "valid workload builds envelope");
assert(envelope1.envelope !== null, "envelope is not null");
assert(envelope1.envelope.correlationId === "test-valid-001", "envelope has correct correlationId");
assert(envelope1.envelope.syntheticDemo === true, "envelope has syntheticDemo: true");
assert(envelope1.envelope.nonPiiDeclaration === true, "envelope has nonPiiDeclaration: true");

// ── Test 2: Missing required fields are rejected ────────────────────────

section("Test 2: Missing required fields are rejected");

const client2 = createNosanaClient({ mode: "offline" });

const missingCorrelation = { ...validWorkload, correlationId: "" };
const val2a = client2.validateWorkload(missingCorrelation);
assert(val2a.valid === false, "missing correlationId rejected");
assert(val2a.issues.some((i) => i.includes("correlationId")), "issue mentions correlationId");

const missingOrigin = { ...validWorkload, origin: "" };
const val2b = client2.validateWorkload(missingOrigin);
assert(val2b.valid === false, "missing origin rejected");

const missingConnection = { ...validWorkload, connectionAirport: "" };
const val2c = client2.validateWorkload(missingConnection);
assert(val2c.valid === false, "missing connectionAirport rejected");

const missingDestination = { ...validWorkload, destination: "" };
const val2d = client2.validateWorkload(missingDestination);
assert(val2d.valid === false, "missing destination rejected");

const invalidDuration = { ...validWorkload, connectionDurationMinutes: -10 };
const val2e = client2.validateWorkload(invalidDuration);
assert(val2e.valid === false, "negative connectionDurationMinutes rejected");

const missingDataset = { ...validWorkload, staticHistoricalDatasetVersion: "" };
const val2f = client2.validateWorkload(missingDataset);
assert(val2f.valid === false, "missing datasetVersion rejected");

const syntheticFalse = { ...validWorkload, syntheticDemo: false };
const val2g = client2.validateWorkload(syntheticFalse);
assert(val2g.valid === false, "syntheticDemo: false rejected");

const piiFalse = { ...validWorkload, nonPiiDeclaration: false };
const val2h = client2.validateWorkload(piiFalse);
assert(val2h.valid === false, "nonPiiDeclaration: false rejected");

const envelope2 = client2.buildRequestEnvelope(missingCorrelation);
assert(envelope2.valid === false, "buildRequestEnvelope rejects invalid workload");
assert(envelope2.envelope === null, "envelope is null on validation failure");

// ── Test 3: Mutation-like operations are rejected ───────────────────────

section("Test 3: Mutation-like operations are rejected");

const client3 = createNosanaClient({ mode: "offline" });

for (const mutOp of NOSANA_CLIENT_CONSTANTS.MUTATION_OPERATIONS) {
  try {
    client3.rejectMutation(mutOp);
    assert(false, `mutation operation "${mutOp}" should be rejected`);
  } catch (err) {
    assert(err.message.includes("rejected"), `mutation "${mutOp}" throws rejection error`);
  }
}

const workloadWithSubmit = { ...validWorkload, submit: true };
const val3 = client3.validateWorkload(workloadWithSubmit);
assert(val3.valid === false, "workload with submit field rejected");
assert(val3.issues.some((i) => i.includes("submit")), "issue mentions submit field");

const workloadWithDeploy = { ...validWorkload, deploy: "something" };
const val3b = client3.validateWorkload(workloadWithDeploy);
assert(val3b.valid === false, "workload with deploy field rejected");

// ── Test 4: Offline mode never calls transport ──────────────────────────

section("Test 4: Offline mode never calls transport");

let transportCalled = false;
const fakeTransport = {
  call: () => {
    transportCalled = true;
    return Promise.resolve({});
  },
};

const client4 = createNosanaClient({ mode: "offline", transport: null });
const status4 = client4.getStatus();
assert(status4.status === "disabled", "offline mode returns disabled status");
assert(status4.executedAgainstProvider === false, "offline mode has executedAgainstProvider: false");
assert(transportCalled === false, "transport was never called in offline mode");

// ── Test 5: Transport rejected without explicit future execution flag ───

section("Test 5: Transport rejected without explicit future execution flag");

try {
  createNosanaClient({ mode: "offline", transport: fakeTransport });
  assert(false, "should throw when transport supplied in offline mode without flag");
} catch (err) {
  assert(err.message.includes("allowFutureExecution"), "error mentions allowFutureExecution");
}

try {
  createNosanaClient({ mode: "future-execution", transport: fakeTransport, allowFutureExecution: false });
  assert(false, "should throw when transport supplied with future-execution but flag is false");
} catch (err) {
  assert(err.message.includes("allowFutureExecution"), "error mentions allowFutureExecution for future-execution mode");
}

// Valid: future-execution mode with flag
const client5 = createNosanaClient({
  mode: "future-execution",
  transport: fakeTransport,
  allowFutureExecution: true,
});
assert(client5 !== null, "client created with future-execution mode and flag");

// ── Test 6: Fixture results retain executedAgainstProvider: false ───────

section("Test 6: Fixture results retain executedAgainstProvider: false");

const client6 = createNosanaClient({ mode: "offline" });

const fixtureResult6 = {
  workloadStatus: "passed",
  jobOrServiceReference: "synthetic-ref-001",
  riskBand: "medium",
  riskScore: 0.42,
  heuristicDisclaimer: "Heuristic risk estimate only.",
  failureCascadeExplanation: "Test explanation.",
  datasetVersion: "synthetic-demo-v0",
  fallbackUsed: false,
  errorCode: null,
  errorMessage: null,
};

const normalized6 = client6.normalizeFixtureResult(fixtureResult6);
assert(normalized6.executedAgainstProvider === false, "executedAgainstProvider is false");
assert(normalized6.sourceType === "synthetic-local-placeholder", "sourceType is synthetic-local-placeholder");
assert(normalized6.placeholderLabel === NOSANA_CLIENT_CONSTANTS.PLACEHOLDER_LABEL, "placeholderLabel is correct");

// ── Test 7: Fixture results retain sourceType: "synthetic-local-placeholder"

section("Test 7: Fixture results retain sourceType: synthetic-local-placeholder");

const fixtureResult7 = {
  workloadStatus: "failed",
  riskBand: "unavailable",
  riskScore: null,
  heuristicDisclaimer: "Heuristic disclaimer.",
  failureCascadeExplanation: "Failure explanation.",
  datasetVersion: "v1",
  fallbackUsed: true,
  errorCode: "TEST_ERROR",
  errorMessage: "Test error message.",
};

const normalized7 = client6.normalizeFixtureResult(fixtureResult7);
assert(normalized7.sourceType === "synthetic-local-placeholder", "sourceType is synthetic-local-placeholder");
assert(normalized7.executedAgainstProvider === false, "executedAgainstProvider is false for failed result");
assert(normalized7.workloadStatus === "failed", "workloadStatus preserved");
assert(normalized7.fallbackUsed === true, "fallbackUsed preserved");

// ── Test 8: Sanitization of raw headers, tokens, credentials, PII ───────

section("Test 8: Sanitization of raw headers, tokens, credentials, PII");

const client8 = createNosanaClient({ mode: "offline" });

const dirtyWorkload = {
  ...validWorkload,
  apiKey: "sk-test123456789",
  authorization: "Bearer token123",
  passengerName: "John Doe",
  email: "john@example.com",
  payment: { cardNumber: "4111111111111111" },
  headers: { "X-Custom-Header": "value" },
};

const envelope8 = client8.buildRequestEnvelope(dirtyWorkload);
assert(envelope8.valid === true, "dirty workload still validates (forbidden fields stripped)");
assert(envelope8.envelope.apiKey === undefined, "apiKey stripped from envelope");
assert(envelope8.envelope.authorization === undefined, "authorization stripped from envelope");
assert(envelope8.envelope.passengerName === undefined, "passengerName stripped from envelope");
assert(envelope8.envelope.email === undefined, "email stripped from envelope");
assert(envelope8.envelope.payment === undefined, "payment stripped from envelope");
assert(envelope8.envelope.headers === undefined, "headers stripped from envelope");

const dirtyResult = {
  workloadStatus: "passed",
  riskBand: "low",
  riskScore: 0.18,
  heuristicDisclaimer: "Disclaimer.",
  failureCascadeExplanation: "Explanation.",
  datasetVersion: "v1",
  fallbackUsed: false,
  secretToken: "secret123",
  password: "pass123",
  passenger: { name: "Jane Doe" },
};

const normalized8 = client8.normalizeFixtureResult(dirtyResult);
assert(normalized8.secretToken === undefined, "secretToken stripped from result");
assert(normalized8.password === undefined, "password stripped from result");
assert(normalized8.passenger === undefined, "passenger stripped from result");
assert(normalized8.executedAgainstProvider === false, "executedAgainstProvider preserved after sanitization");

// ── Test 9: Timeout and retry bounds enforced ───────────────────────────

section("Test 9: Timeout and retry bounds enforced");

const client9 = createNosanaClient({ mode: "offline" });

const workloadWithTimeout = {
  ...validWorkload,
  timeoutMs: 120000, // Exceeds 60s limit
};
const val9a = client9.validateWorkload(workloadWithTimeout);
assert(val9a.valid === false, "timeoutMs exceeding limit rejected");

const workloadWithTimeout2 = {
  ...validWorkload,
  timeoutMs: 30000, // Within limit
};
const val9b = client9.validateWorkload(workloadWithTimeout2);
assert(val9b.valid === true, "timeoutMs within limit accepted");

const workloadWithRetry = {
  ...validWorkload,
  maxRetries: 5, // Exceeds 0 limit
};
const val9c = client9.validateWorkload(workloadWithRetry);
assert(val9c.valid === false, "maxRetries exceeding limit rejected");

const workloadWithRetry2 = {
  ...validWorkload,
  maxRetries: 0, // Within limit
};
const val9d = client9.validateWorkload(workloadWithRetry2);
assert(val9d.valid === true, "maxRetries: 0 accepted");

// ── Test 10: Single request attempt limit ───────────────────────────────

section("Test 10: Single request attempt limit");

const client10 = createNosanaClient({
  mode: "future-execution",
  transport: fakeTransport,
  allowFutureExecution: true,
});

client10.enforceRequestLimit();
assert(client10._getAttemptCount() === 1, "first request attempt succeeds");

try {
  client10.enforceRequestLimit();
  assert(false, "second request attempt should be rejected");
} catch (err) {
  assert(err.message.includes("Maximum request attempts"), "error mentions max attempts");
}

client10._resetAttemptCount();
assert(client10._getAttemptCount() === 0, "attempt count reset");

// ── Test 11: Existing Nosana fixtures remain valid ──────────────────────

section("Test 11: Existing Nosana fixtures remain valid");

const client11 = createNosanaClient({ mode: "offline" });
const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "manifest.json"), "utf8"));

for (const entry of manifest.requestFixtures) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, entry.file), "utf8"));
  const validation = client11.validateWorkload(fixture.riskRequest);

  if (entry.expectedValid) {
    assert(validation.valid === true, `${entry.fixtureId} validates as expected`);
  } else {
    assert(validation.valid === false, `${entry.fixtureId} rejects as expected`);
  }
}

// Test result fixtures
const successFixture = JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, "res-nos-success.json"), "utf8"),
);
const normalized11 = client11.normalizeFixtureResult(successFixture.riskResult);
assert(normalized11.executedAgainstProvider === false, "success fixture has executedAgainstProvider: false");
assert(normalized11.sourceType === "synthetic-local-placeholder", "success fixture has correct sourceType");

// ── Test 12: Invalid mode rejected ──────────────────────────────────────

section("Test 12: Invalid mode rejected");

try {
  createNosanaClient({ mode: "invalid-mode" });
  assert(false, "invalid mode should throw");
} catch (err) {
  assert(err.message.includes("Invalid mode"), "error mentions invalid mode");
}

// ── Test 13: Constants are frozen ───────────────────────────────────────

section("Test 13: Constants are frozen");

assert(Object.isFrozen(NOSANA_CLIENT_CONSTANTS), "NOSANA_CLIENT_CONSTANTS is frozen");
assert(Object.isFrozen(NOSANA_CLIENT_CONSTANTS.ALLOWED_OPERATIONS), "ALLOWED_OPERATIONS is frozen");
assert(Object.isFrozen(NOSANA_CLIENT_CONSTANTS.MUTATION_OPERATIONS), "MUTATION_OPERATIONS is frozen");
assert(Object.isFrozen(NOSANA_CLIENT_CONSTANTS.WORKLOAD_STATUSES), "WORKLOAD_STATUSES is frozen");
assert(Object.isFrozen(NOSANA_CLIENT_CONSTANTS.SAFETY_LIMITS), "SAFETY_LIMITS is frozen");

// ── Test 14: Client API is frozen ───────────────────────────────────────

section("Test 14: Client API is frozen");

const client14 = createNosanaClient({ mode: "offline" });
assert(Object.isFrozen(client14), "client API is frozen");

// ── Test 15: Invalid workload status corrected ──────────────────────────

section("Test 15: Invalid workload status corrected");

const client15 = createNosanaClient({ mode: "offline" });
const invalidStatusResult = {
  workloadStatus: "invalid-status",
  riskBand: "medium",
  riskScore: 0.5,
  heuristicDisclaimer: "Disclaimer.",
  failureCascadeExplanation: "Explanation.",
  datasetVersion: "v1",
  fallbackUsed: false,
};

const normalized15 = client15.normalizeFixtureResult(invalidStatusResult);
assert(normalized15.workloadStatus === "failed", "invalid status corrected to failed");
assert(normalized15.executedAgainstProvider === false, "executedAgainstProvider preserved after correction");

// ── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(72)}`);
console.log(`Nosana client offline tests: ${passed} passed, ${failed} failed.`);
console.log(`${"=".repeat(72)}`);

if (failed > 0) {
  process.exitCode = 1;
}
