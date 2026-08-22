// nosana-risk-runner.mjs — Wrapper for the StitchCheck Nosana risk workload.
//
// This module orchestrates the full risk-workload lifecycle:
//   1. Build a minimal container job definition (Python risk script + env vars).
//   2. Validate locally with validateJobDefinition() before submission.
//   3. Pin the definition to IPFS and submit via nosana_run_job.mjs.
//   4. Parse the structured result from the child process stdout.
//   5. On ANY failure, fall back to a local heuristic calculation.
//
// SAFETY:
// - NOSANA_API_KEY is read from env and passed to the child process ONLY.
//   It is NEVER printed, logged, or included in any output or result file.
// - The result is labelled "nosana-evidence" ONLY when the remote job succeeds.
// - On failure, the result is labelled "local-fallback" with an explicit
//   user-visible message: "Nosana unavailable — local fallback used; not Nosana evidence."
// - No PII is ever included in inputs, outputs, or logs.
// - No Atlas booking/payment/ticketing behaviour is modified.
//
// Returns:
//   { success, output, latencyMs, tierUsed, provider, usedFallback,
//     jobMetadata, riskResult, evidenceSource, evidenceLabel }

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJobDefinition } from "./nosana_run_job.mjs";
import {
  PLACEHOLDER_LABEL,
  HEURISTIC_DISCLAIMER,
  validateRiskRequest,
  validateRiskResult,
} from "./schema-validator.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const HISTORICAL_DATA_PATH = path.join(here, "fixtures", "historical-delay-data.json");
const RESULT_OUTPUT_PATH = path.join(here, "results", "nosana-risk-result.json");

const FALLBACK_MESSAGE =
  "Nosana unavailable — local fallback used; not Nosana evidence.";
const NOSANA_EVIDENCE_LABEL =
  "Nosana evidence — remote job succeeded; result from decentralized GPU workload.";

// ── Python risk script (runs inside the Nosana container) ──────────────────
//
// This script is embedded in the job definition's command field.
// It reads RISK_INPUT_DATA from env, computes a heuristic risk score,
// and emits one JSON line on stdout.
//
// The script uses only Python stdlib (json, os, sys, math, random), which is
// compatible with the Ubuntu/Python-based TensorFlow image below.
// Container image: docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter
// (verified present in the target market's required_images allowlist;
// the previous python:3.12-slim image was NOT allowlisted).

const PYTHON_RISK_SCRIPT = [
  "import json, os, sys, math, random",
  "",
  "random.seed(42)",
  "",
  "data = json.loads(os.environ['RISK_INPUT_DATA'])",
  "hist = json.loads(os.environ['HISTORICAL_DELAY_DATA'])",
  "",
  "conn_min = data['connectionDurationMinutes']",
  "conn_apt = data['connectionAirport']",
  "origin = data['origin']",
  "dest = data['destination']",
  "",
  "apt = hist.get('airports', {}).get(conn_apt, {})",
  "avg_delay = apt.get('avgDelayMinutes', 20)",
  "on_time = apt.get('onTimeRate', 0.75)",
  "tight_rate = apt.get('tightConnectionRate', 0.25)",
  "sample = apt.get('sampleSize', 500)",
  "",
  "route = None",
  "for r in hist.get('routes', []):",
  "    if r['origin'] == origin and r['connection'] == conn_apt:",
  "        route = r",
  "        break",
  "miss_rate = route['avgMissRate'] if route else 0.20",
  "",
  "n_sims = min(1000, max(100, sample))",
  "tight_count = 0",
  "for _ in range(n_sims):",
  "    d = max(0, random.gauss(avg_delay, avg_delay * 0.4))",
  "    remaining = conn_min - d",
  "    if remaining < 45:",
  "        tight_count += 1",
  "",
  "tight_ratio = tight_count / n_sims",
  "risk_score = round(min(1.0, max(0.0, miss_rate * 0.6 + tight_ratio * 0.4)), 4)",
  "",
  "if risk_score < 0.25:",
  "    band = 'low'",
  "elif risk_score < 0.55:",
  "    band = 'medium'",
  "else:",
  "    band = 'high'",
  "",
  "result = {",
  "    'riskScore': risk_score,",
  "    'riskBand': band,",
  "    'assumptions': [",
  "        'Historical average delay at %s: %d min' % (conn_apt, avg_delay),",
  "        'On-time rate: %.2f' % on_time,",
  "        'Route miss rate: %.2f' % miss_rate,",
  "        'Monte Carlo simulations: %d' % n_sims,",
  "    ],",
  "    'simulationCount': n_sims,",
  "    'explanation': (",
  "        'A %d-minute connection at %s was evaluated against %d historical records. '",
  "        'Monte Carlo simulation (%d runs) estimated a %.1f%% probability of tight connection. '",
  "        'Combined with route miss rate, the heuristic risk score is %.4f (%s band). '",
  "        'This is a heuristic indication only — not a prediction or guarantee.'",
  "    ) % (conn_min, conn_apt, sample, n_sims, tight_ratio * 100, risk_score, band),",
  "}",
  "",
  "print(json.dumps(result))",
].join("\n");

// Exported for offline portability testing (no network involved).
export { PYTHON_RISK_SCRIPT };

// Fully qualified image string, verified in the market required_images
// allowlist. Used verbatim — do not shorten or re-tag.
export const RISK_WORKLOAD_IMAGE = "docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter";

// ── Job Definition Builder ─────────────────────────────────────────────────

/**
 * Builds the Nosana container job definition for the risk workload.
 *
 * Matches the official Nosana Job Definition Schema (v0.1):
 *   - version: "0.1" (required)
 *   - type: "container" (required)
 *   - ops[]: ordered operations with id, type, args (required)
 *   - meta: metadata (optional)
 *   - global.env: environment variables available to all ops (optional)
 *
 * Source: https://learn.nosana.com/deployments/jobs/job-definition/schema.html
 *
 * The Python script is passed via a heredoc in the container cmd.
 * Input data is passed via global.env (available to all ops).
 */
export function buildRiskJobDefinition(itineraryPayload, historicalData) {
  const inputJson = JSON.stringify(itineraryPayload);
  const histJson = JSON.stringify(historicalData);

  // Build the shell command:
  // python3 << 'PYEOF' runs the Python script from stdin (heredoc).
  // The env vars RISK_INPUT_DATA and HISTORICAL_DELAY_DATA are set by
  // the Nosana container runtime from global.env.
  const command = "python3 << 'PYEOF'\n" + PYTHON_RISK_SCRIPT + "\nPYEOF";

  const jobDef = {
    version: "0.1",
    type: "container",
    ops: [
      {
        id: "stitchcheck-risk-calc",
        type: "container/run",
        args: {
          // VERIFIED: this exact fully-qualified image string is in the target
          // market's required_images allowlist. Used verbatim — no env override,
          // no re-tagging, so submissions can never reference a non-allowlisted image.
          image: RISK_WORKLOAD_IMAGE,
          cmd: command,
        },
      },
    ],
  // Only permitted meta keys per official Nosana job definition schema:
  //   trigger: "cli" | "dashboard" | "api" | "deployment-manager"
  //   system_resources: Record<string, string|number>
  // See: https://learn.nosana.com/deployments/jobs/job-definition/schema.html
  // Custom metadata (workload, version, syntheticDemo, nonPiiDeclaration)
  // must NOT be placed inside the official job definition's meta object.
    meta: {
      trigger: "api",
    },
    global: {
      env: {
        RISK_INPUT_DATA: inputJson,
        HISTORICAL_DELAY_DATA: histJson,
      },
    },
  };

  return jobDef;
}

// ── Local Fallback Risk Calculation ────────────────────────────────────────

/**
 * Local heuristic risk calculation — used when Nosana is unavailable.
 * Mirrors the Python container logic but runs in Node.js.
 */
export function localRiskCalculation(itineraryPayload, historicalData) {
  const connMin = itineraryPayload.connectionDurationMinutes;
  const connApt = itineraryPayload.connectionAirport;
  const origin = itineraryPayload.origin;

  const apt = (historicalData.airports || {})[connApt] || {};
  const avgDelay = apt.avgDelayMinutes || 20;
  const onTimeRate = apt.onTimeRate || 0.75;
  const tightConnectionRate = apt.tightConnectionRate || 0.25;
  const sampleSize = apt.sampleSize || 500;

  // Find matching route
  const route = (historicalData.routes || []).find(
    (r) => r.origin === origin && r.connection === connApt,
  );
  const missRate = route ? route.avgMissRate : 0.20;

  // Deterministic Monte Carlo (seeded pseudo-random for reproducibility)
  const nSims = Math.min(1000, Math.max(100, sampleSize));
  let tightCount = 0;
  // Simple seeded PRNG (mulberry32)
  let seed = 42;
  function seededRandom() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // Simple Box-Muller for gaussian
  function gaussianRandom(mean, stddev) {
    const u1 = seededRandom();
    const u2 = seededRandom();
    const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  }

  for (let i = 0; i < nSims; i++) {
    const delay = Math.max(0, gaussianRandom(avgDelay, avgDelay * 0.4));
    const remaining = connMin - delay;
    if (remaining < 45) tightCount++;
  }

  const tightRatio = tightCount / nSims;
  const riskScore = Math.round(
    Math.min(1.0, Math.max(0.0, missRate * 0.6 + tightRatio * 0.4)) * 10000,
  ) / 10000;

  let riskBand;
  if (riskScore < 0.25) riskBand = "low";
  else if (riskScore < 0.55) riskBand = "medium";
  else riskBand = "high";

  return {
    riskScore,
    riskBand,
    assumptions: [
      `Historical average delay at ${connApt}: ${avgDelay} min`,
      `On-time rate: ${onTimeRate.toFixed(2)}`,
      `Route miss rate: ${missRate.toFixed(2)}`,
      `Monte Carlo simulations: ${nSims}`,
    ],
    simulationCount: nSims,
    explanation:
      `A ${connMin}-minute connection at ${connApt} was evaluated against ` +
      `${sampleSize} historical records. Monte Carlo simulation (${nSims} runs) ` +
      `estimated a ${(tightRatio * 100).toFixed(1)}% probability of tight connection. ` +
      `Combined with route miss rate, the heuristic risk score is ${riskScore.toFixed(4)} ` +
      `(${riskBand} band). This is a heuristic indication only — not a prediction or guarantee.`,
  };
}

// ── Main Runner ────────────────────────────────────────────────────────────

/**
 * Runs the Nosana risk workload with full fallback chain.
 *
 * @param {Object} itineraryPayload - Non-PII itinerary fields
 * @param {Object} [options] - { timeoutMs, market, skipNosana }
 * @returns {Object} Structured result with evidence labelling
 */
export async function runNosanaRiskWorkload(itineraryPayload, options = {}) {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs || 120000;
  const market = options.market || process.env.NOSANA_MARKET || "7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq";
  const skipNosana = options.skipNosana === true;
  const dryRun = options.dryRun !== false; // default TRUE — must explicitly set false for live

  // Load historical data
  let historicalData;
  try {
    historicalData = JSON.parse(fs.readFileSync(HISTORICAL_DATA_PATH, "utf8"));
  } catch (err) {
    return buildFallbackResult(
      itineraryPayload,
      startedAt,
      "HISTORICAL_DATA_MISSING",
      `Historical delay data not found: ${err.message}`,
    );
  }

  // Validate the input payload
  const inputValidation = validateRiskRequest(itineraryPayload);
  if (!inputValidation.valid) {
    return buildFallbackResult(
      itineraryPayload,
      startedAt,
      "INVALID_INPUT",
      `Input validation failed: ${inputValidation.issues.join("; ")}`,
    );
  }

  // Build and validate the job definition
  const jobDef = buildRiskJobDefinition(itineraryPayload, historicalData);
  const jobValidation = validateJobDefinition(jobDef);
  if (!jobValidation.success) {
    return buildFallbackResult(
      itineraryPayload,
      startedAt,
      "JOB_DEF_INVALID",
      `Job definition validation failed: ${jobValidation.errors.map((e) => `${e.path}: expected ${e.expected}`).join("; ")}`,
    );
  }

  // If skipNosana is set (e.g., SDK not installed, or demo mode), go straight to fallback
  if (skipNosana || !process.env.NOSANA_API_KEY) {
    const localResult = localRiskCalculation(itineraryPayload, historicalData);
    return buildLocalResult(itineraryPayload, localResult, startedAt, "NOSANA_SKIPPED");
  }

  // ── Dry-run mode (DEFAULT) ──────────────────────────────────────────────
  // Build and validate the job definition, print what would be submitted,
  // but do NOT call the child process (no IPFS pin, no job post, no credits).
  if (dryRun) {
    return buildDryRunResult(itineraryPayload, jobDef, market, startedAt);
  }

  // Attempt real Nosana submission via child process
  try {
    const childResult = await runNosanaChildProcess(jobDef, market, timeoutMs);

    if (childResult.success && childResult.output) {
      // Validate the raw output structure from Nosana
      const outputValidation = validateNosanaOutput(childResult.output);
      if (!outputValidation.valid) {
        return buildFallbackResult(
          itineraryPayload,
          startedAt,
          "OUTPUT_INVALID",
          `Nosana output validation failed: ${outputValidation.issues.join("; ")}`,
        );
      }

      // Build the risk result from Nosana output
      const latencyMs = Date.now() - startedAt;
      const riskResult = buildRiskResultFromNosana(
        itineraryPayload,
        childResult.output,
        childResult.jobId,
        latencyMs,
      );

      // Validate the built risk result with validateRiskResult() before
      // claiming Nosana evidence. If validation fails, use local fallback.
      const riskValidation = validateRiskResult(riskResult);
      if (!riskValidation.valid) {
        const localResult = localRiskCalculation(itineraryPayload, safeLoadHistoricalData());
        return buildLocalResult(itineraryPayload, localResult, startedAt, "RISK_RESULT_INVALID");
      }

      // SUCCESS — validated Nosana evidence
      return {
        success: true,
        provider: "nosana/job",
        tierUsed: "cheap",
        usedFallback: false,
        evidenceSource: "nosana-evidence",
        evidenceLabel: NOSANA_EVIDENCE_LABEL,
        latencyMs,
        jobMetadata: {
          jobId: childResult.jobId,
          market,
          ipfsHash: childResult.ipfsHash,
          submittedAt: childResult.submittedAt,
          completedAt: childResult.completedAt,
          observedStates: childResult.observedStates || [],
          creditsUsed: childResult.creditsUsed ?? null,
          containerImage: jobDef.ops?.[0]?.args?.image || RISK_WORKLOAD_IMAGE,
        },
        riskResult,
        output: childResult.output,
      };
    }

    // Child process returned failure
    return buildFallbackResult(
      itineraryPayload,
      startedAt,
      childResult.errorCode || "JOB_FAILED",
      childResult.error || "Nosana job failed without specific error",
    );
  } catch (err) {
    return buildFallbackResult(
      itineraryPayload,
      startedAt,
      "CHILD_PROCESS_ERROR",
      err.message || "Unknown error running Nosana child process",
    );
  }
}

// ── Child Process ──────────────────────────────────────────────────────────

function runNosanaChildProcess(jobDef, market, timeoutMs) {
  return new Promise((resolve, reject) => {
    const jobDefJson = JSON.stringify(jobDef);
    const helperPath = path.join(here, "nosana_run_job.mjs");

    const child = spawn("node", [helperPath, "--market", market, "--timeout", String(Math.floor(timeoutMs / 1000))], {
      env: {
        ...process.env,
        NOSANA_JOB_DEF: jobDefJson,
        // NOSANA_API_KEY is already in process.env — child inherits it
        // NEVER add it to any log or output
      },
      stdio: ["pipe", "pipe", "pipe"],
      timeout: timeoutMs + 5000, // slightly longer than the job timeout
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    // NEVER log stderr content that might contain credentials
    child.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(`nosana_run_job.mjs exited with code ${code}`));
        return;
      }
      try {
        // Parse the last non-empty line of stdout as JSON
        const lines = stdout.trim().split("\n").filter((l) => l.trim());
        const lastLine = lines[lines.length - 1];
        const result = JSON.parse(lastLine);
        resolve(result);
      } catch (parseErr) {
        reject(new Error(`Failed to parse nosana_run_job output: ${parseErr.message}`));
      }
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

// ── Result Builders ────────────────────────────────────────────────────────

function buildRiskResultFromNosana(itineraryPayload, nosanaOutput, jobId, latencyMs) {
  return {
    correlationId: itineraryPayload.correlationId,
    workloadStatus: "completed",
    jobOrServiceReference: jobId,
    riskBand: nosanaOutput.riskBand,
    riskScore: nosanaOutput.riskScore,
    heuristicDisclaimer: `${HEURISTIC_DISCLAIMER} ${NOSANA_EVIDENCE_LABEL}`,
    failureCascadeExplanation: nosanaOutput.explanation,
    datasetVersion: itineraryPayload.staticHistoricalDatasetVersion,
    fallbackUsed: false,
    errorCode: null,
    errorMessage: null,
    // Extended fields for evidence tracking
    evidenceSource: "nosana-evidence",
    evidenceLabel: NOSANA_EVIDENCE_LABEL,
    simulationCount: nosanaOutput.simulationCount,
    assumptions: nosanaOutput.assumptions,
    latencyMs,
  };
}

function buildLocalResult(itineraryPayload, localOutput, startedAt, reason) {
  const latencyMs = Date.now() - startedAt;
  return {
    success: true,
    provider: "local-fallback",
    tierUsed: "local",
    usedFallback: true,
    evidenceSource: "local-fallback",
    evidenceLabel: FALLBACK_MESSAGE,
    latencyMs,
    jobMetadata: null,
    riskResult: {
      correlationId: itineraryPayload.correlationId,
      workloadStatus: "completed",
      jobOrServiceReference: null,
      riskBand: localOutput.riskBand,
      riskScore: localOutput.riskScore,
      heuristicDisclaimer: `${HEURISTIC_DISCLAIMER} ${PLACEHOLDER_LABEL}`,
      failureCascadeExplanation: localOutput.explanation,
      datasetVersion: itineraryPayload.staticHistoricalDatasetVersion,
      fallbackUsed: true,
      errorCode: null,
      errorMessage: null,
      evidenceSource: "local-fallback",
      evidenceLabel: FALLBACK_MESSAGE,
      simulationCount: localOutput.simulationCount,
      assumptions: localOutput.assumptions,
      latencyMs,
      fallbackReason: reason,
    },
    output: localOutput,
  };
}

function buildFallbackResult(itineraryPayload, startedAt, errorCode, errorMessage) {
  const localOutput = localRiskCalculation(
    itineraryPayload,
    safeLoadHistoricalData(),
  );
  const result = buildLocalResult(itineraryPayload, localOutput, startedAt, errorCode);
  result.riskResult.errorCode = errorCode;
  result.riskResult.errorMessage = errorMessage;
  result.riskResult.fallbackUsed = true;
  result.usedFallback = true;
  return result;
}

/**
 * Builds a dry-run result — the job definition is fully built and validated
 * but NOT submitted. No IPFS pin, no job post, no credits spent.
 * The result includes the full job definition payload for inspection.
 */
function buildDryRunResult(itineraryPayload, jobDef, market, startedAt) {
  const latencyMs = Date.now() - startedAt;
  const localOutput = localRiskCalculation(itineraryPayload, safeLoadHistoricalData());

  // Redact any sensitive values from the job definition for display
  const redactedDef = JSON.parse(JSON.stringify(jobDef));
  // (The job def should not contain secrets, but we redact env blobs
  // partially for safety in logs)
  if (redactedDef.global?.env) {
    for (const key of Object.keys(redactedDef.global.env)) {
      const val = redactedDef.global.env[key];
      if (typeof val === "string" && val.length > 80) {
        redactedDef.global.env[key] = val.slice(0, 40) + "…[redacted]…" + val.slice(-20);
      }
    }
  }

  console.error("\n═══ DRY-RUN MODE ═══");
  console.error("The following job definition WOULD be submitted to Nosana:");
  console.error(`Market: ${market}`);
  console.error(`Timeout: 120 seconds`);
  console.error(`Image: ${RISK_WORKLOAD_IMAGE}`);
  console.error(`Job definition (redacted):`);
  console.error(JSON.stringify(redactedDef, null, 2));
  console.error("═══ END DRY-RUN ═══\n");

  return {
    success: true,
    provider: "dry-run",
    tierUsed: "none",
    usedFallback: true,
    evidenceSource: "dry-run",
    evidenceLabel: "Dry-run mode — job definition built and validated but NOT submitted to Nosana.",
    latencyMs,
    jobMetadata: {
      jobId: null,
      market,
      ipfsHash: null,
      submittedAt: null,
      completedAt: null,
      observedStates: [],
      creditsUsed: null,
      containerImage: RISK_WORKLOAD_IMAGE,
      dryRunPayload: redactedDef,
    },
    riskResult: {
      correlationId: itineraryPayload.correlationId,
      workloadStatus: "completed",
      jobOrServiceReference: null,
      riskBand: localOutput.riskBand,
      riskScore: localOutput.riskScore,
      heuristicDisclaimer: `${HEURISTIC_DISCLAIMER} ${PLACEHOLDER_LABEL}`,
      failureCascadeExplanation: localOutput.explanation,
      datasetVersion: itineraryPayload.staticHistoricalDatasetVersion,
      fallbackUsed: true,
      errorCode: null,
      errorMessage: null,
      evidenceSource: "dry-run",
      evidenceLabel: "Dry-run mode — job definition built and validated but NOT submitted to Nosana.",
      simulationCount: localOutput.simulationCount,
      assumptions: localOutput.assumptions,
      latencyMs,
      fallbackReason: "DRY_RUN",
    },
    output: localOutput,
  };
}

function safeLoadHistoricalData() {
  try {
    return JSON.parse(fs.readFileSync(HISTORICAL_DATA_PATH, "utf8"));
  } catch {
    return { airports: {}, routes: [] };
  }
}

function validateNosanaOutput(output) {
  const issues = [];
  if (!output || typeof output !== "object") {
    return { valid: false, issues: ["output must be an object"] };
  }
  if (typeof output.riskScore !== "number" || output.riskScore < 0 || output.riskScore > 1) {
    issues.push("riskScore must be a number between 0 and 1");
  }
  if (!["low", "medium", "high"].includes(output.riskBand)) {
    issues.push("riskBand must be low, medium, or high");
  }
  if (!Array.isArray(output.assumptions)) {
    issues.push("assumptions must be an array");
  }
  if (typeof output.simulationCount !== "number" || output.simulationCount < 1) {
    issues.push("simulationCount must be a positive number");
  }
  if (typeof output.explanation !== "string" || output.explanation.length < 10) {
    issues.push("explanation must be a non-empty string");
  }
  return { valid: issues.length === 0, issues };
}

// ── CLI Entry Point ────────────────────────────────────────────────────────

async function runCli() {
  const isMain = process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  if (!isMain) return;

  console.error("StitchCheck Nosana Risk Runner");
  console.error(`Disclaimer: ${HEURISTIC_DISCLAIMER}`);
  console.error(`Label: ${PLACEHOLDER_LABEL}`);
  console.error("");

  // Default itinerary payload (non-PII, synthetic)
  const defaultPayload = {
    correlationId: "nosana-risk-run-" + Date.now(),
    origin: "AAA",
    connectionAirport: "BBB",
    destination: "CCC",
    connectionDurationMinutes: 75,
    staticHistoricalDatasetVersion: "hist-delay-v1",
    syntheticDemo: true,
    nonPiiDeclaration: true,
  };

  // Check for --skip-nosana flag (demo/fallback mode)
  const skipNosana = process.argv.includes("--skip-nosana");
  // Dry-run is the default; --live disables it
  const dryRun = !process.argv.includes("--live");

  const result = await runNosanaRiskWorkload(defaultPayload, {
    skipNosana: skipNosana || !process.env.NOSANA_API_KEY,
    dryRun,
  });

  // Write result to results/ directory
  const resultsDir = path.join(here, "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(
    RESULT_OUTPUT_PATH,
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  // Also write to app/public/ for the React dev server to serve
  const appPublicDir = path.join(here, "..", "..", "app", "public");
  fs.mkdirSync(appPublicDir, { recursive: true });
  fs.writeFileSync(
    path.join(appPublicDir, "nosana-risk-result.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  // Write timestamped evidence artifacts when this is a live Nosana result.
  // For offline/fallback mode, write a labelled local definition only.
  const utcTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evidenceDir = path.join(resultsDir, utcTimestamp);
  fs.mkdirSync(evidenceDir, { recursive: true });

  // Always write result.json
  fs.writeFileSync(
    path.join(evidenceDir, "result.json"),
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  // Write summary.md
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
      ``,
      `## Job Metadata`,
      ``,
      `- Job ID: ${result.jobMetadata.jobId}`,
      `- Market: ${result.jobMetadata.market}`,
      `- IPFS hash: ${result.jobMetadata.ipfsHash}`,
      `- Observed states: ${(result.jobMetadata.observedStates || []).join(", ") || "N/A"}`,
      `- Credits used: ${result.jobMetadata.creditsUsed ?? "N/A"}`,
    );
  }
  if (result.riskResult) {
    summaryLines.push(
      ``,
      `## Risk Result`,
      ``,
      `- Risk band: ${result.riskResult.riskBand}`,
      `- Risk score: ${result.riskResult.riskScore}`,
      `- Simulation count: ${result.riskResult.simulationCount || "N/A"}`,
    );
  }
  summaryLines.push(
    "",
    result.usedFallback
      ? "> **Note:** No live Nosana job was submitted. This is a local fallback result."
      : "> **Note:** This is live Nosana evidence from a decentralized GPU workload.",
    "",
  );
  fs.writeFileSync(
    path.join(evidenceDir, "summary.md"),
    summaryLines.join("\n") + "\n",
    "utf8",
  );

  // Write job-definition.json — labelled by execution mode
  const jobDefForArtifact = buildRiskJobDefinition(
    defaultPayload,
    safeLoadHistoricalData(),
  );
  const jobDefArtifact = {
    _label: result.usedFallback
      ? "LOCAL PREPARED DEFINITION — not submitted to Nosana"
      : "SUBMITTED DEFINITION — posted to Nosana network",
    _evidenceSource: result.evidenceSource,
    definition: jobDefForArtifact,
  };
  fs.writeFileSync(
    path.join(evidenceDir, "job-definition.json"),
    JSON.stringify(jobDefArtifact, null, 2) + "\n",
    "utf8",
  );

  console.error(`Result written to ${path.relative(here, RESULT_OUTPUT_PATH)}`);
  console.error(`Evidence source: ${result.evidenceSource}`);
  console.error(`Evidence label: ${result.evidenceLabel}`);
  console.error(`Latency: ${result.latencyMs}ms`);
  console.error(`Fallback used: ${result.usedFallback}`);
  console.error(`Evidence artifacts: ${path.relative(here, evidenceDir)}/`);

  // Print the result JSON to stdout for piping
  console.log(JSON.stringify(result, null, 2));
}

// Only run CLI when this file is executed directly (not when imported)
const _isDirectMain = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (_isDirectMain) {
  runCli();
}

export default runNosanaRiskWorkload;
