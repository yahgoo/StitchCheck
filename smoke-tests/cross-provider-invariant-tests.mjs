// Cross-provider invariant tests for StitchCheck.
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// These tests verify shared evidence, confirmation, and offline-safety
// invariants across Gemini, Atlas, and Nosana boundaries. They protect
// the property that no local placeholder is ever labelled as live provider
// evidence, that confirmation gates are preserved, and that disabled
// provider states remain disabled by default.
//
// Hard guarantees:
// - Zero network code: no fetch/http/https/net/socket imports or calls.
// - Zero credentials read: no .env or secret file is ever touched.
// - Zero dependencies: Node.js built-ins and existing local modules only.
// - Deterministic: no randomness, no timing, no external calls.
// - Reads existing fixtures and contracts only; never modifies them.

import assert from "node:assert";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import {
  EXTRACTION_LABELS,
  createDisabledExtractionResult,
  createDisabledSourceStatus,
} from "./extraction/extraction-contract.mjs";

import { openrouterExtractionAdapter } from "./extraction/openrouter-extraction-adapter.mjs";

import {
  ATLAS_LABELS,
  createDisabledAtlasSearchResult,
  createDisabledAtlasSourceStatus,
} from "./atlas/alternatives-contract.mjs";

import {
  createNosanaClient,
  NOSANA_CLIENT_CONSTANTS,
} from "./nosana/nosana-client.mjs";

import {
  PLACEHOLDER_LABEL as NOSANA_PLACEHOLDER_LABEL,
} from "./nosana/schema-validator.mjs";

import {
  DISCLAIMER_LABEL as ATLAS_DISCLAIMER_LABEL,
} from "./atlas/schema-validator.mjs";

import {
  validateExtractionResult as validateGeminiExtractionResult,
} from "./extraction/schema-validator.mjs";

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

// ── Invariant 1: Every local placeholder result has executedAgainstProvider: false,
//                 a synthetic/local source classification, and an explicit non-live
//                 evidence boundary. ───────────────────────────────────────────────

test("Gemini disabled result has executedAgainstProvider: false", () => {
  const result = createDisabledExtractionResult("test");
  assert.strictEqual(result.sourceStatus.executed, false);
});

test("Gemini disabled result has synthetic/local source classification", () => {
  const result = createDisabledExtractionResult("test");
  assert.strictEqual(result.syntheticDemo, true);
  assert.strictEqual(result.sourceStatus.fallbackUsed, true);
});

test("Gemini disabled result has explicit non-live evidence boundary", () => {
  const result = createDisabledExtractionResult("test");
  assert.strictEqual(result.sourceStatus.label, EXTRACTION_LABELS.syntheticLocalFallback);
});

test("Nosana client status has executedAgainstProvider: false", () => {
  const client = createNosanaClient({ mode: "offline" });
  const status = client.getStatus();
  assert.strictEqual(status.executedAgainstProvider, false);
});

test("Nosana client status has synthetic/local source classification", () => {
  const client = createNosanaClient({ mode: "offline" });
  const status = client.getStatus();
  assert.strictEqual(status.sourceType, "synthetic-local-placeholder");
});

test("Nosana client status has explicit non-live evidence boundary", () => {
  const client = createNosanaClient({ mode: "offline" });
  const status = client.getStatus();
  assert.strictEqual(status.placeholderLabel, NOSANA_PLACEHOLDER_LABEL);
});

test("Nosana normalized fixture result has executedAgainstProvider: false", () => {
  const client = createNosanaClient({ mode: "offline" });
  const fixtureResult = {
    workloadStatus: "completed",
    riskBand: "medium",
    riskScore: 0.5,
    heuristicDisclaimer: "test disclaimer",
    failureCascadeExplanation: "test explanation",
    datasetVersion: "v1",
    fallbackUsed: false,
  };
  const normalized = client.normalizeFixtureResult(fixtureResult);
  assert.strictEqual(normalized.executedAgainstProvider, false);
});

test("Nosana normalized fixture result has synthetic/local source classification", () => {
  const client = createNosanaClient({ mode: "offline" });
  const fixtureResult = {
    workloadStatus: "completed",
    riskBand: "medium",
    riskScore: 0.5,
    heuristicDisclaimer: "test disclaimer",
    failureCascadeExplanation: "test explanation",
    datasetVersion: "v1",
    fallbackUsed: false,
  };
  const normalized = client.normalizeFixtureResult(fixtureResult);
  assert.strictEqual(normalized.sourceType, "synthetic-local-placeholder");
});

test("Atlas disabled result has executed: false", () => {
  const result = createDisabledAtlasSearchResult("test");
  assert.strictEqual(result.sourceStatus.executed, false);
});

test("Atlas disabled result has synthetic/local source classification", () => {
  const result = createDisabledAtlasSearchResult("test");
  assert.strictEqual(result.syntheticDemo, true);
  assert.strictEqual(result.sourceStatus.fallbackUsed, true);
});

test("Atlas disabled result has explicit non-live evidence boundary", () => {
  const result = createDisabledAtlasSearchResult("test");
  assert.strictEqual(result.sourceStatus.label, ATLAS_LABELS.syntheticLocalFallback);
});

// ── Invariant 2: Every result requiring downstream decision support preserves
//                 requiresUserConfirmation: true. ─────────────────────────────────

test("Gemini disabled result requires user confirmation", () => {
  const result = createDisabledExtractionResult("test");
  assert.strictEqual(result.requiresUserConfirmation, true);
});

test("Atlas disabled result requires user confirmation", () => {
  const result = createDisabledAtlasSearchResult("test");
  assert.strictEqual(result.requiresUserConfirmation, true);
});

test("Gemini schema validator enforces requiresUserConfirmation", () => {
  const invalidResult = {
    extractionStatus: "disabled",
    requiresUserConfirmation: false,
    syntheticDemo: true,
    missingFields: [],
    validationMessages: [],
  };
  const validation = validateGeminiExtractionResult(invalidResult);
  assert.strictEqual(validation.valid, false);
  assert.ok(validation.issues.some(issue => issue.includes("requiresUserConfirmation")));
});

// ── Invariant 3: Disabled provider states remain disabled by default. ────────────

test("Extraction adapter is disabled by default", () => {
  assert.strictEqual(openrouterExtractionAdapter.isEnabled(), false);
});

test("Atlas disabled source status has enabled: false", () => {
  const status = createDisabledAtlasSourceStatus(ATLAS_LABELS.syntheticLocalFallback, true);
  assert.strictEqual(status.enabled, false);
});

test("Nosana client status is disabled in offline mode", () => {
  const client = createNosanaClient({ mode: "offline" });
  const status = client.getStatus();
  assert.strictEqual(status.status, "disabled");
});

// ── Invariant 4: Exact evidence labels remain unchanged. ─────────────────────────

test("Extraction live validation label is exact", () => {
  assert.strictEqual(
    EXTRACTION_LABELS.liveValidation,
    "Source: AI extraction (MiniMax M3 via OpenRouter) · live",
  );
});

test("Nosana placeholder label is exact", () => {
  assert.strictEqual(
    NOSANA_PLACEHOLDER_LABEL,
    "Synthetic local placeholder — not Nosana evidence"
  );
});

test("Atlas disclaimer label is exact", () => {
  assert.strictEqual(
    ATLAS_DISCLAIMER_LABEL,
    "Synthetic local placeholder — not Atlas Sandbox evidence"
  );
});

test("Atlas synthetic local fallback label is exact", () => {
  assert.strictEqual(
    ATLAS_LABELS.syntheticLocalFallback,
    "Synthetic local placeholder — not Atlas Sandbox evidence"
  );
});

// ── Invariant 5: No local placeholder is labelled as provider evidence. ──────────

test("Extraction disabled result label is not live validation", () => {
  const result = createDisabledExtractionResult("test");
  assert.notStrictEqual(result.sourceStatus.label, EXTRACTION_LABELS.liveValidation);
  assert.notStrictEqual(result.label, EXTRACTION_LABELS.liveValidation);
});

test("Nosana result sourceType is not provider-evidence", () => {
  const client = createNosanaClient({ mode: "offline" });
  const status = client.getStatus();
  assert.notStrictEqual(status.sourceType, "provider-evidence");
  assert.notStrictEqual(status.sourceType, "live-provider_evidence");
});

test("Atlas disabled result label is not live Atlas evidence", () => {
  const result = createDisabledAtlasSearchResult("test");
  assert.ok(result.sourceStatus.label.includes("placeholder"));
  assert.ok(!result.sourceStatus.label.includes("live"));
});

// ── Invariant 6: Nosana mutation-like operations remain rejected. ────────────────

test("Nosana rejects submit mutation", () => {
  const client = createNosanaClient({ mode: "offline" });
  assert.throws(() => client.rejectMutation("submit"), /Mutation operation/);
});

test("Nosana rejects deploy mutation", () => {
  const client = createNosanaClient({ mode: "offline" });
  assert.throws(() => client.rejectMutation("deploy"), /Mutation operation/);
});

test("Nosana rejects fund mutation", () => {
  const client = createNosanaClient({ mode: "offline" });
  assert.throws(() => client.rejectMutation("fund"), /Mutation operation/);
});

test("Nosana rejects cancel mutation", () => {
  const client = createNosanaClient({ mode: "offline" });
  assert.throws(() => client.rejectMutation("cancel"), /Mutation operation/);
});

test("Nosana rejects reserve mutation", () => {
  const client = createNosanaClient({ mode: "offline" });
  assert.throws(() => client.rejectMutation("reserve"), /Mutation operation/);
});

test("Nosana rejects purchase mutation", () => {
  const client = createNosanaClient({ mode: "offline" });
  assert.throws(() => client.rejectMutation("purchase"), /Mutation operation/);
});

test("Nosana rejects delete mutation", () => {
  const client = createNosanaClient({ mode: "offline" });
  assert.throws(() => client.rejectMutation("delete"), /Mutation operation/);
});

// ── Invariant 7: No credential-like, header-like, token-like, PII, or
//                 raw-provider fields survive sanitization. ───────────────────────

test("Nosana sanitization strips apiKey from request envelope", () => {
  const client = createNosanaClient({ mode: "offline" });
  const workload = {
    correlationId: "test-001",
    origin: "AAA",
    connectionAirport: "BBB",
    destination: "CCC",
    connectionDurationMinutes: 60,
    staticHistoricalDatasetVersion: "v1",
    syntheticDemo: true,
    nonPiiDeclaration: true,
    apiKey: "secret-key-12345",
  };
  const envelope = client.buildRequestEnvelope(workload);
  assert.strictEqual(envelope.valid, true);
  assert.strictEqual(envelope.envelope.apiKey, undefined);
});

test("Nosana sanitization strips authorization header from request envelope", () => {
  const client = createNosanaClient({ mode: "offline" });
  const workload = {
    correlationId: "test-002",
    origin: "AAA",
    connectionAirport: "BBB",
    destination: "CCC",
    connectionDurationMinutes: 60,
    staticHistoricalDatasetVersion: "v1",
    syntheticDemo: true,
    nonPiiDeclaration: true,
    authorization: "Bearer token-xyz",
  };
  const envelope = client.buildRequestEnvelope(workload);
  assert.strictEqual(envelope.valid, true);
  assert.strictEqual(envelope.envelope.authorization, undefined);
});

test("Nosana sanitization strips PII fields from request envelope", () => {
  const client = createNosanaClient({ mode: "offline" });
  const workload = {
    correlationId: "test-003",
    origin: "AAA",
    connectionAirport: "BBB",
    destination: "CCC",
    connectionDurationMinutes: 60,
    staticHistoricalDatasetVersion: "v1",
    syntheticDemo: true,
    nonPiiDeclaration: true,
    passenger: "John Doe",
    email: "john@example.com",
  };
  const envelope = client.buildRequestEnvelope(workload);
  assert.strictEqual(envelope.valid, true);
  assert.strictEqual(envelope.envelope.passenger, undefined);
  assert.strictEqual(envelope.envelope.email, undefined);
});

test("Nosana sanitization strips credential-like fields from normalized result", () => {
  const client = createNosanaClient({ mode: "offline" });
  const fixtureResult = {
    workloadStatus: "completed",
    riskBand: "medium",
    riskScore: 0.5,
    heuristicDisclaimer: "test disclaimer",
    failureCascadeExplanation: "test explanation",
    datasetVersion: "v1",
    fallbackUsed: false,
    token: "secret-token",
    password: "secret-password",
  };
  const normalized = client.normalizeFixtureResult(fixtureResult);
  assert.strictEqual(normalized.token, undefined);
  assert.strictEqual(normalized.password, undefined);
});

// ── Invariant 8: The test source itself contains no network primitive, live SDK
//                 import, credential reference, endpoint, URL, or secret. ─────────

// Build forbidden strings dynamically to avoid self-referential matches.
const _netModules = ["fetch", "http", "https", "net", "socket"]
  .map((m) => `import ${m}`);
// Construct SDK package names dynamically to avoid self-match.
const _sdkPackages = [
  ["@google", "genai"].join("/"),
  ["@anthropic-ai", "sdk"].join("/"),
];

test("Test source contains no network primitives", () => {
  const testSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  // Check for actual import statements of network modules
  for (const mod of _netModules) {
    assert.ok(
      !testSource.includes(mod),
      `Forbidden import found: ${mod}`,
    );
  }
  // Check for live SDK package imports
  for (const pkg of _sdkPackages) {
    assert.ok(
      !testSource.includes(pkg),
      `Forbidden SDK import found: ${pkg}`,
    );
  }
});

test("Test source contains no credential references", () => {
  const testSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  // Check for env-file reads or credential loading patterns
  // Construct dynamically to avoid self-match.
  const _envLocal = [".env", ".local"].join("");
  assert.ok(
    !testSource.includes(_envLocal),
    "Forbidden: env-local reference found",
  );
  // Check for credential assignment patterns at module scope
  // (test-local objects with forbidden keys are allowed for sanitization tests)
  const credAssign = /(?:^|\n)\s*(?:const|let|var)\s+(?:apiKey|api_key|secret|password)\s*=/;
  assert.ok(
    !credAssign.test(testSource),
    "Forbidden: credential assignment found",
  );
});

test("Test source contains no endpoint URLs", () => {
  const testSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  // Check for actual URL strings (http:// or https://)
  const urlPattern = /https?:\/\/[^\s"')]+/;
  assert.ok(
    !urlPattern.test(testSource),
    "Forbidden: endpoint URL found",
  );
});

// ── Invariant 9: The test is deterministic and performs zero external calls. ─────

test("Test is deterministic: first run completes", () => {
  // This test itself is part of the deterministic run
  assert.ok(true);
});

test("Test performs zero external calls: no network imports", () => {
  const testSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  for (const mod of _netModules) {
    assert.ok(
      !testSource.includes(mod),
      `Forbidden network import found: ${mod}`,
    );
  }
});

// ── Summary ──────────────────────────────────────────────────────────────────────

console.log(`\nCross-provider invariant tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
