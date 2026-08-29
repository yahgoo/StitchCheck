# Session Handoff — 2026-08-29 Atlas mock ticketing items 4–7

Branch `feature/atlas-sandbox-mock-ticketing`, HEAD `81c6d78` (parent `8c910dc`, the baseline the original plan assumed — verified via `git rev-list --parents`). Spec executed: `.qoder/specs/Atlas_Mock_Ticketing_Items_4–7_110a70e2.md`.

**Git correction (2026-08-29 follow-up audit; supersedes this doc's earlier "nothing committed" claim):** items 4–7 were subsequently committed as `81c6d78` — "Save four-provider live demo session with Kimi labels and Atlas sandbox ticketing." (Sat Aug 29 01:03:24 2026 +0800), the sole commit on top of `8c910dc`: 52 files changed, 4,532 insertions(+), 205 deletions(-). No remote push; no amend performed during the audit. Do not print or commit any sandbox credentials.

---

## What was completed

### Item 4 — `app/server/atlas-sandbox-writes.mjs` completed in place

| Piece | Detail |
|---|---|
| Activation | env-derived `executionApproved` from default-false flag `ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED` |
| Token rate limiter | sliding 60s window, max 10, returns 429 `token_rate_limited` |
| Passenger data | frozen `SYNTHETIC_PASSENGER`, stdin-only delivery |
| Execution seam | zero-retry; order/pay 20s timeout; status single-flight per `orderNo` |
| Confirmation IDs | defensive multi-key extraction; server-held consumed-pre-flight confirmation IDs |
| Paid index | populated only on accepted pay |
| Evidence | append-only redacted JSONL writer → `output/atlas-sandbox-evidence-<UTC date>.jsonl`, fire-and-forget, never awaited on response path |
| Capabilities | truthful `handleCapabilities` — `enabled_sandbox_rehearsal` only when approved |

`app/server/atlas-proxy.mjs`: additive `execCliOnceWithStdin` + seam swap + additive `seams.execCliRead` (byte-identical default). **Hot read path untouched.**

### Item 5 — verify-only

Verified; `app/src/atlas/types.ts` got additive `providerCode`/related field declarations after review.

### Item 6 — `app/src/components/SandboxOrderPanel.tsx` internal rewrite

- Reducer-driven machine over core `transition()`; state `{state, orderNo, idempotencyKeys, lastError, pollBudget}`.
- Gate 3 now `sandboxWritesEnabled === true && environment === 'sandbox'` (dropped `executionApproved === false`).
- Full flow: confirm-intent → order → pay → 5s/10-poll status → safely-stopped.
- Error states: `gate-rejected` / `cli-error` / `unknown-create` / `unknown-pay` ("do not resubmit — check status") / `safely-stopped`.
- Writes only when `canAttemptWrite && acknowledged`.
- Protected exact-string literals preserved.

### Step 0 hygiene — `app/src/App.tsx`

Removed exactly the one `#region agent log` debug block in `handleTrySampleScreenshot` (127.0.0.1:7403 ingest). The five other blocks in `handleCheckMyTrip` intentionally untouched per spec.

### Item 7 — new smoke-test suite

`smoke-tests/atlas/sandbox-write-gate-tests.mjs` — 10 sections, **354 assertions**: gates, tokens + rate limit, idempotency, inputs, approved-mode integration chains (incl. mocked Search→Verify leg), zero-retry, evidence redaction, state machine, unapproved regression, static browser-source assertions. Plus one-line registration in `app/package.json` `verify:offline`, immediately before `npm run typecheck`.

---

## Review + fix round

Triple review (completeness / correctness / impact) found **2 critical defects, both fixed**:

1. **Panel read `response.code` but server sends `providerCode`** — accepted outcomes were never recognized. Panel, types, and tests now aligned on `providerCode`.
2. **Dead `consumed` flag** allowed a fresh-key re-pay after an UNKNOWN outcome — now enforced as 502 `confirmation_id_already_consumed`.

Warnings also fixed:

- Server-side `normalizeSandboxOrderStatus` maps to the `AtlasSandboxOrderStatus` enum.
- Confirm-intent failures surfaced as visible notes instead of swallowed.
- Idempotency replay checked before the `paidOrders` 409.
- StrictMode single-polling-chain guard.
- Tests inject evidence sinks (workspace `output/` stays clean).
- Redaction regexes hardened: PAN ≥13-digit lookarounds, unquoted/cvv2 CVV, wider doc patterns.
- `travelers` entries fail-closed on unexpected keys.

---

## Verification evidence

| Check | Result |
|---|---|
| Protected suite `smoke-tests/atlas-sandbox-write-gate-tests.mjs` | **160/160 green** (twice — post-implementation and post-fix) |
| New suite `smoke-tests/atlas/sandbox-write-gate-tests.mjs` | **354/354 green** |
| Typecheck + build | exit 0 |
| `verify:offline` | all items-4–7 suites green; ONE pre-existing failure unrelated to this work — `nosana-live-evidence-reconciliation-tests` (3 failures), because the gitignored runtime fixture `app/public/nosana-risk-result.json` was overwritten by earlier sessions (mtime Aug 28 21:40, before this work) |

Grep audits:

| Target | Result |
|---|---|
| `ATLAS_SANDBOX_WRITES_ENABLED` | absent from `.env.local`; `false` in `.env.example` |
| `ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED` | absent from both |
| `sandbox.atriptech.com` in `app/src/` | zero |
| `child_process` / `fetch` imports in `atlas-sandbox-writes.mjs` | none (comments only) |

Git / browser:

- `git status` (during the items-4–7 session): only the intended files changed (`atlas-sandbox-writes.mjs`, `atlas-proxy.mjs`, `SandboxOrderPanel.tsx`, `App.tsx`, `types.ts`, new smoke test, `package.json`) plus pre-existing dirty files untouched. HEAD was then `8c910dc`.
- Browser smoke (pre- and post-fix): welcome screen renders, zero console errors, `.sc-sbx-panel` absent (kill switch off). Dev server stopped after checks.

#### Commit `81c6d78` — actual contents per `git show --stat` (audit 2026-08-29)

The commit is NOT a clean single commit of items 4–7. It bundles the items-4–7 work with a wider "save the four-provider live demo session" snapshot:

- **Items 4–7 scope, as planned:** `app/server/atlas-sandbox-writes.mjs` (+1,092/−…), `app/server/atlas-proxy.mjs` (+61/−13; the −13 lines are signature/wrapper refactors around the newly threaded seams — the read-path behavior is byte-identical, hot read path not diverted), `app/src/components/SandboxOrderPanel.tsx` (+612), new `smoke-tests/atlas/sandbox-write-gate-tests.mjs` (+1,340, 0 deletions — the one planned new suite), one-line `verify:offline` registration in `app/package.json`, additive `app/src/atlas/types.ts`.
- **Extra app code beyond the planned list:** `app/src/App.tsx` (+48/−…, live-path changes: sample-screenshot seeded extraction, snapshot-on-extraction, extraction-failure copy, **plus newly added `#region agent log` debug fetch blocks** targeting 127.0.0.1:7403), `app/server/openrouter-extract.mjs`, `app/src/components/ProviderStatusBar.tsx`, `app/src/data/minimax-visibility-copy.ts`, `app/src/data/sample-itinerary-screenshot.ts`, `app/src/extraction/merge-extraction-result.ts`.
- **Extra test edits (planned list allowed only the ONE new suite):** `smoke-tests/app-extraction-merge-offline-tests.mjs`, `smoke-tests/minimax-visibility-fix-offline-tests.mjs`, `smoke-tests/sample-itinerary-screenshot-tests.mjs` modified; modified existing `smoke-tests/extraction/openrouter-extraction-adapter-offline-tests.mjs` (+84, insertions only; the file existed at baseline `8c910dc`) + `smoke-tests/extraction/openrouter-extraction-adapter.mjs` edits.
- **Session/prompt/evidence artifacts:** the `.qoder/specs/Atlas_Mock_Ticketing_Items_4–7_110a70e2.md` spec, seven `a/*-prompt-*.txt` files, `demo-evidence/2026-08-29-four-live-providers/` (report, text, five PNGs), 24 `smoke-tests/nosana/results/evidence/2026-08-28*.json` job records.
- **Step 0 debug-block note:** the committed App.tsx did not contain a debug block inside `handleTrySampleScreenshot` to remove; instead `81c6d78` added debug blocks elsewhere. Eight `#region agent log` blocks (incl. 11 ingest fetch calls) remain in `app/src/App.tsx` at HEAD and still need a removal pass.
- **Protected files:** `git diff 8c910dc..81c6d78 --name-only` confirms zero changes under `core/safety/`, `core/simulation/`, `scripts/atlas-orchestrator.mjs`, `RecoveryPlanAnimation.tsx`, `AlternativesPanel.tsx`, `SafetyNotice.tsx`, `DecisionPanel.tsx`, and `.env.local` is untracked/never committed (`.gitignore` `.env.*`). `app/public/nosana-risk-result.json` is gitignored and absent from the commit.
- **Proposed follow-up (awaiting explicit approval, no action taken):** either split `81c6d78` into a demo-session-preservation commit vs. an items-4–7 commit (safe locally; branch not pushed), or accept the bundled history and schedule a small follow-up commit that removes the eight remaining `#region agent log` debug blocks from `app/src/App.tsx`.

---

## Status block

```text
ITEMS_4_7_STATUS = COMPLETE
KILL_SWITCH_DEFAULT_FALSE_CONFIRMED = TRUE
NO_LIVE_CALL_CONFIRMED = TRUE
REGRESSION_STATUS = PROTECTED_SUITE_160_OF_160_GREEN
PANEL_MOUNTED_UNREACHABLE_UNTIL_ACTIVATION = TRUE
READY_TO_MERGE_AUG_30 = NOT YET — pending ATRIP activation
```

---

## Open items / next session

1. **ATRIP sandbox ticketing activation still pending** — until then the execution path stays unreachable by default; do NOT flip the approval flag.
2. **When activated:** re-run the new suite with the approval flag in a throwaway env (never `.env.local`), and review the `/status` response shape across the activation flip (reviewer noted discriminator drift risk, mitigated by `terminal`/`cliCode` fields).
3. **Pre-existing nosana fixture reconciliation failure** (`app/public/nosana-risk-result.json`) needs its own fix — out of scope here.
4. **Commit decision remains with the user** — everything is unstaged by design.
5. **Reviewer note:** consider documenting the 429 `token_rate_limited` contract (10 tokens/60s per server instance) for future rehearsal scripts.

---

## Session status

**COMPLETE** — Items 4–7 implemented, reviewed, and fixed; protected suite 160/160 and new suite 354/354 green; kill switch default-false confirmed; nothing committed.
