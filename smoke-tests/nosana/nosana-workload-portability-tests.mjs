// nosana-workload-portability-tests.mjs — OFFLINE-ONLY verification suite.
//
// Covers Expert C workload-portability checklist (C1-C8) plus requirement D
// (validateJobDefinition on the final job definition object).
//
// Hard guarantees:
// - No job submission, no IPFS pin, no credits, no network calls of any kind.
// - No credentials are read (never touches .env.local or NOSANA_API_KEY).
// - The risk workload is dry-run locally by executing the EXACT container
//   cmd (python3 heredoc) with `sh`, using only the synthetic fixture data.
// - Local results are synthetic placeholders, NOT Nosana evidence.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildRiskJobDefinition,
  RISK_WORKLOAD_IMAGE,
} from "./nosana-risk-runner.mjs";
import {
  validateJobDefinition as localValidateJobDefinition,
  normalizeJobStatus,
  isTerminalJobStatus,
  DEFAULT_TIMEOUT_SEC,
} from "./nosana_run_job.mjs";
import {
  PLACEHOLDER_LABEL,
  HEURISTIC_DISCLAIMER,
  validateRiskRequest,
} from "./schema-validator.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const HISTORICAL_DATA_PATH = path.join(here, "fixtures", "historical-delay-data.json");

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
console.log("StitchCheck Nosana workload portability tests — OFFLINE ONLY");
console.log(`DISCLAIMER: ${HEURISTIC_DISCLAIMER}`);
console.log(`LABEL: ${PLACEHOLDER_LABEL}`);
console.log("No job submission, no IPFS pin, no credits, no network, no credentials.");
console.log("=".repeat(72));

// ── Shared inputs (synthetic, non-PII, deterministic) ─────────────────────

const payload = {
  correlationId: "portability-test-fixed-001",
  origin: "AAA",
  connectionAirport: "BBB",
  destination: "CCC",
  connectionDurationMinutes: 75,
  staticHistoricalDatasetVersion: "hist-delay-v1",
  syntheticDemo: true,
  nonPiiDeclaration: true,
};
const historicalData = JSON.parse(fs.readFileSync(HISTORICAL_DATA_PATH, "utf8"));
const jobDef = buildRiskJobDefinition(payload, historicalData);
const cmd = jobDef.ops[0].args.cmd;

// ── C1: Synthetic non-PII inputs ──────────────────────────────────────────

section("C1: workload uses only synthetic non-PII data");
const reqValidation = validateRiskRequest(payload);
assert(reqValidation.valid, `input payload passes validateRiskRequest (${reqValidation.issues.join("; ") || "no issues"})`);
const envKeys = Object.keys(jobDef.global?.env || {});
assert(
  envKeys.every((k) => ["RISK_INPUT_DATA", "HISTORICAL_DELAY_DATA"].includes(k)),
  `global.env carries only the two data variables (found: ${envKeys.join(", ")})`,
);
const envBlob = JSON.stringify(jobDef.global?.env || {});
const piiPatterns = [/email/i, /passenger/i, /passport/i, /\bpnr\b/i, /cardNumber/i, /dateOfBirth/i, /apiKey/i, /NOSANA_API_KEY/];
assert(
  !piiPatterns.some((re) => re.test(envBlob)),
  "no PII/secret patterns in job-definition env payload",
);
assert(
  jobDef.meta && Object.keys(jobDef.meta).every((k) => ["trigger", "system_resources"].includes(k)),
  "meta contains only schema-permitted keys (no custom metadata inside job definition)",
);

// ── C2: no network inside the container ───────────────────────────────────

section("C2: workload needs no network inside the container");
const networkPatterns = [
  /\bimport\s+(urllib|http|https|socket|ssl|ftplib|smtplib|telnetlib)\b/,
  /\bfrom\s+(urllib|http|https|socket|ssl|requests)\b/,
  /\brequests\./, /\burlopen\b/, /\bsocket\./, /\bcurl\b/, /\bwget\b/, /\bnc\b\s/,
];
assert(
  !networkPatterns.some((re) => re.test(cmd)),
  "cmd contains no network imports or network commands",
);
const importLine = cmd.split("\n").find((l) => l.startsWith("import "));
assert(
  importLine === "import json, os, sys, math, random",
  `workload imports only stdlib modules (found: ${importLine || "none"})`,
);

// ── C8: image is the verified allowlisted string ──────────────────────────

section("C8: container image is the verified allowlisted string");
assert(
  RISK_WORKLOAD_IMAGE === "docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter",
  "RISK_WORKLOAD_IMAGE constant matches the verified allowlist entry verbatim",
);
assert(
  jobDef.ops[0].args.image === RISK_WORKLOAD_IMAGE,
  "job definition uses the verified image string verbatim",
);

// ── C6: timeout below approved ceiling ────────────────────────────────────

section("C6: timeout stays below the approved ceiling (120 s)");
assert(DEFAULT_TIMEOUT_SEC === 120, `DEFAULT_TIMEOUT_SEC is 120 seconds (found: ${DEFAULT_TIMEOUT_SEC})`);
assert(DEFAULT_TIMEOUT_SEC <= 120, "timeout is at or below the approved 120 s ceiling");
assert(DEFAULT_TIMEOUT_SEC < 3600, "timeout is below the SDK schema default of 3600 s");

// ── D: validateJobDefinition (local mirror + official @nosana/kit) ────────

section("D: final job definition passes validateJobDefinition");
const localValidation = localValidateJobDefinition(jobDef);
assert(localValidation.success, `local validateJobDefinition passes (${localValidation.errors.map((e) => e.path).join(", ") || "no errors"})`);

let sdkValidationReported = false;
try {
  const { validateJobDefinition: sdkValidate } = await import("@nosana/kit");
  const sdkResult = sdkValidate(jobDef);
  assert(sdkResult.success === true, "@nosana/kit validateJobDefinition returns success: true");
  if (!sdkResult.success) {
    console.log(`    SDK errors: ${JSON.stringify(sdkResult.errors)}`);
  }
  sdkValidationReported = true;
} catch (err) {
  console.log(`  ⚠ @nosana/kit unavailable offline (${err.message}); SDK validation skipped, local mirror used.`);
}
assert(sdkValidationReported || localValidation.success, "at least one validateJobDefinition layer confirmed the final job definition");

// ── Poll-loop terminal detection (offline, deterministic) ────────────────

section("Poll loop terminal-state detection (string jobStatus / numeric state)");
assert(isTerminalJobStatus({ jobStatus: "completed", ipfsResult: "QmX" }) === true, "completed + ipfsResult is terminal");
assert(isTerminalJobStatus({ jobStatus: "failed", state: 3 }) === true, "failed jobStatus with numeric state is terminal-without-result");
assert(isTerminalJobStatus({ jobStatus: "stopped", state: 4 }) === true, "stopped jobStatus with numeric state is terminal-without-result");
assert(isTerminalJobStatus({ jobStatus: "running", state: 1 }) === false, "running is not terminal");
assert(isTerminalJobStatus({ jobStatus: "pending", state: 0 }) === false, "pending is not terminal");
assert(isTerminalJobStatus({ state: 2 }) === false, "numeric-only state is never guessed as terminal");
assert(isTerminalJobStatus({ state: "Completed" }) === true, "string state is case-insensitively normalised");
assert(isTerminalJobStatus({ ipfsResult: "QmY", jobStatus: "running" }) === true, "ipfsResult presence alone is terminal");
assert(normalizeJobStatus({ jobStatus: "FAILED", state: 3 }) === "failed", "normalizeJobStatus prefers jobStatus string");
assert(normalizeJobStatus({ state: 7 }) === null, "normalizeJobStatus returns null for numeric-only state");

// ── C3/C4/C5/C7: local dry-run of the exact container cmd ────────────────

section("C3/C4/C5/C7: local dry-run of the workload (exact container cmd via sh)");

function dryRunWorkload() {
  return spawnSync("sh", ["-c", cmd], {
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      RISK_INPUT_DATA: JSON.stringify(payload),
      HISTORICAL_DELAY_DATA: JSON.stringify(historicalData),
    },
    encoding: "utf8",
    timeout: 30000,
  });
}

const pythonCheck = spawnSync("python3", ["--version"], { encoding: "utf8" });
if (pythonCheck.error || pythonCheck.status !== 0) {
  console.log("  ⚠ python3 not available locally — execution checks skipped (static checks above still apply).");
} else {
  const run1 = dryRunWorkload();
  assert(run1.status === 0, `workload exits 0 deterministically (exit code: ${run1.status})`);
  assert(run1.stdout.trim().split("\n").length === 1, "workload emits exactly one line on stdout");

  let output1 = null;
  let parseOk = true;
  try {
    output1 = JSON.parse(run1.stdout.trim());
  } catch {
    parseOk = false;
  }
  assert(parseOk, "stdout parses as valid JSON (C4)");

  if (output1) {
    assert(typeof output1.riskScore === "number" && output1.riskScore >= 0 && output1.riskScore <= 1, `riskScore is a number in [0,1] (found: ${output1.riskScore}) (C7)`);
    assert(["low", "medium", "high"].includes(output1.riskBand), `riskBand is low/medium/high (found: ${output1.riskBand}) (C7)`);
    assert(Array.isArray(output1.assumptions) && output1.assumptions.length > 0, "assumptions is a non-empty array (C7)");
    assert(Number.isInteger(output1.simulationCount), `simulationCount is an integer (found: ${output1.simulationCount}) (C7)`);
    assert(output1.simulationCount <= 1000, `simulationCount bounded ≤ 1000 (found: ${output1.simulationCount}) (C3)`);
    assert(output1.simulationCount >= 100, `simulationCount ≥ 100 per workload contract (found: ${output1.simulationCount})`);
    assert(typeof output1.explanation === "string" && output1.explanation.length >= 10, "explanation is a non-empty string (C7)");
    assert(output1.assumptions.some((a) => /simulations/i.test(a)), "assumptions carry evidence metadata (simulation count) (C7)");
  }

  const run2 = dryRunWorkload();
  assert(run2.status === 0, "second dry-run exits 0");
  assert(run1.stdout === run2.stdout, "two identical dry-runs produce byte-identical output (C5 determinism, seeded RNG)");
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(72)}`);
console.log(`Workload portability tests: ${passed} passed, ${failed} failed.`);
console.log("All checks were offline: no job submission, no IPFS pin, no credits,");
console.log("no network endpoints contacted, no credentials read.");
console.log(`${"=".repeat(72)}`);

if (failed > 0) {
  process.exitCode = 1;
}
