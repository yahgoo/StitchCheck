// Offline deterministic regression tests for the gemini-3.7-flash
// Interactions API routing fix (2026-08-22).
//
// Run:  node gemini-3.7-routing-regression-tests.mjs
//
// These tests make zero network requests, read no credentials, and invoke
// no provider. They verify:
//   1. gemini-3.7-flash routes to interactions.create
//   2. gemini-3.6-flash still routes to generateContent (unchanged)
//   3. No deprecated sampling parameters (temperature/top_p/top_k/
//      candidate_count) are sent for either model
//   4. thinking_level defaults to "medium"; thinking_budget is never sent
//   5. Multimodal image input is correctly shaped for the Interactions path
//   6. Model-not-found / malformed responses are reported truthfully
//   7. fallbackUsed / label fields remain accurate
//   8. No credentials or headers appear in serialized results
//   9. Model resolution precedence: env > pinned > approved > default
//  10. Existing evidence files are byte-identical (SHA-256 pinned)
//
// Exit code 0 = all tests passed.  Exit code 1 = one or more failures.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXTRACTION_LABELS,
} from "./extraction-contract.mjs";

import {
  directGeminiAdapter,
  _setProviderClient,
  _setCredentialLoader,
  _resetModuleState,
  _testHooks,
  _resolveApiStyle,
  _buildInteractionsRequest,
  _buildProviderRequest,
} from "./direct-gemini-adapter.mjs";

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

/* ── Shared fixtures ── */

const FIXTURE_PNG_PATH = join(harnessDir, "fixtures", "gem-01-two-leg-clean.png");
const FIXTURE_PNG_BYTES = new Uint8Array(readFileSync(FIXTURE_PNG_PATH));

const VALID_EXTRACTION_JSON = JSON.stringify({
  extractionStatus: "success",
  firstLeg: {
    origin: "AAA", destination: "BBB", date: "2026-09-15",
    departureTime: "08:00", arrivalTime: "10:30",
    airline: "Synthetic Carrier", flightNumber: "SC-101",
  },
  secondLeg: {
    origin: "BBB", destination: "CCC", date: "2026-09-15",
    departureTime: "13:00", arrivalTime: "15:45",
    airline: "Synthetic Carrier", flightNumber: "SC-202",
  },
  connectionDurationMinutes: 150,
  missingFields: [],
  fieldConfidence: { overall: "high" },
  validationMessages: [],
  requiresUserConfirmation: true,
  syntheticDemo: true,
});

const DEPRECATED_PARAMS = ["temperature", "top_p", "top_k", "candidate_count"];

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/* ══════════════════════════════════════════════════════════════════
   Test 1 — gemini-3.7-flash routes to interactions.create end-to-end
   ══════════════════════════════════════════════════════════════════ */

section("Test 1 — gemini-3.7-flash routes to interactions.create");

_resetModuleState();

let interactionsCalls = 0;
let legacyCalls = 0;
let capturedInteractionsReq = null;

const routingClient37 = {
  async interactionsCreate(req) {
    interactionsCalls += 1;
    capturedInteractionsReq = req;
    return { output_text: VALID_EXTRACTION_JSON };
  },
  async generateContent() {
    legacyCalls += 1;
    return { text: VALID_EXTRACTION_JSON };
  },
};
_setProviderClient(routingClient37);
_setCredentialLoader(() => "test-cred-routing-37");

const origEnv1 = process.env.GEMINI_MODEL;
process.env.GEMINI_MODEL = "gemini-3.7-flash";

const result37 = await directGeminiAdapter.extract({
  fixtureId: "gem-01-two-leg-clean",
  image: FIXTURE_PNG_BYTES,
  mediaType: "image/png",
});

if (origEnv1 === undefined) delete process.env.GEMINI_MODEL;
else process.env.GEMINI_MODEL = origEnv1;

assertEqual(interactionsCalls, 1, "gemini-3.7-flash used interactions.create exactly once");
assertEqual(legacyCalls, 0, "gemini-3.7-flash did NOT use generateContent");
assertEqual(result37.extractionStatus, "success", "gemini-3.7-flash extraction succeeded");
assertEqual(
  capturedInteractionsReq?.model,
  "gemini-3.7-flash",
  "interactions request carried model gemini-3.7-flash",
);

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 2 — gemini-3.6-flash still routes to generateContent (unchanged)
   ══════════════════════════════════════════════════════════════════ */

section("Test 2 — gemini-3.6-flash still routes to generateContent");

assertEqual(
  _resolveApiStyle("gemini-3.6-flash"),
  "generateContent",
  "_resolveApiStyle(gemini-3.6-flash) = generateContent",
);

_resetModuleState();

let interactionsCalls36 = 0;
let legacyCalls36 = 0;

const routingClient36 = {
  async interactionsCreate() {
    interactionsCalls36 += 1;
    return { output_text: VALID_EXTRACTION_JSON };
  },
  async generateContent() {
    legacyCalls36 += 1;
    return { text: VALID_EXTRACTION_JSON };
  },
};
_setProviderClient(routingClient36);
_setCredentialLoader(() => "test-cred-routing-36");

const origEnv2 = process.env.GEMINI_MODEL;
process.env.GEMINI_MODEL = "gemini-3.6-flash";

const result36 = await directGeminiAdapter.extract({
  fixtureId: "gem-01-two-leg-clean",
  image: FIXTURE_PNG_BYTES,
  mediaType: "image/png",
});

if (origEnv2 === undefined) delete process.env.GEMINI_MODEL;
else process.env.GEMINI_MODEL = origEnv2;

assertEqual(legacyCalls36, 1, "gemini-3.6-flash used generateContent exactly once");
assertEqual(interactionsCalls36, 0, "gemini-3.6-flash did NOT use interactions.create");
assertEqual(result36.extractionStatus, "success", "gemini-3.6-flash extraction succeeded");

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 3 — No deprecated sampling parameters for either model
   ══════════════════════════════════════════════════════════════════ */

section("Test 3 — No deprecated sampling parameters sent");

const interactionsPayload = _buildInteractionsRequest({
  fixtureId: "gem-01-two-leg-clean",
  image: FIXTURE_PNG_BYTES,
  mediaType: "image/png",
}, "gemini-3.7-flash");

const legacyPayload = _buildProviderRequest({
  fixtureId: "gem-01-two-leg-clean",
  image: FIXTURE_PNG_BYTES,
  mediaType: "image/png",
}, "gemini-3.6-flash");

const interactionsJson = JSON.stringify(interactionsPayload);
const legacyJson = JSON.stringify(legacyPayload);

for (const param of DEPRECATED_PARAMS) {
  assert(
    !(param in interactionsPayload) && !interactionsJson.includes(`"${param}"`),
    `interactions payload does not contain '${param}'`,
  );
  assert(
    !(param in legacyPayload) &&
      !(legacyPayload.config && param in legacyPayload.config) &&
      !legacyJson.includes(`"${param}"`),
    `legacy payload does not contain '${param}'`,
  );
}

/* ══════════════════════════════════════════════════════════════════
   Test 4 — thinking_level defaults to medium; no thinking_budget
   ══════════════════════════════════════════════════════════════════ */

section("Test 4 — thinking_level medium; thinking_budget never sent");

assert(
  interactionsPayload.generation_config !== undefined,
  "interactions payload has generation_config",
);
assertEqual(
  interactionsPayload.generation_config?.thinking_level,
  "medium",
  "thinking_level defaults to 'medium'",
);
assert(
  !interactionsJson.includes("thinking_budget"),
  "interactions payload never contains thinking_budget",
);
assert(
  !legacyJson.includes("thinking_budget"),
  "legacy payload never contains thinking_budget",
);

/* ══════════════════════════════════════════════════════════════════
   Test 5 — Multimodal image input shape for the Interactions path
   ══════════════════════════════════════════════════════════════════ */

section("Test 5 — Multimodal image input shape (Interactions)");

assert(Array.isArray(interactionsPayload.input), "input is an array of content blocks");
const textBlock = interactionsPayload.input.find((p) => p.type === "text");
const imageBlock = interactionsPayload.input.find((p) => p.type === "image");
assert(textBlock !== undefined && typeof textBlock.text === "string" && textBlock.text.length > 0,
  "text block present with non-empty text");
assert(imageBlock !== undefined, "image block present");
assertEqual(imageBlock?.mime_type, "image/png", "image block mime_type is image/png");
assert(
  typeof imageBlock?.data === "string" && imageBlock.data.length > 0,
  "image block data is non-empty base64",
);
const decoded = Buffer.from(imageBlock.data, "base64");
assertEqual(decoded.length, FIXTURE_PNG_BYTES.length, "decoded image length matches fixture");
assertEqual(sha256Hex(decoded), sha256Hex(FIXTURE_PNG_BYTES), "decoded image bytes match fixture exactly");
// Matches SDK 2.18.0 ImageContent shape: { type: "image", data, mime_type }
assert(
  Object.keys(imageBlock).every((k) => ["type", "data", "mime_type", "uri", "resolution"].includes(k)),
  "image block keys match SDK ImageContent shape",
);

/* ══════════════════════════════════════════════════════════════════
   Test 6 — Errors are reported truthfully, never mapped to success
   ══════════════════════════════════════════════════════════════════ */

section("Test 6 — model-not-found and malformed responses reported truthfully");

_resetModuleState();

let calls404 = 0;
const client404 = {
  async interactionsCreate() {
    calls404 += 1;
    throw new Error("404 Not Found: models/gemini-9.9-flash is not found");
  },
  async generateContent() {
    throw new Error("unexpected legacy call");
  },
};
_setProviderClient(client404);
_setCredentialLoader(() => "test-cred-404");

const origEnv6 = process.env.GEMINI_MODEL;
process.env.GEMINI_MODEL = "gemini-3.7-flash";

const result404 = await directGeminiAdapter.extract({
  fixtureId: "gem-01",
  image: FIXTURE_PNG_BYTES,
  mediaType: "image/png",
});

if (origEnv6 === undefined) delete process.env.GEMINI_MODEL;
else process.env.GEMINI_MODEL = origEnv6;

assertEqual(result404.extractionStatus, "error", "404 produces extractionStatus 'error', never 'success'");
assertEqual(calls404, 1, "404 is not retried (exactly one interactions call)");
assertEqual(result404.sourceStatus.fallbackUsed, true, "404 result has fallbackUsed: true");

_resetModuleState();

const clientMalformed = {
  async interactionsCreate() {
    return { output_text: "{{{ not json" };
  },
};
_setProviderClient(clientMalformed);
_setCredentialLoader(() => "test-cred-malformed");

const origEnv6b = process.env.GEMINI_MODEL;
process.env.GEMINI_MODEL = "gemini-3.7-flash";

const resultMalformed = await directGeminiAdapter.extract({
  fixtureId: "gem-01",
  image: FIXTURE_PNG_BYTES,
  mediaType: "image/png",
});

if (origEnv6b === undefined) delete process.env.GEMINI_MODEL;
else process.env.GEMINI_MODEL = origEnv6b;

assert(
  resultMalformed.extractionStatus !== "success",
  "malformed response is never mapped to success",
);
assertEqual(resultMalformed.sourceStatus.fallbackUsed, true, "malformed result has fallbackUsed: true");

_resetModuleState();

/* ══════════════════════════════════════════════════════════════════
   Test 7 — fallbackUsed and labels remain accurate on success path
   ══════════════════════════════════════════════════════════════════ */

section("Test 7 — fallbackUsed / labels accurate");

assertEqual(result37.sourceStatus.fallbackUsed, false, "successful 3.7 result has fallbackUsed: false");
assertEqual(result37.sourceStatus.executed, true, "successful 3.7 result has executed: true");
assertEqual(
  result37.sourceStatus.label,
  EXTRACTION_LABELS.directGeminiValidation,
  "successful 3.7 result uses direct Gemini validation label",
);
assertEqual(result36.sourceStatus.fallbackUsed, false, "successful 3.6 result has fallbackUsed: false");
assertEqual(
  result36.sourceStatus.label,
  EXTRACTION_LABELS.directGeminiValidation,
  "successful 3.6 result uses direct Gemini validation label",
);

/* ══════════════════════════════════════════════════════════════════
   Test 8 — No credentials or headers in serialized output
   ══════════════════════════════════════════════════════════════════ */

section("Test 8 — No credentials or headers in output");

const serialized = [result37, result36, result404, resultMalformed]
  .map((r) => JSON.stringify(r))
  .join("\n");

assert(!/AIza[a-zA-Z0-9_-]{20,}/.test(serialized), "no AIza key pattern in any result");
assert(!/sk-[a-zA-Z0-9]{10,}/.test(serialized), "no sk- key pattern in any result");
assert(!/Bearer\s+[a-zA-Z0-9._-]+/i.test(serialized), "no Bearer header pattern in any result");
assert(!serialized.includes("test-cred-"), "no injected test credential leaked into results");
assert(!/x-goog-api-key/i.test(serialized), "no api-key header name in results");

/* ══════════════════════════════════════════════════════════════════
   Test 9 — Model resolution precedence: env > approved > default
   (config.json pinnedModelIdentifier is intentionally NOT consulted;
   selecting the pinned 3.7 model requires an explicit env override)
   ══════════════════════════════════════════════════════════════════ */

section("Test 9 — Model resolution precedence");

const configOnDisk = JSON.parse(readFileSync(join(harnessDir, "config.json"), "utf8"));
const capabilitiesOnDisk = JSON.parse(readFileSync(join(harnessDir, "provider-capabilities.json"), "utf8"));

const origEnv9 = process.env.GEMINI_MODEL;
delete process.env.GEMINI_MODEL;

// No env: approved model (capabilities) is the default, NOT the pinned model
assertEqual(
  _testHooks.resolveModel(),
  capabilitiesOnDisk.providers.gemini.approvedModelIdentifier,
  "without env override, approvedModelIdentifier is resolved (pinned not consulted)",
);

// Env override selects the pinned model for an explicit single invocation
process.env.GEMINI_MODEL = "gemini-3.7-flash";
assertEqual(
  _testHooks.resolveModel(),
  "gemini-3.7-flash",
  "explicit env override selects gemini-3.7-flash",
);

if (origEnv9 === undefined) delete process.env.GEMINI_MODEL;
else process.env.GEMINI_MODEL = origEnv9;

// Truthfulness check: the pinned model is the GA Interactions-API model
assertEqual(
  configOnDisk.pinnedModelIdentifier,
  "gemini-3.7-flash",
  "config.json pins gemini-3.7-flash",
);
assert(
  capabilitiesOnDisk.providers?.gemini?.approvedModelIdentifier === "gemini-3.6-flash",
  "capabilities approved model remains gemini-3.6-flash (unchanged)",
);

/* ══════════════════════════════════════════════════════════════════
   Test 10 — Evidence files are byte-identical (unchanged)
   ══════════════════════════════════════════════════════════════════ */

section("Test 10 — Existing evidence files unchanged (SHA-256 pinned)");

const EVIDENCE_HASHES = Object.freeze({
  "results-gemini-3.7-flash-success.json":
    "7942b9b07806e77dcf074b3b07325c6ffe9948977135b76c9afb8fde6fdb9482",
  "results-gemini-3.7-flash-failure.json":
    "8dc36803c4315879a6090ee97086c393858cad4d4105958f0a59156424d113f4",
  "results-gemini-3.6-flash-success.json":
    "4dde376b8a898e8eb11b60383e1672bc63a27a737667b33457107dade93f37ec",
});

for (const [fileName, expectedHash] of Object.entries(EVIDENCE_HASHES)) {
  const bytes = readFileSync(join(harnessDir, "results", fileName));
  assertEqual(sha256Hex(bytes), expectedHash, `${fileName} is byte-identical`);
}

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
