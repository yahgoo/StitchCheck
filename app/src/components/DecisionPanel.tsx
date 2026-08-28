import { FINAL_STATEMENT } from '../data/labels';
import type { Decision as DecisionType } from '../data/types';

interface Props {
  decision: DecisionType;
  onDecision: (d: DecisionType) => void;
  onConfirmDecision: () => void;
  onRestart: () => void;
  decisionConfirmed: boolean;
}

export function DecisionPanel({
  decision,
  onDecision,
  onConfirmDecision,
  onRestart,
  decisionConfirmed,
}: Props) {
  if (decisionConfirmed) {
    return (
      <section className="sc-decision sc-decision--final" aria-label="Demo complete">
        <h2>Demo Complete — No Action Created</h2>
        <div className="sc-final-statement">
          <p>{FINAL_STATEMENT}</p>
          <dl className="sc-meta-list">
            <dt>noOrderCreated:</dt><dd>true</dd>
            <dt>demoMode:</dt><dd>true</dd>
            <dt>externalCallsMade:</dt><dd>false</dd>
            <dt>decision:</dt><dd>{decision ?? 'none'}</dd>
          </dl>
        </div>
        <button className="sc-btn sc-btn--primary" onClick={onRestart} type="button">
          Restart demo
        </button>
      </section>
    );
  }

  return (
    <section className="sc-decision" aria-label="Your decision">
      <h2>Your Decision</h2>
      <p>
        Choose whether to <strong>Keep</strong> your current self-transfer plan
        or <strong>Switch</strong> to a safer alternative. This is a{' '}
        <strong>local demo decision only</strong>. No booking, payment,
        reservation, ticket, order, verification, or any other external action
        will be created.
      </p>

      <div className="sc-decision-buttons">
        <button
          className={`sc-btn ${decision === 'keep' ? 'sc-btn--primary' : 'sc-btn--secondary'}`}
          onClick={() => onDecision('keep')}
          type="button"
          aria-pressed={decision === 'keep'}
        >
          Keep current plan
        </button>
        <button
          className={`sc-btn ${decision === 'switch' ? 'sc-btn--primary' : 'sc-btn--secondary'}`}
          onClick={() => onDecision('switch')}
          type="button"
          aria-pressed={decision === 'switch'}
        >
          Switch to alternative
        </button>
      </div>

      {decision && (
        <div className="sc-decision-summary">
          <h3>
            Your Decision: {decision === 'keep' ? 'Keep' : 'Switch'}
          </h3>
          <p>
            You have chosen to{' '}
            {decision === 'keep'
              ? 'keep your current self-transfer plan'
              : 'switch to a safer alternative'}
            . This is a local demo decision only. No booking, payment,
            reservation, ticket, order, verification, or any other external
            action has been created or will be created.
          </p>
          <button className="sc-btn sc-btn--primary" onClick={onConfirmDecision} type="button">
            Confirm decision
          </button>
          <button
            className="sc-btn sc-btn--secondary"
            onClick={() => onDecision(decision === 'keep' ? 'switch' : 'keep')}
            type="button"
          >
            Change to {decision === 'keep' ? 'Switch' : 'Keep'}
          </button>
        </div>
      )}
    </section>
  );
}
