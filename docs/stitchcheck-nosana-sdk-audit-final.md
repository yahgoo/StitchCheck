# StitchCheck — Nosana SDK Integration Audit (Final)

> **Status:** READ-ONLY AUDIT COMPLETE — no external writes, no Nosana calls, no credits spent, no secrets accessed, no source files modified.  
> **Date:** 2026-08-21  
> **Scope:** Audit of `smoke-tests/nosana/` Nosana SDK integration against official Nosana documentation at https://learn.nosana.com/.  
> **Constraint:** `.env.local` was not read. No Nosana API call was made. No package was installed. No paid workload was submitted.

---

## 1. Files Reviewed and Ownership

| File | Purpose | Ownership |
|---|---|---|
| `smoke-tests/nosana/nosana_run_job.mjs` (345 lines) | Three-step Nosana job submission (pin → post → poll → retrieve) | Nosana smoke-test harness |
| `smoke-tests/nosana/nosana-risk-runner.mjs` (590 lines) | Live-execution wrapper with local Monte Carlo fallback | Nosana smoke-test harness |
| `smoke-tests/nosana/run-risk-job.mjs` (145 lines) | CLI entry point; loads credential, delegates to runner | Nosana smoke-test harness |
| `smoke-tests/nosana/nosana-client.mjs` (425 lines) | Offline-only safety boundary (zero network, zero credentials) | Nosana smoke-test harness |
| `smoke-tests/nosana/nosana-client-offline-tests.mjs` (413 lines) | 75 offline tests for the client boundary | Nosana smoke-test harness |
| `smoke-tests/nosana/schema-validator.mjs` (297 lines) | Input/output contract validators | Nosana smoke-test harness |
| `smoke-tests/nosana/workload-skeleton.mjs` (222 lines) | Local lifecycle simulator | Nosana smoke-test harness |
| `smoke-tests/nosana/README.md` (93 lines) | Harness documentation | Nosana smoke-test harness |
| `docs/stitchcheck-nosana-approval-packet.md` (211 lines) | Prior approval packet | Docs (read-only) |
| `docs/stitchcheck-nosana-code-gaps.md` (409 lines) | Prior code-gaps document | Docs (read-only) |
| `.env.example` (4 lines) | Credential placeholder | Project root (read-only) |

**External documentation consulted:**

| URL | Content |
|---|---|
| https://learn.nosana.com/kit/ | SDK overview, architecture, core concepts |
| https://learn.nosana.com/kit/examples/jobs.html | Job creation, monitoring, querying examples |
| https://learn.nosana.com/api/jobs.html | Jobs API — post, get, extend, stop, batch, idempotency |
| https://learn.nosana.com/deployments/jobs/job-definition/schema.html | Official job definition schema (v0.1) |
| https://learn.nosana.com/api/markets.html | Markets API — list, get, pricing |

**No files assigned to another chat were modified. No `.env.local`, credentials, final media, deck assets, or provider integrations were touched.**

---

## 2. Local Test Results (All Passed)

| Test Suite | Result | Detail |
|---|---|---|
| `schema-validator.mjs` | **21/21 PASS** | All fixture validations passed; self-check passed |
| `nosana-client-offline-tests.mjs` | **75/75 PASS** | All 15 test sections passed |
| `workload-skeleton.mjs` | **5/5 PASS** | All 5 lifecycle simulations passed |
| `cross-provider-invariant-tests.mjs` | **40/40 PASS** | Cross-provider invariants held |
| **Total** | **141/141 PASS** | **Zero failures** |

---

## 3. Audit Findings — Eight Determinations

### 3.1 Correct `@nosana/kit` Version

| Aspect | Finding |
|---|---|
| **Package name** | `@nosana/kit` |
| **Currently installed?** | **NO** — no `package.json` exists in `smoke-tests/nosana/`; no `node_modules/@nosana/` directory |
| **Latest version** | Cannot be confirmed — npm registry returned 403 during this audit |
| **Install command** | `cd smoke-tests/nosana && npm install @nosana/kit` |
| **Minimum expected exports** | `createNosanaClient`, `NosanaNetwork`, `JobState`, `address`, `generateIdempotencyKey` |

**Verdict:** The package name is correct. The version must be verified at install time by checking `npm view @nosana/kit version`.

---

### 3.2 Correct Client Initialization

**Official pattern** (from `learn.nosana.com/api/jobs.html` and `learn.nosana.com/kit/examples/jobs.html`):

```typescript
import { createNosanaClient, NosanaNetwork } from '@nosana/kit';

const client = createNosanaClient(NosanaNetwork.MAINNET, {
  api: {
    apiKey: process.env.NOSANA_API_KEY,
  },
});
```

**Project code** (`nosana_run_job.mjs` L192–195):

```javascript
const { createNosanaClient, NosanaNetwork } = await import("@nosana/kit");
nosanaClient = createNosanaClient(NosanaNetwork.MAINNET, {
  api: { apiKey },
});
```

**Verdict: ✅ MATCH.** The client initialization in `nosana_run_job.mjs` exactly matches the official pattern. The previous code-gaps document (`stitchcheck-nosana-code-gaps.md` §D-02) flagged a mismatch (`new Nosana({ key, network })`) — that mismatch has since been corrected in the codebase. The gap is now resolved.

**Note:** The official SDK examples also show a Solana wallet path (`client.wallet = await generateKeyPairSigner()`), but that is for on-chain transaction signing. The project uses the credits-based Jobs API path, which only requires `api.apiKey`.

---

### 3.3 API-Key Versus Wallet Requirements

| Auth method | When used | Project uses? |
|---|---|---|
| `api: { apiKey }` | Credits-based Jobs API and Deployments API via Nosana's hosted API | **YES** — `nosana_run_job.mjs` L154, L193–195 |
| `client.wallet = keypairSigner` | Direct Solana transaction signing (SDK examples for on-chain operations) | NO — not needed for the credits path |

**Findings:**

- `NOSANA_API_KEY` is the only credential required for the project's usage pattern.
- `.env.example` L3 contains `NOSANA_API_KEY=` (placeholder present).
- `run-risk-job.mjs` L30–45 loads `NOSANA_API_KEY` from `.env.local` if not already in env.
- The key is NEVER printed, logged, or included in any output.
- No Solana wallet or keypair is needed for the credits-based Jobs API path.

**Verdict: ✅ CORRECT.** API-key authentication is the right approach for this integration.

---

### 3.4 Correct Job-Definition Schema

**Official schema** (from `learn.nosana.com/deployments/jobs/job-definition/schema.html`):

| Field | Required? | Type |
|---|---|---|
| `version` | ✅ | `"0.1"` |
| `type` | ✅ | `"container"` |
| `ops[]` | ✅ | Array of `{ id, type: "container/run", args: { image, cmd, ... } }` |
| `meta` | ❌ | `{ trigger, system_resources }` |
| `global` | ❌ | `{ image, gpu, env, work_dir, entrypoint }` |

**Project code** (`nosana-risk-runner.mjs` L145–173, `buildRiskJobDefinition()`):

```javascript
{
  version: "0.1",         // ✅ matches
  type: "container",      // ✅ matches
  ops: [{                 // ✅ matches
    id: "stitchcheck-risk-calc",
    type: "container/run",
    args: {
      image: "python:3.12-slim",
      cmd: "python3 << 'PYEOF'\n...\nPYEOF",
    },
  }],
  meta: { trigger: "api", workload: "...", version: "1.0.0", syntheticDemo: true, nonPiiDeclaration: true },
  global: { env: { RISK_INPUT_DATA: "...", HISTORICAL_DELAY_DATA: "..." } },
}
```

**Verdict: ✅ MATCH.** The job definition exactly conforms to the official v0.1 schema. The previous code-gaps document (§D-01) flagged a flat-structure mismatch — that has since been corrected. The gap is now resolved.

**Additional note on `cmd` format:** The official schema page states that when `cmd` is a string, bash is used to interpret it. The project uses a heredoc string (`python3 << 'PYEOF'...`), which is valid bash.

---

### 3.5 Correct IPFS, Submit, Poll, and Result Methods

| Step | Official docs | Project code (`nosana_run_job.mjs`) | Match? |
|---|---|---|---|
| **Pin** | `client.ipfs.pin(jobDefinition)` → returns hash string | L209: `nosanaClient.ipfs.pin(jobDef)` → extracts hash defensively | ✅ |
| **Submit** | `client.api.jobs.list({ ipfsHash, market, timeout? })` → returns `{ job }` | L218: `nosanaClient.api.jobs.list({ ipfsHash, market, timeout })` | ✅ |
| **Poll** | `client.api.jobs.get(jobAddress)` → returns `Job` with `state`, `ipfsResult` | L237: `nosanaClient.api.jobs.get(jobId)` → checks `ipfsResult`, `result`, `state` | ✅ |
| **Retrieve result** | `client.ipfs.retrieve(ipfsResult)` (per monitor example) | L273: `nosanaClient.ipfs.get(resultHash)` | ⚠️ See below |

**⚠️ Minor method-name discrepancy on IPFS retrieve:**

- The Jobs examples monitor snippet uses `client.ipfs.retrieve(event.data.ipfsResult)`.
- The project uses `client.ipfs.get(resultHash)`.
- Both may exist as aliases in the SDK, but the official examples favour `retrieve`. This should be verified when the SDK is installed. If `get` does not exist, change to `retrieve`.

**⚠️ Job submission return shape:**

- Official docs show: `result.job` (the job address).
- Project code uses: `job.id || job.jobId` (L224).
- The official return is `{ job: "job-address", credits: { creditsUsed } }`. The project should extract `job.job` instead of `job.id || job.jobId`.

**Verdict: ✅ IPFS pin and job submission match. ⚠️ Two minor discrepancies in result retrieval and job address extraction need verification against the installed SDK.**

---

### 3.6 Correct Timeout Units

| Context | Unit | Source |
|---|---|---|
| **Jobs API `timeout` parameter** | **SECONDS** | Official docs: `timeout: 600, // Optional: max runtime in seconds (default: 3600)` |
| **Deployment `timeout`** | Minutes | Official docs: `timeout: 60` = 60 minutes |
| **Project raw job path** | Seconds | `nosana_run_job.mjs` L42: `DEFAULT_TIMEOUT_SEC = 120` |

**Verdict: ✅ RESOLVED.** The previous code-gaps document (§D-04) flagged ambiguity. The official Jobs API documentation now explicitly states the timeout is in **seconds** (default 3600). The project's `DEFAULT_TIMEOUT_SEC = 120` (120 seconds) is correct and within the default bound.

**Safety-limit discrepancy (informational):**

| Component | Timeout |
|---|---|
| `nosana-client.mjs` SAFETY_LIMITS.requestTimeoutMs | 60,000 ms (60s) |
| `nosana-risk-runner.mjs` default timeoutMs | 120,000 ms (120s) |
| `nosana_run_job.mjs` DEFAULT_TIMEOUT_SEC | 120 seconds |

The offline client boundary enforces a 60s safety limit, while the live-execution path defaults to 120s. This is by design — the offline client is more restrictive. The live path's 120s is within the SDK's default of 3600s.

---

### 3.7 Correct Market Lookup

| Aspect | Value | Status |
|---|---|---|
| **Hardcoded default** | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` | Format: valid Solana base58 |
| **Official docs example** | `CA5pMpqkYFKtme7K31pNB1s62X2SdhEv1nN9RdxKCpuQ` (NVIDIA 3090 market) | From Jobs API docs |
| **Verification** | Not verified against live `client.api.markets.list()` | **BLOCKED** — requires SDK install + API key |
| **Env override** | `process.env.NOSANA_MARKET` supported | ✅ |
| **CLI override** | `--market <addr>` supported | ✅ |

**Verdict: ⚠️ Format correct, address unverified.** The hardcoded market address differs from the one used in official docs examples. It must be verified via a read-only `client.api.markets.list()` call before any paid submission. The override mechanism (env + CLI) is correctly implemented.

---

### 3.8 Is Current Code Ready for One Live Smoke Test?

**Verdict: NOT YET. Three blockers remain.**

#### Blocker Summary

| # | Blocker | Severity | Effort to resolve |
|---|---|---|---|
| 1 | `@nosana/kit` is not installed | **P0 — HARD BLOCK** | ~5 min (install) |
| 2 | Market address not verified against live API | **P1 — SHOULD VERIFY** | ~15 min (read-only call) |
| 3 | Job address extraction uses `job.id \|\| job.jobId` instead of `job.job` | **P1 — LIKELY BUG** | ~5 min (code fix) |

#### What IS Ready

| Item | Status |
|---|---|
| ✅ Job definition matches official schema v0.1 | Verified |
| ✅ Client initialization matches `createNosanaClient()` pattern | Verified |
| ✅ API-key authentication (not wallet) | Verified |
| ✅ IPFS pin method (`client.ipfs.pin()`) | Verified |
| ✅ Job submission method (`client.api.jobs.list()`) | Verified |
| ✅ Polling method (`client.api.jobs.get()`) | Verified |
| ✅ Timeout units (seconds) | Verified against official docs |
| ✅ Local `validateJobDefinition()` checks all required schema fields | Verified |
| ✅ Fallback chain (any failure → local Monte Carlo) | Comprehensive |
| ✅ Evidence labelling (`nosana-evidence` vs `local-fallback`) | Correct |
| ✅ PII guard on `global.env` | Implemented |
| ✅ Safety limits (timeout, retry, envelope size) | Enforced |
| ✅ All 141 local tests pass | Verified this session |
| ✅ `NOSANA_API_KEY` placeholder in `.env.example` | Present |

#### What Must Be Done Before Paid Execution

| Step | Command / Action | Gated by |
|---|---|---|
| 1 | `cd smoke-tests/nosana && npm init -y` | Human approval |
| 2 | `cd smoke-tests/nosana && npm install @nosana/kit` | Human approval |
| 3 | Verify `job.job` (not `job.id`) in `nosana_run_job.mjs` L224 | SDK source inspection |
| 4 | Verify `client.ipfs.get()` vs `client.ipfs.retrieve()` in `nosana_run_job.mjs` L273 | SDK source inspection |
| 5 | Verify market address via `client.api.markets.list()` | Human approval + API key |
| 6 | Confirm Nosana credit balance is available | Human |
| 7 | Provide written approval (see §5) | Human |

---

## 4. Discrepancies vs. Prior Code-Gaps Document

The previous `stitchcheck-nosana-code-gaps.md` identified 5 discrepancies. This audit re-verifies each:

| Gap ID | Prior Finding | Current Status | Reason |
|---|---|---|---|
| **D-01** (Job definition schema) | MISMATCH — flat structure | ✅ **RESOLVED** | `buildRiskJobDefinition()` now produces `version`, `type`, `ops[]`, `global.env` |
| **D-02** (SDK client init) | MISMATCH — `new Nosana({ key, network })` | ✅ **RESOLVED** | `nosana_run_job.mjs` now uses `createNosanaClient(NosanaNetwork.MAINNET, { api: { apiKey } })` |
| **D-03** (Local validator) | MISMATCH — doesn't check `version`, `type`, `ops[]` | ✅ **RESOLVED** | `validateJobDefinition()` now checks all required fields per official schema |
| **D-04** (Timeout units) | AMBIGUOUS | ✅ **RESOLVED** | Official Jobs API docs confirm **seconds** (default 3600); project uses 120 seconds |
| **D-05** (Market address) | UNVERIFIED | ⚠️ **STILL UNVERIFIED** | Requires live API call; not a code fix |

**Summary:** 4 of 5 prior gaps are resolved. 1 (market address) remains open but is a prerequisite step, not a code change.

**New findings from this audit:**

| New ID | Finding | Severity |
|---|---|---|
| **N-01** | Job address extraction: `job.id \|\| job.jobId` should be `job.job` per official docs | MEDIUM |
| **N-02** | IPFS retrieve: `client.ipfs.get()` may need to be `client.ipfs.retrieve()` per official examples | LOW |
| **N-03** | `@nosana/kit` still not installed (no `package.json` in `smoke-tests/nosana/`) | P0 BLOCKER |

---

## 5. Exact Approval-Gated Commands

**No live commands have been executed. The following are the exact commands to run after human approval.**

### Step A: Install SDK

```bash
cd smoke-tests/nosana && npm init -y && npm install @nosana/kit
```

### Step B: Verify installation

```bash
cd smoke-tests/nosana && node -e "import('@nosana/kit').then(m => console.log('exports:', Object.keys(m).join(', ')))"
```

Expected: exports include `createNosanaClient`, `NosanaNetwork`, `JobState`, `address`.

### Step C: Run local tests (no network, no cost)

```bash
node smoke-tests/nosana/schema-validator.mjs
node smoke-tests/nosana/nosana-client-offline-tests.mjs
node smoke-tests/nosana/workload-skeleton.mjs
node smoke-tests/cross-provider-invariant-tests.mjs
```

### Step D: Verify market address (read-only, no cost)

```bash
cd smoke-tests/nosana && node -e "
import { createNosanaClient, NosanaNetwork } from '@nosana/kit';
const c = createNosanaClient(NosanaNetwork.MAINNET, { api: { apiKey: process.env.NOSANA_API_KEY } });
c.api.markets.list().then(ms => ms.forEach(m => console.log(m.address, m.name, m.gpu, m.price_per_hour_usd)));
"
```

### Step E: Execute one bounded risk workload (costs credits)

```bash
cd smoke-tests/nosana && node run-risk-job.mjs
```

### Required Human Approval Wording (Before Step E)

> "I approve one bounded Nosana risk workload execution using the job definition
> produced by `buildRiskJobDefinition()` in `nosana-risk-runner.mjs`. Maximum spend:
> US$10.00. One attempt, zero retries. No PII enters the workload. I understand the
> fallback will activate if the job fails."

---

## 6. Confirmation

| Confirmation | Detail |
|---|---|
| No Nosana API call made | Zero HTTP requests to any Nosana endpoint |
| No credits spent | No workload submitted |
| No source files modified | Only this new file created in `docs/` |
| No secrets accessed | `.env.local` not read; no credential values accessed |
| No packages installed | No `npm install` executed |
| No paid workload submitted | **Explicitly confirmed: zero paid workloads were submitted** |
| Local tests run | 141/141 passed (schema-validator, offline-tests, workload-skeleton, cross-provider) |

---

## 7. Summary Verdict

| Audit Point | Verdict |
|---|---|
| 1. `@nosana/kit` version | ✅ Package name correct; **not installed** — version uncheckable |
| 2. Client initialization | ✅ **MATCH** — `createNosanaClient(NosanaNetwork.MAINNET, { api: { apiKey } })` |
| 3. API-key vs wallet | ✅ **CORRECT** — API-key for credits path; no wallet needed |
| 4. Job-definition schema | ✅ **MATCH** — `version`, `type`, `ops[]`, `global.env` all correct |
| 5. IPFS/submit/poll/result | ✅ Pin, submit, poll match; ⚠️ `ipfs.get` vs `ipfs.retrieve` and `job.id` vs `job.job` need SDK verification |
| 6. Timeout units | ✅ **RESOLVED** — seconds, matching official docs |
| 7. Market lookup | ⚠️ Format correct; address unverified against live API |
| 8. Ready for live smoke test? | **NOT YET** — install SDK, verify 2 method names, verify market, get approval |

**The code architecture is sound. All 141 local tests pass. The three remaining blockers are dependency installation and live verification — not structural code issues.**

---

- **Created:** 2026-08-21
- **Author:** SDK audit by coding agent
- **Review status:** Ready for human review
- **No external writes were performed. No live calls were made. No files outside `docs/` were created or modified.**
