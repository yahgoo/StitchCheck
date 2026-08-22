# StitchCheck Final Recording Handoff

## Recording Status

**READY FOR MANUAL LOCAL RECORDING**

The recording-blocking defect has been fixed:

- **Before confirmation**: Risk and Alternatives panels are now rendered visibly in disabled state during the review step.
- **Disabled state**: Both panels use `enabled={false}` during review, showing lock icons and the message: `Confirm itinerary first`
- **After explicit confirmation**: The panels unlock and display local placeholder data.

**Important**: No service has been executed live. All displayed data is synthetic and local. Direct Gemini, Nosana, and Atlas remain unexecuted.

---

## Verified Product Flow

### Step 1: Start from the fresh local demo state

**What to click or show:**
- Open http://localhost:5173/ in a fresh browser session
- Show the safety notice screen

**What the audience should see:**
- StitchCheck header with "SYNTHETIC DEMO — NO LIVE SERVICES" badge
- Full safety notice text explaining this is a synthetic demo
- "I understand — continue with synthetic data" button

**What the operator should say:**
"StitchCheck is a local demo that helps budget travelers understand the hidden risk of stitching two separately purchased flight tickets. This is a review-first approach — all data is synthetic, and no live service has been executed."

**What must not be claimed:**
- Do not say Gemini, Nosana, or Atlas has been executed live
- Do not say this is a production application
- Do not claim any real flight data is being used

---

### Step 2: Select a synthetic itinerary fixture

**What to click or show:**
- Click "I understand — continue with synthetic data"
- Show the upload panel with five fixture options (GEM-01 through GEM-05)
- Select GEM-01 for both screenshot slots
- Click "Continue to review"

**What the audience should see:**
- Upload panel with synthetic fixture selection
- GEM-01 fixture previews visible
- Itinerary review screen with extracted fields
- Source label: "OpenRouter temporary path — not direct Gemini validation"

**What the operator should say:**
"We select from pre-built synthetic fixtures — in this case, GEM-01, a clear two-leg itinerary. The extraction label reads: OpenRouter temporary path — not direct Gemini validation. This extraction was produced via a temporary path and is not direct Gemini validation."

**What must not be claimed:**
- Do not say Gemini extracted this in real-time
- Do not say this is live Gemini output
- Do not claim direct Gemini validation has occurred

---

### Step 3: Review extracted fields and make one visible correction

**What to click or show:**
- Show the editable itinerary fields (origin, destination, dates, flight numbers, times, connection duration)
- Edit the second-leg flight number from SC-202 to SC-299
- Show the correction note that appears

**What the audience should see:**
- All fields are editable text inputs
- Flight number changes from SC-202 to SC-299
- Correction note appears: "Changed secondLeg.flightNumber: SC-202 → SC-299"

**What the operator should say:**
"Extracted itinerary fields are fully editable. The user can correct any value before confirming. In this demo, we correct the second-leg flight number from SC-202 to SC-299. The correction is recorded locally. This review-and-correct step ensures the traveler has full control."

**What must not be claimed:**
- Do not say this correction will be sent to any service
- Do not claim the correction triggers any external action
- Do not say this is real flight data

---

### Step 4: Show the disabled Risk and Alternatives panels, then confirm the itinerary

**What to click or show:**
- Scroll down to show the Risk and Alternatives panels in their disabled state
- Show the "Confirm itinerary first" message and lock icons
- Click "Confirm itinerary"

**What the audience should see:**
- Risk panel showing "Confirm itinerary first" with lock icon
- Alternatives panel showing "Confirm itinerary first" with lock icon
- Source labels visible on both panels
- After clicking confirm: status banner appears, panels unlock

**What the operator should say:**
"Before confirmation, the risk and alternatives panels are disabled. They display: Confirm itinerary first. This is the confirmation gate — downstream panels unlock only after the user explicitly confirms the reviewed itinerary. No risk calculation or alternative search begins before this step."

**What must not be claimed:**
- Do not say risk calculation is happening now
- Do not say alternatives are being searched now
- Do not claim any service is being called

---

### Step 5: Review the unlocked local risk and alternatives placeholder states

**What to click or show:**
- Show the unlocked Risk panel with heuristic risk data
- Show the unlocked Alternatives panel with synthetic options
- Show the Comparison view
- Point out all three evidence labels

**What the audience should see:**
- Risk panel: "Connection Risk — Heuristic Result", risk band "medium", score 0.42, heuristic disclaimer
- Risk panel label: "Synthetic local placeholder — not Nosana evidence"
- Alternatives panel: two synthetic alternatives (one-stop and nonstop)
- Alternatives panel label: "Synthetic local placeholder — not Atlas Sandbox evidence"
- Comparison table showing original vs alternatives

**What the operator should say:**
"The risk panel displays a heuristic risk estimate — medium risk with a score of 0.42. The disclaimer states this is a synthetic local placeholder, not Nosana evidence. Nosana is represented only as a planned local role and has not been executed. The alternatives panel shows two synthetic options labeled as Atlas Sandbox placeholders. Atlas is also a planned local role and has not been executed. No provider claim is being made from local placeholders."

**What must not be claimed:**
- Do not say Nosana computed this risk
- Do not say Atlas returned these alternatives
- Do not say these are live service results
- Do not claim Nosana or Atlas has been deployed or executed

---

### Step 6: Select Keep or Switch locally and close without an external action

**What to click or show:**
- Click "Keep current plan" or "Switch to alternative"
- Click "Confirm decision"
- Show the final statement

**What the audience should see:**
- Decision buttons visible
- Decision summary appears
- Final statement: "No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only."
- Metadata: noOrderCreated: true, syntheticDemo: true, externalCallsMade: false

**What the operator should say:**
"The user makes a local decision: Keep the current plan or Switch to an alternative. This is a UI-only selection — no booking, payment, reservation, ticket, order, verification, or other external action occurs. The final screen states explicitly that no external action has been created. Direct Gemini remains unexecuted. Nosana and Atlas remain unexecuted. This local demo ends here, having demonstrated the review-first flow with synthetic data and zero external calls."

**What must not be claimed:**
- Do not say a booking was made
- Do not say a payment was processed
- Do not say a reservation was created
- Do not say any external action occurred
- Do not claim any service was called

---

## Recording Configuration

**App location:**
- Local app only at http://localhost:5173/
- No external services or network requests

**Viewport:**
- Recommended: 1440x900
- Minimum acceptable: 1280x720
- Must be set manually by the operator before recording

**Browser state:**
- Fresh browser session (clear cache, disable extensions)
- No autofill, saved passwords, or personal data visible
- No unrelated tabs or applications visible

**Data:**
- Synthetic fixtures only (GEM-01 through GEM-05)
- No real screenshots or personal data

**Environment:**
- Hide terminal windows
- Hide `.env.local` and any credential files
- Disable desktop notifications
- Close unrelated browser tabs and applications

**Duration:**
- Target: approximately 100 seconds
- Use the existing fallback narration and caption draft from `docs/stitchcheck-demo-recording-fallback.md`

---

## Evidence Labels

These exact labels must be visible and spoken during the recording:

1. **Gemini extraction label**: `OpenRouter temporary path — not direct Gemini validation`
2. **Nosana risk label**: `Synthetic local placeholder — not Nosana evidence`
3. **Atlas alternatives label**: `Synthetic local placeholder — not Atlas Sandbox evidence`

**Status statements:**
- Direct Gemini remains unexecuted.
- Nosana remains unexecuted and not deployed.
- Atlas remains unexecuted and not authenticated.
- Local placeholders are not live provider results.

---

## Safety Boundaries

**The following must NOT occur during recording:**

- ❌ No booking
- ❌ No payment
- ❌ No reservation
- ❌ No ticketing
- ❌ No order creation
- ❌ No verification action
- ❌ No external write action
- ❌ No credentials or personal data
- ❌ No real flight data
- ❌ No live service calls

**The following MUST be true:**

- ✅ All data is synthetic and local
- ✅ No external network requests occur
- ✅ No credentials are accessed or displayed
- ✅ No PII is present
- ✅ All evidence labels are visible
- ✅ Disabled state is shown before confirmation
- ✅ Final statement denies any external action

---

## Known Verification

**Build verification:**
- ✅ Type-check passes (`npm run typecheck`)
- ✅ Production build passes (`npm run build`) — 242.84 kB

**Browser verification:**
- ✅ All 14 recording-readiness checks passed
- ✅ Disabled panels visible before confirmation
- ✅ Panels unlock after confirmation
- ✅ All three evidence labels visible and readable
- ✅ Keep/Switch decision flow works correctly
- ✅ Reset behavior matches operator guide

**Step 13 note:**
- Step 13 (viewport check) requires the human operator to manually set and visually confirm the viewport at 1440x900 or at least 1280x720

**Code changes:**
- ✅ `app/src/App.tsx` contains the minimal recording fix (disabled panels now render in review step)
- ✅ No other source files were modified in the readiness pass
- ✅ No fixture contracts changed
- ✅ No evidence labels changed
- ✅ No service adapters changed

**No invented data:**
- No test commands invented
- No timestamps invented
- No hashes invented
- No service results invented

---

## Final Operator Sign-Off

**Operator:** _______________

**Recording date:** _______________

**Browser viewport:** _______________ (must be at least 1280x720, preferably 1440x900)

**Fresh state confirmed:** [ ] Yes  [ ] No

**Disabled panels visibly shown:** [ ] Yes  [ ] No

**Confirmation unlock visibly shown:** [ ] Yes  [ ] No

**Evidence labels checked:**
- [ ] "OpenRouter temporary path — not direct Gemini validation" visible
- [ ] "Synthetic local placeholder — not Nosana evidence" visible
- [ ] "Synthetic local placeholder — not Atlas Sandbox evidence" visible

**Safety boundaries checked:**
- [ ] No booking/payment/reservation/ticket/order/verification action
- [ ] No credentials or personal data visible
- [ ] No live service calls occurred
- [ ] All data is synthetic and local

**Recording captured:** [ ] Yes  [ ] No

**Retake required:** [ ] Yes  [ ] No

**Notes:**
_____________________________________________
_____________________________________________
_____________________________________________

---

## Stop Conditions

**Recording must stop immediately if:**

- ❌ The disabled panels are not visible before confirmation
- ❌ "Confirm itinerary first" is missing or unreadable
- ❌ Any evidence label is absent or inconsistent
- ❌ A provider is described as live without evidence
- ❌ Any credential, PII, or personal browser data appears
- ❌ Any booking, payment, reservation, ticket, order, verification, or external action appears
- ❌ The UI is blank, broken, clipped, or not the StitchCheck app
- ❌ The app makes unexpected network requests
- ❌ The viewport is below 1280x720 and cannot be adjusted
- ❌ Any error message or console error appears

**If any stop condition occurs:**
1. Stop recording immediately
2. Do not continue or attempt to fix during recording
3. Document the issue
4. Restart from a fresh state if appropriate
5. Re-verify all checks before resuming

---

## Verification

Before finalizing this handoff document:

- [x] All required sections exist
- [x] Exact three evidence labels appear
- [x] Document says the local demo is ready, not live-service-ready
- [x] No secrets, PII, raw provider output, or real booking/payment data appears
- [x] Only `docs/stitchcheck-final-recording-handoff.md` was created
- [x] Six-step flow is complete and verified
- [x] Safety boundaries are prominent
- [x] Stop conditions are clear
