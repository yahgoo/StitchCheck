# StitchCheck Scene 6 Caption Fix Validation

> **Purpose:** Fix Scene 6 caption overlay opacity — reduce from near-solid black to semi-transparent gradient.
>
> **Date:** 2026-08-22
>
> **Original corrected file preserved:** `stitchcheck-full-voiceover-proof-corrected.mp4` (unchanged)

---

## 1. Root Cause

The Scene 6 caption band in `generate-frames.py` used three compounding factors that produced a near-opaque black rectangle:

1. **High gradient alpha:** `MAX_ALPHA = int(255 * 0.55) = 140` — the gradient band reached 55% opacity at its bottom edge.
2. **Dark shadow text pass:** A separate `draw_wrapped_text()` call rendered the full caption in near-black `(5, 6, 9)` across the band area, adding a second layer of darkness on top of the gradient.
3. **Large band height:** 96px band covered a significant portion of the lower screen.

Combined effect: the bottom ~96px of the frame was rendered as a near-solid black rectangle, completely obscuring the "Demo Complete — No Action Created" panel, evidence fields (`noOrderCreated`, `syntheticDemo`, `externalCallsMade`, `decision`), and the "Restart demo" button.

---

## 2. Exact Rendering Changes

**File changed:** `output/demo-artifacts/stitchcheck-video/_scene6-fix/scene6-fix-frame.py` (new file, Scene 6 only)

| Parameter | Before (generate-frames.py) | After (scene6-fix-frame.py) |
|-----------|---------------------------|---------------------------|
| Band height | 96px | 100px (fits 4-5 wrapped lines) |
| Max alpha | 0.55 (140/255) | 0.40 (102/255) |
| Gradient shape | Linear: `a = MAX_ALPHA * (i / (BAND_H - 1))` | Quadratic ease-in: `a = MAX_ALPHA * (t * t)` |
| Text rendering | Two-pass: dark shadow `(5,6,9)` + white `(232,232,237)` | Two-pass: dark outline `(0,0,0)` + white `(255,255,255)` with 1px offset |
| Font size | 28px | 18px (fits more lines in compact band) |
| Text position | `y = H - 86` | `y = H - BAND_H + 4 = 964` |
| Line spacing | 6px | 3px |
| Max text width | 1700px | 1780px |

**Key fix:** The quadratic gradient (`t * t`) keeps the top of the band nearly transparent (alpha ≈ 0 at top, alpha ≈ 10 at 25% height), so the panels above the caption remain fully visible. Only the bottom portion where text sits reaches the maximum 0.40 opacity.

---

## 3. Output Video Path

| Field | Value |
|-------|-------|
| Path | `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof-scene6-caption-fix.mp4` |
| File size | 5,000,197 bytes (~4.8 MB) |
| Container | MP4 (H.264 + AAC) |

---

## 4. Scene 6 Timing Values

| Field | Value |
|-------|-------|
| Scene 6 audio start (video timeline) | t = 109.000s |
| Scene 6 no-caption pre-segment | t = 109.000 – 110.000s (1s) |
| Scene 6 caption segment | t = 110.000 – 135.792s (25.792s) |
| Scene 6 no-caption tail | t = 135.792 – 137.792s (2.0s) |
| Audio delay for Scene 6 | 109,000ms |
| WAV duration (scene-06.wav) | 25.792s |

---

## 5. ffprobe Result

```json
{
  "streams": [
    {
      "index": 0,
      "codec_name": "h264",
      "profile": "High",
      "codec_type": "video",
      "width": 1920,
      "height": 1080,
      "r_frame_rate": "30/1",
      "duration": "139.800000",
      "bit_rate": "202576"
    },
    {
      "index": 1,
      "codec_name": "aac",
      "profile": "LC",
      "codec_type": "audio",
      "sample_rate": "24000",
      "channels": 1,
      "channel_layout": "mono",
      "duration": "134.792000",
      "bit_rate": "80060"
    }
  ],
  "format": {
    "nb_streams": 2,
    "duration": "139.800000",
    "size": "5000197",
    "bit_rate": "286134"
  }
}
```

**Validation checklist:**
1. One H.264 High profile video stream at 1920x1080, 30 fps — PASS
2. One AAC LC audio stream at 24 kHz mono — PASS
3. Video duration 139.800s matches expected composition — PASS
4. Audio duration 134.792s matches last scene end (109 + 25.792) — PASS
5. Exactly 2 streams (1 video + 1 audio) — PASS
6. No encoding errors in ffmpeg output — PASS

---

## 6. Timestamps Inspected

| Timestamp | Scene | Caption visible? | Panels visible? | Evidence labels visible? | Stale claims? | Verdict |
|-----------|-------|-------------------|-----------------|------------------------|---------------|---------|
| t=12s | Scene 1 — Review-First Gate | Yes | First/Second Leg form fields, lock icons | "Synthetic local placeholder" | No | PASS |
| t=111s | Scene 6 — caption start + 1s | Yes | Demo Complete panel, Your Current Plan, Safer Alternatives | Both placeholder labels visible | No — corrected text | PASS |
| t=122.9s | Scene 6 — caption midpoint | Yes | Demo Complete panel, evidence fields, Restart demo button | Both placeholder labels visible | No — corrected text | PASS |
| t=134.8s | Scene 6 — caption end − 1s | Yes | Demo Complete panel, evidence fields, Restart demo button | Both placeholder labels visible | No — corrected text | PASS |

---

## 7. Visual Validation Result

| # | Check | Result |
|---|-------|--------|
| 1 | Caption text is legible | PASS — white text with dark outline, readable at all timestamps |
| 2 | Caption background is transparent/semi-transparent | PASS — gradient band, max 0.40 opacity, quadratic ease-in |
| 3 | Underlying panels are visible | PASS — "Demo Complete", "Your Current Plan", "Safer Alternatives" all fully visible |
| 4 | Evidence labels are visible | PASS — "Synthetic local placeholder — not Nosana evidence" and "Synthetic local placeholder — not Atlas Sandbox evidence" both visible |
| 5 | No dark opaque obstruction remains | PASS — band is thin (100px) with gradient transparency |
| 6 | No stale wording appears | PASS — corrected Scene 6 narration text renders correctly |
| 7 | Earlier scenes are unchanged | PASS — Scene 1 frame at t=12s matches original corrected video |
| 8 | Evidence fields visible | PASS — noOrderCreated: true, syntheticDemo: true, externalCallsMade: false, decision: keep |
| 9 | "Restart demo" button visible | PASS — blue button fully visible above caption band |
| 10 | Lock icons visible (Scene 1) | PASS — lock icons visible in Connection Risk and Safer Alternatives panels |

---

## 8. Pixel-Level Verification

Sampled pixels from the fixed frame PNG (`frame-scene-06-caption-fixed.png`):

| Location | RGB Value | Interpretation |
|----------|-----------|---------------|
| (960, 1040) — caption text area | [24, 24, 42] | Dark (text shadow/outline region) |
| (100, 1070) — band bottom, no text | [21, 21, 36] | Semi-dark (scene footer + 0.40 alpha gradient) |
| (100, 970) — above band | [245, 245, 245] | Light (scene background, no overlay) |

The gradient compositing is verified: above the band (y=970), pixels are near-white (245, 245, 245) showing the scene background. Within the band (y=1070), pixels are moderately dark (21, 21, 36) due to the scene's dark footer combined with the 0.40 alpha gradient — not a solid black rectangle.

---

## 9. Original-File Preservation

| File | Size | Modified | Status |
|------|------|----------|--------|
| `stitchcheck-full-voiceover-proof-corrected.mp4` | 4,492,921 bytes | Aug 21 23:55 | UNCHANGED |
| `stitchcheck-full-voiceover-proof.mp4` | 4,158,844 bytes | Aug 21 23:18 | UNCHANGED |
| `stitchcheck-demo.mp4` | 2,927,320 bytes | Aug 21 13:25 | UNCHANGED |
| `stitchcheck-voice-caption-sync-proof.mp4` | 637,161 bytes | Aug 21 15:40 | UNCHANGED |
| `stitchcheck-voice-caption-sync-proof-fix-test.mp4` | 671,811 bytes | Aug 21 22:45 | UNCHANGED |

All original video files remain at their original sizes and timestamps.

---

## 10. No-Provider-Call Statement

- No Atlas API calls were made during this session.
- No Nosana API calls were made during this session.
- No Gemini API calls were made during this session.
- No OpenRouter API calls were made during this session.
- No packages were installed.
- No files in `app/src` were modified.
- No deck files were modified.
- No WAV files were modified.
- No voice manifest timing was changed.
- No narration text was changed.
- All operations were local file reads, Python image generation, and ffmpeg video encoding.

---

## 11. Files Changed

| File | Action |
|------|--------|
| `output/demo-artifacts/stitchcheck-video/_scene6-fix/scene6-fix-frame.py` | **Created** — Scene 6 caption frame generator with semi-transparent gradient |
| `output/demo-artifacts/stitchcheck-video/_scene6-fix/build-scene6-fix.sh` | **Created** — build script that splices fixed Scene 6 segment into video |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/frame-scene-06-caption-fixed.png` | **Created** — fixed Scene 6 caption frame PNG |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/s06-b-fixed.mp4` | **Created** — encoded fixed Scene 6 caption video segment |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/video_only-scene6-fix.mp4` | **Created** — concatenated video-only intermediate |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/concat-scene6-fix.txt` | **Created** — concat list with fixed Scene 6 segment |
| `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof-scene6-caption-fix.mp4` | **Created** — final output video with fixed Scene 6 caption |
| `docs/stitchcheck-scene6-caption-fix-validation.md` | **Created** — this document |

**No existing files were modified.** All changes are additive (new files only).

---

## 12. Verdict

**All validation checks PASS.** The Scene 6 caption overlay has been fixed from a near-opaque black rectangle to a semi-transparent gradient band. All underlying panels, evidence labels, evidence fields, and UI elements remain fully visible. Caption text remains legible. No original files were modified. No provider calls were made.
