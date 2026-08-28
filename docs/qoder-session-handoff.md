# StitchCheck — Qoder Session Handoff
_Last updated: 2026-08-25 23:10 +08_
_Source: final message from the 24-credit Qoder account, immediately before account switch. Confirmed as the accurate last known state — no changes since this handoff was first written._

## Purpose
This file exists so a **new Qoder session/account** can resume exactly where the prior (24-credit) session stopped, without re-doing completed work or assuming any approval that was never actually granted, while re-confirming any gate that requires fresh, explicit approval.

## Confirmed status (do not re-verify unless evidence looks stale)

```text
ATLAS_READ_ONLY_STATUS = CONFIRMED_LIVE
ATLAS_WRITE_STATUS = BLOCKED
GEMINI_LIVE_STATUS = NOT_CONFIRMED
NOSANA_LIVE_STATUS = BLOCKED_PENDING_APPROVAL (gate 3.3 pending — awaiting user answer)
```

## Completed work (DONE — do not repeat)

1. **Atlas Search + Verify** confirmed live end-to-end through the active browser UI (not just the proxy). Evidence: `smoke-tests/atlas/live-app-runs/2026-08-24T17-03-17Z/atlas-reconciliation.json`. Write routes (`order`, `booking`, `payment`, `ticket`, `cancel`, `refund`) confirmed blocked (404).

2. **Gemini live extraction — two attempts made, both failed honestly (no fixture mislabeled as live):**
   - Attempt 1: failed in ~341ms.
   - Attempt 2 (authorized diagnostic retry, fresh server restart, full response-body capture by browser agent "Emily"): failed with **`401 UNAUTHENTICATED / ACCESS_TOKEN_TYPE_UNSUPPORTED`**. This is a definitive diagnosis — the credential type/auth scheme is rejected by Google, meaning either `GEMINI_API_KEY` is invalid/expired or the auth method the code uses doesn't match what that key/endpoint supports.
   - Evidence for both attempts recorded at separate timestamped paths under `smoke-tests/gemini/live-runs/`; prior record untouched by the second write.
   - UI correctly showed "Gemini extraction unavailable" — never showed a false live label.
   - Dev server was stopped after this diagnosis (agent "Taylor").
   - **The one authorized diagnostic retry has been used. Do not attempt a third live Gemini call without a fresh, separate user authorization in the new session.**

3. **Nosana flags added to `.env.local`** (additive only; agent "Jimmy" confirmed pre-existing file content byte-identical aside from the addition):
   ```text
   DEMO_MODE=live
   NOSANA_ENABLED=true
   NOSANA_LIVE_ENABLED=true
   ```
   `NOSANA_API_KEY` confirmed present (value never printed, never will be).

## PARTIALLY DONE / NOT DONE — next actions

### Immediate next step — THIS QUESTION WAS NEVER ANSWERED before the account switch

The 24-credit session ended still waiting on this exact question. Ask it again, verbatim, before doing anything else:

> "Do you approve running the two read-only Nosana checks (`client.api.credits.balance` + `client.api.markets.list`)? No job will be submitted and no credits will be spent by this check alone."

Details already gathered (safe to reuse without re-deriving):
- Script location: small read-only node script run from `smoke-tests/nosana/` using installed `@nosana/kit` v2.7.5.
- Purpose: verify the market identifier the code defaults to (`7AtiX…cGHq`, currently flagged `UNVERIFIED` in code) actually exists, and confirm credit sufficiency against the cost ceiling (`NOSANA_COST_CEILING_USD`, default $10).
- Output expected: a credit-sufficiency boolean (numeric balance only if the user wants it shown) and a confirmed/`UNVERIFIED` market verdict. If the market cannot be verified, Step 3 stops there — no guessing, no substitute market address.

**Do not assume the prior "1B" Nosana authorization covers this gate — it explicitly does not.** The prior session was correct to stop and ask; the new session must ask again since no answer was given before the switch.

### If approved, remaining Nosana gates (in order)

1. Run the two read-only checks. Report credit sufficiency and confirm/deny the market identifier. Do not guess if unverifiable — stop there if so.
2. Present **gate 3.4** (separate approval): final live-job approval showing SDK version, market, estimated cost vs. `NOSANA_COST_CEILING_USD` (default $10), timeout (120s), single-attempt/zero-retry policy, and evidence fields to be persisted. Wait for explicit approval before submitting anything.
3. Only after 3.4 approval: submit exactly one job, poll with lowercase states (`pending`/`running`/`completed`/`failed`/`stopped`), retrieve via documented IPFS method, validate with `validateRiskResult` before labeling as live evidence.

### Gemini — open question for the user, not yet resolved

The `ACCESS_TOKEN_TYPE_UNSUPPORTED` error needs a human check before any further attempt:
- Confirm `GEMINI_API_KEY` in `.env.local` is current/unexpired for the correct Google Cloud project.
- Confirm the model identifier string used in `app/server/gemini-extract.mjs` / `smoke-tests/gemini/direct-gemini-adapter.mjs` is a currently valid model name, and that the auth scheme (API key vs. OAuth/service-account token) matches what that endpoint expects.
- Do **not** attempt a third live call without a fresh explicit user authorization — the "one diagnostic retry" authorization from the prior session has been used up and is not renewed by switching accounts.

## Hard constraints that still apply in the new session

- Never print `GEMINI_API_KEY`, `NOSANA_API_KEY`/wallet key, `ATLAS_CLIENT_ID`/`ATLAS_CLIENT_SECRET`, tokens, or auth headers.
- Do not read other lines of `.env.local` beyond confirming presence/booleans.
- Do not commit, push, reset, revert, checkout, stash, or cherry-pick.
- Do not modify videos, narration, subtitles, SRT, or presentation files.
- Do not implement or execute any Atlas Order/Pay/Ticket/write route.
- Do not submit a Nosana job or spend credits without both gate 3.3 and gate 3.4 freshly approved in *this* session — neither is satisfied yet.
- Do not treat this handoff file's "DONE" list as authorization to skip a required approval gate — it is a record of completed work only, not a standing approval.

## Evidence file locations (for the new session to inspect, read-only)

```text
smoke-tests/atlas/live-app-runs/2026-08-24T17-03-17Z/atlas-reconciliation.json
smoke-tests/gemini/live-runs/<timestamp-1>/gemini-live-evidence.json
smoke-tests/gemini/live-runs/<timestamp-2>/gemini-live-evidence.json  (ACCESS_TOKEN_TYPE_UNSUPPORTED)
```

## First message the new session should send to the user

> "Resuming from handoff file (account switch from a 24-credit account). Confirmed: Atlas live, Gemini diagnosed as 401/ACCESS_TOKEN_TYPE_UNSUPPORTED (one diagnostic retry already used), Nosana flags added but gate 3.3 was never answered before the switch. Do you approve running the two read-only Nosana checks (credits balance + markets list)? No credits will be spent by this check."
