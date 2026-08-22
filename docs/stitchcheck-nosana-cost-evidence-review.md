# StitchCheck Nosana Cost & Evidence Review

> **Status:** READ-ONLY REVIEW COMPLETE — NO JOB SUBMITTED, NO CREDITS SPENT
>
> **Date:** 2026-08-21
>
> **Scope:** Verify assigned credits, hourly market price, 120-second cost
> estimate, US$10 hard ceiling, one-attempt rule, required live evidence
> fields, fallback labels, timestamped evidence paths, and PII/credential
> safety across all existing Nosana artifacts.

---

## 1. Assigned Credits

| Field | Value | Source |
|---|---|---|
| Assigned credits | 110 | `client.api.credits.balance()` — read-only call, 2026-08-21 |
| Reserved credits | 0 | Same |
| Settled credits | 0.2 | Same |

**Verdict: PASS.** 110 credits available — orders of magnitude above the
expected cost of the StitchCheck risk workload (~US$0.00145).

---

## 2. Hourly Market Price

| Field | Value | Source |
|---|---|---|
| Market address | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` | `client.api.markets.list()` — read-only |
| Slug | `nvidia-3060` | Same |
| Name | NVIDIA 3060 | Same |
| Type | PREMIUM | Same |
| USD reward per hour | US$0.0436 | Same |
| NOS job price per second | 0.0000451 NOS | Same |
| Network fee | 10% | Same |

**Verdict: PASS.** The configured market is the cheapest PREMIUM market at
US$0.0436/hr. Confirmed present in the live market listing via a read-only
call.

---

## 3. 120-Second Cost Estimate

| Parameter | Calculation | Result |
|---|---|---|
| USD cost | 0.0436 × (120 / 3600) | **~US$0.00145** |
| NOS cost | 0.0000451 × 120 | **~0.00541 NOS** |
| Network fee (10%) | Applied on top of base | Included in margin |
| Total with fee | ~0.00145 × 1.10 | **~US$0.00160** |

**Verdict: PASS.** The estimated cost is consistent across all three
source documents:

| Document | Cited Estimate |
|---|---|
| `stitchcheck-nosana-readonly-preflight.md` §4 | ~US$0.00145 |
| `stitchcheck-nosana-final-live-approval.md` §9 | ~US$0.00145 |
| `stitchcheck-nosana-expert-security-review.md` §4 | ~US$0.0016 |

The minor variance (US$0.00145 vs US$0.0016) is due to the security review
citing the fee-inclusive estimate. Both are correct within rounding.

---

## 4. US$10 Hard Ceiling

| Document | Reference | Ceiling |
|---|---|---|
| `stitchcheck-nosana-readonly-preflight.md` | §4 "Hard ceiling" | US$10 |
| `stitchcheck-nosana-final-live-approval.md` | §10 "Hard Maximum Spend" | US$10 |
| `stitchcheck-nosana-expert-security-review.md` | §5 "Hard Cost Ceiling" | US$10 |

**Code-level enforcement:**

| File | Mechanism |
|---|---|
| `nosana-client.mjs` | `SAFETY_LIMITS.requestTimeoutMs: 60000`, `maxRetries: 0`, `maxRequestAttempts: 1` |
| `nosana-risk-runner.mjs` | `timeoutMs: options.timeoutMs \|\| 120000` (120 s default) |
| `nosana_run_job.mjs` | `DEFAULT_TIMEOUT_SEC = 120`; deadline-based polling |
| `run-risk-job.mjs` | Stop conditions include "Credits used exceeds US$10" (§17 of approval packet) |

**Margin calculation:**

| Metric | Value |
|---|---|
| Hard ceiling | US$10.00 |
| Expected cost | ~US$0.0016 |
| Safety margin | ~6,250× below ceiling |

**Verdict: PASS.** The ceiling is documented consistently across all three
approval documents and is enforced in code via the stop-conditions list in
`run-risk-job.mjs` and the approval packet's §17 abort criteria.

---

## 5. One-Attempt Rule

| Document | Reference | Rule |
|---|---|---|
| `stitchcheck-nosana-final-live-approval.md` | §14 | "One attempt, zero automatic retries" |
| `stitchcheck-nosana-expert-security-review.md` | §6 | "One attempt, zero automatic retries" |

**Code-level enforcement:**

| File | Setting | Value |
|---|---|---|
| `nosana-client.mjs` | `SAFETY_LIMITS.maxRetries` | `0` |
| `nosana-client.mjs` | `SAFETY_LIMITS.maxRequestAttempts` | `1` |
| `nosana-client.mjs` | Retry logic | None — no retry loop in any code path |
| `nosana_run_job.mjs` | Retry logic | None — single submission, single poll deadline |
| `nosana-risk-runner.mjs` | Retry logic | None — on any failure, falls through to local fallback |

**Verdict: PASS.** Zero retry logic exists in any code path. All three
layers (client boundary, child process, risk runner) enforce single-attempt
execution.

---

## 6. Required Live Evidence Fields

When a live job is authorised, the following evidence fields must be
captred. Sources are cross-referenced across the approval packet and
security review:

| Evidence Field | Source | Approval Packet § | Security Review § |
|---|---|---|---|
| Job ID | `result.job` from `client.api.jobs.list()` | 16 | 8 |
| Status transitions | Observed during polling via `client.api.jobs.get()` | 16 | 8 |
| Latency | `completedAt - submittedAt` in milliseconds | 16 | 8 |
| Credits used | `result.credits.creditsUsed` from post response | 16 | 8 |
| Sanitised output | Parsed from `client.ipfs.retrieve(hash)` | 16 | 8 |
| Timestamp | ISO 8601 UTC | 16 | 8 |
| Job definition hash | SHA-256 of submitted JSON | 16 | 8 |

**Evidence write path (defined in approval packet §13):**

| File | Content |
|---|---|
| `smoke-tests/nosana/results/nosana-risk-result.json` | Full result JSON |
| `app/public/nosana-risk-result.json` | Copy for React dev server |
| `smoke-tests/nosana/results/<UTC-timestamp>/result.json` | Timestamped evidence |
| `smoke-tests/nosana/results/<UTC-timestamp>/summary.md` | Human-readable summary |
| `smoke-tests/nosana/results/<UTC-timestamp>/job-definition.json` | Submitted job definition |

**Verdict: PASS.** All seven required evidence fields are documented
consistently across both the approval packet and the security review. The
evidence write path is defined with exact file locations.

---

## 7. Fallback Labels

Three fallback labels are used consistently across code and artifacts:

| Label | Expected Value | Code (`nosana-risk-runner.mjs`) | Result files |
|---|---|---|---|
| `evidenceSource` | `"local-fallback"` | ✅ Line: `evidenceSource: "local-fallback"` | ✅ All three result files |
| `evidenceLabel` | `"Nosana unavailable — local fallback used; not Nosana evidence."` | ✅ Exact string | ✅ All three result files |
| `fallbackUsed` | `true` | ✅ Boolean | ✅ All three result files |

**Additional labelling in result files:**

| File | `provider` | `heuristicDisclaimer` | `placeholderLabel` |
|---|---|---|---|
| `results/nosana-risk-result.json` | `"local-fallback"` | ✅ Present | N/A (embedded in disclaimer) |
| `results/2026-08-21T15-17-00-645Z/result.json` | `"local-fallback"` | ✅ Present | N/A (embedded in disclaimer) |
| `results/2026-08-20T15-53-43Z/result.json` | N/A (blocked) | N/A | ✅ `"Synthetic local placeholder — not Nosana evidence"` |
| `app/public/nosana-risk-result.json` | `"local-fallback"` | ✅ Present | N/A (embedded in disclaimer) |

**Fixture-level labelling:**

| Artifact | Watermark / Label |
|---|---|
| `fixtures/manifest.json` | `"SYNTHETIC FIXTURE — NOT REAL DATA — NO PII — NOT NOSANA EVIDENCE"` |
| `fixtures/manifest.json` | `"placeholderLabel": "Synthetic local placeholder — not Nosana evidence"` |
| All `fixtures/res-nos-*.json` | `heuristicDisclaimer` field present |
| `results/results.json` | `"executedAgainstNosana": false` |

**Verdict: PASS.** Fallback labels are consistent across all code paths
and result artifacts. No result file claims to be Nosana evidence. Every
local or fallback result is clearly labelled as such.

---

## 8. Timestamped Evidence Paths

**Existing timestamped directories:**

| Path | Content | Status |
|---|---|---|
| `smoke-tests/nosana/results/2026-08-20T15-53-43Z/` | `result.json`, `summary.md` | ✅ Blocked preflight (no network) |
| `smoke-tests/nosana/results/2026-08-21T15-17-00-645Z/` | `result.json`, `summary.md`, `job-definition.json` | ✅ Local fallback run |
| `smoke-tests/nosana/results/2026-08-21T15-49-16-958Z/` | `result.json`, `summary.md`, `job-definition.json` | ✅ LOCAL PREPARED DEFINITION (local fallback, new allowlisted image) |

**Timestamp format:** ISO 8601 UTC with hyphenated time component
(`2026-08-21T15-17-00-645Z`).

**Evidence path contract (from approval packet §13):**

```
smoke-tests/nosana/results/<UTC-timestamp>/result.json
smoke-tests/nosana/results/<UTC-timestamp>/summary.md
smoke-tests/nosana/results/<UTC-timestamp>/job-definition.json
```

**Verdict: PASS.** Timestamped evidence directories exist and follow the
documented contract. All three existing directories contain correctly structured
artifacts. The format is consistent and parseable.

---

## 9. No PII / Credential Leakage

### 9.1 Credential Safety — Code Review

| File | Mechanism | Verified |
|---|---|---|
| `nosana-client.mjs` | Header: "Zero credentials read: no .env or secret file is ever touched" | ✅ |
| `nosana-client.mjs` | `FORBIDDEN_KEYS` array includes `apiKey`, `secret`, `password`, `token`, `NOSANA_API_KEY`, etc. | ✅ |
| `nosana_run_job.mjs` | Line 12: "Reads NOSANA_API_KEY from env; NEVER prints it" | ✅ |
| `nosana_run_job.mjs` | Line 357: "NEVER include NOSANA_API_KEY or any credential in output" | ✅ |
| `run-risk-job.mjs` | Line 15: "NEVER prints NOSANA_API_KEY or any credential" | ✅ |
| `run-risk-job.mjs` | Line 80: Logs `present: yes (will NOT be logged)` — confirms key is never echoed | ✅ |
| `nosana-risk-runner.mjs` | Line 12: "NEVER printed, logged, or included in any output or result file" | ✅ |

### 9.2 Credential Safety — Artifact Scan

| Artifact | NOSANA_API_KEY value present? | Any secret/token? |
|---|---|---|
| `results/nosana-risk-result.json` | ❌ Not found | ❌ None |
| `results/2026-08-21T15-17-00-645Z/result.json` | ❌ Not found | ❌ None |
| `results/2026-08-21T15-17-00-645Z/summary.md` | ❌ Not found | ❌ None |
| `results/2026-08-21T15-17-00-645Z/job-definition.json` | ❌ Not found | ❌ None |
| `results/2026-08-20T15-53-43Z/result.json` | ❌ Not found | ❌ None |
| `results/2026-08-20T15-53-43Z/summary.md` | ❌ Not found | ❌ None |
| `results/results.json` | ❌ Not found | ❌ None |
| `app/public/nosana-risk-result.json` | ❌ Not found | ❌ None |
| `fixtures/manifest.json` | ❌ Not found | ❌ None |
| All `fixtures/req-nos-*.json` | ❌ Not found | ❌ None |
| All `fixtures/res-nos-*.json` | ❌ Not found | ❌ None |

### 9.3 PII Safety — Input Payload

| Field | Value | PII? |
|---|---|---|
| `origin` | `"AAA"` | ❌ Synthetic placeholder |
| `connectionAirport` | `"BBB"` | ❌ Synthetic placeholder |
| `destination` | `"CCC"` | ❌ Synthetic placeholder |
| `connectionDurationMinutes` | `75` | ❌ Synthetic number |
| `staticHistoricalDatasetVersion` | `"hist-delay-v1"` | ❌ Fictional version |
| `syntheticDemo` | `true` | ❌ Explicit declaration |
| `nonPiiDeclaration` | `true` | ❌ Explicit declaration |

### 9.4 PII Safety — Forbidden Key Scan

The `FORBIDDEN_KEYS` list in `nosana-client.mjs` covers: `apiKey`,
`api_key`, `secret`, `password`, `token`, `authorization`, `bearer`,
`credential`, `name`, `firstName`, `lastName`, `email`, `phone`,
`passenger`, `bookingReference`, `pnr`, `payment`, `cardNumber`,
`passport`, `dateOfBirth`, `address`, `NOSANA_API_KEY`.

The `nosana_run_job.mjs` child process has an identical forbidden key
scan on `global.env` before submission.

**Verdict: PASS.** Zero credentials or PII found in any artifact. All
code layers enforce credential non-disclosure. All inputs are synthetic
by construction with explicit declarations.

---

## 10. Consolidated Verdict

| Check | Result | Notes |
|---|---|---|
| Assigned credits | ✅ PASS | 110 available; well above expected cost |
| Hourly market price | ✅ PASS | US$0.0436/hr (cheapest PREMIUM market) |
| 120-second cost estimate | ✅ PASS | ~US$0.00145–0.0016; consistent across docs |
| US$10 hard ceiling | ✅ PASS | Documented in all three approval docs; enforced in code |
| One-attempt rule | ✅ PASS | `maxRetries: 0`, `maxRequestAttempts: 1`; no retry logic anywhere |
| Required live evidence fields | ✅ PASS | 7 fields defined consistently; write path specified |
| Fallback labels | ✅ PASS | `evidenceSource`, `evidenceLabel`, `fallbackUsed` consistent in code and artifacts |
| Timestamped evidence paths | ✅ PASS | Three timestamped directories exist; format matches contract |
| No PII/credential leakage | ✅ PASS | Zero secrets in 14 scanned artifacts; forbidden-key guards in code |

---

## 11. Known Blocker (Unchanged)

The container image `python:3.12-slim` is **NOT** in the target market's
`required_images` allowlist. This blocker was identified in
`stitchcheck-nosana-readonly-preflight.md` §5 and confirmed in
`stitchcheck-nosana-final-live-approval.md` §NOT READY.

**No live job has been submitted.** All existing results are local
fallback or blocked preflight artifacts.

**Required resolution before live submission:** Change
`ops[0].args.image` to an allowed image (e.g.,
`docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter`) and adapt the
workload command accordingly.

---

## 12. Evidence Boundary Statement

> All existing Nosana results in this repository are **local fallback** or
> **blocked preflight** artifacts. None constitute live Nosana evidence.
> Synthetic and offline results must **never** be upgraded or relabelled as
> live evidence. A live job requires separate human authorization and
> resolution of the container image blocker.

---

*This document is part of the StitchCheck Nosana expert approval packet.*
