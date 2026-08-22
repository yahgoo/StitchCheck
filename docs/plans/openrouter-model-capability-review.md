# OpenRouter Model Capability Review

This is a read-only model-capability review plan for the temporary OpenRouter
extraction path defined in `docs/plans/openrouter-temporary-extraction-amendment.md`.
No implementation, no model selection, and no external request occurs here.

## Required Capability Checks
A candidate is eligible only when the official OpenRouter model/provider
information confirms all of the following for the exact model and endpoint:
- Image input / vision support. OpenRouter accepts image inputs only for
  vision-capable models (see the official OpenRouter multimodal overview).
- Text output suitable for itinerary extraction.
- Structured JSON Schema output support, not merely plain-text JSON.
- Provider endpoint support for structured outputs, since this can vary by
  provider for the same model.
- Availability under the intended OpenRouter account and budget.
- No silent provider or model fallback.

A lack of confirmation for any of these checks is a hard blocker.

## Human Evidence Record
A human must complete this table after reviewing official OpenRouter model
information for one candidate model. Every decision field is left blank until
that review occurs.

| Candidate Model Identifier | Vision Confirmed | JSON Schema Confirmed | Endpoint/Provider Confirmed | Source URL Reviewed | Review Date | Human Approver | Approved/Rejected |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

No model is selected by this document. No decision is pre-filled.

## Selection Rules
- Select exactly one approved model identifier.
- Do not use an automatically routed generic/free model identifier.
- Do not make a request until the human approves the model and enters the exact
  approved identifier into `smoke-tests/gemini/provider-capabilities.json`.
- Set provider routing to require required parameters so a request cannot be
  silently sent to an endpoint lacking structured-output support.
- Use the label `OpenRouter temporary path — not direct Gemini validation` in
  all artifacts.
- Treat a lack of capability confirmation as a hard blocker.

## Rate-Limit Controls
- One initial attempt per GEM case.
- At most two retries after the initial attempt.
- Respect `Retry-After` when provided; otherwise use bounded exponential
  backoff with jitter.
- No parallel requests and no silent model/provider switching.
- Record rate-limit outcomes separately as temporary OpenRouter evidence; a
  rate-limit failure is a documented failure/blocker, never grounds to switch
  models silently or fabricate an outcome.

## Handoff
After human model approval, a separate implementation task may update only the
non-secret capability manifest (`smoke-tests/gemini/provider-capabilities.json`)
and the request adapter. A further, explicit human approval is required before
any external request is made. Temporary-path results can never satisfy the
direct Gemini Go/No-Go gate.

## Stop Condition
Only `docs/plans/openrouter-model-capability-review.md` is created by this
planning task. No other file is created or modified, and no implementation or
external request occurs.
