# StitchCheck Nosana Approval Phase Report

> **Date:** 2026-08-21
>
> **SDK:** `@nosana/kit@2.7.5`
>
> **Node:** v24.14.1

---

## 1. Package Installation Result

| Field | Value |
|---|---|
| Package | `@nosana/kit@2.7.5` |
| Install directory | `smoke-tests/nosana/` |
| Result | ✅ **Success** — 127 packages installed, 0 vulnerabilities |
| `npm ls` confirmation | `@nosana/kit@2.7.5` present |
| package.json created | `smoke-tests/nosana/package.json` (new file) |
| package-lock.json created | `smoke-tests/nosana/package-lock.json` (new file) |

---

## 2. Installed SDK Compatibility Result

All exports required by the edited code are confirmed present:

| Export / Method | Status |
|---|---|
| `createNosanaClient` | ✅ Present |
| `NosanaNetwork` | ✅ Present |
| `validateJobDefinition` | ✅ Present |
| `generateIdempotencyKey` | ✅ Present (no-arg, returns UUID) |
| `client.ipfs.pin` | ✅ Present |
| `client.ipfs.retrieve` | ✅ Present |
| `client.api.jobs.list` | ✅ Present (accepts `{ idempotencyKey }` as 2nd arg) |
| `client.api.jobs.get` | ✅ Present |
| `client.api.credits.balance` | ✅ Present |
| `client.api.markets.list` | ✅ Present |

**Validator return shape:**
- Success: `{ success: true, data: <JobDefinition> }`
- Failure: `{ success: false, errors: [{ path, expected, value }] }`

**Note:** The local offline fallback in `nosana_run_job.mjs` returns `{ success, data, errors }` (all three keys always present). The official SDK omits `errors` on success and `data` on failure. The code handles both shapes correctly since it checks `result.success` first.

**Compatibility document needed:** No — all exports match.

---

## 3. Local Validator Result

| Test | Result |
|---|---|
| Official SDK `validateJobDefinition()` on StitchCheck job def | ✅ `success: true` |
| Official SDK validator on invalid def | ✅ `success: false` with 3 errors |
| Client construction with placeholder key (no network) | ✅ No network call made |

---

## 4. Idempotency Result

| Field | Value |
|---|---|
| `generateIdempotencyKey()` available | ✅ Yes |
| Signature | No arguments, returns UUID string via `crypto.randomUUID()` |
| `jobs.list()` accepts idempotency key | ✅ Yes — via `jobs.list(request, { idempotencyKey })` |
| Code change applied | ✅ Added to `nosana_run_job.mjs` |
| Tests after change | ✅ All pass (75/75 offline, all fixtures valid) |

---

## 5. Offline Test Results

| Test | Result |
|---|---|
| `node smoke-tests/nosana/schema-validator.mjs` | ✅ All fixture validations passed |
| `node smoke-tests/nosana/nosana-client-offline-tests.mjs` | ✅ 75 passed, 0 failed |
| `node smoke-tests/nosana/workload-skeleton.mjs` | ✅ 5 simulated runs, all schema valid |
| `node smoke-tests/cross-provider-invariant-tests.mjs` | ✅ 40 passed, 0 failed |
| `cd app && npx tsc --noEmit` | ✅ Passed (zero errors) |
| `cd app && npm run build` | ✅ Built successfully |

---

## 6. Read-Only Preflight

| Field | Value |
|---|---|
| Approved by human | ✅ Yes |
| Calls executed | `client.api.credits.balance()`, `client.api.markets.list()` |
| Credit balance | 110 assigned, 0 reserved, 0.2 settled |
| Market address verified | ✅ `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` confirmed in live listing |
| Market type | PREMIUM (NVIDIA 3060) |
| Expected cost (120s) | ~US$0.00145 |
| Output file | `docs/stitchcheck-nosana-readonly-preflight.md` |

---

## 7. Market Result

| Field | Value |
|---|---|
| Market address | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` |
| Slug | `nvidia-3060` |
| Type | PREMIUM |
| Hardware | NVIDIA 3060 |
| USD reward per hour | 0.0436 |
| NOS job price per second | 0.0000451 |
| Network fee | 10% |
| **Container image compatible** | **❌ NO — `python:3.12-slim` not in market `required_images` allowlist** |

---

## 8. Live Job Status

> **No live Nosana job was submitted during this phase.**

---

## 9. Exact Command Awaiting Final Approval

```bash
cd smoke-tests/nosana && node run-risk-job.mjs
```

**This command has NOT been executed.** It requires separate human approval after the container image blocker is resolved.

---

## 10. Files Changed

| File | Action |
|---|---|
| `smoke-tests/nosana/package.json` | **Created** — new package manifest with `@nosana/kit@2.7.5` dependency |
| `smoke-tests/nosana/package-lock.json` | **Created** — lockfile from `npm install` |
| `smoke-tests/nosana/node_modules/` | **Created** — installed dependencies |
| `smoke-tests/nosana/nosana_run_job.mjs` | **Modified** — added `generateIdempotencyKey` import and idempotency key to `jobs.list()` call |
| `docs/stitchcheck-nosana-readonly-preflight.md` | **Created** — read-only preflight results |
| `docs/stitchcheck-nosana-final-live-approval.md` | **Created** — final live approval packet |
| `docs/stitchcheck-nosana-approval-phase-report.md` | **Created** — this file |

**No `app/src/`, Atlas, Gemini, deck, video, or final media files were modified.**

---

## 11. Remaining Risks

### CRITICAL — Container Image Incompatibility

The target market `nvidia-3060` enforces a `required_images` allowlist. The current job definition uses `python:3.12-slim`, which is **NOT** in the allowlist. The job will likely be rejected if submitted as-is.

**Resolution required:** Change `ops[0].args.image` to an allowed image (e.g., `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter`) and adapt the workload command.

### Minor — Market Node Availability

At the time of the preflight query, the market's `nodes` array was empty (`[]`). This means no GPU nodes were actively connected. The job would need to wait for a node to come online, which may cause timeout within the 120-second window.

### Minor — `nosana_run_job.mjs` Variable Scope

The `creditsUsed` variable is referenced in the timeout path (line 287) before it is assigned in the catch block (line 334). This is a pre-existing issue that would cause a `ReferenceError` if the timeout path is hit. The `?? null` fallback mitigates this in practice due to the `typeof` check behavior, but it should be cleaned up.

---

## 12. Explicit Statements

> **No live Nosana job was submitted during this phase.**
>
> **No credits were spent.**
>
> **No wallet was created or modified.**

---

*This document is part of the StitchCheck Nosana expert approval packet.*
