# StitchCheck — Final Packaging Regression Audit

> **Date:** 2026-08-21  
> **Auditor:** Qoder (Automated)  
> **Scope:** Local-only regression. No external calls, no credits spent, no source code modified.  
> **Purpose:** Verify all offline tests, typecheck, build, capture, media files, and security constraints before final packaging.

---

## 1. Offline Test Suites

| Suite | Passed | Failed | Source |
|-------|-------:|-------:|--------|
| Cross-provider invariant tests | 40 | 0 | `smoke-tests/cross-provider-invariant-tests.mjs` |
| Gemini adapter offline tests | 92 | 0 | `smoke-tests/gemini/adapter-offline-tests.mjs` |
| Atlas adapter offline tests | 89 | 0 | `smoke-tests/atlas/adapter-offline-tests.mjs` |
| Atlas duplicate-booking guard | 48 | 0 | `smoke-tests/atlas/duplicate-booking-guard-offline-tests.mjs` |
| Atlas schema validator | 9 | 0 | `smoke-tests/atlas/schema-validator.mjs` |
| Nosana client offline tests | 75 | 0 | `smoke-tests/nosana/nosana-client-offline-tests.mjs` |
| Nosana schema validator | 8 | 0 | `smoke-tests/nosana/schema-validator.mjs` |
| **Total** | **361** | **0** | |

**Status: PASS.** All 361 offline tests passed. Zero failures.

---

## 2. TypeScript Typecheck

| Check | Result |
|-------|--------|
| Command | `tsc --noEmit` |
| Errors | 0 |
| Warnings | 0 |

**Status: PASS.** Zero type errors.

---

## 3. Production Build

| Check | Result |
|-------|--------|
| Command | `vite build` |
| Modules transformed | 39 |
| Build time | 67 ms |
| Output files | `dist/index.html` (0.41 kB), `dist/assets/index-RLpGX0u6.css` (10.20 kB), `dist/assets/index-cpYxbXo4.js` (249.46 kB) |

**Status: PASS.** Build succeeded with no errors.

---

## 4. Deterministic Six-Scene Capture

| Check | Result |
|-------|--------|
| Command | `node scripts/stitchcheck-demo-capture.mjs` |
| Scenes captured | 6/6 |
| Duration | 6.4 s |
| Output directory | `output/captures/capture-2026-08-21T15-48-20/` |
| voiceMode | `silent` (by design) |
| nosanaSource | `local-fallback` (synthetic fixture) |

### Scene Details

| Scene | File | Status |
|-------|------|--------|
| 01 — Locked state | `scene-01-locked.png` (77,804 bytes) | PASS |
| 02 — Edited field | `scene-02-edited-field.png` (84,099 bytes) | PASS |
| 03 — Confirmed & unlocked | `scene-03-confirmed-unlocked.png` (391,577 bytes) | PASS |
| 04 — Provider status | `scene-04-provider-status.png` (196,098 bytes) | PASS |
| 05 — Comparison view | `scene-05-comparison.png` (149,068 bytes) | PASS |
| 06 — Decision & final state | `scene-06-keep-switch-final.png` (137,979 bytes) | PASS |

**Status: PASS.** All 6 scenes captured successfully. Output directory is timestamped. No previous captures were overwritten (11 capture directories exist).

---

## 5. Media File Verification

### Final Voiceover Video

| Field | Value |
|-------|-------|
| Path | `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` |
| File size | 4,158,844 bytes (~4.0 MB) |
| Duration | 131.000 s |
| Resolution | 1920 × 1080 @ 30 fps |
| Video codec | H.264 (libx264, High profile) |
| Audio codec | AAC (LC), 24,000 Hz, mono |
| Voiceover | Kokoro ONNX v0.4.7 (`af_heart`, `en-us`, speed 0.95) — fully local |
| External TTS calls | **None** |
| Provider calls during render | **None** |

### Original Demo Video (Unchanged)

| Field | Value |
|-------|-------|
| Path | `output/demo-artifacts/stitchcheck-video/stitchcheck-demo.mp4` |
| File size | 2,927,320 bytes (~2.8 MB) |
| Duration | 120.000 s |
| Resolution | 1920 × 1080 @ 30 fps |
| Video codec | H.264 (libx264, High profile) |
| Status | **Preserved unchanged** (not overwritten) |

**Status: PASS.** Both videos intact. Original demo video not overwritten. Voiceover video matches specifications from `docs/stitchcheck-final-submission-readiness-final.md`.

---

## 6. Security Verification

### 6.1 Credential Leakage

| Check | Result |
|-------|--------|
| Scan scope | `app/src/**/*.{ts,tsx,mjs,json}` |
| Patterns scanned | API keys, Bearer tokens, private keys, passwords, secrets |
| Matches found | **0** |

**Status: PASS.** No credentials leaked in source code.

### 6.2 External Write Paths in UI

| Check | Result |
|-------|--------|
| Scan scope | `app/src/**/*.{ts,tsx}` |
| Patterns scanned | `fetch()`, `XMLHttpRequest`, `axios`, `.post()`, `.put()`, `.delete()`, `.patch()` |
| Matches found | 1 |

**Match analysis:**
- `app/src/data/fixtures.ts:67` — `fetch('/nosana-risk-result.json')` — **Local static file read only.** Not an external call.

**Status: PASS.** No external write paths in UI.

### 6.3 Booking/Payment/Order Actions

| Check | Result |
|-------|--------|
| Scan scope | `app/src/**/*.{ts,tsx}` |
| Patterns scanned | `booking`, `payment`, `order`, `ticket`, `reserve`, `cancel`, `refund`, `pay()` |
| Matches found | 25 |

**Match analysis:**
- All matches are CSS `border` properties, `onCancel` callbacks, footer text ("No booking, payment, or order created"), and `cancel()` calls in narration (Web Speech API).
- **No actual write operations found.**

**Status: PASS.** No booking, payment, or order actions in UI code.

### 6.4 Environment Variable Safety

| Check | Result |
|-------|--------|
| `.env.local` in `.gitignore` | **Yes** |
| `.env*.local` in `.gitignore` | **Yes** |
| `.env.example` contains real credentials | **No** (all values empty) |
| `process.env.*` references in source | 6 matches (all in `smoke-tests/nosana/`, not in `app/src`) |

**Status: PASS.** Credentials properly isolated. No secrets in source code.

### 6.5 voiceMode During Capture

| Check | Result |
|-------|--------|
| Capture manifest `voiceMode` | `"silent"` |
| External TTS or cloud service called | **No** |
| Narration uses browser-local Web Speech API | **Yes** (opt-in only) |

**Status: PASS.** Automated capture is silent by design. No external TTS called.

### 6.6 Output Directory Timestamping

| Check | Result |
|-------|--------|
| Capture output directory format | `capture-YYYY-MM-DDTHH-MM-SS` |
| Total capture directories | 11 |
| Latest capture | `capture-2026-08-21T15-48-20` |
| Previous captures overwritten | **No** (all 11 directories preserved) |

**Status: PASS.** All output directories are timestamped. No overwrites.

### 6.7 Original Video Preservation

| Check | Result |
|-------|--------|
| `stitchcheck-demo.mp4` exists | **Yes** (2,927,320 bytes, Aug 21 13:25) |
| `stitchcheck-full-voiceover-proof.mp4` exists | **Yes** (4,158,844 bytes, Aug 21 23:18) |
| Original video overwritten | **No** |

**Status: PASS.** Original videos preserved.

---

## 7. Preflight Check Drift (Non-Blocking)

| Check | Result |
|-------|--------|
| Preflight script | `scripts/stitchcheck-preflight.mjs` |
| Passed | 22 |
| Failed | 1 |

**Failed check:**
- "Atlas unauthenticated statement" — The preflight script expects the phrase `"Atlas remains unauthenticated"` in `docs/stitchcheck-submission-evidence-index.md`, but this phrase was intentionally removed during the final consolidation pass (see `docs/stitchcheck-final-submission-readiness-final.md` §4). The evidence index was corrected to reflect that Atlas Sandbox authentication succeeded and one live search returned 5 reference-price offers (ATL-SBX-SV-01).

**Impact:** **None.** This is a preflight script drift, not a security issue. The evidence index is the source of truth, and it correctly reflects the current state. The preflight script should be updated to match, but this is not a blocker for submission.

---

## 8. Summary

| Category | Status | Details |
|----------|--------|---------|
| Offline tests | **PASS** | 361/361 passed, 0 failed |
| TypeScript typecheck | **PASS** | 0 errors |
| Production build | **PASS** | 39 modules, 67 ms |
| Six-scene capture | **PASS** | 6/6 scenes, 6.4 s |
| Media files | **PASS** | Voiceover video 131s, original preserved |
| Credential leakage | **PASS** | 0 matches in source |
| External write paths | **PASS** | 0 external writes in UI |
| voiceMode silent | **PASS** | `"voiceMode": "silent"` in manifest |
| Output timestamped | **PASS** | 11 capture directories, no overwrites |
| Original videos preserved | **PASS** | Both videos intact |
| Preflight check | **DRIFT** | 22/23 passed, 1 stale check (non-blocking) |

---

## 9. Blockers

**None.** All critical checks passed. The preflight script drift is non-blocking and does not affect submission readiness.

---

## 10. Files Verified (Not Modified)

| File | Purpose |
|------|---------|
| `app/src/**/*.{ts,tsx}` | Source code (no credentials, no external writes) |
| `app/package.json` | Build scripts |
| `scripts/stitchcheck-demo-capture.mjs` | Capture script |
| `scripts/stitchcheck-preflight.mjs` | Preflight checker |
| `smoke-tests/**/*.mjs` | Offline test suites |
| `docs/stitchcheck-final-submission-readiness-final.md` | Prior readiness doc |
| `docs/stitchcheck-submission-evidence-index.md` | Evidence index (source of truth) |
| `output/demo-artifacts/stitchcheck-video/*.mp4` | Final videos |
| `output/captures/capture-2026-08-21T15-48-20/*` | Latest capture |

---

## 11. Explicit Safety Statements

- **No provider was called during this audit.** Confirmed.
- **No package was installed.** Confirmed.
- **No credit was spent, no job submitted, no wallet created.** Confirmed.
- **No `.env.local` was modified or printed.** Confirmed.
- **No existing video was overwritten.** Confirmed.
- **No `app/src` was modified.** Confirmed.
- **No external TTS, voice API, or media generation service was called.** Confirmed.
- **All edits were limited to this new audit document.** Confirmed.

---

## 12. Conclusion

**All regression checks passed.** The project is ready for final packaging and submission. No blockers identified.

**Recommended next steps (human action required):**
1. Review final voiceover video (`stitchcheck-full-voiceover-proof.mp4`, 131s)
2. Decide on Nosana live attempt (yes/no)
3. Decide on direct Gemini live attempt (yes/no)
4. Decide on Atlas ticketing activation (yes/no)
5. Export eight-slide deck as PDF/PPTX (optional)
6. Submit to hackathon platform

---

**End of audit.**
