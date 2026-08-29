# StitchCheck — Hackathon Submission

## Project Title

**StitchCheck** — Self-Transfer Flight Risk Validator

## Description

StitchCheck helps budget travellers understand the hidden risk of stitching two separately purchased flight tickets with a tight connection. It extracts itinerary details from a screenshot, presents them for human review, assesses connection risk, and surfaces safer alternatives — before any booking commitment.

## Key Features

- **Screenshot-to-structured-data extraction** — fictional test itinerary images are parsed into editable flight fields (origin, destination, dates, airlines, flight numbers, times, connection duration). MiniMax M3 (via OpenRouter) live extraction validated.
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
| Extraction | Structured JSON from fictional test itinerary images | MiniMax M3 via OpenRouter (`minimax/minimax-m3:free`; live extraction validated, schema-validated, `fallbackUsed: false`) |
| Risk estimation | Heuristic Monte Carlo simulation | Nosana (live job accepted and completed; result recovered from `opStates.logs.log`; `costUsd: 0.044`; risk output schema-valid; browser demo uses local fallback fixture) |
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

1. **MiniMax M3 (via OpenRouter) live extraction validated.** Evidence: `demo-evidence/2026-08-29-submission-final/00-report.txt`. Extraction succeeded, schema-validated, `fallbackUsed: false`, and the `Extracted by MiniMax M3` provenance tag is derived from real extraction state.
2. **Nosana live job completed.** Job `BNZTHNoARu98EdaqPU5WiCaFWZAyU1e9NYCZJj2h1afY` accepted and completed; result recovered from `opStates.logs.log`; `costUsd: 0.044`; risk output schema-valid. Browser demo still uses local fallback fixture.
3. **Atlas ticketing activation-gated.** Search and verify completed successfully. Ticketing/booking is blocked pending human activation.
4. **Browser demo risk and alternatives panels use offline fixtures.** Risk and alternatives panels display local fixtures, not live provider results.
5. **No persistence.** State resets on browser refresh.
6. **No automated browser test runner.** Validation uses offline adapter tests and manual browser walkthrough.

## Live vs Fallback Disclosure

| Capability | Status | Displayed Label |
|---|---|---|
| Extraction (MiniMax M3 via OpenRouter) | Live extraction validated, schema-validated, no fallback | `Extracted by MiniMax M3` |
| Nosana risk workload | Live job completed; result validated | `Nosana evidence — remote job succeeded` (when showing reconciled live evidence); `Local fallback — not Nosana evidence` (when showing browser local fixture) |
| Atlas Sandbox search + verify | Completed (20 offers, KUL→SIN) | `Atlas Sandbox — live Search/Verify` (when showing sandbox evidence); `Offline fixture — not Atlas Sandbox evidence` (when showing local fixture) |
| Atlas production search | Completed (8 offers, SIN→BKK) | Reference-price only, `bookable: false` |
| Atlas ticketing | Activation-gated, not completed | N/A — no ticketing attempted |
| Browser demo UI | Fully functional offline | `Fictional Demo — Live Providers Where Labelled` |

## Security Confirmations

- [x] **No API key is included in this repository.** `.env.example` contains placeholders only. `.env.local` is gitignored.
- [x] **`OPENROUTER_API_KEY` is server-side only.** The browser bundle does not read, reference, or transmit this key.
- [x] **No bearer tokens, private keys, wallet secrets, or credentials are committed.**
- [x] **No personal absolute file paths in committed source files.**
- [x] **External writes require explicit user confirmation.** No UI handler, route, or button creates a booking, payment, order, or any write action. Atlas is read-only. Nosana has zero mutation operations.
- [x] **No live Nosana job was resubmitted.** One job was previously submitted and completed. Evidence reconciled offline. No additional spend occurred.
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
- [x] No claim that Atlas ticketing succeeded
- [x] Nosana live job completed; reconciled evidence preserved; browser uses local fallback
- [x] Fallback behaviour works when API keys are absent
- [x] Cross-provider invariant tests enforce placeholder/evidence boundary

### Verification Results

- [x] Production build passes (`npm run build`)
- [x] Type-check passes (`npm run typecheck`)
- [x] Offline test suites pass (`npm run verify:offline`)
- [x] Nosana child-process regression tests pass (29/29)
- [x] No push to GitHub or external upload performed
