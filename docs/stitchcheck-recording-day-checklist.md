# StitchCheck Recording-Day Checklist

## Before Recording

- [ ] Local app is running at http://localhost:5173/
- [ ] Browser is at 1440×900 or another viewport at least 1280×720
- [ ] Fresh browser state is loaded (cache cleared, extensions disabled)
- [ ] Synthetic fixture data is selected (GEM-01 through GEM-05 only)
- [ ] Terminals, `.env.local`, credentials, notifications, personal data, and unrelated tabs are hidden
- [ ] Narration script and fallback captions are open separately
- [ ] Recording is framed as a local demo (not live services)

---

## Six Visible Moments

### Moment 1: Initial Disabled State with `Confirm itinerary first`

**Show:** After selecting a fixture and proceeding to review, scroll down to show the Risk and Alternatives panels in their disabled state with lock icons and the text "Confirm itinerary first."

**Say:** "Before confirmation, the risk and alternatives panels are disabled. They display: Confirm itinerary first. This is the confirmation gate — downstream panels unlock only after the user explicitly confirms the reviewed itinerary."

---

### Moment 2: Synthetic Fixture Selection

**Show:** Return to the upload panel and show the five fixture options (GEM-01 through GEM-05). Select GEM-01 and point out the source label.

**Say:** "We select from pre-built synthetic fixtures — in this case, GEM-01, a clear two-leg itinerary. The extraction label reads: OpenRouter temporary path — not direct Gemini validation."

---

### Moment 3: Editable Field and User Correction

**Show:** On the itinerary review screen, edit the second-leg flight number from SC-202 to SC-299. Show the correction note that appears.

**Say:** "Extracted itinerary fields are fully editable. The user can correct any value before confirming. In this demo, we correct the second-leg flight number from SC-202 to SC-299. The correction is recorded locally."

---

### Moment 4: Explicit Itinerary Confirmation and Panel Unlock

**Show:** Click "Confirm itinerary." Show the status banner and the panels transitioning from disabled to enabled.

**Say:** "The user clicks Confirm, and the panels activate with local placeholder data. No risk calculation or alternative search begins before this step. The confirmation gate ensures human control at every step."

---

### Moment 5: Local Risk and Alternatives Placeholder States with Labels

**Show:** Point out the Risk panel (medium band, score 0.42) and the Alternatives panel (two synthetic options). Point out all three evidence labels.

**Say:** "The risk panel displays a heuristic estimate — medium risk with a score of 0.42. The disclaimer states this is a synthetic local placeholder, not Nosana evidence. The alternatives panel shows two synthetic options labeled as Atlas Sandbox placeholders. Atlas is also a planned local role and has not been executed."

---

### Moment 6: Local Keep or Switch Outcome with No External Action

**Show:** Click "Keep current plan" or "Switch to alternative," then "Confirm decision." Show the final statement.

**Say:** "The user makes a local decision — no booking, payment, reservation, ticket, order, verification, or other external action occurs. The final screen states explicitly that no external action has been created. Direct Gemini remains unexecuted. Nosana and Atlas remain unexecuted."

---

## Exact Evidence Labels

These exact labels must be visible and spoken during the recording:

1. `OpenRouter temporary path — not direct Gemini validation`
2. `Synthetic local placeholder — not Nosana evidence`
3. `Synthetic local placeholder — not Atlas Sandbox evidence`

**Service execution status:**

- Direct Gemini remains unexecuted.
- Nosana remains unexecuted and not deployed.
- Atlas remains unexecuted and not authenticated.
- Local placeholders are not live provider results.

---

## Safety Stop

**Stop recording immediately if any of these occur:**

1. Any secret, credential, token, cookie, or PII appears.
2. The app is blank, broken, clipped, or shows the wrong state.
3. `Confirm itinerary first` is missing or unreadable.
4. A provider is described as live without evidence.
5. Any booking, payment, reservation, ticket, order, verification, or external action appears.

**If a stop condition occurs:** Stop immediately. Do not continue or attempt to fix during recording. Document the issue, reset to a fresh state, and re-verify before resuming.

---

## After Recording

- [ ] Save the recording using a local-demo filename (e.g., `stitchcheck-local-demo-YYYY-MM-DD.mp4`)
- [ ] Review the complete recording before sharing
- [ ] Confirm the six moments are visible
- [ ] Confirm narration matches the visible UI
- [ ] Confirm no forbidden content appears (no credentials, PII, raw provider output, booking/payment data)
- [ ] Keep the recording separate from any future live-service validation video

---

## Human Sign-Off

- **Operator:** _______________
- **Date:** _______________
- **Browser viewport:** _______________
- **Recording completed:** [ ] Yes  [ ] No
- **Six moments visible:** [ ] Yes  [ ] No
- **Evidence labels checked:** [ ] Yes  [ ] No
- **Safety review completed:** [ ] Yes  [ ] No
- **Retake needed:** [ ] Yes  [ ] No
- **Notes:**
  _____________________________________________
  _____________________________________________
  _____________________________________________
