# StitchCheck — Direct Gemini Final Readiness Audit

> **Status:** NOT READY — SIX PREREQUISITES UNMET  
> **Date:** 2026-08-21  
> **Scope:** Exhaustive audit of every prerequisite for one bounded direct Gemini extraction call.  
> **Constraint:** No Gemini call was made. No SDK installed. No secret values read. No existing file modified.  
> **Supersedes:** `docs/stitchcheck-direct-gemini-approval-packet.md` (preparation artifact only).

---

## 1. Required SDK and Version

| Item | Value |
|------|-------|
| **Package name** | `@google/genai` |
| **Install location** | `smoke-tests/gemini/` (local to harness) |
| **Current status** | **NOT INSTALLED** — `package.json` `dependencies` is `{}` |
| **Version** | Human must verify latest version at https://www.npmjs.com/package/@google/genai before installation |
| **Install command** | `cd smoke-tests/gemini && npm install @google/genai` |
| **Import isolation** | The real SDK import is isolated behind the future execution entry point (`run-direct-gemini.mjs`); no source file currently imports `@google/genai` |

**Blocker:** SDK must be installed before any provider call can occur.

---

## 2. Model Identifier

| Item | Value |
|------|-------|
| **Approved model identifier** | **UNRESOLVED — empty string** |
| **Configuration file** | `smoke-tests/gemini/provider-capabilities.json` |
| **Configuration field** | `providers.gemini.approvedModelIdentifier` |
| **Current value** | `""` |
| **Capability review status** | `"pending-hackathon-day"` (not `"approved"`) |
| **Capability reviewed by** | `""` (empty) |
| **Capability review date** | `""` (empty) |
| **Capability source** | `"official Gemini API documentation (not yet reviewed)"` |

**For reference — OpenRouter temporary path model:** `google/gemini-3.7-flash` (approved for the OpenRouter proxy path only; this is a different provider with a different identifier namespace).

**Blocker:** A human must select and approve a specific Gemini model identifier (e.g., `gemini-2.0-flash`, `gemini-1.5-pro`) after confirming it supports both (a) image input and (b) structured JSON output via the official Gemini API documentation at https://ai.google.dev/gemini-api/docs.

---

## 3. Structured-Output Configuration

**Current state:** Prompt-level JSON instruction only. No native structured-output configuration exists.

The adapter's `_buildExtractionPrompt()` embeds the full `ExtractionResult` JSON schema inline in the text prompt:

```
Return ONLY a JSON object with this schema: {
  "extractionStatus": "success" | "partial" | "invalid" | "error",
  "firstLeg": { "origin": "", "destination": "", "date": "YYYY-MM-DD", ... },
  "secondLeg": { ... },
  "connectionDurationMinutes": <number | null>,
  "missingFields": ["<field>"],
  "fieldConfidence": { "overall": "high" | "medium" | "low" },
  "validationMessages": ["<message>"],
  "requiresUserConfirmation": true,
  "syntheticDemo": true
}
```

**Before execution, the human must decide:**

| Decision | Options | Current state |
|----------|---------|---------------|
| Native structured output | Use `generationConfig.responseSchema` + `generationConfig.responseMimeType: "application/json"` if the approved model supports it | **Not configured** |
| Prompt-level instruction | Rely on the inline JSON schema in the prompt text | **Implemented** (present in `_buildExtractionPrompt()`) |
| Hybrid | Native structured output with prompt-level fallback | **Not configured** |

**Note:** The `_buildProviderRequest()` method currently constructs the payload without a `generationConfig` object. If native structured output is chosen, the entry point must add it.

---

## 4. Safety Settings

**Current state:** Not configured. The adapter does not set `safetySettings` in the request payload.

**Before execution, the human must decide acceptable thresholds for:**

| Category | Options |
|----------|---------|
| `HARM_CATEGORY_HARASSMENT` | `BLOCK_NONE`, `BLOCK_ONLY_HIGH`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_LOW_AND_ABOVE` |
| `HARM_CATEGORY_HATE_SPEECH` | `BLOCK_NONE`, `BLOCK_ONLY_HIGH`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_LOW_AND_ABOVE` |
| `HARM_CATEGORY_SEXUALLY_EXPLICIT` | `BLOCK_NONE`, `BLOCK_ONLY_HIGH`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_LOW_AND_ABOVE` |
| `HARM_CATEGORY_DANGEROUS_CONTENT` | `BLOCK_NONE`, `BLOCK_ONLY_HIGH`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_LOW_AND_ABOVE` |

**Recommendation for synthetic, PII-free flight itinerary extraction:** `BLOCK_ONLY_HIGH` for all categories is a reasonable default, as the input is a fictional itinerary screenshot with no sensitive content.

---

## 5. Direct Execution Entry Point

**Current state:** Does not exist.

| Item | Value |
|------|-------|
| **Planned file** | `smoke-tests/gemini/run-direct-gemini.mjs` |
| **Exists** | **No** — glob search returned zero results |
| **Planned command** | `cd smoke-tests/gemini && node run-direct-gemini.mjs --fixture gem-01-two-leg-clean.png` |

**The entry point must perform exactly these steps:**

1. Import `@google/genai` and instantiate the Gemini client.
2. Inject the client via `_setProviderClient()` on the adapter.
3. Inject a credential loader via `_setCredentialLoader()` that reads `GEMINI_API_KEY` from `.env.local` (never printed or logged).
4. Load the specified PNG fixture as a `Uint8Array`.
5. Call `directGeminiAdapter.extract()` exactly once.
6. Write sanitized result to `smoke-tests/gemini/results/<UTC-timestamp>/`.
7. Exit immediately (no retry, no polling, no background calls).

**Authorization gates the entry point must verify before calling:**

| Gate | Source | Current value |
|------|--------|---------------|
| `config.directGeminiEnabled === true` | `config.json` | **Field does not exist** |
| `providers.gemini.capabilityReviewStatus === "approved"` | `provider-capabilities.json` | `"pending-hackathon-day"` |
| `providers.gemini.approvedModelIdentifier` is non-empty | `provider-capabilities.json` | `""` |
| `GEMINI_API_KEY` available at runtime | `.env.local` | Variable name exists; value not read |
| SDK client injected | Runtime | No SDK installed |

---

## 6. Exact Fixture and Expected Schema

### Input fixture

| Item | Value |
|------|-------|
| **Primary fixture ID** | `gem-01-two-leg-clean` |
| **File** | `smoke-tests/gemini/fixtures/gem-01-two-leg-clean.png` |
| **Format** | PNG (960×560) |
| **Description** | Clear fictional two-leg itinerary screenshot |
| **Content** | Synthetic flight itinerary with two legs, all fields readable |
| **PII** | None — entirely fictional airports, flight numbers, times |
| **Watermark** | "SYNTHETIC FIXTURE — NOT REAL DATA — NO PII" |

**All five available fixtures:**

| Fixture ID | File | Test IDs | Description |
|------------|------|----------|-------------|
| `gem-01-two-leg-clean` | `gem-01-two-leg-clean.png` | GEM-01, GEM-08 | Clear fictional two-leg itinerary |
| `gem-02-missing-optional` | `gem-02-two-leg-missing-optional.png` | GEM-02 | One optional field absent |
| `gem-03-fragmented` | `gem-03-two-leg-fragmented.png` | GEM-03 | Fragmented fictional layout |
| `gem-04-non-itinerary` | `gem-04-non-itinerary.png` | GEM-04 | Not a flight itinerary |
| `gem-05-unreadable-field` | `gem-05-unreadable-field.png` | GEM-05 | One unreadable required field |

### Expected output schema

The adapter's `_normalizeProviderResult()` produces a frozen `ExtractionResult`:

```json
{
  "extractionStatus": "success",
  "firstLeg": {
    "origin": "AAA",
    "destination": "BBB",
    "date": "2026-03-15",
    "departureTime": "08:30",
    "arrivalTime": "11:45",
    "airline": "FictionAir",
    "flightNumber": "FA-101"
  },
  "secondLeg": {
    "origin": "BBB",
    "destination": "CCC",
    "date": "2026-03-15",
    "departureTime": "13:00",
    "arrivalTime": "16:15",
    "airline": "FictionAir",
    "flightNumber": "FA-202"
  },
  "connectionDurationMinutes": 75,
  "missingFields": [],
  "fieldConfidence": { "overall": "high" },
  "validationMessages": [],
  "requiresUserConfirmation": true,
  "syntheticDemo": true,
  "sourceStatus": {
    "provider": "gemini",
    "label": "Direct Gemini validation",
    "executed": true,
    "enabled": true,
    "authorizationKey": "GEMINI_API_KEY",
    "fallbackUsed": false
  },
  "label": "Direct Gemini validation"
}
```

**Mandatory result invariants (enforced by `schema-validator.mjs` and `extraction-validator.mjs`):**

- `extractionStatus` ∈ `{ "success", "partial", "invalid", "error", "disabled" }`
- `firstLeg` and `secondLeg` each contain required fields: `origin`, `destination`, `date` (ISO-8601), `departureTime` (HH:MM), `arrivalTime` (HH:MM)
- Optional leg fields: `airline`, `flightNumber` (non-empty strings when present)
- `connectionDurationMinutes`: non-negative number ≤ 1440 when status is `"success"`
- `missingFields`: array of non-empty strings
- `fieldConfidence`: object with string or finite-number values
- `validationMessages`: array of non-empty strings
- `requiresUserConfirmation`: must be `true`
- `syntheticDemo`: must be `true`
- Result is `Object.freeze()`-d

---

## 7. Evidence Output Path

```
smoke-tests/gemini/results/<UTC-timestamp>/
├── direct-gemini-result.json    # Sanitized, normalized ExtractionResult
└── direct-gemini-evidence.md    # Human-readable evidence record
```

**`direct-gemini-result.json` must contain:**

| Field | Required value |
|-------|----------------|
| `sourceStatus.provider` | `"gemini"` |
| `sourceStatus.label` | `"Direct Gemini validation"` |
| `sourceStatus.executed` | `true` |
| `label` | `"Direct Gemini validation"` |
| `extractionStatus` | `"success"` or `"partial"` (not `"disabled"` or `"error"`) |
| `requiresUserConfirmation` | `true` |
| `syntheticDemo` | `true` |
| Schema validation | Passes `schema-validator.mjs` |

**Existing results directory:** `smoke-tests/gemini/results/` already contains OpenRouter temporary-path results (`results.json`, `evidence-stub.md`). Direct Gemini results will be written to a new UTC-timestamped subdirectory and will never be merged with or relabelled as OpenRouter results.

---

## 8. Whether One Successful Call Is Enough for Demo Evidence

**Yes.** One successful call with fixture `gem-01-two-leg-clean` is sufficient for demo evidence, provided:

1. The result passes `schema-validator.mjs` validation.
2. `extractionStatus` is `"success"` or `"partial"`.
3. `sourceStatus.executed` is `true`.
4. The evidence file is written to the timestamped output directory.
5. The result is clearly labelled `"Direct Gemini validation"` (not merged with OpenRouter results).

**Safety constraints on that single call:**

| Parameter | Value | Source |
|-----------|-------|--------|
| Request timeout | 60,000 ms (60 s) | `SAFETY_LIMITS.requestTimeoutMs` |
| Maximum retries | 0 (single request) | `SAFETY_LIMITS.maxRetries` |
| Maximum calls per execution | 1 | `SAFETY_LIMITS.maxCalls` |
| Maximum response size | 10 MB | `SAFETY_LIMITS.maxResponseBytes` |
| Estimated cost | Free tier: $0.00; Paid: varies by model | Google AI pricing |

---

## Readiness Verdict

### NOT READY — Six blockers remain

| # | Blocker | Current state | Required state |
|---|---------|---------------|----------------|
| 1 | `@google/genai` SDK not installed | `dependencies: {}` in `package.json` | SDK installed, version human-approved |
| 2 | Model identifier unresolved | `approvedModelIdentifier: ""` | Non-empty, human-approved model string |
| 3 | Capability review not approved | `capabilityReviewStatus: "pending-hackathon-day"` | `"approved"` with reviewer name and date |
| 4 | Config enable flag absent | `directGeminiEnabled` field does not exist in `config.json` | `directGeminiEnabled: true` |
| 5 | Safety settings not configured | No `safetySettings` in adapter or request payload | Human-decided thresholds set |
| 6 | Execution entry point missing | `run-direct-gemini.mjs` does not exist | File created with the seven-step execution sequence |

### What IS ready

| Component | Status | Evidence |
|-----------|--------|----------|
| Direct Gemini adapter | ✅ Fully implemented (527 lines) | `direct-gemini-adapter.mjs` |
| Provider-neutral extraction contract | ✅ Implemented | `extraction-contract.mjs` |
| Extraction validator | ✅ 92/92 offline tests passing | `extraction-validator.mjs`, `adapter-offline-tests.mjs` |
| Schema validator | ✅ Implemented with self-check | `schema-validator.mjs` |
| Provider-call boundary | ✅ DI seam, one-request limit, timeout, sanitization | `createProviderCallFunction()` in adapter |
| Error sanitization | ✅ Covers `sk-*`, `AIza*`, `Bearer`, URLs, emails, stack traces | `_sanitizeError()` in adapter |
| `GEMINI_API_KEY` variable name | ✅ Present in `.env.local` (value not read) | Confirmed by grep count = 1 |
| Request shape design | ✅ Fully specified | `_buildProviderRequest()` in adapter |
| Response parsing and normalization | ✅ Fully specified | `_parseProviderText()`, `_normalizeProviderResult()` |
| Synthetic fixtures | ✅ Five PNG fixtures, all PII-free | `fixtures/gem-01` through `gem-05` |
| Result labelling | ✅ `"Direct Gemini validation"` never merged with OpenRouter | `EXTRACTION_LABELS` in contract |
| Cost-control rules | ✅ Recorded as frozen `SAFETY_LIMITS` | Adapter constants |

---

## Human Approval Checklist

Before any direct Gemini call, the human must answer ALL of the following:

1. **Model:** Which specific Gemini model is approved? (e.g., `gemini-2.0-flash`, `gemini-1.5-pro`)
2. **Capabilities:** Has the human confirmed the model supports both (a) image input and (b) structured JSON output?
3. **Safety settings:** What `safetySettings` thresholds are acceptable?
4. **Generation config:** Native structured output, or prompt-level JSON instruction sufficient?
5. **Cost:** Is the expected cost (free or paid) acceptable for one bounded request?
6. **Data handling:** Is it acceptable to send a synthetic, PII-free flight itinerary screenshot to the Gemini API?
7. **SDK version:** Has the human reviewed and approved the `@google/genai` package version?

**If any answer is "no" or "unknown," do not proceed.**

---

## File Ownership Declaration

| File | Action | Owner |
|------|--------|-------|
| `docs/stitchcheck-direct-gemini-final-readiness.md` | **CREATED** | This audit (current chat) |
| `docs/stitchcheck-direct-gemini-approval-packet.md` | Read only | Prior audit |
| `smoke-tests/gemini/*` (all files) | Read only | Gemini smoke-test harness |
| `.env.local` | Not read | Environment configuration |
| `app/src/*` | Not touched | UI application |
| Nosana, deck, video files | Not touched | Separate chat ownership |

---

- **Created:** 2026-08-21
- **Author:** Direct Gemini readiness audit (current chat)
- **No direct Gemini call was made. No SDK was installed. No model was approved. No secret was read. No existing file was modified.**
