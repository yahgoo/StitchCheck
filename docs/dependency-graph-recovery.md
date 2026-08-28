# Dependency-Graph Recovery Feature

This document describes the StitchCheck dependency-graph recovery feature,
its architecture, execution modes, provenance model, safety restrictions,
and current live-versus-mock status.

## 1. Product Purpose

StitchCheck helps budget travellers understand the risk of booking separate
flight tickets with tight connections. The product walks the user through:

1. Selecting a synthetic itinerary screenshot fixture (GEM-01 to GEM-05).
2. Reviewing and editing extracted fields (origin, destination, dates, etc.).
3. Explicitly confirming the itinerary to unlock downstream panels.
4. Viewing risk scores and alternative options.
5. Comparing and choosing **Keep** or **Switch**.

The application is a pure frontend React/Vite/TypeScript single-page
application. The browser makes zero direct network calls to external
providers. All provider interactions are handled through standalone
Node.js smoke-test scripts outside the browser app.

## 2. Dependency-Graph Explanation

### 2.1 Purpose

The dependency graph models how a delay to one flight leg cascades through
downstream itinerary items. Each node represents a downstream dependency
whose risk status depends on upstream delay propagation.

### 2.2 Type Model (shared core)

Defined in `core/domain/dependency-graph.ts` and exported through
`core/index.ts`:

| Type | Description |
|---|---|
| `DependencyNodeStatus` | `'ok' \| 'at-risk' \| 'failed'` |
| `DependencyNodeKind` | `'connection-window' \| 'onward-leg' \| 'hotel-checkin' \| 'ground-transport' \| 'event-connection'` |
| `DependencyNode` | `{ id, label, kind, status, cascadeDelayMs, dependsOn }` |
| `DependencyGraph` | `{ nodes: DependencyNode[], rootTriggerId: string }` |

Nodes are ordered by `cascadeDelayMs` ascending. Each node declares
which upstream nodes it `dependsOn`.

### 2.3 Graph Construction

The graph is built by `workers/daytona-risk-worker/graph-builder.mjs`.
Construction proceeds in stages:

1. **Root trigger** — the first flight leg that is delayed. Status is
   `'at-risk'` or `'failed'` (terminal state).
2. **Connection window** — appears when the itinerary has two or more
   legs. Status depends on the computed risk score (threshold: 20).
3. **Onward leg** — appears when risk score ≥ 40 and the itinerary is
   multi-leg. Depends on the connection window.
4. **Hotel check-in** — appears when risk score ≥ 60 or a hotel
   commitment is present. Depends on the onward leg and/or connection
   window.
5. **Additional downstream commitments** — any extra commitments from
   the input (ground transport, event connections, etc.).

Each node receives a `cascadeDelayMs` of `cascadeOrder × 550 ms`,
which drives the staggered visual animation in the UI.

Edges are explicit `{ sourceId, destinationId, reason }` records that
explain why each dependency exists.

### 2.4 Terminal State

When the risk band is `'error'`, `'timeout'`, or otherwise unrecognised,
the system enters a terminal no-plan state. All non-root nodes are
collapsed to `'failed'` status and no recovery plan is constructed.

### 2.5 Recovery Plan Evaluation

The recovery evaluator (`workers/daytona-risk-worker/recovery-evaluator.mjs`)
assesses candidate recovery options:

- Each candidate is checked for a valid route summary and a
  deterministic viability score.
- The first viable candidate becomes the recommended plan.
- If no candidate is viable, or the re-plan attempt limit (2) is
  reached, the result is `recoveryPlan: null`.
- Trade-off fields (`arrivalImpactMinutes`, `connectionBufferMinutes`,
  `fareDelta`, `fareDeltaCurrency`) are set to `null` when not
  available from current evidence — never fabricated.

### 2.6 Recovery Plan Adapter

`core/domain/recovery-plan-adapter.ts` converts a `RiskResult` into
`RecoveryPlanAnimationData` for the UI component. This adapter:

- Generates candidate alternatives deterministically from the seed.
- Collapses candidates into a single recommended plan.
- Maps dependency-graph nodes to downstream animation items.
- Declares the execution mode and provenance label.

## 3. Daytona Role — Isolated Risk Computation

Daytona provides an **isolated sandbox** for running the risk computation
worker. The worker:

- Accepts anonymised itinerary and risk input.
- Performs deterministic dependency-graph recovery computation.
- Writes sanitised output.

**What Daytona does:**

- Runs the risk computation in an isolated environment.
- Reads input from `/worker/input/risk-request.json` (or stdin/env).
- Writes output to `/worker/output/result.json`.

**What Daytona does not do:**

- Daytona does not run Atlas. Atlas is a separate provider.
- Daytona does not call any external service (Gemini, Nosana, Atlas,
  OpenRouter).
- Daytona does not hold or process credentials.
- Daytona does not perform booking, payment, or ticketing.

The default execution mode for the Daytona worker is
`daytona-offline-mock`. The provenance label is:

> "Daytona offline mock — deterministic risk computation, no live execution"

The worker output always includes:

```json
{
  "provenance": {
    "evidenceSource": "daytona-sandbox",
    "provider": "daytona-risk-worker",
    "executed": false,
    "fallbackUsed": true,
    "readOnly": true,
    "label": "Daytona offline mock — deterministic risk computation, no live execution"
  },
  "externalWriteOccurred": false
}
```

## 4. Atlas Boundary

Atlas is the flight-search provider. In the current implementation:

- Atlas is **search-only** (read-only). No booking, payment,
  verification with purchase intent, ticketing, or order creation.
- Atlas Sandbox search returned 20 flight offers (KUL → SIN) in a
  verified live smoke test.
- Atlas production search returned 8 flight offers (SIN → BKK) as
  reference-price only.
- Atlas ticketing requires activation and has **not** been executed.
- The browser app uses local fixture data for alternatives display.
  It does not call Atlas directly.

**Hard boundaries:**

- Atlas is never claimed to have run inside Daytona.
- Atlas offers are display-only; `offerReference` never triggers
  verification, booking, payment, ticketing, or order creation.
- If search fails or returns no alternatives, the user can Keep
  their original itinerary. Results are never fabricated.

## 5. Nosana Optional Batch Role

Nosana provides optional decentralized GPU workload execution for
risk computation. In the current implementation:

- One live Nosana job was submitted and completed. The result was
  validated via the `opStates.logs.log` parser fix.
- Live result: `riskScore: 0.2895`, `riskBand: medium`,
  `simulationCount: 800`, `creditsUsed: 44`, `costUsd: 0.044`.
- The Nosana client boundary has been verified: zero network code,
  zero credentials, zero mutations in the browser app.
- The browser app uses local fixture data for risk display. It does
  not call Nosana directly.

**Nosana is optional.** When no live Nosana evidence is available,
the system falls back to local or Daytona-computed results with
appropriate provenance labels.

**No live Nosana result is claimed without evidence.** The
reconciled evidence file is stored at
`smoke-tests/nosana/results/evidence/`.

## 6. Execution Modes

Every result declares exactly one execution mode. Defined in
`core/domain/execution-mode.ts`:

| Mode | Provenance Label | Is Live |
|---|---|---|
| `local-fallback` | Local fallback — Daytona risk computation not executed | No |
| `daytona-offline-mock` | Daytona offline mock — no live risk computation executed | No |
| `daytona-live-risk` | Daytona live risk computation — read-only, sandboxed | Yes |
| `nosana-offline` | Nosana workload prepared and offline-validated — no live job executed | No |
| `nosana-live` | Nosana live workload — decentralized GPU evidence | Yes |
| `atlas-test-data` | Atlas test data — fictional alternatives, not live inventory | No |
| `atlas-production-reference` | Atlas production Search — reference prices only, read-only | Yes |

The default execution mode for the browser app is `local-fallback`.
The default for the Daytona worker is `daytona-offline-mock`.

The function `resolveExecutionMode()` validates the mode string and
falls back to `local-fallback` for any unrecognised value.

## 7. Provenance Labels

Provenance labels are centralised in `core/provenance/labels.ts`.
Labels are selected based on evidence fields (`evidenceSource`,
`provider`, `executed`, `fallbackUsed`, `validationOutcome`), not
provider name alone.

### Gemini Labels

| Label | When Displayed |
|---|---|
| `Direct Gemini 3.7 — live validated` | `evidenceSource='gemini-live'`, `provider='gemini'`, `executed=true`, `fallbackUsed=false`, `validationOutcome='valid'` |
| `Fictional itinerary — local demo fixture` | `evidenceSource='local-fixture'`, `executed=false`, `fallbackUsed=true` |
| `Offline fixture — not direct Gemini evidence` | Conservative default for all other cases |

### Atlas Labels

| Label | When Displayed |
|---|---|
| `Atlas Sandbox — live Search/Verify` | `evidenceSource='atlas-sandbox'`, `executed=true`, `fallbackUsed=false` |
| `Atlas production Search — reference only` | `evidenceSource='atlas-production'`, `executed=true`, `fallbackUsed=false` |
| `Fictional alternatives — local demo fixture` | `evidenceSource='local-fixture'` |
| `Offline fixture — not Atlas Sandbox evidence` | Conservative default |

### Nosana Labels

| Label | When Displayed |
|---|---|
| `Nosana evidence — remote job succeeded; result from decentralized GPU workload.` | `evidenceSource='nosana-evidence'`, `fallbackUsed=false` |
| `Nosana workload validated offline — local fallback used; not Nosana evidence` | `evidenceSource='nosana-evidence'`, `fallbackUsed=true` |
| `Local fallback — not Nosana evidence` | Conservative default |

### Key Rules

1. Missing or contradictory provenance always resolves to a
   conservative offline/fictional label.
2. No offline fixture is ever labelled as live provider evidence.
3. The browser walkthrough uses fictional local fixtures
   (`provenanceMode: 'fictional-local'`).
4. The `RecoveryPlanAnimation` component renders `provenanceLabel`
   verbatim and never assumes "real" or "fixture" on its own.

## 8. Safety Restrictions

### 8.1 Safety Gates (`core/safety/gates.ts`)

- **Confirmation gate**: No downstream work (risk calculation, Atlas
  search) occurs before explicit user confirmation of the itinerary.
- **Write rejection**: Operations like `book`, `create_booking`,
  `reserve`, `ticket`, `issue`, `pay`, `purchase`, `cancel`, `change`,
  `refund`, `order` are explicitly forbidden.
- **Ticketing prerequisites**: Seven prerequisites must all be met
  before any write operation. All default to `false`.

### 8.2 Input Validation (`workers/daytona-risk-worker/input-schema.mjs`)

- Maximum input size: 64 KB.
- Forbidden PII keys: name, email, phone, passport, payment, etc.
- Forbidden operations: book, order, pay, ticket, refund, cancel.
- Flight legs: 1–4 legs, IATA codes only.
- Scenario limit: 1–20.
- Re-plan attempts: maximum 2.

### 8.3 Output Sanitization (`workers/daytona-risk-worker/sanitize.mjs`)

- Strips all forbidden keys (PII, secrets, credentials).
- Rejects output containing `process.env` references.
- Rejects output containing filesystem paths.
- Rejects output containing raw provider response keys.
- Rejects output containing live-data claims when the computation
  was offline.

### 8.4 Feature Flags (`core/flags/feature-flags.ts`)

All flags default to disabled:

| Flag | Default | Purpose |
|---|---|---|
| `DAYTONA_ENABLED` | `false` | May the orchestrator create Daytona sandboxes |
| `ATLAS_LIVE_READ_ONLY` | `false` | May Atlas read-only operations run |
| `ATLAS_WRITES_ENABLED` | `false` | May Atlas write operations run (requires all prerequisites) |
| `ATLAS_TICKETING_SIMULATION_ENABLED` | `false` | May simulated ticketing UI run |
| `DEMO_MODE` | `'local'` | `'local'` \| `'daytona'` \| `'atlas'` |

Mode constraints:

- `daytona` mode: writes forced off, simulation forced off.
- `atlas` mode: Daytona forced off.
- `local` mode: everything off.

### 8.5 Browser Architecture

- Pure frontend React/Vite/TypeScript SPA.
- Zero direct network calls to external providers.
- No provider secret reaches frontend code.
- Every result has provenance metadata.
- Every simulated result is visibly marked simulated/local.
- No external write can occur by default.

## 9. Offline Test Status

All tests are offline-only with zero provider execution.

### Dependency Graph Offline Tests

File: `smoke-tests/dependency-graph-offline-tests.mjs` (1383 lines)

Verifies:

1. Dependency graph types are well-formed.
2. Deterministic seeded risk computation is pure and reproducible.
3. Recovery-plan adapter produces valid animation data.
4. Execution-mode labels are accurate and never claim live for mock.
5. Cascade is visible (at least one downstream item).
6. One recovery plan is shown for non-terminal results.
7. Confirmation state is safe (no "Booked", "Switched", "Ticket issued").
8. No forbidden write labels appear.
9. Evidence labels are accurate.
10. No fabricated live provenance in graph or computation types.

Hard guarantees: zero network code, zero credentials, zero
dependencies beyond Node.js built-ins, fully deterministic.

### Daytona Risk Worker Offline Tests

File: `workers/daytona-risk-worker/tests/daytona-risk-worker-offline-tests.mjs`
(1034 lines)

Verifies:

- Input validation (size, type, forbidden keys, forbidden operations,
  required fields, bounds).
- Risk engine determinism (seeded PRNG, risk band derivation).
- Graph builder contract (node kinds, edge shapes, cascade ordering).
- Recovery evaluator (constraint checking, plan shape, terminal state).
- Output sanitization (forbidden key stripping, safety validation).
- Full pipeline determinism across all modules.

### Provenance Label Offline Tests

File: `smoke-tests/provenance-label-offline-tests.mjs` (504 lines)

Verifies:

- Local fixture does not receive a live Gemini label.
- Fallback used prevents live label even when evidence source is live.
- Atlas Sandbox live evidence receives correct label.
- Missing/contradictory provenance uses conservative label.
- Browser fixture has no live-provider claim.

### Cross-Provider Invariant Tests

File: `smoke-tests/cross-provider-invariant-tests.mjs` (440 lines)

Verifies that no offline fixture is ever labelled as live evidence
across all providers.

## 10. Qoder Spec → Agent → Expert → Agent Workflow

The StitchCheck project was developed using the Qoder agentic coding
environment. The workflow follows a structured pattern:

### Spec Phase

- A Qoder Spec is authored describing the desired feature, its
  boundaries, and acceptance criteria.
- The spec defines file ownership, safety constraints, and
  documentation requirements.
- Example: the dependency-graph recovery feature spec defined the
  type model, graph construction rules, and recovery evaluation
  contract before any code was written.

### Agent Phase

- The Qoder Agent implements the spec by creating or modifying code
  files according to the defined boundaries.
- The Agent retrieves project memories and knowledge to ensure
  alignment with existing architecture and conventions.
- The Agent runs offline tests to verify correctness.

### Expert Phase

- Domain-specific Expert agents perform specialised review:
  - **CodeReview** subagent identifies logic bugs and security
    vulnerabilities.
  - **Plan** subagent produces structured implementation plans for
    complex multi-step tasks.
- Expert review ensures that safety invariants are maintained,
  provenance labels are accurate, and no false claims are introduced.

### Agent Verification Phase

- The Agent incorporates Expert feedback and performs final
  verification.
- All offline tests must pass.
- Documentation is updated to reflect the implementation.
- The evidence index is reconciled.

This workflow ensures that every feature is specified before
implementation, reviewed by specialised agents, and verified against
the project's safety and provenance requirements.

## 11. File Ownership

| Directory / File | Owner | Purpose |
|---|---|---|
| `core/` | Shared core | Domain models, provenance labels, evidence normalization, safety gates, feature flags, contracts |
| `core/domain/dependency-graph.ts` | Shared core | Dependency graph type definitions |
| `core/domain/risk-computation.ts` | Shared core | Deterministic seeded risk computation |
| `core/domain/recovery-plan-adapter.ts` | Shared core | Converts RiskResult to animation data |
| `core/domain/execution-mode.ts` | Shared core | Execution mode types and labels |
| `core/provenance/labels.ts` | Shared core | Centralised provenance label constants and selectors |
| `core/provenance/metadata.ts` | Shared core | Provenance type definitions and constructors |
| `core/safety/gates.ts` | Shared core | Safety gates and ticketing prerequisites |
| `core/flags/feature-flags.ts` | Shared core | Feature flag definitions and evaluation |
| `app/` | Browser SPA | React/Vite/TypeScript frontend |
| `app/src/components/RecoveryPlanAnimation.tsx` | Browser SPA | Visual recovery plan animation component |
| `workers/daytona-risk-worker/` | Daytona worker | Risk computation worker for Daytona sandbox |
| `workers/daytona-risk-worker/graph-builder.mjs` | Daytona worker | Dependency graph construction |
| `workers/daytona-risk-worker/recovery-evaluator.mjs` | Daytona worker | Recovery plan evaluation |
| `workers/daytona-risk-worker/risk-engine.mjs` | Daytona worker | Deterministic risk computation engine |
| `workers/daytona-risk-worker/input-schema.mjs` | Daytona worker | Input validation and rejection |
| `workers/daytona-risk-worker/sanitize.mjs` | Daytona worker | Output sanitization |
| `smoke-tests/` | Test harness | Offline tests and live smoke-test results |
| `docs/` | Documentation | Feature docs, audit reports, runbooks |

## 12. Known Limitations

1. **Browser app is fixture-only.** The browser makes zero direct
   network calls to external providers. All display data is local
   fixture data unless explicitly labelled otherwise.

2. **Daytona worker is offline-mock by default.** The default
   execution mode is `daytona-offline-mock`. The risk computation
   is deterministic and seeded, but does not use live provider data.

3. **Recovery plan trade-offs are null.** Fields like
   `arrivalImpactMinutes`, `connectionBufferMinutes`, `fareDelta`,
   and `fareDeltaCurrency` are set to `null` because they are not
   available from current evidence. They are never fabricated.

4. **No real-time delay signal.** The delay trigger in the recovery
   plan animation is simulated. The downstream cascade analysis is
   real computation, but the trigger itself is not from a live
   delay feed.

5. **Nosana is optional and not continuously connected.** The browser
   app does not call Nosana. One live job was completed through the
   standalone runner script.

6. **Atlas ticketing is activation-gated.** Ticketing has not been
   activated and no booking, payment, or ticket was created.

7. **OpenRouter was a temporary path.** A direct Gemini adapter
   exists but the OpenRouter path was used historically. The
   historical label is preserved in all evidence artifacts.

8. **Candidate recovery options may be empty.** When no candidates
   are supplied, the recovery plan is constructed from input
   structure alone, with all value fields set to `null`.

## 13. No Booking / Payment / Ticket Boundary

StitchCheck enforces a strict no-booking boundary:

- **P0 ends at Keep or Switch.** The decision is recorded with
  `noOrderCreated: true` and `syntheticDemo: true`.
- **Forbidden operations** include: book, order, pay, ticket,
  refund, cancel, change, confirm supplier, settle fare.
- **Atlas is search-only.** No verification with purchase intent,
  no booking, no payment, no ticketing, no order creation.
- **Ticketing prerequisites** all default to `false`. No write
  operation can execute without all seven prerequisites being met.
- **The RecoveryPlanAnimation component** never displays "Booked",
  "Switched", or "Ticket issued" unless a `verifiedOutcome` is
  explicitly provided. The default is `verifiedOutcome: null`.
- **Final statement**: No booking, payment, reservation, ticket,
  or order was created. This is a synthetic demo.

## 14. Live Versus Mock Status

| Component | Status | Evidence |
|---|---|---|
| Direct Gemini 3.7 extraction | Live validated | `smoke-tests/gemini/results/results-gemini-3.7-flash-success.json` |
| OpenRouter temporary path | Historical smoke-test only | `smoke-tests/gemini/results/results.json` |
| Atlas Sandbox search | Live completed (20 offers) | `smoke-tests/atlas/results/sandbox-search-verify-*.json` |
| Atlas production search | Live completed (8 offers, reference only) | `smoke-tests/live-demo-results/` |
| Atlas ticketing | Activation-gated, not completed | Auth status: `ticketing_available: false` |
| Nosana risk workload | Live job completed, result validated | `smoke-tests/nosana/results/evidence/` |
| Daytona risk worker | Offline-mock by default | Worker output: `executed: false` |
| Browser demo UI | Fully functional offline; local fixtures | `app/` passes typecheck and production build |
| Dependency graph types | Verified offline | `smoke-tests/dependency-graph-offline-tests.mjs` |
| Recovery plan adapter | Verified offline | `smoke-tests/dependency-graph-offline-tests.mjs` |
| Provenance labels | Verified offline | `smoke-tests/provenance-label-offline-tests.mjs` |
| Cross-provider invariants | Verified offline | `smoke-tests/cross-provider-invariant-tests.mjs` |

**Key principle**: No offline fixture is ever labelled as live
provider evidence. No local or mock data is presented as live.
Missing or contradictory provenance always resolves to a
conservative offline/fictional label.
