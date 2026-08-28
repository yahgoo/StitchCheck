/* ── Atlas Sandbox write-rehearsal panel (SCAFFOLDING ONLY) ──
 *
 * Renders ONLY safe scaffolding: opt-in, acknowledgement, synthetic
 * test-data disclosure, and a permanently DISABLED Order action.
 *
 * Visibility requires ALL of (fail closed — any failure hides the panel):
 *   1. __ATLAS_SANDBOX_WRITES__ === true   (compile-time second layer)
 *   2. DATA_MODE === 'live'
 *   3. runtime POST /api/atlas/sandbox/capabilities reports sandbox
 *      writes enabled AND execution NOT approved (fetched lazily only
 *      when panel-eligible; any fetch failure keeps the panel hidden)
 *   4. Verify succeeded
 *   5. a valid current booking identifier exists (from VerifySummary)
 *   6. the user explicitly opts in (button + acknowledgement checkbox)
 *
 * Safety invariants:
 *   - The Order control is ALWAYS disabled and never fires a request.
 *   - No Pay control is rendered (no sandbox order can be proven to
 *     exist at this stage). No Ticket control exists at all.
 *   - No copy ever claims a real booking, payment, or airline ticket;
 *     every state carries Sandbox/test/simulated qualifiers.
 *   - Panel state logic uses the pure @core sandbox state machine
 *     (hidden → opt-in → order-review); submitting states are never
 *     reached because no enabled write control exists. */

import { useCallback, useEffect, useState } from 'react';
// Core barrel (the `@core` alias target) — sandbox state machine and
// sandbox disclosure are imported from there, never duplicated locally.
// Relative form matches the existing app convention for tsc resolution.
import {
  canTransition,
  transition,
  getSandboxInitialState,
  canAttemptWrite,
  SANDBOX_WRITE_DISCLOSURE,
} from '../../../core';
import type { SandboxOrderState } from '../../../core';
import { atlasSandboxCapabilities } from '../atlas/client';
import type { AtlasSandboxCapabilitiesResponse } from '../atlas/types';

const DATA_MODE: string = typeof __DATA_MODE__ !== 'undefined' ? __DATA_MODE__ : 'offline';

/** Compile-time second-layer gate injected by vite define. Never the
 *  sole gate — the runtime capabilities check is primary. */
const SANDBOX_WRITES_COMPILE_FLAG: boolean =
  typeof __ATLAS_SANDBOX_WRITES__ !== 'undefined' ? __ATLAS_SANDBOX_WRITES__ : false;

/** Exact helper text required for the disabled Order action. */
const ORDER_HELPER_TEXT = 'Sandbox write implementation pending contract approval';

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
  const [panelState, setPanelState] = useState<SandboxOrderState>(getSandboxInitialState());
  const [acknowledged, setAcknowledged] = useState(false);

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

  /* Runtime gate: writes enabled, sandbox environment confirmed, and
   * execution still NOT approved. If execution were ever approved the
   * scaffolding panel hides itself — a fresh approved UI is required. */
  const runtimeEnabled =
    capabilities !== null &&
    capabilities.sandboxWritesEnabled === true &&
    capabilities.environment === 'sandbox' &&
    capabilities.executionApproved === false;

  const handleStartRehearsal = useCallback(() => {
    // Pure state machine transition `hidden → opt-in`; forbidden
    // transitions return null and the state is left unchanged.
    setPanelState((prev) => transition(prev, { type: 'opt-in' }) ?? prev);
  }, []);

  const handleAcknowledgeChange = useCallback((checked: boolean) => {
    setAcknowledged(checked);
    if (checked) {
      // Only modelled path forward from `opt-in` is `reset`, which the
      // state machine maps to the order-review state.
      setPanelState((prev) => transition(prev, { type: 'reset' }) ?? prev);
    }
  }, []);

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

      {panelState === 'hidden' && (
        <>
          <p className="sc-sbx-copy">
            Rehearsal scaffold for the Atlas Sandbox test flow (synthetic test
            data only). Nothing here creates a real booking, charge, or airline
            ticket.
          </p>
          <button
            className="sc-btn sc-btn--secondary"
            type="button"
            onClick={handleStartRehearsal}
            disabled={!canTransition(panelState, { type: 'opt-in' })}
          >
            Atlas Sandbox rehearsal (test data only)
          </button>
          <p className="sc-sbx-footnote">{SANDBOX_WRITE_DISCLOSURE}</p>
        </>
      )}

      {panelState !== 'hidden' && (
        <>
          <label className="sc-sbx-ack">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => handleAcknowledgeChange(e.target.checked)}
            />
            <span>
              I understand this is a sandbox test: no real booking, no real
              charge, no airline ticket.
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
          </dl>

          {/* Order action: PERMANENTLY DISABLED in this scaffolding stage.
              It has no onClick handler and can never fire a write request. */}
          <button className="sc-btn sc-btn--primary" type="button" disabled aria-disabled="true">
            Create sandbox test order
          </button>
          <p className="sc-sbx-helper">{ORDER_HELPER_TEXT}</p>

          {!acknowledged && panelState === 'order-review' && (
            <p className="sc-sbx-helper">
              Acknowledgement unchecked — sandbox order review stays locked.
            </p>
          )}

          {canAttemptWrite(panelState, 'order') && (
            <p className="sc-sbx-copy">
              Sandbox order review ready (test data). The order control above is
              intentionally disabled while the write contract is pending
              approval. No payment step and no ticketing step exist in this
              scaffold.
            </p>
          )}

          <p className="sc-sbx-footnote">
            {SANDBOX_WRITE_DISCLOSURE} · Sandbox only — synthetic passenger — no
            real payment or production ticket
          </p>
        </>
      )}
    </div>
  );
}

/* Scoped scaffolding styles (additive; existing app styles untouched). */
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
`;
