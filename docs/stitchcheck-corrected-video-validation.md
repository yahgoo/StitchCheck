# StitchCheck Corrected Video Validation

> **Purpose:** Truthful-media correction of Scene 6 narration in the full 6-scene voiceover proof video.
>
> **Date:** 2026-08-21
>
> **Original file preserved:** `stitchcheck-full-voiceover-proof.mp4` (unchanged)

---

## 1. Corrected Video Path

| Field | Value |
|-------|-------|
| Path | `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof-corrected.mp4` |
| File size | 4,492,921 bytes (~4.3 MB) |
| Container | MP4 (H.264 + AAC) |
| Resolution | 1920 x 1080 @ 30 fps |
| Total duration | 139.800 s |
| Video bitrate | 173,544 bps |
| Audio sample rate | 24,000 Hz |
| Audio channels | 1 (mono) |
| Audio codec | AAC (LC) |
| Audio duration | 134.792 s |

---

## 2. Changed Scene

**Scene 6 only** — narration text, audio, caption, and frame regenerated.
Scenes 1–5 are unchanged.

---

## 3. Final Narration Text (Scene 6)

> "StitchCheck's local demo is deterministic and write-free. Separate smoke tests
> verified OpenRouter extraction and Atlas Search and Sandbox Verify. Nosana is
> prepared for a bounded risk workload, but no live Nosana job was submitted.
> No booking, payment, ticketing, cancellation, or refund was performed. Atlas
> ticketing remains activation-gated, so this demo stops before any write."

**Claims NOT made:**
- No "zero external calls" (project-wide)
- No "direct Gemini" validation
- No "live Nosana" execution
- No "Atlas booking" or "ticketing"
- No "unexecuted" claims for Atlas

---

## 4. Measured WAV Duration

| Field | Value |
|-------|-------|
| Scene | 6 |
| WAV path | `output/demo-artifacts/stitchcheck-video/voice/scene-06.wav` |
| Measured duration | 25.792 s |
| Peak amplitude | 0.9017 |
| RMS amplitude | 0.075796 |
| Validation | Pass (non-silent, no clipping, fits scene) |

---

## 5. SRT Timing

| Cue | Start | End | Duration |
|-----|-------|-----|----------|
| 6 | 00:01:41,000 | 00:02:06,792 | 25.792 s |

Cues 1–5 are unchanged.

---

## 6. ffprobe Result

```json
{
  "streams": [
    {
      "index": 0,
      "codec_name": "h264",
      "codec_type": "video",
      "width": 1920,
      "height": 1080,
      "r_frame_rate": "30/1",
      "duration": "139.800000",
      "bit_rate": "173544"
    },
    {
      "index": 1,
      "codec_name": "aac",
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
    "size": "4492921",
    "bit_rate": "257105"
  }
}
```

**Validation checklist:**
1. One H.264 video stream at 1920x1080, 30 fps — PASS
2. One AAC audio stream at 24 kHz mono — PASS
3. Video duration 139.800 s matches expected composition — PASS
4. Audio duration 134.792 s matches last scene end (109 + 25.792) — PASS
5. Container size 4,492,921 bytes — PASS
6. No unexpected extra streams — PASS
7. No encoding errors in ffmpeg output — PASS

---

## 7. Frame Inspection Result

| Timestamp | Scene | Caption visible? | Panels visible? | Stale claims? | Verdict |
|-----------|-------|-------------------|-----------------|---------------|---------|
| t=12s | Scene 1 — Review-First Gate | Yes | Connection Risk + Safer Alternatives panels | No | PASS |
| t=75s | Scene 4 — Provider Status | Yes | Provider status, OpenRouter label | No | PASS |
| t=120s | Scene 6 — Keep or Switch | Yes | Decision panel, Keep/Switch options, "Demo Complete" | No — corrected text visible | PASS |
| t=137s | Closing card | N/A | "Full Voiceover Complete / 6 scenes / No external TTS call" | No | PASS |

**Caption legibility:** Confirmed at all inspected timestamps.
**Panel visibility:** Confirmed through semi-transparent caption band.
**No opaque caption overlay:** Confirmed.
**No stale claims in rendered video:** Confirmed.

---

## 8. Original-File Preservation

| File | Size | Modified | Status |
|------|------|----------|--------|
| `stitchcheck-full-voiceover-proof.mp4` | 4,158,844 bytes | Aug 21 23:18 | UNCHANGED |
| `stitchcheck-demo.mp4` | 2,927,320 bytes | Aug 21 13:25 | UNCHANGED |
| `stitchcheck-voice-caption-sync-proof.mp4` | 637,161 bytes | Aug 21 15:40 | UNCHANGED |
| `stitchcheck-voice-caption-sync-proof-fix-test.mp4` | 671,811 bytes | Aug 21 22:45 | UNCHANGED |

All original video files remain at their original sizes and timestamps.

---

## 9. No-Provider-Call Statement

- No Atlas API calls were made during this session.
- No Nosana API calls were made during this session.
- No Gemini API calls were made during this session.
- No OpenRouter API calls were made during this session.
- All audio synthesis was performed locally by Kokoro ONNX v0.4.7.
- Voice: `af_heart`, locale: `en-us`, speed: `0.95`.
- No packages installed, no credits spent, no wallet operations.

---

## 10. No-Live-Nosana Statement

- No live Nosana job was submitted.
- No credits were spent.
- No IPFS pin was created.
- Nosana SDK is installed and offline tests pass.
- Container image `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter` is allowlisted.
- Live execution requires explicit human approval.

---

## 11. Files Changed

| File | Action |
|------|--------|
| `output/demo-artifacts/stitchcheck-video/voice/scene-06.txt` | **Modified** — corrected narration text |
| `output/demo-artifacts/stitchcheck-video/voice/captions.srt` | **Modified** — updated cue 6 timing and text |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/generate-frames.py` | **Modified** — updated Scene 6 narration string |
| `output/demo-artifacts/stitchcheck-video/voice/scene-06.wav` | **Modified** — regenerated with corrected text |
| `output/demo-artifacts/stitchcheck-video/voice/voice-manifest.json` | **Modified** — updated Scene 6 duration and metrics |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/regen-scene06.py` | **Created** — Scene 6 regeneration script |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/build-corrected-video.sh` | **Created** — corrected video build script |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/*.mp4` | **Created** — intermediate corrected segments |
| `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/frame-scene-06-caption.png` | **Regenerated** — corrected caption frame |
| `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof-corrected.mp4` | **Created** — corrected output video |
| `docs/stitchcheck-corrected-video-validation.md` | **Created** — this document |
| `docs/stitchcheck-nosana-final-readiness-status.md` | **Created** — Nosana readiness status |

---

## 12. Verdict

**All validation checks PASS.** The corrected video renders truthful narration for Scene 6.
No stale claims remain. All original files are preserved.
