/* ── Recovery Plan Animation — prop interface ──
 *
 * This is the data contract between the live Atlas Sandbox result
 * (produced by workers/daytona-atlas-worker/ via the Daytona orchestrator)
 * and the RecoveryPlanAnimation component.
 *
 * The component MUST be usable with BOTH real sandbox data and fixture
 * data. The provenanceLabel prop determines which label is displayed;
 * the component never assumes "real" or "fixture" on its own. */

/** A single recovery-flight option derived from the Atlas Search result. */
export interface RecoveryOption {
  /** Offer reference from Atlas. Null if not available from response. */
  offerReference: string | null;
  /** Route summary, e.g. "SIN -> BKK". Null if not available. */
  routeSummary: string | null;
  /** ISO-8601 departure time. Null if not available from Sandbox response. */
  departureTime: string | null;
  /** ISO-8601 arrival time. Null if not available from Sandbox response. */
  arrivalTime: string | null;
  /** Flight duration string. Null if not available from Sandbox response. */
  duration: string | null;
  /** Connection type (nonstop/1-stop/etc). Null if not available. */
  connectionType: string | null;
  /** Price display string, e.g. "$312". Null if not available. */
  priceDisplay: string | null;
  /** Currency code, e.g. "USD". Null if not available. */
  currency: string | null;
  /** Availability label from Atlas. Null if not available. */
  availabilityLabel: string | null;
}

/** Trade-offs for the recommended recovery plan. */
export interface RecoveryTradeoffs {
  /** Arrival impact in minutes vs original. Null — not available from current Sandbox response. */
  arrivalImpactMinutes: number | null;
  /** Connection buffer in minutes. Null — not available from current Sandbox response. */
  connectionBufferMinutes: number | null;
  /** Fare delta vs original itinerary. Null — not available from current Sandbox response. */
  fareDelta: number | null;
  /** Currency for fareDelta. Null if fareDelta is null. */
  fareDeltaCurrency: string | null;
}

/** The single recommended recovery plan after collapse. */
export interface RecoveryPlan {
  replacementFirstLeg: RecoveryOption | null;
  onwardOption: RecoveryOption | null;
  tradeoffs: RecoveryTradeoffs;
}

/** The full data prop for the RecoveryPlanAnimation component. */
export interface RecoveryPlanAnimationData {
  /* --- Trigger state --- */
  /** The original itinerary's first leg that is delayed. */
  originalFirstLeg: {
    routeSummary: string;
    scheduledDeparture: string | null;
    scheduledArrival: string | null;
  };
  /** Whether the delay is from a real signal or simulated. */
  delayTrigger: {
    isRealDelaySignal: boolean;
    label: string;
    /** If isRealDelaySignal is false, must be exactly:
     *  "Simulated delay trigger — downstream impact is analysis only" */
  };

  /* --- Cascade visualization --- */
  /** Downstream items that transition to red/at-risk, in stagger order. */
  downstreamItems: Array<{
    id: string;
    label: string;
    /** Delay in ms before this item transitions to red. */
    cascadeDelayMs: number;
  }>;

  /* --- Candidate alternatives (from real Atlas Search) --- */
  /** All candidate recovery options from the Search result. */
  candidateAlternatives: RecoveryOption[];

  /* --- Recommended plan (after collapse) --- */
  /** The single recommended recovery plan. Null when no safe plan could
   *  be produced (terminal no-plan state). */
  recommendedPlan: RecoveryPlan | null;

  /* --- Re-plan attempt counter --- */
  rePlanAttemptCount: number;   // 0, 1, or 2
  maxRePlanAttempts: 2;
  /** When rePlanAttemptCount >= maxRePlanAttempts AND recommendedPlan is null:
   *  terminal state shows "No safe plan found — escalate to traveller/agent" */

  /* --- Freshness badge --- */
  /** ISO-8601 timestamp from the Atlas call envelope. */
  freshnessTimestamp: string;
  /** Provenance label string. For real data:
   *  "Atlas Sandbox Search/Verify — read-only, real Atlas Sandbox inventory, executed inside Daytona sandbox"
   *  For fixture data: "Demo alternatives — local demo fixture" (or whichever label the fixture carries).
   *  The component renders this verbatim; it never fabricates or overrides it. */
  provenanceLabel: string;
  /** Data source identifier. */
  dataSource: 'real-atlas-sandbox-inventory' | 'local-fixture' | 'local-fallback' | 'daytona-live-risk';

  /* --- Confirmation / outcome states --- */
  /** Current animation phase, drives which visual state is shown. */
  confirmationPhase:
    | 'idle'
    | 'review-recovery-plan'
    | 'confirm-switch-request'
    | 'request-submitted'
    | 'verified-outcome';
  /** The verified outcome string from Phase 5 Verify, if available.
   *  Null if no real verification response was received.
   *  When null, confirmationPhase shows "Request submitted — awaiting verified supplier outcome".
   *  When non-null, shows the real verified state. */
  verifiedOutcome: string | null;
}
