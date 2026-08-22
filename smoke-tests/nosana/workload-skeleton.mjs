// Local-only Nosana workload lifecycle skeleton for the StitchCheck P0
// smoke test (docs/smoke-test-nosana.md).
//
// This script SIMULATES the workload lifecycle locally:
//   pending -> running -> completed | failed | timed_out
// (plus "rejected" for inputs that fail local validation before any
// simulated workload starts). It records state transitions to a local
// results JSON and NEVER contacts Nosana or any network endpoint.
//
// Hard guarantees:
// - Zero network code: no fetch/http/https/net/socket imports or calls.
// - Zero dependencies: Node.js built-ins only.
// - Zero credentials read: no .env or secret file is ever touched.
// - All recorded output is a synthetic local placeholder, NOT Nosana
//   evidence, and the heuristic-risk disclaimer is surfaced on every run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLACEHOLDER_LABEL,
  HEURISTIC_DISCLAIMER,
  validateRiskRequest,
  validateRiskResult,
} from "./schema-validator.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(here, "fixtures");
const RESULTS_DIR = path.join(here, "results");
const RESULTS_PATH = path.join(RESULTS_DIR, "results.json");

const SIMULATED_TIMEOUT_BUDGET_MS = 5000;

function now() {
  return new Date().toISOString();
}

// Deterministic toy heuristic over the synthetic input only. Never a real
// prediction; exists purely so the "completed" scenario has a plausible
// labelled shape.
function toyHeuristic(request) {
  const minutes = request.connectionDurationMinutes;
  if (minutes < 60) return { band: "high", score: 0.78 };
  if (minutes <= 120) return { band: "medium", score: 0.42 };
  return { band: "low", score: 0.18 };
}

function buildResult(common, overrides) {
  return {
    correlationId: common.correlationId,
    workloadStatus: "error",
    jobOrServiceReference: null,
    riskBand: "unavailable",
    riskScore: null,
    heuristicDisclaimer: `${HEURISTIC_DISCLAIMER} ${PLACEHOLDER_LABEL}`,
    failureCascadeExplanation: "",
    datasetVersion: common.datasetVersion,
    fallbackUsed: false,
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}

// Simulates one workload lifecycle. All "states" are local recordings; no
// real delay, job, or external call happens.
function simulateRun(fixtureEntry) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, fixtureEntry.file), "utf8"));
  const request = fixture.riskRequest;
  const startedAt = now();
  const transitions = [{ state: "pending", at: startedAt }];
  const common = {
    correlationId: request?.correlationId ?? fixture.fixtureId,
    datasetVersion: request?.staticHistoricalDatasetVersion ?? "synthetic-demo-v0",
  };
  const reference = `synthetic-local-ref-${fixture.fixtureId} (NOT a real Nosana job reference)`;

  const validation = validateRiskRequest(request);
  if (!validation.valid) {
    // NOS-05 style: rejected before any (simulated) workload starts.
    transitions.push({ state: "rejected", at: now() });
    return {
      fixtureId: fixture.fixtureId,
      testIds: fixtureEntry.testIds,
      simulatedScenario: "rejected",
      startedAt,
      endedAt: now(),
      stateTransitions: transitions,
      simulatedStatesObserved: ["pending", "rejected"],
      validationIssues: validation.issues,
      riskResult: buildResult(common, {
        failureCascadeExplanation:
          "The request failed local validation before any workload could start: " +
          validation.issues.join("; ") +
          ". Understandable feedback is surfaced and the request can be corrected and replayed.",
        errorCode: "SIMULATED_INVALID_REQUEST",
        errorMessage: "Simulated local validation error (placeholder scenario; nothing was executed against Nosana).",
      }),
    };
  }

  transitions.push({ state: "running", at: now() });
  const scenario = fixtureEntry.simulatedScenario;
  let riskResult;
  let terminalState;

  if (scenario === "success") {
    terminalState = "completed";
    const { band, score } = toyHeuristic(request);
    riskResult = buildResult(common, {
      workloadStatus: "completed",
      jobOrServiceReference: reference,
      riskBand: band,
      riskScore: score,
      failureCascadeExplanation:
        `A ${request.connectionDurationMinutes}-minute connection at ${request.connectionAirport} ` +
        `falls in the "${band}" band of the synthetic static dataset. This is a heuristic indication ` +
        "only, not a prediction or guarantee, and no booking, order, or payment is involved.",
    });
  } else if (scenario === "unavailable") {
    terminalState = "completed";
    riskResult = buildResult(common, {
      workloadStatus: "completed",
      jobOrServiceReference: reference,
      fallbackUsed: true,
      failureCascadeExplanation:
        "The simulated dataset slice has no record for this connection airport, so no risk band can be " +
        "produced. No score is invented; a labelled fallback path (re-run or proceed without risk " +
        "guidance) is offered.",
    });
  } else if (scenario === "timeout") {
    terminalState = "timed_out";
    riskResult = buildResult(common, {
      workloadStatus: "timeout",
      jobOrServiceReference: reference,
      fallbackUsed: true,
      failureCascadeExplanation:
        `The simulated workload exceeded the demo time budget (${SIMULATED_TIMEOUT_BUDGET_MS} ms), so no ` +
        "risk band or score exists and none is invented. A labelled replay/fallback path is offered.",
      errorCode: "SIMULATED_WORKLOAD_TIMEOUT",
      errorMessage: "Simulated workload timeout (local placeholder scenario; no real workload was executed).",
    });
  } else {
    // scenario === "failure"
    terminalState = "failed";
    riskResult = buildResult(common, {
      workloadStatus: "error",
      jobOrServiceReference: reference,
      failureCascadeExplanation:
        "The simulated workload failed before producing a result, so no risk band or score exists and " +
        "none is invented. A labelled replay/retry path is offered to the user.",
      errorCode: "SIMULATED_WORKLOAD_FAILURE",
      errorMessage: "Simulated workload internal error (local placeholder scenario; no real workload was executed).",
    });
  }

  transitions.push({ state: terminalState, at: now() });

  return {
    fixtureId: fixture.fixtureId,
    testIds: fixtureEntry.testIds,
    simulatedScenario: scenario,
    startedAt,
    endedAt: now(),
    stateTransitions: transitions,
    simulatedStatesObserved: transitions.map((t) => t.state),
    validationIssues: [],
    riskResult,
  };
}

function run() {
  console.log("=".repeat(72));
  console.log("StitchCheck Nosana workload skeleton — LOCAL SIMULATION ONLY");
  console.log(`DISCLAIMER: ${HEURISTIC_DISCLAIMER}`);
  console.log(`LABEL: ${PLACEHOLDER_LABEL}`);
  console.log("No Nosana call, job submission, deployment, credential, or network");
  console.log("access exists in this script or anywhere in this directory.");
  console.log("=".repeat(72));

  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "manifest.json"), "utf8"));
  const runs = manifest.requestFixtures.map((entry) => {
    const run = simulateRun(entry);
    const validation = validateRiskResult(run.riskResult);
    run.resultSchemaValid = validation.valid;
    run.resultSchemaIssues = validation.issues;
    console.log(
      `- ${run.fixtureId}: ${run.simulatedStatesObserved.join(" -> ")} ` +
        `(scenario: ${run.simulatedScenario}, result schema ${validation.valid ? "valid" : "INVALID: " + validation.issues.join("; ")})`,
    );
    return run;
  });

  const statesObserved = [...new Set(runs.flatMap((r) => r.simulatedStatesObserved))].sort();

  const record = {
    harness: "stitchcheck-nosana-workload-skeleton",
    harnessVersion: "0.1.0-local",
    phase: "preparation",
    executedAgainstNosana: false,
    nosanaCallOrJobOrDeploymentExists: false,
    networkCallsMade: 0,
    credentialsRead: 0,
    syntheticDemo: true,
    disclaimer: `${HEURISTIC_DISCLAIMER} Local results are heuristic placeholders only, not Nosana evidence.`,
    placeholderLabel: PLACEHOLDER_LABEL,
    simulatedStatesObserved: statesObserved,
    runAt: now(),
    runs,
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(record, null, 2) + "\n", "utf8");

  console.log("");
  console.log(`Recorded ${runs.length} simulated run(s) to ${path.relative(here, RESULTS_PATH)}.`);
  console.log(`Simulated lifecycle states observed: ${statesObserved.join(", ")}`);
  console.log(`DISCLAIMER (repeated): ${record.disclaimer}`);
}

run();
