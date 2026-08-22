import { LABELS } from '../data/labels';
import type { ExtractionResult, FlightLeg } from '../data/types';

interface Props {
  extraction: ExtractionResult;
  onFieldChange: (leg: 'firstLeg' | 'secondLeg', field: keyof FlightLeg, value: string) => void;
  onConnectionDurationChange: (value: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmed: boolean;
  correctionNotes: string[];
}

function LegFields({
  label,
  leg,
  legKey,
  onChange,
  disabled,
}: {
  label: string;
  leg: FlightLeg;
  legKey: 'firstLeg' | 'secondLeg';
  onChange: (leg: 'firstLeg' | 'secondLeg', field: keyof FlightLeg, value: string) => void;
  disabled: boolean;
}) {
  const fields: { key: keyof FlightLeg; label: string }[] = [
    { key: 'origin', label: 'Origin' },
    { key: 'destination', label: 'Destination' },
    { key: 'departureDate', label: 'Departure Date' },
    { key: 'airline', label: 'Airline' },
    { key: 'flightNumber', label: 'Flight Number' },
    { key: 'departureTime', label: 'Departure Time' },
    { key: 'arrivalTime', label: 'Arrival Time' },
  ];

  return (
    <fieldset className="sc-fieldset">
      <legend>{label}</legend>
      {fields.map(({ key, label: fLabel }) => (
        <div className="sc-field" key={key}>
          <label htmlFor={`${legKey}-${key}`}>{fLabel}</label>
          <input
            id={`${legKey}-${key}`}
            type="text"
            value={leg[key]}
            onChange={(e) => onChange(legKey, key, e.target.value)}
            disabled={disabled}
            aria-label={`${label} ${fLabel}`}
          />
        </div>
      ))}
    </fieldset>
  );
}

export function ItineraryReview({
  extraction,
  onFieldChange,
  onConnectionDurationChange,
  onConfirm,
  onCancel,
  confirmed,
  correctionNotes,
}: Props) {

  const requiredFields = [
    extraction.firstLeg.origin,
    extraction.firstLeg.destination,
    extraction.firstLeg.departureDate,
    extraction.firstLeg.airline,
    extraction.firstLeg.flightNumber,
    extraction.firstLeg.departureTime,
    extraction.firstLeg.arrivalTime,
    extraction.secondLeg.origin,
    extraction.secondLeg.destination,
    extraction.secondLeg.departureDate,
    extraction.secondLeg.airline,
    extraction.secondLeg.flightNumber,
    extraction.secondLeg.departureTime,
    extraction.secondLeg.arrivalTime,
  ];

  const allPopulated = requiredFields.every((f) => f.trim() !== '');
  const canConfirm = allPopulated && !confirmed;

  if (confirmed) {
    return (
      <section className="sc-itinerary-review sc-itinerary-review--confirmed" aria-label="Confirmed itinerary">
        <h2>✓ Itinerary Confirmed</h2>
        <p className="sc-source-label">{LABELS.geminiExtraction}</p>
        <p>
          The itinerary has been confirmed. Risk and alternatives panels are now
          available. <strong>No external service call was made.</strong> All
          downstream data is local synthetic placeholder content.
        </p>
        <div className="sc-summary-grid">
          <div className="sc-summary-item">
            <span className="sc-summary-label">Leg 1:</span>
            <span>{extraction.firstLeg.origin} → {extraction.firstLeg.destination}, {extraction.firstLeg.flightNumber}, {extraction.firstLeg.departureTime}–{extraction.firstLeg.arrivalTime}</span>
          </div>
          <div className="sc-summary-item">
            <span className="sc-summary-label">Leg 2:</span>
            <span>{extraction.secondLeg.origin} → {extraction.secondLeg.destination}, {extraction.secondLeg.flightNumber}, {extraction.secondLeg.departureTime}–{extraction.secondLeg.arrivalTime}</span>
          </div>
          <div className="sc-summary-item">
            <span className="sc-summary-label">Connection:</span>
            <span>{extraction.connectionDurationMinutes} minutes</span>
          </div>
        </div>
        {correctionNotes.length > 0 && (
          <div className="sc-corrections">
            <h3>Corrections recorded</h3>
            <ul>
              {correctionNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="sc-itinerary-review" aria-label="Review extracted itinerary">
      <h2>Review Extracted Itinerary</h2>
      <p className="sc-source-label">{LABELS.geminiExtraction}</p>
      <p>
        The following itinerary fields were extracted from your synthetic
        screenshots. All fields are editable. Please review and correct any
        errors before confirming.
      </p>

      <div className="sc-legs-grid">
        <LegFields
          label="First Leg"
          leg={extraction.firstLeg}
          legKey="firstLeg"
          onChange={onFieldChange}
          disabled={false}
        />
        <LegFields
          label="Second Leg"
          leg={extraction.secondLeg}
          legKey="secondLeg"
          onChange={onFieldChange}
          disabled={false}
        />
      </div>

      <div className="sc-field">
        <label htmlFor="connection-duration">Connection Duration (minutes)</label>
        <input
          id="connection-duration"
          type="number"
          value={extraction.connectionDurationMinutes}
          onChange={(e) => onConnectionDurationChange(parseInt(e.target.value, 10) || 0)}
          min={0}
          aria-label="Connection duration in minutes"
        />
      </div>

      {correctionNotes.length > 0 && (
        <div className="sc-corrections">
          <h3>Corrections recorded</h3>
          <ul>
            {correctionNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {!allPopulated && (
        <div className="sc-banner sc-banner--warning" role="status">
          <strong>Missing fields:</strong> All required fields must be populated
          before confirming.
        </div>
      )}

      <div className="sc-review-actions">
        <button
          className="sc-btn sc-btn--primary"
          onClick={onConfirm}
          disabled={!canConfirm}
          type="button"
          aria-label={canConfirm ? 'Confirm itinerary' : 'Confirm itinerary — disabled until all fields are populated'}
        >
          Confirm itinerary
        </button>
        <button
          className="sc-btn sc-btn--secondary"
          onClick={onCancel}
          type="button"
        >
          Cancel and re-upload
        </button>
      </div>
    </section>
  );
}
