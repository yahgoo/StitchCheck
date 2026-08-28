# StitchCheck Judge Q&A

## 30-Second Answer

StitchCheck converts itinerary screenshots into editable, user-confirmed structured data, keeping risk and alternatives locked until the user explicitly confirms the itinerary. The current submission demonstrates a local review-first workflow with offline contract safeguards, using synthetic fixture data. The demo walkthrough makes no external service calls. Direct Gemini 3.7 live extraction succeeded via the Interactions API. Nosana live job was completed and reconciled offline. Atlas production authentication succeeded with two live read-only searches and one Sandbox Search + Verify returning reference-price offers.

## Core Questions

### Q1. What problem does StitchCheck solve?

StitchCheck helps budget travellers understand the hidden risk of stitching two separately purchased flight tickets with a tight connection. When flights are booked as separate tickets, each is an independent contract; if the first flight is delayed, the second airline generally has no obligation to rebook or refund. StitchCheck surfaces itinerary details, assesses connection risk, and presents alternatives — all under explicit user control.

### Q2. What happens in the demo?

The user selects a synthetic itinerary screenshot fixture, reviews editable extracted fields, corrects any value, and explicitly confirms the itinerary before downstream panels unlock. After confirmation, local placeholder risk and alternatives data become visible, and the user makes a Keep or Switch decision. The final screen states that no booking, payment, reservation, ticket, order, verification, or other write action has been created.

### Q3. Why is explicit confirmation required?

The confirmation gate ensures the traveller has actually reviewed and approved the extracted data before any downstream processing occurs. Risk and alternatives panels remain disabled with `Confirm itinerary first` until the user explicitly confirms. No automated step can bypass this gate; it requires a single explicit human action every time.

### Q4. What does Gemini do?

Gemini's role is structured itinerary extraction from synthetic screenshots into editable fields for user review. Direct Gemini 3.7 live extraction succeeded via the Interactions API; schema-valid, no fallback (evidence: `smoke-tests/gemini/results/results-gemini-3.7-flash-success.json`). The browser walkthrough uses a fictional local fixture and makes no provider call. Offline tests (92 passed, 0 failed) validate the extraction contract, validators, and safety boundaries.

### Q5. What do Nosana and Atlas do?

Nosana's planned role is a connection-risk workload that accepts a non-PII itinerary summary and returns a heuristic risk band/score with visible workload status. Atlas's planned role is read-only alternative search for safer flight options. Nosana live job was completed and reconciled offline (`riskScore: 0.2895`, `riskBand: medium`, `costUsd: 0.044`); the browser demo uses a local fallback fixture. Atlas production authentication succeeded via the official Skill CLI with two live read-only searches returning real offers (all reference-price only, ticketing activation pending) and one Sandbox Search + Verify. Offline tests (Nosana: 75 passed, 0 failed; Atlas: 89 passed, 0 failed) confirm contract shapes and safety boundaries.

### Q6. Which services have actually been executed?

Direct Gemini 3.7 live extraction succeeded via the Interactions API; schema-valid, no fallback. The browser walkthrough uses a fictional local fixture. Nosana live job was completed and reconciled offline (`riskScore: 0.2895`, `riskBand: medium`, `costUsd: 0.044`); the demo uses a local fallback fixture. Atlas production authentication succeeded via the official Skill CLI with two live read-only searches (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers via ATL-LIVE-01), all reference-price only with ticketing activation pending; Atlas Sandbox Search + Verify also completed (20 offers KUL→SIN; verify returned PRICE_CONFIRMATION_REQUIRED). GEM-01 was also executed via a historical OpenRouter temporary path and is labelled accordingly. The OpenRouter path is historical and not the active provider.

### Q7. What does the OpenRouter evidence mean?

GEM-01 was executed via a historical OpenRouter temporary path using a synthetic fixture and is labelled: `Historical temporary OpenRouter test path — not the active provider`. Direct Gemini 3.7 was subsequently verified via the Interactions API. The OpenRouter path is historical temporary evidence and not the active provider.

### Q8. How do you prevent incorrect itinerary data from reaching decisions?

All extracted fields are fully editable, and the user can correct any value before confirming. The confirmation gate prevents any downstream processing — risk scoring or alternative search — until the user explicitly confirms the reviewed itinerary. If the extracted data is incorrect, the user corrects it first; if it is unusable, the user can re-upload without any downstream action occurring.

### Q9. Does StitchCheck book, pay for, reserve, ticket, order, or verify anything?

No. StitchCheck does not book, pay for, reserve, ticket, order, verify, or perform any external action of any kind. No UI handler, route, or button enables any write action. The final screen explicitly states that no booking, payment, reservation, ticket, order, verification, or other write action has been created. The scope ends at the local Keep or Switch decision.

### Q10. What would you do next with authorization and credentials?

Any later live test requires explicit human authorization, credential and permission review, cost review, and a bounded smoke-test plan. Each provider (Gemini, Nosana, Atlas) requires separate human authorization, its own credentials, and execution evidence before any live-integration claim can be made. Until each provider passes its own smoke-test gate, no live-integration claim is supportable.

## Technical Proof Points

The following verified offline and local results support the submission:

- Gemini offline tests: 92 passed, 0 failed.
- Atlas offline tests: 89 passed, 0 failed.
- Nosana client offline tests: 75 passed, 0 failed.
- Nosana schema-validator fixtures passed.
- Nosana workload skeleton: 5 simulated runs, all valid.
- Type-check passed.
- Production build passed with 37 modules.
- Local browser walkthrough passed 39 acceptance items.
- Confirmation gate remained unchanged.
- Gemini schema-validator correction aligned `fieldConfidence` and `disabled` handling with the extraction contract.

These are offline contract and local verification results. They do not constitute live provider evidence.

## Evidence Labels

- `Demo itinerary — local demo fixture`
- `Local fallback — not Nosana evidence`
- `Demo alternatives — local demo fixture`

## Difficult Questions

### 1. Why should we trust a local demo?

The local demo proves the review-first workflow, the confirmation gate, and the safety boundaries — all of which are under the application's control. Offline tests deterministically validate that adapter contracts, fixture schemas, forbidden-action enforcement, and sanitization rules are correctly implemented. What the local demo cannot prove is that any external provider actually works; that requires separately authorized live execution with real credentials.

### 2. Why are all providers not live?

Each provider requires separate human authorization, credentials, cost review, and a bounded smoke-test plan before any live call can be made. Nosana's live job was completed and reconciled offline. Direct Gemini 3.7 live extraction succeeded; a subsequent re-verification returned a transient error and was not retried. Atlas Sandbox Search + Verify completed; production Atlas was authenticated and searched but ticketing activation is pending.

### 3. What is the strongest evidence available today?

The strongest evidence is that the local demo passes type-check, production build, and a 39-item browser acceptance walkthrough, and that offline tests across all three provider boundaries pass deterministically (Gemini: 92, Atlas: 89, Nosana: 75). The GEM-01 OpenRouter temporary-path execution demonstrates the extraction interface with a synthetic fixture. These results prove that contracts and safeguards are correctly implemented; they do not prove that any external service works.

### 4. What is the biggest remaining risk?

The biggest risk is that while Direct Gemini 3.7, Nosana, and Atlas have each produced live evidence, the browser demo itself uses local fixtures. The offline tests confirm that contracts and safety boundaries are correctly implemented, but the live demo walkthrough does not invoke any provider in real time.

### 5. How would you measure success after live authorization?

Success would be measured against the pass criteria in each smoke-test plan: Gemini must extract structured itinerary fields from synthetic screenshots with visible confidence; Nosana must return a heuristic risk band with visible workload status within a bounded time; Atlas must return labelled Sandbox alternatives within a bounded time. Each test must preserve the confirmation gate, safety labels, and no-write-action boundary. Pass or fail must be recorded honestly against documented criteria.

## Presenter Rules

- Lead with user control.
- Show the disabled state before confirmation.
- Show one user correction before confirming.
- Say "local demo" when referring to local behavior.
- Qualify every provider claim.
- Never reveal credentials or personal data.
- End with the next authorized validation step.
