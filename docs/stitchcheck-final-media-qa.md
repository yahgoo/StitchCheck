# StitchCheck Final Media QA

## Summary

Read-only QA verification of the final StitchCheck video package. All technical checks pass.
Stale claims identified in video-related documentation and narration scripts require correction.

---

## 1. Video Existence and Technical Validation

### 1.1 Full Voiceover Video

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| File exists | `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` | Present | ✅ PASS |
| File size | 4,158,844 bytes | 4,158,844 bytes | ✅ PASS |
| Container format | MP4 | MP4 | ✅ PASS |
| Video codec | H.264 | h264 | ✅ PASS |
| Video resolution | 1920×1080 | 1920×1080 | ✅ PASS |
| Frame rate | 30 fps | 30/1 | ✅ PASS |
| Video duration | 131.000 s | 131.000000 s | ✅ PASS |
| Video bitrate | ~172 kbps | 172,553 bps | ✅ PASS |
| Audio codec | AAC | aac | ✅ PASS |
| Audio sample rate | 24,000 Hz | 24,000 Hz | ✅ PASS |
| Audio channels | 1 (mono) | 1, mono | ✅ PASS |
| Audio duration | ~125.9 s | 125.917000 s | ✅ PASS |
| Total streams | 2 | 2 | ✅ PASS |

**ffprobe output (verified):**
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
      "duration": "131.000000",
      "bit_rate": "172553"
    },
    {
      "index": 1,
      "codec_name": "aac",
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

**Verdict:** ✅ PASS — All technical specifications match the validation document.

### 1.2 Original Videos Unchanged

| File | Expected Size | Actual Size | Expected Date | Actual Date | Status |
|------|---------------|-------------|---------------|-------------|--------|
| `stitchcheck-demo.mp4` | 2,927,320 bytes | 2,927,320 bytes | Aug 21 13:25 | Aug 21 13:25 | ✅ PASS |
| `stitchcheck-voice-caption-sync-proof.mp4` | 637,161 bytes | 637,161 bytes | Aug 21 15:40 | Aug 21 15:40 | ✅ PASS |
| `stitchcheck-voice-caption-sync-proof-fix-test.mp4` | 671,811 bytes | 671,811 bytes | Aug 21 22:45 | Aug 21 22:45 | ✅ PASS |

**Verdict:** ✅ PASS — All original video assets remain unchanged.

---

## 2. Caption and Panel Visibility

### 2.1 Caption Overlay Fix

The caption-overlay bug (opaque 140px band hiding panels) was fixed in a prior session.
The fix uses a 96px semi-transparent RGBA gradient band with per-row alpha 0→~0.55.

**Verification from `stitchcheck-final-video-validation.md`:**
- Frame extraction at t=12s (Scene 1 caption window): Caption text fully legible
- "Connection Risk" and "Safer Alternatives" panels visible through band
- Dashed borders, lock icons, and evidence labels all visible
- Scene labels and status indicators visible

**Verdict:** ✅ PASS — Caption overlay fix confirmed working across all 6 scenes.

### 2.2 Scene-by-Scene Validation

From `stitchcheck-final-video-validation.md` frame inspection:

| Timestamp | Scene | Caption Visible? | Panels Visible? | Status |
|-----------|-------|------------------|-----------------|--------|
| t=12s | Scene 1 — Review-First Gate | Yes | Connection Risk + Safer Alternatives | ✅ PASS |
| t=33s | Scene 2 — Editable Fields | Yes | Itinerary form, correction box | ✅ PASS |
| t=54s | Scene 3 — Confirm to Unlock | Yes | Risk Band, Heuristic Result, Sandbox Results | ✅ PASS |
| t=75s | Scene 4 — Provider Status | Yes | Provider status, OpenRouter label | ✅ PASS |
| t=96s | Scene 5 — Comparison View | Yes | Comparison table, plan cards | ✅ PASS |
| t=117s | Scene 6 — Keep or Switch | Yes | Decision panel, Keep/Switch options | ✅ PASS |
| t=129s | Closing card | N/A | "Full Voiceover Complete" | ✅ PASS |

**Verdict:** ✅ PASS — All captions legible, all panels visible throughout.

---

## 3. Narration Claims vs. Evidence

### 3.1 Voice Manifest Verification

From `voice/voice-manifest.json`:
- Voice: `af_heart`, locale: `en-us`, speed: 0.95
- Model: Kokoro ONNX v0.4.7 (local)
- `externalTtsCalls: false` for all 6 scenes
- All scenes: `validationStatus: "pass"`
- No ElevenLabs, PlayHT, Google Cloud TTS, or external voice API used

**Verdict:** ✅ PASS — No external TTS calls made. All audio synthesized locally.

### 3.2 Narration Text Accuracy

**Scene 5 narration (voice/scene-05.txt):**
> "The comparison view shows the original self-transfer itinerary alongside safer synthetic alternatives. Atlas production search returned real reference-price offers, but ticketing activation is pending. All alternatives shown here are local placeholders."

**Evidence check:**
- Atlas production search: ✅ Correct (ATL-LIVE-01 returned 8 offers SIN→BKK)
- Reference-price only: ✅ Correct (`price_status: reference`, `bookable: false`)
- Ticketing activation pending: ✅ Correct (matches evidence index)
- Alternatives are local placeholders: ✅ Correct (labelled as such)

**Scene 6 narration (voice/scene-06.txt):**
> "The traveller makes a local decision: keep the current plan or switch to an alternative. No booking, payment, or reservation is created. This review-first flow keeps the traveller in control at every step, with synthetic data and zero external calls."

**Evidence check:**
- No booking/payment/reservation created: ✅ Correct
- Review-first flow: ✅ Correct
- Synthetic data: ✅ Correct
- **"zero external calls":** ⚠️ STALE — See Section 4.1

**Verdict:** ⚠️ PARTIAL — Scene 6 contains stale "zero external calls" phrasing.

---

## 4. Stale Claims in Video-Related Documents

### 4.1 "Zero External Calls" Phrasing

**Issue:** The phrase "zero external calls" appears in video narration and frame generation scripts.
This phrasing is ambiguous and was already flagged in `stitchcheck-pitch-claim-audit.md` (Issue 1).
The deck was corrected to say "the demo UI makes no external calls" (qualified), but the video
narration and frame scripts still use the unqualified version.

**Locations:**

| File | Line | Content | Severity |
|------|------|---------|----------|
| `voice/scene-06.txt` | 1 | "...with synthetic data and zero external calls." | HIGH (spoken in video) |
| `voice/captions.srt` | 23 | "...with synthetic data and zero external calls." | HIGH (subtitle) |
| `_full-vo-tmp/generate-frames.py` | 66 | "...with synthetic data and zero external calls." | HIGH (burned into frames) |

**Why it's stale:**
- Atlas production search was called (ATL-LIVE-01, 8 offers)
- OpenRouter was called (GEM-LIVE-01)
- Atlas Sandbox Search + Verify was called (ATL-SBX-SV-01)
- The phrase is technically true for the demo app (`externalCallsMade: false`), but misleading
  when stated without qualification in the context of the entire project

**Recommended correction:**
Replace "zero external calls" with "the demo UI makes no live service calls" or
"no external calls from the demo app" to match the corrected deck language.

**Note:** This is baked into the final video. Correction requires re-rendering Scene 6
narration and frames, which is out of scope for this read-only QA.

### 4.2 "Atlas Unexecuted" / "Atlas Unauthenticated" Claims

**Issue:** Multiple video-related documents still state Atlas is "unexecuted" or "unauthenticated,"
contradicting the evidence index which confirms Atlas authentication succeeded and two live
production searches were performed.

**Locations:**

| File | Line | Content | Severity |
|------|------|---------|----------|
| `manifest.md` | 68 | "**Atlas**: Unexecuted. All alternatives data is synthetic local placeholder." | HIGH |
| `captions.md` | 21 | "Nosana and Atlas remain unexecuted." | MEDIUM |
| `composition.html` | 56 | "Nosana and Atlas remain unexecuted." | MEDIUM |
| `hyperframes-project/index.html` | 56 | "Nosana and Atlas remain unexecuted." | MEDIUM |
| `stitchcheck-demo/index.html` | 114 | "Nosana and Atlas remain unexecuted." | MEDIUM |

**Evidence index (authoritative):**
> "Atlas: Authentication succeeded via official Atlas Flight Booking Skill (browser ATRIP
> authorization). Two live production searches: (1) PVG→NRT/HND returned 5 real offers,
> (2) SIN→BKK returned 8 real offers (ATL-LIVE-01). All offers are reference prices
> (`price_status: reference`, `bookable: false`) due to `TICKETING_ACTIVATION_REQUIRED`."

**Why it's stale:**
- Atlas authentication succeeded (via official Skill)
- Two live production searches executed (ATL-LIVE-01)
- Atlas Sandbox Search + Verify executed (ATL-SBX-SV-01, partial success)
- Only the demo UI alternatives panels use synthetic placeholders

**Recommended correction:**
Replace "Atlas remains unexecuted" with "Atlas production authentication succeeded with two
live read-only searches (reference-price only); demo panels remain local placeholders."

**Note:** These are documentation files, not the video itself. Corrections can be made without
re-rendering.

### 4.3 Manifest File Size Discrepancy

**Issue:** `manifest.md` reports `stitchcheck-demo.mp4` file size as 2,926,952 bytes, but
the actual file size is 2,927,320 bytes (368-byte discrepancy).

**Location:** `manifest.md` line 12

**Recommended correction:** Update to 2,927,320 bytes.

---

## 5. Audio Timing and Synchronization

### 5.1 Timeline Structure

From `stitchcheck-final-video-validation.md`:

| Scene | Audio Start | Audio End | Duration | Status |
|-------|-------------|-----------|----------|--------|
| 1 | 4.000s | 20.683s | 16.683s | ✅ PASS |
| 2 | 25.000s | 41.341s | 16.341s | ✅ PASS |
| 3 | 46.000s | 62.917s | 16.917s | ✅ PASS |
| 4 | 67.000s | 83.725s | 16.725s | ✅ PASS |
| 5 | 88.000s | 105.707s | 17.707s | ✅ PASS |
| 6 | 109.000s | 125.917s | 16.917s | ✅ PASS |

**Total audio duration:** 125.917s (matches ffprobe)
**Total video duration:** 131.000s
**Closing card:** 128-131s (silent, by design)

**Verdict:** ✅ PASS — Audio timing matches voice manifest. No overlap, clean gaps.

### 5.2 Synchronization Method

- Audio delays derived from `voice-manifest.json` measured durations (no estimation)
- Each scene's audio starts 1 second after visual segment begins
- `amix=inputs=6:duration=longest:dropout_transition=0` produces clean non-overlapping output
- Synchronization guaranteed by construction

**Verdict:** ✅ PASS — Synchronization is frame-accurate by construction.

---

## 6. Evidence Boundary Compliance

### 6.1 No Provider Calls During Rendering

From `stitchcheck-final-video-validation.md`:
- All audio synthesis performed locally by Kokoro ONNX v0.4.7
- No Atlas, Nosana, Gemini, or OpenRouter calls made during video rendering
- No package installs, credit spend, wallet operations, bookings, or payments

**Verdict:** ✅ PASS — Rendering was fully local, no provider calls.

### 6.2 No Synthetic Data Presented as Live Evidence

All video frames and narration correctly label synthetic placeholders:
- Scene 1-3: "Synthetic local placeholder" labels visible
- Scene 4: OpenRouter label visible
- Scene 5: "Atlas production search returned real reference-price offers" + "All alternatives shown here are local placeholders"
- Scene 6: Local decision, synthetic data

**Verdict:** ✅ PASS — No synthetic data misrepresented as live evidence.

---

## 7. Summary of Findings

### 7.1 Technical Checks (All Pass)

| Check | Status |
|-------|--------|
| Full voiceover video exists | ✅ PASS |
| H.264/AAC streams present | ✅ PASS |
| Resolution 1920×1080 @ 30fps | ✅ PASS |
| Duration 131s (video) / 125.917s (audio) | ✅ PASS |
| File size 4,158,844 bytes | ✅ PASS |
| Original videos unchanged | ✅ PASS |
| Captions legible | ✅ PASS |
| Panels visible through caption band | ✅ PASS |
| Caption overlay fix effective | ✅ PASS |
| Audio timing matches manifest | ✅ PASS |
| No external TTS calls | ✅ PASS |
| No provider calls during rendering | ✅ PASS |
| Synthetic data correctly labelled | ✅ PASS |

### 7.2 Stale Claims (Require Correction)

| Issue | Severity | Location | Action Required |
|-------|----------|----------|-----------------|
| "zero external calls" in Scene 6 narration | HIGH | `voice/scene-06.txt`, `voice/captions.srt`, `_full-vo-tmp/generate-frames.py` | Re-render Scene 6 (out of scope for read-only QA) |
| "Atlas: Unexecuted" in manifest | HIGH | `manifest.md` line 68 | Update documentation |
| "Nosana and Atlas remain unexecuted" | MEDIUM | `captions.md`, `composition.html`, `hyperframes-project/index.html`, `stitchcheck-demo/index.html` | Update documentation |
| File size discrepancy | LOW | `manifest.md` line 12 | Update to 2,927,320 bytes |

### 7.3 Narration Accuracy

- **Scene 5:** ✅ Accurate (Atlas production search, reference-price, ticketing pending)
- **Scene 6:** ⚠️ Contains stale "zero external calls" phrasing (already flagged in pitch-claim audit)

---

## 8. Recommendations

### 8.1 Immediate (Out of Scope for Read-Only QA)

1. **Re-render Scene 6 narration** to replace "zero external calls" with "the demo UI makes no live service calls"
2. **Re-generate Scene 6 frames** with corrected caption text
3. **Re-mux final video** with corrected Scene 6

### 8.2 Documentation Updates (Can Be Done Without Re-Rendering)

1. Update `manifest.md` line 68 to reflect Atlas authentication and live searches
2. Update `captions.md` line 21 to clarify Atlas status
3. Update `composition.html`, `hyperframes-project/index.html`, `stitchcheck-demo/index.html` line 56/114 to clarify Atlas status
4. Correct `manifest.md` line 12 file size to 2,927,320 bytes

### 8.3 Submission Readiness

The video is **technically ready** for submission. The stale "zero external calls" phrasing
in Scene 6 is a **narration accuracy issue**, not a technical defect. The pitch-claim audit
already identified and corrected this in the deck; the video narration was not updated.

**Decision required:** Re-render Scene 6 or submit as-is with the understanding that the
phrase is technically defensible (refers to the demo app) but potentially misleading.

---

## 9. Files Examined

### 9.1 Video Files

- `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4`
- `output/demo-artifacts/stitchcheck-video/stitchcheck-demo.mp4`
- `output/demo-artifacts/stitchcheck-video/stitchcheck-voice-caption-sync-proof.mp4`
- `output/demo-artifacts/stitchcheck-video/stitchcheck-voice-caption-sync-proof-fix-test.mp4`

### 9.2 Documentation Files

- `docs/stitchcheck-final-video-validation.md`
- `docs/stitchcheck-post-2200-session-report.md`
- `docs/stitchcheck-submission-manifest.md`
- `docs/stitchcheck-submission-evidence-index.md`
- `docs/stitchcheck-voice-caption-sync-proof.md`
- `docs/stitchcheck-pitch-claim-audit.md`
- `docs/stitchcheck-pitch-claim-corrections-applied.md`

### 9.3 Video-Related Files

- `output/demo-artifacts/stitchcheck-video/manifest.md`
- `output/demo-artifacts/stitchcheck-video/captions.md`
- `output/demo-artifacts/stitchcheck-video/composition.html`
- `output/demo-artifacts/stitchcheck-video/hyperframes-project/index.html`
- `output/demo-artifacts/stitchcheck-video/stitchcheck-demo/index.html`
- `output/demo-artifacts/stitchcheck-video/voice/voice-manifest.json`
- `output/demo-artifacts/stitchcheck-video/voice/scene-06.txt`
- `output/demo-artifacts/stitchcheck-video/voice/captions.srt`
- `output/demo-artifacts/stitchcheck-video/_full-vo-tmp/generate-frames.py`

---

## 10. Verdict

**Technical validation:** ✅ ALL PASS
**Narration accuracy:** ⚠️ STALE CLAIMS IDENTIFIED
**Documentation consistency:** ⚠️ STALE CLAIMS IDENTIFIED

The full voiceover video is technically complete and meets all specifications. However,
Scene 6 narration and multiple documentation files contain stale "zero external calls"
and "Atlas unexecuted" claims that contradict the evidence index. These issues were
previously identified in the pitch-claim audit and corrected in the deck, but not in
the video narration or all video-related documentation.

**Recommendation:** Update documentation files immediately. Decide whether to re-render
Scene 6 before submission or accept the current narration with the understanding that
the phrase is defensible but potentially misleading.

---

## 11. Confirmation

- ✅ No media files were modified during this QA
- ✅ No deck, app source, or provider integration files were modified
- ✅ No packages installed, no external calls made, no credits spent
- ✅ Evidence index treated as authoritative source of truth
- ✅ All findings documented with exact file paths and line numbers

---

**QA performed:** 2026-08-21
**QA scope:** Read-only verification of final video package
**Files created:** `docs/stitchcheck-final-media-qa.md` (this document)
**Files modified:** None
