# StitchCheck — Eight-Slide Deck Final Copy

> **Source of truth for slide narration.** All copy below is presentation-ready.
> Speaker notes follow each slide. Visual direction is noted in brackets.
> No file other than this one was created or modified.

---

## Slide 1 — Title

**Headline:** StitchCheck

**Tagline:** Review before you commit.

**Bullets:**

- Upload synthetic itinerary screenshots.
- Extract, review, correct, confirm.
- Compare risk against safer alternatives.
- Keep or Switch — no booking, no external action.

**Badge (top-right):** Synthetic Demo — No Live Services

**Speaker note:**
StitchCheck is a local demo that helps budget travellers understand the hidden risk of stitching two separately purchased flight tickets. The local demo walkthrough runs with synthetic fixture data — the demo UI itself makes no live service calls. Separately, OpenRouter and Atlas production have been called outside the demo UI; their status is reported in Slide 8.

---

## Slide 2 — The Problem

**Headline:** Two tickets, two contracts, one gap

**Bullets:**

- Two separate tickets = two independent contracts.
- A missed connection means the second airline has no obligation to rebook or refund.
- Savings are visible at checkout; exposure is not.
- Travellers need a reviewable, correctable view before deciding.

**Visual direction:**
Side-by-side: cluttered itinerary screenshot (left, using GEM-03 fixture) with callout boxes highlighting connection time and separate-ticket warning (right).

**Speaker note:**
Budget travellers often book two separate tickets to save money, but they may not realise that a tight connection between independently booked flights carries real exposure. If the first flight is delayed, the second airline has no obligation to help. StitchCheck surfaces this risk before the traveller commits.

---

## Slide 3 — The Review-First Solution

**Headline:** Screenshot → Extract → Review → Confirm → Decide

**Bullets:**

- Synthetic screenshot fixtures feed local extraction.
- Extracted fields are fully editable — the user can correct any value.
- Explicit confirmation is required before downstream panels unlock.
- Risk and alternatives placeholders appear only after confirmation.
- The user makes one local decision: Keep or Switch.

**Visual direction:**
Horizontal flow diagram with five boxes and icons. An arrow from "Confirm" gates the downstream panels. Original diagram, no external icons.

**Speaker note:**
The review-first design ensures the traveller always has the final say. Extraction produces a starting point, not a conclusion. The user can correct any field, and nothing downstream — risk scoring, alternative search — activates until the user explicitly confirms the itinerary.

---

## Slide 4 — Human Control Is the Gate

**Headline:** Confirm itinerary first

**Bullets:**

- Before confirmation, risk and alternatives panels display: `Confirm itinerary first`.
- Controls are visually locked with a lock icon and `aria-disabled`.
- No risk calculation or alternative search begins before confirmation.
- Confirmation is a single explicit user action — not automatic.
- The gate cannot be bypassed by any UI shortcut.

**Visual direction:**
Two screenshots side-by-side from the local demo: locked state (left) and unlocked state (right) with placeholder data.

**Speaker note:**
The confirmation gate is the central safety mechanism. It ensures that the traveller has actually reviewed and approved the extracted data before any downstream processing occurs. No automated step can skip this gate — it requires an explicit human action every time.

---

## Slide 5 — Three Essential Service Roles

**Headline:** Each service has one job

**Role cards:**

| Service | Planned Role | Current Status |
|---|---|---|
| **Gemini** | Structured itinerary extraction from screenshots into editable fields. | Direct Gemini 3.7 live extraction succeeded via the Interactions API; schema-valid, no fallback. Browser walkthrough uses a local fixture. |
| **Nosana** | Planned connection-risk workload returning a heuristic band/score with visible status. | Local fixtures and workload skeleton only. Live execution remains unverified. |
| **Atlas Sandbox** | Planned read-only alternative search for safer flight options. | Authentication succeeded. Two production searches succeeded (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers via ATL-LIVE-01). All reference-price only. Ticketing activation pending. |

**Evidence labels (displayed below the table):**

- `OpenRouter temporary path — not direct Gemini validation`
- `Synthetic local placeholder — not Nosana evidence`
- `Synthetic local placeholder — not Atlas Sandbox evidence`

**Speaker note:**
Each service has a clearly defined role. Gemini provides the structured extraction that feeds the review screen — GEM-01 succeeded through the OpenRouter temporary path, but direct Gemini remains unexecuted. Nosana is planned to deliver a heuristic risk assessment; the local harness exists but live execution remains unverified. Atlas authentication succeeded. Two production searches returned reference-price offers (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers via ATL-LIVE-01); however, ticketing activation is still pending and no booking was created. All risk data in the demo carries the label: Synthetic local placeholder — not Nosana evidence. All alternatives data carries the label: Synthetic local placeholder — not Atlas Sandbox evidence.

---

## Slide 6 — Trust, Safety, and Scope

**Headline:** Synthetic data. Human gate. No write actions.

**Checklist:**

- ✓ All fixtures are synthetic: invented airport codes, fictional flight numbers, placeholder prices.
- ✓ No credential values appear in the repository.
- ✓ No booking, payment, reservation, ticket, order, verification, or write action exists.
- ✓ Atlas is designed as Sandbox/search-only when later executed.
- ✓ Human review and confirmation gate every downstream step.

**Visual direction:**
Checklist graphic with green check marks. Small inset of the final decision screen showing the no-order statement.

**Speaker note:**
Safety is not an afterthought — it is baked into every layer of the demo. No personal data enters the demo system. Live Atlas production searches returned flight offer data (routes, prices, schedules) — not passenger or personal data. No credential is stored in source code. And critically, no action that creates a booking, processes a payment, or triggers any external write exists anywhere in the application. The scope ends at the Keep-or-Switch decision.

---

## Slide 7 — Demo Walkthrough

**Headline:** Six steps — the demo UI makes no external calls

**Steps:**

1. Open the local app and acknowledge the synthetic-demo notice.
2. Select synthetic screenshot fixtures (GEM-01 through GEM-05).
3. Review and correct extracted itinerary fields.
4. Confirm the itinerary — panels unlock with local placeholder data.
5. Compare options and choose Keep or Switch.
6. View the final statement: no booking or external action created.

**Visible labels (at bottom of slide):**

- `OpenRouter temporary path — not direct Gemini validation`
- `Synthetic local placeholder — not Nosana evidence`
- `Synthetic local placeholder — not Atlas Sandbox evidence`

**Visual direction:**
Numbered step list with small screenshot thumbnails from the local demo at each stage. Alternatively, one annotated wide screenshot of the confirmed state.

**Speaker note:**
The walkthrough is designed to be repeatable and self-contained. At every step, the operator can point to a specific label or safety message. The three required source labels are visible at their respective stages, making it clear which data is local placeholder and which came from the temporary extraction path.

---

## Slide 8 — Status and Next Steps

**Headline:** Local demo ready. Live validation separately gated.

**Status dashboard:**

| Component | Status | Detail |
|---|---|---|
| **Local demo** | ✅ Ready | Type-check, production build, and browser walkthrough all pass. |
| **Gemini (direct)** | ⬜ Not executed | Pass/fail intentionally blank. |
| **Gemini (OpenRouter path)** | 🟡 Temporary | GEM-01 succeeded via OpenRouter temporary path. Labelled accordingly. |
| **Nosana** | ⬜ Not verified | Local harness exists. Live execution remains unverified. |
| **Atlas** | 🟡 Partial | Authentication succeeded. Two production searches succeeded (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers). All reference-price only. Ticketing activation pending. No booking, payment, ticket, or order was created. |
| **Atlas duplicate-booking guard** | 🔵 Offline only | 48 offline tests passed. Not live Atlas evidence. |

**Next goals:**

- Obtain human authorization and credentials for each remaining service smoke test.
- Complete Nosana prerequisites (workload design, submission adapter, target environment).
- Activate Atlas ticketing at ATRIP workspace (requires human admin action) and attempt sandbox booking rehearsal.
- Execute direct Gemini with confirmed model/API configuration.
- Finalise submission assets (README, demo narrative, slide recording).

**Speaker note:**
We have a working local demo that proves the review-first flow, the confirmation gate, and the Keep-or-Switch decision — the demo UI itself uses synthetic data and makes no live service calls. Atlas authentication succeeded; two production searches returned reference-price offers (PVG→NRT/HND: 5; SIN→BKK: 8), but ticketing activation is still pending and no booking was created. The Nosana live execution remains unverified. Direct Gemini 3.7 live extraction was verified separately via the Interactions API. The Atlas offline duplicate-booking guard passed 48 tests but is offline-only — not live Atlas evidence. No booking, payment, reservation, ticket, order, verification, or cancellation occurred. Each live-service gate must be passed independently before any live-integration claim can be made.

---

*End of deck copy. Eight slides. No provider status was upgraded in this document.*
