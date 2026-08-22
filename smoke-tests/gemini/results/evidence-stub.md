# Smoke-Test Evidence — Direct Gemini validation

Generated automatically by the harness. Default runs are offline; execution
occurs only behind the explicit execution flag with full readiness.

- Run at: 2026-08-22T03:47:28.303Z
- Provider: gemini (direct)
- Model identifier: gemini-3.6-flash
- Key status: present-not-used
- Execution requested: false; executed: false
- Network calls made: 0
- Data: synthetic demo only

Retry policy: one initial attempt per case; up to two bounded retries;
Retry-After honored when provided, otherwise bounded exponential backoff with
jitter; no concurrent requests; no model/provider switching after failure.

| Test ID | Fixture | Provider | Outcome | Error Class | Pass/Fail |
|---|---|---|---|---|---|
| GEM-01 | gem-01-two-leg-clean | gemini | not_executed | none | |
| GEM-02 | gem-02-missing-optional | gemini | not_executed | none | |
| GEM-03 | gem-03-fragmented | gemini | not_executed | none | |
| GEM-04 | gem-04-non-itinerary | gemini | not_executed | none | |
| GEM-05 | gem-05-unreadable-field | gemini | not_executed | none | |
| GEM-06 | (service-side) | gemini | not_executed | none | |
| GEM-07 | (service-side) | gemini | not_executed | none | |
| GEM-08 | gem-01-two-leg-clean | gemini | not_executed | none | |

## Executed case details
- GEM-01: attempts=0 started=2026-08-22T03:47:28.303Z ended=n/a latencyMs=0 validation=not_run validationMessages=0 missingFields=0 retryDelayMs=0 fixtureSyntheticNonPii=n/a destination=none (offline) confirmationGate=not_reached
- GEM-02: attempts=0 started=2026-08-22T03:47:28.303Z ended=n/a latencyMs=0 validation=not_run validationMessages=0 missingFields=0 retryDelayMs=0 fixtureSyntheticNonPii=n/a destination=none (offline) confirmationGate=not_reached
- GEM-03: attempts=0 started=2026-08-22T03:47:28.303Z ended=n/a latencyMs=0 validation=not_run validationMessages=0 missingFields=0 retryDelayMs=0 fixtureSyntheticNonPii=n/a destination=none (offline) confirmationGate=not_reached
- GEM-04: attempts=0 started=2026-08-22T03:47:28.303Z ended=n/a latencyMs=0 validation=not_run validationMessages=0 missingFields=0 retryDelayMs=0 fixtureSyntheticNonPii=n/a destination=none (offline) confirmationGate=not_reached
- GEM-05: attempts=0 started=2026-08-22T03:47:28.303Z ended=n/a latencyMs=0 validation=not_run validationMessages=0 missingFields=0 retryDelayMs=0 fixtureSyntheticNonPii=n/a destination=none (offline) confirmationGate=not_reached
- GEM-06: attempts=0 started=2026-08-22T03:47:28.303Z ended=n/a latencyMs=0 validation=not_run validationMessages=0 missingFields=0 retryDelayMs=0 fixtureSyntheticNonPii=n/a destination=none (offline) confirmationGate=not_reached
- GEM-07: attempts=0 started=2026-08-22T03:47:28.303Z ended=n/a latencyMs=0 validation=not_run validationMessages=0 missingFields=0 retryDelayMs=0 fixtureSyntheticNonPii=n/a destination=none (offline) confirmationGate=not_reached
- GEM-08: attempts=0 started=2026-08-22T03:47:28.303Z ended=n/a latencyMs=0 validation=not_run validationMessages=0 missingFields=0 retryDelayMs=0 fixtureSyntheticNonPii=n/a destination=none (offline) confirmationGate=not_reached

The extraction remains editable and unconfirmed in the local review artifact
(smoke-tests/gemini/review/confirmation-demo.html); no downstream action
exists or is enabled in this harness.

## Direct Gemini validation (hackathon day)
Direct Gemini validation: not executed. Pass/fail intentionally blank until direct
Gemini is actually run. Temporary-path results are never merged into or
relabelling of the direct Gemini record.

## Statements
- All inputs are synthetic fixtures and contain no PII.
- No key, token, request header, or secret-like value appears in this file.
- No downstream capability of any kind exists in this harness.
- Nothing in this file claims that extraction works on either provider path.
