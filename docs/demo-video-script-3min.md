# StitchCheck Demo Video — 3-Minute Script and Shot List

## Metadata

- **Target duration:** exactly 3:00 (180 seconds).
- **Format:** Screen-capture walkthrough with burned-in captions and voiceover.
- **Audience:** Hackathon judges and reviewers (Daytona HackSprint — Alibaba × Atlas Travel).
- **Sample route:** CGK ↔ DPS (Jakarta ↔ Bali), fictional test itinerary, 2026-09-15, invented flight numbers SC-101 / SC-202→SC-299. No real passenger data.
- **Narration source of truth:** wording adapted from `docs/hackathon-demo-script.md`.
- **Claim boundary:** wording restricted to what `docs/evidence-status.md` permits. Browser walkthrough uses fictional local fixtures; live provider processing only where explicitly labelled. Sandbox/mock only — no real booking, payment, or ticket is created or claimed.
- **Voice spec:** Kokoro ONNX local TTS, voice `af_heart`, locale `en-us`, speed 0.95; no external TTS calls.

---

## 1. Timestamped Narration Script

### Segment A — Problem (0:00–0:15, 15 s, ~38 words)

**Visual:** Title card "StitchCheck" on dark background → cut to the sample itinerary screenshot.

**Voiceover:**

> A cheap self-transfer flight looks like a smart deal at checkout. But separately booked tickets are independent contracts. If the first leg is delayed and you miss the second, the second airline owes you nothing. StitchCheck shows the full risk picture before you commit.

**On-screen proof:** Title card; no live-service claims.

---

### Segment B — Core Loop (0:15–1:30, 75 s, ~185 words)

**Visual:** App walkthrough — upload → extraction → review → risk → alternatives → sandbox rehearsal.

**Voiceover (split at shot boundaries):**

> **[0:15–0:25 · Upload]** The traveller uploads a fictional itinerary screenshot — no real passenger data.

> **[0:25–0:40 · Extraction]** StitchCheck extracts the itinerary fields: airlines, flight numbers, origins, destinations, dates, and times. Every extracted field is fully editable. MiniMax M3 via OpenRouter — live extraction validated.

> **[0:40–0:50 · Confirm]** On Review trip the traveller clicks **Check my itinerary**. That freezes the confirmed snapshot; downstream risk, recovery, and search all use that snapshot.

> **[0:50–1:05 · Risk]** The risk panel examines connection duration, delay assumptions, and the potential failure cascade. The browser walkthrough shows a local fixture risk score of zero point two nine three, in the medium band — an indication, not a guaranteed probability. Separately, a Nosana live job completed with a risk score of zero point two eight nine five, at a cost of four point four cents.

> **[1:05–1:18 · Alternatives]** The alternatives panel lists twenty Atlas offers, sorted by price, with the lowest price shown first. One action — **Verify and select plan** — verifies the fare before any plan is selected.

> **[1:18–1:30 · Mock ticketing]** The Atlas Sandbox rehearsal walks Confirm → Order → Pay → Ticketed entirely in the test environment: no real booking, no real charge, no airline ticket is ever created. The supervised rehearsal record reached the ticketed state — order TESTA-2026-08-29, PNR S-30798.

**On-screen proof:** Editable fields; `Corrections recorded`; risk band `medium` with score 0.293; source tags per Section 4; sandbox rehearsal panel terminal copy.

---

### Segment C — Technical Merit (1:30–2:15, 45 s, ~110 words)

**Visual:** Provider status panel → safety-architecture callout cards (text overlays) → test-suite summary.

**Voiceover:**

> Under the hood, three providers do real work. MiniMax M3 via OpenRouter performs live extraction — schema-validated, no fallback. Nosana runs the risk workload as a decentralized GPU job — one live job accepted and completed, result recovered and validated. Atlas Sandbox powers flight search and fare verification — strictly read-only. The app runs on Alibaba Cloud infrastructure.
>
> Safety is architecture, not a disclaimer. A confirmation gate keeps every downstream panel locked until the traveller confirms. Labels are chosen from evidence fields — source, executed, fallback used — so an offline fixture can never be labelled as live evidence. Cross-provider tests enforce that invariant. The Nosana client refuses to run without explicit transport and authorization. Nothing writes without an explicit human confirmation.

**On-screen proof:** Provider status indicators; evidence labels; test result summary.

---

### Segment D — Wow Factor (2:15–2:45, 30 s, ~72 words)

**Visual:** Slow zoom back to the corrected flight-number field → `Corrections recorded` note → locked-then-unlocked panels.

**Voiceover:**

> The moment that matters: the extraction gets the second-leg flight number wrong — SC-202 instead of SC-299. The traveller simply edits the field, and the correction is recorded locally. Nothing downstream runs until the human confirms. The system proposes; the traveller decides. Every panel stays locked until confirmation, and no external action ever happens without it. That human boundary is the product.

**On-screen proof:** `Corrections recorded (1)` with note `User corrected secondLeg.flightNumber from SC-202 to SC-299`; confirmation gate behaviour.

---

### Segment E — Close (2:45–3:00, 15 s, ~36 words)

**Visual:** End card: Nosana + Atlas + Alibaba Cloud logos/names, safety statement, "StitchCheck — validate before you commit."

**Voiceover:**

> StitchCheck: validate before you commit. Powered by Nosana, Atlas, and Alibaba Cloud. Everything you saw was sandbox and mock — no booking, payment, or ticket was created. Safe, reproducible, and honest.

**On-screen proof:** Closing statement: "No booking, payment, reservation, ticket, order, verification, or other write action has been created."

---

## 2. Shot List

| # | Time | Beat | Shot / Screen Content | Camera / Motion | Exact UI wording on screen |
|---|------|------|-----------------------|-----------------|---------------------------|
| S1 | 0:00–0:05 | Title | Title card: "StitchCheck" branding on dark background | Static, fade-in | — |
| S2 | 0:05–0:15 | Problem | Sample itinerary screenshot (`sample-itinerary-screenshot.png`) over title | Slow push-in | — |
| S3 | 0:15–0:25 | Screenshot upload | Upload control; screenshot appears in app | **Zoom in** on the drop zone as the image lands | — |
| S4 | 0:25–0:40 | Extraction moment | Editable itinerary fields appearing leg-by-leg (CGK→DPS SC-101 08:00–10:30; DPS→CGK SC-202 13:00–15:45); connection 150 min | Slow **zoom in** on fields as they populate | `Source: AI extraction (MiniMax M3 via OpenRouter) · live` (label shown when live-labelled flow is used) / `Local fixture` (default browser walkthrough) |
| S5 | 0:40–0:50 | Human confirmation | Review trip screen; cursor clicks the confirm button; downstream panels locked → unlocked | Pan down to the button, hold on click | `Check my itinerary`; locked hint `Confirm itinerary first` |
| S6 | 0:50–1:05 | Risk explanation | Risk panel: connection duration, delay-assumption disclaimer, risk band | **Zoom in** on score and band, then on the disclaimer | Score `0.293`, band `medium`; `Heuristic risk estimate only…`; source tag `Local fallback — not Nosana evidence`; Nosana caption overlay: `Nosana evidence — remote job succeeded; result from decentralized GPU workload.` (score 0.2895, cost $0.044 — reconciled offline evidence) |
| S7 | 1:05–1:18 | Alternatives panel | Featured card plus expanded list of 20 cards, price-sorted; cursor clicks the featured card's action button | Wide framing of the grid, then **zoom in** on the featured card and button | `Live Atlas alternatives (20)`; `Lowest price shown`; `Verify and select plan` → `Verifying…`; `See more live alternatives (19)`; source tag `Local fixture` / `Atlas Sandbox — live Search/Verify` per evidence state |
| S8 | 1:18–1:30 | Mock ticketing flow | Sandbox rehearsal panel stepping through Confirm → Order → Pay → Ticketed | Step cuts on each state change; hold on terminal copy | Badge `Atlas Sandbox rehearsal` + `Test environment only`; checkbox `I understand this is a Sandbox test: no real booking, no real charge, no airline ticket will ever be created.`; buttons `Create sandbox test order`, `Review sandbox payment (test)`, `Pay sandbox test order (simulated)`; status `Sandbox test order created (unpaid, simulated). No real charge has occurred.`; terminal `Sandbox rehearsal complete: a simulated ticket was issued in the test environment. No real ticket exists.`; footnote `Sandbox only — synthetic passenger — no real payment and no real ticket` |
| S9 | 1:30–1:48 | Providers | Provider status panel: MiniMax M3 / Nosana / Atlas rows | Slow rack down the list | `MiniMax M3 via OpenRouter — live extraction validated`; `Nosana — live job completed, result validated`; `Atlas Sandbox — live Search/Verify` |
| S10 | 1:48–2:15 | Safety architecture | Text-overlay callout cards over a dimmed app background | Static cards, staggered fade-in | Callouts: confirmation gate; evidence-driven labels; offline client boundary; Alibaba Cloud infrastructure |
| S11 | 2:15–2:30 | User correction moment | Flight-number field edited SC-202 → SC-299; correction note appears | **Zoom in** on the field, then on the note | `Corrections recorded`; note `User corrected secondLeg.flightNumber from SC-202 to SC-299` |
| S12 | 2:30–2:45 | Human boundary | Locked panels before confirm vs unlocked after; decision controls | Split-screen or wipe transition | `Confirm itinerary first`; decision options `Keep` / `Switch` |
| S13 | 2:45–3:00 | Close | End card: Nosana + Atlas + Alibaba Cloud; safety statement | Fade-in, hold | `No booking, payment, reservation, ticket, order, verification, or other write action has been created.` |

---

## 3. Zoom Shots, Subtitle Positions, and Voiceover Cues

### Zoom shots (explicit)

| Shot | Zoom target | Type | Timing |
|------|-------------|------|--------|
| S2 | Itinerary screenshot over title | Slow push-in (110% → 125%) | 0:05–0:15 |
| S3 | Upload drop zone | Quick zoom-in on image landing | 0:20–0:24 |
| S4 | Editable fields as they appear | Slow zoom-in, 100% → 120%, eased | 0:26–0:38 |
| S6 | Risk score `0.293` + band `medium`, then disclaimer | Two-stage zoom-in, hold 1.5 s each | 0:52–1:02 |
| S7 | Featured alternative card + `Verify and select plan` button | Zoom-in before click, release after verify banner | 1:10–1:16 |
| S8 | Terminal ticketing copy | Gentle zoom-in on final sentence | 1:26–1:30 |
| S11 | Corrected flight-number field, then `Corrections recorded` note | Slow zoom-in, 130% | 2:17–2:28 |

Rule: one primary zoom per shot; never zoom while narration is delivering the safety boundary sentence (let the words carry).

### Subtitle positions

- **Default:** bottom-center, max 2 lines, ≥48 px margin from the bottom edge; never overlap the app's source-tag labels.
- **Shots S4/S6/S7 (dense panels):** move captions to **top-center** so evidence labels (`Local fallback — not Nosana evidence`, `Live Atlas alternatives (20)`, verify banner) stay legible.
- **Shot S8 (ticketing panel):** captions **bottom-left**, panel content right-weighted; keep the footnote `Sandbox only — synthetic passenger — no real payment and no real ticket` unobscured.
- **Shots S1/S13 (cards):** captions **below the card title**, centered.
- Burned-in captions must match the voiceover verbatim; quoted UI labels appear in the captions exactly as rendered in the app.

### Voiceover cues per shot

| Shot | Cue | Delivery |
|------|-----|----------|
| S1–S2 | Start narration on title fade-in complete | Measured, problem-setting tone |
| S3 | Begin "uploads a fictional itinerary" exactly as the image lands | Sync action + word |
| S4 | Say "MiniMax M3 via OpenRouter — live extraction validated" only after the source tag is visible | Slight pause before the label sentence |
| S5 | Say "Check my itinerary" in sync with the click | Emphasize the button name |
| S6 | Pause after "medium band" before the disclaimer; slower pace for the Nosana numbers (0.2895, $0.044) | Deliberate, evidence tone |
| S7 | Say "twenty Atlas offers, sorted by price" while the expanded list is visible; "Verify and select plan" in sync with the click | Neutral, factual |
| S8 | One sentence per state change (Confirm → Order → Pay → Ticketed); final sentence over the terminal copy | Calm, unambiguous — safety claim |
| S9 | Rack down the provider list in narration order: MiniMax M3, Nosana, Atlas, Alibaba Cloud | Confident, quickening pace |
| S10 | One clause per callout card | Crisp, technical |
| S11 | "SC-202 instead of SC-299" spoken while the field visibly changes | The wow beat — slight slow-down |
| S12 | "The system proposes; the traveller decides." on the transition frame | Emphasis line |
| S13 | Final line lands before the end card fades; 1 s of silence after "Safe, reproducible, and honest." | Resolve, then silence |

---

## 4. Required Evidence Labels (exact strings)

| # | Exact label | Segment | Panel |
|---|---|---|---|
| 1 | `Source: AI extraction (MiniMax M3 via OpenRouter) · live` | B (S4) | Itinerary review — live-labelled flow only |
| 2 | `Local fixture` | B (S4, S7) | Default browser walkthrough extraction + alternatives |
| 3 | `Local fallback — not Nosana evidence` | B (S6) | Risk panel — browser fixture |
| 4 | `Nosana evidence — remote job succeeded; result from decentralized GPU workload.` | B (S6) / C (S9) | Nosana reconciled live evidence (overlay caption) |
| 5 | `Atlas Sandbox — live Search/Verify` | B (S7) / C (S9) | Atlas sandbox evidence state |

## 5. Claim-Boundary Notes

- Extraction provider wording: **"MiniMax M3 via OpenRouter — live extraction validated."** Never call the current provider Gemini (Gemini validation exists only as a historical artifact).
- The **browser walkthrough uses fictional local fixtures** (`provenanceMode: 'fictional-local'`); it makes no provider call. Live provider processing appears only where explicitly labelled (shots S4, S6, S7, S9).
- Nosana numbers (risk score **0.2895**, **800 simulations**, cost **$0.044**) come from the reconciled live job artifact — present them as separate offline-reconciled evidence, not as output of the browser demo.
- Atlas: **Search/Verify only**; ticketing is **activation-gated**. The PNR **S30798** and order **TESTA20260829181717829** are the **supervised-rehearsal record** of the sandbox write contract (terminal state TICKETED, 2026-08-29) — always framed as sandbox rehearsal/test environment, never as a real booking.
- The mock ticketing flow is a **simulation**: every frame must keep the disclosure copy visible (`Test environment only`; `Sandbox only — synthetic passenger — no real payment and no real ticket`).
- Never claim: a real booking/payment/ticket was created; the browser calls live providers; any offline fixture is live evidence; credentials or raw provider output are shown.
