# StitchCheck — Nosana Evidence Plan (Read-Only Audit)

> **Status:** READ-ONLY AUDIT — no external writes, no Nosana calls, no credits spent, no source files modified, no secrets accessed.
> **Date:** 2026-08-21
> **Scope:** Full read-only audit of the Nosana integration across project documentation, smoke-test implementation, official Nosana documentation (https://learn.nosana.com/), and the React UI layer.
> **Constraint:** `.env.local` was not read. No Nosana API call was made. No package was installed. No Git operation was performed.

---

## 1. Exact Documented API/SDK Flow

The Nosana platform exposes both a **REST HTTP API** and a **TypeScript SDK** (`@nosana/kit`). The documented end-to-end flow for running a workload is:

### 1.1 Prerequisites (per official docs)

| Prerequisite | Source |
|---|---|
| Nosana API key (`NOSANA_API_KEY`) obtained from dashboard | `learn.nosana.com/api/intro.html` |
| Credit balance > 0 in the Nosana account | `learn.nosana.com/api/credits.html` |
| Valid job definition (JSON matching schema `version: "0.1"`, `type: "container"`) | `learn.nosana.com/deployments/jobs/job-definition/schema.html` |
| Target GPU market address (Solana address) | `learn.nosana.com/api/markets.html` |

### 1.2 Authentication

```
Authorization: Bearer $NOSANA_API_KEY
```

Base URL: `https://dashboard.k8s.prd.nos.ci/api`

### 1.3 Deployment Lifecycle (primary path)

| Step | Method | Endpoint / SDK Call |
|---|---|---|
| **1. Create deployment** | `POST` | `/api/deployments` / `client.api.deployments.create({...})` |
| **2. Start deployment** | `POST` | `/api/deployments/{id}/start` / `deployment.start()` |
| **3. Poll status** | `GET` | `/api/deployments/{id}` / `client.api.deployments.get(id)` |
| **4. Retrieve result** | `GET` | Via deployment status or job `ipfsResult` field |
| **5. Stop deployment** | `POST` | `/api/deployments/{id}/stop` / `deployment.stop()` |
| **6. Archive deployment** | `POST` | `/api/deployments/{id}/archive` / `deployment.archive()` |

New deployments are created in **draft** state and must be explicitly started.

### 1.4 Alternative: Raw Job Path (CLI/SDK lower-level)

| Step | Method | Description |
|---|---|---|
| **1. Pin job definition to IPFS** | `nosanaClient.ipfs.pin(jobDef)` | Returns an IPFS hash |
| **2. Post job to market** | `nosanaClient.api.jobs.list({ipfsHash, market, timeout})` | Returns a job ID |
| **3. Poll for result** | `nosanaClient.api.jobs.get(jobId)` | Until `ipfsResult` or `result` is set |
| **4. Retrieve result from IPFS** | `nosanaClient.ipfs.get(resultHash)` | Parse container stdout |

### 1.5 SDK Initialisation

```typescript
import { createNosanaClient, NosanaNetwork } from '@nosana/kit';
const client = createNosanaClient(NosanaNetwork.MAINNET, {
  api: { apiKey: process.env.NOSANA_API_KEY },
});
```

### 1.6 Read-Only Endpoints (no cost incurred)

| Endpoint | Purpose |
|---|---|
| `GET /api/credits/balance` | Check credit balance (`assignedCredits`, `reservedCredits`, `settledCredits`) |
| `GET /api/markets` | List GPU markets |
| `GET /api/markets/prices` | Get all market pricing |
| `GET /api/credits/request/eligibility` | Check free-credit eligibility |
| `POST /api/credits/request` | Request free credits (if eligible) |

---

## 2. Required Job-Definition Fields

Per the official Nosana Job Definition Schema (`learn.nosana.com/deployments/jobs/job-definition/schema.html`):

### 2.1 Official Schema (required fields marked ✅)

| Field | Type | Required? | Description |
|---|---|---|---|
| `version` | `string` | ✅ | Schema version: `"0.1"` |
| `type` | `"container"` | ✅ | Execution type |
| `ops` | `Array` | ✅ | Ordered operations |
| `meta` | `object` | ❌ | Metadata (trigger, system_resources) |
| `global` | `object` | ❌ | Default values across ops |

### 2.2 Operation Object (`ops[]`)

| Field | Type | Required? | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique operation identifier |
| `type` | `"container/run"` | ✅ | Operation type |
| `args` | `object` | ✅ | Operation arguments |

### 2.3 Operation Args (`args`)

| Field | Type | Required? | Description |
|---|---|---|---|
| `image` | `string` | ✅ | Docker image (URL recommended) |
| `cmd` | `string \| string[]` | ❌ | Command to execute |
| `gpu` | `boolean` | ❌ | GPU requirement |
| `expose` | `number \| object` | ❌ | Exposed ports |
| `resources` | `Resource[]` | ❌ | External data sources (S3, HF) |
| `authentication` | `object` | ❌ | Docker registry auth |

### 2.4 Deployment Configuration (wraps job definition)

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Unique deployment name |
| `market` | `string` | Solana address of GPU market |
| `timeout` | `number` | Max execution time in **minutes** |
| `replicas` | `number` | Number of instances |
| `strategy` | `"SIMPLE" \| "SCHEDULED"` | Deployment strategy |
| `job_definition` | `object` | The container job definition |

### 2.5 Project's Local Job Definition Builder

The project's `nosana-risk-runner.mjs` builds a **simplified** job definition that does **not** match the official schema:

```javascript
{
  containerImage: "python:3.12-slim",   // NOT "image" inside ops[].args
  command: "python3 << 'PYEOF'...",      // NOT "cmd" inside ops[].args
  env: { RISK_INPUT_DATA: "...", HISTORICAL_DELAY_DATA: "..." },
  meta: { workload: "stitchcheck-risk-calc", version: "1.0.0" }
}
```

**This is a discrepancy** (see Section 7, item D-01).

---

## 3. Required IPFS/Result Flow

### 3.1 Documented IPFS Flow (raw job path)

1. **Pin:** Serialise the job definition JSON → `nosanaClient.ipfs.pin(jobDef)` → receive IPFS hash.
2. **Post:** Submit the IPFS hash to a market via `jobs.list()`.
3. **Poll:** Poll `jobs.get(jobId)` every N seconds until `ipfsResult` or `result` field is populated, or until timeout.
4. **Retrieve:** Fetch the result content from IPFS via `nosanaClient.ipfs.get(resultHash)`.
5. **Parse:** The container's stdout is captured; the last JSON line is the structured result.

### 3.2 Deployment Path (result retrieval)

The deployment path abstracts IPFS internally. Results are accessible via the deployment status endpoint. The exact structure of the result payload beyond the deployment status field is not fully documented.

### 3.3 Project's Implementation

`nosana_run_job.mjs` implements the three-step raw job flow:
- Step 1: `nosanaClient.ipfs.pin(jobDef)` → hash
- Step 2: `nosanaClient.api.jobs.list({ipfsHash, market, timeout})` → jobId
- Step 3: Poll `nosanaClient.api.jobs.get(jobId)` every 3s until `ipfsResult` or deadline

Result parsing: last non-empty line of stdout → `JSON.parse()`.

### 3.4 IPFS Unknown

Per the resolution plan: *"It's unclear whether API-triggered deployments also require IPFS upload or handle it internally."* The Deployment API likely handles IPFS transparently; the raw job path requires explicit IPFS pinning.

---

## 4. Cost and Credit Evidence Requirements

### 4.1 Credit System

- Credits are the currency for API-key-authenticated deployments.
- Balance fields: `assignedCredits`, `reservedCredits`, `settledCredits`.
- Available = `assignedCredits - reservedCredits - settledCredits`.
- Insufficient credits → deployment fails with `INSUFFICIENT_FUNDS` status.

### 4.2 Cost Estimation

| Parameter | Value | Source |
|---|---|---|
| Cheapest market (NVIDIA 3060) | ~$0.048/hr | Nosana published pricing |
| 60-second workload cost | ~$0.0008 | Calculation: $0.048 × (60/3600) |
| Hard ceiling | US$10.00 | Project preflight rules |
| Actual consumption tracking | `creditsUsed` field in job response | Nosana API |

### 4.3 Credit Acquisition Methods

| Method | API | Description |
|---|---|---|
| Claim code | `POST /api/credits/claim` | Redeem a credit code |
| Request free credits | `POST /api/credits/request` | Subject to eligibility check |
| Check eligibility | `GET /api/credits/request/eligibility` | Pre-check before requesting |
| Invitation | `POST /api/credits/invitations/{token}/claim` | Claim an invitation |
| Purchase | Via Nosana Deploy dashboard | Top-up through dashboard |

### 4.4 Evidence Required for Judge

To prove cost-awareness and financial governance:
- Pre-execution balance screenshot or API response (sanitised).
- Market pricing at time of execution.
- Post-execution `creditsUsed` from job response.
- Confirmation that total spend < US$10.00.

### 4.5 Current Status

**No credits exist.** No account has been created. No balance check has been performed. Cost estimation is based on published pricing only.

---

## 5. One-Page Smoke-Test Checklist

### NOS-LIVE-01 — Nosana Risk Workload Smoke Test

**Test ID:** NOS-LIVE-01
**Fixture:** `smoke-tests/nosana/fixtures/req-nos-clean-two-leg.json`
**Workload:** Non-PII connection-risk heuristic (synthetic airports AAA/BBB/CCC, 75-min connection)

#### Pre-Execution Gates (all must pass)

- [ ] **G-01:** Nosana account created at `dashboard.k8s.prd.nos.ci`
- [ ] **G-02:** `NOSANA_API_KEY` provisioned in `.env.local` (presence only; value not read/logged)
- [ ] **G-03:** `NOSANA_API_KEY` listed in `.env.example` with empty value
- [ ] **G-04:** Credit balance confirmed > 0 (via `GET /api/credits/balance`)
- [ ] **G-05:** Free credits claimed if eligible (via `POST /api/credits/request`)
- [ ] **G-06:** Market address confirmed via `GET /api/markets` (cheapest 3060 market)
- [ ] **G-07:** Market pricing confirmed via `GET /api/markets/prices` (cost < US$10.00)
- [ ] **G-08:** Container image built and pushed to Docker Hub (public repo)
- [ ] **G-09:** Job definition matches official Nosana schema (`version: "0.1"`, `type: "container"`, `ops[]`)
- [ ] **G-10:** Job definition validated locally with SDK `validateJobDefinition()`
- [ ] **G-11:** Input fixture verified PII-free (no names, emails, passports, bookings)
- [ ] **G-12:** Human organizer has explicitly approved one-attempt execution and spend

#### Execution Steps (exactly 1 attempt, 0 retries)

- [ ] **E-01:** Create deployment via `POST /api/deployments` (name, market, timeout=1 min, replicas=1, strategy=SIMPLE)
- [ ] **E-02:** Start deployment via `POST /api/deployments/{id}/start`
- [ ] **E-03:** Record deployment ID and ISO 8601 timestamp
- [ ] **E-04:** Poll `GET /api/deployments/{id}` every 5s, max 60s
- [ ] **E-05:** On completion: retrieve result, validate against schema contract
- [ ] **E-06:** On timeout: record `workloadStatus: "timeout"`, `riskBand: "unavailable"`, `riskScore: null`
- [ ] **E-07:** Stop and archive deployment

#### Post-Execution Validation

- [ ] **V-01:** Result JSON matches expected output contract
- [ ] **V-02:** `riskBand` ∈ {low, medium, high, unavailable}
- [ ] **V-03:** `riskScore` is null or number 0–1
- [ ] **V-04:** `heuristicDisclaimer` contains the word "heuristic"
- [ ] **V-05:** `correlationId` matches input fixture
- [ ] **V-06:** No PII in input or output
- [ ] **V-07:** Cost < US$10.00 (verify `creditsUsed`)
- [ ] **V-08:** Evidence recorded: deployment ID, timestamp, status, sanitised summary

#### Hard Stop Conditions (abort immediately if any is true)

| # | Condition |
|---|---|
| S-01 | Cost unclear or ≥ US$10.00 |
| S-02 | No billing account approved |
| S-03 | Credential missing or over-permissioned |
| S-04 | Input cannot be proven PII-free |
| S-05 | Job definition fails local validation |
| S-06 | Container image fails to build/push |
| S-07 | Any accidental credential exposure |

---

## 6. Judge-Facing Evidence Table

### 6.1 Evidence Classification Matrix

| Evidence Item | Real Nosana Execution | Local Validation | Synthetic Placeholder | Fallback |
|---|---|---|---|---|
| **NOS-LIVE-01 result** | ❌ Not executed | N/A | N/A | N/A |
| **`nosana-client.mjs` offline tests (75 tests)** | ❌ Does not contact Nosana | ✅ Validates client boundary, sanitisation, safety limits, mutation rejection | ✅ Uses synthetic fixtures | N/A |
| **`schema-validator.mjs` fixture validation** | ❌ Does not contact Nosana | ✅ Validates input/output contracts against schema | ✅ All fixtures labelled synthetic | N/A |
| **`workload-skeleton.mjs` lifecycle simulation** | ❌ Zero network code | ✅ Simulates state transitions locally | ✅ All results carry placeholder label | N/A |
| **`nosana-risk-runner.mjs` local fallback** | ❌ `skipNosana=true` when no `NOSANA_API_KEY` | ✅ Monte Carlo heuristic in Node.js | ✅ Labelled `local-fallback` | ✅ Used when Nosana unavailable |
| **`nosana_run_job.mjs` submission helper** | ⚠️ Designed for real execution | ✅ Validates job definition locally | N/A | N/A |
| **`run-risk-job.mjs` CLI entry point** | ⚠️ Designed for real execution | ✅ Loads `.env.local`, checks credential presence | N/A | ✅ Falls back to local if no key |
| **React UI `RiskPanel.tsx`** | ⚠️ Supports `evidenceSource: 'nosana-evidence'` display | N/A | ✅ Default: shows fixture data with placeholder label | ✅ Shows fallback label when `evidenceSource: 'local-fallback'` |
| **`fixtures/res-nos-*.json` (5 result fixtures)** | ❌ Never from Nosana | ✅ Schema-valid shapes | ✅ All carry `placeholderLabel` and `heuristicDisclaimer` | N/A |
| **`fixtures/req-nos-*.json` (5 request fixtures)** | ❌ Never submitted | ✅ Schema-valid contracts | ✅ All carry watermark | N/A |
| **`fixtures/historical-delay-data.json`** | ❌ Not used by Nosana | ✅ Local heuristic input | ✅ Fictional airports/routes | ✅ Used by local fallback |
| **`results/2026-08-20T15-53-43Z/` (NOS-ATTEMPT-001)** | ❌ Blocked before network | ✅ Blocker documented | ✅ Labelled blocked | N/A |
| **`live-demo-results/.../nosana-live-result.md`** | ❌ BLOCKED | ✅ Safety boundary verified | ✅ Labelled blocked | N/A |
| **Cross-provider invariant tests (Nosana subset)** | ❌ Does not contact Nosana | ✅ Evidence boundary invariants pass | ✅ Placeholder labels verified | N/A |

### 6.2 Summary for Judges

| Category | Count | Label |
|---|---|---|
| **Real Nosana execution evidence** | **0** | No live workload has been submitted or completed |
| **Local validation tests** | **75+** offline tests | Client boundary, schema contracts, sanitisation, safety limits, invariant checks |
| **Synthetic placeholder artifacts** | **10** fixtures + skeleton results | All labelled `Synthetic local placeholder — not Nosana evidence` |
| **Fallback implementations** | **2** local heuristic engines | `workload-skeleton.mjs` (toy) + `nosana-risk-runner.mjs` (Monte Carlo) |

### 6.3 Safe Claim Language

| ✅ Safe to Say | ❌ NOT Safe to Say |
|---|---|
| "The Nosana integration architecture is fully designed and documented against the official API and SDK." | "Nosana runs our risk computation." |
| "75+ offline tests validate the client boundary, schema contracts, and safety limits." | "We have executed a Nosana workload." |
| "The UI supports displaying real Nosana evidence when available, with distinct fallback labelling." | "The risk score comes from Nosana." |
| "A complete execution plan exists with human-gated safety checks and a US$10 hard spend ceiling." | "Nosana is production-ready." |
| "Live execution is blocked on credential provisioning, credit acquisition, and container image build." | "We have validated Nosana cost behaviour." |

---

## 7. Discrepancies Between Documentation and Implementation

### D-01: Job Definition Schema Mismatch

| Aspect | Official Nosana Schema | Project Implementation (`nosana-risk-runner.mjs`) |
|---|---|---|
| Top-level structure | `version`, `type`, `ops[]` | `containerImage`, `command`, `env`, `meta` |
| Container image | `ops[].args.image` | `containerImage` (top-level) |
| Command | `ops[].args.cmd` (string or array) | `command` (top-level string) |
| Environment variables | `global.env` or `ops[].args.env` | `env` (top-level object) |
| Schema version | Required: `"0.1"` | Not present |
| Execution type | Required: `"container"` | Not present |

**Severity: HIGH.** The project's `buildRiskJobDefinition()` produces a flat structure that does not conform to the official Nosana job definition schema. If submitted as-is, the Nosana API would likely reject it. The `validateJobDefinition()` in `nosana_run_job.mjs` validates only `containerImage`, `command`, and `env` — it does not check for `version`, `type`, or `ops[]`.

### D-02: `.env.example` Missing `NOSANA_API_KEY`

| Aspect | Expected | Actual |
|---|---|---|
| `.env.example` credential placeholders | `OPENROUTER_API_KEY=`, `GEMINI_API_KEY=`, `NOSANA_API_KEY=` | Only `OPENROUTER_API_KEY=` and `GEMINI_API_KEY=` present |

**Severity: MEDIUM.** The execution checklist (Section 3, check C-5) requires `NOSANA_API_KEY` to be listed in `.env.example` with an empty value. It is absent. This violates the project's own credential-presence check.

### D-03: SDK Import Path Discrepancy

| Aspect | Official Docs | Project Implementation |
|---|---|---|
| SDK package | `@nosana/kit` | `@nosana/kit` (in `nosana_run_job.mjs`) |
| Client creation | `createNosanaClient(NosanaNetwork.MAINNET, { api: { apiKey } })` | `new Nosana({ key: apiKey, network: "mainnet" })` |
| Network constant | `NosanaNetwork.MAINNET` | `"mainnet"` (string literal) |

**Severity: MEDIUM.** The `nosana_run_job.mjs` uses `new Nosana(...)` with a string network, while official docs use `createNosanaClient(NosanaNetwork.MAINNET, ...)`. The class-based `Nosana` constructor may be from an older SDK version.

### D-04: Job Submission API Method Name

| Aspect | Official Docs | Project Implementation |
|---|---|---|
| Post job to market | `client.api.deployments.create({...})` (Deployment path) | `nosanaClient.api.jobs.list({...})` (raw Job path) |

**Severity: LOW.** The method name `jobs.list()` semantically suggests listing, not creating. The official docs show `deployments.create()` for the Deployment path. The raw job path may use a different method. This needs verification against the actual SDK.

### D-05: Timeout Unit Mismatch

| Aspect | Official Docs | Project Implementation |
|---|---|---|
| Deployment timeout | **Minutes** (e.g., `timeout: 60` = 60 minutes) | `nosana-client.mjs`: `requestTimeoutMs: 60000` (60 seconds); `nosana-risk-runner.mjs`: `timeoutMs: 120000` (120 seconds) |

**Severity: LOW.** The official deployment timeout is in minutes. The project's client boundary uses milliseconds for its internal safety limit. If the project passes `timeout: 60` to the deployment API, that means 60 minutes — far longer than the intended 60-second workload. The mapping between the client's `requestTimeoutMs` and the deployment's `timeout` field needs clarification.

### D-06: README Atlas Status Stale

| Aspect | README.md Statement | Actual Status |
|---|---|---|
| Atlas | "Local fixtures and comparison adapter only. Not authenticated, not executed." | Auth succeeded; 1 production search returned 5 real offers (per resolution plan and live-demo results) |

**Severity: LOW.** The README under-reports Atlas integration progress. The Service Roles table says "Not authenticated, not executed" but authentication succeeded and a live search was performed.

### D-07: Dual Nosana Client Architecture

| Aspect | `nosana-client.mjs` | `nosana-risk-runner.mjs` + `nosana_run_job.mjs` |
|---|---|---|
| Network code | Zero — explicitly forbidden | Contains `spawn()`, SDK dynamic import, IPFS pin/poll/get |
| Credential access | Zero — explicitly forbidden | Reads `NOSANA_API_KEY` from env, reads `.env.local` |
| Purpose | Offline-only safety boundary | Future live-execution path |

**Severity: INFORMATIONAL.** Two parallel Nosana integration paths exist: a locked-down offline client and a live-execution runner. They are not contradictory but could confuse reviewers. The offline client is the default; the runner only activates when `NOSANA_API_KEY` is present and `skipNosana` is false.

### D-08: Market Address Hardcoded

| Aspect | Value | Source |
|---|---|---|
| Default market | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` | Hardcoded in `nosana_run_job.mjs` |
| Resolution plan market | NVIDIA 3060 at ~$0.048/hr | Documented estimate |
| Official docs example market | `CA5pMpqkYFKtme7K31pNB1s62X2SdhEv1nN9RdxKCpuQ` (NVIDIA 3090) | `learn.nosana.com/deployments/options.html` |

**Severity: LOW.** The hardcoded market address `7AtiXMSH...` is described as "cheapest known market" but was not verified against a live `GET /api/markets` call. It may be stale or incorrect.

### D-09: Result Schema Enum Mismatch

| Aspect | `schema-validator.mjs` | `nosana-client.mjs` |
|---|---|---|
| `WORKLOAD_STATUSES` | `["queued", "running", "completed", "timeout", "error"]` | `["disabled", "blocked", "ready", "failed", "passed"]` |

**Severity: LOW.** Two different status enums exist in parallel. The schema validator uses Nosana-aligned statuses; the client boundary uses internal lifecycle statuses. The `normalizeFixtureResult()` function corrects invalid statuses to `"failed"`, bridging the gap. However, this could cause confusion during integration.

---

## Appendix A: Files Reviewed

| File | Purpose |
|---|---|
| `docs/stitchcheck-opus-nosana-atlas-resolution-plan.md` | Architecture and go/no-go plan |
| `docs/stitchcheck-nosana-execution-checklist.md` | Pre-execution checklist with all gates |
| `README.md` | Project overview and service status |
| `smoke-tests/nosana/README.md` | Harness status and prerequisites |
| `smoke-tests/nosana/nosana-client.mjs` | Offline-only client boundary |
| `smoke-tests/nosana/nosana-client-offline-tests.mjs` | 75 offline tests for client boundary |
| `smoke-tests/nosana/schema-validator.mjs` | Input/output contract validators |
| `smoke-tests/nosana/workload-skeleton.mjs` | Local lifecycle simulator |
| `smoke-tests/nosana/nosana-risk-runner.mjs` | Live-execution wrapper with fallback |
| `smoke-tests/nosana/nosana_run_job.mjs` | Three-step Nosana job submission helper |
| `smoke-tests/nosana/run-risk-job.mjs` | CLI entry point for risk workload |
| `smoke-tests/nosana/fixtures/manifest.json` | Fixture index with test-case mapping |
| `smoke-tests/nosana/fixtures/req-nos-clean-two-leg.json` | Primary synthetic request fixture |
| `smoke-tests/nosana/fixtures/historical-delay-data.json` | Synthetic historical delay dataset |
| `smoke-tests/nosana/results/2026-08-20T15-53-43Z/result.json` | NOS-ATTEMPT-001 blocked result |
| `smoke-tests/nosana/results/2026-08-20T15-53-43Z/summary.md` | NOS-ATTEMPT-001 blocked summary |
| `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/nosana-live-result.md` | Live demo Nosana result (BLOCKED) |
| `smoke-tests/cross-provider-invariant-tests.mjs` | Cross-provider evidence invariants |
| `app/src/components/RiskPanel.tsx` | UI risk panel with evidence labelling |
| `app/src/data/fixtures.ts` | Fixture loader with live-result support |
| `app/src/data/labels.ts` | Centralised evidence labels |
| `app/src/data/types.ts` | TypeScript types including `evidenceSource` |
| `.env.example` | Credential placeholder file |
| External: `learn.nosana.com/` | Nosana documentation home |
| External: `learn.nosana.com/api/intro.html` | API introduction and authentication |
| External: `learn.nosana.com/api/create-deployments.html` | Deployment creation (SDK + HTTP) |
| External: `learn.nosana.com/api/credits.html` | Credits API and balance |
| External: `learn.nosana.com/api/markets.html` | Markets API and pricing |
| External: `learn.nosana.com/deployments/options.html` | Deployment configuration options |
| External: `learn.nosana.com/deployments/jobs/job-definition/schema.html` | Job definition schema |

## Appendix B: No External Writes Performed

| Confirmation | Detail |
|---|---|
| No Nosana API call | Zero HTTP requests to any Nosana endpoint |
| No credits spent | No account exists; no balance check performed |
| No source files modified | Only this new file created |
| No secrets accessed | `.env.local` not read; no credential values accessed |
| No packages installed | No `npm install` or SDK installation |
| No Git operations | No commits, pushes, or branch changes |
| No Docker operations | No container builds or pushes |

---

- **Created:** 2026-08-21
- **Author:** Read-only audit by coding agent
- **Review status:** Ready for human review
- **No external writes were performed in the creation of this document.**
