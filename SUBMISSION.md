# StitchCheck — Hackathon Submission

## Project Title

**StitchCheck** — Self-Transfer Flight Risk Validator

## Description

StitchCheck helps budget travellers understand the hidden risk of stitching two separately purchased flight tickets with a tight connection. It extracts itinerary details from a screenshot, presents them for human review, assesses connection risk, and surfaces safer alternatives — before any booking commitment.

## Key Features

- **Screenshot-to-structured-data extraction** — synthetic itinerary images are parsed into editable flight fields (origin, destination, dates, airlines, flight numbers, times, connection duration).
- **Human confirmation gate** — downstream panels remain locked until the traveller explicitly reviews and confirms the itinerary. Correction notes track every field change.
- **Connection risk assessment** — heuristic risk band and score derived from historical delay data, with Monte Carlo simulation and clear disclaimers.
- **Safer alternatives display** — side-by-side comparison of the current self-transfer plan against single-ticket alternatives.
- **Decision support** — Keep or Switch choice with explicit statement that no booking, payment, or order is created.
- **Browser-local narration** — optional Web Speech API captions/voiceover for accessibility (purely local, no external call).
- **Cross-provider safety invariants** — automated tests ensure no placeholder is ever labelled as live evidence.

## Technology & Provider Attribution

| Component | Technology | Provider |
|---|---|---|
| Frontend | React 19, Vite 8, TypeScript 7 | — |
| Extraction | Structured JSON from synthetic screenshots | Direct Google Gemini (3.6 live-verified; 3.7 Interactions API path implemented and offline-tested; live 3.7 verification pending) |
| Risk estimation | Heuristic Monte Carlo simulation | Nosana (offline/dry-run validated; live execution not verified) |
| Alternatives | Read-only flight search | Atlas Sandbox (search + verify completed; ticketing activation-gated) |
| Narration | Web Speech API | Browser-local only |
| Testing | Node.js offline test harnesses | Zero network requests, zero credentials |

## Demo Video

- **Primary:** `output/demo-artifacts/stitchcheck-video/hackathon-submission/stitchcheck-hackathon-demo-v2.mp4`
- **Duration:** 2:41 (161 seconds)
- **Resolution:** 1920x1080, H.264, AAC audio
- **Fallback videos:**
  - `stitchcheck-hackathon-demo.mp4` (original v1)
  - `stitchcheck-full-voiceover-proof.mp4` (full voiceover proof)
  - `stitchcheck-demo.mp4` (earlier capture)

## Setup Instructions

```bash
# Clone
git clone <repo-url>
cd <repo-dir>

# Install (from app/)
cd app
npm install

# Development server
npm run dev

# Production build
npm run build

# Type-check
npm run typecheck

# Full offline verification (all test suites + typecheck + build)
npm run verify:offline
```

## Known Limitations

1. **Direct Gemini 3.7 not yet executed live.** The Gemini 3.7 Interactions API path is implemented and offline-tested. A live direct Gemini 3.7 result is not included in this evidence package. Gemini 3.6 was live-verified previously. GEM-01 was executed via a historical OpenRouter temporary path.
2. **Nosana not executed live.** Nosana: offline/dry-run validated; live execution not verified. Local fallback used in recording.
3. **Atlas ticketing activation-gated.** Search and verify completed successfully. Ticketing/booking is blocked pending human activation.
4. **All browser demo data is synthetic.** Risk and alternatives panels display local fixtures, not live provider results.
5. **No persistence.** State resets on browser refresh.
6. **No automated browser test runner.** Validation uses offline adapter tests and manual browser walkthrough.

## Live vs Fallback Disclosure

| Capability | Status | Displayed Label |
|---|---|---|
| Gemini extraction (direct 3.6) | Live extraction verified previously | `Direct Gemini validation` |
| Gemini extraction (direct 3.7) | Interactions API path implemented, offline-tested, not executed live | `Direct Gemini validation` (pending live verification) |
| Gemini extraction (OpenRouter path) | Historical temporary smoke-test only | `Historical/temporary OpenRouter smoke-test result; not evidence of direct Google Gemini execution.` |
| Nosana risk workload | Offline/dry-run validated; live unverified | `Nosana workload validated offline; local fallback used.` |
| Atlas Sandbox search + verify | Completed (20 offers, KUL→SIN) | `Atlas Sandbox evidence — search + verify completed` |
| Atlas production search | Completed (8 offers, SIN→BKK) | Reference-price only, `bookable: false` |
| Atlas ticketing | Activation-gated, not completed | N/A — no ticketing attempted |
| Browser demo UI | Fully functional offline | `Synthetic Demo — No Live Services` |

## Security Confirmations

- [x] **No API key is included in this repository.** `.env.example` contains placeholders only. `.env.local` is gitignored.
- [x] **`GEMINI_API_KEY` is server-side only.** The browser bundle does not read, reference, or transmit this key.
- [x] **No bearer tokens, private keys, wallet secrets, or credentials are committed.**
- [x] **No personal absolute file paths in committed source files.**
- [x] **External writes require explicit user confirmation.** No UI handler, route, or button creates a booking, payment, order, or any write action. Atlas is read-only. Nosana has zero mutation operations.
- [x] **No live Nosana job was submitted.** No spend occurred.
- [x] **No Atlas ticketing was called.** Ticketing is activation-gated.

## Final Pre-Submission Checklist

### Repository Review

- [x] README.md with setup, architecture, provider roles, and safety notes
- [x] .env.example with placeholder-only variables (no real keys)
- [x] .gitignore excludes .env, .env.*, node_modules, dist, output, secrets
- [x] .gitignore does NOT exclude .env.example
- [x] SUBMISSION.md with project description, features, and disclosures
- [x] docs/evidence-status.md with provider evidence table
- [x] docs/hackathon-demo-script.md with timed narration script
- [x] No secrets in source code, build output, or tracked files
- [x] No personal absolute paths in committed files
- [x] All provider evidence labels are accurate
- [x] No claim that Atlas ticketing or Nosana succeeded
- [x] Fallback behaviour works when API keys are absent
- [x] Cross-provider invariant tests enforce placeholder/evidence boundary

### Verification Results

- [x] Production build passes (`npm run build`)
- [x] Type-check passes (`npm run typecheck`)
- [x] Offline test suites pass (`npm run verify:offline`)
- [x] Nosana child-process regression tests pass (29/29)
- [x] No push to GitHub or external upload performed
