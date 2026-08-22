import { NOSANA_UI_LABELS, ATLAS_UI_LABELS } from '../data/labels';
import type { ComparisonData, RiskResult } from '../data/types';

interface Props {
  comparison: ComparisonData;
  riskResult: RiskResult | null;
}

export function ComparisonView({ comparison, riskResult }: Props) {
  const { originalItinerary, alternatives } = comparison;

  return (
    <section className="sc-comparison" aria-label="Compare itinerary with alternatives">
      <h2>Compare: Risky Self-Transfer vs Safer Alternatives</h2>
      <p className="sc-source-label">{ATLAS_UI_LABELS.offlineFixture}</p>
      <p>
        Below is a side-by-side comparison of your current self-transfer plan
        against available alternatives. All data is from offline fixtures. Risk
        data is a heuristic placeholder. Alternatives are offline fixtures.
        No booking or order is created by viewing this comparison.
      </p>

      <div className="sc-comparison-grid">
        <div className="sc-comparison-col sc-comparison-col--original">
          <h3>Your Current Plan</h3>
          <p className="sc-source-label sc-source-label--small">{NOSANA_UI_LABELS.localFallback}</p>
          <dl>
            <dt>Route:</dt><dd>{originalItinerary.routeSummary}</dd>
            <dt>Leg 1:</dt><dd>{originalItinerary.firstLeg}</dd>
            <dt>Leg 2:</dt><dd>{originalItinerary.secondLeg}</dd>
            <dt>Connection:</dt><dd>{originalItinerary.connectionDurationMinutes} min</dd>
            <dt>Risk Band:</dt>
            <dd>
              {riskResult
                ? `${riskResult.riskBand}${riskResult.riskScore !== null ? ` (${riskResult.riskScore})` : ''}`
                : originalItinerary.riskBand}
            </dd>
          </dl>
        </div>

        <div className="sc-comparison-col sc-comparison-col--alternatives">
          <h3>Safer Alternatives</h3>
          <p className="sc-source-label sc-source-label--small">{ATLAS_UI_LABELS.offlineFixture}</p>

          {alternatives.length === 0 ? (
            <p>No alternatives available for comparison.</p>
          ) : (
            <table className="sc-comparison-table">
              <thead>
                <tr>
                  <th scope="col">Route</th>
                  <th scope="col">Depart</th>
                  <th scope="col">Arrive</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Type</th>
                  <th scope="col">Price</th>
                </tr>
              </thead>
              <tbody>
                {alternatives.map((alt) => (
                  <tr key={alt.offerReference}>
                    <td>{alt.routeSummary}</td>
                    <td>{alt.departureTime}</td>
                    <td>{alt.arrivalTime}</td>
                    <td>{alt.duration}</td>
                    <td>{alt.connectionType}</td>
                    <td>{alt.priceDisplay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
