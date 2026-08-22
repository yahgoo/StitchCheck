# Atlas Flight Booking Skill — Read-Only Source Audit

> **Status**: READ-ONLY AUDIT — no tools invoked, no API calls made, no orders created, no source code edited.
> **Date**: 2026-08-21
> **Sources consulted**:
> - GitHub repository: <https://github.com/atlas-doc/atlas-flight-booking-skill> (fetched 2026-08-21)
>   - `README.md`, `pyproject.toml`, `docs/installation.md`
>   - `skills/atlas-flight-booking/SKILL.md`
>   - `skills/atlas-flight-booking/references/cli-contract.md`
>   - `skills/atlas-flight-booking/references/booking-workflow.md`
>   - `skills/atlas-flight-booking/references/error-handling.md`
> - Local: `specs/atlas-skill-integration-spec.md`
> - Local: `Atlas_Flight_Booking_Skill_Qoder_User_Guide.docx` / `.pdf` (binary — not machine-readable; content inferred from cross-references in repo docs and local integration spec)
> - Local: `smoke-tests/atlas/` adapter code, contracts, fixtures, and validators
> - Local: `docs/atlas-adapter-offline-test-notes.md`, `docs/atlas-duplicate-booking-protection.md`, `docs/smoke-test-atlas.md`

---

## 1. Installation and Configuration Requirements

### 1.1 Skill installation (one-time)

```bash
npx --yes skills add https://github.com/atlas-doc/atlas-flight-booking-skill --skill atlas-flight-booking
```

- Requires **Node.js** with `npx` available on `PATH`.
- Requires **internet access** so the agent can download `uv` and the signed CLI package from PyPI.
- Supported OS: Windows, macOS, Linux.

### 1.2 CLI auto-provisioning (automatic, on first invocation)

The Skill checks `atlas-flight --version` on every flight task. When the CLI is missing or older than `0.3.12`:

1. Installs `uv` from Astral's official standalone installer (macOS/Linux: `curl -LsSf https://astral.sh/uv/install.sh | sh`; Windows: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`).
2. Runs `uv tool install --force --python 3.12 atlas-flight-booking==0.3.12`.
3. A newer CLI is **never downgraded**.
4. No separately prepared Python environment is required; `uv` downloads and manages Python 3.12.

### 1.3 CLI dependencies (from `pyproject.toml`)

| Package | Version constraint |
|---|---|
| click | >=8.2, <9 |
| httpx | >=0.28, <1 |
| keyring | >=25, <26 |
| platformdirs | >=4, <5 |
| portalocker | >=3, <4 |
| pydantic | >=2.11, <3 |
| typer | >=0.16, <1 |
| tzdata | >=2025.2 |

Python requirement: `>=3.12, <3.13` (pinned to 3.12.x).

### 1.4 Manual CLI recovery (advanced, only when agent-managed install fails)

```bash
uv tool install --force --python 3.12 atlas-flight-booking==0.3.12
atlas-flight --version
atlas-flight doctor --json
```

### 1.5 Authorization (human-driven, browser-based)

- `atlas-flight auth status --json` checks current authorization state.
- `atlas-flight auth login --json` returns `data.authorization_url`.
- Human opens the URL in their own browser, signs in with an ATRIP account (or creates one), and completes authorization.
- Agent polls once: `atlas-flight auth poll --timeout 120 --json`.
- Credentials stored via the **operating system's secure credential facility** (keyring); no plaintext fallback.

### 1.6 Configuration summary

| Item | Who manages | Where stored |
|---|---|---|
| Skill lifecycle | `npx skills add` | Agent skill registry |
| CLI binary | `uv tool install` | uv tool directory |
| Python 3.12 runtime | `uv` | uv-managed |
| Atlas credentials | `atlas-flight auth login` | OS keyring (via `keyring` package) |
| Environment selection | `atlas-flight environment use {sandbox\|production} --json` | CLI local config |

---

## 2. Environment Variables (by Name Only)

The official Atlas Flight Booking Skill and CLI do **not** use environment variables for credentials or configuration. All secrets are managed through the OS keyring via the `keyring` Python package.

The local `.env.example` contains only `OPENROUTER_API_KEY` and `GEMINI_API_KEY` — no Atlas-related entries.

The local StitchCheck adapter code (`read-only-atlas-adapter.mjs`) references a conceptual `ATLAS_CREDENTIAL` via dependency-injected credential loader, but this is a **local design artifact** — not part of the official Skill or CLI. The integration spec (Rule 3) explicitly prohibits `.env.local` access.

**Names referenced in local code only (not official):**
- `ATLAS_CREDENTIAL` — conceptual credential resolved via injected loader function.

**Official credential mechanism:**
- OS secure credential facility (keyring) — no env var, no plaintext file, no `.env*` reference.

---

## 3. Sandbox versus Production Behavior

| Aspect | Production (default) | Sandbox |
|---|---|---|
| Activation | Default; no switch needed | `atlas-flight environment use sandbox --json` |
| Return to production | `atlas-flight environment use production --json` | N/A |
| Data source | Live fares and availability | Test data only |
| Booking creates real order | Yes (with payment) | No |
| Payment charges real balance | Yes | No |
| Skill commands change | No — same commands work in both | No |
| Reinstall required | No | No |
| Prior offers after switch | **Expired** — must start a new search | Same |
| Purchase decision basis | Permitted | **Must not** be used for purchase decisions |
| Prices and availability | Real | Synthetic test data |

**Key rule**: After any environment switch, all previously obtained offers expire. A new search must be started before continuing.

---

## 4. Read-Only versus Write-Capable Tools

### 4.1 Read-only commands (no side effects)

| Command | Purpose |
|---|---|
| `atlas-flight --version` | Check CLI version |
| `atlas-flight auth status --json` | Check authorization state |
| `atlas-flight auth login --json` | Initiate authorization (returns URL) |
| `atlas-flight auth poll --timeout 120 --json` | Poll authorization completion |
| `atlas-flight doctor --json` | Diagnose readiness |
| `atlas-flight search --origin ... --destination ... --depart ... --adults ... --json` | Search flights |
| `atlas-flight search --json` | Replay retained search |
| `atlas-flight offer list --search-id {id} --json` | List offers from a search |
| `atlas-flight offer verify --offer-id {id} --json` | Verify current price of an offer |
| `atlas-flight environment use {sandbox\|production} --json` | Switch environment |
| `atlas-flight order status --order-no {id} --json` | Query order/ticketing status |
| `atlas-flight booking baggage list --booking-id {id} --json` | List available baggage |
| `atlas-flight booking seat list --booking-id {id} --json` | List available seats |

### 4.2 Write-capable commands (side effects)

| Command | Side effect |
|---|---|
| `atlas-flight booking confirm-price --booking-id {id} --json` | Confirms an increased price |
| `atlas-flight booking baggage select --booking-id ... --baggage-id ... --json` | Selects baggage |
| `atlas-flight booking baggage remove --booking-id ... --json` | Removes baggage |
| `atlas-flight booking seat select --booking-id ... --seat-id ... --json` | Selects seat |
| `atlas-flight booking seat remove --booking-id ... --json` | Removes seat |
| `atlas-flight order create --booking-id {id} --passengers-stdin --json` | Creates an order |
| `atlas-flight order create --booking-id {id} --passengers-file {path} --json` | Creates an order from file |
| `atlas-flight order pay --confirmation-id {id} --json` | Pays for an order (single-use) |

### 4.3 Local adapter read-only enforcement

The StitchCheck local adapter (`read-only-atlas-adapter.mjs`) enforces its own allowlist:
- **Permitted**: `search`, `compare`
- **Forbidden**: `book`, `create_booking`, `reserve`, `ticket`, `issue`, `pay`, `purchase`, `verify`, `cancel`, `change`, `refund`, `order`

This allowlist is a **local safety boundary** — it does not map 1:1 to CLI commands. The official CLI has finer-grained control via separate subcommands.

---

## 5. Request/Response Identifier Flow

### 5.1 Official CLI identifier chain

```
search → search_id
  └→ offer list → offer_id (per offer)
       └→ offer verify → booking_id (per verified offer)
            ├→ baggage list/select/remove → baggage_id, traveler_id, segment_id
            ├→ seat list/select/remove → seat_id, traveler_id, segment_id
            └→ order create → order_no
                 └→ order pay → payment_confirmation_id (single-use)
                      └→ order status → ticketing state
```

All IDs are **opaque** and must be preserved exactly as returned. The `payment_confirmation_id` is **single-use** and must never be reused.

### 5.2 Authorization identifiers

```
auth login → data.authorization_url (presented to human)
auth status → AUTHORIZED | AUTHORIZATION_REQUIRED | AUTH_PENDING | ...
           → data.ticketing_available (boolean)
           → data.ticketing_activation_url (optional)
           → data.ticketing_blocker (optional: TOP_UP_REQUIRED | TICKETING_ACTIVATION_REQUIRED)
```

### 5.3 Response envelope (all commands)

Every CLI subcommand returns one stable JSON envelope with fields:
- `schema_version`
- `status`
- `code` — **branch on this field**, never parse `message`
- `message` — human-readable; not for programmatic branching
- `retryable` — boolean; permits at most one identical retry for read-only commands
- `request_id`
- `data` — command-specific payload
- `details` — additional context (e.g., `ticketing_blocker`, `url`, `fields`)

### 5.4 Local adapter identifier flow (discrepancy — see §8)

The local adapter uses its own `correlationId` (prefixed `synthetic-`) and does not carry `search_id`, `offer_id`, `booking_id`, `order_no`, or `payment_confirmation_id`. The local adapter's `AtlasSearchRequest` and `AtlasSearchResult` shapes are a simplified, display-only contract that cannot represent the full CLI workflow.

---

## 6. Error Propagation Behavior

### 6.1 Official CLI error model

- **Branch on `code`**, never on `message`.
- `retryable=true` permits at most **one identical retry** for read-only commands only.
- `retryable=true` **never** authorizes a different command, a second order creation, or a second payment attempt.
- Internal causes must be kept out of user-facing output; only normalized CLI fields are presented.

### 6.2 Error code catalog (from `error-handling.md`)

| Category | Codes |
|---|---|
| Authorization / access | `AUTHORIZATION_REQUIRED`, `AUTH_PENDING`, `AUTH_EXPIRED`, `AUTH_SESSION_MISSING`, `AUTH_SERVICE_UNAVAILABLE`, `SUBSCRIPTION_REQUIRED`, `SECURE_STORE_UNAVAILABLE`, `CREDENTIAL_REJECTED` |
| Search / verification | `SEARCH_NO_RESULTS`, `SEARCH_LIMIT_REACHED`, `OFFER_EXPIRED`, `BOOKING_EXPIRED`, `PRICE_CONFIRMATION_REQUIRED`, `PRICE_CONFIRMED`, `PRICE_VERIFICATION_UNAVAILABLE`, `FLIGHT_UNAVAILABLE`, `BOOKING_INPUT_INVALID` |
| Optional services / passengers | `BAGGAGE_UNAVAILABLE`, `SEAT_UNAVAILABLE`, `ANCILLARY_SELECTION_INVALID`, `PASSENGER_INFO_REQUIRED`, `PASSENGER_INFO_INVALID`, `CONTACT_INFO_INVALID`, `PASSENGER_COMBINATION_UNSUPPORTED` |
| Order / payment / ticketing | `PAYMENT_CONFIRMATION_REQUIRED`, `PAYMENT_CONFIRMATION_INVALID`, `PRICE_CHANGED`, `ORDER_CREATION_UNAVAILABLE`, `PAYMENT_METHOD_UNAVAILABLE`, `PAYMENT_DEADLINE_EXPIRED`, `PAYMENT_BALANCE_CHECK_REQUIRED`, `ORDER_CREATION_UNKNOWN`, `DUPLICATE_BOOKING_SUSPECTED`, `PAYMENT_STATUS_UNKNOWN`, `PAYMENT_PROCESSING`, `TICKETED`, `TICKETING_PENDING`, `ORDER_CANCELLED`, `ORDER_NOT_FOUND`, `ORDER_STATUS_UNAVAILABLE`, `UNSUPPORTED_BOOKING_FLOW`, `BOOKING_STATE_INVALID`, `ORDER_STATE_INVALID` |
| General | `INVALID_ARGUMENT`, `SERVICE_TEMPORARILY_UNAVAILABLE`, `SERVICE_REQUEST_FAILED`, `SERVICE_RESPONSE_INVALID` |

### 6.3 Local adapter error sanitization

The local adapter (`read-only-atlas-adapter.mjs`) sanitizes errors by stripping:
- API key patterns (`sk-*`, `AIza*`)
- Bearer tokens
- URLs
- Email addresses
- Stack traces

Error results carry `errorCode` and `errorMessage` fields. The `searchStatus` can be `disabled`, `completed`, `empty`, `timeout`, or `error`.

### 6.4 Upstream normalization note

Payment upstream status `411` is normalized by the CLI as `PAYMENT_BALANCE_CHECK_REQUIRED`. The numeric status must not be exposed to the user, and insufficient balance must not be claimed as the only possible cause.

---

## 7. Likely Cause of `TICKETING_ACTIVATION_REQUIRED`

### 7.1 What the code means

`TICKETING_ACTIVATION_REQUIRED` appears as a value of `data.ticketing_blocker` in the `auth status` response (or within `details.ticketing_blocker` in the `SUBSCRIPTION_REQUIRED` error code). It means:

> The ATRIP account has not completed the remaining activation steps required for ticketing.

### 7.2 What is known

- Flight and price **search** may still be available (depending on whether the blocker also restricts to `TOP_UP_REQUIRED`).
- Price **verification**, **order creation**, and **ticketing** are **not available** until activation is complete.
- The CLI returns `data.ticketing_activation_url` — a link to the ATRIP workspace where the user can see and complete the unfinished steps.

### 7.3 What is explicitly unknown

The SKILL.md states: **"Do not guess whether the unfinished step is email verification, subscription, or access approval."** The CLI does not disclose which specific activation step is pending. The possible causes include, but are not limited to:

1. Email verification not yet completed.
2. Account subscription or plan not yet activated.
3. Access approval (e.g., API access or booking权限) pending review.
4. Balance top-up not yet effective (though this is usually `TOP_UP_REQUIRED` instead).
5. Account compliance or KYC steps incomplete.

### 7.4 Correct handling (from SKILL.md)

1. Present `data.ticketing_activation_url` as a descriptive "ATRIP 工作台" link.
2. Explain that the account is not yet enabled for ticketing.
3. Wait for the user to complete the indicated steps.
4. After the user confirms, re-check authorization status with `atlas-flight auth status --json`.
5. When `data.ticketing_available=true`, previously selected offers with `price_status=current` can be verified even if their original `bookable=false`.

---

## 8. Discrepancies Between Repository Docs and Local Integration

### 8.1 Architectural mismatch

| Aspect | Official Skill/CLI | Local StitchCheck Integration |
|---|---|---|
| Integration pattern | Agent invokes CLI via shell commands | JavaScript adapter with dependency-injected SDK client |
| Credential management | OS keyring via `keyring` package | Injected credential loader function |
| Command interface | `atlas-flight search ...` shell commands | `client.searchAlternates(request)` JS method |
| Response shape | CLI JSON envelope (`code`, `data`, `retryable`, ...) | Local `AtlasSearchResult` (`searchStatus`, `alternatives`, `label`, ...) |
| ID management | CLI manages opaque IDs internally (`search_id`, `offer_id`, `booking_id`, ...) | Local `correlationId` (synthetic prefix); no CLI IDs carried |
| Environment switching | `atlas-flight environment use sandbox --json` | `sandboxOnly: true` in request payload |
| Error codes | ~40 named codes in `error-handling.md` | 5 status values: `disabled`, `completed`, `empty`, `timeout`, `error` |

### 8.2 Operation vocabulary mismatch

- **Local adapter** defines read-only operations as `["search", "compare"]`.
- **Official CLI** has no `compare` command; comparison is an agent-side orchestration over search results.
- **Official CLI** has `search`, `offer list`, `offer verify` as separate read-only commands — the local adapter collapses these into a single `search` operation.

### 8.3 Evidence label discrepancy

- **Local label**: `"Synthetic local placeholder — not Atlas Sandbox evidence"` (used on all disabled/fallback results).
- **Official Skill**: No equivalent label concept; the CLI returns real data from either Sandbox or Production without metadata labels.
- The local adapter always sets `syntheticDemo: true` and `sourceEnvironment: "sandbox-placeholder"`, even for results that would come from the real Sandbox.

### 8.4 Duplicate-booking guard mapping

- **Local code** (`duplicate-booking-guard.mjs`): Implements a state machine around HTTP 318 response.
- **Official CLI**: Returns `DUPLICATE_BOOKING_SUSPECTED` as a response code; also handles `ORDER_CREATION_UNKNOWN` for uncertain order creation.
- The local 318 concept and the CLI's `DUPLICATE_BOOKING_SUSPECTED` are related but not identical. The local guard's state machine (`attempt-created` → `awaiting-authoritative-status` → `query-existing-order` → ...) has no direct counterpart in the CLI's error handling model.

### 8.5 Missing CLI concepts in local adapter

The local adapter does not model:
- `offer verify` (price verification step)
- `booking_id` (intermediate identifier between offer and order)
- `payment_confirmation_id` (single-use payment token)
- `ticketing_activation_url` / `ticketing_blocker`
- `price_status` (`current` vs `reference`)
- `bookable` flag
- Flexible-date search orchestration
- Mandatory checkpoints (AUTHORIZATION, PRICE INCREASE, SEAT FALLBACK, PAYMENT)
- Baggage/seat selection workflow
- `retryable` flag semantics

### 8.6 Integration spec acknowledges the gap

The local integration spec (`specs/atlas-skill-integration-spec.md`) explicitly states:
> "Direct OAuth endpoints are not available for StitchCheck to call. The correct path is to install the official Skill, which automatically provisions the CLI."

The local adapter was built **before** the official Skill path was known, as a defensive boundary for a direct-API integration that returned 404. The adapter is now a **safety wrapper** that is architecturally incompatible with the official CLI-based integration path.

---

## 9. Exact Support Questions for Atlas

### 9.1 Integration architecture

1. **Is there a programmatic SDK (Python or JavaScript) for integrating Atlas outside the CLI wrapper?** The official Skill is designed for AI agent consumption via shell commands. StitchCheck's React/Vite frontend would need a library-level integration point for automated search and comparison.

2. **Can the `atlas-flight` CLI be invoked programmatically from a Node.js application** (e.g., via `child_process`), or is this unsupported? What are the licensing and terms-of-service implications?

3. **Is there a REST API that the CLI wraps**, and if so, is there documentation for direct API consumers? The `pyproject.toml` shows `httpx` as a dependency, confirming HTTP calls under the hood.

### 9.2 Sandbox behavior

4. **What is the data freshness guarantee for Sandbox?** Are Sandbox routes, schedules, and prices representative of real-world data, or entirely fictional?

5. **Is there a programmatic way to query which environment (Sandbox vs Production) is currently active**, other than `atlas-flight environment use ... --json`? Can the CLI return the current environment in `auth status` or `doctor` output?

6. **Do `offer_id` values persist across environment switches**, or are they guaranteed to be invalidated? The docs say "any offer obtained before the switch expires," but is this a hard server-side invalidation or a CLI-side cache clear?

### 9.3 `TICKETING_ACTIVATION_REQUIRED`

7. **What specific activation steps does `TICKETING_ACTIVATION_REQUIRED` encompass?** The SKILL.md says "do not guess," but for support and debugging purposes, can Atlas confirm whether this relates to email verification, subscription plan activation, API access approval, or balance requirements?

8. **Is there a separate error code or `ticketing_blocker` value for each distinct activation step**, or are they all collapsed into `TICKETING_ACTIVATION_REQUIRED`?

9. **Can `TICKETING_ACTIVATION_REQUIRED` be resolved programmatically** (e.g., via an API call), or does it always require manual action on the ATRIP workspace?

### 9.4 Duplicate-booking and 318

10. **What is the exact relationship between HTTP 318 and the CLI's `DUPLICATE_BOOKING_SUSPECTED` code?** Does the CLI always return `DUPLICATE_BOOKING_SUSPECTED` when the upstream API returns 318, or are there cases where 318 maps to `ORDER_CREATION_UNKNOWN`?

11. **When `DUPLICATE_BOOKING_SUSPECTED` is returned, is the `order_no` of the existing booking always included** in the response `data`? The local duplicate-booking guard assumes an `existingOrderId` is available.

### 9.5 Rate limits and quotas

12. **What are the rate limits for `search`, `offer verify`, and `order status` in both Sandbox and Production?** The CLI documents `SEARCH_LIMIT_REACHED` but does not specify the threshold.

13. **Is there a daily or hourly quota for Sandbox searches?** This affects demo rehearsal planning.

### 9.6 Credential and authorization

14. **Does the `keyring`-based credential storage work in headless/CI environments** (e.g., Docker containers without a desktop keyring daemon)? Is there a fallback mechanism for non-interactive environments?

15. **Can authorization be completed programmatically** (e.g., via a service account or API key), or is browser-based human authorization the only supported path?

### 9.7 Price-compare-search

16. **Is the price-compare-search endpoint** (<https://resources.atriptech.com/api-wen-dang/api-reference/booking-apis/price-compare-search>) **accessible independently of the CLI**, and if so, what authentication mechanism does it use? The SKILL.md references it as a documentation link for `price_status=reference` offers.

### 9.8 Balance and payment

17. **What is the minimum Atlas balance required to complete a Sandbox booking flow** (search → verify → create → pay)? Is there a test balance pre-loaded for Sandbox accounts?

18. **Can the balance be checked programmatically** via the CLI, or only through the ATRIP workspace UI?

---

## Appendix A: Local File Inventory

| File | Lines | Role |
|---|---|---|
| `specs/atlas-skill-integration-spec.md` | 248 | Correct integration path spec (replaces failed OAuth approach) |
| `smoke-tests/atlas/alternatives-contract.mjs` | 189 | Provider-neutral adapter interface contract |
| `smoke-tests/atlas/read-only-atlas-adapter.mjs` | 515 | Read-only adapter (disabled by default) |
| `smoke-tests/atlas/comparison-adapter.mjs` | 183 | Local-only comparison view builder |
| `smoke-tests/atlas/schema-validator.mjs` | 502 | Fixture schema and forbidden-action validator |
| `smoke-tests/atlas/duplicate-booking-guard.mjs` | 421 | Offline duplicate-booking state machine |
| `smoke-tests/atlas/adapter-offline-tests.mjs` | 1017 | Offline test suite (89 assertions, all passing) |
| `smoke-tests/atlas/result-shape.d.ts` | 149 | TypeScript definitions for UI-ready shapes |
| `docs/atlas-adapter-offline-test-notes.md` | 185 | Offline test results and safety invariants |
| `docs/atlas-duplicate-booking-protection.md` | 72 | Duplicate-booking guard documentation |
| `docs/smoke-test-atlas.md` | 153 | Smoke test plan (ATL-01 through ATL-12) |
| `app/src/data/labels.ts` | 20 | UI disclaimer label constants |

## Appendix B: Official Repository Structure

```
atlas-doc/atlas-flight-booking-skill/
├── .github/
├── .gitignore
├── LICENSE (Apache 2.0)
├── NOTICE
├── README.md
├── README.zh-CN.md
├── assets/
├── docs/
│   ├── installation.md
│   └── installation.zh-CN.md
├── pyproject.toml
├── scripts/
├── skills/
│   └── atlas-flight-booking/
│       ├── SKILL.md (10.4 KB)
│       ├── agents/
│       └── references/
│           ├── booking-workflow.md (4.5 KB)
│           ├── cli-contract.md (6.7 KB)
│           ├── error-handling.md (6.5 KB)
│           └── passenger-input.md (2.5 KB)
├── src/ (Python CLI source)
├── tests/
└── uv.lock
```

## Appendix C: Mandatory Checkpoints (from SKILL.md)

The official Skill defines four mandatory human-confirmation checkpoints:

1. **AUTHORIZATION** — After presenting the authorization link; stop and wait for user confirmation.
2. **PRICE INCREASE** — After presenting old and new totals; stop and wait for explicit acceptance.
3. **SEAT FALLBACK** — Before selecting a seat; stop until the user chooses fallback behavior.
4. **PAYMENT** — After presenting masked payment summary and order link; stop and wait for explicit approval.

The local integration does not model these checkpoints.

---

*End of audit. No tools were invoked. No API calls were made. No orders were created. No source code was edited.*
