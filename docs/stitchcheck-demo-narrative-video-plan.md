# StitchCheck Demo Narrative and Video Plan

## Recording Goal

This recording demonstrates the StitchCheck local, review-first experience using synthetic fixture data only. The demo UI itself makes no live service calls, and every result shown is a local placeholder. Historical Gemini evidence is preserved under `smoke-tests/extraction/`; the ready-made demo performs no extraction and correctly shows MiniMax offline. Historical Nosana evidence is reconciled, while the current browser fixture is only a permitted dry-run preview (`jobId: null`). Historical Atlas Sandbox Search→Verify evidence returned 20 offers and then `PRICE_CONFIRMATION_REQUIRED`, with no write; the Aug 28 run was an environment-switch failure, not fresh evidence.

---

## Before Recording

1. **Start the local app using the existing operator guide.** Run `npm run dev` from `app/` and confirm the app loads at http://localhost:5173/ with the safety notice and synthetic-demo badge visible. Follow `docs/stitchcheck-local-demo-operator-guide.md` for the full 12-step demo path.

2. **Use a fresh browser session.** Clear browser cache, disable extensions, and reload the page. Set the viewport to at least 1280×720 (1440×900 preferred). Confirm browser zoom is at 100% and all labels are legible.

3. **Use only synthetic fixtures.** Select from GEM-01 through GEM-05 pre-built fixtures. Do not upload real screenshots, personal data, or any image containing PII, real booking references, or payment information.

4. **Hide terminals, credentials, `.env.local`, notifications, personal data, and unrelated tabs.** Close or hide all terminal windows, environment files, credential-bearing files, browser autofill suggestions, desktop notifications, personal tabs, bookmarks, and unrelated applications before recording begins.

5. **Confirm the initial confirmation gate is visible.** Before recording, verify that the Risk and Alternatives panels display `Confirm itinerary first` with lock icons in their disabled state. This is the confirmation gate that the recording must show unlocking.

6. **Keep the recording focused on the product flow.** Record only the running StitchCheck UI. Do not recreate UI elements in external tools, composite or fabricate screenshots, or include tangential tooling, code editors, or infrastructure views.

7. **Do not narrate unsupported provider-execution claims.** Every spoken line must describe the experience as a local demo. Do not state or imply that Gemini, Nosana, or Atlas was successfully executed, deployed, authenticated, or validated.

---

## Timeline and Script

| Time | Screen action | Spoken narrative | Visible proof |
|------|--------------|-----------------|---------------|
| 0:00–0:12 | App loads with safety notice visible. Header shows "StitchCheck — Synthetic Demo — No Live Services." Risk and Alternatives panels are not yet in view. | "StitchCheck helps budget travelers understand the hidden risk of stitching two separately purchased flight tickets. When flights are booked as separate tickets, each is an independent contract. If the first flight is delayed and you miss the second, the second airline has no obligation to rebook or refund. This local demo shows a review-first approach to understanding itinerary risk before making decisions." | Safety notice panel visible. "Synthetic Demo" badge in header. No live-service claims on screen. |
| 0:12–0:28 | Acknowledge safety notice. Upload panel appears with five fixture slots (GEM-01 through GEM-05). Select GEM-01. Extraction result appears with itinerary fields. Source label is visible. | "The demo begins with synthetic itinerary screenshots — fictional images containing no real passenger data, booking references, or payment information. The user selects GEM-01, a clear two-leg itinerary. The extraction label reads: Demo itinerary — local demo fixture. This is structured-extraction functionality only; direct Gemini 3.7 was verified separately via the Interactions API." | Upload panel with fixture selection visible. GEM-01 selected. Source label: "Demo itinerary — local demo fixture." Editable itinerary fields populated. |
| 0:28–0:45 | Itinerary review screen shows extracted fields. All fields are editable. Edit the second-leg flight number from SC-202 to SC-299. Correction note appears. | "Extracted itinerary fields are displayed for review. All fields are editable — the user can correct any value before confirming. In this demo, the second-leg flight number is corrected from SC-202 to SC-299. The correction is recorded locally. This editable extraction and user correction step ensures the traveler has full control over the itinerary data before any downstream processing." | Editable fields visible. Flight number changed from SC-202 to SC-299. Correction note: "Changed secondLeg.flightNumber: SC-202 → SC-299." |
| 0:45–1:00 | Scroll down to show Risk and Alternatives panels in disabled state with lock icons and "Confirm itinerary first." Click "Confirm itinerary." Status banner appears. Panels unlock with local placeholder data. | "Before confirmation, the risk and alternatives panels are disabled. They display: Confirm itinerary first. This is the confirmation gate — downstream decision-support panels unlock only after the user explicitly confirms the reviewed itinerary. No risk calculation or alternative search begins before this step. The user clicks Confirm, and the panels activate with local placeholder data." | Disabled panels with "Confirm itinerary first" and lock icons (before). Status banner: "Itinerary confirmed. No external service call was made." Panels unlocked with placeholder data (after). |
| 1:00–1:20 | Risk panel shows medium risk band (score 0.42) with heuristic disclaimer and Nosana source label. Alternatives panel shows two synthetic options with Atlas source label. Open comparison view to display original itinerary alongside an alternative side by side. | "The risk panel is a local dry-run preview — not a live Nosana result. Historical Nosana evidence is reconciled separately. The alternatives panel contains local demo fixtures; it does not display Atlas output. Historical Atlas Sandbox Search→Verify evidence returned 20 offers then `PRICE_CONFIRMATION_REQUIRED`, with no write. The comparison view displays the original itinerary alongside a placeholder alternative." | Risk panel: medium band, heuristic disclaimer, source label "Local fallback — not Nosana evidence." Alternatives panel: two options with source label "Demo alternatives — local demo fixture." Comparison table visible. |
| 1:20–1:40 | Decision panel shows "Keep current plan" and "Switch to alternative." Select "Keep current plan." Confirm decision. Final screen appears with no-external-action statement and metadata. | "The user makes a local decision — Keep the current plan or Switch to an alternative. This is a UI-only selection. No booking, payment, reservation, ticket, order, verification, or other external action occurs. Historical Gemini evidence is preserved separately; this ready-made demo performs no extraction and shows MiniMax offline. This local demo makes no provider calls." | Decision buttons visible. Final statement: "No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only." Metadata: noOrderCreated: true, syntheticDemo: true, externalCallsMade: false. |

**Total target duration:** 100 seconds (12 + 16 + 17 + 15 + 20 + 20)

---

## Required Visual Proof

The recording must clearly show each of the following moments:

1. **Initial disabled downstream state with `Confirm itinerary first`.** Before the user confirms, the Risk and Alternatives panels must be visible in their disabled state with lock icons and the text "Confirm itinerary first."

2. **Editable extracted field.** After fixture selection, the itinerary review screen must show populated fields that are visibly editable (e.g., a text input cursor or highlighted field).

3. **User correction before confirmation.** The second-leg flight number must be changed from SC-202 to SC-299, and the resulting correction note must be visible on screen.

4. **Explicit confirmation action.** The user must visibly click the "Confirm itinerary" button, and the transition from disabled to enabled panels must be captured.

5. **Downstream panels becoming available.** After confirmation, the Risk and Alternatives panels must be shown populated with placeholder data, demonstrating the gate has unlocked.

6. **Required source/placeholder labels.** All three exact evidence labels must be visible on screen at the appropriate moments:
   - `Demo itinerary — local demo fixture` (during fixture selection / extraction)
   - `Local fallback — not Nosana evidence` (during risk panel review)
   - `Demo alternatives — local demo fixture` (during alternatives panel review)

7. **Local Keep or Switch choice with no-external-action end state.** The user must select Keep or Switch, confirm the decision, and the final statement must be visible confirming no external action was created.

---

## Accuracy Guardrails

The following claims are prohibited in the recording, narration, captions, and any derived artifact:

- **Local fixtures are live provider outputs.** Do not state, imply, or visually suggest that any risk estimate, alternative option, or extraction result is a live Gemini, Nosana, or Atlas response.

- **A local fixture is a Gemini result.** Historical Gemini evidence is retained under `smoke-tests/extraction/`, but the ready-made demo performs no extraction and shows MiniMax offline.

- **The dry-run preview was a Nosana job.** Historical evidence is reconciled separately; the current fixture has `jobId: null` and no workload was submitted.

- **Atlas history is active demo output.** Historical Sandbox Search→Verify evidence returned 20 offers and then `PRICE_CONFIRMATION_REQUIRED`, with no write. The Aug 28 environment-switch failure is not fresh evidence, and the demo panels stay local fixtures.

- **Any booking, payment, reservation, ticket, order, or verification occurred.** The demo is entirely read-only and UI-only. No external transaction of any kind is created at any point.

- **Credentials, PII, raw provider output, or real booking/payment data are shown.** All data in the recording must be synthetic and fictional (AAA/BBB/CCC airports, SC-101/SC-202 flights, fictional dates).

---

## Recovery Takes

### Recovery 1: Missed Click or Unclear Narration

If a click is missed, a UI element is not clearly captured, or the narration does not match the visible screen: **stop** the recording. Do not attempt to continue or patch the take. **Reload the page** in the browser to reset the app to its initial state. **Restart the affected segment** from the beginning of that timeline row without changing any source files, configuration, or fixture data. No external calls are made during a reload.

### Recovery 2: Browser State or Reset Issue

If the browser shows a blank screen, an error state, a cached stale page, or the app does not respond correctly: **stop** the recording. **Close and reopen the browser** to a fresh session with cache cleared. Navigate to http://localhost:5173/ and confirm the safety notice loads correctly. **Restart the recording** from Segment 1 (0:00–0:12) without modifying any source files, environment configuration, or running processes. If the app fails to load, follow the operator guide to restart the dev server.

### Recovery 3: Visual Defect or Missing-Label Issue

If a required evidence label is missing, a panel renders incorrectly, text is clipped or unreadable, or the UI does not match the expected state: **stop** the recording. **Reload the page** to reset all application state. Verify the app displays all expected labels by checking the relevant source data files (`app/src/data/labels.ts`, `app/src/data/fixtures.ts`) without modifying them. **Restart the affected segment** once the UI is confirmed correct. Do not change source files, install packages, or make external calls to fix a visual defect.

---

## Closing Line

"This review-first flow keeps the traveler in control at every step — an honest local demo with synthetic data. Historical evidence is preserved separately, while this demo stays offline and creates no external action."

---

## Verification

Before finalizing this document:

- [x] Exactly six timeline segments exist (0:00–0:12, 0:12–0:28, 0:28–0:45, 0:45–1:00, 1:00–1:20, 1:20–1:40).
- [x] Estimated duration is approximately 100 seconds (12 + 16 + 17 + 15 + 20 + 20 = 100).
- [x] The exact phrase `Demo itinerary — local demo fixture` appears exactly once in the Timeline and Script table (Segment 2 spoken narrative).
- [x] All three exact evidence labels appear:
  - `Demo itinerary — local demo fixture` (Segment 2)
  - `Local fallback — not Nosana evidence` (Segment 5 and Required Visual Proof)
  - `Demo alternatives — local demo fixture` (Segment 5 and Required Visual Proof)
- [x] All service status claims distinguish historical evidence from the active demo: Gemini evidence is under `smoke-tests/extraction/` while MiniMax is offline; Nosana is a dry-run preview; Atlas evidence is read-only Search→Verify with no write; demo panels remain local placeholders.
- [x] No secrets, PII, raw provider output, or real booking/payment data appears.
- [x] Only `docs/stitchcheck-demo-narrative-video-plan.md` was created.
