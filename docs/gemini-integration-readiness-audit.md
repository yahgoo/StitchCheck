# Gemini Integration Readiness Audit

## Scope

This audit is read-only. It covers the adapter boundary, offline tests, configuration, authorization packet, review worksheet, browser boundary, and evidence claims for the StitchCheck direct-Gemini integration path. No SDK installation, credential configuration, network request, or live provider invocation occurred during this audit. No existing file was modified.

## Implementation Inventory

| Component | Path | Status | Finding |
|-----------|------|--------|---------|
| Provider-neutral extraction contract | `smoke-tests/gemini/extraction-contract.mjs` | Implemented | Defines `ExtractionAdapter` interface, `ExtractionRequest`/`ExtractionResult` typedefs, label constants, disabled-result factory, and adapter shape validation. Pure contract with no network code. |
| Direct Gemini adapter | `smoke-tests/gemini/direct-gemini-adapter.mjs` | Implemented (disabled by default) | Provider-call boundary with dependency-injection seam, request-shaping, response-normalization, error sanitization, one-request limit, timeout/response bounds. Disabled unless all safety gates are satisfied. |
| Extraction validator | `smoke-tests/gemini/extraction-validator.mjs` | Implemented | Validates required fields, date/time formats, connection-duration plausibility, confidence values. Preserves uncertainty as warnings. Does not invent data. |
| Offline test suite | `smoke-tests/gemini/adapter-offline-tests.mjs` | Implemented | 87 assertions across 21 test cases covering disabled-by-default fallback, fixture normalization, validation pass/fail, network/credential absence, label correctness, confirmation gate, provider-call boundary, fake-client injection, error sanitization, and one-request limit. |
| Adapter offline notes | `docs/gemini-adapter-offline-test-notes.md` | Created | Documents adapter boundary implementation, test results, SDK dependency status, and human authorization prerequisites. Historical Gemini evidence is preserved separately under `smoke-tests/extraction/`. |
| Authorization packet | `docs/gemini-live-smoke-test-authorization-packet.md` | Created | Defines prerequisites and stop conditions for any new run. It does not supersede the historical evidence preserved under `smoke-tests/extraction/`. |
| SDK/model review worksheet | `docs/gemini-sdk-model-review-worksheet.md` | Created | Provides blank review fields for SDK and model, 10 compatibility questions (all Pending), 9 unchecked approval checkboxes, and stop conditions. No values have been entered. |
| Browser application boundary | `app/src/` | Unchanged | React/Vite/TypeScript UI with local synthetic fixtures. Zero provider imports, zero credential access, zero network primitives. Confirmation gate intact. |
| Existing Gemini evidence artifacts | `smoke-tests/extraction/` | Historical | Historical Gemini live evidence is preserved here. The active ready-made demo performs no extraction and correctly shows MiniMax offline. |

## Safety-Gate Audit

| Gate | Required state | Current state | Result |
|------|---------------|---------------|--------|
| Direct Gemini enable flag | `directGeminiEnabled: true` in `config.json` | Not enabled (field absent) | BLOCKED |
| Capability approval | `capabilityReviewStatus: "approved"` for gemini | `"pending-hackathon-day"` | BLOCKED |
| Approved model identifier | Non-empty `approvedModelIdentifier` for gemini | Empty (`""`) | BLOCKED |
| Secure runtime credential | `GEMINI_API_KEY` available via secure mechanism | Not configured; not inspected | BLOCKED |
| Reviewed SDK/version | `@google/genai` reviewed against official docs | Not installed; not reviewed | BLOCKED |
| Explicit client injection | SDK client injected via `_setProviderClient()` | No client injected (`null`) | BLOCKED |
| One-request limit | `maxCalls: 1` enforced | Implemented and tested (87 assertions pass) | PASS (code ready) |
| Timeout/response bounds | 60 s timeout, 10 MB response limit | Implemented in `SAFETY_LIMITS` | PASS (code ready) |
| No automatic invocation | No provider call on import/build/test/UI | Verified: zero auto-execution paths | PASS |
| Human authorization | Explicit written approval for one bounded test | Not provided | BLOCKED |
| Sanitized evidence output | Error sanitization and response normalization applied | Implemented and tested | PASS (code ready) |

## Offline-Test Audit

- **Assertions:** 87 passed, 0 failed.
- **Test cases:** 21 (Tests 1–21).
- **What the tests prove:**
  - The adapter returns a disabled/local fallback by default.
  - Synthetic fixtures can be normalized into the provider-neutral request contract.
  - Valid extraction results pass validation; missing, malformed, and impossible values fail.
  - Uncertain values remain warnings or confidence information rather than being invented.
  - No network primitive is invoked in adapter modules.
  - No credential is required or read during default operation.
  - Exact evidence labels are present and correct.
  - The confirmation gate is not bypassed by adapter output.
  - The provider-call boundary rejects calls when any gate is unsatisfied.
  - An injected fake SDK client receives a correctly shaped request.
  - Fake SDK responses are normalized and validated; raw output is not returned.
  - Sanitized errors exclude credentials, URLs, and raw content.
  - The one-request limit is enforced.
- **What the tests do not prove:**
  - The tests do not prove that the real Gemini API works correctly.
  - The tests do not constitute direct Gemini evidence.
  - The tests do not validate SDK behavior, model capability, or response shape from a real provider.
- **Real SDK or network request:** None. All tests use fake clients and synthetic data. Zero network calls occurred.

## Browser-Boundary Audit

| Check | Result | Basis |
|-------|--------|-------|
| No provider SDK import in `app/src/` | PASS | Zero imports from `smoke-tests/gemini/` or any provider SDK in `app/src/` |
| No credential access in `app/src/` | PASS | Zero matches for `API_KEY`, `api_key`, `secret`, `credential`, `Bearer`, `Authorization` |
| No network primitive in `app/src/` | PASS | Zero matches for `fetch(`, `XMLHttpRequest`, `axios`, `node:http`, `node:https` |
| Confirmation gate remains intact | PASS | `DISABLED_MESSAGE = 'Confirm itinerary first'` in `labels.ts`; `userConfirmed` state gates downstream panels in `App.tsx` |
| No external action exists | PASS | `FINAL_STATEMENT` in `labels.ts`: "No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only." |

## Evidence Boundary

The following evidence labels are preserved:

- `OpenRouter temporary path — not direct Gemini validation`
- `Synthetic local placeholder — not direct Gemini evidence`
- `Synthetic local placeholder — not Nosana evidence`
- `Synthetic local placeholder — not Atlas Sandbox evidence`

Status statements:

- Historical Gemini live evidence is preserved under `smoke-tests/extraction/`; this audit did not make a fresh provider call.
- Historical Nosana evidence is reconciled; the current runtime fixture is a permitted dry-run preview with no submitted job ID.
- Historical Atlas Sandbox Search→Verify evidence returned 20 offers and then `PRICE_CONFIRMATION_REQUIRED`, with no write. The most recent Aug 28 attempt was an environment-switch failure, not fresh evidence.
- The ready-made browser demo performs no extraction and correctly shows MiniMax offline.
- Offline fake-client tests are not provider evidence. They validate adapter logic with synthetic data only.
- No status may be upgraded by this audit. All provider statuses remain as previously recorded.

## Blockers Before Live Test

The following prerequisites remain unresolved:

1. Official `@google/genai` SDK/version review against https://ai.google.dev/gemini-api/docs.
2. Official model/capability review confirming image input and structured JSON Schema output.
3. Capability approval: set `gemini.capabilityReviewStatus` to `"approved"` in `provider-capabilities.json`.
4. Explicit configuration enablement: set `directGeminiEnabled: true` in `config.json`.
5. Secure runtime credential setup: `GEMINI_API_KEY` available via secure mechanism without exposing its value.
6. Cost/quota/permission/data-handling review: confirm acceptable cost, quota, permissions, and data retention.
7. SDK installation and wiring (if approved): install `@google/genai` and inject the client behind the existing DI seam.
8. Exact one-request authorization: human authorizes exactly one bounded smoke-test command.
9. Explicit execution command: a manual, separate command that is not triggered by import, build, test, or UI.
10. Human review of sanitized results: review the normalized output before any documentation status change.

## Verdict

`NOT READY — offline implementation is ready for review, but live Gemini execution remains gated by unresolved human prerequisites.`

## Human Next Action

"Complete the SDK/model worksheet and authorization packet manually. Do not install the SDK, configure credentials, or execute a request until every gate is reviewed and approved."
