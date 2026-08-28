/* ── Atlas Sandbox write rehearsal state machine ──
 *
 * Pure, dependency-free model of the Sandbox order/pay rehearsal flow
 * (Atlas Sandbox write routing spec, Section 5). This module performs
 * NO network or CLI calls; it only describes which state transitions
 * are allowed for the UI branch.
 *
 * Safety invariants (enforced by the transition table and offline tests):
 *   - No write state is reachable from `hidden` without an explicit
 *     `opt-in` event.
 *   - Order and Pay each require their own separate confirmation event
 *     (`submit-order` and `submit-pay`).
 *   - Unknown Order/Pay outcomes never auto-retry: from `unknown-create`
 *     and `unknown-pay` only `status-check`, `reset`, and `hide` exist;
 *     no retry event transitions them forward.
 *   - A new write attempt requires a new confirmation event carrying a
 *     fresh confirmationToken AND a fresh idempotencyKey; reuse of a
 *     previously consumed idempotency key is rejected.
 *   - `ticketed` exists ONLY as `ticketed-simulated`.
 *   - Unknown or numeric provider codes map to an `unknown` outcome,
 *     never to a success state. */

/* ── States ── */

export type SandboxOrderState =
  | 'hidden'
  | 'opt-in'
  | 'order-review'
  | 'order-submitting'
  | 'order-created-unpaid'
  | 'payment-review'
  | 'payment-submitting'
  | 'pay-accepted'
  | 'status-polling'
  | 'ticketed-simulated'
  | 'cancelled'
  | 'gate-rejected'
  | 'cli-error'
  | 'unknown-create'
  | 'unknown-pay'
  | 'safely-stopped';

export const SANDBOX_ORDER_STATES: readonly SandboxOrderState[] = [
  'hidden',
  'opt-in',
  'order-review',
  'order-submitting',
  'order-created-unpaid',
  'payment-review',
  'payment-submitting',
  'pay-accepted',
  'status-polling',
  'ticketed-simulated',
  'cancelled',
  'gate-rejected',
  'cli-error',
  'unknown-create',
  'unknown-pay',
  'safely-stopped',
];

export const SANDBOX_TERMINAL_STATES: readonly SandboxOrderState[] = [
  'ticketed-simulated',
  'cancelled',
  'safely-stopped',
];

export const SANDBOX_UNKNOWN_OUTCOME_STATES: readonly SandboxOrderState[] = [
  'unknown-create',
  'unknown-pay',
];

/* ── Events ── */

export type SandboxWriteOperation = 'order' | 'pay';

/** Every new write attempt must carry a fresh human confirmation. */
export interface WriteConfirmation {
  confirmationToken: string;
  idempotencyKey: string;
}

export type SandboxOrderEvent =
  | { type: 'opt-in' }
  | { type: 'hide' }
  | { type: 'review-payment' }
  | ({ type: 'submit-order' } & WriteConfirmation)
  | ({ type: 'submit-pay' } & WriteConfirmation)
  | { type: 'order-accepted'; orderNo: string }
  | { type: 'order-gate-rejected' }
  | { type: 'order-cli-error' }
  | { type: 'order-outcome-unknown' }
  | { type: 'pay-accepted' }
  | { type: 'pay-gate-rejected' }
  | { type: 'pay-cli-error' }
  | { type: 'pay-outcome-unknown' }
  | { type: 'start-polling' }
  | { type: 'status-ticketed-simulated' }
  | { type: 'status-cancelled' }
  | { type: 'poll-budget-exhausted' }
  | { type: 'status-check' }
  | { type: 'status-unknown' }
  | { type: 'reset' };

/** Optional pure context used to verify confirmation freshness. */
export interface TransitionContext {
  /** Idempotency keys already consumed by previous attempts. An event
   *  carrying one of these keys is stale and must be rejected. */
  usedIdempotencyKeys?: ReadonlySet<string> | readonly string[];
}

/* ── Transition table ──
 *
 * The single authoritative source of allowed transitions. Anything not
 * listed here for a state is forbidden. Note in particular:
 *   - `hidden` accepts ONLY `opt-in`.
 *   - `unknown-create` / `unknown-pay` accept NO retry/submit events.
 *   - Terminal states accept no events at all. */

const TRANSITION_TABLE: Record<
  SandboxOrderState,
  Partial<Record<SandboxOrderEvent['type'], SandboxOrderState>>
> = {
  'hidden': {
    'opt-in': 'opt-in',
  },
  'opt-in': {
    'hide': 'hidden',
    'reset': 'order-review',
  },
  'order-review': {
    'hide': 'hidden',
    'submit-order': 'order-submitting',
    'reset': 'order-review',
  },
  'order-submitting': {
    'order-accepted': 'order-created-unpaid',
    'order-gate-rejected': 'gate-rejected',
    'order-cli-error': 'cli-error',
    'order-outcome-unknown': 'unknown-create',
  },
  'order-created-unpaid': {
    'hide': 'hidden',
    'review-payment': 'payment-review',
    'reset': 'order-review',
  },
  'payment-review': {
    'hide': 'hidden',
    'submit-pay': 'payment-submitting',
    'reset': 'order-review',
  },
  'payment-submitting': {
    'pay-accepted': 'pay-accepted',
    'pay-gate-rejected': 'gate-rejected',
    'pay-cli-error': 'cli-error',
    'pay-outcome-unknown': 'unknown-pay',
  },
  'pay-accepted': {
    'start-polling': 'status-polling',
    'reset': 'order-review',
  },
  'status-polling': {
    'status-ticketed-simulated': 'ticketed-simulated',
    'status-cancelled': 'cancelled',
    'poll-budget-exhausted': 'safely-stopped',
    'status-unknown': 'safely-stopped',
    'status-check': 'status-polling',
  },
  // Terminal states: no outgoing transitions.
  'ticketed-simulated': {},
  'cancelled': {},
  'gate-rejected': {
    // A new attempt requires `reset` back to review, followed by a NEW
    // submit event carrying a fresh confirmationToken + idempotencyKey.
    'reset': 'order-review',
    'hide': 'hidden',
  },
  'cli-error': {
    'reset': 'order-review',
    'hide': 'hidden',
  },
  // Unknown outcomes: read-only status checks and reset only. NO retry.
  'unknown-create': {
    'status-check': 'unknown-create',
    'reset': 'order-review',
    'hide': 'hidden',
  },
  'unknown-pay': {
    'status-check': 'unknown-pay',
    'reset': 'order-review',
    'hide': 'hidden',
  },
  // Safely stopped: manual status re-checks allowed; never a write.
  'safely-stopped': {
    'status-check': 'safely-stopped',
    'reset': 'order-review',
    'hide': 'hidden',
  },
};

/* ── Validation helpers (pure) ── */

function isFreshNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isWriteEvent(
  event: SandboxOrderEvent,
): event is Extract<SandboxOrderEvent, { type: 'submit-order' | 'submit-pay' }> {
  return event.type === 'submit-order' || event.type === 'submit-pay';
}

/**
 * Validates an event shape. Write events must carry a fresh, non-empty
 * confirmationToken and idempotencyKey; if the context lists previously
 * used idempotency keys, a reused key makes the event stale (invalid).
 */
function isEventValid(
  event: SandboxOrderEvent,
  context?: TransitionContext,
): boolean {
  if (!event || typeof event.type !== 'string') return false;

  if (isWriteEvent(event)) {
    if (!isFreshNonEmptyString(event.confirmationToken)) return false;
    if (!isFreshNonEmptyString(event.idempotencyKey)) return false;
    if (context?.usedIdempotencyKeys) {
      const used =
        context.usedIdempotencyKeys instanceof Set
          ? context.usedIdempotencyKeys
          : new Set(context.usedIdempotencyKeys);
      if (used.has(event.idempotencyKey)) return false;
    }
  }

  if (event.type === 'order-accepted') {
    return isFreshNonEmptyString(event.orderNo);
  }

  return true;
}

/* ── State machine API ── */

/** Returns whether a state is one of the known sandbox states. */
export function isKnownState(state: SandboxOrderState): boolean {
  return (SANDBOX_ORDER_STATES as readonly string[]).includes(state);
}

/** Returns whether a transition is allowed from `from` on `event`. */
export function canTransition(
  from: SandboxOrderState,
  event: SandboxOrderEvent,
  context?: TransitionContext,
): boolean {
  if (!isKnownState(from)) return false;
  if (!isEventValid(event, context)) return false;
  const target = TRANSITION_TABLE[from][event.type];
  return typeof target === 'string';
}

/**
 * Applies a transition. Returns the new state, or null when the
 * transition is forbidden (fail closed — the caller must not proceed).
 */
export function transition(
  from: SandboxOrderState,
  event: SandboxOrderEvent,
  context?: TransitionContext,
): SandboxOrderState | null {
  if (!canTransition(from, event, context)) return null;
  return TRANSITION_TABLE[from][event.type] ?? null;
}

/** Returns the initial state. The branch starts hidden; no write state
 *  is reachable without an explicit opt-in event. */
export function getInitialState(): SandboxOrderState {
  return 'hidden';
}

/** Terminal states render final banners and accept no write events. */
export function isTerminalState(state: SandboxOrderState): boolean {
  return (SANDBOX_TERMINAL_STATES as readonly string[]).includes(state);
}

/** Unknown-outcome states: "Result unknown — do not resubmit". */
export function isUnknownOutcomeState(state: SandboxOrderState): boolean {
  return (SANDBOX_UNKNOWN_OUTCOME_STATES as readonly string[]).includes(state);
}

/** Whether a fresh write attempt may start from this state. A new write
 *  always requires being back at the matching review state, which in
 *  turn requires a new confirmation event. */
export function canAttemptWrite(
  state: SandboxOrderState,
  operation: SandboxWriteOperation,
): boolean {
  if (operation === 'order') return state === 'order-review';
  if (operation === 'pay') return state === 'payment-review';
  return false;
}

/* ── Provider outcome mapping (pure) ── */

export type SandboxProviderOutcome = 'accepted' | 'unknown';

/** Named codes that indicate an accepted sandbox order outcome. */
const KNOWN_ORDER_ACCEPTED_CODES: ReadonlySet<string> = new Set([
  'PAYMENT_CONFIRMATION_REQUIRED',
  // Adopt the returned existing order number; never recreate.
  'DUPLICATE_BOOKING_SUSPECTED',
]);

/** Named codes that indicate an accepted sandbox pay outcome. */
const KNOWN_PAY_ACCEPTED_CODES: ReadonlySet<string> = new Set([
  'PAYMENT_ACCEPTED',
]);

/** Codes that explicitly mean the outcome is unknown. */
const KNOWN_UNKNOWN_CODES: ReadonlySet<string> = new Set([
  'ORDER_CREATION_UNKNOWN',
  'PAYMENT_STATUS_UNKNOWN',
  'PAYMENT_PROCESSING',
]);

/**
 * Maps a provider result code to an outcome, fail closed:
 *   - non-string, empty, numeric, or unrecognized codes → 'unknown';
 *   - numeric status-code semantics are unverified (spec Section 22
 *     BLOCKED), so numeric codes NEVER map to a success state.
 */
export function mapProviderOutcome(
  operation: SandboxWriteOperation,
  code: unknown,
): SandboxProviderOutcome {
  if (typeof code !== 'string' || code.trim().length === 0) return 'unknown';
  // Numeric codes are unverified placeholders — never success.
  if (/^-?\d+(\.\d+)?$/.test(code.trim())) return 'unknown';
  const normalized = code.trim();
  const accepted =
    operation === 'order' ? KNOWN_ORDER_ACCEPTED_CODES : KNOWN_PAY_ACCEPTED_CODES;
  if (accepted.has(normalized)) return 'accepted';
  if (KNOWN_UNKNOWN_CODES.has(normalized)) return 'unknown';
  return 'unknown';
}
