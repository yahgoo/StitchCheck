# StitchCheck Provider Authorization Matrix

## Purpose

This matrix separates offline implementation readiness from human authorization for live provider execution. Each provider has independent gates; approval for one does not imply approval for the other. Direct Gemini 3.7 live extraction succeeded via the Interactions API. Atlas Sandbox Search/Verify was verified read-only. Nosana workload validated offline; live execution was not verified. The browser walkthrough itself uses fictional local fixtures and makes no provider calls.

## Current Provider Status

| Provider | Current status | Offline implementation | Live evidence | Exact label |
|----------|---------------|------------------------|---------------|-------------|
| Direct Gemini | Live extraction validated (3.7) | Adapter boundary and offline tests implemented; disabled by default | `smoke-tests/gemini/results/results-gemini-3.7-flash-success.json` | `Direct Gemini 3.7 — live validated` (when showing live evidence); `Fictional itinerary — local demo fixture` (browser walkthrough) |
| OpenRouter | Historical temporary path (GEM-01 only) | Executed once for GEM-01 under temporary-phase approval | Existing GEM-01 evidence | `Historical temporary OpenRouter test path — not the active provider` |
| Atlas | Sandbox Search/Verify verified; production search verified | Read-only adapter boundary and offline tests implemented; disabled by default | Sandbox: `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json`; Production: `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/atlas-live-result.md` | `Atlas Sandbox — live Search/Verify` (when showing sandbox evidence); `Fictional alternatives — local demo fixture` (browser walkthrough) |
| Nosana | Workload validated offline; live execution not verified | Local workload skeleton only; simulated lifecycle | One live job submitted but output validation failed; local fallback used | `Local fallback — not Nosana evidence` |

## Authorization Matrix

| Gate | Gemini | Atlas | Owner | Evidence required | Current status |
|------|--------|-------|-------|-------------------|----------------|
| Official SDK/client documentation reviewed | Pending | Pending | Human reviewer | Link to official documentation; review date recorded | Pending |
| SDK/client version reviewed | Pending | Pending | Human reviewer | Version number; compatibility notes | Pending |
| Target model/environment identified | Pending | Pending | Human reviewer | Exact model identifier or environment name from official source | Pending |
| Required capability verified | Pending | Pending | Human reviewer | Capability confirmation from official documentation | Pending |
| Read-only scope verified | Pending | Pending | Human reviewer | Written confirmation that only permitted operations are in scope | Pending |
| Credential mechanism reviewed | Pending | Pending | Human reviewer | Description of secure runtime mechanism; confirmation that no secret is stored in config or source | Pending |
| Cost/quota/permissions reviewed | Pending | Pending | Human reviewer | Acceptable cost estimate; quota confirmation; permission scope | Pending |
| Data-handling/retention reviewed | Pending | Pending | Human reviewer | Data retention policy; handling confirmation | Pending |
| One-request limit confirmed | Pending | Pending | Human reviewer | Confirmation that adapter enforces single-request limit | Pending |
| Timeout and response-size bounds confirmed | Pending | Pending | Human reviewer | Timeout value and response-size limit reviewed | Pending |
| No retries/polling confirmed | Pending | Pending | Human reviewer | Confirmation that zero retries and no polling are enforced | Pending |
| Sanitized evidence format approved | Pending | Pending | Human reviewer | Review of normalized output shape and error sanitization | Pending |
| Exact execution command reviewed | Pending | Pending | Human reviewer | Manual command recorded; not triggered by import, build, test, or UI | Pending |
| Human authorization recorded | Pending | Pending | Human reviewer | Signed sign-off block below | Pending |
| Post-run human review assigned | Pending | Pending | Human reviewer | Reviewer assigned to evaluate sanitized results before any documentation change | Pending |

## Gemini Scope

The only permitted future operation for direct Gemini is:

- Extract one synthetic itinerary image into the existing structured extraction contract.
- Return normalized fields (`extractionStatus`, `firstLeg`, `secondLeg`, `connectionDurationMinutes`, `missingFields`, `fieldConfidence`, `validationMessages`), warnings, confidence, and the confirmation requirement.
- No raw provider output is returned; only contract fields survive normalization.
- No external action is created, confirmed, or implied.

Direct Gemini requires the official `@google/genai` SDK review, model review, capability approval, secure credential setup via a runtime mechanism, and explicit one-request authorization before any live execution can occur. Until every gate is satisfied and a human records GO, direct Gemini remains disabled and unexecuted.

## Atlas Scope

The only permitted future operations for Atlas are:

- Read-only `search` — search for safer flight alternatives.
- Read-only `compare` — compare alternatives against the confirmed itinerary.

The following operations are explicitly forbidden:

- `book`
- `create_booking`
- `reserve`
- `ticket`
- `issue`
- `pay`
- `purchase`
- `verify`
- `cancel`
- `change`
- `refund`
- `order`
- Any equivalent mutation

Atlas cannot be considered live evidence until its official client or SDK, target environment, credential mechanism, and one-request authorization are reviewed and approved. Until every gate is satisfied and a human records GO, Atlas remains unauthenticated and unexecuted.

## Shared Stop Conditions

Execution must not proceed if any of the following conditions apply:

- Missing official documentation for the SDK or client.
- Unverified SDK/client behavior.
- Missing capability approval.
- Missing model or environment selection.
- Missing secure credential mechanism.
- Unclear cost, quota, permissions, retention, or data handling.
- More than one request is attempted.
- Any retry, polling, background execution, or automatic invocation is attempted.
- Any raw response or credential exposure is detected.
- Any booking, payment, reservation, ticket, order, verification, or write operation is requested.
- Any need to guess an endpoint, model, version, credential name, or environment.

## Evidence Rules

The following evidence labels are preserved exactly:

- `Direct Gemini 3.7 — live validated`
- `Fictional itinerary — local demo fixture`
- `Historical temporary OpenRouter test path — not the active provider`
- `Local fallback — not Nosana evidence`
- `Nosana workload validated offline — local fallback used; not Nosana evidence`
- `Fictional alternatives — local demo fixture`
- `Atlas Sandbox — live Search/Verify`
- `Atlas production Search — reference prices only`
- `Offline fixture — not Atlas Sandbox evidence`

Rules:

- Offline tests are not provider evidence. They validate adapter logic using fake clients and synthetic data only.
- A blocked test is valid evidence of a safe stop, not provider evidence. It demonstrates that the gate enforcement works correctly.
- No status can be upgraded by this matrix. All provider statuses remain as recorded in the Current Provider Status table.
- Human review is required before any documentation status change. No automated process may alter evidence claims.

## Human Sign-Off

### Gemini

- Reviewer:
- Date/time:
- SDK/version:
- Model:
- Capability decision:
- Cost/quota decision:
- Credential decision:
- One-request authorization: Approved / Not approved
- Final decision: GO / NO-GO
- Notes:

### Atlas

- Reviewer:
- Date/time:
- Client/SDK:
- Target environment:
- Read-only capability decision:
- Cost/quota decision:
- Credential decision:
- One-request authorization: Approved / Not approved
- Final decision: GO / NO-GO
- Notes:

## Final Rule

"No provider request may occur until every applicable matrix gate is complete, the exact request scope is approved, and a human records GO for that provider."
