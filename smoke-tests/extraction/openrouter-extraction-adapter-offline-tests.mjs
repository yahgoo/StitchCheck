// Offline deterministic tests for the OpenRouter extraction adapter boundary.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXTRACTION_LABELS,
  createDisabledExtractionResult,
  validateAdapterShape,
} from "./extraction-contract.mjs";

import {
  openrouterExtractionAdapter,
  getOpenRouterExtractionReadiness,
  _setProviderClient,
  _setCredentialLoader,
  _resetModuleState,
  _testHooks,
} from "./openrouter-extraction-adapter.mjs";

const harnessDir = dirname(fileURLToPath(import.meta.url));
const LIVE_LABEL = EXTRACTION_LABELS.liveValidation;
const FALLBACK_LABEL = EXTRACTION_LABELS.syntheticLocalFallback;

const _envKeyBackup = { OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY };
delete process.env.OPENROUTER_API_KEY;

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

function mockSuccessClient(payload) {
  return {
    async chatCompletions() {
      return {
        choices: [{ message: { content: JSON.stringify(payload) } }],
      };
    },
  };
}

section("Test 1 — Disabled-by-default fallback");
assertEqual(openrouterExtractionAdapter.isEnabled(), false, "isEnabled() false without credential");
const defaultResult = await openrouterExtractionAdapter.extract({
  fixtureId: "gem-01-two-leg-clean",
  image: new Uint8Array([0]),
  mediaType: "image/png",
});
assertEqual(defaultResult.extractionStatus, "disabled", "default extract() is disabled");
assertEqual(defaultResult.label, FALLBACK_LABEL, "fallback label when disabled");

section("Test 2 — Adapter shape");
const shape = validateAdapterShape(openrouterExtractionAdapter);
assert(shape.ok, "adapter satisfies ExtractionAdapter shape");

section("Test 3 — Network boundary");
const adapterSource = readFileSync(join(harnessDir, "openrouter-extraction-adapter.mjs"), "utf8");
const contractSource = readFileSync(join(harnessDir, "extraction-contract.mjs"), "utf8");
assert(!/\bfetch\s*\(/.test(contractSource), "contract remains network-free");
assert(/minimax\/minimax-m3:free/.test(adapterSource), "adapter pins minimax/minimax-m3:free");
assert(/OPENROUTER_CHAT_ENDPOINT/.test(adapterSource), "adapter uses OpenRouter chat endpoint");

section("Test 4 — Successful mock extraction");
_resetModuleState();
_setProviderClient(mockSuccessClient({
  extractionStatus: "success",
  firstLeg: {
    origin: "SIN",
    destination: "KUL",
    date: "2026-08-01",
    departureTime: "08:00",
    arrivalTime: "09:05",
    airline: "SC",
    flightNumber: "SC-101",
  },
  secondLeg: {
    origin: "KUL",
    destination: "BKK",
    date: "2026-08-01",
    departureTime: "11:00",
    arrivalTime: "12:10",
    airline: "SC",
    flightNumber: "SC-202",
  },
  connectionDurationMinutes: 115,
  missingFields: [],
  fieldConfidence: { overall: "high" },
  validationMessages: [],
  requiresUserConfirmation: true,
  syntheticDemo: true,
}));
_setCredentialLoader(() => "test-credential");

const successResult = await openrouterExtractionAdapter.extract({
  fixtureId: "gem-01-two-leg-clean",
  image: new Uint8Array([1]),
  mediaType: "image/png",
});
assertEqual(successResult.extractionStatus, "success", "mock success extraction");
assertEqual(successResult.sourceStatus.provider, "openrouter", "provider is openrouter");
assertEqual(successResult.sourceStatus.authorizationKey, "OPENROUTER_API_KEY", "authorizationKey recorded");
assertEqual(successResult.sourceStatus.label, LIVE_LABEL, "live validation label");
assertEqual(successResult.sourceStatus.transport, "openrouter", "transport is openrouter");

section("Test 5 — Model resolution");
assertEqual(_testHooks.resolveModel(), "minimax/minimax-m3:free", "default model is minimax/minimax-m3:free");

section("Test 6 — Missing OPENROUTER_API_KEY disables adapter");
_resetModuleState();
_setCredentialLoader(null);
delete process.env.OPENROUTER_API_KEY;
assertEqual(openrouterExtractionAdapter.isEnabled(), false, "disabled without OPENROUTER_API_KEY");

section("Test 7 — Readiness report");
_resetModuleState();
const readiness = getOpenRouterExtractionReadiness();
assert(typeof readiness.enabled === "boolean", "readiness exposes enabled flag");
assertEqual(readiness.adapter, "openrouter-extraction", "readiness adapter id");
assert(!JSON.stringify(readiness).includes("sk-or-v1-"), "readiness does not leak credentials");

section("Test 8 — Parser handles prose-wrapped JSON");

const wrapped = _testHooks.parseProviderText(
  'Here is the itinerary:\n```json\n{"extractionStatus":"success","firstLeg":{"origin":"SIN","destination":"KUL","date":"2026-08-01","departureTime":"08:00","arrivalTime":"09:05","flightNumber":"SC-101"},"secondLeg":null,"missingFields":[],"fieldConfidence":{"overall":"high"},"validationMessages":[],"requiresUserConfirmation":true,"syntheticDemo":true}\n```\nThanks.',
);
assert(wrapped.parsed !== null, "parser extracts JSON from prose and fences");
assertEqual(wrapped.parsed.firstLeg.origin, "SIN", "parsed origin preserved");

section("Test 9 — Schema assessment rejects missing flightNumber");
const badSchema = _testHooks.assessItinerarySchema({
  firstLeg: { origin: "SIN", destination: "KUL", departureTime: "08:00", arrivalTime: "09:05" },
});
assertEqual(badSchema.schemaValidated, false, "missing flightNumber fails schema assessment");

if (_envKeyBackup.OPENROUTER_API_KEY !== undefined) {
  process.env.OPENROUTER_API_KEY = _envKeyBackup.OPENROUTER_API_KEY;
}

console.log(`\n${"═".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  ❌  ${f}`);
}
process.exit(failed > 0 ? 1 : 0);
