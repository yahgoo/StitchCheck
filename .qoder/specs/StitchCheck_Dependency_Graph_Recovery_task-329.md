
# StitchCheck Dependency-Graph Recovery — Implementation Specification

---

## 1. Product Goal

StitchCheck helps a traveller understand whether a self-transfer itinerary is fragile before making a commitment. The new feature adds a **dependency-graph recovery animation** driven by **deterministic risk computation executed in an isolated Daytona sandbox**, showing how a single delayed leg cascades across the entire trip, then collapsing candidate alternatives into one explainable recovery plan — while keeping the traveller in control.

Classification: **CONFIRMED**

---

## 2. Problem Statement

A disrupted self-transfer is not one missed flight; it is a chain reaction across the traveller's entire trip. The current StitchCheck UI shows risk and alternatives as static panels. It does not visualize:

- The causal dependency between legs, connections, and downstream commitments.
- How a delay on the first leg propagates.
- How candidate recovery options are evaluated and collapsed into one plan.
- The provenance of the computation (Daytona sandbox vs. fixture vs. Atlas).

Classification: **CONFIRMED**

---

## 3. Target User and Business Value

- **Target user**: A leisure or business traveller booking a self-transfer itinerary (e.g. two separate tickets with a connection) who needs to understand the risk before committing.
- **Business value**: Differentiates the hackathon entry by demonstrating Daytona as isolated disposable execution, Nosana as optional batch analysis, Atlas as travel evidence, and StitchCheck as human-controlled decision support.

Classification: **CONFIRMED**

---

## 4. Current Product Capabilities

Existing codebase already provides:

| Capability | Location | Status |
|---|---|---|
| Itinerary extraction (fixture) | `app/src/data/fixtures.ts`, `core/domain/itinerary.ts` | CONFIRMED |
| Risk result model | `core/domain/risk.ts` | CONFIRMED — needs extension |
| RecoveryPlanAnimation component | `app/src/components/RecoveryPlanAnimation.tsx` | CONFIRMED — needs extension |
| Recovery plan type contract | `app/src/types/recovery-plan.ts` | CONFIRMED — needs extension |
| Daytona orchestrator (mock mode) | `scripts/daytona-orchestrator.mjs` | CONFIRMED — needs repurposing |
| Daytona worker (Atlas search/verify) | `workers/daytona-atlas-worker/` | CONFIRMED — will remain but not be claimed as risk compute |
| Feature flags | `core/flags/feature-flags.ts` | CONFIRMED — needs new flags |
| Evidence envelopes | `core/contracts/envelopes.ts` | CONFIRMED — needs new envelope type |
| Provenance labels | `core/provenance/labels.ts` | CONFIRMED — needs new labels |
| Safety gates | `core/safety/gates.ts` | CONFIRMED |
| Simulation state machine | `core/simulation/ticketing.ts` | CONFIRMED |
| Nosana fixtures and offline tests | `smoke-tests/nosana/` | CONFIRMED |
| App step flow | `app/src/App.tsx` | CONFIRMED — needs new steps |

Classification: **CONFIRMED**

---

## 5. New Dependency-Graph Recovery Experience

### 5.1 Dependency Graph Model

A new typed model in `core/domain/dependency-graph.ts`:

```typescript
export type NodeType = 'flight-leg' | 'connection-window' | 'onward-flight' | 'hotel-checkin' | 'commitment';
export type NodeStatus = 'ok' | 'at-risk' | 'disrupted' | 'resolved';

export interface DependencyNode {
  id: string;
  type: NodeType;
  label: string;
  status: NodeStatus;
  cascadeOrder: number;
  dependencyReason: string;
  downstreamOf: string[];  // IDs of upstream nodes
}

export interface DependencyEdge {
  from: string;
  to: string;
  reason: string;
}

export interface DependencyGraph {
  graphId: string;
  itineraryId: string;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  computedAt: string;  // ISO-8601
  source: 'daytona-risk-compute' | 'local-fallback';
}
```

### 5.2 Risk Compute Result (extended)

Extend `core/domain/risk.ts` to add:

```typescript
export interface RiskComputeResult {
  resultId: string;
  dependencyGraph: DependencyGraph;
  riskBand: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;  // 0-100
  scoreInterpretation: string;
  scenariosEvaluated: number;
  delayDistribution: string;  // e.g. "normal, mean=45min, sd=20min"
  assumptions: string[];
  constraintViolations: string[];
  recoveryPlan: RecoveryPlanResult | null;
  rePlanAttemptCount: number;
  maxRePlanAttempts: 2;
  executionEnvironment: 'daytona-sandbox' | 'local-fallback';
  executionTimestamp: string;
  timeoutMs: number;
  latencyMs: number;
  failureState: null | 'timeout' | 'error' | 'no-safe-plan';
  provenance: RiskComputeProvenance;
}

export interface RecoveryPlanResult {
  replacementFirstLeg: RecoveryOption | null;
  onwardOption: RecoveryOption | null;
  affectedDownstreamCommitments: string[];
  arrivalImpactMinutes: number | null;
  connectionBufferMinutes: number | null;
  fareDelta: number | null;
  currency: string | null;
  constraintsSatisfied: string[];
  tradeoffs: string[];
}

export interface RiskComputeProvenance {
  provider: 'daytona' | 'local-fallback';
  executionEnvironment: string;
  dataSource: 'daytona-risk-compute' | 'local-fixture' | 'local-fallback';
  classification: 'isolated-sandbox' | 'local-deterministic';
  timestamp: string;
  externalWriteOccurred: false;  // always false, hard-coded
  sandboxDestroyed: boolean;
  resultSanitized: boolean;
}
```

### 5.3 Daytona Risk Worker

A new worker script at `workers/daytona-risk-worker/` that:

- Receives the confirmed itinerary (no PII, no credentials).
- Runs a bounded deterministic risk computation (reuse Monte Carlo shape from existing `core/domain/risk.ts` patterns).
- Builds the dependency graph.
- Evaluates candidate recovery options against constraints.
- Returns a `RiskComputeResult` envelope.

The worker is uploaded to a fresh Daytona sandbox, executed with resource limits, output downloaded, and sandbox destroyed.

Classification: **ASSUMED** — Daytona SDK is available (`@daytona/sdk` in `package.json`); the risk computation logic is simple deterministic math, not a complex solver.

---

## 6. Daytona Architecture

### 6.1 Role

Daytona = isolated, disposable execution for one traveller's risk computation.

```
local orchestrator
  -> upload confirmed itinerary + risk parameters
  -> create Daytona sandbox
  -> execute risk computation worker
  -> download sanitized result
  -> destroy sandbox with wait=true
```

### 6.2 Constraints (hard, code-enforced)

- Read-only workload; no outbound network except explicit allowlist.
- Bounded: CPU=1, memory=2GB, timeout=120s, input size max 64KB.
- Deterministic for same input + seed.
- No credentials injected (the risk worker needs none).
- No passenger PII in input.
- Cannot create bookings, payments, orders, tickets, or supplier changes.
- `ATLAS_WRITES_ENABLED` is hard-coded `false` in the risk worker environment.

### 6.3 Lifecycle

1. Evaluate flags: `DAYTONA_RISK_COMPUTE_ENABLED` must be `true`.
2. Create sandbox with `ephemeral: true`, `ttlMinutes: 10`, no secrets.
3. Upload `workers/daytona-risk-worker/index.mjs` + `core/` subset.
4. Execute: `node /worker/index.mjs` with `timeout: 120000`.
5. Download `/worker/output/risk-result.json`.
6. Orchestrator-side sanitization pass (strip any forbidden keys).
7. Build `DaytonaRiskEnvelope`.
8. `client.delete(sandbox, { wait: true, timeout: 30 })`.
9. Write envelope to `app/public/daytona-risk-evidence.json`.

### 6.4 Existing Daytona orchestrator

The existing `scripts/daytona-orchestrator.mjs` manages Atlas search/verify workers. A **new** `scripts/daytona-risk-orchestrator.mjs` will be created for the risk computation lifecycle, reusing patterns (mock client, sanitization, envelope builders) but with a different worker and purpose.

The existing orchestrator and its worker remain unchanged to preserve the Atlas evidence path.

Classification: **CONFIRMED** (orchestrator pattern exists); **ASSUMED** (risk worker deterministic computation shape).

---

## 7. Nosana Architecture

### 7.1 Role (optional)

Nosana = larger, anonymized batch analysis across many delay scenarios. Not required for the primary demo flow.

```
anonymized itinerary constraints
  -> Nosana batch workload
  -> many bounded delay/baggage/immigration scenarios
  -> aggregate robustness result
```

### 7.2 Constraints

- Never: book, pay, issue tickets, choose supplier, decide refund, settle fare, override traveller confirmation.
- If not actually run: label as `"Nosana workload prepared and offline-validated -- no live job executed"`.
- No live Nosana result fabricated.

### 7.3 Existing Nosana code

The existing `smoke-tests/nosana/` directory already has fixtures, offline tests, and schema validators. The existing `loadNosanaRiskResult()` in `app/src/data/fixtures.ts` loads from `/nosana-risk-result.json`. This remains as-is for the primary flow.

An optional `scripts/nosana-batch-adapter.mjs` may be added as a nice-to-have.

Classification: **CONFIRMED** (existing code); **ASSUMED** (optional batch adapter is nice-to-have).

---

## 8. Atlas Boundary

- Atlas remains separate from Daytona.
- Atlas evidence may provide route/search/offer/verification data when available through an approved path.
- Atlas Sandbox data labelled as test/simulated: `"Atlas Sandbox test data -- read-only; not production availability"`.
- If Atlas was not executed in the current run, its results are not shown as current evidence.
- The existing `workers/daytona-atlas-worker/` and `scripts/daytona-orchestrator.mjs` remain for the Atlas evidence path.

Classification: **CONFIRMED**

---

## 9. End-to-End User Journey

The updated App step flow:

```
safety-notice
  -> upload            (screenshot selection)
  -> review            (itinerary correction)
  -> confirmed         (traveller confirms itinerary)
  -> risk-computing    (NEW: Daytona sandbox risk computation in progress)
  -> recovery          (NEW: dependency-graph recovery animation + plan review)
  -> decision          (Keep/Switch decision with confirmation)
```

New steps `risk-computing` and `recovery` are inserted between `confirmed` and the existing decision panels. The existing `RiskPanel`, `AlternativesPanel`, `ComparisonView`, `SimulationPanel`, and `DecisionPanel` remain in the `recovery` step.

Classification: **ASSUMED** — step naming; **CONFIRMED** — overall flow shape.

---

## 10. Animation State Machine

The `RecoveryPlanAnimation` component already exists at `app/src/components/RecoveryPlanAnimation.tsx`. It needs to be extended to support the full 12-state machine from the spec:

| State | Current | Action |
|---|---|---|
| `idle` | Partial (via `trigger` phase) | Rename/add explicit idle state |
| `delay-triggered` | `trigger` phase | Already exists |
| `cascade-evaluating` | `cascade` phase | Already exists |
| `candidates-visible` | `candidates` phase | Already exists |
| `plan-collapsing` | `collapse` phase | Already exists |
| `recommended-plan` | Part of `done` | Extract as explicit state |
| `review-recovery-plan` | In `confirmationPhase` | Already exists |
| `confirm-switch-request` | In `confirmationPhase` | Already exists |
| `request-submitted` | In `confirmationPhase` | Already exists |
| `verified-outcome` | In `confirmationPhase` | Already exists |
| `no-safe-plan` | `isTerminalNoPlan` | Already exists |
| `error` | Missing | Add new error state |

### Changes to `RecoveryPlanAnimation.tsx`:

1. Add `error` state rendering.
2. Add `constraintsSatisfied` display in the recommended plan section (at least 3 constraints from computation).
3. Wire the component to accept the new `RiskComputeResult` via a normalized adapter, not just the existing `RecoveryPlanAnimationData`.
4. Add a "Re-plan attempt" counter display (already partially present).
5. Ensure the freshness badge says `"Risk computation completed in isolated Daytona sandbox"` for Daytona results, with a separate Atlas label only when Atlas supplied evidence.

### New adapter component

Create `app/src/components/RecoveryPlanFromRiskResult.tsx` that:
- Accepts a `RiskComputeResult` prop.
- Maps it to `RecoveryPlanAnimationData`.
- Passes it to `RecoveryPlanAnimation`.

This keeps the animation component pure (data-in, no fetching).

Classification: **CONFIRMED** (component exists); **ASSUMED** (extension shape).

---

## 11. Data Model

### 11.1 New files in `core/domain/`

- `dependency-graph.ts` — `DependencyGraph`, `DependencyNode`, `DependencyEdge` types.
- `risk-compute.ts` — `RiskComputeResult`, `RecoveryPlanResult`, `RiskComputeProvenance` types.

### 11.2 New envelope in `core/contracts/`

Extend `core/contracts/envelopes.ts` with:

```typescript
export interface DaytonaRiskEnvelope {
  envelopeVersion: 1;
  correlationId: string;
  sandboxId: string;
  createdAt: string;
  destroyedAt: string | null;
  riskResult: RiskComputeResult;
  provenance: DaytonaRiskProvenance;
  sanitized: true;
}

export interface DaytonaRiskProvenance {
  provider: 'daytona';
  executionEnvironment: 'daytona-sandbox';
  dataSource: 'daytona-risk-compute';
  classification: 'isolated-sandbox';
  timestamp: string;
  externalWriteOccurred: false;
  sandboxDestroyed: boolean;
  resultSanitized: boolean;
  label: string;
}
```

### 11.3 Update `core/index.ts`

Export all new types and constructors.

Classification: **ASSUMED** — exact type shapes are design decisions.

---

## 12. Provenance and Evidence Model

### 12.1 Evidence boundaries (preserved from spec)

```
Fictional itinerary — local demo fixture
Fictional alternatives — local demo fixture
OpenRouter temporary path — not direct Gemini validation
Atlas Sandbox test data — read-only; not production availability
Atlas production search — reference prices only
Nosana workload prepared and offline-validated — no live job executed
Daytona risk computation — isolated sandbox execution
```

### 12.2 New provenance labels

Add to `core/provenance/labels.ts`:

```typescript
export const DAYTONA_RISK_LABELS = {
  'success': 'Daytona risk computation — isolated sandbox execution',
  'fallback': 'Daytona sandbox unavailable — local risk fallback used',
  'destroyed': 'Risk computation completed in isolated Daytona sandbox — sandbox destroyed',
} as const;
```

### 12.3 Never merge evidence sources

Each result object carries its own provenance. The UI renders labels per-source, never a blended label.

Classification: **CONFIRMED**

---

## 13. Safety and Write Restrictions

### 13.1 Hard-coded write block

In `core/safety/gates.ts`, the existing `assertWriteBlocked()` already prevents write operations. Add:

```typescript
export function assertRiskComputeReadOnly(env: Record<string, string | undefined>): void {
  if (env.ATLAS_WRITES_ENABLED === 'true') {
    throw new SafetyGateError('ATLAS_WRITES_ENABLED must be false for risk computation');
  }
}
```

### 13.2 Confirmation buttons

The existing component already uses safe button text. Verify:
- "Request switch" (not "Book now", "Pay now", etc.)
- "Keep original itinerary" (not "Switch completed")
- Post-confirmation: "Request submitted -- awaiting verified supplier outcome"

These are already correct in the existing `RecoveryPlanAnimation.tsx`.

### 13.3 `externalWriteOccurred` always false

The `DaytonaRiskProvenance.externalWriteOccurred` field is typed as the literal `false`. The worker and orchestrator never set it to `true`. This is enforced by the TypeScript type system.

Classification: **CONFIRMED**

---

## 14. Failure-Mode Handling

### 14.1 Infinite loop protection

- `maxRePlanAttempts: 2` is already in the `RecoveryPlanAnimationData` type.
- The component already stops after `isTerminalNoPlan` and never loops.
- The risk compute worker enforces the same limit server-side.

### 14.2 Stale data

- Freshness badge shows `freshnessTimestamp` from the computation.
- Provenance label identifies the source (Daytona, Atlas, fixture, Nosana).
- If no fresh provider evidence exists, the UI says so.

### 14.3 False success

- After confirmation, always show: `"Request submitted -- awaiting verified supplier outcome"` unless `verifiedOutcome` is non-null.
- The existing component already implements this correctly.

### 14.4 Error state

Add a new `error` animation state that renders:
```
Risk computation encountered an error — local fallback displayed
```
with the provenance label showing the fallback source.

Classification: **CONFIRMED** (existing protections); **ASSUMED** (error state design).

---

## 15. Feature Flags

### 15.1 New flags to add to `core/flags/feature-flags.ts`

```typescript
export interface FeatureFlags {
  // Existing
  DAYTONA_ENABLED: boolean;
  ATLAS_LIVE_READ_ONLY: boolean;
  ATLAS_WRITES_ENABLED: boolean;
  ATLAS_TICKETING_SIMULATION_ENABLED: boolean;
  DEMO_MODE: DemoMode;
  // New
  DAYTONA_RISK_COMPUTE_ENABLED: boolean;
  NOSANA_ENABLED: boolean;
  NOSANA_LIVE_ENABLED: boolean;
}
```

### 15.2 Defaults (all disabled)

```typescript
DAYTONA_RISK_COMPUTE_ENABLED: false,
NOSANA_ENABLED: false,
NOSANA_LIVE_ENABLED: false,
```

### 15.3 Hard-disabled writes

`ATLAS_WRITES_ENABLED` is hard-disabled in the risk worker environment (not passed to the sandbox at all). The orchestrator asserts `assertRiskComputeReadOnly()` before creating the sandbox.

Classification: **CONFIRMED**

---

## 16. Daytona Sandbox Lifecycle

### 16.1 Configuration

```typescript
const RISK_SANDBOX_CONFIG = Object.freeze({
  language: 'javascript',
  image: 'node:20-slim',
  resources: { cpu: 1, memory: 2 },       // GB
  maxInputSizeKB: 64,
  maxOutputSizeKB: 256,
  processTimeoutMs: 120_000,
  ttlMinutes: 10,
  ephemeral: true,
  autoStopInterval: 5,
  autoDeleteInterval: 0,
  createTimeoutS: 90,
  deleteTimeoutS: 30,
  networkPolicy: 'blocked',               // no outbound network for risk compute
  domainAllowList: [],                     // empty — risk compute is offline
});
```

### 16.2 Cleanup guarantees

- `finally` block always calls `client.delete(sandbox, { wait: true, timeout: 30 })`.
- TTL provides a safety net (10-minute hard limit).
- Sandbox ID is redacted in UI display (show only first 8 chars).
- No credential injection: the `secrets` field is omitted from `client.create()`.

### 16.3 Sanitization

Two-pass: worker-side + orchestrator-side, using the existing `sanitizeOutput()` pattern from `scripts/daytona-orchestrator.mjs`.

Classification: **ASSUMED** — exact resource limits; **CONFIRMED** — lifecycle pattern (existing orchestrator).

---

## 17. Nosana Adapter Lifecycle

### 17.1 Optional adapter (nice-to-have)

A new `scripts/nosana-batch-adapter.mjs` that:
- Accepts normalized batch input (anonymized itinerary constraints).
- Bounded scenario count (max 100).
- Timeout: 300s.
- Cost ceiling: configurable, default $5.
- Result normalization to `NosanaBatchResult`.
- No write capabilities.
- Explicit live/offline status label.

### 17.2 Not a dependency

The primary demo flow does not require Nosana. If `NOSANA_ENABLED=false`, the UI shows the Nosana panel as "offline capability — not executed".

Classification: **CONFIRMED**

---

## 18. UI/Component Design

### 18.1 New components

| Component | File | Purpose |
|---|---|---|
| `RiskComputePanel` | `app/src/components/RiskComputePanel.tsx` | Shows Daytona sandbox lifecycle status, risk result, dependency graph summary |
| `RecoveryPlanFromRiskResult` | `app/src/components/RecoveryPlanFromRiskResult.tsx` | Adapter: maps `RiskComputeResult` to `RecoveryPlanAnimationData` |
| `DependencyGraphView` | `app/src/components/DependencyGraphView.tsx` | Visual graph of nodes and edges with cascade animation |
| `ProvenanceBadge` | `app/src/components/ProvenanceBadge.tsx` | Renders provenance label with classification badge |

### 18.2 Modified components

| Component | Changes |
|---|---|
| `RecoveryPlanAnimation` | Add `error` state, `constraintsSatisfied` display, accept extended data |
| `App.tsx` | Add `risk-computing` and `recovery` steps, wire risk computation flow |
| `StatusBanner` | Already sufficient |

### 18.3 App flow wiring

In `App.tsx`, after `handleConfirm`:
1. Set step to `risk-computing`.
2. Call `runRiskComputation()` (fetches `/daytona-risk-evidence.json` or uses local fallback).
3. On completion, set step to `recovery`.
4. Pass `RiskComputeResult` to `RecoveryPlanFromRiskResult`.
5. Existing panels (Risk, Alternatives, Comparison, Decision) render below the animation.

Classification: **ASSUMED** — component names and exact wiring.

---

## 19. Accessibility and Video-Capture Requirements

- All graph nodes have text labels (not color-only). The existing component already uses `aria-label` and text labels alongside color.
- `role="status"` and `role="alert"` used for dynamic state changes (already present).
- Animation plays once, never loops (already enforced).
- `data-demo-ready` attribute for capture tooling (already present in `App.tsx`).
- Cascade animation has staggered delays suitable for screen capture (already implemented).

Classification: **CONFIRMED**

---

## 20. Offline Test Plan

### 20.1 New test files

| Test | File |
|---|---|
| Dependency graph model tests | `smoke-tests/core/dependency-graph-offline-tests.mjs` |
| Risk compute result shape tests | `smoke-tests/core/risk-compute-offline-tests.mjs` |
| Daytona risk orchestrator offline tests | `scripts/daytona-risk-orchestrator-offline-tests.mjs` |
| Recovery plan adapter tests | `smoke-tests/ui/recovery-plan-adapter-offline-tests.mjs` |
| Provenance label assertion tests | `smoke-tests/core/provenance-label-assertion-tests.mjs` |

### 20.2 Existing tests preserved

All existing tests in `app/package.json` `verify:offline` script continue to pass. The new tests are appended.

### 20.3 Update `verify:offline`

Add new test commands to the `verify:offline` script in `app/package.json`.

Classification: **ASSUMED** — test file names.

---

## 21. Daytona Integration Test Boundary

- The Daytona risk orchestrator offline tests use the mock client (same pattern as existing `scripts/daytona-orchestrator-offline-tests.mjs`).
- No real sandbox is created in tests.
- Tests verify: envelope shape, sanitization, fallback behavior, flag evaluation, cleanup guarantees.

Classification: **CONFIRMED**

---

## 22. Nosana Live-Execution Boundary

- Nosana live execution is gated by `NOSANA_LIVE_ENABLED`.
- Default is `false`. When false, the UI shows the offline label.
- No live Nosana job is executed during the demo unless explicitly enabled.

Classification: **CONFIRMED**

---

## 23. Acceptance Criteria

1. A typed `DependencyGraph` model exists in `core/domain/` and is exported from `core/index.ts`.
2. A typed `RiskComputeResult` model exists and carries full provenance.
3. The Daytona risk orchestrator creates a sandbox (mock in tests), uploads the worker, downloads the result, sanitizes, and destroys the sandbox.
4. The `RecoveryPlanAnimation` component renders all 12 states including `error`.
5. The animation is driven by structured data, not chatbot narrative.
6. Provenance labels are rendered verbatim; the component never fabricates them.
7. "Book now", "Pay now", "Confirm booking", "Switch completed" never appear in the UI.
8. After confirmation, "Request submitted -- awaiting verified supplier outcome" is shown unless a verified outcome exists.
9. Re-plan attempt counter shows max 2 attempts, then terminal state.
10. All write flags are hard-disabled in code.
11. `verify:offline` passes with all new tests.
12. Feature flags default to all-disabled.
13. No credentials are injected into the risk sandbox.
14. Sandbox ID is redacted in UI display.
15. The demo flows end-to-end with fixture data when Daytona is disabled.

Classification: **CONFIRMED**

---

## 24. Demo Script

Three-minute demo narration:

1. Show flight screenshot and confirmed itinerary.
2. Traveller corrects a field.
3. First leg becomes delayed/risk-triggered (simulated).
4. Downstream dependency nodes turn red one by one (cascade animation).
5. Daytona performs isolated risk computation (show sandbox lifecycle: created -> computing -> destroyed).
6. Multiple candidates appear, then collapse into one constraint-satisfying recovery plan.
7. Traveller reviews the plan (constraints satisfied, trade-offs, missing values marked).
8. Traveller confirms switch request.
9. UI shows "Request submitted -- awaiting verified supplier outcome" (no booking/payment claimed).
10. Sandbox destruction and provenance state displayed.
11. Nosana shown only as optional batch-analysis capability (offline label).

Suggested narration:
> "A disrupted self-transfer is not one missed flight. It is a chain reaction across the traveller's entire trip. StitchCheck evaluates that dependency graph in an isolated Daytona sandbox, then presents one explainable recovery plan while keeping the traveller in control. For larger resilience studies, the same anonymized scenario model can be dispatched to Nosana -- but no provider is allowed to commit a booking or payment without explicit human authorization."

Classification: **CONFIRMED**

---

## 25. Evidence/Qoder Usage Plan

- All fixture data is local; no external API calls during the demo.
- Daytona evidence is generated by the mock orchestrator (offline).
- Atlas evidence is from existing fixtures (offline).
- Nosana evidence is from existing fixtures (offline).
- No Gemini/OpenRouter calls during the demo flow.

Classification: **CONFIRMED**

---

## 26. Must-Do Scope

Prioritized:

1. Typed dependency-graph model (`core/domain/dependency-graph.ts`).
2. Deterministic risk computation result type (`core/domain/risk-compute.ts`).
3. Daytona risk orchestrator with mock client (`scripts/daytona-risk-orchestrator.mjs`).
4. Daytona risk worker (`workers/daytona-risk-worker/index.mjs`).
5. Recovery-plan animation extensions (error state, constraints display).
6. `RecoveryPlanFromRiskResult` adapter component.
7. Provenance labels for risk computation (`core/provenance/labels.ts`).
8. Confirmation/outcome safety states (verify existing + add missing).
9. Feature flag additions (`DAYTONA_RISK_COMPUTE_ENABLED`, `NOSANA_ENABLED`, `NOSANA_LIVE_ENABLED`).
10. Offline tests for all new modules.
11. App.tsx wiring for `risk-computing` and `recovery` steps.
12. One clean demo path end-to-end with fixture data.

Classification: **CONFIRMED**

---

## 27. Nice-to-Have Scope

If time remains:

- Optional Nosana batch adapter (`scripts/nosana-batch-adapter.mjs`).
- "Why this plan wins" constraint drawer in the animation.
- Richer graph visualization (SVG-based `DependencyGraphView`).
- Additional accessibility polish (keyboard navigation for confirmation buttons).
- Live Atlas evidence adapter outside Daytona, only if independently verified.

Classification: **CONFIRMED**

---

## 28. Explicit Non-Goals

- Atlas Skill inside Daytona.
- Headless keyring workarounds.
- Browser authorization bypass.
- Direct undocumented Atlas API.
- Booking, payment, ticket issuance, refund/cancellation, autonomous fare settlement.
- Broad multi-agent architecture.
- Second Daytona sandbox.
- Synthetic data presented as live.
- Replacement of the existing video pipeline.
- Removal of provenance labels.
- Any secret exposure.

Classification: **CONFIRMED**

---

## 29. Open Questions

| # | Question | Classification |
|---|---|---|
| 1 | Should the risk computation use a seeded PRNG for deterministic Monte Carlo, or pure heuristic? | UNKNOWN |
| 2 | Should the `DependencyGraphView` use SVG or CSS-based layout? | UNKNOWN |
| 3 | Should the Daytona risk worker share code with the existing Atlas worker, or be fully independent? | UNKNOWN |
| 4 | Is the 10-minute sandbox TTL sufficient for the risk computation? | ASSUMED (yes, computation is bounded) |

---

## 30. Implementation Milestones

### Milestone 1: Core Domain Models (est. 1 hour)

- Create `core/domain/dependency-graph.ts` with types.
- Create `core/domain/risk-compute.ts` with types.
- Update `core/domain/index.ts` barrel export.
- Update `core/index.ts` barrel export.

### Milestone 2: Feature Flags (est. 30 min)

- Add `DAYTONA_RISK_COMPUTE_ENABLED`, `NOSANA_ENABLED`, `NOSANA_LIVE_ENABLED` to `core/flags/feature-flags.ts`.
- Update `ResolvedFlags` with derived booleans.
- Update `evaluateFlags()` constraints.

### Milestone 3: Provenance Labels (est. 30 min)

- Add `DAYTONA_RISK_LABELS` to `core/provenance/labels.ts`.
- Add `getDaytonaRiskLabel()` function.
- Export from `core/provenance/index.ts` and `core/index.ts`.

### Milestone 4: Contracts (est. 30 min)

- Add `DaytonaRiskEnvelope` and `DaytonaRiskProvenance` to `core/contracts/envelopes.ts`.
- Add `createDaytonaRiskFallbackEnvelope()` constructor.
- Export from `core/contracts/index.ts` and `core/index.ts`.

### Milestone 5: Daytona Risk Worker (est. 1.5 hours)

- Create `workers/daytona-risk-worker/index.mjs`.
- Implement deterministic risk computation (heuristic-based).
- Build dependency graph from itinerary input.
- Evaluate candidate recovery options.
- Write sanitized output to `/worker/output/risk-result.json`.

### Milestone 6: Daytona Risk Orchestrator (est. 1.5 hours)

- Create `scripts/daytona-risk-orchestrator.mjs`.
- Implement mock client (same pattern as existing).
- Implement full lifecycle: create, upload, execute, download, sanitize, destroy.
- Write envelope to `app/public/daytona-risk-evidence.json`.

### Milestone 7: Animation Extensions (est. 1 hour)

- Add `error` state to `RecoveryPlanAnimation.tsx`.
- Add `constraintsSatisfied` display.
- Update `RecoveryPlanAnimationData` type if needed.

### Milestone 8: Adapter Component (est. 1 hour)

- Create `app/src/components/RecoveryPlanFromRiskResult.tsx`.
- Map `RiskComputeResult` to `RecoveryPlanAnimationData`.
- Handle fallback case (no plan, error state).

### Milestone 9: RiskComputePanel (est. 1 hour)

- Create `app/src/components/RiskComputePanel.tsx`.
- Show sandbox lifecycle status.
- Show risk band, score, interpretation.
- Show provenance badge.

### Milestone 10: App.tsx Wiring (est. 1.5 hours)

- Add `risk-computing` and `recovery` steps.
- Wire risk computation trigger after confirmation.
- Load Daytona risk evidence or fallback.
- Pass data to new components.
- Update `verify:offline` script.

### Milestone 11: Offline Tests (est. 1.5 hours)

- Create `scripts/daytona-risk-orchestrator-offline-tests.mjs`.
- Create dependency graph model tests.
- Create risk compute result shape tests.
- Create recovery plan adapter tests.
- Append to `verify:offline`.

### Milestone 12: Integration and Demo Rehearsal (est. 1 hour)

- End-to-end walkthrough with fixture data.
- Verify all provenance labels render correctly.
- Verify no forbidden button text.
- Verify animation plays once, never loops.
- Verify sandbox lifecycle display.

**Total estimated effort: ~12 hours**

---

## Summary of File Changes

### New files (12)

| File | Purpose |
|---|---|
| `core/domain/dependency-graph.ts` | Dependency graph types |
| `core/domain/risk-compute.ts` | Risk compute result types |
| `workers/daytona-risk-worker/index.mjs` | Risk computation worker |
| `scripts/daytona-risk-orchestrator.mjs` | Risk sandbox lifecycle |
| `scripts/daytona-risk-orchestrator-offline-tests.mjs` | Orchestrator tests |
| `app/src/components/RecoveryPlanFromRiskResult.tsx` | Adapter component |
| `app/src/components/RiskComputePanel.tsx` | Risk compute UI panel |
| `app/src/components/DependencyGraphView.tsx` | Graph visualization (nice-to-have) |
| `app/src/components/ProvenanceBadge.tsx` | Provenance badge component |
| `smoke-tests/core/dependency-graph-offline-tests.mjs` | Model tests |
| `smoke-tests/core/risk-compute-offline-tests.mjs` | Result shape tests |
| `app-fixture-contracts/risk-compute-fixture.json` | Fixture data for demo |

### Modified files (7)

| File | Changes |
|---|---|
| `core/domain/index.ts` | Add new type exports |
| `core/index.ts` | Add new exports |
| `core/flags/feature-flags.ts` | Add 3 new flags |
| `core/provenance/labels.ts` | Add risk labels |
| `core/contracts/envelopes.ts` | Add `DaytonaRiskEnvelope` |
| `app/src/components/RecoveryPlanAnimation.tsx` | Add error state, constraints display |
| `app/src/App.tsx` | Add new steps, wire risk computation |
| `app/package.json` | Update `verify:offline` script |
