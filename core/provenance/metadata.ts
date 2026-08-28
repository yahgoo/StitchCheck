/* ── Provenance metadata types and constructors ──
 *
 * Central provenance interfaces used by all label-resolution functions.
 * Each provider (OpenRouter extraction, Atlas, Nosana, Daytona) has its own provenance
 * shape; all share the core evidence-boundary semantics. */

/* ── Unified provider live status model ──
 *
 * Each provider result must use this status to drive UI labels.
 * Rules:
 *   status === 'live-success' → executed=true, fallbackUsed=false, real evidence exists
 *   status !== 'live-success' → do not use a live provider label */

export type ProviderLiveStatus =
  | 'live-success'
  | 'live-failed'
  | 'offline-fallback'
  | 'not-configured'
  | 'blocked-pending-approval';

export interface ProviderStatusResult {
  provider: 'openrouter' | 'nosana' | 'atlas';
  status: ProviderLiveStatus;
  executed: boolean;
  fallbackUsed: boolean;
  evidenceSource: string;
  retrievedAt: string;
  correlationId: string;
  errorCode?: string;
}

/**
 * Creates a ProviderStatusResult from provenance fields.
 * Derives the status from evidence fields rather than trusting a label.
 */
export function deriveProviderStatus(
  provider: ProviderStatusResult['provider'],
  fields: {
    evidenceSource?: string;
    executed?: boolean;
    fallbackUsed?: boolean;
    errorCode?: string | null;
  },
): ProviderStatusResult {
  const { evidenceSource = 'unknown', executed = false, fallbackUsed = true, errorCode } = fields;
  let status: ProviderLiveStatus;
  if (executed && !fallbackUsed && evidenceSource !== 'local-fixture' && evidenceSource !== 'local-fallback') {
    status = 'live-success';
  } else if (executed && fallbackUsed) {
    status = 'live-failed';
  } else if (!executed && evidenceSource === 'safety-gate-blocked') {
    status = 'blocked-pending-approval';
  } else if (!executed && (evidenceSource === 'local-fixture' || evidenceSource === 'local-fallback')) {
    status = 'offline-fallback';
  } else if (!executed) {
    status = 'not-configured';
  } else {
    status = 'offline-fallback';
  }
  return {
    provider,
    status,
    executed,
    fallbackUsed,
    evidenceSource,
    retrievedAt: new Date().toISOString(),
    correlationId: `corr-${Date.now()}`,
    ...(errorCode ? { errorCode: String(errorCode) } : {}),
  };
}

/* ── Provider-specific provenance interfaces ── */

export interface ExtractionProvenance {
  evidenceSource?: string;
  provider?: string;
  executed?: boolean;
  fallbackUsed?: boolean;
  validationOutcome?: string;
  syntheticDemo?: boolean;
  provenanceMode?: string;
}

/** @deprecated Use ExtractionProvenance */
export type GeminiProvenance = ExtractionProvenance;

export interface AtlasProvenance {
  evidenceSource?: string;
  provider?: string;
  executed?: boolean;
  fallbackUsed?: boolean;
  sourceEnvironment?: string;
  syntheticDemo?: boolean;
}

export interface NosanaProvenance {
  evidenceSource?: string;
  provider?: string;
  executed?: boolean;
  fallbackUsed?: boolean;
}

export interface DaytonaProvenance {
  evidenceSource: 'daytona-sandbox';
  provider: 'atlas';
  executed: true;
  fallbackUsed: false;
  readOnly: true;
  sandboxDestroyed: boolean;
  label: string;
}

/* ── Provenance constructors ── */

/**
 * Creates a Daytona provenance record for a successful sandbox execution.
 */
export function createDaytonaProvenance(sandboxDestroyed: boolean): DaytonaProvenance {
  return Object.freeze({
    evidenceSource: 'daytona-sandbox' as const,
    provider: 'atlas' as const,
    executed: true as const,
    fallbackUsed: false as const,
    readOnly: true as const,
    sandboxDestroyed,
    label: sandboxDestroyed
      ? 'Daytona sandbox evidence \u2014 Atlas Search/Verify, read-only'
      : 'Daytona sandbox evidence \u2014 sandbox not yet destroyed',
  });
}

/**
 * Creates a Daytona provenance record for a fallback / unavailable state.
 */
export function createDaytonaFallbackProvenance(): DaytonaProvenance {
  return Object.freeze({
    evidenceSource: 'daytona-sandbox' as const,
    provider: 'atlas' as const,
    executed: false as unknown as true,
    fallbackUsed: true as unknown as false,
    readOnly: true as const,
    sandboxDestroyed: false,
    label: 'Daytona sandbox unavailable \u2014 local fallback used',
  });
}
