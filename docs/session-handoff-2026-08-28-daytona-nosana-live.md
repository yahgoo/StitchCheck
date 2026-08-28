# Session Handoff — 2026-08-28 Daytona live sandbox + Nosana live job

Night before Daytona HackSprint Singapore. Cursor Grok 4.6. No git commit or push this session (prior live-integration prompts forbade both). HEAD remains `4959653`. Almost all live integration is uncommitted working tree.

Prompt sources:

- `a/cursor-grok-prompt-debug-three-provider-live-path.txt` (read-only diagnosis earlier)
- `a/cursor-prompt-daytona-live-readiness-and-execution.txt` (user typed `approved`)
- `a/cursor-grok-prompt-nosana-live-daytona-demo.txt` (user typed `approved`)

Do not print or commit `DAYTONA_API_KEY`, `NOSANA_API_KEY`, or other credentials.

---

## Demo story for tomorrow (honest)

Two real sponsor executions landed tonight:

1. **Daytona** — one ephemeral sandbox, risk-worker only, no Atlas inside the sandbox, destroyed in `finally`.
2. **Nosana** — one credit-funded GPU job, API-key auth, no wallet, no retry.

Atlas Search/Verify was **not** run live tonight. Default app launch stays `DATA_MODE=offline`. Alternatives still show `Source: Local fixture`. MiniMax/OpenRouter extraction was not re-run as part of this session.

Do not claim Booked / Switched / Atlas Search inside Daytona / live delay data.

---

## Checkpoint — flags (`.env.local`, names and values that are not secrets)

| Flag | End of session | Notes |
|------|----------------|-------|
| `DATA_MODE` | `offline` | Vite default for demo launch |
| `DEMO_MODE` | `live` | Required for Nosana safety gate (non-local) |
| `NOSANA_ENABLED` | `true` | |
| `NOSANA_LIVE_ENABLED` | `true` | |
| `ATLAS_LIVE_READ_ONLY` | `true` | Not exercised live this session |
| `DAYTONA_API_KEY` | present | Never printed |
| `NOSANA_API_KEY` | present | Never printed |
| `NOSANA_MARKET` | unset | Code default used after preflight confirm |

---

## 1. Daytona — risk-worker-only live cycle

**Approved plan:** `node:20-slim`, cpu 1, memory 2GiB, `networkBlockAll: true`, no domain allowlist, exec 90s, TTL 10 min, ephemeral, destroy in `finally`. Max one sandbox this session.

| Field | Value |
|-------|--------|
| SDK | `@daytona/sdk` 0.205.1 (repo root `node_modules`) |
| Runner | `scripts/daytona-live-risk-runner.mjs` (gated: `ALLOW_LIVE=1` + key) |
| Sandbox id (first 8) | `bdd69d6d` |
| Worker | `workers/daytona-risk-worker` only |
| Result | exit 0, `riskBand=medium`, `riskScore=54`, `externalWriteOccurred=false` |
| Destroyed | YES, confirmed |
| Do not recreate | Quota used; do not run `ALLOW_LIVE=1` again unless a new explicit approval |

**First create attempt** failed before any remote sandbox: SDK mutates `labels`; frozen create params threw `Cannot add property code-toolbox-language`. Retry used mutable params. Still one successful create.

Evidence:

- `smoke-tests/daytona/results/daytona-live-risk-2026-08-28T13-01-59-259Z.json`
- `app/public/daytona-risk-live-result.json` (same envelope; `sandboxIdFirst8` only)

UI wiring (Recovery Plan under “See why this is risky”):

- Tag: `Source: Daytona sandbox · live`
- Provenance: `Daytona live risk computation — read-only, sandboxed`
- Missing times/prices/tradeoffs: `not available from Sandbox response`
- How-calculated overlay uses Daytona worker fields (medium, 54, `daytona-risk-worker-v1`, 6ms) when the live envelope is present

Key files:

- `scripts/daytona-live-risk-runner.mjs`
- `app/src/data/daytona-live-risk.ts`
- `app/src/App.tsx` (fetch live envelope; prefer live animation + how-calculated)
- `app/src/components/RecoveryPlanAnimation.tsx` (`dataSourceToTag`, live missing-field label)
- `app/src/components/DataSourceTag.tsx` (`daytona-live`)
- `core/domain/execution-mode.ts` (`daytona-live-risk`)

`scripts/daytona-orchestrator.mjs` remains **MOCK_ONLY**. Atlas-inside-Daytona is still not live-ready.

**Do not** label this as Atlas Search/Verify or `real-atlas-sandbox-inventory`.

---

## 2. Nosana — one live job

Preflight (read-only, no pin/job): assigned credits 110; market `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` CONFIRMED (`nvidia-3060`, PREMIUM, $0.0436/hr); estimated job ~$0.0436 vs $10 ceiling.

Live command (exactly one attempt, no retry):

```bash
cd smoke-tests/nosana && node run-risk-job.mjs --live
```

(`node run-risk-job.mjs` with no flags is still dry-run by design.)

| Field | Value |
|-------|--------|
| Job ID | `8CfUkxFgZnPpC5kxiphD1kozwiJeLYBC4KB33bKPAEp1` |
| Status | completed |
| Credits used | 44 (internal) |
| costUSD | 0.044 |
| Latency | 28388 ms |
| Market | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` |
| IPFS (job def) | `QmPF9E4NZyfu44m2eNHuHZufJ4cccoAPBkidcrJs6QEQVm` |
| IPFS (result) | `QmXG2ZpA6AJYd2zTHxVCarGpPuY6RvtETKoNMYjV3vz6uG` |
| Submitted | 2026-08-28T13:39:46.019Z |
| Completed | 2026-08-28T13:40:14.359Z |
| Risk | medium, 0.2895, 800 simulations |
| Label | `evidenceSource: "nosana-evidence"`, `fallbackUsed: false` |

Evidence (gitignored fixed paths + timestamped audit dir):

- `app/public/nosana-risk-result.json`
- `smoke-tests/nosana/results/nosana-risk-result.json`
- `smoke-tests/nosana/results/2026-08-28T13-40-14-375Z/` (`result.json`, `summary.md`, `job-definition.json`)
- `smoke-tests/nosana/results/evidence/2026-08-28T13-40-14-358Z-completed_success.json`

`observedStates` is empty (job finished on first poll without a string status). Do not submit another job to fill that field.

SDK: `@nosana/kit` 2.7.5 in `smoke-tests/nosana/` only (not root/app). D1–D8 were largely already in `nosana_run_job.mjs`; this session added official `validateJobDefinition` before pin, poll-loop `creditsUsed` capture, timestamped writes from `run-risk-job.mjs`, and `.env.local` flag loading so `--live` is not silently blocked.

UI: no dedicated Nosana panel change. Provider bar maps `nosana-evidence` → **Nosana · live** (`How this works`). How-calculated still prefers the Daytona live envelope when present.

**Do not** run `--live` again without a new literal `approved`.

---

## 3. Demo walkthrough (2 minutes)

1. `cd app && npm run dev` → http://localhost:5173/ (`DATA_MODE=offline`).
2. Ready-made sample → Check my itinerary.
3. Recovery: “See why this is risky” → Daytona live tag + provenance + sandbox missing fields.
4. “How this works” → Nosana · live (from public JSON).
5. Alternatives remain local fixture. Safety footer unchanged. No Booked/Switched.

---

## 4. What next session must not do

- Do not create another Daytona sandbox without a new approval (`ALLOW_LIVE=1`).
- Do not submit another Nosana job without a new approval (`--live`).
- Do not git commit/push unless the user explicitly asks (live JSON for Nosana is gitignored; Daytona public JSON is **not** gitignored).
- Do not claim Atlas live inventory or Gemini-on-runtime-path (extraction is OpenRouter MiniMax unless a later session changes that).
- Atlas-inside-Daytona worker is still not live-ready.

---

## 5. Git / backup

- Repo already has origin `https://github.com/yahgoo/StitchCheck.git`.
- This session did **not** commit or push.
- Nosana live JSON is gitignored; copying the timestamped dir is the durable local audit trail.

If a later session should commit, exclude `.env.local` and do not force-add gitignored Nosana result files unless that is an explicit request.
