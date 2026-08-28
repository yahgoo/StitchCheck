# Complete Atlas Mock Ticketing Items 4–7

## Summary

Branch `feature/atlas-sandbox-mock-ticketing` (HEAD = baseline `8c910dc`) already contains fail-closed scaffolds for all four items. This plan **completes** them in place rather than rewriting:

- **Item 4**: `app/server/atlas-sandbox-writes.mjs` — add the execution path (CLI invocation, synthetic passenger, rate limiter, evidence writer, paid-index population), fully gated behind a new default-false flag `ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED`.
- **Item 5**: `app/src/atlas/{types,client,adapter}.ts` — already fully implemented at baseline; verify-only via typecheck.
- **Item 6**: `app/src/components/SandboxOrderPanel.tsx` — internal rewrite to reducer-driven full state machine; `App.tsx` mount/reset already done.
- **Item 7**: new `smoke-tests/atlas/sandbox-write-gate-tests.mjs` + one-line registration in `app/package.json` `verify:offline`.

### Key decision — execution activation flag (resolves spec-vs-baseline conflict)

The **protected** existing test `smoke-tests/atlas-sandbox-write-gate-tests.mjs` (registered in `verify:offline`) asserts, under all-pass `PASS_ENV`: order/pay → 503 `sandbox_write_not_implemented`, CLI spy invoked 0 times, and `capabilities.executionApproved === false` with `writeExecution === 'disabled_pending_contract_approval'`. Since that file cannot be edited and ATRIP activation is still pending (spec's "Still-blocked item"), the execution path must be unreachable by default:

- Replace the internal `const WRITE_EXECUTION_APPROVED = false` with an env-derived read inside `createSandboxWriteHandler`: `executionApproved = env.ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED === 'true'` (absent everywhere → defaults false; not in `PASS_ENV`, not in `.env.local`).
- `capabilities` reports `executionApproved` truthfully; under `PASS_ENV` this stays `false` and `writeExecution` stays the exact legacy string, so protected case 22 remains green. When approved, `writeExecution` = `'enabled_sandbox_rehearsal'` (no bare "production" wording).
- Unapproved path: byte-identical current behavior (503 + `idempotencyStore.finish(key, 'unknown', …)` ordering preserved). Approved path: full execution (new tests cover it).

## Pre-work hygiene (Step 0)

- `app/src/App.tsx` contains stray injected debug instrumentation at lines 274–276 (`// #region agent log` … `fetch('http://127.0.0.1:7403/ingest/…')` … `// #endregion`) inside `handleTrySampleScreenshot`, with apparently malformed quoting. **Remove exactly that region block only**; make no other App.tsx change.
- Snapshot `git status`/`git diff --stat` before starting. Do not touch the other 4 pre-existing dirty files (`sample-itinerary-screenshot.ts`, 3 unrelated smoke tests).
- Run `cd app && npm run typecheck` to capture the baseline state before edits.

## Item 4 — `app/server/atlas-sandbox-writes.mjs` (the only server file for item 4)

Keep ALL existing exports and their shapes unchanged (`createSandboxWriteHandler`, `createSandboxEvidenceRecord`, `PASSENGER_CONTRACT_STATUS`, `ATRIP_TICKETING_ACTIVATION_STATUS`, `REQUIRED_SANDBOX_BASE_URL`) — the protected test imports them.

Add, in place:

1. **Rate limiter** — token issuance in `handleConfirmIntent`: sliding 60s window, max 10, lazy trim (no timers), machine error `429 { error: 'token_rate_limited' }`.
2. **Synthetic passenger constant** — `Object.freeze` server-owned `SYNTHETIC_PASSENGER` (TESTTRAVELER, M, 1990-01-01, nationality JP, document type PP, fixed synthetic document number, test@example.com, phone 0000000000). Payload builder merges the constant with validated `traveler_id`/`passenger_type` from the request (already validated by `isValidTravelers`); delivered via stdin only, never temp files. The existing `FORBIDDEN_REQUEST_KEY_PATTERNS` scanner remains the browser-input gate (400).
3. **Execution seam activation** — `execCliImpl` becomes live when `executionApproved` is true. Exact invocations, zero retries (single shot, never `execCliWithRetry`):
   - order: `['order','create','--booking-id',<id>,'--passengers-stdin','--json']`, 20s timeout, stdin payload.
   - pay: `['order','pay','--confirmation-id',<id>,'--json']`, 20s timeout.
   - status: `['order','status','--order-no',<id>,'--json']` via per-orderNo single-flight `Map<orderNo, Promise>` (read; bounded retry acceptable only through the injected seam semantics; delete entry on settle). Keep `statusImpl` test seam precedence.
4. **Defensive multi-key extraction** — named frozen key arrays for orderNo, confirmation-id, provider code/status; unknown/numeric codes map to `unknown` outcome, never success (mirror `mapProviderOutcome` semantics). Confirmation-id is extracted server-side from the order-create response, stored per orderNo (never sent to browser), and marked consumed pre-flight before any `order pay` call.
5. **Paid index** — populate `paidOrders.set(orderNo, { payKey, paidAt })` only after a pay accepted outcome; existing duplicate guard returns 409. On pay timeout/error → `idempotencyStore.finish(key,'unknown',…)`, **never auto-retry**; same-key follow-up replays; reconciliation happens via `/status`.
6. **Evidence writer** — append-only JSONL to `output/atlas-sandbox-evidence-<UTC YYYY-MM-DD>.jsonl`, one line per operation outcome including gate rejections. Use `node:fs/promises` (`mkdir` recursive lazily once, serialized append chain so line order is preserved and the HTTP response path never awaits fs). Line = `createSandboxEvidenceRecord(…)` output merged externally with real `latencyMs` and `terminal` — **do not change `createSandboxEvidenceRecord`'s output shape** (protected evidence-shape tests). Redaction: local `redactForEvidence()` wrapper = `sanitizeResponse` semantics + PAN (13–19 digit), CVV, document-number regexes; CLI stderr via `sanitizeError` (≤500 chars). Injectable seam: `options.evidenceDir` / `options.evidenceSink` for tests (default `output/` relative to workspace root).
7. **`handleCapabilities`** — report `executionApproved` from the env flag; keep exact legacy strings when false.

### `app/server/atlas-proxy.mjs` — two additive changes only

1. New export `execCliOnceWithStdin(args, { stdin, timeoutMs })`: `execFile('atlas-flight', args, { timeout: timeoutMs ?? 8_000, maxBuffer: 10MB })`, writes `stdin` string to `child.stdin` then ends; resolves the same `{parsed, exitCode, timedOut, errorCode, stderr}` shape. Single attempt.
2. Line ~414: pass `execCliOnceWithStdin` (instead of `execCli`) as the `execCliImpl` seam. Everything else byte-identical — `execCli`/`execCliWithRetry` read path, `BLOCKED_PATHS`, `SANDBOX_ROUTES`, sanitizers untouched. This keeps `atlas-sandbox-writes.mjs` free of any `child_process`/`fetch` import (spec final-report grep requirement).

## Item 5 — verify-only (no changes expected)

`app/src/atlas/types.ts` (all five sandbox envelopes), `client.ts` (five functions), `adapter.ts` (bookingId/travelers passthrough) are complete at baseline. Confirm via `npm run typecheck`; only additive optional-field tweaks if typecheck reveals gaps against the panel's needs.

## Item 6 — `app/src/components/SandboxOrderPanel.tsx` internal rewrite

- Replace `useState` panel state with `useReducer`; reducer dispatches `SandboxOrderEvent`s through core `transition()` (imported from `../../../core` barrel) — `null` returns are fail-closed no-ops. Reducer state: `{ state, orderNo, idempotencyKeys, lastError, pollBudget }`. No local transition table; reuse `core/simulation/sandbox-order-states.ts` exclusively (read-only, protected).
- Keep gates 1/2/4/5 (compile flag, `DATA_MODE==='live'`, `verifyStatus==='success'`, non-empty `bookingId`).
- **Change gate 3**: runtime visibility becomes `capabilities.sandboxWritesEnabled === true && capabilities.environment === 'sandbox'` (drop the scaffold's `executionApproved === false` condition — the full flow requires execution to exist).
- Full flow per state: opt-in checkbox → order-review → confirm-intent (`atlasSandboxConfirmIntent`) → fresh token + `crypto.randomUUID()` idempotency key → `atlasSandboxOrder` → order-created-unpaid → payment-review → `atlasSandboxPay` → pay-accepted → status polling (`atlasSandboxStatus`, recursive `setTimeout` chain, 5s cadence, ~10-poll budget → `safely-stopped`; cleanup aborts on unmount — App.tsx's existing `sandboxPanelKey` bump in `handleRestart` provides reset+abort, so **App.tsx gets no further changes**).
- Error states: gate-rejected (403), cli-error (502 + code), unknown-create / unknown-pay (copy: "do not resubmit — check status"), safely-stopped. Provider outcomes mapped via `mapProviderOutcome` semantics; buttons enabled only when `canAttemptWrite(state, op) && acknowledged` — guaranteeing no write request can fire before explicit confirmation and no handler exists pre-activation.
- Copy: Sandbox/test/simulated qualifiers in every state; no bare "production" wording; no real-data input controls; double-click prevention via disabled buttons + state checks.
- Retain scoped CSS pattern; extend classes as needed.

## Item 7 — `smoke-tests/atlas/sandbox-write-gate-tests.mjs` (new file) + registration

Clone the hand-rolled harness from `smoke-tests/atlas-sandbox-write-gate-tests.mjs` (`assert`/`assertEqual`/`section`, `createMockReq`/`createMockRes`, `callHandler`/`callMiddleware`) but with a **counting** CLI spy (records args + stdin, returns scripted envelopes) and an injected fake `now()` clock. Sections:

1. **Gates**: kill switch false → all 5 routes 403; `ATLAS_ENVIRONMENT!=sandbox` → 403; `ATLAS_WRITES_ENABLED=true` → 403; non-sandbox base URL → 403; regression re-assertion of default-deny and the 7 `BLOCKED_PATHS` across env combinations via `createAtlasProxyMiddleware` (failing CLI spy).
2. **Tokens**: single-use, 120s expiry (fake clock), operation binding, cross-operation misuse rejected, replay rejected, **rate limit 10/min → 429**.
3. **Idempotency**: in-flight → 409 (deferred mock promise); completed → replay with CLI invocation count asserted === 1; duplicate pay suppressed; N pay retries → exactly 1 CLI call; key expiry via clock advance.
4. **Inputs**: browser-supplied passengers/card/name keys → 400; oversized `traveler_id` → 400; browser-supplied travelers field rejected.
5. **Integration (execution approved env: `PASS_ENV` + `ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED='true'`)** — mocked CLI envelope chains: full Search→Verify→Order→Pay→Status success; `PRICE_CONFIRMATION_REQUIRED`; `OFFER_EXPIRED`; invalid bookingId → order creation failure; `PAYMENT_BALANCE_CHECK_REQUIRED` → payment-blocked (never re-pay); 3DS-style rejection; pay timeout → poll-only (never re-pay); duplicate pay; polling timeout; `ORDER_CANCELLED`; malformed upstream; upstream config error.
6. **Zero-retry assertion**: CLI invocation counters per operation per request === 1.
7. **Evidence redaction**: inject temp `evidenceDir`, drain queue, assert JSONL lines contain no URL/email/Bearer/sk-PAN/CVV/passenger payload/document number; clean up temp files.
8. **State-machine unit tests**: import `core/simulation/sandbox-order-states.ts` directly (Node ≥23.6 type stripping) — transition table, terminal codes, numeric/unknown → `unknown`.
9. **Regression preservation**: with unapproved env, order/pay still 503 `sandbox_write_not_implemented` and CLI spy count 0 (mirrors the protected file's invariants from the new file).
10. **Browser verification (static source assertions** — no Playwright dependency exists and adding one is out of scope): read `SandboxOrderPanel.tsx`/`App.tsx` sources and assert: flag-off invisibility gate conditions present, opt-in checkbox required, separate Order and Pay confirmations, no write client call before confirmation handlers, no real-data input controls, Sandbox qualifier copy in all render branches, refresh-recovery via remount key, disabled-until-activation buttons, no bare "production" wording.

**Registration**: append `&& node ../smoke-tests/atlas/sandbox-write-gate-tests.mjs` to the `verify:offline` chain in `app/package.json` (single additive edit, inserted before `&& npm run typecheck`).

## Constraints enforced throughout

- `ATLAS_SANDBOX_WRITES_ENABLED` resolves false by default everywhere (`.env.local` untouched; `.env.example` already `false`).
- Zero live network calls: write module imports no `fetch`/`child_process`; tests inject seams exclusively; `sandbox.atriptech.com` must appear zero times in `app/src/`.
- Do NOT touch: `.env.local`, `core/safety/` (incl. `gates.ts`), `core/simulation/ticketing.ts`, `core/simulation/sandbox-order-states.ts`, `scripts/atlas-orchestrator.mjs`, `RecoveryPlanAnimation.tsx`, `AlternativesPanel.tsx`, `SafetyNotice.tsx`, `DecisionPanel.tsx`, any existing smoke-test file, video/presentation assets.
- No commit, no push — leave changes unstaged for manual review.

## Verification (final)

1. `cd app && npm run typecheck`
2. `cd app && npm run verify:offline` (full chain incl. 188 Daytona offline tests, Nosana suite, protected sandbox gate tests, and the new file)
3. Grep audits: `ATLAS_SANDBOX_WRITES_ENABLED` default false; zero `sandbox.atriptech.com` in `app/src/`; zero `child_process`/`fetch` imports in `atlas-sandbox-writes.mjs`.
4. `git status` — confirm only intended files changed: `app/server/atlas-sandbox-writes.mjs`, `app/server/atlas-proxy.mjs` (additive), `app/src/components/SandboxOrderPanel.tsx`, `app/src/App.tsx` (debug-block removal only), new `smoke-tests/atlas/sandbox-write-gate-tests.mjs`, `app/package.json` (one line).
5. Browser smoke: start dev server, load app, confirm it renders the welcome screen with no console errors and the sandbox panel absent (kill switch off); stop the server afterwards.
6. Final report per spec §"Final report", ending with the exact status block (`ITEMS_4_7_STATUS`, `KILL_SWITCH_DEFAULT_FALSE_CONFIRMED`, `NO_LIVE_CALL_CONFIRMED`, `REGRESSION_STATUS`, `PANEL_MOUNTED_UNREACHABLE_UNTIL_ACTIVATION`, `READY_TO_MERGE_AUG_30 = NOT YET — pending ATRIP activation`).

## Risks and mitigations

- **Protected tests break** → execution stays behind default-false `ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED`; unapproved behavior byte-identical; new file re-asserts the same invariants.
- **Evidence-shape protected assertions** → `createSandboxEvidenceRecord` output unchanged; extra fields merged externally in the writer.
- **Security-critical proxy regression** → `atlas-proxy.mjs` changes are additive only (new exported executor + one seam argument); read path untouched; existing allowlist tests guard it.
- **Unconfirmed CLI response field names (ATRIP pending)** → defensive multi-key extraction arrays in one place; unknown/numeric codes fail closed to `unknown`; ready-to-merge stays "NOT YET".
- **Stray debug block may already break baseline build** → captured in Step 0 typecheck snapshot; removed as scoped hygiene fix.
- **Test filesystem side effects** → injectable evidence dir/sink; temp files cleaned.

## Rejected alternatives

- **Restructuring/splitting the server module**: protected test imports specific exports; splitting breaks that contract.
- **Modifying `execCli`'s signature in atlas-proxy.mjs**: touches the hot read path; a separate new executor is additive and isolated.
- **Flipping `WRITE_EXECUTION_APPROVED` constant to true / unconditional execution**: breaks protected tests and violates fail-closed intent while ATRIP activation is pending.
- **Adding Playwright for browser verification**: no such dependency exists; adding one expands footprint against the minimal-change constraint; static source assertions + post-activation manual checklist cover the requirement.
- **Editing the existing root-level `atlas-sandbox-write-gate-tests.mjs`**: protected file; the spec mandates a NEW file at `smoke-tests/atlas/sandbox-write-gate-tests.mjs` (different path).