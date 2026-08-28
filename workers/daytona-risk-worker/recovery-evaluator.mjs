// Daytona risk worker — recovery plan evaluator.
//
// Evaluates candidate recovery options and selects a recommended
// plan when a safe option exists. Returns a terminal no-safe-plan
// result when no option satisfies the constraints.
//
// All computation is deterministic. No live provider data is used.
// Fare deltas, availability, and flight numbers are set to null
// (not available from current evidence) when not present in input.
//
// This module runs INSIDE the Daytona sandbox (offline mode).

/* ── Constraint checking ── */

/**
 * Check if a candidate option satisfies the basic safety constraints.
 * A candidate is "safe" if:
 *   1. It has a valid route summary.
 *   2. Its deterministic viability score (from rng) is above threshold.
 *   3. It does not violate the re-plan attempt limit.
 *
 * @param {Object} candidate - The candidate option from input.
 * @param {Function} rng - Seeded PRNG function.
 * @param {number} riskScore - Current computed risk score.
 * @returns {Object} { isViable, constraintViolations, explanation }
 */
function evaluateCandidate(candidate, rng, riskScore) {
  const violations = [];

  // Must have a route summary
  if (!candidate.routeSummary || candidate.routeSummary.length === 0) {
    violations.push('Candidate missing route summary');
  }

  // Deterministic viability: use rng to simulate evaluation
  const viabilityScore = Math.round(rng() * 100);
  const viabilityThreshold = Math.min(70, riskScore + 10);

  if (viabilityScore < viabilityThreshold) {
    violations.push(`Candidate viability score (${viabilityScore}) below threshold (${viabilityThreshold})`);
  }

  const isViable = violations.length === 0;

  return {
    isViable,
    viabilityScore,
    constraintViolations: violations,
    explanation: isViable
      ? `Candidate ${candidate.optionId} satisfies constraints with viability score ${viabilityScore}`
      : `Candidate ${candidate.optionId} rejected: ${violations.join('; ')}`,
  };
}

/**
 * Build a recovery option in the contract-compatible shape.
 * Uses null for any value not present in the input (no fabrication).
 *
 * @param {Object} candidate - Input candidate option.
 * @returns {Object} RecoveryOption-shaped object.
 */
function buildRecoveryOption(candidate) {
  return {
    offerReference: candidate.optionId || null,
    routeSummary: candidate.routeSummary || null,
    departureTime: candidate.departureTime || null,
    arrivalTime: candidate.arrivalTime || null,
    duration: candidate.duration || null,
    connectionType: candidate.connectionType || null,
    priceDisplay: null, // Not available from current evidence
    currency: candidate.currency || null,
    availabilityLabel: null, // Not available from current evidence
  };
}

/**
 * Evaluate recovery options and produce a recovery plan.
 *
 * @param {Object} params
 * @param {Object[]} params.candidates - Candidate options from input.
 * @param {number} params.riskScore - Computed risk score.
 * @param {string} params.riskBand - Computed risk band.
 * @param {boolean} params.isTerminalNoPlan - Whether in terminal state.
 * @param {number} params.rePlanAttemptCount - Current re-plan attempts.
 * @param {Function} params.rng - Seeded PRNG (already advanced past metrics).
 * @param {Object[]} params.flightLegs - Input flight legs.
 * @returns {Object} Recovery plan result.
 */
export function evaluateRecoveryPlan(params) {
  const {
    candidates,
    riskScore,
    riskBand,
    isTerminalNoPlan,
    rePlanAttemptCount,
    rng,
    flightLegs,
  } = params;

  const constraintViolations = [];
  const MAX_REPLAN = 2;

  // Terminal state: no plan possible
  if (isTerminalNoPlan) {
    return {
      recoveryPlan: null,
      scenariosEvaluated: 0,
      constraintViolations: ['Terminal state — no safe plan can be constructed'],
      rePlanAttemptCount,
      maxRePlanAttempts: MAX_REPLAN,
      explanation: 'No safe plan: terminal state reached (error/timeout/unknown risk band)',
    };
  }

  // Re-plan limit exceeded
  if (rePlanAttemptCount >= MAX_REPLAN) {
    return {
      recoveryPlan: null,
      scenariosEvaluated: 0,
      constraintViolations: ['Re-plan attempt limit reached (2/2)'],
      rePlanAttemptCount,
      maxRePlanAttempts: MAX_REPLAN,
      explanation: 'No safe plan: maximum re-plan attempts exhausted',
    };
  }

  // No candidates provided: build a minimal fallback plan
  if (!candidates || candidates.length === 0) {
    const firstLeg = flightLegs[0];
    const replacementFirstLeg = {
      offerReference: null,
      routeSummary: firstLeg
        ? `${firstLeg.origin} → ${firstLeg.destination}`
        : null,
      departureTime: null,
      arrivalTime: null,
      duration: null,
      connectionType: null,
      priceDisplay: null,
      currency: null,
      availabilityLabel: null,
    };

    // Onward option: only if multi-leg and risk warrants it
    let onwardOption = null;
    if (flightLegs.length >= 2 && riskScore >= 40) {
      const lastLeg = flightLegs[flightLegs.length - 1];
      onwardOption = {
        offerReference: null,
        routeSummary: lastLeg
          ? `${lastLeg.origin} → ${lastLeg.destination}`
          : null,
        departureTime: null,
        arrivalTime: null,
        duration: null,
        connectionType: null,
        priceDisplay: null,
        currency: null,
        availabilityLabel: null,
      };
    }

    return {
      recoveryPlan: {
        replacementFirstLeg,
        onwardOption,
        affectedDownstreamCommitments: [],
        constraintsSatisfied: ['Route structure derived from input legs'],
        tradeoffs: {
          arrivalImpactMinutes: null,
          connectionBufferMinutes: null,
          fareDelta: null,
          fareDeltaCurrency: null,
        },
      },
      scenariosEvaluated: 1,
      constraintViolations: [],
      rePlanAttemptCount,
      maxRePlanAttempts: MAX_REPLAN,
      explanation: 'Recovery plan constructed from input structure — no candidate options supplied; values are unavailable from current evidence',
    };
  }

  // Evaluate each candidate
  let selectedCandidate = null;
  let selectedEvaluation = null;
  let evaluatedCount = 0;

  for (const candidate of candidates) {
    evaluatedCount++;
    const evaluation = evaluateCandidate(candidate, rng, riskScore);

    if (!evaluation.isViable) {
      constraintViolations.push(...evaluation.constraintViolations);
    }

    if (evaluation.isViable && selectedCandidate === null) {
      selectedCandidate = candidate;
      selectedEvaluation = evaluation;
    }
  }

  // No viable candidate found
  if (selectedCandidate === null) {
    return {
      recoveryPlan: null,
      scenariosEvaluated: evaluatedCount,
      constraintViolations,
      rePlanAttemptCount,
      maxRePlanAttempts: MAX_REPLAN,
      explanation: `No safe plan: all ${evaluatedCount} candidate(s) failed constraint evaluation`,
    };
  }

  // Build the recommended plan from the selected candidate
  const replacementFirstLeg = buildRecoveryOption(selectedCandidate);

  // Onward option: derived from input legs if multi-leg
  let onwardOption = null;
  if (flightLegs.length >= 2) {
    const lastLeg = flightLegs[flightLegs.length - 1];
    onwardOption = {
      offerReference: null,
      routeSummary: lastLeg
        ? `${lastLeg.origin} → ${lastLeg.destination}`
        : null,
      departureTime: null,
      arrivalTime: null,
      duration: null,
      connectionType: null,
      priceDisplay: null,
      currency: null,
      availabilityLabel: null,
    };
  }

  return {
    recoveryPlan: {
      replacementFirstLeg,
      onwardOption,
      affectedDownstreamCommitments: [],
      constraintsSatisfied: [
        selectedEvaluation.explanation,
        'Route summary derived from candidate input',
      ],
      tradeoffs: {
        arrivalImpactMinutes: null,
        connectionBufferMinutes: null,
        fareDelta: null,
        fareDeltaCurrency: null,
      },
    },
    scenariosEvaluated: evaluatedCount,
    constraintViolations,
    rePlanAttemptCount,
    maxRePlanAttempts: MAX_REPLAN,
    explanation: `Selected candidate ${selectedCandidate.optionId}: ${selectedEvaluation.explanation}`,
  };
}
