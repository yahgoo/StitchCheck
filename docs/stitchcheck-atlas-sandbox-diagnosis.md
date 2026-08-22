# StitchCheck — Atlas Sandbox Integration Diagnosis

> **Status**: DIAGNOSIS COMPLETE — read-only audit, no external writes  
> **Date**: 2026-08-21  
> **Author**: Integration Architect  
> **Scope**: Determine the exact environment-switch procedure, Sandbox URL, credential requirements, read-only Search/Verify flow, identifier and currency rules, `TICKETING_ACTIVATION_REQUIRED` blast radius, and the precise stopping point before any write.  
> **Constraint**: No booking, payment, ticketing, cancellation, refund, order creation, or any external write was performed. No credentials were exposed. No application code was modified.

---

## 1. Exact Environment-Switch Procedure

### 1.1 Current state

The `atlas-flight` CLI is in **production** mode. The Skill defaults to production and no environment switch has been executed to date.

### 1.2 Switch command

```bash
atlas-flight environment use sandbox --json
```

- This is a **local CLI config change only** — no network request, no API call.
- The same Skill and all public commands continue to work after the switch.
- No reinstallation or re-authorization is required.
- Any offer obtained before the switch **expires immediately** and must not be reused.
- A **new search** must be started after the switch.

### 1.3 Rollback command

```bash
atlas-flight environment use production --json
```

### 1.4 Verification after switch

After switching, confirm the environment with:

```bash
atlas-flight environment
```

The CLI output should indicate `sandbox`.

---

## 2. Sandbox Base URL and Credential Requirements

### 2.1 Integration path in use

StitchCheck integrates via the **Atlas Flight Booking Skill**, not via direct REST calls. The Skill and its companion `atlas-flight` CLI handle all API communication, endpoint routing, authentication, and response normalization.

### 2.2 Direct API reference (not currently used)

| Item | Value |
|---|---|
| **Sandbox base URL** | `https://sandbox.atriptech.com/` |
| **Production base URLs** | Separate URLs for Search vs. Transaction APIs; obtained from ATRIP → My Profile → Company Information |
| **Request method** | `POST /<endpoint>.do` with JSON body |

### 2.3 Required headers (direct API path)

```http
Content-Type: application/json
Accept: */*
Accept-Encoding: gzip
x-atlas-client-id: <sandbox-client-id>
x-atlas-client-secret: <sandbox-client-secret>
```

**Critical:** Do NOT send `Accept: application/json`. Atlas requires `Accept: */*` to allow gzip transport and future content-type flexibility. Sending `application/json` may trigger a server-side error.

### 2.4 Credential generation (direct API path)

1. Log in to ATRIP.
2. Navigate to `Profile` → `My Profile` → `Company Information`.
3. Under `Sandbox Info`, find `x-atlas-client-id` and `x-atlas-client-secret`.

### 2.5 Credential storage in Skill path

- The Skill stores credentials via the **OS secure credential facility** (Keychain on macOS).
- No `x-atlas-client-id` or `x-atlas-client-secret` exists in `.env.local` or any project file.
- The agent never observes or handles plaintext credentials.
- Authorization was completed via a browser-based ATRIP sign-in flow.

### 2.6 Security rules

- Credentials must be retained server-side only.
- Never expose credentials in client applications, logs, or evidence.
- Use Sandbox for integration and testing; Production only after UAT approval and account switch to `LIVE`.

---

## 3. Search and Verify Read-Only Flow

### 3.1 Search (read-only)

| Aspect | Detail |
|---|---|
| **Skill tool** | Atlas Flight Booking Skill → `atlas-flight search` |
| **CLI command** | `atlas-flight search --origin KUL --destination SIN --depart 2026-09-15 --adults 1 --json` |
| **Atlas API operation** | Shopping / FlightSearch |
| **Read/Write** | **Read-only** |
| **Output** | One stable JSON envelope; agents branch on `code`, preserve opaque IDs exactly |
| **Key output field** | `routingIdentifier` — must be preserved for subsequent steps |

### 3.2 Verify (read-only)

| Aspect | Detail |
|---|---|
| **Skill tool** | Verify tool |
| **Atlas API operation** | Verification |
| **Read/Write** | **Read-only** — checks current price/availability of a specific offer |
| **Output** | Verification status: accept or price-change |
| **Key output field** | `sessionId` — must be preserved for subsequent steps |
| **Price-change handling** | A verified price increase requires a new explicit confirmation |

### 3.3 Flow sequence (read-only portion)

```
Search → routingIdentifier
   ↓
Verify (using routingIdentifier from Search) → sessionId
   ↓
[STOP — next step is Order creation, which is a WRITE]
```

---

## 4. Required Currency and Identifiers

### 4.1 Currency

Per the Atlas quick-start documentation:

> When first connecting, Atlas may not have configured a settlement currency. In the Sandbox environment, before account setup is complete, manually add `"currency":"USD"` to Search requests.

**Action:** If Sandbox searches fail or return unexpected results, include `"currency":"USD"` in the search payload. When using the Skill/CLI, this may be handled via `--currency USD` or equivalent.

### 4.2 Identifiers to preserve across the booking flow

| Identifier | Source | Used In |
|---|---|---|
| `routingIdentifier` | Search response | Verify request |
| `sessionId` | Verify response | Order creation request |
| `orderNo` | Order creation response | Payment, ticketing, order query |
| `OfferId` | Get Offer path (alternative to Verify) | Used in place of `sessionId` |

**Rule:** These identifiers are opaque. Agents must preserve them exactly as returned and never inspect, parse, or modify them.

---

## 5. TICKETING_ACTIVATION_REQUIRED — Scope Analysis

### 5.1 What it is

`TICKETING_ACTIVATION_REQUIRED` is an **account-level activation requirement** at the ATRIP workspace. It is not a per-request, per-offer, or per-endpoint issue.

### 5.2 Effect on each operation

| Operation | Affected? | Explanation |
|---|---|---|
| **Search** | **No** | Search works in both Production and Sandbox. One production search already returned 5 offers. Search is purely read-only and does not require ticketing activation. |
| **Verify** | **No** | Verify is a read-only price check. It confirms whether a specific offer's price is still valid. It does not create any booking state and does not require ticketing activation. |
| **Order** | **Yes** | Order creation is the first write operation. Without ticketing activation, offers carry `bookable: false` and `price_status: reference`. No order can be created. |
| **Payment** | **Yes** | Payment requires a completed order. Since orders cannot be created, payment is blocked transitively. |
| **Ticketing** | **Yes** | Ticketing requires a completed payment. Since payment cannot occur, ticketing is blocked transitively. |

### 5.3 Root cause

The ATRIP workspace has not yet activated ticketing for the account or application. This is consistent with the Atlas integration lifecycle:

1. **Sandbox Access** → Generate credentials ✅ (completed)
2. **Sandbox Development** → Build and test booking flow ✅ (search works)
3. **UAT Validation** → Complete required UAT flows ❌ (not completed)
4. **Production Go-Live** → Account switched to LIVE ❌ (not completed)

`TICKETING_ACTIVATION_REQUIRED` indicates that Step 3/4 have not been completed. The account has API access for search, but ticketing capability has not been activated.

### 5.4 Resolution path

| Action | Owner |
|---|---|
| Activate ticketing for the account | ATRIP workspace admin (human) |
| Complete UAT validation | ATRIP → UAT Testing interface |
| Switch account to LIVE status | Atlas account manager |

This is an **external human action** outside the scope of this repository, the Skill, or the agent.

---

## 6. Whether One Safe Sandbox Search/Verify Smoke Test Is Possible

### 6.1 Verdict: YES

A Sandbox Search + Verify smoke test is **safe and possible** because:

1. **Search is read-only** — it queries available flights without creating any state.
2. **Verify is read-only** — it checks current price/availability without creating any state.
3. **Environment switch is local** — `atlas-flight environment use sandbox --json` changes only the CLI's local configuration.
4. **`TICKETING_ACTIVATION_REQUIRED` does not block Search or Verify** — it only blocks Order creation and downstream writes.
5. **The Skill is already authorized** — ATRIP browser authorization succeeded; credentials are stored in the OS secure credential facility.

### 6.2 Proposed test plan

| Test ID | Operation | Expected Outcome | Human Gate | Evidence |
|---|---|---|---|---|
| ATL-SBX-01 | Switch to Sandbox | Environment confirmed as Sandbox | No | CLI output showing `sandbox` |
| ATL-SBX-02 | Sandbox search (e.g., KUL → SIN, 2026-09-15, 1 adult) | Structured offers returned with Sandbox test data | No | Sanitized JSON result summary |
| ATL-SBX-03 | Verify one offer from ATL-SBX-02 | Price verification response (accept or price change) | No | Verification status |
| ATL-SBX-04 | Switch back to production | Environment confirmed as production | No | CLI output showing `production` |

### 6.3 Safety constraints

- **No PII** in search request or response.
- **No write operation** of any kind.
- If `TICKETING_ACTIVATION_REQUIRED` unexpectedly blocks Sandbox Search (not just booking), stop and record the finding.
- All offers obtained in Sandbox are test data and must not be used for purchase decisions.

### 6.4 Pass criteria

- [ ] Environment switches to Sandbox successfully.
- [ ] Sandbox search returns structured offers with comparison-ready fields (route, times, price, availability).
- [ ] Verification returns a price status.
- [ ] No write operation is performed.
- [ ] Evidence recorded: search result summary (sanitized), environment confirmation.

---

## 7. Exact Stopping Point Before Any Write

### 7.1 The hard stop

**The flow stops after Verify (ATL-SBX-03).** The next operation in the Atlas lifecycle is **Order creation**, which is a **write operation** that creates a test order.

### 7.2 Classification of all operations

| Operation | Classification | Allowed in this audit? |
|---|---|---|
| Environment switch (`sandbox`/`production`) | Local config change | ✅ Yes |
| Search | Read-only | ✅ Yes |
| Verify | Read-only | ✅ Yes |
| Order creation | **Write** — creates an order | ❌ **STOP** |
| Payment confirmation | **Write** — processes payment | ❌ Not attempted |
| Ticketing poll | Read-only (polling status) | ❌ Not attempted (requires prior write) |
| Order query | Read-only | ❌ Not attempted (requires prior write) |
| Cancellation / refund | **Not implemented** in current Skill version | ❌ N/A |

### 7.3 If order creation were to be attempted (not in this audit)

- Requires **explicit human confirmation immediately before** execution.
- Must use **fictional passenger data only**: TEST/TRAVELER, Male, DOB 1990-01-01, Nationality JP, Passport TR0000001, Issuing country JP, Expiry 2032-12-31.
- If `TICKETING_ACTIVATION_REQUIRED` also affects Sandbox, stop and record the finding.

---

## 8. Additional Findings

### 8.1 StitchCheck adapter vs. Skill path

The existing `smoke-tests/atlas/read-only-atlas-adapter.mjs` was built **before** the Atlas Flight Booking Skill was adopted. It references `ATLAS_CLIENT_ID`, `ATLAS_CLIENT_SECRET`, and direct OAuth — all of which are **stale**. The Skill is now the authoritative integration path. The adapter's `sandboxOnly: true` flag is irrelevant when using the Skill, since the Skill manages environment routing internally.

### 8.2 VCC/318 guard is independent

The duplicate-booking guard (`smoke-tests/atlas/duplicate-booking-guard.mjs`) is a **client-side state machine** that prevents blind retry after a 318 (duplicate booking) response. It is completely independent of `TICKETING_ACTIVATION_REQUIRED`:

- The guard would only become relevant **after** ticketing activation is complete and order creation is attempted.
- The guard has no effect on the provider-side activation status.
- 48 offline tests pass; no live Atlas response has been used as input.

### 8.3 Evidence labels

The current evidence label for Atlas artifacts remains:

> "Synthetic local placeholder — not Atlas Sandbox evidence"

After a successful Sandbox Search + Verify, this label would be updated to reflect genuine Sandbox evidence. Until then, all `smoke-tests/atlas/` artifacts remain correctly labelled as synthetic.

---

## 9. Summary of Answers

| # | Question | Answer |
|---|---|---|
| 1 | Exact environment-switch procedure | `atlas-flight environment use sandbox --json`; local config change; no re-auth needed; existing offers expire; new search required |
| 2 | Sandbox base URL and credential requirements | Base URL: `https://sandbox.atriptech.com/`; credentials via Skill's OS secure credential facility (no `.env.local`); direct API uses `x-atlas-client-id` + `x-atlas-client-secret` from ATRIP → Profile → Company Information → Sandbox Info |
| 3 | Search and Verify read-only flow | Search → `routingIdentifier` → Verify → `sessionId` → **STOP** (next is Order, a write) |
| 4 | Required currency and identifiers | `"currency":"USD"` may be required in Sandbox before account setup; preserve `routingIdentifier`, `sessionId`, `orderNo`, `OfferId` exactly as returned |
| 5 | TICKETING_ACTIVATION_REQUIRED scope | Affects **Order, Payment, Ticketing** only. Does **not** affect Search or Verify. It is an account-level activation, not a per-request issue. |
| 6 | Is one safe Sandbox Search/Verify smoke test possible? | **Yes.** Search and Verify are both read-only. `TICKETING_ACTIVATION_REQUIRED` does not block them. The Skill is already authorized. |
| 7 | Exact stopping point before any write | **After Verify (ATL-SBX-03).** Order creation is the first write operation and is the hard stop. |

---

## 10. Files Reviewed

| File / Source | Purpose |
|---|---|
| `docs/stitchcheck-opus-nosana-atlas-resolution-plan.md` | Prior diagnosis with Atlas environment and lifecycle analysis |
| `docs/stitchcheck-atlas-live-disclosure.md` | Live-demo disclosure (auth + search evidence) |
| `smoke-tests/atlas/read-only-atlas-adapter.mjs` | Existing read-only adapter (stale — pre-Skill) |
| `skills/stitchcheck-demo-media/SKILL.md` | Demo media skill constraints |
| Atlas Flight Booking Skill (system-loaded) | Skill capabilities, environment switch, safety boundaries |
| `resources.atriptech.com/api-wen-dang/readme-1/quick-start` | Atlas quick-start: integration lifecycle, currency, identifiers |
| `resources.atriptech.com/api-wen-dang/readme-1/making-requests` | Sandbox access: base URL, credentials, headers |
| `github.com/atlas-doc/atlas-flight-booking-skill` | Skill README: installation, environment switch, supported workflow |

---

## Footer

- **Created**: 2026-08-21
- **Author**: Integration Architect
- **Review status**: Diagnosis complete — ready for human go/no-go on ATL-SBX-01 through ATL-SBX-04
- **No external writes were performed in the creation of this document.**
- **No credentials were exposed.**
- **No application code was modified.**
