/* ── Daytona offline risk normalization boundary ──
 *
 *   worker result
 *   → normalized Daytona offline risk result
 *   → existing RiskResult / animation adapter
 *
 * The Daytona risk worker (workers/daytona-risk-worker/) reports
 * evidenceSource: "daytona-sandbox". That literal is NOT part of the
 * RiskResult evidence union, and no live Daytona sandbox has been
 * created in this demo. This module is the single explicit boundary
 * where the worker-shaped result is normalized into the existing
 * RiskResult contract — no `as any`, no unsafe casts, no silent
 * string coercion.
 *
 * Safety rules enforced here:
 *   - Execution mode is ALWAYS 'daytona-offline-mock' (isLive: false).
 *   - 'daytona-live-risk' is never produced: a result may be called
 *     live only after a real Daytona sandbox was created, the worker
 *     ran inside it, its output was downloaded, and the sandbox was
 *     destroyed with lifecycle evidence. None of that exists here.
 *   - No network calls, no credentials, no provider execution. */

import type { RiskResult } from '../../../core/domain';
import type { ExecutionMode, ItineraryContext } from '../../../core/domain';
import { getExecutionModeLabel } from '../../../core/domain';
import {
  riskResultToAnimationData,
} from '../../../core/domain';
import type { RecoveryPlanFromRiskResult } from '../../../core/domain';
import { formatMissingField } from '../../../core/copy/missing-field-labels';

/* ── Structural shape of the Daytona risk worker output ── */

export interface DaytonaWorkerProvenance {
  evidenceSource: string;
  provider: string;
  executed: boolean;
  fallbackUsed: boolean;
  readOnly: boolean;
  label: string;
}

/** Worker result as produced by workers/daytona-risk-worker/index.mjs. */
export interface DaytonaWorkerRiskResult {
  correlationId: string;
  workloadStatus: string;
  jobOrServiceReference: string | null;
  riskBand: string;
  riskScore: number | null;
  heuristicDisclaimer: string;
  failureCascadeExplanation: string;
  datasetVersion: string;
  fallbackUsed: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  /** Raw worker literal — notably 'daytona-sandbox', which the
   *  RiskResult contract does not accept. Handled at this boundary. */
  evidenceSource: string;
  provider: string;
  executed: boolean;
  evidenceLabel: string;
  simulationCount: number;
  assumptions: string[];
  latencyMs: number;
  executionEnvironment: string;
  provenance: DaytonaWorkerProvenance;
  externalWriteOccurred: boolean;
  sanitized: boolean;
}

/* ── Normalized result ── */

export interface NormalizedDaytonaOfflineRiskResult {
  /** Contract-conformant RiskResult for existing panels/adapters. */
  riskResult: RiskResult;
  /** Always 'daytona-offline-mock' at this boundary. */
  executionMode: ExecutionMode;
  /** Always false — no live Daytona execution occurred. */
  isLive: false;
  /** Canonical offline provenance label for UI display. */
  provenanceLabel: string;
  /** The raw worker evidenceSource literal, preserved for traceability. */
  workerEvidenceSource: string;
  /** Always false — the worker guarantees no external write. */
  externalWriteOccurred: false;
}

const OFFLINE_EXECUTION_MODE: ExecutionMode = 'daytona-offline-mock';

const VALID_WORKLOAD_STATUSES: readonly string[] = [
  'success',
  'no-safe-plan',
  'error',
];

/* ── Defensive parse of unknown worker output ── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/**
 * Parses unknown input into a DaytonaWorkerRiskResult.
 * Returns null when the input is not an object — never throws.
 */
export function parseDaytonaWorkerRiskResult(
  raw: unknown,
): DaytonaWorkerRiskResult | null {
  if (!isRecord(raw)) return null;

  const provenanceRaw = isRecord(raw['provenance']) ? raw['provenance'] : {};

  return {
    correlationId: readString(raw['correlationId'], 'unknown'),
    workloadStatus: readString(raw['workloadStatus'], 'error'),
    jobOrServiceReference: readStringOrNull(raw['jobOrServiceReference']),
    riskBand: readString(raw['riskBand'], 'error'),
    riskScore: readNumberOrNull(raw['riskScore']),
    heuristicDisclaimer: readString(
      raw['heuristicDisclaimer'],
      'Computed result — not live provider evidence',
    ),
    failureCascadeExplanation: readString(
      raw['failureCascadeExplanation'],
      formatMissingField('critical'),
    ),
    datasetVersion: readString(raw['datasetVersion'], 'daytona-risk-worker-v1'),
    fallbackUsed: readBoolean(raw['fallbackUsed'], true),
    errorCode: readStringOrNull(raw['errorCode']),
    errorMessage: readStringOrNull(raw['errorMessage']),
    evidenceSource: readString(raw['evidenceSource'], 'daytona-sandbox'),
    provider: readString(raw['provider'], 'daytona-risk-worker'),
    executed: readBoolean(raw['executed'], false),
    evidenceLabel: readString(raw['evidenceLabel'], ''),
    simulationCount: readNumberOrNull(raw['simulationCount']) ?? 0,
    assumptions: readStringArray(raw['assumptions']),
    latencyMs: readNumberOrNull(raw['latencyMs']) ?? 0,
    executionEnvironment: readString(
      raw['executionEnvironment'],
      'daytona-offline-mock',
    ),
    provenance: {
      evidenceSource: readString(provenanceRaw['evidenceSource'], 'daytona-sandbox'),
      provider: readString(provenanceRaw['provider'], 'daytona-risk-worker'),
      executed: readBoolean(provenanceRaw['executed'], false),
      fallbackUsed: readBoolean(provenanceRaw['fallbackUsed'], true),
      readOnly: readBoolean(provenanceRaw['readOnly'], true),
      label: readString(provenanceRaw['label'], ''),
    },
    externalWriteOccurred: readBoolean(raw['externalWriteOccurred'], false),
    sanitized: readBoolean(raw['sanitized'], true),
  };
}

/* ── Normalization boundary ── */

/**
 * Normalizes a Daytona risk worker result into the offline demo contract.
 *
 * The worker reports evidenceSource 'daytona-sandbox', but no live
 * sandbox execution occurred in this demo, so the normalized RiskResult
 * carries evidenceSource 'local-fallback' (the only honest member of the
 * RiskResult evidence union for an offline computation). The raw worker
 * literal is preserved on the wrapper for traceability.
 *
 * The execution mode is forced to 'daytona-offline-mock' with
 * isLive: false regardless of anything the raw payload claims.
 */
export function normalizeDaytonaOfflineRiskResult(
  workerResult: DaytonaWorkerRiskResult,
): NormalizedDaytonaOfflineRiskResult {
  const workloadStatus = VALID_WORKLOAD_STATUSES.includes(
    workerResult.workloadStatus,
  )
    ? workerResult.workloadStatus
    : 'error';

  const riskResult: RiskResult = {
    correlationId: workerResult.correlationId,
    workloadStatus,
    jobOrServiceReference: null,
    riskBand: workerResult.riskBand,
    riskScore: workerResult.riskScore,
    heuristicDisclaimer: workerResult.heuristicDisclaimer,
    failureCascadeExplanation: workerResult.failureCascadeExplanation,
    datasetVersion: workerResult.datasetVersion,
    /* Offline computation is never live provider evidence. */
    fallbackUsed: true,
    errorCode: workerResult.errorCode,
    errorMessage: workerResult.errorMessage,
    /* Normalization: worker literal 'daytona-sandbox' is not a valid
     * RiskResult evidenceSource and no live sandbox evidence exists. */
    evidenceSource: 'local-fallback',
    provider: 'daytona-risk-worker',
    executed: false,
    evidenceLabel:
      workerResult.evidenceLabel !== ''
        ? workerResult.evidenceLabel
        : getExecutionModeLabel(OFFLINE_EXECUTION_MODE).provenanceLabel,
    simulationCount: workerResult.simulationCount,
    assumptions: workerResult.assumptions,
    latencyMs: workerResult.latencyMs,
  };

  return {
    riskResult,
    executionMode: OFFLINE_EXECUTION_MODE,
    isLive: false,
    provenanceLabel: getExecutionModeLabel(OFFLINE_EXECUTION_MODE).provenanceLabel,
    workerEvidenceSource: workerResult.evidenceSource,
    externalWriteOccurred: false,
  };
}

/* ── Local deterministic mock of the worker result ──
 * Simulates the worker output contract locally for the browser demo.
 * No Daytona sandbox is created; no provider is called. The shape and
 * provenance mirror workers/daytona-risk-worker/index.mjs exactly. */

const LOCAL_DEMO_CORRELATION_ID = 'stitchcheck-local-demo-001';

/**
 * Builds the deterministic offline worker-shaped result used by the
 * local demo. Pure and local-only: no network, no credentials.
 */
export function createDaytonaOfflineMockWorkerResult(
  correlationId: string = LOCAL_DEMO_CORRELATION_ID,
): DaytonaWorkerRiskResult {
  return {
    correlationId,
    workloadStatus: 'success',
    jobOrServiceReference: null,
    riskBand: 'high',
    riskScore: null,
    heuristicDisclaimer: 'Computed result — not live provider evidence',
    failureCascadeExplanation:
      'Deterministic offline risk computation drives the downstream cascade',
    datasetVersion: 'daytona-risk-worker-v1',
    fallbackUsed: true,
    errorCode: null,
    errorMessage: null,
    evidenceSource: 'daytona-sandbox',
    provider: 'daytona-risk-worker',
    executed: false,
    evidenceLabel: 'Daytona sandbox \u2014 deterministic risk computation',
    simulationCount: 0,
    assumptions: [
      'Deterministic computation \u2014 no live risk computation executed',
      'Simulated delay trigger — downstream impact is analysis only',
    ],
    latencyMs: 0,
    executionEnvironment: 'daytona-offline-mock',
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
  };
}

/* ── One-step integration helper ── */

export interface DaytonaOfflineRecoveryAnimation {
  normalized: NormalizedDaytonaOfflineRiskResult;
  plan: RecoveryPlanFromRiskResult;
}

/**
 * Full offline flow for the local demo:
 *   offline worker-shaped result → normalization boundary →
 *   riskResultToAnimationData ('daytona-offline-mock').
 *
 * No risk logic is duplicated in the caller — everything lives here
 * and in core/domain. Deterministic, local-only, no provider calls.
 *
 * @param correlationId - Optional correlation ID override.
 * @param itineraryContext - Optional confirmed itinerary route context.
 *   When provided, the recovery plan's trigger route, cascade labels,
 *   candidate alternatives, and recommended plan all reference the
 *   traveller's actual confirmed route instead of hardcoded placeholders.
 */
export function getDaytonaOfflineRecoveryAnimation(
  correlationId: string = LOCAL_DEMO_CORRELATION_ID,
  itineraryContext?: ItineraryContext,
): DaytonaOfflineRecoveryAnimation {
  const workerResult = createDaytonaOfflineMockWorkerResult(correlationId);
  const normalized = normalizeDaytonaOfflineRiskResult(workerResult);
  const plan = riskResultToAnimationData(
    normalized.riskResult,
    OFFLINE_EXECUTION_MODE,
    itineraryContext,
  );
  return { normalized, plan };
}
