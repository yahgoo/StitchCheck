# StitchCheck Nosana Live Approval Update

> **Status:** PREPARED — AWAITING LEAD GATE + SEPARATE EXPLICIT HUMAN APPROVAL
>
> **Date:** 2026-08-21
>
> **SDK:** `@nosana/kit@2.7.5`
>
> **Updates:** [`docs/stitchcheck-nosana-final-live-approval.md`](./stitchcheck-nosana-final-live-approval.md) (prior status: **NOT READY — container image blocker**)

---

## 1. Prior Approval State

The prior packet ([`docs/stitchcheck-nosana-final-live-approval.md`](./stitchcheck-nosana-final-live-approval.md)) concluded **NOT READY** because the job definition used `python:3.12-slim`, which is not in the target market's `required_images` allowlist. All other packet elements (SDK version, authentication mode, market verification, cost envelope, non-PII proof, one-attempt rule, stop conditions) were already approved.

---

## 2. What Changed Since Last Approval

### 2.1 Container Image — Blocker Resolved

| Field | Before | After |
|---|---|---|
| `ops[0].args.image` | `python:3.12-slim` (not allowlisted) | `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter` (allowlisted, verbatim) |
| Env override of the image | Present | **Removed** — a non-allowlisted image can never be submitted |

Full analysis: [`docs/stitchcheck-nosana-live-image-resolution.md`](./stitchcheck-nosana-live-image-resolution.md).

### 2.2 Bug Fixes (applied by the code specialist; documented as fact)

| Fix | Detail |
|---|---|
| `ReferenceError` | Fixed the catch-block scoping issue for `job`/`creditsUsed` in `nosana_run_job.mjs` |
| TDZ error | Fixed the temporal-dead-zone access on the timeout path in `nosana_run_job.mjs` |
| Terminal-state detection | Added `normalizeJobStatus()` / `isTerminalJobStatus()` handling numeric `state` vs string `jobStatus`; failed/stopped jobs now exit promptly |

These correspond to the "Minor — `nosana_run_job.mjs` Variable Scope" risk recorded in [`docs/stitchcheck-nosana-approval-phase-report.md`](./stitchcheck-nosana-approval-phase-report.md) §11, now resolved.

### 2.3 New Offline Test Suite

New suite `smoke-tests/nosana/nosana-workload-portability-tests.mjs`: **37 passed, 0 failed**.

### 2.4 Final Validation

- `validateJobDefinition()` (official `@nosana/kit@2.7.5`): **`success: true`** on the final definition with the allowlisted image.

### 2.5 All Offline Suites Pass

| Suite | Result |
|---|---|
| `schema-validator.mjs` | ✅ 21/21 |
| `nosana-client-offline-tests.mjs` | ✅ 75/75 |
| `workload-skeleton.mjs` | ✅ 5/5 |
| `nosana-workload-portability-tests.mjs` | ✅ 37/37 |
| `cross-provider-invariant-tests.mjs` | ✅ 40/40 |

### 2.6 SDK Contract Clarification

The timeout-unit dispute (minutes vs seconds) is **definitively resolved: seconds**, verified against the installed SDK's OpenAPI schema, kit README, and official docs. Approved timeout remains **120 seconds**. Full resolutions B1–B6: [`docs/stitchcheck-nosana-sdk-contract-resolution.md`](./stitchcheck-nosana-sdk-contract-resolution.md).

---

## 3. Unchanged Safety Envelope (restated)

| Control | Value |
|---|---|
| Expected cost (120 s) | ~US$0.00145 |
| Hard maximum cost | US$10 |
| Attempts | Exactly **one**; any failure/timeout/abnormal result stops further attempts pending human review |
| Authentication | API key only (`NOSANA_API_KEY`); no wallet |
| Market | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` (nvidia-3060, PREMIUM) |
| UI gating | Nosana evidence shown only after job completion + result validation + sanitized evidence creation; labels remain fallback/synthetic until then |
| Fallback wording | "Synthetic local placeholder — not Nosana evidence" / "Nosana unavailable — local fallback used; not Nosana evidence" |

Stop conditions (unchanged): allowlist mismatch, validation failure, timeout ambiguity, cost above ceiling, missing credential, any wallet/IPFS/credit side effect, empty market node pool persisting, or any unexpected error.

---

## 4. Remaining Risks (disclosed honestly)

1. **Allowlist provenance** — the sole record is the preflight markdown; the raw `markets.list()` payload was not persisted. A separate approved read-only re-verification before submission is recommended (not executed here).
2. **Empty node pool** — the market `nodes` array was empty at preflight; the posted job may queue past the 120 s window.
3. **GPU market for a CPU-only workload** — GPU capability unused; cost immaterial.
4. **`required_images` semantics** — docs describe cached availability, not an explicit hard reject.

---

## 5. Current Status

**PREPARED — awaiting lead gate + separate explicit human approval of the exact submission.**

The command awaiting approval is unchanged from the prior packet:

```bash
cd smoke-tests/nosana && node run-risk-job.mjs
```

**This command has NOT been executed.** Live submission requires, in order: (1) lead gate clearance, then (2) separate explicit human approval of the exact submission, including the allowlisted image and the 120-second timeout.

---

## 6. Explicit Confirmation

> **No job submitted. No credits spent. No IPFS pin.**
>
> All work since the last approval was offline: code fixes, offline test suites, local validation, and documentation. No `client.api.jobs.list()` call was made, no `client.ipfs.pin()` call was made, and no wallet was created or modified. No credential values were read or printed by this documentation task.

---

*This document is part of the StitchCheck Nosana expert approval packet.*

No live Nosana job was submitted during this task.
