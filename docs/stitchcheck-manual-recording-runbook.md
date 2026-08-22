# StitchCheck Manual Recording Runbook

## Why Manual Recording

Automated capture and rendering are blocked because Playwright/Chromium, Hyperframes, and Kokoro TTS are unavailable in the current environment. The automated pipeline documented in `output/demo-artifacts/stitchcheck-video/manifest.md` cannot proceed without these dependencies.

However, the local StitchCheck app itself starts successfully and runs correctly. This manual workflow demonstrates the local UI behavior only — the review-first flow, the confirmation gate, and the Keep/Switch decision — using synthetic fixture data and zero external service calls.

## Recording Setup

**Local app URL:** `http://localhost:5173`

**Start command:** From the `app/` directory, run `npm run dev` (if not already running). Confirm the app loads with the safety notice and "Synthetic Demo — No Live Services" badge visible.

**Recommended viewport:** 1440×900 or 1920×1080 at 100% browser zoom. Recording resolution should match the viewport.

**Target duration:** 90–120 seconds (approximately 15–20 seconds per shot).

**Hide before recording:**
- Terminal windows and command-line interfaces
- Desktop notifications and system alerts
- Browser extensions that add UI overlays
- Unrelated browser tabs and bookmarks bar
- `.env.local`, credentials, API keys, or any secret-bearing files
- Personal information, autofill suggestions, browsing history
- Code editors, file explorers, or unrelated applications

**Synthetic fixture requirement:** Use only the pre-built synthetic fixtures (GEM-01 through GEM-05). Do not upload real screenshots, personal data, or any image containing PII, real booking references, or payment information.

**Recording tool:** Use the operating system's built-in screen recorder (macOS: Cmd+Shift+5; Windows: Win+G; Linux: distribution-specific tool). No dependency installation is needed.

**Audio:** Record narration live or add voiceover in post-production using the narration cues below.

## Six-Shot Sequence

| Shot | Target Time | Human Action | Required Visible Proof | Narration Cue |
|------|-------------|--------------|------------------------|---------------|
| 1 | 0:00–0:15 | Open the local app. Acknowledge the safety notice. Observe the initial state with downstream panels locked. | Safety notice visible. "Synthetic Demo — No Live Services" badge in header. Risk and Alternatives panels show `Confirm itinerary first` with lock icons. | "StitchCheck is a local demo that helps budget travelers understand the hidden risk of stitching two separately purchased flight tickets. Before we begin, note that this is a synthetic demo — no live services are called at any point." |
| 2 | 0:15–0:35 | Select synthetic fixture GEM-01. Review the extracted itinerary fields. Edit one field (e.g., change second-leg flight number from SC-202 to SC-299). Observe the correction note. | Upload panel with fixture selection visible. GEM-01 selected. Extracted fields populated and editable. Correction note visible: "Changed secondLeg.flightNumber: SC-202 → SC-299." Source label visible: `OpenRouter temporary path — not direct Gemini validation`. | "The demo begins with synthetic itinerary screenshots — fictional images containing no real passenger data. The extracted fields are fully editable, so the traveler can correct any value before confirming. In this case, we correct the second-leg flight number." |
| 3 | 0:35–0:50 | Scroll to show the Risk and Alternatives panels in their locked state. Click the "Confirm itinerary" button. Observe the status banner and panels unlocking. | Before confirmation: panels show `Confirm itinerary first` with lock icons. After confirmation: status banner appears ("Itinerary confirmed. No external service call was made."). Panels unlock with placeholder data. | "Before confirmation, the risk and alternatives panels are disabled. They display: Confirm itinerary first. This is the confirmation gate — downstream panels unlock only after the user explicitly confirms the reviewed itinerary. No risk calculation or alternative search begins before this step." |
| 4 | 0:50–1:10 | Observe the unlocked Risk panel showing a heuristic risk band (e.g., medium risk, score 0.42) with disclaimer. Observe the Alternatives panel showing two synthetic options. | Risk panel: medium band, score 0.42, heuristic disclaimer, source label "Synthetic local placeholder — not Nosana evidence." Alternatives panel: two options with source label "Synthetic local placeholder — not Atlas Sandbox evidence." | "After confirmation, StitchCheck shows local risk and alternatives states. The risk panel displays a heuristic estimate — in this case, medium risk. The disclaimer states this is a synthetic local placeholder, not Nosana evidence. Nosana is a planned role and has not been executed. The alternatives panel shows synthetic options labeled as Atlas Sandbox placeholders. Atlas is also a planned role and has not been executed." |
| 5 | 1:10–1:25 | Open the comparison view to display the original itinerary alongside a synthetic alternative side by side. Observe all three required source labels are visible. | Comparison table visible showing original itinerary and placeholder alternative. All three labels visible: `OpenRouter temporary path — not direct Gemini validation`, `Synthetic local placeholder — not Nosana evidence`, `Synthetic local placeholder — not Atlas Sandbox evidence`. | "The comparison view displays the original itinerary alongside a placeholder alternative. All three required source labels are visible, making it clear which data is local placeholder and which came from the temporary extraction path. Gemini is intended for structured extraction, while Nosana and Atlas have planned roles for risk and comparison. Their live execution is not claimed here." |
| 6 | 1:25–1:40 | Select "Keep current plan" or "Switch to alternative." Confirm the decision. Observe the final statement. | Decision buttons visible. Final statement: "No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only." Metadata visible: noOrderCreated: true, syntheticDemo: true, externalCallsMade: false. | "This local demo ends with a Keep or Switch decision. It never books, pays, reserves, tickets, verifies, or performs another external action. The final screen states explicitly that no external action has been created. Direct Gemini remains unexecuted. Nosana and Atlas remain unexecuted. This local demo ends here, having demonstrated the review-first flow with synthetic data and zero external calls." |

**Total target duration:** approximately 100 seconds (within 90–120 second range).

## Claim-Safe Narration

**Shot 1:** "StitchCheck is a local demo that helps budget travelers understand the hidden risk of stitching two separately purchased flight tickets. Before we begin, note that this is a synthetic demo — no live services are called at any point."

**Shot 2:** "The demo begins with synthetic itinerary screenshots — fictional images containing no real passenger data. The extracted fields are fully editable, so the traveler can correct any value before confirming. In this case, we correct the second-leg flight number. The extraction label reads: OpenRouter temporary path — not direct Gemini validation."

**Shot 3:** "Before confirmation, the risk and alternatives panels are disabled. They display: Confirm itinerary first. This is the confirmation gate — downstream panels unlock only after the user explicitly confirms the reviewed itinerary. No risk calculation or alternative search begins before this step."

**Shot 4:** "After confirmation, StitchCheck shows local risk and alternatives states. The risk panel displays a heuristic estimate — in this case, medium risk. The disclaimer states this is a synthetic local placeholder, not Nosana evidence. Nosana is a planned role and has not been executed. The alternatives panel shows synthetic options labeled as Atlas Sandbox placeholders. Atlas is also a planned role and has not been executed."

**Shot 5:** "The comparison view displays the original itinerary alongside a placeholder alternative. All three required source labels are visible, making it clear which data is local placeholder and which came from the temporary extraction path. Gemini is intended for structured extraction, while Nosana and Atlas have planned roles for risk and comparison. Their live execution is not claimed here."

**Shot 6:** "This local demo ends with a Keep or Switch decision. It never books, pays, reserves, tickets, verifies, or performs another external action. The final screen states explicitly that no external action has been created. Direct Gemini remains unexecuted. Nosana and Atlas remain unexecuted. This local demo ends here, having demonstrated the review-first flow with synthetic data and zero external calls."

## Retake Rules

1. **Missed click:** If a click is missed or a UI element is not clearly captured, stop the recording. Reload the page to reset the app to its initial state. Restart the affected shot from the beginning without changing any source files or fixture data.

2. **Wrong fixture:** If the wrong fixture is selected or an unintended field is edited, stop the recording. Reload the page. Restart from Shot 2 with the correct fixture (GEM-01 through GEM-05) and the intended correction.

3. **Gate not visible:** If the `Confirm itinerary first` message or lock icons are not visible before confirmation, stop the recording. Reload the page. Verify the app displays the confirmation gate in its initial locked state before restarting.

4. **Required label not visible:** If any of the three required source labels (`OpenRouter temporary path — not direct Gemini validation`, `Synthetic local placeholder — not Nosana evidence`, `Synthetic local placeholder — not Atlas Sandbox evidence`) is missing or unreadable, stop the recording. Reload the page. Verify the labels are present in the app's source data before restarting.

5. **Unexpected personal or credential information:** If any personal information, credential, API key, `.env.local` content, PII, or unrelated tab/notification appears in the recording, stop immediately. Close the recording software. Hide or close the unwanted content. Restart the entire recording from Shot 1 with a clean environment.

## Final Export Checklist

- [ ] Target duration is approximately 90–120 seconds.
- [ ] All six shots are understandable and follow the sequence.
- [ ] Exact labels are readable:
  - `OpenRouter temporary path — not direct Gemini validation`
  - `Synthetic local placeholder — not Nosana evidence`
  - `Synthetic local placeholder — not Atlas Sandbox evidence`
- [ ] No terminals, credentials, `.env.local`, PII, or notifications appear in any frame.
- [ ] No live provider execution is claimed in narration or visuals.
- [ ] The recording ends in a local no-external-action state with the final statement visible.
- [ ] Filename: `stitchcheck-local-demo-YYYY-MM-DD.mp4` (replace YYYY-MM-DD with the recording date).

## Evidence Note

This recording demonstrates local UI behavior only — the review-first flow, the confirmation gate, editable extraction, and the Keep/Switch decision — using synthetic fixture data and zero external service calls. It is not live Gemini, Nosana, or Atlas provider evidence. Direct Gemini remains unexecuted. Nosana remains unexecuted and not deployed. Atlas remains unauthenticated and unexecuted. All risk estimates, alternative options, and extraction results shown are local placeholders, not live provider responses.
