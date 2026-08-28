/* ── Search result / alternative domain model ──
 * Shared across browser app, orchestrators, and workers.
 * Extracted from app/src/data/types.ts as the canonical source. */

export interface Alternative {
  offerReference: string;
  routeSummary: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  connectionType: string;
  connectionDurationMinutes: number;
  priceDisplay: string;
  currency: string;
  availabilityLabel: string;
}

export interface SearchResult {
  correlationId: string;
  searchStatus: string;
  sourceEnvironment: string;
  alternatives: Alternative[];
  errorCode: string | null;
  errorMessage: string | null;
  fallbackUsed: boolean;
  /* Provenance fields for evidence-aware labeling */
  evidenceSource?:
    | 'atlas-sandbox'
    | 'atlas-production'
    | 'atlas-offline'
    | 'local-fixture'
    | 'local-fallback'
    | 'daytona-sandbox';
  provider?: string;
  executed?: boolean;
  /* Retrieval timestamp for live results */
  retrievedAt?: string;
}

export interface ComparisonOriginal {
  routeSummary: string;
  firstLeg: string;
  secondLeg: string;
  connectionDurationMinutes: number;
  riskBand: string;
  riskLabel: string;
}

export interface ComparisonAlternative {
  offerReference: string;
  routeSummary: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  connectionType: string;
  connectionDurationMinutes: number;
  priceDisplay: string;
  sourceLabel: string;
}

export interface ComparisonData {
  originalItinerary: ComparisonOriginal;
  alternatives: ComparisonAlternative[];
}

export type AlternativesScenario = 'success' | 'empty' | 'error' | 'timeout';
