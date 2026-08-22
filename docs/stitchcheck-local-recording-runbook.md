# StitchCheck Local Recording Runbook

## Recording Decision

**Decision**: Record the local demo now.

**Rationale**:
- Do not wait for live Gemini, Nosana, or Atlas execution.
- The current local demo is complete, type-checked, build-verified, and acceptance-tested.
- A later live-validation video is optional and must be created only after separate authorization and successful evidence collection for each service.
- The current recording is a local-demo artifact that honestly represents the review-first flow with synthetic data.
- No provider has been executed live; all risk and alternatives data are local placeholders.

---

## Pre-Recording Checklist

Before starting the recording, verify:

- [ ] **Local app starts successfully**: Run `npm run dev` from `app/` and confirm the app loads at http://localhost:5173/ without errors.
- [ ] **Fresh browser state**: Clear browser cache, disable extensions, and reload the page to ensure a clean start.
- [ ] **Viewport size**: Set browser viewport to at least 1280x720, preferably 1440x900, to ensure all UI elements are visible and readable.
- [ ] **Synthetic fixture data only**: Confirm you will select from GEM-01 through GEM-05 fixtures; do not upload real screenshots.
- [ ] **No sensitive content visible**: Hide or close:
  - Terminal windows
  - `.env.local` or any credential files
  - Browser autofill suggestions
  - Desktop notifications
  - Personal tabs, bookmarks, or browsing history
  - Any unrelated applications
- [ ] **Browser zoom and text readable**: Set zoom to 100% and confirm all labels, buttons, and field values are legible.
- [ ] **No external service calls occur**: Confirm the app runs entirely locally; no network requests to Gemini, OpenRouter, Nosana, or Atlas are made.

---

## Recording Sequence

**Target total duration**: Approximately 100 seconds (90–120 seconds acceptable)

### Step 1: Show the Itinerary-Risk Problem and Initial Disabled State
**Approximate duration**: 12 seconds (0:00–0:12)

**Screen action**:
- App loads with safety notice visible
- Header shows "StitchCheck — Synthetic Demo — No Live Services"
- Risk and alternatives panels are not yet visible (will appear after confirmation)

**Spoken line**:
"StitchCheck helps budget travelers understand the hidden risk of stitching two separately purchased flight tickets. When flights are booked as separate tickets, each is an independent contract. If the first flight is delayed and you miss the second, the second airline has no obligation to rebook or refund. This local demo shows a review-first approach to understanding itinerary risk before making decisions."

**Visible proof point**:
- Safety notice panel visible
- "Synthetic Demo" badge in header
- No live-service claims

**Recovery action if retake needed**:
Reload the page to reset to the initial state. If the safety notice does not appear, check the terminal for build errors and restart with `npm run dev`.

---

### Step 2: Select a Synthetic Itinerary Fixture
**Approximate duration**: 16 seconds (0:12–0:28)

**Screen action**:
- Click "I understand — continue with synthetic data" on safety notice
- Upload panel appears with five fixture slots (GEM-01 through GEM-05)
- Select GEM-01 fixture
- Extraction result appears with itinerary fields
- Source label "OpenRouter temporary path — not direct Gemini validation" is visible

**Spoken line**:
"The demo begins with synthetic itinerary screenshots. These are fictional images containing no real passenger data, booking references, or payment information. The user selects from pre-built fixtures — in this case, GEM-01, a clear two-leg itinerary. The extraction label reads: OpenRouter temporary path — not direct Gemini validation. This extraction was produced via a temporary path and is not direct Gemini validation."

**Visible proof point**:
- Upload panel with fixture selection
- GEM-01 fixture selected
- Source label visible: "OpenRouter temporary path — not direct Gemini validation"

**Recovery action if retake needed**:
Click "Restart demo" to return to the safety notice. If fixtures do not load, verify the app has access to fixture files in the parent directory.

---

### Step 3: Review Extracted Fields and Make One Visible Correction
**Approximate duration**: 17 seconds (0:28–0:45)

**Screen action**:
- Itinerary review screen shows extracted fields (origin, destination, dates, flight numbers, times, connection duration)
- All fields are editable
- Edit the second-leg flight number from SC-202 to SC-299
- Correction note appears: "Changed secondLeg.flightNumber: SC-202 → SC-299"

**Spoken line**:
"Extracted itinerary fields are displayed for review. All fields are editable — the user can correct any value before confirming. In this demo, the second-leg flight number is corrected from SC-202 to SC-299. The correction is recorded locally. This review-and-correct step ensures the traveler has full control over the itinerary data before any downstream processing."

**Visible proof point**:
- Editable fields visible
- Flight number changed from SC-202 to SC-299
- Correction note visible

**Recovery action if retake needed**:
Reload the page and repeat Steps 1–2. If fields are not editable, check browser console for JavaScript errors.

---

### Step 4: Explicitly Confirm the Itinerary and Show Downstream Panels Unlocking
**Approximate duration**: 15 seconds (0:45–1:00)

**Screen action**:
- Before confirmation: scroll down to show risk and alternatives panels displaying "Confirm itinerary first" with lock icons
- Click "Confirm itinerary" button
- Status banner appears: "Itinerary confirmed. No external service call was made."
- Risk and alternatives panels unlock and display placeholder data

**Spoken line**:
"Before confirmation, the risk and alternatives panels are disabled. They display: Confirm itinerary first. This is the confirmation gate — downstream decision-support panels unlock only after the user explicitly confirms the reviewed itinerary. No risk calculation or alternative search begins before this step. The user clicks Confirm, and the panels activate with local placeholder data."

**Visible proof point**:
- Disabled panels with "Confirm itinerary first" text and lock icons (before confirmation)
- Confirmation button clicked
- Panels unlock and show data (after confirmation)

**Recovery action if retake needed**:
Reload the page and repeat Steps 1–3. If panels do not show the disabled message, verify `userConfirmed` state is false. If panels do not unlock after confirmation, check the `handleConfirm` function in `app/src/App.tsx`.

---

### Step 5: Review Local Risk and Alternatives Placeholder Panels
**Approximate duration**: 20 seconds (1:00–1:20)

**Screen action**:
- Risk panel shows:
  - Risk band: "medium"
  - Risk score: 0.42
  - Heuristic disclaimer visible
  - Source label: "Synthetic local placeholder — not Nosana evidence"
- Alternatives panel shows:
  - Two synthetic alternatives (one-stop and nonstop)
  - Source environment: "sandbox-placeholder"
  - Source label: "Synthetic local placeholder — not Atlas Sandbox evidence"
- Comparison view displays original itinerary alongside alternatives

**Spoken line**:
"The risk panel displays a heuristic risk estimate — in this case, medium risk with a score of 0.42. The disclaimer states this is a synthetic local placeholder, not Nosana evidence. Nosana is represented only as a planned local role and has not been executed. The alternatives panel shows two synthetic options labeled as Atlas Sandbox placeholders. Atlas is also a planned local role and has not been executed. The comparison view displays the original itinerary alongside these placeholders. No provider claim is being made from local placeholders."

**Visible proof point**:
- Risk panel with "medium" band, score 0.42, and disclaimer
- Alternatives panel with two options and "sandbox-placeholder" source
- Source labels visible: "Synthetic local placeholder — not Nosana evidence" and "Synthetic local placeholder — not Atlas Sandbox evidence"
- Comparison table visible

**Recovery action if retake needed**:
Reload and repeat Steps 1–4. If risk or alternatives panels are blank, check that fixture data is loaded in `app/src/data/fixtures.ts`. If labels are missing, verify `LABELS.nosanaRisk` and `LABELS.atlasAlternatives` in `app/src/data/labels.ts`.

---

### Step 6: Select Keep or Switch Locally and End Without an External Action
**Approximate duration**: 20 seconds (1:20–1:40)

**Screen action**:
- Decision panel shows "Keep current plan" and "Switch to alternative" buttons
- Click "Keep current plan"
- Decision summary appears
- Click "Confirm decision"
- Final screen appears with statement: "No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only."
- Metadata shows: noOrderCreated: true, syntheticDemo: true, externalCallsMade: false

**Spoken line**:
"The user makes a local decision: Keep the current plan or Switch to an alternative. This is a UI-only selection — no booking, payment, reservation, ticket, order, verification, or other external action occurs. The final screen states explicitly that no external action has been created. Direct Gemini remains unexecuted. Nosana and Atlas remain unexecuted. This local demo ends here, having demonstrated the review-first flow with synthetic data and zero external calls."

**Visible proof point**:
- Decision buttons visible
- Final statement visible: "No booking, payment, reservation, ticket, order, verification, or other write action has been created"
- Metadata: noOrderCreated: true, syntheticDemo: true, externalCallsMade: false

**Recovery action if retake needed**:
Reload and repeat Steps 1–5. If decision buttons do not respond, check browser console for errors. If final statement does not appear, verify `FINAL_STATEMENT` constant in `app/src/data/labels.ts`.

---

## Exact Evidence Language

These exact labels must be visible and spoken during the recording:

1. **Gemini extraction label**: `OpenRouter temporary path — not direct Gemini validation`
2. **Nosana risk label**: `Synthetic local placeholder — not Nosana evidence`
3. **Atlas alternatives label**: `Synthetic local placeholder — not Atlas Sandbox evidence`

**Status statements**:
- Direct Gemini is unexecuted.
- Nosana is unexecuted and not deployed.
- Atlas is unexecuted and not authenticated.
- Local placeholders are not live provider results.

---

## Suggested Opening and Closing

**Opening line**:
"StitchCheck is a local demo that helps budget travelers understand the hidden risk of stitching two separately purchased flight tickets — before they commit."

**Closing line**:
"This review-first flow ensures human control at every step, with synthetic data and zero external calls — because transparency comes before decisions."

---

## Recording Do-Not-Show List

Do not show or mention:

- `.env.local` or any environment files
- Credentials, tokens, API keys, cookies, or browser autofill
- Personal information (names, emails, phone numbers, addresses)
- Raw provider output (unredacted API responses)
- Real booking, payment, reservation, ticket, order, or verification data
- Any Atlas authorization or booking screen
- Any terminal command that exposes sensitive information
- Any claim that Gemini, Nosana, or Atlas has been executed live

---

## Later Live-Validation Separation

A future live-service video requires, **separately**:

1. **Human authorization** for each service (Gemini, Nosana, Atlas)
2. **Required credentials/configuration** provisioned in `.env.local` (gitignored)
3. **A fresh smoke test** for each service with synthetic, non-PII inputs
4. **Evidence artifacts** recorded honestly (real responses or honest errors/timeouts)
5. **Correct labels** applied to each service's actual execution status
6. **A new recording** that shows only behavior actually executed

**Do not** execute live services now. Do not suggest executing them without separate authorization. A live-validation video is optional and must be created only after all prerequisites are met and evidence is collected.

---

## Final Human Sign-Off

**Recording date**: _______________

**Operator**: _______________

**Local demo walkthrough completed**: [ ] Yes  [ ] No

**Six proof points visible**:
- [ ] Safety notice and synthetic-demo badge
- [ ] Source label: "OpenRouter temporary path — not direct Gemini validation"
- [ ] Editable fields with one correction visible
- [ ] Confirmation gate with "Confirm itinerary first" disabled state
- [ ] Source labels: "Synthetic local placeholder — not Nosana evidence" and "Synthetic local placeholder — not Atlas Sandbox evidence"
- [ ] Final statement: "No booking, payment, reservation, ticket, order, verification, or other write action has been created"

**Evidence labels checked**: [ ] Yes  [ ] No

**Privacy/safety checked**: [ ] Yes  [ ] No

**Final local-demo status**: [ ] Ready  [ ] Not Ready

**Notes**:
_____________________________________________
_____________________________________________
_____________________________________________

---

## Verification

Before finalizing this runbook:

- [x] Exactly six recording steps exist
- [x] Target duration is approximately 100 seconds (12 + 16 + 17 + 15 + 20 + 20 = 100)
- [x] All three exact evidence labels appear in Step 2, Step 5, and the Evidence Language section
- [x] No unsupported live-service claims appear
- [x] No secrets, PII, raw provider output, or booking/payment data appears
- [x] Only `docs/stitchcheck-local-recording-runbook.md` was created
