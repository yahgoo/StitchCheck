# Cross-Provider Invariant Test Record

## Purpose

This test protects shared evidence, confirmation, and offline-safety invariants
across the Gemini, Atlas, and Nosana provider boundaries. It verifies that no
local placeholder is ever labelled as live provider evidence, that confirmation
gates are preserved for downstream decision support, and that disabled provider
states remain disabled by default. The test runs entirely offline with
deterministic local objects and existing fixtures.

## Scope

This is an offline-only test. It does not validate live provider behavior. No
network request, credential, authentication, or provider execution is involved.
The test verifies structural invariants of the contracts, adapters, and client
boundaries that wrap each provider — not the providers themselves.

## Invariants Checked

1. Every local placeholder result has `executedAgainstProvider: false` (or
   `executed: false`), a synthetic/local source classification, and an explicit
   non-live evidence boundary label.
2. Every result requiring downstream decision support preserves
   `requiresUserConfirmation: true`.
3. Disabled provider states remain disabled by default (Gemini adapter not
   enabled, Atlas source status not enabled, Nosana client status disabled).
4. Exact evidence labels remain unchanged across all three providers.
5. No local placeholder is labelled as provider evidence.
6. Nosana mutation-like operations (submit, deploy, fund, cancel, reserve,
   purchase, delete) remain rejected.
7. No credential-like, header-like, token-like, PII, or raw-provider fields
   survive the Nosana sanitizer where it is applied.
8. The test source itself contains no network primitive, live SDK import,
   credential reference, endpoint URL, or secret.
9. The test is deterministic and performs zero external calls.

## Result

Cross-provider invariant tests: 40 passed, 0 failed.

Network requests made during the test: 0.

## Evidence Boundary

The following exact labels are verified by the test and appear once each in the
evidence boundary assertions:

- `OpenRouter temporary path — not direct Gemini validation`
- `Synthetic local placeholder — not Nosana evidence`
- `Synthetic local placeholder — not Atlas Sandbox evidence`

Provider execution status:

- Direct Gemini 3.7 live extraction succeeded via the Interactions API; schema-valid, no fallback. Browser walkthrough uses a local fixture.
- Nosana workload validated offline; live execution was not verified; demo uses local fallback.
- Atlas Sandbox Search/Verify was verified read-only. Production Search returned reference-price results; no booking occurred.

## Limitations

This test does not prove provider availability, provider accuracy, deployment
success, authentication success, latency, cost, or production readiness. It
verifies only that the local contracts, adapters, and client boundaries maintain
their safety invariants when no provider is invoked.
