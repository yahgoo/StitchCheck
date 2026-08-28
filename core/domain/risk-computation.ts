/* ── Deterministic seeded risk computation ──
 *
 * Pure function: given the same seed, always produces the same risk
 * computation result. No network calls, no side effects, no credentials.
 *
 * Used by the recovery-plan adapter to derive cascade, candidates,
 * and recommended plan deterministically from a risk result. */

import type { DependencyGraph, DependencyNode, DependencyNodeStatus } from './dependency-graph';

/** Itinerary context for parameterizing dependency-graph labels.
 *  When provided, cascade labels reference the actual confirmed route
 *  instead of hardcoded placeholder airports. */
export interface ItineraryContext {
  /** First leg origin airport code, e.g. 'AAA'. */
  firstLegOrigin: string;
  /** First leg destination airport code, e.g. 'BBB'. */
  firstLegDestination: string;
  /** Second leg origin airport code (typically same as firstLegDestination). */
  secondLegOrigin: string;
  /** Second leg destination airport code, e.g. 'CCC'. */
  secondLegDestination: string;
}

/**
 * Input seed for deterministic risk computation.
 */
export interface RiskComputationSeed {
  /** Unique correlation identifier. */
  correlationId: string;
  /** Original risk band from the risk result. */
  riskBand: string;
  /** Numeric risk score (0–1), or null if unavailable. */
  riskScore: number | null;
  /** Whether a fallback was used upstream. */
  fallbackUsed: boolean;
  /** Optional itinerary context for route-aware cascade labels. */
  itineraryContext?: ItineraryContext;
}

/** Result of deterministic risk computation. */
export interface RiskComputationResult {
  /** The dependency graph with cascade statuses. */
  dependencyGraph: DependencyGraph;
  /** Derived numeric risk score (0–100). Non-null. */
  riskScore: number;
  /** Derived risk band category. */
  riskBand: 'low' | 'medium' | 'high' | 'critical';
  /** Whether the computation reached a terminal no-plan state. */
  isTerminalNoPlan: boolean;
  /** Seed used for reproducibility. */
  seed: RiskComputationSeed;
}

/**
 * Deterministic pseudo-random number generator (mulberry32).
 * Given the same seed, always produces the same sequence.
 */
function seededRandom(seed: number): () => number {
  let state = seed | 0;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a numeric seed from a correlation-id string. */
function deriveNumericSeed(correlationId: string): number {
  let hash = 0;
  for (let i = 0; i < correlationId.length; i++) {
    hash = ((hash << 5) - hash + correlationId.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Compute risk deterministically from a seed.
 *
 * Pure function: no network, no side effects, no credentials.
 * Given the same seed, always returns the same result.
 */
export function computeRiskFromSeed(seed: RiskComputationSeed): RiskComputationResult {
  const numericSeed = deriveNumericSeed(seed.correlationId);
  const rng = seededRandom(numericSeed);

  /* ── Derive risk score (0–100) ── */
  let riskScore: number;
  if (seed.riskScore !== null) {
    riskScore = Math.round(seed.riskScore * 100);
  } else {
    switch (seed.riskBand) {
      case 'low':
        riskScore = 10 + Math.round(rng() * 20);
        break;
      case 'medium':
        riskScore = 35 + Math.round(rng() * 25);
        break;
      case 'high':
        riskScore = 65 + Math.round(rng() * 20);
        break;
      case 'critical':
        riskScore = 88 + Math.round(rng() * 12);
        break;
      default:
        /* error / timeout / unknown → terminal */
        riskScore = 100;
        break;
    }
  }

  /* ── Derive risk band from score ── */
  let riskBand: 'low' | 'medium' | 'high' | 'critical';
  if (riskScore < 30) {
    riskBand = 'low';
  } else if (riskScore < 60) {
    riskBand = 'medium';
  } else if (riskScore < 85) {
    riskBand = 'high';
  } else {
    riskBand = 'critical';
  }

  /* ── Terminal state for error/timeout/unknown ── */
  const isTerminalNoPlan =
    seed.riskBand === 'error' ||
    seed.riskBand === 'timeout' ||
    (!['low', 'medium', 'high', 'critical'].includes(seed.riskBand));

  /* ── Build dependency graph ──
   * Labels derive from the confirmed itinerary context when available,
   * ensuring cascade items reference the traveller's actual route. */
  const ctx = seed.itineraryContext;
  const connectionAirport = ctx ? ctx.firstLegDestination : 'BKK';
  const onwardRoute = ctx
    ? `${ctx.secondLegOrigin} → ${ctx.secondLegDestination}`
    : 'BKK → HAN';

  const statusForScore = (threshold: number): DependencyNodeStatus =>
    riskScore >= threshold ? 'at-risk' : 'ok';

  const connectionStatus: DependencyNodeStatus = isTerminalNoPlan
    ? 'failed'
    : statusForScore(20);
  const onwardStatus: DependencyNodeStatus = isTerminalNoPlan
    ? 'failed'
    : statusForScore(40);
  const hotelStatus: DependencyNodeStatus = isTerminalNoPlan
    ? 'failed'
    : statusForScore(60);

  const nodes: DependencyNode[] = [
    {
      id: 'connection-window',
      label: `Connection window at ${connectionAirport}`,
      kind: 'connection-window',
      status: connectionStatus,
      cascadeDelayMs: 0,
      dependsOn: [],
    },
  ];

  if (!isTerminalNoPlan) {
    if (riskScore >= 40) {
      nodes.push({
        id: 'onward-leg',
        label: `Onward leg ${onwardRoute}`,
        kind: 'onward-leg',
        status: onwardStatus,
        cascadeDelayMs: 550,
        dependsOn: ['connection-window'],
      });
    }
    if (riskScore >= 60) {
      nodes.push({
        id: 'hotel-checkin',
        label: 'Pre-booked hotel check-in',
        kind: 'hotel-checkin',
        status: hotelStatus,
        cascadeDelayMs: 1100,
        dependsOn: ['onward-leg', 'connection-window'],
      });
    }
  }

  const dependencyGraph: DependencyGraph = {
    nodes,
    rootTriggerId: 'connection-window',
  };

  return {
    dependencyGraph,
    riskScore,
    riskBand,
    isTerminalNoPlan,
    seed,
  };
}
