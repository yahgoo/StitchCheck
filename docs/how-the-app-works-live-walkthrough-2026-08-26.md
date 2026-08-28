# StitchCheck — Live App Walkthrough (2026-08-26)

Screen-by-screen reference for how the running app behaves in **`DATA_MODE=live`**. Captured from `http://localhost:5173/` on 2026-08-26 ~22:55 UTC+8 via browser automation on the sample itinerary (`KUL → SIN → BKK`), plus one upload-path entry and separate Keep / Switch completion runs.

---

## 1. Welcome screen

**What triggers this:** App mount — `step === 'welcome'` (initial `useState<AppStep>('welcome')` in `app/src/App.tsx`).

**What you're looking at:** Landing screen with safety copy, two entry paths, and the sample route hint.

**Real captured example data (this run):**
- Title: **StitchCheck**
- Subtitle: *Check your multi-leg itinerary for connection risks and find safer alternatives.*
- Safety: *Sample documents only. Do not upload real travel documents.*
- Sample route label: **Kuala Lumpur → Singapore → Bangkok** (`SAMPLE_ITINERARY_ROUTE_LABEL` in `app/src/data/sample-itinerary.ts`)
- Buttons: **Upload itinerary** | **Try a sample itinerary →**

**What state/code this reads from:**
| Path | Handler | State set |
|------|---------|-----------|
| Upload itinerary | `handleGetStarted` | `itineraryInputMode = 'upload'`, `setStep('trip')` |
| Try a sample itinerary | `handleTrySampleItinerary` | `setExtraction(getSampleItineraryExtraction())`, `itineraryInputMode = 'sample'`, clears tickets/confirmation, `setStep('trip')` |

**From here you can:**
- **Upload itinerary** → Trip screen in upload mode (default fixture extraction, ticket selectors visible).
- **Try a sample itinerary →** → Trip screen pre-filled with sample KUL→SIN→BKK legs.

---

## 2. Review screen (Trip / itinerary confirmation)

**What triggers this:** Either welcome button sets `step === 'trip'`.

**What you're looking at:** Input area (upload button + two ticket `<select>` dropdowns) and read-only boarding-pass cards summarizing the two legs. This is the last editable moment before confirmation.

### Path A — Sample itinerary (live-verified)

**Real captured example data:**
- Banner: *Sample itinerary — not uploaded. Edit or replace it with your own.*
- **First flight:** KUL → SIN · Sample carrier · SC-101 · 08:00 → 09:15
- **Second flight:** SIN → BKK · Sample carrier · SC-202 · 12:30 → 13:45
- Connection note: **Connection at SIN · 195 min**
- Actions: **Edit itinerary** | **Check my itinerary**

### Path B — Upload itinerary entry (live-verified, not checked through)

**Real captured example data:**
- No sample banner (upload mode).
- Upload button label: **Upload itinerary** (unchanged until clicked).
- **First flight:** KUL → BKK · Sample carrier · SC-101 · 08:00 → 10:30
- **Second flight:** BKK → HAN · Sample carrier · SC-202 · 13:00 → 15:45
- Connection note: **Connection at BKK · 150 min**
- Default extraction from `getDefaultExtraction()` in `app/src/data/fixtures.ts`.

**What state/code this reads from:**
- `extraction` (`ExtractionResult`) — rendered as `firstLeg` / `secondLeg` derived vars.
- `itineraryInputMode` — `'sample' | 'upload' | 'default'` controls banner and downstream extraction skip.
- `selectedTicket1`, `selectedTicket2` — GEM fixture IDs for live OpenRouter extraction on upload path.
- `uploadAcknowledged` — toggled by inner **Upload itinerary** button (demo stand-in for file pick).
- `isEditing` — toggles between boarding-pass cards and inline edit form (`handleFieldChange`).

**From here you can:**
- **Edit itinerary** → inline field editor; edits mutate `extraction` and append to `correctionNotes`.
- **Check my itinerary** → confirmation snapshot + async provider pipeline (next section).

---

## 3. "Check my itinerary" transition

**What triggers this:** Click **Check my itinerary** → `handleCheckMyTrip()` in `app/src/App.tsx`.

**What you're looking at:** Button becomes disabled with loading copy while parallel async work runs. Second click is ignored (double-click guard).

**Real captured example data:**
- Button text while in flight: **Checking itinerary…**
- Button state: `disabled`, `aria-busy=true`
- Guard: early return when `confirmTransitionInFlight === true`

**What state/code this reads from:**
- `confirmTransitionInFlight` — set `true` at start, cleared in `finally`.
- `createConfirmedItinerarySnapshot(extraction, inputMode)` → `confirmedItinerary` (`app/src/domain/confirmed-itinerary.ts`). Immutable route context for all downstream calls.
- **Sample path:** skips live OpenRouter extraction (`skipLiveExtraction = itineraryInputMode === 'sample'`); sets `extractionProviderStatus` to `offline-fallback` / `local-fixture`.
- **Upload path (code path, not exercised live this run):** calls `extractItinerary()` → merges via `mergeExtractionResult`.
- Risk: `loadNosanaRiskResult()` → `riskResult`, `nosanaProviderStatus`.
- Live mode: `setStep('options')` then `performLiveSearchForConfirmed(snapshot)` (Atlas Search on **first leg only** for the alternatives list).

**Intermediate banner on Options screen (code-defined; flashed quickly this run):**
- While `searchLoading`: *Checking live alternatives…* (`.sc-banner--loading`)

**From here:** Automatic transition to Options when handlers complete (`setStep('options')`).

---

## 4. Options screen — risk headline, recommendation, Keep / Switch

**What triggers this:** `handleCheckMyTrip` finishes Nosana + sets `step = 'options'`; Atlas search continues/finishes asynchronously.

**What you're looking at:** Combined answer screen — risk headline, status banners, featured recommended card from offline recovery plan, per-leg unbooked previews, live Atlas alternative cards, and decision buttons.

**Real captured example data (sample itinerary run):**
- Headline: **Your connection is at risk**
- Success banner (after Atlas search): *Itinerary checked. Live alternatives ready for review.*
- Featured recommended card:
  - Badge: **Recommended**
  - Route: **KUL → SIN**
  - Type: **nonstop**
  - Onward: **SIN → BKK**
  - Arrival impact: **—** (missing-field label)
  - CTA: **Switch to this plan**
- Source footer (alternatives): **Source: Atlas Sandbox · live**
- Live Atlas alternatives count: **20**
- Example top offer: **KUL → SIN (OD OD805)** · nonstop · 19:30–20:30 · **USD 38.60** · `off_6fae8ab7bdca674592899de9` · Available
- Cheapest seen: **KUL → SIN (AK AK701)** · USD **21.80** · 06:10–07:15
- Decision row: **Keep current itinerary** | **Switch to this plan**

**What state/code this reads from:**
| UI element | State / derivation |
|------------|-------------------|
| Headline | Static copy on `step === 'options'` |
| Loading banner | `searchLoading` |
| Error banner + Retry | `searchError`, `handleRetrySearch` |
| Recommended card | `recoveryAnimationData?.recommendedPlan` from `getDaytonaOfflineRecoveryAnimation(undefined, itineraryContext)` |
| Onward / tradeoffs | `recommendedPlan.replacementFirstLeg`, `.onwardOption`, `.tradeoffs` |
| Switch highlight | `decision === 'switch'` adds `sc-recommended-option--selected` |
| Atlas alternatives list | `alternativesResult?.alternatives` via `performLiveSearchForConfirmed` → `atlasSearch` + `mapSearchResponseToResult` |
| Verify buttons | `handleVerifyOffer(offerReference)` → `verifyResult`, `selectedOfferId` |
| Keep / Switch | `decision` state (`'keep' \| 'switch' \| null`) |

**From here you can:**
- Expand **See why this is risky** → recovery animation (§5).
- Expand header **How this works** → provider status (§6).
- Scroll **Verified unbooked previews** per leg (§7).
- Browse **Live Atlas alternatives (N)** cards; optional **Verify offer** per card.
- Choose **Keep current itinerary** or **Switch to this plan** → confirmation block → Done (§8–§9).

---

## 5. "See why this is risky" — recovery plan animation

**What triggers this:** `<details className="sc-risk-detail">` expand on Options screen.

**What you're looking at:** Daytona-offline recovery animation (`RecoveryPlanAnimation`) showing cascade from a simulated delay on leg 1 through downstream risks, then a collapsed recommended plan. Execution mode is always **`daytona-offline-mock`** — not live Daytona.

**Real captured example data (this run):**
- Animation label: **Recovery plan ready** / **Recovery Plan**
- Source tag inside animation: **Source: Offline fallback**
- Trigger node: **DELAYED · KUL → SIN** — *Simulated delay trigger — downstream impact is analysis only*
- Cascade list (all **AT RISK**):
  - Connection window at **SIN**
  - Onward leg **SIN → BKK**
  - Pre-booked hotel check-in
- Candidate replacement rows show route summaries but many timing/price fields display **—** or **We don't have this yet** (offline mock data).
- Collapsed plan sections: **Replacement first leg** KUL → SIN (nonstop), **Onward option** SIN → BKK (nonstop), **Trade-offs** (arrival impact / connection buffer / fare delta mostly **—**).
- Timestamp: **Recovery plan computed · 26 Aug 2026, 14:55 UTC**
- Nested **How this was calculated:**
  - Risk band: **medium**
  - Dataset: **hist-delay-v1 · Latency: 11072ms**
  - Explanation references *75-minute connection at BBB*, *800 Monte Carlo runs*, *30.4% tight-connection probability* (Nosana evidence text from `riskResult.failureCascadeExplanation`).

**What state/code this reads from:**
- `userConfirmed` must be true (set in `handleCheckMyTrip`).
- `itineraryContext` from `confirmedItineraryToContext(confirmedItinerary)` — **not** live `extraction` after confirmation.
- `recoveryAnimation` = `getDaytonaOfflineRecoveryAnimation(undefined, itineraryContext)` (`app/src/data/daytona-offline-risk.ts`).
- `recoveryAnimationData` = `recoveryAnimation.plan.animationData` (+ optional `confirmationPhase` when `recoverySubmitted`).
- Rendered by `<RecoveryPlanAnimation data={recoveryAnimationData} executionMode="daytona-offline-mock" />`.
- Risk copy from `riskResult` (`riskBand`, `heuristicDisclaimer`, `failureCascadeExplanation`, `datasetVersion`, `latencyMs`).

---

## 6. "How this works" — provider status bar

**What triggers this:** `<details className="sc-provider-details">` in header `ProviderStatusBar`. Appears once any provider status is set (after **Check my itinerary** starts).

**What you're looking at:** Compact summary + expandable per-provider lines for the three live checks.

**Real captured example data (sample path, this run):**
- Summary: **Live checks: 2 of 3 passed**
- **MiniMax M3 · offline** (extraction)
- **Nosana · live** (risk analysis)
- **Atlas Sandbox · live** (flight search)

On sample itinerary, extraction is intentionally skipped → offline/fallback. On upload path with GEM ticket selected, extraction would show **extracting…** then live/offline depending on OpenRouter outcome.

**What state/code this reads from:**
- `ProviderStatusBar` in `app/src/components/ProviderStatusBar.tsx`
- Props: `extractionProviderStatus`, `nosanaProviderStatus`, `atlasProviderStatus`, `extractionLoading`
- Set inside `handleCheckMyTrip` and `performLiveSearchForConfirmed`
- `countLiveSuccess()` counts statuses equal to `'live-success'` (max 3)

---

## 7. Per-leg unbooked preview sections

**What triggers this:** `useEffect` on `step === 'options' && isLive && confirmedItinerary` calls `loadLegUnbookedPreviews` sequentially for first then second leg.

**What you're looking at:** Up to five Atlas Search+Verify previews per leg. Each section shows disclosure text, one **featured** card (`selectBestOptionCard`), and **See more verified options (N)** for the rest.

**Real captured example data:**

### First leg — KUL → SIN

| Run | Featured card | Notes |
|-----|---------------|-------|
| Run 1 (first full pass) | *(none)* — status **We don't have this yet** | Search/verify pipeline returned no displayable card |
| Run 2 (switch pass) | **KUL → SIN (AK AK701)** · nonstop · 06:10–07:15 | Source: *Atlas Sandbox · live (5 offers verified individually)* |

Intermittent first-leg behavior — Atlas returned live alternatives for the headline search but preview pipeline may still show fallback on a given run.

### Second leg — SIN → BKK

- Disclosure: *Unbooked preview · Not a real ticket · No booking, payment, or reservation created* (`UNBOOKED_PREVIEW_DISCLOSURE`)
- Featured: **SIN → DMK (FD FD356)** · nonstop · 14:40–16:20 · verified · search/verified price **USD 104.85** · offer `off_bd8f892c55fa90f1cad420bc`
- **See more verified options (4)** expanded to show:
  - **SIN → BKK (TR TR626)** · 18:00–19:35 · USD 107.10
  - **SIN → BKK (TR TR624)** · 08:20–09:55 · USD 107.57
  - **SIN → BKK (TR TR610)** · 16:15–17:50 · USD 114.11
  - **SIN → BKK (TR TR608)** · 06:30–08:05 · USD 119.39

**What state/code this reads from:**
- `firstLegPreviews`, `secondLegPreviews` (`LegUnbookedPreviewSection`)
- `UnbookedTicketPreviewLegSection` — local `expanded` state for "See more…"
- `selectBestOptionCard` + `BEST_OPTION_SELECTION_RULE` in `app/src/atlas/unbooked-previews.ts`:
  - *lowest total_price with successful Verify; else lowest attempted*
- `splitPreviewCardsForDisplay` — featured vs `remaining`
- `loadLegUnbookedPreviews` — sequential verify with `VERIFY_DELAY_MS = 300`
- `previewsLoading` — footer *Verifying unbooked previews sequentially…*

**From here:** Read-only cards; no booking. Separate from **Live Atlas alternatives** list (first-leg search only).

---

## 8. Keep path → Done

**What triggers this:** On Options, click **Keep current itinerary** (`setDecision('keep')`) → **Confirm** → `setStep('done')`.

**What you're looking at:** Confirmation block appears after Keep is selected; final Done screen acknowledges choice without any write action.

**Real captured example data:**
- After Keep selected: *Keeping current itinerary*
- Safety copy: *No booking action is taken. No booking, payment, reservation, or order is created. Search is read-only.*
- Confirm button: **Confirm**
- Done title: **Itinerary kept**
- Done message: *You chose to keep your current flights.*
- Status line: *Request submitted — awaiting verified supplier outcome*
- Footer safety: *No booking, payment, reservation, or order is created.*
- **Technical details** `<details>`: `noOrderCreated: true`, `decision: keep`
- **Check another trip** → `handleRestart()` back to Welcome

**What state/code this reads from:**
- `decision === 'keep'`
- `setStep('done')` on Confirm click
- Done copy branches on `decision === 'switch'` vs keep in `step === 'done'` JSX
- `handleRestart` resets all flow state including provider statuses and `confirmedItinerary`

---

## 9. Switch path → Done

**What triggers this:** Separate live run: **Switch to this plan** on recommended card (or decision row) → **Submit switch request** → `setStep('done')`.

**What you're looking at:** Same Options screen but recommended card shows **✓ Selected**; decision status reads *Switch selected*; Done title changes.

**Real captured example data:**
- Recommended card: **✓ Selected · KUL → SIN** (nonstop, onward SIN → BKK)
- Decision status: *Switch selected*
- Submit button: **Submit switch request** (shown instead of Confirm when `decision === 'switch'`)
- Done title: **Switch selected**
- Done message: *You chose to switch to the recommended option.*
- Same awaiting-outcome and no-booking safety lines as Keep path
- Technical details: `decision: switch`

**What state/code this reads from:**
- `setDecision('switch')` from recommended card or `.sc-decision-actions`
- Selecting an Atlas alt card also sets `selectedOfferId` + `decision='switch'`
- `decision === 'switch'` hides duplicate Switch CTAs on alt cards
- No `SandboxOrderPanel` visible unless `verifyResult` exists (Verify was not required for switch-on-recommended)

---

## Known rough edges

1. **Browser back button** — Any back navigation from a non-welcome step triggers `popstate` → `handleRestart()`, returning to Welcome and clearing all flow state. There is no step-by-step history (documented in `docs/session-handoff-2026-08-26-post-audit-cleanup.md`).

2. **Double-click guard on Check my itinerary** — `confirmTransitionInFlight` blocks re-entry; button shows **Checking itinerary…** and stays disabled until the full async pipeline completes. Prevents duplicate snapshots/provider calls.

3. **Intermittent Atlas / preview failures** — Earlier sessions reported Atlas credential or proxy errors; this run succeeded for headline search (20 alternatives, live source label) but **first-leg unbooked previews** showed *We don't have this yet* on one pass and live AK701 on another. Treat preview sections as best-effort; retry by restarting the flow.

4. **Recovery animation vs live Atlas data** — Recommended card routes (KUL→SIN, SIN→BKK) align with the sample itinerary, but animation timing/price fields often show placeholders (**—** / *We don't have this yet*) because recovery data is Daytona-offline mock, not Atlas-backed.

5. **Sample vs upload extraction** — Sample path skips live OpenRouter extraction (provider shows offline). Upload path with GEM ticket selected would call live extraction and may change leg fields before confirmation if merge succeeds.

---

## Capture log (for audit)

| Screen | Live exercised? |
|--------|-----------------|
| Welcome (both entry buttons) | ✅ Yes |
| Trip / review (sample + upload entry) | ✅ Yes |
| Check transition loading | ✅ Yes (`Checking itinerary…`) |
| Options — banners, recommended, alternatives | ✅ Yes |
| Recovery animation expanded | ✅ Yes |
| How this works provider bar | ✅ Yes |
| Unbooked previews + expand | ✅ Yes (second leg; first leg intermittent) |
| Keep → Done | ✅ Yes |
| Switch → Done | ✅ Yes |
| Upload path through live extraction + check | ⚠️ Code-only (upload review captured; Check not run on upload path) |
| `Checking live alternatives…` banner | ⚠️ Code-only (transition too fast to capture visually; confirmed via `searchLoading` JSX) |

**No application code was modified during this walkthrough.**
