import { useState } from 'react';
import { LABELS } from '../data/labels';
import { screenshotFixtures } from '../data/fixtures';
import type { ScreenshotFixture } from '../data/fixtures';

interface Props {
  selections: [string | null, string | null];
  onSelect: (slot: number, fixtureId: string) => void;
  onContinue: () => void;
  onRestart: () => void;
}

export function UploadPanel({ selections, onSelect, onContinue, onRestart }: Props) {
  const [error, setError] = useState<string | null>(null);
  const bothSelected = selections[0] !== null && selections[1] !== null;

  function handleSelect(slot: number, fixtureId: string) {
    setError(null);
    onSelect(slot, fixtureId);
  }

  function handleContinue() {
    if (!bothSelected) {
      setError('Please select exactly two synthetic screenshots before continuing.');
      return;
    }
    onContinue();
  }

  function renderSlot(slot: number) {
    const selectedId = selections[slot];
    const selected: ScreenshotFixture | undefined = screenshotFixtures.find(
      (f) => f.id === selectedId,
    );

    return (
      <div className="sc-upload-slot">
        <label htmlFor={`screenshot-${slot}`}>
          Screenshot {slot + 1}
        </label>
        <select
          id={`screenshot-${slot}`}
          value={selectedId ?? ''}
          onChange={(e) => handleSelect(slot, e.target.value)}
          aria-label={`Select synthetic screenshot for slot ${slot + 1}`}
        >
          <option value="">— Select a synthetic fixture —</option>
          {screenshotFixtures.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        {selected && (
          <div className="sc-upload-preview">
            <img
              src={selected.src}
              alt={`Synthetic fixture: ${selected.label}`}
              className="sc-upload-preview__img"
            />
            <span className="sc-upload-preview__caption">
              {selected.label}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="sc-upload-panel" aria-label="Upload synthetic screenshots">
      <h2>Upload Synthetic Screenshots</h2>
      <p className="sc-upload-panel__body">
        Select exactly two synthetic, unbooked flight-ticket or checkout
        screenshots. These must be fictional images only — no real bookings, no
        real passenger data.
      </p>
      <p className="sc-source-label">{LABELS.geminiExtraction}</p>

      <div className="sc-upload-slots">
        {renderSlot(0)}
        {renderSlot(1)}
      </div>

      {error && (
        <div className="sc-banner sc-banner--error" role="alert">
          <strong>Validation Error:</strong> {error}
        </div>
      )}

      <div className="sc-upload-actions">
        <button
          className="sc-btn sc-btn--primary"
          onClick={handleContinue}
          disabled={!bothSelected}
          type="button"
        >
          Continue to review
        </button>
        <button
          className="sc-btn sc-btn--secondary"
          onClick={onRestart}
          type="button"
        >
          Restart demo
        </button>
      </div>
    </section>
  );
}
