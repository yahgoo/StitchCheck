# StitchCheck Live-Demo Rehearsal Sheet

## Metadata

- **Total duration:** 120 seconds (2 minutes).
- **Format:** Six timed UI actions, one sentence each, with recovery instructions.
- **Data policy:** Synthetic fixtures only. No PII, no credentials, no real booking references.
- **Boundary:** No booking, payment, reservation, ticket, order, verification, or other write action is performed or claimed.

---

## Timed Actions

| # | Time | UI Action (one sentence) |
|---|---|---|
| 1 | 0:00–0:18 | Open the local app, acknowledge the synthetic-demo safety notice, and state the self-transfer risk problem while the header badge reads "Synthetic Demo — No Live Services." |
| 2 | 0:18–0:36 | Select fixture GEM-01 in the upload panel; point to the label **OpenRouter temporary path — not direct Gemini validation** beside the extracted itinerary fields to show where the structured extraction came from. |
| 3 | 0:36–0:52 | Correct the second-leg flight number from SC-202 to SC-299 in the editable itinerary review screen so the correction note appears, demonstrating that every field is human-editable before confirmation. |
| 4 | 0:52–1:06 | Scroll to show both the Risk and Alternatives panels locked with "Confirm itinerary first" and lock icons, then click **Confirm itinerary** to unlock them; the status banner reads "Itinerary confirmed. No external service call was made." |
| 5 | 1:06–1:30 | Show the Risk panel (medium band, score 0.42) with its disclaimer **Synthetic local placeholder — not Nosana evidence**, then show the Alternatives panel labelled **Synthetic local placeholder — not Atlas Sandbox evidence** while stating that Nosana's planned role is connection-risk analysis but no Nosana workload has been executed or deployed. |
| 6 | 1:30–2:00 | Select "Keep current plan" in the Decision panel, confirm, and close by stating that Atlas authentication succeeded and one live read-only production search returned five reference-price offers (Shanghai PVG → Tokyo NRT/HND) with ticketing activation pending and no booking created, while the final screen displays the no-external-action statement. |

---

## Exact Disclosure Moments

### Gemini / OpenRouter live output (Action 2 — 0:18–0:36)

- The on-screen label reads: `OpenRouter temporary path — not direct Gemini validation`.
- Safe spoken sentence: "Structured extraction was tested through an OpenRouter temporary path; direct Gemini remains unexecuted."

### Atlas production-search disclosure (Action 6 — 1:30–2:00)

- Safe spoken sentence: "Atlas authentication was completed through the official Atlas Flight Booking Skill; one live read-only search returned five real production offers — Shanghai PVG to Tokyo NRT and HND — all carrying reference-price status with ticketing activation pending; no booking, payment, or order was created."
- The demo Alternatives panel itself remains a local placeholder labelled `Synthetic local placeholder — not Atlas Sandbox evidence`.

### Nosana wording (Action 5 — 1:06–1:30)

- Safe spoken sentence: "Nosana's planned role is connection-risk analysis; in this demo no Nosana workload has been executed or deployed — what you see is a local placeholder shape only."
- The on-screen label reads: `Synthetic local placeholder — not Nosana evidence`.

### Confirm itinerary first (Action 4 — 0:52–1:06)

- Before click: both panels display `Confirm itinerary first` with lock icons and `aria-disabled="true"`.
- After click: status banner reads `Itinerary confirmed. No external service call was made.`

### Local Keep/Switch ending (Action 6 — 1:30–2:00)

- The Decision panel offers "Keep current plan" and "Switch to alternative" as a UI-only local decision.
- Final screen states: "No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only."
- Metadata visible: `noOrderCreated: true`, `syntheticDemo: true`, `externalCallsMade: false`.

---

## Recovery Instructions

### Stale state

1. **Stop speaking.**
2. Reload the page (`Ctrl/Cmd + R`).
3. Restart from **Action 1** (safety notice screen).
4. Do not attempt to resume from a mid-flow state.

### Missing label

1. **Stop speaking.**
2. Reload the page.
3. Verify the label source in `app/src/data/labels.ts` before restarting.
4. Restart from **Action 1** and confirm all three labels are visible at their expected actions before continuing.

### Provider failure (browser error or console exception)

1. **Stop speaking.**
2. Close the browser tab completely.
3. Reopen the browser and navigate to the local dev URL.
4. Restart from **Action 1**.
5. Do not open `.env.local` or use credentials during recovery.
6. No source files, configuration, or fixture data are modified during recovery.

---

## Prohibited Claims — Do Not Say

- Direct Gemini was called, validated, or produced results.
- Nosana was executed, deployed, authenticated, or returned results.
- Atlas Sandbox search was executed (the live search used production Atlas, not Sandbox).
- Any local placeholder is a live provider result.
- Any booking, payment, reservation, ticket, order, or verification was created.
- Credentials, PII, or raw provider output are shown.

---

## Timing Summary

| Action | Time | Duration | Topic |
|---|---|---|---|
| 1 | 0:00–0:18 | 18 s | Problem statement and safety notice |
| 2 | 0:18–0:36 | 18 s | Gemini/OpenRouter extraction with label |
| 3 | 0:36–0:52 | 16 s | Human correction of itinerary field |
| 4 | 0:52–1:06 | 14 s | Confirm itinerary first gate |
| 5 | 1:06–1:30 | 24 s | Risk panel (Nosana status) and Alternatives panel (Atlas status) |
| 6 | 1:30–2:00 | 30 s | Atlas disclosure, Keep/Switch decision, final statement |
| **Total** | | **120 s** | **2 minutes** |
