/* ── Centralised disclaimer / safety label constants ── */

export const LABELS = {
  geminiExtraction:
    'Synthetic local placeholder \u2014 not direct Gemini evidence',
  nosanaRisk:
    'Synthetic local placeholder \u2014 not Nosana evidence',
  nosanaRiskEvidence:
    'Nosana evidence \u2014 remote job succeeded; result from decentralized GPU workload',
  nosanaRiskFallback:
    'Nosana unavailable \u2014 local fallback used; not Nosana evidence',
  atlasAlternatives:
    'Synthetic local placeholder \u2014 not Atlas Sandbox evidence',
} as const;

export const DISABLED_MESSAGE = 'Confirm itinerary first';

export const FINAL_STATEMENT =
  'No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only.';
