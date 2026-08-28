// Daytona risk worker — deterministic risk computation engine.
//
// Pure function: given the same input and seed, always produces
// the same result. No network calls, no side effects, no credentials.
//
// Uses a seeded PRNG (mulberry32) for deterministic pseudo-random
// derivation of risk scores and scenario evaluations.
//
// This module runs INSIDE the Daytona sandbox (offline mode).

/* ── Seeded PRNG (mulberry32) ──
 * Identical to core/domain/risk-computation.ts for cross-consistency. */

function seededRandom(seed) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a numeric seed from a string (same algorithm as core). */
function deriveNumericSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Derive risk band from numeric score.
 * Matches core/domain/risk-computation.ts thresholds.
 */
export function deriveRiskBand(score) {
  if (score < 30) return 'low';
  if (score < 60) return 'medium';
  if (score < 85) return 'high';
  return 'critical';
}

/**
 * Compute the deterministic risk score and related metrics.
 *
 * @param {Object} params
 * @param {string} params.itineraryId - Anonymized itinerary ID.
 * @param {string} params.deterministicSeed - User-provided seed.
 * @param {Object[]} params.flightLegs - Flight legs from input.
 * @param {number|null} params.connectionDurationMinutes - Connection window.
 * @param {number} params.scenarioLimit - Max scenarios to evaluate.
 * @returns {Object} Computed risk metrics.
 */
export function computeRiskMetrics(params) {
  const {
    itineraryId,
    deterministicSeed,
    flightLegs,
    connectionDurationMinutes,
    scenarioLimit,
  } = params;

  // Combine seeds for uniqueness per itinerary + user seed
  const combinedSeed = `${itineraryId}:${deterministicSeed}`;
  const numericSeed = deriveNumericSeed(combinedSeed);
  const rng = seededRandom(numericSeed);

  // Derive base risk score from flight characteristics
  const legCount = flightLegs.length;
  const hasTightConnection = connectionDurationMinutes !== null &&
    connectionDurationMinutes !== undefined &&
    connectionDurationMinutes < 90;

  // Base score: influenced by leg count and connection tightness
  let baseScore = 20 + Math.round(rng() * 30); // 20-50 base
  if (legCount >= 2) baseScore += 10 + Math.round(rng() * 15);
  if (hasTightConnection) baseScore += 15 + Math.round(rng() * 10);

  // Clamp to 0–100
  const riskScore = Math.min(100, Math.max(0, baseScore));
  const riskBand = deriveRiskBand(riskScore);

  // Evaluate scenarios deterministically
  const scenariosToEvaluate = Math.min(scenarioLimit, 3 + legCount * 2);
  const scenarios = [];
  for (let i = 0; i < scenariosToEvaluate; i++) {
    const scenarioScore = Math.round(rng() * 100);
    const scenarioBand = deriveRiskBand(scenarioScore);
    scenarios.push({
      scenarioId: `scenario-${i + 1}`,
      riskScore: scenarioScore,
      riskBand: scenarioBand,
      isViable: scenarioScore < 85,
    });
  }

  // Derive assumptions from computation
  const assumptions = [];
  assumptions.push('Risk score derived from deterministic seed and itinerary structure');
  assumptions.push('No live provider data used — all values are computed');
  if (hasTightConnection) {
    assumptions.push(`Tight connection window (${connectionDurationMinutes} min) increases cascade risk`);
  }
  if (legCount >= 2) {
    assumptions.push('Multi-leg itinerary increases downstream dependency chain');
  }

  return {
    numericSeed,
    riskScore,
    riskBand,
    scenariosEvaluated: scenarios.length,
    scenarios,
    assumptions,
    rng, // Pass through for downstream deterministic use
  };
}
