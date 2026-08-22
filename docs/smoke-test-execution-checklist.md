# StitchCheck: Smoke-Test Execution Checklist

## Purpose
This checklist controls the later, human-approved execution of the three
independent smoke tests:
1. Gemini screenshot extraction (`docs/smoke-test-gemini.md`).
2. Nosana non-PII risk workload (`docs/smoke-test-nosana.md`).
3. Atlas Sandbox alternative search (`docs/smoke-test-atlas.md`).

This document does not execute any test and does not establish that any
integration works.

## Execution Order
1. Gemini.
2. Nosana.
3. Atlas Sandbox.

Each test is independent and must be fully documented before building the
integrated P0 application.

## Global Safety Gate

| Check | Required Evidence | Pass/Fail |
|---|---|---|
| Synthetic data only | Inputs contain no real PII or payment data | |
| No production credentials | Environment and credentials are non-production | |
| Atlas environment | Sandbox confirmed before any Atlas activity | |
| Atlas scope | Search-only; no verify/book/pay/ticket/order action | |
| No fabricated evidence | Record real response or honest error/timeout only | |
| Secrets protection | No secrets appear in notes, screenshots, or commits | |
| Rollback readiness | Replay/fallback behavior is documented | |

## Gemini Execution Gate

| Gate Item | Required Evidence | Pass/Fail |
|---|---|---|
| Required synthetic inputs for GEM-01 through GEM-08 | All eight test inputs prepared and labelled synthetic | |
| Confirmed model/API configuration | Model and API version recorded from official documentation | |
| Structured response evidence | Raw structured response recorded with no sensitive data | |
| Extraction accuracy and missing-field outcomes | Extracted fields, missing fields, and confidence recorded | |
| User correction/confirmation gate | No downstream processing before explicit user confirmation | |
| Latency | End-to-end extraction latency recorded | |
| Error and timeout behavior | Error and timeout outcomes recorded with retry/replay paths | |
| Pass/fail decision | Overall GEM result recorded against pass criteria | |
| Link or path to the execution evidence | Evidence location recorded in the Evidence Log | |

Do not proceed to integrated P0 implementation if Gemini cannot have an
essential, visible, app-consumed role.

## Nosana Execution Gate

| Gate Item | Required Evidence | Pass/Fail |
|---|---|---|
| Confirmed non-PII synthetic request | Request content inspected; nonPiiDeclaration true | |
| Workload or service deployment method | Deployment method recorded from official documentation | |
| Job/service reference | Identifiable reference returned and recorded | |
| Visible status transitions | Queued/running/completed (or equivalent) transitions with timestamps | |
| Structured risk result | App-consumable structured result recorded | |
| Heuristic disclaimer | Disclaimer present in result and UI rendering | |
| Timeout/error/replay behavior | Timeout and error outcomes recorded with replay/fallback paths | |
| Proof no PII was transmitted | Input/output inspection evidence recorded | |
| Latency | End-to-end workload latency recorded | |
| Pass/fail decision | Overall NOS result recorded against pass criteria | |
| Link or path to the execution evidence | Evidence location recorded in the Evidence Log | |

Do not proceed to integrated P0 implementation if Nosana cannot have an
essential, visible, app-consumed role.

## Atlas Execution Gate

| Gate Item | Required Evidence | Pass/Fail |
|---|---|---|
| Sandbox environment confirmation | Proof that Sandbox was active before the run | |
| Search-only authorization configuration | Authorization scope recorded; no write scope requested | |
| Confirmed synthetic search input | Input recorded and proven free of PII | |
| Search status transitions | Loading/completed/empty/timeout/error transitions with timestamps | |
| Result fields available for comparison | Route, times, duration, connection type, price display recorded | |
| Empty/error/timeout behavior | Honest empty/error/timeout outcomes recorded with retry/replay | |
| Proof that output is labelled Sandbox | sourceEnvironment labelling visible in recorded evidence | |
| Proof no verification, booking, payment, ticketing, reservation, or order was attempted | Audit of the run shows zero write actions | |
| Environment-switch behavior and no offer reuse | New search required after switch; no old offer reused | |
| Latency | End-to-end search latency recorded | |
| Pass/fail decision | Overall ATL result recorded against pass criteria | |
| Link or path to the execution evidence | Evidence location recorded in the Evidence Log | |

Do not proceed to integrated P0 implementation if Atlas cannot have an
essential, visible, app-consumed search role.

## Evidence Log Format

| Execution ID | Service | Test IDs | Date/Time | Environment | Synthetic Input ID | Outcome | Latency | Evidence Location | Notes |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |

## Go/No-Go Decision

| Service | Required Pass Condition | Result | Go/No-Go | Required Follow-Up |
|---|---|---|---|---|
| Gemini | GEM pass criteria met; essential, visible, app-consumed role proven | | | |
| Nosana | NOS pass criteria met; essential, visible, app-consumed workload proven | | | |
| Atlas Sandbox | ATL pass criteria met; search-only essential role proven | | | |

Decision rules:
- "Go" requires all three services to pass their essential-role requirements.
- A failure must be documented before altering P0 scope.
- Any change to P0 requires updates to `docs/PRD.md`, `docs/UAT.md`, and
  `docs/SPECS.md`.
- Do not implement a decorative integration to compensate for a failed smoke
  test.

## Stop Condition
Confirm only that `docs/smoke-test-execution-checklist.md` was created and is
the only project file changed.
