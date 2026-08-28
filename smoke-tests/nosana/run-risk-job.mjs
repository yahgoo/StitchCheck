#!/usr/bin/env node
// run-risk-job.mjs — CLI entry point for the StitchCheck Nosana risk workload.
//
// Usage:
//   node smoke-tests/nosana/run-risk-job.mjs [--skip-nosana] [--dry-run] [--live] [--market <addr>] [--timeout <ms>]
//
// Modes:
//   --dry-run  (DEFAULT) Build and validate the job definition but do NOT submit.
//   --live     Explicitly enable live submission (requires DRY_RUN=false or --live flag).
//   --skip-nosana  Skip Nosana entirely, use local fallback.
//
// Environment:
//   DRY_RUN=true (default) — dry-run mode. Set DRY_RUN=false or use --live to submit.
//
// This script:
//   1. Reads NOSANA_API_KEY from .env.local (if present) or environment.
//   2. Builds and validates the risk job definition.
//   3. Submits to Nosana (or falls back to local calculation).
//   4. Writes the result to smoke-tests/nosana/results/nosana-risk-result.json
//      and app/public/nosana-risk-result.json for the React dev server.
//
// SAFETY:
// - NEVER prints NOSANA_API_KEY or any credential.
// - NEVER modifies Atlas booking/payment/ticketing.
// - All inputs are non-PII synthetic data only.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRiskJobDefinition,
  RISK_WORKLOAD_IMAGE,
} from "./nosana-risk-runner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(here, "results");
const RESULT_OUTPUT_PATH = path.join(RESULTS_DIR, "nosana-risk-result.json");
const APP_PUBLIC_DIR = path.join(here, "..", "..", "app", "public");

// ── Load NOSANA_API_KEY from .env.local if not already in env ──────────────

const ENV_KEYS = [
  "NOSANA_API_KEY",
  "NOSANA_MARKET",
  "NOSANA_COST_CEILING_USD",
  "NOSANA_ENABLED",
  "NOSANA_LIVE_ENABLED",
  "DEMO_MODE",
];

function loadEnvLocal() {
  const envLocalPath = path.join(here, "..", "..", ".env.local");
  try {
    const content = fs.readFileSync(envLocalPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const eq = trimmed.indexOf("=");
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!ENV_KEYS.includes(key)) continue;
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env.local not found — that's fine, will use env or fallback
  }
}

// ── Parse CLI args ─────────────────────────────────────────────────────────

function parseArgs() {
  const args = { skipNosana: false, market: null, timeoutMs: null, dryRun: null };
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--skip-nosana") {
      args.skipNosana = true;
    } else if (process.argv[i] === "--market" && process.argv[i + 1]) {
      args.market = process.argv[++i];
    } else if (process.argv[i] === "--timeout" && process.argv[i + 1]) {
      args.timeoutMs = parseInt(process.argv[++i], 10);
    } else if (process.argv[i] === "--dry-run") {
      args.dryRun = true;
    } else if (process.argv[i] === "--live") {
      args.dryRun = false;
    }
  }
  return args;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();
  const args = parseArgs();

  console.error("════════════════════════════════════════════════════════════════════");
  console.error("StitchCheck Nosana Risk Workload Runner");
  console.error("════════════════════════════════════════════════════════════════════");
  console.error("");
  console.error("Disclaimer: Heuristic risk estimate only — derived from a");
  console.error("static/historical synthetic dataset; not a live delay, weather,");
  console.error("legal, or guaranteed-outcome prediction.");
  console.error("");

  // Determine dry-run mode. Default is TRUE (dry-run).
  // Explicit --live flag or DRY_RUN=false env var enables live submission.
  const envDryRun = process.env.DRY_RUN;
  let isDryRun;
  if (args.dryRun === false) {
    isDryRun = false; // --live flag explicitly set
  } else if (args.dryRun === true) {
    isDryRun = true; // --dry-run flag explicitly set
  } else if (envDryRun !== undefined) {
    isDryRun = envDryRun.toLowerCase() !== "false"; // DRY_RUN=false enables live
  } else {
    isDryRun = true; // DEFAULT: dry-run
  }

  if (isDryRun) {
    console.error("*** DRY-RUN MODE — no job will be submitted to Nosana ***");
    console.error("*** To enable live submission, use --live flag or set DRY_RUN=false ***");
  } else {
    console.error("*** LIVE MODE — job WILL be submitted to Nosana network ***");
    console.error("*** Credits will be spent. Ensure you have authorization. ***");
  }
  console.error("");

  // Check credential presence (NEVER print the key)
  const hasKey = !!process.env.NOSANA_API_KEY;
  console.error(`NOSANA_API_KEY present: ${hasKey ? "yes (will NOT be logged)" : "no"}`);
  console.error(`Skip Nosana flag: ${args.skipNosana}`);
  console.error(`Market: ${args.market || "default (cheapest)"}`);
  console.error("");

  // Import the runner
  const { default: runNosanaRiskWorkload } = await import("./nosana-risk-runner.mjs");

  // Default non-PII itinerary payload
  const payload = {
    correlationId: "nosana-risk-cli-" + Date.now(),
    origin: "AAA",
    connectionAirport: "BBB",
    destination: "CCC",
    connectionDurationMinutes: 75,
    staticHistoricalDatasetVersion: "hist-delay-v1",
    syntheticDemo: true,
    nonPiiDeclaration: true,
  };

  const result = await runNosanaRiskWorkload(payload, {
    skipNosana: args.skipNosana || !hasKey,
    market: args.market || undefined,
    timeoutMs: args.timeoutMs || undefined,
    dryRun: isDryRun,
  });

  // Write result to results/ directory
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(RESULT_OUTPUT_PATH, JSON.stringify(result, null, 2) + "\n", "utf8");

  // Also write to app/public/ for the React dev server to serve
  fs.mkdirSync(APP_PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(APP_PUBLIC_DIR, "nosana-risk-result.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  const utcTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evidenceDir = path.join(RESULTS_DIR, utcTimestamp);
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, "result.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  const summaryLines = [
    `# StitchCheck Nosana Risk Workload — ${utcTimestamp}`,
    "",
    `- Evidence source: ${result.evidenceSource}`,
    `- Evidence label: ${result.evidenceLabel}`,
    `- Provider: ${result.provider}`,
    `- Fallback used: ${result.usedFallback}`,
    `- Latency: ${result.latencyMs}ms`,
  ];
  if (result.jobMetadata) {
    summaryLines.push(
      "",
      "## Job Metadata",
      "",
      `- Job ID: ${result.jobMetadata.jobId}`,
      `- Market: ${result.jobMetadata.market}`,
      `- IPFS hash: ${result.jobMetadata.ipfsHash}`,
      `- Observed states: ${(result.jobMetadata.observedStates || []).join(", ") || "N/A"}`,
      `- Credits used: ${result.jobMetadata.creditsUsed ?? "N/A"}`,
      `- Submitted at: ${result.jobMetadata.submittedAt ?? "N/A"}`,
      `- Completed at: ${result.jobMetadata.completedAt ?? "N/A"}`,
    );
  }
  if (result.riskResult) {
    summaryLines.push(
      "",
      "## Risk Result",
      "",
      `- Risk band: ${result.riskResult.riskBand}`,
      `- Risk score: ${result.riskResult.riskScore}`,
      `- Simulation count: ${result.riskResult.simulationCount || "N/A"}`,
    );
  }
  summaryLines.push(
    "",
    result.usedFallback
      ? "> **Note:** No live Nosana job was submitted. This is a local fallback or dry-run result."
      : "> **Note:** This is live Nosana evidence from a decentralized GPU workload.",
    "",
  );
  fs.writeFileSync(path.join(evidenceDir, "summary.md"), summaryLines.join("\n") + "\n", "utf8");

  let jobDefForArtifact = null;
  try {
    const histPath = path.join(here, "fixtures", "historical-delay-data.json");
    const historicalData = JSON.parse(fs.readFileSync(histPath, "utf8"));
    jobDefForArtifact = buildRiskJobDefinition(payload, historicalData);
  } catch {
    jobDefForArtifact = { error: "Could not rebuild job definition for audit trail" };
  }
  fs.writeFileSync(
    path.join(evidenceDir, "job-definition.json"),
    JSON.stringify({
      _label: result.usedFallback
        ? "LOCAL PREPARED DEFINITION — not submitted to Nosana"
        : "SUBMITTED DEFINITION — posted to Nosana network",
      _evidenceSource: result.evidenceSource,
      _containerImage: RISK_WORKLOAD_IMAGE,
      definition: jobDefForArtifact,
    }, null, 2) + "\n",
    "utf8",
  );

  // Summary
  console.error("");
  console.error("────────────────────────────────────────────────────────────────");
  console.error(`Evidence source:  ${result.evidenceSource}`);
  console.error(`Evidence label:   ${result.evidenceLabel}`);
  console.error(`Provider:         ${result.provider}`);
  console.error(`Fallback used:    ${result.usedFallback}`);
  console.error(`Latency:          ${result.latencyMs}ms`);
  if (result.jobMetadata) {
    console.error(`Job ID:           ${result.jobMetadata.jobId}`);
    console.error(`Market:           ${result.jobMetadata.market}`);
    console.error(`IPFS hash:        ${result.jobMetadata.ipfsHash}`);
    console.error(`Platform timeout: ${result.jobMetadata.platformTimeoutSec ?? "N/A"}s`);
    console.error(`Credits used:     ${result.jobMetadata.creditsUsed ?? "N/A"} (internal platform credits)`);
    console.error(`Cost USD:         ${result.jobMetadata.costUsd ?? "N/A"}`);
  }
  if (result.liveAttemptMetadata) {
    console.error(`── Live attempt metadata (fallback used, live data preserved) ──`);
    console.error(`  Job ID:         ${result.liveAttemptMetadata.jobId || "N/A"}`);
    console.error(`  Market:         ${result.liveAttemptMetadata.market || "N/A"}`);
    console.error(`  Credits used:   ${result.liveAttemptMetadata.creditsUsed ?? "N/A"} (internal platform credits)`);
    console.error(`  Cost USD:       ${result.liveAttemptMetadata.costUsd ?? "N/A"}`);
    console.error(`  Platform timeout: ${result.liveAttemptMetadata.platformTimeoutSec ?? "N/A"}s`);
  }
  console.error(`Risk band:        ${result.riskResult.riskBand}`);
  console.error(`Risk score:       ${result.riskResult.riskScore}`);
  console.error(`Simulations:      ${result.riskResult.simulationCount || "N/A"}`);
  console.error("────────────────────────────────────────────────────────────────");
  console.error("");
  console.error("Result written to:");
  console.error("  smoke-tests/nosana/results/nosana-risk-result.json");
  console.error("  app/public/nosana-risk-result.json");
  console.error(`  smoke-tests/nosana/results/${utcTimestamp}/ (result.json, summary.md, job-definition.json)`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exitCode = 1;
});
