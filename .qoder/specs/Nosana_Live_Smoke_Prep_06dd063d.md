# StitchCheck Nosana Live Smoke-Test Readiness (Preparation Only)

## Guardrails (apply to every step)
- NO job submission, NO credit spend, NO wallet creation/modification, NO provider calls (Atlas/Gemini/OpenRouter/Nosana runtime).
- NO reading `.env.local` VALUES (name-presence only via `.env.example`), NO credential printing/persistence.
- NO package install until package name/version/directory/reason are shown and explicitly approved.
- NO live market/credit-balance request unless separately approved as read-only.
- Only modify files listed under each expert; one owner per file; all test data synthetic/non-PII.
- Do NOT touch `app/src/`, Atlas, Gemini, deck, or video files.

## Reconciled findings (3 researchers, verified against official learn.nosana.com + code)
- Package: `@nosana/kit` current **v2.7.5** (Node >= 20.18); NOT installed; not declared in any package.json.
- Init is correct: `createNosanaClient(NosanaNetwork.MAINNET, { api: { apiKey } })` (`nosana_run_job.mjs:192`).
- API key alone is sufficient for a credit-funded job via `client.api`; **no wallet/private key** needed for this path.
- Timeout is in **seconds** (default 3600); current `DEFAULT_TIMEOUT_SEC = 120` is correct — D-04 uncertainty resolved.
- Pin → Post → Poll → Retrieve flow concept is correct, but 3 API-contract bugs + schema/validator/evidence gaps must be fixed offline.

### Confirmed defects to fix (all offline, in allowed files)
- **D1** `nosana_run_job.mjs:224` reads `job.id || job.jobId`; official Post response field is `job.job`.
- **D2** `nosana_run_job.mjs:273` calls `ipfs.get(hash)`; official method is `ipfs.retrieve(hash)`.
- **D3** `nosana_run_job.mjs:242` compares uppercase `FAILED/COMPLETED`; official states are lowercase (`pending/running/completed/failed/stopped`).
- **D4** `nosana-risk-runner.mjs:158-164` `meta` has non-schema keys (`workload/version/syntheticDemo/nonPiiDeclaration`); official strict validator only allows `trigger` + `system_resources`.
- **D5** `validateJobDefinition()` is a custom hand-rolled guard, NOT the official SDK validator (SDK exports one returning `{success,data,errors}`).
- **D6** live success path never runs `validateRiskResult()` before labelling output as evidence.
- **D8** no idempotency key on Post (docs provide `generateIdempotencyKey()` to prevent double-spend on retry).
- **Evidence gaps** (from security review): `creditsUsed` never captured; status transitions not recorded; evidence written only to fixed paths (approval packet promises timestamped dir + persisted job definition).
- **D7** market address `7AtiX...` self-flagged UNVERIFIED — resolve only via execution-phase read-only gate (separately approved), NOT now.

---

## Expert 1 — Nosana SDK/API specialist (owns `smoke-tests/nosana/nosana_run_job.mjs` ONLY)
Apply documented offline fixes; no network, no install.
- D1: `const jobId = job.job || job.id || job.jobId;`
- D2: `await nosanaClient.ipfs.retrieve(resultHash)`
- D3: compare lowercase `"failed"/"completed"`; add `"stopped"` to terminal set.
- Simplify pin to `resolvedHash = await nosanaClient.ipfs.pin(jobDef)` (docs show hash returned directly); keep safe fallback.
- Replace stale timeout-unit comment (`:35-42`) with documented fact: seconds, default 3600 (cite learn.nosana.com/api/jobs.html).
- D5: after the dynamic `@nosana/kit` import (`:192`), also import `validateJobDefinition` from the SDK and run it before `ipfs.pin`, adapting `{success,errors}` → existing `{valid,issues}` shape; keep custom validator as pre-install fallback and retain the PII env-key guard.
- D8: pass `{ idempotencyKey: generateIdempotencyKey() }` as 2nd arg to `api.jobs.list` (graceful no-op if SDK absent).
- Evidence capture: extract credit fields + each observed `status.state` (with ISO timestamp) in the poll loop (`:234-249`); add `creditsUsed` and `observedStates[]` to every `emitResult` payload (success/timeout/error).
- Emit contract for Expert 2: include `creditsUsed`, `observedStates`, `latencyMs`, `jobId`, `market`, `ipfsHash`, `submittedAt`, `completedAt` in the child-process JSON result.
- Do NOT add credits-balance/market-list network calls here (those are approval-gated execution-phase gates).

## Expert 2 — Workload/schema specialist (owns `smoke-tests/nosana/nosana-risk-runner.mjs` AND `smoke-tests/nosana/run-risk-job.mjs`)
`nosana-risk-runner.mjs`:
- D4: sanitize `meta` to only `trigger: "api"`; move `workload/syntheticDemo/nonPiiDeclaration` declarations out of `meta` (they already exist in the input payload).
- D6: call already-imported `validateRiskResult()` on the built `riskResult` before labelling `nosana-evidence`; on failure route to `buildFallbackResult`.
- Propagate Expert 1's `creditsUsed` + `observedStates` into `jobMetadata` (`:344-351`); preserve fallback label logic and evidence boundary (`evidenceSource`/`fallbackUsed`).
`run-risk-job.mjs`:
- Align evidence artifacts with approval packet §8: in addition to the existing fixed-path writes (`results/nosana-risk-result.json`, `app/public/nosana-risk-result.json`), also write `results/<UTC-timestamp>/{result.json, summary.md, job-definition.json}` persisting the exact submitted job definition (for hash verification, checklist B-02).

## Expert 3 — Security/cost/evidence specialist (owns `docs/stitchcheck-nosana-expert-security-review.md` ONLY — docs, no code)
Create the security review doc covering: no credential leakage; no PII in workload; max timeout (120 s); max cost (cheapest market ~$0.048/hr → ≈$0.0016; hard ceiling US$10); single-attempt/zero-retry; failure→`local-fallback`; market-selection evidence requirement; required live evidence fields (job ID, status transition, latency, sanitized result, credits used, timestamp); and exact judge-facing wording for live/fallback/offline/blocked. Cite existing controls with file:line.

## Expert 4 — Test/integration specialist (owns NO code; runs local-only checks after Experts 1-2 finish)
Run (report exact pass/fail counts):
- `node smoke-tests/nosana/schema-validator.mjs`
- `node smoke-tests/nosana/nosana-client-offline-tests.mjs`
- `node smoke-tests/nosana/workload-skeleton.mjs`
- `node smoke-tests/cross-provider-invariant-tests.mjs`
- `cd app && npm run typecheck`
- `cd app && npm run build`
Verify UI labels remain intact (no UI change): `app/src/data/labels.ts` — "Synthetic local placeholder — not Nosana evidence" and "Nosana unavailable — local fallback used; not Nosana evidence." Do NOT modify UI code.

## Lead — reconciliation + resolution doc (owns `docs/stitchcheck-nosana-expert-resolution.md`)
After all experts return, reconcile disagreements against official docs (do NOT take majority):
- D4 `meta` strictness: include the fix (documented strict validator); confirm against SDK source at execution if validator rejects.
- Custom vs SDK validator: SDK-first with custom fallback (both researchers agree).
Create `docs/stitchcheck-nosana-expert-resolution.md` with: official SDK/package conclusion; correct client init; API-key-vs-wallet requirement; correct IPFS/job/market/status/result flow; schema verification; files changed; offline test results; security & cost review; live-readiness verdict; exact approval-gated command; exact unresolved questions; and explicit statements (no job submitted, no credits spent, no wallet changed, no non-local provider called).

### Approval packet (inside resolution doc) must contain
Exact final job definition; SDK version (`@nosana/kit@2.7.5`); authentication mode (API key only, `client.api`); wallet requirement (NONE for this path); market identifier (pending read-only verification); expected runtime (≤120 s); expected (~$0.0016) and max (US$10 ceiling) cost; exact command `cd smoke-tests/nosana && node run-risk-job.mjs`; result path; fallback path; hard stop after one attempt. Do NOT execute the command.

---

## Approval-gated items (NOT performed in this task; presented for explicit human approval)
1. **Package install**: `@nosana/kit@2.7.5` into `smoke-tests/nosana/` (new `package.json`, `type: module`). Reason: required for live SDK path; dynamic import already fails gracefully until then. Present name/version/directory/reason and WAIT.
2. **Read-only preflight**: `client.api.credits.balance()` + `client.api.markets.list()` to verify credit sufficiency and market `7AtiX...` before the single Post. Requires separate read-only approval.
3. **The single live run** itself (Gate B human approval per `docs/stitchcheck-final-human-approval-checklist.md`).

## Dependencies
- Expert 1 and Expert 2 edit different files; they share the emit contract defined above (Expert 1 emits, Expert 2 consumes).
- Expert 3 is independent (docs only).
- Expert 4 runs after Experts 1-2 complete (regression check).
- Lead resolution doc after all experts return.
- Package install / read-only preflight / live run are blocked behind explicit human approval.

## Risks & mitigations
- SDK signatures verified against docs only (some deep pages 404). Mitigation: pin v2.7.5; cite docs URLs; verify against installed SDK source post-approval.
- Strict validator may reject beyond `meta`. Mitigation: D5 surfaces exact `path/expected` errors pre-pin/pre-credit.
- Evidence filename collision. Mitigation: add timestamped dir while keeping fixed paths for UI.
- Credential leakage. Mitigation: existing stderr/PII guards retained in all edits; `.env.local` never opened.

## Rejected alternatives
- Install `@nosana/kit` immediately: rejected — user requires explicit package approval first.
- Add live market/credit calls now: rejected — requires separate read-only approval; this task is preparation only.
- Take majority opinion on disagreements: rejected — reconcile against official docs.
- Modify UI to surface live evidence: rejected — labels already exist in `labels.ts` and flip via `evidenceSource`; no UI change allowed.
