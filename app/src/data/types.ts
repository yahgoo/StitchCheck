/* ── TypeScript interfaces for StitchCheck demo data ── */

export interface FlightLeg {
  origin: string;
  destination: string;
  departureDate: string;
  airline: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
}

export interface FieldConfidence {
  overall: string;
  note: string;
}

export interface ExtractionResult {
  extractionStatus: string;
  firstLeg: FlightLeg;
  secondLeg: FlightLeg;
  connectionDurationMinutes: number;
  missingFields: string[];
  fieldConfidence: FieldConfidence;
  validationMessages: string[];
  requiresUserConfirmation: boolean;
  syntheticDemo: boolean;
}

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
  // Evidence tracking fields
  evidenceSource?: 'nosana-evidence' | 'local-fallback';
  evidenceLabel?: string;
  simulationCount?: number;
  assumptions?: string[];
  latencyMs?: number;
  fallbackReason?: string;
}

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

export interface DecisionData {
  selectedDecision: string | null;
  options: string[];
  noOrderCreated: boolean;
  syntheticDemo: boolean;
  finalStatement: string;
}

export type AppStep =
  | 'safety-notice'
  | 'upload'
  | 'review'
  | 'confirmed';

export type RiskScenario = 'success' | 'unavailable' | 'error' | 'timeout' | 'failure';
export type AlternativesScenario = 'success' | 'empty' | 'error' | 'timeout';
export type Decision = 'keep' | 'switch' | null;
