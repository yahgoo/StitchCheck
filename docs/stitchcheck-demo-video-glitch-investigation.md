# StitchCheck Demo-Video Rendering Glitch — Investigation & Specification

**Status**: Read-only investigation. No code changes. No external provider calls.
**Date**: 2026-08-22
**Author**: AI investigation (pending human approval before any code changes)

---

## 1. Observed Symptom

The recorded demo video (`output/demo-artifacts/stitchcheck-video/stitchcheck-demo.mp4`) appears visually degraded:

- The StitchCheck UI is visible but **text is very small** relative to the 1920×1080 frame.
- The recording may have captured an **unstable or incorrectly scaled layout**.
- The **final frame may have been rendered before fonts/layout/assets settled**.
- **Captions and audio/video synchronization** are potential risks (the existing `stitchcheck-demo.mp4` has no audio stream at all — it is the caption-only predecessor).
- The existing video must remain untouched as a fallback.

---

## 2. Evidence Available

| Artifact | Path | Properties |
|----------|------|------------|
| Caption-only video | `output/demo-artifacts/stitchcheck-video/stitchcheck-demo.mp4` | H.264, 1920×1080, 30fps, 120s, **no audio stream**, 2.9 MB |
| Voiceover proof video | `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` | H.264+AAC, 1920×1080, 30fps, 131s, 4.2 MB |
| Scene screenshots | `output/demo-artifacts/stitchcheck-video/scene-0{1..6}-*.png` | All 1920×1080 PNG |
| Frame generator | `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/generate-frames.py` | Pillow-based, resizes all source images to 1920×1080 |
| Build script | `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/build-full-video.sh` | ffmpeg concat of per-scene segments |
| Capture script (main) | `scripts/stitchcheck-demo-capture.mjs` | Playwright, viewport 1920×1080, deviceScaleFactor 1 |
| Capture script (legacy) | `output/demo-artifacts/stitchcheck-video/capture-scenes.mjs` | Playwright, viewport 1920×1080, deviceScaleFactor 1 |
| Composition HTML | `output/demo-artifacts/stitchcheck-video/composition.html` | Static HTML composition with `<img>` frames |
| App CSS | `app/src/App.css` | `max-width: 1200px` on `.sc-main`, system fonts, CSS transitions on buttons |
| App labels | `app/src/data/labels.ts` | Provenance-based label selection |
| App fixtures | `app/src/data/fixtures.ts` | `getDefaultExtraction()` sets `evidenceSource: 'local-fixture'` |
| Voice generation | `scripts/generate-stitchcheck-voice.py` | Kokoro ONNX, af_heart, speed 0.95 |
| Voice-caption sync proof | `docs/stitchcheck-voice-caption-sync-proof.md` | Documents synchronization methodology |
| Recording fallback doc | `docs/stitchcheck-demo-recording-fallback.md` | Documents manual recording procedure |

---

## 3. Candidate Causes

### C1. Full-page screenshot squashed to viewport (HIGH CONFIDENCE)
**File**: `output/demo-artifacts/stitchcheck-video/capture-scenes.mjs`, line 107
```js
await page.screenshot({ path: ..., fullPage: true });
```
Scene 3 is captured with `fullPage: true`, producing a tall image. The frame generator (`generate-frames.py`, line 136) then does:
```python
scene_bg = Image.open(scene_img_path).convert("RGB").resize((W, H))
```
This **naively stretches** the tall full-page screenshot to 1920×1080, compressing vertical content and making text very small. The current `scene-03-confirmed-unlocked.png` happens to be 1920×1080 (likely because the page content fit within the viewport at capture time), but this is fragile — any content overflow would cause the distortion.

### C2. No font/layout stabilization before capture (HIGH CONFIDENCE)
**File**: `scripts/stitchcheck-demo-capture.mjs`, line 175
```js
await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 });
```
`domcontentloaded` does NOT wait for:
- `document.fonts.ready` (web fonts)
- Image/media loading
- React hydration completion
- CSS layout stabilization

The app uses system fonts (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`), so font loading is less critical, but **React hydration and async state updates** may still be in flight.

### C3. No application-ready marker (HIGH CONFIDENCE)
The app has **no `data-demo-ready` attribute** or equivalent ready signal. The capture script relies solely on selector visibility waits, which can fire before the full layout is stable.

### C4. CSS transitions active during capture (MEDIUM CONFIDENCE)
**File**: `app/src/App.css`, line 95
```css
.sc-btn {
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}
```
CSS transitions are not disabled during capture. If a screenshot is taken mid-transition, the result may show partial opacity or color states.

### C5. Gemini label mismatch between capture script and app (HIGH CONFIDENCE)
**Capture script** (`scripts/stitchcheck-demo-capture.mjs`, line 55):
```js
gemini: 'OpenRouter temporary path — not direct Gemini validation',
```
**App** (`app/src/data/fixtures.ts`, lines 108–118): `getDefaultExtraction()` returns `evidenceSource: 'local-fixture'`, which through `getGeminiLabel()` produces `'Fictional itinerary — local demo fixture'`.

The capture script's assertion at line 215–216 would **fail** against the current app code. The existing scene screenshots were captured with an older label configuration.

### C6. No audio in `stitchcheck-demo.mp4` (CONFIRMED)
`ffprobe` confirms `stitchcheck-demo.mp4` has **only one stream** (H.264 video, no audio). This is the caption-only predecessor. The voiceover proof video (`stitchcheck-full-voiceover-proof.mp4`) does have AAC audio.

### C7. Pillow resize distorts aspect ratio for non-16:9 sources (MEDIUM CONFIDENCE)
`generate-frames.py` line 136: `.resize((W, H))` uses default `Image.NEAREST` or `Image.BICUBIC` resampling without aspect-ratio preservation. If any source screenshot has a different aspect ratio (e.g., a future fullPage capture), text will be vertically compressed.

### C8. Caption timing based on hardcoded durations, not measured WAV (LOW CONFIDENCE for current video, MEDIUM for future)
The build script (`build-full-video.sh`) uses measured durations from `voice-manifest.json`, which is correct. However, the original `stitchcheck-demo.mp4` used hardcoded 20-second scene durations without audio, so caption timing was approximate.

### C9. No `data-demo-ready` in composition.html (MEDIUM CONFIDENCE)
The `composition.html` uses `data-start` and `data-duration` attributes for timing but has no ready marker for the composition itself.

---

## 4. Reproduction Procedure

1. Start the Vite dev server: `cd app && npm run dev -- --port 5174`
2. Run the capture script: `node scripts/stitchcheck-demo-capture.mjs`
3. Observe that scene-03 screenshot may be taller than 1080px if content overflows
4. Run the frame generator: `cd output/demo-artifacts/stitchcheck-video && .tts-venv/bin/python _full-vo-tmp/generate-frames.py`
5. Observe that any non-1920×1080 source image is stretched to 1920×1080
6. Build the video: `bash _full-vo-tmp/build-full-video.sh`
7. Inspect the output with `ffprobe` and visually check frames at t=0, t=60, t=120

---

## 5. Most Likely Root Cause

**Primary**: The combination of (C1) full-page screenshot capture for scene 3 and (C7) naive Pillow resize to 1920×1080 causes vertical compression when content exceeds viewport height. Even when the current screenshots happen to fit, this is a latent bug that will manifest whenever page content overflows.

**Secondary**: (C2) No font/layout stabilization and (C3) no application-ready marker mean screenshots may be taken before React hydration and async state updates complete, causing flicker or incomplete layouts.

**Tertiary**: (C5) The Gemini label in the capture script does not match the app's current provenance-based label, meaning the capture script assertions are stale and would fail against the current code.

---

## 6. Capture Invariants

The following invariants MUST hold for every capture run:

1. Viewport is exactly 1920×1080 with deviceScaleFactor 1.
2. Browser zoom is 100%.
3. No horizontal clipping or unexpected scrollbars.
4. Body text is readable at normal playback size (minimum 14px effective).
5. No layout shift occurs after the ready marker.
6. No missing fonts, icons, or images.
7. All evidence labels are visible and match expected text.
8. No caption clipping in the final video.

---

## 7. Deterministic Browser-Ready Protocol

The capture script MUST implement this sequence before any screenshot:

1. `page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })`
2. `await page.evaluate(() => document.fonts.ready)`
3. `await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))` (two animation frames)
4. Wait for app-specific ready marker: `await page.waitForSelector('[data-demo-ready="true"]')`
5. `await page.evaluate(() => window.scrollTo(0, 0))` (reset scroll)
6. Disable CSS transitions: `await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })`

The app MUST set `data-demo-ready="true"` on the root element after:
- React hydration is complete
- All fixture data is loaded
- All images are loaded
- No pending state updates

---

## 8. Readability and Viewport Standard

| Property | Value |
|----------|-------|
| Viewport width | 1920px |
| Viewport height | 1080px |
| deviceScaleFactor | 1 |
| Browser zoom | 100% |
| Content max-width | 1200px (centered) |
| Minimum body text size | 14px (effective, after any scaling) |
| Minimum label text size | 12px |
| No horizontal scroll | Required |
| No vertical scroll in captured region | Required for non-fullPage captures |

---

## 9. Font/Image/Layout Stabilization Protocol

1. **Fonts**: Wait for `document.fonts.ready` before any screenshot.
2. **Images**: Wait for all `<img>` elements to have `complete === true`.
3. **Layout**: Wait for `requestAnimationFrame` × 2 after the ready marker.
4. **Transitions**: Inject `transition: none !important; animation: none !important` before capture.
5. **Scroll**: Reset to `scrollTo(0, 0)` before each screenshot.
6. **FullPage avoidance**: Never use `fullPage: true` for video frame sources. Always capture within the viewport.

---

## 10. Caption and Audio Synchronization Protocol

1. Generate WAV files with Kokoro (local, no external TTS).
2. Measure each WAV duration with `ffprobe` (not estimated).
3. Store measured durations in `voice-manifest.json`.
4. Build script reads measured durations from manifest — never hardcodes.
5. Caption segments start at the same timestamp as audio segments.
6. Caption segments end at `audio_start + measured_duration`.
7. No caption appears before voice starts; no caption remains after voice ends.
8. Audio is AAC at 192kbps, muxed with H.264 video.

---

## 11. Video Encoding Standard

| Property | Value |
|----------|-------|
| Video codec | H.264 (libx264) |
| Audio codec | AAC |
| Resolution | 1920×1080 |
| Frame rate | 30 fps |
| Pixel format | yuv420p |
| Video preset | fast |
| Video CRF | 18 |
| Audio bitrate | 192k |
| Container | MP4 |

---

## 12. Atomic Output and Fallback Policy

1. Render to a **new filename** (e.g., `stitchcheck-demo-v2.mp4`), never overwrite the existing file.
2. Validate the new file with `ffprobe` (streams, duration, resolution, codecs).
3. Inspect first, middle, and last frames visually.
4. Listen to first and last audio segments.
5. Generate a contact sheet (6 frames, one per scene) for review.
6. **Only after all gates pass**, update any symlink or index to point to the new file.
7. The previous known-good video (`stitchcheck-demo.mp4`) is **never deleted or overwritten**.
8. Record the final artifact SHA-256 hash.

---

## 13. Automated Validation Commands

```bash
# 1. ffprobe stream validation
ffprobe -v error -show_entries stream=index,codec_name,codec_type,width,height,r_frame_rate,duration,pix_fmt \
  -show_entries format=duration,size -of json <output.mp4>

# 2. Frame extraction for visual inspection
ffmpeg -y -i <output.mp4> -vf "select=eq(n\,0)+eq(n\,1800)+eq(n\,3600)" -vsync vfr frames_%03d.png

# 3. Contact sheet generation
ffmpeg -y -i <output.mp4> -vf "fps=1/20,scale=320:-1,tile=3x2" contact-sheet.png

# 4. Audio duration check
ffprobe -v error -show_entries stream=codec_name,duration -select_streams a -of default=noprint_wrappers=1 <output.mp4>

# 5. Secret scan
node scripts/secret-scan.mjs

# 6. SHA-256 hash
shasum -a 256 <output.mp4>
```

---

## 14. Manual QA Checklist

- [ ] Viewport is 1920×1080, no horizontal clipping
- [ ] No unexpected scrollbars in any scene
- [ ] Body text readable at normal playback size (≥14px effective)
- [ ] No layout shift after ready marker
- [ ] No missing fonts, icons, or images
- [ ] No caption clipping
- [ ] Captions begin and end within measured audio bounds
- [ ] H.264 video stream present
- [ ] AAC audio stream present
- [ ] Non-zero audio duration
- [ ] Frame rate is 30 fps
- [ ] Resolution is 1920×1080
- [ ] Total duration matches expected (≈131s for 6-scene voiceover)
- [ ] First, middle, and final frames visually valid
- [ ] Fallback video (`stitchcheck-demo.mp4`) unchanged
- [ ] No secret values in logs or artifacts
- [ ] No stale claim that OpenRouter is direct Gemini
- [ ] No "free" model claim without explicit evidence

---

## 15. OpenRouter Configuration Boundary

**Do not assume** that "Gemini 3.6 Flash free" or any specific free model exists.

The following configuration shape is proposed but **NOT yet populated**:

```
OPENROUTER_MODEL_ID=<human-approved model identifier>
OPENROUTER_PROVIDER_MODE=explicit
OPENROUTER_ENABLED=false
```

Until a human approves the exact model identifier from the current OpenRouter catalog:
- `OPENROUTER_MODEL_ID` remains empty.
- `OPENROUTER_ENABLED` remains `false`.
- No OpenRouter request is made.
- No automatic fallback to another model or provider.
- No "free" model claim is made without explicit evidence.

**Evidence label**: `OpenRouter temporary path — not direct Gemini validation`

This label is used ONLY when the app is configured to use OpenRouter. The current app defaults to `evidenceSource: 'local-fixture'` with label `'Fictional itinerary — local demo fixture'`.

---

## 16. Required Tests

1. **Capture script test**: Run `node scripts/stitchcheck-demo-capture.mjs` and verify all 6 scenes pass with correct evidence labels.
2. **Frame generator test**: Run `generate-frames.py` and verify all output frames are exactly 1920×1080 with no distortion.
3. **Build script test**: Run `build-full-video.sh` and verify `ffprobe` output matches encoding standard.
4. **Label consistency test**: Verify capture script expected labels match app's `getGeminiLabel()`, `getNosanaLabel()`, `getAtlasLabel()` outputs for the current fixture provenance.
5. **Audio sync test**: Verify caption start/end timestamps match measured WAV durations within ±50ms.
6. **Fallback preservation test**: Verify `stitchcheck-demo.mp4` is unchanged after any new render.

---

## 17. Acceptance Criteria

| Criterion | Pass Condition |
|-----------|---------------|
| Fixed viewport and device scale | 1920×1080, deviceScaleFactor 1 |
| No horizontal clipping | Content fits within 1200px max-width |
| No unexpected scrollbars | `overflow: hidden` or content fits |
| Readable body text | ≥14px effective at 1920×1080 playback |
| No layout shift after ready marker | `data-demo-ready` set before capture |
| No missing fonts/icons/images | `document.fonts.ready` + image load waits |
| No caption clipping | Caption band fits within frame |
| Captions within audio bounds | Caption start = audio start, caption end = audio end |
| H.264 video stream | `codec_name=h264` |
| AAC audio stream | `codec_name=aac` |
| Non-zero audio duration | `duration > 0` for audio stream |
| Expected frame rate | `r_frame_rate=30/1` |
| Expected resolution | `width=1920, height=1080` |
| Expected total duration | ≈131s (voiceover) or ≈120s (caption-only) |
| First/middle/final frames valid | Visual inspection passes |
| Fallback video unchanged | `stitchcheck-demo.mp4` size/hash unchanged |
| No secrets in artifacts | `secret-scan.mjs` passes |
| No stale OpenRouter/Gemini claim | Labels match current provenance |
| No "free" model claim | No unverified model claims |

---

## 18. Rollback Plan

1. The existing `stitchcheck-demo.mp4` is **never modified** — it remains as the fallback.
2. Any new video is rendered to a separate filename (e.g., `stitchcheck-demo-v2.mp4`).
3. If the new video fails any validation gate, delete the new file and retain the fallback.
4. No application code changes are made until this specification is approved.
5. If any code change causes regression, revert via `git checkout` of the specific files.

---

## 19. Files Permitted to Change After Approval

| File | Change Type |
|------|-------------|
| `scripts/stitchcheck-demo-capture.mjs` | Add font/layout stabilization, ready marker wait, transition disabling, fix Gemini label assertion |
| `app/src/App.tsx` | Add `data-demo-ready` attribute after hydration |
| `app/src/index.css` | Add capture-mode class to disable transitions (optional) |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/generate-frames.py` | Fix resize to preserve aspect ratio, add validation |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/build-full-video.sh` | No changes needed (already uses measured durations) |
| `output/demo-artifacts/stitchcheck-video/capture-scenes.mjs` | Remove `fullPage: true`, add stabilization |
| `.env.example` | Add `OPENROUTER_MODEL_ID`, `OPENROUTER_PROVIDER_MODE`, `OPENROUTER_ENABLED` fields (empty defaults) |

---

## 20. Files That Must Remain Untouched

| File | Reason |
|------|--------|
| `output/demo-artifacts/stitchcheck-video/stitchcheck-demo.mp4` | Fallback video — must remain unchanged |
| `.env.local` | Contains secrets — never modified |
| `app/src/data/labels.ts` | Provenance label logic — correct as-is |
| `app/src/data/fixtures.ts` | Fixture data — correct as-is |
| `app/src/data/types.ts` | Type definitions — no changes needed |
| All voice WAV files in `voice/` | Generated audio — not overwritten |
| `voice-manifest.json` | Measured durations — not overwritten |
| All provider integration files | No external calls permitted |

---

## 21. Remaining Unknowns

1. **Exact cause of "very small text"**: The current scene screenshots are 1920×1080 and text appears readable at that resolution. The "very small text" symptom may be from:
   - The video being played back at a resolution lower than 1920×1080 (player zoom).
   - The `max-width: 1200px` content area leaving large empty margins, making the effective content area smaller.
   - A previous version of the screenshots that was captured at a different resolution and then stretched.

2. **Whether the existing `stitchcheck-demo.mp4` was rendered from the current screenshots or older ones**: The video is 120s (6 × 20s scenes), suggesting it was built before the voiceover pipeline existed. The source frames may differ from the current `scene-0*.png` files.

3. **Whether HyperFrames CLI is available**: The fallback doc lists HyperFrames as unavailable. If it becomes available, the composition.html could be rendered directly instead of via the Pillow/ffmpeg pipeline.

4. **Whether the `data-demo-ready` marker should be set by the app or by the capture script**: The app could set it after hydration, or the capture script could inject it after waiting for network idle + fonts + animation frames. The app-based approach is more robust.

5. **OpenRouter model catalog**: The exact model identifier, pricing, and capabilities are unconfirmed. No assumption should be made until a human reviews the current OpenRouter catalog.

---

## Safety and Evidence Labels

These exact distinctions are maintained throughout this document:

- **OpenRouter temporary path** — not direct Gemini validation
- **Synthetic local placeholder** — not Atlas Sandbox evidence
- **Synthetic local placeholder** — not Nosana evidence
- **Atlas production search** — reference prices only
- **Offline VCC/318 guard** — not live booking proof
- **No booking, payment, order, or ticket was created**

---

## Explicit Statement

**No external provider call occurred during this investigation.** No Gemini, OpenRouter, Atlas, Daytona, or Nosana API was called. No credentials were read, printed, or exposed. No `.env.local` was accessed. No code was committed, pushed, or submitted. The existing demo video was not overwritten.
