#!/usr/bin/env node
// StitchCheck P0 -- Gemini smoke-test harness (direct Gemini default).
//
// Default provider: Google Gemini via GEMINI_API_KEY.
// OpenRouter is available only as an explicitly selectable rollback path.
//
// Default behavior is OFFLINE: no external request is made and every case is
// recorded as not_executed. The request adapter is loaded only when the
// explicit execution flag is supplied AND the readiness checks pass (approved
// model, capability approval, and a local key). Without all of those,
// execution is refused and the offline path applies.
//
// Secrets are never printed, logged, or persisted. Results for the two
// provider paths are never merged.

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { assessReadiness, GEMINI_LABEL, loadJson } from "./providers.mjs";
import { validateExtractionResult } from "./schema-validator.mjs";

const harnessDir = dirname(fileURLToPath(import.meta.url));
const resultsDir = join(harnessDir, "results");

// Load .env.local into process.env for execution (defense-in-depth: secrets
// are never printed, logged, or serialized).
try {
  const workspaceRoot = join(harnessDir, "..", "..");
  const envText = readFileSync(join(workspaceRoot, ".env.local"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (line.startsWith("#") || !line.trim()) continue;
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
} catch {
  // Missing env file is a valid state.
}

const config = loadJson("config.json");
const manifest = loadJson(join("fixtures", "manifest.json"));

const readiness = assessReadiness();
const runAt = new Date().toISOString();
const executeRequested = process.argv.includes("--execute");
const onlyIndex = process.argv.indexOf("--only");
const onlyTestId = onlyIndex !== -1 ? process.argv[onlyIndex + 1] : null;

// Test plan derived from the fixture manifest.
const testPlan = [];
for (const fixture of manifest.fixtures) {
  for (const testId of fixture.testIds) {
    testPlan.push({
      testId,
      fixtureId: fixture.fixtureId,
      fixtureFile: fixture.file,
    });
  }
}
for (const serviceCase of manifest.serviceSideCases) {
  testPlan.push({
    testId: serviceCase.testId,
    fixtureId: null,
    fixtureFile: null,
  });
}
testPlan.sort((a, b) => a.testId.localeCompare(b.testId));

// A bounded round may restrict execution to a single case (e.g. GEM-01).
const activePlan = onlyTestId
  ? testPlan.filter((p) => p.testId === onlyTestId)
  : testPlan;

// Every offline per-test record carries the full mandated evidence field set.
function offlineRecord(planItem) {
  return {
    provider: readiness.provider,
    providerMode: readiness.providerMode,
    modelIdentifier: readiness.modelIdentifier,
    testId: planItem.testId,
    fixtureId: planItem.fixtureId,
    timestamp: runAt,
    latencyMs: 0,
    outcome: "not_executed",
    missingFields: [],
    validationOutcome: "not_run",
    errorClass: readiness.errorClass,
    retryCount: 0,
    retryDelayMs: 0,
    confirmationGateStatus: "not_reached",
    redactedResponseSummary: null,
  };
}

// ── Fixture loading ────────────────────────────────────────────────────────
//
// Loads a real local synthetic PNG/JPEG fixture from the fixtures/ directory.
// Derives the path from the script location (harnessDir). Reports fixture
// basename, MIME type, byte length, and model name. Never uses placeholder
// bytes like new Uint8Array([0]).

const MIME_MAP = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
});

function loadFixtureBytes(fixtureFile) {
  const fixturePath = join(harnessDir, "fixtures", fixtureFile);
  const bytes = readFileSync(fixturePath);
  const ext = extname(fixtureFile).toLowerCase();
  const mimeType = MIME_MAP[ext] || "application/octet-stream";
  const byteLength = bytes.byteLength;
  return {
    bytes: new Uint8Array(bytes),
    mimeType,
    byteLength,
    fixtureBasename: basename(fixtureFile),
    fixturePath,
  };
}

function reportFixtureMeta(fixtureFile, model) {
  try {
    const info = loadFixtureBytes(fixtureFile);
    console.log(
      `Fixture: ${info.fixtureBasename} | MIME: ${info.mimeType} | ` +
      `bytes: ${info.byteLength} | model: ${model}`
    );
    return info;
  } catch (err) {
    console.log(`Fixture load FAILED for ${fixtureFile}: ${err.message}`);
    return null;
  }
}

let executed = false;
let executionBlocker = null;
let tests;

// Converts a direct Gemini adapter ExtractionResult to the smoke-test record
// format. Records provider, model, timestamp, and evidence fields.
function geminiAdapterRecord(planItem, adapterResult) {
  const runAt = new Date().toISOString();
  return {
    provider: "gemini",
    providerMode: "direct",
    modelIdentifier: readiness.modelIdentifier,
    testId: planItem.testId,
    fixtureId: planItem.fixtureId,
    timestamp: runAt,
    latencyMs: 0,
    outcome: adapterResult?.extractionStatus ?? "error",
    missingFields: adapterResult?.missingFields ?? [],
    validationOutcome: adapterResult?.extractionStatus === "success" ? "valid" : "not_run",
    errorClass: adapterResult?.fallbackReason ?? null,
    retryCount: 0,
    retryDelayMs: 0,
    confirmationGateStatus: adapterResult?.requiresUserConfirmation ? "pending_user_review" : "not_reached",
    redactedResponseSummary: adapterResult?.extractionStatus === "success"
      ? { extractionStatus: adapterResult.extractionStatus, note: "raw response redacted" }
      : null,
    attempts: 1,
    endedAt: runAt,
    validationMessages: adapterResult?.validationMessages ?? [],
    fixtureSyntheticNonPii: true,
    networkDestinationCategory: "Google Gemini API (direct)",
    sourceStatus: adapterResult?.sourceStatus ?? null,
    label: adapterResult?.label ?? null,
  };
}

if (executeRequested) {
  if (readiness.provider === "gemini") {
    if (!readiness.ready) {
      executionBlocker = readiness.errorClass;
    } else {
      const { directGeminiAdapter } = await import("./direct-gemini-adapter.mjs");
      executed = true;
      tests = [];
      for (const planItem of activePlan) {
        if (!planItem.fixtureFile) {
          tests.push({
            ...offlineRecord(planItem),
            errorClass: "service_side_case_not_runnable_by_adapter",
          });
          continue;
        }
        // Run the extraction via the direct Gemini adapter.
        // Load the real synthetic fixture PNG/JPEG from disk.
        const fixtureInfo = loadFixtureBytes(planItem.fixtureFile);
        const startedAt = Date.now();
        const adapterResult = await directGeminiAdapter.extract({
          fixtureId: planItem.fixtureId,
          image: fixtureInfo.bytes,
          mediaType: fixtureInfo.mimeType,
        });
        const latencyMs = Date.now() - startedAt;
        const record = geminiAdapterRecord(planItem, adapterResult);
        record.latencyMs = latencyMs;
        record.fixtureBasename = fixtureInfo.fixtureBasename;
        record.fixtureMimeType = fixtureInfo.mimeType;
        record.fixtureByteLength = fixtureInfo.byteLength;
        console.log(
          `  ${planItem.testId}: ${fixtureInfo.fixtureBasename} ` +
          `(${fixtureInfo.mimeType}, ${fixtureInfo.byteLength} bytes) ` +
          `→ ${adapterResult?.extractionStatus ?? "error"} [${latencyMs}ms]`
        );
        tests.push(record);
      }
    }
  } else if (readiness.provider === "openrouter") {
    if (!readiness.ready) {
      executionBlocker = readiness.errorClass;
    } else {
      const adapter = await import("./openrouter-adapter.mjs");
      executed = true;
      tests = [];
      for (const planItem of activePlan) {
        if (!planItem.fixtureFile) {
          tests.push({
            ...offlineRecord(planItem),
            errorClass: "service_side_case_not_runnable_by_adapter",
          });
          continue;
        }
        // Sequential only: no concurrent requests.
        tests.push(await adapter.runExtractionCase(planItem));
      }
    }
  } else {
    executionBlocker = "unknown_provider";
  }
}

if (!executed) {
  tests = activePlan.map(offlineRecord);
}

// Offline self-check: the validator must reject non-conforming input.
const validatorSelfCheck = {
  invalidInputRejected: validateExtractionResult(null).valid === false,
};

// Redaction guard: strips long token-like strings as defense in depth.
function redact(text) {
  return text.replace(/[A-Za-z0-9+/=_-]{30,}/g, "[REDACTED]");
}

const networkCallsMade = executed
  ? tests.reduce(
      (total, t) =>
        total + (t.outcome === "not_executed" ? 0 : 1 + (t.retryCount ?? 0)),
      0,
    )
  : 0;

const results = {
  harness: "stitchcheck-gemini-smoke-test",
  harnessVersion: "0.4.0-direct-gemini",
  phase: config.phase,
  provider: readiness.provider,
  providerMode: readiness.providerMode,
  providerLabel: readiness.label,
  modelIdentifier: readiness.modelIdentifier,
  keyStatus: readiness.keyStatus,
  readinessErrorClass: readiness.errorClass,
  executionRequested: executeRequested,
  executed,
  executionBlocker,
  onlyFilter: onlyTestId,
  retryPolicy: config.retryPolicy,
  networkCallsMade,
  redactionApplied: true,
  syntheticDemo: true,
  validatorSelfCheck,
  runAt,
  tests,
  providerStatus: {
    label: readiness.label,
    status: executed
      ? `executed with ${networkCallsMade} network call(s)`
      : "not_executed — offline default",
  },
};

function evidenceMarkdown() {
  const rows = tests
    .map(
      (t) =>
        `| ${t.testId} | ${t.fixtureId ?? "(service-side)"} | ${t.provider} | ${t.outcome} | ${t.errorClass ?? "none"} | |`,
    )
    .join("\n");
  return `# Smoke-Test Evidence — ${readiness.label}

Generated automatically by the harness. Default runs are offline; execution
occurs only behind the explicit execution flag with full readiness.

- Run at: ${runAt}
- Provider: ${readiness.provider} (${readiness.providerMode})
- Model identifier: ${readiness.modelIdentifier}
- Key status: ${readiness.keyStatus}
- Execution requested: ${executeRequested}; executed: ${executed}${executionBlocker ? `; blocked by: ${executionBlocker}` : ""}
- Network calls made: ${networkCallsMade}
- Data: synthetic demo only

Retry policy: one initial attempt per case; up to two bounded retries;
Retry-After honored when provided, otherwise bounded exponential backoff with
jitter; no concurrent requests; no model/provider switching after failure.

| Test ID | Fixture | Provider | Outcome | Error Class | Pass/Fail |
|---|---|---|---|---|---|
${rows}

## Executed case details
${tests
    .map(
      (t) =>
        `- ${t.testId}: attempts=${t.attempts ?? 0} started=${t.timestamp} ` +
        `ended=${t.endedAt ?? "n/a"} latencyMs=${t.latencyMs} ` +
        `validation=${t.validationOutcome ?? "not_run"} ` +
        `validationMessages=${(t.validationMessages ?? []).length} ` +
        `missingFields=${(t.missingFields ?? []).length} ` +
        `retryDelayMs=${t.retryDelayMs ?? 0} ` +
        `fixtureSyntheticNonPii=${t.fixtureSyntheticNonPii ?? "n/a"} ` +
        `destination=${t.networkDestinationCategory ?? "none (offline)"} ` +
        `confirmationGate=${t.confirmationGateStatus}`,
    )
    .join("\n")}

The extraction remains editable and unconfirmed in the local review artifact
(smoke-tests/gemini/review/confirmation-demo.html); no downstream action
exists or is enabled in this harness.

## Direct Gemini validation (hackathon day)
${GEMINI_LABEL}: not executed. Pass/fail intentionally blank until direct
Gemini is actually run. Temporary-path results are never merged into or
relabelling of the direct Gemini record.

## Statements
- All inputs are synthetic fixtures and contain no PII.
- No key, token, request header, or secret-like value appears in this file.
- No downstream capability of any kind exists in this harness.
- Nothing in this file claims that extraction works on either provider path.
`;
}

mkdirSync(resultsDir, { recursive: true });
writeFileSync(
  join(resultsDir, "results.json"),
  redact(JSON.stringify(results, null, 2)) + "\n",
);
writeFileSync(join(resultsDir, "evidence-stub.md"), evidenceMarkdown());

// Console output is limited to fixed strings and statuses; no env values.
console.log(`Label: ${readiness.label}`);
console.log(
  `Readiness: provider=${readiness.provider} mode=${readiness.providerMode} ` +
    `key=${readiness.keyStatus} model=${readiness.modelIdentifier} ` +
    `errorClass=${readiness.errorClass ?? "none"}`,
);
if (executeRequested && !executed) {
  console.log(
    `Execution requested but blocked (${executionBlocker}); offline not-executed records written.`,
  );
}
console.log(
  executed
    ? `Executed with ${networkCallsMade} network call(s).`
    : "No network request was made. No environment values are printed.",
);
console.log("Results:       smoke-tests/gemini/results/results.json");
console.log("Evidence:      smoke-tests/gemini/results/evidence-stub.md");
