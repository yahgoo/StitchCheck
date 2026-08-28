/* ── Atlas Sandbox write-rehearsal panel (full reducer-driven flow) ──
 *
 * Renders the complete Sandbox rehearsal flow: opt-in → order-review →
 * confirm-intent → order → payment-review → pay → read-only status
 * polling. Every transition is driven through the pure core state
 * machine (`transition()` from the core barrel); forbidden transitions
 * return null and are treated as fail-closed no-ops.
 *
 * Visibility requires ALL of (fail closed — any failure hides the panel):
 *   1. __ATLAS_SANDBOX_WRITES__ === true   (compile-time second layer)
 *   2. DATA_MODE === 'live'
 *   3. runtime POST /api/atlas/sandbox/capabilities reports sandbox
 *      writes enabled AND a sandbox environment (fetched lazily only
 *      when panel-eligible; any fetch failure keeps the panel hidden)
 *   4. Verify succeeded
 *   5. a valid current booking identifier exists (from VerifySummary)
 *   6. the user explicitly opts in and acknowledges the sandbox nature
 *      before any write control becomes enabled
 *
 * Safety invariants:
 *   - Write buttons are enabled ONLY when
 *     `canAttemptWrite(state, op) && acknowledged`; no write request
 *     can fire before explicit confirmation.
 *   - Every write attempt uses a fresh confirm-intent token plus a
 *     fresh `crypto.randomUUID()` idempotency key; consumed keys are
 *     recorded in reducer state and rejected by the state machine.
 *   - Unknown order/pay outcomes never auto-retry; only read-only
 *     status checks remain available.
 *   - Status polling is a recursive setTimeout chain (5s cadence,
 *     10-poll budget) that ends in `safely-stopped`; unmount cleanup
 *     clears pending timers and discards in-flight results.
 *   - No copy ever claims a real booking, payment, or airline ticket;
 *     every state carries Sandbox/test/simulated qualifiers. */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
// Core barrel (the `@core` alias target) — the sandbox state machine is
// imported from there, never duplicated locally. Relative form matches
// the existing app convention for tsc resolution.
import {
  transition,
  getSandboxInitialState,
  canAttemptWrite,
  mapProviderOutcome,
  SANDBOX_WRITE_DISCLOSURE,
} from '../../../core';
import type { SandboxOrderEvent, SandboxOrderState } from '../../../core';
import {
  atlasSandboxCapabilities,
  atlasSandboxConfirmIntent,
  atlasSandboxOrder,
  atlasSandboxPay,
  atlasSandboxStatus,
  AtlasClientError,
} from '../atlas/client';
import type { AtlasSandboxCapabilitiesResponse } from '../atlas/types';

const DATA_MODE: string = typeof __DATA_MODE__ !== 'undefined' ? __DATA_MODE__ : 'offline';

/** Compile-time second-layer gate injected by vite define. Never the
 *  sole gate — the runtime capabilities check is primary. */
const SANDBOX_WRITES_COMPILE_FLAG: boolean =
  typeof __ATLAS_SANDBOX_WRITES__ !== 'undefined' ? __ATLAS_SANDBOX_WRITES__ : false;

/* Status polling parameters: 5s cadence, ~10-poll budget, then the
 * machine is dispatched to `safely-stopped`. */
const POLL_INTERVAL_MS = 5_000;
const POLL_BUDGET = 10;

/* ── Reducer: all panel state moves through the core state machine ── */

interface PanelReducerState {
  state: SandboxOrderState;
  orderNo: string | null;
  /** Idempotency keys already consumed by previous write attempts. */
  idempotencyKeys: string[];
  lastError: string | null;
  pollBudget: number;
}

type PanelAction = { event: SandboxOrderEvent; lastError?: string | null };

function createInitialPanelState(): PanelReducerState {
  return {
    state: getSandboxInitialState(),
    orderNo: null,
    idempotencyKeys: [],
    lastError: null,
    pollBudget: 0,
  };
}

/** Pure reducer. The core `transition()` is the ONLY transition table;
 *  a `null` return (forbidden / stale event) is a fail-closed no-op. */
function panelReducer(prev: PanelReducerState, action: PanelAction): PanelReducerState {
  const next = transition(prev.state, action.event, {
    usedIdempotencyKeys: prev.idempotencyKeys,
  });
  if (next === null) return prev;

  const event = action.event;
  let orderNo = prev.orderNo;
  let idempotencyKeys = prev.idempotencyKeys;
  let pollBudget = prev.pollBudget;

  if (event.type === 'submit-order' || event.type === 'submit-pay') {
    idempotencyKeys = [...prev.idempotencyKeys, event.idempotencyKey];
  }
  if (event.type === 'order-accepted') orderNo = event.orderNo;
  if (event.type === 'start-polling') pollBudget = POLL_BUDGET;
  if (event.type === 'status-check') pollBudget = Math.max(0, prev.pollBudget - 1);

  let lastError = prev.lastError;
  if (action.lastError !== undefined) lastError = action.lastError;
  if (event.type === 'reset' || event.type === 'opt-in') lastError = null;

  return { state: next, orderNo, idempotencyKeys, lastError, pollBudget };
}

export interface SandboxOrderPanelProps {
  /** Opaque booking identifier from the successful Verify response. */
  bookingId?: string;
  /** Currently verified offer id (context reference only). */
  offerId: string | null;
  /** Status of the current Verify result ('success' required). */
  verifyStatus?: string;
}

export function SandboxOrderPanel({ bookingId, offerId, verifyStatus }: SandboxOrderPanelProps) {
  const [capabilities, setCapabilities] = useState<AtlasSandboxCapabilitiesResponse | null>(null);
  const [panel, dispatch] = useReducer(panelReducer, undefined, createInitialPanelState);
  const [acknowledged, setAcknowledged] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  /* Lifecycle guards: on unmount (e.g. App.tsx's sandboxPanelKey bump
   * on restart) pending timers are cleared and in-flight results are
   * discarded — nothing can dispatch after the panel is gone. */
  const cancelledRef = useRef(false);
  const busyRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderNoRef = useRef<string | null>(null);
  /** Monotonic polling-chain id: every (re)start bumps it, and cleanup
   *  invalidates the current chain so StrictMode double-mounts can never
   *  run two status-polling chains in parallel. */
  const pollChainRef = useRef(0);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    orderNoRef.current = panel.orderNo;
  }, [panel.orderNo]);

  /* Gates 1, 2, 4, 5 — compile flag, live mode, successful Verify,
   * and a valid booking identifier. All fail closed. */
  const eligible =
    SANDBOX_WRITES_COMPILE_FLAG === true &&
    DATA_MODE === 'live' &&
    verifyStatus === 'success' &&
    typeof bookingId === 'string' &&
    bookingId.trim().length > 0;

  /* Gate 3 — runtime capabilities, fetched lazily only when eligible.
   * Any fetch failure (403 gate rejection, network error, ...) keeps
   * the panel hidden. Re-checked whenever the Verify context changes. */
  useEffect(() => {
    if (!eligible) {
      setCapabilities(null);
      return;
    }
    let cancelled = false;
    atlasSandboxCapabilities()
      .then((caps) => {
        if (!cancelled) setCapabilities(caps);
      })
      .catch(() => {
        if (!cancelled) setCapabilities(null);
      });
    return () => {
      cancelled = true;
    };
  }, [eligible, bookingId, offerId]);

  /* Runtime visibility gate: sandbox writes enabled AND the runtime
   * confirms a sandbox environment. Any fetch failure leaves
   * `capabilities` null and the panel hidden (fail closed). */
  const runtimeEnabled =
    capabilities !== null &&
    capabilities.sandboxWritesEnabled === true &&
    capabilities.environment === 'sandbox';

  /* ── Write flow handlers (fire only from explicit confirmations) ── */

  const handleSubmitOrder = useCallback(async () => {
    if (!acknowledged || busyRef.current) return;
    if (typeof bookingId !== 'string' || bookingId.trim().length === 0) return;
    busyRef.current = true;
    setStatusNote(null);
    // Fresh idempotency key per attempt; the confirm-intent token is
    // fetched fresh and single-use server-side.
    const idempotencyKey = crypto.randomUUID();
    // True only once the submit-order event has been dispatched; a
    // confirm-intent failure BEFORE that point has no valid transition
    // from order-review, so it must be surfaced via the status note
    // instead of a swallowed dispatch (fix round WARNING-4).
    let submitted = false;
    try {
      const intent = await atlasSandboxConfirmIntent({ operation: 'order', bookingId });
      if (cancelledRef.current) return;
      dispatch({
        event: { type: 'submit-order', confirmationToken: intent.confirmationToken, idempotencyKey },
      });
      submitted = true;
      const response = await atlasSandboxOrder({
        bookingId,
        confirmationToken: intent.confirmationToken,
        idempotencyKey,
      });
      if (cancelledRef.current) return;
      const outcome = mapProviderOutcome('order', response.providerCode);
      if (
        outcome === 'accepted' &&
        typeof response.orderNo === 'string' &&
        response.orderNo.trim().length > 0
      ) {
        dispatch({ event: { type: 'order-accepted', orderNo: response.orderNo }, lastError: null });
      } else {
        dispatch({
          event: { type: 'order-outcome-unknown' },
          lastError: `Sandbox provider returned an unrecognized order outcome code (${String(response.providerCode ?? 'none')}). No retry will be attempted.`,
        });
      }
    } catch (err) {
      if (cancelledRef.current) return;
      if (!submitted) {
        // Confirm-intent failed before any write was submitted: surface
        // the failure directly (no state-machine transition exists for
        // this case). Sandbox-qualified copy; nothing was created.
        if (err instanceof AtlasClientError && err.httpStatus === 429) {
          setStatusNote(
            'Sandbox confirmation-token rate limit reached (HTTP 429). Nothing was created or charged in the sandbox test — try again shortly.',
          );
        } else if (err instanceof AtlasClientError && err.httpStatus === 403) {
          setStatusNote(
            `Sandbox safety gate rejected the confirmation request (HTTP 403, ${err.code}). Nothing was created or charged.`,
          );
        } else {
          setStatusNote(
            'Sandbox confirmation step failed before the test order was submitted. Nothing was created or charged — try again shortly.',
          );
        }
        return;
      }
      if (err instanceof AtlasClientError && err.httpStatus === 403) {
        dispatch({
          event: { type: 'order-gate-rejected' },
          lastError: `Sandbox safety gate rejected the order request (HTTP 403, ${err.code}). Nothing was created or charged.`,
        });
      } else if (err instanceof AtlasClientError && err.httpStatus === 502) {
        dispatch({
          event: { type: 'order-cli-error' },
          lastError: `Sandbox order failed upstream (HTTP 502, code: ${err.code}). The test flow halted before any confirmation.`,
        });
      } else {
        dispatch({
          event: { type: 'order-outcome-unknown' },
          lastError: 'Sandbox order outcome unknown — do not resubmit — check status. No retry will be attempted automatically.',
        });
      }
    } finally {
      busyRef.current = false;
    }
  }, [acknowledged, bookingId]);

  const handleSubmitPay = useCallback(async () => {
    if (!acknowledged || busyRef.current) return;
    const orderNo = orderNoRef.current;
    if (!orderNo) return;
    busyRef.current = true;
    setStatusNote(null);
    const idempotencyKey = crypto.randomUUID();
    // See handleSubmitOrder: a confirm-intent failure before the
    // submit-pay dispatch must surface via the status note (WARNING-4).
    let submitted = false;
    try {
      const intent = await atlasSandboxConfirmIntent({ operation: 'pay', orderNo });
      if (cancelledRef.current) return;
      dispatch({
        event: { type: 'submit-pay', confirmationToken: intent.confirmationToken, idempotencyKey },
      });
      submitted = true;
      const response = await atlasSandboxPay({
        orderNo,
        confirmationToken: intent.confirmationToken,
        idempotencyKey,
      });
      if (cancelledRef.current) return;
      const outcome = mapProviderOutcome('pay', response.providerCode);
      if (outcome === 'accepted') {
        dispatch({ event: { type: 'pay-accepted' }, lastError: null });
      } else {
        dispatch({
          event: { type: 'pay-outcome-unknown' },
          lastError: `Sandbox provider returned an unrecognized payment outcome code (${String(response.providerCode ?? 'none')}). Never re-pay — check status.`,
        });
      }
    } catch (err) {
      if (cancelledRef.current) return;
      if (!submitted) {
        if (err instanceof AtlasClientError && err.httpStatus === 429) {
          setStatusNote(
            'Sandbox confirmation-token rate limit reached (HTTP 429). No payment was submitted in the sandbox test — try again shortly.',
          );
        } else if (err instanceof AtlasClientError && err.httpStatus === 403) {
          setStatusNote(
            `Sandbox safety gate rejected the payment confirmation request (HTTP 403, ${err.code}). Nothing was charged.`,
          );
        } else {
          setStatusNote(
            'Sandbox payment confirmation step failed before submission. Nothing was charged — never re-pay; try again shortly or check status.',
          );
        }
        return;
      }
      if (err instanceof AtlasClientError && err.httpStatus === 403) {
        dispatch({
          event: { type: 'pay-gate-rejected' },
          lastError: `Sandbox safety gate rejected the payment request (HTTP 403, ${err.code}). Nothing was charged.`,
        });
      } else if (err instanceof AtlasClientError && err.httpStatus === 502) {
        dispatch({
          event: { type: 'pay-cli-error' },
          lastError: `Sandbox payment failed upstream (HTTP 502, code: ${err.code}). Never re-pay — check status first.`,
        });
      } else {
        dispatch({
          event: { type: 'pay-outcome-unknown' },
          lastError: 'Sandbox payment outcome unknown — do not resubmit — check status. Never re-pay an unresolved order.',
        });
      }
    } finally {
      busyRef.current = false;
    }
  }, [acknowledged]);

  /* ── Read-only status polling (recursive setTimeout chain) ── */

  const schedulePoll = useCallback((remaining: number, chainId: number) => {
    if (cancelledRef.current) return;
    if (pollChainRef.current !== chainId) return; // superseded chain
    pollTimerRef.current = setTimeout(async () => {
      pollTimerRef.current = null;
      if (cancelledRef.current) return;
      if (pollChainRef.current !== chainId) return; // superseded chain
      const orderNo = orderNoRef.current;
      if (!orderNo || remaining <= 0) {
        dispatch({ event: { type: 'poll-budget-exhausted' } });
        return;
      }
      try {
        const res = await atlasSandboxStatus({ orderNo });
        if (cancelledRef.current) return;
        if (pollChainRef.current !== chainId) return; // superseded chain
        if (res.status === 'ticketed-simulated') {
          dispatch({ event: { type: 'status-ticketed-simulated' }, lastError: null });
          return;
        }
        if (res.status === 'cancelled') {
          dispatch({ event: { type: 'status-cancelled' }, lastError: null });
          return;
        }
        if (res.status === 'unknown') {
          dispatch({ event: { type: 'status-unknown' } });
          return;
        }
        dispatch({ event: { type: 'status-check' } });
        schedulePoll(remaining - 1, chainId);
      } catch {
        if (cancelledRef.current) return;
        if (pollChainRef.current !== chainId) return;
        dispatch({ event: { type: 'status-unknown' } });
      }
    }, POLL_INTERVAL_MS);
  }, []);

  /* After an accepted sandbox payment, move to polling automatically.
   * The cleanup invalidates the polling chain and clears any scheduled
   * timer, so dev StrictMode double-mounts run exactly ONE chain. */
  useEffect(() => {
    if (panel.state !== 'pay-accepted') return;
    const chainId = pollChainRef.current + 1;
    pollChainRef.current = chainId;
    dispatch({ event: { type: 'start-polling' } });
    schedulePoll(POLL_BUDGET, chainId);
    return () => {
      pollChainRef.current += 1; // invalidate this chain
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [panel.state, schedulePoll]);

  /* Manual read-only status check (available in unknown/stopped states). */
  const handleManualStatusCheck = useCallback(async () => {
    if (busyRef.current) return;
    const orderNo = orderNoRef.current;
    if (!orderNo) return;
    busyRef.current = true;
    try {
      const res = await atlasSandboxStatus({ orderNo });
      if (cancelledRef.current) return;
      dispatch({ event: { type: 'status-check' } });
      setStatusNote(`Sandbox status (test data): ${res.status}${res.reason ? ` — ${res.reason}` : ''}. Read-only check; no write was attempted.`);
    } catch (err) {
      if (cancelledRef.current) return;
      dispatch({ event: { type: 'status-check' } });
      setStatusNote(
        err instanceof AtlasClientError
          ? `Sandbox status check failed (HTTP ${err.httpStatus}, ${err.code}). Read-only; no write was attempted.`
          : 'Sandbox status check failed. Read-only; no write was attempted.',
      );
    } finally {
      busyRef.current = false;
    }
  }, []);

  const handleStartRehearsal = useCallback(() => {
    dispatch({ event: { type: 'opt-in' } });
  }, []);

  const handleAcknowledgeChange = useCallback((checked: boolean) => {
    setAcknowledged(checked);
    if (checked) {
      // Only modelled path forward from `opt-in` is `reset`, which the
      // state machine maps to the order-review state.
      dispatch({ event: { type: 'reset' } });
    }
  }, []);

  const handleReset = useCallback(() => {
    dispatch({ event: { type: 'reset' } });
    setStatusNote(null);
  }, []);

  const state = panel.state;

  /* Hidden unless every gate passes. */
  if (!eligible || !runtimeEnabled) {
    return null;
  }

  return (
    <div className="sc-sbx-panel" aria-label="Atlas Sandbox rehearsal">
      <style>{SANDBOX_PANEL_CSS}</style>

      <div className="sc-sbx-header">
        <span className="sc-sbx-badge">Atlas Sandbox rehearsal</span>
        <span className="sc-sbx-env">Test environment only</span>
      </div>

      {state === 'hidden' && (
        <>
          <p className="sc-sbx-copy">
            Sandbox write rehearsal for the Atlas test flow (synthetic test
            data only). Nothing here creates a real booking, charge, or
            airline ticket.
          </p>
          <button
            className="sc-btn sc-btn--secondary"
            type="button"
            onClick={handleStartRehearsal}
          >
            Atlas Sandbox rehearsal (test data only)
          </button>
          <p className="sc-sbx-footnote">{SANDBOX_WRITE_DISCLOSURE}</p>
        </>
      )}

      {state !== 'hidden' && (
        <>
          <label className="sc-sbx-ack">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => handleAcknowledgeChange(e.target.checked)}
            />
            <span>
              I understand this is a Sandbox test: no real booking, no real
              charge, no airline ticket will ever be created.
            </span>
          </label>

          <p className="sc-sbx-disclosure">{SANDBOX_WRITE_DISCLOSURE}</p>

          <dl className="sc-sbx-meta">
            <dt>Sandbox booking reference (test data)</dt>
            <dd>{bookingId}</dd>
            {offerId && (
              <>
                <dt>Verified offer (test context)</dt>
                <dd>{offerId}</dd>
              </>
            )}
            {panel.orderNo && (
              <>
                <dt>Sandbox order number (test data)</dt>
                <dd>{panel.orderNo}</dd>
              </>
            )}
          </dl>
        </>
      )}

      {state === 'opt-in' && (
        <p className="sc-sbx-helper">
          Acknowledge the Sandbox test disclosure above to unlock the
          sandbox order review (synthetic data only).
        </p>
      )}

      {state === 'order-review' && (
        <>
          <button
            className="sc-btn sc-btn--primary"
            type="button"
            onClick={handleSubmitOrder}
            disabled={!canAttemptWrite(state, 'order') || !acknowledged || busyRef.current}
          >
            Create sandbox test order
          </button>
          <p className="sc-sbx-helper">
            Sandbox order review (test data). Requires a fresh confirmation
            token and a fresh idempotency key; nothing is charged.
          </p>
          {!acknowledged && (
            <p className="sc-sbx-helper">
              Acknowledgement unchecked — the sandbox order control stays locked.
            </p>
          )}
        </>
      )}

      {state === 'order-submitting' && (
        <p className="sc-sbx-copy" role="status">
          Creating sandbox test order (simulated)… the sandbox control is
          locked until the provider answers.
        </p>
      )}

      {state === 'order-created-unpaid' && (
        <>
          <p className="sc-sbx-copy" role="status">
            Sandbox test order created (unpaid, simulated). No real charge
            has occurred.
          </p>
          <button
            className="sc-btn sc-btn--secondary"
            type="button"
            onClick={() => dispatch({ event: { type: 'review-payment' } })}
          >
            Review sandbox payment (test)
          </button>
        </>
      )}

      {state === 'payment-review' && (
        <>
          <button
            className="sc-btn sc-btn--primary"
            type="button"
            onClick={handleSubmitPay}
            disabled={!canAttemptWrite(state, 'pay') || !acknowledged || busyRef.current}
          >
            Pay sandbox test order (simulated)
          </button>
          <p className="sc-sbx-helper">
            Sandbox payment rehearsal (synthetic). A separate confirmation
            token and a fresh idempotency key are required; no real charge
            exists.
          </p>
        </>
      )}

      {state === 'payment-submitting' && (
        <p className="sc-sbx-copy" role="status">
          Submitting simulated sandbox payment… the sandbox control is
          locked until the provider answers.
        </p>
      )}

      {state === 'pay-accepted' && (
        <p className="sc-sbx-copy" role="status">
          Simulated sandbox payment accepted — starting read-only status
          polling (test data).
        </p>
      )}

      {state === 'status-polling' && (
        <p className="sc-sbx-copy" role="status">
          Polling sandbox order status every 5 seconds (test data); about{' '}
          {panel.pollBudget} checks remaining in the budget. No further
          writes will be attempted.
        </p>
      )}

      {state === 'ticketed-simulated' && (
        <p className="sc-sbx-copy sc-sbx-terminal" role="status">
          Sandbox rehearsal complete: a simulated ticket was issued in the
          test environment. No real ticket exists.
        </p>
      )}

      {state === 'cancelled' && (
        <p className="sc-sbx-copy sc-sbx-terminal" role="status">
          The sandbox test order was cancelled in the test environment. No
          real booking or charge was affected.
        </p>
      )}

      {state === 'gate-rejected' && (
        <p className="sc-sbx-copy sc-sbx-error" role="alert">
          Sandbox write rejected by the safety gates (HTTP 403). Nothing was
          created or charged in the sandbox test.
        </p>
      )}

      {state === 'cli-error' && (
        <p className="sc-sbx-copy sc-sbx-error" role="alert">
          Sandbox write failed upstream (HTTP 502). The test flow halted
          before any confirmation; nothing is charged.
        </p>
      )}

      {state === 'unknown-create' && (
        <p className="sc-sbx-copy sc-sbx-error" role="alert">
          Sandbox order outcome unknown — do not resubmit — check status.
          No retry will be attempted automatically.
        </p>
      )}

      {state === 'unknown-pay' && (
        <p className="sc-sbx-copy sc-sbx-error" role="alert">
          Sandbox payment outcome unknown — do not resubmit — check status.
          Never re-pay an unresolved sandbox test order.
        </p>
      )}

      {state === 'safely-stopped' && (
        <p className="sc-sbx-copy sc-sbx-error" role="status">
          Sandbox status polling budget exhausted — the rehearsal was safely
          stopped. Manual read-only status checks remain available; no write
          will be retried.
        </p>
      )}

      {panel.lastError && state !== 'hidden' && (
        <p className="sc-sbx-helper sc-sbx-last-error">{panel.lastError}</p>
      )}

      {statusNote && <p className="sc-sbx-helper">{statusNote}</p>}

      {(state === 'unknown-create' || state === 'unknown-pay' || state === 'safely-stopped') &&
        panel.orderNo && (
          <button
            className="sc-btn sc-btn--secondary"
            type="button"
            onClick={handleManualStatusCheck}
            disabled={busyRef.current}
          >
            Check sandbox order status (read-only)
          </button>
        )}

      {(state === 'gate-rejected' ||
        state === 'cli-error' ||
        state === 'unknown-create' ||
        state === 'unknown-pay' ||
        state === 'safely-stopped') && (
        <button className="sc-btn sc-btn--secondary" type="button" onClick={handleReset}>
          Return to sandbox order review
        </button>
      )}

      {state !== 'hidden' && (
        <p className="sc-sbx-footnote">
          {SANDBOX_WRITE_DISCLOSURE} · Sandbox only — synthetic passenger —
          no real payment and no real ticket
        </p>
      )}
    </div>
  );
}

/* Scoped rehearsal styles (additive; existing app styles untouched). */
const SANDBOX_PANEL_CSS = `
.sc-sbx-panel {
  margin-top: 0.75rem;
  padding: 0.85rem 1rem;
  border: 1px dashed rgba(120, 120, 140, 0.55);
  border-radius: 8px;
  background: rgba(120, 120, 140, 0.07);
}
.sc-sbx-header { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.sc-sbx-badge {
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid currentColor;
}
.sc-sbx-env { font-size: 0.78rem; opacity: 0.75; }
.sc-sbx-copy { font-size: 0.85rem; margin: 0.5rem 0; }
.sc-sbx-ack { display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.85rem; margin: 0.5rem 0; }
.sc-sbx-disclosure { font-size: 0.85rem; font-weight: 600; margin: 0.4rem 0; }
.sc-sbx-meta { font-size: 0.8rem; margin: 0.5rem 0; }
.sc-sbx-meta dt { opacity: 0.7; }
.sc-sbx-meta dd { margin: 0 0 0.35rem 0; word-break: break-all; }
.sc-sbx-helper { font-size: 0.78rem; opacity: 0.8; margin: 0.35rem 0; }
.sc-sbx-footnote { font-size: 0.72rem; opacity: 0.65; margin-top: 0.6rem; }
.sc-sbx-error { font-weight: 600; }
.sc-sbx-terminal { font-weight: 600; }
.sc-sbx-last-error { font-style: italic; }
`;
