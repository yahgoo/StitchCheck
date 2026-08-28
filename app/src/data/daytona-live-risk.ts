/* ── Daytona live risk result → RecoveryPlanAnimation ──
 *
 * Consumes the sanitized envelope written by
 * scripts/daytona-live-risk-runner.mjs after one real sandbox
 * create → exec → download → destroy cycle.
 *
 * Atlas Search/Verify did not run inside this sandbox. Missing
 * fare/time fields stay labelled "not available from Sandbox response".
 * Never claims Booked/Switched. */

import { getExecutionModeLabel } from '../../../core/domain';
import type { ExecutionMode } from '../../../core/domain';
import type {
  RecoveryOption,
  RecoveryPlan,
  RecoveryPlanAnimationData,
} from '../types/recovery-plan';

export const DAYTONA_LIVE_MISSING = 'not available from Sandbox response';
export const DAYTONA_LIVE_EXECUTION_MODE: ExecutionMode = 'daytona-live-risk';

const LIVE_LABEL = getExecutionModeLabel(DAYTONA_LIVE_EXECUTION_MODE).provenanceLabel;

export interface DaytonaLiveEnvelope {
  envelopeVersion: number;
  correlationId: string;
  startedAt: string;
  finishedAt: string;
  sandboxIdFirst8: string | null;
  sandboxDestroyed: boolean;
  success: boolean;
  execExitCode: number | null;
  workerResult: Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function sandboxOrMissing(value: unknown): string {
  const s = readString(value);
  return s ?? DAYTONA_LIVE_MISSING;
}

function mapOption(raw: unknown): RecoveryOption | null {
  if (!isRecord(raw)) return null;
  return {
    offerReference: readString(raw.offerReference),
    routeSummary: sandboxOrMissing(raw.routeSummary),
    departureTime: sandboxOrMissing(raw.departureTime),
    arrivalTime: sandboxOrMissing(raw.arrivalTime),
    duration: sandboxOrMissing(raw.duration),
    connectionType: sandboxOrMissing(raw.connectionType),
    priceDisplay: sandboxOrMissing(raw.priceDisplay),
    currency: sandboxOrMissing(raw.currency),
    availabilityLabel: sandboxOrMissing(raw.availabilityLabel),
  };
}

export interface DaytonaLiveHowCalculated {
  riskBand: string;
  heuristicDisclaimer: string;
  failureCascadeExplanation: string;
  datasetVersion: string;
  latencyMs?: number;
}

export function liveEnvelopeToHowCalculated(
  envelope: DaytonaLiveEnvelope,
): DaytonaLiveHowCalculated {
  const worker = envelope.workerResult ?? {};
  return {
    riskBand: readString(worker.riskBand) ?? DAYTONA_LIVE_MISSING,
    heuristicDisclaimer: readString(worker.heuristicDisclaimer) ?? DAYTONA_LIVE_MISSING,
    failureCascadeExplanation:
      readString(worker.failureCascadeExplanation) ?? DAYTONA_LIVE_MISSING,
    datasetVersion: readString(worker.datasetVersion) ?? DAYTONA_LIVE_MISSING,
    latencyMs: typeof worker.latencyMs === 'number' ? worker.latencyMs : undefined,
  };
}

export function isUsableDaytonaLiveEnvelope(
  envelope: unknown,
): envelope is DaytonaLiveEnvelope {
  if (!isRecord(envelope)) return false;
  return (
    envelope.success === true
    && envelope.sandboxDestroyed === true
    && envelope.execExitCode === 0
    && isRecord(envelope.workerResult)
  );
}

export async function loadDaytonaLiveEnvelope(): Promise<DaytonaLiveEnvelope | null> {
  try {
    const res = await fetch('/daytona-risk-live-result.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isUsableDaytonaLiveEnvelope(data) ? data : null;
  } catch {
    return null;
  }
}

export function liveEnvelopeToAnimationData(
  envelope: DaytonaLiveEnvelope,
  confirmationPhase: RecoveryPlanAnimationData['confirmationPhase'] = 'review-recovery-plan',
): RecoveryPlanAnimationData {
  const worker = envelope.workerResult ?? {};
  const graph = isRecord(worker.dependencyGraph) ? worker.dependencyGraph : {};
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const recoveryRaw = isRecord(worker.recoveryPlan) ? worker.recoveryPlan : null;

  const triggerNode = nodes.find((n) => isRecord(n) && n.id === graph.rootTriggerId);
  const routeSummary = isRecord(triggerNode) && typeof triggerNode.label === 'string'
    ? triggerNode.label.replace(/^First leg delayed:\s*/, '')
    : DAYTONA_LIVE_MISSING;

  const downstreamItems = nodes
    .filter((n): n is Record<string, unknown> => isRecord(n) && n.id !== graph.rootTriggerId)
    .map((n, index) => ({
      id: readString(n.id) ?? `node-${index}`,
      label: readString(n.label) ?? DAYTONA_LIVE_MISSING,
      cascadeDelayMs: typeof n.cascadeDelayMs === 'number' ? n.cascadeDelayMs : index * 550,
    }));

  const replacement = recoveryRaw ? mapOption(recoveryRaw.replacementFirstLeg) : null;
  const onward = recoveryRaw ? mapOption(recoveryRaw.onwardOption) : null;
  const tradeoffsRaw = recoveryRaw && isRecord(recoveryRaw.tradeoffs)
    ? recoveryRaw.tradeoffs
    : {};

  const recommendedPlan: RecoveryPlan | null = recoveryRaw
    ? {
        replacementFirstLeg: replacement,
        onwardOption: onward,
        tradeoffs: {
          arrivalImpactMinutes:
            typeof tradeoffsRaw.arrivalImpactMinutes === 'number'
              ? tradeoffsRaw.arrivalImpactMinutes
              : null,
          connectionBufferMinutes:
            typeof tradeoffsRaw.connectionBufferMinutes === 'number'
              ? tradeoffsRaw.connectionBufferMinutes
              : null,
          fareDelta:
            typeof tradeoffsRaw.fareDelta === 'number' ? tradeoffsRaw.fareDelta : null,
          fareDeltaCurrency: readString(tradeoffsRaw.fareDeltaCurrency),
        },
      }
    : null;

  const candidateAlternatives: RecoveryOption[] = replacement ? [replacement] : [];

  const freshness = readString(worker.executionTimestamp) ?? envelope.finishedAt;

  return {
    originalFirstLeg: {
      routeSummary,
      scheduledDeparture: DAYTONA_LIVE_MISSING,
      scheduledArrival: DAYTONA_LIVE_MISSING,
    },
    delayTrigger: {
      isRealDelaySignal: false,
      label: 'Simulated delay trigger — downstream impact is analysis only',
    },
    downstreamItems,
    candidateAlternatives,
    recommendedPlan,
    rePlanAttemptCount: typeof worker.rePlanAttemptCount === 'number'
      ? worker.rePlanAttemptCount
      : 0,
    maxRePlanAttempts: 2,
    freshnessTimestamp: freshness,
    provenanceLabel: LIVE_LABEL,
    dataSource: 'daytona-live-risk',
    confirmationPhase,
    verifiedOutcome: null,
  };
}
