import { LABELS, DISABLED_MESSAGE } from '../data/labels';
import type { SearchResult, AlternativesScenario } from '../data/types';

interface Props {
  enabled: boolean;
  searchResult: SearchResult | null;
  scenario: AlternativesScenario;
  onScenarioChange: (s: AlternativesScenario) => void;
}

export function AlternativesPanel({ enabled, searchResult, scenario, onScenarioChange }: Props) {

  if (!enabled) {
    return (
      <section className="sc-panel sc-panel--disabled" aria-label="Safer alternatives" aria-disabled="true">
        <h2>Safer Alternatives</h2>
        <p className="sc-source-label">{LABELS.atlasAlternatives}</p>
        <div className="sc-panel__locked">
          <span className="sc-panel__lock-icon" aria-hidden="true">🔒</span>
          <p>{DISABLED_MESSAGE}</p>
        </div>
      </section>
    );
  }

  if (!searchResult) {
    return (
      <section className="sc-panel" aria-label="Safer alternatives">
        <h2>Safer Alternatives</h2>
        <p className="sc-source-label">{LABELS.atlasAlternatives}</p>
        <div className="sc-banner sc-banner--loading" role="status">Searching for alternatives…</div>
      </section>
    );
  }

  const isEmpty = searchResult.searchStatus === 'empty';
  const isError = searchResult.searchStatus === 'error';
  const isTimeout = searchResult.searchStatus === 'timeout';
  const isSuccess = searchResult.searchStatus === 'completed';

  return (
    <section className="sc-panel" aria-label="Safer alternatives">
      <h2>
        Safer Alternatives
        {isSuccess && ' — Sandbox Results'}
        {isEmpty && ' — No Results'}
        {isError && ' — Search Error'}
        {isTimeout && ' — Search Timeout'}
      </h2>
      <p className="sc-source-label">{LABELS.atlasAlternatives}</p>
      <p className="sc-panel__env-label">
        Source environment: <strong>{searchResult.sourceEnvironment}</strong>
      </p>

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

      {isSuccess && (
        <>
          <p>
            The following alternatives were returned from a local synthetic
            placeholder search. All results are fictional and for demo display
            only. Atlas content is search-only; no booking, payment, or order is
            created.
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
                  <dt>Availability:</dt><dd>{alt.availabilityLabel}</dd>
                </dl>
                <p className="sc-alt-ref">
                  Reference: {alt.offerReference} (display-only)
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {isEmpty && (
        <>
          <div className="sc-banner sc-banner--empty" role="status">
            <strong>No results:</strong> No safer alternatives were found for
            this itinerary. This is a local synthetic placeholder result.
          </div>
          <div className="sc-panel-actions">
            <button className="sc-btn sc-btn--primary" disabled type="button" aria-label="Retry alternative search — disabled in synthetic demo">
              Retry alternative search
            </button>
          </div>
          <p className="sc-panel__demo-note">Retry is unavailable in this synthetic demo. No live provider is connected.</p>
        </>
      )}

      {isError && (
        <>
          <div className="sc-banner sc-banner--error" role="alert">
            <strong>Error{searchResult.errorCode ? ` (${searchResult.errorCode})` : ''}:</strong>{' '}
            {searchResult.errorMessage ?? 'The alternative search could not be completed.'}
          </div>
          <div className="sc-panel-actions">
            <button className="sc-btn sc-btn--primary" disabled type="button" aria-label="Retry alternative search — disabled in synthetic demo">
              Retry alternative search
            </button>
          </div>
          <p className="sc-panel__demo-note">Retry is unavailable in this synthetic demo. No live provider is connected.</p>
        </>
      )}

      {isTimeout && (
        <>
          <div className="sc-banner sc-banner--warning" role="status">
            <strong>Timeout{searchResult.errorCode ? ` (${searchResult.errorCode})` : ''}:</strong>{' '}
            {searchResult.errorMessage ?? 'The alternative search did not complete in time.'}
          </div>
          <div className="sc-panel-actions">
            <button className="sc-btn sc-btn--primary" disabled type="button" aria-label="Retry alternative search — disabled in synthetic demo">
              Retry alternative search
            </button>
          </div>
          <p className="sc-panel__demo-note">Retry is unavailable in this synthetic demo. No live provider is connected.</p>
        </>
      )}
    </section>
  );
}
