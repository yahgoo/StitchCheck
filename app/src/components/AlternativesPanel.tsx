import { DISABLED_MESSAGE } from '../data/labels';
import { DataSourceTag } from './DataSourceTag';
import type { DataSource } from './DataSourceTag';
import type { SearchResult, AlternativesScenario } from '../data/types';
import type { VerifySummary } from '../atlas/adapter';

interface Props {
  enabled: boolean;
  searchResult: SearchResult | null;
  scenario: AlternativesScenario;
  onScenarioChange: (s: AlternativesScenario) => void;
  /* Live mode props */
  isLive?: boolean;
  isLiveLoading?: boolean;
  onVerifyOffer?: (offerId: string) => void;
  onRetrySearch?: () => void;
  verifyResult?: VerifySummary | null;
  verifyLoading?: boolean;
  selectedOfferId?: string | null;
}

export function AlternativesPanel({
  enabled,
  searchResult,
  scenario,
  onScenarioChange,
  isLive = false,
  isLiveLoading = false,
  onVerifyOffer,
  onRetrySearch,
  verifyResult = null,
  verifyLoading = false,
  selectedOfferId = null,
}: Props) {

  if (!enabled) {
    return (
      <section className="sc-panel sc-panel--disabled" aria-label="Safer alternatives" aria-disabled="true">
        <h2>Safer Alternatives</h2>
        <DataSourceTag source="local-fixture" />
        <div className="sc-panel__locked">
          <span className="sc-panel__lock-icon" aria-hidden="true">🔒</span>
          <p>{DISABLED_MESSAGE}</p>
        </div>
      </section>
    );
  }

  if (isLiveLoading) {
    return (
      <section className="sc-panel" aria-label="Safer alternatives">
        <h2>Safer Alternatives — Searching…</h2>
        <DataSourceTag source="atlas-live" />
        <div className="sc-banner sc-banner--loading" role="status">
          Contacting Atlas Sandbox — live Search in progress…
        </div>
      </section>
    );
  }

  if (!searchResult) {
    return (
      <section className="sc-panel" aria-label="Safer alternatives">
        <h2>Safer Alternatives</h2>
        <DataSourceTag source="local-fixture" />
        <div className="sc-banner sc-banner--loading" role="status">Searching for alternatives…</div>
      </section>
    );
  }

  const isEmpty = searchResult.searchStatus === 'empty';
  const isError = searchResult.searchStatus === 'error';
  const isTimeout = searchResult.searchStatus === 'timeout';
  const isSuccess = searchResult.searchStatus === 'completed';

  /* Determine data source tag from provenance — never from global mode alone. */
  let dataSource: DataSource = 'local-fixture';
  if (isSuccess && searchResult.evidenceSource === 'atlas-sandbox'
      && searchResult.executed === true && searchResult.fallbackUsed === false) {
    dataSource = 'atlas-live';
  } else if (searchResult.fallbackUsed === true && searchResult.evidenceSource === 'local-fixture') {
    dataSource = 'offline-fallback';
  }

  return (
    <section className="sc-panel" aria-label="Safer alternatives">
      <h2>Safer Alternatives</h2>
      <DataSourceTag source={dataSource} />
      <p className="sc-panel__env-label">
        Source environment: <strong>{searchResult.sourceEnvironment}</strong>
      </p>

      {/* In offline mode, show the scenario selector */}
      {!isLive && (
        <div className="sc-demo-control">
          <label htmlFor="alt-scenario">Demo scenario:</label>
          <select
            id="alt-scenario"
            value={scenario}
            onChange={(e) => onScenarioChange(e.target.value as AlternativesScenario)}
          >
            <option value="success">Success (2 alternatives)</option>
            <option value="empty">Empty (no results)</option>
            <option value="error">Error</option>
            <option value="timeout">Timeout</option>
          </select>
        </div>
      )}

      {isSuccess && (
        <>
          <p>
            Alternatives are read-only. No booking, payment, or order is created.
          </p>
          <div className="sc-alternatives-list">
            {searchResult.alternatives.map((alt) => (
              <div key={alt.offerReference} className="sc-alternative-card">
                <h3>{alt.routeSummary}</h3>
                <dl className="sc-alt-details">
                  <dt>Departure:</dt><dd>{alt.departureTime}</dd>
                  <dt>Arrival:</dt><dd>{alt.arrivalTime}</dd>
                  <dt>Duration:</dt><dd>{alt.duration}</dd>
                  <dt>Type:</dt><dd>{alt.connectionType}</dd>
                  <dt>Connection:</dt><dd>{alt.connectionDurationMinutes} min</dd>
                  <dt>Price:</dt><dd>{alt.priceDisplay}</dd>
                  <dt>Currency:</dt><dd>{alt.currency}</dd>
                  <dt>Availability:</dt><dd>{alt.availabilityLabel}</dd>
                </dl>
                <p className="sc-alt-ref">
                  Offer ID: {alt.offerReference} (display-only)
                </p>
                {isLive && onVerifyOffer && (
                  <button
                    type="button"
                    className="sc-btn sc-btn--small sc-btn--primary"
                    onClick={() => onVerifyOffer(alt.offerReference)}
                    disabled={verifyLoading}
                  >
                    {selectedOfferId === alt.offerReference && verifyLoading
                      ? 'Verifying…'
                      : 'Verify offer'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Verify result display */}
          {verifyResult && isLive && (
            <div className={`sc-banner sc-banner--${verifyResult.status === 'success' ? 'success' : 'warning'}`} role="status">
              <strong>Verify status:</strong> {verifyResult.status}
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
        </>
      )}

      {isEmpty && (
        <>
          <div className="sc-banner sc-banner--empty" role="status">
            <strong>No results:</strong> No safer alternatives were found for
            this itinerary.{isLive ? '' : ' This is a local offline fixture result.'}
          </div>
          <div className="sc-panel-actions">
            {isLive && onRetrySearch ? (
              <button className="sc-btn sc-btn--primary" type="button" onClick={onRetrySearch} aria-label="Retry alternative search">
                Retry alternative search
              </button>
            ) : (
              <button className="sc-btn sc-btn--primary" disabled type="button" aria-label="Retry alternative search — disabled in demo mode">
                Retry alternative search
              </button>
            )}
          </div>
          {!isLive && (
            <p className="sc-panel__demo-note">Retry is unavailable in this demo mode. No live provider is connected.</p>
          )}
        </>
      )}

      {isError && (
        <>
          <div className="sc-banner sc-banner--error" role="alert">
            <strong>Error{searchResult.errorCode ? ` (${searchResult.errorCode})` : ''}:</strong>{' '}
            {searchResult.errorMessage ?? 'The alternative search could not be completed.'}
          </div>
          <div className="sc-panel-actions">
            {isLive && onRetrySearch ? (
              <button className="sc-btn sc-btn--primary" type="button" onClick={onRetrySearch} aria-label="Retry alternative search">
                Retry alternative search
              </button>
            ) : (
              <button className="sc-btn sc-btn--primary" disabled type="button" aria-label="Retry alternative search — disabled in demo mode">
                Retry alternative search
              </button>
            )}
          </div>
          {!isLive && (
            <p className="sc-panel__demo-note">Retry is unavailable in this demo mode. No live provider is connected.</p>
          )}
        </>
      )}

      {isTimeout && (
        <>
          <div className="sc-banner sc-banner--warning" role="status">
            <strong>Timeout{searchResult.errorCode ? ` (${searchResult.errorCode})` : ''}:</strong>{' '}
            {searchResult.errorMessage ?? 'The alternative search did not complete in time.'}
          </div>
          <div className="sc-panel-actions">
            {isLive && onRetrySearch ? (
              <button className="sc-btn sc-btn--primary" type="button" onClick={onRetrySearch} aria-label="Retry alternative search">
                Retry alternative search
              </button>
            ) : (
              <button className="sc-btn sc-btn--primary" disabled type="button" aria-label="Retry alternative search — disabled in demo mode">
                Retry alternative search
              </button>
            )}
          </div>
          {!isLive && (
            <p className="sc-panel__demo-note">Retry is unavailable in this demo mode. No live provider is connected.</p>
          )}
        </>
      )}
    </section>
  );
}
