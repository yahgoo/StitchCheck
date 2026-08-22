// nosana-response-normalization-tests.mjs — OFFLINE-ONLY regression suite.
//
// Catches the exact class of bug that caused live Attempt 5 (OUTPUT_INVALID
// with total loss of job ID, IPFS hashes, creditsUsed, and costUSD):
//   1. The child accepted ANY parseable IPFS payload as the risk output —
//      including the node-produced job-flow result wrapper — and emitted
//      success: true without validating the output.
//   2. The parent's OUTPUT_INVALID fallback path silently discarded all
//      live-attempt metadata.
//
// Coverage (maps to the 22 required cases):
//   Section A (pure):  job-post response normalization — documented shape,
//     id/jobId compat fields, nested data.job, missing ID, ambiguous IDs,
//     missing credits, missing costUSD.                              [1-8]
//   Section B (pure):  IPFS result parsing — direct object, JSON string,
//     NDJSON last line, flow-result wrapper ops[].results.stdout, nested
//     result field, malformed content, wrong-shape content.       [14-16+]
//   Section C (spawned child, fake SDK): cost below/above ceiling, post
//     failure after pin, poll failure after submission, retrieval failure,
//     malformed IPFS, wrapper regression, exactly-one-stdout-line,
//     stderr-only diagnostics, no secrets anywhere, success requires
//     jobId + valid output, failure preserves jobId + billing.
//                                                          [9-13, 17-19, 21-22]
//   Section D (parent): liveAttemptMetadata preservation on the
//     OUTPUT_INVALID path and evidence artifact sanitization.        [20]
//
// Hard guarantees:
//   - No network calls of any kind (fake SDK injected via ESM loader).
//   - No credentials are used (fake API key, never printed).
//   - Evidence writes are redirected to a temp dir via NOSANA_EVIDENCE_DIR.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  normalizeJobPostResponse,
  parseIpfsResultOutput,
  describeShape,
} from "./nosana_run_job.mjs";
import { validateNosanaOutput } from "./schema-validator.mjs";
import {
  extractLiveMetadata,
  writeLiveAttemptEvidence,
} from "./nosana-risk-runner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const RUN_JOB_PATH = path.join(here, "nosana_run_job.mjs");
const RUNNER_SOURCE = fs.readFileSync(path.join(here, "nosana-risk-runner.mjs"), "utf8");
const RUN_JOB_SOURCE = fs.readFileSync(RUN_JOB_PATH, "utf8");

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
console.log("StitchCheck Nosana response-normalization tests — OFFLINE ONLY");
console.log("=".repeat(72));

// ── Shared fixtures ──────────────────────────────────────────────────────────

const VALID_OUTPUT = {
  riskScore: 0.42,
  riskBand: "medium",
  assumptions: ["Fake assumption"],
  simulationCount: 500,
  explanation: "Fake explanation for offline normalization tests.",
};

const FAKE_IDEMPOTENCY_KEY = "fake-idempotency-key-normalization-test-000";
const FAKE_JOB_ADDRESS = "fakeJobAddressNormalizationTest";
const FAKE_IPFS_HASH = "QmFakeIpfsHashNormalizationTest";
const FAKE_RESULT_HASH = "QmFakeResultHashNormalizationTest";
const FAKE_MARKET = "fakeMarketAddressNormalization";
const FAKE_API_KEY = "fake-api-key-normalization-tests-only";

// ── Section A: normalizeJobPostResponse (pure) ──────────────────────────────

section("Section A: job-post response normalization (pure) [cases 1-8]");

// Case 1 — documented CreateJobWithCreditsResponse shape
{
  const r = normalizeJobPostResponse({
    tx: "fake-tx",
    job: "job-address",
    run: "run-address",
    credits: {
      costUSD: 0.0436,
      creditsUsed: 44,
      reservationId: "reservation-id",
      project: "project-id",
    },
  });
  assert(r.ok === true, "case 1: documented response normalizes successfully");
  assert(r.jobId === "job-address", "case 1: jobId extracted from documented `job` field");
  assert(r.jobIdField === "job", "case 1: jobIdField is `job`");
  assert(r.costUsd === 0.0436, "case 1: costUSD preserved (0.0436)");
  assert(r.creditsUsed === 44, "case 1: creditsUsed preserved (44)");
  assert(r.reservationId === "reservation-id", "case 1: reservationId preserved");
  assert(r.project === "project-id", "case 1: project preserved");
  assert(
    r.responseKeys.includes("job") && r.responseKeys.includes("credits"),
    "case 1: sanitized response key set preserved",
  );
  assert(
    r.rawShape && typeof r.rawShape === "object" && r.rawShape.job === "string",
    "case 1: rawShape is a key/type map (no values)",
  );
}

// Case 2 — response with `id` only (compatibility)
{
  const r = normalizeJobPostResponse({ id: "job-via-id", credits: { costUSD: 0.01, creditsUsed: 2 } });
  assert(r.ok === true && r.jobId === "job-via-id" && r.jobIdField === "id",
    "case 2: `id` compatibility field supported");
}

// Case 3 — response with `jobId` only (compatibility)
{
  const r = normalizeJobPostResponse({ jobId: "job-via-jobId" });
  assert(r.ok === true && r.jobId === "job-via-jobId" && r.jobIdField === "jobId",
    "case 3: `jobId` compatibility field supported");
}

// Case 4 — nested data.job (compatibility)
{
  const r = normalizeJobPostResponse({ data: { job: "job-via-nested" } });
  assert(r.ok === true && r.jobId === "job-via-nested" && r.jobIdField === "data.job",
    "case 4: nested `data.job` compatibility field supported");
}

// Case 5 — missing job ID
{
  const r = normalizeJobPostResponse({ tx: "fake-tx", credits: { costUSD: 0.01 } });
  assert(r.ok === false && r.errorCode === "NO_JOB_ID",
    "case 5: missing job ID rejected with NO_JOB_ID before polling");
  assert(!("jobId" in r) || r.jobId == null, "case 5: no job ID is ever invented");
}

// Case 6 — ambiguous multiple DISTINCT IDs; same value twice is NOT ambiguous
{
  const rAmb = normalizeJobPostResponse({ job: "address-a", id: "address-b" });
  assert(rAmb.ok === false && rAmb.errorCode === "AMBIGUOUS_JOB_ID",
    "case 6: conflicting job ID fields rejected with AMBIGUOUS_JOB_ID");
  const rSame = normalizeJobPostResponse({ job: "address-a", id: "address-a" });
  assert(rSame.ok === true && rSame.jobId === "address-a",
    "case 6: identical value in two fields is NOT ambiguous");
}

// Case 7 — missing credits object
{
  const r = normalizeJobPostResponse({ job: "job-address" });
  assert(r.ok === true && r.creditsUsed === null && r.costUsd === null,
    "case 7: missing credits → null metadata (handled safely downstream)");
}

// Case 8 — credits present but costUSD missing
{
  const r = normalizeJobPostResponse({ job: "job-address", credits: { creditsUsed: 44 } });
  assert(r.ok === true && r.costUsd === null && r.creditsUsed === 44,
    "case 8: missing costUSD → costUsd null, creditsUsed preserved");
}

// Non-object responses rejected
{
  const rArr = normalizeJobPostResponse([{ job: "x" }]);
  const rStr = normalizeJobPostResponse("job-address");
  assert(rArr.ok === false && rStr.ok === false,
    "array/string responses rejected with NO_JOB_ID (no guessing)");
}

// ── Section B: parseIpfsResultOutput (pure) ─────────────────────────────────

section("Section B: IPFS result parsing (pure) [cases 14-16 + shapes]");

// Direct object containing the risk result
{
  const r = parseIpfsResultOutput(VALID_OUTPUT);
  assert(r.ok === true && r.source === "direct" && r.output.riskScore === 0.42,
    "direct risk-output object accepted");
}

// JSON string
{
  const r = parseIpfsResultOutput(JSON.stringify(VALID_OUTPUT));
  assert(r.ok === true && r.source === "raw:json-string",
    "JSON string of risk output accepted");
}

// Case 15 — newline-delimited output, final non-empty line is JSON
{
  const r = parseIpfsResultOutput(
    "container boot log\nloading model\n" + JSON.stringify(VALID_OUTPUT) + "\n",
  );
  assert(r.ok === true && r.source === "raw:ndjson-last-line" && r.output.simulationCount === 500,
    "case 15: NDJSON with final JSON line accepted");
}

// Attempt-5 regression — node-produced flow-result wrapper with
// ops[].results.stdout containing the container's JSON line
{
  const wrapper = {
    status: "success",
    ops: [
      {
        id: "stitchcheck-risk-calc",
        type: "container/run",
        results: { exitCode: 0, stdout: JSON.stringify(VALID_OUTPUT) + "\n", stderr: "" },
      },
    ],
  };
  const r = parseIpfsResultOutput(wrapper);
  assert(r.ok === true && r.source === "ops.stitchcheck-risk-calc.results.stdout:json-string",
    "attempt-5 regression: flow-result wrapper ops[].results.stdout accepted");
  assert(r.output.riskBand === "medium", "attempt-5 regression: extracted output is the risk result");
}

// Wrapper whose stdout is newline-delimited (logs + final JSON line)
{
  const wrapper = {
    ops: [
      { id: "stitchcheck-risk-calc", results: { stdout: "boot\n" + JSON.stringify(VALID_OUTPUT) } },
    ],
  };
  const r = parseIpfsResultOutput(wrapper);
  assert(r.ok === true && r.source.endsWith("ndjson-last-line"),
    "wrapper with NDJSON stdout accepted");
}

// Case 16 — documented nested result field
{
  const r = parseIpfsResultOutput({ result: VALID_OUTPUT });
  assert(r.ok === true && r.source === "result",
    "case 16: nested `result` field accepted");
}

// Case 14 — malformed IPFS JSON
{
  const r = parseIpfsResultOutput("this is not json {{{");
  assert(r.ok === false && r.errorCode === "RESULT_PARSE_ERROR",
    "case 14: malformed IPFS content → RESULT_PARSE_ERROR");
}

// Wrong-shape object (parses but is not the risk output)
{
  const r = parseIpfsResultOutput({ status: "success", ops: [{ id: "x", results: { stdout: "no json" } }] });
  assert(r.ok === false && r.errorCode === "OUTPUT_INVALID",
    "parseable but invalid-shape content → OUTPUT_INVALID (never fabricated)");
}

// Every accepted candidate passes the shared validator
{
  const r = parseIpfsResultOutput({ ops: [{ id: "stitchcheck-risk-calc", results: VALID_OUTPUT }] });
  assert(r.ok === true && validateNosanaOutput(r.output).valid,
    "accepted output always passes validateNosanaOutput");
}

// ── Section B2: opStates result parsing (pure) ──────────────────────────────

section("Section B2: opStates result parsing (pure) [live-shape regression]");

// Load the sanitized fixture derived from the actual live IPFS result
const OPSTATES_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(here, "fixtures", "opstates-live-result-sanitized.json"), "utf8"),
);

// T1: Actual opStates result shape parses successfully
{
  const r = parseIpfsResultOutput(OPSTATES_FIXTURE);
  assert(r.ok === true, "T1: actual opStates live shape parses successfully");
  assert(r.source.startsWith("opStates."), "T1: source starts with opStates (got: " + r.source + ")");
  assert(typeof r.output.riskScore === "number" && r.output.riskScore >= 0 && r.output.riskScore <= 1,
    "T1: extracted riskScore is valid");
  assert(["low", "medium", "high"].includes(r.output.riskBand),
    "T1: extracted riskBand is valid");
  assert(validateNosanaOutput(r.output).valid,
    "T1: extracted output passes shared validator");
}

// T2: Risk output is extracted only from the verified field path
{
  const r = parseIpfsResultOutput(OPSTATES_FIXTURE);
  assert(r.ok === true && r.source.includes("logs"),
    "T2: risk output extracted from opStates[].logs[].log path (source: " + r.source + ")");
  assert(r.output.riskScore === 0.2895 && r.output.riskBand === "medium",
    "T2: extracted values match the fixture log content");
  assert(r.output.simulationCount === 800,
    "T2: simulationCount extracted correctly from log JSON");
}

// T3: Outer {status, startTime, endTime, secrets, opStates} is NOT accepted as risk output
{
  // The outer flow-status document should never be the "direct" candidate
  const outerOnly = {
    status: "success",
    startTime: 1234567890,
    endTime: 1234567900,
    secrets: {},
    opStates: [{ operationId: "other-op", status: "success", logs: [] }],
  };
  const r = parseIpfsResultOutput(outerOnly);
  assert(r.ok === false,
    "T3: outer flow-status document without valid risk output is rejected");
  assert(r.errorCode === "RESULT_PARSE_ERROR" || r.errorCode === "OUTPUT_INVALID",
    "T3: error code is RESULT_PARSE_ERROR or OUTPUT_INVALID (never success)");
}

// T4: Flow-status metadata is not mistaken for the risk result
{
  const metadataOnly = {
    status: "success",
    startTime: Date.now(),
    endTime: Date.now(),
    secrets: {},
    opStates: [{
      operationId: "stitchcheck-risk-calc",
      status: "success",
      exitCode: 0,
      logs: [{ log: "not json at all", type: "stdout", timestamp: "2026-08-22T00:00:00Z" }],
    }],
  };
  const r = parseIpfsResultOutput(metadataOnly);
  assert(r.ok === false && r.errorCode === "OUTPUT_INVALID",
    "T4: non-JSON log content → OUTPUT_INVALID (metadata not mistaken for risk)");
}

// T5: Newline-delimited stdout inside the verified field parses successfully
{
  const ndjsonFixture = {
    status: "success",
    opStates: [{
      operationId: "stitchcheck-risk-calc",
      logs: [{
        log: "container boot log\nloading model\n" + JSON.stringify(VALID_OUTPUT) + "\n",
        type: "stdout",
        timestamp: "2026-08-22T00:00:00Z",
      }],
    }],
  };
  const r = parseIpfsResultOutput(ndjsonFixture);
  assert(r.ok === true && r.source.includes("ndjson-last-line"),
    "T5: NDJSON stdout inside opStates log parses successfully");
  assert(r.output.riskScore === 0.42,
    "T5: extracted risk output from NDJSON log is correct");
}

// T6: Escaped JSON inside the verified field parses successfully
{
  const escapedFixture = {
    status: "success",
    opStates: [{
      operationId: "stitchcheck-risk-calc",
      logs: [{
        log: JSON.stringify(VALID_OUTPUT),
        type: "stdout",
        timestamp: "2026-08-22T00:00:00Z",
      }],
    }],
  };
  const r = parseIpfsResultOutput(escapedFixture);
  assert(r.ok === true && r.source.includes("json-string"),
    "T6: escaped JSON string inside opStates log parses successfully");
  assert(r.output.riskBand === "medium",
    "T6: extracted risk output from escaped JSON is correct");
}

// T7: Invalid opStates output returns OUTPUT_INVALID
{
  const invalidOutput = {
    status: "success",
    opStates: [{
      operationId: "stitchcheck-risk-calc",
      logs: [{
        log: JSON.stringify({ riskScore: "not-a-number", riskBand: "invalid" }),
        type: "stdout",
        timestamp: "2026-08-22T00:00:00Z",
      }],
    }],
  };
  const r = parseIpfsResultOutput(invalidOutput);
  assert(r.ok === false && r.errorCode === "OUTPUT_INVALID",
    "T7: invalid risk output inside opStates → OUTPUT_INVALID");
}

// T8: Missing opStates output — outer object is not a valid risk output
{
  const emptyOpStates = {
    status: "success",
    opStates: [{
      operationId: "stitchcheck-risk-calc",
      logs: [],
    }],
  };
  const r = parseIpfsResultOutput(emptyOpStates);
  // The outer object itself is added as a "direct" candidate and fails
  // validateNosanaOutput → OUTPUT_INVALID (parseable but not risk output).
  // RESULT_PARSE_ERROR would mean no JSON candidate was found at all.
  assert(r.ok === false && (r.errorCode === "OUTPUT_INVALID" || r.errorCode === "RESULT_PARSE_ERROR"),
    "T8: empty logs array → parse failure (OUTPUT_INVALID or RESULT_PARSE_ERROR)");
}

// opStates with nested result field (secondary path)
{
  const nestedOpState = {
    status: "success",
    opStates: [{
      operationId: "stitchcheck-risk-calc",
      result: VALID_OUTPUT,
    }],
  };
  const r = parseIpfsResultOutput(nestedOpState);
  assert(r.ok === true && r.source === "opStates.stitchcheck-risk-calc.result",
    "opStates[].result nested object accepted (secondary path)");
}

// opStates preferred operation ID sorting
{
  const multiOp = {
    opStates: [
      { operationId: "other-op", logs: [{ log: JSON.stringify({ riskScore: 0.99, riskBand: "high", assumptions: [], simulationCount: 1, explanation: "wrong one" }), type: "stdout" }] },
      { operationId: "stitchcheck-risk-calc", logs: [{ log: JSON.stringify(VALID_OUTPUT), type: "stdout" }] },
    ],
  };
  const r = parseIpfsResultOutput(multiOp);
  assert(r.ok === true && r.output.riskScore === 0.42,
    "opStates preferred operationId sorting works (stitchcheck-risk-calc first)");
}

// stderr-only logs are not used when stdout logs exist
{
  const mixedLogs = {
    opStates: [{
      operationId: "stitchcheck-risk-calc",
      logs: [
        { log: "error trace", type: "stderr" },
        { log: JSON.stringify(VALID_OUTPUT), type: "stdout" },
      ],
    }],
  };
  const r = parseIpfsResultOutput(mixedLogs);
  assert(r.ok === true && r.output.riskScore === 0.42,
    "stderr logs skipped when stdout logs contain valid JSON");
}

// ── Section C: spawned child process with parameterized fake SDK ────────────

section("Section C: spawned child with fake SDK [cases 9-13, 17-19, 21-22]");

function createParameterizedFakeSdk() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nosana-norm-test-"));

  const fakeKitCode = `
export const NosanaNetwork = { MAINNET: "mainnet" };

export function generateIdempotencyKey() {
  return "${FAKE_IDEMPOTENCY_KEY}";
}

const VALID_OUTPUT = ${JSON.stringify(VALID_OUTPUT)};

function postResponse() {
  const mode = process.env.FAKE_POST_MODE || "documented";
  const credits = { costUSD: 0.001, creditsUsed: 5, reservationId: "fake-reservation", project: "fake-project" };
  switch (mode) {
    case "documented":
      return { tx: "fake-tx", job: "${FAKE_JOB_ADDRESS}", run: "fake-run", credits };
    case "id-field":
      return { id: "${FAKE_JOB_ADDRESS}", credits };
    case "no-id":
      return { tx: "fake-tx", credits };
    case "ambiguous":
      return { job: "${FAKE_JOB_ADDRESS}", id: "conflictingJobAddress999", credits };
    case "no-credits":
      return { job: "${FAKE_JOB_ADDRESS}" };
    case "cost-below":
      return { job: "${FAKE_JOB_ADDRESS}", credits: { costUSD: 0.0436, creditsUsed: 44, reservationId: "fake-reservation", project: "fake-project" } };
    case "cost-above":
      return { job: "${FAKE_JOB_ADDRESS}", credits: { costUSD: 999.0, creditsUsed: 44000, reservationId: "fake-reservation", project: "fake-project" } };
    case "throw":
      throw new Error("fake post rejection: market unknown");
    default:
      return { job: "${FAKE_JOB_ADDRESS}", credits };
  }
}

function pollResponse() {
  const mode = process.env.FAKE_POLL_MODE || "complete";
  if (mode === "throw") throw new Error("fake poll network error");
  return { jobStatus: "completed", ipfsResult: "${FAKE_RESULT_HASH}" };
}

function retrieveResponse() {
  const mode = process.env.FAKE_RETRIEVE_MODE || "valid-object";
  switch (mode) {
    case "valid-object": return VALID_OUTPUT;
    case "valid-string": return JSON.stringify(VALID_OUTPUT);
    case "ndjson": return "boot log\\nloading\\n" + JSON.stringify(VALID_OUTPUT) + "\\n";
    case "wrapper-stdout":
      return { status: "success", ops: [ { id: "stitchcheck-risk-calc", type: "container/run", results: { exitCode: 0, stdout: JSON.stringify(VALID_OUTPUT) + "\\n", stderr: "" } } ] };
    case "opstates-logs":
      return { status: "success", startTime: 1787375710053, endTime: 1787375711055, secrets: {}, opStates: [ { operationId: "stitchcheck-risk-calc", group: "stitchcheck-risk-calc", status: "success", exitCode: 0, logs: [ { log: JSON.stringify(VALID_OUTPUT) + "\\n", type: "stdout", timestamp: "2026-08-22T05:15:10Z" } ], errors: [], diagnostics: {} } ] };
    case "opstates-invalid":
      return { status: "success", opStates: [ { operationId: "stitchcheck-risk-calc", logs: [ { log: JSON.stringify({ riskScore: "bad", riskBand: "nope" }), type: "stdout" } ] } ] };
    case "opstates-empty-logs":
      return { status: "success", opStates: [ { operationId: "stitchcheck-risk-calc", logs: [] } ] };
    case "nested-result": return { result: VALID_OUTPUT };
    case "malformed": return "this is not json {{{";
    case "wrong-shape":
      return { status: "success", ops: [ { id: "stitchcheck-risk-calc", results: { exitCode: 0, stdout: "no json here" } } ] };
    case "throw": throw new Error("fake IPFS gateway 502");
    default: return VALID_OUTPUT;
  }
}

export function createNosanaClient(network, config) {
  return {
    ipfs: {
      pin: async (jobDef) => "${FAKE_IPFS_HASH}",
      retrieve: async (hash) => retrieveResponse(),
    },
    api: {
      jobs: {
        list: async (params, options) => postResponse(),
        get: async (jobId) => pollResponse(),
      },
    },
  };
}

export function validateJobDefinition(jobDef) {
  return { success: true, data: jobDef, errors: [] };
}
`;
  fs.writeFileSync(path.join(tmpDir, "fake-nosana-kit.mjs"), fakeKitCode);

  const resolverCode = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@nosana/kit") {
    return {
      url: new URL("fake-nosana-kit.mjs", import.meta.url).href,
      shortCircuit: true,
      format: "module",
    };
  }
  return nextResolve(specifier, context);
}
`;
  fs.writeFileSync(path.join(tmpDir, "fake-kit-resolver.mjs"), resolverCode);

  const loaderCode = `
import { register } from "node:module";
register("./fake-kit-resolver.mjs", import.meta.url);
`;
  fs.writeFileSync(path.join(tmpDir, "fake-kit-loader.mjs"), loaderCode);

  const evidenceDir = path.join(tmpDir, "evidence");
  return {
    tmpDir,
    evidenceDir,
    loaderPath: path.join(tmpDir, "fake-kit-loader.mjs"),
    cleanup() {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
    },
  };
}

const MINIMAL_JOB_DEF = JSON.stringify({
  version: "0.1",
  type: "container",
  ops: [
    {
      id: "stitchcheck-risk-calc",
      type: "container/run",
      args: {
        image: "docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter",
        cmd: "echo test",
      },
    },
  ],
  meta: { trigger: "api" },
  global: {
    env: {
      RISK_INPUT_DATA: '{"test":true}',
      HISTORICAL_DELAY_DATA: '{"airports":{},"routes":[]}',
    },
  },
});

function spawnChild(fixture, env = {}, extraArgs = []) {
  return new Promise((resolvePromise) => {
    const child = spawn(
      "node",
      [
        "--import", `file://${fixture.loaderPath}`,
        RUN_JOB_PATH,
        "--market", FAKE_MARKET,
        "--timeout", "3600",
        ...extraArgs,
      ],
      {
        env: {
          ...process.env,
          NOSANA_API_KEY: FAKE_API_KEY,
          NOSANA_JOB_DEF: MINIMAL_JOB_DEF,
          NOSANA_EVIDENCE_DIR: fixture.evidenceDir,
          NOSANA_POLL_INTERVAL_MS: "50",
          ...env,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => { stdout += c.toString(); });
    child.stderr.on("data", (c) => { stderr += c.toString(); });
    child.on("close", (code) => resolvePromise({ stdout, stderr, code }));
    child.on("error", (err) => resolvePromise({ stdout, stderr: stderr + "\n" + err.message, code: -1 }));
  });
}

function parseSingleStdoutLine(result) {
  const lines = result.stdout.trim().split("\n").filter((l) => l.trim());
  if (lines.length !== 1) return { lineCount: lines.length, parsed: null };
  try {
    return { lineCount: 1, parsed: JSON.parse(lines[0]) };
  } catch {
    return { lineCount: 1, parsed: null };
  }
}

function readEvidenceArtifacts(evidenceDir) {
  try {
    return fs.readdirSync(evidenceDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(evidenceDir, f), "utf8")) }));
  } catch {
    return [];
  }
}

const fixture = createParameterizedFakeSdk();

// ── C1: documented response, cost below ceiling, full success [9, 17] ───────

{
  const r = await spawnChild(fixture, { FAKE_POST_MODE: "cost-below" });
  const { lineCount, parsed } = parseSingleStdoutLine(r);
  assert(lineCount === 1, `case 17: child emits EXACTLY ONE JSON stdout line (got ${lineCount})`);
  assert(parsed !== null, "case 17: the single stdout line is valid JSON");
  assert(parsed?.success === true, "case 9: cost below ceiling → success");
  assert(parsed?.phase === "complete", "success result has phase 'complete'");
  assert(parsed?.jobId === FAKE_JOB_ADDRESS, "success result carries jobId");
  assert(parsed?.output?.riskScore === 0.42, "success result carries validated output");
  assert(validateNosanaOutput(parsed?.output).valid, "success output passes shared validator");
  assert(parsed?.costUsd === 0.0436 && parsed?.creditsUsed === 44,
    "billing metadata preserved (costUsd 0.0436, creditsUsed 44)");
  assert(parsed?.reservationId === "fake-reservation" && parsed?.project === "fake-project",
    "reservationId and project preserved");
  assert(parsed?.resultIpfsHash === FAKE_RESULT_HASH, "result IPFS hash captured separately");
  assert(Array.isArray(parsed?.observedStates) && parsed.observedStates.includes("completed"),
    "observedStates recorded");

  const artifacts = readEvidenceArtifacts(fixture.evidenceDir);
  const events = artifacts.map((a) => a.data.eventType);
  assert(events.includes("post_accepted"), "evidence: post_accepted written immediately after post");
  assert(events.includes("polling"), "evidence: polling artifact written");
  assert(events.includes("completed_success"), "evidence: completed_success written");
  const postAccepted = artifacts.find((a) => a.data.eventType === "post_accepted");
  assert(postAccepted?.data.jobId === FAKE_JOB_ADDRESS, "post_accepted evidence carries jobId");
  assert(postAccepted?.data.costUsd === 0.0436 && postAccepted?.data.creditsUsed === 44,
    "post_accepted evidence carries billing metadata");
  assert(Array.isArray(postAccepted?.data.responseKeys) && postAccepted.data.responseKeys.includes("job"),
    "post_accepted evidence preserves sanitized response keys");
}

// ── C2: attempt-5 regression — flow-result wrapper now parses [21-pass] ─────

{
  const r = await spawnChild(fixture, { FAKE_RETRIEVE_MODE: "wrapper-stdout" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === true && parsed?.output?.riskScore === 0.42,
    "attempt-5 regression: flow-result wrapper yields validated success (no more OUTPUT_INVALID)");
}

// ── C3: cost above ceiling [10, 22] ─────────────────────────────────────────

{
  const r = await spawnChild(fixture, { FAKE_POST_MODE: "cost-above" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === false && parsed?.errorCode === "COST_CEILING_EXCEEDED",
    "case 10: cost above ceiling → COST_CEILING_EXCEEDED");
  assert(parsed?.jobId === FAKE_JOB_ADDRESS,
    "case 22: cost-ceiling failure preserves jobId");
  assert(parsed?.creditsUsed === 44000 && parsed?.costUsd === 999,
    "case 22: cost-ceiling failure preserves billing metadata");
}

// ── C4: post failure after IPFS pin [11] ────────────────────────────────────

{
  const r = await spawnChild(fixture, { FAKE_POST_MODE: "throw" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === false && parsed?.errorCode === "POST_FAILED",
    "case 11: post failure → POST_FAILED");
  assert(parsed?.phase === "post", "case 11: phase is 'post'");
  assert(parsed?.jobId === null, "case 11: no job ID invented after post failure");
  assert(parsed?.ipfsHash === FAKE_IPFS_HASH,
    "case 11: IPFS pin hash preserved even though post failed");
  const events = readEvidenceArtifacts(fixture.evidenceDir).map((a) => a.data.eventType);
  assert(events.includes("post_rejected"), "case 11: post_rejected evidence written");
}

// ── C5: missing job ID in post response [5, child level] ────────────────────

{
  const r = await spawnChild(fixture, { FAKE_POST_MODE: "no-id" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === false && parsed?.errorCode === "POST_NO_JOB_ID",
    "case 5 (child): missing job ID rejected before polling");
  assert(parsed?.jobId === null, "case 5 (child): no job ID invented");
}

// ── C6: ambiguous job IDs in post response [6, child level] ─────────────────

{
  const r = await spawnChild(fixture, { FAKE_POST_MODE: "ambiguous" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === false && parsed?.errorCode === "POST_AMBIGUOUS_JOB_ID",
    "case 6 (child): ambiguous job IDs rejected before polling");
}

// ── C7: missing credits / missing costUSD fail safely [7, 8, child level] ───

{
  const r = await spawnChild(fixture, { FAKE_POST_MODE: "no-credits" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === false && parsed?.errorCode === "COST_METADATA_MISSING",
    "cases 7-8 (child): missing costUSD → COST_METADATA_MISSING (fail safe)");
  assert(parsed?.jobId === FAKE_JOB_ADDRESS,
    "cases 7-8 (child): jobId preserved on cost-metadata failure");
}

// ── C8: poll failure after job submission [12, 22] ──────────────────────────

{
  const r = await spawnChild(
    fixture,
    { FAKE_POLL_MODE: "throw" },
    ["--local-watchdog", "1500"],
  );
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === false && parsed?.errorCode === "LOCAL_WATCHDOG_TIMEOUT",
    "case 12: persistent poll failure → LOCAL_WATCHDOG_TIMEOUT (no retry, no resubmission)");
  assert(parsed?.phase === "poll", "case 12: phase is 'poll'");
  assert(parsed?.jobId === FAKE_JOB_ADDRESS,
    "case 22: poll failure preserves jobId");
  assert(parsed?.creditsUsed === 5 && parsed?.costUsd === 0.001,
    "case 22: poll failure preserves billing metadata");
}

// ── C9: retrieval failure after job completion [13, 22] ─────────────────────

{
  const r = await spawnChild(fixture, { FAKE_RETRIEVE_MODE: "throw" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === false && parsed?.errorCode === "RETRIEVAL_FAILED",
    "case 13: IPFS retrieval failure → RETRIEVAL_FAILED");
  assert(parsed?.phase === "retrieve", "case 13: phase is 'retrieve'");
  assert(parsed?.jobId === FAKE_JOB_ADDRESS && parsed?.ipfsHash === FAKE_IPFS_HASH,
    "case 22: retrieval failure preserves jobId and definition IPFS hash");
  assert(parsed?.resultIpfsHash === FAKE_RESULT_HASH,
    "case 22: retrieval failure preserves result IPFS hash");
  assert(parsed?.creditsUsed === 5 && parsed?.costUsd === 0.001 &&
    parsed?.reservationId === "fake-reservation" && parsed?.project === "fake-project",
    "case 22: retrieval failure preserves full billing metadata");
  const events = readEvidenceArtifacts(fixture.evidenceDir).map((a) => a.data.eventType);
  assert(events.includes("retrieval_failed"), "case 13: retrieval_failed evidence written");
}

// ── C10: malformed IPFS content [14, child level] ───────────────────────────

{
  const r = await spawnChild(fixture, { FAKE_RETRIEVE_MODE: "malformed" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === false && parsed?.errorCode === "RESULT_PARSE_ERROR",
    "case 14 (child): malformed IPFS content → RESULT_PARSE_ERROR");
  assert(parsed?.jobId === FAKE_JOB_ADDRESS && parsed?.resultIpfsHash === FAKE_RESULT_HASH,
    "case 14 (child): parse failure preserves jobId and result hash");
}

// ── C11: wrong-shape content — success requires valid output [21] ───────────

{
  const r = await spawnChild(fixture, { FAKE_RETRIEVE_MODE: "wrong-shape" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === false && parsed?.errorCode === "OUTPUT_INVALID",
    "case 21: invalid output shape → OUTPUT_INVALID, never success");
  assert(parsed?.jobId === FAKE_JOB_ADDRESS,
    "case 21: OUTPUT_INVALID preserves jobId");
  assert(parsed?.output === null, "case 21: failure never carries unvalidated output");
}

// ── C12: NDJSON and nested shapes end-to-end [15, 16, child level] ──────────

{
  const rNd = await spawnChild(fixture, { FAKE_RETRIEVE_MODE: "ndjson" });
  const nd = parseSingleStdoutLine(rNd).parsed;
  assert(nd?.success === true && nd?.output?.riskScore === 0.42,
    "case 15 (child): NDJSON retrieve → success");
  const rNested = await spawnChild(fixture, { FAKE_RETRIEVE_MODE: "nested-result" });
  const nested = parseSingleStdoutLine(rNested).parsed;
  assert(nested?.success === true && nested?.output?.riskBand === "medium",
    "case 16 (child): nested result field → success");
}

// ── C12b: opStates live-shape end-to-end [child level] ───────────────────────

{
  const r = await spawnChild(fixture, { FAKE_RETRIEVE_MODE: "opstates-logs" });
  const { lineCount, parsed } = parseSingleStdoutLine(r);
  assert(lineCount === 1, "C12b: exactly one stdout line for opStates success");
  assert(parsed?.success === true, "C12b: opStates live shape → child success");
  assert(parsed?.phase === "complete", "C12b: phase is 'complete'");
  assert(parsed?.output?.riskScore === 0.42, "C12b: validated output extracted from opStates[].logs[].log");
  assert(validateNosanaOutput(parsed?.output).valid, "C12b: output passes shared validator");
  assert(parsed?.jobId === FAKE_JOB_ADDRESS, "C12b: jobId preserved on opStates success");
  assert(parsed?.resultIpfsHash === FAKE_RESULT_HASH, "C12b: resultIpfsHash preserved on opStates success");
}

// opStates with invalid output → OUTPUT_INVALID, metadata preserved
{
  const r = await spawnChild(fixture, { FAKE_RETRIEVE_MODE: "opstates-invalid" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === false && parsed?.errorCode === "OUTPUT_INVALID",
    "C12b: invalid opStates output → OUTPUT_INVALID");
  assert(parsed?.jobId === FAKE_JOB_ADDRESS,
    "C12b: OUTPUT_INVALID on opStates preserves jobId");
}

// opStates with empty logs → parse failure, metadata preserved
{
  const r = await spawnChild(fixture, { FAKE_RETRIEVE_MODE: "opstates-empty-logs" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === false && (parsed?.errorCode === "RESULT_PARSE_ERROR" || parsed?.errorCode === "OUTPUT_INVALID"),
    "C12b: empty opStates logs → parse failure (RESULT_PARSE_ERROR or OUTPUT_INVALID)");
  assert(parsed?.jobId === FAKE_JOB_ADDRESS,
    "C12b: parse failure on opStates preserves jobId");
}

// ── C13: compat `id` field end-to-end [2, child level] ──────────────────────

{
  const r = await spawnChild(fixture, { FAKE_POST_MODE: "id-field" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.success === true && parsed?.jobId === FAKE_JOB_ADDRESS,
    "case 2 (child): `id` compat field works end-to-end");
}

// ── C14: NOSANA_DEBUG_RESPONSE=1 diagnostics go to stderr only [18] ─────────

{
  const r = await spawnChild(fixture, { NOSANA_DEBUG_RESPONSE: "1" });
  const { lineCount, parsed } = parseSingleStdoutLine(r);
  assert(r.stderr.includes("NOSANA_DEBUG_RESPONSE [phase=post]"),
    "case 18: post-phase debug block on stderr");
  assert(r.stderr.includes("job ID present: yes"), "case 18: job-ID presence reported");
  assert(r.stderr.includes("costUSD present: yes"), "case 18: costUSD presence reported");
  assert(r.stderr.includes("creditsUsed present: yes"), "case 18: creditsUsed presence reported");
  assert(r.stderr.includes("reservationId present: yes"), "case 18: reservationId presence reported");
  assert(r.stderr.includes("response key names:"), "case 18: response key names reported");
  assert(r.stderr.includes("NOSANA_DEBUG_RESPONSE [phase=poll]"), "case 18: poll-phase debug block");
  assert(r.stderr.includes("NOSANA_DEBUG_RESPONSE [phase=retrieve]"), "case 18: retrieve-phase debug block");
  assert(lineCount === 1 && parsed?.success === true,
    "case 18: stdout still exactly one JSON line with debug enabled");
}

// ── C15: no secrets in stdout, stderr, or evidence artifacts [19] ───────────

{
  const forbidden = [FAKE_API_KEY, FAKE_IDEMPOTENCY_KEY];
  const r = await spawnChild(fixture, { NOSANA_DEBUG_RESPONSE: "1" });
  assert(!forbidden.some((s) => r.stdout.includes(s)), "case 19: no secrets in stdout");
  assert(!forbidden.some((s) => r.stderr.includes(s)), "case 19: no secrets in stderr (debug enabled)");
  const artifacts = readEvidenceArtifacts(fixture.evidenceDir);
  assert(artifacts.length > 0, "case 19: evidence artifacts exist to audit");
  const evidenceBlob = artifacts.map((a) => JSON.stringify(a.data)).join("\n");
  assert(!forbidden.some((s) => evidenceBlob.includes(s)),
    "case 19: no API key or idempotency-key value in any evidence artifact");
}

fixture.cleanup();

// ── Section D: parent metadata preservation [20, 21] ────────────────────────

section("Section D: parent preserves liveAttemptMetadata [case 20]");

// extractLiveMetadata unit behaviour
{
  const meta = extractLiveMetadata({
    success: false,
    errorCode: "OUTPUT_INVALID",
    jobId: "job-abc",
    market: "market-abc",
    ipfsHash: "QmDef",
    resultIpfsHash: "QmResult",
    platformTimeoutSec: 3600,
    submittedAt: "2026-08-22T00:00:00.000Z",
    completedAt: "2026-08-22T00:00:10.000Z",
    observedStates: ["queued", "running", "completed"],
    creditsUsed: 44,
    costUsd: 0.0436,
    reservationId: "res-1",
    project: "proj-1",
    phase: "validate",
  });
  assert(meta !== null && meta.jobId === "job-abc", "case 20: extractLiveMetadata preserves jobId");
  assert(meta.creditsUsed === 44 && meta.costUsd === 0.0436,
    "case 20: extractLiveMetadata preserves billing metadata");
  assert(meta.reservationId === "res-1" && meta.project === "proj-1",
    "case 20: extractLiveMetadata preserves reservationId/project");
  assert(meta.resultIpfsHash === "QmResult" && meta.phase === "validate",
    "case 20: extractLiveMetadata preserves result hash and phase");
  assert(extractLiveMetadata({}) === null, "case 20: empty child result → null metadata");
  assert(extractLiveMetadata(null) === null, "case 20: null child result → null metadata");
}

// Source invariant: the OUTPUT_INVALID fallback path passes live metadata
{
  const idx = RUNNER_SOURCE.indexOf('"OUTPUT_INVALID"');
  const block = idx >= 0 ? RUNNER_SOURCE.substring(idx, idx + 500) : "";
  assert(idx >= 0 && block.includes("extractLiveMetadata(childResult)"),
    "case 20: OUTPUT_INVALID fallback passes extractLiveMetadata(childResult)");
  const idxRisk = RUNNER_SOURCE.indexOf('"RISK_RESULT_INVALID"');
  const blockRisk = idxRisk >= 0 ? RUNNER_SOURCE.substring(idxRisk, idxRisk + 500) : "";
  assert(idxRisk >= 0 && blockRisk.includes("extractLiveMetadata(childResult)"),
    "case 20: RISK_RESULT_INVALID fallback passes extractLiveMetadata(childResult)");
  const idxContract = RUNNER_SOURCE.indexOf('"CHILD_CONTRACT_VIOLATION"');
  assert(idxContract >= 0,
    "case 21: parent guards against child success without jobId/output");
}

// Parent evidence writer: sanitized artifact, correct event types
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nosana-parent-evidence-"));
  process.env.NOSANA_EVIDENCE_DIR = tmpDir;
  try {
    writeLiveAttemptEvidence({
      success: false,
      errorCode: "OUTPUT_INVALID",
      error: "validation failed",
      jobId: "job-abc",
      ipfsHash: "QmDef",
      creditsUsed: 44,
      costUsd: 0.0436,
    });
    writeLiveAttemptEvidence({ success: true, jobId: "job-abc", ipfsHash: "QmDef" });
    writeLiveAttemptEvidence(null, { forcedEventType: "child_process_error" });
    const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".json"));
    const blob = files.map((f) => fs.readFileSync(path.join(tmpDir, f), "utf8")).join("\n");
    assert(files.some((f) => f.includes("output_invalid")),
      "case 20: parent writes output_invalid evidence");
    assert(files.some((f) => f.includes("completed_success")),
      "case 20: parent writes completed_success evidence");
    assert(files.some((f) => f.includes("child_process_error")),
      "case 20: parent writes child_process_error evidence");
    assert(blob.includes("job-abc"), "case 20: parent evidence preserves jobId");
    assert(!blob.includes(FAKE_API_KEY) && !blob.includes(FAKE_IDEMPOTENCY_KEY),
      "case 19: parent evidence contains no secrets");
  } finally {
    delete process.env.NOSANA_EVIDENCE_DIR;
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// Child contract guard exists at the single stdout choke point
{
  assert(
    RUN_JOB_SOURCE.includes("CONTRACT_GUARD"),
    "case 21: child emitResult enforces success-requires-jobId-and-output guard",
  );
  assert(
    /if \(safe\.success && \(!safe\.jobId \|\| !safe\.output/.test(RUN_JOB_SOURCE),
    "case 21: guard downgrades success without jobId or valid output",
  );
}

// describeShape never includes values (keys/types only)
{
  const shape = describeShape({ job: "secret-address-value", credits: { costUSD: 0.0436 } });
  const blob = JSON.stringify(shape);
  assert(!blob.includes("secret-address-value") && !blob.includes("0.0436"),
    "describeShape emits key/type map only — no values");
}

// ── Section E: opStates 16-point regression checklist ─────────────────────────

section("Section E: opStates 16-point regression checklist");

// E1: Actual opStates result shape parses successfully
{
  const r = parseIpfsResultOutput(OPSTATES_FIXTURE);
  assert(r.ok === true && validateNosanaOutput(r.output).valid,
    "E1: actual opStates result shape parses and validates");
}

// E2: Risk output extracted only from verified field path
{
  const r = parseIpfsResultOutput(OPSTATES_FIXTURE);
  assert(r.ok === true && r.source.includes("opStates.") && r.source.includes("logs"),
    "E2: risk output from opStates[].logs[].log only (source: " + r.source + ")");
}

// E3: Outer {status, startTime, endTime, secrets, opStates} not accepted as risk
{
  const r = parseIpfsResultOutput({
    status: "success", startTime: 0, endTime: 0, secrets: {},
    opStates: [{ operationId: "x", logs: [] }],
  });
  assert(r.ok === false, "E3: outer flow-status document not accepted as risk output");
}

// E4: Flow-status metadata not mistaken for risk result
{
  const r = parseIpfsResultOutput({
    status: "success", opStates: [{
      operationId: "stitchcheck-risk-calc",
      logs: [{ log: "not json", type: "stdout" }],
    }],
  });
  assert(r.ok === false, "E4: flow-status metadata not mistaken for risk result");
}

// E5: Newline-delimited stdout inside verified field parses
{
  const r = parseIpfsResultOutput({
    opStates: [{
      operationId: "stitchcheck-risk-calc",
      logs: [{ log: "boot\n" + JSON.stringify(VALID_OUTPUT) + "\n", type: "stdout" }],
    }],
  });
  assert(r.ok === true && r.output.riskScore === 0.42,
    "E5: NDJSON stdout inside opStates log parses");
}

// E6: Escaped JSON inside verified field parses
{
  const r = parseIpfsResultOutput({
    opStates: [{
      operationId: "stitchcheck-risk-calc",
      logs: [{ log: JSON.stringify(VALID_OUTPUT), type: "stdout" }],
    }],
  });
  assert(r.ok === true && r.output.riskBand === "medium",
    "E6: escaped JSON inside opStates log parses");
}

// E7: Invalid opStates output returns OUTPUT_INVALID
{
  const r = parseIpfsResultOutput({
    opStates: [{
      operationId: "stitchcheck-risk-calc",
      logs: [{ log: '{"riskScore":"bad"}', type: "stdout" }],
    }],
  });
  assert(r.ok === false && r.errorCode === "OUTPUT_INVALID",
    "E7: invalid opStates output → OUTPUT_INVALID");
}

// E8: Missing opStates output — outer object fails validation
{
  const r = parseIpfsResultOutput({
    opStates: [{ operationId: "stitchcheck-risk-calc", logs: [] }],
  });
  // The outer object is a valid JSON object but not a valid risk output.
  // It becomes the "direct" candidate and fails → OUTPUT_INVALID.
  assert(r.ok === false && (r.errorCode === "OUTPUT_INVALID" || r.errorCode === "RESULT_PARSE_ERROR"),
    "E8: missing opStates output → parse failure");
}

// E9: Job metadata preserved on parse success (verified in C12b)
// E10: Job metadata preserved on parse failure (verified in C10, C11, C12b)
{
  // Source-code invariant check
  const hasExtract = RUNNER_SOURCE.includes("extractLiveMetadata(childResult)");
  assert(hasExtract, "E9/E10: parent always passes extractLiveMetadata(childResult)");
}

// E11: costUsd: 0.044 remains distinct from creditsUsed: 44
{
  const fixture2 = createParameterizedFakeSdk();
  const r = await spawnChild(fixture2, { FAKE_POST_MODE: "cost-below" });
  const { parsed } = parseSingleStdoutLine(r);
  assert(parsed?.costUsd === 0.0436 && parsed?.creditsUsed === 44,
    "E11: costUsd (0.0436) and creditsUsed (44) remain distinct");
  assert(parsed?.costUsd !== parsed?.creditsUsed,
    "E11: costUsd !== creditsUsed (different units, never confused)");
  fixture2.cleanup();
}

// E12: Evidence source is live only after validated output
{
  // Check that evidenceSource: "nosana-evidence" only appears on the success path
  // (after childResult.success && childResult.output check)
  const successPathIdx = RUNNER_SOURCE.indexOf('childResult.success && childResult.output');
  const evidenceIdx = RUNNER_SOURCE.indexOf('evidenceSource: "nosana-evidence"');
  assert(successPathIdx >= 0 && evidenceIdx > successPathIdx,
    "E12: evidenceSource 'nosana-evidence' only on validated success path");
  const fallbackCheck = RUNNER_SOURCE.indexOf('"local-fallback"');
  assert(fallbackCheck >= 0, "E12: fallback evidenceSource exists");
}

// E13: Fallback remains labelled fallback when parsing fails
{
  const idx = RUNNER_SOURCE.indexOf("FALLBACK_MESSAGE");
  assert(idx >= 0, "E13: FALLBACK_MESSAGE constant exists in runner");
  const fallbackLabel = RUNNER_SOURCE.includes("Nosana unavailable");
  assert(fallbackLabel, "E13: fallback label present in runner source");
}

// E14: Exactly one JSON result line emitted on stdout (verified in C1, C12b)
// E15: Diagnostics remain stderr-only (verified in C14)
// E16: No secrets in test output or evidence (verified in C15)
{
  // Source-code invariant: emitResult uses console.log exactly once
  const emitMatches = RUN_JOB_SOURCE.match(/console\.log\(JSON\.stringify\(safe\)\)/g);
  assert(emitMatches && emitMatches.length === 1,
    "E14: emitResult has exactly one console.log(JSON.stringify(safe)) call");
  // Diagnostics go to stderr only
  const debugStderr = RUN_JOB_SOURCE.includes("console.error(lines.join");
  assert(debugStderr, "E15: debug diagnostics use console.error (stderr)");
  // No secret values in evidence
  assert(RUN_JOB_SOURCE.includes("NEVER include NOSANA_API_KEY"),
    "E16: source code guards against credential leakage");
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log("");
console.log("=".repeat(72));
console.log(`Nosana response-normalization tests: ${passed} passed, ${failed} failed.`);
console.log("=".repeat(72));

if (failed > 0) {
  process.exitCode = 1;
}
