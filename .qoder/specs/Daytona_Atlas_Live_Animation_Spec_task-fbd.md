
# Specification: Daytona Sandbox Live Atlas Search/Verify + Recovery-Plan Animation

---

## 1. File List

Every file to be created or modified, organized by phase ownership.

### (a) Phase 1 — Parallel Experts (safe, no live effect)

| File | Action | Purpose |
|---|---|---|
| `app/src/components/RecoveryPlanAnimation.tsx` | CREATE | Expert F builds the self-contained animation component; accepts a typed data prop; no live data wired yet |
| `app/src/types/recovery-plan.ts` | CREATE | TypeScript interfaces for the animation prop shape (see Section 3); Expert F codes against this contract |
| `app/src/components/RecoveryPlanAnimation.css` | CREATE | Styles for cascade-to-red, collapse-into-one-plan, freshness badge, confirmation states |
| `scripts/daytona-orchestrator-offline-tests.mjs` | READ ONLY | Expert A runs the existing 27 orchestrator offline tests; reports pass/fail; no modifications |
| `scripts/daytona-worker-sanitize-tests.mjs` | READ ONLY | Expert A runs the existing 16 worker sanitize tests; reports pass/fail; no modifications |
| `scripts/daytona-sandbox-plan.mjs` | CREATE | Expert B drafts the exact `@daytona/sdk` create-sandbox request script (image, resources, domainAllowList, networkBlockAll, exec timeout); not yet executed |
| `scripts/daytona-provision-sandbox.sh` | CREATE | Expert C drafts the provisioning shell script (uv, Python 3.12, atlas-flight-booking==0.3.12, PATH setup); not yet executed |
| `docs/real-route-justification.md` | CREATE | Expert D documents the real route selection, its source from Atlas docs/onboarding, and non-PII traveler placeholder confirmation |

### (b) Phases 3-7 — Serial Lead Agent only (live effect)

| File | Action | Purpose |
|---|---|---|
| Daytona sandbox (external resource) | CREATE/DESTROY | Phase 3: exactly one sandbox created; Phase 6: destroyed in `finally` block |
| `/worker/output/evidence.json` (inside sandbox) | CREATE | Phase 5: worker writes sanitized Atlas Search/Verify result |
| `app/public/daytona-evidence.json` | CREATE/OVERWRITE | Phase 5/5.5: Lead Agent downloads sanitized envelope from sandbox and writes to this path; this is the data file the animation component reads |
| `app/src/components/RecoveryPlanAnimation.tsx` | READ (no change) | Phase 5.5: Lead Agent wires real data from the envelope into the existing component as its data prop |
| `app/src/App.tsx` | MODIFY | Phase 5.5: import `RecoveryPlanAnimation`, call `loadDaytonaEvidence()`, pass result as prop to the animation component; mount the component in the `confirmed` step |
| `core/provenance/labels.ts` | MODIFY | Phase 7: add one new label constant `ATLAS_UI_LABELS.daytonaSandboxReal` with value `Atlas Sandbox Search/Verify — read-only, real Atlas Sandbox inventory, executed inside Daytona sandbox`; add corresponding branch in `getAtlasLabel()` |
| `core/provenance/metadata.ts` | MODIFY | Phase 7: add new `DataSourceLabel` type including `'real-atlas-sandbox-inventory'` if not already present |
| `docs/evidence-status.md` | MODIFY | Phase 7: append one new row for the Daytona real-data evidence with the new provenance label; explicitly separated from the existing fixture-based rows |

### (c) Phase 8 — Verification only (expect zero or near-zero changes)

| File | Action | Purpose |
|---|---|---|
| `app-fixture-contracts/stitchcheck-ui-demo-data.json` | VERIFY READ ONLY | Confirm fixture data unchanged |
| `smoke-tests/atlas/fixtures/*.json` | VERIFY READ ONLY | Confirm fixture hashes unchanged |
| `core/flags/index.ts` | VERIFY READ ONLY | Confirm feature flags still default safely for fixture-only path |
| `app/src/components/RecoveryPlanAnimation.tsx` | VERIFY (no change expected) | Confirm component renders correctly with fixture data and displays the fixture provenance label, not the real-data label |
| `app/src/App.tsx` | VERIFY (no change expected) | Confirm fixture-only demo path still runs and passes typecheck |

---

## 2. Data Contract — Real Atlas Sandbox Response

The sanitized result flowing from the live worker (Phase 5) into the animation component (Phase 5.5). This is the `DaytonaEvidenceEnvelope` as produced by the existing worker at `workers/daytona-atlas-worker/index.mjs`, with the following exact field structure:

```
DaytonaEvidenceEnvelope {
  envelopeVersion: 1                                          // number, required
  correlationId: string                                       // UUID, required
  sandboxId: string                                           // string, required (opaque sandbox identifier)
  createdAt: string                                           // ISO-8601 timestamp, required — used as freshness timestamp
  destroyedAt: string | null                                  // ISO-8601 or null
  operations: DaytonaOperation[]                              // array, required (0-2 elements)
  provenance: DaytonaEnvelopeProvenance                        // object, required
  sanitized: true                                             // literal, required
}

DaytonaOperation (search) {
  operation: 'search'                                         // literal, required
  status: 'success' | 'error' | 'timeout' | 'forbidden'      // required
  requestSummary: {
    origin: string                                            // IATA code, e.g. 'SIN'
    destination: string                                       // IATA code, e.g. 'BKK'
    departureDate: string                                     // ISO-8601 date
    currency: string                                          // e.g. 'USD'
  }
  responseSummary: {
    offerCount: number | undefined                            // PRESENT if search succeeded; ABSENT on error
    firstOfferReference: string | null | undefined            // PRESENT if offers returned; ABSENT on error
    priceDisplay: string | null | undefined                   // PRESENT if first offer has price; may be null
    currency: string | undefined                              // PRESENT if search succeeded
  }
  latencyMs: number                                           // required
  errorCode: string | null                                    // required
  errorMessage: string | null                                 // required
}

DaytonaOperation (verify) {
  operation: 'verify'                                         // literal, required
  status: 'success' | 'error' | 'timeout' | 'forbidden'      // required
  requestSummary: {
    offerReference: string                                    // the offer that was verified
  }
  responseSummary: {
    verifyStatus: string                                      // e.g. 'price-confirmed', 'PRICE_CONFIRMATION_REQUIRED', 'unknown'
    priceDisplay: string | null                               // verified price or null
    currency: string                                          // e.g. 'USD'
  }
  latencyMs: number                                           // required
  errorCode: string | null                                    // required
  errorMessage: string | null                                 // required
}

DaytonaEnvelopeProvenance {
  evidenceSource: 'daytona-sandbox'                           // literal
  provider: 'atlas'                                           // literal
  executed: boolean                                           // true if live call ran
  fallbackUsed: boolean                                       // true if fallback
  readOnly: true                                              // literal
  sandboxDestroyed: boolean                                   // true after Phase 6
  label: string                                               // provenance label string
}
```

### Fields that MAY be absent and must render as "not available from Sandbox response"

The following fields are NOT produced by the current worker's sanitized response and MUST display as `"not available from Sandbox response"` in the animation rather than a fabricated value:

| Animation field | Why absent | Display when absent |
|---|---|---|
| `fareDelta` | Current worker captures `priceDisplay` (absolute price) but does not compute a delta against an original itinerary fare | `"not available from Sandbox response"` |
| `connectionBufferMinutes` | Current worker does not extract per-offer departure/arrival times needed to compute connection buffer | `"not available from Sandbox response"` |
| `arrivalImpactMinutes` | Current worker does not capture per-offer arrival times for comparison | `"not available from Sandbox response"` |
| `perOffer departureTime` | `responseSummary` aggregates to `firstOfferReference` and `priceDisplay`; does not include per-offer schedule | `"not available from Sandbox response"` |
| `perOffer arrivalTime` | Same as above | `"not available from Sandbox response"` |
| `perOffer duration` | Not captured in current `responseSummary` shape | `"not available from Sandbox response"` |
| `delayRiskSignal` | No live delay-risk field in the Atlas Sandbox response; if no validated heuristic exists, the trigger must be labeled `"Simulated delay trigger — downstream impact is real analysis"` | Use simulated trigger label |

### Fields that ARE available from the real response

| Field | Source | Notes |
|---|---|---|
| `searchRoute.origin` | `operations[0].requestSummary.origin` | Real IATA code |
| `searchRoute.destination` | `operations[0].requestSummary.destination` | Real IATA code |
| `searchRoute.departureDate` | `operations[0].requestSummary.departureDate` | Real date |
| `searchResult.offerCount` | `operations[0].responseSummary.offerCount` | Real count from Atlas inventory |
| `searchResult.currency` | `operations[0].responseSummary.currency` | Real currency |
| `verifiedOffer.priceDisplay` | `operations[1].responseSummary.priceDisplay` | Real verified price |
| `verifiedOffer.verifyStatus` | `operations[1].responseSummary.verifyStatus` | Real verification status |
| `freshnessTimestamp` | `envelope.createdAt` | Real timestamp of the envelope creation |
| `provenanceLabel` | `envelope.provenance.label` | Must be the new real-data label |

---

## 3. Animation Component Prop Interface

The exact TypeScript shape Expert F must build against in Phase 1. This contract matches the data from Section 2 exactly, so no rework is needed when real data is wired in at Phase 5.5.

File: `app/src/types/recovery-plan.ts`

```typescript
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
     *  "Simulated delay trigger — downstream impact is real analysis" */
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
  recommendedPlan: RecoveryPlan;

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
   *  For fixture data: "Fictional alternatives — local demo fixture" (or whichever label the fixture carries).
   *  The component renders this verbatim; it never fabricates or overrides it. */
  provenanceLabel: string;
  /** Data source identifier. */
  dataSource: 'real-atlas-sandbox-inventory' | 'local-fixture' | 'local-fallback';

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
```

### Required visual states

| State | Trigger condition | Visual behavior |
|---|---|---|
| **Trigger** | `delayTrigger.label` is shown | First leg displayed as delayed; if `isRealDelaySignal` is false, label must be exactly `"Simulated delay trigger — downstream impact is real analysis"` |
| **Cascade** | Animation phase progresses through `downstreamItems` | Each item transitions to red/at-risk with its `cascadeDelayMs` stagger; NOT instant — staggered |
| **Collapse into one plan** | `candidateAlternatives` briefly shown, then merge | Multiple alternatives appear, then visually collapse into `recommendedPlan` showing `tradeoffs` (with null fields rendered as `"not available from Sandbox response"`) |
| **Re-plan attempt** | `rePlanAttemptCount > 0` | Show `"Re-plan attempt N of 2"` |
| **Terminal no-plan** | `rePlanAttemptCount >= maxRePlanAttempts` AND `recommendedPlan` is null | Show `"No safe plan found — escalate to traveller/agent"` — do NOT loop |
| **Freshness badge** | Always shown before confirmation screen | `"Availability refreshed just now"` + `freshnessTimestamp` + `provenanceLabel` badge |
| **Review recovery plan** | `confirmationPhase === 'review-recovery-plan'` | Display recommended plan with trade-offs |
| **Confirm switch request** | `confirmationPhase === 'confirm-switch-request'` | User action prompt |
| **Request submitted** | `confirmationPhase === 'request-submitted'` AND `verifiedOutcome === null` | Show `"Request submitted — awaiting verified supplier outcome"` |
| **Verified outcome** | `confirmationPhase === 'verified-outcome'` AND `verifiedOutcome !== null` | Show the real verified state string |
| **NEVER "Booked"/"Switched"** | Unless `verifiedOutcome` contains a real verified result from Phase 5 | Hard rule: these words must not appear without a real verified outcome |

---

## 4. Phase Sequence and Ownership

| Phase | Name | Owner | Model tier | Human gate? | Time allocation |
|---|---|---|---|---|---|
| **1** | Parallel expert prep | Experts A-F (parallel) | Efficient/Lite for Expert F (UI/CSS/motion); Efficient/Lite for Experts A, B, C, D, E (prep/draft/review) | No gate to START; all six must complete before Phase 2 | Part of 80% |
| **2** | Approval Gate 1 | Lead Agent presents; HUMAN approves | N/A (presentation only) | **YES — must receive explicit "approved" before Phase 3** | Part of 80% |
| **3** | Sandbox creation + provisioning | Lead Agent (serial only) | **Performance** (live infrastructure judgment) | No gate after Gate 1 approval; but destroy-and-report-failure if provisioning fails | Part of 80% |
| **4** | Approval Gate 2 | Lead Agent presents; HUMAN approves | N/A (presentation only) | **YES — must receive explicit "approved" before Phase 5** | Part of 80% |
| **5** | Live Atlas Search + Verify | Lead Agent (serial only) | **Performance** (live data judgment) | No gate after Gate 2 approval; bounded by max 1 Search + max 1 Verify | Part of 80% |
| **5.5** | Wire real data into animation | Lead Agent | Efficient/Lite (UI wiring) | No | Part of 80% |
| **6** | Guaranteed cleanup | Lead Agent (serial only) | Efficient/Lite | No — runs unconditionally in `finally` | Part of 80% |
| **7** | Evidence labeling | Lead Agent | Efficient/Lite | No | Part of 80% |
| **8** | Fallback preservation checklist | Lead Agent | Efficient/Lite | No | The 20% slice |

### Model tier rationale

- **Efficient/Lite**: Used for all Phase 1 prep work (including Expert F's animation component), Phase 5.5 wiring, Phase 6 cleanup, Phase 7 labeling, and Phase 8 verification. These are UI/CSS/motion work, file edits, or read-only verification — no live infrastructure judgment needed.
- **Performance**: Reserved for Phase 3 (sandbox creation, provisioning — live infrastructure with real consequences) and Phase 5 (Atlas Search/Verify — live data judgment, sanitization verification). These phases interact with real external systems and require careful decision-making.

---

## 5. Approval Gate Wording

### Approval Gate 1 (between Phase 1 and Phase 3)

The Lead Agent must present ALL of the following to the user and wait for explicit `"approved"`:

```
=== APPROVAL GATE 1 ===

SANDBOX CREATION PLAN:
- Provider: Daytona
- Image: node:20-slim (or as approved by Expert B)
- Resources: { cpu: 1, memory: 2 }
- Network: domainAllowList restricted to PyPI (pypi.org, files.pythonhosted.org), astral.sh, and sandbox.atriptech.com; networkBlockAll otherwise
- Exec timeout: >= 90 seconds
- TTL: 10 minutes (hard cap)
- Ephemeral: true
- Auto-stop: 5 minutes; auto-delete: 0

PROVISIONING SCRIPT:
- Install uv
- Python 3.12
- Install atlas-flight-booking==0.3.12
- Configure PATH
[Exact script content from Expert C follows]

PROPOSED REAL ROUTE:
- Origin: [IATA code from Expert D]
- Destination: [IATA code from Expert D]
- Departure date: [ISO-8601 date from Expert D]
- Currency: USD
- Source justification: [Expert D's documentation of where this route comes from in Atlas's own docs/examples/onboarding materials]
- Confirmation: This route exists in Atlas's documented network and is NOT fabricated or synthetic.
- Traveler details: Non-PII placeholders only (name: "Test Traveler", email: "test@example.com", phone: "+1-555-000-0000")

ANIMATION COMPONENT PREVIEW:
- Component: RecoveryPlanAnimation
- States: trigger -> cascade -> collapse into one plan -> freshness badge -> review recovery plan -> confirm switch request -> request submitted / verified outcome
- Terminal states: "No safe plan found — escalate to traveller/agent" (if no safe plan after 2 attempts)
- Data prop: RecoveryPlanAnimationData (see Section 3)
- Key rule: No fabricated values; fields not available from real data show "not available from Sandbox response"

Type "approved" to proceed to sandbox creation (Phase 3).
```

**Nothing may proceed to Phase 3 without the user's explicit `"approved"` response matching this wording.**

### Approval Gate 2 (between Phase 3 and Phase 5)

The Lead Agent must present the following and wait for explicit `"approved"`:

```
=== APPROVAL GATE 2 ===

SANDBOX STATUS:
- Sandbox created: [sandbox ID]
- Provisioning: [exit code and timing]
- Status: ready for Atlas call

EXACT ATLAS-FLIGHT SEARCH COMMAND:
  atlas-flight search \
    --origin [ORIGIN] \
    --destination [DESTINATION] \
    --depart [DATE] \
    --adults 1 \
    --currency USD \
    --output json

TRAVELER PLACEHOLDER DETAILS (non-PII):
- Name: "Test Traveler"
- Email: "test@example.com"
- Phone: "+1-555-000-0000"

CONSTRAINTS REMINDER:
- Read-only: Search + Verify only
- No order, booking, payment, or ticketing
- Sandbox will be destroyed in finally block after completion

Type "approved" to execute the Atlas Search call (Phase 5).
```

**Nothing may proceed to Phase 5 without the user's explicit `"approved"` response matching this wording.**

---

## 6. Hard Constraints Checklist

Each item is independently verifiable at the end of the run:

```
HARD CONSTRAINTS CHECKLIST — verify each item at end of run:

[ ] 1.  Max 1 Daytona sandbox created, ever, this session
[ ] 2.  Max 1 Atlas Search call, max 1 Atlas Verify call
[ ] 3.  Route/flight/fare data is real Atlas Sandbox inventory, never fabricated or synthetic
[ ] 4.  Traveler/passenger details remain non-PII placeholders
[ ] 5.  No order, booking confirmation, payment, or ticket issuance at any point — hard-disabled in code, not just flag-gated
[ ] 6.  No secret value (DAYTONA_API_KEY, Atlas credentials) ever read, printed, logged, or persisted
[ ] 7.  Sandbox destroyed in a `finally` block regardless of success or failure, confirmation shown
[ ] 8.  Total sandbox lifetime capped at 10 minutes
[ ] 9.  No commit, push, or upload of any kind
[ ] 10. No expert may independently trigger a live external call — only the serial Lead Agent, only after the matching approval gate
[ ] 11. Phase 8 fallback verification introduces no new code — verification only
[ ] 12. Animation never displays a fabricated value for a field the real data doesn't provide; it shows "not available from Sandbox response" instead
[ ] 13. Animation never claims "Booked" or "Switched" without a real verified outcome from Phase 5
```

---

## 7. 80/20 Time-Budget Checkpoint

At approximately the 80% mark of the total session effort, the Lead Agent must announce the following statement verbatim:

```
"Live path + animation effort budget reached — moving to fallback verification now."
```

Then proceed immediately to Phase 8.

### Fallback behavior if incomplete at the 80% mark

If either the live data path (Phases 3-5) or the animation wiring (Phase 5.5) is still incomplete at the 80% mark, the Lead Agent must:

1. Stop live-path work immediately.
2. Destroy any running sandbox (Phase 6 runs early).
3. Report to the user:
   - The exact blocking step that remains incomplete (e.g., "Atlas Search returned an error; sandbox destroyed; animation component built but not wired to real data").
   - What was successfully completed.
   - What was not completed and why.
4. **Defer the extend/fallback decision to the user.** The Lead Agent must NOT independently decide to extend the budget, switch to synthetic data, or fabricate values. The user decides whether to: (a) extend the budget and retry, (b) accept the partial result, or (c) abort.

---

## 8. Evidence and Provenance Labels

### New real-data provenance label

The exact provenance label string to be applied to the new real-data evidence (added in Phase 7):

```
Atlas Sandbox Search/Verify — read-only, real Atlas Sandbox inventory, executed inside Daytona sandbox
```

This label is added as a new constant `ATLAS_UI_LABELS.daytonaSandboxReal` in `core/provenance/labels.ts`. It is selected by `getAtlasLabel()` when `evidenceSource === 'daytona-sandbox'` AND `executed === true` AND `fallbackUsed === false` AND a new field `dataSource === 'real-atlas-sandbox-inventory'` is present.

### Existing fixture-based label (must NOT be merged or confused)

```
Fictional itinerary — local demo fixture
```

This is `GEMINI_LABELS.localFixture` in `core/provenance/labels.ts`. It applies to the browser walkthrough using local fixture data. It must remain distinct and never be merged with, replaced by, or confused with the new real-data label.

### Additional existing labels that must remain untouched

| Label | Constant | Status |
|---|---|---|
| `Fictional alternatives — local demo fixture` | `ATLAS_UI_LABELS.localFixture` | Untouched |
| `Offline fixture — not Atlas Sandbox evidence` | `ATLAS_UI_LABELS.offlineFixture` | Untouched |
| `Daytona sandbox evidence — Atlas Search/Verify, read-only` | `ATLAS_UI_LABELS.daytonaSandbox` | Untouched (this is the existing mock-mode label) |
| `Daytona sandbox unavailable — local fallback used` | `ATLAS_UI_LABELS.daytonaFallback` | Untouched |
| `Atlas Sandbox — live Search/Verify` | `ATLAS_UI_LABELS.sandboxLive` | Untouched |

### Separation rule

The evidence record in `app/public/daytona-evidence.json` produced by this run carries the new real-data label. The existing fixture-based evidence files (`app-fixture-contracts/stitchcheck-ui-demo-data.json`, `smoke-tests/atlas/fixtures/*.json`) retain their original labels. The two must never appear in the same evidence envelope, and the UI must render whichever label corresponds to the actual `evidenceSource` and `dataSource` fields of the data it is displaying.

---

## 9. Final Report Template

The Lead Agent must return the following fields at the end of the run:

```
=== FINAL REPORT ===

1. TIME-SPLIT CONFIRMATION
   - 80/20 split followed: [yes/no]
   - Checkpoint statement announced: [yes/no, exact timestamp]
   - If incomplete at checkpoint: [blocking step description]

2. PHASE 1 EXPERT OUTPUTS SUMMARY
   - Expert A (test re-run): [pass/fail count, model tier used]
   - Expert B (sandbox plan): [summary, model tier used]
   - Expert C (provisioning script): [summary, model tier used]
   - Expert D (real route): [route + justification, model tier used]
   - Expert E (sanitize review): [findings, model tier used]
   - Expert F (animation component): [summary, model tier used]

3. REAL ROUTE SELECTED
   - Origin: [IATA]
   - Destination: [IATA]
   - Departure date: [ISO-8601]
   - Source justification: [where in Atlas docs/onboarding this route was found]
   - Confirmed not synthetic: [yes/no]

4. SANDBOX LIFECYCLE TIMINGS
   - Sandbox created at: [ISO-8601]
   - Provisioning completed at: [ISO-8601] (exit code: [N])
   - Atlas Search executed at: [ISO-8601] (latency: [N]ms)
   - Atlas Verify executed at: [ISO-8601] (latency: [N]ms)
   - Sandbox destroyed at: [ISO-8601]
   - Total sandbox lifetime: [N] seconds (cap: 600s)

5. SANITIZED ATLAS RESULT
   - Envelope version: 1
   - Correlation ID: [UUID]
   - Operations: [list with status, offerCount, verifyStatus]
   - Data source: real-atlas-sandbox-inventory
   - Confirmed real Sandbox inventory: [yes/no]

6. ANIMATION WIRING CONFIRMATION
   - Component mounted in App.tsx: [yes/no]
   - Data prop populated from real envelope: [yes/no]
   - Animation renders end-to-end with real data: [yes/no]

7. "NOT AVAILABLE" FIELDS
   - Fields shown as "not available from Sandbox response": [list each field]
   - Reason for each: [why the current response shape doesn't provide it]

8. SANDBOX DESTROY CONFIRMATION
   - Sandbox destroyed: [yes/no]
   - Destroyed in finally block: [yes/no]
   - Destroy confirmation shown: [yes/no]

9. SECRET-EXPOSURE CONFIRMATION
   - No secret value read, printed, logged, or persisted: [yes/no]
   - Verification method: [how checked]

10. NO-WRITE-ACTION CONFIRMATION
    - No order/booking/payment/ticket attempted: [yes/no]
    - No "Booked" or "Switched" claim shown without real verified outcome: [yes/no]

11. PHASE 8 CHECKLIST RESULTS
    - Fixture-only demo path still runs: [yes/no]
    - Existing fallback video hashes unchanged: [yes/no]
    - Feature flags default safely: [yes/no]
    - Fixture-only evidence labels untouched: [yes/no]
    - Animation renders correctly with fixture data + fixture label: [yes/no]
    - Changes made: [none / list any]

12. LIVE-VERIFIED vs. MOCK-ONLY STATUS SUMMARY
    - Now live-verified with real data + working animation: [list]
    - Still mock/fixture-only: [list]
```

---

## 10. Explicit Non-Goals

This task must NOT attempt any of the following:

1. **Aftercare, cancellation, refund, or payment flows** — no post-booking operations of any kind.
2. **Real booking writes, even in sandbox** — no order creation, no payment processing, no ticket issuance, even if the sandbox technically allows it.
3. **A second Daytona sandbox** — exactly one sandbox, ever, this session.
4. **Multiple Search or Verify calls** — max 1 Search, max 1 Verify.
5. **Any rebuild of the existing capture/video pipeline** — no changes to `scripts/` video-related scripts, `skills/stitchcheck-demo-media/`, or any existing recording runbook.
6. **Any new fallback feature work** — Phase 8 is verification only; no new code for the fallback path.
7. **Synthetic or fabricated data in the live path** — if the real Atlas call fails, report the failure; do not substitute fake data.
8. **Changes to existing provenance labels** — the existing labels in `core/provenance/labels.ts` are not modified; only new labels are added.
9. **Changes to existing evidence files** — `app-fixture-contracts/stitchcheck-ui-demo-data.json`, `smoke-tests/atlas/fixtures/*.json`, `smoke-tests/nosana/fixtures/*.json`, `smoke-tests/gemini/fixtures/*` are all untouched.
10. **GitHub commit, push, or upload** — no version control operations.
11. **Modification of the existing video or demo assets** — no changes to any file in `skills/` or `output/`.
12. **Expansion of the animation scope beyond what is specified** — the animation visualizes the recovery-plan dependency graph; it does not become a general-purpose flight search UI.

---

*End of specification. Awaiting user approval before implementation.*
