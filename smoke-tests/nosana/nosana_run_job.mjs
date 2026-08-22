// nosana_run_job.mjs — Nosana job submission helper for StitchCheck risk workload.
//
// Follows the verified three-step Nosana contract (ref: looPilot pattern):
//   1. Pin job definition to IPFS
//   2. Post job to the selected Nosana market
//   3. Poll until job.ipfsResult is set, then retrieve from IPFS
//
// This script shells out from the wrapper (nosana-risk-runner.mjs) and
// emits exactly ONE JSON line on stdout upon completion.
//
// SAFETY:
// - Reads NOSANA_API_KEY from env; NEVER prints it or includes it in output.
// - Reads NOSANA_MARKET from env (falls back to cheapest known market).
// - No PII is ever logged or included in output.
// - validateJobDefinition() runs locally before any submission.
//
// Usage:
//   node nosana_run_job.mjs --ipfs-hash <hash> --market <addr> --timeout <sec>
//
// The --ipfs-hash is the IPFS hash of the pinned job definition (produced
// separately by the wrapper). This script handles steps 2-3 (post + poll)
// and also re-pins if needed.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

// ── Constants ──────────────────────────────────────────────────────────────

// NOTE: This is a Solana base58 address. Format is valid, but the specific
// address needs live verification via a read-only markets call before any
// paid submission. Do NOT make that call without explicit human approval.
// Source: https://learn.nosana.com/api/markets.html
const DEFAULT_MARKET = "7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq"; // cheapest known market — UNVERIFIED against live API
// NOTE: Timeout is in SECONDS. The official SDK schema default is 3600
// seconds (1 hour). StitchCheck uses 120 seconds (2 minutes), which stays
// below the approved ceiling. Confirmed via:
// https://learn.nosana.com/api/jobs.html — timeout parameter in client.api.jobs.list()
export const DEFAULT_TIMEOUT_SEC = 120;
const POLL_INTERVAL_MS = 3000;

// ── Cost ceiling ────────────────────────────────────────────────────────────
//
// Hard ceiling on credits spent per job. If the post-submission creditsUsed
// exceeds this value, the result is flagged COST_CEILING_EXCEEDED. The job
// has already been posted at that point (the Nosana API does not offer a
// separate pre-flight cost estimate), but the flag ensures the caller
// treats the result as a safety violation rather than a normal outcome.
//
// Configurable via NOSANA_COST_CEILING_USD env var (default 10).
const DEFAULT_COST_CEILING_USD = 10;
function getCostCeilingUsd() {
  const envVal = process.env.NOSANA_COST_CEILING_USD;
  if (envVal !== undefined) {
    const parsed = parseFloat(envVal);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_COST_CEILING_USD;
}

// ── Job status helpers ─────────────────────────────────────────────────────

// Official job states (docs use lowercase strings): pending, running,
// completed, failed, stopped. Terminal states: completed, failed, stopped.
const TERMINAL_JOB_STATUSES = new Set(["completed", "failed", "stopped"]);
// Terminal states that end WITHOUT producing an ipfsResult.
const TERMINAL_WITHOUT_RESULT = new Set(["failed", "stopped"]);

/**
 * Normalises a job status payload to a lowercase status string.
 *
 * The SDK indexer types `state` as a number while `jobStatus` is the
 * human-readable string; docs use lowercase strings. We prefer `jobStatus`,
 * fall back to a string `state`, and return null when neither is usable.
 */
export function normalizeJobStatus(status) {
  if (!status || typeof status !== "object") return null;
  if (typeof status.jobStatus === "string" && status.jobStatus.length > 0) {
    return status.jobStatus.toLowerCase();
  }
  if (typeof status.state === "string" && status.state.length > 0) {
    return status.state.toLowerCase();
  }
  // Numeric `state` (indexer enum) carries no reliable mapping here;
  // terminal detection must not guess from it.
  return null;
}

/**
 * Deterministic terminal-state detection for the poll loop.
 *
 * Terminal when ANY of:
 *   - a result hash is already present (ipfsResult / result), or
 *   - the normalised status string is completed | failed | stopped.
 * `failed` / `stopped` are terminal-without-result: the loop exits promptly
 * and the caller surfaces a labelled failure instead of polling to deadline.
 */
export function isTerminalJobStatus(status) {
  if (!status || typeof status !== "object") return false;
  if (status.ipfsResult || status.result) return true;
  const label = normalizeJobStatus(status);
  return label !== null && TERMINAL_JOB_STATUSES.has(label);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const val = argv[i + 1];
    if (key) args[key] = val;
  }
  return args;
}

/**
 * Validates a Nosana job definition locally before submission.
 *
 * Aligns with the official Nosana Job Definition Schema (v0.1):
 *   - version: "0.1" (required)
 *   - type: "container" (required)
 *   - ops[]: non-empty array of operations (required)
 *   - ops[].id: unique string identifier (required)
 *   - ops[].type: "container/run" (required)
 *   - ops[].args.image: non-empty string (required)
 *   - ops[].args.cmd: non-empty string or array (required)
 *   - global.env: object; checked for PII-like keys (project-specific guard)
 *
 * Source: https://learn.nosana.com/deployments/jobs/job-definition/schema.html
 *
 * OFFLINE FALLBACK — this is NOT the official SDK validator.
 * When @nosana/kit is installed, prefer the official validateJobDefinition()
 * which returns { success: true, data: JobDefinition } on success, or
 * { success: false, errors: [{ path, expected, value }] } on failure.
 *
 * This local function mirrors that return shape for offline use:
 *   { success: boolean, data: object|null, errors: Array<{path,expected,value}> }
 *
 * Callers must check result.success (not result.valid) to align with the SDK.
 */
export function validateJobDefinition(jobDef) {
  const issues = [];
  if (!jobDef || typeof jobDef !== "object") {
    return {
      success: false,
      data: null,
      errors: [{ path: "$input", expected: "object", value: typeof jobDef }],
    };
  }

  // Required top-level fields per official schema
  if (jobDef.version !== "0.1") {
    issues.push({ path: "$input.version", expected: '"0.1"', value: jobDef.version });
  }
  if (jobDef.type !== "container") {
    issues.push({ path: "$input.type", expected: '"container"', value: jobDef.type });
  }
  if (!Array.isArray(jobDef.ops) || jobDef.ops.length === 0) {
    issues.push({ path: "$input.ops", expected: "non-empty array", value: jobDef.ops });
  } else {
    const seenIds = new Set();
    for (let i = 0; i < jobDef.ops.length; i++) {
      const op = jobDef.ops[i];
      const prefix = `$input.ops[${i}]`;

      if (!op.id || typeof op.id !== "string") {
        issues.push({ path: `${prefix}.id`, expected: "non-empty string", value: op.id });
      } else if (seenIds.has(op.id)) {
        issues.push({ path: `${prefix}.id`, expected: "unique", value: op.id });
      } else {
        seenIds.add(op.id);
      }

      if (op.type !== "container/run") {
        issues.push({ path: `${prefix}.type`, expected: '"container/run"', value: op.type });
      }

      if (!op.args || typeof op.args !== "object") {
        issues.push({ path: `${prefix}.args`, expected: "object", value: typeof op.args });
      } else {
        if (!op.args.image || typeof op.args.image !== "string") {
          issues.push({ path: `${prefix}.args.image`, expected: "non-empty string", value: op.args.image });
        }
        if (
          !op.args.cmd ||
          (typeof op.args.cmd !== "string" && !Array.isArray(op.args.cmd))
        ) {
          issues.push({ path: `${prefix}.args.cmd`, expected: "non-empty string or array", value: op.args.cmd });
        }
      }
    }
  }

  // PII guard on global.env (project-specific, not from SDK)
  const forbidden = [
    "apiKey", "api_key", "secret", "password", "token", "authorization",
    "bearer", "credential", "name", "firstName", "lastName", "email",
    "phone", "passenger", "bookingReference", "pnr", "payment", "cardNumber",
    "passport", "dateOfBirth", "address", "NOSANA_API_KEY",
  ];
  const envObj = jobDef.global?.env;
  if (envObj && typeof envObj === "object") {
    for (const key of Object.keys(envObj)) {
      if (forbidden.some((f) => f.toLowerCase() === key.toLowerCase())) {
        issues.push({ path: `$input.global.env.${key}`, expected: "no PII/secret keys", value: key });
      }
    }
  }

  return {
    success: issues.length === 0,
    data: issues.length === 0 ? jobDef : null,
    errors: issues,
  };
}

// ── Main: Three-step Nosana flow ───────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const market = args.market || process.env.NOSANA_MARKET || DEFAULT_MARKET;
  const timeoutSec = parseInt(args.timeout || String(DEFAULT_TIMEOUT_SEC), 10);
  const ipfsHash = args["ipfs-hash"];
  const jobDefJson = process.env.NOSANA_JOB_DEF; // wrapper passes serialised job def

  // Read API key from env — NEVER log it
  const apiKey = process.env.NOSANA_API_KEY;
  if (!apiKey) {
    emitError("NOSANA_API_KEY not set in environment", "MISSING_CREDENTIAL");
    return;
  }

  if (!ipfsHash && !jobDefJson) {
    emitError("Either --ipfs-hash or NOSANA_JOB_DEF env must be provided", "MISSING_INPUT");
    return;
  }

  // Validate job definition if provided inline
  let jobDef = null;
  if (jobDefJson) {
    try {
      jobDef = JSON.parse(jobDefJson);
    } catch {
      emitError("Invalid NOSANA_JOB_DEF JSON", "INVALID_JOB_DEF");
      return;
    }
    const validation = validateJobDefinition(jobDef);
    if (!validation.success) {
      emitError(
        `Job definition validation failed: ${validation.errors.map((e) => `${e.path}: expected ${e.expected}`).join("; ")}`,
        "VALIDATION_FAILED",
      );
      return;
    }
  }

  const submittedAt = Date.now();
  let nosanaClient;
  // Hoisted: the @nosana/kit namespace object, needed in both the SDK-init
  // block (try #1) and the idempotency-key generation (try #2, Step 2).
  let nosanaKit;

  // Hoisted so the catch block can safely reference them. NOTE: `job` is
  // block-scoped to main(); the SDK response object (fields: `job` address,
  // `credits.creditsUsed`) lives here, never the raw credential.
  let job = null;
  let jobId = null;
  let creditsUsed = null;
  // Track observed job states during polling for evidence metadata
  const observedStates = [];

  try {
    // Dynamic import — @nosana/kit must be installed before live execution.
    // Install with: npm install @nosana/kit
    // Official SDK initialisation pattern:
    //   https://learn.nosana.com/api/create-deployments.html
    // NOTE: Use the namespace object directly (no destructuring of SDK exports).
    // Two prior live failures were scope/reference errors — not undocumented SDK
    // behaviour — caused by block-scoped bindings becoming invisible across the
    // two try blocks in main(). Keeping nosanaKit as the single outer-scoped
    // namespace binding and accessing members at point of use eliminates this
    // entire class of cross-block binding mistake.
    nosanaKit = await import("@nosana/kit");

    // Optional export diagnostic (controlled by NOSANA_DEBUG_EXPORTS=1).
    // Prints export names and types to stderr ONLY. NEVER prints API keys,
    // idempotency-key values, job payload secrets, or wallet material.
    // Disabled by default. Must NOT be used during live submission.
    if (process.env.NOSANA_DEBUG_EXPORTS === "1") {
      console.error("── @nosana/kit export diagnostic ──");
      for (const [key, val] of Object.entries(nosanaKit)) {
        console.error(`  ${key}: ${typeof val}`);
      }
      console.error("── end export diagnostic ──");
    }

    // Defensive checks: abort with a clear error before attempting SDK use
    // if critical exports are missing or have unexpected types.
    if (typeof nosanaKit.createNosanaClient !== "function") {
      throw new Error("createNosanaClient export missing or not a function");
    }
    if (!nosanaKit.NosanaNetwork ||
        nosanaKit.NosanaNetwork.MAINNET === undefined) {
      throw new Error("NosanaNetwork.MAINNET export missing");
    }

    nosanaClient = nosanaKit.createNosanaClient(nosanaKit.NosanaNetwork.MAINNET, {
      api: { apiKey },
    });
  } catch (err) {
    emitError(
      `Failed to initialise Nosana SDK: ${err.message}`,
      "SDK_INIT_FAILED",
    );
    return;
  }

  let resolvedHash = ipfsHash;

  try {
    // ── Step 1: Pin job definition to IPFS (if not already pinned) ──────
    if (!resolvedHash && jobDef) {
      // Official: client.ipfs.pin() returns the IPFS hash string directly.
      // Safe compatibility fallback preserved for unexpected response shapes.
      const pinResult = await nosanaClient.ipfs.pin(jobDef);
      resolvedHash = typeof pinResult === "string" ? pinResult
        : (pinResult.hash || pinResult.IpfsHash || null);
      if (!resolvedHash) {
        emitError("IPFS pin returned no hash", "PIN_FAILED");
        return;
      }
    }

    // ── Step 2: Post job to market ──────────────────────────────────────
    // Idempotency key: generated once per submission so that a crash-and-retry
    // of the identical logical operation is de-duplicated by the API.
    // Prefer the SDK's generateIdempotencyKey via namespace property access;
    // fall back to crypto.randomUUID() if the export is unavailable.
    // NOTE: randomUUID() produces a syntactically valid UUID string, but whether
    // the Nosana API accepts it as an idempotency key is UNVERIFIED against the
    // live API or official SDK documentation.
    const _genIdem = typeof nosanaKit.generateIdempotencyKey === "function"
      ? nosanaKit.generateIdempotencyKey()
      : randomUUID();
    if (!_genIdem || typeof _genIdem !== "string") {
      emitError(
        "Idempotency key generation produced no value — aborting before submission",
        "IDEMPOTENCY_KEY_FAILED",
      );
      return;
    }
    const idempotencyKey = _genIdem;
    // NOTE: The second options argument ({ idempotencyKey }) follows the
    // pattern shown in the Nosana docs/examples, but this specific call
    // signature is UNVERIFIED against the live API. Preserved as-is.
    job = await nosanaClient.api.jobs.list({
      ipfsHash: resolvedHash,
      market,
      timeout: timeoutSec,
    }, { idempotencyKey });

    // Official response field: result.job (the job address).
    // See: https://learn.nosana.com/api/jobs.html — Post Job
    jobId = job.job || job.id || job.jobId;
    if (!jobId) {
      emitError("Job submission returned no job ID", "POST_FAILED");
      return;
    }

    // Capture creditsUsed from the post response for evidence metadata.
    // Declared here (before any timeout/error path) so it is never read
    // before initialisation.
    creditsUsed = job?.credits?.creditsUsed ?? null;

    // ── Cost ceiling check ────────────────────────────────────────────
    // If the job has already been posted and creditsUsed exceeds the
    // configured ceiling, flag it immediately. The job cannot be un-posted,
    // but the caller must treat this as a safety violation.
    const costCeilingUsd = getCostCeilingUsd();
    if (creditsUsed !== null && creditsUsed > costCeilingUsd) {
      emitResult({
        success: false,
        error: `Cost ceiling exceeded: creditsUsed ${creditsUsed} > ceiling ${costCeilingUsd} USD`,
        errorCode: "COST_CEILING_EXCEEDED",
        jobId,
        market,
        ipfsHash: resolvedHash,
        latencyMs: Date.now() - submittedAt,
        submittedAt: new Date(submittedAt).toISOString(),
        completedAt: new Date().toISOString(),
        observedStates: [...new Set(observedStates)],
        creditsUsed,
        costCeilingUsd,
      });
      return;
    }

    // ── Step 3: Poll until result is available ──────────────────────────
    const deadline = Date.now() + timeoutSec * 1000;
    let finalJob = null;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      try {
        const status = await nosanaClient.api.jobs.get(jobId);
        if (status) {
          const label = normalizeJobStatus(status);
          if (label !== null) observedStates.push(label);
        }
        // Terminal detection checks BOTH the string job status (jobStatus,
        // falling back to a string `state`) and ipfsResult/result presence.
        // failed/stopped exit the loop promptly as terminal-without-result.
        if (isTerminalJobStatus(status)) {
          finalJob = status;
          break;
        }
      } catch {
        // Polling error — continue retrying until deadline
      }
    }

    const completedAt = Date.now();
    const latencyMs = completedAt - submittedAt;

    if (!finalJob || (!finalJob.ipfsResult && !finalJob.result)) {
      // Distinguish a terminal failure (failed/stopped, or completed without
      // a result hash) from a genuine poll deadline. Both exit without a
      // result and never invent a score.
      const terminalLabel = normalizeJobStatus(finalJob);
      const isTerminalFailure =
        finalJob !== null &&
        (terminalLabel === null ||
          TERMINAL_WITHOUT_RESULT.has(terminalLabel) ||
          terminalLabel === "completed");
      emitResult({
        success: false,
        error: isTerminalFailure
          ? `Job ended in terminal state${terminalLabel ? ` "${terminalLabel}"` : ""} without producing a result`
          : "Job timed out waiting for result",
        errorCode: isTerminalFailure ? "JOB_TERMINAL_FAILURE" : "JOB_TIMEOUT",
        jobId,
        market,
        ipfsHash: resolvedHash,
        latencyMs,
        submittedAt: new Date(submittedAt).toISOString(),
        completedAt: new Date(completedAt).toISOString(),
        observedStates: [...new Set(observedStates)],
        creditsUsed: creditsUsed ?? null,
      });
      return;
    }

    // Retrieve result from IPFS
    const resultHash = finalJob.ipfsResult || finalJob.result;
    let jobOutput;
    try {
      // Official: client.ipfs.retrieve(hash) — not ipfs.get().
      // See: https://learn.nosana.com/kit/examples/jobs.html
      const rawResult = await nosanaClient.ipfs.retrieve(resultHash);
      // The container emits one JSON line on stdout
      const rawStr = typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult);
      const lines = rawStr.trim().split("\n");
      jobOutput = JSON.parse(lines[lines.length - 1]); // last line is the JSON result
    } catch (parseErr) {
      emitResult({
        success: false,
        error: `Failed to parse job output: ${parseErr.message}`,
        errorCode: "RESULT_PARSE_ERROR",
        jobId,
        market,
        ipfsHash: resolvedHash,
        latencyMs,
        submittedAt: new Date(submittedAt).toISOString(),
        completedAt: new Date(completedAt).toISOString(),
        observedStates: [...new Set(observedStates)],
        creditsUsed: creditsUsed ?? null,
      });
      return;
    }

    // Emit success — one JSON line on stdout
    emitResult({
      success: true,
      jobId,
      market,
      ipfsHash: resolvedHash,
      latencyMs,
      submittedAt: new Date(submittedAt).toISOString(),
      completedAt: new Date(completedAt).toISOString(),
      observedStates: [...new Set(observedStates)],
      creditsUsed: creditsUsed ?? null,
      output: jobOutput,
    });
  } catch (err) {
    const completedAt = Date.now();
    // creditsUsed is captured from the post response above (hoisted before
    // the try block); reading it here can never throw a TDZ/ReferenceError.
    emitResult({
      success: false,
      error: err.message || "Unknown Nosana job error",
      errorCode: "JOB_EXECUTION_ERROR",
      jobId: jobId || null,
      market,
      ipfsHash: resolvedHash || null,
      latencyMs: completedAt - submittedAt,
      submittedAt: new Date(submittedAt).toISOString(),
      completedAt: new Date(completedAt).toISOString(),
      observedStates: [...new Set(observedStates)],
      creditsUsed: creditsUsed ?? null,
    });
  }
}

// ── Output helpers ─────────────────────────────────────────────────────────

function emitResult(obj) {
  // Emit exactly one JSON line on stdout — the wrapper parses this.
  // NEVER include NOSANA_API_KEY or any credential in output.
  console.log(JSON.stringify(obj));
}

function emitError(message, errorCode) {
  emitResult({ success: false, error: message, errorCode });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Run ────────────────────────────────────────────────────────────────────

// Only run main() when this file is executed directly (not when imported)
const _isDirectMain = process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (_isDirectMain) {
  main().catch((err) => {
    emitError(err.message || "Unhandled error in nosana_run_job.mjs", "UNHANDLED_ERROR");
  });
}
