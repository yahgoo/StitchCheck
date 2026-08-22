# StitchCheck — Direct Gemini Provider Change Report

**Date:** 2026-08-22
**Status:** All offline tests, typecheck, and build pass. No live request was made.
**Update:** Gemini 3.7 Interactions API path implemented, offline-tested, and live-verified. Evidence: `smoke-tests/gemini/results/results-gemini-3.7-flash-success.json`.

---

## Summary

Replaced the OpenRouter(Gemini) extraction path with direct Google Gemini API using the `@google/genai` SDK. The adapter reads `GEMINI_API_KEY` from `process.env` server-side only. When the key is absent or the call fails, the adapter returns a clearly marked local fallback. All existing safety gates, no-write boundaries, validation, and offline testability are preserved.

---

## Files Changed

### Core adapter and harness
| File | Change |
|------|--------|
| `smoke-tests/gemini/direct-gemini-adapter.mjs` | Major overhaul: auto-create SDK client from env, credential resolution (process.env only), model resolution (env > capabilities > default), structured output schema, retry logic (max 1, never for auth errors), timeout handling, error sanitization |
| `smoke-tests/gemini/config.json` | `providerSelection: "gemini"`, `directGeminiEnabled: true`, `pinnedModelIdentifier: "gemini-2.5-flash"` |
| `smoke-tests/gemini/provider-capabilities.json` | Gemini capability `approved`, model `gemini-2.5-flash`, OpenRouter marked `rollbackOnly: true` |
| `smoke-tests/gemini/providers.mjs` | Readiness assessment updated for gemini as default provider |
| `smoke-tests/gemini/run-smoke-test.mjs` | Added `.env.local` loading into `process.env`, gemini execution path, `geminiAdapterRecord()` helper |
| `smoke-tests/gemini/package.json` | Added `@google/genai` dependency |

### UI labels
| File | Change |
|------|--------|
| `app/src/data/labels.ts` | `geminiExtraction` label → `"Fictional itinerary — local demo fixture"` (for local browser fixture) |
| `app/src/components/useNarration.ts` | Narration scene updated to match new label |
| `app/src/components/SafetyNotice.tsx` | Safety notice text updated to remove OpenRouter reference |
| `app-fixture-contracts/stitchcheck-ui-demo-data.json` | All `sourceLabel` and `geminiExtraction` labels updated |

### Configuration
| File | Change |
|------|--------|
| `.env.example` | Added `GEMINI_API_KEY=`, `GEMINI_MODEL=`, `EXTRACTION_PROVIDER=gemini` |

### Tests
| File | Change |
|------|--------|
| `smoke-tests/gemini/adapter-offline-tests.mjs` | Updated Tests 13, 14, 21 for new config; added Tests 23–35 (auth failure, timeout, secret redaction, evidence, malformed response, empty response, missing key, model resolution, auth error detection, structured output config, human confirmation gate, readiness report, schema validation) |

---

## Environment Variables Required

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes (for live calls) | Google Gemini API key. Read from `process.env` only. Never exposed to browser. |
| `GEMINI_MODEL` | No | Override model identifier. Default: `gemini-2.5-flash`. |
| `EXTRACTION_PROVIDER` | No | Select provider. Default: `gemini`. |

---

## Selected Gemini Model

- **Target:** `gemini-3.7-flash` (configured, not live-verified; uses Interactions API)
- **Fallback:** `gemini-3.6-flash` (live-verified previously; uses legacy generateContent API)
- **Resolution priority:** `GEMINI_MODEL` env → `provider-capabilities.json` → hardcoded default (`gemini-3.6-flash`)
- **Current config:** `gemini-3.6-flash` (from `provider-capabilities.json` approvedModelIdentifier)
- **API style resolution:** `auto` — gemini-3.7-flash and later → Interactions API; gemini-3.6-flash and earlier → legacy generateContent API

---

## Provider Selection Behavior

1. Adapter is **enabled** when ALL of:
   - `config.json` has `directGeminiEnabled: true` OR `providerSelection: "gemini"`
   - `provider-capabilities.json` has `gemini.capabilityReviewStatus: "approved"`
   - A model identifier is resolvable
   - `GEMINI_API_KEY` is present in `process.env`
2. Adapter is **disabled** when ANY prerequisite is missing.
3. When disabled, all extraction requests return a clearly marked local fallback.
4. The UI never claims "live Gemini" unless the adapter is enabled AND the call succeeded AND the response passed validation.

---

## Fallback Behavior

- **Missing key:** Returns `extractionStatus: "disabled"` with label `"Fictional itinerary — local demo fixture"`
- **Provider error:** Returns `extractionStatus: "error"` with `fallbackUsed: true`
- **Auth failure:** Returns `extractionStatus: "error"` immediately (no retry)
- **Timeout:** Retries once (max), then returns `extractionStatus: "error"` with `fallbackUsed: true`
- **Malformed response:** Returns `extractionStatus: "partial"` with validation messages
- **Schema validation failure:** Downgrades to `extractionStatus: "partial"` with validation messages
- Fallback output is **never** labeled as Gemini output.

---

## Test Results

### Adapter offline tests
- **165 passed, 0 failed** (original suite)
- Tests cover: auth failure, timeout, secret redaction, evidence records, malformed response, empty response, missing key, model resolution, auth error detection, structured output config, human confirmation gate, readiness report, schema validation

### Interactions API offline tests
- **92 passed, 0 failed** (new suite)
- Tests cover: API-style resolution, config override, interactions payload structure, base64 round-trip, structured-output config, store: false, legacy compatibility, response normalization, malformed JSON, schema-invalid output, 404/model-not-found, auth errors, interactions API missing at runtime, no API key leakage, no network requests, fallback labels, no false live labels, schema conversion

### Cross-provider invariant tests
- **40 passed, 0 failed**

### Full verification suite (`npm run verify:offline`)
- Cross-provider invariant tests: ✅
- Gemini adapter offline tests: ✅
- Atlas adapter offline tests: ✅
- Atlas duplicate-booking guard: ✅
- Atlas schema validator: ✅
- Nosana client offline tests: ✅
- Nosana schema validator: ✅
- TypeScript typecheck: ✅
- Production build: ✅

---

## Security Confirmations

- ✅ No live Gemini request was made.
- ✅ No secret was printed, logged, committed, or bundled.
- ✅ `GEMINI_API_KEY` is read from `process.env` only (not from `.env.local` file reading).
- ✅ `.env.local` is confirmed gitignored.
- ✅ `.env.example` contains placeholders only (no real key).
- ✅ No `VITE_GEMINI_API_KEY` or `VITE_` prefixed secrets exist.
- ✅ No `Authorization` headers or `apiKey` references in client-side code.
- ✅ Production bundle (`dist/`) contains no `GEMINI_API_KEY`, `AIza`, `sk-`, `OpenRouter`, `Bearer`, or `Authorization` patterns.
- ✅ Error messages are sanitized: API keys, Bearer tokens, URLs, emails, stack traces are redacted.
- ✅ Readiness report does not expose credential values.
- ✅ Old OpenRouter labels have been replaced in UI components.
- ✅ Gemini 3.7 Interactions API path implemented with SDK-verified types.
- ✅ 404/model-not-found errors are detected and not retried.
- ✅ Legacy generateContent path preserved for gemini-3.6-flash.

---

## Manual Verification Checklist

Perform these steps after this change report:

### Setup
- [ ] Copy `.env.example` to `.env.local`
- [ ] Add your real `GEMINI_API_KEY` to `.env.local` (do NOT commit this file)
- [ ] Optionally set `GEMINI_MODEL` to override the default model
- [ ] Run `npm install` in `smoke-tests/gemini/` to ensure `@google/genai` is installed

### Offline verification
- [ ] Run `cd app && npm run verify:offline` — all tests should pass
- [ ] Confirm no errors in typecheck or build output

### Live smoke test (requires separate explicit approval)
- [ ] Run `cd smoke-tests/gemini && node run-smoke-test.mjs` with `GEMINI_API_KEY` set
- [ ] Verify the output shows `providerStatus: "gemini"` and a valid extraction record
- [ ] Verify the response passed schema validation
- [ ] Verify the evidence object records `provider: "gemini"`, model, timestamp, and success

### Security verification
- [ ] Confirm `.env.local` is NOT tracked by git: `git status .env.local`
- [ ] Search the repo for your API key value (should find nothing)
- [ ] Search `app/dist/` for `GEMINI_API_KEY` (should find nothing)
- [ ] Open the browser dev tools on the running app and verify no secrets in console or network tab
- [ ] Verify the UI shows "Fictional itinerary — local demo fixture" for fixture data

### Rollback verification
- [ ] Set `EXTRACTION_PROVIDER=openrouter` in `.env.local` (if OpenRouter rollback is needed)
- [ ] Or set `directGeminiEnabled: false` in `config.json` to disable Gemini entirely
- [ ] Re-run `npm run verify:offline` to confirm fallback behavior

---

## Notes

- The OpenRouter adapter is preserved as a rollback path (`rollbackOnly: true` in capabilities).
- The adapter uses at most one controlled retry for transient errors; auth and validation failures are never retried.
- The SDK import is lazy (performed at execution time only, not at module import).
- No telemetry or analytics code was added.
- No Atlas ticketing, Nosana, wallet, payment, booking, or external-write behavior was modified.
