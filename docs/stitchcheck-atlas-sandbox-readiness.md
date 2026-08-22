# StitchCheck — Atlas Sandbox Readiness Assessment

> **Status**: READINESS ASSESSMENT — not a live execution record  
> **Date**: 2026-08-21  
> **Owner**: StitchCheck dev lead  
> **Scope**: Document current Atlas integration readiness without making any live call, environment switch, search, offer selection, order creation, or payment.

---

## 1. Official Skill Installation and Authorization Status

The **Atlas Flight Booking Skill** was installed via the official installation path defined in `specs/atlas-skill-integration-spec.md` (Step 1):

```bash
npx --yes skills add https://github.com/atlas-doc/atlas-flight-booking-skill --skill atlas-flight-booking
```

- The Skill is **installed and recognized** by the agent.
- The companion `atlas-flight` CLI is auto-provisioned by the Skill on first invocation (minimum version `atlas-flight-booking==0.3.12`). No separate `pip` or `uv` installation is required or permitted.
- **Authorization completed** via the browser-based ATRIP authorization flow. The human opened the authorization link, signed in to the ATRIP workspace, and granted consent. Credentials are stored securely by the CLI via the OS secure credential facility. The agent never observed or handled plaintext credentials.
- No direct OAuth endpoint was constructed or called. The 404 root cause documented in `specs/atlas-skill-integration-spec.md` §2 confirmed that direct OAuth against Atlas is unsupported; the official Skill is the only valid integration path.

**Current status**: Skill installed, CLI provisioned, human authorization completed.

---

## 2. Real Production Search Status

After authorization, **one live search was executed against the production environment**:

- **Route**: Shanghai PVG → Tokyo NRT/HND
- **Date**: 2026-09-04
- **Passengers**: 1 adult
- **Result**: 5 real production-flight offers returned with normalized JSON.

All 5 offers carry the following status:

| Field | Value | Meaning |
|---|---|---|
| `price_status` | `reference` | Display/reference price only; not a confirmed bookable fare. |
| `bookable` | `false` | Offers cannot be used to create a booking at this time. |

The search demonstrated that:

- The Skill can invoke the CLI and return structured, normalized results.
- Real production-flight data is reachable through the authorized Skill.
- The `price_status` and `bookable` labelling is correctly applied.

**Current status**: Production search works; all returned offers are reference-only and non-bookable.

---

## 3. `TICKETING_ACTIVATION_REQUIRED` Blocker

The `bookable: false` and `price_status: reference` state on all 5 offers is caused by a **`TICKETING_ACTIVATION_REQUIRED`** condition.

- This means the ATRIP workspace has not yet activated ticketing for the account or application.
- Until ticketing activation is completed by a human at the ATRIP workspace, no offer can progress from reference price to a bookable fare.
- Ticketing activation is an **external human action** outside the scope of this repository, the Skill, or the agent. It must be performed in the ATRIP workspace administration interface.

**Impact**: No booking, payment, ticketing, or order creation can succeed until this blocker is resolved. This is the primary gate between "search works" and "end-to-end booking is possible."

**Current status**: Blocker identified; activation pending human action at ATRIP workspace.

---

## 4. Sandbox Switch Command

No Sandbox search has been performed yet. Before any Sandbox test can occur, the CLI environment must be switched from production to Sandbox.

The required command (from `specs/atlas-skill-integration-spec.md` Step 5):

```bash
atlas-flight environment use sandbox --json
```

- This switches the CLI's local service configuration to the Sandbox environment.
- The same Skill and commands continue to work after the switch.
- **This command has not been executed yet.**

**Current status**: Sandbox switch not performed; pending human decision to execute.

---

## 5. Requirement to Start a New Search After Environment Switch

Per the Atlas integration contract and the evidence index rules:

- **Any offer obtained before an environment switch expires immediately after the switch.**
- A **new search must be started** after switching environments. Prior results must not be reused, relabelled, or presented as Sandbox output.
- This applies in both directions: production → Sandbox and Sandbox → production.

This rule is documented in:

- `specs/atlas-skill-integration-spec.md` §3 Step 5: *"Any offer obtained before the switch expires; a new search must be started after switching."*
- `docs/smoke-test-atlas.md`, test case ATL-10: *"Atlas environment switched → Prior results invalidated → App requires a new search; old offers not reused."*
- Knowledge base: *"After switching Atlas environments, begin a new search and never reuse an earlier offer."*

**Current status**: Rule acknowledged; no search has been performed in Sandbox yet.

---

## 6. Fictional Passenger Data Only

All Atlas interactions — past, present, and future — use **synthetic, fictional passenger data only**.

- The production search (Shanghai PVG → Tokyo NRT/HND, 2026-09-04, 1 adult) used a synthetic passenger profile with no real personal information.
- The smoke-test plan (`docs/smoke-test-atlas.md`) defines the minimal search input with `"syntheticDemo": true` and `"confirmedItinerary": true`.
- No PII has been transmitted to Atlas, and no PII will be used in any future Sandbox or production test.
- All fixture data in `smoke-tests/atlas/fixtures/` is synthetic and fictional.

**Current status**: Confirmed — only fictional passenger data has been and will be used.

---

## 7. Explicit Human Review Before Sandbox Payment Confirmation

Per the safety rules in `specs/atlas-skill-integration-spec.md` §4 and the provider authorization matrix:

- **No payment, booking, ticketing, reservation, or order creation may occur without explicit human review and confirmation immediately before execution.**
- The agent must never autonomously confirm a payment or booking.
- The human must review the offer details, fare, route, passenger profile, and all terms before authorizing any write operation.
- This gate applies even after ticketing activation is complete and even in the Sandbox environment.

The StitchCheck UI enforces this at the application level:

- The confirmation gate in `app/src/components/RiskPanel.tsx` and `app/src/components/AlternativesPanel.tsx` blocks downstream panels until explicit user confirmation.
- No UI handler, route, or button enables any write action without passing through this gate.

**Current status**: Gate implemented and documented; no payment or booking has been attempted.

---

## 8. What Evidence Is Currently Proven

The following Atlas-related claims are supported by evidence:

| # | Claim | Evidence Source |
|---|---|---|
| 1 | The official Atlas Flight Booking Skill is installed and recognized. | Skill installation record; agent skill list. |
| 2 | Human authorization completed via the ATRIP browser flow. | Authorization flow completion; CLI credential storage. |
| 3 | The `atlas-flight` CLI is provisioned and operational. | CLI auto-provisioning on first invocation. |
| 4 | A live production search returned 5 real flight offers. | Normalized JSON result with route, dates, offer details. |
| 5 | Offers carry correct `price_status: reference` and `bookable: false` labelling. | Response field values from the live search. |
| 6 | The `TICKETING_ACTIVATION_REQUIRED` blocker is correctly identified and reported. | Consistent `bookable: false` across all 5 offers. |
| 7 | The read-only adapter boundary is correctly implemented offline. | `smoke-tests/atlas/adapter-offline-tests.mjs` — 89 passed, 0 failed. |
| 8 | The duplicate-booking protection state machine is correctly implemented offline. | `smoke-tests/atlas/duplicate-booking-guard-offline-tests.mjs` — 48 passed, 0 failed. |
| 9 | No write operation (booking, payment, ticket, order, verification) has been created. | Evidence index, provider authorization matrix, safety rules. |
| 10 | Only synthetic, fictional data has been used. | All fixture manifests and search inputs. |

---

## 9. What Remains Unproven

The following claims have **not** been demonstrated and remain unproven:

| # | Unproven Claim | Blocker / Dependency |
|---|---|---|
| 1 | Sandbox search returns structured alternatives. | Sandbox switch has not been executed. |
| 2 | Sandbox offers contain fields needed by the comparison view. | Sandbox search not yet performed. |
| 3 | Ticketing activation can be completed. | Pending human action at ATRIP workspace. |
| 4 | Offers become bookable after ticketing activation. | Depends on ticketing activation. |
| 5 | A booking can be created in Sandbox. | Depends on ticketing activation + Sandbox switch + new search. |
| 6 | A payment can be processed in Sandbox. | Depends on booking capability. |
| 7 | A ticket can be issued in Sandbox. | Depends on payment capability. |
| 8 | The duplicate-booking guard works against live Atlas responses. | Offline tests use fake clients; live validation not performed. |
| 9 | End-to-end booking reliability and error handling in production. | No production booking attempted; ticketing activation pending. |
| 10 | The `TICKETING_ACTIVATION_REQUIRED` blocker is resolvable by the hackathon deadline. | External dependency on ATRIP workspace administration. |

---

## Summary

| Area | Status |
|---|---|
| Skill installation | ✅ Installed and recognized |
| CLI provisioning | ✅ Auto-provisioned |
| Human authorization | ✅ Completed via ATRIP browser flow |
| Production search | ✅ 5 real offers returned |
| Offer labelling | ✅ `price_status: reference`, `bookable: false` |
| Ticketing activation | ❌ `TICKETING_ACTIVATION_REQUIRED` — pending ATRIP workspace action |
| Sandbox switch | ❌ Not executed |
| Sandbox search | ❌ Not performed |
| Sandbox booking rehearsal | ❌ Not attempted |
| Payment / ticketing / order | ❌ Not attempted; blocked by ticketing activation |
| Passenger data | ✅ Fictional only — no PII used |
| Human review gate | ✅ Implemented in UI and documented |
| Offline adapter tests | ✅ 89 passed, 0 failed |
| Offline duplicate-booking guard | ✅ 48 passed, 0 failed |

---

## Footer

- **Created**: 2026-08-21
- **Last updated**: 2026-08-21
- **Author**: StitchCheck dev lead
- **Review status**: Pending human review
- **No live call, transaction, environment switch, offer selection, order creation, or payment was made in the creation of this document.**
- **`.env.local` was not accessed.**
- **No existing file was modified.**
