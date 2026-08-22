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

const here = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(here, "results");
const RESULT_OUTPUT_PATH = path.join(RESULTS_DIR, "nosana-risk-result.json");
const APP_PUBLIC_DIR = path.join(here, "..", "..", "app", "public");

// ── Load NOSANA_API_KEY from .env.local if not already in env ──────────────

function loadEnvLocal() {
  const envLocalPath = path.join(here, "..", "..", ".env.local");
  if (process.env.NOSANA_API_KEY) return; // already set
  try {
    const content = fs.readFileSync(envLocalPath, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^NOSANA_API_KEY=(.+)$/);
      if (match) {
        process.env.NOSANA_API_KEY = match[1].trim();
        return;
      }
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
  }
  console.error(`Risk band:        ${result.riskResult.riskBand}`);
  console.error(`Risk score:       ${result.riskResult.riskScore}`);
  console.error(`Simulations:      ${result.riskResult.simulationCount || "N/A"}`);
  console.error("────────────────────────────────────────────────────────────────");
  console.error("");
  console.error("Result written to:");
  console.error("  smoke-tests/nosana/results/nosana-risk-result.json");
  console.error("  app/public/nosana-risk-result.json");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exitCode = 1;
});
