# StitchCheck: Technical Specification

This document defines the P0 implementation contract only. It must remain
consistent with the PRD (`docs/PRD.md`), User Stories (`docs/user-stories.md`),
and UAT (`docs/UAT.md`).

## P0 Boundary

Full P0 flow:

Synthetic screenshot upload -> Gemini extraction -> user correction and
confirmation -> Nosana risk scoring -> Atlas Sandbox search -> comparison ->
Keep or Switch -> final state showing no booking/order/payment occurred.

Explicit declarations:
- P0 ends at Keep or Switch.
- Atlas is search-only in P0.
- No real PII, production credentials, booking, payment, reservation, offer
  verification, ticketing, or order creation.
- No implementation claim is evidence that an integration works.

## Requirement Traceability

| User Story | Functional Requirement | UAT Coverage | Technical Component |
|---|---|---|---|
| US-01 | FR-01 | UAT-02, UAT-26 | Upload and Safety UI |
| US-02 | FR-02 | UAT-01 | Upload and Safety UI |
| US-03 | FR-03 | UAT-06, UAT-29 | Gemini Extraction Service |
| US-04 | FR-04 | UAT-07, UAT-08 | Itinerary Confirmation UI |
| US-05 | FR-05 | UAT-03, UAT-04, UAT-05, UAT-09 | Upload and Safety UI, Gemini Extraction Service, Shared Error and Replay Handling |
| US-06 | FR-06 | UAT-11, UAT-15, UAT-29 | Nosana Risk Service |
| US-07 | FR-07 | UAT-12, UAT-13 | Nosana Risk Service, Comparison and Decision UI |
| US-08 | FR-08 | UAT-10, UAT-14, UAT-27 | Nosana Risk Service, Shared Error and Replay Handling |
| US-09 | FR-09 | UAT-16, UAT-17, UAT-21, UAT-28, UAT-29 | Atlas Sandbox Search Service |
| US-10 | FR-10 | UAT-18, UAT-19, UAT-20, UAT-27 | Atlas Sandbox Search Service, Shared Error and Replay Handling |
| US-11 | FR-11 | UAT-22 | Comparison and Decision UI |
| US-12 | FR-12 | UAT-23 | Comparison and Decision UI |
| US-13 | FR-13 | UAT-24, UAT-25, UAT-26 | Comparison and Decision UI |

## System Components

### 1. Upload and Safety UI
- Inputs: two synthetic screenshot references; synthetic-demo acknowledgement.
- Outputs: SyntheticUpload record; transition to extraction or validation
  feedback.
- States: UploadReady, UploadValidating, UploadInvalid.
- Errors: unreadable, incomplete, or non-two-leg inputs; upload rejection.
- Safety boundary: synthetic-only notice always visible; no real PII accepted.
- Requirement IDs: FR-01, FR-02, FR-05.

### 2. Gemini Extraction Service
- Inputs: confirmed synthetic screenshot references.
- Outputs: ExtractedItinerary (structured fields plus confidence).
- States: ExtractingItinerary, ExtractionReview (handoff), ExtractionError.
- Errors: extraction failure, low confidence, invalid itinerary shape.
- Safety boundary: receives synthetic images only; never receives real PII.
- Requirement IDs: FR-03, FR-05.

### 3. Itinerary Confirmation UI
- Inputs: ExtractedItinerary.
- Outputs: user-confirmed itinerary (userConfirmed = true) with corrections
  and notes.
- States: ExtractionReview, AwaitingConfirmation.
- Errors: unconfirmed or partially edited itinerary blocks downstream work.
- Safety boundary: no risk calculation or Atlas search may start before
  explicit confirmation.
- Requirement IDs: FR-04.

### 4. Nosana Risk Service
- Inputs: RiskRequest (confirmed itinerary, dataset version, non-PII
  declaration, correlationId).
- Outputs: RiskResult (risk band/score, disclaimer, failure-cascade
  explanation, workload status, job/service reference).
- States: RiskQueued, RiskRunning, RiskReady, RiskTimeout, RiskError.
- Errors: timeout, job failure, unavailable dataset; labelled fallback/replay.
- Safety boundary: non-PII inputs only; score labelled heuristic, never a
  guarantee.
- Requirement IDs: FR-06, FR-07, FR-08.

### 5. Atlas Sandbox Search Service
- Inputs: AtlasSearchRequest (confirmed itinerary, search intent, sandboxOnly,
  correlationId).
- Outputs: list of AtlasAlternative records or empty/error result.
- States: AtlasSearching, AtlasResults, AtlasEmpty, AtlasTimeout, AtlasError.
- Errors: timeout, search failure, empty results; retry/replay offered.
- Safety boundary: Sandbox only, search-only; no verification, booking,
  payment, ticketing, or order controls; no offer reuse after environment
  switch.
- Requirement IDs: FR-09, FR-10.

### 6. Comparison and Decision UI
- Inputs: RiskResult, AtlasAlternative list, confirmed itinerary.
- Outputs: comparison display; DecisionRecord (Keep or Switch).
- States: ComparisonReady, DecisionRecorded, ReplayAvailable.
- Errors: missing comparison data defers the decision; never fabricates data.
- Safety boundary: DecisionRecorded creates no Atlas order or write action;
  final state states noOrderCreated: true.
- Requirement IDs: FR-11, FR-12, FR-13.

### 7. Shared Error and Replay Handling
- Inputs: failure events from any component.
- Outputs: user-facing error states, retry paths, labelled replay of recorded
  results.
- States: applies across all failure states; ReplayAvailable.
- Errors: classifies timeout vs error vs empty; prevents silent failure.
- Safety boundary: replayed content always labelled; synthetic labels
  preserved on every retry.
- Requirement IDs: FR-05, FR-08, FR-10 (cross-cutting support for all).

## State Model

Named application states:

- UploadReady
- UploadValidating
- UploadInvalid
- ExtractingItinerary
- ExtractionReview
- ExtractionError
- AwaitingConfirmation
- RiskQueued
- RiskRunning
- RiskReady
- RiskTimeout
- RiskError
- AtlasSearching
- AtlasResults
- AtlasEmpty
- AtlasTimeout
- AtlasError
- ComparisonReady
- DecisionRecorded
- ReplayAvailable

Transition rules:
- No risk or Atlas search may start before itinerary confirmation
  (AwaitingConfirmation -> RiskQueued / AtlasSearching only after
  userConfirmed = true).
- Keep or Switch is only available after comparison data is ready
  (ComparisonReady -> DecisionRecorded).
- DecisionRecorded does not create an Atlas order or any write action.
- Retry and replay must preserve the synthetic-demo safety labels.

## Data Contracts

Illustrative JSON-like schemas only; no code is created by this document.

### SyntheticUpload
- sessionId
- syntheticDemoAcknowledged
- screenshotOneReference
- screenshotTwoReference
- uploadStatus
- validationErrors

### ExtractedItinerary
- origin
- destination
- departureDate
- firstLeg
- secondLeg
- airline
- flightNumber
- departureTime
- arrivalTime
- connectionDurationMinutes
- extractionConfidence
- userConfirmed
- correctionNotes

### RiskRequest
- confirmedItinerary
- staticHistoricalDatasetVersion
- nonPiiDeclaration
- correlationId

### RiskResult
- correlationId
- riskBand
- riskScore
- heuristicDisclaimer
- failureCascadeExplanation
- workloadStatus
- jobOrServiceReference
- fallbackUsed

### AtlasSearchRequest
- confirmedItinerary
- searchIntent
- sandboxOnly
- correlationId

### AtlasAlternative
- offerReference
- routeSummary
- departureTime
- arrivalTime
- duration
- priceDisplay
- currency
- connectionType
- sourceEnvironment
- availabilityLabel

`offerReference` is display/search context only in P0 and must never trigger
verification, booking, payment, ticketing, or order creation.

### DecisionRecord
- sessionId
- selectedDecision: Keep or Switch
- selectedAlternativeReference if Switch
- decisionTimestamp
- noOrderCreated: true
- syntheticDemo: true

## Interface Contracts

Conceptual interfaces only: no endpoint URLs, SDK names, code, or credentials.
All P0 interfaces are read-only except internal non-PII session state. Atlas
interfaces are explicitly read-only/search-only.

### 1. Gemini extraction request and structured response
- Required input fields: two synthetic screenshot references; sessionId.
- Expected output fields: ExtractedItinerary fields plus
  extractionConfidence.
- Timeout behavior: bounded wait, then ExtractionError with retry.
- Error behavior: structured error surfaced as understandable UI feedback.
- Fallback/replay behavior: re-extraction retry or labelled replay of a prior
  successful extraction.
- Read-only or may write: read-only (writes only internal non-PII session
  state).

### 2. Gemini extraction error response
- Required input fields: correlationId; failing screenshot references.
- Expected output fields: errorCategory; understandable message; retry path.
- Timeout behavior: same bounded wait as interface 1.
- Error behavior: never silently fails; routes to ExtractionError.
- Fallback/replay behavior: re-upload or labelled replay.
- Read-only or may write: read-only.

### 3. Nosana job/service submit request
- Required input fields: RiskRequest fields (confirmed itinerary, dataset
  version, nonPiiDeclaration, correlationId).
- Expected output fields: jobOrServiceReference; initial workloadStatus.
- Timeout behavior: submit timeout returns RiskError with retry.
- Error behavior: submission failure surfaced with retry path.
- Fallback/replay behavior: labelled replay of a prior recorded result.
- Read-only or may write: read-only with respect to user-facing travel data;
  internal non-PII job state only.

### 4. Nosana status polling or status update response
- Required input fields: jobOrServiceReference; correlationId.
- Expected output fields: workloadStatus (queued/running/complete/failed).
- Timeout behavior: polling timeout yields RiskTimeout state.
- Error behavior: status errors yield RiskError with retry.
- Fallback/replay behavior: labelled replay available when a recorded result
  exists.
- Read-only or may write: read-only.

### 5. Nosana risk result response
- Required input fields: jobOrServiceReference.
- Expected output fields: RiskResult fields (riskBand, riskScore,
  heuristicDisclaimer, failureCascadeExplanation, fallbackUsed).
- Timeout behavior: result retrieval timeout yields RiskTimeout.
- Error behavior: malformed or missing result yields RiskError.
- Fallback/replay behavior: fallbackUsed must be true and labelled when a
  recorded result is served.
- Read-only or may write: read-only.

### 6. Atlas Sandbox search request
- Required input fields: AtlasSearchRequest fields; sandboxOnly = true.
- Expected output fields: search acknowledgement; correlationId.
- Timeout behavior: bounded wait, then AtlasTimeout with retry.
- Error behavior: search failure yields AtlasError with retry.
- Fallback/replay behavior: labelled replay of a prior recorded search.
- Read-only or may write: read-only / search-only. No verification, booking,
  payment, ticketing, or order creation.

### 7. Atlas Sandbox search result response
- Required input fields: correlationId.
- Expected output fields: list of AtlasAlternative records;
  sourceEnvironment = sandbox.
- Timeout behavior: n/a (response path); late arrival treated as timeout.
- Error behavior: malformed offers yield AtlasError; nothing is fabricated.
- Fallback/replay behavior: labelled replay of recorded results.
- Read-only or may write: read-only / search-only.

### 8. Atlas Sandbox empty/error/timeout response
- Required input fields: correlationId.
- Expected output fields: outcome category (empty/error/timeout); message;
  retry path.
- Timeout behavior: explicit AtlasTimeout state.
- Error behavior: understandable messaging; Keep remains available.
- Fallback/replay behavior: retry or labelled replay; never fabricated
  results.
- Read-only or may write: read-only / search-only.

## UI Views

### Safety notice and upload
- Information displayed: synthetic-demo notice; upload slots for two
  screenshots.
- Permitted user actions: acknowledge notice; upload; restart.
- Loading, empty, timeout, and error behavior: upload progress; empty slots;
  upload error with retry.
- Replay behavior: restart with synthetic inputs.
- Required safety labels: "synthetic demo data only; no real personal data".

### Validation feedback
- Information displayed: specific validation problem(s) per screenshot.
- Permitted user actions: re-upload; restart.
- Loading, empty, timeout, and error behavior: immediate feedback; error
  detail shown.
- Replay behavior: restart preserves synthetic labels.
- Required safety labels: synthetic-demo context retained.

### Extraction review and correction
- Information displayed: extracted fields beside source screenshots;
  confidence indicator.
- Permitted user actions: edit fields; confirm; cancel back to upload.
- Loading, empty, timeout, and error behavior: extracting state; extraction
  error with retry.
- Replay behavior: re-run extraction.
- Required safety labels: fields identified as Gemini-derived and unconfirmed
  until confirmation.

### Risk workload status
- Information displayed: Nosana workload/job/service status and reference.
- Permitted user actions: none beyond waiting; retry on failure.
- Loading, empty, timeout, and error behavior: queued/running indicator;
  timeout and error states with retry.
- Replay behavior: labelled replay of recorded result.
- Required safety labels: Nosana attribution; non-PII note.

### Risk result and failure-cascade explanation
- Information displayed: risk band/score; plain-language explanation;
  disclaimer.
- Permitted user actions: proceed to alternatives.
- Loading, empty, timeout, and error behavior: not applicable once ready;
  fallback labelled when used.
- Replay behavior: labelled replay state when fallback used.
- Required safety labels: "heuristic; not a guarantee or live prediction".

### Atlas search status/results
- Information displayed: search progress; labelled sandbox alternatives.
- Permitted user actions: wait; retry; proceed to comparison.
- Loading, empty, timeout, and error behavior: all four states visibly
  handled with retry/replay.
- Replay behavior: labelled replay of a recorded search.
- Required safety labels: "Atlas Sandbox"; search-only.

### Comparison and Keep/Switch decision
- Information displayed: risky plan vs alternatives side by side; source
  labels.
- Permitted user actions: select Keep or Switch (single decision).
- Loading, empty, timeout, and error behavior: decision deferred while data
  missing; Keep remains available.
- Replay behavior: restart comparison from recorded data.
- Required safety labels: sandbox data labels; offerReference is
  display-only.

### Final decision confirmation
- Information displayed: selected decision; statement that no booking,
  payment, reservation, or order was created.
- Permitted user actions: restart demo.
- Loading, empty, timeout, and error behavior: static confirmation; restart
  on error.
- Replay behavior: full demo restart with synthetic inputs.
- Required safety labels: noOrderCreated: true; syntheticDemo: true.

## Risk Heuristic Rules
- The score is a heuristic from static/historical non-PII inputs.
- It is not a guarantee, legal advice, live delay prediction, or weather
  model.
- The UI must show a plain-language explanation and disclaimer.
- If risk scoring is unavailable, show a labelled fallback/replay state
  rather than inventing a score.

## Atlas Rules
- Sandbox only.
- Search-only in P0.
- Never reuse an offer after an environment switch.
- Do not expose booking, verification, payment, ticketing, or order controls.
- If search fails or returns no alternatives, preserve the ability to Keep
  and offer retry/replay; do not fabricate Atlas results.

## Observability and Demo Evidence
Visible proof required for the demo:
- Gemini structured itinerary fields.
- User confirmation of the itinerary.
- Nosana job/service status and risk output.
- Atlas Sandbox search result or a clearly labelled empty/error state.
- Final Keep/Switch decision with `noOrderCreated: true`.

## Error and Replay Matrix

| Failure Area | User-Facing State | Allowed Action | Fallback Rule | Must Not Happen |
|---|---|---|---|---|
| Upload validation | UploadInvalid | Re-upload or restart | Explain the specific problem; keep synthetic labels | Silent acceptance of invalid input |
| Gemini extraction | ExtractionError | Retry extraction or re-upload | Labelled replay of a prior successful extraction | Fabricated itinerary fields |
| Nosana timeout/error | RiskTimeout / RiskError | Retry, or labelled replay | Serve recorded result labelled as replay, or show heuristic unavailable | Invent a score; hide job status |
| Atlas empty/timeout/error | AtlasEmpty / AtlasTimeout / AtlasError | Retry, labelled replay, or proceed to Keep | Keep remains available; never fabricate offers | Fake Atlas results; any write action |
| Final decision handling | DecisionRecorded error | Restart demo | Replay full flow with synthetic inputs | Create any booking, payment, or order |

## Open Questions for Smoke Tests
Listed only; not answered here and no success is claimed:
- Gemini screenshot extraction and structured-output support.
- Gemini response reliability and timeout behavior.
- Nosana workload submission, status visibility, result retrieval, and
  latency.
- Static/historical risk-data suitability.
- Atlas Sandbox authorization, search behavior, alternative availability,
  response shape, and latency.
- Whether the chosen UI stack can safely handle synthetic screenshot upload.

## Implementation Constraints
- No code in this task.
- No external calls in this task.
- No production data or credentials.
- No Atlas write operations in P0.
- Preserve FR/US/UAT traceability.
- Prefer a repeatable demo path over feature scope.

## Stop Condition
Confirm only that `docs/SPECS.md` was created and is the only project file
changed.
