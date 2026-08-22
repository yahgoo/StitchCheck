# StitchCheck Nosana Final Live Approval Packet

> **Status:** NOT READY — CONTAINER IMAGE BLOCKER MUST BE RESOLVED
>
> **Date:** 2026-08-21
>
> **This task did NOT submit a live job.**

---

## 1. Installed SDK Version

| Field | Value |
|---|---|
| Package | `@nosana/kit` |
| Version | `2.7.5` |
| Install directory | `smoke-tests/nosana/node_modules/@nosana/kit` |
| Installed at | 2026-08-21 (this session) |

---

## 2. Node Version

| Field | Value |
|---|---|
| Node.js | v24.14.1 |
| SDK requirement | >=20.18 |
| Status | ✅ Satisfied |

---

## 3. Authentication Mode

| Field | Value |
|---|---|
| Method | API key via `client.api` |
| Config key name | `NOSANA_API_KEY` |
| Config location | `.env.local` |
| Wallet required | **No** — API key is sufficient for the `client.api` path |
| Wallet path needed | Only for on-chain `client.jobs.post()` (Solana transaction signing) — not used |

---

## 4. Wallet Requirement

**No wallet is required or created.** The integration uses the credit-funded `client.api` path, which authenticates via API key only.

---

## 5. Exact Validated Job Definition

> SUPERSEDED — container image replaced with docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter; see docs/stitchcheck-nosana-live-image-resolution.md and docs/stitchcheck-nosana-live-approval-update.md.

```json
{
  "version": "0.1",
  "type": "container",
  "ops": [
    {
      "id": "stitchcheck-risk-calc",
      "type": "container/run",
      "args": {
        "image": "python:3.12-slim",
        "cmd": "python3 << 'PYEOF'\n<python risk script>\nPYEOF"
      }
    }
  ],
  "meta": {
    "trigger": "api"
  },
  "global": {
    "env": {
      "RISK_INPUT_DATA": "<JSON: origin, connectionAirport, destination, connectionDurationMinutes, staticHistoricalDatasetVersion, syntheticDemo, nonPiiDeclaration>",
      "HISTORICAL_DELAY_DATA": "<JSON: airports and routes historical delay data>"
    }
  }
}
```

**Validated by:** Official SDK `validateJobDefinition()` from `@nosana/kit@2.7.5`
**Result:** `{ success: true, data: <JobDefinition> }` ✅

---

## 6. Job-Definition Hash

To be computed at submission time. The definition is deterministic for a given input payload and historical data. The exact SHA-256 hash will be recorded in the evidence artifacts.

---

## 7. Exact Market Address and Verification Evidence

| Field | Value |
|---|---|
| Address | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` |
| Slug | `nvidia-3060` |
| Name | NVIDIA 3060 |
| Type | PREMIUM |
| Verification | ✅ Confirmed present in live `client.api.markets.list()` response |
| Verification date | 2026-08-21 |

---

## 8. Maximum Runtime

**120 seconds.** The `timeout` parameter is in seconds (confirmed via SDK and official docs). The default is 3600 seconds; StitchCheck overrides to 120.

---

## 9. Expected Cost

| Basis | Value |
|---|---|
| USD reward per hour | US$0.0436 |
| Expected cost for 120s | ~US$0.00145 |
| NOS job price per second | 0.0000451 NOS |
| Expected NOS for 120s | ~0.00541 NOS |
| Network fee | 10% |

---

## 10. Hard Maximum Spend

**US$10.** The integration is designed for exactly one job attempt with zero retries. The expected cost (~US$0.00145) is orders of magnitude below this ceiling.

---

## 11. Exact Input Payload — Non-PII Proof

```json
{
  "correlationId": "nosana-risk-cli-<timestamp>",
  "origin": "AAA",
  "connectionAirport": "BBB",
  "destination": "CCC",
  "connectionDurationMinutes": 75,
  "staticHistoricalDatasetVersion": "hist-delay-v1",
  "syntheticDemo": true,
  "nonPiiDeclaration": true
}
```

**Non-PII confirmation:**
- Airport codes `AAA`, `BBB`, `CCC` are synthetic placeholders (not real IATA codes).
- Connection duration `75` minutes is synthetic.
- Historical dataset contains only aggregate airport statistics (no personal data).
- `syntheticDemo: true` and `nonPiiDeclaration: true` explicitly declare the synthetic nature.
- The `validateJobDefinition()` PII guard scans `global.env` for forbidden keys (names, emails, cards, etc.) and rejects any match.

---

## 12. Exact Command

```bash
cd smoke-tests/nosana && node run-risk-job.mjs
```

---

## 13. Expected Output Files

| File | Content |
|---|---|
| `smoke-tests/nosana/results/nosana-risk-result.json` | Full result JSON |
| `app/public/nosana-risk-result.json` | Copy for React dev server |
| `smoke-tests/nosana/results/<UTC-timestamp>/result.json` | Timestamped evidence |
| `smoke-tests/nosana/results/<UTC-timestamp>/summary.md` | Human-readable summary |
| `smoke-tests/nosana/results/<UTC-timestamp>/job-definition.json` | Submitted job definition |

---

## 14. One-Attempt Rule

**One attempt, zero automatic retries.** The code enforces `maxRetries: 0` and `maxRequestAttempts: 1`. No retry logic exists in any code path.

---

## 15. Timeout and Fallback Behaviour

| Scenario | Behaviour |
|---|---|
| Job completes within 120s | Parse result, validate, emit Nosana evidence |
| Job times out (120s) | Fall back to local heuristic calculation |
| SDK init fails | Fall back to local heuristic calculation |
| API key missing | Fall back to local heuristic calculation |
| Job fails | Fall back to local heuristic calculation |
| Output validation fails | Fall back to local heuristic calculation |
| Any unhandled error | Fall back to local heuristic calculation |

The fallback result is always labelled:
- `evidenceSource: "local-fallback"`
- `evidenceLabel: "Nosana unavailable — local fallback used; not Nosana evidence."`
- `fallbackUsed: true`

---

## 16. Required Live Evidence

| Evidence Field | Source |
|---|---|
| Job ID | `result.job` from `client.api.jobs.list()` |
| Status transitions | Observed during polling via `client.api.jobs.get()` |
| Latency | `completedAt - submittedAt` in milliseconds |
| Credits used | `result.credits.creditsUsed` from post response |
| Sanitised output | Parsed from `client.ipfs.retrieve(hash)` |
| Timestamp | ISO 8601 UTC timestamps |
| Job definition hash | SHA-256 of submitted JSON |

---

## 17. Exact Stop Conditions

The live command must be aborted if:
1. Any unexpected error occurs.
2. The job does not complete within 120 seconds.
3. The output fails validation.
4. Credits used exceeds US$10.
5. The SDK attempts to access a wallet or private key.
6. Any credential is unexpectedly logged.

---

## 18. Explicit Confirmation

> **This task did NOT submit a live job.**
>
> All work in this session was offline preparation, SDK installation, local validation, and read-only preflight. No `client.api.jobs.list()` call was made. No IPFS pin was created. No credits were spent. No wallet was created or modified.

---

## NOT READY — Blocker

The approval packet **cannot say "ready"** because:

### Container Image Incompatibility

The target market `nvidia-3060` (`7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq`) enforces a `required_images` allowlist. The current job definition uses `python:3.12-slim`, which is **NOT** in the allowlist.

**Required resolution before live submission:**
Change `ops[0].args.image` to an allowed image (e.g., `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter`) and adapt the workload command accordingly.

See: [`docs/stitchcheck-nosana-readonly-preflight.md`](./stitchcheck-nosana-readonly-preflight.md) §5 for full details.

---

*This document is part of the StitchCheck Nosana expert approval packet.*
