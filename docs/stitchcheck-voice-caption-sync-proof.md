# StitchCheck Voice + Caption Synchronization Proof

## Summary

A short (~26 s) proof video demonstrating that the Kokoro local TTS voiceover
and the measured-duration captions are synchronized frame-accurately. No
external TTS or provider calls were made.

---

## Output Video

| Field | Value |
|-------|-------|
| Path | `output/demo-artifacts/stitchcheck-video/stitchcheck-voice-caption-sync-proof.mp4` |
| File size | 637 161 bytes |
| Container | MP4 (H.264 + AAC) |
| Resolution | 1920 × 1080 @ 30 fps |
| Total duration | 26.000 s |

---

## Selected Scene

| Field | Value |
|-------|-------|
| Scene | Scene 01 — Review-First Gate |
| Visual source | `output/demo-artifacts/stitchcheck-video/scene-01-locked.png` |
| Narration text | "StitchCheck helps budget travellers understand the hidden risk of self-transfer flights. When you stitch two separately booked tickets, each is an independent contract. If the first flight is delayed and you miss the connection, the second airline has no obligation to help." |
| Source text file | `output/demo-artifacts/stitchcheck-video/voice/scene-01.txt` |

---

## WAV Source and Measured Duration

| Field | Value |
|-------|-------|
| WAV source | `output/demo-artifacts/stitchcheck-video/voice/scene-01.wav` |
| Also at | `output/demo-artifacts/stitchcheck-video/hyperframes-project/assets/voice/scene-01.wav` |
| Measured duration | **16.683 s** (from `voice-manifest.json`) |
| ffprobe duration | 16.682667 s |
| File size | 800 812 bytes |
| Format | PCM 16-bit, 24 000 Hz, mono |
| Peak amplitude | 0.6602 |
| RMS amplitude | 0.0779 |
| Validation status | pass |

---

## Audio and Caption Timings

All timings derived from `voice-manifest.json` measured values. No estimation.

| Event | Time in proof video |
|-------|---------------------|
| Title card starts | 0.000 s |
| Scene visual starts | 3.000 s |
| Audio starts (voice begins) | **4.000 s** (= 3 s title + 1 s scene offset) |
| Caption appears (burned-in) | **4.000 s** (= audio start) |
| Audio ends | **20.683 s** (= 4.000 + 16.683) |
| Caption disappears | **20.683 s** (= audio end; separate no-caption segment begins) |
| Scene visual ends | 23.000 s |
| Closing card starts | 23.000 s |
| Video ends | 26.000 s |

### Synchronization verification

- Caption start (4.000 s) = audio start (4.000 s) ✓
- Caption end (20.683 s) = audio start + measured duration (4.000 + 16.683 = 20.683 s) ✓
- No caption appears before the voice ✓
- No caption remains after the voice ends ✓
- No timing drift: the caption and audio are frame-aligned by construction
  (both start at the same segment boundary in the concatenated video)

---

## Video Structure

The proof video is composed of five concatenated segments:

| Segment | Duration | Content | Caption visible? |
|---------|----------|---------|-------------------|
| Title card | 3.000 s | Dark background, "StitchCheck" title, proof subtitle, Kokoro config | No |
| Scene A | 1.000 s | Scene-01 visual with status label and scene label | No |
| Scene B | 16.683 s | Scene-01 visual with burned-in caption text | **Yes** |
| Scene C | 2.317 s | Scene-01 visual, caption removed | No |
| Closing card | 3.000 s | "Voice and captions Synchronized", "No external TTS call" | No |

Status label visible throughout scene segments:
"Kokoro local voice + measured captions"

---

## Rendering Command

```bash
cd <workspace-root>
bash output/demo-artifacts/stitchcheck-video/_proof-tmp/build-proof.sh
```

The build script performs:
1. Generates frame PNGs via Python/Pillow (`generate-frames.py`)
2. Creates individual video segments from still PNGs using `ffmpeg -loop 1`
3. Concatenates segments using `ffmpeg -f concat`
4. Muxes AAC audio with 4 000 ms delay (`adelay=4000|4000`)

---

## ffprobe Results

### Duration

```
duration=26.000000
```

### Streams

```json
{
  "streams": [
    {
      "index": 0,
      "codec_name": "h264",
      "codec_type": "video",
      "duration": "26.000000"
    },
    {
      "index": 1,
      "codec_name": "aac",
      "codec_type": "audio",
      "duration": "26.000000"
    }
  ]
}
```

### Validation checklist

1. ✅ Video duration matches proof composition (26 s)
2. ✅ One video stream (h264)
3. ✅ One AAC audio stream
4. ✅ Audio duration is non-zero (26 s, padded to match video)
5. ✅ No unexpected extra audio streams
6. ✅ WAV source path resolves correctly
7. ✅ SRT/caption source path resolves correctly
8. ✅ Title card and closing verification card are present
9. ⚠️ Voice audibility cannot be verified in headless environment (see Limitations)
10. ✅ Existing final media (`stitchcheck-demo.mp4`) is unchanged

---

## Existing Final Video Unchanged

| File | Size | Modified | Duration |
|------|------|----------|----------|
| `stitchcheck-demo.mp4` | 2 927 320 bytes | Aug 21 13:25 | 120.000 s |

File size and modification timestamp are identical to the original. The proof
video was rendered to a separate path.

---

## Confirmation: No External TTS/Provider Call

- All audio synthesis was performed locally by Kokoro ONNX v0.4.7
- Voice: `af_heart`, locale: `en-us`, speed: `0.95`
- Model: `~/.cache/hyperframes/tts/models/kokoro-v1.0.onnx`
- Voices: `~/.cache/hyperframes/tts/voices/voices-v1.0.bin`
- `voice-manifest.json` records `externalTtsCalls: false` for every scene
- No ElevenLabs, PlayHT, Google Cloud TTS, or external voice API was used
- No Atlas, Nosana, Gemini, or OpenRouter calls were made

---

## Files Created

| File | Action |
|------|--------|
| `output/demo-artifacts/stitchcheck-video/stitchcheck-voice-caption-sync-proof.mp4` | **Created** — proof video |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/build-proof.sh` | **Created** — build script |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/generate-frames.py` | **Created** — frame generator |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/frame-title.png` | **Created** — title card frame |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/frame-scene-nocaption.png` | **Created** — scene frame without caption |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/frame-scene-caption.png` | **Created** — scene frame with caption |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/frame-closing.png` | **Created** — closing card frame |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/title.mp4` | **Created** — intermediate segment |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/scene-a.mp4` | **Created** — intermediate segment |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/scene-b.mp4` | **Created** — intermediate segment |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/scene-c.mp4` | **Created** — intermediate segment |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/closing.mp4` | **Created** — intermediate segment |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/video_only.mp4` | **Created** — intermediate concatenated video |
| `docs/stitchcheck-voice-caption-sync-proof.md` | **Created** — this document |

### Files NOT modified

- `stitchcheck-demo.mp4` — existing caption-only video preserved
- `composition.html` — production composition unchanged
- `hyperframes-project/index.html` — unchanged
- All WAV files in `voice/` — not overwritten
- `captions.srt` — not overwritten
- `voice-manifest.json` — not overwritten
- Atlas, Nosana, Gemini, OpenRouter files — not touched
- `.env.local` — not accessed
- `app/` — no application code changes

---

## Limitations

1. **Headless audio playback**: The voice cannot be verified as audible in a
   headless CI/agent environment. The AAC audio stream is present and non-silent
   (Qavg: 65 492.816 from the ffmpeg AAC encoder output), but actual playback
   requires a media player.

2. **No waveform-level timestamp inspection**: Precise sample-level alignment
   was not verified with a waveform analysis tool. Synchronization is guaranteed
   by construction: both the caption segment boundary and the audio `adelay`
   value are set to the same 4 000 ms offset.

3. **ffmpeg drawtext unavailable**: The local ffmpeg build lacks `libfreetype`,
   so burned-in captions were rendered via Python/Pillow PNG frames rather than
   real-time text overlays. This does not affect synchronization accuracy.

4. **Caption is a single block**: The full narration sentence is displayed as a
   word-wrapped block for the entire audio duration. Word-level karaoke-style
   highlighting is not implemented; this proof validates start/end alignment
   only.

## Caption Overlay Fix

A visual bug in the Pillow frame generator was fixed and re-rendered to a new
test video. The original approved proof video above remains untouched.

**Root cause.** In
`output/demo-artifacts/stitchcheck-video/_proof-tmp/generate-frames.py`
(lines 125–129 of the original), the caption-band loop computed
`alpha = int(230 * (i / 140))` per row but never applied it: the rows were
drawn with opaque RGB fills (`(15,17,23)` / `(10,11,16)`) onto an RGB image
with no alpha channel. The result was a fully opaque, full-width, 140px-tall
dark band at the bottom of every captioned frame, hiding the "Connection Risk"
and "Safer Alternatives" panels and their evidence labels.

**Fix applied.** The opaque band draw was replaced with true RGBA alpha
compositing: a 96px-tall RGBA overlay (shrunk from 140px to fit the two
wrapped caption lines) whose per-row alpha ramps from 0 at the band top to
`int(255 * 0.55)` (~0.55 opacity, matching the HTML caption-bar intent of
`rgba(0,0,0,0.55)`) at the bottom, composited with `Image.alpha_composite`
before the final RGB conversion. The caption text start was shifted from
`y = H - 130` to `y = H - 86` so both lines sit inside the band, and a subtle
1px-offset dark shadow pass is drawn behind the main text fill for legibility.
No changes were made to narration text, narration timing, WAV files,
`captions.srt` timestamps, or the `build-proof.sh` timing/`adelay` logic; the
only `build-proof.sh` change is the `OUTPUT` filename (line 15) so the render
writes a new test file.

**Before / after.** Before: a solid opaque dark band obscured the bottom
panels and their evidence labels during the 4.000–20.683s caption window.
After: the caption text remains fully legible (white text with a 1px shadow on
a semi-transparent gradient), while the "Connection Risk" and "Safer
Alternatives" panels and their "Synthetic local placeholder" evidence labels
are clearly visible through the bar.

**New test video.**
`output/demo-artifacts/stitchcheck-video/stitchcheck-voice-caption-sync-proof-fix-test.mp4`

**ffprobe validation of the new test video.**

- Command: `ffprobe -v error -show_entries stream=index,codec_name,codec_type,width,height,r_frame_rate -of default=noprint_wrappers=1 stitchcheck-voice-caption-sync-proof-fix-test.mp4`
  - Stream 0: `codec_name=h264`, `codec_type=video`, `width=1920`, `height=1080`, `r_frame_rate=30/1`
  - Stream 1: `codec_name=aac`, `codec_type=audio`
- Command: `ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 stitchcheck-voice-caption-sync-proof-fix-test.mp4`
  - `duration=26.000000` (identical to the original proof video), `size=671811`
- Frame inspection at t=12s (inside the caption window) confirms the caption
  is legible and the panels/evidence labels beneath the band are visible.

The original `stitchcheck-voice-caption-sync-proof.mp4`, the original
caption-only video, and the 120s `stitchcheck-demo.mp4` were not overwritten
or modified by this fix.
