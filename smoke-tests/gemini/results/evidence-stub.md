# Smoke-Test Evidence — Direct Gemini validation

Generated automatically by the harness. Default runs are offline; execution
occurs only behind the explicit execution flag with full readiness.

- Run at: 2026-08-22T03:52:44.024Z
- Provider: gemini (direct)
- Model identifier: gemini-3.6-flash
- Key status: present-not-used
- Execution requested: true; executed: true
- Network calls made: 1
- Data: synthetic demo only

Retry policy: one initial attempt per case; up to two bounded retries;
Retry-After honored when provided, otherwise bounded exponential backoff with
jitter; no concurrent requests; no model/provider switching after failure.

| Test ID | Fixture | Provider | Outcome | Error Class | Pass/Fail |
|---|---|---|---|---|---|
| GEM-01 | gem-01-two-leg-clean | gemini | success | none | |

## Executed case details
- GEM-01: attempts=1 started=2026-08-22T03:52:48.955Z ended=2026-08-22T03:52:48.955Z latencyMs=4922 validation=valid validationMessages=0 missingFields=0 retryDelayMs=0 fixtureSyntheticNonPii=true destination=Google Gemini API (direct) confirmationGate=pending_user_review

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
