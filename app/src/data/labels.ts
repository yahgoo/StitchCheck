/* ── Centralised disclaimer / safety label constants ──
 *
 * Provenance-aware labeling model:
 *   - Labels are selected based on evidence fields (evidenceSource,
 *     fallbackUsed, validationOutcome), not provider name alone.
 *   - Live evidence labels are used only when verified success data exists.
 *   - Offline/fallback labels are used for fixtures, mocks, and local data.
 *   - No label ever claims booking/payment completion.
 */

/* ── Provenance interfaces ── */

export interface GeminiProvenance {
  evidenceSource?: string;
  provider?: string;
  executed?: boolean;
  fallbackUsed?: boolean;
  validationOutcome?: string;
  syntheticDemo?: boolean;
  provenanceMode?: string;
}

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

/* ── Gemini labels ── */

export const GEMINI_LABELS = {
  /** Direct Google Gemini 3.7 — live extraction validated, schema-valid, no fallback. */
  liveValidated: 'Direct Gemini 3.7 — live validated',
  /** Local browser fixture — fictional itinerary, not from any live provider call. */
  localFixture: 'Fictional itinerary — local demo fixture',
  /** Offline fixture or fallback — not from a live Gemini call. */
  offlineFixture: 'Offline fixture — not direct Gemini evidence',
} as const;

/**
 * Selects the correct Gemini label based on evidence provenance.
 *
 * Live validated label requires ALL of:
 *   evidenceSource='gemini-live', provider='gemini', executed=true,
 *   fallbackUsed=false, validationOutcome='valid'.
 * Local fixture label: evidenceSource='local-fixture' + executed=false + fallbackUsed=true.
 * Other / missing / contradictory provenance → conservative offline label.
 */
export function getGeminiLabel(provenance: GeminiProvenance): string {
  if (
    provenance.evidenceSource === 'gemini-live' &&
    provenance.provider === 'gemini' &&
    provenance.executed === true &&
    provenance.fallbackUsed === false &&
    provenance.validationOutcome === 'valid'
  ) {
    return GEMINI_LABELS.liveValidated;
  }
  if (
    provenance.evidenceSource === 'local-fixture' &&
    provenance.executed === false &&
    provenance.fallbackUsed === true
  ) {
    return GEMINI_LABELS.localFixture;
  }
  return GEMINI_LABELS.offlineFixture;
}

/* ── Atlas labels ── */

export const ATLAS_UI_LABELS = {
  /** Atlas Sandbox Search/Verify — live evidence from verified sandbox artifact. */
  sandboxLive: 'Atlas Sandbox — live Search/Verify',
  /** Atlas production Search — read-only reference-price results. */
  productionSearch: 'Atlas production Search — reference prices only',
  /** Local browser fixture — fictional alternatives, not from any live Atlas call. */
  localFixture: 'Fictional alternatives — local demo fixture',
  /** Offline fixture or fallback — not from live Atlas Sandbox evidence. */
  offlineFixture: 'Offline fixture — not Atlas Sandbox evidence',
} as const;

/**
 * Selects the correct Atlas label based on evidence provenance.
 *
 * - evidenceSource='atlas-sandbox' + executed=true + fallbackUsed=false → live Sandbox label.
 * - evidenceSource='atlas-production' + executed=true + fallbackUsed=false → production Search label.
 * - evidenceSource='local-fixture' → fictional alternatives label.
 * - Other / missing / contradictory provenance → conservative offline label.
 */
export function getAtlasLabel(provenance: AtlasProvenance): string {
  if (
    provenance.evidenceSource === 'atlas-sandbox' &&
    provenance.executed === true &&
    provenance.fallbackUsed === false
  ) {
    return ATLAS_UI_LABELS.sandboxLive;
  }
  if (
    provenance.evidenceSource === 'atlas-production' &&
    provenance.executed === true &&
    provenance.fallbackUsed === false
  ) {
    return ATLAS_UI_LABELS.productionSearch;
  }
  if (provenance.evidenceSource === 'local-fixture') {
    return ATLAS_UI_LABELS.localFixture;
  }
  return ATLAS_UI_LABELS.offlineFixture;
}

/* ── Nosana labels ── */

export const NOSANA_UI_LABELS = {
  /** Generic local fallback — not Nosana evidence. */
  localFallback: 'Local fallback — not Nosana evidence',
  /** Nosana workload validated offline; local fallback used in the demo. */
  offlineValidated:
    'Nosana workload validated offline — local fallback used; not Nosana evidence',
  /** Nosana live evidence — reconciled job result from decentralized GPU workload. */
  liveEvidence:
    'Nosana evidence — remote job succeeded; result from decentralized GPU workload.',
} as const;

/**
 * Selects the correct Nosana label based on evidence provenance.
 *
 * - evidenceSource='nosana-evidence' + fallbackUsed=false → live evidence label.
 * - evidenceSource='nosana-evidence' + fallbackUsed=true → offline validated (fallback used).
 * - Other / local-fallback → local fallback label.
 */
export function getNosanaLabel(provenance: NosanaProvenance): string {
  if (
    provenance.evidenceSource === 'nosana-evidence' &&
    provenance.fallbackUsed === false
  ) {
    return NOSANA_UI_LABELS.liveEvidence;
  }
  if (provenance.evidenceSource === 'nosana-evidence') {
    // Nosana evidence source but fallback was used — conservative label
    return NOSANA_UI_LABELS.offlineValidated;
  }
  return NOSANA_UI_LABELS.localFallback;
}

/* ── Historical OpenRouter label ── */

export const OPENROUTER_HISTORICAL_LABEL =
  'Historical temporary OpenRouter test path — not the active provider';

/* ── Backward-compatible LABELS object ──
 * Default (conservative) labels used when provenance is unknown or disabled.
 */

export const LABELS = {
  geminiExtraction: GEMINI_LABELS.localFixture,
  nosanaRisk: NOSANA_UI_LABELS.localFallback,
  nosanaRiskEvidence: NOSANA_UI_LABELS.liveEvidence,
  nosanaRiskLive: NOSANA_UI_LABELS.liveEvidence,
  nosanaRiskOffline: NOSANA_UI_LABELS.offlineValidated,
  nosanaRiskFallback: NOSANA_UI_LABELS.offlineValidated,
  atlasAlternatives: ATLAS_UI_LABELS.localFixture,
} as const;

export const DISABLED_MESSAGE = 'Confirm itinerary first';

export const FINAL_STATEMENT =
  'No booking, payment, reservation, ticket, order, verification, or other write action has been created. This demo uses fictional data only.';
