/* ── Risk result domain model ──
 * Shared across browser app, orchestrators, and workers.
 * Extracted from app/src/data/types.ts as the canonical source. */

export interface RiskResult {
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
  /* Evidence tracking fields */
  evidenceSource?: 'nosana-evidence' | 'local-fallback';
  provider?: string;
  executed?: boolean;
  evidenceLabel?: string;
  simulationCount?: number;
  assumptions?: string[];
  latencyMs?: number;
  fallbackReason?: string;
}

export type RiskScenario = 'success' | 'unavailable' | 'error' | 'timeout' | 'failure';
