/* ── Recovery Plan from Risk Result adapter ──
 *
 * Converts a RiskResult (from core/domain/risk.ts) into
 * RecoveryPlanAnimationData (from app/src/types/recovery-plan.ts).
 *
 * All computation is deterministic and local. No network calls,
 * no credentials, no provider execution.
 *
 * Stage 1 execution mode: 'local-fallback'
 * Provenance label: "Local fallback — Daytona risk computation not executed" */

import type { RiskResult } from './risk';
import type { RecoveryPlan, RecoveryPlanAnimationData, RecoveryOption } from '../../app/src/types/recovery-plan';
import { computeRiskFromSeed } from './risk-computation';
import type { RiskComputationResult, ItineraryContext } from './risk-computation';
import { getExecutionModeLabel } from './execution-mode';
import type { ExecutionMode } from './execution-mode';
import { formatMissingField } from '../copy/missing-field-labels';

/** Result of the adapter conversion. */
export interface RecoveryPlanFromRiskResult {
  /** The animation-ready data for the RecoveryPlanAnimation component. */
  animationData: RecoveryPlanAnimationData;
  /** The intermediate computation result (for inspection / testing). */
  computation: RiskComputationResult;
  /** Execution mode declared on this result. */
  executionMode: ExecutionMode;
}

/**
 * Generate candidate recovery alternatives deterministically.
 * Returns an empty array for terminal (no-plan) states.
 *
 * When itineraryContext is provided, route summaries reference
 * the traveller's actual confirmed route. Without it, candidates
 * are null/not-available (no fabricated routes). */
function generateCandidates(
  computation: RiskComputationResult,
  itineraryContext?: ItineraryContext,
): RecoveryOption[] {
  if (computation.isTerminalNoPlan) return [];

  const { riskScore } = computation;
  const candidates: RecoveryOption[] = [];

  /* When we have itinerary context, candidates reference the same route.
   * Without context, we cannot fabricate a route — candidates are empty. */
  if (!itineraryContext) return candidates;

  const routeSummary = `${itineraryContext.firstLegOrigin} → ${itineraryContext.firstLegDestination}`;

  /* Candidate 1: nonstop, moderate price */
  candidates.push({
    offerReference: 'local-fallback-offer-001',
    routeSummary,
    departureTime: null,
    arrivalTime: null,
    duration: null,
    connectionType: 'nonstop',
    priceDisplay: null,
    currency: null,
    availabilityLabel: null,
  });

  /* Candidate 2: appears when score is above low threshold */
  if (riskScore >= 30) {
    candidates.push({
      offerReference: 'local-fallback-offer-002',
      routeSummary,
      departureTime: null,
      arrivalTime: null,
      duration: null,
      connectionType: '1-stop',
      priceDisplay: null,
      currency: null,
      availabilityLabel: null,
    });
  }

  /* Candidate 3: appears when score is moderate or higher */
  if (riskScore >= 50) {
    candidates.push({
      offerReference: 'local-fallback-offer-003',
      routeSummary,
      departureTime: null,
      arrivalTime: null,
      duration: null,
      connectionType: 'nonstop',
      priceDisplay: null,
      currency: null,
      availabilityLabel: null,
    });
  }

  return candidates;
}

/**
 * Collapse candidate alternatives into one recommended plan.
 * Returns null when no candidates exist (terminal state).
 *
 * When itineraryContext is provided, the replacement leg and onward
 * option reference the traveller's actual confirmed route.
 * Without context, returns null (no fabricated route data). */
function collapseIntoRecommendedPlan(
  candidates: RecoveryOption[],
  computation: RiskComputationResult,
  itineraryContext?: ItineraryContext,
): RecoveryPlan | null {
  if (candidates.length === 0 || computation.isTerminalNoPlan) {
    return null;
  }

  const replacement = candidates[0];
  const hasOnwardOption = computation.riskScore >= 40;

  let onwardOption: RecoveryOption | null = null;
  if (hasOnwardOption && itineraryContext) {
    onwardOption = {
      offerReference: 'local-fallback-offer-010',
      routeSummary: `${itineraryContext.secondLegOrigin} → ${itineraryContext.secondLegDestination}`,
      departureTime: null,
      arrivalTime: null,
      duration: null,
      connectionType: 'nonstop',
      priceDisplay: null,
      currency: null,
      availabilityLabel: null,
    };
  }

  return {
    replacementFirstLeg: replacement,
    onwardOption,
    tradeoffs: {
      arrivalImpactMinutes: null,
      connectionBufferMinutes: null,
      fareDelta: null,
      fareDeltaCurrency: null,
    },
  };
}

/**
 * Convert a RiskResult into RecoveryPlanAnimationData.
 *
 * Pure function: deterministic, local-only, no side effects.
 * The returned data is ready to pass directly to RecoveryPlanAnimation.
 *
 * @param riskResult - The upstream risk result to adapt.
 * @param executionMode - The execution mode to declare (default: 'local-fallback').
 * @param itineraryContext - Optional confirmed itinerary route context.
 *   When provided, the trigger route, cascade labels, candidate alternatives,
 *   and recommended plan all reference the traveller's actual route.
 *   When omitted, route-specific fields use honest "not available" states
 *   rather than fabricating an unrelated route.
 */
export function riskResultToAnimationData(
  riskResult: RiskResult,
  executionMode: ExecutionMode = 'local-fallback',
  itineraryContext?: ItineraryContext,
): RecoveryPlanFromRiskResult {
  const computation = computeRiskFromSeed({
    correlationId: riskResult.correlationId,
    riskBand: riskResult.riskBand,
    riskScore: riskResult.riskScore,
    fallbackUsed: riskResult.fallbackUsed,
    itineraryContext,
  });

  const candidates = generateCandidates(computation, itineraryContext);
  const recommendedPlan = collapseIntoRecommendedPlan(candidates, computation, itineraryContext);

  const modeLabel = getExecutionModeLabel(executionMode);

  /* Downstream items for the animation cascade */
  const downstreamItems = computation.dependencyGraph.nodes.map((node) => ({
    id: node.id,
    label: node.label,
    cascadeDelayMs: node.cascadeDelayMs,
  }));

  /* Safe confirmation phase: never claim booking/switch without verified outcome */
  const confirmationPhase: RecoveryPlanAnimationData['confirmationPhase'] =
    recommendedPlan !== null ? 'review-recovery-plan' : 'idle';

  /* Trigger route: derive from confirmed itinerary when available,
   * otherwise use an explicit "not available" state. */
  const triggerRouteSummary = itineraryContext
    ? `${itineraryContext.firstLegOrigin} → ${itineraryContext.firstLegDestination}`
    : formatMissingField('critical');

  const animationData: RecoveryPlanAnimationData = {
    originalFirstLeg: {
      routeSummary: triggerRouteSummary,
      scheduledDeparture: null,
      scheduledArrival: null,
    },
    delayTrigger: {
      isRealDelaySignal: false,
      label: 'Simulated delay trigger — downstream impact is analysis only',
    },
    downstreamItems,
    candidateAlternatives: candidates,
    recommendedPlan,
    /* Terminal no-plan states exhaust the attempt budget so the animation
     * surfaces the stable 'no-safe-plan' completion state. */
    rePlanAttemptCount: computation.isTerminalNoPlan ? 2 : 0,
    maxRePlanAttempts: 2,
    freshnessTimestamp: new Date().toISOString(),
    provenanceLabel: modeLabel.provenanceLabel,
    dataSource: 'local-fallback',
    confirmationPhase,
    verifiedOutcome: null,
  };

  return {
    animationData,
    computation,
    executionMode,
  };
}
