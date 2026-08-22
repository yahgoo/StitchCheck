# StitchCheck Recording-Day Readiness

## Purpose

This document prepares a human operator to record the approximately 100-second StitchCheck local demo. It consolidates preflight checks, required takes, narration constraints, failure-recovery procedures, and go/no-go criteria from the existing recording artifacts into a single planning and verification reference. This document does not perform recording, does not execute any service, and does not modify any source file or evidence record.

---

## Preflight Checklist

- [ ] **Local demo commands match `app/package.json`.** The dev server starts with `npm run dev` (Vite 8), type-check runs with `npm run typecheck` (`tsc --noEmit`), and production build runs with `npm run build` (`tsc -b && vite build`). The app loads at http://localhost:5173/.
- [ ] **Type-check has a documented passing result.** `npm run typecheck` passes with zero errors. Documented in `docs/stitchcheck-final-recording-handoff.md` and `docs/stitchcheck-recording-readiness-verification.md`.
- [ ] **Production build has a documented passing result.** `npm run build` passes (242.84 kB). Documented in `docs/stitchcheck-final-recording-handoff.md` and `docs/stitchcheck-recording-readiness-verification.md`.
- [ ] **Browser starts from a fresh state.** Clear browser cache, disable extensions, and reload the page. Confirm the safety notice and "SYNTHETIC DEMO — NO LIVE SERVICES" badge are visible. Verified in `docs/stitchcheck-recording-rehearsal-report.md` (12/12 proof points passed).
- [ ] **Synthetic fixture data is selected.** Use only GEM-01 through GEM-05 pre-built fixtures. Do not upload real screenshots, personal images, or any data containing PII, real booking references, or payment information.
- [ ] **Browser viewport is suitable for the walkthrough.** Set viewport to 1440×900 (preferred) or at least 1280×720. Confirm all labels, buttons, and panels are fully visible and readable at 100% zoom.
- [ ] **Terminal, `.env.local`, credentials, notifications, personal data, and unrelated tabs are hidden.** Close or hide all terminal windows, environment files, credential-bearing files, browser autofill suggestions, desktop notifications, personal tabs, bookmarks, and unrelated applications.
- [ ] **No network or authentication activity is planned.** The local demo makes zero external network requests. No API key, credential, or authentication flow is accessed, displayed, or triggered during recording.
- [ ] **The exact evidence labels are visible in the intended flow.** Before recording, verify that all three labels are present and readable at their respective stages: `OpenRouter temporary path — not direct Gemini validation` (extraction), `Synthetic local placeholder — not Nosana evidence` (risk panel), `Synthetic local placeholder — not Atlas Sandbox evidence` (alternatives panel).

---

## Required Takes

| # | Take | Duration | Required visible behavior | Pass condition |
|---|------|----------|--------------------------|----------------|
| 1 | Full uninterrupted demo | ~100 s | Complete six-segment walkthrough: safety notice → fixture selection → editable correction → confirmation gate → risk/alternatives review → Keep/Switch close. | All six segments flow without interruption; all three evidence labels visible; final no-external-action statement appears; narration matches visible UI throughout. |
| 2 | Confirmation-gate close-up | ~15 s | Risk and Alternatives panels visible in disabled state with lock icons and the text `Confirm itinerary first`. Scroll down to show both panels before clicking Confirm. | `Confirm itinerary first` is clearly readable on both panels; lock icons are visible; panels are visibly disabled before confirmation. |
| 3 | Editable-field correction | ~17 s | Itinerary review screen shows extracted fields. Edit the second-leg flight number from SC-202 to SC-299. Correction note appears. | The field is visibly edited; the correction note "Changed secondLeg.flightNumber: SC-202 → SC-299" (or equivalent) appears; no external action is triggered. |
| 4 | Unlock transition | ~15 s | Click "Confirm itinerary." Show the transition from disabled panels to enabled panels with placeholder data. Status banner appears. | The disabled state is shown first, then the confirmation action, then the panels unlock with data; the status banner confirms no external service call was made. |
| 5 | Source-label close-up | ~20 s | All three evidence-boundary labels are clearly visible and readable: Gemini extraction label, Nosana risk label, Atlas alternatives label. | Each label is legible at the recording viewport; labels match the exact required text; no label is clipped, obscured, or missing. |
| 6 | Local decision close | ~20 s | Decision panel shows "Keep current plan" and "Switch to alternative." Select one. Confirm decision. Final statement and metadata appear. | The decision buttons are visible; the final statement "No booking, payment, reservation, ticket, order, verification, or other write action has been created" is visible; metadata shows noOrderCreated: true, syntheticDemo: true, externalCallsMade: false. |

---

## Narration Constraints

### Statements the presenter must make:

- **This is a local demo using synthetic fixtures.** All data is fictional (AAA/BBB/CCC airports, SC-101/SC-202 flights). No real passenger data, booking references, or payment information is used.
- **User review and explicit confirmation precede downstream decision support.** The confirmation gate ensures that risk and alternatives panels remain disabled until the user explicitly confirms the reviewed itinerary.
- **Gemini wording uses:** `OpenRouter temporary path — not direct Gemini validation` — This exact phrase must be spoken and visible during the extraction/fixture-selection segment.
- **Nosana smoke test was blocked before any network request.** Nosana is a planned role whose smoke test was intentionally blocked due to missing infrastructure. It has not been deployed, authenticated, or executed.
- **Atlas remains local, unauthenticated, and unexecuted.** Atlas is represented by local synthetic fixtures only. No Atlas Sandbox search, authentication, or execution has occurred.
- **No booking, payment, reservation, ticket, order, verification, or external write action occurs.** The demo is entirely read-only and UI-only. No external transaction of any kind is created at any point.

### Claims the presenter must not make:

- **Direct Gemini was tested or passed.** Do not state or imply that Google Gemini was directly called, validated, or produced results.
- **Nosana was deployed, authenticated, executed, or validated.** Do not claim any Nosana workload was submitted, executed, or returned results. The smoke test was blocked before any network request.
- **Atlas Sandbox was authenticated, executed, or validated.** Do not claim any Atlas search was performed, authenticated, or returned results.
- **Local placeholders are live provider results.** Do not state, imply, or visually suggest that any risk estimate, alternative option, or extraction result is a live provider response.

---

## Failure Recovery

1. **Missed click.** Stop the recording. Do not attempt to continue or patch the take. Reload the page in the browser to reset the app to its initial state. Restart the affected take from the beginning of that segment. Do not change any source files, configuration, or fixture data. No external calls are made during a reload.

2. **Browser state mismatch.** Stop the recording. Close and reopen the browser to a fresh session with cache cleared. Navigate to http://localhost:5173/ and confirm the safety notice loads correctly with the synthetic-demo badge visible. Restart the recording from Take 1. Do not modify any source files, environment configuration, or running processes. If the app fails to load, follow the operator guide (`docs/stitchcheck-local-demo-operator-guide.md`) to restart the dev server.

3. **Missing or incorrect label.** Stop the recording. Reload the page to reset all application state. Verify the app displays all expected labels by checking the relevant source data files (`app/src/data/labels.ts`, `app/src/data/fixtures.ts`) without modifying them. Confirm the label text matches the exact required wording. Restart the affected take once the UI is confirmed correct. Do not change source files, install packages, or make external calls.

4. **Unexpected visual defect.** Stop the recording. Reload the page to reset to a clean state. If the defect persists after reload, check the browser console for errors and the terminal for build errors. If the dev server needs restarting, use `npm run dev` from `app/`. Do not modify source files to fix a visual defect during recording. Restart the affected take once the UI renders correctly. If the defect cannot be resolved without code changes, stop and document the issue for a separate fix.

5. **Recording interruption.** If the recording tool fails, the file is corrupted, or the recording is accidentally stopped: do not attempt to resume or splice. Reload the browser to a fresh state, confirm the app loads correctly, and restart the entire recording from Take 1. Do not change any source files, credentials, or configuration. Treat the interrupted recording as discarded.

---

## Evidence and File Safety

- **No credentials are needed for local recording.** The local demo runs entirely without API keys, tokens, or authentication. No credential file needs to be opened, read, or referenced.
- **Do not open or expose `.env.local`.** The environment file must remain hidden throughout the recording. Do not display it in any terminal, editor, file browser, or screen share.
- **Do not include PII, raw provider output, real booking/payment data, or secrets.** All data in the recording must be synthetic and fictional (AAA/BBB/CCC airports, SC-101/SC-202 flights, fictional dates and times).
- **Do not modify evidence records during recording.** Do not alter any file in `smoke-tests/`, `app/src/data/`, or any results, fixtures, or evidence file. Recording is a read-only observation of the running app.
- **Store any human-created recording outside the repository unless a separate explicit packaging task is approved.** Video, audio, and screenshot files produced by the recording should be saved to a location outside the project directory. Do not commit or add media files to the repository without a separate approved workflow.

---

## Go/No-Go

### GO

- Local demo reproduces the documented flow.
- Confirmation gate and labels are visible.
- The presenter can complete the script within approximately 100 seconds.
- No forbidden content is visible.
- The human reviewer approves the take.

### NO-GO

- The local app cannot reproduce the flow.
- The confirmation gate is missing or bypassed.
- Any provider is described as live without valid evidence.
- A credential, PII, or real transaction data appears.
- Recording requires a network call or authentication.

---

## Human Sign-Off

- **Recorder:** _______________
- **Reviewer:** _______________
- **Date/time:** _______________
- **Selected take:** _______________
- **Final decision:** GO / NO-GO
- **Notes:**
  _____________________________________________
  _____________________________________________
  _____________________________________________
