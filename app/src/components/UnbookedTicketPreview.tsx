import {
  UNBOOKED_PREVIEW_DISCLOSURE,
  type UnbookedPreviewCard,
} from '../atlas/unbooked-previews';

interface UnbookedTicketPreviewProps {
  card: UnbookedPreviewCard;
  index: number;
  /** When false (default inside leg sections), the section renders disclosure once. */
  showDisclosureBanner?: boolean;
}

export function UnbookedTicketPreview({
  card,
  index,
  showDisclosureBanner = false,
}: UnbookedTicketPreviewProps) {
  const verified = card.status === 'verified' && card.isLiveVerified;
  const shortStatus = verified
    ? 'Verified just now'
    : (card.failureMessage ?? 'Could not verify this offer');

  return (
    <article
      className={`sc-unbooked-preview ${verified ? 'sc-unbooked-preview--verified' : 'sc-unbooked-preview--unverified'}`}
      aria-label={`Unbooked preview ${index + 1}`}
    >
      {showDisclosureBanner && (
        <p className="sc-unbooked-preview__disclosure" role="note">
          {UNBOOKED_PREVIEW_DISCLOSURE}
        </p>
      )}

      <p
        className={`sc-unbooked-preview__status ${verified ? 'sc-unbooked-preview__status--verified' : 'sc-unbooked-preview__status--failed'}`}
        role="status"
      >
        {shortStatus}
      </p>

      {card.isLiveVerified && (
        <span className="sc-source-tag sc-source-tag--live sc-unbooked-preview__live-tag">
          Atlas Sandbox · live
        </span>
      )}

      <header className="sc-unbooked-preview__header">
        <h4 className="sc-unbooked-preview__route">{card.routeSummary}</h4>
        <p className="sc-unbooked-preview__meta">
          {card.connectionType} · {card.departureTime}–{card.arrivalTime}
        </p>
      </header>

      {verified && card.verifySummary && (
        <dl className="sc-unbooked-preview__details">
          <div>
            <dt>Offer</dt>
            <dd>{card.offerReference}</dd>
          </div>
          <div>
            <dt>Search price</dt>
            <dd>{card.priceDisplay}</dd>
          </div>
          {card.verifySummary.currentPrice !== 'Not available from Atlas response' && (
            <div>
              <dt>Verified price</dt>
              <dd>
                {card.verifySummary.currency} {card.verifySummary.currentPrice}
              </dd>
            </div>
          )}
        </dl>
      )}
    </article>
  );
}
