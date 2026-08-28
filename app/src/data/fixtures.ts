/* ── Local fixture adapter ──
 * Imports demo data and fixture shapes from the repo.
 * No external calls. No live service data. All content is local placeholder. */

import demoData from '../../../app-fixture-contracts/stitchcheck-ui-demo-data.json';

import nosSuccess from '../../../smoke-tests/nosana/fixtures/res-nos-success.json';
import nosError from '../../../smoke-tests/nosana/fixtures/res-nos-error.json';
import nosTimeout from '../../../smoke-tests/nosana/fixtures/res-nos-timeout.json';
import nosFailure from '../../../smoke-tests/nosana/fixtures/res-nos-failure.json';
import nosUnavailable from '../../../smoke-tests/nosana/fixtures/res-nos-unavailable.json';

import atlSuccess from '../../../smoke-tests/atlas/fixtures/result-atl-success.json';
import atlEmpty from '../../../smoke-tests/atlas/fixtures/result-atl-empty.json';
import atlError from '../../../smoke-tests/atlas/fixtures/result-atl-error.json';
import atlTimeout from '../../../smoke-tests/atlas/fixtures/result-atl-timeout.json';

import type {
  ExtractionResult,
  RiskResult,
  SearchResult,
  ComparisonData,
  DecisionData,
  RiskScenario,
  AlternativesScenario,
} from './types';

import type {
  DaytonaEvidenceEnvelope,
  AtlasEvidenceEnvelope,
} from '../../../core/contracts/envelopes';

/* ── Re-export raw demo data ── */
export { demoData };

/* ── Screenshot fixture catalogue ── */
export interface ScreenshotFixture {
  id: string;
  label: string;
  src: string;
}

export const screenshotFixtures: ScreenshotFixture[] = [
  { id: 'gem-01', label: 'GEM-01: Clear demo two-leg itinerary', src: '../../../smoke-tests/extraction/fixtures/gem-01-two-leg-clean.png' },
  { id: 'gem-02', label: 'GEM-02: Demo itinerary, one optional field absent', src: '../../../smoke-tests/extraction/fixtures/gem-02-two-leg-missing-optional.png' },
  { id: 'gem-03', label: 'GEM-03: Fragmented demo layout', src: '../../../smoke-tests/extraction/fixtures/gem-03-two-leg-fragmented.png' },
  { id: 'gem-04', label: 'GEM-04: Demo image, not a flight itinerary', src: '../../../smoke-tests/extraction/fixtures/gem-04-non-itinerary.png' },
  { id: 'gem-05', label: 'GEM-05: Demo itinerary, one unreadable field', src: '../../../smoke-tests/extraction/fixtures/gem-05-unreadable-field.png' },
];

/* ── Risk fixture lookup ── */
const riskFixtures: Record<RiskScenario, RiskResult> = {
  success: nosSuccess.riskResult as RiskResult,
  unavailable: nosUnavailable.riskResult as RiskResult,
  error: nosError.riskResult as RiskResult,
  timeout: nosTimeout.riskResult as RiskResult,
  failure: nosFailure.riskResult as RiskResult,
};

export function getRiskFixture(scenario: RiskScenario): RiskResult {
  return riskFixtures[scenario];
}

/* ── Nosana live result loader ──
 * Attempts to load the result from a real Nosana risk workload run.
 * If the file exists and carries evidenceSource === 'nosana-evidence',
 * the UI labels it as Nosana evidence. Otherwise, falls back to the
 * local demo fixture.
 */
export async function loadNosanaRiskResult(): Promise<RiskResult | null> {
  try {
    const res = await fetch('/nosana-risk-result.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    // The result file has a nested riskResult field
    if (data && data.riskResult) {
      return data.riskResult as RiskResult;
    }
    return null;
  } catch {
    return null;
  }
}

/* ── Alternatives fixture lookup ── */
const altFixtures: Record<AlternativesScenario, SearchResult> = {
  success: atlSuccess.searchResult as SearchResult,
  empty: atlEmpty.searchResult as SearchResult,
  error: atlError.searchResult as SearchResult,
  timeout: atlTimeout.searchResult as SearchResult,
};

export function getAlternativesFixture(scenario: AlternativesScenario): SearchResult {
  return altFixtures[scenario];
}

/* ── Comparison data ── */
export function getComparisonData(): ComparisonData {
  return demoData.uiStates.comparisonAndDecision.comparison as unknown as ComparisonData;
}

/* ── Decision data ── */
export function getDecisionData(): DecisionData {
  return demoData.uiStates.comparisonAndDecision.decision as unknown as DecisionData;
}

/* ── Daytona evidence loader ──
 * Attempts to load the Daytona sandbox evidence envelope.
 * If the file exists and is valid, the UI labels it as Daytona sandbox evidence.
 * Otherwise, returns null (caller should use local fallback). */
export async function loadDaytonaEvidence(): Promise<DaytonaEvidenceEnvelope | null> {
  try {
    const res = await fetch('/daytona-evidence.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.envelopeVersion === 1 && data.sanitized === true) {
      return data as DaytonaEvidenceEnvelope;
    }
    return null;
  } catch {
    return null;
  }
}

/* ── Atlas evidence loader ──
 * Attempts to load the Atlas evidence envelope.
 * If the file exists and is valid, the UI labels it as Atlas evidence.
 * Otherwise, returns null (caller should use local fallback). */
export async function loadAtlasEvidence(): Promise<AtlasEvidenceEnvelope | null> {
  try {
    const res = await fetch('/atlas-evidence.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.envelopeVersion === 1) {
      return data as AtlasEvidenceEnvelope;
    }
    return null;
  } catch {
    return null;
  }
}

/* ── Default extraction (unconfirmed itinerary) ──
 * The fixture data uses a coherent KUL → BKK → HAN route.
 * The browser walkthrough itself uses this local fixture and makes no provider call.
 * Provenance is labelled accordingly: local-fixture. */
export function getDefaultExtraction(): ExtractionResult {
  const base = demoData.uiStates.itineraryUnconfirmed.extractionResult as unknown as ExtractionResult;
  return {
    ...base,
    evidenceSource: 'local-fixture',
    provider: 'local',
    executed: false,
    fallbackUsed: true,
    validationOutcome: 'valid',
  };
}
