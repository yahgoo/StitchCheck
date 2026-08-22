# Smoke Test: Atlas Sandbox Alternative Search

## Purpose
Validate whether the Atlas Flight Booking Sandbox can perform a search-only
flight alternative query for StitchCheck P0 and return structured alternative
results that can be displayed in the comparison view.

This is a plan only. Atlas has not been authenticated, configured, called, or
proven to work.

**Update:** Atlas Sandbox Search/Verify was subsequently verified read-only. Atlas production Search returned read-only reference-price results; no booking or payment occurred. Evidence files exist in this directory.

## P0 Requirement Coverage
Relevant requirements and tests:
- US-09, US-10, US-11, US-12, US-13
- FR-09, FR-10, FR-11, FR-12, FR-13
- UAT-16 through UAT-25, plus UAT-28 and UAT-29

## Hypothesis
Given a synthetic, user-confirmed itinerary and a search-only request in the
Atlas Sandbox, Atlas can:
1. Return zero or more structured safer-alternative flight options.
2. Return results with enough fields to compare route, times, duration,
   connection type, and displayed price.
3. Provide an understandable empty, timeout, or error outcome when no result
   is available.
4. Remain strictly read-only: no offer verification, booking, payment,
   ticketing, reservation, or order creation occurs.
5. Complete within a demo-acceptable time or support a clear replay/fallback
   path.

## Preconditions
- Read the attached Atlas Qoder User Guide before any future execution.
- Use only synthetic itinerary input and Sandbox credentials when execution is
  later approved.
- Do not use real passenger details, payment data, booking references, or
  production credentials.
- Confirm the active Atlas environment is Sandbox before every test run.
- Do not claim search, authorization, offer availability, or response behavior
  works until this smoke test succeeds.
- No Gemini extraction or Nosana workload is invoked by this Atlas-only test.

## Minimal Search Input
Illustrative JSON-like request only:

```
{
  "correlationId": "synthetic-demo-id",
  "origin": "AAA",
  "destination": "CCC",
  "departureDate": "YYYY-MM-DD",
  "earliestDepartureTime": "HH:MM",
  "latestArrivalTime": "HH:MM",
  "searchIntent": "safer-alternative",
  "sandboxOnly": true,
  "syntheticDemo": true,
  "confirmedItinerary": true
}
```

This is an illustrative contract, not an endpoint, SDK call, or code.

## Expected Result Contract
Illustrative JSON-like response only:

```
{
  "correlationId": "synthetic-demo-id",
  "searchStatus": "loading | completed | empty | timeout | error",
  "sourceEnvironment": "sandbox",
  "alternatives": [
    {
      "offerReference": "display-only-reference",
      "routeSummary": "string",
      "departureTime": "string",
      "arrivalTime": "string",
      "duration": "string",
      "connectionType": "string",
      "priceDisplay": "string",
      "currency": "string",
      "availabilityLabel": "string"
    }
  ],
  "errorCode": null,
  "errorMessage": null,
  "fallbackUsed": false
}
```

Requirements:
- `offerReference` is display/search context only.
- P0 must never use a result to verify an offer, book, pay, ticket, reserve,
  or create an order.
- If the result is empty, unavailable, or invalid, the UI must not fabricate
  alternatives.
- Search output must be clearly identified as Atlas Sandbox output when shown.

## Test Cases

| Test ID | Synthetic Input / Condition | Expected Atlas Outcome | Required UI or Safety Behavior | Pass/Fail |
|---|---|---|---|---|
| ATL-01 | Valid synthetic confirmed itinerary | Search request produced | Search only starts after itinerary confirmation | |
| ATL-02 | Search in progress | Search loading state observable | Visible loading indicator labelled Atlas Sandbox | |
| ATL-03 | Completed search | Structured alternatives returned | Results attributed to Atlas Sandbox | |
| ATL-04 | Completed search | Result fields support the comparison view | Route, times, duration, connection type, price display all renderable | |
| ATL-05 | No alternatives available | Labelled empty state | Understandable message with retry/replay path; nothing fabricated | |
| ATL-06 | Search timeout | Labelled timeout state | Timeout message with retry/replay path | |
| ATL-07 | Search error | Labelled error state | Understandable error with retry/replay path | |
| ATL-08 | Any completed result | Result visibly marked as Sandbox output | sourceEnvironment label displayed | |
| ATL-09 | Entire test run | No write action occurs | No offer verification, booking, payment, ticketing, reservation, or order creation attempted | |
| ATL-10 | Atlas environment switched | Prior results invalidated | App requires a new search; old offers not reused | |
| ATL-11 | Completed search with alternatives | Output supports Keep/Switch comparison | Comparison renders without creating an order | |
| ATL-12 | Missing or unconfirmed itinerary input | Search request prevented | Clear feedback that confirmation is required first | |

## Pass Criteria
The smoke test passes only if:
- Sandbox authentication and search behavior can be demonstrated later using
  approved synthetic inputs.
- A search returns structured alternatives, or a documented empty/error/timeout
  outcome that the UI can handle honestly.
- Search status is observable.
- Results expose fields needed by the comparison view.
- The environment is visibly confirmed as Sandbox.
- No Atlas write action occurs.
- Earlier results are not reused after an environment switch.
- No PII is needed or transmitted.

## Failure Decision
If this smoke test fails:
- Do not claim Atlas integration or search works.
- Record the exact failure mode, environment, and latency.
- Do not substitute fabricated flight alternatives as if they were Atlas data.
- Keep P0 Atlas search-only; do not expand into verification or booking to
  solve a search failure.
- Update PRD, UAT, and SPECS before implementation if the available Sandbox
  behavior changes the P0 contract.

## Evidence to Record After Execution
- Date, tester, environment, and relevant Atlas tool/version details.
- Proof that Sandbox was active.
- Synthetic input identifier and proof that it contains no PII.
- Search status transitions and timestamps.
- Raw response shape or error response, with no secrets.
- Returned field availability and result count.
- End-to-end latency.
- Result for every ATL test case.
- Screenshot or recording of Atlas-labelled results or honest empty/error
  state.
- Proof that no offer verification, booking, payment, ticketing, reservation,
  or order was attempted.

## Stop Condition
Confirm only that `docs/smoke-test-atlas.md` was created and is the only
project file changed.
