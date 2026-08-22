# StitchCheck — Nosana Execution Checklist

> **READ-ONLY CHECKLIST FOR AUTHORIZED LIVE CHAT**
>
> This document is a read-only execution checklist. It does **not** execute,
> deploy, submit, poll, or cancel any Nosana job. No network request is made.
> No credential value is accessed or exposed. No existing file is modified.

---

## 1. Exact Workload

| Item | Value |
|---|---|
| **Test ID** | `NOS-LIVE-01` |
| **Workload type** | Non-PII connection-risk heuristic assessment |
| **Fixture file** | `smoke-tests/nosana/fixtures/req-nos-clean-two-leg.json` |
| **Fixture identifier** | `nos-req-clean-two-leg` |
| **Covered test IDs** | NOS-01, NOS-02, NOS-03, NOS-04, NOS-08, NOS-10 |
| **Simulated scenario** | `success` |

### Input Contract (exact payload to submit)

```jsonc
{
  "correlationId":              "synthetic-nos-01-clean",
  "origin":                     "AAA",
  "connectionAirport":          "BBB",
  "destination":                "CCC",
  "connectionDurationMinutes":  75,
  "staticHistoricalDatasetVersion": "synthetic-demo-v0",
  "syntheticDemo":              true,
  "nonPiiDeclaration":          true
}
```

### Expected Output Contract

```jsonc
{
  "correlationId":              "string",
  "workloadStatus":             "queued | running | completed | timeout | error",
  "jobOrServiceReference":      "string | null",
  "riskBand":                   "low | medium | high | unavailable",
  "riskScore":                  "null | number 0–1",
  "heuristicDisclaimer":        "string (must contain 'heuristic')",
  "failureCascadeExplanation":  "string",
  "datasetVersion":             "string",
  "fallbackUsed":               false,
  "errorCode":                  "null",
  "errorMessage":               "null"
}
```

---

## 2. Required Environment

| # | Requirement | How to Verify | Pass/Fail |
|---|---|---|---|
| E-1 | Nosana program/API access confirmed via official documentation (https://learn.nosana.com/) | Record documentation URL and access confirmation | |
| E-2 | Environment confirmed as **testnet / non-production** | Record environment name and proof of isolation | |
| E-3 | Workload image/definition deployed and reviewed | Record deployment reference and review approval | |
| E-4 | Solana wallet or compute prerequisites provisioned | Record wallet/quota readiness (no wallet address in docs) | |
| E-5 | Node.js runtime available for harness scripts | `node --version` recorded; `smoke-tests/nosana/` scripts use zero dependencies | |

**All five environment checks must pass before execution may proceed.**

---

## 3. Credential Presence Check

| # | Check | Method | Pass/Fail |
|---|---|---|---|
| C-1 | `NOSANA_API_KEY` (or equivalent) exists in `.env.local` | Check key presence only — **do not read, print, or log the value** | |
| C-2 | Credential is **not** present in any source file, fixture, result, log, or documentation | `grep` for the key name across the repo; zero hits expected outside `.env.local` | |
| C-3 | Credential is scoped to **testnet / non-production** only | Confirm scope metadata with credential owner | |
| C-4 | Credential has **least-privilege** permissions (no broader scope than required) | Confirm with credential owner | |
| C-5 | `NOSANA_API_KEY` (or equivalent) is listed in `.env.example` with an **empty value** | Open `.env.example`; confirm key name present with `=` and no value | |

**The credential value must never appear in this document, any documentation file, any evidence artifact, any screenshot, any recording, or any commit.**

---

## 4. Expected Cost Verification

| # | Check | Required Answer | Pass/Fail |
|---|---|---|---|
| COST-1 | Cost of a single minimum Nosana workload has been estimated | Exact estimated amount in USD recorded | |
| COST-2 | Estimated cost is **strictly less than US$10.00** | Amount < $10.00 confirmed | |
| COST-3 | Billing account has been explicitly approved by the human organizer | Billing account identifier recorded (no account secrets) | |
| COST-4 | Cost can be verified before submission (e.g., pricing page, rate card) | Source of cost verification recorded | |

### US$10 Maximum Spend — Hard Ceiling

> **If the cost of the single workload cannot be estimated, or if the
> estimated or confirmed cost is ≥ US$10.00, execution must not proceed.
> This is non-negotiable.**

---

## 5. One-Attempt Limit

| Constraint | Value | Source |
|---|---|---|
| Maximum workload submissions | **1** | `docs/stitchcheck-live-service-demo-preflight.md` (NOS-LIVE-01) |
| Maximum request attempts (client-level) | **1** | `nosana-client.mjs` → `SAFETY_LIMITS.maxRequestAttempts = 1` |
| Maximum retries | **0** | `nosana-client.mjs` → `SAFETY_LIMITS.maxRetries = 0` |
| Envelope size limit | **1 MB** (1 048 576 bytes) | `nosana-client.mjs` → `SAFETY_LIMITS.maxEnvelopeBytes = 1024 * 1024` |

**Only one workload may be submitted. No retry is permitted. A second
attempt is blocked by the client-level request-limit guard.**

---

## 6. Timeout and Stop Rules

### Timeout Parameters

| Parameter | Value | Source |
|---|---|---|
| Request timeout | **60 000 ms** (60 seconds) | `nosana-client.mjs` → `SAFETY_LIMITS.requestTimeoutMs` |
| Timeout is hard-bounded | Yes — `Math.min(config.timeoutMs, 60000)` | Client enforces ceiling |
| Retry on timeout | **No** — `maxRetries = 0` | No automatic retry |

### Timeout / Error Behavior

| Scenario | `workloadStatus` | `riskBand` | `riskScore` |
|---|---|---|---|
| Timeout | `"timeout"` | `"unavailable"` | `null` |
| Error | `"error"` | `"unavailable"` | `null` |
| Success | `"completed"` | `"low" \| "medium" \| "high"` | `null \| number 0–1` |

**A score must never be invented if the job fails or times out.**

### Hard Stop Conditions — Immediate Abort

Execution must **not** proceed if **any** of the following is true:

| # | Condition | Rationale |
|---|---|---|
| S-1 | Cost of the single workload is unclear or cannot be estimated | Financial safety gate |
| S-2 | Estimated or confirmed cost ≥ US$10.00 | Hard ceiling per organizer approval |
| S-3 | No billing account has been explicitly approved | Financial governance |
| S-4 | Environment is not confirmed testnet/non-production | Production safety |
| S-5 | Nosana program access is not confirmed | Prerequisite gate |
| S-6 | Workload image/definition is not deployed | Prerequisite gate |
| S-7 | Required credential (`NOSANA_API_KEY` or equivalent) is not provisioned in `.env.local` | Prerequisite gate |
| S-8 | Credential has broader permissions than required | Least-privilege safety |
| S-9 | Input cannot be proven PII-free before submission | Data safety |
| S-10 | Any provider response would expose secrets, PII, or private data | Data safety |

**All ten conditions must be verified as false before NOS-LIVE-01 may
execute. If any condition is true, stop immediately.**

---

## 7. Sanitized Evidence Fields

Only the following fields may be recorded after execution. All values must
be sanitized — no raw provider output, no headers, no credentials, no PII.

| Field | Format | Example |
|---|---|---|
| `timestamp` | ISO 8601 UTC | `2026-08-21T14:30:00Z` |
| `serviceAndTestId` | string | `Nosana / NOS-LIVE-01` |
| `status` | enum | `success`, `failed`, `timeout`, `aborted` |
| `requestPurpose` | string | "Validate that Nosana can execute one minimum-cost non-PII risk workload on testnet" |
| `fixtureIdentifier` | string | `nos-req-clean-two-leg` |
| `sanitizedResultSummary` | string | "Workload completed; riskBand returned as 'medium'; result matches schema" |
| `reachedProvider` | boolean | `true` if request reached Nosana and a response was received; `false` otherwise |
| `whatThisProves` | string | See Section 8 |
| `whatThisDoesNotProve` | string | See Section 8 |

### Explicitly Prohibited from Capture

- Raw Nosana response (full JSON, unstructured data)
- HTTP headers, authorization tokens, API keys, credentials
- PII of any kind
- Booking, payment, reservation, ticket, order, or verification data
- Private URLs, account identifiers, wallet addresses, internal endpoints
- Screenshots or video containing any of the above

---

## 8. What the Result Would Prove and Not Prove

### If NOS-LIVE-01 succeeds:

**Proves:**

- Nosana can execute a minimum-cost, non-PII, synthetic risk-assessment workload on a testnet/non-production environment.
- The workload returns a structured, app-consumable result matching the expected contract schema.
- Status transitions (queued → running → completed or equivalent) are observable and can be displayed in the StitchCheck UI.
- A job or service reference is returned and can be shown in the UI.
- No PII is required or transmitted.
- Nosana has an essential, visible, app-consumed role in the P0 flow.

**Does not prove:**

- Nosana is production-ready or deployed to mainnet.
- The risk assessment is accurate, reliable, or based on real-world data.
- Nosana can handle production-scale workloads or concurrent requests.
- The integration works with real itineraries, real PII-containing data, or real booking contexts.
- Nosana pricing, availability, or SLA is suitable for production use.
- Any other provider (Gemini, Atlas) integration works.

### If NOS-LIVE-01 fails:

- Do not claim a Nosana integration works.
- Record the precise failure mode and latency.
- Do not replace Nosana with a decorative or unused integration.
- Reassess P0 only if an alternative Nosana workload/service design still has an essential, visible, app-consumed role.
- Update `docs/PRD.md`, `docs/UAT.md`, and `docs/SPECS.md` before altering P0 scope.

---

## 9. Blocked Wording

If any of the following conditions is true, record the exact wording below
in the evidence log and **do not execute**:

| Trigger | Exact Blocked Wording |
|---|---|
| Cost is unclear or unestimated | **BLOCKED — Cost of the single Nosana workload is unclear or cannot be estimated. Execution must not proceed until cost is confirmed strictly below US$10.00.** |
| Cost ≥ US$10.00 | **BLOCKED — Estimated or confirmed cost of the single Nosana workload equals or exceeds US$10.00. This exceeds the hard spend ceiling. Execution must not proceed.** |
| Billing account not approved | **BLOCKED — No billing account has been explicitly approved by the human organizer. Execution must not proceed.** |
| Workload configuration is unclear | **BLOCKED — The Nosana workload configuration (image, definition, or job type) is unclear or has not been reviewed and deployed. Execution must not proceed.** |
| Environment not confirmed testnet | **BLOCKED — The Nosana environment has not been confirmed as testnet/non-production. Execution must not proceed.** |
| Credential missing | **BLOCKED — The required Nosana credential (`NOSANA_API_KEY` or equivalent) is not provisioned in `.env.local`. Execution must not proceed.** |
| Credential over-permissioned | **BLOCKED — The Nosana credential has broader permissions than required for this single testnet workload. Execution must not proceed.** |
| PII cannot be ruled out | **BLOCKED — The input fixture cannot be proven PII-free before submission. Execution must not proceed.** |

---

## 10. Pre-Execution Verification Checklist

All checkboxes must be marked before NOS-LIVE-01 may execute:

- [ ] **E-1:** Nosana program access confirmed via official documentation.
- [ ] **E-2:** Environment confirmed as testnet/non-production.
- [ ] **E-3:** Workload image/definition deployed and reviewed.
- [ ] **E-4:** Solana wallet or compute prerequisites provisioned.
- [ ] **E-5:** Node.js runtime available.
- [ ] **C-1:** Credential present in `.env.local` (presence only; value not read).
- [ ] **C-2:** Credential absent from all source, fixture, result, log, and doc files.
- [ ] **C-3:** Credential scoped to testnet/non-production.
- [ ] **C-4:** Credential has least-privilege permissions.
- [ ] **C-5:** Credential key listed in `.env.example` with empty value.
- [ ] **COST-1:** Cost of single workload estimated.
- [ ] **COST-2:** Estimated cost confirmed < US$10.00.
- [ ] **COST-3:** Billing account explicitly approved.
- [ ] **COST-4:** Cost verification source recorded.
- [ ] **S-1 to S-10:** All hard stop conditions verified as false.
- [ ] Input fixture inspected and proven PII-free.
- [ ] Evidence capture rules understood and will be followed.
- [ ] Human organizer has explicitly approved NOS-LIVE-01 execution.

**No test may proceed until every checkbox above is marked.**

---

## Changed-Files Verification

| File | Action |
|---|---|
| `docs/stitchcheck-nosana-execution-checklist.md` | **CREATED** |
| All other files | **UNCHANGED** |
