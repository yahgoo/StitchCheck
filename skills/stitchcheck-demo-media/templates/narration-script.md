# StitchCheck Demo Narration Script

Total duration: 100 seconds

---

## Scene 1: Locked `Confirm itinerary first` (12 seconds)

StitchCheck helps budget travelers understand the hidden risk of stitching two separately purchased flight tickets. When flights are booked as separate tickets, each is an independent contract. If the first flight is delayed and you miss the second, the second airline has no obligation to rebook or refund. This local demo shows a review-first approach to understanding itinerary risk before making decisions.

---

## Scene 2: Editable Field and Correction (16 seconds)

The demo begins with synthetic itinerary screenshots — fictional images containing no real passenger data, booking references, or payment information. The user selects GEM-01, a clear two-leg itinerary. Direct Gemini integration is implemented and offline-tested. The recorded video uses the validated fallback.

Extracted itinerary fields are displayed for review. All fields are editable — the user can correct any value before confirming. In this demo, the second-leg flight number is corrected from SC-202 to SC-299. The correction is recorded locally. This editable extraction and user correction step ensures the traveler has full control over the itinerary data before any downstream processing.

---

## Scene 3: Confirmation and Unlocked Panels (17 seconds)

Before confirmation, the risk and alternatives panels are disabled. They display: Confirm itinerary first. This is the confirmation gate — downstream decision-support panels unlock only after the user explicitly confirms the reviewed itinerary. No risk calculation or alternative search begins before this step. The user clicks Confirm, and the panels activate with local placeholder data.

---

## Scene 4: Sanitized Provider Status (15 seconds)

The risk panel displays a heuristic risk estimate — medium risk with a score of 0.293. The disclaimer states this is a local fallback — not Nosana evidence. Nosana workload validated offline. Local fallback used.

The alternatives panel shows two synthetic options labeled as local demo fixtures. Atlas Sandbox Search and Verify was verified separately. The browser demo uses local fixtures unless explicitly labelled otherwise.

---

## Scene 5: Comparison (20 seconds)

The comparison view displays the original itinerary alongside a placeholder alternative. The side-by-side table shows route details, connection times, and pricing. All data is synthetic and local. The original plan carries the medium-risk label from the risk panel. The alternative is labeled as a sandbox placeholder. This comparison helps the traveler understand the trade-offs before making a local decision.

---

## Scene 6: Local Keep/Switch Ending (20 seconds)

The user makes a local decision — Keep the current plan or Switch to an alternative. This is a UI-only selection. No booking, payment, reservation, ticket, order, verification, or other external action occurs. The final screen states explicitly that no external action has been created. Direct Gemini 3.7 live extraction succeeded via the Interactions API, verified separately. Nosana workload validated offline; live execution was not verified. Atlas Sandbox Search/Verify was verified separately. The browser walkthrough itself uses fictional local fixtures and makes no provider calls.

---

## Closing Line

This review-first flow keeps the traveler in control at every step — an honest local demo with fictional fixtures and live provider processing where explicitly labelled, ready for separately authorized live-service validation when each provider is deployed and evidence is collected.
