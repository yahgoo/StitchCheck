#!/usr/bin/env node
// One-shot live Gemini 3.7 Interactions API verification runner.
//
// Authorized scope: EXACTLY ONE live request via ai.interactions.create
// against gemini-3.7-flash using the synthetic non-PII fixture
// gem-01-two-leg-clean.png. Writes ONE new timestamped sanitized result
// file under results/. No retry, no second request, no other provider.
//
// Safety guarantees enforced here:
//   - Hard single-request guard at the client level: any second call attempt
//     (including an internal adapter retry) is blocked BEFORE the network.
//   - GEMINI_MODEL override is applied inline only (never written to any
//     config file).
//   - No credentials, headers, env values, base64 data, raw responses, or
//     private paths are printed or persisted.
//   - Errors are sanitized via the adapter's existing sanitizer.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const harnessDir = dirname(fileURLToPath(import.meta.url));
const resultsDir = join(harnessDir, "results");
const FIXTURE_FILE = "gem-01-two-leg-clean.png";
const APPROVED_MODEL = "gemini-3.7-flash";

// ── Inline-only environment override (never written to any file) ──
process.env.GEMINI_MODEL = APPROVED_MODEL;

// Load only the credential variable from the ignored root .env.local into
// process.env. The value is never printed, logged, or serialized.
let keyStatus = "absent";
try {
  const workspaceRoot = join(harnessDir, "..", "..");
  const envText = readFileSync(join(workspaceRoot, ".env.local"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (line.startsWith("#") || !line.trim()) continue;
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match && match[1] === "GEMINI_API_KEY" && !process.env.GEMINI_API_KEY) {
      process.env.GEMINI_API_KEY = match[2].trim();
    }
  }
} catch {
  // Missing env file: credential may still be present via process.env.
}
keyStatus =
  process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0
    ? "present"
    : "absent";

// ── SDK version (metadata only; no secrets) ──
const sdkVersion = JSON.parse(
  readFileSync(join(harnessDir, "node_modules", "@google/genai", "package.json"), "utf8"),
).version;

// ── Preflight verification (fixed strings only) ──
const fixturePath = join(harnessDir, "fixtures", FIXTURE_FILE);
if (!existsSync(fixturePath)) {
  console.error("preflight failed: fixture missing");
  process.exit(1);
}
if (keyStatus !== "present") {
  console.error("preflight failed: credential not available (name only: GEMINI_API_KEY)");
  process.exit(1);
}

// Verify the prepared request shape WITHOUT any network call.
const { _buildInteractionsRequest, _resolveApiStyle } = await import(
  "./direct-gemini-adapter.mjs"
);
const cfg = JSON.parse(readFileSync(join(harnessDir, "config.json"), "utf8"));
const apiStyle = _resolveApiStyle(APPROVED_MODEL, cfg);
const probe = _buildInteractionsRequest(
  { image: new Uint8Array(0), mediaType: "image/png" },
  APPROVED_MODEL,
);
const preflightOk =
  apiStyle === "interactions" &&
  probe.model === APPROVED_MODEL &&
  probe.store === false &&
  probe.generation_config?.thinking_level === "medium" &&
  typeof probe.response_format?.schema === "object";
if (!preflightOk) {
  console.error("preflight failed: request shape mismatch");
  process.exit(1);
}

console.log("model: gemini-3.7-flash");
console.log("api: ai.interactions.create");
console.log(`sdk: @google/genai@${sdkVersion}`);
console.log(`fixture: ${FIXTURE_FILE}`);
console.log("request_count: 1");
console.log("store: false");
console.log("output: new timestamped file");

// ── Single-request guard client ──
const { GoogleGenAI } = await import("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });
let networkRequests = 0;
let retrySuppressed = false;
const guardedClient = {
  async interactionsCreate(interactionsReq) {
    if (networkRequests >= 1) {
      retrySuppressed = true;
      throw new Error("second_request_blocked_by_single_request_guard");
    }
    networkRequests += 1;
    const { model, input, response_format, generation_config, store } = interactionsReq;
    const params = { model, input };
    if (response_format) params.response_format = response_format;
    if (generation_config) params.generation_config = generation_config;
    if (store !== undefined) params.store = store;
    const interaction = await ai.interactions.create(params);
    return { output_text: interaction.output_text || "" };
  },
  async generateContent() {
    throw new Error("generateContent_path_disallowed_for_this_verification");
  },
};

// ── Execute exactly one extraction via the existing adapter ──
const {
  directGeminiAdapter,
  _setProviderClient,
  _resetModuleState,
  _sanitizeError,
} = await import("./direct-gemini-adapter.mjs");
const { validateExtractionResult } = await import("./schema-validator.mjs");

_resetModuleState();
_setProviderClient(guardedClient);

const image = new Uint8Array(readFileSync(fixturePath));
const startedAt = new Date();
let adapterResult;
let httpStatus = null;
let errorCategory = null;
try {
  adapterResult = await directGeminiAdapter.extract({
    fixtureId: "gem-01-two-leg-clean",
    image,
    mediaType: "image/png",
  });
} catch (err) {
  adapterResult = null;
  errorCategory = "unhandled_exception";
  adapterResult = {
    extractionStatus: "error",
    validationMessages: [_sanitizeError(err)],
    sourceStatus: { fallbackUsed: true, executed: true, provider: "gemini" },
  };
}
const endedAt = new Date();
const latencyMs = endedAt.getTime() - startedAt.getTime();

// Classify error using adapter diagnostic first, then fall back to message text.
let retrySuppressedFlag = false;
if (adapterResult?.extractionStatus === "error") {
  if (adapterResult._diagnostic) {
    httpStatus = adapterResult._diagnostic.errorHttpStatus ?? null;
    errorCategory = adapterResult._diagnostic.errorCategory ?? "provider_error";
    retrySuppressedFlag = (adapterResult._diagnostic.retryCount ?? 0) > 0;
  } else {
    const msgs = (adapterResult.validationMessages || []).join(" ");
    const m = msgs.match(/\b([45]\d\d)\b/);
    if (m) httpStatus = m[1];
    if (/auth|401|403/i.test(msgs)) errorCategory = "authentication";
    else if (/404|not.?found/i.test(msgs)) errorCategory = "model_not_found";
    else if (/timeout/i.test(msgs)) errorCategory = "timeout";
    else if (/second_request_blocked/.test(msgs)) errorCategory = "single_request_guard";
    else errorCategory = errorCategory ?? "provider_error";
  }
  // Detect retry suppression from guard
  if (!retrySuppressedFlag && retrySuppressed) retrySuppressedFlag = true;
}

const schemaReport = validateExtractionResult(adapterResult);
const success =
  adapterResult?.extractionStatus === "success" &&
  schemaReport.valid === true &&
  adapterResult?.sourceStatus?.fallbackUsed === false &&
  networkRequests === 1;

// ── Write ONE new timestamped sanitized result file ──
const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
const outFile = join(resultsDir, `live-verification-${APPROVED_MODEL}-${stamp}.json`);
const resultDoc = {
  harness: "stitchcheck-gemini-smoke-test",
  harnessVersion: "0.4.1-direct-gemini-live-runner",
  phase: "gemini-direct",
  provider: "gemini",
  providerMode: "direct",
  providerLabel: "Direct Gemini validation",
  modelIdentifier: APPROVED_MODEL,
  modelTestPurpose: "Re-verify gemini-3.7-flash via Interactions API (ai.interactions.create)",
  apiStyle: "interactions",
  sdkMethod: "ai.interactions.create",
  sdkVersion: `@google/genai ${sdkVersion}`,
  thinkingLevel: "medium",
  store: false,
  runAt: startedAt.toISOString(),
  outcome: success ? "success" : "failure",
  latencyMs,
  networkRequestsMade: networkRequests,
  test: {
    provider: "gemini",
    providerMode: "direct",
    modelIdentifier: APPROVED_MODEL,
    apiStyle: "interactions",
    sdkMethod: "ai.interactions.create",
    testId: "GEM-01",
    fixtureId: "gem-01-two-leg-clean",
    fixtureBasename: FIXTURE_FILE,
    fixtureMimeType: "image/png",
    fixtureByteLength: image.byteLength,
    fixtureSyntheticNonPii: true,
    timestamp: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    latencyMs,
    outcome: adapterResult?.extractionStatus ?? "error",
    schemaValidation: schemaReport.valid ? "valid" : "invalid",
    schemaIssues: schemaReport.valid ? [] : schemaReport.issues,
    missingFields: adapterResult?.missingFields ?? [],
    validationMessages: adapterResult?.validationMessages ?? [],
    fieldConfidence: adapterResult?.fieldConfidence ?? null,
    requiresUserConfirmation: true,
    sourceStatus: adapterResult?.sourceStatus ?? null,
    label: adapterResult?.label ?? "Direct Gemini validation",
    networkDestinationCategory: "Google Gemini API (direct)",
    errorCategory,
    httpStatus,
    retrySuppressed: retrySuppressedFlag,
    sanitizedExtractedFields:
      adapterResult?.extractionStatus === "success" ||
      adapterResult?.extractionStatus === "partial"
        ? {
            firstLeg: adapterResult.firstLeg ?? null,
            secondLeg: adapterResult.secondLeg ?? null,
            connectionDurationMinutes: adapterResult.connectionDurationMinutes ?? null,
          }
        : null,
  },
  safetyCompliance: {
    exactlyOneLiveRequest: networkRequests === 1,
    noRetry: true,
    singleRequestGuardArmed: true,
    retrySuppressed: retrySuppressedFlag,
    environmentOverrideInlineOnly: true,
    noAtlasCall: true,
    noNosanaSubmission: true,
    noAppOrVideoOrFixtureModification: true,
    noGithubPush: true,
    noUpload: true,
    noApiKeyExposed: true,
    redactionApplied: true,
    previousEvidencePreserved: true,
  },
};

// Structured field redaction (defense in depth).
// Redact only credential-shaped values, not ordinary long identifiers.
let redacted;
try {
  const parsed = JSON.parse(JSON.stringify(resultDoc, null, 2));
  // Redact sensitive string fields
  for (const field of ["validationMessages", "errorCategory"]) {
    if (Array.isArray(parsed[field])) {
      parsed[field] = parsed[field].map((v) =>
        typeof v === "string"
          ? v
              .replace(/AIza[a-zA-Z0-9]{20,}/g, "[REDACTED]")
              .replace(/sk-[a-zA-Z0-9]{10,}/g, "[REDACTED]")
              .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "[REDACTED]")
          : v,
      );
    }
  }
  redacted = JSON.stringify(parsed, null, 2);
} catch {
  redacted = JSON.stringify(resultDoc, null, 2);
}
// Final safety net: narrow credential-shaped regex only
redacted = redacted
  .replace(/AIza[a-zA-Z0-9]{20,}/g, "[REDACTED]")
  .replace(/sk-[a-zA-Z0-9]{10,}/g, "[REDACTED]")
  .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "[REDACTED]");
writeFileSync(outFile, redacted + "\n");

// ── Console summary (sanitized; no secrets, no payloads, no base64) ──
console.log(`outcome: ${success ? "success" : "failure"}`);
console.log(`extraction_status: ${adapterResult?.extractionStatus ?? "error"}`);
console.log(`schema_validation: ${schemaReport.valid ? "valid" : "invalid"}`);
console.log(`fallback_used: ${adapterResult?.sourceStatus?.fallbackUsed}`);
console.log(`latency_ms: ${latencyMs}`);
console.log(`network_requests: ${networkRequests}`);
if (errorCategory) console.log(`error_category: ${errorCategory}`);
if (httpStatus) console.log(`http_status: ${httpStatus}`);
console.log(`output_file: results/${basename(outFile)}`);
process.exit(success ? 0 : 2);
