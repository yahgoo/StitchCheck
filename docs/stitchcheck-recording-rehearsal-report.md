# StitchCheck Recording Rehearsal Report

## Result

**REHEARSAL PASSED — READY TO RECORD**

---

## Environment

- **Local app URL:** http://localhost:5173/
- **Browser viewport:** 1440x900 (verified via browser agent)
- **Fresh-state result:** Confirmed — page loads cleanly with safety notice visible
- **Synthetic fixtures used:** Yes — GEM-01 through GEM-05 available, GEM-01 selected for rehearsal
- **Credentials/tokens/cookies:** None accessed or displayed
- **Environment files:** `.env.local` not accessed or modified

---

## Proof-Point Results

| # | Proof Point | Pass/Fail | What Was Visibly Confirmed | Retake Note |
|---|-------------|-----------|----------------------------|-------------|
| 1 | Fresh initial state is visible | ✅ PASS | Safety notice visible with "SYNTHETIC DEMO — NO LIVE SERVICES" badge. Full disclaimer text displayed. "I understand — continue with synthetic data" button present. | None |
| 2 | A synthetic itinerary fixture can be selected | ✅ PASS | Upload panel appeared with two dropdown slots. Selected "GEM-01: Clear fictional two-leg itinerary" in both slots. Fixture preview images loaded. "Continue to review" button enabled. | None |
| 3 | An extracted field can be edited | ✅ PASS | All itinerary fields displayed as editable textboxes/spinbuttons: First Leg (AAA→BBB, SC-101, 08:00–10:30), Second Leg (BBB→CCC, SC-202, 13:00–15:45), Connection Duration (150 min). All fields clickable and editable. | None |
| 4 | One visible correction can be made before confirmation | ✅ PASS | Edited second-leg flight number from "SC-202" to "SC-299". Correction note appeared: "Corrections recorded — Changed secondLeg.flightNumber: 'SC-202' → 'SC-299'". | None |
| 5 | Risk and Alternatives panels are visible but disabled | ✅ PASS | Both "Connection Risk" and "Safer Alternatives" panels visible below itinerary form. Both marked `disabled` in accessibility tree. Lock/disabled state visible. Source labels present on both panels. | None |
| 6 | The exact text "Confirm itinerary first" is readable | ✅ PASS | Exact text "Confirm itinerary first" visible on both Connection Risk panel and Safer Alternatives panel. Text is clear and readable. | None |
| 7 | Explicit itinerary confirmation unlocks the panels | ✅ PASS | Clicked "Confirm itinerary" button. Form replaced with "✓ Itinerary Confirmed" summary showing corrected flight number SC-299. Both Risk and Alternatives panels now enabled (no longer `disabled`), showing full data content with dropdowns and detailed information. | None |
| 8 | Required evidence labels are visible and readable | ✅ PASS | All three labels visible and readable: (1) "OpenRouter temporary path — not direct Gemini validation" in confirmed itinerary section, (2) "Synthetic local placeholder — not Nosana evidence" in Connection Risk panel, (3) "Synthetic local placeholder — not Atlas Sandbox evidence" in Safer Alternatives panel. | None |
| 9 | Local risk and alternatives placeholder content is understandable | ✅ PASS | Risk panel shows: Risk Band = "medium", Score = "0.42", heuristic explanation text, dataset "synthetic-demo-v0". Alternatives panel shows: Two synthetic options (AAA→BBB→CCC one-stop 7h40m, AAA→CCC direct 3h50m) with placeholder pricing and availability. Content is clear and labeled as synthetic. | None |
| 10 | Keep or Switch can be selected locally | ✅ PASS | Clicked "Keep current plan". "Your Decision: Keep" section appeared with text: "You have chosen to keep your current self-transfer plan. This is a local demo decision only. No booking, payment, reservation, ticket, order, verification, or any other external action has been created or will be created." "Confirm decision" button present. | None |
| 11 | The flow ends without any external action | ✅ PASS | Clicked "Confirm decision". "Demo Complete — No Action Created" section appeared with exact statement: "No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only." Structured data shows: noOrderCreated: true, syntheticDemo: true, externalCallsMade: false, decision: keep. | None |
| 12 | Refresh/reset behavior matches the operator guide | ✅ PASS | Reloaded the page. Returned to initial safety notice state with "SYNTHETIC DEMO — NO LIVE SERVICES" badge, full disclaimer text, and "I understand — continue with synthetic data" button. All prior state cleared. Matches operator guide specification. | None |

**Total: 12/12 PASS**

---

## Narration Readiness

**Status: READY**

The six-step spoken narrative can be delivered naturally within approximately 100 seconds. Each step has clear visual proof points that align with the narration script in `docs/stitchcheck-local-recording-runbook.md`. The flow is smooth, with no awkward pauses or unclear transitions. The disabled-state panels (proof points 5–6) are now visible before confirmation, allowing the operator to demonstrate the confirmation gate as specified in the narration.

**Estimated timing by step:**
- Step 1 (Initial state): ~12 seconds
- Step 2 (Fixture selection): ~16 seconds
- Step 3 (Review and correction): ~17 seconds
- Step 4 (Disabled panels and confirmation): ~15 seconds
- Step 5 (Risk and alternatives review): ~20 seconds
- Step 6 (Keep/Switch and close): ~20 seconds

**Total: ~100 seconds** (within the 90–120 second target range)

---

## Evidence Boundaries

The following exact labels were verified as visible and readable during the rehearsal:

1. **Gemini extraction label:** `OpenRouter temporary path — not direct Gemini validation`
2. **Nosana risk label:** `Synthetic local placeholder — not Nosana evidence`
3. **Atlas alternatives label:** `Synthetic local placeholder — not Atlas Sandbox evidence`

**Service execution status:**
- **Direct Gemini:** Remains unexecuted. Only the OpenRouter temporary path has been tested (GEM-01).
- **Nosana:** Remains unexecuted and not deployed. Only local placeholder fixtures exist.
- **Atlas:** Remains unexecuted and not authenticated. Only local placeholder fixtures exist.

**Local placeholders are not live provider evidence.** All risk and alternatives data displayed during the rehearsal are synthetic fixture shapes, not results from live service execution.

---

## Safety Result

The rehearsal confirmed the following safety properties:

| Safety Check | Result |
|--------------|--------|
| Any credentials or secrets visible? | **No** |
| Any PII (personally identifiable information) visible? | **No** |
| Any raw provider output visible? | **No** |
| Any booking action occurred? | **No** |
| Any payment action occurred? | **No** |
| Any reservation action occurred? | **No** |
| Any ticketing action occurred? | **No** |
| Any order creation occurred? | **No** |
| Any verification action occurred? | **No** |
| Any external action occurred? | **No** |

**All safety checks passed.** The rehearsal used only synthetic fixture data, made no network requests, accessed no credentials, and performed no external actions. The final statement explicitly confirms that no external action was created.

---

## Final Operator Action

**Proceed with one manual recording using `docs/stitchcheck-final-recording-handoff.md`.**

All 12 proof points passed on the first run with no issues encountered. The local demo is fully rehearsal-ready and meets all requirements for manual recording. The operator should:

1. Set browser viewport to 1440x900 (or at least 1280x720)
2. Start from a fresh browser state
3. Follow the six-step flow in `docs/stitchcheck-final-recording-handoff.md`
4. Use the narration script from `docs/stitchcheck-local-recording-runbook.md`
5. Ensure all three evidence labels are clearly visible and spoken
6. Verify the disabled-state panels are shown before confirmation
7. Confirm the final statement appears after the Keep/Switch decision

**No retakes or fixes are required.** The demo is ready for recording.
