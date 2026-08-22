# StitchCheck — Atlas Live-Demo Disclosure

> **Status**: FINAL — for live-demo presenter and judge reference  
> **Date**: 2026-08-21  
> **Owner**: StitchCheck dev lead  
> **Scope**: Accurate, bounded statement of what has and has not been demonstrated with the Atlas Flight Booking Skill as of the live demo. This document does not make any Atlas call, switch environments, select an offer, create an order or payment, access `.env.local`, or modify any existing file.

---

## 1. What Was Demonstrated

### 1.1 Official Atlas Skill Authorization

The **Atlas Flight Booking Skill** was installed via the official installation path and **authorization succeeded** through the browser-based ATRIP authorization flow.

- The human opened the authorization link, signed in to the ATRIP workspace, and granted consent.
- The companion `atlas-flight` CLI was auto-provisioned by the Skill (minimum version `atlas-flight-booking==0.3.12`).
- Credentials are stored securely by the CLI via the OS secure credential facility. The agent never observed or handled plaintext credentials.
- No direct OAuth endpoint was constructed or called. Direct OAuth against Atlas is unsupported; the official Skill is the only valid integration path.

**Status**: ✅ Official Atlas Skill authorization succeeded.

### 1.2 One Production Search — Five Real Offers

After authorization, **one live read-only search** was executed against the **production** Atlas environment:

- **Route**: Shanghai PVG → Tokyo NRT/HND
- **Date**: 2026-09-04
- **Passengers**: 1 adult (synthetic, fictional profile — no PII)
- **Result**: 5 real production-flight offers returned with normalized JSON.

**Status**: ✅ One production search returned five real offers.

### 1.3 All Offers Are Reference Prices — `bookable: false`

All 5 returned offers carry the following status:

| Field | Value | Meaning |
|---|---|---|
| `price_status` | `reference` | Display/reference price only; not a confirmed bookable fare. |
| `bookable` | `false` | Offers cannot be used to create a booking at this time. |

The search proved that the Skill can invoke the CLI and return structured, normalized results with real production-flight data. However, none of the offers are bookable.

**Status**: ✅ All were reference prices with `bookable: false`.

### 1.4 `TICKETING_ACTIVATION_REQUIRED` Remains

The `bookable: false` and `price_status: reference` state on all 5 offers is caused by a **`TICKETING_ACTIVATION_REQUIRED`** condition.

- The ATRIP workspace has not yet activated ticketing for the account or application.
- Until ticketing activation is completed by a human at the ATRIP workspace, no offer can progress from reference price to a bookable fare.
- Ticketing activation is an **external human action** outside the scope of this repository, the Skill, or the agent.

**Status**: ✅ `TICKETING_ACTIVATION_REQUIRED` remains.

---

## 2. What Was Not Demonstrated

### 2.1 Sandbox Rehearsal Was Not Attempted

- The CLI environment was **not** switched from production to Sandbox.
- The command `atlas-flight environment use sandbox --json` was **not** executed.
- No Sandbox search, Sandbox booking rehearsal, or Sandbox validation of any kind was performed.
- The five production offers obtained before any environment switch cannot be relabelled as Sandbox output.

**Status**: ❌ Sandbox rehearsal was not attempted.

### 2.2 No Booking, Payment, Ticket, or Order Was Created

- No `book`, `create_booking`, `reserve`, `ticket`, `issue`, `pay`, `purchase`, `verify`, `cancel`, `change`, `refund`, `order`, or equivalent mutation was executed.
- No write operation of any kind was performed against Atlas — in production or Sandbox.
- The StitchCheck UI enforces a confirmation gate that blocks all downstream panels until explicit user confirmation, and no UI handler, route, or button enables any write action.

**Status**: ❌ No booking, payment, ticket, or order was created.

### 2.3 Offline Duplicate-Booking Guard Is Not Live Atlas Evidence

- The duplicate-booking protection state machine (`smoke-tests/atlas/duplicate-booking-guard.mjs`, `smoke-tests/atlas/duplicate-booking-guard-offline-tests.mjs`) was validated **offline only** with fake clients.
- 48 offline tests passed, 0 failed. These tests demonstrate that the query-before-retry contract and state-machine logic are correctly implemented.
- These tests do **not** demonstrate that the duplicate-booking guard works against live Atlas responses. No live Atlas response was used as input to the guard.
- Offline test results must not be presented as live Atlas evidence.

**Status**: ❌ Offline duplicate-booking guard is not live Atlas evidence.

---

## 3. Evidence Summary

| # | Claim | Status | Evidence Source |
|---|---|---|---|
| 1 | Official Atlas Skill authorization succeeded. | ✅ Proven | Skill installation record; ATRIP browser authorization completion; CLI credential storage. |
| 2 | One production search returned five real offers. | ✅ Proven | Normalized JSON result: Shanghai PVG → Tokyo NRT/HND, 2026-09-04, 1 adult. |
| 3 | All offers are reference prices with `bookable: false`. | ✅ Proven | Response fields: `price_status: reference`, `bookable: false` on all 5 offers. |
| 4 | `TICKETING_ACTIVATION_REQUIRED` remains. | ✅ Proven | Consistent `bookable: false` across all 5 offers; pending ATRIP workspace action. |
| 5 | Sandbox rehearsal was attempted. | ❌ Not proven | Sandbox switch not executed; no Sandbox search performed. |
| 6 | A booking, payment, ticket, or order was created. | ❌ Not proven | No write operation of any kind was executed. |
| 7 | The duplicate-booking guard works against live Atlas. | ❌ Not proven | Offline tests only; no live Atlas response used as input. |

---

## 4. Safe Presenter Sentences

Use these sentences when describing Atlas status during the live demo:

> "Atlas authentication has been completed through the official Atlas Flight Booking Skill. One live read-only search returned five real production offers — Shanghai PVG to Tokyo NRT and HND. All five offers carry reference-price status with `bookable: false` due to `TICKETING_ACTIVATION_REQUIRED`. Ticketing activation is pending human action at the ATRIP workspace. No booking, payment, ticket, or order was created. Sandbox rehearsal was not attempted."

> "The offline duplicate-booking guard passes 48 tests with fake clients. This demonstrates that the contract and state machine are correctly implemented. It is not live Atlas evidence and must not be presented as such."

---

## 5. Prohibited Claims — Do Not State

The following claims are **false** and must not be made during the live demo or in any submission material:

- Atlas Sandbox search was executed or returned results.
- A booking, payment, ticket, or order was created through Atlas.
- The duplicate-booking guard was validated against live Atlas responses.
- Ticketing activation has been completed.
- Offers are bookable or can progress to a confirmed fare.
- Any credential, token, or `.env.local` content was accessed or is shown.
- Any existing file was modified to produce this disclosure.

---

## 6. Changed-Files Verification

This disclosure was created as a **single new file**:

- `docs/stitchcheck-atlas-live-disclosure.md` — **created**

**No existing file was modified.** No Atlas call was made. No environment was switched. No offer was selected. No order or payment was created. `.env.local` was not accessed.

---

## Footer

- **Created**: 2026-08-21
- **Last updated**: 2026-08-21
- **Author**: StitchCheck dev lead
- **Review status**: Final — ready for live-demo presenter and judge reference
- **No live Atlas call, environment switch, offer selection, order creation, or payment was made in the creation of this document.**
- **`.env.local` was not accessed.**
- **No existing file was modified.**
