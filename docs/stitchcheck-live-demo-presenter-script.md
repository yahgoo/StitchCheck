# StitchCheck Live-Demo Presenter Script

## Metadata

- **Target duration:** 120 seconds (2 minutes).
- **Format:** Timed narration with screen-action cues and visible-proof checkpoints.
- **Audience:** Hackathon judges or live-demo reviewers.
- **Data policy:** Synthetic fixtures only. No PII, no credentials, no real booking references.
- **Boundary:** No booking, payment, reservation, ticket, order, verification, or other write action is performed or claimed.

---

## Segment 1 — The Problem (0:00–0:18)

**Screen action:** App loads. Safety notice is visible. Header reads "StitchCheck — Synthetic Demo — No Live Services."

**Spoken narrative:**

> "Budget travelers face a hidden trap. When you stitch two separately purchased flights to save money, each ticket is an independent contract. If the first flight is delayed and you miss the second, the second airline has no obligation to rebook, protect, or refund you. The savings are visible at checkout — the exposure is not.
>
> StitchCheck gives travelers a review-first way to understand itinerary risk before committing. This is a local demo with synthetic data; the demo walkthrough itself makes no external service calls."

**Visible proof:** Safety notice panel. "Synthetic Demo" badge in header. No live-service claims on screen.

---

## Segment 2 — Extraction via OpenRouter Temporary Path (0:18–0:36)

**Screen action:** Upload panel appears with five fixture slots (GEM-01 through GEM-05). Select GEM-01. Extraction result populates itinerary fields beside the source screenshot.

**Spoken narrative:**

> "The user starts with a synthetic itinerary screenshot — fictional image, no real passenger data. We select GEM-01, a clear two-leg itinerary.
>
> Structured extraction uses a fictional local fixture. The label on screen reads: **Fictional itinerary — local demo fixture.** Direct Gemini 3.7 live extraction was verified separately via the Interactions API."

**Visible proof:** Upload panel with fixture selection. GEM-01 selected. Source label visible: `Fictional itinerary — local demo fixture`. Editable itinerary fields populated from fixture.

---

## Segment 3 — Human Correction (0:36–0:52)

**Screen action:** Itinerary review screen shows extracted fields. All fields are editable. Edit the second-leg flight number from SC-202 to SC-299. Correction note appears.

**Spoken narrative:**

> "Extracted fields are displayed for human review. Every field is editable — the traveler has full control. In this demo, the second-leg flight number is corrected from SC-202 to SC-299. The correction is recorded locally with a visible note.
>
> This review-and-correct step ensures no downstream panel acts on unverified data. The traveler confirms only what they have personally reviewed."

**Visible proof:** Editable fields visible. Flight number changed from SC-202 to SC-299. Correction note: "Changed secondLeg.flightNumber: SC-202 → SC-299."

---

## Segment 4 — Confirm Itinerary First (0:52–1:06)

**Screen action:** Scroll to show Risk and Alternatives panels in disabled state with lock icons and "Confirm itinerary first." Click "Confirm itinerary." Status banner appears. Panels unlock.

**Spoken narrative:**

> "Before confirmation, both the risk and alternatives panels are locked. They display: **Confirm itinerary first.** No risk calculation or alternative search begins until the user explicitly confirms.
>
> The user clicks Confirm. The panels activate. The status banner states that no external service call was made. This confirmation gate keeps the traveler in control at every step."

**Visible proof:** Disabled panels with `Confirm itinerary first` and lock icons (before). Status banner: "Itinerary confirmed. No external service call was made." Panels unlocked with placeholder data (after).

---

## Segment 5 — Risk Panel and Nosana Status (1:06–1:22)

**Screen action:** Risk panel shows medium risk band (score 0.42) with heuristic disclaimer and Nosana source label.

**Spoken narrative:**

> "The risk panel displays a heuristic risk estimate — medium risk with a score of 0.42. The disclaimer is explicit: **Synthetic local placeholder — not Nosana evidence.**
>
> Nosana's planned role is connection-risk analysis. In this demo, no Nosana workload has been executed or deployed. A smoke-test attempt was intentionally blocked before any network request due to missing infrastructure. What you see here is a local placeholder shape only."

**Visible proof:** Risk panel: medium band, score 0.42, heuristic disclaimer. Source label: `Synthetic local placeholder — not Nosana evidence`.

---

## Segment 6 — Atlas Search Status and Alternatives (1:22–1:40)

**Screen action:** Alternatives panel shows two synthetic options with Atlas source label. Open comparison view for side-by-side display.

**Spoken narrative:**

> "The alternatives panel shows synthetic options labelled: **Synthetic local placeholder — not Atlas Sandbox evidence.** These are local fixture shapes for UI demonstration.
>
> Separately, Atlas authentication has been completed through the official Atlas Flight Booking Skill. Two live read-only production searches returned real offers \u2014 five from Shanghai PVG to Tokyo NRT/HND, and eight from Singapore SIN to Bangkok BKK (ATL-LIVE-01). All offers carry reference-price status with ticketing activation pending. No booking, payment, or order was created from those searches. The demo panels you see now remain local placeholders."

**Visible proof:** Alternatives panel: two options with source label `Synthetic local placeholder — not Atlas Sandbox evidence`. Comparison table visible showing original itinerary alongside a placeholder alternative.

---

## Segment 7 — Keep/Switch Outcome and Close (1:40–2:00)

**Screen action:** Decision panel shows "Keep current plan" and "Switch to alternative." Select "Keep current plan." Confirm decision. Final screen appears with no-external-action statement and metadata.

**Spoken narrative:**

> "The traveler makes a local decision — Keep the current plan or Switch to an alternative. This is a UI-only selection. No booking, payment, reservation, ticket, order, verification, or other external action occurs.
>
> The final screen states it explicitly: no external action has been created. Direct Gemini 3.7 was live-verified separately. Nosana uses local fallback in this walkthrough. Atlas has shown reference-price search results only — no write action of any kind.
>
> StitchCheck demonstrates a review-first flow that keeps the traveler in control at every step — an honest local demo with synthetic data, the demo UI itself makes no live service calls."

**Visible proof:** Decision buttons visible. Final statement: "No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only." Metadata: `noOrderCreated: true`, `syntheticDemo: true`, `externalCallsMade: false`.

---

## Timing Summary

| Segment | Time | Duration | Topic |
|---|---|---|---|
| 1 | 0:00–0:18 | 18 s | Distressed traveler problem |
| 2 | 0:18–0:36 | 18 s | Gemini/OpenRouter extraction |
| 3 | 0:36–0:52 | 16 s | Human correction |
| 4 | 0:52–1:06 | 14 s | Confirm itinerary first |
| 5 | 1:06–1:22 | 16 s | Risk panel and Nosana status |
| 6 | 1:22–1:40 | 18 s | Atlas search status and alternatives |
| 7 | 1:40–2:00 | 20 s | Keep/Switch outcome and close |
| **Total** | | **120 s** | **2 minutes** |

---

## Required Evidence Labels

All three exact labels must appear on screen at the indicated moments:

| # | Exact label | Segment | Panel |
|---|---|---|---|
| 1 | `OpenRouter temporary path — not direct Gemini validation` | 2 | Itinerary review |
| 2 | `Synthetic local placeholder — not Nosana evidence` | 5 | Risk panel |
| 3 | `Synthetic local placeholder — not Atlas Sandbox evidence` | 6 | Alternatives panel |

---

## Claim-Boundary Verification

Before delivering this script, verify every spoken claim against the evidence record.

| Claim in script | Evidence source | Boundary |
|---|---|---|
| "Fictional itinerary — local demo fixture" | `app/src/data/labels.ts`, `app/src/data/fixtures.ts` | Browser walkthrough uses local fixture; direct Gemini 3.7 live-verified separately. |
| "Direct Gemini 3.7 live extraction succeeded" | `smoke-tests/gemini/results/results-gemini-3.7-flash-success.json` | Verified via Interactions API; schema-valid, no fallback. |
| "Nosana workload has been executed or deployed" — **negated** | `smoke-tests/nosana/results/2026-08-20T15-53-43Z/`, `README.md` | Blocked before any network request. No deployment, no execution. |
| "Atlas authentication completed through the official Atlas Flight Booking Skill" | `docs/stitchcheck-submission-evidence-index.md` Provider Status table | Authentication via official Skill and CLI only. |
| "One live read-only search returned five real production offers" | `docs/stitchcheck-submission-evidence-index.md` Provider Status table, `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/atlas-live-result.md` | Two production searches: PVG→NRT/HND (5 offers) and SIN→BKK (8 offers via ATL-LIVE-01). Reference prices only. |
| "All five offers carry reference-price status with ticketing activation pending" | `docs/stitchcheck-submission-evidence-index.md` — `price_status: reference`, `bookable: false`, `TICKETING_ACTIVATION_REQUIRED` | No bookable offer. No booking, payment, ticket, or order created. |
| "Demo panels remain local placeholders" | `app/src/data/labels.ts`, `app/src/data/fixtures.ts` | UI fixture shapes, not live Atlas output. |
| "No booking, payment, reservation, ticket, order, verification, or other external action" | `app/src/App.tsx`, `app/src/data/labels.ts`, `docs/SPECS.md` | No UI handler, route, or button enables any write action. |

### Prohibited claims — do not add

- Direct Gemini was called, validated, or produced results.
- Nosana was executed, deployed, authenticated, or returned results.
- Atlas Sandbox search was executed (the live search used production Atlas, not Sandbox).
- Any local placeholder is a live provider result.
- Any booking, payment, reservation, ticket, order, or verification was created.
- Credentials, PII, or raw provider output are shown.

---

## Recovery Notes

- If a click is missed or narration does not match the screen: **stop**, reload the page, and restart the segment.
- If the browser shows an error or stale state: **stop**, close and reopen the browser, and restart from Segment 1.
- If a required label is missing or unreadable: **stop**, reload, verify labels in `app/src/data/labels.ts`, and restart the segment.
- No source files, configuration, or fixture data are modified during recovery.
