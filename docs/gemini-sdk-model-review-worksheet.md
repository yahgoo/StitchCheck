# Gemini SDK and Model Review Worksheet

## Review Purpose

This worksheet helps a human verify official Gemini SDK and model capabilities before any dependency installation or live request. It provides a structured review surface for recording SDK version, model identifier, capability confirmations, and cost/quota decisions against official sources.

Direct Gemini remains unexecuted. No SDK has been installed, no credential has been configured, and no live request has been made. This worksheet is not provider evidence.

## Current Project Constraints

- The adapter uses dependency injection. The real SDK client is injected via `_setProviderClient()` behind the existing disabled-by-default adapter boundary.
- The real SDK (`@google/genai`) is not installed. No package installation has occurred.
- Offline fake-client tests are not provider evidence. They validate adapter request-shaping and response-normalization logic using synthetic fake clients.
- One request maximum is required. The adapter enforces a one-request-per-execution limit via a module-level call counter.
- No automatic retries or polling are allowed. `maxRetries` is 0. No retry loop, polling mechanism, or background execution exists.
- Browser code must remain provider-free. `app/src/` contains no fetch, HTTP SDK, provider import, or credential access.
- The confirmation gate must remain unchanged. `requiresUserConfirmation: true` is enforced on every extraction result, and the UI confirmation gate (`Confirm itinerary first`) is not bypassed by adapter output.

## SDK Review Fields

| Field | Human-entered value | Evidence/source | Status |
|-------|---------------------|-----------------|--------|
| SDK package name | | | Pending human review |
| SDK version | | | Pending human review |
| Official documentation URL | | | Pending human review |
| Supported runtime | | | Pending human review |
| Image-input support | | | Pending human review |
| Structured JSON Schema output support | | | Pending human review |
| Timeout/cancellation behavior | | | Pending human review |
| Response-size handling | | | Pending human review |
| Error behavior | | | Pending human review |
| Credential configuration method | | | Pending human review |
| Data-retention/privacy considerations | | | Pending human review |
| Cost/quota implications | | | Pending human review |

## Model Review Fields

| Field | Human-entered value | Evidence/source | Status |
|-------|---------------------|-----------------|--------|
| Model identifier | | | Pending human review |
| Official model documentation URL | | | Pending human review |
| Image-input support | | | Pending human review |
| Structured-output support | | | Pending human review |
| Maximum input constraints relevant to one fixture | | | Pending human review |
| Output constraints | | | Pending human review |
| Availability for the intended API | | | Pending human review |
| Cost/quota considerations | | | Pending human review |
| Data-handling considerations | | | Pending human review |

## Compatibility Questions

1. Does the reviewed SDK support the intended runtime? — **Pending**
2. Does it support the required image input? — **Pending**
3. Does it support structured output constrained by the extraction schema? — **Pending**
4. Can requests be bounded to one call? — **Pending**
5. Can timeout and cancellation be enforced? — **Pending**
6. Can responses be bounded and sanitized? — **Pending**
7. Can credentials remain outside source and browser code? — **Pending**
8. Does the chosen model support the required capabilities? — **Pending**
9. Are cost, quota, permissions, and retention acceptable? — **Pending**
10. Can the proposed request remain extraction-only with no external action? — **Pending**

## Approval Gate

- [ ] SDK/version reviewed by a human.
- [ ] Model identifier reviewed by a human.
- [ ] Capability status approved.
- [ ] Cost/quota/permissions reviewed.
- [ ] Credential configured securely without exposing its value.
- [ ] Adapter implementation reviewed.
- [ ] Exact one-request scope approved.
- [ ] Sanitized evidence format approved.
- [ ] Separate execution command approved.

## Evidence Labels

The following evidence labels are used across the StitchCheck project:

- `OpenRouter temporary path — not direct Gemini validation`
- `Synthetic local placeholder — not direct Gemini evidence`
- `Synthetic local placeholder — not Nosana evidence`
- `Synthetic local placeholder — not Atlas Sandbox evidence`

None of these labels constitutes direct Gemini evidence. Direct Gemini validation remains unexecuted. Offline fake-client tests use synthetic data and do not produce provider evidence.

## Stop Conditions

The following conditions require stopping before any SDK installation or live request:

- Missing official source (no official documentation URL recorded for the SDK or model).
- Unverified SDK or model capability (image input or structured output not confirmed against official documentation).
- Missing approval (any approval-gate checkbox remains unchecked).
- Missing secure credential configuration (no secure runtime mechanism for the credential, or credential has been exposed in any file or log).
- Unclear cost/quota/retention (cost, quota, permissions, or data-retention implications are not understood and accepted).
- Need for more than one request (the test scope exceeds one bounded extraction request).
- Any retry, polling, browser-side call, or external write action (retry loop, polling mechanism, browser fetch, booking, payment, reservation, ticket, order, verification, or other write action is possible).
- Any need to guess a model, endpoint, parameter, or response shape (any value is assumed rather than confirmed against official documentation).

## Human Sign-Off

- **Reviewer:**
- **Date/time:**
- **SDK/version:**
- **Model identifier:**
- **Official sources reviewed:**
- **Cost/quota decision:**
- **Privacy/data-handling decision:**
- **Final decision:** GO / NO-GO
- **Notes:**

## Final Rule

"No SDK installation, credential configuration, or Gemini request may occur until all worksheet fields are reviewed and a human records GO."
