# StitchCheck — Final Nosana Live-Execution Approval Packet

> **Status:** AWAITING HUMAN APPROVAL — NOT YET EXECUTED  
> **Date:** 2026-08-21  
> **Scope:** One bounded non-PII Nosana workload. This packet consolidates every parameter the human needs to approve or deny execution.  
> **Constraint:** No workload has been submitted. No credit spent. No package installed. No live call made. This document is a preparation artifact only.

---

## 1. Exact Non-PII Input

The input is a synthetic, fictional, PII-free itinerary payload. It is identical to the `req-nos-clean-two-leg.json` fixture and the default payload in `run-risk-job.mjs`.

### 1.1 Itinerary Payload (submitted as `RISK_INPUT_DATA` env var)

```json
{
  "correlationId": "nosana-risk-cli-<UNIX-ms-at-runtime>",
  "origin": "AAA",
  "connectionAirport": "BBB",
  "destination": "CCC",
  "connectionDurationMinutes": 75,
  "staticHistoricalDatasetVersion": "hist-delay-v1",
  "syntheticDemo": true,
  "nonPiiDeclaration": true
}
```

### 1.2 Historical Delay Data (submitted as `HISTORICAL_DELAY_DATA` env var)

Source file: `smoke-tests/nosana/fixtures/historical-delay-data.json`

- Dataset version: `hist-delay-v1`
- Contains 5 fictional airports (AAA–EEE) with synthetic delay statistics.
- Contains 6 fictional routes with synthetic miss rates.
- `nonPiiDeclaration: true`, `syntheticDemo: true`.

### 1.3 PII Declaration

| Check | Status |
|---|---|
| Passenger names | ❌ None |
| Emails | ❌ None |
| Passports | ❌ None |
| Booking references | ❌ None |
| Payment data | ❌ None |
| Real airport codes | ❌ None — AAA/BBB/CCC are fictional |
| Real flight numbers | ❌ None |
| Personal data of any kind | ❌ None |

---

## 2. Exact Job Definition

The job definition is built by `buildRiskJobDefinition()` in `smoke-tests/nosana/nosana-risk-runner.mjs`. It conforms to the official Nosana Job Definition Schema v0.1.

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
        "cmd": "<Python heredoc — see Section 3>"
      }
    }
  ],
  "meta": {
    "trigger": "api",
    "workload": "stitchcheck-risk-calc",
    "version": "1.0.0",
    "syntheticDemo": true,
    "nonPiiDeclaration": true
  },
  "global": {
    "env": {
      "RISK_INPUT_DATA": "<serialized itinerary JSON from §1.1>",
      "HISTORICAL_DELAY_DATA": "<serialized historical data JSON from §1.2>"
    }
  }
}
```

### 2.1 Schema Compliance

| Required Field | Value | Present |
|---|---|---|
| `version` | `"0.1"` | ✅ |
| `type` | `"container"` | ✅ |
| `ops[]` | Non-empty array, 1 operation | ✅ |
| `ops[0].id` | `"stitchcheck-risk-calc"` (unique) | ✅ |
| `ops[0].type` | `"container/run"` | ✅ |
| `ops[0].args.image` | `"python:3.12-slim"` | ✅ |
| `ops[0].args.cmd` | Python heredoc (see §3) | ✅ |
| `meta.syntheticDemo` | `true` | ✅ |
| `meta.nonPiiDeclaration` | `true` | ✅ |

### 2.2 Local Validation

The job definition is validated locally by `validateJobDefinition()` in `smoke-tests/nosana/nosana_run_job.mjs` before any submission. This function checks all required schema fields and rejects PII-like keys in `global.env`.

---

## 3. Exact Container and Command

### 3.1 Container Image

```
python:3.12-slim
```

- Public Docker Hub image.
- No custom image build required — the Python script is self-contained.
- Uses only Python stdlib: `json`, `os`, `sys`, `math`, `random`.

### 3.2 Exact Command

The `cmd` field is a shell heredoc that runs an inline Python script:

```bash
python3 << 'PYEOF'
import json, os, sys, math, random

random.seed(42)

data = json.loads(os.environ['RISK_INPUT_DATA'])
hist = json.loads(os.environ['HISTORICAL_DELAY_DATA'])

conn_min = data['connectionDurationMinutes']
conn_apt = data['connectionAirport']
origin = data['origin']
dest = data['destination']

apt = hist.get('airports', {}).get(conn_apt, {})
avg_delay = apt.get('avgDelayMinutes', 20)
on_time = apt.get('onTimeRate', 0.75)
tight_rate = apt.get('tightConnectionRate', 0.25)
sample = apt.get('sampleSize', 500)

route = None
for r in hist.get('routes', []):
    if r['origin'] == origin and r['connection'] == conn_apt:
        route = r
        break
miss_rate = route['avgMissRate'] if route else 0.20

n_sims = min(1000, max(100, sample))
tight_count = 0
for _ in range(n_sims):
    d = max(0, random.gauss(avg_delay, avg_delay * 0.4))
    remaining = conn_min - d
    if remaining < 45:
        tight_count += 1

tight_ratio = tight_count / n_sims
risk_score = round(min(1.0, max(0.0, miss_rate * 0.6 + tight_ratio * 0.4)), 4)

if risk_score < 0.25:
    band = 'low'
elif risk_score < 0.55:
    band = 'medium'
else:
    band = 'high'

result = {
    'riskScore': risk_score,
    'riskBand': band,
    'assumptions': [
        'Historical average delay at %s: %d min' % (conn_apt, avg_delay),
        'On-time rate: %.2f' % on_time,
        'Route miss rate: %.2f' % miss_rate,
        'Monte Carlo simulations: %d' % n_sims,
    ],
    'simulationCount': n_sims,
    'explanation': (
        'A %d-minute connection at %s was evaluated against %d historical records. '
        'Monte Carlo simulation (%d runs) estimated a %.1f%% probability of tight connection. '
        'Combined with route miss rate, the heuristic risk score is %.4f (%s band). '
        'This is a heuristic indication only — not a prediction or guarantee.'
    ) % (conn_min, conn_apt, sample, n_sims, tight_ratio * 100, risk_score, band),
}

print(json.dumps(result))
PYEOF
```

### 3.3 Container Behaviour Guarantees

- Reads only `RISK_INPUT_DATA` and `HISTORICAL_DELAY_DATA` from environment.
- Makes zero network calls.
- Writes zero files.
- Prints exactly one JSON line to stdout.
- Uses only Python stdlib — no pip install, no external dependencies.

---

## 4. Exact Market Requirement

| Parameter | Value |
|---|---|
| **Market address** | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` |
| **Source** | Hardcoded default in `nosana_run_job.mjs` — described as "cheapest known market" |
| **Format** | Solana base58 (valid format) |
| **Verification status** | **NOT verified** against live `GET /api/markets` |

### 4.1 Pre-Execution Market Verification (required)

Before execution, the human must confirm the market address via a **read-only** call:

```
GET https://dashboard.k8s.prd.nos.ci/api/markets
```

If the market address is invalid or unavailable, execution must not proceed.

---

## 5. Maximum Runtime

| Parameter | Value | Source |
|---|---|---|
| **Container execution** | ~60 seconds | Python script runs 1000 Monte Carlo iterations — completes in <1s; remaining time is overhead |
| **Job polling deadline** | 120 seconds | `nosana_run_job.mjs` → `DEFAULT_TIMEOUT_SEC = 120` |
| **Client-level hard ceiling** | 60 seconds | `nosana-client.mjs` → `SAFETY_LIMITS.requestTimeoutMs = 60000` |
| **End-to-end wall clock** | ≤ 125 seconds | Polling deadline + 5s child-process grace |

**Maximum runtime for approval purposes: 120 seconds (2 minutes).**

---

## 6. Expected and Maximum Cost

| Parameter | Value | Source |
|---|---|---|
| Cheapest market (NVIDIA 3060) | ~$0.048/hr | Nosana published pricing |
| 60-second workload | **~$0.0008** | $0.048 × (60/3600) |
| 120-second worst case | ~$0.0016 | $0.048 × (120/3600) |
| **Hard ceiling** | **US$10.00** | Project preflight rules — non-negotiable |

### 6.1 Cost Verification

- If cost cannot be estimated → **BLOCKED**.
- If estimated cost ≥ US$10.00 → **BLOCKED**.
- Post-execution: verify `creditsUsed` from job response < US$10.00.

---

## 7. Authentication Requirements

| Requirement | Detail |
|---|---|
| **Credential name** | `NOSANA_API_KEY` |
| **Storage location** | `.env.local` (git-ignored, never in source) |
| **How it's read** | `run-risk-job.mjs` reads from `.env.local` or `process.env` |
| **How it's passed** | Inherited by child process via `process.env`; never printed or logged |
| **Auth header format** | `Authorization: Bearer $NOSANA_API_KEY` |
| **API base URL** | `https://dashboard.k8s.prd.nos.ci/api` |
| **SDK initialisation** | `createNosanaClient(NosanaNetwork.MAINNET, { api: { apiKey } })` |

### 7.1 Credential Safety

- `NOSANA_API_KEY` is **never** printed, logged, or included in any output or result file.
- `nosana-client.mjs` strips all credential-like keys from envelopes via `FORBIDDEN_KEYS`.
- Error messages are sanitized — credentials stripped before recording.
- The credential value must never appear in this document, any evidence artifact, or any commit.

### 7.2 Current Credential Status

- `NOSANA_API_KEY` variable name exists in `.env.local` (grep count = 1; value not read).
- `NOSANA_API_KEY` is **not** listed in `.env.example` (discrepancy D-02 in evidence plan).
- No Nosana credit account is known to exist.

---

## 8. Result Path

### 8.1 Execution Command

```bash
cd smoke-tests/nosana && node run-risk-job.mjs
```

### 8.2 Output Locations

| File | Purpose |
|---|---|
| `smoke-tests/nosana/results/nosana-risk-result.json` | Primary result (sanitized) |
| `app/public/nosana-risk-result.json` | Copy for React dev server |

### 8.3 Evidence Directory (on success)

```
smoke-tests/nosana/results/<UTC-timestamp>/
├── result.json            # Sanitized Nosana job result
├── summary.md             # Human-readable evidence record
└── job-definition.json    # Exact job definition submitted (for hash verification)
```

### 8.4 Result Must Contain

| Field | Constraint |
|---|---|
| `correlationId` | Matches input fixture |
| `riskBand` | ∈ {`low`, `medium`, `high`} |
| `riskScore` | Number in [0, 1] |
| `heuristicDisclaimer` | Contains the word "heuristic" |
| `simulationCount` | Positive number |
| `assumptions` | Array of strings |
| `explanation` | Non-empty string |
| PII | **None** in input or output |

---

## 9. Fallback

If the Nosana job fails, times out, errors, or is rejected for any reason:

| Behaviour | Detail |
|---|---|
| **Fallback engine** | Local Monte Carlo heuristic in `nosana-risk-runner.mjs` → `localRiskCalculation()` |
| **Algorithm** | Seeded PRNG (mulberry32, seed=42), Box-Muller gaussian, 1000 simulations |
| **Result label** | `evidenceSource: "local-fallback"` |
| **User-visible label** | `"Nosana unavailable — local fallback used; not Nosana evidence."` |
| **`fallbackUsed`** | `true` |
| **`usedFallback`** | `true` |
| **UI display** | Shows fallback label, **not** live-evidence label |
| **Retry** | **None** — `maxRetries: 0`, `maxRequestAttempts: 1` |

The fallback ensures the UI always has a result to display, and the evidence boundary ensures the fallback is never confused with live Nosana evidence.

---

## 10. One-Attempt Stop Rule

| Constraint | Value | Source |
|---|---|---|
| Maximum workload submissions | **1** | This approval packet |
| Maximum request attempts | **1** | `nosana-client.mjs` → `SAFETY_LIMITS.maxRequestAttempts = 1` |
| Maximum retries | **0** | `nosana-client.mjs` → `SAFETY_LIMITS.maxRetries = 0` |
| Envelope size limit | **1 MB** (1,048,576 bytes) | `nosana-client.mjs` → `SAFETY_LIMITS.maxEnvelopeBytes` |

### 10.1 Hard Stop Conditions

Execution must **not** proceed if **any** of the following is true:

| # | Condition |
|---|---|
| S-1 | Cost of the single workload is unclear or cannot be estimated |
| S-2 | Estimated or confirmed cost ≥ US$10.00 |
| S-3 | No billing account has been explicitly approved |
| S-4 | Environment is not confirmed as non-production / appropriate |
| S-5 | Nosana program access is not confirmed |
| S-6 | Workload image/definition fails local validation |
| S-7 | Required credential (`NOSANA_API_KEY`) is not provisioned in `.env.local` |
| S-8 | Credential has broader permissions than required |
| S-9 | Input cannot be proven PII-free |
| S-10 | Any accidental credential exposure detected |

**After one attempt (success, failure, or timeout), no further attempt may be made without a new, separate human approval.**

---

## 11. Evidence Needed to Claim Live Nosana

To claim "live Nosana executed" to judges, **all** of the following must be satisfied:

### 11.1 Mandatory Evidence Artifacts

| # | Artifact | Required Content |
|---|---|---|
| E-1 | **Job ID** | A real Nosana job ID returned by the API (not a synthetic reference) |
| E-2 | **Market address** | The market to which the job was submitted |
| E-3 | **IPFS hash** | The IPFS hash of the pinned job definition |
| E-4 | **Timestamps** | ISO 8601 `submittedAt` and `completedAt` |
| E-5 | **Result JSON** | Sanitized result containing `riskBand`, `riskScore`, `heuristicDisclaimer` |
| E-6 | **Job definition** | Exact JSON submitted (for hash verification against IPFS) |
| E-7 | **Cost record** | `creditsUsed` from job response, confirmed < US$10.00 |
| E-8 | **Evidence source label** | `evidenceSource: "nosana-evidence"` (set only on success) |

### 11.2 What a Successful Result Proves

- Nosana executed one minimum-cost, non-PII, synthetic risk-assessment workload.
- The workload returned a structured, app-consumable result matching the expected contract.
- Nosana has an essential, visible, app-consumed role in the P0 user journey.
- No PII was required or transmitted.
- The UI correctly displays live Nosana evidence with appropriate labelling.

### 11.3 What a Successful Result Does NOT Prove

- Nosana is production-ready or deployed to mainnet.
- The risk assessment is accurate or based on real-world data.
- Nosana can handle production-scale workloads.
- Any other provider (Gemini, Atlas) integration works.

### 11.4 If the Job Fails

- `evidenceSource` is set to `"local-fallback"`, **not** `"nosana-evidence"`.
- The label reads: `"Nosana unavailable — local fallback used; not Nosana evidence."`
- No claim of live Nosana execution may be made.
- The precise failure mode and latency are recorded.

---

## 12. Prerequisites Checklist

All must be resolved before execution may proceed:

- [ ] `@nosana/kit` installed (`cd smoke-tests/nosana && npm install @nosana/kit`)
- [ ] Nosana credit account exists with balance > 0
- [ ] Market address verified via read-only `GET /api/markets`
- [ ] Job definition validated locally with `validateJobDefinition()`
- [ ] `NOSANA_API_KEY` present in `.env.local` (presence only; value not read)
- [ ] Input fixture verified PII-free
- [ ] Human has explicitly approved one-attempt execution and spend ≤ US$10.00

---

## 13. Required Human Approval Wording

Before execution, the human must provide written approval including:

> "I approve one bounded Nosana risk workload execution using the job definition
> in this approval packet. Maximum spend: US$10.00. One attempt, zero retries.
> No PII enters the workload. I understand the fallback will activate if the
> job fails."

---

## 14. Explicit Safety Statements

**No paid Nosana workload was submitted during the creation of this document.**

**No Nosana API call was made. No credit was spent. No package was installed.**

**No `.env.local` value was read. No credential was accessed.**

**No existing file was modified. Only this new file was created.**

---

## Changed-Files Verification

| File | Action |
|---|---|
| `docs/stitchcheck-nosana-live-approval-packet-final.md` | **CREATED** |
| All other files | **UNCHANGED** |

---

- **Created:** 2026-08-21
- **Author:** Final verification lead
- **No workload was submitted. No package was installed. No credit was spent.**
