# StitchCheck Kokoro Voiceover Pipeline

## Overview

Local TTS voiceover pipeline for the StitchCheck demo video using Kokoro ONNX
with the `af_heart` voice. Generates one WAV per scene, validates each with
ffprobe, mounts audio in the Hyperframes composition, and produces SRT captions
synchronized to measured audio durations.

**No external TTS calls are made. All synthesis is local.**

---

## 1. Voice Configuration

| Parameter | Value |
|-----------|-------|
| Voice | `af_heart` |
| Locale | `en-us` |
| Speed | `0.95` |
| Style | Natural, warm, conversational female American English |
| Sample rate | 24000 Hz |
| Output format | WAV (PCM 16-bit) |
| Engine | Kokoro ONNX v0.4.7 (`kokoro-onnx` Python package) |

---

## 2. Local Virtual Environment

All Python dependencies are installed in a repo-local virtual environment:

```
.tts-venv/
```

Setup:

```bash
python3 -m venv .tts-venv
.tts-venv/bin/python -m pip install --upgrade pip
.tts-venv/bin/python -m pip install kokoro-onnx soundfile
```

**Note:** kokoro-onnx 0.4.7 supports Python 3.14. The previous assumption that
Python >=3.10, <3.13 was required is outdated.

---

## 3. eSpeak-ng Requirements

Kokoro uses eSpeak-ng for phonemization. On macOS with Homebrew:

```bash
brew install espeak-ng
```

Required environment variables:

```bash
export PHONEMIZER_ESPEAK_LIBRARY="/opt/homebrew/lib/libespeak-ng.dylib"
export ESPEAK_DATA_PATH="/opt/homebrew/share/espeak-ng-data"
```

---

## 4. Model and Voice Cache Paths

| File | Path | Size |
|------|------|------|
| Kokoro model | `~/.cache/hyperframes/tts/models/kokoro-v1.0.onnx` | ~325 MB |
| Voice weights | `~/.cache/hyperframes/tts/voices/voices-v1.0.bin` | ~28 MB |

These files are not committed to the repository. They are cached locally by
Hyperframes/Kokoro on first use.

---

## 5. One-WAV-per-Scene Rule

Each scene has exactly one WAV file. No single long narration file is created
for the entire video. This allows:

- Independent regeneration of any scene.
- Precise duration measurement per scene.
- Clean audio track mounting in Hyperframes.

Current scenes (6 × 20s visual scenes):

| Scene | Text file | WAV file | Visual start | Audio start |
|-------|-----------|----------|--------------|-------------|
| 1 | `voice/scene-01.txt` | `voice/scene-01.wav` | 0s | 1s |
| 2 | `voice/scene-02.txt` | `voice/scene-02.wav` | 20s | 21s |
| 3 | `voice/scene-03.txt` | `voice/scene-03.wav` | 40s | 41s |
| 4 | `voice/scene-04.txt` | `voice/scene-04.wav` | 60s | 61s |
| 5 | `voice/scene-05.txt` | `voice/scene-05.wav` | 80s | 81s |
| 6 | `voice/scene-06.txt` | `voice/scene-06.wav` | 100s | 101s |

---

## 6. ffprobe / ffmpeg Validation

Every WAV is validated after generation:

**Duration and size check:**

```bash
ffprobe -v error \
  -show_entries format=duration,size \
  -of csv=p=0 \
  path/to/scene.wav
```

**Volume check:**

```bash
ffmpeg -hide_banner -nostats \
  -i path/to/scene.wav \
  -af volumedetect \
  -f null - 2>&1
```

**Rejection criteria:**
- Near-silent (peak < 0.01)
- Shorter than 0.5 seconds
- Longer than visual scene duration minus 1.5 seconds
- Corrupt or unreadable
- Clipped (peak > 0.99) or abnormally loud

---

## 7. Hyperframes Audio Track Mounting

Audio elements are mounted on dedicated track index `20`:

```html
<audio
  id="vo-scene-01"
  data-start="1"
  data-duration="16.683"
  data-track-index="20"
  data-volume="1"
  src="assets/voice/scene-01.wav">
</audio>
```

Rules:
- Narration starts 1 second after the visual scene begins.
- Duration uses the measured WAV value, rounded to 3 decimals.
- Visual tracks are unchanged.
- No background music is added.

---

## 8. SRT Caption Generation

Captions are generated from measured audio durations:

- Start time = visual scene start + 1 second
- End time = start + measured WAV duration
- Text matches the exact narration input

Output: `output/demo-artifacts/stitchcheck-video/voice/captions.srt`

---

## 9. How to Regenerate One Scene

```bash
cd <workspace-root>

PHONEMIZER_ESPEAK_LIBRARY="/opt/homebrew/lib/libespeak-ng.dylib" \
ESPEAK_DATA_PATH="/opt/homebrew/share/espeak-ng-data" \
.tts-venv/bin/python -c "
from kokoro_onnx import Kokoro
import soundfile as sf

kokoro = Kokoro(
    '$HOME/.cache/hyperframes/tts/models/kokoro-v1.0.onnx',
    '$HOME/.cache/hyperframes/tts/voices/voices-v1.0.bin'
)

text = open('output/demo-artifacts/stitchcheck-video/voice/scene-01.txt').read().strip()
samples, sr = kokoro.create(text, voice='af_heart', speed=0.95, lang='en-us')
sf.write('output/demo-artifacts/stitchcheck-video/voice/scene-01.wav', samples, sr)
print(f'Duration: {len(samples)/sr:.3f}s')
"
```

Replace `scene-01` with the target scene number (01–06).

---

## 10. How to Render a Test Video

To render a new video without overwriting the existing final asset:

```bash
# Render to a test output path
cd output/demo-artifacts/stitchcheck-video/hyperframes-project
npx --yes hyperframes@0.8.6 render \
  --output ../stitchcheck-demo-with-voice-test.mp4 \
  index.html
```

**Do not overwrite `stitchcheck-demo.mp4` directly.** Always render to a new
test path first, validate, then replace if acceptable.

---

## 11. Caption-Only Fallback

The existing caption-only video (`stitchcheck-demo.mp4`) is preserved as the
primary deliverable. The voiceover pipeline is an enhancement layer:

- If Kokoro, eSpeak-ng, or model weights are unavailable, the caption-only
  video remains the final deliverable.
- The React app does not depend on generated WAV files.
- Automated Playwright capture remains silent by default.

---

## 12. No External TTS Calls

- All synthesis uses the local Kokoro ONNX runtime.
- No API keys, network requests, or cloud services are involved.
- The voice manifest records `externalTtsCalls: false` for every scene.
- No ElevenLabs, PlayHT, Google Cloud TTS, or external voice API is used.

---

## 13. Known macOS / Python Limitations

| Limitation | Status |
|---|---|
| System Python 3.14 incompatible with older kokoro-onnx | Resolved: kokoro-onnx 0.4.7 supports Python 3.14 |
| eSpeak-ng library path varies by install method | Use Homebrew path: `/opt/homebrew/lib/libespeak-ng.dylib` |
| Model weights are large (~325 MB) | Cached in `~/.cache/hyperframes/tts/`, not in repo |
| Voice generation takes ~4.5s per scene on M-series Mac | Acceptable for 6 scenes (~27s total) |
| Headless Chromium cannot play audio | Capture remains silent by design |

---

## 14. Files Changed

| File | Action |
|---|---|
| `.tts-venv/` | **Created** — Python virtual environment with kokoro-onnx |
| `scripts/generate-stitchcheck-voice.py` | **Created** — Voice generation script |
| `output/demo-artifacts/stitchcheck-video/voice/scene-0[1-6].txt` | **Created** — Narration text (6 files) |
| `output/demo-artifacts/stitchcheck-video/voice/scene-0[1-6].wav` | **Created** — Generated WAV audio (6 files) |
| `output/demo-artifacts/stitchcheck-video/voice/voice-manifest.json` | **Created** — Generation manifest |
| `output/demo-artifacts/stitchcheck-video/voice/captions.srt` | **Created** — SRT captions |
| `output/demo-artifacts/stitchcheck-video/hyperframes-project/assets/voice/` | **Created** — WAV copies for Hyperframes |
| `output/demo-artifacts/stitchcheck-video/hyperframes-project/index.html` | **Modified** — Added audio elements |
| `output/demo-artifacts/stitchcheck-video/composition.html` | **Modified** — Added audio elements |
| `docs/stitchcheck-kokoro-voiceover-pipeline.md` | **Created** — This documentation |

**Not modified:**
- `app/` — no application code changes
- `.env.local` — not accessed
- `stitchcheck-demo.mp4` — existing caption-only video preserved
- `docs/stitchcheck-deck-final-copy.md` — deck unchanged
- `docs/stitchcheck-live-demo-presenter-script.md` — presenter script unchanged
- Atlas, Nosana, Gemini/OpenRouter files — not touched
