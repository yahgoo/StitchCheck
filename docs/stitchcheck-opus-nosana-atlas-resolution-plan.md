# StitchCheck — Nosana & Atlas Resolution Plan

> **Status**: PLANNING DOCUMENT — no implementation, no external writes
> **Date**: 2026-08-21
> **Author**: Senior Integration Architect
> **Scope**: Diagnostic investigation and bounded implementation plan for Nosana live workload and Atlas Sandbox booking/ticketing path.
> **Constraint**: No source code was modified. No external write, deployment, booking, payment, ticketing, cancellation, refund, or order was performed. No credential value was accessed or exposed. `.env.local` was not read. No package was installed.

---

## 1. Executive Recommendation

**Nosana: NO-GO for immediate execution.** The integration path is now fully documented by official Nosana documentation (REST API + TypeScript SDK via `@nosana/kit`, Deployment resource type, credit-based billing). However, critical prerequisites remain unmet: no API key has been provisioned, no credit balance exists, no container image for risk computation has been built, and no market has been selected. The path from here to a working one-shot workload is approximately 2–4 hours of human-gated work, and should only proceed if the organizer explicitly approves spend.

**Atlas: CONDITIONAL GO for Sandbox search-only testing.** The Atlas Flight Booking Skill is installed, authorization succeeded, and one production search returned five real offers. The `TICKETING_ACTIVATION_REQUIRED` blocker prevents any booking/payment/ticketing — this is an account-level activation that must be performed by a human in the ATRIP workspace. Sandbox search can be tested independently of ticketing activation by switching the CLI environment. For the hackathon, a verified Sandbox search-verify flow is the realistic maximum; full booking/ticketing requires ATRIP support action that may not complete before the deadline.

**For the 22 Aug build day:** Protect Track 1 (Gemini/OpenRouter extraction, human confirmation, Atlas read-only search, existing offline tests, demo recording). Attempt Track 2 only if prerequisites are confirmed with zero guessing. Defer all production booking/payment/ticketing and unverified Nosana deployments.

---

## 2. Current Evidence and Boundaries

### Evidence Labels (exact, non-negotiable)

| Label | Scope |
|---|---|
| `OpenRouter temporary path — not direct Gemini validation` | GEM-01 result via OpenRouter; not transferable to Gemini API |
| `Synthetic local placeholder — not Nosana evidence` | All `smoke-tests/nosana/` artifacts |
| `Synthetic local placeholder — not Atlas Sandbox evidence` | All `smoke-tests/atlas/` artifacts |
| `Atlas production search — reference prices only` | 5 real offers returned; all `bookable: false`, `price_status: reference` |
| `TICKETING_ACTIVATION_REQUIRED — provider/account activation blocker` | ATRIP workspace action required before any offer becomes bookable |
| `Offline VCC/318 guard — not live booking proof` | 48 offline tests passed; no live Atlas response used |

### Provider Status Summary

| Provider | Live Evidence | Offline Evidence | Blocker |
|---|---|---|---|
| Gemini (direct) | Not executed | 92 offline tests pass | SDK review, credential, one-request authorization pending |
| OpenRouter | GEM-01 executed (temporary path) | — | Temporary path only; not Gemini validation |
| Atlas | Auth succeeded; 1 production search (5 offers, reference-only) | 89 adapter tests + 48 guard tests pass | `TICKETING_ACTIVATION_REQUIRED`; Sandbox not switched |
| Nosana | Blocked before any network request (NOS-ATTEMPT-001) | 75 client tests pass; schema validators pass | No API key, no credits, no container image, no deployment |

---

## 3. Nosana Architecture and Minimum Viable Workload

### 3.1 What Nosana resource should StitchCheck use?

**Answer: Deployment** (with a SIMPLE strategy, 1 replica).

**Justification:**
- Per official Nosana documentation (`learn.nosana.com/api/create-deployments.html`), a **Deployment** is the primary abstraction for running container workloads via the API or SDK.
- Deployments wrap a **Job Definition** (the container image, commands, and ops).
- The alternative — posting a raw **Job** via `nosana job post` or `client.api.jobs.list()` — is a lower-level primitive documented in the "Your First Job" guide. Both paths are valid; for a hackathon one-shot workload, either would work.
- The Deployment path provides: named resource, draft-then-start lifecycle, stop/archive capability, and management via dashboard or API.
- **Recommended approach:** Use the HTTP API directly (`POST /deployments`) rather than the SDK, to minimize dependencies. The SDK (`@nosana/kit`) is the alternative if a Node.js environment is preferred.

### 3.2 Exact intended workload

| Parameter | Value |
|---|---|
| **Input** | Non-PII synthetic route/connection parameters from `smoke-tests/nosana/fixtures/req-nos-clean-two-leg.json`: origin `AAA`, connection `BBB`, destination `CCC`, 75-minute connection, synthetic dataset `synthetic-demo-v0` |
| **Output** | Structured JSON risk metrics: `correlationId`, `workloadStatus`, `riskBand` (low/medium/high/unavailable), `riskScore` (0–1 or null), `heuristicDisclaimer`, `failureCascadeExplanation` |
| **Maximum runtime** | 60 seconds (hard-bounded by `SAFETY_LIMITS.requestTimeoutMs` in `nosana-client.mjs`) |
| **Maximum batch size** | 1 request (single workload submission; `maxRequestAttempts = 1`) |
| **Termination condition** | Workload completes, times out at 60s, or errors. No retry. |
| **Envelope size limit** | 1 MB |

### 3.3 What must be defined before submission?

| Prerequisite | Status | Detail |
|---|---|---|
| **Container image** | NOT BUILT | A Docker image that accepts the input JSON (stdin or env), runs a risk heuristic (e.g., Python script using the synthetic dataset), and outputs the result JSON to stdout or `/nosana/outputs/`. Simplest viable: `ubuntu` or `python:3.12-slim` with an embedded script. |
| **Command** | NOT DEFINED | e.g., `python /app/risk_heuristic.py` or a shell script that reads input and echoes a JSON result. |
| **Input format** | DEFINED | JSON per `req-nos-clean-two-leg.json` contract in `smoke-tests/nosana/schema-validator.mjs`. |
| **Output format** | DEFINED | JSON per result contract in `smoke-tests/nosana/schema-validator.mjs`. |
| **Resource requirements** | NOT SELECTED | A GPU market must be selected. For this workload (no ML inference, just numerical heuristic), the cheapest market is sufficient: NVIDIA 3060 at ~$0.048/hr. GPU is not strictly required for a simple heuristic but Nosana markets are GPU-based. |
| **Environment variables** | NONE REQUIRED | The workload uses no secrets. Input is passed via the job definition. |
| **Network requirements** | NONE | The container does not need outbound network access. |
| **Authentication** | NOT PROVISIONED | Requires a Nosana API key (`NOSANA_API_KEY`), obtained from the Nosana dashboard at `dashboard.k8s.prd.nos.ci`. |
| **Wallet/credits** | NOT PROVISIONED | Requires credits in the Nosana account. Free credits may be available via `client.api.credits.checkEligibility()` or `client.api.credits.request()`. Alternatively, credits can be purchased. |
| **Result retrieval** | DOCUMENTED | After job completion, results are retrievable via `client.api.jobs.get(jobAddress)` or the deployment status endpoint. |
| **Cleanup** | DOCUMENTED | Stop deployment via `deployment.stop()` or `POST /deployments/{id}/stop`. Archive via `deployment.archive()`. |

### 3.4 Which requirements are documented vs. unknown?

| Documented by Nosana | Still Unknown |
|---|---|
| Deployment lifecycle: create → draft → start → running → completed/stopped | Exact credit cost for a 60-second job on a 3060 market |
| API authentication: Bearer token with `NOSANA_API_KEY` | Whether free credits are available for new accounts |
| Base URL: `https://deployment-manager.k8s.prd.nos.ci` for deployments, `https://dashboard.k8s.prd.nos.ci/api` as general API base | Whether the Nosana API key can be generated without Solana wallet setup |
| Job definition schema: version `0.1`, type `container`, ops array with `container/run` | Whether a non-GPU workload can run on a GPU market (likely yes — GPU is optional in args) |
| SDK: `@nosana/kit` with `createNosanaClient(NosanaNetwork.MAINNET, { api: { apiKey } })` | Whether testnet/devnet exists for zero-cost testing |
| Credit balance check: `client.api.credits.balance()` | Docker image registry requirements (public Docker Hub likely works) |
| Market listing: `client.api.markets.list()` and pricing via `client.api.markets.getPrices()` | Whether IPFS upload is required for API-triggered deployments |
| Job definition validation: `validateJobDefinition()` from SDK | — |

### 3.5 Official API/Dashboard/SDK path

| Method | Path | Source |
|---|---|---|
| **REST API** | `POST https://deployment-manager.k8s.prd.nos.ci/deployments` | `learn.nosana.com/api/create-deployments.html` |
| **Start** | `POST /deployments/{id}/start` | Same page |
| **Get** | `GET /deployments/{id}` | `learn.nosana.com/api/manage-deployments.html` |
| **Stop** | `POST /deployments/{id}/stop` | Same page |
| **Auth header** | `Authorization: Bearer $NOSANA_API_KEY` | `learn.nosana.com/api/intro.html` |
| **SDK** | `npm install @nosana/kit` → `createNosanaClient()` | Same page |
| **Dashboard** | `https://dashboard.k8s.prd.nos.ci` | Referenced in docs |
| **Credit balance** | `GET /api/credits/balance` | `learn.nosana.com/api/credits.html` |
| **Free credits** | `POST /api/credits/request` (if eligible) | Same page |
| **Markets** | `GET /api/markets` and `GET /api/markets/prices` | `learn.nosana.com/api/markets.html` |

### 3.6 Testnet, dry-run, or local validation

| Option | Status |
|---|---|
| **Testnet / devnet** | NOT DOCUMENTED in current Nosana API docs. The SDK references `NosanaNetwork.MAINNET` only. No testnet network constant was found. |
| **Dry-run** | NOT DOCUMENTED. No dry-run flag exists in the deployment or job APIs. |
| **Local validation** | AVAILABLE. `validateJobDefinition()` from `@nosana/kit` validates the job definition schema locally without making any network request. This should be used before any submission. |
| **Read-only inspection** | AVAILABLE. `client.api.credits.balance()`, `client.api.markets.list()`, and `client.api.markets.getPrices()` are read-only queries that do not create any resource or incur cost. |

**Recommendation:** Before any paid submission, perform local job definition validation and a read-only credit balance check.

### 3.7 How to verify expected cost

1. **Check market pricing:** `client.api.markets.getPrices()` returns current per-hour prices in USD.
2. **NVIDIA 3060 pricing:** Approximately $0.048/hr based on Nosana's published pricing page.
3. **For a 60-second workload:** Cost ≈ $0.048 × (60/3600) = **$0.0008** (less than 1 cent).
4. **Credit consumption:** The `jobs.list()` response includes `credits.creditsUsed` to show actual consumption.
5. **Pre-flight balance check:** `client.api.credits.balance()` returns `assignedCredits`, `reservedCredits`, `settledCredits`.
6. **Hard ceiling:** US$10.00 per existing preflight rules. A single 60-second 3060 job is far below this.

### 3.8 How to prove execution

| Evidence | Source |
|---|---|
| **Deployment ID** | Returned by `POST /deployments` in the response `id` field |
| **Job address** | Returned by job posting or derivable from deployment status |
| **Timestamp** | ISO 8601 from deployment `created_at` / job start time |
| **Status** | Deployment/job status field: `draft`, `running`, `completed`, `stopped`, `failed` |
| **Node/execution details** | Job result may contain node information (if exposed by the API) |
| **Input/output hash** | SHA-256 of the input fixture and the sanitized output result |
| **UI evidence** | Screenshot of the Nosana dashboard showing deployment status, or the StitchCheck UI displaying the returned risk score |
| **Credit consumption** | `creditsUsed` from the job response |

### 3.9 Safe acceptance test (no PII)

**Test ID:** NOS-LIVE-01

| Step | Detail |
|---|---|
| 1 | Validate job definition locally with `validateJobDefinition()` |
| 2 | Check credit balance with `credits.balance()` |
| 3 | Create deployment with the risk-heuristic container image, NVIDIA 3060 market, 60s timeout, 1 replica, SIMPLE strategy |
| 4 | Start deployment |
| 5 | Wait for completion (poll deployment status, max 60s) |
| 6 | Retrieve result and validate against the schema contract |
| 7 | Record: deployment ID, timestamp, status, `creditsUsed`, sanitized result summary |
| 8 | Stop and archive the deployment |
| 9 | Verify: no PII in input or output, `correlationId` matches, `heuristicDisclaimer` contains "heuristic", `riskBand` is valid enum, `riskScore` is null or 0–1 |

**Input:** `req-nos-clean-two-leg.json` fixture (synthetic airports AAA/BBB/CCC, no PII).
**Pass criteria:** Deployment completes, result matches schema, no PII transmitted, cost < $10.

### 3.10 Go/No-Go Decision

| Gate | Status | Verdict |
|---|---|---|
| Workload defined | Partial — input/output contracts exist, container image NOT BUILT | **NO-GO** |
| Transport documented | YES — REST API + SDK path fully documented | Pass |
| Credentials provisioned | NO — no API key exists | **NO-GO** |
| Cost verifiable | YES — pricing is published; estimated < $0.01 for 60s on 3060 | Pass |
| Credit balance sufficient | UNKNOWN — no account exists | **NO-GO** |
| Result retrieval path known | YES — via deployment/job API | Pass |
| Testnet available | NOT CONFIRMED — no testnet documented | Warning |
| Human approval for spend | NOT GRANTED | **NO-GO** |

**Overall: NO-GO.** Four critical gates are unmet. The Nosana integration path is fully understood but requires human action to provision credentials, obtain credits, build the container image, and approve spend before execution.

### Nosana Step-by-Step Execution Plan (NOT EXECUTED)

1. **Human: Create Nosana account** at `dashboard.k8s.prd.nos.ci`.
2. **Human: Generate API key** and store as `NOSANA_API_KEY` in `.env.local`.
3. **Human: Obtain credits** — check free-credit eligibility, claim if available, or purchase.
4. **Agent: Read-only credit balance check** — `GET /api/credits/balance`.
5. **Agent: Read-only market listing** — `GET /api/markets` to confirm 3060 market address.
6. **Agent: Build container image** — minimal Python/shell script that reads input JSON, computes a synthetic risk heuristic, outputs result JSON. Push to Docker Hub (public repo).
7. **Agent: Validate job definition locally** — `validateJobDefinition()` with the exact job definition.
8. **Human: Review and approve** the job definition, cost estimate, and one-attempt authorization.
9. **Agent: Create deployment** — `POST /deployments` with approved job definition.
10. **Agent: Start deployment** — `POST /deployments/{id}/start`.
11. **Agent: Poll status** — `GET /deployments/{id}` until completed, max 60s.
12. **Agent: Retrieve and validate result** — check schema, sanitize, record evidence.
13. **Agent: Stop and archive deployment** — cleanup.
14. **Agent: Update evidence index** — record NOS-LIVE-01 pass/fail with sanitized summary.

---

## 4. Nosana Unknowns and Go/No-Go Gate

### Critical Unknowns

1. **No testnet exists** in current documentation. All workloads run on mainnet with real credits.
2. **Free credit eligibility** is unknown until an account is created and `credits.checkEligibility()` is called.
3. **Docker image registry** requirements — public Docker Hub images are likely supported (examples use `ubuntu`, `docker.io/nosana/pytorch-jupyter`), but private registries require authentication configuration.
4. **IPFS upload** — the "Your First Job" guide mentions IPFS for job definitions posted via CLI/SDK. It's unclear whether API-triggered deployments also require IPFS upload or handle it internally.
5. **Result retrieval format** — the exact structure of completed job results beyond what the deployment status API returns.

### Go/No-Go Gate

**Current verdict: NO-GO.**

Execution may proceed to GO only when ALL of the following are true:
- [ ] Nosana API key provisioned in `.env.local`
- [ ] Credit balance confirmed > 0
- [ ] Container image built, tested locally, and pushed to registry
- [ ] Job definition validated locally with `validateJobDefinition()`
- [ ] Cost estimate confirmed < US$10.00
- [ ] Human has explicitly approved the one-attempt execution and spend
- [ ] Market address confirmed via read-only API call

---

## 5. Atlas Environment and Lifecycle Diagnosis

### 5.1 Current Atlas environment

**Production.** The Skill was authorized in the default production environment. No environment switch has been executed. The command `atlas-flight environment use sandbox --json` has NOT been run.

### 5.2 Current endpoints

| Operation | Integration Path | Status |
|---|---|---|
| **Search** | Atlas Flight Booking Skill → `atlas-flight search` CLI command → Atlas production API | **Working** — returned 5 real offers |
| **Verify** | Skill → `atlas-flight verify` (or equivalent) | **Not attempted** |
| **Order** | Skill → order creation tool | **Not attempted** — blocked by `TICKETING_ACTIVATION_REQUIRED` |
| **Payment** | Skill → payment confirmation tool | **Not attempted** |
| **Ticketing** | Skill → ticketing poll | **Not attempted** |
| **Order retrieval** | Skill → order query tool | **Not attempted** |

The Skill abstracts the underlying ATRIP API endpoints. StitchCheck does not call Atlas REST endpoints directly — the Skill and CLI handle all API communication, including authentication, endpoint routing, and response normalization.

**Direct API path (not currently used):**
- Sandbox base URL: `https://sandbox.atriptech.com/`
- Production uses separate base URLs for search vs. transaction APIs, obtained from ATRIP → My Profile → Company Information.
- Headers: `x-atlas-client-id`, `x-atlas-client-secret`, `Content-Type: application/json`, `Accept: */*`, `Accept-Encoding: gzip`.

### 5.3 Integration method

**Atlas Flight Booking Skill** — not direct ATRIP API. The Skill was installed via:
```
npx --yes skills add https://github.com/atlas-doc/atlas-flight-booking-skill --skill atlas-flight-booking
```
The companion `atlas-flight` CLI (version `atlas-flight-booking==0.3.12`) was auto-provisioned. Authorization completed via browser-based ATRIP sign-in. Credentials are stored by the CLI in the OS secure credential facility.

### 5.4 Sandbox credentials

The Skill's CLI manages credentials via the OS secure credential facility. No `x-atlas-client-id` or `x-atlas-client-secret` is stored in `.env.local` or any project file — this is by design (the Skill handles auth, not the application).

**For direct API access (alternative path):** Sandbox credentials would be generated from ATRIP → Profile → My Profile → Company Information → Sandbox Info. This has NOT been done, and is not required if using the Skill.

### 5.5 Currency inclusion

Per the Atlas quick-start documentation:
> "首次接入时，Atlas 中可能尚未配置结算币种。在沙箱环境下，在账户设置完成前，请在 Search 请求中手动添加 `"currency":"USD"`。"

Translation: When first connecting, Atlas may not have configured a settlement currency. In the Sandbox environment, before account setup is complete, manually add `"currency":"USD"` to Search requests.

**Status:** Unknown whether the Skill automatically includes currency. If Sandbox searches fail or return unexpected results, adding `--currency USD` or equivalent to the search command may be required.

### 5.6 Identifier preservation

Per the quick-start documentation, the following identifiers must be preserved across the booking flow:
- `routingIdentifier` — from search
- `sessionId` — from verification
- `orderNo` — from order creation
- `OfferId` — if using the Get Offer path

**Status:** The Skill and CLI handle identifier preservation internally. The StitchCheck smoke-test adapter (`read-only-atlas-adapter.mjs`) does not participate in the booking flow and only handles search.

### 5.7 Where the flow stops

**The flow stops at search.** One production search succeeded. No verify, order, payment, or ticketing has been attempted. The `bookable: false` status on all returned offers prevents any downstream operation.

### 5.8 What causes TICKETING_ACTIVATION_REQUIRED

All 5 returned offers carry `price_status: reference` and `bookable: false`. Per `docs/stitchcheck-atlas-live-disclosure.md`:

> "The ATRIP workspace has not yet activated ticketing for the account or application. Until ticketing activation is completed by a human at the ATRIP workspace, no offer can progress from reference price to a bookable fare."

This is an **account-level activation requirement**, not a per-request or per-offer issue. It affects all offers returned by this account until activation is completed.

### 5.9 Is this consistent with a provider/account activation requirement?

**Yes.** The Atlas quick-start lifecycle is:
1. Sandbox access → Generate credentials.
2. Sandbox development → Build and test booking flow.
3. UAT validation → Complete required UAT flows.
4. Production go-live → Account switched to LIVE by account manager.

`TICKETING_ACTIVATION_REQUIRED` is consistent with **Step 3/4 not being completed.** The account has Sandbox/production API access for search, but ticketing capability has not been activated. This is distinct from:
- Wrong endpoint (search works, so the endpoint is correct).
- Missing credentials (auth succeeded).
- VCC/318 (this is a duplicate-booking guard, not an activation blocker).

### 5.10 Does the VCC/318 guard run before external writes?

**Yes.** The duplicate-booking guard (`smoke-tests/atlas/duplicate-booking-guard.mjs`) is an offline-only state machine that:
- Runs entirely locally with no network code.
- Prevents blind retry after a 318 (duplicate booking) response.
- Requires explicit user confirmation before any attempt.
- Requires a different candidate fingerprint for retries.
- Has been validated with 48 offline tests.

**The guard does NOT cause `TICKETING_ACTIVATION_REQUIRED`.** These are independent issues:
- VCC/318 guard: Prevents the application from making duplicate booking attempts.
- `TICKETING_ACTIVATION_REQUIRED`: Prevents the Atlas account from progressing any offer to bookable status.

The guard would only become relevant after ticketing activation is complete and the application attempts to create orders.

### 5.11 Does the guard leave the provider-side activation issue unchanged?

**Yes.** The VCC/318 guard is a client-side safeguard. It has no effect on the provider-side `TICKETING_ACTIVATION_REQUIRED` status. Resolving the activation blocker requires human action in the ATRIP workspace, completely independent of the guard.

### 5.12 What can be tested safely in Sandbox?

| Test | Safety | Prerequisite |
|---|---|---|
| Switch to Sandbox environment | Safe — local CLI config change only | `atlas-flight environment use sandbox --json` |
| Sandbox search | Safe — read-only | Environment switched to Sandbox |
| Sandbox verify (price check) | Safe — read-only price verification | Sandbox search completed, offer selected |
| Sandbox order creation | **WRITE** — creates a test order | **Requires explicit human confirmation immediately before** |
| Sandbox payment | **WRITE** — processes test payment | **Requires explicit human confirmation immediately before** |
| Sandbox ticketing poll | Read-only status check | Test order/payment completed |

**Important:** Even in Sandbox, order creation and payment are write operations that require explicit human confirmation per the safety rules.

### 5.13 What requires ATRIP/Atlas support?

| Action | Owner |
|---|---|
| Activate ticketing for the account | ATRIP workspace admin (human) |
| Switch account to LIVE status | Atlas account manager |
| Complete UAT validation | ATRIP → UAT Testing interface |
| Resolve settlement currency configuration | ATRIP account settings |

### 5.14 Minimum Sandbox evidence for the hackathon

For the **Alibaba Cloud x Atlas Agentic AI Hackathon** (deadline 30 Aug 2026):

| Tier | Evidence | Sufficient? |
|---|---|---|
| **Minimum** | Sandbox search returns structured alternatives | Demonstrates Atlas integration with real data; sufficient for "search works" claim |
| **Better** | Sandbox search + verify (price confirmation) | Demonstrates deeper integration; still read-only |
| **Ideal** | Sandbox search + verify + order (with human confirmation) | Demonstrates full forward booking flow in test environment |
| **Full** | Sandbox search + verify + order + payment + ticketing | Complete end-to-end; requires ticketing activation |

**Recommendation:** Target **Minimum or Better** tier. Sandbox search alone is demonstrable and safe. Verify adds value with no additional risk. Order creation requires human confirmation and careful handling.

### 5.15 Is live production ticketing required?

**No.** The hackathon brief states: "Use Atlas Sandbox only" and "Do not use production Atlas credentials, real bookings, real payments, or real personal data."

A verified Sandbox search flow is sufficient for the hackathon. The existing production search evidence (5 real reference-price offers) already demonstrates that Atlas authentication and search work in production. Sandbox search would demonstrate the same in the test environment.

**Live production ticketing is explicitly NOT required and NOT recommended for the hackathon.**

---

## 6. Atlas Skill Review

### Source: `https://github.com/atlas-doc/atlas-flight-booking-skill`

### 6.1 Installation and configuration

```bash
npx --yes skills add https://github.com/atlas-doc/atlas-flight-booking-skill --skill atlas-flight-booking
```

The Skill auto-provisions the `atlas-flight` CLI via `uv tool install --force --python 3.12 atlas-flight-booking==0.3.12`. No separate Python environment is required. No manual pip install is needed.

### 6.2 Required environment variables

None stored in `.env.local`. The CLI uses the OS secure credential facility for authorization tokens. Authorization is completed via a browser-based ATRIP sign-in flow, not via environment variables.

### 6.3 Read-only tools

| Tool/Operation | Read-Only? |
|---|---|
| Search (`atlas-flight search`) | **Yes** — read-only |
| Environment check (`atlas-flight environment`) | **Yes** — read-only |
| Authorization status check | **Yes** — read-only |
| Order query (post-booking) | **Yes** — read-only |

### 6.4 Tools that create or modify external state

| Tool/Operation | Creates State? |
|---|---|
| Authorization (browser sign-in) | Creates auth tokens locally; grants access |
| Verify (fare verification) | **Read-only** — checks current price |
| Order creation | **YES — creates an order** |
| Payment confirmation | **YES — processes payment** |
| Ticketing poll | Read-only status check |
| Environment switch | Local config change only |

### 6.5 Tool-to-Atlas-operation mapping

| StitchCheck Need | Atlas Skill Tool | Atlas API Operation | Read/Write |
|---|---|---|---|
| Search for alternatives | `atlas-flight search` | Shopping/FlightSearch | Read |
| Verify price | Verify tool | Verification | Read |
| Create booking/order | Order creation tool | OrderCreation | **Write** |
| Process payment | Payment confirmation | Payment | **Write** |
| Issue ticket | Ticketing poll | Ticketing follow-up | Read (polling) |
| Check order status | Order query | OrderQuery | Read |
| Cancel/refund | **Not implemented** in current Skill version | — | — |

The Skill README explicitly states: "This release does not implement refunds, cancellations, changes, credit-card payment, or other after-sales operations."

### 6.6 Sandbox default

**No — the Skill defaults to production.** From the README:
> "Atlas Flight Booking uses production services by default. Production is the right place to search live fares and make real purchase decisions."

Switching to Sandbox requires an explicit command: `atlas-flight environment use sandbox --json`.

### 6.7 Environment switching

```bash
# Switch to Sandbox
atlas-flight environment use sandbox --json

# Switch back to production
atlas-flight environment use production --json
```

After switching:
- The same Skill and commands continue to work.
- Any offer obtained before the switch expires.
- A new search must be started.
- Sandbox prices are test data and must not be used for purchase decisions.

### 6.8 Request tracing / raw response capture

The Skill and CLI normalize all output into a stable JSON envelope. From the README:
> "All subcommands return one stable JSON envelope. Agents branch on the response `code`, preserve opaque IDs exactly, and never inspect credentials or internal routing."

Raw Atlas API responses are not exposed to the agent or application. The CLI handles all normalization internally.

### 6.9 Error pass-through

Errors are normalized by the CLI. The response `code` field indicates success or failure type. The Skill does not expose raw HTTP status codes or Atlas error codes directly — they are translated into the normalized envelope format.

### 6.10 VCC/318 protection

**VCC/318 protection is provided by StitchCheck, NOT by the Atlas Skill.**

The Skill provides safety boundaries for payment (single-use confirmation, price-change re-confirmation) but does not implement a duplicate-booking guard. The duplicate-booking protection state machine is in `smoke-tests/atlas/duplicate-booking-guard.mjs` and is a StitchCheck component.

### 6.11 Mismatches between Skill docs and project code

| Aspect | Skill Documentation | Project Code | Mismatch? |
|---|---|---|---|
| Auth method | Browser-based ATRIP sign-in via Skill | Project previously attempted direct OAuth (`/oauth/token`) which returned 404 | **Resolved** — project now uses the Skill |
| Credential storage | OS secure credential facility via CLI | `smoke-tests/atlas/read-only-atlas-adapter.mjs` references `ATLAS_CLIENT_ID`, `ATLAS_CLIENT_SECRET`, and direct OAuth | **Stale** — the adapter was built before the Skill was adopted; the Skill is now the authoritative path |
| Default environment | Production | `read-only-atlas-adapter.mjs` assumes Sandbox-only | **Mismatch** — the Skill defaults to production; the adapter's `sandboxOnly: true` flag is irrelevant when using the Skill |
| Cancellation/refund | Not implemented in current Skill | Not referenced in project code | No mismatch |

---

## 7. VCC/318 vs. TICKETING_ACTIVATION_REQUIRED

These are **two completely independent issues**:

| Aspect | VCC/318 Duplicate-Booking Guard | TICKETING_ACTIVATION_REQUIRED |
|---|---|---|
| **What it is** | Client-side state machine preventing blind retry after Atlas response code 318 (existing booking) | Account-level activation requirement at the ATRIP workspace |
| **Where it lives** | `smoke-tests/atlas/duplicate-booking-guard.mjs` (StitchCheck code) | Atlas/ATRIP backend |
| **When it triggers** | After an order creation attempt receives a 318 response | Before any offer can progress from `reference` to `bookable` |
| **Who resolves it** | The application (query existing order, then decide with human confirmation) | A human at the ATRIP workspace (activate ticketing) |
| **Current status** | 48 offline tests pass; never triggered against live Atlas | Active blocker on all 5 returned offers |
| **Effect on each other** | None — the guard cannot cause or resolve the activation requirement | None — the activation requirement has nothing to do with duplicate bookings |

**Bottom line:** `TICKETING_ACTIVATION_REQUIRED` is the root cause of all offers being non-bookable. VCC/318 is a separate safety mechanism that would only become relevant after ticketing activation is complete and order creation is attempted. They do not interact.

---

## 8. Sandbox-Only Verification Plan

### Prerequisites

1. `atlas-flight environment use sandbox --json` — switch to Sandbox.
2. Verify environment: "Please check my current Atlas authorization and ticketing status."
3. Start a **new search** — do not reuse production offers.

### Test Plan

| Test ID | Operation | Expected Outcome | Human Gate | Evidence |
|---|---|---|---|---|
| ATL-SBX-01 | Switch to Sandbox | Environment confirmed as Sandbox | No | CLI output showing environment name |
| ATL-SBX-02 | Sandbox search (e.g., KUL → SIN, 2026-09-15, 1 adult) | Structured offers returned with Sandbox data | No | Sanitized JSON result (no PII, no credentials) |
| ATL-SBX-03 | Verify an offer from ATL-SBX-02 | Price verification response (accept/price change) | No | Verification status |
| ATL-SBX-04 | (OPTIONAL) Create order with fictional passenger | Test order number returned | **YES — requires explicit human confirmation** | Order number (sanitized) |
| ATL-SBX-05 | Switch back to production | Environment confirmed as production | No | CLI output |

**Stop points:**
- ATL-SBX-01 through ATL-SBX-03 are safe and recommended.
- ATL-SBX-04 requires explicit human confirmation and should only be attempted if ATL-SBX-01–03 succeed.
- Use fictional passenger data ONLY: TEST/TRAVELER, Male, DOB 1990-01-01, Nationality JP, Passport TR0000001, Issuing country JP, Expiry 2032-12-31.
- If `TICKETING_ACTIVATION_REQUIRED` also affects Sandbox, stop and record the finding.

---

## 9. Tomorrow's Time-Boxed Plan (22 Aug 2026)

### Schedule (assuming 9:00 AM start, SGT)

| Time | Track | Activity | Stop Rule |
|---|---|---|---|
| **09:00–09:30** | Setup | Environment verification, `.env.local` confirmed, dev server starts, existing tests pass | If dev server fails to start, fix before proceeding |
| **09:30–10:30** | **Track 1** | Gemini/OpenRouter extraction demo rehearsal; human confirmation gate walkthrough; existing offline test suite re-run | If OpenRouter returns errors, use recorded evidence as fallback |
| **10:30–11:30** | **Track 1** | Atlas read-only search demo rehearsal (production search, showing reference prices and `bookable: false` status); record evidence | If search fails, use previously captured 5-offer evidence |
| **11:30–12:00** | **Track 1** | Evidence labels verified in UI; offline VCC/318 test suite re-run; demo recording dry run | — |
| **12:00–13:00** | Lunch + Plan Review | Review Track 2 prerequisites; go/no-go decision for Nosana and Atlas Sandbox attempts | — |
| **13:00–14:00** | **Track 2** (if GO) | Atlas Sandbox: switch environment, run one Sandbox search, verify one offer | If Sandbox switch fails or `TICKETING_ACTIVATION_REQUIRED` blocks Sandbox too, stop and record |
| **14:00–15:00** | **Track 2** (if GO) | Nosana: if credentials and credits confirmed, validate job definition locally, do one read-only balance check, prepare container image | If any prerequisite is missing, stop Nosana track |
| **15:00–16:00** | **Track 1** | Final demo recording; fallback recording with existing evidence | Must have a complete recording by 16:00 |
| **16:00–17:00** | Polish | Slides, README, submission assets | — |
| **17:00+** | Submit | Final submission assembly | — |

### Track 1 — Must Not Break

- [x] Gemini/OpenRouter extraction (working, labelled as temporary path)
- [x] Human itinerary confirmation gate (implemented, 39 acceptance items pass)
- [x] Atlas read-only search evidence (5 real production offers captured)
- [x] Clear evidence labels (all three exact labels visible in UI)
- [x] Existing offline VCC/318 tests (48 pass, 0 fail)
- [ ] Demo recording and fallback recording

### Track 2 — Attempt Only If Prerequisites Known

- [ ] One Atlas Sandbox search (requires: environment switch, active Sandbox auth)
- [ ] One Atlas Sandbox verify (requires: successful Sandbox search)
- [ ] One Nosana test workload (requires: API key, credits, container image, human approval)
- **Any order-creating write requires explicit human confirmation immediately before**

### Track 3 — Defer

- Production booking, payment, ticketing, cancellation, refund
- Any attempt to bypass `TICKETING_ACTIVATION_REQUIRED`
- Any guessed Nosana deployment, endpoint, or configuration
- Production Atlas writes of any kind
- Credit-card payment or real passenger data

---

## 10. Required Human Approvals

| Approval | Who | When | Blocking |
|---|---|---|---|
| Nosana account creation and API key generation | Human organizer | Before Nosana Track 2 | YES — no Nosana execution without this |
| Nosana credit acquisition or free-credit claim | Human organizer | Before Nosana Track 2 | YES — no deployment without credits |
| Nosana one-attempt execution authorization | Human organizer | Before NOS-LIVE-01 | YES — final gate |
| Atlas Sandbox environment switch | Human developer | Before ATL-SBX-01 | YES — local action |
| Atlas Sandbox order creation confirmation | Human developer | Before ATL-SBX-04 | YES — write operation |
| ATRIP ticketing activation | ATRIP workspace admin | Before any offer becomes bookable | YES — external dependency |
| Demo recording approval | Human organizer | Before final submission | YES |

---

## 11. Judge-Facing Claim-Safe Language

### Safe to say:

> "StitchCheck demonstrates multimodal itinerary extraction via the Gemini API through an OpenRouter temporary path, with results labelled accordingly. Direct Gemini API validation is planned but has not yet been completed."

> "Atlas authentication succeeded through the official Atlas Flight Booking Skill. A live read-only search returned five real production offers. All offers carry reference-price status due to pending ticketing activation at the ATRIP workspace."

> "The Nosana integration architecture is designed and documented. Offline contract tests pass (75 tests, 0 failures). Live Nosana execution has not yet occurred due to infrastructure prerequisites that are in progress."

> "The duplicate-booking protection state machine passes 48 offline tests. These tests validate the contract and state-machine logic with synthetic data. They are not live Atlas booking evidence."

### NOT safe to say:

- "Nosana runs our risk computation." (It does not — no live workload has executed.)
- "Atlas can book flights for the user." (It cannot — `TICKETING_ACTIVATION_REQUIRED` blocks all bookings.)
- "We use Gemini directly." (GEM-01 was via OpenRouter, not direct Gemini.)
- "The VCC/318 guard prevents real duplicate bookings." (It has only been tested offline.)

---

## 12. Exact Acceptance Criteria

### For Nosana (NOS-LIVE-01)

- [ ] Deployment creates successfully (deployment ID returned)
- [ ] Job completes within 60 seconds
- [ ] Result JSON matches schema contract
- [ ] `riskBand` is one of: low, medium, high, unavailable
- [ ] `riskScore` is null or a number 0–1
- [ ] `heuristicDisclaimer` contains the word "heuristic"
- [ ] `correlationId` matches input
- [ ] No PII in input or output
- [ ] Cost < US$10.00
- [ ] Evidence recorded: deployment ID, timestamp, status, sanitized summary

### For Atlas Sandbox (ATL-SBX-01 through ATL-SBX-03)

- [ ] Environment switches to Sandbox successfully
- [ ] Sandbox search returns structured offers
- [ ] Offers contain comparison-ready fields (route, times, price, availability)
- [ ] No PII in search request or response
- [ ] Verification returns a price status
- [ ] No write operation is performed without explicit human confirmation
- [ ] Evidence recorded: search result summary (sanitized), environment confirmation

---

## 13. Rollback and Stop Conditions

### Immediate Stop

| Condition | Action |
|---|---|
| Nosana cost exceeds US$10.00 estimate | Abort Nosana track; record evidence |
| Sandbox switch fails | Record error; continue with production search evidence only |
| Sandbox search returns `TICKETING_ACTIVATION_REQUIRED` for search (not just booking) | Record finding; this would indicate a deeper account issue |
| Any accidental production write attempt | **HARD STOP** — immediate human intervention required |
| Credential exposure in logs, UI, or evidence | Rotate credential; purge evidence; restart |
| PII detected in any provider request or response | Abort; investigate; do not record raw response |

### Rollback Procedures

| Component | Rollback |
|---|---|
| Atlas environment | `atlas-flight environment use production --json` |
| Nosana deployment | `deployment.stop()` + `deployment.archive()` |
| Evidence index | Revert to pre-test version; do not upgrade status without validated evidence |
| UI labels | Labels are static in `app/src/data/labels.ts`; no runtime modification occurs |

---

## 14. Files Reviewed

| File | Purpose |
|---|---|
| `docs/hackathon-brief.md` | Hackathon requirements and constraints |
| `docs/stitchcheck-hackathon-requirements-decision.md` | Service role matrix and evidence requirements |
| `docs/stitchcheck-demo-readiness-report.md` | Current demo readiness status |
| `docs/stitchcheck-atlas-live-disclosure.md` | Atlas live-demo disclosure (auth + search evidence) |
| `docs/stitchcheck-atlas-sandbox-readiness.md` | Atlas Sandbox readiness assessment |
| `docs/stitchcheck-nosana-execution-checklist.md` | Nosana execution checklist with all gates |
| `docs/stitchcheck-nosana-live-preflight.md` | Nosana preflight plan with stop conditions |
| `docs/stitchcheck-submission-evidence-index.md` | Evidence index with provider status |
| `docs/stitchcheck-provider-authorization-matrix.md` | Provider authorization gates |
| `docs/notebooklm-deep-research-report.md` | Hackathon evaluation report |
| `.qoder/specs/Atlas_Skill_Integration_Spec_task-a09.md` | Atlas Skill integration spec |
| `.qoder/specs/Create_Nosana_Smoke_Test_task-af6.md` | Nosana smoke test creation spec |
| `.qoder/specs/Create_Atlas_Smoke_Test_task-af6.md` | Atlas smoke test creation spec |
| `.qoder/specs/Create_Execution_Checklist_task-af6.md` | Execution checklist creation spec |
| `smoke-tests/nosana/README.md` | Nosana harness status |
| `smoke-tests/nosana/nosana-client.mjs` | Nosana client boundary (offline) |
| `smoke-tests/nosana/results/2026-08-20T15-53-43Z/summary.md` | NOS-ATTEMPT-001 blocked summary |
| `smoke-tests/atlas/read-only-atlas-adapter.mjs` | Atlas read-only adapter (offline) |
| `smoke-tests/atlas/duplicate-booking-guard.mjs` | VCC/318 guard state machine |
| External: `learn.nosana.com/api/intro.html` | Nosana API introduction |
| External: `learn.nosana.com/api/create-deployments.html` | Nosana deployment creation |
| External: `learn.nosana.com/api/manage-deployments.html` | Nosana deployment management |
| External: `learn.nosana.com/api/credits.html` | Nosana credits API |
| External: `learn.nosana.com/api/markets.html` | Nosana markets API |
| External: `learn.nosana.com/deployments/options.html` | Nosana deployment options |
| External: `learn.nosana.com/deployments/jobs/job-definition/schema.html` | Nosana job definition schema |
| External: `resources.atriptech.com/api-wen-dang/readme-1/quick-start` | Atlas quick-start guide |
| External: `resources.atriptech.com/api-wen-dang/readme-1/making-requests` | Atlas Sandbox access guide |
| External: `github.com/atlas-doc/atlas-flight-booking-skill` README | Atlas Skill documentation |

---

## 15. No External Writes Performed

**Confirmation:** This document was created as a single new planning file. During its creation:

- No source code was modified.
- No external API call was made (except read-only documentation fetches).
- No deployment, booking, payment, ticketing, cancellation, refund, or order was created.
- No credential value was accessed, read, printed, or exposed.
- `.env.local` was not accessed.
- No package was installed.
- No Git operation was performed.
- No Nosana job was submitted.
- No Atlas environment was switched.
- No Atlas search, verify, order, or any other operation was executed.

| File | Action |
|---|---|
| `docs/stitchcheck-opus-nosana-atlas-resolution-plan.md` | **CREATED** |
| All other files | **UNCHANGED** |

---

## Footer

- **Created**: 2026-08-21
- **Author**: Senior Integration Architect
- **Review status**: Ready for human review and go/no-go decisions
- **No external writes were performed in the creation of this document.**
