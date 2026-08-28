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
import { resolve, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { validateNosanaOutput } from "./schema-validator.mjs";

const here = dirname(fileURLToPath(import.meta.url));

// ── Constants ──────────────────────────────────────────────────────────────

// NOTE: This is a Solana base58 address. Format is valid, but the specific
// address needs live verification via a read-only markets call before any
// paid submission. Do NOT make that call without explicit human approval.
// Source: https://learn.nosana.com/api/markets.html
const DEFAULT_MARKET = "7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq"; // cheapest known market — UNVERIFIED against live API
// NOTE: Timeout is in SECONDS. The Nosana platform requires a minimum of
// 3600 seconds for credit-paid jobs. Using the minimum accepted platform
// value. The workload itself (Python risk script) completes in seconds,
// but the platform enforces this as the job execution timeout.
// Ref: platform rejection at 120s — "Credit-paid jobs must have a timeout
// of at least 3600 seconds."
export const DEFAULT_TIMEOUT_SEC = 3600;

// Local watchdog — separate from the platform job timeout.
// This is the maximum wall-clock time the local poll loop will observe
// before declaring a local timeout. The workload is expected to complete
// in seconds; this watchdog prevents the runner from hanging indefinitely
// if the platform or network becomes unresponsive.
// 180 seconds (3 minutes) — generous for a seconds-long workload, but
// bounded so the process cannot hang for the full platform timeout.
export const LOCAL_WATCHDOG_TIMEOUT_MS = 180000;

const POLL_INTERVAL_MS = 3000;

// Poll interval is configurable ONLY for offline tests with a fake SDK
// (keeps spawned-child tests fast). Live runs use the default.
function getPollIntervalMs() {
  const envVal = process.env.NOSANA_POLL_INTERVAL_MS;
  if (envVal !== undefined) {
    const parsed = parseInt(envVal, 10);
    if (Number.isFinite(parsed) && parsed >= 10) return parsed;
  }
  return POLL_INTERVAL_MS;
}

// ── Cost ceiling ────────────────────────────────────────────────────────────
//
// Hard ceiling on USD cost per job. The Nosana API response includes two
// separate fields in `credits`:
//   - `costUSD` (number): the actual USD cost — THIS is compared against
//     the ceiling.
//   - `creditsUsed` (number): internal platform credit count — preserved
//     as metadata but NEVER compared against a USD ceiling.
//
// If `costUSD` is absent from the response, the result is flagged
// COST_METADATA_MISSING (the job has already been posted, but we cannot
// verify the cost). `creditsUsed` alone is NOT sufficient for the check.
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

/**
 * Pull creditsUsed from a poll/status payload when present.
 * Never invents a number; returns null when the field is absent.
 */
export function extractCreditsUsedFromStatus(status) {
  if (!status || typeof status !== "object") return null;
  if (typeof status.creditsUsed === "number") return status.creditsUsed;
  const credits = status.credits;
  if (credits && typeof credits === "object" && typeof credits.creditsUsed === "number") {
    return credits.creditsUsed;
  }
  return null;
}

// ── Job-post response normalization ────────────────────────────────────────
//
// Verified SDK contract (@nosana/kit 2.7.5, @nosana/api client-manager schema):
//   jobs post → CreateJobWithCreditsResponse:
//     { tx: string, job: string, run: string,
//       credits: { costUSD: number, creditsUsed: number,
//                  reservationId: string, project: string } }
// The documented job-ID field is `response.job`. `response.id` and
// `response.jobId` do NOT exist in the typed response; they are read only as
// safe compatibility fallbacks in case the runtime shape ever drifts.

/**
 * Produces a sanitized structural description of a response object:
 * key names and value types ONLY — never values. Safe for stderr/debug
 * output and evidence artifacts (cannot leak secrets, addresses are
 * values and are therefore excluded).
 */
export function describeShape(value, depth = 0) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (typeof value !== "object") return typeof value;
  if (depth >= 2) return "object";
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = describeShape(v, depth + 1);
  }
  return out;
}

/**
 * Normalizes the job-post response into a stable internal shape.
 *
 * Extraction order for the job ID:
 *   1. response.job        (documented field — verified in SDK types)
 *   2. response.id         (compatibility only)
 *   3. response.jobId      (compatibility only)
 *   4. response.data?.job  (compatibility only)
 *   5. response.result?.job (compatibility only)
 *
 * Rules:
 *   - NEVER invents a job ID.
 *   - Two different non-empty ID values → AMBIGUOUS_JOB_ID (rejected).
 *   - The SAME value appearing in multiple fields is NOT ambiguous.
 *   - No usable ID → NO_JOB_ID (rejected before any polling).
 *
 * Returns:
 *   { ok: true, jobId, jobIdField, creditsUsed, costUsd, reservationId,
 *     project, responseKeys, rawShape }
 *   { ok: false, errorCode, error, responseKeys, rawShape }
 */
export function normalizeJobPostResponse(response) {
  const isObj = response !== null && typeof response === "object" && !Array.isArray(response);
  const responseKeys = isObj ? Object.keys(response) : [];
  const rawShape = describeShape(response);

  if (!isObj) {
    return {
      ok: false,
      errorCode: "POST_NO_JOB_ID",
      error: `Job-post response is not an object (got ${Array.isArray(response) ? "array" : typeof response})`,
      responseKeys,
      rawShape,
    };
  }

  const candidates = [];
  const pushCandidate = (field, value) => {
    if (typeof value === "string" && value.trim().length > 0) {
      candidates.push({ field, value: value.trim() });
    }
  };
  pushCandidate("job", response.job);
  pushCandidate("id", response.id);
  pushCandidate("jobId", response.jobId);
  pushCandidate("data.job", response.data?.job);
  pushCandidate("result.job", response.result?.job);

  const distinctIds = [...new Set(candidates.map((c) => c.value))];
  if (distinctIds.length === 0) {
    return {
      ok: false,
      errorCode: "NO_JOB_ID",
      error: `Job-post response contains no usable job ID (looked for: job, id, jobId, data.job, result.job; top-level keys: ${responseKeys.join(", ") || "none"})`,
      responseKeys,
      rawShape,
    };
  }
  if (distinctIds.length > 1) {
    return {
      ok: false,
      errorCode: "AMBIGUOUS_JOB_ID",
      error: `Job-post response contains conflicting job ID fields: ${candidates.map((c) => c.field).join(", ")} — refusing to guess`,
      responseKeys,
      rawShape,
    };
  }

  const jobId = distinctIds[0];
  const jobIdField = candidates.find((c) => c.value === jobId).field;
  const credits = response.credits && typeof response.credits === "object" ? response.credits : null;

  return {
    ok: true,
    jobId,
    jobIdField,
    creditsUsed: typeof credits?.creditsUsed === "number" ? credits.creditsUsed : null,
    costUsd: typeof credits?.costUSD === "number" ? credits.costUSD : null,
    reservationId: typeof credits?.reservationId === "string" ? credits.reservationId : null,
    project: typeof credits?.project === "string" ? credits.project : null,
    responseKeys,
    rawShape,
  };
}

// ── IPFS result parsing ────────────────────────────────────────────────────
//
// Verified SDK contract (@nosana/ipfs 2.7.3 createIPFSFetchClient):
//   ipfs.retrieve(hash) returns a PARSED JSON OBJECT when the gateway
//   responds with content-type application/json, otherwise a TEXT STRING.
//
// The content pinned at job.ipfsResult is produced by the Nosana node as a
// job-flow result document — it is NOT necessarily the raw container stdout.
//
// Two verified result shapes (both from live Nosana mainnet jobs):
//
//   DOCUMENTED (older / simpler flows):
//     { status, ops: [{ id, type, results: { exitCode, stdout, stderr } }] }
//     Container output lives under ops[].results.stdout.
//
//   ACTUAL (verified 2026-08-22 live job BNZTHNoARu98EdaqPU5WiCaFWZAyU1e9NYCZJj2h1afY):
//     { status, startTime, endTime, secrets, opStates: [{
//         operationId, group, providerId, status, startTime, endTime,
//         exitCode, logs: [{ log: "{...JSON...}", type: "stdout", timestamp }],
//         errors: [], diagnostics: {...}
//     }] }
//     Container output lives under opStates[].logs[].log (type="stdout").
//
// Every candidate must pass validateNosanaOutput(). Extraction order:
//   1.  direct validated risk object;
//   2.  JSON string of the risk output;
//   3.  newline-delimited JSON (final non-empty line);
//   4.  documented ops[].results.stdout (string);
//   5.  documented ops[].results (object);
//   6.  actual opStates[].logs[].log where type="stdout" (verified path);
//   7.  opStates[].result / output / data (nested object or string);
//   8.  top-level results.stdout (string), result / output / data.

const PREFERRED_OP_ID = "stitchcheck-risk-calc";

export function parseIpfsResultOutput(raw) {
  const candidates = [];

  const addStringCandidates = (str, sourcePrefix) => {
    const trimmed = str.trim();
    if (!trimmed) return;
    try {
      candidates.push({ source: `${sourcePrefix}:json-string`, value: JSON.parse(trimmed) });
    } catch { /* not whole-document JSON — try NDJSON below */ }
    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      try {
        candidates.push({ source: `${sourcePrefix}:ndjson-last-line`, value: JSON.parse(lines[lines.length - 1]) });
      } catch { /* last line is not JSON */ }
    }
  };

  if (typeof raw === "string") {
    addStringCandidates(raw, "raw");
  } else if (raw !== null && typeof raw === "object") {
    candidates.push({ source: "direct", value: raw });

    // ── Documented shape: ops[].results.stdout / ops[].results ──────────
    if (Array.isArray(raw.ops)) {
      const ordered = [...raw.ops].sort(
        (a, b) => (b?.id === PREFERRED_OP_ID ? 1 : 0) - (a?.id === PREFERRED_OP_ID ? 1 : 0),
      );
      for (const op of ordered) {
        const res = op?.results;
        if (res && typeof res === "object") {
          if (typeof res.stdout === "string") {
            addStringCandidates(res.stdout, `ops.${op.id ?? "?"}.results.stdout`);
          }
          candidates.push({ source: `ops.${op.id ?? "?"}.results`, value: res });
        }
      }
    }

    // ── Actual shape: opStates[].logs[].log (verified 2026-08-22) ────────
    // Each opState has a `logs` array of { log, type, timestamp } objects.
    // Container stdout entries have type="stdout"; the `log` field is a
    // string that may contain the risk JSON (possibly with trailing newline
    // or NDJSON wrapper lines).
    if (Array.isArray(raw.opStates)) {
      const ordered = [...raw.opStates].sort(
        (a, b) => (b?.operationId === PREFERRED_OP_ID ? 1 : 0) - (a?.operationId === PREFERRED_OP_ID ? 1 : 0),
      );
      for (const opState of ordered) {
        const opLabel = opState?.operationId ?? opState?.group ?? "?";
        // Primary: logs array with typed entries
        if (Array.isArray(opState?.logs)) {
          // Prefer stdout entries; scan in reverse for the last match
          const stdoutLogs = opState.logs.filter(
            (l) => l && typeof l === "object" && l.type === "stdout" && typeof l.log === "string",
          );
          const logsToScan = stdoutLogs.length > 0 ? stdoutLogs : opState.logs.filter(
            (l) => l && typeof l === "object" && typeof l.log === "string",
          );
          for (const logEntry of logsToScan) {
            addStringCandidates(logEntry.log, `opStates.${opLabel}.logs[${opState.logs.indexOf(logEntry)}].log`);
          }
        }
        // Secondary: nested result / output / data fields inside opState
        for (const key of ["result", "output", "data"]) {
          const v = opState?.[key];
          if (typeof v === "string") addStringCandidates(v, `opStates.${opLabel}.${key}`);
          else if (v !== null && typeof v === "object") candidates.push({ source: `opStates.${opLabel}.${key}`, value: v });
        }
      }
    }

    // ── Top-level nested fields ──────────────────────────────────────────
    if (raw.results && typeof raw.results === "object") {
      if (typeof raw.results.stdout === "string") {
        addStringCandidates(raw.results.stdout, "results.stdout");
      }
      candidates.push({ source: "results", value: raw.results });
    }
    for (const key of ["result", "output", "data"]) {
      const v = raw[key];
      if (typeof v === "string") addStringCandidates(v, key);
      else if (v !== null && typeof v === "object") candidates.push({ source: key, value: v });
    }
  }

  let firstInvalid = null;
  for (const candidate of candidates) {
    if (candidate.value === null || typeof candidate.value !== "object") continue;
    const validation = validateNosanaOutput(candidate.value);
    if (validation.valid) {
      return { ok: true, output: candidate.value, source: candidate.source };
    }
    if (!firstInvalid) firstInvalid = { source: candidate.source, issues: validation.issues };
  }

  if (firstInvalid) {
    return {
      ok: false,
      errorCode: "OUTPUT_INVALID",
      error: `Retrieved content parsed but failed risk-output validation (candidate: ${firstInvalid.source}): ${firstInvalid.issues.join("; ")}`,
    };
  }
  return {
    ok: false,
    errorCode: "RESULT_PARSE_ERROR",
    error: "Retrieved IPFS content contained no parseable JSON candidate (expected risk-output JSON, NDJSON, or a flow-result document with ops[].results.stdout or opStates[].logs[].log)",
  };
}

// ── Sanitized debug diagnostics (opt-in) ───────────────────────────────────
//
// Enabled ONLY via NOSANA_DEBUG_RESPONSE=1. Writes to stderr ONLY.
// Prints key names, value types, and presence booleans — NEVER values of
// secrets, NEVER raw response bodies, NEVER idempotency-key values,
// NEVER API keys, wallet material, or full IPFS content.

export function debugResponseShape(phase, response) {
  if (process.env.NOSANA_DEBUG_RESPONSE !== "1") return;
  const isObj = response !== null && typeof response === "object" && !Array.isArray(response);
  const credits = isObj && response.credits && typeof response.credits === "object" ? response.credits : null;
  const yesNo = (b) => (b ? "yes" : "no");
  const lines = [
    `── NOSANA_DEBUG_RESPONSE [phase=${phase}] ──`,
    `  response top-level type: ${Array.isArray(response) ? "array" : typeof response}`,
    `  response key names: ${isObj ? Object.keys(response).join(", ") || "(none)" : "n/a"}`,
    `  nested credits key names: ${credits ? Object.keys(credits).join(", ") || "(none)" : "n/a"}`,
    `  nested data key names: ${isObj && response.data && typeof response.data === "object" ? Object.keys(response.data).join(", ") : "n/a"}`,
    `  nested result key names: ${isObj && response.result && typeof response.result === "object" ? Object.keys(response.result).join(", ") : "n/a"}`,
    `  job ID present: ${yesNo(isObj && [response.job, response.id, response.jobId, response.data?.job, response.result?.job].some((v) => typeof v === "string" && v.length > 0))}`,
    `  IPFS hash present (ipfsResult/result string): ${yesNo(isObj && (typeof response.ipfsResult === "string" || typeof response.result === "string"))}`,
    `  credits object present: ${yesNo(credits !== null)}`,
    `  costUSD present: ${yesNo(typeof credits?.costUSD === "number")}`,
    `  creditsUsed present: ${yesNo(typeof credits?.creditsUsed === "number")}`,
    `  reservationId present: ${yesNo(typeof credits?.reservationId === "string")}`,
    `  project present: ${yesNo(typeof credits?.project === "string")}`,
    `  status field types: jobStatus=${typeof response?.jobStatus}, state=${typeof response?.state}`,
    `  output/result field types: output=${typeof response?.output}, result=${typeof response?.result}, ops=${Array.isArray(response?.ops) ? `array[${response.ops.length}]` : typeof response?.ops}`,
    `── end debug [phase=${phase}] ──`,
  ];
  console.error(lines.join("\n"));
}

// ── Timestamped evidence artifacts ─────────────────────────────────────────
//
// Written IMMEDIATELY after the job-post response is received and again at
// completion/failure, so an accepted live job is always traceable even if a
// later phase fails. Artifacts contain ONLY sanitized metadata — never API
// keys, idempotency-key values, raw response bodies, or full IPFS content.
//
// Directory: smoke-tests/nosana/results/evidence/ (override with
// NOSANA_EVIDENCE_DIR — used by offline tests to redirect into a temp dir).
// Evidence-write failures must NEVER break the job flow.

function getEvidenceDir() {
  return process.env.NOSANA_EVIDENCE_DIR || join(here, "results", "evidence");
}

export function writeEvidenceArtifact(eventType, data) {
  try {
    const dir = getEvidenceDir();
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = join(dir, `${ts}-${eventType}.json`);
    const artifact = {
      eventType,
      recordedAt: new Date().toISOString(),
      ...data,
    };
    fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2) + "\n", "utf8");
    return filePath;
  } catch {
    return null; // best effort — evidence failure must not fail the job
  }
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
  // Local watchdog: bounded observation window, separate from platform timeout.
  const localWatchdogMs = parseInt(args["local-watchdog"] || String(LOCAL_WATCHDOG_TIMEOUT_MS), 10);
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
  // `credits.creditsUsed`, `credits.costUSD`) lives here, never the raw
  // credential.
  let job = null;
  let jobId = null;
  let creditsUsed = null;
  let costUsd = null;
  // Additional billing/traceability metadata captured from the post response.
  let reservationId = null;
  let project = null;
  // IPFS hash of the RESULT document (distinct from the job-definition hash).
  let resultIpfsHash = null;
  // Sanitized structural metadata about the post response (keys/types only).
  let postResponseKeys = [];
  let postRawShape = null;
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
    // ── D5: official SDK validator before any IPFS pin ────────────────
    // Local validateJobDefinition already ran above. The live path must
    // also run @nosana/kit's export before pin. Fake/offline kits that
    // omit the export skip this layer.
    if (jobDef && typeof nosanaKit.validateJobDefinition === "function") {
      const sdkValidation = nosanaKit.validateJobDefinition(jobDef);
      const sdkOk = Boolean(
        sdkValidation && (sdkValidation.success === true || sdkValidation.valid === true),
      );
      if (!sdkOk) {
        const detail = Array.isArray(sdkValidation?.errors)
          ? sdkValidation.errors.map((e) => `${e.path}: expected ${e.expected}`).join("; ")
          : Array.isArray(sdkValidation?.issues)
            ? sdkValidation.issues.join("; ")
            : "official validateJobDefinition rejected the job definition";
        emitError(`Official SDK job definition validation failed: ${detail}`, "SDK_VALIDATION_FAILED");
        return;
      }
    }

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
    // VERIFIED against installed SDK types (@nosana/api 2.7.5):
    //   list(request, options?: { idempotencyKey?: string })
    // The option is sent as the `Idempotency-Key` request header
    // (NosanaJobActionOptions in routes/jobs/types.d.ts).
    try {
      job = await nosanaClient.api.jobs.list({
        ipfsHash: resolvedHash,
        market,
        timeout: timeoutSec,
      }, { idempotencyKey });
    } catch (postErr) {
      // Post rejected/failed AFTER the IPFS pin succeeded — preserve the pin
      // hash so the attempt remains traceable. No job ID exists yet.
      writeEvidenceArtifact("post_rejected", {
        phase: "post",
        jobId: null,
        market,
        ipfsHash: resolvedHash,
        errorCode: "POST_FAILED",
        error: postErr.message || "Job post request failed",
        submittedAt: new Date(submittedAt).toISOString(),
      });
      emitResult({
        success: false,
        phase: "post",
        error: `Job post failed: ${postErr.message || "unknown error"}`,
        errorCode: "POST_FAILED",
        jobId: null,
        market,
        ipfsHash: resolvedHash,
        platformTimeoutSec: timeoutSec,
        latencyMs: Date.now() - submittedAt,
        submittedAt: new Date(submittedAt).toISOString(),
        completedAt: new Date().toISOString(),
        observedStates: [],
        creditsUsed: null,
        costUsd: null,
      });
      return;
    }

    // ── Normalize the post response ─────────────────────────────────────
    // Verified SDK response shape (CreateJobWithCreditsResponse):
    //   { tx, job, run, credits: { costUSD, creditsUsed, reservationId, project } }
    // The documented job-ID field is `job`. Normalization NEVER invents an
    // ID and rejects ambiguous/missing IDs BEFORE any polling begins.
    debugResponseShape("post", job);
    const normalized = normalizeJobPostResponse(job);
    postResponseKeys = normalized.responseKeys || [];
    postRawShape = normalized.rawShape || null;

    if (!normalized.ok) {
      writeEvidenceArtifact("post_rejected", {
        phase: "post",
        jobId: null,
        market,
        ipfsHash: resolvedHash,
        errorCode: normalized.errorCode,
        error: normalized.error,
        responseKeys: postResponseKeys,
        rawShape: postRawShape,
        submittedAt: new Date(submittedAt).toISOString(),
      });
      emitResult({
        success: false,
        phase: "post",
        error: normalized.error,
        errorCode: normalized.errorCode === "AMBIGUOUS_JOB_ID" ? "POST_AMBIGUOUS_JOB_ID" : "POST_NO_JOB_ID",
        jobId: null,
        market,
        ipfsHash: resolvedHash,
        platformTimeoutSec: timeoutSec,
        latencyMs: Date.now() - submittedAt,
        submittedAt: new Date(submittedAt).toISOString(),
        completedAt: new Date().toISOString(),
        observedStates: [],
        creditsUsed: normalized.creditsUsed ?? null,
        costUsd: normalized.costUsd ?? null,
      });
      return;
    }

    jobId = normalized.jobId;
    creditsUsed = normalized.creditsUsed;
    costUsd = normalized.costUsd;
    reservationId = normalized.reservationId;
    project = normalized.project;

    // CRITICAL: write timestamped evidence IMMEDIATELY after an accepted
    // submission response, BEFORE polling. If any later phase fails, the
    // job ID and billing metadata are already preserved on disk.
    writeEvidenceArtifact("post_accepted", {
      phase: "post",
      jobId,
      jobIdField: normalized.jobIdField,
      market,
      ipfsHash: resolvedHash,
      creditsUsed,
      costUsd,
      reservationId,
      project,
      responseKeys: postResponseKeys,
      rawShape: postRawShape,
      submittedAt: new Date(submittedAt).toISOString(),
    });

    // ── Cost ceiling check ────────────────────────────────────────────
    // The ceiling is compared against `costUSD` (actual USD cost), NOT
    // `creditsUsed` (internal credit count). If `costUSD` is missing,
    // we cannot verify the cost — flag as COST_METADATA_MISSING and stop.
    const costCeilingUsd = getCostCeilingUsd();
    if (costUsd === null || costUsd === undefined) {
      // Cannot verify cost — safest to stop. The job is already posted.
      emitResult({
        success: false,
        phase: "post",
        error: `Job posted but costUSD is missing from API response — cannot verify cost against ceiling ${costCeilingUsd} USD (creditsUsed: ${creditsUsed ?? "unknown"} internal credits)`,
        errorCode: "COST_METADATA_MISSING",
        jobId,
        market,
        ipfsHash: resolvedHash,
        platformTimeoutSec: timeoutSec,
        latencyMs: Date.now() - submittedAt,
        submittedAt: new Date(submittedAt).toISOString(),
        completedAt: new Date().toISOString(),
        observedStates: [...new Set(observedStates)],
        creditsUsed,
        costUsd: null,
        reservationId,
        project,
        costCeilingUsd,
      });
      return;
    }
    if (costUsd > costCeilingUsd) {
      emitResult({
        success: false,
        phase: "post",
        error: `Cost ceiling exceeded: costUSD ${costUsd} > ceiling ${costCeilingUsd} USD (creditsUsed: ${creditsUsed ?? "unknown"} internal credits)`,
        errorCode: "COST_CEILING_EXCEEDED",
        jobId,
        market,
        ipfsHash: resolvedHash,
        platformTimeoutSec: timeoutSec,
        latencyMs: Date.now() - submittedAt,
        submittedAt: new Date(submittedAt).toISOString(),
        completedAt: new Date().toISOString(),
        observedStates: [...new Set(observedStates)],
        creditsUsed,
        costUsd,
        reservationId,
        project,
        costCeilingUsd,
      });
      return;
    }

    // ── Step 3: Poll until result is available ──────────────────────────
    // Two deadlines:
    //   - Platform job timeout (timeoutSec): the Nosana platform's maximum
    //     execution time for this job. Used in the job definition.
    //   - Local watchdog (localWatchdogMs): our bounded observation window.
    //     If the watchdog fires, we stop polling and record a timeout
    //     WITHOUT submitting another job. The workload should complete in
    //     seconds; the watchdog prevents indefinite hangs.
    const pollDeadline = Date.now() + localWatchdogMs;
    let finalJob = null;
    let watchdogFired = false;

    // Evidence: polling has begun for a known, accepted job ID.
    writeEvidenceArtifact("polling", {
      phase: "poll",
      jobId,
      market,
      ipfsHash: resolvedHash,
      creditsUsed,
      costUsd,
      reservationId,
      project,
      submittedAt: new Date(submittedAt).toISOString(),
    });

    while (Date.now() < pollDeadline) {
      await sleep(getPollIntervalMs());
      try {
        const status = await nosanaClient.api.jobs.get(jobId);
        debugResponseShape("poll", status);
        if (status) {
          const label = normalizeJobStatus(status);
          if (label !== null) observedStates.push(label);
          const polledCredits = extractCreditsUsedFromStatus(status);
          if (polledCredits !== null) creditsUsed = polledCredits;
        }
        // Terminal detection checks BOTH the string job status (jobStatus,
        // falling back to a string `state`) and ipfsResult/result presence.
        // failed/stopped exit the loop promptly as terminal-without-result.
        if (isTerminalJobStatus(status)) {
          finalJob = status;
          break;
        }
      } catch {
        // Polling error — continue retrying until watchdog deadline
      }
    }

    // Check if the watchdog fired (local timeout, not platform timeout)
    if (!finalJob && Date.now() >= pollDeadline) {
      watchdogFired = true;
    }

    const completedAt = Date.now();
    const latencyMs = completedAt - submittedAt;

    if (!finalJob || (!finalJob.ipfsResult && !finalJob.result)) {
      // Distinguish a terminal failure (failed/stopped, or completed without
      // a result hash) from a local watchdog timeout. Both exit without a
      // result and never invent a score.
      // IMPORTANT: On watchdog timeout, we do NOT retry or submit another job.
      const terminalLabel = normalizeJobStatus(finalJob);
      const isTerminalFailure =
        finalJob !== null &&
        (terminalLabel === null ||
          TERMINAL_WITHOUT_RESULT.has(terminalLabel) ||
          terminalLabel === "completed");
      const isWatchdogTimeout = watchdogFired && !isTerminalFailure;
      emitResult({
        success: false,
        phase: "poll",
        error: isWatchdogTimeout
          ? `Local watchdog timeout after ${localWatchdogMs}ms — stopped polling without submitting another job (platform job timeout: ${timeoutSec}s)`
          : isTerminalFailure
          ? `Job ended in terminal state${terminalLabel ? ` "${terminalLabel}"` : ""} without producing a result`
          : "Job timed out waiting for result",
        errorCode: isWatchdogTimeout ? "LOCAL_WATCHDOG_TIMEOUT" : isTerminalFailure ? "JOB_TERMINAL_FAILURE" : "JOB_TIMEOUT",
        jobId,
        market,
        ipfsHash: resolvedHash,
        platformTimeoutSec: timeoutSec,
        latencyMs,
        submittedAt: new Date(submittedAt).toISOString(),
        completedAt: new Date(completedAt).toISOString(),
        observedStates: [...new Set(observedStates)],
        creditsUsed: creditsUsed ?? null,
        costUsd: costUsd ?? null,
        reservationId,
        project,
      });
      return;
    }

    // ── Retrieve result from IPFS ───────────────────────────────────────
    // Official: client.ipfs.retrieve(hash) — not ipfs.get().
    // See: https://learn.nosana.com/kit/examples/jobs.html
    // Verified SDK behaviour (@nosana/ipfs 2.7.3): returns a PARSED JSON
    // OBJECT when the gateway sends content-type application/json,
    // otherwise a TEXT string. Both shapes are handled by
    // parseIpfsResultOutput().
    const resultHash = finalJob.ipfsResult || finalJob.result;
    resultIpfsHash = typeof resultHash === "string" ? resultHash : null;
    let rawResult;
    try {
      rawResult = await nosanaClient.ipfs.retrieve(resultHash);
    } catch (retrieveErr) {
      // Retrieval failed AFTER the job completed — preserve ALL job and
      // billing metadata so the completed, billed job remains traceable.
      writeEvidenceArtifact("retrieval_failed", {
        phase: "retrieve",
        jobId,
        market,
        ipfsHash: resolvedHash,
        resultIpfsHash,
        creditsUsed,
        costUsd,
        reservationId,
        project,
        observedStates: [...new Set(observedStates)],
        errorCode: "RETRIEVAL_FAILED",
        error: retrieveErr.message || "IPFS retrieval failed",
        submittedAt: new Date(submittedAt).toISOString(),
        completedAt: new Date().toISOString(),
      });
      emitResult({
        success: false,
        phase: "retrieve",
        error: `Failed to retrieve job result from IPFS: ${retrieveErr.message}`,
        errorCode: "RETRIEVAL_FAILED",
        jobId,
        market,
        ipfsHash: resolvedHash,
        resultIpfsHash,
        platformTimeoutSec: timeoutSec,
        latencyMs: Date.now() - submittedAt,
        submittedAt: new Date(submittedAt).toISOString(),
        completedAt: new Date().toISOString(),
        observedStates: [...new Set(observedStates)],
        creditsUsed: creditsUsed ?? null,
        costUsd: costUsd ?? null,
        reservationId,
        project,
      });
      return;
    }

    // ── Parse and validate the retrieved content ────────────────────────
    // The retrieved document is the node-produced job-flow result, which
    // may wrap the container stdout (ops[].results.stdout). Only verified
    // shapes are accepted, and every candidate must pass the shared risk
    // -output validator. On failure the job ID, IPFS hashes, credits, cost,
    // statuses, and timestamps are ALL preserved — never fabricated.
    debugResponseShape("retrieve", rawResult);
    const parsedOutput = parseIpfsResultOutput(rawResult);
    if (!parsedOutput.ok) {
      const isParseError = parsedOutput.errorCode === "RESULT_PARSE_ERROR";
      writeEvidenceArtifact(isParseError ? "retrieval_failed" : "output_invalid", {
        phase: isParseError ? "retrieve" : "validate",
        jobId,
        market,
        ipfsHash: resolvedHash,
        resultIpfsHash,
        creditsUsed,
        costUsd,
        reservationId,
        project,
        observedStates: [...new Set(observedStates)],
        retrievedShape: describeShape(rawResult),
        errorCode: parsedOutput.errorCode,
        error: parsedOutput.error,
        submittedAt: new Date(submittedAt).toISOString(),
        completedAt: new Date().toISOString(),
      });
      emitResult({
        success: false,
        phase: isParseError ? "retrieve" : "validate",
        error: parsedOutput.error,
        errorCode: parsedOutput.errorCode,
        jobId,
        market,
        ipfsHash: resolvedHash,
        resultIpfsHash,
        platformTimeoutSec: timeoutSec,
        latencyMs: Date.now() - submittedAt,
        submittedAt: new Date(submittedAt).toISOString(),
        completedAt: new Date().toISOString(),
        observedStates: [...new Set(observedStates)],
        creditsUsed: creditsUsed ?? null,
        costUsd: costUsd ?? null,
        reservationId,
        project,
      });
      return;
    }

    // Emit success — one JSON line on stdout. The output has already passed
    // the shared risk-output validator inside parseIpfsResultOutput().
    writeEvidenceArtifact("completed_success", {
      phase: "complete",
      jobId,
      market,
      ipfsHash: resolvedHash,
      resultIpfsHash,
      creditsUsed,
      costUsd,
      reservationId,
      project,
      observedStates: [...new Set(observedStates)],
      outputSource: parsedOutput.source,
      latencyMs: Date.now() - submittedAt,
      submittedAt: new Date(submittedAt).toISOString(),
      completedAt: new Date().toISOString(),
    });
    emitResult({
      success: true,
      phase: "complete",
      jobId,
      market,
      ipfsHash: resolvedHash,
      resultIpfsHash,
      platformTimeoutSec: timeoutSec,
      latencyMs: Date.now() - submittedAt,
      submittedAt: new Date(submittedAt).toISOString(),
      completedAt: new Date().toISOString(),
      observedStates: [...new Set(observedStates)],
      creditsUsed: creditsUsed ?? null,
      costUsd: costUsd ?? null,
      reservationId,
      project,
      output: parsedOutput.output,
    });
  } catch (err) {
    const completedAt = Date.now();
    // creditsUsed is captured from the post response above (hoisted before
    // the try block); reading it here can never throw a TDZ/ReferenceError.
    // Any metadata captured before the failure is preserved so an accepted
    // job remains traceable even when a later phase throws unexpectedly.
    emitResult({
      success: false,
      phase: jobId ? "unknown" : "post",
      error: err.message || "Unknown Nosana job error",
      errorCode: "JOB_EXECUTION_ERROR",
      jobId: jobId || null,
      market,
      ipfsHash: resolvedHash || null,
      resultIpfsHash,
      platformTimeoutSec: timeoutSec,
      latencyMs: completedAt - submittedAt,
      submittedAt: new Date(submittedAt).toISOString(),
      completedAt: new Date(completedAt).toISOString(),
      observedStates: [...new Set(observedStates)],
      creditsUsed: creditsUsed ?? null,
      costUsd: costUsd ?? null,
      reservationId,
      project,
    });
  }
}

// ── Cost estimation helper (offline, for reporting only) ─────────────────────

/**
 * Estimates USD cost from a market's price-per-hour and a job timeout.
 *
 * This is a rough pre-submission estimate only. The authoritative cost is
 * `credits.costUSD` from the API response AFTER the job is posted.
 *
 * @param {number} pricePerHour - Market price in USD per hour
 * @param {number} timeoutSec - Job timeout in seconds
 * @returns {number|null} Estimated USD cost, or null if inputs are invalid
 */
export function estimateCostUsdFromMarketRate(pricePerHour, timeoutSec) {
  if (!Number.isFinite(pricePerHour) || pricePerHour < 0) return null;
  if (!Number.isFinite(timeoutSec) || timeoutSec < 0) return null;
  return pricePerHour * (timeoutSec / 3600);
}

// ── Output helpers ─────────────────────────────────────────────────────────

// ── Child-process result contract ──────────────────────────────────────────
//
// The child emits EXACTLY ONE JSON object on stdout (diagnostics go to
// stderr only). Every result — success or failure — carries the same stable
// field set so the parent can always preserve live-attempt metadata:
//
//   success, phase, jobId, market, ipfsHash, resultIpfsHash, creditsUsed,
//   costUsd, reservationId, project, observedStates, latencyMs,
//   submittedAt, completedAt, errorCode, error, output, platformTimeoutSec
//
// Invariants enforced HERE (the single choke point for all output):
//   - success: true REQUIRES a non-empty jobId and a validated output object;
//     otherwise the result is downgraded to a failure (CONTRACT_GUARD).
//   - success: true never carries errorCode/error.
//   - phase is one of: post | poll | retrieve | validate | complete | unknown.
const CHILD_CONTRACT_PHASES = new Set(["post", "poll", "retrieve", "validate", "complete", "unknown"]);

function emitResult(obj) {
  // Emit exactly one JSON line on stdout — the wrapper parses this.
  // NEVER include NOSANA_API_KEY or any credential in output.
  const safe = {
    success: obj.success === true,
    phase: CHILD_CONTRACT_PHASES.has(obj.phase) ? obj.phase : "unknown",
    jobId: obj.jobId ?? null,
    market: obj.market ?? null,
    ipfsHash: obj.ipfsHash ?? null,
    resultIpfsHash: obj.resultIpfsHash ?? null,
    creditsUsed: obj.creditsUsed ?? null,
    costUsd: obj.costUsd ?? null,
    reservationId: obj.reservationId ?? null,
    project: obj.project ?? null,
    observedStates: Array.isArray(obj.observedStates) ? obj.observedStates : [],
    latencyMs: typeof obj.latencyMs === "number" ? obj.latencyMs : 0,
    submittedAt: obj.submittedAt ?? null,
    completedAt: obj.completedAt ?? null,
    errorCode: obj.errorCode ?? null,
    error: obj.error ?? null,
    output: obj.output ?? null,
    platformTimeoutSec: obj.platformTimeoutSec ?? null,
    ...(obj.costCeilingUsd !== undefined ? { costCeilingUsd: obj.costCeilingUsd } : {}),
  };
  // Contract guard: never emit success without a job ID and a valid output.
  if (safe.success && (!safe.jobId || !safe.output || typeof safe.output !== "object")) {
    safe.success = false;
    safe.phase = "validate";
    safe.errorCode = "CONTRACT_GUARD";
    safe.error = "Internal contract guard: success downgraded — jobId and validated output are required for success";
    safe.output = null;
  }
  if (safe.success) {
    safe.phase = "complete";
    safe.errorCode = null;
    safe.error = null;
  }
  console.log(JSON.stringify(safe));
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
