# StitchCheck Eight-Slide Visual Specification

## Global Design Rules

- **Canvas:** 16:9 widescreen (1920×1080 minimum).
- **Typography:** Accessible contrast (WCAG AA minimum); sans-serif typeface; body text no smaller than 24pt; headings no smaller than 36pt.
- **Message discipline:** One primary message per slide; maximum five short on-slide bullets (each bullet no more than 12 words).
- **Label consistency:** Use exact labels for local, offline, temporary-path, and unexecuted states throughout. Never abbreviate or paraphrase the three required evidence labels.
- **Asset origin:** No external images, stock photos, or copied external text. Use only original diagrams or local demo screenshots captured from the StitchCheck dev server.
- **Visual tone:** Avoid visual language that implies live provider execution (no API arrows, no cloud icons pointing outward, no "live" or "real-time" badges).

---

## Slide 1 — Title: StitchCheck

### Purpose
Introduce the product name and one-line value proposition. Establish that this is a local demo with synthetic data.

### Layout
- Center-aligned product name (large, dominant).
- One-line tagline below.
- Five short bullets in the lower third.
- Small "Synthetic Demo — No Live Services" badge in the top-right corner.

### On-slide copy
- **StitchCheck** (product name, 60pt+)
- Review before you commit.
- Upload synthetic itinerary screenshots.
- Extract, review, correct, confirm.
- Compare risk against safer alternatives.
- Keep or Switch — no booking, no external action.

### Visual asset
Local demo landing screen showing the app header, the "Synthetic Demo — No Live Services" badge, and the safety-notice panel. Capture from `http://localhost:5173` before any fixture selection.

### Evidence label treatment
No evidence labels required on this slide. The "Synthetic Demo — No Live Services" badge serves as the primary boundary indicator.

### Speaker emphasis
StitchCheck is a local demo that helps budget travellers understand the hidden risk of stitching two separately purchased flight tickets. The entire flow runs locally with synthetic data — no live service is called at any point.

### Do-not-show/do-not-claim
- No provider logos (Gemini, Nosana, Atlas, OpenRouter).
- No live-service badges or "powered by" language.
- No real traveler photos or real booking screenshots.

---

## Slide 2 — The Problem

### Purpose
Visualize screenshot ambiguity and connection-risk uncertainty. Establish why a review-first tool is needed.

### Layout
- Two-column layout: left column shows a cluttered itinerary screenshot; right column shows highlighted callout boxes.
- Four short bullets below the visual.

### On-slide copy
- Two separate tickets = two independent contracts.
- A missed connection means the second airline has no obligation to rebook or refund.
- Savings are visible at checkout; exposure is not.
- Travellers need a reviewable, correctable view before deciding.

### Visual asset
Original diagram or local synthetic illustration: a side-by-side comparison showing a cluttered itinerary screenshot on the left with key fields (connection time, separate ticket warning) highlighted in callout boxes on the right. Use the GEM-03 fragmented-layout fixture as the source image. Do not use real traveler data.

### Evidence label treatment
No evidence labels required on this slide. The visual is an original diagram or synthetic fixture, not live provider output.

### Speaker emphasis
Budget travellers often book two separate tickets to save money, but they may not realise that a tight connection between independently booked flights carries real exposure. If the first flight is delayed, the second airline has no obligation to help. StitchCheck surfaces this risk before the traveller commits.

### Do-not-show/do-not-claim
- No real traveler or real booking.
- No implication that the screenshot is from a live provider.
- No claim that the risk has been calculated by Nosana.

---

## Slide 3 — The Review-First Solution

### Purpose
Show the review-first pipeline: synthetic input → editable extraction → user correction → confirmation → local decision support. Distinguish planned service roles from the local demo.

### Layout
- Horizontal flow diagram with five boxes: "Screenshot" → "Extract" → "Review & Correct" → "Confirm" → "Decide".
- Each box has a small icon.
- An arrow from "Confirm" gates the downstream panels.

### On-slide copy
- Synthetic screenshot fixtures feed local extraction.
- Extracted fields are fully editable — the user can correct any value.
- Explicit confirmation is required before downstream panels unlock.
- Risk and alternatives placeholders appear only after confirmation.
- The user makes one local decision: Keep or Switch.

### Visual asset
Original diagram drawn in the presentation tool. Simple boxes and arrows, no external icons. Draw as an original diagram in the presentation tool.

### Evidence label treatment
No evidence labels required on this slide. The diagram shows the local flow, not live provider execution.

### Speaker emphasis
The review-first design ensures the traveller always has the final say. Extraction produces a starting point, not a conclusion. The user can correct any field, and nothing downstream — risk scoring, alternative search — activates until the user explicitly confirms the itinerary.

### Do-not-show/do-not-claim
- No implication that extraction is performed by live Gemini.
- No implication that risk is calculated by live Nosana.
- No implication that alternatives are searched by live Atlas.

---

## Slide 4 — Human Control Is the Gate

### Purpose
Make `Confirm itinerary first` the dominant UI proof. Show locked downstream panels before confirmation and unlocked panels after it.

### Layout
- Two screenshots side-by-side: left shows the locked state (before confirmation); right shows the unlocked state (after confirmation).
- Two short bullets below each screenshot.

### On-slide copy
- Before confirmation, risk and alternatives panels display: `Confirm itinerary first`.
- Controls are visually locked with a lock icon and `aria-disabled`.
- No risk calculation or alternative search begins before confirmation.
- Confirmation is a single explicit user action — not automatic.
- The gate cannot be bypassed by any UI shortcut.

### Visual asset
Two screenshots from the local demo:
1. **Left:** Itinerary Review screen with the Risk Panel and Alternatives Panel both locked, displaying the "Confirm itinerary first" message and lock icon. Capture from `http://localhost:5173` before clicking Confirm.
2. **Right:** Same screen after clicking Confirm, showing the Risk Panel and Alternatives Panel unlocked with placeholder data.

### Evidence label treatment
The exact phrase `Confirm itinerary first` appears as a UI-state label only. It is not an evidence label.

### Speaker emphasis
The confirmation gate is the central safety mechanism. It ensures that the traveller has actually reviewed and approved the extracted data before any downstream processing occurs. No automated step can skip this gate — it requires an explicit human action every time.

### Do-not-show/do-not-claim
- No implication that the gate is connected to live provider execution.
- No claim that the gate validates provider responses.

---

## Slide 5 — Three Essential Service Roles

### Purpose
Use a three-column role map for Gemini, Nosana, and Atlas Sandbox. Include the exact evidence labels and state that live execution is not complete.

### Layout
- Three-column table or card layout.
- Each column shows the service name, its role in one line, and a status badge.
- Three evidence labels listed below the columns.

### On-slide copy
- **Gemini:** structured itinerary extraction from screenshots into editable fields.
- **Nosana:** planned connection-risk workload returning a heuristic band/score with visible status.
- **Atlas Sandbox:** planned read-only alternative search for safer flight options.
- Locally demonstrated: extraction UI, risk placeholder states, alternatives placeholder states.
- Awaiting live execution: direct Gemini, Nosana workload deployment and submission, Atlas Sandbox authentication.

### Visual asset
Original diagram drawn in the presentation tool. Three columns with status badges: "Temporary path evidence" for Gemini, "Local placeholder" for Nosana, "Local placeholder" for Atlas. Draw as an original diagram in the presentation tool.

### Evidence label treatment
Include the three exact labels below the columns:
- `OpenRouter temporary path — not direct Gemini validation`
- `Synthetic local placeholder — not Nosana evidence`
- `Synthetic local placeholder — not Atlas Sandbox evidence`

### Speaker emphasis
Each service has a clearly defined role. Gemini provides the structured extraction that feeds the review screen. Nosana is planned to deliver a heuristic risk assessment; the local harness exists but the smoke test was blocked before any network request — no workload, endpoint, SDK, or submission mechanism is in place yet. Atlas Sandbox is planned to return safer alternatives for comparison. Today, the local demo shows all three roles with placeholder data; live execution of each service is separately gated and has not yet occurred. All risk data carries the label: Synthetic local placeholder — not Nosana evidence. All Atlas alternatives carry the label: Synthetic local placeholder — not Atlas Sandbox evidence.

### Do-not-show/do-not-claim
- No claim that direct Gemini has been executed.
- No claim that Nosana has been deployed or executed.
- No claim that Atlas has been authenticated or executed.

---

## Slide 6 — Trust, Safety, and Scope

### Purpose
Use a safety boundary diagram. Include synthetic data, human confirmation, no credentials, and no external action. Do not show real booking/payment UI.

### Layout
- Checklist-style graphic with green check marks next to each safety property.
- Five short bullets in the lower third.

### On-slide copy
- All fixtures are synthetic: invented airport codes, fictional flight numbers, placeholder prices.
- No credential values appear in the repository.
- No booking, payment, verification, reservation, ticket, order, or write action exists.
- Atlas is designed as Sandbox/search-only when later executed.
- Human review and confirmation gate every downstream step.

### Visual asset
Original diagram drawn in the presentation tool. Checklist-style graphic with green check marks next to: "Synthetic data only", "No PII", "No credentials in repo", "No write actions", "Human confirmation gate". Use the final decision screen from the local demo as a small inset showing the no-order statement.

### Evidence label treatment
No evidence labels required on this slide. The safety properties are local-demo boundaries, not provider-evidence labels.

### Speaker emphasis
Safety is not an afterthought — it is baked into every layer of the demo. No real personal data enters the system. No credential is stored in source code. And critically, no action that creates a booking, processes a payment, or triggers any external write exists anywhere in the application. The scope ends at the Keep-or-Switch decision.

### Do-not-show/do-not-claim
- No real booking or payment UI.
- No implication that the demo can create external actions.

---

## Slide 7 — Demo Walkthrough

### Purpose
Use a numbered six-step walkthrough. Identify where to capture local screenshots. Include the visible gate and final local Keep/Switch state.

### Layout
- Numbered step list with a small screenshot thumbnail beside each step.
- Three evidence labels listed at the bottom.

### On-slide copy
1. Open the local app and acknowledge the synthetic-demo notice.
2. Select synthetic screenshot fixtures (GEM-01 through GEM-05).
3. Review and correct extracted itinerary fields.
4. Confirm the itinerary — panels unlock with local placeholder data.
5. Compare options and choose Keep or Switch.
6. View the final statement: no booking or external action created.

Visible labels: `OpenRouter temporary path — not direct Gemini validation`, `Synthetic local placeholder — not Nosana evidence`, `Synthetic local placeholder — not Atlas Sandbox evidence`.

### Visual asset
Numbered step list with small screenshot thumbnails captured from the local demo at each stage:
1. Landing screen with synthetic-demo notice.
2. Fixture selection screen showing GEM-01 through GEM-05.
3. Edited itinerary field (user correction visible).
4. Confirmed itinerary with unlocked panels.
5. Risk/alternatives placeholder state with labels visible.
6. Final local Keep/Switch state with no-order statement.

Alternatively, a single wide screenshot showing the full scrollable page in the confirmed state with annotations pointing to each label and the decision panel.

### Evidence label treatment
The three exact labels are visible at their respective stages:
- `OpenRouter temporary path — not direct Gemini validation` (visible after extraction)
- `Synthetic local placeholder — not Nosana evidence` (visible in risk panel)
- `Synthetic local placeholder — not Atlas Sandbox evidence` (visible in alternatives panel)

### Speaker emphasis
The walkthrough is designed to be repeatable and self-contained. At every step, the operator can point to a specific label or safety message. The three required source labels are visible at their respective stages, making it clear which data is local placeholder and which came from the temporary extraction path.

### Do-not-show/do-not-claim
- No implication that the walkthrough demonstrates live provider execution.
- No claim that the labels represent live provider responses.

---

## Slide 8 — Status and Next Steps

### Purpose
Separate "proven locally/offline" from "not yet live-validated." Include the Atlas duplicate-booking guard statement. Preserve the exact Gemini temporary-path label.

### Layout
- Status dashboard with three rows — one per service — each showing a progress indicator.
- A fourth row shows "Local demo" fully green.
- One bullet for Atlas duplicate-booking guard.

### On-slide copy
- Local React/Vite demo: **ready** — type-check, production build, and browser walkthrough all pass.
- GEM-01 evidence: `OpenRouter temporary path — not direct Gemini validation`.
- Direct Gemini: not yet executed. Pass/fail intentionally blank.
- Nosana: local harness exists — smoke test blocked before any network request; not executed, not deployed.
- Atlas Sandbox: local fixtures only — not authenticated, not executed.
- Atlas duplicate-booking guard: offline-only state machine for synthetic 318 scenarios; 48 tests passed; not live Atlas evidence.
- Next goals: obtain human authorization and credentials for each service smoke test; begin submission assets (README, demo narrative, slide recording).

### Visual asset
Original diagram drawn in the presentation tool. Status dashboard with three rows:
- Gemini: "temporary path done, direct pending"
- Nosana: "preparation only"
- Atlas: "preparation only"
- Local demo: fully green

Draw as an original diagram in the presentation tool.

### Evidence label treatment
The extraction panel label reads: `Fictional itinerary — local demo fixture`. Direct Gemini 3.7 live extraction was verified separately. The Atlas duplicate-booking guard is clearly marked as "offline-only" and "not live Atlas evidence."

### Speaker emphasis
We have a working local demo that proves the review-first flow, the confirmation gate, and the Keep-or-Switch decision — the demo UI itself uses synthetic data and makes no live service calls. Direct Gemini 3.7 live extraction was verified separately via the Interactions API. Atlas Sandbox Search/Verify was verified separately read-only. Nosana workload validated offline; live execution was not verified. The browser walkthrough uses fictional local fixtures throughout.

### Do-not-show/do-not-claim
- No presentation of offline tests as provider execution.
- No claim that Atlas duplicate-booking protection has been tested against live Atlas.
- No claim that the browser walkthrough calls any live provider.

---

## Asset Capture Plan

### Required local-demo screenshots

1. **Initial locked state**
   - **What must be visible:** Itinerary Review screen with Risk Panel and Alternatives Panel locked, displaying "Confirm itinerary first" message and lock icon.
   - **What must be hidden:** No unlocked panels, no placeholder data, no browser extensions or unrelated tabs.
   - **Used in:** Slide 4 (left side).

2. **Edited itinerary field**
   - **What must be visible:** At least one extracted field with a user correction visible (e.g., corrected date or airport code).
   - **What must be hidden:** No browser console, no developer tools, no credentials or PII.
   - **Used in:** Slide 7 (step 3).

3. **Confirmed itinerary with unlocked panels**
   - **What must be visible:** Itinerary Review screen after confirmation, with Risk Panel and Alternatives Panel unlocked and showing placeholder data.
   - **What must be hidden:** No browser extensions, no unrelated tabs, no real booking UI.
   - **Used in:** Slide 4 (right side), Slide 7 (step 4).

4. **Risk/alternatives placeholder state with labels**
   - **What must be visible:** Risk Panel and Alternatives Panel with placeholder data and visible labels: `Synthetic local placeholder — not Nosana evidence` and `Synthetic local placeholder — not Atlas Sandbox evidence`.
   - **What must be hidden:** No real risk scores, no real alternative flights, no credentials.
   - **Used in:** Slide 7 (step 5).

5. **Final local Keep/Switch state**
   - **What must be visible:** Final decision screen showing Keep or Switch option and the no-order statement.
   - **What must be hidden:** No booking confirmation, no payment UI, no external action.
   - **Used in:** Slide 7 (step 6).

### Capture instructions
- Use the local dev server at `http://localhost:5173`.
- Capture at 1920×1080 resolution or higher.
- Use synthetic fixtures only (GEM-01 through GEM-05).
- Do not include browser chrome, URL bar, or tabs.
- Do not include any credentials, PII, or real travel data.

---

## Final Visual QA

- [ ] Exactly eight slides present.
- [ ] No unsupported provider claim appears in any slide.
- [ ] Exact labels preserved:
  - `OpenRouter temporary path — not direct Gemini validation`
  - `Synthetic local placeholder — not Nosana evidence`
  - `Synthetic local placeholder — not Atlas Sandbox evidence`
- [ ] Offline Atlas guard clearly marked offline-only in Slide 8.
- [ ] Confirmation gate visibly demonstrated in Slide 4.
- [ ] No credentials, PII, raw provider output, or real booking/payment data appears in any screenshot or diagram.
- [ ] No external-action implication in any visual or copy.
- [ ] Text readable at recording resolution (24pt+ body, 36pt+ headings).
