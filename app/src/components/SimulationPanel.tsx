import { useState, useCallback, useRef } from 'react';
import {
  advanceSimulation,
  getInitialState,
  isSimulationComplete,
  getStepLabels,
} from '../../../core/simulation/ticketing';
import type { SimulationState } from '../../../core/simulation/ticketing';
import type { SimulatedTicketingStep } from '../../../core/contracts/envelopes';

interface Props {
  enabled: boolean;
}

interface CompletedStep extends SimulatedTicketingStep {
  label: string;
  durationMs?: number;
}

export function SimulationPanel({ enabled }: Props) {
  const [state, setState] = useState<SimulationState>(getInitialState());
  const [completedSteps, setCompletedSteps] = useState<CompletedStep[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const stepStartRef = useRef<number>(Date.now());

  const stepLabels = getStepLabels();
  const complete = isSimulationComplete(state);

  const handleAdvance = useCallback(() => {
    if (isTransitioning || complete) return;

    setIsTransitioning(true);
    stepStartRef.current = Date.now();

    const result = advanceSimulation(state);
    if (!result) {
      setState('simulation-complete');
      setIsTransitioning(false);
      return;
    }

    /* Simulate the delay for this step */
    setTimeout(() => {
      const durationMs = Date.now() - stepStartRef.current;
      const stepLabel = stepLabels.find((s) => s.step === result.step.step)?.label ?? result.step.step;

      setCompletedSteps((prev) => [
        ...prev,
        { ...result.step, label: stepLabel, durationMs },
      ]);
      setState(result.newState);
      setIsTransitioning(false);

      /* If this was the last step, advance to complete */
      if (isSimulationComplete(result.newState)) {
        /* Already complete */
      }
    }, result.delayMs);
  }, [state, isTransitioning, complete, stepLabels]);

  if (!enabled) return null;

  return (
    <section className="sc-simulation" aria-label="Simulated order lifecycle">
      <h2>Simulated Order Lifecycle</h2>
      <div className="sc-simulation-disclaimer">
        <strong>SIMULATION ONLY — no real booking created</strong>
      </div>

      <div className="sc-simulation-steps">
        {stepLabels.map((sl, index) => {
          const completed = completedSteps.find((s) => s.step === sl.step);
          const isCurrent = !completed && index === completedSteps.length && !complete;

          return (
            <div
              key={sl.step}
              className={`sc-simulation-step ${completed ? 'sc-simulation-step--done' : ''} ${isCurrent ? 'sc-simulation-step--current' : ''}`}
            >
              <span className="sc-simulation-step-indicator">
                {completed ? '✓' : isTransitioning && isCurrent ? '...' : '○'}
              </span>
              <span className="sc-simulation-step-label">{sl.label}</span>
              {completed && completed.durationMs !== undefined && (
                <span className="sc-simulation-step-time">
                  [{(completed.durationMs / 1000).toFixed(1)}s]
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!complete && (
        <button
          className="sc-btn sc-btn--secondary"
          onClick={handleAdvance}
          disabled={isTransitioning}
          type="button"
        >
          {isTransitioning ? 'Processing...' : completedSteps.length === 0 ? 'Start simulation' : 'Advance step'}
        </button>
      )}

      {complete && (
        <div className="sc-simulation-final">
          <p>
            <strong>Disclaimer:</strong> This simulation demonstrates the order
            lifecycle shape. No real order, payment, passenger PII, or ticket
            was created.
          </p>
          <dl className="sc-meta-list">
            <dt>simulationOnly:</dt><dd>true</dd>
            <dt>steps completed:</dt><dd>{completedSteps.length}</dd>
            <dt>externalCallsMade:</dt><dd>false</dd>
          </dl>
        </div>
      )}
    </section>
  );
}
