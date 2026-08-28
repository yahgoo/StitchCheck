/* Node mirror of core/copy/missing-field-labels.ts for offline smoke tests. */

export const MISSING_FIELD_LABELS = {
  critical: "We don't have this yet",
  nonCritical: '—',
};

export function formatMissingField(category = 'nonCritical') {
  return MISSING_FIELD_LABELS[category] ?? MISSING_FIELD_LABELS.nonCritical;
}
