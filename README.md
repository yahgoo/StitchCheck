# StitchCheck

StitchCheck turns a flight screenshot into a confirmed itinerary, explains self-transfer risk, and compares safer alternatives before a traveller commits.

## Hackathon Submission

- **Event:** Build with Gemini Hackathon 2026
- **Track:** Most Creative Gemini Hack
- **Status:** Submitted
- **Demo video:** <YOUR_YOUTUBE_URL_HERE>

## What It Does

1. **Screenshot upload** — the traveller uploads a booking-page screenshot of two separately purchased flights.
2. **Gemini multimodal extraction** — Gemini 3.7 (`ai.interactions.create`) parses the image into structured itinerary fields (origins, destinations, dates, airlines, flight numbers, times, connection duration).
3. **Editable fields** — the traveller reviews and corrects every extracted field beside the source image.
4. **User correction** — correction notes track each change the traveller makes.
5. **Confirmation gate** — downstream panels stay locked until the traveller explicitly confirms the itinerary.
6. **Risk analysis** — a Nosana decentralized-compute workload runs a Monte Carlo simulation over historical delay data to estimate connection risk.
7. **Alternatives** — Atlas Sandbox Search/Verify returns single-ticket alternatives for the same route.
8. **Keep / Switch decision** — a side-by-side comparison lets the traveller choose to keep the self-transfer or switch to a safer option. No booking, payment, or order is created.

## Technology and Providers

| Component | Technology | Role |
|---|---|---|
| Itinerary extraction | Gemini 3.7 (`ai.interactions.create`, `@google/genai`) | Multimodal screenshot-to-structured-data extraction |
| Risk analysis | Nosana decentralized compute | Validated Monte Carlo connection-risk workload |
| Alternative routing | Atlas Sandbox Search/Verify | Read-only alternative itinerary evidence |
| Frontend | React + Vite + TypeScript | Local browser walkthrough |

## Provenance and Evidence Status

The interactive browser walkthrough uses fictional local fixture data and makes no external provider calls.

Gemini, Nosana, and Atlas evidence shown in the demo video and documentation was verified separately using dedicated smoke-test scripts.

**Gemini 3.7** (`gemini-3.7-flash`, Interactions API): implemented and offline-validated; a later live verification attempt during final polish returned a transient error and was not retried, per project safety rules. The previously captured successful live evidence artifact remains available in `smoke-tests/gemini/results/`.

**Nosana**: a completed live job was reconciled offline. Verified values: riskScore 0.2895, riskBand medium, simulationCount 800, costUsd 0.044, evidenceSource `"nosana-evidence"`, fallbackUsed false. This is a heuristic indication, not a guaranteed probability.

**Atlas**: Sandbox Search and Verify evidence is read-only. No booking, payment, or ticketing was performed.

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

# Start development server (runs entirely offline with fictional fixtures)
npm run dev

# Production build
npm run build

# Type-check
npm run typecheck
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in values for live smoke tests. The browser demo runs fully offline without any keys.

| Variable | Purpose | Required |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key — server-side only, never exposed in browser bundle | No — demo runs offline with fictional fixtures when absent |
| `GEMINI_MODEL` | Model identifier (e.g. `gemini-3.7-flash`) | No — defaults to `gemini-3.7-flash` |
| `EXTRACTION_PROVIDER` | `gemini` (direct) or `openrouter` (legacy rollback) | No — defaults to `gemini` |
| `NOSANA_API_KEY` | Nosana API key — server-side only | No — risk panel uses local fallback when absent |
| `NOSANA_MARKET` | Nosana market address (Solana public key) | No — used only for live workload submission |
| `NOSANA_COST_CEILING_USD` | Maximum USD spend ceiling (safety limit) | No — defaults to `10` |

Never commit `.env.local` or any file containing real credentials.

## Safety and Limitations

- No booking, payment, ticketing, reservation, or order is created by this application.
- The browser walkthrough uses fictional, non-PII data only.
- Nosana's risk output is a heuristic indication, not a guaranteed probability.
- Atlas evidence is read-only; ticketing remains gated and was never activated.
- No real passenger personal data is processed.
- `GEMINI_API_KEY` is server-side only — the browser bundle does not read, reference, or transmit this key.
- Human confirmation gate — downstream panels remain locked until the user explicitly confirms the itinerary.

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

- **Gemini 3.7 live path** is implemented and offline-tested; the most recent live attempt was inconclusive due to a transient error. The previously captured successful evidence artifact is preserved in `smoke-tests/gemini/results/`.
- **Nosana live evidence** comes from a previously completed and reconciled job, not a fresh submission. No additional Nosana job was submitted during final polish.
- **Atlas evidence** is Sandbox/read-only only. No production booking, payment, or ticketing was performed.
- **Browser demo uses offline fixtures.** The risk and alternatives panels display local fixtures, not live provider results.
- **No persistence.** All state resets on browser refresh.

## Repository Structure

```
app/                          React/Vite/TypeScript demo application
  src/components/             UI components (9 components + narration hook)
  src/data/                   Fixtures, types, and label constants
app-fixture-contracts/        JSON contracts defining UI data shapes
smoke-tests/
  gemini/                     Gemini adapter, offline tests, fixtures
  atlas/                      Atlas adapter, offline tests, fixtures
  nosana/                     Nosana client boundary, offline tests, fixtures
  cross-provider-invariant-tests.mjs
  provenance-label-offline-tests.mjs
scripts/                      Capture and preflight scripts
docs/                         Documentation and audit reports
```

## License

Private — hackathon submission.
