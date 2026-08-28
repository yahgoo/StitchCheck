/* ── Itinerary domain model ──
 * Shared across browser app, orchestrators, and workers.
 * Extracted from app/src/data/types.ts as the canonical source. */

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
  /* Provenance fields for evidence-aware labeling */
  evidenceSource?: 'extraction-live' | 'extraction-offline' | 'local-fallback' | 'local-fixture';
  provider?: string;
  executed?: boolean;
  fallbackUsed?: boolean;
  validationOutcome?: 'valid' | 'invalid' | 'partial' | 'unknown';
  provenanceMode?: 'fictional-local' | 'live-evidence' | 'offline-replay';
}
