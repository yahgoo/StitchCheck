<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# what are outstanding to code after 22:00

After 22:00, the remaining work should be **integration and submission hardening**, not broad feature development. Your local UI, voiceover assets, capture workflow, tests, and Atlas Sandbox Search → Verify path are largely complete.

## Priority 1: Render and verify video

- Render the new Kokoro voiceover video to a **new filename**.
- Render the short caption/voice synchronization proof video.
- Check both with `ffprobe` for:
    - H.264 video;
    - AAC audio;
    - non-zero audio duration;
    - correct total duration.
- Listen to the first and last scenes manually.
- Confirm captions start and end against measured WAV durations.
- Keep the existing caption-only video unchanged until the new render passes.


## Priority 2: Finish evidence reconciliation

Update only documentation that is now stale:

- Atlas Sandbox Search → Verify result: 20 offers and `PRICE_CONFIRMATION_REQUIRED`.
- Environment restored to Production.
- No Atlas write occurred.
- Nosana corrected offline but not executed.
- Direct Gemini not executed.
- OpenRouter remains a temporary path.
- Production Atlas results remain reference prices only.

Then check the deck and video narration for stale claims such as:

- “zero external calls”;
- “Atlas unauthenticated”;
- “no provider executed.”

Do not leave those claims in the final submission assets.

## Priority 3: Decide whether to run provider calls

### Atlas

No further Atlas coding is needed tonight unless the Sandbox evidence needs to be wired into the UI. Do not pursue ticketing. It is still blocked by account activation.

### Nosana

Remaining code work:

- Install and verify `@nosana/kit`.
- Confirm the package version.
- Confirm the corrected SDK initialization.
- Verify the market address.
- Run the official validator.
- Run one bounded non-PII workload only after reviewing expected cost and approving spend.
- Capture job ID, status, latency, sanitized result, and credit usage.

If the SDK or market cannot be verified safely, leave Nosana marked as:

> “Corrected and locally validated; no live workload executed.”

### Direct Gemini

Remaining code work:

- Install `@google/genai`.
- Confirm the approved model identifier.
- Add the execution entry point.
- Configure structured output and safety settings.
- Run one GEM-01 extraction call.
- Save sanitized evidence and validate the output schema.

If the model or SDK is not approved, do not force it tonight. Keep the OpenRouter disclosure.

## Priority 4: Final UI QA

- Verify the Kokoro work does not alter the browser app’s silent capture mode.
- Keep `voiceMode: "silent"` for Playwright.
- Check that all six capture scenes still pass.
- Ensure no button implies booking, payment, ticketing, or retry functionality.
- Ensure all labels are still exact:
    - `OpenRouter temporary path — not direct Gemini validation`
    - `Synthetic local placeholder — not Nosana evidence`
    - `Synthetic local placeholder — not Atlas Sandbox evidence`
    - `Atlas production search — reference prices only`
    - `Offline VCC/318 guard — not live booking proof`


## Priority 5: Submission packaging

- Update the evidence index with final paths.
- Verify the final three-minute video opens and plays.
- Verify the slide deck export.
- Confirm the contact sheet and screenshots are present.
- Confirm the submission manifest has no stale claims.
- Complete the human Go/No-Go checklist.
- Prepare a fallback submission package using the existing caption-only video.


## Suggested schedule

| Time | Work |
| :-- | :-- |
| 22:00–22:45 | Render voiceover and sync-proof videos |
| 22:45–23:15 | Audio/video/caption validation |
| 23:15–00:00 | Evidence and claim reconciliation |
| 00:00–00:45 | Optional direct Gemini or Nosana setup, not both |
| 00:45–01:15 | Capture rerun and final UI QA |
| 01:15–01:45 | Package submission assets and fallback |
| After 01:45 | Stop coding; review and rehearse |

## What not to code tonight

- Atlas ticketing.
- Payment or booking flows.
- Cancellation/refund.
- New product features.
- Multi-user persistence.
- Cloud TTS.
- Large Nosana Monte Carlo expansion.
- Unverified provider adapters.
- Deck redesign.

The best post-22:00 outcome is a **finished, claim-safe video package**, not maximum integration. If only one provider task can be attempted, choose direct Gemini if its SDK/model prerequisites are confirmed; otherwise preserve the strong local demo and use the honest evidence boundaries.

