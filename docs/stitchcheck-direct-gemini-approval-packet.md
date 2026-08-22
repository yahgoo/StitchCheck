# StitchCheck — Direct Gemini Approval Packet

> **Status:** NOT READY — PREREQUISITES UNMET  
> **Date:** 2026-08-21  
> **Scope:** Exact information needed to authorize one bounded direct Gemini extraction call.  
> **Constraint:** No Gemini call was made. No SDK installed. No model approved. This document is a preparation artifact only.

---

## 1. Required SDK and Version

| Item | Value |
|------|-------|
| **Package name** | `@google/genai` |
| **Install location** | `smoke-tests/gemini/` (or workspace-level) |
| **Current status** | **NOT INSTALLED** |
| **Version** | Human must verify latest version at https://www.npmjs.com/package/@google/genai before installation. |
| **Install command** | `cd smoke-tests/gemini && npm install @google/genai` |

## 2. Required Model Identifier and Configuration Location

| Item | Value |
|------|-------|
| **Approved model identifier** | **UNRESOLVED — not yet approved** |
| **Configuration file** | `smoke-tests/gemini/provider-capabilities.json` |
| **Configuration field** | `providers.gemini.approvedModelIdentifier` |
| **Current value** | `""` (empty string) |
| **Capability review status** | `"pending-hackathon-day"` (not `"approved"`) |

**The model identifier is NOT verified.** Candidate models (e.g., `gemini-2.0-flash`, `gemini-1.5-pro`) must be confirmed by a human against the official Gemini API documentation to support both (a) image input and (b) structured JSON output before approval.

## 3. Required Environment Variable Name

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `GEMINI_API_KEY` | YES | Runtime credential for Gemini API authentication. |

- **Presence verified:** `GEMINI_API_KEY` variable name exists in `.env.local` (grep count = 1).
- **Value not read, not exposed, not logged.**
- **Also listed in `.env.example`** with empty value (credential placeholder).

## 4. Exact Request Shape

The adapter builds the following payload via `_buildProviderRequest()`:

```json
{
  "model": "<approved-model-identifier>",
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "<extraction instruction + JSON schema constraint>"
        },
        {
          "inlineData": {
            "data": "<image bytes as Uint8Array>",
            "mimeType": "image/png"
          }
        }
      ]
    }
  ]
}
```

The extraction instruction asks for a JSON object matching the `ExtractionResult` contract. No booking, payment, or write instruction is included.

## 5. Structured-Output / Schema Configuration

**Not yet configured.** The adapter currently relies on a **prompt-level JSON instruction** only:

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
- Whether to use native structured output via `generationConfig.responseSchema` (if the approved model supports it).
- Whether to set `generationConfig.responseMimeType: "application/json"`.
- Whether the prompt-level instruction is sufficient.

## 6. Safety Settings

**Not yet configured.** The adapter does not currently set `safetySettings`.

**Before execution, the human must decide acceptable thresholds for:**
- `HARM_CATEGORY_HARASSMENT`
- `HARM_CATEGORY_HATE_SPEECH`
- `HARM_CATEGORY_SEXUALLY_EXPLICIT`
- `HARM_CATEGORY_DANGEROUS_CONTENT`

Each category supports: `BLOCK_NONE`, `BLOCK_ONLY_HIGH`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_LOW_AND_ABOVE`.

## 7. Input Fixture

| Item | Value |
|------|-------|
| **Fixture ID** | `gem-01-two-leg-clean` |
| **File** | `smoke-tests/gemini/fixtures/gem-01-two-leg-clean.png` |
| **Description** | Clear fictional two-leg itinerary screenshot |
| **Content** | Synthetic flight itinerary with two legs, all fields readable |
| **PII** | None — entirely fictional airports, flight numbers, times |

## 8. Expected Output Schema

The adapter expects `result.text` to contain a JSON object (optionally wrapped in markdown fences):

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
  "syntheticDemo": true
}
```

The adapter parses, normalizes, validates, and freezes the result. Raw provider output is never returned.

## 9. Sanitization Rules

The adapter implements the following sanitization pipeline:

1. **Markdown fence stripping:** Removes ` ```json ` and ` ``` ` wrappers from provider text output.
2. **Error message sanitization** (`_sanitizeError()`):
   - Strips `sk-*` patterns (API key patterns)
   - Strips `AIza*` patterns (Google API key patterns)
   - Strips `Bearer <token>` patterns
   - Strips all URLs (`https?://...`)
   - Strips email addresses
   - Strips stack traces
   - Collapses excessive newlines
3. **Response size limit:** 10 MB maximum (`maxResponseBytes: 10 * 1024 * 1024`).
4. **Result validation:** All parsed results pass through `validateExtractionResult()` before being returned.
5. **Object freezing:** All results are `Object.freeze()`-d to prevent mutation.

## 10. Exact One-Call Command

**Not yet available.** The execution entry point must be created before the command can run.

**Planned command (after Phase C of the readiness plan):**

```bash
cd smoke-tests/gemini && node run-direct-gemini.mjs --fixture gem-01-two-leg-clean.png
```

This entry point does not yet exist and must be created. It will:
1. Import `@google/genai` and instantiate the client.
2. Inject the client via `_setProviderClient()`.
3. Inject a credential loader via `_setCredentialLoader()`.
4. Load the specified fixture.
5. Call `directGeminiAdapter.extract()` exactly once.
6. Write sanitized result to `smoke-tests/gemini/results/<UTC-timestamp>/`.
7. Exit immediately (no retry, no polling).

## 11. Expected Evidence Output Path

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

## 12. Cost-Control and Timeout Rules

| Parameter | Value | Source |
|-----------|-------|--------|
| Request timeout | 60,000 ms (60 seconds) | `SAFETY_LIMITS.requestTimeoutMs` |
| Maximum retries | 0 (single request only) | `SAFETY_LIMITS.maxRetries` |
| Maximum calls per execution | 1 | `SAFETY_LIMITS.maxCalls` |
| Maximum response size | 10 MB | `SAFETY_LIMITS.maxResponseBytes` |
| Estimated cost per call | Free tier: $0.00; Paid: varies by model | Google AI pricing |
| Hard cost ceiling | Human must set before execution | Approval decision |

## 13. Human Approval Question

**Before any direct Gemini call, the human must answer ALL of the following:**

1. **Model:** Which specific Gemini model is approved for this extraction? (e.g., `gemini-2.0-flash`, `gemini-1.5-pro`)
2. **Capabilities:** Has the human confirmed that the approved model supports both (a) image input and (b) structured JSON output?
3. **Safety settings:** What `safetySettings` thresholds are acceptable?
4. **Generation config:** Should native structured output be used, or is the prompt-level JSON instruction sufficient?
5. **Cost:** Is the expected cost (free or paid) acceptable for one bounded request?
6. **Data handling:** Is it acceptable to send a synthetic, PII-free flight itinerary screenshot to the Gemini API?
7. **SDK version:** Has the human reviewed and approved the `@google/genai` package version?

**If any answer is "no" or "unknown," do not proceed.**

---

## Readiness Verdict

**Direct Gemini is NOT READY for approval.**

**Specific reasons:**

1. **`@google/genai` SDK is NOT installed.** Cannot make any provider call without it.
2. **Model identifier is UNRESOLVED.** `approvedModelIdentifier` is `""`. No model has been human-approved for image input + structured JSON output.
3. **Capability review status is `"pending-hackathon-day"`.** Not `"approved"`.
4. **Config enable flag is absent.** `directGeminiEnabled` field does not exist in `config.json`.
5. **Safety settings not configured.** No `safetySettings` or `generationConfig` objects exist.
6. **Execution entry point does not exist.** `run-direct-gemini.mjs` has not been created.

**What IS ready:**
- ✅ Direct Gemini adapter fully implemented (527 lines, disabled by default).
- ✅ Provider-neutral extraction contract implemented.
- ✅ Extraction validator implemented and passing (92/92 offline tests).
- ✅ Provider-call boundary implemented (DI seam, one-request limit, timeout, sanitization).
- ✅ `GEMINI_API_KEY` variable name present in `.env.local`.
- ✅ Request shape, response parsing, and normalization fully designed.
- ✅ Error sanitization covers all known credential/URL/PII patterns.

---

- **Created:** 2026-08-21
- **Author:** Final verification lead
- **No direct Gemini call was made during this review. No SDK was installed. No model was approved.**
