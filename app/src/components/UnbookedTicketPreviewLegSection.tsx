import { useState } from 'react';
import { UnbookedTicketPreview } from './UnbookedTicketPreview';
import {
  buildSectionLiveSourceLabel,
  splitPreviewCardsForDisplay,
  UNBOOKED_PREVIEW_DISCLOSURE,
  type LegUnbookedPreviewSection,
} from '../atlas/unbooked-previews';
import { formatMissingField } from '../data/labels';

interface UnbookedTicketPreviewLegSectionProps {
  section: LegUnbookedPreviewSection;
}

export function UnbookedTicketPreviewLegSection({ section }: UnbookedTicketPreviewLegSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const liveSourceLabel = buildSectionLiveSourceLabel(section.liveVerifiedCount);
  const { best, remaining } = splitPreviewCardsForDisplay(section.cards);

  return (
    <section
      className="sc-unbooked-preview-leg"
      aria-label={section.title}
      data-leg={section.legKey}
    >
      <h3 className="sc-unbooked-preview-leg__title">{section.title}</h3>
      <p className="sc-unbooked-preview-leg__route">
        {section.origin} → {section.destination}
      </p>

      {section.loading && (
        <p className="sc-unbooked-preview-leg__status" role="status">
          Loading unbooked previews…
        </p>
      )}

      {!section.loading && section.placeholderBlocked && (
        <p className="sc-unbooked-preview-leg__fallback" role="status">
          {section.fallbackMessage ?? formatMissingField('critical')}
        </p>
      )}

      {!section.loading && section.searchUnavailable && !section.placeholderBlocked && (
        <p className="sc-unbooked-preview-leg__fallback" role="status">
          {section.fallbackMessage ?? formatMissingField('critical')}
        </p>
      )}

      {!section.loading && best && (
        <>
          <p className="sc-unbooked-preview-leg__disclosure" role="note">
            {UNBOOKED_PREVIEW_DISCLOSURE}
          </p>

          <div className="sc-unbooked-preview-leg__featured">
            <UnbookedTicketPreview card={best} index={0} />
          </div>

          {remaining.length > 0 && (
            <>
              {!expanded && (
                <button
                  type="button"
                  className="sc-unbooked-preview-leg__expand"
                  onClick={() => setExpanded(true)}
                  aria-expanded={false}
                >
                  See more verified options ({remaining.length})
                </button>
              )}

              {expanded && (
                <div
                  className="sc-unbooked-preview-leg__cards"
                  aria-label={`${remaining.length} additional unbooked preview options`}
                >
                  {remaining.map((card, index) => (
                    <UnbookedTicketPreview
                      key={`${section.legKey}-${card.offerReference}-${index + 1}`}
                      card={card}
                      index={index + 1}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {liveSourceLabel && (
        <p className="sc-source-note sc-unbooked-preview-leg__source">{liveSourceLabel}</p>
      )}
    </section>
  );
}
