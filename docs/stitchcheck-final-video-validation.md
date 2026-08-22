# StitchCheck Final Video Validation

## Summary

Full 6-scene voiceover video rendered, validated, and documented. All checks pass.
No existing assets were modified. No provider calls, installs, or credit spend occurred.

---

## Output Video

| Field | Value |
|-------|-------|
| Path | `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` |
| File size | 4,158,844 bytes (~4.0 MB) |
| Container | MP4 (H.264 + AAC) |
| Resolution | 1920 x 1080 @ 30 fps |
| Total duration | 131.000 s |
| Video bitrate | 172,553 bps |
| Audio sample rate | 24,000 Hz |
| Audio channels | 1 (mono) |
| Audio codec | AAC (LC) |
| Audio duration | 125.917 s (ends with last scene narration; closing card is silent) |

---

## ffprobe Results

### Streams

```json
{
  "streams": [
    {
      "index": 0,
      "codec_name": "h264",
      "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
      "codec_type": "video",
      "width": 1920,
      "height": 1080,
      "r_frame_rate": "30/1",
      "duration": "131.000000",
      "bit_rate": "172553"
    },
    {
      "index": 1,
      "codec_name": "aac",
      "codec_long_name": "AAC (Advanced Audio Coding)",
      "codec_type": "audio",
      "sample_rate": "24000",
      "channels": 1,
      "channel_layout": "mono",
      "duration": "125.917000",
      "bit_rate": "78086"
    }
  ],
  "format": {
    "nb_streams": 2,
    "duration": "131.000000",
    "size": "4158844",
    "bit_rate": "253975"
  }
}
```

### Validation checklist

1. One H.264 video stream at 1920x1080, 30 fps -- PASS
2. One AAC audio stream at 24 kHz mono -- PASS
3. Video duration 131.000 s matches expected composition -- PASS
4. Audio duration 125.917 s matches last scene end (109 + 16.917) -- PASS
5. Container size 4,158,844 bytes -- PASS
6. No unexpected extra streams -- PASS
7. No encoding errors in ffmpeg output -- PASS

---

## Caption Overlay Fix Verification

### Root cause (pre-existing, fixed in prior session)

The caption-band loop in `generate-frames.py` computed per-row alpha values but
never applied them: rows were drawn with opaque RGB fills onto an RGB image
with no alpha channel, producing a fully opaque 140px dark band that hid the
"Connection Risk" and "Safer Alternatives" panels and their evidence labels.

### Fix applied (pre-existing, verified this session)

- Replaced opaque band draw with true RGBA alpha compositing
- Band height reduced from 140px to 96px
- Per-row alpha ramps from 0 (top) to ~0.55 opacity (bottom), matching
  `rgba(0,0,0,0.55)` HTML caption-bar intent
- Caption text repositioned with 1px dark shadow for legibility
- `Image.alpha_composite` keeps panels beneath the band visible

### Visual verification (this session)

Frame extracted at t=12s from `stitchcheck-voice-caption-sync-proof-fix-test.mp4`:

- Caption text fully legible (white with 1px shadow on semi-transparent gradient)
- "Connection Risk" and "Safer Alternatives" panels clearly visible through band
- Dashed borders, lock icons, and "Synthetic local placeholder" evidence labels
  all visible
- Status label "Kokoro local voice + measured captions" visible top-right
- Scene label "Scene 1 -- Review-First Gate" visible top-left

**Verdict: PASS** -- caption overlay fix confirmed working.

---

## Full Video Frame Inspection

Frames extracted at key timestamps across all 6 scenes:

| Timestamp | Scene | Caption visible? | Panels visible? | Verdict |
|-----------|-------|-------------------|-----------------|---------|
| t=12s | Scene 1 -- Review-First Gate | Yes | Connection Risk + Safer Alternatives panels, evidence labels, lock icons | PASS |
| t=33s | Scene 2 -- Editable Fields | Yes | Itinerary form fields, correction box | PASS |
| t=54s | Scene 3 -- Confirm to Unlock | Yes | Confirmed itinerary, Risk Band badge, Heuristic Result, Sandbox Results | PASS |
| t=75s | Scene 4 -- Provider Status | Yes | Provider status indicators, OpenRouter label | PASS |
| t=96s | Scene 5 -- Comparison View | Yes | Comparison table, "Your Current Plan" + "Safer Alternatives" cards | PASS |
| t=117s | Scene 6 -- Keep or Switch | Yes | Decision panel, Keep/Switch options | PASS |
| t=129s | Closing card | N/A | "Full Voiceover Complete / 6 scenes / No external TTS call" | PASS |

All captions are legible. All underlying UI panels remain visible through the
semi-transparent caption band. The caption-overlay fix is effective across all
6 scenes.

---

## Timeline Structure

| Segment | Time range | Duration | Content |
|---------|-----------|----------|---------|
| Title card | 0-3s | 3.000s | "StitchCheck / Full 6-Scene Voiceover Proof" |
| Scene 1 pre-caption | 3-4s | 1.000s | Scene 1 visual, no caption |
| Scene 1 caption | 4-20.683s | 16.683s | Scene 1 visual + caption (audio plays) |
| Scene 1 tail | 20.683-23s | 2.317s | Scene 1 visual, caption gone |
| Gap 1 | 23-24s | 1.000s | Black |
| Scene 2 pre-caption | 24-25s | 1.000s | Scene 2 visual, no caption |
| Scene 2 caption | 25-41.341s | 16.341s | Scene 2 visual + caption (audio plays) |
| Scene 2 tail | 41.341-44s | 2.659s | Scene 2 visual, caption gone |
| Gap 2 | 44-45s | 1.000s | Black |
| Scene 3 pre-caption | 45-46s | 1.000s | Scene 3 visual, no caption |
| Scene 3 caption | 46-62.917s | 16.917s | Scene 3 visual + caption (audio plays) |
| Scene 3 tail | 62.917-65s | 2.083s | Scene 3 visual, caption gone |
| Gap 3 | 65-66s | 1.000s | Black |
| Scene 4 pre-caption | 66-67s | 1.000s | Scene 4 visual, no caption |
| Scene 4 caption | 67-83.725s | 16.725s | Scene 4 visual + caption (audio plays) |
| Scene 4 tail | 83.725-86s | 2.275s | Scene 4 visual, caption gone |
| Gap 4 | 86-87s | 1.000s | Black |
| Scene 5 pre-caption | 87-88s | 1.000s | Scene 5 visual, no caption |
| Scene 5 caption | 88-105.707s | 17.707s | Scene 5 visual + caption (audio plays) |
| Scene 5 tail | 105.707-107s | 1.293s | Scene 5 visual, caption gone |
| Gap 5 | 107-108s | 1.000s | Black |
| Scene 6 pre-caption | 108-109s | 1.000s | Scene 6 visual, no caption |
| Scene 6 caption | 109-125.917s | 16.917s | Scene 6 visual + caption (audio plays) |
| Scene 6 tail | 125.917-128s | 2.083s | Scene 6 visual, caption gone |
| Closing card | 128-131s | 3.000s | "Full Voiceover Complete" |

---

## Audio Timing

All audio delays derived from `voice-manifest.json` measured durations.
No estimation. Each scene's audio starts 1 second after its visual segment begins.

| Scene | Audio delay (ms) | WAV duration (s) | Audio end (s) |
|-------|-----------------|-------------------|---------------|
| 1 | 4,000 | 16.683 | 20.683 |
| 2 | 25,000 | 16.341 | 41.341 |
| 3 | 46,000 | 16.917 | 62.917 |
| 4 | 67,000 | 16.725 | 83.725 |
| 5 | 88,000 | 17.707 | 105.707 |
| 6 | 109,000 | 16.917 | 125.917 |

Audio mixed via `amix=inputs=6:duration=longest:dropout_transition=0`.
Since no two audio segments overlap (gaps between scenes ensure separation),
amix produces clean, non-overlapping output.

---

## Existing Assets Unchanged

| File | Size | Modified | Status |
|------|------|----------|--------|
| `stitchcheck-demo.mp4` | 2,927,320 bytes | Aug 21 13:25 | UNCHANGED |
| `stitchcheck-voice-caption-sync-proof.mp4` | 637,161 bytes | Aug 21 15:40 | UNCHANGED |
| `stitchcheck-voice-caption-sync-proof-fix-test.mp4` | 671,811 bytes | Aug 21 22:45 | UNCHANGED |
| All WAV files in `voice/` | -- | -- | UNCHANGED |
| `captions.srt` | -- | -- | UNCHANGED |
| `voice-manifest.json` | -- | -- | UNCHANGED |
| `composition.html` | -- | -- | UNCHANGED |
| `hyperframes-project/index.html` | -- | -- | UNCHANGED |

---

## Files Created This Session

| File | Action |
|------|--------|
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/generate-frames.py` | **Created** -- 6-scene frame generator |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/build-full-video.sh` | **Created** -- full video build script |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/frame-title.png` | **Created** -- title card frame |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/frame-scene-0[1-6]-nocaption.png` | **Created** -- 6 scene frames without caption |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/frame-scene-0[1-6]-caption.png` | **Created** -- 6 scene frames with caption |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/frame-closing.png` | **Created** -- closing card frame |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/*.mp4` | **Created** -- intermediate segment videos |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/video_only.mp4` | **Created** -- concatenated video (no audio) |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/verify-*.png` | **Created** -- frame inspection samples |
| `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` | **Created** -- final output video |
| `docs/stitchcheck-final-video-validation.md` | **Created** -- this document |

---

## Files NOT Modified

- `app/` -- no application code changes
- `.env.local` -- not accessed
- `stitchcheck-demo.mp4` -- existing caption-only video preserved
- `stitchcheck-voice-caption-sync-proof.mp4` -- original proof video preserved
- `stitchcheck-voice-caption-sync-proof-fix-test.mp4` -- fix-test video preserved
- All WAV files in `voice/` -- not overwritten
- `captions.srt` -- not overwritten
- `voice-manifest.json` -- not overwritten
- `composition.html` -- not modified
- `hyperframes-project/index.html` -- not modified
- Atlas, Nosana, Gemini, OpenRouter files -- not touched
- Deck assets -- not touched
- Credentials -- not accessed

---

## Confirmation: No External TTS/Provider Call

- All audio synthesis was performed locally by Kokoro ONNX v0.4.7
- Voice: `af_heart`, locale: `en-us`, speed: `0.95`
- Model: `~/.cache/hyperframes/tts/models/kokoro-v1.0.onnx`
- Voices: `~/.cache/hyperframes/tts/voices/voices-v1.0.bin`
- `voice-manifest.json` records `externalTtsCalls: false` for every scene
- No ElevenLabs, PlayHT, Google Cloud TTS, or external voice API was used
- No Atlas, Nosana, Gemini, or OpenRouter calls were made
- No package installs, credit spend, wallet operations, bookings, or payments

---

## Remaining Blockers / Limitations

1. **Headless audio playback**: Voice audibility cannot be verified in a
   headless environment. The AAC audio stream is present and non-silent
   (Qavg: 65,488.871 from the ffmpeg AAC encoder output), but actual playback
   requires a media player.

2. **Audio duration vs video duration**: The audio track ends at 125.917s
   (end of Scene 6 narration) while the video continues to 131s (closing card).
   The closing card is intentionally silent. This is by design.

3. **No waveform-level timestamp inspection**: Precise sample-level alignment
   was not verified with a waveform analysis tool. Synchronization is
   guaranteed by construction: each scene's audio `adelay` value matches the
   cumulative timeline offset.

4. **ffmpeg drawtext unavailable**: The local ffmpeg build lacks `libfreetype`,
   so burned-in captions are rendered via Python/Pillow PNG frames rather than
   real-time text overlays. This does not affect synchronization accuracy.

5. **Caption is a single block per scene**: The full narration sentence is
   displayed as a word-wrapped block for the entire audio duration. Word-level
   karaoke-style highlighting is not implemented.

---

## Verdict

**All validation checks PASS.** The full 6-scene voiceover video is ready for
review. The caption-overlay fix is verified effective across all scenes. All
existing assets remain unchanged.
