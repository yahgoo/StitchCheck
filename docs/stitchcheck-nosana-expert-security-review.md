# StitchCheck Nosana Expert Security Review

> **Status:** OFFLINE PREPARATION COMPLETE — NO LIVE JOB SUBMITTED
>
> **Date:** 2026-08-21
>
> **Scope:** Nosana risk-workload integration for the StitchCheck hackathon demo.

---

## 1. Credential Safety

- **No credentials logged or persisted.** `NOSANA_API_KEY` is read from environment only; it is never printed, logged, written to any output file, or included in any emitted JSON.
- The child process (`nosana_run_job.mjs`) inherits `NOSANA_API_KEY` via `process.env` but never echoes it to stdout or stderr.
- The CLI entry point (`run-risk-job.mjs`) reads `.env.local` only to populate `process.env.NOSANA_API_KEY`; the value is never printed.
- Credential/PII scan on all generated outputs: **zero matches**.

## 2. PII Safety

- **No PII in workload.** All inputs are synthetic, non-PII data:
  - Airport codes: `AAA`, `BBB`, `CCC` (synthetic placeholders).
  - Connection duration: `75` minutes (synthetic).
  - Historical delay data: static fixture file with aggregate airport statistics only.
- The job definition's `global.env` is scanned for forbidden keys (PII, secrets) by `validateJobDefinition()` before any submission.
- The `validateRiskRequest()` function performs recursive PII key scanning.

## 3. Timeout

- **Maximum timeout: 120 seconds.**
- The Nosana API timeout parameter is in **seconds** (confirmed via official docs).
- The official default is 3600 seconds (1 hour); StitchCheck overrides to 120 seconds.
- The child process spawn timeout is `120000 + 5000 = 125000` ms (slightly above the job timeout for graceful shutdown).

## 4. Estimated Cost

- **Estimated cost: ~US$0.0016** at the cited market rate for a single Python container job with no GPU requirement.
- This is a heuristic estimate based on publicly available Nosana pricing information.

## 5. Hard Cost Ceiling

- **Hard ceiling: US$10.**
- The integration is designed for exactly one job attempt with zero retries.
- If the job fails or times out, the system falls back to local computation at zero additional cost.

## 6. Attempt Limit

- **One attempt, zero automatic retries.**
- The offline client boundary enforces `maxRetries: 0` and `maxRequestAttempts: 1`.
- No automatic retry logic exists in any code path.

## 7. Fallback Behaviour

- On **any** failure (SDK not installed, API key missing, job timeout, job failure, output validation failure, risk result validation failure), the system falls back to a **local heuristic calculation** that runs entirely in Node.js.
- The fallback result is clearly labelled:
  - `evidenceSource: "local-fallback"`
  - `evidenceLabel: "Nosana unavailable — local fallback used; not Nosana evidence."`
  - `fallbackUsed: true`
- The fallback never claims to be Nosana evidence.

## 8. Required Live Evidence (when a live job is authorised)

When a live Nosana job is submitted (pending human approval), the following evidence is captured:

| Evidence Field | Source |
|---|---|
| Job ID | `result.job` from `client.api.jobs.list()` |
| Status transitions | Observed during polling via `client.api.jobs.get()` |
| Latency | `completedAt - submittedAt` in milliseconds |
| Sanitised result | Parsed from `client.ipfs.retrieve(hash)` |
| Credits used | `result.credits.creditsUsed` from post response |
| Timestamp | ISO 8601 UTC timestamps for submission and completion |
| Exact job definition | Persisted in `results/<UTC-timestamp>/job-definition.json` |

Evidence artifacts are written to: `smoke-tests/nosana/results/<UTC-timestamp>/`

## 9. Judge-Facing Wording

### Live Nosana Evidence
> "This result was produced by a Nosana decentralized GPU workload. The job was posted to the Nosana network, executed in a container, and the result was retrieved from IPFS. Evidence includes job ID, status transitions, latency, credits used, and the exact job definition."

### Offline Validation
> "All Nosana integration code has been validated offline using synthetic fixtures. The schema validator, client boundary tests, workload skeleton, and cross-provider invariant tests all pass without any network access or credential usage."

### Local Fallback
> "This result was produced by a local heuristic calculation. Nosana was not contacted. The result is a heuristic indication only — not a prediction or guarantee, and not Nosana evidence."

### Blocked Execution
> "Nosana execution is blocked pending human approval. The market address has not been verified via a read-only API call. No credits have been spent. The system falls back to local computation."

## 10. Explicit Statement

> **"No live Nosana job was submitted during this task."**
>
> All code changes in this session are offline preparation only. No `@nosana/kit` installation was performed. No network call was made to any Nosana endpoint. No credits were spent. No wallet was created or modified. No IPFS pin was created. No job was posted.

---

*This document is part of the StitchCheck Nosana expert approval packet.*
