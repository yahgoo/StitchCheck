import { LABELS, DISABLED_MESSAGE, NOSANA_UI_LABELS } from '../data/labels';
import type { RiskResult, RiskScenario } from '../data/types';

interface Props {
  enabled: boolean;
  riskResult: RiskResult | null;
  scenario: RiskScenario;
  onScenarioChange: (s: RiskScenario) => void;
}

export function RiskPanel({ enabled, riskResult, scenario, onScenarioChange }: Props) {

  if (!enabled) {
    return (
      <section className="sc-panel sc-panel--disabled" aria-label="Connection risk" aria-disabled="true">
        <h2>Connection Risk</h2>
        <p className="sc-source-label">{LABELS.nosanaRisk}</p>
        <div className="sc-panel__locked">
          <span className="sc-panel__lock-icon" aria-hidden="true">🔒</span>
          <p>{DISABLED_MESSAGE}</p>
        </div>
      </section>
    );
  }

  if (!riskResult) {
    return (
      <section className="sc-panel" aria-label="Connection risk">
        <h2>Connection Risk</h2>
        <p className="sc-source-label">{LABELS.nosanaRisk}</p>
        <div className="sc-banner sc-banner--loading" role="status">Loading risk assessment…</div>
      </section>
    );
  }

  const isError = riskResult.workloadStatus === 'error';
  const isTimeout = riskResult.workloadStatus === 'timeout';
  const isUnavailable = riskResult.riskBand === 'unavailable';
  const isSuccess = !isError && !isTimeout && !isUnavailable;

  // Determine evidence source label
  const isNosanaEvidence = riskResult.evidenceSource === 'nosana-evidence';
  const isNosanaLive = isNosanaEvidence && !riskResult.fallbackUsed;
  const isLocalFallback = riskResult.evidenceSource === 'local-fallback' || riskResult.fallbackUsed;
  const sourceLabel = isNosanaLive
    ? NOSANA_UI_LABELS.liveEvidence
    : isNosanaEvidence
    ? NOSANA_UI_LABELS.offlineValidated
    : isLocalFallback
    ? NOSANA_UI_LABELS.localFallback
    : NOSANA_UI_LABELS.localFallback;
  const sourceLabelClass = isNosanaLive
    ? 'sc-source-label sc-source-label--live'
    : isNosanaEvidence
    ? 'sc-source-label sc-source-label--evidence'
    : isLocalFallback
    ? 'sc-source-label sc-source-label--fallback'
    : 'sc-source-label';

  return (
    <section className="sc-panel" aria-label="Connection risk">
      <h2>
        Connection Risk
        {isSuccess && ' — Heuristic Result'}
        {isUnavailable && ' — Unavailable'}
        {isError && ' — Error'}
        {isTimeout && ' — Timeout'}
      </h2>
      <p className={sourceLabelClass}>{sourceLabel}</p>

      <div className="sc-demo-control">
        <label htmlFor="risk-scenario">Demo scenario:</label>
        <select
          id="risk-scenario"
          value={scenario}
          onChange={(e) => onScenarioChange(e.target.value as RiskScenario)}
        >
          <option value="success">Success (medium risk)</option>
          <option value="unavailable">Unavailable</option>
          <option value="error">Error</option>
          <option value="timeout">Timeout</option>
          <option value="failure">Workload Failure</option>
        </select>
      </div>

      {isSuccess && (
        <>
          <div className="sc-risk-band sc-risk-band--medium">
            <span className="sc-risk-band__label">Risk Band:</span>
            <span className="sc-risk-band__value">{riskResult.riskBand}</span>
          </div>
          {riskResult.riskScore !== null && (
            <p className="sc-risk-score">Score: {riskResult.riskScore}</p>
          )}
          {riskResult.simulationCount !== undefined && (
            <p className="sc-risk-score">Simulations: {riskResult.simulationCount}</p>
          )}
          {riskResult.assumptions && riskResult.assumptions.length > 0 && (
            <div className="sc-assumptions">
              <strong>Assumptions:</strong>
              <ul>
                {riskResult.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="sc-disclaimer">{riskResult.heuristicDisclaimer}</div>
          <p className="sc-explanation">{riskResult.failureCascadeExplanation}</p>
        </>
      )}

      {isUnavailable && (
        <>
          <div className="sc-banner sc-banner--warning" role="status">
            <strong>Unavailable:</strong> No risk band could be produced for this
            itinerary. No score has been invented.
          </div>
          {isLocalFallback && (
            <div className="sc-banner sc-banner--warning" role="status">
              {NOSANA_UI_LABELS.offlineValidated}
            </div>
          )}
          <div className="sc-disclaimer">{riskResult.heuristicDisclaimer}</div>
          <p className="sc-explanation">{riskResult.failureCascadeExplanation}</p>
          <div className="sc-panel-actions">
            <button className="sc-btn sc-btn--primary" disabled type="button" aria-label="Re-run risk assessment — disabled in demo mode">
              Re-run risk assessment
            </button>
            <button className="sc-btn sc-btn--secondary" disabled type="button" aria-label="Proceed without risk guidance — disabled in demo mode">
              Proceed without risk guidance
            </button>
          </div>
          <p className="sc-panel__demo-note">Retry is unavailable in this demo mode. No live provider is connected.</p>
        </>
      )}

      {isError && (
        <>
          {isLocalFallback && (
            <div className="sc-banner sc-banner--warning" role="status">
              {NOSANA_UI_LABELS.offlineValidated}
            </div>
          )}
          <div className="sc-banner sc-banner--error" role="alert">
            <strong>Error{riskResult.errorCode ? ` (${riskResult.errorCode})` : ''}:</strong>{' '}
            {riskResult.errorMessage ?? 'The risk assessment could not be completed.'}
          </div>
          <div className="sc-disclaimer">{riskResult.heuristicDisclaimer}</div>
          <p className="sc-explanation">{riskResult.failureCascadeExplanation}</p>
          <div className="sc-panel-actions">
            <button className="sc-btn sc-btn--primary" disabled type="button" aria-label="Retry risk assessment — disabled in demo mode">
              Retry risk assessment
            </button>
          </div>
          <p className="sc-panel__demo-note">Retry is unavailable in this demo mode. No live provider is connected.</p>
        </>
      )}

      {isTimeout && (
        <>
          {isLocalFallback && (
            <div className="sc-banner sc-banner--warning" role="status">
              {NOSANA_UI_LABELS.offlineValidated}
            </div>
          )}
          <div className="sc-banner sc-banner--warning" role="status">
            <strong>Timeout{riskResult.errorCode ? ` (${riskResult.errorCode})` : ''}:</strong>{' '}
            {riskResult.errorMessage ?? 'The risk assessment did not complete in time.'}
          </div>
          <div className="sc-disclaimer">{riskResult.heuristicDisclaimer}</div>
          <p className="sc-explanation">{riskResult.failureCascadeExplanation}</p>
          <div className="sc-panel-actions">
            <button className="sc-btn sc-btn--primary" disabled type="button" aria-label="Retry risk assessment — disabled in demo mode">
              Retry risk assessment
            </button>
          </div>
          <p className="sc-panel__demo-note">Retry is unavailable in this demo mode. No live provider is connected.</p>
        </>
      )}

      <p className="sc-panel__footer-note">
        Dataset: {riskResult.datasetVersion} · Fallback used: {riskResult.fallbackUsed ? 'yes' : 'no'}
        {riskResult.latencyMs !== undefined && ` · Latency: ${riskResult.latencyMs}ms`}
      </p>
    </section>
  );
}
