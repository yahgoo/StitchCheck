/** Copy strings from docs/minimax-visibility-fix-spec-2026-08-28.md — do not paraphrase. */

export const WELCOME_SCREENSHOT_SAMPLE_CTA =
  'Extract with MiniMax M3';

export const WELCOME_SCREENSHOT_SAMPLE_HELPER =
  'Use a sample itinerary screenshot. MiniMax M3 will extract your flights and dates.';

export const WELCOME_READY_MADE_CTA =
  'Use sample — no extraction';

export const WELCOME_READY_MADE_HELPER =
  'Fast preview with itinerary data already loaded.';

export const MINIMAX_EXTRACTION_LOADING =
  'MiniMax M3 is reading your itinerary…';

export const MINIMAX_PROVENANCE_TAG = 'Extracted by MiniMax M3';

export const MINIMAX_OFFLINE_STATUS = 'MiniMax M3: offline';

export const MINIMAX_OFFLINE_EXPLANATION =
  'Expected for this fast path — a ready-made itinerary was loaded directly, so no MiniMax M3 extraction request was made.';

export const PROVIDER_CHECK_COUNT = 4;

export function providerChecksSummary(completedCount: number): string {
  return `Provider checks: ${completedCount} of ${PROVIDER_CHECK_COUNT} complete`;
}
