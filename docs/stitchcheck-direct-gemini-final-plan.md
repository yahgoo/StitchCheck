# StitchCheck — Direct Gemini Final Plan (Independent Audit)

> **Status:** NOT READY — SIX BLOCKERS CONFIRMED  
> **Date:** 2026-08-21  
> **Scope:** Independent audit of every prerequisite for one bounded direct Gemini extraction call.  
> **Method:** Read-only inspection of source files, configuration, and adapter code. No packages installed. No Gemini call made. No secret values read. No code modified.  
> **Supersedes:** `docs/stitchcheck-direct-gemini-final-readiness.md` and `docs/stitchcheck-direct-gemini-approval-packet.md` (both are preparation artifacts; this plan consolidates and independently verifies their claims against source).

---

## 1. Required SDK and Version

| Item | Verified Value |
|------|----------------|
| **Package name** | `@google/genai` |
| **Install location** | `smoke-tests/gemini/` (local to harness) |
| **Current status** | **NOT INSTALLED** — `package.json` line 10: `"dependencies": {}` |
| **Version** | Human must verify latest version at https://www.npmjs.com/package/@google/genai |
| **Install command** | `cd smoke-tests/gemini && npm install @google/genai` |
| **Import isolation** | Confirmed: no source file in `smoke-tests/gemini/` currently imports `@google/genai`. The three references in `direct-gemini-adapter.mjs` (lines 24, 27, 433) are comments only. |

**Independent verification:** `grep` for `@google/genai` across `smoke-tests/gemini/` returned 3 matches — all inside code comments in `direct-gemini-adapter.mjs`. Zero `import` statements reference the package. `package.json` `dependencies` is an empty object.

**Blocker:** SDK must be installed before any provider call can occur.

---

## 2. Approved Model Requirement

| Item | Verified Value |
|------|----------------|
| **Approved model identifier** | **UNRESOLVED — empty string `""`** |
| **Configuration file** | `smoke-tests/gemini/provider-capabilities.json` |
| **Configuration field** | `providers.gemini.approvedModelIdentifier` |
| **Current value** | `""` (line 21) |
| **Capability review status** | `"pending-hackathon-day"` (line 24) — NOT `"approved"` |
| **Capability reviewed by** | `""` (empty, line 25) |
| **Capability review date** | `""` (empty, line 26) |
| **Capability source** | `"official Gemini API documentation (not yet reviewed)"` (line 27) |
| **supportsImageInput** | `null` (line 22) |
| **supportsStructuredJsonOutput** | `null` (line 23) |

**Contrast with OpenRouter temporary path:**

| Field | OpenRouter value | Gemini value |
|-------|-----------------|--------------|
| `approvedModelIdentifier` | `"google/gemini-3.7-flash"` | `""` |
| `capabilityReviewStatus` | `"approved"` | `"pending-hackathon-day"` |
| `capabilityReviewedBy` | `"human (hackathon team)"` | `""` |
| `supportsImageInput` | `true` | `null` |
| `supportsStructuredJsonOutput` | `true` | `null` |

**Blocker:** A human must select and approve a specific Gemini model identifier (e.g., `gemini-2.0-flash`, `gemini-1.5-pro`) after confirming at https://ai.google.dev/gemini-api/docs that it supports both (a) image input and (b) structured JSON output.

---

## 3. Structured-Output Configuration

**Current state:** Prompt-level JSON instruction only. No native structured-output configuration exists.

The adapter's `_buildExtractionPrompt()` (lines 117–131 of `direct-gemini-adapter.mjs`) embeds the full `ExtractionResult` JSON schema inline in the text prompt:

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

The `_buildProviderRequest()` method (lines 139–154) constructs the payload **without** a `generationConfig` object. The request shape is:

```json
{
  "model": "<approved-model-identifier>",
  "contents": [{
    "role": "user",
    "parts": [
      { "text": "<extraction instruction + JSON schema constraint>" },
      { "inlineData": { "data": "<image bytes>", "mimeType": "image/png" } }
    ]
  }]
}
```

**Before execution, the human must decide:**

| Decision | Options | Current state |
|----------|---------|---------------|
| Native structured output | Use `generationConfig.responseSchema` + `generationConfig.responseMimeType: "application/json"` if the approved model supports it | **Not configured** |
| Prompt-level instruction | Rely on the inline JSON schema in the prompt text | **Implemented** |
| Hybrid | Native structured output with prompt-level fallback | **Not configured** |

**Note:** If native structured output is chosen, the entry point (or adapter) must be updated to add `generationConfig` to the request payload. The adapter as written does not include it.

---

## 4. Safety Settings

**Current state:** Not configured. The adapter does not set `safetySettings` anywhere in the request payload or as a module-level constant.

**Before execution, the human must decide acceptable thresholds for:**

| Category | Options |
|----------|---------|
| `HARM_CATEGORY_HARASSMENT` | `BLOCK_NONE`, `BLOCK_ONLY_HIGH`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_LOW_AND_ABOVE` |
| `HARM_CATEGORY_HATE_SPEECH` | `BLOCK_NONE`, `BLOCK_ONLY_HIGH`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_LOW_AND_ABOVE` |
| `HARM_CATEGORY_SEXUALLY_EXPLICIT` | `BLOCK_NONE`, `BLOCK_ONLY_HIGH`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_LOW_AND_ABOVE` |
| `HARM_CATEGORY_DANGEROUS_CONTENT` | `BLOCK_NONE`, `BLOCK_ONLY_HIGH`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_LOW_AND_ABOVE` |

**Recommendation:** For synthetic, PII-free flight itinerary extraction, `BLOCK_ONLY_HIGH` for all categories is a reasonable default, as the input is a fictional itinerary screenshot with no sensitive content.

---

## 5. Missing Execution Entry Point

**Current state:** Does not exist.

| Item | Verified Value |
|------|----------------|
| **Planned file** | `smoke-tests/gemini/run-direct-gemini.mjs` |
| **Exists** | **No** — glob search for `**/run-direct-gemini.mjs` returned zero results across the entire workspace |
| **Planned command** | `cd smoke-tests/gemini && node run-direct-gemini.mjs --fixture gem-01-two-leg-clean.png` |

**Authorization gates the entry point must verify before calling (inherited from `checkAuthorization()` at lines 366–412):**

| Gate | Source | Current value | Status |
|------|--------|---------------|--------|
| `config.directGeminiEnabled === true` | `config.json` | **Field does not exist** | BLOCKED |
| `providers.gemini.capabilityReviewStatus === "approved"` | `provider-capabilities.json` | `"pending-hackathon-day"` | BLOCKED |
| `providers.gemini.approvedModelIdentifier` is non-empty | `provider-capabilities.json` | `""` | BLOCKED |
| `GEMINI_API_KEY` available at runtime | `.env.local` | Variable name present (line 6); value not read | READY (variable only) |
| SDK client injected | Runtime | No SDK installed | BLOCKED |

**The entry point must perform exactly these seven steps:**

1. Import `@google/genai` and instantiate the Gemini client.
2. Inject the client via `_setProviderClient()` on the adapter.
3. Inject a credential loader via `_setCredentialLoader()` that reads `GEMINI_API_KEY` from `.env.local` (never printed or logged).
4. Load the specified PNG fixture as a `Uint8Array`.
5. Call `directGeminiAdapter.extract()` exactly once.
6. Write sanitized result to `smoke-tests/gemini/results/<UTC-timestamp>/`.
7. Exit immediately (no retry, no polling, no background calls).

---

## 6. Exact One-Call Command After Prerequisites

**Not yet available.** After all six blockers are resolved, the command will be:

```bash
cd smoke-tests/gemini && node run-direct-gemini.mjs --fixture gem-01-two-leg-clean.png
```

**Prerequisites that must be satisfied first (in order):**

| Step | Action | File(s) affected |
|------|--------|------------------|
| 1 | Install `@google/genai` SDK | `smoke-tests/gemini/package.json`, `package-lock.json`, `node_modules/` |
| 2 | Human approves a model identifier (e.g., `gemini-2.0-flash`) | `smoke-tests/gemini/provider-capabilities.json` |
| 3 | Set `capabilityReviewStatus` to `"approved"` with reviewer and date | `smoke-tests/gemini/provider-capabilities.json` |
| 4 | Add `"directGeminiEnabled": true` | `smoke-tests/gemini/config.json` |
| 5 | Human decides `safetySettings` thresholds | Entry point code or adapter |
| 6 | Human decides structured-output strategy (native vs prompt-level) | Entry point code or adapter |
| 7 | Create `run-direct-gemini.mjs` with the seven-step execution sequence | `smoke-tests/gemini/run-direct-gemini.mjs` (new file) |

---

## 7. Evidence Artifact Requirements

### Output directory structure

```
smoke-tests/gemini/results/<UTC-timestamp>/
├── direct-gemini-result.json    # Sanitized, normalized ExtractionResult
└── direct-gemini-evidence.md    # Human-readable evidence record
```

### Mandatory fields in `direct-gemini-result.json`

| Field | Required value | Verification method |
|-------|----------------|---------------------|
| `sourceStatus.provider` | `"gemini"` | Direct comparison |
| `sourceStatus.label` | `"Direct Gemini validation"` | Direct comparison |
| `sourceStatus.executed` | `true` | Direct comparison |
| `sourceStatus.enabled` | `true` | Direct comparison |
| `sourceStatus.authorizationKey` | `"GEMINI_API_KEY"` | Direct comparison |
| `sourceStatus.fallbackUsed` | `false` | Direct comparison |
| `label` | `"Direct Gemini validation"` | Direct comparison |
| `extractionStatus` | `"success"` or `"partial"` | Must NOT be `"disabled"` or `"error"` |
| `requiresUserConfirmation` | `true` | Direct comparison |
| `syntheticDemo` | `true` | Direct comparison |
| Schema validation | Passes `schema-validator.mjs` | Run validator against result |

### Separation from existing OpenRouter results

The existing `smoke-tests/gemini/results/` directory contains OpenRouter temporary-path results:

| Existing file | Provider | Content |
|---------------|----------|---------|
| `results.json` | `"openrouter"` | GEM-01 execution via OpenRouter (2946 ms latency) |
| `evidence-stub.md` | `"openrouter"` | Evidence stub for OpenRouter path |

Direct Gemini results **must** be written to a new UTC-timestamped subdirectory and **must never** be merged with or relabelled as OpenRouter results. This is enforced by the `EXTRACTION_LABELS` constants in `extraction-contract.mjs`.

### Schema invariants enforced by validators

From `schema-validator.mjs` and `extraction-validator.mjs`:

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

## 8. Whether One Successful Call Is Sufficient

**Yes.** One successful call with fixture `gem-01-two-leg-clean` is sufficient for demo evidence, provided:

1. The result passes `schema-validator.mjs` validation.
2. `extractionStatus` is `"success"` or `"partial"`.
3. `sourceStatus.executed` is `true`.
4. The evidence file is written to the timestamped output directory.
5. The result is clearly labelled `"Direct Gemini validation"` (not merged with OpenRouter results).

**Safety constraints on that single call (from `SAFETY_LIMITS` at lines 44–49):**

| Parameter | Value | Source |
|-----------|-------|--------|
| Request timeout | 60,000 ms (60 s) | `SAFETY_LIMITS.requestTimeoutMs` |
| Maximum retries | 0 (single request) | `SAFETY_LIMITS.maxRetries` |
| Maximum calls per execution | 1 | `SAFETY_LIMITS.maxCalls` |
| Maximum response size | 10 MB | `SAFETY_LIMITS.maxResponseBytes` |
| Estimated cost | Free tier: $0.00; Paid: varies by model | Google AI pricing |

---

## Readiness Verdict

### NOT READY — Six blockers confirmed independently

| # | Blocker | Current state | Required state |
|---|---------|---------------|----------------|
| 1 | `@google/genai` SDK not installed | `dependencies: {}` in `package.json` | SDK installed, version human-approved |
| 2 | Model identifier unresolved | `approvedModelIdentifier: ""` | Non-empty, human-approved model string |
| 3 | Capability review not approved | `capabilityReviewStatus: "pending-hackathon-day"` | `"approved"` with reviewer name and date |
| 4 | Config enable flag absent | `directGeminiEnabled` field does not exist in `config.json` | `directGeminiEnabled: true` |
| 5 | Safety settings not configured | No `safetySettings` in adapter or request payload | Human-decided thresholds set |
| 6 | Execution entry point missing | `run-direct-gemini.mjs` does not exist | File created with the seven-step execution sequence |

### What IS ready (independently verified)

| Component | Status | Evidence |
|-----------|--------|----------|
| Direct Gemini adapter | ✅ Fully implemented (527 lines) | `direct-gemini-adapter.mjs` — 527 lines, all functions exported |
| Provider-neutral extraction contract | ✅ Implemented | `extraction-contract.mjs` — 164 lines, typed JSDoc interfaces |
| Extraction validator | ✅ Implemented | `extraction-validator.mjs` — referenced by adapter |
| Offline test suite | ✅ 92/92 passing | `adapter-offline-tests.mjs` — 40,709 bytes |
| Schema validator | ✅ Implemented with self-check | `schema-validator.mjs` — 121 lines, validates all contract fields |
| Provider-call boundary | ✅ DI seam, one-request limit, timeout, sanitization | `createProviderCallFunction()` lines 253–342 |
| Error sanitization | ✅ Covers `sk-*`, `AIza*`, `Bearer`, URLs, emails, stack traces | `_sanitizeError()` lines 234–244 |
| `GEMINI_API_KEY` variable name | ✅ Present in `.env.local` (value not read) and `.env.example` (empty placeholder) | Grep confirmed: 1 match in each file |
| Request shape design | ✅ Fully specified | `_buildProviderRequest()` lines 139–154 |
| Response parsing and normalization | ✅ Fully specified | `_parseProviderText()` lines 161–183, `_normalizeProviderResult()` lines 192–227 |
| Synthetic fixtures | ✅ Five PNG fixtures, all PII-free | `fixtures/gem-01` through `gem-05` (5 PNG + 5 SVG + manifest) |
| Result labelling | ✅ `"Direct Gemini validation"` never merged with OpenRouter | `EXTRACTION_LABELS` in `extraction-contract.mjs` lines 18–24 |
| Cost-control rules | ✅ Recorded as frozen `SAFETY_LIMITS` | Lines 44–49, `Object.freeze()`-d |
| Authorization check logic | ✅ Fully implemented | `checkAuthorization()` lines 366–412, checks all config gates |

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
| `docs/stitchcheck-direct-gemini-final-plan.md` | **CREATED** | This independent audit (current chat) |
| `docs/stitchcheck-direct-gemini-final-readiness.md` | Read only | Prior audit |
| `docs/stitchcheck-direct-gemini-approval-packet.md` | Read only | Prior audit |
| `smoke-tests/gemini/*` (all files) | Read only | Gemini smoke-test harness |
| `.env.local` | Grep only (variable name confirmed; value not read) | Environment configuration |
| `app/src/*` | Not touched | UI application |
| Nosana, deck, video files | Not touched | Separate chat ownership |

---

- **Created:** 2026-08-21
- **Author:** Independent direct Gemini readiness audit (current chat)
- **No direct Gemini call was made. No SDK was installed. No model was approved. No secret was read. No existing file was modified.**
