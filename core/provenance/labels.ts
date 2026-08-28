/* ── Centralised disclaimer / safety label constants ──
 *
 * Provenance-aware labeling model:
 *   - Labels are selected based on evidence fields (evidenceSource,
 *     fallbackUsed, validationOutcome), not provider name alone.
 *   - Live evidence labels are used only when verified success data exists.
 *   - Offline/fallback labels are used for fixtures, mocks, and local data.
 *   - No label ever claims booking/payment completion; no real order created.
 *
 * This is the canonical source. app/src/data/labels.ts re-exports from here. */

import type {
  ExtractionProvenance,
  AtlasProvenance,
  NosanaProvenance,
} from './metadata';

/* ── Itinerary extraction labels (MiniMax M3 via OpenRouter) ── */

export const EXTRACTION_PROVIDER_LABELS = {
  localFixture: 'Local fixture',
  offlineFixture: 'Local fixture',
  liveExtraction:
    'Source: AI extraction (MiniMax M3 via OpenRouter) \u00b7 live',
  unavailable: 'AI extraction unavailable',
} as const;

/** @deprecated Use EXTRACTION_PROVIDER_LABELS */
export const GEMINI_LABELS = EXTRACTION_PROVIDER_LABELS;

/**
 * Selects the extraction provider label from evidence provenance.
 */
export function getExtractionProviderLabel(provenance: ExtractionProvenance): string {
  if (
    provenance.evidenceSource === 'extraction-live' &&
    provenance.provider === 'openrouter' &&
    provenance.executed === true &&
    provenance.fallbackUsed === false
  ) {
    return EXTRACTION_PROVIDER_LABELS.liveExtraction;
  }
  if (
    provenance.evidenceSource === 'extraction-live' &&
    provenance.executed === true &&
    provenance.fallbackUsed === true
  ) {
    return EXTRACTION_PROVIDER_LABELS.unavailable;
  }
  return EXTRACTION_PROVIDER_LABELS.localFixture;
}

/** @deprecated Use getExtractionProviderLabel */
export function getGeminiLabel(provenance: ExtractionProvenance): string {
  return getExtractionProviderLabel(provenance);
}

/* ── Atlas labels ── */

export const ATLAS_UI_LABELS = {
  /** Atlas Sandbox Search/Verify — live evidence from verified sandbox artifact. */
  sandboxLive: 'Atlas Sandbox \u2014 live Search/Verify',
  /** Local browser fixture — demo alternatives, not from any live Atlas call. */
  localFixture: 'Local fixture',
  /** Offline fixture or fallback — not from Atlas Sandbox evidence. */
  offlineFixture: 'Offline fallback',
  /** Daytona sandbox evidence — Atlas Search/Verify, read-only. */
  daytonaSandbox: 'Daytona sandbox evidence \u2014 Atlas Search/Verify, read-only',
  /** Daytona sandbox unavailable — local fallback used. */
  daytonaFallback: 'Daytona sandbox unavailable \u2014 local fallback used',
  /** Atlas Sandbox write rehearsal — scaffold/test flow only.
   *  Never a live production booking, payment, or airline ticket. */
  sandboxWrites: 'Source: Atlas Sandbox \u00b7 test flow',
} as const;

/** Disclosure for every Atlas Sandbox write-rehearsal surface.
 *  Exact wording required by the write-routing spec (Section 6). */
export const SANDBOX_WRITE_DISCLOSURE =
  'Sandbox only \u2014 no real booking, charge, or airline ticket';

/**
 * Selects the correct Atlas label based on evidence provenance.
 *
 * - evidenceSource='atlas-sandbox' + executed=true + fallbackUsed=false -> live Sandbox label.
 * - evidenceSource='atlas-production' + executed=true + fallbackUsed=false -> production Search label.
 * - evidenceSource='daytona-sandbox' + executed=true + fallbackUsed=false -> Daytona sandbox label.
 * - evidenceSource='daytona-sandbox' + fallbackUsed=true -> Daytona fallback label.
 * - evidenceSource='atlas-sandbox-writes' -> Sandbox write-rehearsal test-flow label.
 * - evidenceSource='atlas-simulated' -> simulated ticketing label.
 * - evidenceSource='local-fixture' -> demo alternatives label.
 * - Other / missing / contradictory provenance -> conservative offline label.
 */
export function getAtlasLabel(provenance: AtlasProvenance): string {
  if (provenance.evidenceSource === 'atlas-sandbox-writes') {
    return ATLAS_UI_LABELS.sandboxWrites;
  }
  if (
    provenance.evidenceSource === 'atlas-sandbox' &&
    provenance.executed === true &&
    provenance.fallbackUsed === false
  ) {
    return ATLAS_UI_LABELS.sandboxLive;
  }
  if (
    provenance.evidenceSource === 'daytona-sandbox' &&
    provenance.executed === true &&
    provenance.fallbackUsed === false
  ) {
    return ATLAS_UI_LABELS.daytonaSandbox;
  }
  if (
    provenance.evidenceSource === 'daytona-sandbox' &&
    provenance.fallbackUsed === true
  ) {
    return ATLAS_UI_LABELS.daytonaFallback;
  }
  if (provenance.evidenceSource === 'local-fixture') {
    return ATLAS_UI_LABELS.localFixture;
  }
  return ATLAS_UI_LABELS.offlineFixture;
}

/* ── Nosana labels ── */

export const NOSANA_UI_LABELS = {
  /** Generic local fallback — not Nosana evidence. */
  localFallback: 'Local fallback \u2014 not Nosana evidence',
  /** Nosana workload validated offline; local fallback used in the demo. */
  offlineValidated:
    'Nosana workload validated offline \u2014 local fallback used; not Nosana evidence',
  /** Nosana live evidence — reconciled job result from decentralized GPU workload. */
  liveEvidence:
    'Nosana evidence \u2014 remote job succeeded; result from decentralized GPU workload.',
} as const;

/**
 * Selects the correct Nosana label based on evidence provenance.
 *
 * - evidenceSource='nosana-evidence' + fallbackUsed=false -> live evidence label.
 * - evidenceSource='nosana-evidence' + fallbackUsed=true -> offline validated (fallback used).
 * - Other / local-fallback -> local fallback label.
 */
export function getNosanaLabel(provenance: NosanaProvenance): string {
  if (
    provenance.evidenceSource === 'nosana-evidence' &&
    provenance.fallbackUsed === false
  ) {
    return NOSANA_UI_LABELS.liveEvidence;
  }
  if (provenance.evidenceSource === 'nosana-evidence') {
    return NOSANA_UI_LABELS.offlineValidated;
  }
  return NOSANA_UI_LABELS.localFallback;
}

/* ── Historical OpenRouter label ── */

export const OPENROUTER_HISTORICAL_LABEL =
  'Historical temporary OpenRouter test path \u2014 not the active provider';

/* ── Backward-compatible LABELS object ──
 * Default (conservative) labels used when provenance is unknown or disabled. */

export const LABELS = {
  extractionProvider: EXTRACTION_PROVIDER_LABELS.localFixture,
  geminiExtraction: EXTRACTION_PROVIDER_LABELS.localFixture,
  nosanaRisk: NOSANA_UI_LABELS.localFallback,
  nosanaRiskEvidence: NOSANA_UI_LABELS.liveEvidence,
  nosanaRiskLive: NOSANA_UI_LABELS.liveEvidence,
  nosanaRiskOffline: NOSANA_UI_LABELS.offlineValidated,
  nosanaRiskFallback: NOSANA_UI_LABELS.offlineValidated,
  atlasAlternatives: ATLAS_UI_LABELS.localFixture,
} as const;

export const DISABLED_MESSAGE = 'Confirm itinerary first';

export const FINAL_STATEMENT =
  'No booking, payment, reservation, ticket, order, verification, or other write action has been created. This demo uses local fixture data.';
