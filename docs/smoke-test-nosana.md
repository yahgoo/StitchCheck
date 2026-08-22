# Smoke Test: Nosana Risk Workload

## Purpose
Validate whether Nosana can run or serve a minimal non-PII connection-risk
workload for StitchCheck P0, expose visible workload/job/service status, and
return a result that the application can consume.

This is a plan only. Nosana has not been tested, configured, deployed, or
called, and nothing in this document claims that it works.

## P0 Requirement Coverage
Relevant requirements and tests:
- US-06, US-07, US-08
- FR-06, FR-07, FR-08
- UAT-10, UAT-11, UAT-12, UAT-13, UAT-14, UAT-15

## Hypothesis
Given a synthetic, confirmed itinerary summary and a small static/historical
non-PII risk input, a Nosana workload or service can:
1. Start successfully.
2. Expose a visible queued/running/completed or equivalent status.
3. Return a structured risk result.
4. Return an identifiable job or service reference.
5. Complete within a demo-acceptable time or provide a clear timeout/fallback
   state.

## Preconditions
- Use synthetic itinerary data only.
- Do not submit screenshots, passenger details, names, email addresses,
  booking references, payment data, passports, or other PII.
- Confirm official Nosana documentation before implementation.
- Do not claim Nosana deployment, job submission, status visibility, or result
  retrieval works until this smoke test succeeds.
- Risk scoring is a heuristic using static/historical data, not a live delay,
  weather, legal, or guaranteed-outcome prediction.

## Minimal Test Input
Illustrative non-PII input shape only:

```
{
  "correlationId": "synthetic-demo-id",
  "origin": "AAA",
  "connectionAirport": "BBB",
  "destination": "CCC",
  "connectionDurationMinutes": 75,
  "staticHistoricalDatasetVersion": "demo-version",
  "syntheticDemo": true,
  "nonPiiDeclaration": true
}
```

This is an illustrative contract only and not an implementation.

## Expected Result Contract
Illustrative JSON-like output only:

```
{
  "correlationId": "synthetic-demo-id",
  "workloadStatus": "queued | running | completed | timeout | error",
  "jobOrServiceReference": "string",
  "riskBand": "low | medium | high | unavailable",
  "riskScore": null,
  "heuristicDisclaimer": "string",
  "failureCascadeExplanation": "string",
  "datasetVersion": "string",
  "fallbackUsed": false,
  "errorCode": null,
  "errorMessage": null
}
```

Requirements:
- The output must be structured and app-consumable.
- A score must never be invented if the job fails or times out.
- The result must carry a heuristic disclaimer.
- Gemini and Atlas are not called by this smoke test.

## Test Cases

| Test ID | Synthetic Input / Condition | Expected Nosana Outcome | Required UI or Safety Behavior | Pass/Fail |
|---|---|---|---|---|
| NOS-01 | Valid minimal non-PII risk request | Workload/service starts successfully | Synthetic and non-PII labels visible | |
| NOS-02 | Work in progress | Status becomes visible (queued/running or equivalent) | Status panel shows live workload state | |
| NOS-03 | Completed workload | Structured risk result returned | Result rendered and attributed to Nosana | |
| NOS-04 | Completed workload | Result includes a job or service reference | Reference displayed in the status panel | |
| NOS-05 | Missing required non-PII input | Clear validation error | Understandable feedback; no silent failure | |
| NOS-06 | Workload timeout | Labelled timeout outcome | Timeout state with labelled replay/fallback path | |
| NOS-07 | Workload failure | Clear error outcome | Error state with replay path; no invented score | |
| NOS-08 | Any request/response | Output does not include or require PII | Inputs and outputs inspected for PII; none present | |
| NOS-09 | Unavailable risk result | riskBand unavailable; riskScore null | No invented score displayed; fallback labelled | |
| NOS-10 | Completed risk output | Heuristic disclaimer and plain-language failure-cascade explanation present | Disclaimer visible; explanation not framed as a guarantee | |

## Pass Criteria
The smoke test passes only if:
- A minimal non-PII workload or service can be started.
- Status is observable in a form that can be shown in the StitchCheck UI.
- A completed execution returns structured, app-consumable output.
- Failure and timeout behavior are detectable and can support replay.
- No PII is required or transmitted.
- The workload does not call Atlas or create a booking, order, payment, or
  reservation.

## Failure Decision
If this smoke test fails:
- Do not claim a Nosana integration works.
- Record the precise failure mode and latency.
- Do not replace Nosana with a decorative or unused integration.
- Reassess P0 only if an alternative Nosana workload/service design still has
  an essential, visible, app-consumed role.
- Update PRD, UAT, and SPECS before implementation if the P0 contract
  changes.

## Evidence to Record After Execution
- Date, tester, environment, and Nosana tool/version details.
- Synthetic input identifier and proof of non-PII input.
- Job/service reference.
- Status transitions and timestamps.
- Raw structured result or error response, with no secrets.
- End-to-end latency.
- Result for each NOS test case.
- Screenshot or recording showing visible status and final result.

## Stop Condition
Confirm only that `docs/smoke-test-nosana.md` was created and is the only
project file changed.
