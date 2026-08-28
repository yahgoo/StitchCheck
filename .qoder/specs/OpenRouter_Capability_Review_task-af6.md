## Create `docs/plans/openrouter-model-capability-review.md`

### Step 1 -- Create the file

**File:** `/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel/docs/plans/openrouter-model-capability-review.md`

The `docs/plans/` directory already exists. Sources (read-only, all in context from this session): `docs/plans/openrouter-temporary-extraction-amendment.md`, `smoke-tests/gemini/provider-capabilities.json`, `smoke-tests/gemini/config.json`, `smoke-tests/gemini/schema-validator.mjs`, `docs/smoke-test-gemini.md`, `docs/SPECS.md`.

Write `# OpenRouter Model Capability Review` with the exact sections and mandated content:

1. **Required Capability Checks** -- a candidate is eligible only when official OpenRouter model/provider information confirms, for the exact model and endpoint: image input / vision support; text output suitable for itinerary extraction; structured JSON Schema output support (not merely plain-text JSON); provider-endpoint support for structured outputs (varies by provider for the same model); availability under the intended OpenRouter account and budget; no silent provider or model fallback. Note the official multimodal overview reference supplied by the user.
2. **Human Evidence Record** -- the exact blank 8-column table: `| Candidate Model Identifier | Vision Confirmed | JSON Schema Confirmed | Endpoint/Provider Confirmed | Source URL Reviewed | Review Date | Human Approver | Approved/Rejected |` with all decision fields blank.
3. **Selection Rules** -- exactly one approved model identifier; no automatically routed generic/free identifiers; no request until a human approves and enters the exact identifier into `provider-capabilities.json`; provider routing set to require parameters so a request cannot be silently sent to an endpoint lacking structured-output support; the `OpenRouter temporary path — not direct Gemini validation` label in all artifacts; lack of capability confirmation is a hard blocker.
4. **Rate-Limit Controls** -- one initial attempt per GEM case; at most two retries after the initial attempt; respect `Retry-After`, otherwise bounded exponential backoff with jitter; no parallel requests and no silent model/provider switching; rate-limit outcomes recorded separately as temporary OpenRouter evidence.
5. **Handoff** -- after human model approval, a separate implementation task may update only the non-secret capability manifest and request adapter; a further explicit human approval is required before any external request.
6. **Stop Condition** -- only `docs/plans/openrouter-model-capability-review.md` is created.

### Step 2 -- Verify (read-only)

1. Read back the document; confirm all six sections and the blank 8-column evidence table are present.
2. Confirm it describes no external request, no automatic model selection, and no modification of any existing file.
3. Verify via filesystem timestamps (`find -newermt` + `stat -f`; workspace is not a Git repo) that the new plan file is the only project file created or modified.

### Constraints

- Plan document only; no installs, keys, `.env.local` changes, authentication, OpenRouter/Gemini/Nosana/Atlas requests, automatic model selection, GEM execution, or Git operations.
- Report format: Plan file path, Human evidence required, Blocking decisions.