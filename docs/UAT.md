# StitchCheck: User Acceptance Testing

## Purpose
This UAT validates StitchCheck P0 only:
synthetic screenshot upload -> Gemini extraction and user confirmation ->
Nosana risk score -> Atlas Sandbox alternative search -> Keep or Switch.

P0 ends with the decision and must not create a booking, payment, reservation,
verification, or order.

## Test Environment and Safety Preconditions
Mandatory preconditions for every test run:
- Use synthetic, unbooked ticket or checkout screenshots only.
- Do not use real personal data, payment information, production credentials,
  or real bookings.
- Atlas must remain in Sandbox and search-only mode for P0.
- Do not invoke Atlas offer verification, order creation, payment, or
  ticketing.
- Clearly label risk output as a heuristic, not a guarantee or real-time delay
  prediction.
- Record the date, tester, build/version, and environment for every test run.

## Test Data Definitions
Requirements for test data only; no files or sample data are created by this
document:
- Valid synthetic two-leg self-transfer screenshots.
- Synthetic screenshots with missing or unreadable fields.
- Synthetic screenshots that do not represent a valid two-leg self-transfer.
- A repeatable static/historical non-PII input for risk scoring.
- A controlled Atlas Sandbox search scenario, if available.

## UAT Test Cases

### Upload and Safety

| UAT ID | Related FR | Related US | Scenario | Preconditions | Tester Actions | Expected Result | Pass/Fail |
|---|---|---|---|---|---|---|---|
| UAT-01 | FR-02 | US-02 | Safety notice clearly says synthetic demo data only | App launched fresh | Open the landing screen | A visible notice states synthetic demo data only and no real personal data should be used | |
| UAT-02 | FR-01 | US-01 | User uploads two valid synthetic screenshots | Valid synthetic two-leg screenshots prepared | Upload both screenshots | Both are accepted and itinerary extraction begins with receipt confirmation | |
| UAT-03 | FR-05 | US-05 | Product rejects or warns against unreadable/incomplete upload | Synthetic screenshots with missing/unreadable fields | Upload the defective screenshots | Clear, understandable validation feedback is shown with a recovery path | |
| UAT-04 | FR-05 | US-05 | Product rejects or explains input that is not a two-leg self-transfer | Synthetic screenshots of a non-self-transfer itinerary | Upload the screenshots | The product explains why the input is not a valid two-leg self-transfer | |
| UAT-05 | FR-05 | US-05 | User can restart the demo after an upload validation failure | A failed upload just occurred | Choose restart | The demo resets to upload with synthetic inputs; no partial state appears as live data | |

### Gemini Extraction and Confirmation

| UAT ID | Related FR | Related US | Scenario | Preconditions | Tester Actions | Expected Result | Pass/Fail |
|---|---|---|---|---|---|---|---|
| UAT-06 | FR-03 | US-03 | Gemini-derived structured itinerary fields are visible | Two valid synthetic screenshots uploaded | Review the extraction result | Structured fields are visible: origin, destination, date, airline, flight number when available, departure time, arrival time, connection duration | |
| UAT-07 | FR-04 | US-04 | User corrects an extracted field and explicitly confirms | Extraction result displayed with one wrong field | Edit the field and confirm | The corrected value is used downstream and confirmation is visibly recorded | |
| UAT-08 | FR-04 | US-04 | No Nosana risk calculation or Atlas search starts before confirmation | Extraction result displayed, not yet confirmed | Observe the UI without confirming | No risk calculation or Atlas search is triggered until explicit confirmation | |
| UAT-09 | FR-05 | US-05 | Gemini extraction failure produces clear error and replay path | Upload that causes extraction failure | Trigger extraction and observe failure | A clear error is shown with a labelled replay or retry path | |

### Nosana Risk Workflow

| UAT ID | Related FR | Related US | Scenario | Preconditions | Tester Actions | Expected Result | Pass/Fail |
|---|---|---|---|---|---|---|---|
| UAT-10 | FR-08 | US-08 | UI displays a visible Nosana workload loading state | Itinerary confirmed | Trigger risk calculation | A visible loading state identifies the Nosana workload/job/service | |
| UAT-11 | FR-06 | US-06 | Completed Nosana workload produces an app-consumed risk score | Risk calculation running | Wait for completion | A risk score derived from non-PII static/historical data is displayed and attributed to Nosana | |
| UAT-12 | FR-07 | US-07 | Risk result includes plain-language failure-cascade explanation | Risk score displayed | Read the explanation | A plain-language description of delay consequences for the first leg is shown | |
| UAT-13 | FR-07 | US-07 | Risk result states it is a heuristic | Risk score displayed | Read the labels | The result is labelled a heuristic, not a guarantee or live prediction | |
| UAT-14 | FR-08 | US-08 | Nosana timeout or error gives retry, replay, or labelled fallback | Simulated Nosana timeout/error | Observe the failure handling | A clear retry, replay, or clearly labelled fallback state is shown | |
| UAT-15 | FR-06 | US-06 | Application does not expose or send real PII to the risk workload | Any risk run | Inspect inputs to the workload | Only non-PII static/historical and synthetic-derived inputs are used | |

### Atlas Sandbox Search

| UAT ID | Related FR | Related US | Scenario | Preconditions | Tester Actions | Expected Result | Pass/Fail |
|---|---|---|---|---|---|---|---|
| UAT-16 | FR-09 | US-09 | Atlas Sandbox search returns and displays safer alternatives | Itinerary confirmed; Atlas in Sandbox | Run the alternative search | Safer alternative options from the Sandbox are displayed | |
| UAT-17 | FR-09 | US-09 | Alternatives appear in a clearly labelled comparison table | Search completed with results | View the results | Alternatives appear in a comparison table labelled as Atlas Sandbox data | |
| UAT-18 | FR-10 | US-10 | Atlas loading state is visible | Search triggered | Observe during search | A visible loading state is shown while the Sandbox search runs | |
| UAT-19 | FR-10 | US-10 | Atlas empty-result state is understandable with retry/replay | Scenario returning no results | Observe the empty state | An understandable empty-result message appears with a retry or replay path | |
| UAT-20 | FR-10 | US-10 | Atlas timeout or error state is understandable with retry/replay | Simulated Atlas timeout/error | Observe the failure handling | An understandable timeout/error message appears with a retry or replay path | |
| UAT-21 | FR-09 | US-09 | P0 contains no Atlas write action | Entire P0 flow executed | Inspect all Atlas interactions | No offer verification, booking, payment, ticketing, or other write action exists in P0 | |

### Comparison and Decision

| UAT ID | Related FR | Related US | Scenario | Preconditions | Tester Actions | Expected Result | Pass/Fail |
|---|---|---|---|---|---|---|---|
| UAT-22 | FR-11 | US-11 | User can compare risky self-transfer with safer alternatives | Risk result and alternatives available | View the comparison | Risky plan and safer alternatives are shown side by side with clearly labelled sources | |
| UAT-23 | FR-12 | US-12 | User can choose exactly one P0 decision | Comparison view complete | Select Keep or Switch | Exactly one decision is recorded; no other decision point exists in P0 | |
| UAT-24 | FR-13 | US-13 | Final state records and displays the selected decision | Decision made | View the final state | The selected option is confirmed in plain language | |
| UAT-25 | FR-13 | US-13 | Final state confirms no booking/payment/reservation/order | Decision made | Read the final statement | The screen explicitly states no booking, payment, reservation, verification, or order was created | |

### Regression and Demo Reliability

| UAT ID | Related FR | Related US | Scenario | Preconditions | Tester Actions | Expected Result | Pass/Fail |
|---|---|---|---|---|---|---|---|
| UAT-26 | FR-01, FR-13 | US-01, US-13 | Complete happy path runs repeatedly with synthetic inputs | P0 build available | Run the full flow multiple times | Each run completes end to end with synthetic inputs | |
| UAT-27 | FR-08, FR-10 | US-08, US-10 | Every relevant state is clearly labelled | P0 build available | Exercise loading/empty/error/timeout/fallback states | All states are visibly and clearly labelled, including fallback/replay | |
| UAT-28 | FR-09 | US-09 | Atlas environment change requires a new search | Atlas environment switched | Attempt to reuse an earlier offer | Earlier offers are not reused; a new search is required | |
| UAT-29 | FR-03, FR-06, FR-09 | US-03, US-06, US-09 | Demo observer can identify all technology outputs | Full happy-path run | Observe the demo as a viewer | Gemini structured output, Nosana risk score and status, Atlas Sandbox results, and the Keep/Switch decision are each visibly identifiable | |

## UAT Exit Criteria
P0 is accepted only if:
- UAT-01 through UAT-29 pass, or any exception is documented with a
  demo-safe workaround.
- Gemini structured output is visibly consumed by the application.
- Nosana risk output and workload status are visibly consumed by the
  application.
- Atlas Sandbox search results are visibly shown.
- The user can complete Keep or Switch.
- No booking, payment, reservation, verification, or order occurs.

## Defect Template

| Defect ID | UAT ID | Severity | Description | Reproduction Steps | Expected | Actual | Status | Demo Workaround |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## P1 Exclusions
Atlas offer verification, booking rehearsal, payment confirmation, ticketing,
real passenger data, accounts, saved trips, notifications, live delay feeds,
and production integrations are excluded from this P0 UAT.

## Traceability

| UAT ID | FR IDs | US IDs | Technology |
|---|---|---|---|
| UAT-01 | FR-02 | US-02 | UI/Safety |
| UAT-02 | FR-01 | US-01 | UI/Safety |
| UAT-03 | FR-05 | US-05 | Gemini, UI/Safety |
| UAT-04 | FR-05 | US-05 | Gemini, UI/Safety |
| UAT-05 | FR-05 | US-05 | UI/Safety |
| UAT-06 | FR-03 | US-03 | Gemini |
| UAT-07 | FR-04 | US-04 | Gemini, UI/Safety |
| UAT-08 | FR-04 | US-04 | Gemini, Nosana, Atlas Sandbox, UI/Safety |
| UAT-09 | FR-05 | US-05 | Gemini, UI/Safety |
| UAT-10 | FR-08 | US-08 | Nosana, UI/Safety |
| UAT-11 | FR-06 | US-06 | Nosana |
| UAT-12 | FR-07 | US-07 | Gemini, Nosana, UI/Safety |
| UAT-13 | FR-07 | US-07 | UI/Safety |
| UAT-14 | FR-08 | US-08 | Nosana, UI/Safety |
| UAT-15 | FR-06 | US-06 | Nosana, UI/Safety |
| UAT-16 | FR-09 | US-09 | Atlas Sandbox |
| UAT-17 | FR-09 | US-09 | Atlas Sandbox, UI/Safety |
| UAT-18 | FR-10 | US-10 | Atlas Sandbox, UI/Safety |
| UAT-19 | FR-10 | US-10 | Atlas Sandbox, UI/Safety |
| UAT-20 | FR-10 | US-10 | Atlas Sandbox, UI/Safety |
| UAT-21 | FR-09 | US-09 | Atlas Sandbox, UI/Safety |
| UAT-22 | FR-11 | US-11 | Atlas Sandbox, UI/Safety |
| UAT-23 | FR-12 | US-12 | UI/Safety |
| UAT-24 | FR-13 | US-13 | UI/Safety |
| UAT-25 | FR-13 | US-13 | UI/Safety |
| UAT-26 | FR-01, FR-13 | US-01, US-13 | UI/Safety |
| UAT-27 | FR-08, FR-10 | US-08, US-10 | Nosana, Atlas Sandbox, UI/Safety |
| UAT-28 | FR-09 | US-09 | Atlas Sandbox, UI/Safety |
| UAT-29 | FR-03, FR-06, FR-09 | US-03, US-06, US-09 | Gemini, Nosana, Atlas Sandbox, UI/Safety |

## Stop Condition
Confirm only that `docs/UAT.md` was created and is the only project file
changed.
