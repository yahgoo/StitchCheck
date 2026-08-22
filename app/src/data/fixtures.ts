/* ── Local fixture adapter ──
 * Imports synthetic demo data and fixture shapes from the repo.
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

/* ── Re-export raw demo data ── */
export { demoData };

/* ── Screenshot fixture catalogue ── */
export interface ScreenshotFixture {
  id: string;
  label: string;
  src: string;
}

export const screenshotFixtures: ScreenshotFixture[] = [
  { id: 'gem-01', label: 'GEM-01: Clear fictional two-leg itinerary', src: '../../../smoke-tests/gemini/fixtures/gem-01-two-leg-clean.png' },
  { id: 'gem-02', label: 'GEM-02: Fictional itinerary, one optional field absent', src: '../../../smoke-tests/gemini/fixtures/gem-02-two-leg-missing-optional.png' },
  { id: 'gem-03', label: 'GEM-03: Fragmented fictional layout', src: '../../../smoke-tests/gemini/fixtures/gem-03-two-leg-fragmented.png' },
  { id: 'gem-04', label: 'GEM-04: Fictional image, not a flight itinerary', src: '../../../smoke-tests/gemini/fixtures/gem-04-non-itinerary.png' },
  { id: 'gem-05', label: 'GEM-05: Fictional itinerary, one unreadable field', src: '../../../smoke-tests/gemini/fixtures/gem-05-unreadable-field.png' },
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
 * local synthetic fixture.
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

/* ── Default extraction (unconfirmed itinerary) ── */
export function getDefaultExtraction(): ExtractionResult {
  return demoData.uiStates.itineraryUnconfirmed.extractionResult as unknown as ExtractionResult;
}
