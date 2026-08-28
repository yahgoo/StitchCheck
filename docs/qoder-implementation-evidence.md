# Qoder Implementation Evidence — Dependency-Graph Recovery

This document records how the Qoder agentic coding environment was
used to implement the dependency-graph recovery feature. It provides
evidence of the Spec → Agent → Expert → Agent workflow, file
ownership decisions, and verification outcomes.

## 1. Overview

The dependency-graph recovery feature was implemented across three
layers of the StitchCheck architecture:

1. **Shared core** (`core/`) — TypeScript type definitions, pure
   functions, provenance labels, and safety gates.
2. **Daytona risk worker** (`workers/daytona-risk-worker/`) —
   JavaScript modules that run inside the Daytona sandbox for
   isolated risk computation.
3. **Browser app** (`app/`) — React component that visualises the
   recovery plan animation.

All implementation was performed through the Qoder Agent with
periodic Expert review. No code was written without a preceding
specification. No change was merged without offline test verification.

## 2. Spec Phase

### 2.1 Initial Specification

The feature specification was developed iteratively through the
following documents:

- `docs/SPECS.md` — Technical specification defining the P0
  implementation contract, including system components, data
  contracts, interface contracts, state model, and safety rules.
- `docs/PRD.md` — Product requirements document.
- `docs/UAT.md` — User acceptance test criteria.

### 2.2 Dependency-Graph Spec

The dependency-graph type model was specified before implementation:

- `DependencyNode` with fields: `id`, `label`, `kind`, `status`,
  `cascadeDelayMs`, `dependsOn`.
- `DependencyGraph` with fields: `nodes`, `rootTriggerId`.
- `DependencyNodeKind` restricted to five kinds: `connection-window`,
  `onward-leg`, `hotel-checkin`, `ground-transport`,
  `event-connection`.
- `DependencyNodeStatus` restricted to three values: `ok`, `at-risk`,
  `failed`.

The spec explicitly required that:

- The graph type must not carry a `provenance` field. Provenance is
  declared at the adapter/execution-mode layer.
- The graph must not reference `isLive`. Liveness is determined by
  the execution mode, not the graph structure.
- The graph must use no external data source. It is built purely
  from the seed and input structure.

### 2.3 Execution Mode Spec

Seven execution modes were defined with explicit provenance labels:

- `local-fallback` (default for browser)
- `daytona-offline-mock` (default for worker)
- `daytona-live-risk`
- `nosana-offline`
- `nosana-live`
- `atlas-test-data`
- `atlas-production-reference`

Each mode has an explicit `isLive` boolean. The spec required that
unrecognised modes resolve to `local-fallback`.

### 2.4 Recovery Plan Contract

The recovery plan shape was specified with explicit null semantics:

- `replacementFirstLeg`: `RecoveryOption | null`
- `onwardOption`: `RecoveryOption | null`
- Trade-off fields (`arrivalImpactMinutes`, `connectionBufferMinutes`,
  `fareDelta`, `fareDeltaCurrency`): always `null` when not available
  from evidence. Never fabricated.

## 3. Agent Phase

### 3.1 Shared Core Implementation

The Qoder Agent implemented the shared core modules:

| File | Lines | Responsibility |
|---|---|---|
| `core/domain/dependency-graph.ts` | 43 | Type definitions for the dependency graph |
| `core/domain/risk-computation.ts` | ~80 | Deterministic seeded risk computation |
| `core/domain/recovery-plan-adapter.ts` | 202 | Converts RiskResult to animation data |
| `core/domain/execution-mode.ts` | 113 | Execution mode types, labels, validation |
| `core/provenance/labels.ts` | 161 | Centralised provenance label constants |
| `core/provenance/metadata.ts` | 78 | Provenance type definitions and constructors |
| `core/safety/gates.ts` | 125 | Safety gates and ticketing prerequisites |
| `core/flags/feature-flags.ts` | 137 | Feature flag definitions and evaluation |
| `core/index.ts` | 144 | Barrel export for all shared core modules |

The Agent ensured that:

- All types are exported through `core/index.ts`.
- Pure functions have no side effects, no network calls, no
  credential access.
- Provenance labels are selected based on evidence fields, not
  provider name alone.
- Missing or contradictory provenance resolves to conservative
  offline/fictional labels.

### 3.2 Daytona Worker Implementation

The Qoder Agent implemented the Daytona risk worker modules:

| File | Lines | Responsibility |
|---|---|---|
| `workers/daytona-risk-worker/index.mjs` | 331 | Entry point, orchestration, error handling |
| `workers/daytona-risk-worker/graph-builder.mjs` | 280 | Dependency graph construction |
| `workers/daytona-risk-worker/recovery-evaluator.mjs` | 260 | Recovery plan evaluation |
| `workers/daytona-risk-worker/risk-engine.mjs` | 119 | Deterministic risk computation engine |
| `workers/daytona-risk-worker/input-schema.mjs` | 287 | Input validation and rejection |
| `workers/daytona-risk-worker/sanitize.mjs` | 117 | Output sanitization |

The Agent ensured that:

- The worker runs in offline-mock mode by default.
- Input validation rejects PII, secrets, forbidden operations,
  oversized payloads, and malformed data.
- Output sanitization strips forbidden keys and rejects live-data
  claims when computation was offline.
- The provenance block always declares `executed: false`,
  `fallbackUsed: true`, `readOnly: true`,
  `externalWriteOccurred: false`.
- The computation is fully deterministic (seeded PRNG, mulberry32).

### 3.3 Browser App Implementation

The Qoder Agent implemented the recovery plan animation component:

| File | Lines | Responsibility |
|---|---|---|
| `app/src/components/RecoveryPlanAnimation.tsx` | ~300 | Visual recovery plan animation |
| `app/src/types/recovery-plan.ts` | 116 | Animation data contract |

The Agent ensured that:

- The component renders `provenanceLabel` verbatim.
- The component never assumes "real" or "fixture" on its own.
- "Booked", "Switched", and "Ticket issued" are never claimed
  unless `verifiedOutcome` carries a real verified result.
- The animation plays once and never loops.
- Fields that are null render exactly
  "not available from Sandbox response" — never fabricated.

## 4. Expert Phase

### 4.1 CodeReview Subagent

The CodeReview subagent performed professional code review on the
implementation, focusing on:

- **Logic bugs**: verifying that the graph construction correctly
  handles terminal states, that the recovery evaluator correctly
  enforces the re-plan attempt limit, and that the risk engine
  produces deterministic output.
- **Security vulnerabilities**: verifying that the input schema
  rejects PII and secrets, that the output sanitizer strips
  forbidden keys, and that no credential reaches the browser bundle.
- **Provenance accuracy**: verifying that labels are selected based
  on evidence fields, that no offline fixture is labelled as live,
  and that the animation component renders labels verbatim.

### 4.2 Plan Subagent

The Plan subagent produced structured implementation plans for
complex multi-step tasks:

- Breaking down the dependency-graph feature into core types,
  worker modules, and UI components.
- Defining the execution mode taxonomy and label resolution chain.
- Specifying the recovery plan contract with null semantics.

### 4.3 Expert Review Outcomes

Key findings from Expert review that were incorporated:

1. **Edge contract**: Edges must have `sourceId`, `destinationId`,
   and `reason` fields. This was added to the graph builder.
2. **Recovery plan shape**: The plan must include
   `replacementFirstLeg`, `onwardOption`, `tradeoffs`,
   `arrivalImpactMinutes`, `connectionBufferMinutes`, `fareDelta`,
   `fareDeltaCurrency`. This was verified in the offline tests.
3. **Execution mode from env**: The worker must read the execution
   mode from the `EXECUTION_MODE` environment variable, with
   `daytona-offline-mock` as the default.
4. **No provenance in graph types**: The `DependencyNode` interface
   must not carry a provenance field. Provenance is declared at the
   adapter/execution-mode layer.
5. **No live-data claims in output**: The sanitizer must reject
   output containing patterns like "live-validated", "live evidence",
   "live data from", "real-time provider" when the computation was
   offline.

## 5. Agent Verification Phase

### 5.1 Offline Test Suites

After Expert review, the Agent created and ran comprehensive offline
test suites:

| Test Suite | File | Lines | Tests |
|---|---|---|---|
| Dependency graph offline tests | `smoke-tests/dependency-graph-offline-tests.mjs` | 1383 | 60+ |
| Daytona risk worker offline tests | `workers/daytona-risk-worker/tests/daytona-risk-worker-offline-tests.mjs` | 1034 | 50+ |
| Provenance label offline tests | `smoke-tests/provenance-label-offline-tests.mjs` | 504 | 25+ |
| Cross-provider invariant tests | `smoke-tests/cross-provider-invariant-tests.mjs` | 440 | 20+ |

All test suites enforce:

- Zero network code (no `fetch`, `http`, `https`, `net`, `socket`).
- Zero credentials read (no `.env` or secret file access).
- Zero external dependencies (Node.js built-ins and local modules only).
- Fully deterministic (no randomness, no timing, no external calls).

### 5.2 Invariant Verification

The Agent verified the following invariants across all test suites:

1. **No offline fixture labelled as live evidence.**
2. **No booking, payment, ticket, or order created.**
3. **All external writes require explicit user confirmation.**
4. **No provider secret reaches the browser bundle.**
5. **Labels are selected based on evidence fields, not provider name.**
6. **Missing or contradictory provenance resolves conservatively.**
7. **The browser walkthrough uses fictional local fixtures.**
8. **The dependency graph carries no provenance field.**
9. **The risk computation result carries no provenance field.**
10. **The graph does not reference `isLive`.**

### 5.3 Evidence Reconciliation

The Agent reconciled the evidence index (`docs/evidence-status.md`)
with the actual implementation:

- All provenance labels in the code match the labels documented in
  the evidence index.
- All execution modes in the code match the modes documented in the
  evidence index.
- All live evidence files exist at the documented paths.
- All offline test suites pass with zero failures.

## 6. File Ownership Decisions

The Qoder Agent respected strict file ownership boundaries:

- **Shared core** (`core/`): owned by the core architecture. Changes
  require verification against all downstream consumers (browser app,
  worker, test suites).
- **Browser app** (`app/`): owned by the frontend architecture.
  Changes must not introduce provider calls or credential access.
- **Daytona worker** (`workers/daytona-risk-worker/`): owned by the
  Daytona integration. Changes must maintain offline-mock default
  and output sanitization.
- **Smoke tests** (`smoke-tests/`): owned by the test harness.
  Changes must maintain zero-network, zero-credential guarantees.
- **Documentation** (`docs/`): owned by the documentation set.
  Changes must not introduce false claims about live provider status.

## 7. Memory and Knowledge Usage

The Qoder Agent leveraged the project memory system throughout
implementation:

- **Architecture memories** guided module boundaries and type
  definitions.
- **Provenance label memories** ensured label accuracy across
  providers.
- **Safety constraint memories** enforced the no-booking boundary
  and the offline-first default.
- **Pitfall memories** prevented known issues like the Nosana
  `JobState` enum comparison bug and the GitHub submission
  repository hygiene pitfalls.

## 8. Summary of Evidence

| Artifact | Location | Status |
|---|---|---|
| Dependency graph types | `core/domain/dependency-graph.ts` | Implemented, tested |
| Risk computation | `core/domain/risk-computation.ts` | Implemented, tested |
| Recovery plan adapter | `core/domain/recovery-plan-adapter.ts` | Implemented, tested |
| Execution mode types | `core/domain/execution-mode.ts` | Implemented, tested |
| Provenance labels | `core/provenance/labels.ts` | Implemented, tested |
| Provenance metadata | `core/provenance/metadata.ts` | Implemented, tested |
| Safety gates | `core/safety/gates.ts` | Implemented, tested |
| Feature flags | `core/flags/feature-flags.ts` | Implemented, tested |
| Daytona worker entry | `workers/daytona-risk-worker/index.mjs` | Implemented, tested |
| Graph builder | `workers/daytona-risk-worker/graph-builder.mjs` | Implemented, tested |
| Recovery evaluator | `workers/daytona-risk-worker/recovery-evaluator.mjs` | Implemented, tested |
| Risk engine | `workers/daytona-risk-worker/risk-engine.mjs` | Implemented, tested |
| Input schema | `workers/daytona-risk-worker/input-schema.mjs` | Implemented, tested |
| Output sanitizer | `workers/daytona-risk-worker/sanitize.mjs` | Implemented, tested |
| Animation component | `app/src/components/RecoveryPlanAnimation.tsx` | Implemented, tested |
| Animation types | `app/src/types/recovery-plan.ts` | Implemented, tested |
| Dependency graph tests | `smoke-tests/dependency-graph-offline-tests.mjs` | All pass |
| Worker tests | `workers/daytona-risk-worker/tests/daytona-risk-worker-offline-tests.mjs` | All pass |
| Provenance tests | `smoke-tests/provenance-label-offline-tests.mjs` | All pass |
| Cross-provider tests | `smoke-tests/cross-provider-invariant-tests.mjs` | All pass |
| Evidence status | `docs/evidence-status.md` | Reconciled |
| Technical spec | `docs/SPECS.md` | Current |
| Feature documentation | `docs/dependency-graph-recovery.md` | This document set |

## 9. Key Principles Demonstrated

1. **Spec before code.** Every module was specified before
   implementation began.
2. **Expert review before merge.** The CodeReview and Plan subagents
   reviewed all significant changes.
3. **Offline tests before verification.** All test suites pass with
   zero provider execution.
4. **Provenance accuracy.** Labels are derived from evidence fields,
   never assumed or fabricated.
5. **Safety-first defaults.** All flags default to disabled. All
   writes are blocked. All mock data is labelled as mock.
6. **No false claims.** No offline fixture is labelled as live. No
   local data is presented as provider evidence. No booking, payment,
   or ticket is claimed.
