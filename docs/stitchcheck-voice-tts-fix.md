# StitchCheck Voice / TTS Fix

## 1. Current Failure Diagnosis

**Root cause:** TTS was never integrated into the React application. The video
pipeline attempted to use Kokoro TTS for a voiceover track, but Kokoro requires
Python >=3.10, <3.13 and the development system has Python 3.14.6. The video was
produced as caption-only by design.

**Symptoms:**
- No `speechSynthesis`, `SpeechSynthesisUtterance`, `Audio`, or TTS code existed
  in `app/src/`.
- No audio files (`.mp3`, `.wav`, `.ogg`) existed in the project.
- The demo video has no audio track (`Audio: None (caption-only, no voiceover)`).
- The live demo relies on the human presenter for spoken narration.

**Impact:**
- App startup: unaffected.
- Confirmation flow: unaffected.
- Playwright capture: unaffected (already silent and deterministic).
- Final video: unaffected (designed as caption-only).
- Live demo presentation: captions always visible; presenter narrates manually.

## 2. Chosen Implementation

**Approach:** Add optional browser-local narration via the Web Speech API
(`window.speechSynthesis`) with a visible caption bar and graceful fallback.

**Key design decisions:**
- **Off by default.** Narration mode defaults to `'off'`. The user must
  explicitly click "Enable narration" to activate voice.
- **Three modes:** `off` → `captions-only` → `voice`.
- **Deterministic text.** Narration strings are hardcoded from the existing
  presenter script (`NARRATION_SCENES` in `useNarration.ts`).
- **Single utterance.** The hook cancels any in-progress speech before starting
  a new scene. No overlapping utterances.
- **Graceful fallback.** If `speechSynthesis` is unavailable, the hook sets
  `status: 'unsupported'` and the UI shows a captions-only fallback note.
- **Never throws.** All speech API calls are wrapped in try/catch. Errors
  recover to idle state automatically.
- **No external calls.** Zero network requests. No cloud TTS. No provider
  integration.

## 3. Browser / API Limitations

| Limitation | Mitigation |
|---|---|
| `speechSynthesis` not available in all browsers (e.g., some headless environments) | Detected at init; `isSupported` flag drives UI; captions-only fallback |
| Voices may not be loaded immediately (`getVoices()` returns empty array initially) | Best-effort voice selection; falls back to browser default |
| Autoplay / user-gesture restrictions prevent speech without interaction | Narration defaults to `off`; user must click to enable |
| Headless Chromium (Playwright) does not produce audio output | Capture mode is silent by default; `voiceMode: "silent"` in manifest |
| Speech synthesis quality varies by OS/browser | Acceptable for local demo; not a production TTS replacement |

## 4. Manual Demo Instructions

1. Start the dev server: `cd app && npm run dev`
2. Open the app in a **headed** browser (Chrome, Safari, or Edge recommended).
3. The NarrationBar appears below the header showing:
   "Voice disabled for deterministic capture" with an "Enable narration" button.
4. Click **Enable narration** to activate voice mode.
   - The bar turns blue and shows: "Local browser narration".
   - As you navigate through the demo, caption text appears in the bar and
     (if browser supports it) is spoken aloud.
5. Click **Captions only** to show captions without voice.
   - The bar turns green. Caption text is visible but not spoken.
6. Click **Disable** to turn narration off.
7. Click **Stop** during speech to cancel the current utterance.

**Note:** Voice requires a headed browser with user interaction. It will not
work in headless Chromium or without a user gesture.

## 5. Automated Capture Behavior

The Playwright capture script (`scripts/stitchcheck-demo-capture.mjs`) remains
**silent by default**:

- Narration mode is `'off'` on page load.
- No speech synthesis is triggered during automated capture.
- No audio permission prompt is generated.
- No speech promise blocks scene transitions.
- Screenshots remain deterministic.
- The capture manifest records `voiceMode: "silent"`.

If a future `--voice` flag is added, it would:
- Require headed mode (`--headed`).
- Set narration mode to `'voice'` after page load.
- Still not block screenshots on audio completion.

## 6. Captions-Only Fallback

When speech synthesis is unavailable or narration mode is `captions-only`:

- The NarrationBar displays the current scene text as a visible caption.
- The caption is styled with italic text and a green/blue background.
- All demo functionality works normally without voice.
- No test or capture step depends on audio playback.
- The `status: 'unsupported'` state shows a visible fallback note:
  "Speech synthesis unavailable — captions-only fallback active".

## 7. Test Results

| Check | Result |
|---|---|
| TypeScript typecheck (`tsc --noEmit`) | Pass — zero errors |
| Production build (`tsc -b && vite build`) | Pass — 39 modules, 67 ms |
| Cross-provider invariant tests | 40 passed, 0 failed |
| Gemini offline tests | 92 passed, 0 failed |
| Atlas adapter offline tests | 89 passed, 0 failed |
| Atlas duplicate-booking guard | 48 passed, 0 failed |
| Nosana client offline tests | 75 passed, 0 failed |
| Nosana schema validation | All fixtures passed |
| Voice in headed browser | Works (requires user gesture to enable) |
| Automated capture silent | Yes — `voiceMode: "silent"` in manifest |
| No external network request introduced | Verified — zero fetch/network calls in narration code |
| No provider labels changed | Verified — labels limited to "Local browser narration", "Captions only", "Voice disabled" |

## 8. Files Changed

| File | Action | Purpose |
|---|---|---|
| `app/src/components/useNarration.ts` | **Created** | Web Speech API hook with queue, error handling, graceful fallback |
| `app/src/components/NarrationBar.tsx` | **Created** | Visible caption bar with narration mode controls |
| `app/src/App.tsx` | **Modified** | Wired `useNarration` hook and `NarrationBar`; triggers caption on step change |
| `app/src/App.css` | **Modified** | Added `.sc-narration-bar` styles |
| `scripts/stitchcheck-demo-capture.mjs` | **Modified** | Added `voiceMode: "silent"` and `voiceModeNote` to capture manifest |
| `docs/stitchcheck-voice-tts-fix.md` | **Created** | This documentation file |

**Not modified (by design):**
- Atlas files, Nosana files, Gemini/OpenRouter files
- `.env.local`
- Final media assets, video, deck, presenter script
- `app/src/data/labels.ts`, `app/src/data/fixtures.ts`, `app/src/data/types.ts`
- Smoke test files
- Package dependencies (no new packages installed)

## 9. External Provider / TTS Service Declaration

**No external provider or paid TTS service was called.** The implementation uses
only the browser's built-in `window.speechSynthesis` API (Web Speech API). No
network requests are made. No API keys are used. No cloud service is involved.
No package was installed.
