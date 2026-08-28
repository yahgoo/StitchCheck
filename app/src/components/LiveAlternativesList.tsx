import { useState } from 'react';
import type { Alternative } from '../../../core/domain';
import type { VerifySummary } from '../atlas/adapter';
import type { Decision } from '../data/types';
import { splitAlternativesForDisplay } from '../atlas/unbooked-previews';

interface LiveAlternativesListProps {
  alternatives: Alternative[];
  selectedOfferId: string | null;
  verifyResult: VerifySummary | null;
  verifyLoading: boolean;
  decision: Decision;
  onVerifyAndSelectPlan: (offerId: string) => void;
}

function AlternativeCard({
  alt,
  isFeatured,
  showLowestPriceLabel,
  selectedOfferId,
  verifyResult,
  verifyLoading,
  decision,
  onVerifyAndSelectPlan,
}: {
  alt: Alternative;
  isFeatured: boolean;
  showLowestPriceLabel: boolean;
  selectedOfferId: string | null;
  verifyResult: VerifySummary | null;
  verifyLoading: boolean;
  decision: Decision;
  onVerifyAndSelectPlan: (offerId: string) => void;
}) {
  const isSelected = selectedOfferId === alt.offerReference;
  const isVerifying = isSelected && verifyLoading;
  const showVerifyOutcome = isSelected && verifyResult && !verifyLoading;

  return (
    <div
      className={`sc-alt-card ${isSelected && decision === 'switch' ? 'sc-alt-card--selected' : ''}`}
      data-featured={isFeatured ? 'true' : undefined}
    >
      {showLowestPriceLabel && (
        <span className="sc-alt-card__lowest-price">Lowest price shown</span>
      )}
      <h4>{alt.routeSummary}</h4>
      <p>{alt.connectionType} · {alt.departureTime}–{alt.arrivalTime}</p>
      <p>Price: {alt.priceDisplay} · Offer: {alt.offerReference}</p>
      <p>Availability: {alt.availabilityLabel}</p>
      {decision !== 'switch' && decision !== 'keep' && (
        <button
          className="sc-btn sc-btn--small sc-btn--primary"
          onClick={() => onVerifyAndSelectPlan(alt.offerReference)}
          disabled={verifyLoading}
          type="button"
        >
          {isVerifying ? 'Verifying…' : 'Verify and select plan'}
        </button>
      )}
      {showVerifyOutcome && (
        <div
          className={`sc-banner sc-banner--${verifyResult.status === 'success' ? 'success' : 'warning'}`}
          role="status"
        >
          <strong>Verify:</strong> {verifyResult.status}
          {verifyResult.code && ` (${verifyResult.code})`}
          <br />
          {verifyResult.message}
          {verifyResult.currentPrice !== 'Not available from Atlas response' && (
            <>
              <br />
              Current price: {verifyResult.currency} {verifyResult.currentPrice}
            </>
          )}
        </div>
      )}
      {isSelected && decision === 'switch' && (
        <span className="sc-selected-indicator" aria-label="Selected">✓ Selected</span>
      )}
    </div>
  );
}

export function LiveAlternativesList({
  alternatives,
  selectedOfferId,
  verifyResult,
  verifyLoading,
  decision,
  onVerifyAndSelectPlan,
}: LiveAlternativesListProps) {
  const [expanded, setExpanded] = useState(false);
  const { featured, remaining } = splitAlternativesForDisplay(alternatives);

  if (!featured) return null;

  return (
    <div className="sc-more-options">
      <h3 className="sc-more-options__title">
        Live Atlas alternatives ({alternatives.length})
      </h3>

      <div className="sc-more-options__featured">
        <AlternativeCard
          alt={featured}
          isFeatured
          showLowestPriceLabel
          selectedOfferId={selectedOfferId}
          verifyResult={verifyResult}
          verifyLoading={verifyLoading}
          decision={decision}
          onVerifyAndSelectPlan={onVerifyAndSelectPlan}
        />
      </div>

      {remaining.length > 0 && (
        <>
          {!expanded && (
            <button
              type="button"
              className="sc-unbooked-preview-leg__expand sc-more-options__expand"
              onClick={() => setExpanded(true)}
              aria-expanded={false}
            >
              See more live alternatives ({remaining.length})
            </button>
          )}

          {expanded && (
            <div
              className="sc-more-options__remaining"
              aria-label={`${remaining.length} additional live alternatives`}
            >
              {remaining.map((alt) => (
                <AlternativeCard
                  key={alt.offerReference}
                  alt={alt}
                  isFeatured={false}
                  showLowestPriceLabel={false}
                  selectedOfferId={selectedOfferId}
                  verifyResult={verifyResult}
                  verifyLoading={verifyLoading}
                  decision={decision}
                  onVerifyAndSelectPlan={onVerifyAndSelectPlan}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
