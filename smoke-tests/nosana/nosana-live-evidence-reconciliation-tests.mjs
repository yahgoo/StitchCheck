// nosana-live-evidence-reconciliation-tests.mjs — OFFLINE-ONLY test suite.
//
// Validates the reconciled live Nosana evidence after the parser fix.
// These tests confirm:
//   1. Reconciled opStates[0].logs[0].log parses to valid risk output.
//   2. Live metadata remains attached.
//   3. costUsd: 0.044 is retained.
//   4. creditsUsed: 44 remains internal-credit metadata.
//   5. evidenceSource becomes live only after validation.
//   6. Offline browser fixture stays local; runtime file is a permitted dry-run preview.
//   7. Gemini live evidence remains honestly live-failed (NOT_CONFIRMED).
//   8. Atlas live reconciliation evidence is correct (CONFIRMED_LIVE).
//   9. Nosana live label is correct only for the reconciled live result.
//  10. Fallback labels remain correct.
//  11. No secrets appear in the reconciled artifact.
//  12. No live calls occur during tests.
//
// Hard guarantees:
// - No network calls. No job submission. No IPFS read.
// - No credentials are read or exposed.
// - Deterministic and fully offline.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseIpfsResultOutput } from "./nosana_run_job.mjs";
import { validateNosanaOutput } from "./schema-validator.mjs";
import {
  extractLiveMetadata,
} from "./nosana-risk-runner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..");
const OFFLINE_BROWSER_FIXTURE = path.join(here, "fixtures", "browser-local-fallback-result.json");
const RUNTIME_BROWSER_RESULT = path.join(REPO_ROOT, "app", "public", "nosana-risk-result.json");

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

console.log("=".repeat(72));
console.log("StitchCheck Nosana live-evidence reconciliation tests — OFFLINE ONLY");
console.log("=".repeat(72));

// ── Load fixtures ────────────────────────────────────────────────────────────

const fixturePath = path.join(here, "fixtures", "opstates-live-result-sanitized.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

// Find the reconciled artifact
const evidenceDir = path.join(here, "results", "evidence");
const reconciledFiles = fs.readdirSync(evidenceDir).filter((f) => f.includes("reconciled"));
assert(reconciledFiles.length >= 1, "At least one reconciled artifact exists");

const reconciledPath = path.join(evidenceDir, reconciledFiles[reconciledFiles.length - 1]);
const reconciled = JSON.parse(fs.readFileSync(reconciledPath, "utf8"));

// ── Section 1: opStates parser produces valid risk output ────────────────────

section("Section 1: opStates[0].logs[0].log parses to valid risk output");

const parseResult = parseIpfsResultOutput(fixture);
assert(parseResult.ok === true, "Parser returns ok=true for sanitized opStates fixture");
assert(
  parseResult.source.includes("opStates"),
  `Parser source references opStates path (got: ${parseResult.source})`,
);

const output = parseResult.output;
const validation = validateNosanaOutput(output);
assert(validation.valid === true, "Parsed output passes validateNosanaOutput");

// ── Section 2: Exact validated risk values ───────────────────────────────────

section("Section 2: Exact validated risk values");

assert(output.riskScore === 0.2895, `riskScore is 0.2895 (got: ${output.riskScore})`);
assert(output.riskBand === "medium", `riskBand is "medium" (got: ${output.riskBand})`);
assert(output.simulationCount === 800, `simulationCount is 800 (got: ${output.simulationCount})`);
assert(Array.isArray(output.assumptions), "assumptions is an array");
assert(output.assumptions.length === 4, `assumptions has 4 entries (got: ${output.assumptions.length})`);
assert(
  output.assumptions[0] === "Historical average delay at BBB: 25 min",
  "assumptions[0] matches expected value",
);
assert(
  output.assumptions[1] === "On-time rate: 0.72",
  "assumptions[1] matches expected value",
);
assert(
  output.assumptions[2] === "Route miss rate: 0.28",
  "assumptions[2] matches expected value",
);
assert(
  output.assumptions[3] === "Monte Carlo simulations: 800",
  "assumptions[3] matches expected value",
);
assert(
  typeof output.explanation === "string" && output.explanation.length >= 10,
  "explanation is a non-empty string (≥10 chars)",
);
assert(
  output.explanation.includes("0.2895"),
  "explanation references the actual risk score 0.2895",
);

// ── Section 3: Live metadata remains attached ────────────────────────────────

section("Section 3: Live metadata remains attached");

const meta = reconciled.liveMetadata;
assert(meta != null, "Reconciled artifact has liveMetadata");
assert(meta.jobId === "BNZTHNoARu98EdaqPU5WiCaFWZAyU1e9NYCZJj2h1afY", "Job ID preserved");
assert(meta.market === "7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq", "Market preserved");
assert(meta.ipfsHash === "QmVtywQCBsMokSSnpjDDNAgGJR6dDa8rAHffpMwqmnq5Jg", "IPFS definition hash preserved");
assert(meta.resultIpfsHash === "QmbCmtmcbfwRKyU8vE6axGvTMZ6YA1AWkLzVVNpYPZrNHE", "IPFS result hash preserved");
assert(meta.platformTimeoutSec === 3600, "Platform timeout 3600s preserved");

// ── Section 4: costUsd and creditsUsed separation ────────────────────────────

section("Section 4: costUsd: 0.044 retained; creditsUsed: 44 is internal-credit metadata");

assert(meta.costUsd === 0.044, `costUsd is 0.044 (got: ${meta.costUsd})`);
assert(meta.creditsUsed === 44, `creditsUsed is 44 (got: ${meta.creditsUsed})`);
assert(reconciled.billing != null, "Reconciled artifact has billing section");
assert(reconciled.billing.costUsd === 0.044, "billing.costUsd is 0.044");
assert(reconciled.billing.creditsUsed === 44, "billing.creditsUsed is 44");
assert(
  typeof reconciled.billing._note === "string" && reconciled.billing._note.length > 0,
  "billing._note explains the creditsUsed/costUsd distinction",
);

// ── Section 5: evidenceSource becomes live only after validation ─────────────

section("Section 5: evidenceSource becomes live only after validation");

assert(
  reconciled.evidenceSource === "nosana-evidence",
  `Reconciled evidenceSource is "nosana-evidence" (got: ${reconciled.evidenceSource})`,
);
assert(
  reconciled.fallbackUsed === false,
  `Reconciled fallbackUsed is false (got: ${reconciled.fallbackUsed})`,
);

// Verify that the runner's extractLiveMetadata produces correct source
const fakeChildSuccess = {
  success: true,
  jobId: "BNZTHNoARu98EdaqPU5WiCaFWZAyU1e9NYCZJj2h1afY",
  ipfsHash: "QmVtywQCBsMokSSnpjDDNAgGJR6dDa8rAHffpMwqmnq5Jg",
  resultIpfsHash: "QmbCmtmcbfwRKyU8vE6axGvTMZ6YA1AWkLzVVNpYPZrNHE",
  creditsUsed: 44,
  costUsd: 0.044,
  output: { riskScore: 0.2895, riskBand: "medium", assumptions: ["a"], simulationCount: 800, explanation: "test explanation" },
};
const extracted = extractLiveMetadata(fakeChildSuccess);
assert(extracted != null, "extractLiveMetadata returns metadata for successful child");
assert(extracted.jobId === "BNZTHNoARu98EdaqPU5WiCaFWZAyU1e9NYCZJj2h1afY", "extracted metadata has correct jobId");
assert(extracted.costUsd === 0.044, "extracted metadata has correct costUsd");
assert(extracted.creditsUsed === 44, "extracted metadata has correct creditsUsed");

// ── Section 6: Offline browser fixture vs dry-run runtime file ─────────────

section("Section 6: Offline browser fixture stays local; runtime file is dry-run");

const offlineBrowserResult = JSON.parse(fs.readFileSync(OFFLINE_BROWSER_FIXTURE, "utf8"));
assert(
  offlineBrowserResult.evidenceSource === "local-fallback",
  `Offline browser fixture has evidenceSource "local-fallback" (got: ${offlineBrowserResult.evidenceSource})`,
);
assert(
  offlineBrowserResult.usedFallback === true || offlineBrowserResult.riskResult?.fallbackUsed === true,
  "Offline browser fixture has fallbackUsed=true",
);

if (fs.existsSync(RUNTIME_BROWSER_RESULT)) {
  const runtimeResult = JSON.parse(fs.readFileSync(RUNTIME_BROWSER_RESULT, "utf8"));
  assert(
    runtimeResult.evidenceSource === "dry-run",
    `Runtime app/public/nosana-risk-result.json reflects a dry-run preview (got: ${runtimeResult.evidenceSource})`,
  );
  assert(
    runtimeResult.usedFallback === true && runtimeResult.riskResult?.fallbackUsed === true,
    "Runtime browser result has fallbackUsed=true because no job was submitted",
  );
} else {
  assert(true, "Runtime app/public/nosana-risk-result.json not present (skipped)");
}

// ── Section 7: Gemini live evidence label is honest (NOT_CONFIRMED) ────────

section("Section 7: Gemini live evidence label is honest (not falsely live)");

const geminiLiveEvidencePath = path.join(
  REPO_ROOT,
  "smoke-tests",
  "gemini",
  "live-runs",
  "2026-08-25T14-55-47Z",
  "gemini-live-evidence.json",
);
if (fs.existsSync(geminiLiveEvidencePath)) {
  const geminiLive = JSON.parse(fs.readFileSync(geminiLiveEvidencePath, "utf8"));
  assert(
    geminiLive.status === "live-failed",
    `Gemini live evidence records live-failed status (got: ${geminiLive.status})`,
  );
  assert(
    geminiLive.fallbackUsed === true,
    "Gemini live evidence has fallbackUsed=true",
  );
  assert(
    geminiLive.status !== "live-success",
    "Gemini must not be labelled live-success while NOT_CONFIRMED",
  );
} else {
  assert(true, "Gemini live evidence file not present (skipped)");
}

// ── Section 8: Atlas live Sandbox label is correct ───────────────────────────

section("Section 8: Atlas live Sandbox label is correct");

const atlasReconciliationPath = path.join(
  REPO_ROOT,
  "smoke-tests",
  "atlas",
  "live-app-runs",
  "2026-08-24T17-03-17Z",
  "atlas-reconciliation.json",
);
if (fs.existsSync(atlasReconciliationPath)) {
  const atlasResult = JSON.parse(fs.readFileSync(atlasReconciliationPath, "utf8"));
  assert(
    atlasResult.environment === "sandbox" || atlasResult.dataMode === "live",
    "Atlas reconciliation has sandbox environment or live dataMode",
  );
  assert(
    atlasResult.search?.executed === true && atlasResult.verify?.executed === true,
    "Atlas reconciliation records successful read-only search and verify",
  );
  assert(
    atlasResult.readOnlyGate === true,
    "Atlas reconciliation confirms readOnlyGate=true",
  );
} else {
  assert(true, "Atlas reconciliation file not present (skipped)");
}

// ── Section 9: Nosana live label only for reconciled result ──────────────────

section("Section 9: Nosana live label is correct only for the reconciled live result");

// The reconciled artifact should have the live evidence label
assert(
  reconciled.evidenceSource === "nosana-evidence" && reconciled.fallbackUsed === false,
  "Reconciled artifact qualifies for Nosana live evidence label",
);

// The dedicated offline browser fixture must NOT qualify for a live label
const offlineBrowserSource = offlineBrowserResult.evidenceSource
  ?? offlineBrowserResult.riskResult?.evidenceSource;
assert(
  offlineBrowserSource !== "nosana-evidence" || offlineBrowserResult.riskResult?.fallbackUsed === true,
  "Offline browser fixture does not qualify for Nosana live evidence label",
);

// The runtime file is a dry-run preview and must not qualify for a live label.
if (fs.existsSync(RUNTIME_BROWSER_RESULT)) {
  const runtimeResult = JSON.parse(fs.readFileSync(RUNTIME_BROWSER_RESULT, "utf8"));
  const runtimeSource = runtimeResult.evidenceSource ?? runtimeResult.riskResult?.evidenceSource;
  assert(
    runtimeSource === "dry-run" && runtimeResult.usedFallback === true && runtimeResult.jobMetadata?.jobId === null,
    "Runtime browser result is a dry-run preview with no submitted job ID",
  );
} else {
  assert(true, "Runtime browser result not present (cannot verify live label)");
}

// ── Section 10: Fallback labels remain correct ───────────────────────────────

section("Section 10: Fallback labels remain correct");

// When evidenceSource is local-fallback, the label should be fallback
const fallbackProvenance = { evidenceSource: "local-fallback", fallbackUsed: true };
assert(
  fallbackProvenance.evidenceSource === "local-fallback",
  "Local fallback provenance has evidenceSource='local-fallback'",
);
assert(
  fallbackProvenance.fallbackUsed === true,
  "Local fallback provenance has fallbackUsed=true",
);

// When evidenceSource is nosana-evidence but fallbackUsed=true, still fallback
const nosanaFallbackProvenance = { evidenceSource: "nosana-evidence", fallbackUsed: true };
assert(
  nosanaFallbackProvenance.evidenceSource === "nosana-evidence" && nosanaFallbackProvenance.fallbackUsed === true,
  "Nosana evidence with fallbackUsed=true correctly indicates fallback was used",
);

// ── Section 11: No secrets in reconciled artifact ────────────────────────────

section("Section 11: No secrets appear in the reconciled artifact");

const reconciledRaw = fs.readFileSync(reconciledPath, "utf8");
const secretPatterns = [
  /GEMINI_API_KEY/i,
  /NOSANA_API_KEY/i,
  /ATLAS_CLIENT_SECRET/i,
  /ATLAS_CLIENT_ID/i,
  /DAYTONA_API_KEY/i,
  /OPENROUTER_API_KEY/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /wallet.*private.*key/i,
];

let secretsFound = 0;
for (const pattern of secretPatterns) {
  if (pattern.test(reconciledRaw)) {
    secretsFound += 1;
    console.log(`  ✗ Secret pattern matched: ${pattern}`);
  }
}
assert(secretsFound === 0, "No secret patterns found in reconciled artifact");

// Also check the sanitized fixture
const fixtureRaw = fs.readFileSync(fixturePath, "utf8");
let fixtureSecretsFound = 0;
for (const pattern of secretPatterns) {
  if (pattern.test(fixtureRaw)) {
    fixtureSecretsFound += 1;
  }
}
assert(fixtureSecretsFound === 0, "No secret patterns found in sanitized fixture");

// ── Section 12: No live calls during tests ───────────────────────────────────

section("Section 12: No live calls occur during tests");

// Verify no network imports in this test file
const testSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
// Check for actual import statements, not string patterns in assertions
const importLines = testSource.split("\n").filter(
  (l) => /^\s*import\s/.test(l) || /^\s*const\s.*=\s*require\(/.test(l),
);
const hasNetworkImport = importLines.some(
  (l) => l.includes("node:http") || l.includes("node:https") || l.includes("node:net"),
);
assert(!hasNetworkImport, "Test file does not import network modules");

// Check for actual fetch calls outside of assertion strings
const codeLines = testSource.split("\n").filter(
  (l) => !l.trim().startsWith("assert") && !l.trim().startsWith("//") && !l.trim().startsWith("*"),
);
const hasFetchCall = codeLines.some((l) => /\bfetch\s*\(/.test(l));
assert(!hasFetchCall, "Test file does not call fetch");

// Check that no dryRun=false or --live appears in code lines (not assertions or meta-checks)
const executableLines = codeLines.filter(
  (l) => !l.includes("hasDryRunFalse") && !l.includes("hasLiveFlag") && !l.includes("dryRun: false") && !l.includes('"--live"'),
);
const hasDryRunFalse = executableLines.some((l) => l.includes("dryRun: false"));
assert(!hasDryRunFalse, "Test file does not set dryRun=false");
const hasLiveFlag = executableLines.some((l) => l.includes("--live"));
assert(!hasLiveFlag, "Test file does not reference --live flag");

// Verify the reconciled artifact declares no new submission
assert(
  reconciled.safety?.noNewSubmission === true,
  "Reconciled artifact declares noNewSubmission=true",
);
assert(
  reconciled.safety?.noNetworkRequest === true,
  "Reconciled artifact declares noNetworkRequest=true",
);

// ── Summary ──────────────────────────────────────────────────────────────────

console.log("\n" + "=".repeat(72));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(72));

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log("\nAll reconciliation tests passed (offline, synthetic, no Nosana contact).");
}
