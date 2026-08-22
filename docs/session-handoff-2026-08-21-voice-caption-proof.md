# StitchCheck Session Handoff — 2026-08-21 (Voice-Caption Sync Proof)

## Session Summary

Created a ~26-second proof video demonstrating Kokoro local TTS voiceover
synchronized with burned-in captions for Scene 01 of the StitchCheck demo.

## What Was Done

1. **Read and inspected** the existing Kokoro voiceover pipeline:
   - `docs/stitchcheck-kokoro-voiceover-pipeline.md`
   - `output/demo-artifacts/stitchcheck-video/voice/voice-manifest.json`
   - `output/demo-artifacts/stitchcheck-video/voice/captions.srt`
   - `output/demo-artifacts/stitchcheck-video/hyperframes-project/index.html`
   - `scripts/generate-stitchcheck-voice.py`

2. **Verified prerequisites**:
   - ffmpeg 8.1.2 available (no `drawtext` filter — lacks libfreetype)
   - Pillow installed in `.tts-venv` for PNG frame generation
   - Scene-01 WAV: 16.683 s, 800 812 bytes, peak 0.6602
   - Scene-01 PNG: 1920×1080

3. **Generated frame PNGs** via Python/Pillow:
   - Title card (dark bg, "StitchCheck" + proof subtitle)
   - Scene frame without caption
   - Scene frame with burned-in caption text
   - Closing card ("Voice and captions Synchronized", "No external TTS call")

4. **Rendered proof video** using ffmpeg segment concatenation:
   - Title (3 s) → Scene no-caption (1 s) → Scene with-caption (16.683 s) → Scene no-caption (2.317 s) → Closing (3 s) = 26 s total
   - Audio: scene-01.wav with `adelay=4000` (3 s title + 1 s scene offset)
   - Caption visible exactly from audio start to audio end

5. **Validated with ffprobe**:
   - Duration: 26.000 s
   - Streams: 1× H.264 video + 1× AAC audio, no extras
   - Audio non-silent (Qavg: 65 492)
   - Existing `stitchcheck-demo.mp4` unchanged (2 927 320 bytes, 120 s)

6. **Created documentation**: `docs/stitchcheck-voice-caption-sync-proof.md`

## Files Created This Session

| File | Purpose |
|------|---------|
| `output/demo-artifacts/stitchcheck-video/stitchcheck-voice-caption-sync-proof.mp4` | Proof video (637 KB) |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/build-proof.sh` | ffmpeg build script |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/generate-frames.py` | Pillow frame generator |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/frame-*.png` | 4 frame PNGs |
| `output/demo-artifacts/stitchcheck-video/_proof-tmp/*.mp4` | Intermediate segments |
| `docs/stitchcheck-voice-caption-sync-proof.md` | Full documentation |

## Key Technical Details

- **Voice**: Kokoro ONNX `af_heart`, en-us, speed 0.95
- **Scene**: 01 — Review-First Gate
- **Measured WAV duration**: 16.683 s (from voice-manifest.json)
- **Audio start in proof video**: 4.000 s (3 s title + 1 s scene offset)
- **Caption start**: 4.000 s (= audio start)
- **Caption end**: 20.683 s (= 4.000 + 16.683)
- **No external TTS calls** — all local Kokoro ONNX
- **No existing files overwritten** — demo video, WAVs, SRT, compositions all preserved

## Known Limitations

1. ffmpeg lacks `drawtext` (no libfreetype) — captions rendered via Pillow PNG frames
2. Headless environment — cannot verify audio is audible (but AAC stream is non-silent)
3. Caption is a single block for entire audio duration (no word-level karaoke)

## Project State (Unchanged)

- Atlas, Nosana, Gemini, OpenRouter — not touched
- `stitchcheck-demo.mp4` — preserved (caption-only, 120 s)
- `app/` — no application code changes
- `.env.local` — not accessed
- All offline tests still passing

## Resume Notes

- To re-render: `bash output/demo-artifacts/stitchcheck-video/_proof-tmp/build-proof.sh`
- To regenerate frames: `.tts-venv/bin/python output/demo-artifacts/stitchcheck-video/_proof-tmp/generate-frames.py`
- The proof video can be played with `ffplay` or any media player to verify audio
