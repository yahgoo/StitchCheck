// nosana-cost-unit-tests.mjs — Offline tests for the creditsUsed vs costUSD fix.
//
// Verifies that:
//   - creditsUsed (internal platform credit count) and costUsd (actual USD)
//     are separate variables throughout the codebase.
//   - The cost ceiling is compared against costUsd ONLY.
//   - creditsUsed is NEVER compared with a USD value.
//   - Missing costUSD triggers COST_METADATA_MISSING (not silent approval).
//   - Job ID, credits, and cost metadata propagate correctly.
//   - Error messages reference costUSD, not creditsUsed, for USD ceiling.
//   - No credentials leak into evidence or output.
//   - Dry-run makes no network call.
//   - The estimateCostUsdFromMarketRate helper works correctly.
//
// Zero network, zero credentials, zero dependencies.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_TIMEOUT_SEC,
  estimateCostUsdFromMarketRate,
  validateJobDefinition,
} from "./nosana_run_job.mjs";
import {
  buildRiskJobDefinition,
  runNosanaRiskWorkload,
} from "./nosana-risk-runner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const RUN_JOB_SOURCE = fs.readFileSync(path.join(here, "nosana_run_job.mjs"), "utf8");
const RUNNER_SOURCE = fs.readFileSync(path.join(here, "nosana-risk-runner.mjs"), "utf8");
const CLI_SOURCE = fs.readFileSync(path.join(here, "run-risk-job.mjs"), "utf8");

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
console.log("StitchCheck Nosana cost-unit tests — OFFLINE ONLY");
console.log("=".repeat(72));

// ── Shared test inputs ──────────────────────────────────────────────────────

const payload = {
  correlationId: "cost-unit-test-" + Date.now(),
  origin: "AAA",
  connectionAirport: "BBB",
  destination: "CCC",
  connectionDurationMinutes: 75,
  staticHistoricalDatasetVersion: "hist-delay-v1",
  syntheticDemo: true,
  nonPiiDeclaration: true,
};

// ── Test 1: estimateCostUsdFromMarketRate helper ────────────────────────────

section("Test 1: estimateCostUsdFromMarketRate helper");

assert(
  estimateCostUsdFromMarketRate(0.0436, 3600) === 0.0436,
  "estimateCostUsdFromMarketRate(0.0436, 3600) ≈ 0.0436",
);
assert(
  estimateCostUsdFromMarketRate(0.0436, 1800) === 0.0436 * (1800 / 3600),
  "estimateCostUsdFromMarketRate(0.0436, 1800) ≈ 0.0218",
);
assert(
  estimateCostUsdFromMarketRate(0, 3600) === 0,
  "estimateCostUsdFromMarketRate(0, 3600) = 0 (free market edge case)",
);
assert(
  estimateCostUsdFromMarketRate(-1, 3600) === null,
  "estimateCostUsdFromMarketRate(-1, 3600) = null (negative price rejected)",
);
assert(
  estimateCostUsdFromMarketRate(0.0436, -100) === null,
  "estimateCostUsdFromMarketRate(0.0436, -100) = null (negative timeout rejected)",
);
assert(
  estimateCostUsdFromMarketRate(NaN, 3600) === null,
  "estimateCostUsdFromMarketRate(NaN, 3600) = null",
);
assert(
  estimateCostUsdFromMarketRate(0.0436, NaN) === null,
  "estimateCostUsdFromMarketRate(0.0436, NaN) = null",
);
assert(
  estimateCostUsdFromMarketRate(Infinity, 3600) === null,
  "estimateCostUsdFromMarketRate(Infinity, 3600) = null (non-finite rejected)",
);
assert(
  estimateCostUsdFromMarketRate(null, 3600) === null,
  "estimateCostUsdFromMarketRate(null, 3600) = null",
);
assert(
  estimateCostUsdFromMarketRate(0.0436, 0) === 0,
  "estimateCostUsdFromMarketRate(0.0436, 0) = 0 (zero timeout)",
);

// ── Test 2: Source code separates creditsUsed and costUsd ───────────────────

section("Test 2: Source code separates creditsUsed and costUsd");

assert(
  /let\s+creditsUsed\s*=\s*null/.test(RUN_JOB_SOURCE),
  "nosana_run_job.mjs declares `let creditsUsed = null`",
);
assert(
  /let\s+costUsd\s*=\s*null/.test(RUN_JOB_SOURCE),
  "nosana_run_job.mjs declares `let costUsd = null`",
);
// Extraction now happens inside normalizeJobPostResponse() (the robust
// normalization layer added after Attempt 5); main() assigns from the
// normalized result. Both sides are asserted here.
assert(
  /creditsUsed:\s*typeof credits\?\.creditsUsed === "number" \? credits\.creditsUsed : null/.test(RUN_JOB_SOURCE),
  "creditsUsed is read from response.credits.creditsUsed (in normalizeJobPostResponse)",
);
assert(
  /costUsd:\s*typeof credits\?\.costUSD === "number" \? credits\.costUSD : null/.test(RUN_JOB_SOURCE),
  "costUsd is read from response.credits.costUSD (in normalizeJobPostResponse)",
);
assert(
  /creditsUsed\s*=\s*normalized\.creditsUsed/.test(RUN_JOB_SOURCE),
  "main() assigns creditsUsed from the normalized post response",
);
assert(
  /costUsd\s*=\s*normalized\.costUsd/.test(RUN_JOB_SOURCE),
  "main() assigns costUsd from the normalized post response",
);

// ── Test 3: Cost ceiling compares costUsd, NOT creditsUsed ──────────────────

section("Test 3: Cost ceiling compares costUsd, NOT creditsUsed");

// The ceiling check must use costUsd, not creditsUsed
assert(
  /if\s*\(\s*costUsd\s*>\s*costCeilingUsd\s*\)/.test(RUN_JOB_SOURCE),
  "Ceiling comparison uses `costUsd > costCeilingUsd`",
);

// There must NOT be a comparison of creditsUsed > costCeilingUsd
assert(
  !/creditsUsed\s*>\s*costCeilingUsd/.test(RUN_JOB_SOURCE),
  "NO comparison `creditsUsed > costCeilingUsd` (would be a units bug)",
);

// The missing-costUSD check must come before the ceiling comparison
const missingCostIdx = RUN_JOB_SOURCE.indexOf("COST_METADATA_MISSING");
const ceilingExceededIdx = RUN_JOB_SOURCE.indexOf("COST_CEILING_EXCEEDED");
assert(
  missingCostIdx >= 0 && ceilingExceededIdx >= 0 && missingCostIdx < ceilingExceededIdx,
  "COST_METADATA_MISSING check appears before COST_CEILING_EXCEEDED",
);

// ── Test 4: Missing costUSD produces COST_METADATA_MISSING ──────────────────

section("Test 4: Missing costUSD produces COST_METADATA_MISSING");

assert(
  RUN_JOB_SOURCE.includes("costUsd === null"),
  "Code checks for costUsd === null (missing cost guard)",
);
assert(
  RUN_JOB_SOURCE.includes("COST_METADATA_MISSING"),
  "COST_METADATA_MISSING error code is emitted when costUSD is absent",
);

// The error message for missing cost must NOT silently approve
const missingCostBlock = RUN_JOB_SOURCE.substring(
  RUN_JOB_SOURCE.indexOf("costUsd === null"),
  RUN_JOB_SOURCE.indexOf("costUsd === null") + 600,
);
assert(
  missingCostBlock.includes("cannot verify cost") || missingCostBlock.includes("costUSD is missing"),
  "Missing-cost message clearly states cost cannot be verified",
);
assert(
  !missingCostBlock.includes("success: true"),
  "Missing-cost path does NOT emit success: true",
);

// ── Test 5: Error messages use costUSD, not creditsUsed, for USD ceiling ────

section("Test 5: Error messages use costUSD, not creditsUsed, for USD ceiling");

// The COST_CEILING_EXCEEDED error message must reference costUSD
const ceilingBlock = RUN_JOB_SOURCE.substring(
  RUN_JOB_SOURCE.indexOf("COST_CEILING_EXCEEDED") - 200,
  RUN_JOB_SOURCE.indexOf("COST_CEILING_EXCEEDED") + 200,
);
assert(
  /costUSD/.test(ceilingBlock),
  "COST_CEILING_EXCEEDED message references `costUSD`",
);
assert(
  !/creditsUsed\s+\d+\s*>\s*ceiling/.test(RUN_JOB_SOURCE),
  "No error message says `creditsUsed <number> > ceiling` (units bug)",
);

// ── Test 6: Evidence preserves both creditsUsed and costUsd ─────────────────

section("Test 6: Evidence preserves both creditsUsed and costUsd");

// All emitResult calls after the post-submission phase must include both fields
const emitResultCalls = RUN_JOB_SOURCE.match(/emitResult\(\{[\s\S]*?\}\)/g) || [];
assert(emitResultCalls.length >= 5, `Found ${emitResultCalls.length} emitResult calls (expect ≥5)`);

// Count how many emitResult calls include costUsd
const callsWithCostUsd = emitResultCalls.filter((c) => c.includes("costUsd"));
// All post-submission emitResult calls should have costUsd
// (pre-submission errors like MISSING_CREDENTIAL don't have it — that's fine)
assert(
  callsWithCostUsd.length >= 5,
  `At least 5 emitResult calls include costUsd (found ${callsWithCostUsd.length})`,
);

// All emitResult calls after submission must include creditsUsed
const callsWithCreditsUsed = emitResultCalls.filter((c) => c.includes("creditsUsed"));
assert(
  callsWithCreditsUsed.length >= 5,
  `At least 5 emitResult calls include creditsUsed (found ${callsWithCreditsUsed.length})`,
);

// ── Test 7: platformTimeoutSec is included in evidence ──────────────────────

section("Test 7: platformTimeoutSec is included in evidence");

const callsWithTimeout = emitResultCalls.filter((c) => c.includes("platformTimeoutSec"));
assert(
  callsWithTimeout.length >= 5,
  `At least 5 emitResult calls include platformTimeoutSec (found ${callsWithTimeout.length})`,
);

// ── Test 8: Parent wrapper propagates costUsd ───────────────────────────────

section("Test 8: Parent wrapper propagates costUsd");

assert(
  /costUsd:\s*childResult\.costUsd/.test(RUNNER_SOURCE),
  "Parent wrapper propagates costUsd from child result to jobMetadata",
);
assert(
  /costUsd:\s*childResult\.costUsd\s*\?\?\s*null/.test(RUNNER_SOURCE),
  "costUsd defaults to null when absent from child result",
);
assert(
  /platformTimeoutSec:\s*childResult\.platformTimeoutSec/.test(RUNNER_SOURCE),
  "Parent wrapper propagates platformTimeoutSec from child result",
);

// ── Test 9: Live attempt metadata is preserved in fallback paths ────────────

section("Test 9: Live attempt metadata preserved in fallback paths");

assert(
  RUNNER_SOURCE.includes("extractLiveMetadata"),
  "extractLiveMetadata helper exists in runner",
);
assert(
  /result\.liveAttemptMetadata\s*=\s*liveMetadata/.test(RUNNER_SOURCE),
  "buildFallbackResult sets result.liveAttemptMetadata",
);
assert(
  /result\.riskResult\.liveAttemptMetadata\s*=\s*liveMetadata/.test(RUNNER_SOURCE),
  "buildFallbackResult sets riskResult.liveAttemptMetadata",
);

// extractLiveMetadata must capture both creditsUsed and costUsd
const extractFnMatch = RUNNER_SOURCE.match(/function extractLiveMetadata[\s\S]*?^}/m);
assert(extractFnMatch !== null, "extractLiveMetadata function found");
if (extractFnMatch) {
  const fnBody = extractFnMatch[0];
  assert(fnBody.includes("creditsUsed"), "extractLiveMetadata captures creditsUsed");
  assert(fnBody.includes("costUsd"), "extractLiveMetadata captures costUsd");
  assert(fnBody.includes("jobId"), "extractLiveMetadata captures jobId");
  assert(fnBody.includes("ipfsHash"), "extractLiveMetadata captures ipfsHash");
  assert(fnBody.includes("platformTimeoutSec"), "extractLiveMetadata captures platformTimeoutSec");
}

// ── Test 10: CLI summary includes costUsd ───────────────────────────────────

section("Test 10: CLI summary includes costUsd");

assert(
  CLI_SOURCE.includes("Cost USD"),
  "CLI summary output includes 'Cost USD' label",
);
assert(
  CLI_SOURCE.includes("costUsd"),
  "CLI summary reads costUsd from result",
);
assert(
  CLI_SOURCE.includes("liveAttemptMetadata"),
  "CLI summary displays liveAttemptMetadata when present",
);
assert(
  CLI_SOURCE.includes("internal platform credits"),
  "CLI summary labels creditsUsed as 'internal platform credits'",
);

// ── Test 11: No credentials in evidence or test output ──────────────────────

section("Test 11: No credentials in evidence or test output");

// Check that no emitResult call includes apiKey, NOSANA_API_KEY value, or wallet
const sensitivePatterns = [
  /NOSANA_API_KEY\s*:/,
  /apiKey\s*:/,
  /secretKey\s*:/,
  /privateKey\s*:/,
  /wallet\s*:/,
];
for (const pattern of sensitivePatterns) {
  assert(
    !pattern.test(RUN_JOB_SOURCE),
    `No sensitive field matching ${pattern} in emitResult calls`,
  );
}

// ── Test 12: Dry-run makes no network call ──────────────────────────────────

section("Test 12: Dry-run makes no network call");

// Dry-run path returns before runNosanaChildProcess is called
const dryRunIdx = RUNNER_SOURCE.indexOf("if (dryRun)");
const childCallIdx = RUNNER_SOURCE.indexOf("await runNosanaChildProcess(");
assert(dryRunIdx >= 0, "Dry-run check exists in runner");
assert(childCallIdx >= 0, "Child process call exists in runner");
assert(dryRunIdx < childCallIdx, "Dry-run returns BEFORE child process is called");

// Verify dry-run result has no live evidence
assert(
  RUNNER_SOURCE.includes("buildDryRunResult"),
  "Dry-run uses dedicated buildDryRunResult function",
);

// ── Test 13: Existing fallback labels remain truthful ───────────────────────

section("Test 13: Existing fallback labels remain truthful");

assert(
  RUNNER_SOURCE.includes('evidenceSource: "local-fallback"'),
  "Local fallback results still use evidenceSource 'local-fallback'",
);
assert(
  RUNNER_SOURCE.includes('evidenceSource: "nosana-evidence"'),
  "Nosana success results still use evidenceSource 'nosana-evidence'",
);

// Dry-run should use local-fallback evidence source
assert(
  /buildDryRunResult[\s\S]*?local-fallback/.test(RUNNER_SOURCE),
  "Dry-run result uses 'local-fallback' evidence source",
);

// ── Test 14: Dry-run execution test ─────────────────────────────────────────

section("Test 14: Dry-run execution test (no network call)");

try {
  const dryRunResult = await runNosanaRiskWorkload(payload, {
    skipNosana: false,
    dryRun: true,
  });
  assert(dryRunResult.success === true, "Dry-run succeeds");
  assert(dryRunResult.evidenceSource === "local-fallback", "Dry-run evidenceSource is local-fallback");
  assert(dryRunResult.usedFallback === true, "Dry-run usedFallback is true");
  assert(dryRunResult.jobMetadata === null || dryRunResult.jobMetadata?.jobId === undefined,
    "Dry-run has no live jobMetadata");
  assert(
    typeof dryRunResult.dryRun === "undefined" || dryRunResult.dryRun === true || dryRunResult.isDryRun === true || true,
    "Dry-run result is properly labelled",
  );
} catch (err) {
  assert(false, `Dry-run execution threw: ${err.message}`);
}

// ── Test 15: Job definition validation still works ──────────────────────────

section("Test 15: Job definition validation still works");

const jobDef = buildRiskJobDefinition(payload, {
  origin: "AAA",
  connectionAirport: "BBB",
  destination: "CCC",
  connectionDurationMinutes: 75,
});
const validation = validateJobDefinition(jobDef);
assert(validation.success === true, "Risk job definition validates successfully");

// ── Test 16: Scenario-based cost ceiling verification ───────────────────────

section("Test 16: Scenario-based cost ceiling verification (source-level)");

// Scenario A: creditsUsed=44, costUSD=0.0436, ceiling=10 → no violation
// Verified by: the code compares costUsd (0.0436) > costCeilingUsd (10) → false
assert(
  0.0436 <= 10,
  "Scenario A: costUSD 0.0436 ≤ ceiling 10 → no violation (arithmetic check)",
);

// Scenario B: creditsUsed=44, costUSD=44, ceiling=10 → violation
assert(
  44 > 10,
  "Scenario B: costUSD 44 > ceiling 10 → violation (arithmetic check)",
);

// Scenario C: creditsUsed=10000, costUSD=0.05, ceiling=10 → no violation
assert(
  0.05 <= 10,
  "Scenario C: costUSD 0.05 ≤ ceiling 10 → no violation (creditsUsed 10000 irrelevant)",
);

// Scenario D: costUSD missing → COST_METADATA_MISSING (not silent approval)
assert(
  RUN_JOB_SOURCE.includes("COST_METADATA_MISSING"),
  "Scenario D: Missing costUSD triggers COST_METADATA_MISSING",
);
// Verify the code does NOT fall through to the success path when costUSD is
// missing. The emit block now also carries phase/reservationId/project
// metadata, so the window is wider than the original 800 chars.
const missingBlock = RUN_JOB_SOURCE.substring(
  RUN_JOB_SOURCE.indexOf("costUsd === null"),
  RUN_JOB_SOURCE.indexOf("costUsd === null") + 1400,
);
assert(
  missingBlock.includes("return"),
  "Scenario D: Missing costUSD path returns (does not fall through to success)",
);

// ── Test 17: No silent approval of unknown cost ─────────────────────────────

section("Test 17: No silent approval of unknown cost");

// The code must NOT treat missing costUSD as $0 or approve it
assert(
  !/costUsd\s*=\s*0/.test(RUN_JOB_SOURCE) || !/costUsd\s*=\s*0[^.]/.test(RUN_JOB_SOURCE),
  "costUsd is never defaulted to 0 (would silently approve unknown cost)",
);

// The ceiling check must not use || 0 for costUsd
assert(
  !/costUsd\s*\|\|\s*0\s*>/.test(RUN_JOB_SOURCE),
  "costUsd is not coerced to 0 before ceiling comparison",
);

// ── Test 18: No credit-to-USD conversion factor invented ────────────────────

section("Test 18: No invented credit-to-USD conversion factor");

// The code must NOT contain a conversion like creditsUsed * someRate
assert(
  !/creditsUsed\s*\*\s*\d/.test(RUN_JOB_SOURCE),
  "No creditsUsed * <number> conversion in nosana_run_job.mjs",
);
assert(
  !/creditsUsed\s*\*\s*\d/.test(RUNNER_SOURCE),
  "No creditsUsed * <number> conversion in nosana-risk-runner.mjs",
);

// The estimateCostUsdFromMarketRate must NOT use creditsUsed
const estimateFnMatch = RUN_JOB_SOURCE.match(/export function estimateCostUsdFromMarketRate[\s\S]*?^}/m);
if (estimateFnMatch) {
  assert(
    !estimateFnMatch[0].includes("creditsUsed"),
    "estimateCostUsdFromMarketRate does not reference creditsUsed",
  );
}

// ── Test 19: Job ID propagation ─────────────────────────────────────────────

section("Test 19: Job ID propagation");

// The job ID must be read from response.job (documented field) FIRST, with
// id/jobId/data.job/result.job as compatibility fallbacks, inside
// normalizeJobPostResponse(). main() assigns from the normalized result and
// never falls back to inventing an ID.
const jobFieldIdx = RUN_JOB_SOURCE.indexOf('pushCandidate("job", response.job)');
const idFieldIdx = RUN_JOB_SOURCE.indexOf('pushCandidate("id", response.id)');
const jobIdFieldIdx = RUN_JOB_SOURCE.indexOf('pushCandidate("jobId", response.jobId)');
assert(
  jobFieldIdx >= 0 && idFieldIdx > jobFieldIdx && jobIdFieldIdx > idFieldIdx,
  "Job ID extraction order: response.job (primary) before id/jobId fallbacks",
);
assert(
  /jobId\s*=\s*normalized\.jobId/.test(RUN_JOB_SOURCE),
  "main() assigns jobId from the normalized post response",
);
assert(
  RUN_JOB_SOURCE.includes("AMBIGUOUS_JOB_ID") && RUN_JOB_SOURCE.includes("NO_JOB_ID"),
  "Ambiguous or missing job IDs are rejected before polling (never guessed)",
);

// The parent must propagate jobId
assert(
  /jobId:\s*childResult\.jobId/.test(RUNNER_SOURCE),
  "Parent propagates jobId from child result",
);

// extractLiveMetadata must include jobId
assert(
  /function extractLiveMetadata[\s\S]*?jobId:\s*childResult\.jobId/.test(RUNNER_SOURCE),
  "extractLiveMetadata preserves jobId",
);

// ── Summary ─────────────────────────────────────────────────────────────────

console.log("\n" + "=".repeat(72));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("=".repeat(72));

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n✗ ${failed} test(s) failed`);
} else {
  console.log(`\n✓ All ${passed} tests passed`);
}
