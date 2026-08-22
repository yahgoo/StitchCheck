import { LABELS } from '../data/labels';

interface Props {
  onAcknowledge: () => void;
}

export function SafetyNotice({ onAcknowledge }: Props) {
  return (
    <section className="sc-safety-notice">
      <div className="sc-safety-notice__icon" aria-hidden="true">⚠</div>
      <h1>StitchCheck — Synthetic Demo</h1>
      <div className="sc-safety-notice__body">
        <p>
          This is a <strong>synthetic demo application</strong>. All data displayed is
          fictional and local. No real personal data, booking references, payment
          information, or live service evidence is used.
        </p>
        <ul>
          <li>Do not upload real documents.</li>
          <li>All screenshots must be synthetic and unbooked.</li>
          <li>No external service call will be made at any point.</li>
          <li>No booking, payment, reservation, or order will be created.</li>
        </ul>
        <p>
          Extraction evidence is a synthetic local placeholder and is
          not direct Gemini evidence. Nosana and Atlas remain unexecuted; all
          risk and alternatives content is a local synthetic placeholder.
        </p>
      </div>
      <button
        className="sc-btn sc-btn--primary"
        onClick={onAcknowledge}
        type="button"
      >
        I understand — continue with synthetic data
      </button>
      <p className="sc-safety-notice__footer">
        {LABELS.geminiExtraction}
      </p>
    </section>
  );
}
