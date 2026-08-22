# StitchCheck — Atlas Ticketing-Blocker Support Package

> **Status**: READY TO SEND — no API calls made, no code modified, no credentials exposed  
> **Date**: 2026-08-21  
> **Constraint**: This document contacts no one, invokes no tool, and modifies no file. It is a prepared message bundle for human review and dispatch.

---

## Sanitized Fact Summary

The following facts are established from live-demo execution and read-only audits. No credentials, tokens, URLs, or internal identifiers are included.

| # | Fact | Source |
|---|---|---|
| 1 | **Authentication succeeds.** The Atlas Flight Booking Skill was installed and ATRIP browser-based authorization completed successfully. Credentials are stored in the OS secure credential facility. | Live demo 2026-08-21 |
| 2 | **Production Search succeeds.** One live read-only search (Shanghai PVG → Tokyo NRT/HND, 2026-09-04, 1 adult) returned 5 real production-flight offers with normalized JSON. A second search (SIN → BKK, 2026-09-10, 1 adult) returned 8 offers. | Live demo 2026-08-21 |
| 3 | **All offers are reference-priced and `bookable: false`.** Every returned offer carries `price_status: reference` and `bookable: false`. No offer can progress to a confirmed fare. | Live demo 2026-08-21 |
| 4 | **Error is `TICKETING_ACTIVATION_REQUIRED`.** The `bookable: false` state is caused by an account-level `TICKETING_ACTIVATION_REQUIRED` condition. The ATRIP workspace has not yet activated ticketing for this account/application. | `auth status` response |
| 5 | **No booking, payment, or ticketing occurred.** Zero write operations of any kind were executed — in production or Sandbox. No order was created, no payment was processed, no ticket was issued. | Live-demo evidence log |

---

## VCC/318 Offline Protection vs. Account Activation — Explicit Distinction

These are **two completely independent issues** that must not be conflated:

| Aspect | VCC/318 Duplicate-Booking Guard | `TICKETING_ACTIVATION_REQUIRED` |
|---|---|---|
| **What** | Client-side state machine preventing blind retry after a 318 (duplicate booking) response | Account-level activation requirement at the ATRIP workspace |
| **Where** | StitchCheck local code (`duplicate-booking-guard.mjs`) | Atlas/ATRIP backend |
| **When it triggers** | After an order creation attempt receives a 318 response | Before any offer can progress from `reference` to `bookable` |
| **Who resolves** | The application (query existing order, then decide with human confirmation) | A human at the ATRIP workspace (activate ticketing) |
| **Current status** | 48 offline tests pass; never triggered against live Atlas | Active blocker on all returned offers |
| **Effect on each other** | **None** — the guard cannot cause or resolve the activation requirement | **None** — the activation requirement has nothing to do with duplicate bookings |

**Bottom line:** The VCC/318 guard is StitchCheck's own safety mechanism. It is fully implemented and tested offline. It has zero bearing on `TICKETING_ACTIVATION_REQUIRED`, which is an Atlas-side account activation matter.

---

## 1. WhatsApp Message to Harry

> Hi Harry — quick update on the Atlas integration. Auth is working ✅ and production search returns real offers. However every offer comes back `bookable: false` with `price_status: reference` because of a `TICKETING_ACTIVATION_REQUIRED` flag on the account. This means search works but we can't create orders, process payments, or issue tickets yet. It's an account-level activation step at the ATRIP workspace — nothing to do with our code or the VCC/318 duplicate-booking guard (that's our own safety layer, fully tested offline, completely separate). Could you check with the Atlas team on the minimum steps to get ticketing activated — either in Sandbox for rehearsal or Production for the real flow? I'll send a formal email to Eva/Support as well. Thanks!

---

## 2. Formal Email to Eva / Atlas Support

**Subject:** StitchCheck Hackathon — `TICKETING_ACTIVATION_REQUIRED` Blocker — Request for Activation Guidance

---

Dear Eva / Atlas Support Team,

I am writing regarding a ticketing activation blocker we have encountered during our hackathon integration with the Atlas Flight Booking Skill.

### Current Status

We have successfully completed the following:

1. **Authentication**: The Atlas Flight Booking Skill was installed via the official path (`npx skills add`). Browser-based ATRIP authorization completed successfully. Credentials are stored securely via the OS credential facility.

2. **Production Search**: We executed live read-only searches against the production environment. Real flight offers were returned with normalized JSON — confirming that the Skill, CLI, and authentication chain are functioning correctly.

3. **Offer Status**: All returned offers carry `price_status: reference` and `bookable: false`. No offer can progress to a confirmed, bookable fare.

4. **Blocker Identified**: The `auth status` response indicates `TICKETING_ACTIVATION_REQUIRED`. This is an account-level condition preventing any offer from advancing beyond reference pricing.

### What Has Not Occurred

For the avoidance of doubt:

- No booking, order, payment, or ticketing operation was attempted.
- No Sandbox environment switch was executed.
- No credentials were exposed or logged.
- No application code was modified to produce this status.

### Important Clarification — VCC/318 vs. Account Activation

Our application includes a **client-side duplicate-booking protection guard** that handles HTTP 318 responses. This is a StitchCheck component — not an Atlas feature. It is fully implemented and passes 48 offline tests. It is **completely independent** of `TICKETING_ACTIVATION_REQUIRED` and has no effect on account activation status. We raise this only to pre-empt any conflation of the two issues.

### Questions

To unblock our integration, we would be grateful for clarification on the following:

#### Search
1. Is there any configuration or account setting required beyond authorization to enable production Search? (Our searches are already returning results, so this appears to be working.)

#### Verify
2. Does the `TICKETING_ACTIVATION_REQUIRED` blocker also prevent the read-only `offer verify` operation, or is Verify available even while ticketing is inactive?

#### Order
3. What specific activation steps must be completed before offers carry `bookable: true` and orders can be created?
4. Is there a separate error code or `ticketing_blocker` value for each distinct activation step, or are they all reported as `TICKETING_ACTIVATION_REQUIRED`?

#### Payment
5. Once ticketing is activated, is there a minimum balance requirement before payment can be processed?
6. Can balance be checked programmatically via the CLI?

#### Ticketing
7. After a successful order and payment, what is the expected ticketing flow? Is `order status` polling sufficient to confirm ticket issuance?
8. Can `TICKETING_ACTIVATION_REQUIRED` be resolved programmatically (e.g., via an API call), or does it always require manual action in the ATRIP workspace?

#### Sandbox Activation
9. What is the minimum steps to enable Sandbox booking (search → verify → order → pay) for rehearsal purposes?
10. Does `TICKETING_ACTIVATION_REQUIRED` also block Sandbox order creation, or is Sandbox more permissive?
11. Is there a test balance pre-loaded for Sandbox accounts?

#### Production Activation
12. What is the exact sequence to move from `TICKETING_ACTIVATION_REQUIRED` to full production ticketing capability?
13. Does this require UAT completion first, or can UAT and activation proceed in parallel?

#### UAT
14. What UAT flows are required before production ticketing is activated?
15. Is there a UAT testing interface in the ATRIP workspace, and what does it validate?

### Request

We respectfully request guidance on the **minimum steps to enable either Sandbox booking or production ticketing** so that we can complete our hackathon integration demo.

Thank you for your time and support. We look forward to your response.

Best regards,  
StitchCheck Team

---

## Appendix: Source Documents

| Document | Role |
|---|---|
| `docs/stitchcheck-atlas-skill-audit.md` | Read-only audit of the Atlas Flight Booking Skill — full command catalog, error model, identifier flow, and discrepancy analysis |
| `docs/stitchcheck-atlas-sandbox-diagnosis.md` | Sandbox integration diagnosis — environment-switch procedure, credential model, `TICKETING_ACTIVATION_REQUIRED` scope analysis, safe smoke-test plan |
| `docs/stitchcheck-atlas-live-disclosure.md` | Live-demo disclosure — exact statement of what was and was not demonstrated |
| `docs/stitchcheck-opus-nosana-atlas-resolution-plan.md` | Cross-provider resolution plan — VCC/318 vs. `TICKETING_ACTIVATION_REQUIRED` distinction |
| `skills/stitchcheck-demo-media/SKILL.md` | Demo media skill — evidence-label and safety constraints |
| `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/` | Timestamped live-demo evidence (Atlas, Gemini, Nosana results and summary) |

---

*End of support package. No API calls were made. No code was modified. No credentials were exposed. No contact was sent — this document is prepared for human review and dispatch only.*
