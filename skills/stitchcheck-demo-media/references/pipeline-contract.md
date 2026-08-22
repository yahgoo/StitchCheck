# Six-Scene Pipeline Contract

This document defines the six-scene video pipeline for the StitchCheck demo walkthrough.

## Scene 1: Locked `Confirm itinerary first`

**Duration:** 12 seconds  
**Purpose:** Show the initial disabled state before user confirmation.

### Visual Elements
- App loads with safety notice visible
- Header shows "StitchCheck — Synthetic Demo — No Live Services"
- Navigate to itinerary review screen
- Risk panel and Alternatives panel both display `Confirm itinerary first`
- Lock icons visible on both panels
- `aria-disabled="true"` state visible

### Required Labels
- None (safety badge in header serves as boundary indicator)

### Narration
"StitchCheck helps budget travelers understand the hidden risk of stitching two separately purchased flight tickets. When flights are booked as separate tickets, each is an independent contract. If the first flight is delayed and you miss the second, the second airline has no obligation to rebook or refund. This local demo shows a review-first approach to understanding itinerary risk before making decisions."

### Screenshot Capture Points
- Initial locked state with both panels disabled
- Lock icons and `Confirm itinerary first` message clearly visible

---

## Scene 2: Editable Field and Correction

**Duration:** 16 seconds  
**Purpose:** Demonstrate editable extraction and user correction.

### Visual Elements
- Upload panel with five fixture slots (GEM-01 through GEM-05)
- Select GEM-01 fixture
- Extraction result appears with itinerary fields
- Source label visible: `OpenRouter temporary path — not direct Gemini validation`
- All fields are editable (text inputs visible)
- Edit second-leg flight number from `SC-202` to `SC-299`
- Correction note appears: `Changed secondLeg.flightNumber: "SC-202" → "SC-299"`

### Required Labels
- `OpenRouter temporary path — not direct Gemini validation` (visible beside extracted fields)

### Narration
"The demo begins with synthetic itinerary screenshots — fictional images containing no real passenger data, booking references, or payment information. The user selects GEM-01, a clear two-leg itinerary. The extraction label reads: OpenRouter temporary path — not direct Gemini validation. This is structured-extraction functionality only; direct Gemini remains unexecuted. Extracted itinerary fields are displayed for review. All fields are editable — the user can correct any value before confirming. In this demo, the second-leg flight number is corrected from SC-202 to SC-299. The correction is recorded locally. This editable extraction and user correction step ensures the traveler has full control over the itinerary data before any downstream processing."

### Screenshot Capture Points
- Upload panel with GEM-01 selected
- Editable fields with source label visible
- Correction note after field edit

---

## Scene 3: Confirmation and Unlocked Panels

**Duration:** 17 seconds  
**Purpose:** Show the confirmation gate unlocking downstream panels.

### Visual Elements
- Scroll to show Risk and Alternatives panels in disabled state
- Click "Confirm itinerary" button
- Status banner appears: "Itinerary confirmed. No external service call was made."
- Panels unlock with local placeholder data
- Transition from locked to unlocked state visible

### Required Labels
- None (confirmation action is the focus)

### Narration
"Before confirmation, the risk and alternatives panels are disabled. They display: Confirm itinerary first. This is the confirmation gate — downstream decision-support panels unlock only after the user explicitly confirms the reviewed itinerary. No risk calculation or alternative search begins before this step. The user clicks Confirm, and the panels activate with local placeholder data."

### Screenshot Capture Points
- Before: disabled panels with lock icons
- After: unlocked panels with placeholder data
- Status banner visible

---

## Scene 4: Sanitized Provider Status

**Duration:** 15 seconds  
**Purpose:** Show risk and alternatives panels with required evidence labels.

### Visual Elements
- Risk panel displays medium risk band (score 0.42)
- Heuristic disclaimer visible
- Risk panel source label: `Synthetic local placeholder — not Nosana evidence`
- Alternatives panel shows two synthetic options
- Alternatives panel source label: `Synthetic local placeholder — not Atlas Sandbox evidence`

### Required Labels
- `Synthetic local placeholder — not Nosana evidence` (visible in risk panel header)
- `Synthetic local placeholder — not Atlas Sandbox evidence` (visible in alternatives panel header)

### Narration
"The risk panel displays a heuristic risk estimate — medium risk with a score of 0.42. The disclaimer states this is a synthetic local placeholder — not Nosana evidence. Nosana is a planned role whose smoke test was intentionally blocked before any network request due to missing infrastructure; it has not been deployed or executed. The alternatives panel shows two synthetic options labeled as Atlas Sandbox placeholders. Atlas is a planned, read-only role represented by local fixtures only and has not been authenticated or executed."

### Screenshot Capture Points
- Risk panel with label visible
- Alternatives panel with label visible
- Heuristic disclaimer text visible

---

## Scene 5: Comparison

**Duration:** 20 seconds  
**Purpose:** Show side-by-side comparison of original itinerary and alternatives.

### Visual Elements
- Comparison view displays original itinerary alongside alternative
- Table format with route summary, times, duration, connection type, price
- Original plan shows self-transfer with tight connection
- Alternative shows safer option with longer connection
- Source labels visible for both panels

### Required Labels
- Labels from Scene 4 remain visible

### Narration
"The comparison view displays the original itinerary alongside a placeholder alternative. The side-by-side table shows route details, connection times, and pricing. All data is synthetic and local. The original plan carries the medium-risk label from the risk panel. The alternative is labeled as a sandbox placeholder. This comparison helps the traveler understand the trade-offs before making a local decision."

### Screenshot Capture Points
- Full comparison table visible
- Original and alternative columns clearly labeled
- Risk band visible for original plan

---

## Scene 6: Local Keep/Switch Ending

**Duration:** 20 seconds  
**Purpose:** Show final decision and no-external-action statement.

### Visual Elements
- Decision panel shows "Keep current plan" and "Switch to alternative"
- Select "Keep current plan"
- Confirm decision
- Final screen appears with no-external-action statement
- Metadata visible: `noOrderCreated: true`, `syntheticDemo: true`, `externalCallsMade: false`
- Final statement: "No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only."

### Required Labels
- None (final statement serves as closing boundary)

### Narration
"The user makes a local decision — Keep the current plan or Switch to an alternative. This is a UI-only selection. No booking, payment, reservation, ticket, order, verification, or other external action occurs. The final screen states explicitly that no external action has been created. Direct Gemini 3.7 was live-verified separately. Atlas Sandbox Search/Verify was verified separately. Nosana uses local fallback in this walkthrough. This local demo ends here, having demonstrated the review-first flow with synthetic data — the demo UI itself makes no live service calls."

### Screenshot Capture Points
- Decision buttons visible
- Final statement clearly visible
- Metadata showing no external actions

---

## Total Duration

**100 seconds** (12 + 16 + 17 + 15 + 20 + 20)

## Scene Transition Rules

- Each scene ends with a 1-second fade to black
- Each scene begins with a 1-second fade from black
- Narration continues across transitions without gap
- No external music or sound effects

## Required Visual Proof Checklist

The recording must clearly show:
1. Initial disabled downstream state with `Confirm itinerary first`
2. Editable extracted field with user correction visible
3. Explicit confirmation action (button click)
4. Downstream panels becoming available after confirmation
5. All three required source labels at appropriate moments
6. Local Keep or Switch choice with no-external-action end state
