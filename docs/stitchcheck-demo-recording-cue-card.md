# StitchCheck Demo Recording Cue Card

## Recording Rules

- Local demo only — no live services.
- Synthetic fixture data only (GEM-01 through GEM-05).
- Hide credentials, `.env.local`, terminals, notifications, and personal data.
- No network calls or live provider execution.
- No booking, payment, reservation, ticket, order, verification, or other external action.

---

## 100-Second Script

### Cue 1 — 0:00–0:12: Open with the problem

**Do:** Show the app loaded at the safety-notice screen. Point to the "Synthetic Demo — No Live Services" badge.

**Say:** "StitchCheck helps budget travellers understand the hidden risk of stitching two separately purchased tickets. If the first flight is delayed and you miss the second, the second airline has no obligation to help. This local demo shows a review-first approach — all data is synthetic."

**Must show:** Safety-notice panel visible. Header badge readable. No live-service claims on screen.

---

### Cue 2 — 0:12–0:28: Select a fixture

**Do:** Acknowledge the safety notice. Open the upload panel. Select GEM-01. Wait for extracted fields to appear.

**Say:** "We pick from pre-built synthetic fixtures — GEM-01, a clear two-leg itinerary. The extraction label reads: OpenRouter temporary path — not direct Gemini validation. Gemini is represented only within this documented evidence boundary; direct Gemini remains unexecuted."

**Must show:** Upload panel with fixture slots. GEM-01 selected. Label `OpenRouter temporary path — not direct Gemini validation` visible on the extraction result.

---

### Cue 3 — 0:28–0:45: Correct one field

**Do:** Click into the second-leg flight-number field. Change SC-202 to SC-299. Point to the correction note.

**Say:** "Every extracted field is editable. The traveller can correct any value before confirming. Here we fix the second-leg flight number from SC-202 to SC-299. The correction is recorded locally — no external call is made."

**Must show:** Editable field with cursor. Value changed from SC-202 to SC-299. Correction note visible.

---

### Cue 4 — 0:45–1:00: Confirm and unlock

**Do:** Scroll down to show Risk and Alternatives panels disabled with "Confirm itinerary first." Click "Confirm itinerary." Show panels unlock.

**Say:** "Before confirmation the downstream panels are locked — they display: Confirm itinerary first. This is the confirmation gate. Only after the traveller explicitly confirms do the decision-support panels unlock with local placeholder data."

**Must show:** Disabled panels with `Confirm itinerary first` and lock icons. Confirmation button clicked. Panels transition to enabled with placeholder data.

---

### Cue 5 — 1:00–1:20: Review placeholders and labels

**Do:** Point to the Risk panel (medium, 0.42). Point to the Alternatives panel (two synthetic options). Open the comparison view.

**Say:** "The risk panel shows a heuristic estimate — medium, score 0.42 — labelled as a synthetic local placeholder, not Nosana evidence. Nosana is blocked before any network request. The alternatives panel shows two synthetic options labelled as Atlas Sandbox placeholders. Atlas is unauthenticated and unexecuted."

**Must show:** Risk panel with `Synthetic local placeholder — not Nosana evidence`. Alternatives panel with `Synthetic local placeholder — not Atlas Sandbox evidence`. Comparison table visible.

---

### Cue 6 — 1:20–1:40: Decide and close

**Do:** Click "Keep current plan." Click "Confirm decision." Show the final statement and metadata.

**Say:** "The traveller chooses Keep or Switch — a local UI selection only. No booking, payment, reservation, ticket, order, verification, or other external action occurs. The final screen confirms: no external action has been created. This local demo ends here."

**Must show:** Decision buttons. Final statement: "No booking, payment, reservation, ticket, order, verification, or other write action has been created." Metadata: noOrderCreated true, syntheticDemo true, externalCallsMade false.

---

## If Something Goes Wrong

- **Missed click:** Pause, return to the current step, and retake that segment.
- **Wrong state:** Reload the local app and restart from the gate.
- **Label or visual issue:** Stop recording and report the defect; do not edit code during the take.

---

## Final Line

"This review-first flow keeps the traveller in control at every step — an honest local demo with synthetic data, ready for separately authorized live-service validation when each provider is deployed and evidence is collected."
