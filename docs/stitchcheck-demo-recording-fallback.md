# StitchCheck Demo Recording Fallback

## Current Gate Status

- **Local app status**: Running and accessible at http://localhost:5173/
- **Kokoro TTS**: Unavailable — voiceover rendering is blocked
- **HyperFrames CLI**: Unavailable — composition rendering is blocked
- **Substitute voice**: Not authorized
- **Video artifacts**: None created; no partial or complete MP4 exists

No video artifact should be claimed as created. This document prepares for manual recording or future automated rendering once the required tools are available.

---

## Manual Recording Setup

For a human operator to record the demo manually:

1. **Start or reuse the local app**
   - Navigate to the `app/` directory
   - Run `npm run dev` if not already running
   - Confirm the app loads at http://localhost:5173/

2. **Configure browser viewport**
   - Set viewport to 1440x900 or another dimension at least 1280x720
   - Disable browser extensions that add UI overlays
   - Clear browser cache to ensure fresh state

3. **Prepare the recording environment**
   - Hide all terminals and command-line windows
   - Close or hide `.env.local`, credentials, or any secret-bearing files
   - Disable desktop notifications
   - Close unrelated browser tabs and applications
   - Ensure no personal data, bookmarks bar, or browsing history is visible

4. **Use synthetic fixture data only**
   - Select from GEM-01 through GEM-05 fixtures
   - Do not upload real screenshots or personal data
   - All displayed data must be fictional (AAA/BBB/CCC airports, SC-101/SC-202 flights)

5. **Begin from a fresh app state**
   - Reload the page to reset all state
   - Confirm the safety notice is visible
   - Start recording only after the app is fully loaded

6. **Record only the real local StitchCheck UI**
   - Capture the actual running application
   - Do not recreate UI elements in external tools
   - Do not composite or fabricate screenshots

---

## Six-Shot Storyboard

### Shot 1: Traveler Problem and Initial State
- **Duration**: 12 seconds (0:00–0:12)
- **Visible UI action**: App loads with safety notice visible; header shows "StitchCheck — Synthetic Demo — No Live Services"
- **Voiceover text**: "StitchCheck helps budget travelers understand the hidden risk of stitching two separately purchased flight tickets. When flights are booked as separate tickets, each is an independent contract. If the first flight is delayed and you miss the second, the second airline has no obligation to rebook or refund. This local demo shows a review-first approach to understanding itinerary risk before making decisions."
- **Caption text**: "StitchCheck helps budget travelers understand the hidden risk of stitching two separately purchased flight tickets. When flights are booked as separate tickets, each is an independent contract. If the first flight is delayed and you miss the second, the second airline has no obligation to rebook or refund. This local demo shows a review-first approach to understanding itinerary risk before making decisions."
- **Evidence/proof point**: Safety notice visible; "Synthetic Demo" badge in header
- **Failure/retry note**: If safety notice is not visible, reload the page. If the app shows a blank screen or error, check the terminal for build errors and restart with `npm run dev`.

### Shot 2: Synthetic Itinerary Fixture Selection
- **Duration**: 16 seconds (0:12–0:28)
- **Visible UI action**: User acknowledges safety notice, proceeds to upload screen, selects GEM-01 fixture from the five available synthetic screenshots
- **Voiceover text**: "The demo begins with synthetic itinerary screenshots. These are fictional images containing no real passenger data, booking references, or payment information. The user selects from pre-built fixtures — in this case, GEM-01, a clear two-leg itinerary. The extraction label reads: OpenRouter temporary path — not direct Gemini validation. This extraction was produced via a temporary path and is not direct Gemini validation."
- **Caption text**: "The demo begins with synthetic itinerary screenshots. These are fictional images containing no real passenger data, booking references, or payment information. The user selects from pre-built fixtures — in this case, GEM-01, a clear two-leg itinerary. The extraction label reads: OpenRouter temporary path — not direct Gemini validation. This extraction was produced via a temporary path and is not direct Gemini validation."
- **Evidence/proof point**: Upload panel visible; GEM-01 fixture selected; source label "OpenRouter temporary path — not direct Gemini validation" visible
- **Failure/retry note**: If fixtures do not load, verify the app has access to the fixture files in the parent directory. If the label is missing, check `app/src/data/labels.ts` for the exact text.

### Shot 3: Editable Extraction and One User Correction
- **Duration**: 17 seconds (0:28–0:45)
- **Visible UI action**: Itinerary review screen shows extracted fields; user edits the second-leg flight number from SC-202 to SC-299; correction note appears
- **Voiceover text**: "Extracted itinerary fields are displayed for review. All fields are editable — the user can correct any value before confirming. In this demo, the second-leg flight number is corrected from SC-202 to SC-299. The correction is recorded locally. This review-and-correct step ensures the traveler has full control over the itinerary data before any downstream processing."
- **Caption text**: "Extracted itinerary fields are displayed for review. All fields are editable — the user can correct any value before confirming. In this demo, the second-leg flight number is corrected from SC-202 to SC-299. The correction is recorded locally. This review-and-correct step ensures the traveler has full control over the itinerary data before any downstream processing."
- **Evidence/proof point**: Editable fields visible; flight number changed; correction note "Changed secondLeg.flightNumber: SC-202 → SC-299" appears
- **Failure/retry note**: If fields are not editable, check browser console for JavaScript errors. If correction notes do not appear, verify the `onFieldChange` handler in `app/src/components/ItineraryReview.tsx` is wired correctly.

### Shot 4: Explicit Confirmation and Downstream Unlock
- **Duration**: 15 seconds (0:45–1:00)
- **Visible UI action**: Risk and alternatives panels show "Confirm itinerary first" with lock icons; user clicks "Confirm itinerary"; panels unlock
- **Voiceover text**: "Before confirmation, the risk and alternatives panels are disabled. They display: Confirm itinerary first. This is the confirmation gate — downstream decision-support panels unlock only after the user explicitly confirms the reviewed itinerary. No risk calculation or alternative search begins before this step. The user clicks Confirm, and the panels activate with local placeholder data."
- **Caption text**: "Before confirmation, the risk and alternatives panels are disabled. They display: Confirm itinerary first. This is the confirmation gate — downstream decision-support panels unlock only after the user explicitly confirms the reviewed itinerary. No risk calculation or alternative search begins before this step. The user clicks Confirm, and the panels activate with local placeholder data."
- **Evidence/proof point**: Disabled panels visible with "Confirm itinerary first" text; lock icons visible; after confirmation, panels show data
- **Failure/retry note**: If panels do not show the disabled message, reload and check that `userConfirmed` state is false. If panels do not unlock after confirmation, verify the `handleConfirm` function in `app/src/App.tsx` sets `userConfirmed` to true.

### Shot 5: Local Risk and Alternatives Placeholder Review
- **Duration**: 20 seconds (1:00–1:20)
- **Visible UI action**: Risk panel shows heuristic risk band (medium) with disclaimer; alternatives panel shows two synthetic options; comparison view displays side-by-side
- **Voiceover text**: "The risk panel displays a heuristic risk estimate — in this case, medium risk with a score of 0.42. The disclaimer states this is a synthetic local placeholder, not Nosana evidence. Nosana is represented only as a planned local role and has not been executed. The alternatives panel shows two synthetic options labeled as Atlas Sandbox placeholders. Atlas is also a planned local role and has not been executed. The comparison view displays the original itinerary alongside these placeholders. No provider claim is being made from local placeholders."
- **Caption text**: "The risk panel displays a heuristic risk estimate — in this case, medium risk with a score of 0.42. The disclaimer states this is a synthetic local placeholder, not Nosana evidence. Nosana is represented only as a planned local role and has not been executed. The alternatives panel shows two synthetic options labeled as Atlas Sandbox placeholders. Atlas is also a planned local role and has not been executed. The comparison view displays the original itinerary alongside these placeholders. No provider claim is being made from local placeholders."
- **Evidence/proof point**: Risk panel shows "medium" band and disclaimer; alternatives panel shows two options with "sandbox-placeholder" source; comparison table visible
- **Failure/retry note**: If risk or alternatives panels are blank, check that fixture data is loaded in `app/src/data/fixtures.ts`. If labels are missing, verify `LABELS.nosanaRisk` and `LABELS.atlasAlternatives` in `app/src/data/labels.ts`.

### Shot 6: Local Keep or Switch Selection and Safe Close
- **Duration**: 20 seconds (1:20–1:40)
- **Visible UI action**: User selects "Keep current plan"; confirmation screen appears with final statement; demo ends
- **Voiceover text**: "The user makes a local decision: Keep the current plan or Switch to an alternative. This is a UI-only selection — no booking, payment, reservation, ticket, order, verification, or other external action occurs. The final screen states explicitly that no external action has been created. Direct Gemini remains unexecuted. Nosana and Atlas remain unexecuted. This local demo ends here, having demonstrated the review-first flow with synthetic data and zero external calls."
- **Caption text**: "The user makes a local decision: Keep the current plan or Switch to an alternative. This is a UI-only selection — no booking, payment, reservation, ticket, order, verification, or other external action occurs. The final screen states explicitly that no external action has been created. Direct Gemini remains unexecuted. Nosana and Atlas remain unexecuted. This local demo ends here, having demonstrated the review-first flow with synthetic data and zero external calls."
- **Evidence/proof point**: Decision buttons visible; final statement "No booking, payment, reservation, ticket, order, verification, or other write action has been created" visible
- **Failure/retry note**: If decision buttons do not respond, check browser console for errors. If final statement does not appear, verify `FINAL_STATEMENT` constant in `app/src/data/labels.ts` and its usage in `app/src/components/DecisionPanel.tsx`.

**Total target duration**: 100 seconds (within 90–120 second range)

---

## Voiceover Script

### Scene 1 (0:00–0:12)
StitchCheck helps budget travelers understand the hidden risk of stitching two separately purchased flight tickets. When flights are booked as separate tickets, each is an independent contract. If the first flight is delayed and you miss the second, the second airline has no obligation to rebook or refund. This local demo shows a review-first approach to understanding itinerary risk before making decisions.

### Scene 2 (0:12–0:28)
The demo begins with synthetic itinerary screenshots. These are fictional images containing no real passenger data, booking references, or payment information. The user selects from pre-built fixtures — in this case, GEM-01, a clear two-leg itinerary. The extraction label reads: OpenRouter temporary path — not direct Gemini validation. This extraction was produced via a temporary path and is not direct Gemini validation.

### Scene 3 (0:28–0:45)
Extracted itinerary fields are displayed for review. All fields are editable — the user can correct any value before confirming. In this demo, the second-leg flight number is corrected from SC-202 to SC-299. The correction is recorded locally. This review-and-correct step ensures the traveler has full control over the itinerary data before any downstream processing.

### Scene 4 (0:45–1:00)
Before confirmation, the risk and alternatives panels are disabled. They display: Confirm itinerary first. This is the confirmation gate — downstream decision-support panels unlock only after the user explicitly confirms the reviewed itinerary. No risk calculation or alternative search begins before this step. The user clicks Confirm, and the panels activate with local placeholder data.

### Scene 5 (1:00–1:20)
The risk panel displays a heuristic risk estimate — in this case, medium risk with a score of 0.42. The disclaimer states this is a synthetic local placeholder, not Nosana evidence. Nosana is represented only as a planned local role and has not been executed. The alternatives panel shows two synthetic options labeled as Atlas Sandbox placeholders. Atlas is also a planned local role and has not been executed. The comparison view displays the original itinerary alongside these placeholders. No provider claim is being made from local placeholders.

### Scene 6 (1:20–1:40)
The user makes a local decision: Keep the current plan or Switch to an alternative. This is a UI-only selection — no booking, payment, reservation, ticket, order, verification, or other external action occurs. The final screen states explicitly that no external action has been created. Direct Gemini remains unexecuted. Nosana and Atlas remain unexecuted. This local demo ends here, having demonstrated the review-first flow with synthetic data and zero external calls.

---

## Caption File Draft

**Note**: This is a DRAFT WebVTT file. Cue timings must be retimed after Kokoro WAV durations are measured. Current timings are approximate placeholders aligned to the six shots.

```webvtt
WEBVTT

1
00:00:00.000 --> 00:00:12.000
StitchCheck helps budget travelers understand the hidden risk of stitching two
separately purchased flight tickets. When flights are booked as separate tickets,
each is an independent contract. If the first flight is delayed and you miss the
second, the second airline has no obligation to rebook or refund. This local demo
shows a review-first approach to understanding itinerary risk before making decisions.

2
00:00:12.000 --> 00:00:28.000
The demo begins with synthetic itinerary screenshots. These are fictional images
containing no real passenger data, booking references, or payment information. The
user selects from pre-built fixtures — in this case, GEM-01, a clear two-leg
itinerary. The extraction label reads: OpenRouter temporary path — not direct
Gemini validation. This extraction was produced via a temporary path and is not
direct Gemini validation.

3
00:00:28.000 --> 00:00:45.000
Extracted itinerary fields are displayed for review. All fields are editable — the
user can correct any value before confirming. In this demo, the second-leg flight
number is corrected from SC-202 to SC-299. The correction is recorded locally. This
review-and-correct step ensures the traveler has full control over the itinerary
data before any downstream processing.

4
00:00:45.000 --> 00:01:00.000
Before confirmation, the risk and alternatives panels are disabled. They display:
Confirm itinerary first. This is the confirmation gate — downstream decision-support
panels unlock only after the user explicitly confirms the reviewed itinerary. No risk
calculation or alternative search begins before this step. The user clicks Confirm,
and the panels activate with local placeholder data.

5
00:01:00.000 --> 00:01:20.000
The risk panel displays a heuristic risk estimate — in this case, medium risk with a
score of 0.42. The disclaimer states this is a synthetic local placeholder, not
Nosana evidence. Nosana is represented only as a planned local role and has not been
executed. The alternatives panel shows two synthetic options labeled as Atlas Sandbox
placeholders. Atlas is also a planned local role and has not been executed. The
comparison view displays the original itinerary alongside these placeholders. No
provider claim is being made from local placeholders.

6
00:01:20.000 --> 00:01:40.000
The user makes a local decision: Keep the current plan or Switch to an alternative.
This is a UI-only selection — no booking, payment, reservation, ticket, order,
verification, or other external action occurs. The final screen states explicitly
that no external action has been created. Direct Gemini remains unexecuted. Nosana
and Atlas remain unexecuted. This local demo ends here, having demonstrated the
review-first flow with synthetic data and zero external calls.
```

---

## Later Rendering Checklist

Before a final MP4 can be claimed, these gates must pass:

- [ ] Kokoro TTS is available with the `af_heart` voice at approximately speed 0.95
- [ ] Each of the six scenes has a separate WAV file generated by Kokoro
- [ ] Each WAV duration is measured with `ffprobe` and is at least 1.5 seconds shorter than its scene duration
- [ ] Captions are retimed to match the measured WAV durations (not the draft timings above)
- [ ] Audio is mounted at scene start plus 1 second offset
- [ ] HyperFrames `check` passes, if HyperFrames is used for composition
- [ ] Final MP4 is rendered with both video and audio streams
- [ ] `ffprobe` metadata is recorded: duration, dimensions, video codec, audio codec
- [ ] A six-frame contact sheet is extracted (one frame per scene) and visually inspected
- [ ] Contact sheet shows no blank, broken, cropped, or wrong-app frames
- [ ] All generated text artifacts (narration files, SRT, production report) are searched for forbidden content
- [ ] No credentials, PII, raw provider output, or real booking/payment data appears in any artifact
- [ ] No product source files were modified during production

---

## Blocker Resolution

To unblock video production, these prerequisites must be met:

1. **Kokoro TTS environment**: Provide an approved environment with Kokoro installed and the `af_heart` voice available. Do not use macOS robotic voices or any unapproved substitute.

2. **HyperFrames CLI** (if composition rendering is required): Provide HyperFrames in the PATH or specify an alternative composition tool that is approved.

3. **Rerun the original workflow**: Once both tools are available, rerun the original video-production task from the beginning. Do not attempt partial workarounds.

---

## Evidence Boundaries

These exact distinctions must be maintained in all demo artifacts:

- **Gemini**: `OpenRouter temporary path — not direct Gemini validation`. Direct Gemini remains unexecuted.
- **Nosana**: Synthetic local placeholder only; not live evidence. Nosana has not been executed or deployed.
- **Atlas**: Synthetic local placeholder only; not live evidence. Atlas has not been authenticated or executed.
- **No external transaction or booking exists**. No booking, payment, reservation, ticket, order, verification, or other write action occurs at any point in the demo.

---

## Verification

Before finalizing this fallback document:

- [x] Exactly six storyboard shots exist
- [x] Timing target is 100 seconds (within 90–120 second range)
- [x] Exact Gemini label "OpenRouter temporary path — not direct Gemini validation" appears once in Scene 2 voiceover
- [x] Document does not contain credentials, secrets, PII, raw provider output, or real booking/payment data
- [x] Only `docs/stitchcheck-demo-recording-fallback.md` was created
