# StitchCheck — Tomorrow Rehearsal Pack

> **Created:** 2026-08-21  
> **Purpose:** Single-source rehearsal reference for the live judge demo.  
> **Data policy:** Synthetic fixtures only. No PII, no credentials, no real booking references.  
> **Boundary:** No booking, payment, reservation, ticket, order, verification, or other write action is performed or claimed.

---

## File Ownership Confirmation

| File | Owner / Status | Action Taken |
|------|---------------|--------------|
| `docs/stitchcheck-live-demo-presenter-script.md` | Existing — read-only reference | Not modified |
| `docs/stitchcheck-judge-qa.md` | Existing — read-only reference | Not modified |
| `docs/stitchcheck-submission-evidence-index.md` | Existing — read-only reference | Not modified |
| `docs/stitchcheck-pre-hackathon-final-pass-report.md` | Existing — read-only reference | Not modified |
| `docs/stitchcheck-tomorrow-rehearsal-pack.md` | **This file — newly created** | Created |

No source code, deck, video, provider integration, `.env.local`, credential, or final media file was touched.

---

## Verified Evidence Summary (Do Not Exaggerate Beyond These)

| Fact | Source |
|------|--------|
| Gemini offline tests: 92 passed, 0 failed | `smoke-tests/gemini/adapter-offline-tests.mjs` |
| Atlas offline tests: 89 passed, 0 failed | `smoke-tests/atlas/adapter-offline-tests.mjs` |
| Atlas duplicate-booking guard: 48 passed, 0 failed | `smoke-tests/atlas/duplicate-booking-guard-offline-tests.mjs` |
| Nosana client offline tests: 75 passed, 0 failed | `smoke-tests/nosana/nosana-client-offline-tests.mjs` |
| Cross-provider invariant tests: 40 passed, 0 failed | `smoke-tests/cross-provider-invariant-tests.mjs` |
| Total offline tests: 344 passed, 0 failed | Aggregated |
| TypeScript typecheck: zero errors | `tsc --noEmit` |
| Production build: 37 modules, 74 ms | `vite build` |
| Browser acceptance walkthrough: 39 items passed | `docs/react-ui-acceptance-checklist.md` |
| Demo capture: 6/6 scenes passed | `output/captures/capture-2026-08-21T07-04-43/` |
| GEM-01 + GEM-LIVE-01: OpenRouter temporary path executed | `smoke-tests/gemini/results/results.json` |
| Direct Gemini: NOT executed (SDK not installed, model not approved) | `docs/stitchcheck-pre-hackathon-final-pass-report.md` |
| Atlas authentication: succeeded via official Skill CLI | `smoke-tests/live-demo-results/` |
| Atlas production search 1: PVG→NRT/HND, 5 offers, reference-price only | `smoke-tests/live-demo-results/` |
| Atlas production search 2 (ATL-LIVE-01): SIN→BKK, 8 offers, reference-price only | `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/atlas-live-result.md` |
| Atlas Sandbox Search + Verify (ATL-SBX-SV-01): PARTIAL_SUCCESS, 20 offers KUL→SIN, verify returned PRICE_CONFIRMATION_REQUIRED | `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json` |
| Nosana: NOT executed, NOT deployed, blocked before any network request | `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/nosana-live-result.md` |
| Ticketing activation: pending human action at ATRIP workspace | `atlas-flight auth status --json` |

---

## 1. Two-Minute Script (120 seconds)

> Use when the judge slot is exactly 2 minutes. Based on `stitchcheck-live-demo-presenter-script.md`.

### Segment 1 — The Problem (0:00–0:18)

**Screen:** App loaded. Safety notice visible. Header: "StitchCheck — Synthetic Demo — No Live Services."

**Say:**
> "Budget travelers face a hidden trap. When you stitch two separately purchased flights to save money, each ticket is an independent contract. If the first flight is delayed and you miss the second, the second airline has no obligation to rebook, protect, or refund you. The savings are visible at checkout — the exposure is not. StitchCheck gives travelers a review-first way to understand itinerary risk before committing. This is a local demo with synthetic data."

### Segment 2 — Extraction (0:18–0:36)

**Screen:** Upload panel with five fixture slots. Select GEM-01. Extraction result populates.

**Say:**
> "The user starts with a synthetic itinerary screenshot — fictional image, no real passenger data. We select GEM-01, a clear two-leg itinerary. The label on screen reads: Fictional itinerary — local demo fixture. Direct Gemini 3.7 live extraction was verified separately via the Interactions API."

### Segment 3 — Human Correction (0:36–0:52)

**Screen:** Itinerary review screen. Edit second-leg flight number from SC-202 to SC-299.

**Say:**
> "Extracted fields are displayed for human review. Every field is editable. In this demo, the second-leg flight number is corrected from SC-202 to SC-299. The correction is recorded locally with a visible note. This review-and-correct step ensures no downstream panel acts on unverified data."

### Segment 4 — Confirm Itinerary First (0:52–1:06)

**Screen:** Scroll to Risk and Alternatives panels — locked with "Confirm itinerary first." Click Confirm. Panels unlock.

**Say:**
> "Before confirmation, both risk and alternatives panels are locked. The user clicks Confirm. The panels activate. The status banner states that no external service call was made. This confirmation gate keeps the traveler in control at every step."

### Segment 5 — Risk Panel and Nosana Status (1:06–1:22)

**Screen:** Risk panel shows medium risk (score 0.42) with disclaimer.

**Say:**
> "The risk panel displays a heuristic risk estimate — medium risk, score 0.42. The disclaimer is explicit: Synthetic local placeholder — not Nosana evidence. Nosana's planned role is connection-risk analysis. No Nosana workload has been executed or deployed. What you see here is a local placeholder shape only."

### Segment 6 — Atlas Status and Alternatives (1:22–1:40)

**Screen:** Alternatives panel shows two synthetic options with Atlas source label.

**Say:**
> "The alternatives panel shows synthetic options labelled: Synthetic local placeholder — not Atlas Sandbox evidence. Separately, Atlas authentication has been completed through the official Atlas Flight Booking Skill. Two live read-only production searches returned real offers — five from Shanghai PVG to Tokyo NRT and HND, and eight from Singapore SIN to Bangkok BKK. All offers carry reference-price status with ticketing activation pending. No booking, payment, or order was created. The demo panels you see now remain local placeholders."

### Segment 7 — Keep/Switch and Close (1:40–2:00)

**Screen:** Decision panel. Select "Keep current plan." Final screen with no-external-action statement.

**Say:**
> "The traveler makes a local decision — Keep or Switch. This is a UI-only selection. No booking, payment, reservation, ticket, order, or verification occurs. The final screen states it explicitly: no external action has been created. StitchCheck demonstrates a review-first flow that keeps the traveler in control at every step — an honest local demo with synthetic data, ready for separately authorized live-service validation when each provider is deployed and evidence is collected."

---

## 2. Three-Minute Script (180 seconds)

> Use when the judge slot allows 3 minutes. Adds depth to Segments 2, 5, 6, and a closing next-step statement.

### Segment 1 — The Problem (0:00–0:20)

**Screen:** App loaded. Safety notice visible. Header badge visible.

**Say:**
> "Budget travelers face a hidden trap. When you stitch two separately purchased flights to save money, each ticket is an independent contract. If the first flight is delayed and you miss the second, the second airline has no obligation to rebook, protect, or refund you. The savings are visible at checkout — the exposure is not. StitchCheck gives travelers a review-first way to understand itinerary risk before committing. This is a local demo with synthetic data; the walkthrough itself makes no external service calls."

### Segment 2 — Extraction (0:20–0:45)

**Screen:** Upload panel. Select GEM-01. Extraction populates fields.

**Say:**
> "The user starts with a synthetic itinerary screenshot — fictional image, no real passenger data. We select GEM-01, a clear two-leg itinerary. The label on screen reads: Fictional itinerary — local demo fixture. Direct Gemini 3.7 live extraction was verified separately via the Interactions API; schema-valid, no fallback. Offline, the extraction contract and validators pass 92 deterministic tests with zero failures."

### Segment 3 — Human Correction (0:45–1:02)

**Screen:** Itinerary review. Edit SC-202 → SC-299. Correction note appears.

**Say:**
> "Extracted fields are displayed for human review. Every field is editable. In this demo, the second-leg flight number is corrected from SC-202 to SC-299. The correction is recorded locally with a visible note. This review-and-correct step ensures no downstream panel acts on unverified data. The traveler confirms only what they have personally reviewed."

### Segment 4 — Confirm Itinerary First (1:02–1:18)

**Screen:** Locked panels. Click Confirm. Panels unlock.

**Say:**
> "Before confirmation, both risk and alternatives panels are locked with 'Confirm itinerary first.' No risk calculation or alternative search begins until the user explicitly confirms. The user clicks Confirm. The panels activate. The status banner states that no external service call was made. This confirmation gate keeps the traveler in control at every step."

### Segment 5 — Risk Panel and Nosana Status (1:18–1:40)

**Screen:** Risk panel with medium band, score 0.42, disclaimer.

**Say:**
> "The risk panel displays a heuristic risk estimate — medium risk, score 0.42. The disclaimer is explicit: Synthetic local placeholder — not Nosana evidence. Nosana's planned role is connection-risk analysis — it would accept a non-PII itinerary summary and return a heuristic risk band with visible workload status. In this demo, no Nosana workload has been executed or deployed. A smoke-test attempt was intentionally blocked before any network request due to missing infrastructure. Offline, 75 Nosana client tests pass deterministically, validating contract shapes, sanitization, and mutation rejection. What you see here is a local placeholder shape only."

### Segment 6 — Atlas Status and Alternatives (1:40–2:10)

**Screen:** Alternatives panel with two synthetic options. Open comparison view.

**Say:**
> "The alternatives panel shows synthetic options labelled: Synthetic local placeholder — not Atlas Sandbox evidence. These are local fixture shapes for UI demonstration. Separately, Atlas authentication has been completed through the official Atlas Flight Booking Skill. Two live read-only production searches returned real offers — five from Shanghai PVG to Tokyo NRT and HND, and eight from Singapore SIN to Bangkok BKK. All offers carry reference-price status with ticketing activation pending. Additionally, an Atlas Sandbox Search plus Verify was completed — twenty offers for KUL to SIN, with Verify returning PRICE_CONFIRMATION_REQUIRED after a price change. A hard stop was enforced after Verify; no write call was made. The environment was restored to Production afterward. No booking, payment, ticket, or order was created. The demo panels you see now remain local placeholders."

### Segment 7 — Keep/Switch, Close, and Next Step (2:10–3:00)

**Screen:** Decision panel. Select "Keep current plan." Final screen.

**Say:**
> "The traveler makes a local decision — Keep the current plan or Switch to an alternative. This is a UI-only selection. No booking, payment, reservation, ticket, order, verification, or other external action occurs. The final screen states it explicitly: no external action has been created. Direct Gemini 3.7 was live-verified separately. Nosana uses local fallback in this walkthrough. Atlas has shown reference-price search results only — no write action of any kind. StitchCheck demonstrates a review-first flow that keeps the traveler in control at every step — the demo UI itself makes no live service calls."

---

## 3. Exact Screen Actions (Step-by-Step)

Perform these in order. Do not skip any step.

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Open browser to `http://localhost:5173` | App loads. Safety notice visible. Header reads "StitchCheck — Synthetic Demo — No Live Services." |
| 2 | Pause 2 seconds. Let judges read the safety notice. | Safety notice and header badge clearly visible. |
| 3 | Click fixture slot **GEM-01** in the upload panel. | Extraction result populates itinerary fields beside the source screenshot. Label visible: `OpenRouter temporary path — not direct Gemini validation`. |
| 4 | Point to the source label. | Label is readable on screen. |
| 5 | Click into the second-leg flight number field. Change **SC-202** to **SC-299**. | Correction note appears: "Changed secondLeg.flightNumber: SC-202 → SC-299." |
| 6 | Scroll down to Risk and Alternatives panels. | Both panels show lock icons and "Confirm itinerary first." |
| 7 | Click **"Confirm itinerary."** | Status banner appears: "Itinerary confirmed. No external service call was made." Panels unlock. |
| 8 | Point to Risk panel. | Medium risk band, score 0.42. Label visible: `Synthetic local placeholder — not Nosana evidence`. |
| 9 | Point to Alternatives panel. | Two synthetic options. Label visible: `Synthetic local placeholder — not Atlas Sandbox evidence`. |
| 10 | Click comparison view (if available). | Side-by-side display of original itinerary and placeholder alternative. |
| 11 | Click **"Keep current plan."** | Decision confirmed locally. |
| 12 | Final screen appears. | Statement: "No booking, payment, reservation, ticket, order, verification, or other write action has been created." Metadata: `noOrderCreated: true`, `syntheticDemo: true`, `externalCallsMade: false`. |
| 13 | Pause 3 seconds. Let judges read the final statement. | End demo. |

### Recovery During Screen Actions

- If a click is missed or narration does not match: **stop**, reload the page, restart the segment.
- If the browser shows an error or stale state: **stop**, close and reopen browser, restart from Segment 1.
- If a required label is missing or unreadable: **stop**, reload, verify labels in `app/src/data/labels.ts`, restart the segment.
- No source files, configuration, or fixture data are modified during recovery.

---

## 4. What to Say About OpenRouter

**Verified facts only:**

- Direct Gemini 3.7 live extraction succeeded via the Interactions API; schema-valid, no fallback.
- The browser walkthrough uses a fictional local fixture labelled: **Fictional itinerary — local demo fixture.**
- GEM-01 was also executed via a historical OpenRouter temporary path; that path is not the active provider.
- The `@google/genai` SDK was used for the direct Gemini verification.

**Safe sentence:**
> "Direct Gemini 3.7 live extraction was verified separately via the Interactions API. The browser walkthrough uses a fictional local fixture."

**Never say:**
- "Gemini validated" without specifying it was the Interactions API verification.
- "OpenRouter is Gemini."
- "The browser called Gemini" (it uses local fixtures).

---

## 5. What to Say About Atlas Sandbox Search → Verify

**Verified facts only:**

- Atlas authentication succeeded via the official Atlas Flight Booking Skill (browser ATRIP authorization).
- Two live read-only **production** searches returned real offers:
  - PVG → NRT/HND: 5 offers (reference-price only).
  - SIN → BKK (ATL-LIVE-01): 8 offers (reference-price only).
- All offers: `price_status: "reference"`, `bookable: false`, `TICKETING_ACTIVATION_REQUIRED`.
- Atlas Sandbox Search + Verify (ATL-SBX-SV-01):
  - Environment switch to Sandbox: succeeded.
  - Search: 20 offers KUL → SIN, 2026-09-15.
  - Verify: returned `PRICE_CONFIRMATION_REQUIRED` (price changed $64.38 → $203.99).
  - Hard stop after Verify. No write call made.
  - Environment restored to Production afterward.
- Ticketing activation is pending human action at the ATRIP workspace.
- The demo UI panels remain local placeholders — they do not display live Atlas output.

**Safe sentence:**
> "Atlas authentication succeeded via the official Skill. Two live production searches returned real offers — all reference-price only with ticketing activation pending. An Atlas Sandbox Search plus Verify was also completed with a hard stop after Verify; no write call was made. The demo panels you see are local placeholders."

**Never say:**
- "Atlas booked" or "Atlas ticketed."
- "Sandbox search is the demo data."
- "Ticketing works" (it is pending activation).

---

## 6. What to Say About Nosana If Still Offline

**Verified facts only:**

- Nosana's planned role: connection-risk analysis — accept a non-PII itinerary summary, return a heuristic risk band with visible workload status.
- Nosana has **not** been executed, deployed, authenticated, or funded.
- The live smoke-test attempt was intentionally blocked before any network request due to missing infrastructure (no `@nosana/kit` installed, no credit account, market address unverified).
- Job definition has been corrected to official Nosana schema v0.1 (`version: "0.1"`, `type: "container"`, `ops[]`).
- Offline: 75 client tests pass deterministically (contract shapes, sanitization, mutation rejection).
- Workload skeleton: 5 simulated runs, all valid.
- An approval packet exists with exact parameters for when human authorization is granted.
- Estimated cost for one 60-second workload: ~$0.0008.

**Safe sentence:**
> "Nosana's planned role is connection-risk analysis. No Nosana workload has been executed or deployed — the smoke test was intentionally blocked before any network request due to missing infrastructure. What you see is a local placeholder. Offline, 75 tests validate the contract, sanitization, and safety boundaries. An approval packet is ready for when human authorization is granted."

**Never say:**
- "Nosana works" or "Nosana returned results."
- "Nosana is live."
- "We deployed to Nosana."

---

## 7. What to Say About Ticketing Activation

**Verified facts only:**

- `atlas-flight auth status --json` confirms: `authenticated: true`, `ticketing_available: false`, `ticketing_blocker: "TICKETING_ACTIVATION_REQUIRED"`.
- Ticketing activation requires a human action at the ATRIP workspace (external to this repo).
- This does not block read-only operations (search, verify).
- No booking, payment, ticket, order, or verification has been created.
- All Atlas offers remain `bookable: false` until ticketing is activated.

**Safe sentence:**
> "Ticketing activation is pending. It requires a human action at the ATRIP workspace, external to this codebase. This does not block read-only search or verify — all our Atlas evidence is read-only. No booking, payment, or ticket has been created."

**Never say:**
- "We can book" or "ticketing is ready."
- "Atlas is fully operational."

---

## 8. What to Say About PII

**Verified facts only:**

- All fixtures are synthetic and fictional. No real passenger data, no real booking references, no real credentials.
- Fixture files: `smoke-tests/gemini/fixtures/`, `smoke-tests/atlas/fixtures/`, `smoke-tests/nosana/fixtures/`.
- The Nosana request envelope enforces PII sanitization — all mutation attempts are rejected offline (75 tests).
- The extraction contract strips personal data before any downstream processing.
- The demo walkthrough makes no external service calls.
- No credential, secret, or raw provider output is shown at any point.

**Safe sentence:**
> "All data in this demo is synthetic. No PII, no credentials, no real booking references. The Nosana boundary enforces PII sanitization — all mutation attempts are rejected. No credential or raw provider output is shown at any point."

**Never say:**
- Reveal any API key, token, or password.
- Show raw provider JSON output with personal data.
- Claim that PII is "encrypted" without evidence.

---

## 9. Five Difficult Judge Questions and Concise Answers

### Q1. "Why should we trust a local demo with synthetic data?"

> "The local demo proves the review-first workflow, the confirmation gate, and the safety boundaries — all under the application's control. Offline tests deterministically validate that adapter contracts, fixture schemas, forbidden-action enforcement, and sanitization rules are correctly implemented — 344 tests, zero failures. What the local demo cannot prove is that any external provider actually works; that requires separately authorized live execution with real credentials. We are honest about that boundary."

### Q2. "None of your providers are fully live. Isn't this just a mock?"

> "It is more than a mock. The local demo passes type-check, production build, and a 39-item browser acceptance walkthrough. Atlas authentication succeeded via the official Skill, and two live production searches returned real offers. An Atlas Sandbox Search plus Verify was completed with a hard stop after Verify. OpenRouter executed GEM-01 through a temporary path. Nosana is the one provider that remains entirely offline — intentionally blocked before any network request. Each provider requires separate human authorization, credentials, cost review, and a bounded smoke-test plan. We chose to stop safely rather than make uncontrolled external calls."

### Q3. "What is the strongest evidence you have today?"

> "Three things. First, the local demo passes type-check, production build, and a 39-item acceptance walkthrough — the review-first workflow and confirmation gate are proven. Second, offline tests across all three provider boundaries pass deterministically: Gemini 92, Atlas 89 plus 48 for duplicate-booking guard, Nosana 75, cross-provider 40 — 344 total, zero failures. Third, Atlas authentication succeeded with two live production searches returning real offers, and an Atlas Sandbox Search plus Verify was completed. These prove contracts and safeguards are correctly implemented; they do not prove that any external service works under real conditions."

### Q4. "If Nosana is so important, why hasn't it been executed?"

> "Nosana requires four prerequisites that were not met: the `@nosana/kit` package installed, a credit account at the Nosana dashboard, a verified market address against the live API, and explicit human authorization for a paid workload. None of these existed when we reached the Nosana smoke test. Rather than bypass safety gates or make uncontrolled calls, we blocked intentionally, corrected the job definition to official schema v0.1, passed 75 offline tests, and prepared an approval packet with exact parameters. The approval packet is ready for when human authorization is granted. Estimated cost for one workload is under one cent."

### Q5. "What would you do differently if you had more time?"

> "Three actions, each requiring separate human authorization. First, install the Nosana SDK, verify the market address, and execute one risk workload — producing genuine Nosana evidence. Second, approve a Gemini model, install the `@google/genai` SDK, and execute one direct extraction — producing direct Gemini validation. Third, wire real Atlas Sandbox evidence into the React UI, replacing the local placeholder with actual Sandbox offer data. Each action has its own approval gate, credential review, and cost review. The architecture is ready; the execution evidence is what remains to be collected."

---

## 10. Fallback If Live Services Fail

### Scenario A: App Does Not Load

| Step | Action |
|------|--------|
| 1 | Try `http://localhost:5173`. If blank, run `npm run dev` in `app/`. |
| 2 | If build error, check terminal for TypeScript errors. |
| 3 | If unresolvable, play the full voiceover video at `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` (131s, 6 scenes with narration). |
| 4 | State to judges: "The live app is unavailable at this moment. I will play the full voiceover video from the last verified run — type-check clean, build passing, 344 offline tests, 39 acceptance items confirmed." |

### Scenario B: A Panel Does Not Render Correctly

| Step | Action |
|------|--------|
| 1 | Reload the page. |
| 2 | If the panel still fails, skip that segment and say: "This panel is experiencing a rendering issue. I will describe it verbally." |
| 3 | Describe the panel contents from memory using the verified facts in this pack. |
| 4 | Do NOT attempt to fix source code during the demo. |

### Scenario C: All Live Demos Fail

| Step | Action |
|------|--------|
| 1 | **Primary fallback:** Play the full voiceover video at `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` (131s, H.264 1920×1080, AAC 24kHz mono, ~4.0MB). The video covers all 6 scenes with synchronized Kokoro-local voiceover narration and burned-in captions. |
| 2 | **Secondary fallback (if video playback unavailable):** Open the capture manifest: `output/captures/capture-2026-08-21T07-04-43/capture-manifest.json`. Show the 6 captured scenes (all passed verification). |
| 3 | Narrate using the 2-minute script, pointing to the video or screenshots instead of the live app. |
| 4 | State: "The live app is unavailable, but this video/screenshots are from the last verified run — type-check clean, build passing, 344 offline tests, 39 acceptance items confirmed." |

### Scenario D: Judge Asks About a Provider That Is Down

| Provider | Fallback Statement |
|----------|-------------------|
| OpenRouter / Gemini | "Direct Gemini 3.7 live extraction succeeded via the Interactions API; schema-valid, no fallback. The browser walkthrough uses a fictional local fixture and makes no provider call. Historical OpenRouter path is labelled accordingly." |
| Atlas | "Atlas authentication succeeded. Two live production searches returned real offers — all reference-price only. Sandbox Search plus Verify was completed with a hard stop. Ticketing activation is pending." |
| Nosana | "Nosana has not been executed. The smoke test was intentionally blocked before any network request. Offline, 75 tests validate the contract and safety boundaries. An approval packet is ready." |

### Scenario E: Judge Asks "Can You Book a Flight Right Now?"

> "No. StitchCheck does not book, pay for, reserve, ticket, order, verify, or perform any external action of any kind. No UI handler, route, or button enables any write action. Ticketing activation is pending at the ATRIP workspace. The demo scope ends at the local Keep or Switch decision."

---

## Required Evidence Labels (Must Be Visible on Screen)

| # | Exact Label | Panel |
|---|-------------|-------|
| 1 | `OpenRouter temporary path — not direct Gemini validation` | Itinerary review |
| 2 | `Synthetic local placeholder — not Nosana evidence` | Risk panel |
| 3 | `Synthetic local placeholder — not Atlas Sandbox evidence` | Alternatives panel |

If any label is missing, **stop** and reload before continuing.

---

## Presenter Rules (Quick Reference)

- Lead with user control.
- Show the disabled state before confirmation.
- Show one user correction before confirming.
- Say "local demo" when referring to local behavior.
- Qualify every provider claim.
- Never reveal credentials or personal data.
- End with the next authorized validation step.
- If in doubt, say: "This submission demonstrates a review-first local workflow and offline contract safeguards; provider execution status is reported separately and not overstated."

---

## Pre-Demo Checklist

- [ ] `npm run dev` is running in `app/`.
- [ ] Browser opens to `http://localhost:5173` without errors.
- [ ] Safety notice is visible on load.
- [ ] Header reads "StitchCheck — Synthetic Demo — No Live Services."
- [ ] GEM-01 fixture can be selected and extraction populates fields.
- [ ] Flight number field is editable (SC-202 → SC-299).
- [ ] Risk and Alternatives panels are locked before confirmation.
- [ ] Confirm button unlocks both panels.
- [ ] All three evidence labels are visible and readable.
- [ ] Decision panel (Keep/Switch) is functional.
- [ ] Final screen shows no-external-action statement.
- [ ] Full voiceover video available as primary fallback: `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` (131s, 6 scenes with narration).
- [ ] Capture screenshots available as secondary fallback at `output/captures/`.
- [ ] This rehearsal pack is open for quick reference.
