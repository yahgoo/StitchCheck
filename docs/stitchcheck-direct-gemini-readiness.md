# Direct Gemini Readiness — StitchCheck

> **Scope:** Read-only audit of the direct-Gemini integration path.
> **No provider call was made. No credential was configured or exposed. No file other than this document was created or modified.**

---

## 1. Current Status

| Item | Status | Detail |
|------|--------|--------|
| Direct Gemini adapter module | **Implemented** | `smoke-tests/gemini/direct-gemini-adapter.mjs` — 527 lines, disabled by default. |
| Provider-neutral extraction contract | **Implemented** | `smoke-tests/gemini/extraction-contract.mjs` — typed `ExtractionAdapter` interface, shared by both OpenRouter and direct Gemini paths. |
| Extraction validator | **Implemented** | `smoke-tests/gemini/extraction-validator.mjs` and `schema-validator.mjs` — field, date/time, duration, confidence, and gate validation. |
| Offline test suite | **87 assertions pass** | `smoke-tests/gemini/adapter-offline-tests.mjs` — 21 test cases, zero network calls, zero credentials. |
| Provider-call boundary | **Implemented** | Dependency-injection seam (`_setProviderClient`), credential loader (`_setCredentialLoader`), one-request limit, 60 s timeout, 10 MB response cap, error sanitization. |
| `@google/genai` SDK | **Not installed** | DI seam only. No real SDK import exists in any module. |
| Safety settings (Gemini `safetySettings` / `generationConfig`) | **Not configured** | Adapter relies on prompt-level JSON instruction only. No explicit `safetySettings` or `generationConfig` object is present. |
| Direct Gemini execution entry point in harness | **Not implemented** | `run-smoke-test.mjs --execute` supports OpenRouter only. No equivalent command exists for direct Gemini. |
| Capability approval (`provider-capabilities.json`) | **Pending** | `gemini.capabilityReviewStatus` = `"pending-hackathon-day"`. |
| Approved model identifier | **Blank** | `gemini.approvedModelIdentifier` = `""`. |
| Config enable flag | **Not set** | `directGeminiEnabled` field absent from `config.json`. |
| Runtime credential (`GEMINI_API_KEY`) | **Not configured** | Key name exists in `.env.example` (blank). Value not inspected. |
| Live provider call | **Never made** | Direct Gemini remains unexecuted. |

### What the offline tests prove

- Adapter returns disabled/local fallback by default.
- Synthetic fixtures normalise into the provider-neutral request contract.
- Valid extraction results pass validation; missing, malformed, and impossible values fail.
- Uncertain values remain warnings or confidence information (never invented).
- No network primitive is invoked in adapter modules.
- No credential is required or read during default operation.
- Exact evidence labels are correct.
- Confirmation gate is not bypassed by adapter output.
- Provider-call boundary rejects calls when any gate is unsatisfied.
- Injected fake SDK client receives correctly shaped request.
- Fake SDK responses are normalised and validated; raw output is not returned.
- Sanitised errors exclude credentials, URLs, and raw content.
- One-request limit is enforced.

### What the offline tests do NOT prove

- That the real Gemini API works correctly.
- That the `@google/genai` SDK behaves as expected.
- That any approved model supports both image input and structured JSON output.
- That a real provider call would succeed.

---

## 2. Missing Prerequisites

The following must be resolved before a direct Gemini call can occur. None have been resolved.

| # | Prerequisite | Current state | Action required |
|---|-------------|---------------|-----------------|
| P1 | `@google/genai` SDK reviewed against official docs | Not installed, not reviewed | Human reviews SDK version against https://ai.google.dev/gemini-api/docs |
| P2 | Image-input support confirmed for candidate model | `supportsImageInput: null` | Human confirms via official docs |
| P3 | Structured JSON output confirmed for candidate model | `supportsStructuredJsonOutput: null` | Human confirms via official docs |
| P4 | Model identifier approved | `approvedModelIdentifier: ""` | Human records exact model in `provider-capabilities.json` |
| P5 | Capability review status set to approved | `"pending-hackathon-day"` | Human sets to `"approved"` with reviewer name and date |
| P6 | Config enable flag set | Field absent | Human sets `directGeminiEnabled: true` in `config.json` |
| P7 | Runtime credential available securely | Not configured | Human places `GEMINI_API_KEY` in `.env.local` (gitignored); value never printed |
| P8 | Cost / quota / permissions / data-handling reviewed | Not reviewed | Human confirms acceptable cost, quota, scope, and retention |
| P9 | SDK client installed and wired behind DI seam | Not installed | Install `@google/genai`, instantiate client, inject via `_setProviderClient()` |
| P10 | Gemini `safetySettings` / `generationConfig` designed | Not configured | Human reviews and records acceptable safety-category thresholds and generation parameters |
| P11 | Direct Gemini execution entry point created | Not implemented | Create a bounded, explicit smoke-test command separate from `run-smoke-test.mjs --execute` (OpenRouter-only) |
| P12 | Exactly one bounded execution authorised | Not authorised | Human provides written GO decision for one request against one fixture |

---

## 3. Implementation Plan

The plan is sequential. Each step depends on the previous. No step makes a provider call.

### Phase A — Human review (no code changes)

1. **A1.** Review `@google/genai` SDK version against official Gemini API documentation. Record package name and version.
2. **A2.** Confirm the candidate model supports (a) image input and (b) structured JSON Schema output. Record evidence source and date.
3. **A3.** Review cost, quota, permissions, and data-handling implications for one bounded request.
4. **A4.** Design `safetySettings` and `generationConfig` values. Record rationale.

### Phase B — Configuration changes (no provider call)

5. **B1.** In `provider-capabilities.json`, set:
   - `providers.gemini.capabilityReviewStatus` → `"approved"`
   - `providers.gemini.approvedModelIdentifier` → exact approved model
   - `providers.gemini.supportsImageInput` → `true`
   - `providers.gemini.supportsStructuredJsonOutput` → `true`
   - `providers.gemini.capabilityReviewedBy` → reviewer name
   - `providers.gemini.capabilityReviewDate` → review date
6. **B2.** In `config.json`, add `"directGeminiEnabled": true`.
7. **B3.** Ensure `GEMINI_API_KEY` is present in `.env.local` (gitignored). Never print or log the value.

### Phase C — SDK wiring (no provider call yet)

8. **C1.** Install `@google/genai` at the reviewed version in `smoke-tests/gemini/` (or workspace-level if appropriate).
9. **C2.** Create a thin execution entry-point module (e.g., `run-direct-gemini.mjs`) that:
   - Imports the real `@google/genai` client.
   - Instantiates it with the credential from `.env.local` (never printed).
   - Injects it via `_setProviderClient()`.
   - Injects a credential loader via `_setCredentialLoader()`.
   - Applies the approved `safetySettings` and `generationConfig`.
   - Loads one synthetic fixture from `smoke-tests/gemini/fixtures/`.
   - Calls `directGeminiAdapter.extract()` exactly once.
   - Writes the sanitized, normalised result to a new timestamped directory under `smoke-tests/gemini/results/`.
   - Exits immediately after one request (success or failure). No retry, no polling.
10. **C3.** Verify the new entry point passes all offline safety checks:
    - No credential printed or logged.
    - No retry or polling loop.
    - One-request limit enforced.
    - Error sanitisation applied.
    - Response normalisation applied.

### Phase D — Single bounded execution (one provider call)

11. **D1.** Human gives explicit written GO authorisation for one request against one fixture.
12. **D2.** Human invokes the exact command (e.g., `node run-direct-gemini.mjs --fixture gem-01-two-leg-clean.png`).
13. **D3.** Harness writes evidence to `smoke-tests/gemini/results/<UTC-timestamp>/`:
    - `direct-gemini-result.json` — sanitized, normalised extraction result.
    - `direct-gemini-evidence.md` — human-readable evidence record.
14. **D4.** Human reviews sanitized output before any documentation status change.

---

## 4. Technical Details

### 4.1 Request Shape (direct Gemini adapter)

The adapter builds the following payload via `_buildProviderRequest()`:

```
{
  model: "<approved-model-identifier>",
  contents: [{
    role: "user",
    parts: [
      { text: "<extraction instruction + JSON schema>" },
      { inlineData: { data: <image bytes>, mimeType: "image/png" } }
    ]
  }]
}
```

The extraction instruction asks for a JSON object matching the `ExtractionResult` contract. No booking, payment, or write instruction is included.

### 4.2 Response Schema

The adapter expects `result.text` to contain a JSON object (optionally wrapped in markdown fences) matching the extraction contract:

```
{
  extractionStatus: "success" | "partial" | "invalid" | "error",
  firstLeg: { origin, destination, date, departureTime, arrivalTime, airline?, flightNumber? },
  secondLeg: { ... },
  connectionDurationMinutes: <number | null>,
  missingFields: [<string>],
  fieldConfidence: { overall: "high" | "medium" | "low" },
  validationMessages: [<string>],
  requiresUserConfirmation: true,
  syntheticDemo: true
}
```

The adapter parses, normalises, validates, and freezes the result. Raw provider output is never returned.

### 4.3 Safety Settings

**Not yet configured.** The adapter does not currently set `safetySettings` or `generationConfig`. Before execution, the human reviewer must decide:

- Whether to set explicit `safetySettings` (e.g., `HARM_CATEGORY_HARASSMENT: BLOCK_NONE` or another threshold).
- Whether to set `generationConfig` (e.g., `temperature: 0`, `responseMimeType: "application/json"`, `responseSchema`).
- Whether the prompt-level JSON instruction is sufficient or whether native structured output should be used.

### 4.4 Credential / Configuration Required

| Key | Location | Purpose |
|-----|----------|---------|
| `GEMINI_API_KEY` | `.env.local` (gitignored) | Runtime credential for Gemini API authentication. Value never printed, logged, or serialized. |
| `directGeminiEnabled` | `smoke-tests/gemini/config.json` | Explicit enable flag. Must be `true`. |
| `capabilityReviewStatus` | `smoke-tests/gemini/provider-capabilities.json` | Must be `"approved"`. |
| `approvedModelIdentifier` | `smoke-tests/gemini/provider-capabilities.json` | Must be a non-empty, human-approved model string. |

### 4.5 OpenRouter Extraction Contract Reuse

**Yes, the contract is fully reusable.** The extraction contract (`extraction-contract.mjs`) is provider-neutral:

- Both adapters implement the same `ExtractionAdapter` interface (`isEnabled`, `extract`, `getLabel`).
- Both produce the same `ExtractionResult` shape.
- Both use the same `ExtractionRequest` input shape.
- The validators (`extraction-validator.mjs`, `schema-validator.mjs`) are provider-agnostic.
- The only difference is transport: OpenRouter uses HTTP `fetch` with `response_format: { type: "json_schema" }`; direct Gemini uses the `@google/genai` SDK with a text prompt containing a JSON schema instruction.

### 4.6 Exact Smoke-Test Command

**Not yet available.** The current harness command:

```bash
cd smoke-tests/gemini
node run-smoke-test.mjs            # offline only — no provider call
node run-smoke-test.mjs --execute  # OpenRouter temporary path only
```

A separate direct-Gemini execution command must be created in Phase C (e.g., `node run-direct-gemini.mjs --fixture <file>`). This command does not yet exist.

The offline test suite can be run at any time:

```bash
cd smoke-tests/gemini
node adapter-offline-tests.mjs     # 87 assertions, zero network calls
```

---

## 5. Acceptance Criteria

The direct Gemini integration is considered validated when ALL of the following are true:

| # | Criterion | Current state |
|---|-----------|---------------|
| AC1 | `@google/genai` SDK reviewed and version recorded | Not done |
| AC2 | Candidate model confirmed for image input + structured JSON output | Not done |
| AC3 | `provider-capabilities.json` gemini entry fully approved | Not done |
| AC4 | `config.json` has `directGeminiEnabled: true` | Not done |
| AC5 | `GEMINI_API_KEY` present in `.env.local` (value never exposed) | Not done |
| AC6 | SDK client installed and injected behind DI seam | Not done |
| AC7 | `safetySettings` / `generationConfig` reviewed and applied | Not done |
| AC8 | Direct Gemini execution entry point created and safety-verified | Not done |
| AC9 | Exactly one bounded provider call executed against one synthetic fixture | Not done |
| AC10 | Sanitised result passes `schema-validator.mjs` validation | Not done |
| AC11 | Evidence record written to a timestamped directory with label `"Direct Gemini validation"` | Not done |
| AC12 | Human reviewer has reviewed sanitized output and signed off | Not done |
| AC13 | No credential, raw response, header, PII, or private URL appears in any artifact | Not done (verified by design; not yet tested against real output) |
| AC14 | Offline test suite still passes (87/87) after any code changes | Currently passing |

---

## 6. Claim-Safe Labels

The following labels must be used exactly as written in all artifacts. No label may be upgraded, merged, or relabelled.

| Label | When to use |
|-------|-------------|
| `"Direct Gemini validation"` | Only when a real Gemini API call has been executed, sanitized, validated, and human-reviewed. |
| `"OpenRouter temporary path — not direct Gemini validation"` | For any result from the OpenRouter temporary path. |
| `"Synthetic local placeholder — not direct Gemini evidence"` | For any disabled, fallback, or local-placeholder result from the direct Gemini adapter. |

**Current claim-safe status:**

- No artifact may claim `"Direct Gemini validation"` today. Direct Gemini remains unexecuted.
- The existing GEM-01 evidence carries the OpenRouter temporary-path label and may not be relabelled.
- All offline fake-client test results carry the synthetic-local-placeholder label and are not provider evidence.

---

## 7. Evidence Artifact Needed

To claim direct Gemini validation, the following artifact must exist:

```
smoke-tests/gemini/results/<UTC-timestamp>/
├── direct-gemini-result.json    # Sanitized, normalized ExtractionResult
└── direct-gemini-evidence.md    # Human-readable evidence record
```

**`direct-gemini-result.json` must contain:**

- `sourceStatus.provider` = `"gemini"`
- `sourceStatus.label` = `"Direct Gemini validation"`
- `sourceStatus.executed` = `true`
- `label` = `"Direct Gemini validation"`
- `extractionStatus` = `"success"` or `"partial"` (not `"disabled"` or `"error"`)
- `requiresUserConfirmation` = `true`
- `syntheticDemo` = `true`
- Passes `schema-validator.mjs` validation

**`direct-gemini-evidence.md` must contain:**

- Test ID, UTC timestamp, human approver
- Reviewed SDK/version, approved model identifier
- Fixture identifier, request count (must be 1)
- Sanitized normalized result fields
- What the result proves and does not prove
- No credential, raw response, header, PII, or private URL

---

## 8. One-Call Sufficiency

**One call is sufficient for the hackathon demo.** Rationale:

- The adapter enforces `maxCalls: 1` per execution.
- The authorization packet specifies exactly one bounded smoke-test request.
- The demo requires only one successful structured extraction from a synthetic fixture to show the end-to-end flow: image in → structured JSON out → user review → confirmation gate → downstream panels.
- A single successful call with GEM-01 (clear fictional two-leg itinerary) demonstrates that the direct Gemini path works for the happy path.
- Additional fixtures (GEM-02 through GEM-05) and edge cases (GEM-06, GEM-07) are valuable but not required for the minimum demo claim.

**Limitations of a single call:**

- Proves the happy path only. Does not prove robustness across all fixtures.
- Does not prove latency, reliability, or rate-limit behaviour.
- Does not constitute comprehensive model evaluation.

---

## 9. No-Provider-Call Statement

> **No provider call was made during this audit.** No Gemini API request, no OpenRouter request, no Nosana request, and no Atlas request was sent, attempted, or enabled. No credential was configured, read, or exposed. No SDK was installed. No configuration file was modified. This document is a read-only assessment of readiness only.

---

## 10. Summary

| Question | Answer |
|----------|--------|
| Does a direct Gemini adapter already exist? | **Yes.** Fully implemented but disabled by default. Provider-call boundary, DI seam, request shaping, response normalization, error sanitization, and safety limits are in place. |
| What model, endpoint, request shape, response schema, and safety settings are required? | Model: not yet approved (blank). Endpoint: via `@google/genai` SDK (not installed). Request: `{ model, contents: [{ role: "user", parts: [text, inlineData] }] }`. Response: JSON matching extraction contract. Safety settings: **not yet configured**. |
| Can the OpenRouter extraction contract be reused? | **Yes.** The contract is provider-neutral. Both adapters share the same interface, request shape, result shape, and validators. |
| What credential/configuration is required? | `GEMINI_API_KEY` in `.env.local`; `directGeminiEnabled: true` in `config.json`; capability approval and model identifier in `provider-capabilities.json`. No values exposed. |
| What is the exact smoke-test command? | **Not yet available.** A direct-Gemini execution entry point must be created. The offline test command (`node adapter-offline-tests.mjs`) works today. |
| What evidence artifact is needed? | A timestamped directory with a sanitized `direct-gemini-result.json` and `direct-gemini-evidence.md`, both carrying the `"Direct Gemini validation"` label, passing schema validation. |
| Is one call enough for the hackathon demo? | **Yes.** One successful extraction from GEM-01 demonstrates the end-to-end direct-Gemini path for the demo. |
