import { useEffect, useState } from 'react';
import type { RecoveryOption, RecoveryPlan, RecoveryPlanAnimationData } from '../types/recovery-plan';
import type { ExecutionMode } from '../../../core/domain/execution-mode';
import { formatMissingField } from '../../../core/copy/missing-field-labels';
import { DataSourceTag } from './DataSourceTag';
import './RecoveryPlanAnimation.css';

/* ═══════════════════════════════════════════════════════
   RecoveryPlanAnimation
   ───────────────────────────────────────────────────────
   Visualizes the recovery-plan dependency graph:
   trigger → cascade → candidate alternatives → collapse
   into one plan → freshness badge → confirmation states.

   Hard rules honored:
   • Fields that are null render traveller-friendly missing labels — never fabricated.
   • provenanceLabel is rendered verbatim; the component
     never assumes "real" or "fixture" on its own.
   • "Booked"/"Switched" are never claimed unless
     verifiedOutcome carries a real verified result.
   • The animation plays once and never loops.
   ═══════════════════════════════════════════════════════ */

const CRITICAL_MISSING = formatMissingField('critical');
const NON_CRITICAL_MISSING = formatMissingField('nonCritical');
const SIMULATED_TRIGGER_LABEL =
  'Simulated delay trigger — downstream impact is analysis only';

type AnimationPhase =
  | 'trigger'
  | 'cascade'
  | 'candidates'
  | 'collapse'
  | 'freshness'
  | 'done';

/* Completion marker values exposed via data-rpa-phase. The internal
 * timeline always ends at 'done'; the terminal no-plan state is
 * surfaced as 'no-safe-plan'. 'error' is reserved for future use. */
type ExposedPhase = AnimationPhase | 'no-safe-plan' | 'error';

interface Props {
  data: RecoveryPlanAnimationData;
  /** Optional execution mode — drives the mode badge display.
   *  When absent, no mode badge is rendered. */
  executionMode?: ExecutionMode;
}

/** Render a non-critical value, or a low-alarm placeholder when null. */
function valueOrNotAvailable(value: string | number | null): string {
  return value === null ? NON_CRITICAL_MISSING : String(value);
}

/** Format an ISO timestamp into a readable UTC string, e.g. "23 Aug 2026, 09:00 UTC".
 *  Returns the original string unchanged when it cannot be parsed. */
function formatUtcTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const day = d.getUTCDate();
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
}

/** Map an animation phase to a concise screen-reader announcement. */
function phaseAnnouncement(p: AnimationPhase): string {
  switch (p) {
    case 'trigger':   return 'Recovery plan: delay detected';
    case 'cascade':   return 'Recovery plan: analyzing downstream impact';
    case 'candidates': return 'Recovery plan: evaluating alternatives';
    case 'collapse':  return 'Recovery plan: computing recommended plan';
    case 'freshness': return 'Recovery plan: freshness verified';
    case 'done':      return 'Recovery plan ready';
  }
}

/** Renders one recovery-flight option card. */
function OptionCard({ option, variant }: { option: RecoveryOption; variant?: string }) {
  return (
    <div className={`rpa-option${variant ? ` rpa-option--${variant}` : ''}`}>
      <div className="rpa-option__route">
        {option.routeSummary ?? CRITICAL_MISSING}
      </div>
      <dl className="rpa-option__details">
        <div className="rpa-option__row">
          <dt>Departs</dt>
          <dd>{valueOrNotAvailable(option.departureTime)}</dd>
        </div>
        <div className="rpa-option__row">
          <dt>Arrives</dt>
          <dd>{valueOrNotAvailable(option.arrivalTime)}</dd>
        </div>
        <div className="rpa-option__row">
          <dt>Duration</dt>
          <dd>{valueOrNotAvailable(option.duration)}</dd>
        </div>
      </dl>
      <div className="rpa-option__meta">
        {option.connectionType !== null && (
          <span className="rpa-option__tag">{option.connectionType}</span>
        )}
        {option.availabilityLabel !== null && (
          <span className="rpa-option__tag">{option.availabilityLabel}</span>
        )}
        {option.priceDisplay !== null ? (
          <span className="rpa-option__price">
            {option.priceDisplay}
            {option.currency !== null ? ` ${option.currency}` : ''}
          </span>
        ) : (
          <span className="rpa-option__price rpa-option__price--na">
            {CRITICAL_MISSING}
          </span>
        )}
      </div>
    </div>
  );
}

/** Renders the recommended plan's trade-offs (null-safe). */
function TradeoffsList({
  plan,
  missingLabel,
}: {
  plan: RecoveryPlan;
  missingLabel?: string;
}) {
  const { tradeoffs } = plan;
  const minutesMissing = missingLabel ?? NON_CRITICAL_MISSING;
  const fareMissing = missingLabel ?? CRITICAL_MISSING;
  const fareDeltaDisplay =
    tradeoffs.fareDelta === null
      ? fareMissing
      : `${tradeoffs.fareDelta >= 0 ? '+' : ''}${tradeoffs.fareDelta}${
          tradeoffs.fareDeltaCurrency !== null ? ` ${tradeoffs.fareDeltaCurrency}` : ''
        }`;
  return (
    <dl className="rpa-tradeoffs">
      <div className="rpa-tradeoffs__row">
        <dt>Arrival impact</dt>
        <dd>
          {tradeoffs.arrivalImpactMinutes === null
            ? minutesMissing
            : `${tradeoffs.arrivalImpactMinutes} min vs original`}
        </dd>
      </div>
      <div className="rpa-tradeoffs__row">
        <dt>Connection buffer</dt>
        <dd>
          {tradeoffs.connectionBufferMinutes === null
            ? minutesMissing
            : `${tradeoffs.connectionBufferMinutes} min`}
        </dd>
      </div>
      <div className="rpa-tradeoffs__row">
        <dt>Fare delta</dt>
        <dd>{fareDeltaDisplay}</dd>
      </div>
    </dl>
  );
}

/** Renders a recommended plan (replacement leg + onward option + trade-offs). */
function PlanCard({ plan, missingLabel }: { plan: RecoveryPlan; missingLabel?: string }) {
  return (
    <div className="rpa-plan">
      <div className="rpa-plan__leg">
        <h3 className="rpa-plan__leg-title">Replacement first leg</h3>
        {plan.replacementFirstLeg !== null ? (
          <OptionCard option={plan.replacementFirstLeg} variant="compact" />
        ) : (
          <p className="rpa-not-available">{missingLabel ?? CRITICAL_MISSING}</p>
        )}
      </div>
      <div className="rpa-plan__leg">
        <h3 className="rpa-plan__leg-title">Onward option</h3>
        {plan.onwardOption !== null ? (
          <OptionCard option={plan.onwardOption} variant="compact" />
        ) : (
          <p className="rpa-not-available">{missingLabel ?? CRITICAL_MISSING}</p>
        )}
      </div>
      <div className="rpa-plan__tradeoffs">
        <h3 className="rpa-plan__leg-title">Trade-offs</h3>
        <TradeoffsList plan={plan} missingLabel={missingLabel} />
      </div>
    </div>
  );
}

function dataSourceToTag(
  source: RecoveryPlanAnimationData['dataSource'],
): 'local-fixture' | 'atlas-live' | 'offline-fallback' | 'daytona-live' {
  if (source === 'daytona-live-risk') return 'daytona-live';
  if (source === 'real-atlas-sandbox-inventory') return 'atlas-live';
  if (source === 'local-fixture') return 'local-fixture';
  return 'offline-fallback';
}

function missingLabelForSource(
  source: RecoveryPlanAnimationData['dataSource'],
): string | undefined {
  return source === 'daytona-live-risk' ? 'not available from Sandbox response' : undefined;
}

export function RecoveryPlanAnimation({ data, executionMode: _executionMode }: Props) {
  const [phase, setPhase] = useState<AnimationPhase>('trigger');
  const [itemsAtRisk, setItemsAtRisk] = useState<Set<string>>(new Set());

  /* Runtime view of recommendedPlan — the wire format carries null when
   * no safe plan could be produced, which drives the terminal state. */
  const recommendedPlan = data.recommendedPlan;

  const isTerminalNoPlan =
    recommendedPlan === null && data.rePlanAttemptCount >= data.maxRePlanAttempts;

  /* One-shot animation timeline. Plays exactly once; never loops. */
  useEffect(() => {
    setPhase('trigger');
    setItemsAtRisk(new Set());

    const timers: ReturnType<typeof setTimeout>[] = [];

    const cascadeTotalMs = data.downstreamItems.reduce(
      (max, item) => Math.max(max, item.cascadeDelayMs),
      0,
    );

    const at = (ms: number, fn: () => void) => {
      timers.push(setTimeout(fn, ms));
    };

    const triggerHoldMs = 1400;
    at(triggerHoldMs, () => setPhase('cascade'));

    /* Staggered cascade: each item flips to red/at-risk on its own timer,
     * exactly per its cascadeDelayMs — animated, not instant. */
    for (const item of data.downstreamItems) {
      at(triggerHoldMs + item.cascadeDelayMs, () => {
        setItemsAtRisk((prev) => {
          const next = new Set(prev);
          next.add(item.id);
          return next;
        });
      });
    }

    if (isTerminalNoPlan) {
      /* Terminal state: stop after the cascade completes. Do NOT loop. */
      at(triggerHoldMs + cascadeTotalMs + 900, () => setPhase('done'));
      return () => timers.forEach(clearTimeout);
    }

    const cascadeEndMs = triggerHoldMs + cascadeTotalMs + 900;
    at(cascadeEndMs, () => setPhase('candidates'));

    const candidatesHoldMs = 1900;
    at(cascadeEndMs + candidatesHoldMs, () => setPhase('collapse'));

    const collapseHoldMs = 1300;
    at(cascadeEndMs + candidatesHoldMs + collapseHoldMs, () => setPhase('freshness'));

    at(cascadeEndMs + candidatesHoldMs + collapseHoldMs + 1400, () => setPhase('done'));

    return () => timers.forEach(clearTimeout);
    /* The timeline depends only on the cascade items and the terminal
     * state — not on confirmation-phase updates — so the animation
     * plays exactly once even when downstream props change. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.downstreamItems, isTerminalNoPlan]);

  const phaseIndex: Record<AnimationPhase, number> = {
    trigger: 0,
    cascade: 1,
    candidates: 2,
    collapse: 3,
    freshness: 4,
    done: 5,
  };
  const reached = (p: AnimationPhase) => phaseIndex[phase] >= phaseIndex[p];

  /* Trigger label: if the signal is not real, the exact simulated wording
   * is mandatory regardless of what the data carries. */
  const triggerLabel = data.delayTrigger.isRealDelaySignal
    ? data.delayTrigger.label
    : SIMULATED_TRIGGER_LABEL;

  const showFreshness = reached('freshness');
  const showConfirmation = phase === 'done' && !isTerminalNoPlan;

  /* Completion marker: the terminal no-plan state is exposed as
   * 'no-safe-plan'; every other timeline phase is exposed verbatim. */
  const exposedPhase: ExposedPhase =
    isTerminalNoPlan && phase === 'done' ? 'no-safe-plan' : phase;

  return (
    <section
      className="rpa"
      aria-label="Recovery plan animation"
      data-rpa-phase={exposedPhase}
    >
      {/* ── Screen-reader live region for phase announcements ── */}
      <span className="rpa-sr-only" aria-live="polite" role="status">
        {phaseAnnouncement(phase)}
      </span>

      <h2 className="rpa__title">Recovery Plan</h2>
      <DataSourceTag source={dataSourceToTag(data.dataSource)} />
      <p className="rpa-provenance" data-testid="rpa-provenance">{data.provenanceLabel}</p>

      {/* ── Trigger state ── */}
      <div className="rpa-stage">
        <div className="rpa-trigger rpa-trigger--delayed">
          <span className="rpa-trigger__pulse" aria-hidden="true" />
          <span className="rpa-trigger__status" role="status">
            Delayed
          </span>
          <div className="rpa-trigger__body">
            <strong className="rpa-trigger__route">
              {data.originalFirstLeg.routeSummary}
            </strong>
            <span className="rpa-trigger__times">
              Dep {valueOrNotAvailable(data.originalFirstLeg.scheduledDeparture)} · Arr{' '}
              {valueOrNotAvailable(data.originalFirstLeg.scheduledArrival)}
            </span>
          </div>
          <p className="rpa-trigger__label">{triggerLabel}</p>
        </div>
      </div>

      {/* ── Cascade signal line ── */}
      <div className="rpa-signal-line" aria-hidden="true" />

      {/* ── Cascade state ── */}
      <ul className="rpa-cascade" aria-label="Downstream impact">
        {data.downstreamItems.map((item) => (
          <div key={`reveal-${item.id}`} className="rpa-cascade__item--reveal">
          <li
            className={`rpa-cascade__item${
              itemsAtRisk.has(item.id) ? ' rpa-cascade__item--at-risk' : ''
            }`}
          >
            <span className="rpa-cascade__dot" aria-hidden="true" />
            <span className="rpa-cascade__label">{item.label}</span>
            {itemsAtRisk.has(item.id) && (
              <span className="rpa-cascade__flag">at risk</span>
            )}
          </li>
          </div>
        ))}
      </ul>

      {/* ── Re-plan attempt counter ── */}
      {data.rePlanAttemptCount > 0 && !isTerminalNoPlan && (
        <p className="rpa-replan">
          Re-plan attempt {data.rePlanAttemptCount} of {data.maxRePlanAttempts}
        </p>
      )}

      {/* ── Collapse into one plan ── */}
      {!isTerminalNoPlan && (
        <div className="rpa-stage">
          {reached('candidates') && (
            <div
              className={`rpa-candidates${
                reached('collapse') ? ' rpa-candidates--collapsing' : ''
              }`}
              aria-label="Candidate alternatives"
            >
              {data.candidateAlternatives.length > 0 ? (
                data.candidateAlternatives.map((option, i) => (
                  <div
                    key={option.offerReference ?? `candidate-${i}`}
                    className={`rpa-candidates__card${i === 0 ? ' rpa-candidates__card--primary' : ''}`}
                    style={{ transitionDelay: `${i * 110}ms` }}
                  >
                    <OptionCard option={option} variant="compact" />
                  </div>
                ))
              ) : (
                <p className="rpa-not-available">{CRITICAL_MISSING}</p>
              )}
            </div>
          )}

          {reached('collapse') && recommendedPlan !== null && (
            <div className="rpa-recommended" aria-label="Recommended recovery plan">
              <h3 className="rpa-recommended__heading">
                Collapsed into one recommended plan
              </h3>
              <PlanCard plan={recommendedPlan} missingLabel={missingLabelForSource(data.dataSource)} />
            </div>
          )}
        </div>
      )}

      {/* ── Terminal no-plan state (never loops) ── */}
      {isTerminalNoPlan && reached('done') && (
        <div className="rpa-terminal" role="alert">
          No safe plan found — escalate to traveller/agent
        </div>
      )}

      {/* ── Freshness badge (always shown before confirmation screen) ──
       *  Provenance label and execution mode badge are kept in the data
       *  model but NOT rendered in the primary traveller-facing view.
       *  They remain available for the "How this was calculated" panel. */}
      {showFreshness && !isTerminalNoPlan && (
        <div className="rpa-freshness">
          <span className="rpa-freshness__pulse" aria-hidden="true" />
          <span className="rpa-freshness__headline">Recovery plan computed</span>
          <time className="rpa-freshness__timestamp" dateTime={data.freshnessTimestamp} title={data.freshnessTimestamp}>
            {formatUtcTimestamp(data.freshnessTimestamp)}
          </time>
        </div>
      )}

      {/* ── Confirmation / outcome states ── */}
      {showConfirmation && (
        <div className="rpa-confirmation">
          {data.confirmationPhase === 'idle' && (
            <p className="rpa-confirmation__note">
              Recovery plan ready — awaiting traveller review.
            </p>
          )}

          {data.confirmationPhase === 'review-recovery-plan' && recommendedPlan !== null && (
            <div className="rpa-confirmation__panel">
              <h3 className="rpa-confirmation__heading">Review recovery plan</h3>
              <PlanCard plan={recommendedPlan} missingLabel={missingLabelForSource(data.dataSource)} />
            </div>
          )}

          {data.confirmationPhase === 'confirm-switch-request' && (
            <div className="rpa-confirmation__panel">
              <h3 className="rpa-confirmation__heading">Confirm switch request</h3>
              <p className="rpa-confirmation__prompt">
                Request switching this itinerary to the recommended recovery plan? No
                booking change happens until a verified supplier outcome is received.
              </p>
              <div className="rpa-confirmation__actions">
                <button type="button" className="rpa-btn rpa-btn--primary">
                  Request switch
                </button>
                <button type="button" className="rpa-btn">
                  Keep original itinerary
                </button>
              </div>
            </div>
          )}

          {(data.confirmationPhase === 'request-submitted' ||
            data.confirmationPhase === 'verified-outcome') && (
            <div className="rpa-confirmation__panel">
              {data.confirmationPhase === 'verified-outcome' &&
              data.verifiedOutcome !== null ? (
                <>
                  <h3 className="rpa-confirmation__heading">Verified outcome</h3>
                  <p className="rpa-confirmation__outcome">{data.verifiedOutcome}</p>
                </>
              ) : (
                <>
                  <h3 className="rpa-confirmation__heading">Request submitted</h3>
                  <p className="rpa-confirmation__outcome rpa-confirmation__outcome--waiting">
                    Request submitted — awaiting verified supplier outcome
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Placeholder data for development ──
 * This fixture uses the same route as the confirmed itinerary
 * (AAA → BBB / BBB → CCC) for development consistency.
 * In production, data flows from riskResultToAnimationData with
 * the actual itinerary context — never from this placeholder. */
export const placeholderRecoveryPlanData: RecoveryPlanAnimationData = {
  originalFirstLeg: {
    routeSummary: 'AAA → BBB',
    scheduledDeparture: null,
    scheduledArrival: null,
  },
  delayTrigger: {
    isRealDelaySignal: false,
    label: 'Simulated delay trigger — downstream impact is analysis only',
  },
  downstreamItems: [
    { id: 'connection-window', label: 'Connection window at BBB', cascadeDelayMs: 0 },
    { id: 'onward-leg', label: 'Onward leg BBB → CCC', cascadeDelayMs: 550 },
    { id: 'hotel-checkin', label: 'Pre-booked hotel check-in', cascadeDelayMs: 1100 },
  ],
  candidateAlternatives: [
    {
      offerReference: 'fixture-offer-001',
      routeSummary: 'AAA → BBB',
      departureTime: null,
      arrivalTime: null,
      duration: null,
      connectionType: 'nonstop',
      priceDisplay: null,
      currency: null,
      availabilityLabel: null,
    },
    {
      offerReference: 'fixture-offer-002',
      routeSummary: 'AAA → BBB',
      departureTime: null,
      arrivalTime: null,
      duration: null,
      connectionType: '1-stop',
      priceDisplay: null,
      currency: null,
      availabilityLabel: null,
    },
  ],
  recommendedPlan: {
    replacementFirstLeg: {
      offerReference: 'fixture-offer-001',
      routeSummary: 'AAA → BBB',
      departureTime: null,
      arrivalTime: null,
      duration: null,
      connectionType: 'nonstop',
      priceDisplay: null,
      currency: null,
      availabilityLabel: null,
    },
    onwardOption: {
      offerReference: 'fixture-offer-010',
      routeSummary: 'BBB → CCC',
      departureTime: null,
      arrivalTime: null,
      duration: null,
      connectionType: 'nonstop',
      priceDisplay: null,
      currency: null,
      availabilityLabel: null,
    },
    tradeoffs: {
      arrivalImpactMinutes: null,
      connectionBufferMinutes: null,
      fareDelta: null,
      fareDeltaCurrency: null,
    },
  },
  rePlanAttemptCount: 1,
  maxRePlanAttempts: 2,
  freshnessTimestamp: '2026-08-23T09:00:00.000Z',
  provenanceLabel: 'Offline recovery plan — computed locally',
  dataSource: 'local-fixture',
  confirmationPhase: 'review-recovery-plan',
  verifiedOutcome: null,
};
