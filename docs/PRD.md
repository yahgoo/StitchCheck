# StitchCheck: Product Requirements Document

## Product Overview
StitchCheck helps budget travellers assess the hidden risk of stitching two
separately purchased flight tickets with a tight connection before they pay.
The traveller uploads synthetic screenshots of the two tickets, Gemini extracts
a structured itinerary, Nosana computes a connection-risk score, and the Atlas
Flight Booking Sandbox prices safer alternatives — ending in a single
Keep-or-Switch decision.
- Hackathon theme: Most Creative Gemini Hack.
- P0 outcome: help a budget traveller decide whether to Keep a risky
  self-transfer plan or Switch to a safer alternative before paying.

## Problem Statement
When two flights are booked as separate tickets, each ticket is an independent
contract. If the first flight is delayed and the traveller misses the second
flight, the second airline generally has no obligation to rebook, protect, or
refund, and low-cost carriers may apply "no-show" rules that cancel remaining
legs without refund. The savings are visible at checkout; the exposure is not.
No unverified statistics are stated as facts in this document. StitchCheck
offers a risk heuristic built from static/historical data — not a guarantee
and not a real-time prediction.

## Target User
- Budget-conscious self-transfer traveller considering two separately booked
  flights with a tight connection.
- P0 uses only a synthetic demo traveller and synthetic ticket/checkout
  screenshots.

## P0 Goal
P0 is one user, one trigger, one decision, and one outcome:
- User: synthetic budget self-transfer traveller.
- Trigger: uploads two synthetic, unbooked ticket/checkout screenshots.
- Decision: Keep or Switch.
- Outcome: receives a clear risk comparison and a recorded decision state,
  without any booking, payment, reservation, or order.

## P0 User Journey
1. Landing and synthetic-demo safety notice.
2. Upload two synthetic screenshots.
3. Gemini extracts itinerary fields into structured data.
4. User reviews, corrects, and confirms the itinerary.
5. Nosana risk-scoring workload runs and exposes visible status.
6. User receives risk score and plain-language failure-cascade explanation.
7. Atlas Sandbox searches for safer alternatives.
8. User compares risky self-transfer against safer alternatives.
9. User selects Keep or Switch.
10. Final P0 decision state confirms no booking or payment occurred.

## Functional Requirements

| ID    | Requirement |
|-------|-------------|
| FR-01 | The system accepts exactly two synthetic, unbooked flight-ticket or checkout screenshots and validates them before processing (US-01). |
| FR-02 | The system displays a persistent synthetic-demo notice and warns that no real personal data should be used (US-02). |
| FR-03 | Gemini extracts itinerary fields into structured data: origin, destination, date, airline, flight number when available, departure time, arrival time, and connection duration (US-03). |
| FR-04 | The user can review, correct, and must explicitly confirm the extracted itinerary before any risk calculation or alternative search begins (US-04). |
| FR-05 | The system provides understandable feedback for invalid, incomplete, or unreadable uploads, including inputs that do not describe a valid two-leg self-transfer, with a recovery path (US-05). |
| FR-06 | Nosana produces a connection-risk score derived from non-PII static/historical data, consumed by the application (US-06). |
| FR-07 | The system presents a plain-language failure-cascade explanation labelled as a heuristic, never as a guarantee or real-time prediction (US-07). |
| FR-08 | The UI visibly handles Nosana workload loading, completion, timeout, error, replay, and fallback states (US-08). |
| FR-09 | Atlas Sandbox search-only results for safer alternatives are displayed in a comparison table and labelled as sandbox data (US-09). |
| FR-10 | The UI visibly handles Atlas loading, empty-result, timeout, and error states, with a retry or labelled replay path (US-10). |
| FR-11 | The system compares the risky self-transfer itinerary against safer alternatives using only clearly labelled, system-available information (US-11). |
| FR-12 | The user makes exactly one P0 decision: Keep or Switch (US-12). |
| FR-13 | The final decision state confirms the selected option and states explicitly that no booking, payment, reservation, or order exists (US-13). |

## Required Technology Evidence

### Gemini
- Screenshot input produces structured itinerary output used by the app.
- Risk explanation is based on confirmed itinerary data.

### Nosana
- A non-PII risk-scoring workload/service produces a score consumed by the app.
- UI visibly shows workload/job/service state.

### Atlas Flight Booking Sandbox
- Search-only Sandbox results appear in the alternative comparison.
- P0 must not create, verify, pay for, or ticket an order.

## Screens and States

| Screen / view | Required states |
|---------------|-----------------|
| Safety notice and upload | Empty, invalid-upload error, retry |
| Extraction review/correction | Loading (extracting), extraction error, timeout, retry |
| Risk workload progress/status | Loading, completion, timeout, error, labelled fallback/replay |
| Risk result and failure-cascade explanation | Heuristic label, fallback/replay label where applicable |
| Atlas alternative search state | Loading, empty-result, timeout, error, retry |
| Comparison and Keep/Switch decision | Missing-data handling, labelled sandbox data |
| Final decision confirmation | No-order/no-payment confirmation statement |

Where applicable, every screen requires loading, empty, error, timeout, retry,
and clearly labelled fallback/replay behavior.

## Non-Functional Requirements
- Clear, readable, demo-friendly interface.
- Explicit labels for synthetic data and heuristic risk.
- No real PII, payments, production credentials, or production bookings.
- No Atlas write action in P0.
- Repeatable demo flow.
- Graceful failure handling.
- Do not reuse Atlas offers after an environment switch.

## Out of Scope
- Production booking, payments, ticketing, and passenger reservations.
- Real user accounts, saved trips, notifications, and live delay feeds.
- Real-time weather or delay prediction.
- Real personal data.
- Atlas offer verification and booking rehearsal.
- Any feature not required to demonstrate Keep or Switch.

## P1 After P0
- Explicitly confirmed Atlas Sandbox offer verification.
- Sandbox-only booking rehearsal using fictional passenger details.
- Any optional product enhancements.

## Dependencies and Open Questions
Facts requiring official documentation review or smoke tests; these
integrations are not claimed to work yet:
- Gemini multimodal structured-output behavior.
- Gemini screenshot extraction quality.
- Nosana workload deployment, completion, output retrieval, and visible status.
- Historical-data availability and suitability for a non-PII risk heuristic.
- Atlas Sandbox search behavior, alternative-offer availability, and latency.

## Acceptance Criteria
P0 succeeds only when a visible demo proves:
- Gemini-derived structured itinerary data.
- Nosana-derived risk score plus job/service status.
- Atlas Sandbox-derived alternative results.
- A user Keep/Switch choice.
- No booking, payment, reservation, or order created.

## Traceability

| PRD requirement | User story | Technology |
|-----------------|------------|------------|
| FR-01 | US-01 | UI/Safety |
| FR-02 | US-02 | UI/Safety |
| FR-03 | US-03 | Gemini |
| FR-04 | US-04 | Gemini, UI/Safety |
| FR-05 | US-05 | Gemini, UI/Safety |
| FR-06 | US-06 | Nosana |
| FR-07 | US-07 | Gemini, Nosana, UI/Safety |
| FR-08 | US-08 | Nosana, UI/Safety |
| FR-09 | US-09 | Atlas Sandbox |
| FR-10 | US-10 | Atlas Sandbox, UI/Safety |
| FR-11 | US-11 | Atlas Sandbox, UI/Safety |
| FR-12 | US-12 | UI/Safety |
| FR-13 | US-13 | UI/Safety |

## Stop Condition
Confirm only that `docs/PRD.md` was created and is the only project file
changed.
