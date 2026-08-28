import { DataSourceTag } from './DataSourceTag';

interface Props {
  onAcknowledge: () => void;
}

export function SafetyNotice({ onAcknowledge }: Props) {
  return (
    <section className="sc-safety-notice">
      <div className="sc-safety-notice__icon" aria-hidden="true">⚠</div>
      <h1>StitchCheck — Safety Notice</h1>
      <div className="sc-safety-notice__body">
        <p>
          <strong>Sample documents only.</strong> No booking, payment, reservation,
          or order is created. Search is read-only.
        </p>
        <ul>
          <li>Do not upload real documents.</li>
          <li>All screenshots must be sample images, not real bookings.</li>
          <li>No booking, payment, reservation, or order will be created.</li>
        </ul>
        <p>
          Atlas Sandbox Search/Verify was verified separately.
          Nosana uses a local fallback in this walkthrough.
        </p>
      </div>
      <button
        className="sc-btn sc-btn--primary"
        onClick={onAcknowledge}
        type="button"
      >
        I understand — continue
      </button>
      <p className="sc-safety-notice__footer">
        <DataSourceTag source="local-fixture" />
      </p>
    </section>
  );
}
