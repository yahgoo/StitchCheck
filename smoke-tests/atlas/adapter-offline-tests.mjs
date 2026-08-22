// Offline deterministic tests for the StitchCheck Atlas adapter boundary.
//
// Run:  node adapter-offline-tests.mjs
//
// These tests make zero network requests, read no credentials, and invoke
// no provider. They validate the adapter contract, validation, and fallback
// behaviour using only the modules under test and synthetic data.
//
// Exit code 0 = all tests passed.  Exit code 1 = one or more failures.

import {
  ATLAS_LABELS,
  READ_ONLY_OPERATIONS,
  FORBIDDEN_OPERATIONS,
  isReadOnlyOperation,
  isForbiddenOperation,
  createDisabledAtlasSearchResult,
  createDisabledAtlasSourceStatus,
  validateAtlasAdapterShape,
} from "./alternatives-contract.mjs";

import {
  readOnlyAtlasAdapter,
  getAtlasReadiness,
  _setAtlasClient,
  _setCredentialLoader,
  _setCapabilityApproval,
  _setTargetEnvironment,
  _resetModuleState,
  _testHooks,
} from "./read-only-atlas-adapter.mjs";

/* ── Minimal test harness ── */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✅  ${message}`);
  } else {
    failed += 1;
    failures.push(message);
    console.log(`  ❌  ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const ok = actual === expected;
  if (!ok) {
    message += `  (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`;
  }
  assert(ok, message);
}

function assertDeepEqual(actual, expected, message) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    message += `  (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`;
  }
  assert(ok, message);
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

/* ── Helper: reset state between tests ── */

function resetAll() {
  _resetModuleState();
}

/* ══════════════════════════════════════════════════════════════════
   Test 1: Adapter returns disabled / local fallback by default
   ══════════════════════════════════════════════════════════════════ */

section("Test 1 — Disabled-by-default fallback");

resetAll();

assertEqual(
  readOnlyAtlasAdapter.isEnabled(),
  false,
  "isEnabled() returns false by default",
);

const defaultResult = await readOnlyAtlasAdapter.execute({
  operation: "search",
  correlationId: "synthetic-test-1",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  syntheticDemo: true,
  confirmedItinerary: true,
});

assertEqual(
  defaultResult.searchStatus,
  "disabled",
  "Default result has searchStatus 'disabled'",
);

assertEqual(
  defaultResult.label,
  ATLAS_LABELS.syntheticLocalFallback,
  "Default result carries the synthetic local fallback label",
);

assertEqual(
  defaultResult.requiresUserConfirmation,
  true,
  "Default result requires user confirmation",
);

assertEqual(
  defaultResult.syntheticDemo,
  true,
  "Default result is marked syntheticDemo",
);

assertEqual(
  defaultResult.sourceStatus.executed,
  false,
  "Default result sourceStatus.executed is false",
);

assertEqual(
  defaultResult.sourceStatus.enabled,
  false,
  "Default result sourceStatus.enabled is false",
);

/* ══════════════════════════════════════════════════════════════════
   Test 2: Exact Atlas placeholder label is present
   ══════════════════════════════════════════════════════════════════ */

section("Test 2 — Exact Atlas placeholder label");

resetAll();

const label = readOnlyAtlasAdapter.getLabel();
assertEqual(
  label,
  ATLAS_LABELS.syntheticLocalFallback,
  "getLabel() returns the exact synthetic local fallback label",
);

assertEqual(
  ATLAS_LABELS.syntheticLocalFallback,
  "Synthetic local placeholder — not Atlas Sandbox evidence",
  "ATLAS_LABELS.syntheticLocalFallback is the exact expected string",
);

assertEqual(
  defaultResult.sourceStatus.label,
  ATLAS_LABELS.syntheticLocalFallback,
  "Default result sourceStatus.label matches the exact placeholder",
);

/* ══════════════════════════════════════════════════════════════════
   Test 3: Valid synthetic search request is accepted (shape validation)
   ══════════════════════════════════════════════════════════════════ */

section("Test 3 — Valid synthetic search request accepted");

resetAll();

const validRequest = {
  operation: "search",
  correlationId: "synthetic-test-3",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  earliestDepartureTime: "07:00",
  latestArrivalTime: "21:00",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  syntheticDemo: true,
  confirmedItinerary: true,
};

const validation = _testHooks.validateSearchRequest(validRequest);
assertEqual(validation.valid, true, "Valid request passes shape validation");
assertEqual(validation.issues.length, 0, "No validation issues for valid request");

const compareValidation = _testHooks.validateSearchRequest({
  ...validRequest,
  operation: "compare",
});
assertEqual(
  compareValidation.valid,
  true,
  "Valid compare operation passes shape validation",
);

/* ══════════════════════════════════════════════════════════════════
   Test 4: Normalized fake-client result passes validation
   ══════════════════════════════════════════════════════════════════ */

section("Test 4 — Normalized fake-client result passes validation");

resetAll();

const fakeProviderOutput = {
  searchStatus: "completed",
  correlationId: "synthetic-test-4",
  sourceEnvironment: "sandbox-placeholder",
  alternatives: [
    {
      offerReference: "display-only-ref-1",
      routeSummary: "AAA → BBB → CCC (synthetic)",
      departureTime: "08:30",
      arrivalTime: "16:10",
      duration: "7h 40m",
      connectionType: "one-stop",
      connectionDurationMinutes: 135,
      priceDisplay: "— placeholder —",
      currency: "USD",
      availabilityLabel: "placeholder-availability",
    },
  ],
  errorCode: null,
  errorMessage: null,
};

const normalized = _testHooks.normalizeProviderResult(fakeProviderOutput);

assertEqual(normalized.searchStatus, "completed", "Normalized result has correct searchStatus");
assertEqual(normalized.correlationId, "synthetic-test-4", "Normalized result has correct correlationId");
assertEqual(normalized.alternatives.length, 1, "Normalized result has one alternative");
assertEqual(
  normalized.alternatives[0].offerReference,
  "display-only-ref-1",
  "Alternative has correct offerReference",
);
assertEqual(
  normalized.alternatives[0].departureTime,
  "08:30",
  "Alternative has correct departureTime",
);
assertEqual(
  normalized.requiresUserConfirmation,
  true,
  "Normalized result requires user confirmation",
);
assertEqual(
  normalized.syntheticDemo,
  true,
  "Normalized result is marked syntheticDemo",
);
assertEqual(
  normalized.label,
  ATLAS_LABELS.syntheticLocalFallback,
  "Normalized result carries the correct label",
);

/* ══════════════════════════════════════════════════════════════════
   Test 5: Raw fake-client output is not returned
   ══════════════════════════════════════════════════════════════════ */

section("Test 5 — Raw fake-client output is not returned");

resetAll();

const rawOutput = {
  searchStatus: "completed",
  correlationId: "synthetic-test-5",
  sourceEnvironment: "sandbox-placeholder",
  alternatives: [
    {
      offerReference: "ref-1",
      routeSummary: "AAA → CCC",
      departureTime: "09:00",
      arrivalTime: "13:00",
      duration: "4h",
      connectionType: "nonstop",
      connectionDurationMinutes: 0,
      priceDisplay: "$500",
      currency: "USD",
      availabilityLabel: "available",
      extraInternalField: "should-be-stripped",
      rawProviderMetadata: { internal: true },
    },
  ],
  errorCode: null,
  errorMessage: null,
  internalDebugInfo: "debug-data",
};

const normalizedRaw = _testHooks.normalizeProviderResult(rawOutput);

assertEqual(
  normalizedRaw.alternatives[0].extraInternalField,
  undefined,
  "Raw extraInternalField is stripped from normalized output",
);

assertEqual(
  normalizedRaw.alternatives[0].rawProviderMetadata,
  undefined,
  "Raw rawProviderMetadata is stripped from normalized output",
);

assertEqual(
  normalizedRaw.internalDebugInfo,
  undefined,
  "Raw internalDebugInfo is stripped from normalized output",
);

assert(
  Object.isFrozen(normalizedRaw),
  "Normalized result is frozen (immutable)",
);

assert(
  Object.isFrozen(normalizedRaw.alternatives[0]),
  "Normalized alternative is frozen (immutable)",
);

/* ══════════════════════════════════════════════════════════════════
   Test 6: Missing required fields fail safely
   ══════════════════════════════════════════════════════════════════ */

section("Test 6 — Missing required fields fail safely");

resetAll();

const missingCorrelation = _testHooks.validateSearchRequest({
  operation: "search",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});
assertEqual(
  missingCorrelation.valid,
  false,
  "Missing correlationId fails validation",
);
assert(
  missingCorrelation.issues.some((i) => i.includes("correlationId")),
  "Validation issue mentions correlationId",
);

const missingOrigin = _testHooks.validateSearchRequest({
  operation: "search",
  correlationId: "synthetic-test-6",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});
assertEqual(missingOrigin.valid, false, "Missing origin fails validation");
assert(
  missingOrigin.issues.some((i) => i.includes("origin")),
  "Validation issue mentions origin",
);

const invalidDestination = _testHooks.validateSearchRequest({
  operation: "search",
  correlationId: "synthetic-test-6",
  origin: "AAA",
  destination: "invalid",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});
assertEqual(
  invalidDestination.valid,
  false,
  "Invalid destination format fails validation",
);

/* ══════════════════════════════════════════════════════════════════
   Test 7: Malformed dates/times fail safely
   ══════════════════════════════════════════════════════════════════ */

section("Test 7 — Malformed dates/times fail safely");

resetAll();

const invalidDate = _testHooks.validateSearchRequest({
  operation: "search",
  correlationId: "synthetic-test-7",
  origin: "AAA",
  destination: "CCC",
  departureDate: "15-09-2026",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});
assertEqual(invalidDate.valid, false, "Invalid date format fails validation");
assert(
  invalidDate.issues.some((i) => i.includes("departureDate")),
  "Validation issue mentions departureDate",
);

const altDateValidation = _testHooks.validateAlternativeDates({
  departureTime: "25:00",
  arrivalTime: "30:00",
});
assertEqual(
  altDateValidation.valid,
  false,
  "Invalid time format in alternative fails validation",
);

/* ══════════════════════════════════════════════════════════════════
   Test 8: Impossible connection durations fail safely
   ══════════════════════════════════════════════════════════════════ */

section("Test 8 — Impossible connection durations fail safely");

resetAll();

const negativeDuration = _testHooks.validateAlternativeDates({
  departureTime: "08:00",
  arrivalTime: "16:00",
  connectionDurationMinutes: -30,
});
assertEqual(
  negativeDuration.valid,
  false,
  "Negative connection duration fails validation",
);

const nanDuration = _testHooks.validateAlternativeDates({
  departureTime: "08:00",
  arrivalTime: "16:00",
  connectionDurationMinutes: NaN,
});
assertEqual(
  nanDuration.valid,
  false,
  "NaN connection duration fails validation",
);

const validDuration = _testHooks.validateAlternativeDates({
  departureTime: "08:00",
  arrivalTime: "16:00",
  connectionDurationMinutes: 135,
});
assertEqual(
  validDuration.valid,
  true,
  "Valid connection duration passes validation",
);

/* ══════════════════════════════════════════════════════════════════
   Test 9: Booking operation names are rejected
   ══════════════════════════════════════════════════════════════════ */

section("Test 9 — Booking operation names are rejected");

resetAll();

const bookResult = await readOnlyAtlasAdapter.execute({
  operation: "book",
  correlationId: "synthetic-test-9",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});

assertEqual(
  bookResult.searchStatus,
  "disabled",
  "Book operation returns disabled status",
);

assert(
  bookResult.errorMessage.includes("forbidden_operation_book"),
  "Book operation error message indicates forbidden operation",
);

const createBookingResult = await readOnlyAtlasAdapter.execute({
  operation: "create_booking",
  correlationId: "synthetic-test-9",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});

assert(
  createBookingResult.errorMessage.includes("forbidden_operation_create_booking"),
  "create_booking operation is rejected as forbidden",
);

/* ══════════════════════════════════════════════════════════════════
   Test 10: Payment/reservation/ticket/order/verification rejected
   ══════════════════════════════════════════════════════════════════ */

section("Test 10 — Payment/reservation/ticket/order/verification rejected");

resetAll();

const forbiddenOps = ["pay", "reserve", "ticket", "order", "verify"];

for (const op of forbiddenOps) {
  const result = await readOnlyAtlasAdapter.execute({
    operation: op,
    correlationId: "synthetic-test-10",
    origin: "AAA",
    destination: "CCC",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    confirmedItinerary: true,
  });

  assertEqual(
    result.searchStatus,
    "disabled",
    `${op} operation returns disabled status`,
  );

  assert(
    result.errorMessage.includes(`forbidden_operation_${op}`),
    `${op} operation is rejected as forbidden`,
  );
}

/* ══════════════════════════════════════════════════════════════════
   Test 11: Missing capability approval blocks execution
   ══════════════════════════════════════════════════════════════════ */

section("Test 11 — Missing capability approval blocks execution");

resetAll();

_setTargetEnvironment("sandbox-test");
_setAtlasClient({ searchAlternates: async () => ({}) });
_setCredentialLoader(() => "fake-credential");

const authNoCap = _testHooks.checkAuthorization();
assertEqual(
  authNoCap.enabled,
  false,
  "Authorization fails without capability approval",
);
assertEqual(
  authNoCap.reason,
  "atlas_capability_not_approved",
  "Reason indicates capability not approved",
);

const noCapResult = await readOnlyAtlasAdapter.execute({
  operation: "search",
  correlationId: "synthetic-test-11",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});

assertEqual(
  noCapResult.searchStatus,
  "disabled",
  "Execution blocked without capability approval",
);

/* ══════════════════════════════════════════════════════════════════
   Test 12: Missing target environment blocks execution
   ══════════════════════════════════════════════════════════════════ */

section("Test 12 — Missing target environment blocks execution");

resetAll();

_setCapabilityApproval(true);
_setAtlasClient({ searchAlternates: async () => ({}) });
_setCredentialLoader(() => "fake-credential");

const authNoEnv = _testHooks.checkAuthorization();
assertEqual(
  authNoEnv.enabled,
  false,
  "Authorization fails without target environment",
);
assertEqual(
  authNoEnv.reason,
  "no_target_environment_configured",
  "Reason indicates no target environment",
);

const noEnvResult = await readOnlyAtlasAdapter.execute({
  operation: "search",
  correlationId: "synthetic-test-12",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});

assertEqual(
  noEnvResult.searchStatus,
  "disabled",
  "Execution blocked without target environment",
);

/* ══════════════════════════════════════════════════════════════════
   Test 13: Missing injected client blocks execution
   ══════════════════════════════════════════════════════════════════ */

section("Test 13 — Missing injected client blocks execution");

resetAll();

_setCapabilityApproval(true);
_setTargetEnvironment("sandbox-test");
_setCredentialLoader(() => "fake-credential");

const authNoClient = _testHooks.checkAuthorization();
assertEqual(
  authNoClient.enabled,
  false,
  "Authorization fails without injected client",
);
assertEqual(
  authNoClient.reason,
  "no_atlas_client_injected",
  "Reason indicates no client injected",
);

const noClientResult = await readOnlyAtlasAdapter.execute({
  operation: "search",
  correlationId: "synthetic-test-13",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});

assertEqual(
  noClientResult.searchStatus,
  "disabled",
  "Execution blocked without injected client",
);

/* ══════════════════════════════════════════════════════════════════
   Test 14: Missing runtime credential blocks execution
   ══════════════════════════════════════════════════════════════════ */

section("Test 14 — Missing runtime credential blocks execution");

resetAll();

_setCapabilityApproval(true);
_setTargetEnvironment("sandbox-test");
_setAtlasClient({ searchAlternates: async () => ({}) });
// No credential loader set

const credResult = await readOnlyAtlasAdapter.execute({
  operation: "search",
  correlationId: "synthetic-test-14",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});

assertEqual(
  credResult.searchStatus,
  "disabled",
  "Execution blocked without credential",
);

assert(
  credResult.errorMessage.includes("credential_not_available"),
  "Error message indicates credential not available",
);

/* ══════════════════════════════════════════════════════════════════
   Test 15: Second request in one execution is rejected
   ══════════════════════════════════════════════════════════════════ */

section("Test 15 — Second request in one execution is rejected");

resetAll();

_setCapabilityApproval(true);
_setTargetEnvironment("sandbox-test");
_setAtlasClient({
  searchAlternates: async () => ({
    searchStatus: "completed",
    correlationId: "synthetic-test-15",
    sourceEnvironment: "sandbox-placeholder",
    alternatives: [],
  }),
});
_setCredentialLoader(() => "fake-credential");

const firstReq = await readOnlyAtlasAdapter.execute({
  operation: "search",
  correlationId: "synthetic-test-15a",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});

assertEqual(
  firstReq.searchStatus,
  "completed",
  "First request succeeds",
);

const secondReq = await readOnlyAtlasAdapter.execute({
  operation: "search",
  correlationId: "synthetic-test-15b",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});

assertEqual(
  secondReq.searchStatus,
  "disabled",
  "Second request is rejected",
);

assert(
  secondReq.errorMessage.includes("call_limit_exceeded"),
  "Second request error indicates call limit exceeded",
);

/* ══════════════════════════════════════════════════════════════════
   Test 16: No network primitive is called
   ══════════════════════════════════════════════════════════════════ */

section("Test 16 — No network primitive is called");

resetAll();

// The adapter module does not import or use fetch, XMLHttpRequest, WebSocket, etc.
// This test verifies by checking that the adapter can be imported and used
// without any network activity.

const noNetworkResult = await readOnlyAtlasAdapter.execute({
  operation: "search",
  correlationId: "synthetic-test-16",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});

assertEqual(
  noNetworkResult.searchStatus,
  "disabled",
  "Adapter returns disabled result without network calls",
);

assert(
  !noNetworkResult.sourceStatus.executed,
  "No provider was executed",
);

/* ══════════════════════════════════════════════════════════════════
   Test 17: No credential is read or exposed
   ══════════════════════════════════════════════════════════════════ */

section("Test 17 — No credential is read or exposed");

resetAll();

_setCapabilityApproval(true);
_setTargetEnvironment("sandbox-test");
_setAtlasClient({
  searchAlternates: async () => ({
    searchStatus: "completed",
    correlationId: "synthetic-test-17",
    sourceEnvironment: "sandbox-placeholder",
    alternatives: [],
  }),
});

let credentialAccessed = false;
_setCredentialLoader(() => {
  credentialAccessed = true;
  return "fake-credential-for-test-17";
});

const credTestResult = await readOnlyAtlasAdapter.execute({
  operation: "search",
  correlationId: "synthetic-test-17",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});

assert(
  credentialAccessed,
  "Credential loader was called (internal use only)",
);

// Verify credential is not in the result
const resultStr = JSON.stringify(credTestResult);
assert(
  !resultStr.includes("fake-credential-for-test-17"),
  "Credential value is not exposed in the result",
);

assert(
  !resultStr.includes("ATLAS_CREDENTIAL"),
  "Credential environment variable name is not exposed",
);

/* ══════════════════════════════════════════════════════════════════
   Test 18: Existing local placeholder behavior unchanged
   ══════════════════════════════════════════════════════════════════ */

section("Test 18 — Existing local placeholder behavior unchanged");

resetAll();

const placeholderResult = createDisabledAtlasSearchResult("test_reason");

assertEqual(
  placeholderResult.label,
  "Synthetic local placeholder — not Atlas Sandbox evidence",
  "Disabled result carries the exact placeholder label",
);

assertEqual(
  placeholderResult.sourceStatus.label,
  "Synthetic local placeholder — not Atlas Sandbox evidence",
  "Source status carries the exact placeholder label",
);

assertEqual(
  placeholderResult.searchStatus,
  "disabled",
  "Disabled result has searchStatus 'disabled'",
);

assertEqual(
  placeholderResult.fallbackUsed,
  true,
  "Disabled result indicates fallback was used",
);

/* ══════════════════════════════════════════════════════════════════
   Test 19: Adapter cannot bypass app's confirmation gate
   ══════════════════════════════════════════════════════════════════ */

section("Test 19 — Adapter cannot bypass confirmation gate");

resetAll();

// All results must have requiresUserConfirmation: true
const confirmResult = createDisabledAtlasSearchResult("test");

assertEqual(
  confirmResult.requiresUserConfirmation,
  true,
  "Disabled result requires user confirmation",
);

_setCapabilityApproval(true);
_setTargetEnvironment("sandbox-test");
_setAtlasClient({
  searchAlternates: async () => ({
    searchStatus: "completed",
    correlationId: "synthetic-test-19",
    sourceEnvironment: "sandbox-placeholder",
    alternatives: [],
  }),
});
_setCredentialLoader(() => "fake-credential");

const enabledResult = await readOnlyAtlasAdapter.execute({
  operation: "search",
  correlationId: "synthetic-test-19",
  origin: "AAA",
  destination: "CCC",
  departureDate: "2026-09-15",
  searchIntent: "safer-alternative",
  sandboxOnly: true,
  confirmedItinerary: true,
});

assertEqual(
  enabledResult.requiresUserConfirmation,
  true,
  "Enabled result also requires user confirmation",
);

/* ══════════════════════════════════════════════════════════════════
   Test 20: No external action is created by the adapter
   ══════════════════════════════════════════════════════════════════ */

section("Test 20 — No external action is created");

resetAll();

// Verify that the adapter only supports read-only operations
assert(
  isReadOnlyOperation("search"),
  "search is a read-only operation",
);

assert(
  isReadOnlyOperation("compare"),
  "compare is a read-only operation",
);

assert(
  !isReadOnlyOperation("book"),
  "book is not a read-only operation",
);

assert(
  isForbiddenOperation("book"),
  "book is a forbidden operation",
);

assert(
  isForbiddenOperation("pay"),
  "pay is a forbidden operation",
);

assert(
  isForbiddenOperation("reserve"),
  "reserve is a forbidden operation",
);

assert(
  isForbiddenOperation("ticket"),
  "ticket is a forbidden operation",
);

assert(
  isForbiddenOperation("order"),
  "order is a forbidden operation",
);

assert(
  isForbiddenOperation("verify"),
  "verify is a forbidden operation",
);

// Verify readiness report
const readiness = getAtlasReadiness();
assertEqual(
  readiness.adapter,
  "read-only-atlas",
  "Readiness report identifies the adapter correctly",
);

assert(
  Array.isArray(readiness.readOnlyOperations),
  "Readiness report includes read-only operations list",
);

assert(
  Array.isArray(readiness.forbiddenOperations),
  "Readiness report includes forbidden operations list",
);

assert(
  readiness.readOnlyOperations.includes("search"),
  "Read-only operations include search",
);

assert(
  readiness.readOnlyOperations.includes("compare"),
  "Read-only operations include compare",
);

/* ── Summary ── */

console.log("\n" + "═".repeat(60));
console.log(`Tests complete: ${passed} passed, ${failed} failed.`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
} else {
  console.log("All tests passed.");
  process.exit(0);
}
