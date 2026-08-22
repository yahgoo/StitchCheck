# StitchCheck Hackathon Slide Deck Outline

## Slide 1 — Title: StitchCheck

**Core message:** A review-first itinerary connection-risk and alternatives decision demo.

**On-slide content:**
- StitchCheck: review before you commit.
- Upload synthetic itinerary screenshots.
- Extract, review, correct, confirm.
- Compare risk against safer alternatives.
- Keep or Switch — no booking, no external action.

**Suggested visual:** The StitchCheck landing screen showing the app header, the "Synthetic Demo — No Live Services" badge, and the safety-notice panel. Capture from the local dev server.

**Speaker note:** StitchCheck is a local demo that helps budget travellers understand the hidden risk of stitching two separately purchased flight tickets. The local demo walkthrough runs with synthetic fixture data — the demo UI itself makes no live service calls. Separately, OpenRouter and Atlas production have been called outside the demo UI; their status is reported below.

---

## Slide 2 — The Problem

**Core message:** Flight itinerary screenshots are hard to read and can conceal tight connection risks; users need transparency before making choices.

**On-slide content:**
- Two separate tickets = two independent contracts.
- A missed connection means the second airline has no obligation to rebook or refund.
- Savings are visible at checkout; exposure is not.
- Travellers need a reviewable, correctable view of their itinerary before deciding.

**Suggested visual:** A side-by-side comparison: a cluttered itinerary screenshot on the left with key fields (connection time, separate ticket warning) highlighted in callout boxes on the right. Use the GEM-03 fragmented-layout fixture as the source image.

**Speaker note:** Budget travellers often book two separate tickets to save money, but they may not realise that a tight connection between independently booked flights carries real exposure. If the first flight is delayed, the second airline has no obligation to help. StitchCheck surfaces this risk before the traveller commits.

---

## Slide 3 — The Review-First Solution

**Core message:** Show the flow: synthetic screenshot → editable extraction → correction → explicit confirmation → local decision support.

**On-slide content:**
- Synthetic screenshot fixtures feed local extraction.
- Extracted fields are fully editable — the user can correct any value.
- Explicit confirmation is required before downstream panels unlock.
- Risk and alternatives placeholders appear only after confirmation.
- The user makes one local decision: Keep or Switch.

**Suggested visual:** A horizontal flow diagram with five boxes: "Screenshot" → "Extract" → "Review & Correct" → "Confirm" → "Decide". Each box has a small icon. An arrow from "Confirm" gates the downstream panels. Draw this as a simple original diagram in the presentation tool.

**Speaker note:** The review-first design ensures the traveller always has the final say. Extraction produces a starting point, not a conclusion. The user can correct any field, and nothing downstream — risk scoring, alternative search — activates until the user explicitly confirms the itinerary.

---

## Slide 4 — Human Control Is the Gate

**Core message:** Downstream panels are unavailable until the user confirms the itinerary.

**On-slide content:**
- Before confirmation, risk and alternatives panels display: `Confirm itinerary first`.
- Controls are visually locked with a lock icon and `aria-disabled`.
- No risk calculation or alternative search begins before confirmation.
- Confirmation is a single explicit user action — not automatic.
- The gate cannot be bypassed by any UI shortcut.

**Suggested visual:** A screenshot from the local demo showing the Itinerary Review screen with the Risk Panel and Alternatives Panel both locked, displaying the "Confirm itinerary first" message and lock icon. Capture from the local dev server before clicking Confirm.

**Speaker note:** The confirmation gate is the central safety mechanism. It ensures that the traveller has actually reviewed and approved the extracted data before any downstream processing occurs. No automated step can skip this gate — it requires an explicit human action every time.

---

## Slide 5 — Three Essential Service Roles

**Core message:** Gemini extracts, Nosana assesses risk, Atlas searches alternatives — each has a distinct planned role.

**On-slide content:**
- **Gemini:** structured itinerary extraction from screenshots into editable fields.
- **Nosana:** planned connection-risk workload returning a heuristic band/score with visible status. Local harness exists (fixtures, schema validator, workload skeleton). The Nosana smoke test was blocked before any network request due to missing SDK, credit account, and reviewed workload definition.
- **Atlas Sandbox:** planned read-only alternative search for safer flight options. Atlas production authentication succeeded; two live read-only production searches returned reference-price offers. Sandbox Search + Verify (ATL-SBX-SV-01) partially succeeded.
- Locally demonstrated: extraction UI, risk placeholder states, alternatives placeholder states.
- Awaiting live execution: direct Gemini, Nosana workload deployment and submission. Atlas production authentication and two live searches have succeeded; the demo panel remains a local placeholder labelled accordingly.

**Suggested visual:** A three-column table or card layout. Each column shows the service name, its role in one line, and a status badge: "Temporary path evidence" for Gemini, "Local placeholder" for Nosana, "Local placeholder" for Atlas (the demo panel IS a local placeholder, but Atlas production authentication and two live searches have succeeded; the demo panel remains a local placeholder labelled accordingly). Draw as an original diagram in the presentation tool.

**Speaker note:** Each service has a clearly defined role. Gemini provides the structured extraction that feeds the review screen. Nosana is planned to deliver a heuristic risk assessment; the local harness exists but the smoke test was blocked before any network request — no workload, endpoint, SDK, or submission mechanism is in place yet. Atlas Sandbox is planned to return safer alternatives for comparison. Atlas production authentication succeeded and two live read-only searches returned reference-price offers; however, the demo panels remain local placeholders. Nosana live execution has not occurred. All risk data carries the label: Synthetic local placeholder — not Nosana evidence. All Atlas alternatives carry the label: Synthetic local placeholder — not Atlas Sandbox evidence.

---

## Slide 6 — Trust, Safety, and Scope

**Core message:** The demo uses synthetic data only, contains no PII or credentials, and has no transaction capabilities.

**On-slide content:**
- All fixtures are synthetic: invented airport codes, fictional flight numbers, placeholder prices.
- No credential values appear in the repository.
- No booking, payment, verification, reservation, ticket, order, or write action exists.
- Atlas is designed as Sandbox/search-only when later executed.
- Human review and confirmation gate every downstream step.

**Suggested visual:** A checklist-style graphic with green check marks next to each safety property: "Synthetic data only", "No PII", "No credentials in repo", "No write actions", "Human confirmation gate". Use the final decision screen from the local demo as a small inset showing the no-order statement.

**Speaker note:** Safety is not an afterthought — it is baked into every layer of the demo. No personal data enters the demo system. Live Atlas production searches returned flight offer data (routes, prices, schedules) — not passenger or personal data. No credential is stored in source code. And critically, no action that creates a booking, processes a payment, or triggers any external write exists anywhere in the application. The scope ends at the Keep-or-Switch decision.

---

## Slide 7 — Demo Walkthrough

**Core message:** The local demo follows a clear six-step path from synthetic screenshot to final no-action statement.

**On-slide content:**
1. Open the local app and acknowledge the synthetic-demo notice.
2. Select synthetic screenshot fixtures (GEM-01 through GEM-05).
3. Review and correct extracted itinerary fields.
4. Confirm the itinerary — panels unlock with local placeholder data.
5. Compare options and choose Keep or Switch.
6. View the final statement: no booking or external action created.

- Visible labels: `OpenRouter temporary path — not direct Gemini validation`, `Synthetic local placeholder — not Nosana evidence`, `Synthetic local placeholder — not Atlas Sandbox evidence`.

**Suggested visual:** A numbered step list with a small screenshot thumbnail beside each step, captured from the local demo at each corresponding stage. Alternatively, a single wide screenshot showing the full scrollable page in the confirmed state with annotations pointing to each label and the decision panel.

**Speaker note:** The walkthrough is designed to be repeatable and self-contained. At every step, the operator can point to a specific label or safety message. The three required source labels are visible at their respective stages, making it clear which data is local placeholder and which came from the temporary extraction path.

---

## Slide 8 — Status and Next Steps

**Core message:** The local demo is ready; live-service validation is separately gated and not yet complete.

**On-slide content:**
- Local React/Vite demo: **ready** — type-check, production build, and browser walkthrough all pass.
- GEM-01 evidence: `OpenRouter temporary path — not direct Gemini validation`.
- Direct Gemini: not yet executed. Pass/fail intentionally blank.
- Nosana: local harness exists — smoke test blocked before any network request; not executed, not deployed. Evidence: `smoke-tests/nosana/results/2026-08-20T15-53-43Z/`.
- Atlas Sandbox: local fixtures only for demo panels. Atlas production: authentication succeeded; two live read-only searches succeeded (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers). Sandbox Search + Verify (ATL-SBX-SV-01) partially succeeded. Ticketing activation pending.
- Atlas duplicate-booking guard: offline-only state machine for synthetic 318 scenarios; 48 tests passed; not live Atlas evidence.
- Next goals: obtain human authorization and credentials for each service smoke test; begin submission assets (README, demo narrative, slide recording).

**Suggested visual:** A status dashboard with three rows — one per service — each showing a progress indicator: Gemini at "temporary path done, direct pending", Nosana at "preparation only", Atlas at "preparation only". A fourth row shows "Local demo" fully green. Draw as an original diagram in the presentation tool.

**Speaker note:** We have a working local demo that proves the review-first flow, the confirmation gate, and the Keep-or-Switch decision — the demo UI itself uses synthetic data and makes no live service calls. Separately, OpenRouter and Atlas production have been called outside the demo UI. The Nosana smoke test was intentionally blocked before any network request because no reviewed workload, submission mechanism, or target environment exists yet — this is valid evidence of a safe stop. The next phase is to complete the six Nosana prerequisites and obtain the separately required human authorization for each service smoke test. Direct Gemini, Nosana, and Atlas validation are independent gates that must each be passed before any live-integration claim can be made.
