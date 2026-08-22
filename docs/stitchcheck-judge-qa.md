# StitchCheck Judge Q&A

## 30-Second Answer

StitchCheck converts itinerary screenshots into editable, user-confirmed structured data, keeping risk and alternatives locked until the user explicitly confirms the itinerary. The current submission demonstrates a local review-first workflow with offline contract safeguards, using synthetic fixture data. The demo walkthrough makes no external service calls. OpenRouter was used for GEM-01 and GEM-LIVE-01 (temporary path); Atlas production authentication succeeded with two live read-only searches returning reference-price offers. Nosana remains unexecuted.

## Core Questions

### Q1. What problem does StitchCheck solve?

StitchCheck helps budget travellers understand the hidden risk of stitching two separately purchased flight tickets with a tight connection. When flights are booked as separate tickets, each is an independent contract; if the first flight is delayed, the second airline generally has no obligation to rebook or refund. StitchCheck surfaces itinerary details, assesses connection risk, and presents alternatives — all under explicit user control.

### Q2. What happens in the demo?

The user selects a synthetic itinerary screenshot fixture, reviews editable extracted fields, corrects any value, and explicitly confirms the itinerary before downstream panels unlock. After confirmation, local placeholder risk and alternatives data become visible, and the user makes a Keep or Switch decision. The final screen states that no booking, payment, reservation, ticket, order, verification, or other write action has been created.

### Q3. Why is explicit confirmation required?

The confirmation gate ensures the traveller has actually reviewed and approved the extracted data before any downstream processing occurs. Risk and alternatives panels remain disabled with `Confirm itinerary first` until the user explicitly confirms. No automated step can bypass this gate; it requires a single explicit human action every time.

### Q4. What does Gemini do?

Gemini's planned role is structured itinerary extraction from synthetic screenshots into editable fields for user review. The current demo uses local fixture data derived from a temporary-path execution that is labelled with the documented evidence label. Direct Gemini remains unexecuted. Offline tests (92 passed, 0 failed) validate the extraction contract, validators, and safety boundaries.

### Q5. What do Nosana and Atlas do?

Nosana's planned role is a connection-risk workload that accepts a non-PII itinerary summary and returns a heuristic risk band/score with visible workload status. Atlas's planned role is read-only alternative search for safer flight options. Nosana is represented by local fixtures and offline-tested adapters only and has not been executed or authenticated. Atlas production authentication succeeded via the official Skill CLI with two live read-only searches returning real offers (all reference-price only, ticketing activation pending). Offline tests (Nosana: 75 passed, 0 failed; Atlas: 89 passed, 0 failed) confirm contract shapes and safety boundaries.

### Q6. Which services have actually been executed?

Direct Gemini remains unexecuted. Nosana remains unexecuted and undeployed. Atlas production authentication succeeded via the official Skill CLI with two live read-only searches (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers via ATL-LIVE-01), all reference-price only with ticketing activation pending; Atlas Sandbox was not used. GEM-01 and GEM-LIVE-01 were executed via an OpenRouter temporary path and are labelled accordingly. The OpenRouter path is not direct Gemini validation and results are not transferable to the Gemini API.

### Q7. What does the OpenRouter evidence mean?

GEM-01 was executed via an OpenRouter temporary path using a synthetic fixture and is labelled: `OpenRouter temporary path — not direct Gemini validation`. This evidence demonstrates that the extraction interface can process a synthetic screenshot through a vision-capable model, but it is not direct Gemini validation. The result is labelled accordingly and is not transferable to the Gemini API.

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

- `OpenRouter temporary path — not direct Gemini validation`
- `Synthetic local placeholder — not Nosana evidence`
- `Synthetic local placeholder — not Atlas Sandbox evidence`

## Difficult Questions

### 1. Why should we trust a local demo?

The local demo proves the review-first workflow, the confirmation gate, and the safety boundaries — all of which are under the application's control. Offline tests deterministically validate that adapter contracts, fixture schemas, forbidden-action enforcement, and sanitization rules are correctly implemented. What the local demo cannot prove is that any external provider actually works; that requires separately authorized live execution with real credentials.

### 2. Why are all providers not live?

Each provider requires separate human authorization, credentials, cost review, and a bounded smoke-test plan before any live call can be made. Nosana's smoke-test attempt was intentionally blocked before any network request because no reviewed workload, submission mechanism, or target environment existed. Direct Gemini requires its own credential and authorization gate. Atlas Sandbox was not used (no Sandbox switch command in CLI v0.3.12); production Atlas was authenticated and searched but ticketing activation is pending. We chose to stop safely on Nosana rather than make uncontrolled external calls.

### 3. What is the strongest evidence available today?

The strongest evidence is that the local demo passes type-check, production build, and a 39-item browser acceptance walkthrough, and that offline tests across all three provider boundaries pass deterministically (Gemini: 92, Atlas: 89, Nosana: 75). The GEM-01 OpenRouter temporary-path execution demonstrates the extraction interface with a synthetic fixture. These results prove that contracts and safeguards are correctly implemented; they do not prove that any external service works.

### 4. What is the biggest remaining risk?

The biggest risk is that no provider has been validated against live behaviour. The offline tests confirm that contracts and safety boundaries are correctly implemented, but they cannot prove that Gemini will extract accurately, that Nosana will return usable risk bands, or that Atlas will return valid alternatives under real conditions. Until each provider passes its own separately authorized smoke test, the integration remains unproven.

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
