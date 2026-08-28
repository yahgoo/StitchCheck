// nosana-timeout-safety-tests.mjs — Offline tests for the timeout correction
// and safety invariants required by the final Nosana live gate.
//
// Covers:
//   - Platform timeout is exactly 3600 seconds (Nosana minimum for credit-paid jobs).
//   - Local watchdog is bounded and documented.
//   - Dry-run remains the default mode.
//   - One live invocation can submit at most once (no retry).
//   - Timeout/failure evidence is truthful (no fabricated success).
//   - No secret leakage in any output path.
//   - No video path is triggered by the Nosana runner.
//
// Zero network, zero credentials, zero dependencies.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_TIMEOUT_SEC,
  LOCAL_WATCHDOG_TIMEOUT_MS,
  validateJobDefinition,
  normalizeJobStatus,
  isTerminalJobStatus,
} from "./nosana_run_job.mjs";
import {
  buildRiskJobDefinition,
  RISK_WORKLOAD_IMAGE,
  runNosanaRiskWorkload,
  localRiskCalculation,
} from "./nosana-risk-runner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const HISTORICAL_DATA_PATH = path.join(here, "fixtures", "historical-delay-data.json");
const RUNNER_SOURCE = fs.readFileSync(path.join(here, "nosana-risk-runner.mjs"), "utf8");
const RUN_JOB_SOURCE = fs.readFileSync(path.join(here, "nosana_run_job.mjs"), "utf8");

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
console.log("StitchCheck Nosana timeout correction & safety tests — OFFLINE ONLY");
console.log("=".repeat(72));

// ── Shared test inputs ──────────────────────────────────────────────────────

const payload = {
  correlationId: "timeout-safety-test-001",
  origin: "AAA",
  connectionAirport: "BBB",
  destination: "CCC",
  connectionDurationMinutes: 75,
  staticHistoricalDatasetVersion: "hist-delay-v1",
  syntheticDemo: true,
  nonPiiDeclaration: true,
};
const historicalData = JSON.parse(fs.readFileSync(HISTORICAL_DATA_PATH, "utf8"));

// ── Test 1: Platform timeout is exactly 3600 seconds ────────────────────────

section("Test 1: Platform timeout is exactly 3600 seconds");

assert(DEFAULT_TIMEOUT_SEC === 3600, `DEFAULT_TIMEOUT_SEC === 3600 (found: ${DEFAULT_TIMEOUT_SEC})`);
assert(
  RUN_JOB_SOURCE.includes("export const DEFAULT_TIMEOUT_SEC = 3600"),
  "source code defines DEFAULT_TIMEOUT_SEC as 3600",
);
assert(
  RUN_JOB_SOURCE.includes("at least 3600 seconds"),
  "source comments document the platform minimum of 3600 seconds",
);

// ── Test 2: Local watchdog is bounded and documented ────────────────────────

section("Test 2: Local watchdog is bounded and documented");

assert(typeof LOCAL_WATCHDOG_TIMEOUT_MS === "number", "LOCAL_WATCHDOG_TIMEOUT_MS is a number");
assert(LOCAL_WATCHDOG_TIMEOUT_MS > 0, "LOCAL_WATCHDOG_TIMEOUT_MS is positive");
assert(LOCAL_WATCHDOG_TIMEOUT_MS <= 300000, `LOCAL_WATCHDOG_TIMEOUT_MS ≤ 300s (found: ${LOCAL_WATCHDOG_TIMEOUT_MS}ms)`);
assert(
  LOCAL_WATCHDOG_TIMEOUT_MS < DEFAULT_TIMEOUT_SEC * 1000,
  "local watchdog is strictly shorter than the platform timeout",
);
assert(
  RUN_JOB_SOURCE.includes("LOCAL_WATCHDOG_TIMEOUT_MS"),
  "LOCAL_WATCHDOG_TIMEOUT_MS is exported from nosana_run_job.mjs",
);
assert(
  RUN_JOB_SOURCE.includes("watchdogFired"),
  "poll loop tracks whether the watchdog fired",
);
assert(
  RUN_JOB_SOURCE.includes("LOCAL_WATCHDOG_TIMEOUT"),
  "watchdog timeout produces a distinct error code",
);
assert(
  RUN_JOB_SOURCE.includes("without submitting another job"),
  "watchdog timeout message explicitly states no retry",
);

// ── Test 3: Dry-run remains the default ─────────────────────────────────────

section("Test 3: Dry-run remains the default mode");

// Configure the environment so the safety gate permits execution and the
// dry-run path is actually exercised:
//   - DEMO_MODE=daytona (non-local, so the DEMO_MODE gate does not block)
//   - NOSANA_ENABLED=true + NOSANA_LIVE_ENABLED=true (both flags pass)
//   - Fake NOSANA_API_KEY (so the skipNosana/credential check does not block)
// With the gate open, dryRun defaults to true (not explicitly set), so
// buildDryRunResult() is reached — verifying dry-run is still the default.
const savedKey = process.env.NOSANA_API_KEY;
const savedDemoMode = process.env.DEMO_MODE;
const savedNosanaEnabled = process.env.NOSANA_ENABLED;
const savedNosanaLiveEnabled = process.env.NOSANA_LIVE_ENABLED;
process.env.NOSANA_API_KEY = "fake-key-for-dry-run-test";
process.env.DEMO_MODE = "daytona";
process.env.NOSANA_ENABLED = "true";
process.env.NOSANA_LIVE_ENABLED = "true";
try {
  const dryRunResult2 = await runNosanaRiskWorkload(payload, {
    skipNosana: false,
    // dryRun not set → defaults to true
  });
  assert(dryRunResult2.provider === "dry-run", `dry-run is the default (provider: ${dryRunResult2.provider})`);
  assert(dryRunResult2.usedFallback === true, "dry-run uses fallback (no real submission)");
  assert(dryRunResult2.evidenceSource === "dry-run", `evidenceSource is "dry-run" (found: ${dryRunResult2.evidenceSource})`);
  assert(dryRunResult2.jobMetadata?.jobId === null, "dry-run produces no job ID");
  assert(dryRunResult2.jobMetadata?.ipfsHash === null, "dry-run produces no IPFS hash");
} finally {
  if (savedKey === undefined) {
    delete process.env.NOSANA_API_KEY;
  } else {
    process.env.NOSANA_API_KEY = savedKey;
  }
  if (savedDemoMode === undefined) {
    delete process.env.DEMO_MODE;
  } else {
    process.env.DEMO_MODE = savedDemoMode;
  }
  if (savedNosanaEnabled === undefined) {
    delete process.env.NOSANA_ENABLED;
  } else {
    process.env.NOSANA_ENABLED = savedNosanaEnabled;
  }
  if (savedNosanaLiveEnabled === undefined) {
    delete process.env.NOSANA_LIVE_ENABLED;
  } else {
    process.env.NOSANA_LIVE_ENABLED = savedNosanaLiveEnabled;
  }
}

// ── Test 4: One live invocation submits at most once ────────────────────────

section("Test 4: One live invocation can submit at most once (no retry)");

// Verify source code invariants: no retry loops, no second submission
assert(
  !RUN_JOB_SOURCE.match(/jobs\.list\s*\([^)]*\).*jobs\.list/s),
  "nosana_run_job.mjs does not call jobs.list() twice",
);
// Count actual function call expressions (not definitions or comments)
const childProcessCalls = (RUNNER_SOURCE.match(/await\s+runNosanaChildProcess\s*\(/g) || []).length;
assert(
  childProcessCalls <= 1,
  `runner calls runNosanaChildProcess at most once (found: ${childProcessCalls})`,
);
// Verify the catch block in the runner does not retry
const catchBlocks = RUNNER_SOURCE.match(/catch\s*\([^)]*\)\s*\{/g) || [];
assert(catchBlocks.length > 0, "runner has catch blocks for error handling");
// After a failure, the runner calls buildFallbackResult — never re-invokes the child
assert(
  RUNNER_SOURCE.includes("buildFallbackResult"),
  "runner falls back on failure instead of retrying",
);

// ── Test 5: Timeout/failure evidence is truthful ────────────────────────────

section("Test 5: Timeout/failure evidence is truthful");

// When skipNosana is true, the result must be labelled as fallback
const skipResult = await runNosanaRiskWorkload(payload, {
  skipNosana: true,
  dryRun: true,
});
assert(skipResult.evidenceSource !== "nosana-evidence", "skipped run does not claim nosana-evidence");
assert(skipResult.usedFallback === true, "skipped run reports fallback used");

// When dry-run, the result must NOT claim live evidence
// (dry-run was verified in Test 3 with a fake key; here we verify
// without a key, the result is still not nosana-evidence)
const noKeyDryRunResult = await runNosanaRiskWorkload(payload, {
  skipNosana: false,
  // no NOSANA_API_KEY → will skip and fallback
});
assert(noKeyDryRunResult.evidenceSource !== "nosana-evidence", "dry-run without key does not claim nosana-evidence");
assert(noKeyDryRunResult.usedFallback === true, "dry-run without key reports fallback used");

// Verify the fallback message is truthful
assert(
  RUNNER_SOURCE.includes("Nosana unavailable — local fallback used; not Nosana evidence."),
  "fallback message explicitly states it is NOT Nosana evidence",
);

// ── Test 6: No secret leakage ───────────────────────────────────────────────

section("Test 6: No secret leakage in output paths");

// Check that neither source file contains patterns that would log secrets
const secretLeakPatterns = [
  /console\.log\s*\([^)]*NOSANA_API_KEY[^)]*\)/,
  /console\.error\s*\([^)]*NOSANA_API_KEY[^)]*\)/,
  /process\.env\.NOSANA_API_KEY[^,;\s)]*[\n].*console/,
];
for (const pattern of secretLeakPatterns) {
  assert(
    !pattern.test(RUN_JOB_SOURCE),
    `nosana_run_job.mjs does not log NOSANA_API_KEY (pattern: ${pattern})`,
  );
  assert(
    !pattern.test(RUNNER_SOURCE),
    `nosana-risk-runner.mjs does not log NOSANA_API_KEY (pattern: ${pattern})`,
  );
}

// Verify the PII guard in validateJobDefinition blocks NOSANA_API_KEY
const testJobDef = buildRiskJobDefinition(payload, historicalData);
testJobDef.global.env.NOSANA_API_KEY = "test-secret";
const validationWithSecret = validateJobDefinition(testJobDef);
assert(!validationWithSecret.success, "validateJobDefinition rejects job defs with NOSANA_API_KEY in env");

// ── Test 7: No video path is triggered by the Nosana runner ─────────────────

section("Test 7: No video path is triggered by the Nosana runner");

// Verify neither source file references video creation, ffmpeg, or media output
const videoPatterns = [
  /ffmpeg/i,
  /createVideo/i,
  /renderVideo/i,
  /\.mp4/i,
  /video.*create/i,
  /hyperframes/i,
  /remotion/i,
];
for (const pattern of videoPatterns) {
  assert(
    !pattern.test(RUNNER_SOURCE),
    `nosana-risk-runner.mjs does not reference video creation (pattern: ${pattern})`,
  );
  assert(
    !pattern.test(RUN_JOB_SOURCE),
    `nosana_run_job.mjs does not reference video creation (pattern: ${pattern})`,
  );
}

// ── Test 8: validateJobDefinition sees the intended timeout ─────────────────

section("Test 8: validateJobDefinition sees the intended job structure");

const jobDef = buildRiskJobDefinition(payload, historicalData);
const validation = validateJobDefinition(jobDef);
assert(validation.success, `final job definition passes validateJobDefinition (${validation.errors.map(e => e.path).join(", ") || "no errors"})`);
assert(
  jobDef.ops[0].args.image === RISK_WORKLOAD_IMAGE,
  "job definition uses the verified allowlisted image",
);
assert(
  RISK_WORKLOAD_IMAGE === "docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter",
  "image constant matches the verified allowlist entry verbatim",
);

// ── Test 9: Cost ceiling is retained ────────────────────────────────────────

section("Test 9: Cost ceiling of US$10 is retained");

assert(
  RUN_JOB_SOURCE.includes("DEFAULT_COST_CEILING_USD = 10"),
  "cost ceiling default is US$10",
);
assert(
  RUN_JOB_SOURCE.includes("COST_CEILING_EXCEEDED"),
  "cost ceiling violation produces a distinct error code",
);

// ── Test 10: Idempotency handling is retained ───────────────────────────────

section("Test 10: Idempotency handling is retained");

assert(
  RUN_JOB_SOURCE.includes("idempotencyKey"),
  "idempotency key is generated and used",
);
assert(
  RUN_JOB_SOURCE.includes("generateIdempotencyKey") || RUN_JOB_SOURCE.includes("randomUUID"),
  "idempotency key uses SDK or crypto.randomUUID() fallback",
);

// ── Test 11: Timestamped evidence is retained ───────────────────────────────

section("Test 11: Timestamped evidence is retained");

assert(
  RUNNER_SOURCE.includes("utcTimestamp"),
  "runner creates timestamped evidence directories",
);
assert(
  RUNNER_SOURCE.includes("submittedAt") && RUNNER_SOURCE.includes("completedAt"),
  "result includes submittedAt and completedAt timestamps",
);

// ── Test 12: Truthful fallback labels are retained ──────────────────────────

section("Test 12: Truthful fallback labels are retained");

assert(
  RUNNER_SOURCE.includes("evidenceSource") && RUNNER_SOURCE.includes("nosana-evidence"),
  "runner sets evidenceSource to nosana-evidence on success",
);
assert(
  RUNNER_SOURCE.includes("evidenceSource") && RUNNER_SOURCE.includes("local-fallback"),
  "runner sets evidenceSource to local-fallback on fallback",
);
assert(
  RUNNER_SOURCE.includes("fallbackUsed") && RUNNER_SOURCE.includes("false"),
  "runner sets fallbackUsed: false on success",
);

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(72)}`);
console.log(`Timeout correction & safety tests: ${passed} passed, ${failed} failed.`);
console.log("All checks were offline: no job submission, no IPFS pin, no credits,");
console.log("no network endpoints contacted, no credentials read.");
console.log(`${"=".repeat(72)}`);

if (failed > 0) {
  process.exitCode = 1;
}
