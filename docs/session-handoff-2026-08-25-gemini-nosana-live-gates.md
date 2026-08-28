# Session Handoff — 2026-08-25 Gemini + Nosana Live Gates

## Session Objective
Step 2 (Gemini live extraction) executed end-to-end: one authorized attempt + one authorized retry, both live-failed with a definitive root cause. Step 3 (Nosana) advanced through preflight and flag activation (gate 3.1/3.2 complete) and stopped at the read-only credit/market approval gate (3.3).

## Checkpoint State

| Flag | Session start | Session end | Notes |
|------|---------------|-------------|-------|
| ATLAS_READ_ONLY_STATUS | CONFIRMED_LIVE | CONFIRMED_LIVE | Unchanged all session, never touched |
| ATLAS_WRITE_STATUS | BLOCKED | BLOCKED | Never touched, no write route executed |
| GEMINI_LIVE_STATUS | NOT_CONFIRMED (framework wired) | NOT_CONFIRMED | Two live attempts, both live-failed (401) |
| NOSANA_LIVE_STATUS | NOT_CONFIRMED (safety-gate blocked) | BLOCKED_PENDING_APPROVAL | Flags activated; awaiting gate 3.3 approval |

## Step 2 — Gemini Live Run

### Preflight findings
- `GEMINI_API_KEY=present`, `DATA_MODE=live`, `GEMINI_MODEL=gemini-3.6-flash` (approved identifier; adapter default and provider-capabilities `approvedModelIdentifier` all agree).
- Code gap found and fixed (**only** code change this session): `app/src/App.tsx` live branch previously sent a hard-coded synthetic 1x1 PNG; it now sends the selected demo fixture image (gem-01…gem-05 imported via `?inline` from `smoke-tests/gemini/fixtures`; first ticket selection wins, fallback gem-01).
- Offline branch, fallback logic, provenance labeling, server handler, and adapter all untouched. Typecheck passed.
- Key architectural facts: `POST /api/gemini/extract` + `POST /api/gemini/status` are Vite middleware (`app/server/gemini-extract.mjs`); the adapter enforces `maxCalls=1` per dev-server lifetime (fresh restart required per attempt); GET on `/api/gemini/*` returns 405 (status endpoint is POST-only).

### Attempt 1 (via Browser agent, gem-01 fixture)
- Exactly 1 POST, HTTP 200, ~341 ms.
- `extractionStatus: "error"`, `providerStatus: { status: "live-failed", executed: true, fallbackUsed: true, evidenceSource: "local-fallback", correlationId: "gemini-1787668195500" }`.
- UI honestly showed `Gemini · unavailable`; no fixture data mislabeled as live.
- Evidence: `smoke-tests/gemini/live-runs/2026-08-25T14-29-55Z/gemini-live-evidence.json` (status `live-failed`).
- Diagnosis at the time: fast non-retryable failure = auth (401/403) or model-not-found (404); network reachability to `generativelanguage.googleapis.com` confirmed fine.

### Authorized retry (user authorization "2B", exactly one additional attempt)
- Fresh dev-server restart; exactly 1 POST, HTTP 200 (proxy-wrapped), 277 ms, no retries.
- **Definitive root cause** captured from sanitized response body: Google v1beta `GenerateContent` returned **401 UNAUTHENTICATED**, reason `ACCESS_TOKEN_TYPE_UNSUPPORTED` ("Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential"). `missingFields: ["all — authentication failed"]`.
- Interpretation: credential TYPE rejected — either the key is invalid/expired OR the auth scheme (API-key header vs OAuth Bearer) doesn't match the credential type. Fix direction for a future session: verify `GEMINI_API_KEY` is a valid AI Studio key for `generativelanguage.googleapis.com`, and verify the adapter/SDK sends it via the correct scheme (`@google/genai` v2.18.0 handles key auth internally, so an invalid/expired key is the more likely cause).
- UI again honest: `Gemini · unavailable`, offline fallback, failed extraction correctly not applied.
- Evidence: `smoke-tests/gemini/live-runs/2026-08-25T14-55-47Z/gemini-live-evidence.json` (status `live-failed`, `providerHttpCode: 401`, `providerErrorReason: ACCESS_TOKEN_TYPE_UNSUPPORTED`). Prior record untouched.
- **VERDICT: GEMINI_LIVE_STATUS = NOT_CONFIRMED.** No further attempts without new explicit approval + corrected credential.
- Dev server stopped; port 5173 confirmed free.

### Regression after Step 2 (all PASS)
- Typecheck clean; build clean.
- 429 offline assertions green: adapter 165, interactions-api 146, gemini-3.7 routing 50, provenance-label 28, cross-provider invariant 40.
- Atlas paths confirmed untouched this session (only `app/src/App.tsx` + the two evidence JSONs were created/modified).

## Step 3 — Nosana (in progress)

### Preflight (completed)
- All six known contract fixes verified FIXED in code:
  1. Job-ID normalization (`normalizeJobPostResponse`)
  2. IPFS retrieval via `client.ipfs.retrieve(resultHash)`
  3. Lowercase state polling
  4. Metadata schema strictness (`meta.trigger` only)
  5. Idempotency key (`generateIdempotencyKey` with `randomUUID` fallback)
  6. Pre/post validation (`validateRiskRequest`/`validateJobDefinition` before submit, `validateRiskResult` on retrieved result)
- SDK: `@nosana/kit` v2.7.5 installed at `smoke-tests/nosana/node_modules`, declared in `smoke-tests/nosana/package.json`. (Code imports `@nosana/kit`, not `@nosana/sdk`.)
- 552 offline assertions green across 9 Nosana suites + schema validator.
- Live flow facts: submission pins via `client.ipfs.pin()`, posts via `client.api.jobs.list({ ipfsHash, market, timeout }, { idempotencyKey })`; cost ceiling enforced on `credits.costUSD` vs `NOSANA_COST_CEILING_USD` (default $10); platform timeout 3600 s, local watchdog 180 s, poll 3 s; single attempt, zero automatic retry; default market in code flagged UNVERIFIED (`7AtiX…cGHq`).
- Evidence convention: `smoke-tests/nosana/results/nosana-risk-result.json` (fixed) + `results/<ISO-ts>/` (timestamped) + `results/evidence/<ts>-<event>.json` sanitized artifacts.

### Prior-session records (note — from previous session's read-only preflight)
- Market `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` was confirmed valid via `client.api.markets.list` (nvidia-3060, PREMIUM, $0.0436/hr) and `credits.balance()` returned 110 assigned credits — so the market MAY already be verified. However, it remains flagged UNVERIFIED in code and **must be re-confirmed** in the gate 3.3 read-only check since balances/markets can change.
- Prior known blocker: `python:3.12-slim` is NOT in the market's `required_images` allowlist; the job definition was subsequently changed to `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter`. Verify this remains the image in `buildRiskJobDefinition` before any live submission.
- Cost ceiling must be enforced on `costUSD` (USD), not `creditsUsed` (internal credit count) — the units bug was already fixed in code.

### Gate 3.1/3.2 — flag activation (user authorization "1B", COMPLETED)
- Duplicate scan: no pre-existing `DEMO_MODE` / `NOSANA_ENABLED` / `NOSANA_LIVE_ENABLED` keys in any casing.
- Append-only diff applied to `.env.local` (3 lines, EOF): `DEMO_MODE=live` / `NOSANA_ENABLED=true` / `NOSANA_LIVE_ENABLED=true`. Byte-safety verified: pre-existing content SHA-256 unchanged, line count +3 exactly.
- Verification output: `DEMO_MODE=live`, `NOSANA_ENABLED=true`, `NOSANA_LIVE_ENABLED=true`, `NOSANA_API_KEY=present`.
- **Important mechanic**: `run-risk-job.mjs` `loadEnvLocal()` reads ONLY `NOSANA_API_KEY` from `.env.local`; the three flags are read from the **inherited shell environment** by `isNosanaLivePermitted()` — so future invocations must export them explicitly (e.g. `DEMO_MODE=live NOSANA_ENABLED=true NOSANA_LIVE_ENABLED=true node smoke-tests/nosana/run-risk-job.mjs --live ...`).

## Pending Approval Gates

1. **GATE 3.3 — read-only credit/market check.** Approval request already presented to the user, awaiting explicit go-ahead: two read-only calls only — `client.api.credits.balance` and `client.api.markets.list` — via a small new script in `smoke-tests/nosana/` using `@nosana/kit`; no job, no spend. Goal: credit-sufficiency boolean + confirmed/UNVERIFIED market verdict for `7AtiX…cGHq`. If market unverifiable → Step 3 stops, no guessing.
2. **GATE 3.4 — final live-job approval block** (SDK version, market, estimated cost vs $10 ceiling, timeout, workload, single-attempt policy, evidence fields). Separate approval required.
3. **GATES 3.5–3.8** — execute one live job, evidence capture, UI/regression check, verdict. Only after 3.4 approval.

## Safety Confirmations (whole session)
- No credential values ever read/printed (presence-only checks; `DATA_MODE`/`GEMINI_MODEL`/`DEMO_MODE`/`NOSANA_*` non-secret flag values excepted per runbook).
- No git mutations; no package installs; Atlas paths untouched; no Atlas write route touched or executed; no media/narration/SRT/presentation files changed.
- Only files created/modified this session: `app/src/App.tsx` (fixture-image fix), `.env.local` (+3 lines, authorized), `smoke-tests/gemini/live-runs/2026-08-25T14-29-55Z/gemini-live-evidence.json`, `smoke-tests/gemini/live-runs/2026-08-25T14-55-47Z/gemini-live-evidence.json`, and this handoff doc.
- All honest-failure labeling verified in UI; no fabricated live claims.

## Next Steps (for the next session)
1. Get user approval for gate 3.3; write and run the read-only credit/market script (remember to pass the three flags via shell env). Per prior-session records above, the market may already be valid — re-confirm, do not assume.
2. If market verified and credits sufficient → present gate 3.4 approval block; on approval run exactly one live job (`run-risk-job.mjs --live` with flags exported), capture sanitized evidence per convention, verify UI `Nosana · live` only on live-success.
3. Run Nosana + cross-provider offline suites, typecheck, build.
4. For Gemini: obtain/verify a valid `GEMINI_API_KEY` (AI Studio key) — the 401 `ACCESS_TOKEN_TYPE_UNSUPPORTED` result points to credential invalidity; then a fresh single attempt needs new explicit approval.
5. Produce the final combined report with the status block:
   - `GEMINI_LIVE_STATUS = NOT_CONFIRMED` (current)
   - `NOSANA_LIVE_STATUS = BLOCKED_PENDING_APPROVAL` (current, gate 3.3)
   - `ATLAS_READ_ONLY_STATUS = CONFIRMED_LIVE`
   - `THREE_PROVIDER_STATUS = PARTIAL_OR_BLOCKED` (current)

## Session Status
**CHECKPOINT** — Step 2 closed (NOT_CONFIRMED, root cause definitive). Step 3 paused at gate 3.3 awaiting user approval.
