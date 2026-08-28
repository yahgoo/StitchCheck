# StitchCheck

StitchCheck turns a flight screenshot into a confirmed itinerary, explains self-transfer failure risk, and compares safer alternatives before a traveller commits.

## Hackathon Submission

- **Event:** Build with Gemini Hackathon 2026
- **Track:** Most Creative Gemini Hack
- **Demo video:** Local artifact — see [Video Artifacts](#video-artifacts) section below. Not yet uploaded to YouTube.

## Problem

Budget travellers often stitch two separately purchased one-way flights to save money. When the first leg is delayed or cancelled, the second leg is orphaned — no airline is responsible for rebooking, and downstream commitments (hotels, tours, return flights) cascade into unrecoverable losses. StitchCheck makes that hidden failure risk visible **before** the traveller commits.

## Core Flow

1. **Screenshot or itinerary input** — the traveller uploads a booking-page screenshot of two separately purchased flights.
2. **Structured itinerary extraction** — Gemini 3.7 (`ai.interactions.create`) parses the image into structured itinerary fields (origins, destinations, dates, airlines, flight numbers, times, connection duration).
3. **Human correction and confirmation** — the traveller reviews and corrects every extracted field beside the source image. Correction notes track each change.
4. **Dependency-risk explanation** — a Nosana decentralized-compute workload runs a Monte Carlo simulation over historical delay data to estimate connection risk. The browser demo uses a local fallback fixture.
5. **Alternative recovery plans** — Atlas Sandbox Search/Verify returns single-ticket alternatives for the same route. The browser demo uses offline fixtures.
6. **Human-controlled decision boundary** — a side-by-side comparison lets the traveller choose to keep the self-transfer or switch to a safer option. Downstream panels remain locked until the traveller explicitly confirms. No booking, payment, or order is created.

## Technology and Providers

| Component | Technology | Role |
|---|---|---|
| Itinerary extraction | Direct Google Gemini 3.7 (`ai.interactions.create`, `@google/genai`) | Multimodal screenshot-to-structured-data extraction (live validated) |
| Risk analysis | Nosana decentralized compute (one completed live job reconciled offline) | Monte Carlo connection-risk workload; browser demo uses local fallback |
| Alternative routing | Atlas Sandbox Search/Verify (read-only) | Read-only alternative itinerary evidence |
| Sandbox orchestration | Daytona (offline mock in browser demo) | Isolated execution where supported by current evidence |
| Frontend | React + Vite + TypeScript | Local browser walkthrough |
| Development | Alibaba Qoder | AI-assisted development tool |

## Attribution

- **Development:** Developed with Alibaba Qoder
- **Flight Search and Verify:** Atlas provides flight Search and Verify where live evidence exists (Sandbox read-only; production reference prices). No booking, payment, or ticketing was performed.
- **Sandbox orchestration:** Daytona provides isolated execution where supported by current evidence (offline mock in the browser demo).
- **Decentralized compute:** Nosana — one completed live job reconciled offline. Browser demo uses local fallback fixture.
- **Travel-tech context:** WiT Singapore is the travel-tech context, not an endorsement.
- **Extraction:** Direct Google Gemini 3.7 (`ai.interactions.create`) — live extraction validated. Historical temporary OpenRouter path preserved but not the active provider.

## Provider and Evidence Status

The interactive browser walkthrough uses local demo fixture data and makes no external provider calls.

Gemini, Nosana, and Atlas evidence shown in the demo video and documentation was verified separately using dedicated smoke-test scripts.

| Provider | Status | Sandbox vs Production | Fallback/Offline Disclosure |
|---|---|---|---|
| **Gemini 3.7** (`gemini-3.7-flash`, Interactions API) | Live extraction validated via `ai.interactions.create`. Schema-valid, `fallbackUsed: false`. A later re-verification attempt returned a transient error and was not retried, per project safety rules. Evidence: `smoke-tests/gemini/results/results-gemini-3.7-flash-success.json`. | N/A — extraction is a server-side smoke test, not a browser call. | Browser walkthrough uses a local fixture, not the live extraction result. |
| **Nosana** | One live job accepted and completed; result reconciled offline. `riskScore: 0.2895`, `riskBand: medium`, `simulationCount: 800`, `costUsd: 0.044`. Evidence: `smoke-tests/nosana/results/evidence/`. No new submission made during final polish. | N/A — decentralized compute workload, not a sandbox/production distinction. | Browser demo uses a local fallback fixture, not the reconciled live evidence. |
| **Atlas** | Sandbox Search + Verify (ATL-SBX-SV-01) partially succeeded: 20 offers KUL→SIN, verify returned `PRICE_CONFIRMATION_REQUIRED`. Hard stop after Verify — no write call. Two production searches returned reference-price offers (`bookable: false`). Evidence: `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json`. | **Sandbox:** Search + Verify completed (read-only). **Production:** Two searches completed (reference prices only). **Ticketing:** Activation-gated, not completed. | All alternatives data in the demo UI is synthetic local fixture, labelled `Fictional alternatives — local demo fixture` or `Offline fixture — not Atlas Sandbox evidence`. |

## Setup

### Prerequisites

- Node.js >= 20
- npm

### Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd <repo-dir>

# Install dependencies
cd app
npm install

# (Optional) Configure provider keys for live smoke tests
#    cp ../.env.example ../.env.local
#    # Edit .env.local — never commit it

# Start development server (runs entirely offline with demo fixtures)
npm run dev

# Production build
npm run build

# Type-check
npm run typecheck
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in values for live smoke tests. The browser demo runs fully offline without any keys.

```bash
cp .env.example .env.local
# Edit .env.local — never commit it
```

| Variable | Purpose | Required |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key — server-side only, never exposed in browser bundle | No — demo runs offline with demo fixtures when absent |
| `GEMINI_MODEL` | Model identifier (e.g. `gemini-3.7-flash`) | No — defaults to `gemini-3.7-flash` |
| `EXTRACTION_PROVIDER` | `gemini` (direct) or `openrouter` (legacy rollback) | No — defaults to `gemini` |
| `ATLAS_CLIENT_ID` | Atlas API client ID — server-side only | No — demo runs offline when absent |
| `ATLAS_CLIENT_SECRET` | Atlas API client secret — server-side only | No — demo runs offline when absent |
| `DATA_MODE` | `offline` (fixture-only) or `live` (where supported) | No — defaults to `offline` |
| `NOSANA_API_KEY` | Nosana API key — server-side only | No — risk panel uses local fallback when absent |
| `NOSANA_MARKET` | Nosana market address (Solana public key) | No — used only for live workload submission |
| `NOSANA_COST_CEILING_USD` | Maximum USD spend ceiling (safety limit) | No — defaults to `10` |
| `DAYTONA_API_KEY` | Daytona API key for sandbox lifecycle — server-side only | No — offline mock used when absent |
| `DAYTONA_ENABLED` | Allow Daytona sandbox creation | No — defaults to `false` |

Never commit `.env.local` or any file containing real credentials.

## Safety Boundary

> **Request submitted — awaiting verified supplier outcome.**

- No booking-success language is used without verified supplier confirmation.
- No booking, payment, ticketing, reservation, or order is created by this application.
- The browser walkthrough uses demo, non-PII data only.
- Nosana's risk output is a heuristic indication, not a guaranteed probability.
- Atlas evidence is read-only; ticketing remains gated and was never activated.
- No real passenger personal data is processed.
- `GEMINI_API_KEY`, `ATLAS_CLIENT_SECRET`, and all provider keys are server-side only — the browser bundle does not read, reference, or transmit these keys.
- Human confirmation gate — downstream panels remain locked until the user explicitly confirms the itinerary.
- All fixtures are synthetic, fictional, and contain no PII.

## Testing

The offline test suite covers 300+ tests across all providers and cross-cutting invariants:

| Suite | Location | Coverage |
|---|---|---|
| Gemini adapter offline tests | `smoke-tests/gemini/adapter-offline-tests.mjs` | Extraction, schema validation, fallback labels |
| Gemini 3.7 routing regression | `smoke-tests/gemini/gemini-3.7-routing-regression-tests.mjs` | Interactions API routing, model resolution, credential safety |
| Atlas adapter offline tests | `smoke-tests/atlas/adapter-offline-tests.mjs` | Search/Verify contract, schema validation |
| Atlas duplicate-booking guard | `smoke-tests/atlas/duplicate-booking-guard-offline-tests.mjs` | Duplicate booking prevention |
| Nosana client offline tests | `smoke-tests/nosana/nosana-client-offline-tests.mjs` | Client boundary, credential isolation |
| Nosana child-process regression | `smoke-tests/nosana/nosana-child-process-regression-tests.mjs` | Job runner, timeout, idempotency |
| Nosana UI label assertions | `smoke-tests/nosana/nosana-ui-label-assertion-tests.mjs` | Provenance label truthfulness |
| Nosana live-evidence reconciliation | `smoke-tests/nosana/nosana-live-evidence-reconciliation-tests.mjs` | Reconciled artifact validation |
| Nosana timeout safety | `smoke-tests/nosana/nosana-timeout-safety-tests.mjs` | Platform timeout, watchdog, dry-run defaults |
| Nosana cost unit tests | `smoke-tests/nosana/nosana-cost-unit-tests.mjs` | Cost ceiling, credits/cost distinction |
| Provenance label tests | `smoke-tests/provenance-label-offline-tests.mjs` | Cross-provider label invariants |
| Cross-provider invariant tests | `smoke-tests/cross-provider-invariant-tests.mjs` | Placeholder/evidence boundary enforcement |

```bash
# From app/ — runs all offline test suites + typecheck + build
npm run verify:offline

# Individual suites (from repo root)
node smoke-tests/gemini/adapter-offline-tests.mjs
node smoke-tests/gemini/gemini-3.7-routing-regression-tests.mjs
node smoke-tests/atlas/adapter-offline-tests.mjs
node smoke-tests/nosana/nosana-client-offline-tests.mjs
node smoke-tests/nosana/nosana-timeout-safety-tests.mjs
node smoke-tests/cross-provider-invariant-tests.mjs
node smoke-tests/provenance-label-offline-tests.mjs
```

All tests make zero network requests and use no credentials.

### Secret scanning

A lightweight pre-commit secret scanner is available at `scripts/secret-scan.mjs`. It checks staged files for credential-shaped patterns (Google API keys, sk- tokens, Bearer tokens, etc.) and refuses the commit if any match.

```bash
# Scan staged changes (default)
node scripts/secret-scan.mjs

# Scan all tracked files (slower)
node scripts/secret-scan.mjs --all

# Install as a pre-commit hook
cp scripts/secret-scan.mjs .git/hooks/pre-commit
```

No external dependencies required.

## Known Limitations

- **Search and Verify only.** Atlas provides read-only flight Search and Verify. No booking, payment, order creation, or ticket issuance is performed or possible through this application.
- **Atlas Sandbox vs Production status:** Sandbox Search + Verify completed (read-only, `PRICE_CONFIRMATION_REQUIRED` at verify stage). Production searches returned reference-price offers only (`bookable: false`). Ticketing activation is pending human action. No production booking, payment, or ticketing was performed.
- **Gemini 3.7 live path** is implemented and offline-tested; the most recent live attempt was inconclusive due to a transient error. The previously captured successful evidence artifact is preserved in `smoke-tests/gemini/results/`.
- **Nosana live evidence** comes from a previously completed and reconciled job, not a fresh submission. No additional Nosana job was submitted during final polish. Browser demo uses local fallback fixture.
- **Atlas evidence** in the browser demo uses offline fixtures. Risk and alternatives panels display demo fixtures, not live provider results.
- **Daytona** provides isolated execution where supported by current evidence. The browser demo uses a deterministic offline mock (`executionMode: "daytona-offline-mock"`, `isLive: false`).
- **No persistence.** All state resets on browser refresh.
- **No automated browser test runner.** Validation uses offline adapter tests and manual browser walkthrough.

## Video Artifacts

The following demo video artifacts exist locally. They have not been uploaded to YouTube or any external platform.

| Artifact | Path | Details |
|---|---|---|
| Latest render | `output/demo-artifacts/stitchcheck-video/stitchcheck-demo-fixed-v1.mp4` | 120s, H.264 1920×1080, AAC audio |
| Full voiceover proof | `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` | 131s, H.264 1920×1080, AAC 24kHz mono, ~4.0 MB. Voiceover produced locally via Kokoro ONNX v0.4.7 — no external TTS call. |
| Hackathon demo (live v2) | `output/demo-artifacts/stitchcheck-video/hackathon-submission-live-v2/stitchcheck-hackathon-demo-live-v2.mp4` | ~5.0 MB |
| Hackathon demo v2 | `output/demo-artifacts/stitchcheck-video/hackathon-submission/stitchcheck-hackathon-demo-v2.mp4` | ~5.5 MB |

To view: open any `.mp4` file in a media player. All videos were rendered offline — no provider was called during rendering.

## Repository Structure

```
app/                          React/Vite/TypeScript demo application
  src/components/             UI components (9 components + narration hook)
  src/data/                   Fixtures, types, and label constants
core/                         Canonical provenance, safety, and flag modules
app-fixture-contracts/        JSON contracts defining UI data shapes
smoke-tests/
  gemini/                     Gemini adapter, offline tests, fixtures
  atlas/                      Atlas adapter, offline tests, fixtures
  nosana/                     Nosana client boundary, offline tests, fixtures
  cross-provider-invariant-tests.mjs
  provenance-label-offline-tests.mjs
scripts/                      Capture, orchestrator, and preflight scripts
workers/                      Daytona worker modules
docs/                         Documentation and audit reports
```

## License

Private — hackathon submission.
