# Gemini Adapter Offline Test Notes

## Adapter Boundary Implementation

The Gemini adapter boundary is implemented in `smoke-tests/gemini/`:

- `extraction-contract.mjs` — Provider-neutral adapter contract with typed interface
- `direct-gemini-adapter.mjs` — Direct Gemini adapter skeleton (disabled by default)
- `extraction-validator.mjs` — Extraction result validator
- `adapter-offline-tests.mjs` — Deterministic offline test suite

## Offline Test Results

All 87 assertions across 21 test cases passed:

1. ✅ Adapter returns disabled/local fallback by default
2. ✅ Synthetic fixture can be normalized into provider-neutral request contract
3. ✅ Valid extraction result passes validation
4. ✅ Missing required fields fail validation
5. ✅ Malformed date/time values fail validation
6. ✅ Impossible or negative connection durations fail validation
7. ✅ Uncertain values remain warnings or confidence information (not silently invented)
8. ✅ No network primitive is invoked
9. ✅ No credential is required or read
10. ✅ Exact local fallback label is present
11. ✅ Confirmation gate remains outside the adapter and is not bypassed
12. ✅ Provider call is not made by default
13. ✅ Call rejected when capability approval is missing
14. ✅ Call rejected when model identifier is missing
15. ✅ Call rejected when runtime credential is missing
16. ✅ Injected fake SDK client receives correctly shaped synthetic request
17. ✅ Fake SDK response is normalized and validated
18. ✅ Raw fake-provider output is not returned
19. ✅ Sanitized errors do not include credentials or raw response content
20. ✅ Second call in same execution is rejected (one-request limit)
21. ✅ Fallback labels and confirmation-gate assumptions remain unchanged

Run command: `node smoke-tests/gemini/adapter-offline-tests.mjs`

## Direct Gemini Status

**Direct Gemini remains unexecuted.**

The adapter's provider-call boundary is implemented but unreachable unless every explicit safety condition is satisfied. The implementation includes:
- Dependency-injection seam for the SDK client (real SDK not installed)
- Request-shaping and response-normalization logic
- Error sanitization (excludes credentials, URLs, headers, PII)
- One-request limit per execution
- Bounded timeout and response size

Even if `directGeminiEnabled: true` is set in `config.json`, the adapter returns a fallback result unless a provider client is explicitly injected and a runtime credential is available. No network call is made during normal operation, tests, or build.

## SDK Dependency / Configuration Status

The official `@google/genai` SDK is **NOT installed**. The adapter uses a dependency-injection seam:
- A minimal client interface is defined (generateContent method)
- Offline tests use fake clients that return synthetic responses
- The real SDK import is isolated behind the future execution entry point
- No package installation or dependency changes have been made

## Remaining Human Authorization Prerequisites

Before direct Gemini validation can be executed, ALL of the following must be completed:

1. Install `@google/genai` package (not yet done)
2. Set `directGeminiEnabled: true` in `config.json`
3. Mark `gemini.capabilityReviewStatus` as `"approved"` in `provider-capabilities.json`
4. Specify an `approvedModelIdentifier` in `provider-capabilities.json`
5. Make `GEMINI_API_KEY` available via secure runtime mechanism (not in config files)
6. Record explicit human authorization
7. Implement the real SDK call in the provider-call function (currently uses injected client)
8. Execute via an explicit smoke-test command (not automatic)

**Warning:** Offline fake-client tests (Tests 16-20) are NOT Gemini evidence. They validate the adapter's request-shaping, response-normalization, and error-sanitization logic using synthetic data. No real Gemini API call has been made.

## No Live Provider Evidence Created

No live Gemini, OpenRouter, Nosana, or Atlas provider evidence was created during this test session. All existing evidence artifacts pre-date this session and remain unchanged.

## Verification Summary

- ✅ Type-check: passed (exit 0)
- ✅ Build: passed (37 modules, 242.84 kB, 66ms)
- ✅ Network primitives in adapter modules: 0 (excluding test patterns)
- ✅ Credential values in adapter modules: 0
- ✅ Evidence artifacts unchanged: all pre-date this session
- ✅ `app/src/` unchanged: 0 files modified
- ✅ No Git operations occurred

## Conclusion

The adapter boundary with provider-call implementation is correctly implemented and tested. The dependency-injection seam enables offline testing with fake clients. All 87 assertions across 21 test cases pass, confirming the contract, validation, safety properties, and one-request limit. Direct Gemini integration remains disabled and unexecuted, with no live provider evidence created.

**Evidence labels preserved:**
- `OpenRouter temporary path — not direct Gemini validation`
- `Synthetic local placeholder — not direct Gemini evidence`
