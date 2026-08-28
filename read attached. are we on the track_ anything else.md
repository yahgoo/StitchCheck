<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# read attached. are we on the track? anything else to improve based on the judging criteria?

You are **partly on track**, but the attached participant guide changes the priority substantially: the judges care less about a large integration matrix and more about a **clear, memorable working core loop with Gemini visibly essential**. Your strongest fit is **Most Creative Gemini Hack**, not Best Use of Gemma or Best Elderly Hack.[^1]

## Track fit

| Requirement | Current position | Verdict |
| :-- | :-- | :-- |
| Public GitHub repository | Still needs final cleanup/push | Pending |
| Video ≤3:00 | Current video is 2:46 | On track, but needs subtitle/audio fixes |
| Gemini/Gemma essential | Direct Gemini adapter exists, but live proof and visible Gemini moment need confirmation | Main risk |
| Clear problem | Self-transfer failure cascade is compelling | Strong |
| Working core loop | Extraction → correction → risk → alternatives → decision | Strong if shown early |
| Memorable demo | Risk explanation and correction are good, but current presentation is static | Needs improvement |
| Technical merit | Strong testing and safety architecture | Strong |
| Polish | Cropped subtitles and inconsistent volume | Must fix |
| Wow factor | Potentially strong, but needs one unmistakable Gemini moment | Must sharpen |

The guide says the demo should show the main experience first, make Gemini essential, and create one moment judges remember. It also says judges assess technical merit, polish, execution, and wow factor.[^1]

## Best track choice

Select **Most Creative Gemini Hack**.

StitchCheck fits because Gemini can accept a travel screenshot, extract structured itinerary data, identify the failure cascade, and produce an editable, explainable result. The guide specifically encourages multimodal input, visible model behavior, quick interaction, and outputs that change the experience rather than merely generating copy.[^1]

Do **not** select Best Use of Gemma unless you actually use Gemma in a meaningful, non-interchangeable way. Your current architecture is based on direct Gemini, not Gemma. Do not select Best Elderly Hack unless you redesign the product around senior usability and caregiving needs.

You may enter up to two tracks, but adding a weak second track could dilute the story.[^1]

## Biggest risk: Gemini proof

Your current implementation is technically prepared for direct Gemini, but the submission must make Gemini visibly essential.

The video should show:

1. A real or clearly labelled test screenshot entering the app.
2. Gemini extracting fields into editable itinerary cards.
3. A correction or uncertainty being surfaced.
4. The user confirming the corrected itinerary.
5. Risk reasoning changing based on the confirmed data.

Avoid narration that says:

> “OpenRouter temporary path”
> “not direct Gemini validation”

That wording directly conflicts with your new architecture and makes the required technology appear incidental.

Use one of these accurate statements:

- If live Gemini succeeds:
**“Gemini Flash receives the itinerary screenshot and turns it into editable structured flight data.”**
- If live Gemini is not verified:
**“The direct Gemini path is implemented and offline-tested; this recorded run uses the validated fallback.”**

Do not say “live Gemini” without a real successful evidence artifact.

## Video improvements

The guide explicitly says to show the working core loop early and keep the model’s role easy to understand.[^1]

Your revised video should follow this order:

### 0:00–0:15 — Problem

Show the two-ticket/self-transfer risk immediately.

Say:

> “A cheap self-transfer can become an expensive failure cascade when the first delay causes the second ticket to be missed.”

### 0:15–0:55 — Gemini moment

Show the screenshot entering the system and the extracted fields appearing.

Zoom into:

- origin and destination;
- flight number;
- departure and arrival times;
- editable extraction fields.

This is your most important segment.

### 0:55–1:20 — Human correction

Show the incorrect flight number, edit it, and zoom into “Corrections recorded.”

Say:

> “The model does not silently commit its interpretation. The traveller can correct it, and the correction becomes part of the confirmed itinerary.”

### 1:20–1:55 — Risk explanation

Zoom into Connection Risk.

Show:

- connection duration;
- delay assumptions;
- risk band;
- explanation of the failure cascade.

Make clear this is a heuristic, not a guaranteed probability.

### 1:55–2:25 — Atlas alternatives

Show the safer-alternatives result and its evidence label.

Say:

> “Atlas Sandbox Search and Verify returns alternatives for comparison. Booking and payment are not executed.”

### 2:25–2:45 — Decision and safety

Show Keep/Switch and the human boundary.

Say:

> “StitchCheck recommends; the traveller decides. External booking actions remain behind explicit confirmation.”

### 2:45–2:55 — Close

State:

- Gemini is central to multimodal extraction;
- Atlas provides sandbox travel evidence;
- fallback labels are honest;
- no booking or payment occurred.

Fix the cropped subtitles, normalize voiceover volume, and add zoom shots before final export. A polished 2:46 video is better than adding another unreliable live integration.

## What to stop pursuing

### Do not chase live Nosana today

The guide does not require a successful live Nosana job specifically. It requires a memorable working core loop and meaningful Gemini usage.[^1]

You already have:

- 200/200 offline assertions;
- child-process regression coverage;
- dry-run validation;
- accurate fallback labels;
- cost ceiling and timeout handling.

Present Nosana as:

> “The risk workload is packaged and validated for Nosana; this demo uses a clearly labelled local fallback because live execution was not verified.”

Do not show Nosana as live evidence.

### Do not add Gemma

Adding Gemma now would create track ambiguity, require new testing, and weaken the central story. Best Use of Gemma requires openness, deployability, privacy, efficiency, or adaptability to be essential—not merely a model swap.[^1]

### Do not add elderly features

The Elderly track has separate criteria around empathy, high contrast, voice-first interaction, pauses, confirmation, and safety. Your current product is not designed around seniors or caregivers, so it is not a credible second track without a substantial redesign.[^1]

## Repository improvements

Before submission, ensure the public repository contains:

- a concise README;
- exact setup commands;
- `.env.example` with placeholders only;
- `.gitignore`;
- provider architecture;
- evidence-status table;
- test commands and results;
- video filename;
- known limitations;
- explicit no-booking/no-payment disclosure;
- no API keys, `.env.local`, private paths, or local-only credentials.

The guide requires a public GitHub repository and the project name, one-line description, and selected track(s).[^1]

Use a strong one-line description:

> **StitchCheck turns a flight screenshot into a confirmed itinerary, explains self-transfer failure risk, and compares safer alternatives before a traveller commits.**

## Final priority order

1. Fix subtitle position and voiceover loudness.
2. Add zooms that make the Gemini extraction and correction moment unmistakable.
3. Remove every stale OpenRouter reference.
4. Confirm the video is ≤3:00.
5. Complete README, evidence disclosures, and secret scan.
6. Push the public repository.
7. Submit under **Most Creative Gemini Hack**.
8. Keep Nosana as a validated offline/fallback capability, not a live dependency.

**Bottom line:** the concept and engineering are strong, but your submission currently risks losing points because the Gemini moment is not sufficiently visible and the video polish is incomplete. Focus the remaining time on one memorable multimodal Gemini interaction, a clean core loop, and a reliable submission package.

<div align="center">⁂</div>

[^1]: Build-with-Gemini-Hackathon-2026-Participant-Guide.pdf

