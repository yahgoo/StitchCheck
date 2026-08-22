# StitchCheck — Nosana Live-Execution Preflight

> **Status: PREPARATION ONLY — NO NOSANA EXECUTION HAS OCCURRED**
>
> This document is a preflight plan. It does not execute, deploy, submit,
> poll, or cancel any Nosana job. No network request is made. No credential
> is accessed. No existing file is modified.

---

## 1. Exact Documented Workload

**Workload type:** Non-PII connection-risk heuristic assessment.

**Input contract** (defined in `docs/smoke-test-nosana.md` and implemented
in `smoke-tests/nosana/schema-validator.mjs`):

```jsonc
{
  "correlationId":              "string (non-empty, synthetic)",
  "origin":                     "AAA",
  "connectionAirport":          "BBB",
  "destination":                "CCC",
  "connectionDurationMinutes":  75,
  "staticHistoricalDatasetVersion": "synthetic-demo-v0",
  "syntheticDemo":              true,
  "nonPiiDeclaration":          true
}
```

**Fixture to submit:** `nos-req-clean-two-leg` from
`smoke-tests/nosana/fixtures/req-nos-clean-two-leg.json`. This is the only
fixture mapped to the primary test path (NOS-01 through NOS-04, NOS-08,
NOS-10).

**Expected output contract** (defined in `docs/smoke-test-nosana.md` and
validated by `smoke-tests/nosana/schema-validator.mjs`):

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

**Test ID:** NOS-LIVE-01 (as defined in
`docs/stitchcheck-live-service-demo-preflight.md`).

**Coverage:** NOS-01, NOS-02, NOS-03, NOS-04, NOS-08, NOS-10 from
`docs/smoke-test-nosana.md`.

---

## 2. Required Environment

| Requirement | Status | Detail |
|---|---|---|
| Nosana program/API access | **NOT CONFIRMED** | Must be confirmed via official Nosana documentation (https://learn.nosana.com/) before execution |
| Environment (testnet vs mainnet) | **NOT SPECIFIED** | `docs/stitchcheck-live-service-demo-preflight.md` placeholder is blank; testnet/non-production is mandatory |
| Workload image/definition deployed | **NOT DEPLOYED** | The risk-assessment workload must be designed, reviewed, and deployed to the Nosana environment before execution |
| Solana wallet or compute prerequisites | **NOT PROVISIONED** | Any wallet or quota prerequisites required by Nosana must be provisioned separately |
| Node.js runtime (for harness scripts) | Available | `smoke-tests/nosana/` scripts use plain Node.js with zero dependencies |

**All five requirements above must be satisfied before any live execution
can proceed. None are satisfied today.**

---

## 3. Required Credential

| Credential Name | Location | Status |
|---|---|---|
| `NOSANA_API_KEY` (or equivalent Nosana auth credential) | `.env.local` only (never in source, fixtures, results, or docs) | **NOT PROVISIONED — NOT PRESENT IN `.env.example`** |

**Notes:**

- The current `.env.example` contains only `OPENROUTER_API_KEY` and
  `GEMINI_API_KEY`. No Nosana credential key exists.
- The credential name must be added to `.env.example` (with an empty value)
  before live execution, following the secret-safety format established for
  other keys.
- The credential value must never appear in any documentation file, evidence
  artifact, log, screenshot, or commit.
- The credential must be confirmed as non-production / testnet-scoped.

---

## 4. Expected Cost and Verifiability

| Item | Detail |
|---|---|
| Cost per Nosana workload | **UNKNOWN** — Nosana pricing for a minimum workload has not been confirmed or documented |
| Billing account | **NOT SPECIFIED** — no billing account has been identified or approved |
| Cost verifiable before submission? | **NO** — there is currently no way to estimate or verify the cost of a single Nosana workload before submitting it |
| Hard cost ceiling | **US$10.00** — if the cost of the single workload cannot be estimated, or if the estimate equals or exceeds US$10.00, execution must not proceed |

**Hard stop: if the cost is unclear or exceeds US$10.00, do not execute.**
This is a non-negotiable gate per the preflight stop conditions in
`docs/stitchcheck-live-service-demo-preflight.md`.

---

## 5. One-Call / One-Job Limit

| Constraint | Value | Source |
|---|---|---|
| Maximum workload submissions | **1** | `docs/stitchcheck-live-service-demo-preflight.md` (NOS-LIVE-01) |
| Maximum request attempts (client-level) | **1** | `nosana-client.mjs` `SAFETY_LIMITS.maxRequestAttempts = 1` |
| Maximum retries | **0** | `nosana-client.mjs` `SAFETY_LIMITS.maxRetries = 0` |
| Envelope size limit | **1 MB** | `nosana-client.mjs` `SAFETY_LIMITS.maxEnvelopeBytes = 1048576` |

Only one workload may be submitted. No retry is permitted. A second attempt
is blocked by the client-level request-limit guard.

---

## 6. Timeout and Stop Behavior

| Parameter | Value | Source |
|---|---|---|
| Request timeout | **60 000 ms** (60 seconds) | `nosana-client.mjs` `SAFETY_LIMITS.requestTimeoutMs` |
| Timeout is hard-bounded | Yes — `Math.min(config.timeoutMs, 60000)` | Client enforces ceiling |
| Retry on timeout | **No** — `maxRetries = 0` | No automatic retry |
| Behavior on timeout | `workloadStatus: "timeout"`, `riskBand: "unavailable"`, `riskScore: null` | Schema contract |
| Behavior on error | `workloadStatus: "error"`, `riskBand: "unavailable"`, `riskScore: null` | Schema contract — no invented score |
| Abort on cost uncertainty | **Immediate** | Hard stop condition |

**Stop conditions (any one triggers immediate abort):**

1. Cost is unclear or ≥ US$10.00.
2. Environment is not confirmed testnet/non-production.
3. Nosana program access is not confirmed.
4. Workload image/definition is not deployed.
5. Required credential is missing or over-permissioned.
6. Input cannot be proven PII-free before submission.
7. Any provider response would expose secrets, PII, or private data.

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

**Explicitly prohibited from capture:**

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

- Nosana can execute a minimum-cost, non-PII, synthetic risk-assessment
  workload on a testnet/non-production environment.
- The workload returns a structured, app-consumable result matching the
  expected contract schema.
- Status transitions (queued → running → completed or equivalent) are
  observable and can be displayed in the StitchCheck UI.
- A job or service reference is returned and can be shown in the UI.
- No PII is required or transmitted.
- Nosana has an essential, visible, app-consumed role in the P0 flow.

**Does not prove:**

- Nosana is production-ready or deployed to mainnet.
- The risk assessment is accurate, reliable, or based on real-world data.
- Nosana can handle production-scale workloads or concurrent requests.
- The integration works with real itineraries, real PII-containing data, or
  real booking contexts.
- Nosana pricing, availability, or SLA is suitable for production use.
- Any other provider (Gemini, Atlas) integration works.

### If NOS-LIVE-01 fails:

- Do not claim a Nosana integration works.
- Record the precise failure mode and latency.
- Do not replace Nosana with a decorative or unused integration.
- Reassess P0 only if an alternative Nosana workload/service design still
  has an essential, visible, app-consumed role.
- Update `docs/PRD.md`, `docs/UAT.md`, and `docs/SPECS.md` before altering
  P0 scope.

---

## 9. Hard Stop Conditions

**Execution must not proceed if any of the following is true:**

| # | Condition | Rationale |
|---|---|---|
| 1 | Cost of the single workload is unclear or cannot be estimated | Financial safety gate |
| 2 | Estimated or confirmed cost ≥ US$10.00 | Hard ceiling per organizer approval |
| 3 | No billing account has been explicitly approved | Financial governance |
| 4 | Environment is not confirmed testnet/non-production | Production safety |
| 5 | Nosana program access is not confirmed | Prerequisite gate |
| 6 | Workload image/definition is not deployed | Prerequisite gate |
| 7 | Required credential (`NOSANA_API_KEY` or equivalent) is not provisioned in `.env.local` | Prerequisite gate |
| 8 | Credential has broader permissions than required | Least-privilege safety |
| 9 | Input cannot be proven PII-free before submission | Data safety |
| 10 | Any provider response would expose secrets, PII, or private data | Data safety |

**All ten conditions must be verified as false before NOS-LIVE-01 may
execute. If any condition is true, stop immediately.**

---

## 10. Current Truth

The following statements are true as of the creation of this document:

- No Nosana call, job submission, deployment, credential access, or network
  request has been made.
- No Nosana credential exists in `.env.example` or `.env.local`.
- The Nosana environment, job type, cost, and billing account are all
  unspecified.
- The workload image/definition has not been designed, reviewed, or deployed
  to any Nosana environment.
- All fixtures in `smoke-tests/nosana/` are local-only synthetic
  placeholders and are not Nosana evidence.
- The offline harness (`schema-validator.mjs`, `workload-skeleton.mjs`,
  `nosana-client.mjs`) has been validated locally with zero network access.
- This preflight document is a preparation artifact only.

---

## 11. Preflight Verification Checklist

Before executing NOS-LIVE-01, all checkboxes must be marked:

- [ ] Nosana program access confirmed via official documentation.
- [ ] Environment confirmed as testnet/non-production.
- [ ] Workload image/definition deployed and reviewed.
- [ ] Solana wallet or compute prerequisites provisioned.
- [ ] Credential (`NOSANA_API_KEY` or equivalent) provisioned in `.env.local` only.
- [ ] Credential confirmed as non-production / testnet-scoped.
- [ ] Credential added to `.env.example` with empty value (secret-safety format).
- [ ] Cost of single workload estimated and confirmed < US$10.00.
- [ ] Billing account explicitly approved by organizer.
- [ ] Input fixture inspected and proven PII-free.
- [ ] All preflight stop conditions verified as false.
- [ ] Evidence capture rules understood and will be followed.
- [ ] Human organizer has explicitly approved NOS-LIVE-01 execution.

**No test may proceed until all checkboxes above are marked.**

---

## Changed-Files Verification

| File | Action |
|---|---|
| `docs/stitchcheck-nosana-live-preflight.md` | **CREATED** |
| All other files | **UNCHANGED** |
