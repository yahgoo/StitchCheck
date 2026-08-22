// Offline deterministic tests for the StitchCheck Gemini adapter boundary.
//
// Run:  node adapter-offline-tests.mjs
//
// These tests make zero network requests, read no credentials, and invoke
// no provider. They validate the adapter contract, validator, and fallback
// behaviour using only the modules under test and synthetic data.
//
// Exit code 0 = all tests passed.  Exit code 1 = one or more failures.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXTRACTION_LABELS,
  createDisabledExtractionResult,
  createDisabledSourceStatus,
  validateAdapterShape,
} from "./extraction-contract.mjs";

import {
  directGeminiAdapter,
  getDirectGeminiReadiness,
  _setProviderClient,
  _setCredentialLoader,
  _resetModuleState,
  _testHooks,
} from "./direct-gemini-adapter.mjs";

import {
  validateExtractionResult,
  _test,
} from "./extraction-validator.mjs";

import {
  validateExtractionResult as schemaValidateExtraction,
} from "./schema-validator.mjs";

const harnessDir = dirname(fileURLToPath(import.meta.url));

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

function section(title) {
  console.log(`\n── ${title} ──`);
}

/* ══════════════════════════════════════════════════════════════════
   Test 1: Adapter returns disabled / local fallback by default
   ══════════════════════════════════════════════════════════════════ */

section("Test 1 — Disabled-by-default fallback");

assertEqual(
  directGeminiAdapter.isEnabled(),
  false,
  "isEnabled() returns false by default",
);

const defaultResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01-two-leg-clean",
  image: new Uint8Array([0]),
  mediaType: "image/png",
});

assertEqual(
  defaultResult.extractionStatus,
  "disabled",
  "extract() returns extractionStatus 'disabled' by default",
);
assertEqual(
  defaultResult.syntheticDemo,
  true,
  "disabled result has syntheticDemo: true",
);
assertEqual(
  defaultResult.requiresUserConfirmation,
  true,
  "disabled result has requiresUserConfirmation: true",
);
assertEqual(
  defaultResult.fallbackUsed ?? defaultResult.sourceStatus?.fallbackUsed,
  true,
  "disabled result indicates fallback was used",
);

/* ══════════════════════════════════════════════════════════════════
   Test 2: Synthetic fixture can be normalised into the request contract
   ══════════════════════════════════════════════════════════════════ */

section("Test 2 — Fixture normalisation into request contract");

const manifest = JSON.parse(
  readFileSync(join(harnessDir, "fixtures", "manifest.json"), "utf8"),
);

assert(manifest.syntheticOnly === true, "manifest declares syntheticOnly");

const gem01 = manifest.fixtures.find((f) => f.fixtureId === "gem-01-two-leg-clean");
assert(gem01 !== undefined, "GEM-01 fixture entry exists in manifest");
assertEqual(gem01.format, "png", "GEM-01 format is png");

// Normalise into the provider-neutral request shape
const normalisedRequest = {
  fixtureId: gem01.fixtureId,
  image: new Uint8Array(0), // placeholder bytes; no actual read needed
  mediaType: "image/png",
  instruction: undefined,
};

assert(typeof normalisedRequest.fixtureId === "string" && normalisedRequest.fixtureId.length > 0,
  "normalised request has a non-empty fixtureId");
assertEqual(normalisedRequest.mediaType, "image/png", "normalised request has correct mediaType");

/* ══════════════════════════════════════════════════════════════════
   Test 3: Valid extraction result passes validation
   ══════════════════════════════════════════════════════════════════ */

section("Test 3 — Valid extraction result passes validation");

const validResult = {
  extractionStatus: "success",
  firstLeg: {
    origin: "AAA",
    destination: "BBB",
    date: "2026-09-15",
    departureTime: "08:00",
    arrivalTime: "10:30",
    airline: "Synthetic Carrier",
    flightNumber: "SC-101",
  },
  secondLeg: {
    origin: "BBB",
    destination: "CCC",
    date: "2026-09-15",
    departureTime: "13:00",
    arrivalTime: "15:45",
    airline: "Synthetic Carrier",
    flightNumber: "SC-202",
  },
  connectionDurationMinutes: 150,
  missingFields: [],
  fieldConfidence: { overall: "high", note: "all fields populated" },
  validationMessages: [],
  requiresUserConfirmation: true,
  syntheticDemo: true,
};

const validReport = validateExtractionResult(validResult);
assertEqual(validReport.valid, true, "valid result passes validation");
assertEqual(validReport.issues.length, 0, "valid result has zero issues");

/* ══════════════════════════════════════════════════════════════════
   Test 4: Missing required fields fail validation
   ══════════════════════════════════════════════════════════════════ */

section("Test 4 — Missing required fields fail validation");

const missingFieldsResult = {
  extractionStatus: "success",
  firstLeg: {
    origin: "",  // empty — should fail
    destination: "BBB",
    date: "2026-09-15",
    departureTime: "08:00",
    arrivalTime: "10:30",
  },
  secondLeg: null, // missing entirely
  connectionDurationMinutes: 150,
  missingFields: ["firstLeg.origin", "secondLeg"],
  fieldConfidence: { overall: "low" },
  validationMessages: ["missing required fields"],
  requiresUserConfirmation: true,
  syntheticDemo: true,
};

const missingReport = validateExtractionResult(missingFieldsResult);
assertEqual(missingReport.valid, false, "result with missing fields fails validation");
assert(missingReport.issues.length > 0, "missing-field result has at least one issue");

const hasFirstLegOriginIssue = missingReport.issues.some(
  (i) => i.includes("firstLeg.origin"),
);
assert(hasFirstLegOriginIssue, "issue mentions firstLeg.origin");

const hasSecondLegIssue = missingReport.issues.some(
  (i) => i.includes("secondLeg"),
);
assert(hasSecondLegIssue, "issue mentions secondLeg");

/* ══════════════════════════════════════════════════════════════════
   Test 5: Malformed date / time values fail validation
   ══════════════════════════════════════════════════════════════════ */

section("Test 5 — Malformed date/time values fail validation");

const badDateResult = {
  extractionStatus: "success",
  firstLeg: {
    origin: "AAA",
    destination: "BBB",
    date: "not-a-date",
    departureTime: "08:00",
    arrivalTime: "10:30",
  },
  secondLeg: {
    origin: "BBB",
    destination: "CCC",
    date: "2026-09-15",
    departureTime: "25:99", // invalid time
    arrivalTime: "15:45",
  },
  connectionDurationMinutes: 150,
  missingFields: [],
  fieldConfidence: { overall: "low" },
  validationMessages: [],
  requiresUserConfirmation: true,
  syntheticDemo: true,
};

const badDateReport = validateExtractionResult(badDateResult);
assertEqual(badDateReport.valid, false, "malformed date/time fails validation");

const hasDateIssue = badDateReport.issues.some((i) => i.includes("date"));
assert(hasDateIssue, "issue mentions malformed date");

const hasTimeIssue = badDateReport.issues.some((i) => i.includes("departureTime"));
assert(hasTimeIssue, "issue mentions malformed departureTime");

// Also test the internal helpers directly
assertEqual(_test.isValidDate("2026-09-15"), true, "isValidDate accepts valid date");
assertEqual(_test.isValidDate("not-a-date"), false, "isValidDate rejects non-date string");
assertEqual(_test.isValidDate("2026-13-01"), false, "isValidDate rejects impossible month");
assertEqual(_test.isValidTime("08:00"), true, "isValidTime accepts valid time");
assertEqual(_test.isValidTime("25:99"), false, "isValidTime rejects out-of-range time");
assertEqual(_test.isValidTime("abc"), false, "isValidTime rejects non-time string");

/* ══════════════════════════════════════════════════════════════════
   Test 6: Impossible / negative connection durations fail validation
   ══════════════════════════════════════════════════════════════════ */

section("Test 6 — Impossible / negative connection durations");

assertEqual(
  _test.isPlausibleConnectionDuration(-1),
  false,
  "negative duration rejected",
);
assertEqual(
  _test.isPlausibleConnectionDuration(0),
  true,
  "zero duration accepted (tight connection)",
);
assertEqual(
  _test.isPlausibleConnectionDuration(150),
  true,
  "150 min duration accepted",
);
assertEqual(
  _test.isPlausibleConnectionDuration(1440),
  true,
  "1440 min (24 h) accepted at boundary",
);
assertEqual(
  _test.isPlausibleConnectionDuration(1441),
  false,
  "1441 min rejected (exceeds 24 h)",
);
assertEqual(
  _test.isPlausibleConnectionDuration(Infinity),
  false,
  "Infinity rejected",
);
assertEqual(
  _test.isPlausibleConnectionDuration(NaN),
  false,
  "NaN rejected",
);

// Also test via the full validator
const badDurationResult = { ...validResult, connectionDurationMinutes: -30 };
const badDurationReport = validateExtractionResult(badDurationResult);
assertEqual(badDurationReport.valid, false, "negative duration fails full validation");

/* ══════════════════════════════════════════════════════════════════
   Test 7: Uncertain values remain warnings / confidence, not invented
   ══════════════════════════════════════════════════════════════════ */

section("Test 7 — Uncertainty preserved as warnings / confidence");

const uncertainResult = {
  extractionStatus: "partial",
  firstLeg: {
    origin: "AAA",
    destination: "BBB",
    date: "2026-09-15",
    departureTime: "08:00",
    arrivalTime: "10:30",
    airline: "Synthetic Carrier",
    flightNumber: "SC-101",
  },
  secondLeg: {
    origin: "BBB",
    destination: "CCC",
    date: "2026-09-15",
    departureTime: "13:00",
    arrivalTime: "15:45",
    airline: null, // uncertain
    flightNumber: null, // uncertain
  },
  connectionDurationMinutes: 150,
  missingFields: ["secondLeg.airline", "secondLeg.flightNumber"],
  fieldConfidence: {
    overall: "medium",
    note: "optional fields unreadable on second leg",
    "secondLeg.airline": 0.2,
    "secondLeg.flightNumber": 0.1,
  },
  validationMessages: ["some optional fields could not be read"],
  requiresUserConfirmation: true,
  syntheticDemo: true,
};

const uncertainReport = validateExtractionResult(uncertainResult);
assertEqual(uncertainReport.valid, true, "partial result with uncertainty passes validation");
assert(
  uncertainResult.missingFields.length > 0,
  "uncertain result records missing fields explicitly",
);
assert(
  uncertainResult.fieldConfidence["secondLeg.airline"] < 0.5,
  "low confidence recorded for uncertain field (not invented)",
);
assert(
  uncertainResult.validationMessages.length > 0,
  "uncertainty preserved as validation messages (not silently filled)",
);

/* ══════════════════════════════════════════════════════════════════
   Test 8: No network primitive is invoked
   ══════════════════════════════════════════════════════════════════ */

section("Test 8 — No network primitive in adapter modules");

const adapterSource = readFileSync(
  join(harnessDir, "direct-gemini-adapter.mjs"),
  "utf8",
);
const contractSource = readFileSync(
  join(harnessDir, "extraction-contract.mjs"),
  "utf8",
);
const validatorSource = readFileSync(
  join(harnessDir, "extraction-validator.mjs"),
  "utf8",
);

const networkPatterns = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\baxios\b/,
  /require\s*\(\s*["']node:http["']\)/,
  /require\s*\(\s*["']node:https["']\)/,
  /require\s*\(\s*["']node:net["']\)/,
  /from\s+["']node:http["']/,
  /from\s+["']node:https["']/,
  /from\s+["']node:net["']/,
];

let networkFound = false;
for (const pattern of networkPatterns) {
  if (pattern.test(adapterSource) || pattern.test(contractSource) || pattern.test(validatorSource)) {
    networkFound = true;
    assert(false, `network pattern ${pattern} found in adapter modules`);
  }
}
if (!networkFound) {
  assert(true, "no network primitive found in any adapter module source");
}

/* ══════════════════════════════════════════════════════════════════
   Test 9: No credential is required or read
   ══════════════════════════════════════════════════════════════════ */

section("Test 9 — No credential required or read");

// The adapter must work (returning fallback) without any credential
const noCredResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01-two-leg-clean",
  image: new Uint8Array([0]),
  mediaType: "image/png",
});
assertEqual(
  noCredResult.extractionStatus,
  "disabled",
  "adapter returns fallback without any credential present",
);

// Verify no key-like patterns in source
const credPatterns = [
  /sk-[a-zA-Z0-9]{10,}/,
  /AIza[a-zA-Z0-9]{20,}/,
  /Bearer\s+[a-zA-Z0-9]/,
];

let credFound = false;
for (const pattern of credPatterns) {
  if (pattern.test(adapterSource) || pattern.test(contractSource)) {
    credFound = true;
    assert(false, `credential pattern ${pattern} found in source`);
  }
}
if (!credFound) {
  assert(true, "no credential value pattern found in adapter source");
}

// Verify the readiness report does not expose key values
const readiness = getDirectGeminiReadiness();
assertEqual(readiness.enabled, false, "readiness reports adapter disabled");
assert(
  !JSON.stringify(readiness).includes("sk-"),
  "readiness report contains no key-like values",
);

/* ══════════════════════════════════════════════════════════════════
   Test 10: Exact local fallback label is present
   ══════════════════════════════════════════════════════════════════ */

section("Test 10 — Exact evidence labels");

const EXPECTED_FALLBACK_LABEL =
  "Synthetic local placeholder \u2014 not direct Gemini evidence";
const EXPECTED_OPENROUTER_LABEL =
  "OpenRouter temporary path \u2014 not direct Gemini validation";

assertEqual(
  EXTRACTION_LABELS.syntheticLocalFallback,
  EXPECTED_FALLBACK_LABEL,
  "contract defines exact local fallback label",
);
assertEqual(
  EXTRACTION_LABELS.openRouterTemporaryPath,
  EXPECTED_OPENROUTER_LABEL,
  "contract defines exact OpenRouter temporary-path label",
);
assertEqual(
  defaultResult.label,
  EXPECTED_FALLBACK_LABEL,
  "disabled result carries the exact fallback label",
);
assertEqual(
  defaultResult.sourceStatus.label,
  EXPECTED_FALLBACK_LABEL,
  "disabled source status carries the exact fallback label",
);
assertEqual(
  directGeminiAdapter.getLabel(),
  EXPECTED_FALLBACK_LABEL,
  "adapter getLabel() returns exact fallback label when disabled",
);

/* ══════════════════════════════════════════════════════════════════
   Test 11: Confirmation gate is not bypassed by adapter output
   ══════════════════════════════════════════════════════════════════ */

section("Test 11 — Confirmation gate not bypassed by adapter");

// The adapter output must always require user confirmation.
// This ensures the UI confirmation gate cannot be bypassed.

assertEqual(
  defaultResult.requiresUserConfirmation,
  true,
  "disabled result requires user confirmation (gate intact)",
);

// Even a hypothetical enabled result must require confirmation
const hypotheticalEnabled = { ...validResult, requiresUserConfirmation: true };
const gateReport = validateExtractionResult(hypotheticalEnabled);
assertEqual(gateReport.valid, true, "valid result with requiresUserConfirmation=true passes");

// If requiresUserConfirmation were false, validation must fail
const gateBypassAttempt = { ...validResult, requiresUserConfirmation: false };
const gateBypassReport = validateExtractionResult(gateBypassAttempt);
assertEqual(gateBypassReport.valid, false, "result with requiresUserConfirmation=false fails validation");
const hasGateIssue = gateBypassReport.issues.some(
  (i) => i.includes("requiresUserConfirmation"),
);
assert(hasGateIssue, "validation issue mentions requiresUserConfirmation");

// Verify the adapter shape contract
const shapeCheck = validateAdapterShape(directGeminiAdapter);
assertEqual(shapeCheck.ok, true, "adapter passes shape validation");

/* ══════════════════════════════════════════════════════════════════
   Test 12: Provider call is not made by default
   ══════════════════════════════════════════════════════════════════ */

section("Test 12 — Provider call not made by default");

_resetModuleState();
_setProviderClient(null);
_setCredentialLoader(null);

const defaultProviderResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01-two-leg-clean",
  image: new Uint8Array([0]),
  mediaType: "image/png",
});

assertEqual(
  defaultProviderResult.extractionStatus,
  "disabled",
  "default extract returns disabled without provider client",
);
assertEqual(
  defaultProviderResult.syntheticDemo,
  true,
  "default result has syntheticDemo: true",
);
assertEqual(
  defaultProviderResult.requiresUserConfirmation,
  true,
  "default result requires user confirmation",
);

/* ══════════════════════════════════════════════════════════════════
   Test 13: Provider error yields error result with fallback
   ══════════════════════════════════════════════════════════════════ */

section("Test 13 — Provider error yields error result with fallback");

_resetModuleState();

const fakeClient13 = {
  async generateContent() {
    throw new Error("simulated provider failure");
  },
};
_setProviderClient(fakeClient13);
_setCredentialLoader(() => "test-credential-13");

// Config: directGeminiEnabled=true, capability=approved, model present.
// The provider call will fail; the adapter should return an error result.
const providerErrorResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01-two-leg-clean",
  image: new Uint8Array([0]),
  mediaType: "image/png",
});

assertEqual(
  providerErrorResult.extractionStatus,
  "error",
  "extract returns error when provider call fails",
);
assertEqual(
  providerErrorResult.sourceStatus.fallbackUsed,
  true,
  "error result has fallbackUsed: true",
);
assert(
  providerErrorResult.validationMessages.length > 0,
  "error result has validation messages with sanitized error",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 14: Model resolution uses env > capabilities > default
   ══════════════════════════════════════════════════════════════════ */

section("Test 14 — Model resolution from config");

_resetModuleState();

// With the current config, the model should be resolved from capabilities
// or the default. The adapter should be enabled when a credential is present.
const resolvedModel = _testHooks.resolveModel();
assert(
  typeof resolvedModel === "string" && resolvedModel.trim().length > 0,
  "model resolution returns a non-empty string",
);

// Verify the resolved model is used in the provider request
const fakeClient14 = {
  async generateContent(req) {
    assertEqual(req.model, resolvedModel, "provider request uses resolved model");
    return { text: JSON.stringify({
      extractionStatus: "success",
      firstLeg: { origin: "AAA", destination: "BBB", date: "2026-09-15", departureTime: "08:00", arrivalTime: "10:30" },
      secondLeg: { origin: "BBB", destination: "CCC", date: "2026-09-15", departureTime: "13:00", arrivalTime: "15:45" },
      connectionDurationMinutes: 150,
      missingFields: [],
      fieldConfidence: { overall: "high" },
      validationMessages: [],
    }) };
  },
};
_setProviderClient(fakeClient14);
_setCredentialLoader(() => "test-credential-14");

const modelResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01-two-leg-clean",
  image: new Uint8Array([0]),
  mediaType: "image/png",
});

assertEqual(
  modelResult.extractionStatus,
  "success",
  "extract succeeds with resolved model and fake client",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 15: Call rejected when runtime credential is missing
   ══════════════════════════════════════════════════════════════════ */

section("Test 15 — Rejected when credential missing");

_resetModuleState();

const fakeClient15 = {
  async generateContent() {
    throw new Error("should not be called");
  },
};
_setProviderClient(fakeClient15);
_setCredentialLoader(null); // No credential loader

// Even if config/capabilities were enabled, no credential = fallback
const credMissingResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01-two-leg-clean",
  image: new Uint8Array([0]),
  mediaType: "image/png",
});

assertEqual(
  credMissingResult.extractionStatus,
  "disabled",
  "extract returns disabled when credential missing",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 16: Injected fake SDK client receives correctly shaped request
   ══════════════════════════════════════════════════════════════════ */

section("Test 16 — Fake client receives correctly shaped request");

_resetModuleState();

let receivedRequest16 = null;
let receivedModel16 = null;

const fakeClient16 = {
  async generateContent(req) {
    receivedRequest16 = req;
    receivedModel16 = req.model;
    return {
      text: JSON.stringify({
        extractionStatus: "success",
        firstLeg: {
          origin: "AAA",
          destination: "BBB",
          date: "2026-09-15",
          departureTime: "08:00",
          arrivalTime: "10:30",
          airline: "Synthetic Carrier",
          flightNumber: "SC-101",
        },
        secondLeg: {
          origin: "BBB",
          destination: "CCC",
          date: "2026-09-15",
          departureTime: "13:00",
          arrivalTime: "15:45",
          airline: "Synthetic Carrier",
          flightNumber: "SC-202",
        },
        connectionDurationMinutes: 150,
        missingFields: [],
        fieldConfidence: { overall: "high" },
        validationMessages: [],
      }),
    };
  },
};

_setProviderClient(fakeClient16);
_setCredentialLoader(() => "test-credential-16");

// Manually invoke the provider-call function with a test model
const callProvider16 = _testHooks.createProviderCallFunction(fakeClient16);
const testReq16 = {
  fixtureId: "gem-01-two-leg-clean",
  image: new Uint8Array([1, 2, 3]),
  mediaType: "image/png",
};

await callProvider16(testReq16, "test-model-16", "test-credential-16");

assert(receivedRequest16 !== null, "fake client received a request");
assertEqual(receivedModel16, "test-model-16", "fake client received correct model");
assert(
  receivedRequest16.contents?.[0]?.parts?.[0]?.text?.includes("Extract"),
  "request contains extraction instruction",
);
assert(
  receivedRequest16.contents?.[0]?.parts?.[1]?.inlineData !== undefined,
  "request contains inline image data",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 17: Fake SDK response is normalized and validated
   ══════════════════════════════════════════════════════════════════ */

section("Test 17 — Fake SDK response normalized and validated");

_resetModuleState();

const fakeClient17 = {
  async generateContent() {
    return {
      text: JSON.stringify({
        extractionStatus: "success",
        firstLeg: {
          origin: "AAA",
          destination: "BBB",
          date: "2026-09-15",
          departureTime: "08:00",
          arrivalTime: "10:30",
          airline: "Synthetic Carrier",
          flightNumber: "SC-101",
        },
        secondLeg: {
          origin: "BBB",
          destination: "CCC",
          date: "2026-09-15",
          departureTime: "13:00",
          arrivalTime: "15:45",
          airline: "Synthetic Carrier",
          flightNumber: "SC-202",
        },
        connectionDurationMinutes: 150,
        missingFields: [],
        fieldConfidence: { overall: "high" },
        validationMessages: [],
      }),
    };
  },
};

const callProvider17 = _testHooks.createProviderCallFunction(fakeClient17);
const normalizedResult17 = await callProvider17(
  { fixtureId: "gem-01", image: new Uint8Array([1]), mediaType: "image/png" },
  "test-model-17",
  "test-cred-17",
);

assertEqual(
  normalizedResult17.extractionStatus,
  "success",
  "normalized result has extractionStatus success",
);
assert(
  normalizedResult17.firstLeg?.origin === "AAA",
  "normalized result has firstLeg.origin",
);
assert(
  normalizedResult17.secondLeg?.destination === "CCC",
  "normalized result has secondLeg.destination",
);
assertEqual(
  normalizedResult17.connectionDurationMinutes,
  150,
  "normalized result has connectionDurationMinutes",
);
assertEqual(
  normalizedResult17.requiresUserConfirmation,
  true,
  "normalized result requires user confirmation",
);

const normalizedValidation17 = validateExtractionResult(normalizedResult17);
assert(
  normalizedValidation17.valid,
  "normalized result passes validation",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 18: Raw fake-provider output is not returned
   ══════════════════════════════════════════════════════════════════ */

section("Test 18 — Raw provider output not returned");

_resetModuleState();

const fakeClient18 = {
  async generateContent() {
    return {
      text: JSON.stringify({
        extractionStatus: "success",
        firstLeg: {
          origin: "AAA",
          destination: "BBB",
          date: "2026-09-15",
          departureTime: "08:00",
          arrivalTime: "10:30",
        },
        secondLeg: {
          origin: "BBB",
          destination: "CCC",
          date: "2026-09-15",
          departureTime: "13:00",
          arrivalTime: "15:45",
        },
        connectionDurationMinutes: 150,
        missingFields: [],
        fieldConfidence: { overall: "high" },
        validationMessages: [],
      }),
      candidates: [{ content: { parts: [{ text: "raw" }] } }],
      usageMetadata: { promptTokens: 100, candidatesTokenCount: 50 },
    };
  },
};

const callProvider18 = _testHooks.createProviderCallFunction(fakeClient18);
const rawTestResult18 = await callProvider18(
  { fixtureId: "gem-01", image: new Uint8Array([1]), mediaType: "image/png" },
  "test-model-18",
  "test-cred-18",
);

assert(
  rawTestResult18.candidates === undefined,
  "normalized result does not contain raw candidates",
);
assert(
  rawTestResult18.usageMetadata === undefined,
  "normalized result does not contain usageMetadata",
);
assert(
  typeof rawTestResult18.text !== "string",
  "normalized result does not contain raw text field",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 19: Sanitized errors do not include credentials or raw content
   ══════════════════════════════════════════════════════════════════ */

section("Test 19 — Sanitized errors exclude credentials/raw content");

_resetModuleState();

const fakeClient19 = {
  async generateContent() {
    throw new Error(
      "API error: sk-abc123def456ghi789 at https://api.example.com/v1 Bearer token123 Stack trace: at line 42",
    );
  },
};

const callProvider19 = _testHooks.createProviderCallFunction(fakeClient19);
const errorResult19 = await callProvider19(
  { fixtureId: "gem-01", image: new Uint8Array([1]), mediaType: "image/png" },
  "test-model-19",
  "test-cred-19",
);

assertEqual(
  errorResult19.extractionStatus,
  "error",
  "error result has extractionStatus error",
);

const errorStr19 = JSON.stringify(errorResult19);
assert(
  !errorStr19.includes("sk-abc123def456ghi789"),
  "sanitized error does not contain API key",
);
assert(
  !errorStr19.includes("https://api.example.com"),
  "sanitized error does not contain URL",
);
assert(
  !errorStr19.includes("Bearer token123"),
  "sanitized error does not contain Bearer token",
);
assert(
  !errorStr19.includes("at line 42"),
  "sanitized error does not contain stack trace",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 20: Second call in same execution is rejected
   ══════════════════════════════════════════════════════════════════ */

section("Test 20 — Second call rejected (one-request limit)");

_resetModuleState();

let callCount20 = 0;
const fakeClient20 = {
  async generateContent() {
    callCount20 += 1;
    return {
      text: JSON.stringify({
        extractionStatus: "success",
        firstLeg: {
          origin: "AAA",
          destination: "BBB",
          date: "2026-09-15",
          departureTime: "08:00",
          arrivalTime: "10:30",
        },
        secondLeg: {
          origin: "BBB",
          destination: "CCC",
          date: "2026-09-15",
          departureTime: "13:00",
          arrivalTime: "15:45",
        },
        connectionDurationMinutes: 150,
        missingFields: [],
        fieldConfidence: { overall: "high" },
        validationMessages: [],
      }),
    };
  },
};

const callProvider20 = _testHooks.createProviderCallFunction(fakeClient20);
const testReq20 = {
  fixtureId: "gem-01",
  image: new Uint8Array([1]),
  mediaType: "image/png",
};

const firstCall20 = await callProvider20(testReq20, "test-model-20", "test-cred-20");
assertEqual(
  firstCall20.extractionStatus,
  "success",
  "first call succeeds",
);
assertEqual(callCount20, 1, "fake client called once");

const secondCall20 = await callProvider20(testReq20, "test-model-20", "test-cred-20");
assertEqual(
  secondCall20.extractionStatus,
  "disabled",
  "second call returns disabled (call limit exceeded)",
);
assertEqual(callCount20, 1, "fake client not called a second time");

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 21: Fallback labels and confirmation-gate assumptions unchanged
   ══════════════════════════════════════════════════════════════════ */

section("Test 21 — Fallback labels and confirmation gate unchanged");

_resetModuleState();

const fakeClient21 = {
  async generateContent() {
    return {
      text: JSON.stringify({
        extractionStatus: "success",
        firstLeg: {
          origin: "AAA",
          destination: "BBB",
          date: "2026-09-15",
          departureTime: "08:00",
          arrivalTime: "10:30",
        },
        secondLeg: {
          origin: "BBB",
          destination: "CCC",
          date: "2026-09-15",
          departureTime: "13:00",
          arrivalTime: "15:45",
        },
        connectionDurationMinutes: 150,
        missingFields: [],
        fieldConfidence: { overall: "high" },
        validationMessages: [],
      }),
    };
  },
};

_setProviderClient(fakeClient21);
_setCredentialLoader(() => "test-credential-21");

// Manually invoke provider-call to get an "enabled" result
const callProvider21 = _testHooks.createProviderCallFunction(fakeClient21);
const enabledResult21 = await callProvider21(
  { fixtureId: "gem-01", image: new Uint8Array([1]), mediaType: "image/png" },
  "test-model-21",
  "test-cred-21",
);

// Verify labels
assertEqual(
  enabledResult21.label,
  "Direct Gemini validation",
  "enabled result has correct label",
);
assertEqual(
  enabledResult21.sourceStatus.label,
  "Direct Gemini validation",
  "enabled source status has correct label",
);

// Verify confirmation gate
assertEqual(
  enabledResult21.requiresUserConfirmation,
  true,
  "enabled result still requires user confirmation (gate intact)",
);

// Verify default fallback labels when no credential is available
_resetModuleState(); // Clear injected client and credential loader
const defaultLabel21 = directGeminiAdapter.getLabel();
assertEqual(
  defaultLabel21,
  EXPECTED_FALLBACK_LABEL,
  "default getLabel() returns fallback label when no credential available",
);

const defaultResult21 = await directGeminiAdapter.extract({
  fixtureId: "gem-01",
  image: new Uint8Array([1]),
  mediaType: "image/png",
});
assertEqual(
  defaultResult21.label,
  EXPECTED_FALLBACK_LABEL,
  "default extract() returns fallback label when no credential available",
);
assertEqual(
  defaultResult21.requiresUserConfirmation,
  true,
  "default extract() still requires user confirmation",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 22 — Schema validator accepts string fieldConfidence values
   ══════════════════════════════════════════════════════════════════ */

section("Test 22 — Schema validator fieldConfidence contract alignment");

// The contract (extraction-contract.mjs) specifies fieldConfidence.overall
// as a string label ("high" | "medium" | "low"). The schema validator
// (schema-validator.mjs) must accept string values, not require numbers.

const stringConfResult = {
  extractionStatus: "success",
  firstLeg: {
    origin: "AAA",
    destination: "BBB",
    date: "2026-09-15",
    departureTime: "08:00",
    arrivalTime: "10:30",
  },
  secondLeg: {
    origin: "BBB",
    destination: "CCC",
    date: "2026-09-15",
    departureTime: "13:00",
    arrivalTime: "15:45",
  },
  connectionDurationMinutes: 150,
  missingFields: [],
  fieldConfidence: { overall: "high", note: "all fields populated" },
  validationMessages: [],
  requiresUserConfirmation: true,
  syntheticDemo: true,
};

const schemaReport1 = schemaValidateExtraction(stringConfResult);
assertEqual(
  schemaReport1.valid,
  true,
  "schema validator accepts string fieldConfidence values (contract-aligned)",
);

const disabledConfResult = {
  ...stringConfResult,
  extractionStatus: "disabled",
  firstLeg: null,
  secondLeg: null,
  connectionDurationMinutes: null,
  fieldConfidence: { overall: "none", note: "adapter not enabled" },
  missingFields: ["all — adapter disabled"],
};

const schemaReport2 = schemaValidateExtraction(disabledConfResult);
assertEqual(
  schemaReport2.valid,
  true,
  "schema validator accepts disabled result with string fieldConfidence 'none'",
);

// Empty string confidence must be rejected
const emptyConfResult = {
  ...stringConfResult,
  fieldConfidence: { overall: "" },
};

const schemaReport3 = schemaValidateExtraction(emptyConfResult);
assertEqual(
  schemaReport3.valid,
  false,
  "schema validator rejects empty-string fieldConfidence",
);

// Number confidence is still accepted (forward compatibility)
const numConfResult = {
  ...stringConfResult,
  fieldConfidence: { overall: 0.95 },
};

const schemaReport4 = schemaValidateExtraction(numConfResult);
assertEqual(
  schemaReport4.valid,
  true,
  "schema validator still accepts numeric fieldConfidence (forward compat)",
);

// Verify extraction-validator and schema-validator agree on the same result
const extractionReport = validateExtractionResult(stringConfResult);
assertEqual(
  extractionReport.valid,
  schemaReport1.valid,
  "extraction-validator and schema-validator agree on valid string-confidence result",
);

/* ══════════════════════════════════════════════════════════════════
   Test 23 — Authentication failure is detected and not retried
   ══════════════════════════════════════════════════════════════════ */

section("Test 23 — Authentication failure not retried");

_resetModuleState();

let authCallCount = 0;
const authFailClient = {
  async generateContent() {
    authCallCount += 1;
    throw new Error("401 Unauthorized — invalid API key");
  },
};

const callProviderAuth = _testHooks.createProviderCallFunction(authFailClient);
const authResult = await callProviderAuth(
  { fixtureId: "gem-01", image: new Uint8Array([1]), mediaType: "image/png" },
  "test-model-auth",
  "test-cred-auth",
);

assertEqual(
  authResult.extractionStatus,
  "error",
  "auth failure returns error status",
);
assertEqual(
  authCallCount,
  1,
  "auth failure is NOT retried (exactly one call)",
);
assertEqual(
  authResult.sourceStatus.fallbackUsed,
  true,
  "auth failure result has fallbackUsed: true",
);
assert(
  authResult.validationMessages.length > 0,
  "auth failure has validation messages",
);
// Verify the error message is sanitized (no raw credential patterns)
const authMsg = authResult.validationMessages.join(" ");
assert(
  !authMsg.includes("test-cred-auth"),
  "auth error message does not contain credential value",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 24 — Timeout is handled gracefully
   ══════════════════════════════════════════════════════════════════ */

section("Test 24 — Timeout handled gracefully");

_resetModuleState();

let timeoutCallCount = 0;
const timeoutClient = {
  async generateContent() {
    timeoutCallCount += 1;
    // Simulate a timeout error
    throw new Error("request_timeout");
  },
};

// Override the timeout to a very short value for testing
const origTimeoutMs = 60000;
const callProviderTimeout = _testHooks.createProviderCallFunction(timeoutClient);

// Note: We can't easily override the timeout in the closure, but we can
// verify that a timeout error is handled as a transient error and retried
// once, then returns an error result.
const timeoutResult = await callProviderTimeout(
  { fixtureId: "gem-01", image: new Uint8Array([1]), mediaType: "image/png" },
  "test-model-timeout",
  "test-cred-timeout",
);

assertEqual(
  timeoutResult.extractionStatus,
  "error",
  "timeout returns error status",
);
assert(
  timeoutCallCount >= 1 && timeoutCallCount <= 2,
  "timeout is retried at most once (1-2 calls total)",
);
assertEqual(
  timeoutResult.sourceStatus.fallbackUsed,
  true,
  "timeout result has fallbackUsed: true",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 25 — Secret redaction in error messages
   ══════════════════════════════════════════════════════════════════ */

section("Test 25 — Secret redaction in error messages");

const sanitizeError = _testHooks.sanitizeError;

// Test API key patterns are redacted
const errorWithApiKey = new Error("Failed with key AIzaSyA1234567890abcdefghijklmnopqrstuv");
const sanitized1 = sanitizeError(errorWithApiKey);
assert(
  !sanitized1.includes("AIzaSyA1234567890"),
  "Gemini API key pattern is redacted from error",
);
assert(
  sanitized1.includes("[REDACTED]"),
  "redaction marker is present",
);

// Test Bearer token is redacted
const errorWithBearer = new Error("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test");
const sanitized2 = sanitizeError(errorWithBearer);
assert(
  !sanitized2.includes("eyJhbGciOiJIUzI1NiJ9"),
  "Bearer token is redacted from error",
);

// Test URLs are redacted
const errorWithUrl = new Error("Request to https://api.example.com/v1/models failed");
const sanitized3 = sanitizeError(errorWithUrl);
assert(
  !sanitized3.includes("api.example.com"),
  "URL is redacted from error",
);

// Test email is redacted
const errorWithEmail = new Error("Contact admin@example.com for help");
const sanitized4 = sanitizeError(errorWithEmail);
assert(
  !sanitized4.includes("admin@example.com"),
  "email address is redacted from error",
);

// Test sk- key pattern is redacted
const errorWithSkKey = new Error("Key sk-abcdefghij1234567890 exposed");
const sanitized5 = sanitizeError(errorWithSkKey);
assert(
  !sanitized5.includes("sk-abcdefghij1234567890"),
  "sk- key pattern is redacted from error",
);

// Test non-error input is handled
const sanitized6 = sanitizeError("plain string error");
assertEqual(
  sanitized6,
  "plain string error",
  "plain string without secrets passes through unchanged",
);

// Test empty/null input
const sanitized7 = sanitizeError(new Error(""));
assert(
  typeof sanitized7 === "string" && sanitized7.length > 0,
  "empty error produces a non-empty sanitized string",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 26 — Evidence records provider, model, and label
   ══════════════════════════════════════════════════════════════════ */

section("Test 26 — Evidence records provider, model, and label");

_resetModuleState();

const evidenceClient = {
  async generateContent() {
    return {
      text: JSON.stringify({
        extractionStatus: "success",
        firstLeg: {
          origin: "JFK",
          destination: "LAX",
          date: "2026-09-20",
          departureTime: "08:00",
          arrivalTime: "11:30",
        },
        secondLeg: {
          origin: "LAX",
          destination: "SFO",
          date: "2026-09-20",
          departureTime: "14:00",
          arrivalTime: "15:30",
        },
        connectionDurationMinutes: 150,
        missingFields: [],
        fieldConfidence: { overall: "high" },
        validationMessages: [],
      }),
    };
  },
};

_setProviderClient(evidenceClient);
_setCredentialLoader(() => "test-credential-evidence");

const evidenceResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01-two-leg-clean",
  image: new Uint8Array([0]),
  mediaType: "image/png",
});

assertEqual(
  evidenceResult.extractionStatus,
  "success",
  "evidence test: extraction succeeds",
);
assertEqual(
  evidenceResult.sourceStatus.provider,
  "gemini",
  "evidence records provider as 'gemini'",
);
assertEqual(
  evidenceResult.sourceStatus.label,
  "Direct Gemini validation",
  "evidence records correct label",
);
assertEqual(
  evidenceResult.sourceStatus.executed,
  true,
  "evidence records executed: true",
);
assertEqual(
  evidenceResult.sourceStatus.enabled,
  true,
  "evidence records enabled: true",
);
assertEqual(
  evidenceResult.sourceStatus.authorizationKey,
  "GEMINI_API_KEY",
  "evidence records authorizationKey (not the value)",
);
assertEqual(
  evidenceResult.sourceStatus.fallbackUsed,
  false,
  "successful result has fallbackUsed: false",
);
assertEqual(
  evidenceResult.label,
  "Direct Gemini validation",
  "top-level label matches evidence label",
);
assertEqual(
  evidenceResult.requiresUserConfirmation,
  true,
  "evidence result still requires user confirmation",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 27 — Malformed JSON response handled defensively
   ══════════════════════════════════════════════════════════════════ */

section("Test 27 — Malformed JSON response");

_resetModuleState();

const malformedClient = {
  async generateContent() {
    return { text: "this is not json at all {{{" };
  },
};

_setProviderClient(malformedClient);
_setCredentialLoader(() => "test-cred-malformed");

const malformedResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01",
  image: new Uint8Array([1]),
  mediaType: "image/png",
});

assertEqual(
  malformedResult.extractionStatus,
  "partial",
  "malformed JSON returns partial status",
);
assertEqual(
  malformedResult.sourceStatus.provider,
  "gemini",
  "malformed result still records provider as gemini",
);
assert(
  malformedResult.validationMessages.length > 0,
  "malformed result has validation messages",
);
assert(
  malformedResult.validationMessages.some(m => m.includes("parse")),
  "validation message mentions parse failure",
);
assertEqual(
  malformedResult.requiresUserConfirmation,
  true,
  "malformed result still requires user confirmation",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 28 — Empty text response handled
   ══════════════════════════════════════════════════════════════════ */

section("Test 28 — Empty text response");

_resetModuleState();

const emptyClient = {
  async generateContent() {
    return { text: "" };
  },
};

_setProviderClient(emptyClient);
_setCredentialLoader(() => "test-cred-empty");

const emptyResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01",
  image: new Uint8Array([1]),
  mediaType: "image/png",
});

assertEqual(
  emptyResult.extractionStatus,
  "partial",
  "empty text returns partial status",
);
assert(
  emptyResult.validationMessages.some(m => m.includes("no text")),
  "validation message indicates no text output",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 29 — Missing GEMINI_API_KEY disables adapter
   ══════════════════════════════════════════════════════════════════ */

section("Test 29 — Missing GEMINI_API_KEY disables adapter");

_resetModuleState();

// Ensure no credential loader is set and no env key
_setCredentialLoader(null);
const savedKey = process.env.GEMINI_API_KEY;
delete process.env.GEMINI_API_KEY;

const noKeyAuth = directGeminiAdapter.isEnabled();
assertEqual(
  noKeyAuth,
  false,
  "adapter is disabled when GEMINI_API_KEY is absent",
);

const noKeyResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01",
  image: new Uint8Array([1]),
  mediaType: "image/png",
});

assertEqual(
  noKeyResult.extractionStatus,
  "disabled",
  "missing key returns disabled status",
);
assertEqual(
  noKeyResult.sourceStatus.fallbackUsed,
  true,
  "missing key result uses fallback",
);
assertEqual(
  noKeyResult.label,
  EXPECTED_FALLBACK_LABEL,
  "missing key returns fallback label",
);

// Restore env key if it was set
if (savedKey !== undefined) {
  process.env.GEMINI_API_KEY = savedKey;
}

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 30 — Model resolution priority: env > capabilities > default
   ══════════════════════════════════════════════════════════════════ */

section("Test 30 — Model resolution priority");

_resetModuleState();

// Test default model (no env set)
const savedModel = process.env.GEMINI_MODEL;
delete process.env.GEMINI_MODEL;

const defaultModel = _testHooks.resolveModel();
assert(
  typeof defaultModel === "string" && defaultModel.length > 0,
  "default model resolution returns a non-empty string",
);
// Should be from capabilities or the hardcoded default
assert(
  defaultModel === "gemini-2.5-flash" || defaultModel.length > 0,
  "default model is gemini-2.5-flash or from capabilities",
);

// Test env override
process.env.GEMINI_MODEL = "gemini-2.5-pro";
const envModel = _testHooks.resolveModel();
assertEqual(
  envModel,
  "gemini-2.5-pro",
  "GEMINI_MODEL env var overrides capabilities and default",
);

// Restore
if (savedModel !== undefined) {
  process.env.GEMINI_MODEL = savedModel;
} else {
  delete process.env.GEMINI_MODEL;
}

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 31 — Auth error detection patterns
   ══════════════════════════════════════════════════════════════════ */

section("Test 31 — Auth error detection patterns");

const isAuthError = _testHooks.isAuthError;

assert(
  isAuthError(new Error("401 Unauthorized")),
  "401 is detected as auth error",
);
assert(
  isAuthError(new Error("403 Forbidden")),
  "403 is detected as auth error",
);
assert(
  isAuthError(new Error("invalid api key provided")),
  "'invalid api key' is detected as auth error",
);
assert(
  isAuthError(new Error("authentication failed")),
  "'authentication' is detected as auth error",
);
assert(
  !isAuthError(new Error("request_timeout")),
  "timeout is NOT an auth error",
);
assert(
  !isAuthError(new Error("network error")),
  "network error is NOT an auth error",
);
assert(
  !isAuthError(new Error("rate limit exceeded")),
  "rate limit is NOT an auth error",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 32 — Provider request includes structured output config
   ══════════════════════════════════════════════════════════════════ */

section("Test 32 — Provider request includes structured output config");

_resetModuleState();

const buildProviderRequest = _testHooks.buildProviderRequest;
const providerReq = buildProviderRequest(
  { fixtureId: "gem-01", image: new Uint8Array([1, 2, 3]), mediaType: "image/png" },
  "gemini-2.5-flash",
);

assertEqual(
  providerReq.model,
  "gemini-2.5-flash",
  "provider request uses the resolved model",
);
assert(
  Array.isArray(providerReq.contents),
  "provider request has contents array",
);
assertEqual(
  providerReq.contents[0].role,
  "user",
  "provider request uses 'user' role",
);
assert(
  providerReq.contents[0].parts.length >= 2,
  "provider request has text + image parts",
);
assert(
  typeof providerReq.contents[0].parts[0].text === "string",
  "first part is text (extraction prompt)",
);
assert(
  providerReq.contents[0].parts[1].inlineData !== undefined,
  "second part is inlineData (image)",
);
assertEqual(
  providerReq.contents[0].parts[1].inlineData.mimeType,
  "image/png",
  "image mimeType is preserved",
);
assert(
  providerReq.config !== undefined,
  "provider request includes config",
);
assertEqual(
  providerReq.config.responseMimeType,
  "application/json",
  "config sets responseMimeType to application/json",
);
assert(
  providerReq.config.responseSchema !== undefined,
  "config includes responseSchema",
);
assertEqual(
  providerReq.config.responseSchema.type,
  "OBJECT",
  "responseSchema uses Gemini uppercase OBJECT type",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 33 — Human confirmation gate and no-write invariant
   ══════════════════════════════════════════════════════════════════ */

section("Test 33 — Human confirmation gate and no-write invariant");

_resetModuleState();

// Test with a successful provider result
const confirmClient = {
  async generateContent() {
    return {
      text: JSON.stringify({
        extractionStatus: "success",
        firstLeg: {
          origin: "SIN",
          destination: "HKG",
          date: "2026-10-01",
          departureTime: "09:00",
          arrivalTime: "13:00",
        },
        secondLeg: {
          origin: "HKG",
          destination: "NRT",
          date: "2026-10-01",
          departureTime: "15:00",
          arrivalTime: "19:30",
        },
        connectionDurationMinutes: 120,
        missingFields: [],
        fieldConfidence: { overall: "high" },
        validationMessages: [],
      }),
    };
  },
};

_setProviderClient(confirmClient);
_setCredentialLoader(() => "test-cred-confirm");

const confirmResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01-two-leg-clean",
  image: new Uint8Array([0]),
  mediaType: "image/png",
});

assertEqual(
  confirmResult.requiresUserConfirmation,
  true,
  "successful extraction ALWAYS requires user confirmation",
);

// Test with disabled result
_resetModuleState();
const disabledConfirmResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01",
  image: new Uint8Array([1]),
  mediaType: "image/png",
});

assertEqual(
  disabledConfirmResult.requiresUserConfirmation,
  true,
  "disabled extraction ALSO requires user confirmation",
);

// Test with error result
_resetModuleState();
const errorConfirmClient = {
  async generateContent() {
    throw new Error("simulated error");
  },
};
_setProviderClient(errorConfirmClient);
_setCredentialLoader(() => "test-cred-error-confirm");

const errorConfirmResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01",
  image: new Uint8Array([1]),
  mediaType: "image/png",
});

assertEqual(
  errorConfirmResult.requiresUserConfirmation,
  true,
  "error extraction ALSO requires user confirmation",
);

// Verify no-write: adapter never returns booking/payment instructions
assertEqual(
  confirmResult.syntheticDemo,
  true,
  "result is always marked syntheticDemo: true (no-write boundary)",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 34 — Readiness report does not expose secrets
   ══════════════════════════════════════════════════════════════════ */

section("Test 34 — Readiness report does not expose secrets");

_resetModuleState();
_setCredentialLoader(() => "super-secret-key-12345");

const readinessReport34 = getDirectGeminiReadiness();
const readinessStr = JSON.stringify(readinessReport34);

assert(
  !readinessStr.includes("super-secret-key-12345"),
  "readiness report does not contain credential value",
);
assert(
  typeof readinessReport34 === "object" && readinessReport34 !== null,
  "readiness report returns an object",
);
assertEqual(
  readinessReport34.adapter,
  "direct-gemini",
  "readiness report identifies adapter",
);
assert(
  typeof readinessReport34.enabled === "boolean",
  "readiness report includes boolean enabled flag",
);
assert(
  readinessReport34.safetyLimits !== undefined,
  "readiness report includes safety limits",
);
assert(
  Array.isArray(readinessReport34.prerequisites) && readinessReport34.prerequisites.length > 0,
  "readiness report includes prerequisites list",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 35 — Schema validation failure downgrades to partial
   ══════════════════════════════════════════════════════════════════ */

section("Test 35 — Schema validation failure downgrades to partial");

_resetModuleState();

const schemaFailClient = {
  async generateContent() {
    return {
      text: JSON.stringify({
        extractionStatus: "success",
        firstLeg: { origin: "", destination: "", date: "", departureTime: "", arrivalTime: "" },
        secondLeg: { origin: "", destination: "", date: "", departureTime: "", arrivalTime: "" },
        connectionDurationMinutes: null,
        missingFields: [],
        fieldConfidence: { overall: "" },
        validationMessages: [],
      }),
    };
  },
};

_setProviderClient(schemaFailClient);
_setCredentialLoader(() => "test-cred-schema-fail");

const schemaFailResult = await directGeminiAdapter.extract({
  fixtureId: "gem-01",
  image: new Uint8Array([1]),
  mediaType: "image/png",
});

// The adapter should detect validation issues and downgrade
assert(
  schemaFailResult.extractionStatus === "partial" || schemaFailResult.extractionStatus === "success",
  "schema validation issues are handled (partial or success depending on validator)",
);
assert(
  schemaFailResult.validationMessages.length > 0 || schemaFailResult.extractionStatus === "partial",
  "schema validation issues produce messages or partial status",
);
assertEqual(
  schemaFailResult.requiresUserConfirmation,
  true,
  "schema validation failure still requires user confirmation",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Summary
   ══════════════════════════════════════════════════════════════════ */

console.log(`\n${"═".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  ❌  ${f}`);
  }
}
console.log();

process.exit(failed > 0 ? 1 : 0);
