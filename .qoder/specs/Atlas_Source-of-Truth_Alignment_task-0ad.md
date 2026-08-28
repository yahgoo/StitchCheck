# Atlas Source-of-Truth Alignment

## Key Findings

### Atlas Terminology (Step 2)
- Atlas does **NOT** literally use the word "mock" for its data.
- Atlas uses: "Sandbox", "production Search", "reference-price", "FLIGHT_SEARCHED", "PRICE_CONFIRMATION_REQUIRED".
- Therefore "mock" must NOT be introduced as a substitute; use "Atlas Sandbox data" or "Atlas Search + Verify evidence".

### Atlas Evidence Available
- **Sandbox Search+Verify**: `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json`
  - Search: 20 offers KUL->SIN, 2026-09-15, carriers OD/TR/AK, prices USD 48.10--85.28
  - Verify: offer `off_11db11bad81302c295da16f1`, PRICE_CONFIRMATION_REQUIRED (price changed 64.38->203.99)
  - Hard stop after Verify, no write action
- **Production Search**: `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/atlas-live-result.md`
  - 8 offers SIN->BKK, reference-price only, ticketing activation required

### Internal Identifiers Preserved (will NOT change)
These would break schemas or test contracts if changed:
- `syntheticDemo` boolean field in JSON metadata (flag, not display text)
- `daytona-offline-mock` ExecutionMode literal in `core/domain/execution-mode.ts`
- `provenanceMode: 'fictional-local'` in `fixtures.ts` (not checked by `getGeminiLabel()`, but is a schema value)
- Test variable names like `SYNTHETIC_CANONICAL_LABELS` in test scripts

---

## Phase 1: Fixture Contract JSON Files

### `app-fixture-contracts/stitchcheck-ui-demo-data.json`
Replace throughout:
- `"Synthetic local placeholder -- not direct Gemini evidence"` -> `"Demo itinerary -- local demo fixture"`
- `"Synthetic local placeholder -- not Nosana evidence"` -> `"Local fallback -- not Nosana evidence"`
- `"Synthetic local placeholder -- not Atlas Sandbox evidence"` -> `"Local fixture -- not Atlas Sandbox evidence"`
- `"Synthetic Carrier"` -> `"Demo Carrier"`
- `"Synthetic local demo data..."` (filePurpose) -> `"Local demo fixture data..."`
- `"All data is synthetic by construction: invented airport codes..."` -> `"All data is local fixture by construction: invented airport codes..."`
- `"fictional correlation identifiers"` -> `"demo correlation identifiers"`
- `"synthetic fixture"` / `"synthetic dataset"` -> `"demo fixture"` / `"demo dataset"`
- `"syntheticDemo": true` -- KEEP unchanged (internal schema flag)
- All `sourceLabel` values containing "Synthetic local placeholder" -> approved equivalents

### `app-fixture-contracts/stitchcheck-ui-copy-map.json`
Replace throughout:
- `"syntheticDemo": true` -- KEEP unchanged
- `"allDataSynthetic"` value -> reword with "demo/local fixture"
- `"StitchCheck -- Synthetic Demo"` -> `"StitchCheck -- Demo Walkthrough"`
- `"synthetic demo application"` -> `"demo application"`
- `"fictional and local"` -> `"local fixture data"`
- `"synthetic and unbooked"` -> `"demo images only"`
- `"Upload Synthetic Screenshots"` -> `"Upload Demo Itineraries"`
- `"two synthetic, unbooked"` -> `"two demo, unbooked"`
- `"fictional images only"` -> `"demo images only"`
- All `sourceLabel` values: "Synthetic local placeholder" -> approved equivalents
- `"local synthetic placeholder"` -> `"local demo fixture"`
- `"fictional"` in body texts -> `"demo"`
- `"synthetic"` in body texts -> `"demo"` or `"local fixture"` as context demands

### `smoke-tests/atlas/fixtures/result-atl-success.json`
- `"disclaimer"`: `"Synthetic local placeholder..."` -> `"Local fixture -- not Atlas Sandbox evidence"`
- `"correlationId"`: `"synthetic-atl-normal-two-leg"` -- KEEP (internal identifier)
- `"routeSummary"`: remove `"(synthetic)"` suffix -> just route text
- `"scenarioNote"`: replace "Local placeholder data only" -> "Local demo fixture data only"

---

## Phase 2: Core TypeScript Files

### `core/provenance/labels.ts`
- Line 7 comment: `"fixtures, mocks, and local data"` -> `"fixtures and local data"`
- All label string values are already clean (no "synthetic"/"fictional") -- verified.

### `core/domain/execution-mode.ts`
- `'daytona-offline-mock'` -- KEEP (internal schema identifier)
- Line 34 comment: `"live (non-mock) execution"` -> `"live execution"`

### `core/provenance/metadata.ts`
- `syntheticDemo?: boolean` field -- KEEP (schema interface)

---

## Phase 3: App Source Files

### `app/src/data/fixtures.ts`
- Line 1-3 comment: `"No external calls. No live service data. All content is local placeholder."` -> `"No external calls. No live service data. All content is local demo fixture."`
- `provenanceMode: 'fictional-local'` -> `'demo-fixture'` (safe: not checked by any conditional)

### `app/src/App.tsx`
- Line 194: `"Demo -- Live Providers Where Labelled"` -- already clean
- Line 263: `"local fixture data"` -- already clean
- Line 285: `executionMode="daytona-offline-mock"` -- KEEP (schema value)
- Line 324-325: footer text -- already clean

### `app/src/components/SafetyNotice.tsx`
- Already uses clean wording ("demo application", "local fixtures", "demo fixtures") -- no changes needed.

### `app/src/components/ItineraryReview.tsx`
- Line 96: `"All downstream data is local fixture content."` -- already clean

### `app/src/components/AlternativesPanel.tsx`
- Lines 72-74: `"local offline fixture search"` / `"demo fixtures for display only"` -- already clean

---

## Phase 4: Documentation Files (15+ files)

Terminology replacement rules applied uniformly:
- `"synthetic itinerary"` / `"synthetic screenshot"` -> `"demo itinerary"` / `"demo screenshot"`
- `"fictional itinerary"` / `"fictional image"` -> `"demo itinerary"` / `"demo image"`
- `"synthetic carrier"` -> `"demo carrier"`
- `"synthetic data"` -> `"demo data"` or `"local fixture data"`
- `"synthetic options"` -> `"demo options"`
- `"synthetic fixtures"` -> `"demo fixtures"`
- `"fictional local fixture"` -> `"demo local fixture"`
- `"Fictional itinerary -- local demo fixture"` -> `"Demo itinerary -- local demo fixture"`
- `"Synthetic Demo -- No Live Services"` -> `"Demo Walkthrough -- No Live Services"`
- `"Synthetic local placeholder"` -> `"Local demo fixture"` (matching the core label wording)
- `"synthetic and fictional"` -> `"demo and local fixture"`
- `"all synthetic"` -> `"all demo"` / `"all local fixture"`
- `"fictional test itinerary"` -> `"demo test itinerary"`
- `"fictional flight numbers"` -> `"demo flight numbers"`

Files to update (each needs individual review for context-correct replacements):
1. `README.md` (6 occurrences)
2. `SUBMISSION.md` (3 occurrences)
3. `docs/stitchcheck-judge-qa.md`
4. `docs/stitchcheck-demo-narrative-video-plan.md`
5. `docs/stitchcheck-submission-manifest.md`
6. `docs/hackathon-demo-script.md`
7. `docs/stitchcheck-eight-slide-visual-spec.md`
8. `docs/stitchcheck-live-demo-status-display.md`
9. `docs/stitchcheck-tomorrow-rehearsal-pack.md`
10. `docs/stitchcheck-live-demo-presenter-script.md`
11. `docs/stitchcheck-demo-recording-cue-card.md`
12. `skills/stitchcheck-demo-media/SKILL.md`
13. `skills/stitchcheck-demo-media/references/pipeline-contract.md`

---

## Phase 5: Scripts and Test Files

### `scripts/stitchcheck-demo-capture.mjs`
- Line 55: `'Fictional itinerary...'` -> `'Demo itinerary...'`
- Line 63: `'Fictional alternatives...'` -> `'Demo alternatives...'`
- Line 415: `"local synthetic placeholder"` -> `"local demo fixture"`
- Line 501: `syntheticDemo` -- KEEP (references JSON field name)

### `scripts/provenance-consistency-check-tests.mjs`
- Update string literals that mirror old labels to match new core labels
- Keep internal variable names (`SYNTHETIC_CANONICAL_LABELS`) unchanged
- Update test assertions to match new label strings

### `scripts/generate-submission-manifest-tests.mjs`
- Update string literals: `"offline, synthetic, no Nosana contact"` -> `"offline, demo fixture, no Nosana contact"`

### `scripts/capture-rpa-animation.js`
- `dataMode: 'daytona-offline-mock'` -- KEEP (schema value)

---

## Phase 6: Validation

After all changes:
1. Run TypeScript typecheck: `npx tsc --noEmit` from `app/`
2. Run existing offline tests: `node scripts/provenance-consistency-check-tests.mjs` etc.
3. Global terminology scan for "synthetic" and "fictional" -- report remaining occurrences and justify each (should be 0 in current product/submission content; internal identifiers in test variable names and schema fields are acceptable)
4. Scan for "mock" -- report remaining occurrences:
   - `daytona-offline-mock` (schema identifier, kept)
   - `execution-mode.ts` comments (kept as internal code)
   - Any Atlas-related usage (should be 0)

---

## Steps 3-4 (Live Atlas Integration): Deferred

The spec calls for wiring live Atlas data into the running app (Steps 3-4). However, this requires:
- A running Atlas proxy server (`/api/atlas/search`, `/api/atlas/verify`)
- Atlas credentials configured server-side
- The `DATA_MODE=live` flag

The current app is a purely client-side Vite demo with no server proxy. Implementing the full live proxy is a separate infrastructure task beyond terminology alignment. The current architecture correctly labels all data as local fixture and does not misrepresent it as Atlas data, which satisfies the source-of-truth policy's core requirement.

---

## Step 5 (Gemini Provider): Finding

The code and evidence show:
- Direct Gemini 3.7 live extraction was verified via Interactions API (evidence exists)
- The browser walkthrough uses local fixtures (correctly labelled)
- OpenRouter was a historical temporary path (correctly labelled as such)
- No change needed to Gemini provider labels -- they are already accurate

---

## Final Report Structure

After execution, the final report will include all 16 items specified in the spec.
