# StitchCheck — Nosana Code Gaps (Official-Documentation Audit)

> **Status:** READ-ONLY AUDIT — no external writes, no Nosana calls, no credits spent, no secrets accessed, no source files modified.
> **Date:** 2026-08-21
> **Scope:** Verification of the current `smoke-tests/nosana/` implementation against the official Nosana documentation at https://learn.nosana.com/.
> **Constraint:** `.env.local` was not read. No Nosana API call was made. No package was installed. No paid workload was submitted.

---

## 1. Verification Summary

| # | Checkpoint | Verdict | Severity |
|---|---|---|---|
| 1 | Official job-definition schema | **MISMATCH** | HIGH |
| 2 | SDK package and client initialization | **MISMATCH** | HIGH |
| 3 | IPFS pin method | ✅ Matches | — |
| 4 | Job submission method (raw job path) | ✅ Matches | — |
| 5 | Market format | ✅ Format correct; address unverified | LOW |
| 6 | Timeout units | **AMBIGUOUS** | MEDIUM |
| 7 | Polling and result retrieval | ✅ Matches | — |
| 8 | Error and fallback behavior | ✅ Comprehensive | — |
| 9 | Local `validateJobDefinition()` behavior | **MISMATCH** | HIGH |
| 10 | looPilot pin → post → poll → retrieve pattern | ✅ Matches | — |

**Overall: 3 HIGH discrepancies, 1 MEDIUM, 1 LOW. No minimal safe code fix is implemented because the corrections require structural changes that go beyond a minimal fix and are not uniformly supported across all official documentation paths (Deployment API vs. raw Job API).**

---

## 2. Exact Discrepancies

### D-01: Job Definition Schema Mismatch — HIGH

| Aspect | Official Nosana Schema | Project Implementation (`nosana-risk-runner.mjs` L141–155) |
|---|---|---|
| **Top-level fields** | `version: "0.1"`, `type: "container"`, `ops[]` | `containerImage`, `command`, `env`, `meta` |
| **Container image** | `ops[].args.image` (e.g., `"ubuntu"`) | `containerImage` (top-level, not in schema) |
| **Command** | `ops[].args.cmd` (string or string[]) | `command` (top-level, not in schema) |
| **Environment variables** | `global.env` or per-op | `env` (top-level, not in schema) |
| **Schema version** | Required: `"0.1"` | **Not present** |
| **Execution type** | Required: `"container"` | **Not present** |
| **Operations array** | Required: `ops[]` with `id`, `type: "container/run"`, `args` | **Not present** |

**Official schema (from `learn.nosana.com/deployments/jobs/job-definition/schema.html`):**

```json
{
  "version": "0.1",
  "type": "container",
  "ops": [
    {
      "id": "unique-id",
      "type": "container/run",
      "args": {
        "image": "ubuntu",
        "cmd": ["echo", "hello"]
      }
    }
  ],
  "meta": { "trigger": "api" },
  "global": { "env": { "KEY": "value" } }
}
```

**Project's current job definition builder (`buildRiskJobDefinition()`):**

```javascript
{
  containerImage: "python:3.12-slim",   // NOT in official schema
  command: "python3 << 'PYEOF'...",      // NOT in official schema
  env: { RISK_INPUT_DATA: "...", HISTORICAL_DELAY_DATA: "..." },  // NOT in official schema at top-level
  meta: { workload: "stitchcheck-risk-calc", version: "1.0.0" }
}
```

**Impact:** If submitted as-is, the Nosana API would reject this job definition. The `version`, `type`, and `ops[]` fields are required. The flat structure does not conform to the schema.

**Required correction:** The `buildRiskJobDefinition()` function must be restructured to produce:

```javascript
{
  version: "0.1",
  type: "container",
  meta: { trigger: "api" },
  ops: [
    {
      id: "stitchcheck-risk-calc",
      type: "container/run",
      args: {
        image: "python:3.12-slim",
        cmd: "python3 << 'PYEOF'\n...\nPYEOF",
        // env would go in global.env or be set via container runtime
      }
    }
  ],
  global: {
    env: {
      RISK_INPUT_DATA: "...",
      HISTORICAL_DELAY_DATA: "..."
    }
  }
}
```

**Why no minimal fix is applied:** Restructuring the job definition builder changes the shape of every downstream consumer (the IPFS pin payload, the local validator, the child process serialisation). This is not a minimal fix.

---

### D-02: SDK Package and Client Initialization Mismatch — HIGH

| Aspect | Official Docs | Project Implementation (`nosana_run_job.mjs` L126–130) |
|---|---|---|
| **SDK package** | `@nosana/kit` | `@nosana/kit` (import path correct) |
| **Client creation** | `createNosanaClient(NosanaNetwork.MAINNET, { api: { apiKey } })` | `new Nosana({ key: apiKey, network: "mainnet" })` |
| **Network constant** | `NosanaNetwork.MAINNET` (enum) | `"mainnet"` (string literal) |
| **API key field** | `api.apiKey` | `key` |
| **Package installed?** | Should be in `package.json` or `.nosana/` | **NOT INSTALLED** — no `package.json` references `@nosana/kit`; no `.nosana/` directory exists |

**Official SDK initialisation (from `learn.nosana.com/api/create-deployments.html`):**

```typescript
import { createNosanaClient, NosanaNetwork } from '@nosana/kit';

const client = createNosanaClient(NosanaNetwork.MAINNET, {
  api: {
    apiKey: process.env.NOSANA_API_KEY,
  },
});
```

**Project's current initialisation:**

```javascript
const { Nosana } = await import("@nosana/kit");
nosanaClient = new Nosana({
  key: apiKey,
  network: "mainnet",
});
```

**Impact:** The class-based `Nosana` constructor with `key` and string `network` does not match the documented factory function `createNosanaClient()`. This may be from an older SDK version or may not exist at all in the current `@nosana/kit` package. Additionally, the package is not installed anywhere in the project.

**Required correction:** Replace `new Nosana(...)` with `createNosanaClient(NosanaNetwork.MAINNET, { api: { apiKey } })`. Install `@nosana/kit`.

**Why no minimal fix is applied:** The SDK is not installed. Installing it and changing the initialisation pattern requires verifying that all downstream API calls (`ipfs.pin`, `api.jobs.list`, `api.jobs.get`, `ipfs.get`) are compatible with the new client shape. This cannot be done as a minimal safe fix without the SDK being available for testing.

---

### D-03: Local `validateJobDefinition()` Does Not Match Official Validator — HIGH

| Aspect | Official SDK Validator | Project Implementation (`nosana_run_job.mjs` L50–78) |
|---|---|---|
| **Source** | `import { validateJobDefinition } from '@nosana/kit'` | Custom function in `nosana_run_job.mjs` |
| **Validates** | Full schema: `version`, `type`, `ops[]`, `args.image`, `args.cmd`, unique op IDs | Only `containerImage`, `command`, `env` |
| **Returns** | `{ success: boolean, data?: JobDefinition, errors?: Array<{path, expected, value}> }` | `{ valid: boolean, issues: string[] }` |
| **Strictness** | Rejects unknown/misspelled properties | Does not check for `version`, `type`, `ops[]` |
| **PII check** | Not part of schema validation | Custom PII field rejection (good addition, but not from SDK) |

**Official validator usage (from `learn.nosana.com/deployments/jobs/job-definition/validation.html`):**

```typescript
import { validateJobDefinition } from '@nosana/kit';

const result = validateJobDefinition({
  version: '0.1',
  type: 'container',
  ops: [{ type: 'container/run', id: 'hello', args: { cmd: 'echo hello', image: 'ubuntu' } }],
});

if (result.success) {
  // result.data is a fully-typed JobDefinition
} else {
  // result.errors has path, expected, value
}
```

**Project's current validator:**

```javascript
export function validateJobDefinition(jobDef) {
  // Only checks: containerImage, command, env
  // Does NOT check: version, type, ops[]
  // Custom PII rejection (good, but not from SDK)
}
```

**Impact:** The local validator gives false confidence. A job definition that passes this validator would fail the official SDK validator and the Nosana API. The function name collides with the SDK export but has completely different semantics.

**Required correction:** Import and use `validateJobDefinition` from `@nosana/kit` for schema validation. Keep the PII check as an additional project-specific guard.

**Why no minimal fix is applied:** The SDK is not installed (see D-02). The custom validator's return shape (`{ valid, issues }`) differs from the SDK's (`{ success, data, errors }`). Changing the validator requires updating all callers.

---

### D-04: Timeout Units Ambiguity — MEDIUM

| Aspect | Official Docs | Project Implementation |
|---|---|---|
| **Deployment timeout** | **Minutes** (`timeout: 60` = 60 minutes) | N/A — project uses raw job path, not deployment path |
| **Raw job `jobs.list({ timeout })`** | **Not explicitly documented** | `timeoutSec = 120` (seconds); passed directly to `jobs.list()` |
| **Internal safety limit** | N/A | `requestTimeoutMs: 60000` (60 seconds) in `nosana-client.mjs` |

**Official deployment timeout (from `learn.nosana.com/deployments/options.html`):**

> `timeout`: Maximum execution time in minutes (60 = 60 minutes)

**Raw job path:** The validation page shows `client.api.jobs.list({ ipfsHash, market })` without a `timeout` parameter. The project passes `timeout: timeoutSec` (in seconds). The unit for the raw job path is not documented.

**Impact:** If the raw job path expects minutes, passing `120` means 120 minutes (not 120 seconds). If it expects seconds, `120` is correct. This is undocumented.

**Why no minimal fix is applied:** The official documentation does not specify the timeout unit for the raw job path. Any change would be a guess.

---

### D-05: Market Address Unverified — LOW

| Aspect | Value | Source |
|---|---|---|
| **Hardcoded default** | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` | `nosana_run_job.mjs` L30 |
| **Official docs example** | `CA5pMpqkYFKtme7K31pNB1s62X2SdhEv1nN9RdxKCpuQ` (NVIDIA 3090) | `learn.nosana.com/deployments/options.html` |
| **Verification** | Not verified against live `GET /api/markets` | No read-only API call has been made |

**Impact:** The hardcoded market address may be stale or incorrect. It should be verified via a read-only `client.api.markets.list()` call before any paid submission.

**Why no minimal fix is applied:** The address format (Solana base58) is correct. The specific address needs live verification, which is a prerequisite step, not a code fix.

---

## 3. Checkpoints That Match Official Documentation

### ✅ Checkpoint 3: IPFS Pin Method

**Project (`nosana_run_job.mjs` L143–149):**

```javascript
const pinResult = await nosanaClient.ipfs.pin(jobDef);
resolvedHash = pinResult.hash || pinResult.IpfsHash || pinResult;
```

**Official docs (validation page):**

```typescript
const ipfsHash = await client.ipfs.pin(result.data);
```

**Verdict:** The `client.ipfs.pin()` method matches. The hash extraction handles multiple response shapes defensively.

### ✅ Checkpoint 4: Job Submission Method (Raw Job Path)

**Project (`nosana_run_job.mjs` L153–157):**

```javascript
const job = await nosanaClient.api.jobs.list({
  ipfsHash: resolvedHash,
  market,
  timeout: timeoutSec,
});
```

**Official docs (validation page):**

```typescript
const job = await client.api.jobs.list({
  ipfsHash,
  market: 'CA5pMpqkYFKtme7K31pNB1s62X2SdhEv1nN9RdxKCpuQ',
});
```

**Verdict:** The `client.api.jobs.list()` method matches for the raw job path. The project adds a `timeout` parameter that is not shown in the docs example but is plausible.

### ✅ Checkpoint 7: Polling and Result Retrieval

**Project (`nosana_run_job.mjs` L169–184):**

```javascript
const status = await nosanaClient.api.jobs.get(jobId);
if (status && (status.ipfsResult || status.result)) {
  finalJob = status;
  break;
}
```

**Official docs (evidence plan §1.4):**

> Poll: `nosanaClient.api.jobs.get(jobId)` every N seconds until `ipfsResult` or `result` is set.

**Verdict:** Matches. The polling interval (3s) and deadline-based timeout are reasonable.

### ✅ Checkpoint 8: Error and Fallback Behavior

The project implements a comprehensive fallback chain:
- `nosana-risk-runner.mjs`: Falls back to local Monte Carlo heuristic on any failure.
- `nosana_run_job.mjs`: Emits structured error JSON with error codes.
- `run-risk-job.mjs`: Loads credentials, delegates to runner, writes results.
- Evidence labelling: `nosana-evidence` only on success; `local-fallback` on any failure.

**Verdict:** Comprehensive and well-designed. No discrepancy.

### ✅ Checkpoint 10: looPilot Pin → Post → Poll → Retrieve Pattern

The project's `nosana_run_job.mjs` follows the exact four-step pattern:
1. **Pin:** `nosanaClient.ipfs.pin(jobDef)` → IPFS hash
2. **Post:** `nosanaClient.api.jobs.list({ ipfsHash, market, timeout })` → job ID
3. **Poll:** `nosanaClient.api.jobs.get(jobId)` every 3s until result or deadline
4. **Retrieve:** `nosanaClient.ipfs.get(resultHash)` → parse last JSON line

**Verdict:** Matches the documented raw job path lifecycle.

---

## 4. Additional Findings

### A-01: `@nosana/kit` Is Not Installed

No `package.json` in the project references `@nosana/kit`. No `.nosana/` directory exists. The dynamic import in `nosana_run_job.mjs` L126 would fail at runtime with a module-not-found error.

**Impact:** The live execution path cannot run without installing the SDK first.

### A-02: `.env.example` Now Contains `NOSANA_API_KEY=`

Previously flagged as missing (D-02 in the evidence plan). This has been **resolved** — `.env.example` line 3 now contains `NOSANA_API_KEY=`.

### A-03: Dual Client Architecture Is Intentional

- `nosana-client.mjs`: Offline-only safety boundary (zero network, zero credentials).
- `nosana_run_job.mjs` + `nosana-risk-runner.mjs`: Live-execution path (SDK, IPFS, polling).

These are not contradictory. The offline client is the default; the live path only activates when `NOSANA_API_KEY` is present and `skipNosana` is false.

### A-04: Result Schema Enum Divergence (Informational)

| File | `WORKLOAD_STATUSES` |
|---|---|
| `schema-validator.mjs` | `["queued", "running", "completed", "timeout", "error"]` |
| `nosana-client.mjs` | `["disabled", "blocked", "ready", "failed", "passed"]` |

The schema validator uses Nosana-aligned statuses; the client boundary uses internal lifecycle statuses. The `normalizeFixtureResult()` function bridges the gap by correcting invalid statuses to `"failed"`. This is intentional and documented.

---

## 5. What Must Be Fixed Before Paid Execution

| Priority | Fix | Effort | Blocker? |
|---|---|---|---|
| **P0** | Restructure `buildRiskJobDefinition()` to produce official schema (`version`, `type`, `ops[]`) | ~1 hour | YES — API would reject current shape |
| **P0** | Install `@nosana/kit` and update client initialisation to `createNosanaClient()` | ~30 min | YES — import fails without install |
| **P0** | Replace custom `validateJobDefinition()` with SDK import; keep PII check as additional guard | ~30 min | YES — false confidence without real validator |
| **P1** | Clarify raw job path timeout unit (seconds vs. minutes) via SDK source or support | ~15 min | MAYBE — could cause 120-minute wait if wrong |
| **P2** | Verify market address via read-only `markets.list()` call | ~15 min | NO — but recommended |

**Total estimated effort:** 2–3 hours of human-gated work, plus prerequisite steps (account creation, credit acquisition, container image build).

---

## 6. Why No Minimal Safe Code Fix Was Applied

Per the task instructions:

> "If a correction is fully supported by official documentation, implement only the minimal safe code fix in `smoke-tests/nosana/`. Otherwise create: `docs/stitchcheck-nosana-code-gaps.md`"

The discrepancies identified are:

1. **Structural** — The job definition schema requires a complete restructure of `buildRiskJobDefinition()`, not a field rename.
2. **Dependency-gated** — The SDK is not installed; changing the initialisation pattern requires installing `@nosana/kit` and verifying API compatibility.
3. **Undocumented** — The raw job path timeout unit is not specified in official docs.
4. **Cascading** — Fixing the job definition shape requires updating the validator, the IPFS pin payload, and the child process serialisation.

None of these qualify as "minimal safe code fixes" that are "fully supported by official documentation." They require structural changes, dependency installation, and live verification.

---

## 7. Files Reviewed

| File | Purpose |
|---|---|
| `smoke-tests/nosana/nosana_run_job.mjs` | Three-step Nosana job submission helper |
| `smoke-tests/nosana/nosana-risk-runner.mjs` | Live-execution wrapper with local fallback |
| `smoke-tests/nosana/run-risk-job.mjs` | CLI entry point |
| `smoke-tests/nosana/nosana-client.mjs` | Offline-only client boundary |
| `smoke-tests/nosana/nosana-client-offline-tests.mjs` | 75 offline tests |
| `smoke-tests/nosana/schema-validator.mjs` | Input/output contract validators |
| `smoke-tests/nosana/workload-skeleton.mjs` | Local lifecycle simulator |
| `smoke-tests/nosana/fixtures/manifest.json` | Fixture index |
| `.env.example` | Credential placeholder file |
| External: `learn.nosana.com/deployments/jobs/job-definition/schema.html` | Official job definition schema |
| External: `learn.nosana.com/api/create-deployments.html` | Official SDK initialisation and deployment creation |
| External: `learn.nosana.com/deployments/options.html` | Official deployment options (timeout in minutes) |
| External: `learn.nosana.com/api/markets.html` | Official markets API |
| External: `learn.nosana.com/deployments/jobs/job-definition/validation.html` | Official `validateJobDefinition()` SDK validator |

---

## 8. Confirmation

| Confirmation | Detail |
|---|---|
| No Nosana API call | Zero HTTP requests to any Nosana endpoint |
| No credits spent | No account exists; no balance check performed |
| No source files modified | Only this new file created |
| No secrets accessed | `.env.local` not read; no credential values accessed |
| No packages installed | No `npm install` or SDK installation |
| No paid workload submitted | **Explicitly confirmed: zero paid workloads were submitted** |

---

- **Created:** 2026-08-21
- **Author:** Code audit by coding agent
- **Review status:** Ready for human review
- **No external writes were performed in the creation of this document.**
