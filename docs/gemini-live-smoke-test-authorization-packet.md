# Gemini Live Smoke-Test Authorization Packet

## Purpose

This packet defines the prerequisites, configuration review surface, and authorization controls for one future, bounded direct-Gemini smoke test. It is a planning and review document only.

No live direct-Gemini test has occurred. This document is not provider evidence. No result recorded here constitutes a real Gemini API outcome. All offline fake-client tests validate adapter logic with synthetic data and are not Gemini evidence.

## Current Status

| Provider / path | Status |
|-----------------|--------|
| Direct Gemini | Historical live evidence is preserved under `smoke-tests/extraction/`. This packet governs any new run; the active ready-made demo performs no extraction and shows MiniMax offline. |
| OpenRouter temporary path | Historical GEM-01 evidence remains distinct from the active demo path. |
| Nosana | Historical evidence is reconciled. The current browser fixture is a permitted dry-run preview (`jobId: null`), not a submitted workload. |
| Atlas | Historical Sandbox Search→Verify evidence returned 20 offers then `PRICE_CONFIRMATION_REQUIRED`, with no write. The Aug 28 attempt was an environment-switch failure, not fresh evidence. |
| Offline fake-client tests | Not Gemini evidence. Validate adapter request-shaping and response-normalization with synthetic fake clients. |
| `@google/genai` SDK | Not installed. Dependency-injection seam only. |

Local fallback label for the direct Gemini adapter: `Synthetic local placeholder — not direct Gemini evidence`

## Proposed Single-Test Scope

One minimal, read-only extraction request:

- **Input:** One synthetic itinerary fixture already present in the repository (selected by the human reviewer from `smoke-tests/gemini/fixtures/`).
- **Output:** Normalized structured itinerary extraction only — `ExtractionResult` contract fields (legs, connection duration, confidence, validation messages).
- **No external action:** No booking, payment, reservation, ticket, order, verification, or external write action.
- **One request only.** Maximum request count: 1.
- **No retries, polling, background execution, or automatic invocation.** Retry count: 0.
- **Sanitized normalized evidence only.** No raw provider output, headers, tokens, credentials, private URLs, account identifiers, or PII.
- **Human review required** before any documentation status update.

No model identifier, endpoint, API version, credential value, or unverified SDK behavior is specified in this document.

## Prerequisite Checklist

### 1. Review the official `@google/genai` SDK version

- **Owner:** Human
- **Evidence required:** Recorded SDK package name and version number, reviewed against the official Gemini API documentation at https://ai.google.dev/gemini-api/docs.
- **Current status:** Pending
- **Stop condition:** If the SDK version cannot be confirmed against official documentation, stop.

### 2. Confirm image-input support

- **Owner:** Human
- **Evidence required:** Official documentation or SDK changelog confirming the reviewed version supports image input (vision) for the candidate model.
- **Current status:** Pending
- **Stop condition:** If image-input support is not confirmed for the candidate model, stop.

### 3. Confirm structured JSON Schema output support

- **Owner:** Human
- **Evidence required:** Official documentation or SDK changelog confirming the reviewed version supports structured JSON Schema output (not plain-text JSON) for the candidate model.
- **Current status:** Pending
- **Stop condition:** If structured JSON Schema output is not confirmed, stop.

### 4. Approve and record a model identifier

- **Owner:** Human
- **Evidence required:** The exact model identifier recorded in `provider-capabilities.json` under `providers.gemini.approvedModelIdentifier`, matching the model confirmed in prerequisites 2 and 3.
- **Current status:** Pending
- **Stop condition:** If no model identifier is approved, or if the approved model does not support both image input and structured output, stop.

### 5. Set capability review status to approved

- **Owner:** Human
- **Evidence required:** `provider-capabilities.json` field `providers.gemini.capabilityReviewStatus` set to `"approved"`, with reviewer name and date recorded.
- **Current status:** Pending
- **Stop condition:** If the capability review status is not `"approved"`, stop.

### 6. Enable direct Gemini explicitly

- **Owner:** Human
- **Evidence required:** `config.json` field `directGeminiEnabled` set to `true`.
- **Current status:** Pending
- **Stop condition:** If `directGeminiEnabled` is not `true`, stop.

### 7. Configure a secure runtime credential without exposing its value

- **Owner:** Human
- **Evidence required:** Confirmation that a `GEMINI_API_KEY` is available via a secure runtime mechanism (e.g., `.env.local`, which is gitignored). The credential value must not be printed, logged, serialized, or included in any output.
- **Current status:** Pending
- **Stop condition:** If no credential is available through a secure mechanism, or if the credential has been exposed in any file, log, or output, stop.

### 8. Review cost, quota, permissions, and data-handling implications

- **Owner:** Human
- **Evidence required:** Confirmation that the API key has sufficient quota for one bounded request, that costs are understood and acceptable, that permissions are scoped appropriately, and that data-retention and handling implications are reviewed.
- **Current status:** Pending
- **Stop condition:** If cost, quota, permission, retention, or data-handling implications are unclear, stop.

### 9. Wire the reviewed SDK client behind the existing DI seam

- **Owner:** Human (with Qoder implementation support)
- **Evidence required:** The real `@google/genai` SDK client instantiated and injected via `_setProviderClient()`, implementing the `MinimalGeminiClient` interface (`generateContent({ model, contents }) -> { text }`). No raw SDK import in offline tests.
- **Current status:** Pending
- **Stop condition:** If the SDK client cannot be wired behind the DI seam, or if the real SDK is imported in offline tests, stop.

### 10. Authorize exactly one bounded smoke-test command

- **Owner:** Human
- **Evidence required:** Explicit written authorization for exactly one bounded smoke-test command, specifying the fixture, model, timeout, and evidence output path. No automatic retry or polling.
- **Current status:** Pending
- **Stop condition:** If authorization is not explicit, or if more than one request could occur, stop.

### 11. Review sanitized output before changing any documentation status

- **Owner:** Human
- **Evidence required:** Human review of the sanitized normalized result (not raw provider output) before any documentation status change, evidence-label update, or readiness-report modification.
- **Current status:** Pending
- **Stop condition:** If sanitized output has not been reviewed by a human, no documentation status may change.

## Configuration Review Table

| Configuration item | Current state | Required human decision |
|--------------------|---------------|------------------------|
| `directGeminiEnabled` | Not enabled (field absent from `config.json`) | Human must set to `true` after all other prerequisites are met |
| `capabilityReviewStatus` | `"pending-hackathon-day"` | Human must set to `"approved"` after SDK/model review |
| `approvedModelIdentifier` | Empty (`""`) | Human must record the exact approved model identifier |
| SDK dependency (`@google/genai`) | Not installed | Human must install the reviewed version |
| Runtime credential (`GEMINI_API_KEY`) | Not inspected | Human must configure via secure runtime mechanism; value must not be exposed |
| Target fixture | Synthetic fixture present in `smoke-tests/gemini/fixtures/` | Human must select one fixture for the single test |
| Request count | Zero (no request made) | Maximum: one |
| Retry count | Zero | Must remain zero |
| Timeout limit | 60,000 ms (existing adapter safety limit) | Subject to human review; may be adjusted before execution |
| Response size limit | 10 MB (existing adapter safety limit) | Subject to human review; may be adjusted before execution |

## Execution Command Requirements

An eventual execution command must satisfy all of the following properties:

- **Explicit and manual.** The command must be typed and invoked by a human, not triggered by import, build, test, or UI interaction.
- **Separate from import, build, tests, and normal UI use.** The command must not run during `npm run build`, `npm run typecheck`, `npm run dev`, `npm test`, or any offline test.
- **One invocation with a bounded timeout.** The command executes exactly one provider request with a timeout no greater than the adapter's safety limit (60 s default, subject to human review).
- **No automatic retry or polling.** If the request fails, the command records the sanitized error and stops. No retry loop, no polling, no background execution.
- **Sanitized output written only to a newly timestamped evidence directory.** The output directory must be created at execution time with a UTC timestamp. No pre-existing evidence directory may be overwritten.
- **No raw response, headers, token, PII, private URL, or account identifier.** All output must pass through the adapter's error sanitization and response normalization before recording.
- **Must stop rather than guess if any prerequisite is missing.** If any prerequisite from the checklist above is not satisfied, the command must exit with a clear blocked status and record the specific missing prerequisite.

No executable command is provided in this document. The command will be designed after all prerequisites are met and the SDK is installed.

## Evidence Record Template

The following template will be populated only after a live smoke test is executed and reviewed:

```markdown
# Gemini Live Smoke-Test Evidence Record

- **Test ID:** [to be assigned]
- **UTC timestamp:** [to be recorded at execution time]
- **Human approver:** [name of the human who authorized execution]
- **Reviewed SDK/version:** [package name and version reviewed in prerequisite 1]
- **Approved model identifier:** [model recorded in prerequisite 4]
- **Synthetic fixture identifier:** [fixture selected from smoke-tests/gemini/fixtures/]
- **Request count:** [must be 1]
- **Status:** [passed | failed | blocked | timed_out]
- **Sanitized normalized result:**
  - extractionStatus: [value]
  - firstLeg: [normalized leg or null]
  - secondLeg: [normalized leg or null]
  - connectionDurationMinutes: [value or null]
  - missingFields: [array]
  - fieldConfidence: [object]
  - validationMessages: [array of sanitized messages]
  - requiresUserConfirmation: true
  - sourceStatus.provider: "gemini"
  - sourceStatus.label: "Direct Gemini validation"
  - sourceStatus.executed: true
  - label: "Direct Gemini validation"
- **What the result proves:** [human-authored statement about what this single
  result demonstrates]
- **What the result does not prove:** [human-authored statement about the
  limitations of a single-result smoke test]
- **Next safe action:** [human-authored recommendation for the next step, if any]
```

No credential placeholder is included. The credential value must never appear in any evidence record.

## Stop Conditions

The following conditions require stopping before any request is made:

1. Missing or unapproved capability review (`capabilityReviewStatus` is not `"approved"`).
2. Missing model approval (`approvedModelIdentifier` is empty or unset).
3. Missing SDK/version review (the `@google/genai` package has not been reviewed against official documentation).
4. Missing secure runtime credential (no `GEMINI_API_KEY` available through a secure mechanism).
5. Unclear cost, quota, permission, retention, or data-handling implications.
6. More than one request would occur (the one-request guard is not in place or could be bypassed).
7. Retry or polling would occur (any retry loop, polling mechanism, or background execution is present).
8. Raw provider output would be recorded (response normalization or error sanitization is not applied).
9. Any external action is possible (booking, payment, reservation, ticket, order, verification, or other write action could be triggered).
10. Any requirement depends on guessing (model identifier, endpoint, API version, response shape, or SDK behavior is assumed rather than confirmed).

## Human Sign-Off

- **Reviewer:**
- **Date/time:**
- **SDK/version reviewed:**
- **Model identifier reviewed:**
- **Cost/quota review:**
- **Credential configured securely:** Yes / No
- **One-request authorization:** Approved / Not approved
- **Final decision:** GO / NO-GO
- **Notes:**

## Final Rule

"No live Gemini request may occur until every prerequisite is explicitly completed and a human approves one exact bounded execution."
