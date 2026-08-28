/* ── Evidence envelope contracts ──
 *
 * Defines the typed shapes for Daytona and Atlas evidence envelopes.
 * These are the canonical contracts for data passed between
 * orchestrators, workers, and the browser app. */

/* ── Daytona evidence envelope ── */

export interface DaytonaEvidenceEnvelope {
  envelopeVersion: 1;
  correlationId: string;
  sandboxId: string;
  createdAt: string;
  destroyedAt: string | null;
  operations: DaytonaOperation[];
  provenance: DaytonaEnvelopeProvenance;
  sanitized: true;
}

export interface DaytonaOperation {
  operation: 'search' | 'verify';
  status: 'success' | 'error' | 'timeout' | 'forbidden';
  requestSummary: DaytonaRequestSummary;
  responseSummary: DaytonaResponseSummary;
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface DaytonaRequestSummary {
  origin: string;
  destination: string;
  departureDate: string;
  currency: string;
}

export interface DaytonaResponseSummary {
  offerCount?: number;
  firstOfferReference?: string;
  priceDisplay?: string;
  currency?: string;
  verifyStatus?: string;
}

export interface DaytonaEnvelopeProvenance {
  evidenceSource: 'daytona-sandbox';
  provider: 'atlas';
  executed: boolean;
  fallbackUsed: boolean;
  readOnly: true;
  sandboxDestroyed: boolean;
  label: string;
}

/* ── Atlas evidence envelope ── */

export interface AtlasEvidenceEnvelope {
  envelopeVersion: 1;
  correlationId: string;
  createdAt: string;
  operations: AtlasOperation[];
  provenance: AtlasEnvelopeProvenance;
  simulation?: SimulatedTicketingLifecycle;
}

export interface AtlasOperation {
  operation: 'search' | 'verify';
  status: 'success' | 'error' | 'timeout';
  requestSummary: Record<string, unknown>;
  responseSummary: Record<string, unknown>;
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface AtlasEnvelopeProvenance {
  evidenceSource: 'atlas-sandbox' | 'atlas-production' | 'atlas-simulated' | 'local-fallback';
  provider: 'atlas';
  executed: boolean;
  fallbackUsed: boolean;
  readOnly: boolean;
  label: string;
}

/* ── Simulated ticketing lifecycle ── */

export interface SimulatedTicketingLifecycle {
  simulationOnly: true;
  steps: SimulatedTicketingStep[];
  finalDisclaimer: 'SIMULATION ONLY \u2014 no real order, payment, or ticket created';
}

export interface SimulatedTicketingStep {
  step: 'order-created' | 'payment-pending' | 'ticket-issued';
  status: 'simulated';
  simulatedAt: string;
  disclaimer: string;
}

/* ── Envelope constructors ── */

/**
 * Creates a Daytona fallback envelope for when the sandbox is unavailable.
 */
export function createDaytonaFallbackEnvelope(
  correlationId: string,
  _reason: string,
): Readonly<DaytonaEvidenceEnvelope> {
  return Object.freeze({
    envelopeVersion: 1 as const,
    correlationId,
    sandboxId: '',
    createdAt: new Date().toISOString(),
    destroyedAt: null,
    operations: [],
    provenance: Object.freeze({
      evidenceSource: 'daytona-sandbox' as const,
      provider: 'atlas' as const,
      executed: false,
      fallbackUsed: true,
      readOnly: true as const,
      sandboxDestroyed: false,
      label: 'Daytona sandbox unavailable \u2014 local fallback used',
    }),
    sanitized: true as const,
  });
}

/**
 * Creates an Atlas fallback envelope for when the adapter is disabled.
 */
export function createAtlasFallbackEnvelope(
  correlationId: string,
  _reason: string,
): Readonly<AtlasEvidenceEnvelope> {
  return Object.freeze({
    envelopeVersion: 1 as const,
    correlationId,
    createdAt: new Date().toISOString(),
    operations: [],
    provenance: Object.freeze({
      evidenceSource: 'local-fallback' as const,
      provider: 'atlas' as const,
      executed: false,
      fallbackUsed: true,
      readOnly: false,
      label: 'Offline fixture \u2014 not Atlas Sandbox evidence',
    }),
  });
}
