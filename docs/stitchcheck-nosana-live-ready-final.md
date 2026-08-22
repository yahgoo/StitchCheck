# StitchCheck Nosana Live-Ready Final — LEAD-GATE Verdict

> **Status:** LEAD-GATE COMPLETE — ALL 10 GATES PASS — AWAITING SEPARATE EXPLICIT HUMAN APPROVAL
>
> **Date:** 2026-08-22
>
> **SDK:** `@nosana/kit@2.7.5` (installed at `smoke-tests/nosana/node_modules/@nosana/kit`)
>
> **Supersedes:** [`docs/stitchcheck-nosana-live-approval-update.md`](./stitchcheck-nosana-live-approval-update.md) status of "PREPARED — AWAITING LEAD GATE"
>
> **Provenance:** [`docs/stitchcheck-nosana-live-image-resolution.md`](./stitchcheck-nosana-live-image-resolution.md), [`docs/stitchcheck-nosana-sdk-contract-resolution.md`](./stitchcheck-nosana-sdk-contract-resolution.md), `smoke-tests/nosana/nosana-risk-runner.mjs`, `smoke-tests/nosana/nosana_run_job.mjs`, `smoke-tests/nosana/run-risk-job.mjs`

---

## 1. LEAD-GATE Verdict Table

All 10 gates assessed by the lead agent. Verdict recorded verbatim below.

| # | Gate | Verdict | Rationale and Evidence |
|---|---|---|---|
| 1 | Replacement image explicitly in `required_images` | **PASS** | `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter` appears verbatim as an allowlist entry; reproduced in [`docs/stitchcheck-nosana-live-image-resolution.md`](./stitchcheck-nosana-live-image-resolution.md) §3 and hardcoded as `RISK_WORKLOAD_IMAGE` in `smoke-tests/nosana/nosana-risk-runner.mjs` (no env override, no re-tagging) |
| 2 | Image can run the exact workload command | **PASS** | Ubuntu/Python3 base image; command is `sh` + `python3` heredoc with Python stdlib-only imports (`json`, `os`, `sys`, `math`, `random`). **Caveat recorded:** Python presence is inferred from the official TensorFlow image; the image was not pulled or verified locally |
| 3 | Job definition validates with installed SDK | **PASS** | `validateJobDefinition()` returns `success: true`, 0 errors on the final definition with the allowlisted image (`@nosana/kit@2.7.5`; see [`docs/stitchcheck-nosana-live-approval-update.md`](./stitchcheck-nosana-live-approval-update.md) §2.4) |
| 4 | Timeout unit resolved | **PASS** | Seconds; five-source evidence chain in [`docs/stitchcheck-nosana-sdk-contract-resolution.md`](./stitchcheck-nosana-sdk-contract-resolution.md) §B6 (installed SDK OpenAPI schema, `@nosana/kit` README, official Jobs API page, official first-job guide, approved preflight doc) |
| 5 | Job-post response fields correct | **PASS** | Response exposes `job` (the on-chain address) and `credits.creditsUsed`; not `id`/`jobId`. Contract resolution B3, verified in `@nosana/api/dist/routes/jobs/` and schema (`docs/stitchcheck-nosana-sdk-contract-resolution.md`) |
| 6 | Result retrieval correct | **PASS** | Poll `client.api.jobs.get(address)` until `ipfsResult` is set, then `client.ipfs.retrieve(job.ipfsResult)`. Contract resolution B4; implemented in `nosana_run_job.mjs` Steps 2–3 |
| 7 | Idempotency understood | **PASS** | `generateIdempotencyKey()` (no-argument UUID helper); `Idempotency-Key` header optional on `jobs.list`/`jobs.extend`/`jobs.stop`, required on batch; `409` control codes `IDEMPOTENCY_KEY_IN_PROGRESS` / `IDEMPOTENCY_KEY_EXPIRED` / `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` handled by branch on code, not HTTP status. Contract resolution B5 |
| 8 | Expected cost and hard ceiling recorded | **PASS** | ≈ US$0.00145 expected for a 120-second job (0.0436 × 2/60); US$10 hard ceiling. See §7 below and [`docs/stitchcheck-nosana-live-image-resolution.md`](./stitchcheck-nosana-live-image-resolution.md) §8 |
| 9 | Evidence output path timestamped | **PASS** | `results/<UTC-timestamp>/` pattern — `new Date().toISOString().replace(/[:.]/g, "-")` in `nosana-risk-runner.mjs`; three timestamped directories already exist under `smoke-tests/nosana/results/` |
| 10 | UI shows `nosana-evidence` only after completion + validation + sanitized evidence | **PASS** | RiskPanel gates on `evidenceSource === 'nosana-evidence'`; the runner only sets that value after child-process success, `validateNosanaOutput()`, and `validateRiskResult()`. Current state: all local-fallback |

**Result: 10 / 10 PASS.**

---

## 2. Exact Replacement Image

Verbatim, as recorded in the `RISK_WORKLOAD_IMAGE` constant of `smoke-tests/nosana/nosana-risk-runner.mjs` and in the market `required_images` allowlist:

```
docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter
```

- Used verbatim — not shortened, not re-tagged, no environment-variable override exists in the runner.
- The previous image (`python:3.12-slim`) was rejected: not present in the allowlist.
- Allowlist provenance: reproduced verbatim in [`docs/stitchcheck-nosana-live-image-resolution.md`](./stitchcheck-nosana-live-image-resolution.md) §3 from [`docs/stitchcheck-nosana-readonly-preflight.md`](./stitchcheck-nosana-readonly-preflight.md); see risk disclosure in §12 below.

---

## 3. Exact Final Job Definition

Transcribed from `buildRiskJobDefinition()` in `smoke-tests/nosana/nosana-risk-runner.mjs` (structure exact; long embedded script content summarized):

```json
{
  "version": "0.1",
  "type": "container",
  "ops": [
    {
      "id": "stitchcheck-risk-calc",
      "type": "container/run",
      "args": {
        "image": "docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter",
        "cmd": "python3 << 'PYEOF'\n<PYTHON_RISK_SCRIPT>\nPYEOF"
      }
    }
  ],
  "meta": {
    "trigger": "api"
  },
  "global": {
    "env": {
      "RISK_INPUT_DATA": "<JSON.stringify(itineraryPayload)>",
      "HISTORICAL_DELAY_DATA": "<JSON.stringify(historicalData)>"
    }
  }
}
```

Notes, exactly as in source:

- `cmd` is built as `"python3 << 'PYEOF'\n" + PYTHON_RISK_SCRIPT + "\nPYEOF"` — the Python script is passed via a heredoc run from stdin by the container shell.
- `PYTHON_RISK_SCRIPT` (summarized): Python stdlib-only (`json, os, sys, math, random`); reads `RISK_INPUT_DATA` and `HISTORICAL_DELAY_DATA` from env, seeds `random.seed(42)`, runs a bounded Monte Carlo simulation (`n_sims = min(1000, max(100, sample))`), computes `riskScore = round(min(1.0, max(0.0, miss_rate * 0.6 + tight_ratio * 0.4)), 4)`, maps to band `low`/`medium`/`high`, and prints exactly one JSON line (`riskScore`, `riskBand`, `assumptions`, `simulationCount`, `explanation`) to stdout.
- `global.env` carries exactly two keys: `RISK_INPUT_DATA` and `HISTORICAL_DELAY_DATA` — both non-PII synthetic JSON. A project-specific PII guard in `validateJobDefinition()` forbids credential/PII-like env keys.
- `meta` contains only `trigger: "api"` — the only permitted schema keys are `trigger` and `system_resources`; custom metadata is deliberately excluded.
- **The timeout is NOT part of the job definition.** It is supplied at submission time as `timeout: 120` (seconds) in the `client.api.jobs.list()` call — see §4 and §5.

---

## 4. Exact SDK Call Sequence

Transcribed from `smoke-tests/nosana/nosana_run_job.mjs` (`DEFAULT_TIMEOUT_SEC = 120`, `POLL_INTERVAL_MS = 3000`):

```js
// 0. Dynamic import — @nosana/kit@2.7.5 must be installed
const { createNosanaClient, NosanaNetwork, generateIdempotencyKey } = await import("@nosana/kit");

// 1. Client construction (API-key only, no wallet) — contract B1
const nosanaClient = createNosanaClient(NosanaNetwork.MAINNET, {
  api: { apiKey },
});

// 2. Pin job definition to IPFS — returns the hash string directly — contract B2
const pinResult = await nosanaClient.ipfs.pin(jobDef);
// resolvedHash = pinResult (string); fallbacks pinResult.hash / pinResult.IpfsHash retained for shape safety

// 3. Post job to market with idempotency key — contract B3, B5
const idempotencyKey = generateIdempotencyKey();
const job = await nosanaClient.api.jobs.list(
  { ipfsHash: resolvedHash, market, timeout: timeoutSec },   // timeoutSec = 120 (seconds)
  { idempotencyKey },
);
// Official response fields: job.job (the on-chain address), job.credits.creditsUsed
const jobId = job.job || job.id || job.jobId;   // job.job is the official field
const creditsUsed = job?.credits?.creditsUsed ?? null;

// 4. Poll until terminal — contract B4
const deadline = Date.now() + timeoutSec * 1000;   // 120 000 ms
while (Date.now() < deadline) {
  await sleep(POLL_INTERVAL_MS);                   // 3000 ms
  const status = await nosanaClient.api.jobs.get(jobId);
  // normalizeJobStatus() prefers jobStatus (string), falls back to string state;
  // never guesses from numeric state.
  // isTerminalJobStatus() is true when ipfsResult/result is present OR
  // normalized status ∈ { completed, failed, stopped }.
  if (isTerminalJobStatus(status)) { finalJob = status; break; }
}

// 5. Retrieve result from IPFS — contract B2/B4
const rawResult = await nosanaClient.ipfs.retrieve(finalJob.ipfsResult);
// Container emitted one JSON line on stdout; last line is parsed as the result.
```

Supporting contract facts (all from [`docs/stitchcheck-nosana-sdk-contract-resolution.md`](./docs/stitchcheck-nosana-sdk-contract-resolution.md), verified against installed SDK source):

- Terminal states: `completed`, `failed`, `stopped`. `failed`/`stopped` are terminal-without-result; the loop exits promptly and the caller surfaces a labelled failure — a score is never invented.
- There is no `ipfs.add`; retrieval is `client.ipfs.retrieve(hash)` (not `ipfs.get()`).

---

## 5. Exact Timeout and Units

| Parameter | Value | Source |
|---|---|---|
| Approved job timeout | **120 seconds** (2 minutes) | `DEFAULT_TIMEOUT_SEC = 120` in `nosana_run_job.mjs`; approved preflight doc §4 |
| Unit | **SECONDS** — dispute resolved definitively | Five-source evidence chain, [`docs/stitchcheck-nosana-sdk-contract-resolution.md`](./stitchcheck-nosana-sdk-contract-resolution.md) §B6 |
| SDK schema default | 3600 seconds (1 hour); StitchCheck overrides to 120 | Installed SDK OpenAPI schema: `/** @description Job timeout in seconds (default: 3600) */` |
| Client-side poll deadline | `timeoutSec * 1000` ms (120 000 ms), poll interval 3000 ms | `nosana_run_job.mjs` |
| Wrapper child-process timeout | `timeoutMs + 5000` ms (slightly longer than the job timeout) | `nosana-risk-runner.mjs` (`timeoutMs` default 120000) |

---

## 6. Exact Market

| Field | Value |
|---|---|
| Market address | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` |
| Slug | `nvidia-3060` |
| Tier | PREMIUM |
| USD reward per hour | ~US$0.0436 |
| Assigned credits | 110 |
| Default in code | `DEFAULT_MARKET` in `nosana_run_job.mjs` and fallback default in `nosana-risk-runner.mjs` (overridable via `--market` / `NOSANA_MARKET`) |

---

## 7. Cost Envelope

| Parameter | Value |
|---|---|
| Expected cost for a 120-second job | **≈ US$0.00145** (0.0436 × 2/60) |
| Hard maximum cost (ceiling) | **US$10** |
| Available credits | 110 (0 reserved, 0.2 settled) |

The expected cost is orders of magnitude below the hard ceiling. Any cost anomaly is a stop condition (§9).

---

## 8. Exact Command Awaiting Separate Human Approval

The live entry point is `smoke-tests/nosana/run-risk-job.mjs` (usage per its header: `node smoke-tests/nosana/run-risk-job.mjs [--skip-nosana] [--market <addr>] [--timeout <ms>]`). The exact command awaiting approval, as recorded in [`docs/stitchcheck-nosana-live-approval-update.md`](./stitchcheck-nosana-live-approval-update.md) §5:

```bash
cd smoke-tests/nosana && node run-risk-job.mjs
```

> **DO NOT EXECUTE WITHOUT SEPARATE EXPLICIT HUMAN APPROVAL.**
>
> This command has NOT been executed. It loads `NOSANA_API_KEY` from `.env.local` (never printed), builds and validates the job definition, submits to Nosana, and writes results. Live submission requires, in order: (1) lead gate clearance — recorded here, then (2) separate explicit human approval of the exact submission, including the allowlisted image and the 120-second timeout.

---

## 9. One-Attempt Stop Rule

**Exactly ONE live submission attempt.** Any failure, timeout, terminal-without-result, cost anomaly, or unexpected error stops all further attempts pending human review. No automatic retries exist in any code path.

Stop conditions (from [`docs/stitchcheck-nosana-live-image-resolution.md`](./stitchcheck-nosana-live-image-resolution.md) §12):

1. Allowlist mismatch.
2. Validation failure.
3. Timeout ambiguity.
4. Cost above the US$10 ceiling.
5. Missing credential.
6. Any wallet/IPFS/credit side effect that was not part of the approved single job post.
7. Empty market node pool persisting (scheduling risk).
8. Any unexpected error.

---

## 10. Fallback Wording and UI Gating

Exact wording strings (verbatim):

- `Synthetic local placeholder — not Nosana evidence`
- `Nosana unavailable — local fallback used; not Nosana evidence`

The runner's fallback constant is exactly `"Nosana unavailable — local fallback used; not Nosana evidence."` and every fallback/local result carries `evidenceSource: "local-fallback"`. The value `evidenceSource: "nosana-evidence"` is set only when the remote job succeeds, the raw output passes `validateNosanaOutput()`, and the built risk result passes `validateRiskResult()`.

**The UI stays in fallback until validated live evidence exists.** RiskPanel gates on `evidenceSource === 'nosana-evidence'`; current state is all local-fallback.

---

## 11. Evidence Paths and Fields

Evidence output paths (all timestamped, from `nosana-risk-runner.mjs`):

| Path | Purpose |
|---|---|
| `smoke-tests/nosana/results/<UTC-timestamp>/result.json` | Full structured result (`<UTC-timestamp>` = `new Date().toISOString()` with `:`/`.` replaced by `-`) |
| `smoke-tests/nosana/results/<UTC-timestamp>/summary.md` | Human-readable evidence summary |
| `smoke-tests/nosana/results/<UTC-timestamp>/job-definition.json` | Definition labelled `LOCAL PREPARED DEFINITION — not submitted to Nosana` or `SUBMITTED DEFINITION — posted to Nosana network` by execution mode |
| `smoke-tests/nosana/results/nosana-risk-result.json` | Latest result copy |
| `app/public/nosana-risk-result.json` | Served copy for the React dev server — written **only after sanitization** (validated result, no credentials, no PII) |

Three timestamped directories already exist under `smoke-tests/nosana/results/` from prior local runs.

Evidence fields captured per the gate requirement:

| Evidence Field | Description |
|---|---|
| Job ID / address | `job` address returned by the post response |
| Observed states | All state transitions observed during polling (`observedStates`, de-duplicated) |
| Latency | End-to-end duration of the job (`latencyMs`) |
| Credits used | `credits.creditsUsed` from the post response |
| Market address | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` |
| IPFS hash — job definition | Hash returned by `client.ipfs.pin()` |
| IPFS hash — result | `ipfsResult` from the completed job |
| Sanitized result | Validated output with no credentials or PII |
| UTC timestamp | ISO 8601 |

---

## 12. Known Risks (disclosed honestly)

| # | Risk | Detail |
|---|---|---|
| 1 | Allowlist provenance | The sole record of the `required_images` allowlist is the preflight markdown (`docs/stitchcheck-nosana-readonly-preflight.md`); the raw `markets.list()` payload was not persisted. A separate-approved read-only markets re-check is **recommended before submission** (not executed here). |
| 2 | Empty node pool | The market `nodes` array was empty at preflight; a posted job may queue past the 120-second window (scheduling/queue risk within the 120 s window). |
| 3 | GPU market, CPU workload | The workload is CPU-only; GPU capability is unused (cost immaterial at ~US$0.0436/hour). |
| 4 | `required_images` semantics | Official docs describe cached image **availability**, not a documented hard reject; exact rejection behaviour is not fully documented. Enforcement is market/node-side only — neither the SDK client nor `validateJobDefinition()` checks the allowlist. |

---

## 13. Explicit Confirmation

> This task was documentation only. No code was edited, no tests were run, no network call was made, and no `.env.local` values or `NOSANA_API_KEY` were read or printed. No job submitted. No credits spent. No IPFS pin.

---

*This document is part of the StitchCheck Nosana expert approval packet.*

No live Nosana job was submitted during this task.
