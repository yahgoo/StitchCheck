# Troubleshooting Guide

This document covers common issues and recovery procedures for the StitchCheck demo media pipeline.

## Pre-Recording Checks

### Dev Server Not Running

**Symptom:** Cannot access `http://localhost:5173`

**Solution:**
```bash
cd app
npm run dev
```

Wait for the server to start and note the URL shown in the terminal.

### Build Errors

**Symptom:** `npm run typecheck` or `npm run build` fails

**Solution:**
1. Check for TypeScript errors in the output
2. Verify all dependencies are installed: `npm install`
3. Check that Node.js version is compatible (18+ recommended)
4. Review error messages and fix source files if needed

### Fixtures Not Loading

**Symptom:** Fixture selection screen shows empty slots

**Solution:**
1. Verify `app/src/data/fixtures.ts` exists
2. Check that GEM-01 through GEM-05 fixtures are defined
3. Restart the dev server

## Scene-Specific Issues

### Scene 1: Locked State Not Visible

**Symptom:** Risk and Alternatives panels do not show `Confirm itinerary first`

**Solution:**
1. Navigate to the itinerary review screen (after selecting a fixture)
2. Do not click "Confirm itinerary" yet
3. Scroll down to see both panels in their disabled state
4. Verify lock icons are visible

### Scene 2: Correction Note Not Appearing

**Symptom:** After editing a field, no correction note appears

**Solution:**
1. Ensure you are changing a field value (not just clicking it)
2. The correction note appears only when the value differs from the original
3. Try changing `SC-202` to `SC-299` in the second-leg flight number field
4. Check browser console for JavaScript errors

### Scene 3: Panels Not Unlocking

**Symptom:** After clicking "Confirm itinerary", panels remain locked

**Solution:**
1. Verify the status banner appears: "Itinerary confirmed..."
2. Check that `userConfirmed` state is true (inspect React devtools if needed)
3. Reload the page and try again
4. Ensure you are on the `confirmed` step (check URL or app state)

### Scene 4: Labels Not Visible

**Symptom:** Evidence labels do not appear on risk or alternatives panels

**Solution:**
1. Verify the panels are unlocked (Scene 3 must be complete)
2. Check that `app/src/data/labels.ts` contains the exact label text
3. Ensure the risk scenario is set to "success" (not "unavailable" or "error")
4. Ensure the alternatives scenario is set to "success"

### Scene 5: Comparison View Empty

**Symptom:** Comparison table shows no data

**Solution:**
1. Verify `comparisonData` is loaded from `getComparisonData()`
2. Check that the itinerary has been confirmed
3. Ensure both risk and alternatives panels have data

### Scene 6: Final Statement Not Visible

**Symptom:** After selecting Keep/Switch, the final statement does not appear

**Solution:**
1. Click "Confirm decision" after selecting Keep or Switch
2. Verify `decisionConfirmed` state is true
3. Check that `FINAL_STATEMENT` constant is defined in `labels.ts`

## Recording Issues

### Browser State Issues

**Symptom:** Browser shows blank screen, error state, or cached stale page

**Recovery:**
1. Stop the recording
2. Close and reopen the browser to a fresh session
3. Clear browser cache
4. Navigate to `http://localhost:5173`
5. Confirm the safety notice loads correctly
6. Restart the recording from Scene 1

### Missed Click or Unclear Narration

**Symptom:** A click is missed or narration does not match the visible screen

**Recovery:**
1. Stop the recording
2. Reload the page in the browser to reset app state
3. Restart the affected scene from the beginning
4. Do not change any source files, configuration, or fixture data

### Visual Defect or Missing Label

**Symptom:** Required evidence label is missing, panel renders incorrectly, text is clipped

**Recovery:**
1. Stop the recording
2. Reload the page to reset all application state
3. Verify the app displays all expected labels
4. Check `app/src/data/labels.ts` and `app/src/data/fixtures.ts` without modifying them
5. Restart the affected scene once the UI is confirmed correct

## Output Issues

### Scene Files Not Created

**Symptom:** Expected `.mp4` files do not appear in `output/stitchcheck-demo-media/scenes/`

**Solution:**
1. Check that the recording tool has write permissions
2. Verify the output directory exists
3. Check disk space
4. Review recording tool logs for errors

### Narration Audio Missing

**Symptom:** No audio track in the final video

**Solution:**
1. Verify microphone or audio input is configured
2. Check that narration was recorded (separate audio file should exist)
3. Ensure audio is properly synced with video timeline
4. Re-record narration if needed

### Final Video Not Concatenated

**Symptom:** Individual scene files exist but no `stitchcheck-demo-full.mp4`

**Solution:**
1. Check that all six scene files are present
2. Verify the concatenation tool is available (ffmpeg or similar)
3. Run the concatenation step manually if needed
4. Check for encoding errors in individual scene files

## Privacy Violations

### Accidental Credential Display

**Symptom:** `.env.local` or terminal with credentials is visible in recording

**Action:**
1. Stop the recording immediately
2. Do not use this recording
3. Restart the recording with terminals and environment files hidden
4. Review the recording frame-by-frame before finalizing

### Real Data Accidentally Used

**Symptom:** Real booking reference, passenger name, or payment data appears

**Action:**
1. Stop the recording immediately
2. Delete the recording
3. Restart with synthetic fixtures only
4. Verify all data is fictional before proceeding

## Recovery Principles

1. **Stop immediately** when an issue is detected
2. **Do not continue** or attempt to patch the recording
3. **Reset the app state** by reloading the page
4. **Restart the affected scene** from the beginning
5. **Do not modify source files** to fix issues during recording
6. **Verify the fix** before resuming recording

## Escalation

If issues persist after following this guide:
1. Check the app's browser console for JavaScript errors
2. Review the dev server terminal for build errors
3. Verify all dependencies are installed
4. Check that the app passes `npm run typecheck` and `npm run build`
5. Consult the operator guide: `docs/stitchcheck-local-demo-operator-guide.md`
