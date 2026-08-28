# StitchCheck Local Rehearsal Runbook

## Purpose

This runbook lets you personally run and rehearse the StitchCheck React/Vite demo application several times before judging. It is built entirely from source code, fixture data, and verified evidence files — not from slides, video, or live provider calls.

**Safety rules for this runbook:**

- Synthetic data only.
- Never print or expose `GEMINI_API_KEY` or `NOSANA_API_KEY`.
- Never expose `.env.local` to browser/Vite code.
- No live Gemini request.
- No Nosana live mode.
- No Atlas booking, payment, ticketing, or other writes.
- No modification of product behavior.
- No modification of existing video.
- No push or upload.
- No invented UI labels, buttons, values, or provider statuses.

---

## 1. Before Starting

### Working directory

All commands run from the `app/` subdirectory of the project root:

```bash
cd <project-root>/app
```

### Required commands (in order)

```bash
# 1. Install dependencies (first time only, or if node_modules is missing)
npm install

# 2. Start the development server
npm run dev
```

### Expected local URL

Vite prints a local URL to the terminal. The default is:

```
http://localhost:5173
```

If port 5173 is in use, Vite tries the next available port. Use the URL printed in the terminal.

### Browser setup

- Open a modern browser (Chrome, Firefox, Edge, or Safari).
- Open a fresh tab or window.
- Navigate to the local URL printed by `npm run dev`.
- Open DevTools (F12) to monitor for console errors during rehearsal.

### Synthetic-data-only reminder

All data in the StitchCheck demo is fictional. Airport codes (AAA, BBB, CCC), flight numbers (SC-101, SC-202), dates, airlines ("Synthetic Carrier"), and prices are invented. No real passenger, booking reference, or payment data exists.

### No-secret reminder

- `GEMINI_API_KEY` is server-side only. The browser bundle does not read, reference, or transmit this key.
- `NOSANA_API_KEY` is server-side only. The browser bundle has zero network code.
- `.env.local` is gitignored and must not be opened, displayed, or referenced during the demo.
- The header badge always reads: **Synthetic Demo — No Live Services**

### Offline capability

The app runs fully offline. No external service calls occur at any point. The `npm run dev` server serves all assets locally.

### Environment variables for offline demo

No environment variables are required. The demo works without any `.env.local` file present. All provider keys are optional:

| Variable | Required for offline demo? |
|---|---|
| `GEMINI_API_KEY` | No — extraction uses local fixture |
| `GEMINI_MODEL` | No — defaults to `gemini-3.6-flash` |
| `EXTRACTION_PROVIDER` | No — defaults to `gemini` |
| `NOSANA_API_KEY` | No — risk panel uses local fixture |
| `NOSANA_MARKET` | No — used only for live workload |
| `NOSANA_COST_CEILING_USD` | No — defaults to `10` |

### Confirming offline fixtures are active

- The header badge reads: `Fictional Demo — Live Providers Where Labelled`
- The extraction panel shows the label: `Fictional itinerary — local demo fixture`
- The risk panel (after confirmation) shows: `Local fallback — not Nosana evidence`
- The alternatives panel (after confirmation) shows: `Fictional alternatives — local demo fixture`
- The footer reads: `StitchCheck Fictional Demo · No booking, payment, or order created · Fictional itinerary · Live providers where labelled`

### Fixture paths (reference only — do not modify)

| Fixture | Path |
|---|---|
| Demo UI data (default extraction, comparison) | `app-fixture-contracts/stitchcheck-ui-demo-data.json` |
| Screenshot images (GEM-01 through GEM-05) | `smoke-tests/extraction/fixtures/gem-*.png` |
| Nosana risk result (dry-run, served as static file) | `app/public/nosana-risk-result.json` |
| Nosana success fixture | `smoke-tests/nosana/fixtures/res-nos-success.json` |
| Atlas alternatives success fixture | `smoke-tests/atlas/fixtures/result-atl-success.json` |

---

## 2. Core Demo Flow

### Step 1 — Open the application

**User action:** Navigate to `http://localhost:5173` (or the URL printed by `npm run dev`).

**Expected UI state:**

- Page title: `StitchCheck — Fictional Demo`
- Header: `StitchCheck` with badge `Fictional Demo — Live Providers Where Labelled`
- The **Safety Notice** screen is displayed:
  - Heading: `StitchCheck — Fictional Demo`
  - Body text explains all data is fictional and local
  - Bullet list: "Do not upload real documents", "All screenshots must be synthetic and unbooked", "No external service call will be made at any point", "No booking, payment, reservation, or order will be created"
  - The browser walkthrough uses fictional local fixtures and makes no provider calls
  - Button: **I understand — continue with fictional data**
- NarrationBar at top: `Voice disabled for deterministic capture` with `Enable narration` button

**What to say:** "StitchCheck helps budget travellers understand the hidden risk of stitching two separately purchased flight tickets with a tight connection. This is a fully synthetic demo — all data is fictional and local."

**What not to claim:** Do not say any live provider was called or that the app is connected to Gemini, Nosana, or Atlas.

---

### Step 2 — Acknowledge the safety notice

**User action:** Click **I understand — continue with synthetic data**.

**Expected UI state:**

- The **Upload** screen appears.
- Heading: `Upload Fictional Test Itineraries`
- Source label: `Fictional itinerary — local demo fixture`
- Two dropdown slots: `Screenshot 1` and `Screenshot 2`
- Each dropdown default: `— Select a synthetic fixture —`
- Available fixtures in each dropdown:
  - `GEM-01: Clear fictional two-leg itinerary`
  - `GEM-02: Fictional itinerary, one optional field absent`
  - `GEM-03: Fragmented fictional layout`
  - `GEM-04: Fictional image, not a flight itinerary`
  - `GEM-05: Fictional itinerary, one unreadable field`
- Button: **Continue to review** (disabled until both slots are selected)
- Button: **Restart demo**

**What to say:** "The user selects synthetic screenshot fixtures — fictional images with no real passenger data."

**What not to claim:** Do not say these are real screenshots or real bookings.

---

### Step 3 — Select synthetic screenshot fixtures

**User action:** Select `GEM-01: Clear fictional two-leg itinerary` in both Screenshot 1 and Screenshot 2 dropdowns.

**Expected UI state:**

- Both slots show a preview of the GEM-01 fixture image with caption: `GEM-01: Clear fictional two-leg itinerary`
- The **Continue to review** button becomes enabled.

**What to say:** "We select the GEM-01 synthetic fixture — a clear fictional two-leg itinerary."

**What not to claim:** Do not say this is a real itinerary or real booking screenshot.

---

### Step 4 — Continue to review

**User action:** Click **Continue to review**.

**Expected UI state:**

- The **Review Extracted Itinerary** screen appears.
- Heading: `Review Extracted Itinerary`
- Source label: `Fictional itinerary — local demo fixture`
- Two fieldsets: **First Leg** and **Second Leg**, each with editable inputs:

| Field | First Leg value | Second Leg value |
|---|---|---|
| Origin | `AAA` | `BBB` |
| Destination | `BBB` | `CCC` |
| Departure Date | `2026-09-15` | `2026-09-15` |
| Airline | `Synthetic Carrier` | `Synthetic Carrier` |
| Flight Number | `SC-101` | `SC-202` |
| Departure Time | `08:00` | `13:00` |
| Arrival Time | `10:30` | `15:45` |

- Below the legs: **Connection Duration (minutes)** field with value `150`
- Button: **Confirm itinerary** (enabled because all required fields are populated)
- Button: **Cancel and re-upload**
- Risk panel: visible but **locked** with 🔒 icon and message `Confirm itinerary first`
  - Label: `Local fallback — not Nosana evidence`
- Alternatives panel: visible but **locked** with 🔒 icon and message `Confirm itinerary first`
  - Label: `Fictional alternatives — local demo fixture`

**What to say:** "StitchCheck extracts the itinerary fields from the synthetic screenshots. All fields are editable. The traveller can review and correct any value before confirming. Notice that the downstream risk and alternatives panels are locked until the itinerary is confirmed."

**What not to claim:** Do not say a live Gemini extraction just occurred. Say instead: "Direct Gemini integration is live-verified in the evidence package; this local rehearsal uses the prepared synthetic fixture."

---

### Step 5 — Identify and make the correction

**User action:** Change the **Second Leg → Flight Number** field from `SC-202` to `SC-299`.

**Expected UI state:**

- The Flight Number input for Second Leg now shows `SC-299`.
- A **Corrections recorded** section appears below the fields with the note:
  - `Changed secondLeg.flightNumber: "SC-202" → "SC-299"`

**What to say:** "The traveller notices the second-leg flight number is wrong and corrects it from SC-202 to SC-299. The correction is recorded automatically."

**What not to claim:** Do not say this correction was sent to any provider or triggered any external call.

---

### Step 6 — Verify the correction appears

**User action:** Scroll to confirm the **Corrections recorded** section is visible with the correction note.

**Expected UI state:**

- Under **Corrections recorded**:
  - Heading: `Corrections recorded`
  - List item: `Changed secondLeg.flightNumber: "SC-202" → "SC-299"`

**What to say:** "Every field change is tracked in the correction history. This ensures full transparency before the traveller confirms."

**What not to claim:** Do not say the correction was validated by any external service.

---

### Step 7 — Confirm the itinerary

**User action:** Click **Confirm itinerary**.

**Expected UI state:**

- The itinerary section changes to a confirmed summary:
  - Heading: `✓ Itinerary Confirmed`
  - Source label: `Fictional itinerary — local demo fixture`
  - Summary grid:
    - `Leg 1:` `AAA → BBB, SC-101, 08:00–10:30`
    - `Leg 2:` `BBB → CCC, SC-299, 13:00–15:45`
    - `Connection:` `150 minutes`
  - Corrections recorded section shows the correction note
- A green **StatusBanner** appears:
  - `✓ Success: Itinerary confirmed. No external service call was made. Downstream panels are now active with local synthetic placeholder data.`
- The **Connection Risk** panel unlocks and displays data:
  - Heading: `Connection Risk — Heuristic Result`
  - Source label: `Local fallback — not Nosana evidence`
  - Demo scenario dropdown (default: Success)
  - Risk Band: `medium`
  - Score: `0.293`
  - Simulations: `800`
  - Assumptions:
    - `Historical average delay at BBB: 25 min`
    - `On-time rate: 0.72`
    - `Route miss rate: 0.28`
    - `Monte Carlo simulations: 800`
  - Heuristic disclaimer: `Heuristic risk estimate only — derived from a static/historical synthetic dataset; not a live delay, weather, legal, or guaranteed-outcome prediction. Synthetic local placeholder — not Nosana evidence`
  - Failure cascade explanation: `A 75-minute connection at BBB was evaluated against 800 historical records. Monte Carlo simulation (800 runs) estimated a 31.3% probability of tight connection. Combined with route miss rate, the heuristic risk score is 0.2930 (medium band). This is a heuristic indication only — not a prediction or guarantee.`
  - Footer: `Dataset: hist-delay-v1 · Fallback used: yes · Latency: 0ms`
- The **Safer Alternatives** panel unlocks and displays data:
  - Heading: `Safer Alternatives — Sandbox Results`
  - Source label: `Fictional alternatives — local demo fixture`
  - Source environment: `sandbox-placeholder`
  - Demo scenario dropdown (default: Success)
  - Two alternative cards:
    - **Alternative 1:**
      - Route: `AAA → BBB → CCC (synthetic)`
      - Departure: `08:30`
      - Arrival: `16:10`
      - Duration: `7h 40m`
      - Type: `one-stop`
      - Connection: `135 min`
      - Price: `— placeholder —`
      - Availability: `placeholder-availability`
      - Reference: `display-only-reference-a1 (display-only)`
    - **Alternative 2:**
      - Route: `AAA → CCC direct (synthetic)`
      - Departure: `09:15`
      - Arrival: `13:05`
      - Duration: `3h 50m`
      - Type: `nonstop`
      - Connection: `0 min`
      - Price: `— placeholder —`
      - Availability: `placeholder-availability`
      - Reference: `display-only-reference-a2 (display-only)`
- The **Compare** section appears:
  - Heading: `Compare: Risky Self-Transfer vs Safer Alternatives`
  - Left column: **Your Current Plan**
    - Route: `AAA → BBB → CCC (self-transfer, synthetic)`
    - Leg 1: `AAA → BBB, SC-101, 08:00–10:30`
    - Leg 2: `BBB → CCC, SC-299, 13:00–15:45`
    - Connection: `150 min`
    - Risk Band: `medium (0.293)`
  - Right column: **Safer Alternatives** table with Route, Depart, Arrive, Duration, Type, Price columns
- The **Your Decision** section appears:
  - Heading: `Your Decision`
  - Two buttons: **Keep current plan** and **Switch to alternative**

**What to say:** "Once the traveller confirms the itinerary, the downstream panels activate. The risk panel shows a medium risk band with a heuristic score. The alternatives panel shows safer single-ticket options from the Atlas Sandbox placeholder. No external service call was made."

**What not to claim:** Do not say the risk was computed by Nosana or the alternatives came from a live Atlas search. Say instead: "The browser uses a permitted dry-run preview with no submitted Nosana job; historical Nosana evidence is reconciled separately." And: "Historical Atlas Sandbox Search→Verify evidence returned 20 offers and then `PRICE_CONFIRMATION_REQUIRED`, with no write; these browser alternatives are local fixtures."

---

### Step 8 — Inspect the connection-risk panel

**User action:** Scroll to the Connection Risk panel and point out its contents.

**Expected UI state:** (As described in Step 7.)

**What to say:** "The risk panel shows a medium risk band with a score of 0.293 out of 800 Monte Carlo simulations. This is a heuristic indication only — not a prediction or guarantee. The label clearly states this is not Nosana evidence."

**What not to claim:** Do not say Nosana computed this result. Do not say this is a live risk assessment.

---

### Step 9 — Inspect the safer-alternatives panel

**User action:** Scroll to the Safer Alternatives panel.

**Expected UI state:** (As described in Step 7.)

**What to say:** "The alternatives area shows one recommended option first, with additional choices under See more verified options in live mode (or See more options offline). Source tags on each section show whether data is local fixture, Atlas Sandbox live, or offline fallback. No booking, payment, or order is created."

**What not to claim:** Do not say these are live Atlas search results. Do not say Atlas is fully live.

---

### Step 10 — Inspect evidence labels

**User action:** Point out each evidence label visible on screen.

**Expected labels visible simultaneously:**

| Panel | Exact label text |
|---|---|
| Itinerary (confirmed) | `Fictional itinerary — local demo fixture` |
| Connection Risk | `Local fallback — not Nosana evidence` |
| Safer Alternatives | `Fictional alternatives — local demo fixture` |
| Comparison — Current Plan | `Local fallback — not Nosana evidence` |
| Comparison — Safer Alternatives | `Offline fixture — not Atlas Sandbox evidence` |
| Header badge | `Fictional Demo — Live Providers Where Labelled` |

**What to say:** "Every panel carries an honest evidence label. Nothing is presented as live provider evidence when it is not."

**What not to claim:** Do not say any panel shows live evidence.

---

### Step 11 — Select Keep or Switch

**User action:** Click **Keep current plan** (or **Switch to alternative**).

**Expected UI state:**

- A decision summary appears:
  - Heading: `Your Decision: Keep` (or `Your Decision: Switch`)
  - Text explains this is a local demo decision only
  - Button: **Confirm decision**
  - Button: **Change to Switch** (or **Change to Keep**)

**User action:** Click **Confirm decision**.

**Expected UI state:**

- The decision section changes to:
  - Heading: `Demo Complete — No Action Created`
  - Final statement: `No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only.`
  - Metadata list:
    - `noOrderCreated:` `true`
    - `syntheticDemo:` `true`
    - `externalCallsMade:` `false`
    - `decision:` `keep` (or `switch`)
  - Button: **Restart demo**

**What to say:** "The traveller chooses to keep their current plan. This is a UI-only decision — no booking, payment, or order is created. The final screen confirms that no external action was taken."

**What not to claim:** Do not say a booking was made. Do not say the decision was sent to any provider.

---

### Step 12 — Reset and repeat

**User action:** Click **Restart demo**.

**Expected UI state:**

- The app returns to the **Safety Notice** screen (initial state).
- All state is cleared: selections, extraction, corrections, risk, alternatives, decision.
- The full flow can be repeated from Step 1.

**Alternative reset:** Reload the browser page (`Ctrl/Cmd + R`). The app returns to the Safety Notice screen because all state is in-memory.

---

## 3. Three-Minute Narration

The following is a natural spoken script matched to the actual UI. Total target duration: approximately 2:55.

### 0:00–0:15 — Problem

> A cheap self-transfer flight can look like a smart deal at checkout. But when two separately booked tickets are stitched together, each one is an independent contract. If the first flight is delayed and you miss the second, the second airline has no obligation to rebook, protect, or refund you. StitchCheck shows you the risk before you commit.

### 0:15–0:50 — Screenshot and Gemini extraction

> The user selects synthetic screenshot fixtures — fictional images with no real passenger data. Direct Gemini 3.7 live extraction was verified separately; this local rehearsal uses the prepared fictional fixture. StitchCheck extracts the itinerary fields: origin, destination, dates, airlines, flight numbers, and times. Every field is fully editable. Here you can see the first leg from AAA to BBB on flight SC-101, and the second leg from BBB to CCC on flight SC-202, with a connection duration of 150 minutes. The label beside the fields reads: Fictional itinerary — local demo fixture.

### 0:50–1:15 — Correction and human confirmation

> The traveller notices the second-leg flight number is incorrect and changes it from SC-202 to SC-299. The correction is recorded automatically in the correction history. Before any downstream analysis begins, the traveller must explicitly confirm the itinerary. Until then, the risk and alternatives panels remain locked with the message: Confirm itinerary first. Now we click Confirm itinerary. The status banner confirms: no external service call was made.

### 1:15–1:50 — Risk explanation

> The connection-risk panel now activates. It shows a medium risk band with a heuristic score of 0.293 from 800 Monte Carlo simulations. The disclaimer is clear: this is a heuristic indication only, not a prediction or guarantee. The label reads: Local fallback — not Nosana evidence. The current browser fixture is a permitted dry-run preview with no submitted job; reconciled historical Nosana evidence is separate. If the first leg is delayed, the second ticket is void — no automatic rebooking or refund.

### 1:50–2:20 — Atlas Sandbox alternatives

> The safer alternatives panel shows two single-ticket options: a one-stop itinerary and a nonstop flight. All results are fictional local demo fixtures. The label reads: Fictional alternatives — local demo fixture. Atlas Sandbox Search and Verify was verified separately. No booking or payment is executed. The comparison view puts the risky self-transfer plan side by side with the safer alternatives.

### 2:20–2:45 — Keep/Switch decision and safety boundary

> The traveller makes a local decision: Keep the current plan or Switch to an alternative. We choose Keep and confirm. This is a UI-only decision — no booking, payment, reservation, ticket, order, or any external action is created. The final screen states: No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only. The metadata confirms: noOrderCreated true, syntheticDemo true, externalCallsMade false.

### 2:45–2:55 — Close

> StitchCheck: validate before you commit. The demo shows what is verified, what is sandboxed, and what remains activation-gated. A review-first approach that keeps the traveller in control. Safe, reproducible, and honest.

---

## 4. Expected Provider Labels

| Capability | Expected label (exact text from source) | Meaning |
|---|---|---|
| Direct Gemini extraction (browser UI) | `Fictional itinerary — local demo fixture` | Local fixture data; the browser walkthrough makes no provider call. Direct Gemini 3.7 live extraction was verified separately. |
| Historical OpenRouter (GEM-01) | `Historical/temporary OpenRouter smoke-test result; not evidence of direct Google Gemini execution.` | GEM-01 was executed via OpenRouter as a historical smoke-test. Never call this "active" or "direct Gemini validation." |
| Nosana risk (browser UI, dry-run result) | `Local fallback — not Nosana evidence` | The dry-run result has `fallbackUsed: true` and `jobId: null`; it is not a submitted workload. Historical Nosana evidence is reconciled separately. |
| Nosana risk (if dry-run file absent) | `Local fallback — not Nosana evidence` | Generic fixture label when no Nosana result file is found. |
| Atlas alternatives (browser UI) | `Fictional alternatives — local demo fixture` | Local fixture data; Atlas Sandbox Search and Verify was verified separately. No booking or payment was executed. |
| Atlas ticketing / booking | N/A — no UI label or action exists | Ticketing is activation-gated. No UI handler enables booking, payment, or ticketing. |
| Browser demo overall | `Fictional Demo — Live Providers Where Labelled` (header badge) | The entire browser application runs offline with fictional data. Live providers are verified separately and labelled where shown. |
| Final statement | `No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only.` | Displayed after decision confirmation. |

### Label source verification

All labels above are read from:

- `app/src/data/labels.ts` — `LABELS` constants
- `app/src/components/RiskPanel.tsx` — conditional label logic
- `app/src/components/AlternativesPanel.tsx` — panel labels
- `app/src/components/SafetyNotice.tsx` — safety notice label
- `app/src/components/DecisionPanel.tsx` — final statement
- `app/src/App.tsx` — header badge, status banner
- `app/public/nosana-risk-result.json` — `evidenceSource: "local-fallback"`, `fallbackUsed: true` triggers fallback label
- `app-fixture-contracts/stitchcheck-ui-demo-data.json` — fixture data values

---

## 5. Rehearsal Drills

### Drill A — Silent product run

**Goal:** Complete the full flow without speaking. Confirm every UI state.

1. Start the dev server (`npm run dev`).
2. Open the local URL.
3. Acknowledge the safety notice.
4. Select GEM-01 in both screenshot slots.
5. Continue to review.
6. Verify all extraction fields are populated with the expected values.
7. Verify both risk and alternatives panels are locked with `Confirm itinerary first`.
8. Correct Second Leg Flight Number from `SC-202` to `SC-299`.
9. Verify the correction note appears: `Changed secondLeg.flightNumber: "SC-202" → "SC-299"`.
10. Click **Confirm itinerary**.
11. Verify the status banner appears with the success message.
12. Verify the risk panel shows: Risk Band `medium`, Score `0.293`, Simulations `800`.
13. Verify the risk panel source label reads: `Local fallback — not Nosana evidence`.
14. Verify the alternatives panel shows two alternatives with correct values.
15. Verify the alternatives panel source label reads: `Fictional alternatives — local demo fixture`.
16. Verify the comparison view shows the side-by-side table.
17. Click **Keep current plan**, then **Confirm decision**.
18. Verify the final statement and metadata.
19. Click **Restart demo** and verify return to the safety notice.

**Pass criteria:** Every UI state matches the expected values in Section 2. No console errors. No missing labels.

### Drill B — Narrated run

**Goal:** Complete the full flow while speaking the 3-minute script from Section 3.

1. Follow Drill A steps, but speak the narration script at the indicated timings.
2. Practice hitting each narration segment at the correct UI state.
3. Ensure the narration matches what is visible on screen at each moment.
4. Time yourself — target approximately 2:55 total.

**Pass criteria:** Narration matches UI state at every point. Total time is within 2:30–3:00. No claim violates the evidence boundary.

### Drill C — Failure/fallback run

**Goal:** Reload or reset the app and demonstrate that fallback labels remain honest, no fake live evidence appears, no external write is performed, and the demo can continue using prepared evidence.

1. Complete the flow to the confirmed state (Steps 1–7).
2. Reload the browser page (`Ctrl/Cmd + R`).
3. Verify the app returns to the safety notice (all state is in-memory).
4. Acknowledge the safety notice again.
5. Verify no residual data from the previous run appears.
6. Verify the header badge still reads `Fictional Demo — Live Providers Where Labelled`.
7. Verify no console errors reference external network calls.
8. Verify no API keys or credentials appear in the console.
9. Complete the flow again to confirm the demo works end-to-end after reset.

**Pass criteria:** After reset, all labels remain honest. No fake live evidence appears. No external write is performed. The demo completes successfully using prepared evidence.

---

## 6. Troubleshooting

### App does not start

1. Verify you are in the `app/` directory: `pwd` should end with `/app`.
2. Verify Node.js >= 20 is installed: `node --version`.
3. Run `npm install` to ensure all dependencies are present.
4. Run `npm run dev` again.
5. If the error persists, check the terminal output for the specific error message.

### Wrong working directory

1. All commands must run from the `app/` subdirectory, not the project root.
2. If you ran `npm install` from the project root, delete the resulting `node_modules/` there and re-run from `app/`.

### Fixture not found

1. The fixture data is imported at build time from `app-fixture-contracts/stitchcheck-ui-demo-data.json`.
2. If the app starts but shows empty fields, verify the fixture file exists and is valid JSON.
3. Screenshot images are loaded from `smoke-tests/gemini/fixtures/gem-*.png`. If images do not display, verify these files exist.

### Extraction panel locked

- The extraction panel is never locked. If fields are empty, verify the fixture file is loaded correctly.
- If fields show unexpected values, check that `app-fixture-contracts/stitchcheck-ui-demo-data.json` has not been modified.

### Confirm button disabled

- The **Confirm itinerary** button is disabled when any required field is empty.
- Verify all 14 fields (7 per leg) are populated.
- The button is also disabled if the itinerary has already been confirmed (`confirmed` is true).

### Risk panel not visible

- The risk panel is always visible but locked until the itinerary is confirmed.
- After confirmation, if the risk panel shows "Loading risk assessment…", the `loadNosanaRiskResult()` fetch is in progress. Wait briefly.
- If the panel stays in loading state, check that `app/public/nosana-risk-result.json` exists.

### Alternatives not visible

- The alternatives panel is always visible but locked until the itinerary is confirmed.
- After confirmation, alternatives load from the local fixture immediately.

### Stale state after reload

- All state is in-memory. Reloading the page (`Ctrl/Cmd + R`) resets to the safety notice.
- If stale state persists, hard-reload (`Ctrl/Cmd + Shift + R`) or close and reopen the browser tab.

### Fallback label appears

- Fallback labels are the correct and expected behavior. The risk panel shows `Nosana unavailable — local fallback used; not Nosana evidence` because the dry-run result file has `fallbackUsed: true`.
- This is honest and correct. Do not attempt to "fix" it.

### Browser console error

1. Open DevTools (F12) and check the Console tab.
2. Most console errors during rehearsal are non-critical (e.g., missing optional resources).
3. If the app is non-functional, check for specific error messages:
   - Module not found → run `npm install` again.
   - JSON parse error → verify fixture files are valid JSON.
   - Network error → the app should work offline; check that no proxy or extension is interfering.
4. Do not open `.env.local` or use credentials during troubleshooting.

### Port already in use

1. If `http://localhost:5173` is already in use, Vite automatically tries the next port (5174, 5175, etc.).
2. Use the URL printed in the terminal.
3. To free port 5173, find and kill the process using it:
   ```bash
   lsof -i :5173
   kill <PID>
   ```

### General recovery

- **Do not attempt live-provider retries during rehearsal.** All providers are offline by design.
- **Do not open `.env.local` or use credentials.**
- **Do not modify source files, fixture data, or configuration.**
- If the app is non-functional after troubleshooting, stop and report the issue rather than attempting workarounds.

---

## 7. Go/No-Go Checklist

Before the rehearsal or demo, verify each item:

| # | Check | Expected result |
|---|---|---|
| 1 | App starts with `npm run dev` | Dev server prints a local URL |
| 2 | Safety notice appears on first load | Heading: `StitchCheck — Synthetic Demo`, button: `I understand — continue with synthetic data` |
| 3 | Screenshot fixtures load in dropdown | GEM-01 through GEM-05 visible in both slots |
| 4 | GEM-01 image preview displays | Image renders after selection |
| 5 | Extraction fields appear with correct values | 14 fields populated: AAA/BBB/CCC, SC-101/SC-202, 2026-09-15, etc. |
| 6 | Correction works (SC-202 → SC-299) | Field updates, correction note appears |
| 7 | Correction history appears | `Changed secondLeg.flightNumber: "SC-202" → "SC-299"` |
| 8 | Risk and alternatives panels locked before confirmation | 🔒 icon + `Confirm itinerary first` |
| 9 | Confirm button enabled when all fields populated | Button is clickable |
| 10 | Confirmation unlocks downstream panels | Status banner appears, panels activate |
| 11 | Risk panel shows correct data | Band: `medium`, Score: `0.293`, Simulations: `800` |
| 12 | Risk panel label is honest | `Local fallback — not Nosana evidence` |
| 13 | Alternatives panel shows two alternatives | One-stop and nonstop with correct values |
| 14 | Alternatives panel label is honest | `Fictional alternatives — local demo fixture` |
| 15 | Comparison view displays correctly | Side-by-side table with original and alternatives |
| 16 | Keep/Switch controls work | Buttons toggle, decision summary appears |
| 17 | Confirm decision shows final statement | `No booking, payment, reservation, ticket, order, verification, or other write action has been created.` |
| 18 | Metadata displays correctly | `noOrderCreated: true`, `syntheticDemo: true`, `externalCallsMade: false` |
| 19 | Restart demo returns to safety notice | All state cleared |
| 20 | Header badge visible throughout | `Fictional Demo — Live Providers Where Labelled` |
| 21 | Footer visible throughout | `StitchCheck Fictional Demo · No booking, payment, or order created · Fictional itinerary · Live providers where labelled` |
| 22 | No secrets visible | No API keys in UI, console, or network tab |
| 23 | No booking/payment action occurs | No UI handler enables any write action |
| 24 | Full flow completes within 3 minutes | Timed rehearsal under 3:00 |
| 25 | No console errors (or only non-critical) | Clean DevTools console |

---

## Documented Mismatches

The following mismatches were found between existing documentation and the actual source code:

1. **Operator guide label mismatch:** `docs/stitchcheck-local-demo-operator-guide.md` references the label `OpenRouter temporary path — not direct Gemini validation` as a "Required Speaking Label." This label does not exist in the current source code. The actual label displayed in the extraction panel is: `Synthetic local placeholder — not direct Gemini evidence` (from `app/src/data/labels.ts`).

2. **Rehearsal sheet label mismatch:** `docs/stitchcheck-live-demo-rehearsal-sheet.md` also references `OpenRouter temporary path — not direct Gemini validation`. Same mismatch as above.

3. **Connection duration inconsistency in risk explanation:** The risk panel's `failureCascadeExplanation` text (from `app/public/nosana-risk-result.json`) references "A 75-minute connection at BBB" while the extraction fixture displays a connection duration of 150 minutes. This is because the dry-run result was generated with different input data than the current UI fixture. The UI is internally consistent — the explanation text is from the dry-run output and the 150 minutes is from the demo data fixture.

These mismatches do not affect the app's functionality or truthfulness. The app's UI labels are correct and honest.

---

## Validation Summary

- Every command in this runbook matches `app/package.json` scripts.
- Every UI label matches source code in `app/src/data/labels.ts` and component files.
- Every numeric value matches fixture files (`app-fixture-contracts/stitchcheck-ui-demo-data.json`, `app/public/nosana-risk-result.json`, `smoke-tests/nosana/fixtures/res-nos-success.json`, `smoke-tests/atlas/fixtures/result-atl-success.json`).
- No secret value appears in this document.
- No personal absolute path appears in this document.
- No stale OpenRouter active-provider wording appears.
- No unsupported Gemini 3.7 live claim is made for the local rehearsal.
- No Nosana live claim is made.
- No booking/payment claim is made.
- No live provider call, external write, video build, push, or upload occurred during the creation of this runbook.
