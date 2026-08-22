# StitchCheck Final Regression Report

- **Date:** 2026-08-21
- **Scope:** Read-only final regression audit — all offline tests, typecheck, production build, capture verification, safety checks.
- **Constraint:** No packages installed, no providers called, no credits spent, no source code edited.

---

## 1. Offline Test Results

| Suite | Script | Passed | Failed |
|---|---|---:|---:|
| Cross-provider invariant tests | `smoke-tests/cross-provider-invariant-tests.mjs` | 40 | 0 |
| Gemini adapter offline tests | `smoke-tests/gemini/adapter-offline-tests.mjs` | 92 | 0 |
| Atlas adapter offline tests | `smoke-tests/atlas/adapter-offline-tests.mjs` | 89 | 0 |
| Atlas duplicate-booking guard | `smoke-tests/atlas/duplicate-booking-guard-offline-tests.mjs` | 48 | 0 |
| Atlas schema validator | `smoke-tests/atlas/schema-validator.mjs` | 9 fixtures | 0 |
| Nosana client offline tests | `smoke-tests/nosana/nosana-client-offline-tests.mjs` | 75 | 0 |
| Nosana schema validator | `smoke-tests/nosana/schema-validator.mjs` | 21 fixtures | 0 |
| **TOTAL** | **7 suites** | **344 passed** | **0 failed** |

**Delta vs. post-2200 report:** The duplicate-booking guard suite now reports **48 passed** (previously 40 in the post-2200 count — the earlier report listed a subset). All other suite counts are unchanged.

---

## 2. Typecheck

| Command | Exit code | Errors |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` (from `app/`) | 0 | 0 |

---

## 3. Production Build

| Command | Result | Modules | Output |
|---|---|---|---|
| `npm run build` (`tsc -b && vite build`) from `app/` | SUCCESS | 39 transformed | `app/dist/index.html` (0.41 kB), `assets/index-RLpGX0u6.css` (10.20 kB), `assets/index-cpYxbXo4.js` (249.46 kB) |

Build completes in 69 ms. No warnings.

---

## 4. Preflight Check

| Command | Passed | Failed |
|---|---:|---:|
| `npm run preflight` (from `app/`) | 22 | **1** |

**Single failure:** `Atlas unauthenticated statement` — the preflight script (`scripts/stitchcheck-preflight.mjs` line 117) checks for the exact phrase `"Atlas remains unauthenticated"` in `docs/stitchcheck-submission-evidence-index.md`. That phrase was intentionally removed from the evidence index when it was updated to reflect that Atlas authentication succeeded via the official Skill (line 99 of the evidence index now reads: *"Authentication succeeded via official Atlas Flight Booking Skill"*). The phrase still exists in 13 other docs files.

**Classification:** Stale preflight check — not a regression. The evidence index is more accurate than the check. Fix would be to update the preflight script to match the current evidence index wording, but this is out of scope for a read-only audit.

---

## 5. Deterministic Six-Scene Capture

**Most recent capture:** `output/captures/capture-2026-08-21T14-41-47/`

| Field | Value |
|---|---|
| Timestamp | 2026-08-21T14:41:54.433Z |
| Overall status | **pass** |
| Duration | 6.8 s |
| Voice mode | **silent** |
| Scenes passed | **6 / 6** |
| Nosana source | local-fallback |
| External calls | false |

**Scene manifest:**

| Scene | File | Status |
|---|---|---|
| 01-locked | `scene-01-locked.png` (77,804 B) | pass |
| 02-edited-field | `scene-02-edited-field.png` (84,099 B) | pass |
| 03-confirmed-unlocked | `scene-03-confirmed-unlocked.png` (391,577 B, full page) | pass |
| 04-provider-status | `scene-04-provider-status.png` (196,098 B) | pass |
| 05-comparison | `scene-05-comparison.png` (149,068 B) | pass |
| 06-keep-switch-final | `scene-06-keep-switch-final.png` (137,979 B) | pass |

**Manifest path:** `output/captures/capture-2026-08-21T14-41-47/capture-manifest.json`

**Evidence labels verified in capture:**
- Gemini: `OpenRouter temporary path — not direct Gemini validation`
- Nosana: `Synthetic local placeholder — not Nosana evidence` (accepted variant)
- Atlas: `Synthetic local placeholder — not Atlas Sandbox evidence`

---

## 6. Voice / Caption Proof Validation

**Voice assets present:** `output/demo-artifacts/stitchcheck-video/voice/`
- 6 WAV files (scene-01 through scene-06), all present and non-zero
- 1 `captions.srt` file present
- 1 `voice-manifest.json` present
- HyperFrames duplicate set also present under `hyperframes-project/assets/voice/`

**Video assets — originals unchanged:**

| File | Size | Expected (post-2200) | Match |
|---|---:|---:|---|
| `stitchcheck-demo.mp4` | 2,927,320 B | 2,927,320 B | **yes** |
| `stitchcheck-voice-caption-sync-proof.mp4` | 637,161 B | 637,161 B | **yes** |
| `stitchcheck-voice-caption-sync-proof-fix-test.mp4` | 671,811 B | 671,811 B | **yes** |

No original video was overwritten. File sizes match the post-2200 session report exactly.

---

## 7. Safety Checks

### 7a. No Accidental External Writes

| Check | Result |
|---|---|
| `fetch` / `axios` / `XMLHttpRequest` / `WebSocket` in `app/src/` | **One occurrence only:** `fixtures.ts:67` — `fetch('/nosana-risk-result.json')` — local relative path, no external host |
| `fetch` / `http` / `https` in `smoke-tests/gemini/direct-gemini-adapter.mjs` | Only in URL redaction regex (`replace(/https?:\/\/.../)`) — sanitization, not network call |
| `fetch` / `http` / `https` in `smoke-tests/nosana/nosana-client.mjs` | **None** — fully offline |
| Live-capable scripts NOT run | `nosana_run_job.mjs`, `run-risk-job.mjs`, `nosana-risk-runner.mjs`, `atlas/run-sandbox-search-verify.mjs`, `gemini/run-smoke-test.mjs`, `gemini/direct-gemini-adapter.mjs` |

### 7b. No Credential Leakage

| Check | Result |
|---|---|
| `API_KEY` / `SECRET` / `PASSWORD` / `Bearer` in `app/src/` | **None found** |
| `process.env` / `readFileSync(.env)` in `app/src/` | **None found** — frontend never reads env vars |
| `.env.local` exists | Yes (9 lines, values not inspected) |
| `.env.example` format | Correct — blank variable names only, no values |
| Credential reads in `smoke-tests/` | Only in live-capable scripts (`run-risk-job.mjs`, `nosana-risk-runner.mjs`, `nosana_run_job.mjs`, `providers.mjs`) — all deliberately NOT executed |

### 7c. No Stale UI Labels

| Label constant | Value | Used in |
|---|---|---|
| `LABELS.geminiExtraction` | `OpenRouter temporary path — not direct Gemini validation` | `ItineraryReview.tsx`, `UploadPanel.tsx` |
| `LABELS.nosanaRisk` | `Synthetic local placeholder — not Nosana evidence` | `RiskPanel.tsx`, `ComparisonView.tsx` |
| `LABELS.nosanaRiskEvidence` | `Nosana evidence — remote job succeeded; …` | `RiskPanel.tsx` (conditional) |
| `LABELS.nosanaRiskFallback` | `Nosana unavailable — local fallback used; not Nosana evidence` | `RiskPanel.tsx` (conditional) |
| `LABELS.atlasAlternatives` | `Synthetic local placeholder — not Atlas Sandbox evidence` | `AlternativesPanel.tsx`, `ComparisonView.tsx` |
| `DISABLED_MESSAGE` | `Confirm itinerary first` | Panel disabled state |
| `FINAL_STATEMENT` | `No booking, payment, reservation, ticket, order, verification, or other write action has been created.` | `DecisionPanel.tsx` |

All labels match the capture script's `EVIDENCE_LABELS` constants exactly. No stale labels detected.

### 7d. voiceMode Remains Silent During Capture

- Capture manifest: `"voiceMode": "silent"` — confirmed
- `useNarration` hook defaults to `mode: 'off'` — confirmed in source
- Capture script does not interact with narration controls — confirmed
- No external TTS or cloud service called — confirmed in manifest note

### 7e. Original Videos Unchanged

All three MP4 files match their expected sizes from the post-2200 report (see Section 6). No overwrite detected.

---

## 8. File Ownership Declaration

**File to be created by this audit:**

| File | Owner | Action |
|---|---|---|
| `docs/stitchcheck-final-regression-report.md` | This chat | **Create** (new file) |

**Files NOT modified by this audit (read-only):**

- `app/` — all source files untouched
- `scripts/` — all scripts untouched
- `smoke-tests/` — all test files untouched
- `.env.local` — not read, not modified
- `output/demo-artifacts/stitchcheck-video/*.mp4` — not modified
- `output/captures/` — not modified (existing captures from prior chats preserved)
- `docs/stitchcheck-submission-evidence-index.md` — not modified (owned by prior chat)
- `scripts/stitchcheck-preflight.mjs` — not modified (owned by prior chat)

---

## 9. Summary

| Check | Status | Details |
|---|---|---|
| Offline tests | **PASS** | 344 passed / 0 failed across 7 suites |
| Typecheck | **PASS** | 0 errors |
| Production build | **PASS** | 39 modules, dist built |
| Preflight | **WARN** | 22/23 passed — 1 stale check (Atlas wording) |
| Six-scene capture | **PASS** | 6/6 scenes, voiceMode silent |
| Voice/caption assets | **PASS** | All WAV, SRT, MP4 present and unchanged |
| No external writes | **PASS** | Only local fetch in frontend |
| No credential leakage | **PASS** | No secrets in frontend source |
| No stale UI labels | **PASS** | All labels match evidence constants |
| voiceMode silent | **PASS** | Confirmed in manifest and source |
| Original videos intact | **PASS** | File sizes match post-2200 report |

---

## 10. Blockers

**None.** All offline tests pass, typecheck and build are clean, capture is deterministic, safety boundaries are intact.

**One non-blocking advisory:**

The preflight script's `"Atlas remains unauthenticated"` check is stale relative to the current evidence index (which correctly documents that Atlas authentication succeeded). This does not affect test results, build, or demo behavior. Fix is cosmetic and out of scope for this read-only audit.

---

## 11. Output Paths

| Artifact | Path |
|---|---|
| This report | `docs/stitchcheck-final-regression-report.md` |
| Latest capture manifest | `output/captures/capture-2026-08-21T14-41-47/capture-manifest.json` |
| Production build | `app/dist/` |
| Voice assets | `output/demo-artifacts/stitchcheck-video/voice/` |
| Proof video (original) | `output/demo-artifacts/stitchcheck-video/stitchcheck-voice-caption-sync-proof.mp4` |
| Demo video (original) | `output/demo-artifacts/stitchcheck-video/stitchcheck-demo.mp4` |
| Fix-test video | `output/demo-artifacts/stitchcheck-video/stitchcheck-voice-caption-sync-proof-fix-test.mp4` |
