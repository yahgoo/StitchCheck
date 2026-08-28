/* ── Traveller-facing copy for missing/null evidence fields ──
 *
 * critical: gaps that materially affect a decision (price, route, section fallback)
 * nonCritical: secondary/cosmetic fields (duration, buffer minutes, dep/arr times)
 *
 * Never implies data exists when it does not. */

export const MISSING_FIELD_LABELS = {
  critical: "We don't have this yet",
  nonCritical: '—',
} as const;

export type MissingFieldCategory = keyof typeof MISSING_FIELD_LABELS;

export function formatMissingField(category: MissingFieldCategory = 'nonCritical'): string {
  return MISSING_FIELD_LABELS[category];
}
