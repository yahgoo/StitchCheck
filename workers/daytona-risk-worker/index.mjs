// Daytona risk worker — entry point.
//
// Accepts anonymized itinerary/risk input, performs deterministic
// dependency-graph recovery computation, and writes sanitized output.
//
// This script runs INSIDE the Daytona sandbox (offline-only for Stage 2).
// It does NOT call Daytona, Atlas, Nosana, Gemini, OpenRouter, or any
// external service. No credentials, no network, no booking, no payment.
//
// Input:  /worker/input/risk-request.json  (or via stdin/env)
// Output: /worker/output/result.json
//
// Environment variables (set by orchestrator, optional):
//   CORRELATION_ID    — unique identifier for this run (overrides input)
//   EXECUTION_MODE    — execution mode override (e.g. daytona-offline-mock)
//   TIMEOUT_MS        — computation timeout in milliseconds

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateInput, MAX_INPUT_BYTES, MAX_REPLAN_ATTEMPTS } from './input-schema.mjs';
import { computeRiskMetrics, deriveRiskBand } from './risk-engine.mjs';
import { buildDependencyGraph } from './graph-builder.mjs';
import { evaluateRecoveryPlan } from './recovery-evaluator.mjs';
import { sanitizeOutput, validateSanitized, validateOutputSafety } from './sanitize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const OUTPUT_FILE = join(OUTPUT_DIR, 'result.json');
const INPUT_FILE = join(__dirname, 'input', 'risk-request.json');

/* ── Configuration ── */

const DEFAULT_TIMEOUT_MS = 5000;
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '', 10) || DEFAULT_TIMEOUT_MS;

/* ── Error result builder ── */

function buildErrorResult(params) {
  const {
    errorCode,
    errorMessage,
    correlationId,
    executionMode,
    latencyMs,
    timeoutMs,
  } = params;

  return {
    resultId: `error-${correlationId}`,
    correlationId,
    workloadStatus: 'error',
    riskBand: 'critical',
    riskScore: null,
    dependencyGraph: { nodes: [], rootTriggerId: null, edges: [] },
    scenariosEvaluated: 0,
    assumptions: ['Error occurred before computation could complete'],
    constraintViolations: [errorMessage],
    recoveryPlan: null,
    rePlanAttemptCount: 0,
    maxRePlanAttempts: MAX_REPLAN_ATTEMPTS,
    executionEnvironment: executionMode,
    executionTimestamp: new Date().toISOString(),
    timeoutMs,
    latencyMs: latencyMs || 0,
    failureState: {
      errorCode,
      errorMessage,
      isTerminal: true,
    },
    provenance: {
      evidenceSource: 'daytona-sandbox',
      provider: 'daytona-risk-worker',
      executed: false,
      fallbackUsed: true,
      readOnly: true,
      label: 'Daytona sandbox \u2014 risk analysis computed locally, no live risk service called',
    },
    externalWriteOccurred: false,
    sanitized: true,
    heuristicDisclaimer: 'Computed result — not live provider evidence',
    datasetVersion: 'daytona-risk-worker-v1',
    fallbackUsed: true,
    errorCode,
    errorMessage,
    jobOrServiceReference: null,
  };
}

/* ── Main computation ── */

async function main() {
  const startTime = Date.now();
  const executionMode = process.env.EXECUTION_MODE || 'daytona-offline-mock';
  const correlationId = process.env.CORRELATION_ID || 'unknown';
  const timeoutMs = TIMEOUT_MS;

  console.log(`[risk-worker] Starting risk computation for correlationId=${correlationId}`);
  console.log(`[risk-worker] Execution mode: ${executionMode}`);

  // Step 1: Read input
  let rawInput;
  try {
    rawInput = await readFile(INPUT_FILE, 'utf8');
  } catch (err) {
    // If no input file, try reading from stdin (for testing)
    // For now, produce an error result
    const latencyMs = Date.now() - startTime;
    const errorResult = buildErrorResult({
      errorCode: 'input_unavailable',
      errorMessage: `Could not read input file: ${err.code || err.message}`,
      correlationId,
      executionMode,
      latencyMs,
      timeoutMs,
    });
    await writeOutput(errorResult, correlationId);
    return;
  }

  const rawByteLength = Buffer.byteLength(rawInput, 'utf8');

  // Step 2: Parse JSON
  let input;
  try {
    input = JSON.parse(rawInput);
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorResult = buildErrorResult({
      errorCode: 'malformed_input',
      errorMessage: `Invalid JSON: ${err.message}`,
      correlationId,
      executionMode,
      latencyMs,
      timeoutMs,
    });
    await writeOutput(errorResult, correlationId);
    return;
  }

  // Step 3: Validate input
  const validation = validateInput(input, rawByteLength);
  if (!validation.valid) {
    const latencyMs = Date.now() - startTime;
    const errorResult = buildErrorResult({
      errorCode: validation.errorCode,
      errorMessage: validation.errorMessage,
      correlationId,
      executionMode,
      latencyMs,
      timeoutMs,
    });
    await writeOutput(errorResult, correlationId);
    return;
  }

  // Step 4: Timeout guard
  if (Date.now() - startTime > timeoutMs) {
    const latencyMs = Date.now() - startTime;
    const errorResult = buildErrorResult({
      errorCode: 'timeout',
      errorMessage: `Computation exceeded timeout of ${timeoutMs}ms`,
      correlationId,
      executionMode,
      latencyMs,
      timeoutMs,
    });
    await writeOutput(errorResult, correlationId);
    return;
  }

  // Step 5: Deterministic risk computation
  const effectiveCorrelationId = input.itineraryId || correlationId;
  const rePlanAttemptCount = typeof input.rePlanAttempts === 'number' ? input.rePlanAttempts : 0;

  const metrics = computeRiskMetrics({
    itineraryId: input.itineraryId,
    deterministicSeed: input.deterministicSeed,
    flightLegs: input.flightLegs,
    connectionDurationMinutes: input.connectionDurationMinutes ?? null,
    scenarioLimit: input.scenarioLimit,
  });

  // Step 6: Determine terminal state
  const isTerminalNoPlan =
    metrics.riskBand === 'error' ||
    metrics.riskBand === 'timeout' ||
    !['low', 'medium', 'high', 'critical'].includes(metrics.riskBand);

  // Step 7: Build dependency graph
  const { dependencyGraph, edges } = buildDependencyGraph({
    flightLegs: input.flightLegs,
    downstreamCommitments: input.downstreamCommitments || [],
    hotelCheckinCutoff: input.hotelCheckinCutoff || null,
    riskScore: metrics.riskScore,
    isTerminalNoPlan,
  });

  // Step 8: Evaluate recovery plan
  const recoveryResult = evaluateRecoveryPlan({
    candidates: input.candidateRecoveryOptions || [],
    riskScore: metrics.riskScore,
    riskBand: metrics.riskBand,
    isTerminalNoPlan,
    rePlanAttemptCount,
    rng: metrics.rng,
    flightLegs: input.flightLegs,
  });

  // Step 9: Assemble result
  const latencyMs = Date.now() - startTime;
  const resultId = `risk-${effectiveCorrelationId}-${metrics.numericSeed}`;

  const result = {
    resultId,
    correlationId: effectiveCorrelationId,
    workloadStatus: isTerminalNoPlan ? 'no-safe-plan' : (recoveryResult.recoveryPlan ? 'success' : 'no-safe-plan'),
    jobOrServiceReference: null,
    riskBand: metrics.riskBand,
    riskScore: metrics.riskScore,
    heuristicDisclaimer: 'Computed result — not live provider evidence',
    failureCascadeExplanation: isTerminalNoPlan
      ? 'Terminal state reached — downstream cascade cannot be resolved'
      : `Risk score ${metrics.riskScore} (${metrics.riskBand}) drives downstream cascade across ${dependencyGraph.nodes.length} nodes`,
    datasetVersion: 'daytona-risk-worker-v1',
    fallbackUsed: true,
    errorCode: null,
    errorMessage: null,

    /* Evidence tracking */
    evidenceSource: 'daytona-sandbox',
    provider: 'daytona-risk-worker',
    executed: false,
    evidenceLabel: 'Daytona offline mock — deterministic risk computation',
    simulationCount: metrics.scenariosEvaluated + recoveryResult.scenariosEvaluated,
    assumptions: metrics.assumptions,
    latencyMs,

    /* Dependency graph (core-compatible) */
    dependencyGraph: {
      ...dependencyGraph,
      edges,
    },

    /* Recovery plan */
    scenariosEvaluated: metrics.scenariosEvaluated + recoveryResult.scenariosEvaluated,
    constraintViolations: recoveryResult.constraintViolations,
    recoveryPlan: recoveryResult.recoveryPlan,
    rePlanAttemptCount: recoveryResult.rePlanAttemptCount,
    maxRePlanAttempts: MAX_REPLAN_ATTEMPTS,
    recoveryExplanation: recoveryResult.explanation,

    /* Execution metadata */
    executionEnvironment: executionMode,
    executionTimestamp: new Date().toISOString(),
    timeoutMs,

    /* Failure state */
    failureState: isTerminalNoPlan
      ? { errorCode: 'no_safe_plan', errorMessage: 'Terminal state — no safe plan available', isTerminal: true }
      : (recoveryResult.recoveryPlan
        ? null
        : { errorCode: 'no_safe_plan', errorMessage: recoveryResult.explanation, isTerminal: false }),

    /* Provenance */
    provenance: {
      evidenceSource: 'daytona-sandbox',
      provider: 'daytona-risk-worker',
      executed: false,
      fallbackUsed: true,
      readOnly: true,
      label: 'Daytona offline mock — deterministic risk computation, no live execution',
    },

    /* Safety guarantee */
    externalWriteOccurred: false,

    /* Sanitization flag */
    sanitized: true,
  };

  // Step 10: Sanitize output
  const sanitized = sanitizeOutput(result);

  // Step 11: Validate sanitized output
  const sanitizationIssues = validateSanitized(sanitized);
  const safetyIssues = validateOutputSafety(sanitized);
  const allIssues = [...sanitizationIssues, ...safetyIssues];

  if (allIssues.length > 0) {
    console.error(`[risk-worker] Sanitization issues: ${allIssues.join(', ')}`);
    // Write a fallback error result
    const fallbackResult = buildErrorResult({
      errorCode: 'sanitization_failed',
      errorMessage: `Output sanitization failed: ${allIssues.join('; ')}`,
      correlationId: effectiveCorrelationId,
      executionMode,
      latencyMs: Date.now() - startTime,
      timeoutMs,
    });
    await writeOutput(fallbackResult, effectiveCorrelationId);
    return;
  }

  // Step 12: Write output
  await writeOutput(sanitized, effectiveCorrelationId);
}

async function writeOutput(result, correlationId) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`[risk-worker] Result written to ${OUTPUT_FILE}`);
  console.log(`[risk-worker] correlationId=${correlationId}, status=${result.workloadStatus}`);
}

main().catch((error) => {
  console.error(`[risk-worker] Fatal error: ${error.message}`);
  // Write a minimal error result if possible
  const errorResult = buildErrorResult({
    errorCode: 'internal_error',
    errorMessage: error.message,
    correlationId: process.env.CORRELATION_ID || 'unknown',
    executionMode: process.env.EXECUTION_MODE || 'daytona-offline-mock',
    latencyMs: 0,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  writeOutput(errorResult, 'unknown').catch(() => {
    process.exit(1);
  });
});
