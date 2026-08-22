import { getGeminiLabel } from '../data/labels';
import { getDefaultExtraction } from '../data/fixtures';

interface Props {
  onAcknowledge: () => void;
}

export function SafetyNotice({ onAcknowledge }: Props) {
  return (
    <section className="sc-safety-notice">
      <div className="sc-safety-notice__icon" aria-hidden="true">⚠</div>
      <h1>StitchCheck — Fictional Demo</h1>
      <div className="sc-safety-notice__body">
        <p>
          This is a <strong>fictional demo application</strong>. All data displayed is
          fictional and local. No real personal data, booking references, payment
          information, or live service evidence is used.
        </p>
        <ul>
          <li>Do not upload real documents.</li>
          <li>All screenshots must be fictional and unbooked.</li>
          <li>No external service call will be made at any point.</li>
          <li>No booking, payment, reservation, or order will be created.</li>
        </ul>
        <p>
          The browser walkthrough uses fictional local fixtures and makes no provider calls.
          Direct Gemini 3.7 was live-verified separately. Atlas Sandbox Search/Verify was verified separately.
          Nosana uses a local fallback in this walkthrough.
        </p>
      </div>
      <button
        className="sc-btn sc-btn--primary"
        onClick={onAcknowledge}
        type="button"
      >
        I understand — continue with fictional data
      </button>
      <p className="sc-safety-notice__footer">
        {getGeminiLabel(getDefaultExtraction())}
      </p>
    </section>
  );
}
