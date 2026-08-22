# StitchCheck — Atlas Sandbox Search → Verify Smoke Test

> **Status**: PREPARED — NOT YET EXECUTED  
> **Date**: 2026-08-21  
> **Author**: Integration Architect  
> **Scope**: Read-only Atlas Sandbox smoke test: environment switch, Search, offer list, Verify. Hard stop before Order.  
> **Constraint**: No booking, payment, ticketing, cancellation, refund, order creation, or any external write. No credentials exposed. No React app modified.

---

## 1. Prerequisites

### 1.1 CLI availability

| Item | Status | Detail |
|---|---|---|
| `atlas-flight` CLI | ✅ Installed | v0.3.12 (PATH) |
| Atlas authorization | ✅ AUTHORIZED | `search_available: true`, `ticketing_available: false` |
| `TICKETING_ACTIVATION_REQUIRED` | Does not block Search or Verify | Only blocks Order creation and downstream writes |

### 1.2 Verification commands

```bash
atlas-flight --version
# Expected: atlas-flight 0.3.12

atlas-flight auth status --json
# Expected: code=AUTHORIZED, data.search_available=true

atlas-flight doctor --json
# Expected: code=DOCTOR_OK, all checks=true
```

### 1.3 No credential setup required

- Credentials are stored in the OS secure credential facility (keyring).
- No `.env.local` entries, no `ATLAS_CLIENT_ID`, no `ATLAS_CLIENT_SECRET` needed.
- The script does not read, log, or expose any credential.

---

## 2. Execution Options

### Option A: Automated script (recommended)

```bash
node smoke-tests/atlas/run-sandbox-search-verify.mjs
```

The script performs all steps sequentially and saves sanitized evidence to `smoke-tests/atlas/results/`.

### Option B: Manual step-by-step

Each step can be run independently in a terminal. The exact commands are documented in Section 3.

---

## 3. Step-by-Step Commands

### Step 1 — Switch to Sandbox

```bash
atlas-flight environment use sandbox --json
```

- **Classification**: Local config change only. No network request.
- **Expected**: `code: "ENVIRONMENT_SWITCHED"` or `status: "success"`.
- **Important**: Any prior offers expire immediately after this switch.

### Step 2 — Fresh Search

```bash
atlas-flight search \
  --origin KUL \
  --destination SIN \
  --depart 2026-09-15 \
  --adults 1 \
  --currency USD \
  --json
```

- **Classification**: Read-only.
- **Synthetic parameters**: KUL → SIN, 2026-09-15, 1 adult, USD.
- **Expected**: `status: "success"` with `data.search_id` (opaque identifier).
- **Key output**: `search_id` — preserved for next step.
- **Currency**: `USD` included per Atlas quick-start guidance for Sandbox.

### Step 3 — List Offers

```bash
atlas-flight offer list --search-id <SEARCH_ID> --json
```

- **Classification**: Read-only.
- **Input**: `search_id` from Step 2.
- **Expected**: Array of offers, each with an `offer_id`.
- **Key output**: First `offer_id` — preserved for next step.

### Step 4 — Verify Offer (read-only price check)

```bash
atlas-flight offer verify --offer-id <OFFER_ID> --json
```

- **Classification**: Read-only. Checks current price/availability.
- **Input**: `offer_id` from Step 3.
- **Expected**: `status: "success"` with price status, or a known code like `PRICE_CONFIRMATION_REQUIRED`.
- **Key output**: `session_id` (if returned) — would be needed for Order, but we stop here.

### ⛔ HARD STOP — After Step 4

**The flow stops here.** The next operation in the Atlas lifecycle is:

```bash
# NOT EXECUTED — write operation
atlas-flight order create --booking-id <BOOKING_ID> --passengers-stdin --json
```

This is explicitly forbidden in this smoke test. No order, payment, ticketing, cancellation, refund, or modification is performed.

---

## 4. Safety Constraints

| Constraint | Enforcement |
|---|---|
| No order creation | Script hard-stops after Verify. `order create` is never invoked. |
| No payment | `order pay` is never invoked. |
| No ticketing | No ticketing poll or query. |
| No cancellation/refund/modification | Not implemented in CLI; not invoked. |
| No credential exposure | Script sanitizes all output. No `request_id`, URLs, emails, or tokens in saved evidence. |
| No PII | Search uses synthetic parameters only. No passenger data. |
| No React app modification | Script is in `smoke-tests/atlas/`, not `app/`. |
| Single execution | No retry loops. One request per step. |
| Read-only operations only | Search, offer list, offer verify are all classified read-only by the official Skill. |

---

## 5. Evidence Handling

### 5.1 Output location

Results are saved to:

```
smoke-tests/atlas/results/sandbox-search-verify-<TIMESTAMP>.json
```

### 5.2 Evidence labels

| Outcome | Label |
|---|---|
| All steps succeed | `Atlas Sandbox evidence — search + verify completed, read-only, one bounded request` |
| Verify returns known code (price change, expired) | `Atlas Sandbox evidence — search + verify completed, price change or offer expired` |
| Any step fails | `Atlas Sandbox — failure state (<step> failed)` |
| Unexpected exception | `Atlas Sandbox — failure state (unexpected exception)` |

### 5.3 Sanitization rules

The following are stripped from all saved evidence:

- `request_id` (internal routing metadata)
- API key patterns (`sk-*`, `AIza*`)
- Bearer tokens
- URLs (replaced with `[REDACTED]`)
- Email addresses
- Stack traces

### 5.4 What is preserved

- Opaque identifiers: `search_id`, `offer_id`, `session_id` (needed for flow traceability)
- Response codes and status fields
- Offer count
- Price and availability data (synthetic Sandbox test data)

---

## 6. Expected Outcomes

### 6.1 Success path

```
Step 1: Environment switched to Sandbox ✅
Step 2: Search returns offers with search_id ✅
Step 3: Offer list returns offers with offer_id ✅
Step 4: Verify returns price status ✅
HARD STOP reached ✅
Result: SUCCESS
Evidence: Saved to results/
```

### 6.2 Partial success

```
Steps 1-3: Success ✅
Step 4: Verify returns PRICE_CONFIRMATION_REQUIRED or OFFER_EXPIRED
HARD STOP reached ✅
Result: PARTIAL_SUCCESS
Evidence: Saved to results/
```

### 6.3 Failure states

| Failure | Likely cause | Evidence label |
|---|---|---|
| Environment switch fails | CLI misconfiguration | `failure state (environment switch failed)` |
| Search returns empty | No Sandbox data for route/date | `failure state (search failed or returned empty)` |
| Search returns error | Auth expired, network issue | `failure state (search failed)` |
| Offer list returns empty | All offers expired | `failure state (no offers available)` |
| Verify fails | Offer expired, price changed | `failure state (verify failed)` |

---

## 7. Rollback

After the smoke test, return to production:

```bash
atlas-flight environment use production --json
```

This is a local config change only. No network request.

---

## 8. Blockers and Pre-Flight Checklist

### 8.1 Current blockers

**None identified.** All prerequisites are met:

- [x] `atlas-flight` CLI v0.3.12 installed
- [x] Authorization: AUTHORIZED
- [x] `search_available: true`
- [x] No credential setup needed (keyring-managed)
- [x] `TICKETING_ACTIVATION_REQUIRED` does not block Search or Verify

### 8.2 Potential blockers during execution

| Blocker | Detection | Action |
|---|---|---|
| Auth expired | `auth status` returns `AUTH_EXPIRED` | Human re-authorizes via browser |
| Sandbox unreachable | Search returns `SERVICE_REQUEST_FAILED` | Record failure; network or Atlas Sandbox issue |
| No data for route | Search returns `SEARCH_NO_RESULTS` | Try different route/date; record as empty state |
| CLI crash | Non-zero exit code with no JSON | Record failure detail; check `atlas-flight doctor` |

---

## 9. Files Created

| File | Purpose |
|---|---|
| `smoke-tests/atlas/run-sandbox-search-verify.mjs` | Automated smoke test script |
| `docs/stitchcheck-atlas-sandbox-smoke-test.md` | This document |

### Files NOT modified

- `app/` — React application unchanged
- `smoke-tests/atlas/read-only-atlas-adapter.mjs` — Existing adapter unchanged
- `smoke-tests/atlas/fixtures/` — Existing fixtures unchanged
- `.env.local` — Not accessed
- Any existing evidence files — Not modified

---

## 10. Relationship to Existing Artifacts

| Artifact | Relationship |
|---|---|
| `docs/stitchcheck-atlas-sandbox-diagnosis.md` | Diagnosis that confirmed this test is safe and possible |
| `docs/stitchcheck-atlas-skill-audit.md` | Audit of CLI commands and identifier flow |
| `specs/atlas-skill-integration-spec.md` | Integration spec with safety rules |
| `smoke-tests/atlas/read-only-atlas-adapter.mjs` | Pre-Skill adapter (stale); this test uses the official CLI directly |
| `smoke-tests/atlas/local-contract.json` | Existing contract for offline tests; this test is a live Sandbox execution |

---

## 11. Execution Authorization

**This document is a preparation artifact. No external call has been made.**

To authorize execution, a human must:

1. Confirm no production work is in progress.
2. Run the command: `node smoke-tests/atlas/run-sandbox-search-verify.mjs`
3. Review the saved evidence in `smoke-tests/atlas/results/`.
4. Confirm the hard stop was reached (no Order created).

---

## Footer

- **Created**: 2026-08-21
- **Author**: Integration Architect
- **Review status**: Prepared — awaiting human go/no-go for execution
- **No external calls were made in the creation of this document.**
- **No credentials were exposed.**
- **No application code was modified.**
