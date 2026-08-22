# StitchCheck Post-22:00 Session Report

- **Session date:** 2026-08-21 (post-22:00)
- **Model/engine note:** continuing with Qwen3.7-Plus
- **Workstreams:** A — caption overlay bug fix (highest priority); B — safe outstanding integration items only
- **Provider activity:** no paid/live provider calls were made; no installs; no credits spent

---

## 1. Caption overlay bug — root cause

- **Root cause:** In `output/demo-artifacts/stitchcheck-video/_proof-tmp/generate-frames.py` (former lines 125–129), the frame generator computed a per-row `alpha = int(230 * (i / 140))` but **never applied it**. It drew with `draw.line(...)` using a 3-tuple fill onto an RGB image (line 91 `convert("RGB")`, no alpha channel), so every row was fully opaque. This produced a solid, full-width, 140px-tall dark band across the bottom of every captioned frame, hiding the "Connection Risk" and "Safer Alternatives" panels and their evidence labels. The band (~140px) was also ~2x taller than the ~2 lines (~66px) of caption text.
- **Classification:** full-width opaque bottom band (both oversized height and opaque fill).

## 2. Fix applied (before/after)

**Files changed and reason:**

| File | Change | Reason |
|---|---|---|
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/generate-frames.py` | Replaced the opaque caption-band draw with true RGBA alpha compositing | Sole source of the opaque band |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/build-proof.sh` | ONLY line 15 `OUTPUT` changed to the new test filename; no timing/filter flags touched | Render to a new file without overwriting the existing proof video |
| `docs/stitchcheck-voice-caption-sync-proof.md` | Appended a "Caption Overlay Fix" section; existing content untouched | Document the fix |

**Fix details:**

- Semi-transparent gradient band, transparent at top to ~0.55 opacity at the bottom (equivalent to `rgba(0,0,0,0.55)`).
- Band height reduced from **140px to 96px**.
- Caption text repositioned.
- Added a subtle 1px dark shadow pass behind the white caption fill for legibility.
- True alpha compositing (`Image.convert("RGBA")` + `alpha_composite`) keeps the panels beneath visible.

**Before:** solid opaque 140px dark band fully hid the bottom panels.

**After:** caption (2 lines, white with 1px shadow) is fully legible on the semi-transparent gradient, and the "Connection Risk" and "Safer Alternatives" panels, their dashed borders, lock icons, and both "Synthetic local placeholder — not Nosana/Atlas Sandbox evidence" labels are visible through the band.

**Not changed:** underlying app UI (RiskPanel/AlternativesPanel), narration text, narration timing, WAV files, `captions.srt` timestamps, or HTML compositions.

## 3. New test video + ffprobe validation

- **New test video path:** `output/demo-artifacts/stitchcheck-video/stitchcheck-voice-caption-sync-proof-fix-test.mp4`

**ffprobe validation:**

| Check | Result |
|---|---|
| Streams | One h264 video stream (1920x1080, 30 fps) AND one aac audio stream — both present |
| Duration | 26.000000 s — matches the original proof video exactly |
| Size | 671,811 bytes |
| Frame inspection (t=12s, inside the 4.000–20.683s caption window) | Caption legible AND underlying panels/evidence labels now visible |

**Originals NOT overwritten:**

- `stitchcheck-voice-caption-sync-proof.mp4` — 637,161 bytes, unchanged
- `stitchcheck-demo.mp4` — 2,927,320 bytes, unchanged

No caption-only video, WAV, SRT, or timing logic modified.

## 4. Nosana SDK readiness (B1)

- **Status:** BLOCKED / awaiting approval (not installed).
- `@nosana/kit` is NOT installed and NOT a dependency; there is no `package.json` under `smoke-tests/nosana/`. Version is unknown (npm registry returned 403 during the earlier audit; a human must confirm the latest version at npmjs.com before install).
- `validateJobDefinition()` lives at `smoke-tests/nosana/nosana_run_job.mjs` (line ~76) and guards the corrected v0.1 job definition produced by `buildRiskJobDefinition()`; a comment notes the SDK's own validator should be preferred once `@nosana/kit` is installed.
- The approval packet's own verdict is **"Nosana is not ready for approval"** (SDK not installed, market address unverified against live API, no credit account, package version unknown, entry point untested). Nothing was installed or executed this session.

## 5. Direct Gemini readiness (B2)

- **Status:** BLOCKED / awaiting approval (not ready; no call made).
- `GEMINI_API_KEY`: the variable NAME is present in `.env.local` and appears set/non-empty (checked structurally only; the value was never read or printed).
- `@google/genai` is NOT installed and NOT a dependency.
- The adapter (`smoke-tests/gemini/direct-gemini-adapter.mjs`) is fully implemented but disabled by default; its 3 authorization gates are all currently failing:
  1. `directGeminiEnabled` flag absent in `config.json`
  2. `provider-capabilities.json` `capabilityReviewStatus = "pending-hackathon-day"`
  3. `approvedModelIdentifier` empty

  With no injected client, no network path is reachable.
- The approval packet verdict is **"Direct Gemini is NOT READY for approval."** No Gemini call was made this session.

## 6. Evidence index corrections (B3)

No corrections were needed. All four claims in `docs/stitchcheck-submission-evidence-index.md` match the true state:

| Claim | Verified state |
|---|---|
| Atlas Sandbox Search+Verify | 20 offers, PRICE_CONFIRMATION_REQUIRED, hard stop after Verify, no write call, environment restored to Production |
| Nosana | Job-definition schema corrected offline to v0.1; no live execution; no paid workload submitted |
| Gemini | OpenRouter temporary path executed only; direct Gemini never called |
| Ticketing | TICKETING_ACTIVATION_REQUIRED; offers are reference-only; unresolved (pending external ATRIP workspace action) |

Deck and video assets were not touched.

## 7. Demo capture re-run (B4)

- **Command:** `node scripts/stitchcheck-demo-capture.mjs` (from workspace root)
- **Result:** PASS — 6/6 scenes captured successfully; overallStatus `"pass"`; voiceMode remains `"silent"`
- **Manifest:** `output/captures/capture-2026-08-21T14-41-47/capture-manifest.json`
- Offline only (localhost Vite + Playwright); `externalCallsMade=false`; no provider calls.

## 8. Full test / typecheck / build results

- **Typecheck:** `npx tsc --noEmit -p tsconfig.app.json` (from `app/`) — exit 0, 0 errors.
- **Build:** `npm run build` (`tsc -b && vite build`) — SUCCESS, 39 modules transformed, dist built.
- **Offline smoke-test suites** (all confirmed fixture/mock-only before running):

| Suite | Passed / Failed |
|---|---|
| `smoke-tests/atlas/adapter-offline-tests.mjs` | 89 / 0 |
| `smoke-tests/gemini/adapter-offline-tests.mjs` | 92 / 0 (OpenRouter safety gate verified: no live call; OpenRouter appears only as a label constant) |
| `smoke-tests/cross-provider-invariant-tests.mjs` | 40 / 0 |
| `smoke-tests/nosana/nosana-client-offline-tests.mjs` | 75 / 0 |
| **TOTAL** | **296 passed / 0 failed** |

- Live-capable scripts (`nosana_run_job.mjs`, `run-risk-job.mjs`, `nosana-risk-runner.mjs`, `atlas/run-sandbox-search-verify.mjs`, `gemini/run-smoke-test.mjs`) were identified and deliberately NOT run.
- No package installs were performed; existing `app/node_modules` used.

## 9. Safety statements (verbatim)

> "No Atlas order, payment, ticketing, cancellation, or refund was performed."

> "No paid Nosana workload was submitted."

> "No direct Gemini call was made."

Additionally: no provider calls, no credits spent, and no credentials/tokens/headers/.env.local values were printed or persisted this session.

## 10. Commands still awaiting human approval

> Note: no raw market/wallet addresses are reproduced here; the relevant address is recorded in `docs/stitchcheck-nosana-approval-packet.md`.

1. `cd smoke-tests/nosana && npm install @nosana/kit`
   Precondition: human confirms latest version on npmjs.com; registry returned 403 during audit.
2. `cd smoke-tests/nosana && node run-risk-job.mjs`
   Preconditions: after #1 + credit account + market-address verification; written approval required; max US$10.00, one attempt, zero retries.
3. Read-only pre-check: verify the Nosana market address via `GET /api/markets` (the address is recorded in `docs/stitchcheck-nosana-approval-packet.md`) — requires human approval.
4. `cd smoke-tests/gemini && npm install @google/genai`
   Precondition: confirm latest version; approve model identifier, safety settings, generation config, cost, SDK version.
5. `cd smoke-tests/gemini && node run-direct-gemini.mjs --fixture gem-01-two-leg-clean.png`
   Also BLOCKED: entry point `run-direct-gemini.mjs` does not exist yet; `directGeminiEnabled` flag absent; `approvedModelIdentifier` empty; `capabilityReviewStatus` pending.

## 11. Files changed this session

- `output/demo-artifacts/stitchcheck-video/_proof-tmp/generate-frames.py` — caption band → semi-transparent alpha compositing; band height 140→96; text repositioned + shadow
- `output/demo-artifacts/stitchcheck-video/_proof-tmp/build-proof.sh` — line 15 `OUTPUT` → new test filename only
- `docs/stitchcheck-voice-caption-sync-proof.md` — appended "Caption Overlay Fix" section
- `docs/stitchcheck-post-2200-session-report.md` — this deliverable
- (generated artifact, not source) `output/demo-artifacts/stitchcheck-video/stitchcheck-voice-caption-sync-proof-fix-test.mp4`
