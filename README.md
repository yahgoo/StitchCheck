# StitchCheck

StitchCheck helps budget travellers understand the hidden risk of stitching two separately purchased flight tickets with a tight connection — before they pay.

**Target user:** Budget travellers booking self-transfer itineraries on separate tickets who need to understand connection risk before committing.

## Problem

When two flights are booked as separate tickets, each ticket is an independent contract. If the first flight is delayed and the traveller misses the second, the second airline generally has no obligation to rebook, protect, or refund. The savings are visible at checkout; the exposure is not.

StitchCheck extracts itinerary details from a screenshot, reviews them with the traveller, assesses connection risk, and surfaces safer alternatives — all before any booking commitment.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  React / Vite / TypeScript browser demo                 │
│                                                         │
│  Safety Notice → Upload → Review → Confirm → Compare   │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐      │
│  │ Extraction│  │   Risk   │  │   Alternatives    │      │
│  │ (Gemini) │  │ (Nosana) │  │   (Atlas)         │      │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘      │
│       │              │                  │                │
│  Synthetic      Local fixture      Local fixture        │
│  placeholder    (offline-safe)     (offline-safe)       │
└─────────────────────────────────────────────────────────┘
```

- **Frontend:** React 19, Vite 8, TypeScript 7 — single-page app, all state in-memory.
- **Provider adapters:** Isolated Node.js modules in `smoke-tests/` — each provider has its own harness, fixtures, and offline test suite.
- **Fixture contracts:** JSON contracts in `app-fixture-contracts/` define the expected UI data shapes.
- **No backend server:** The demo runs entirely in the browser. Provider adapters are server-side only and are not called by the browser bundle.

## User Demo Flow

1. **Acknowledge the safety notice** — confirms this is a synthetic demo with no live calls.
2. **Select synthetic itinerary screenshot fixture(s)** — choose from pre-built fictional images (GEM-01 through GEM-05).
3. **Review and edit extracted itinerary fields** — fields are displayed in editable inputs beside the source screenshots.
4. **Confirm the itinerary** — the user must explicitly click *Confirm itinerary* before downstream panels activate.
5. **View risk and alternatives** — the risk panel shows a heuristic placeholder; the alternatives panel shows sandbox-placeholder results.
6. **Compare options and choose Keep or Switch** — a side-by-side comparison table.
7. **Finish** — the final screen states that no booking, payment, or write action was created.

## Provider Roles

| Provider | Role | Status |
|---|---|---|
| **Google Gemini** | Structured itinerary extraction from synthetic screenshots. | Direct Gemini 3.6: live extraction verified previously. Gemini 3.7: Interactions API path implemented and offline-tested; live verification pending. |
| **Nosana** | Decentralized GPU workload for connection-risk estimation. | Nosana: offline/dry-run validated; live execution not verified. All risk data in the demo is a local synthetic placeholder. |
| **Atlas** | Read-only flight search for safer alternatives. | Sandbox search + verify completed (20 offers, KUL→SIN). Production search completed (8 offers, SIN→BKK). All offers reference-price only. Ticketing activation-gated — no booking created. |

## Setup Instructions

### Prerequisites

- Node.js >= 20
- npm

### Quick Start

All commands run from the `app/` directory. The demo runs entirely offline — no external service calls occur.

```bash
# Clone the repository
git clone <repo-url>
cd <repo-dir>

# Install dependencies
cd app
npm install

# Start development server
npm run dev

# Run type-check
npm run typecheck

# Run production build
npm run build
```

### Smoke Tests (offline)

Smoke tests run from their respective directories and make zero network requests.

```bash
# From app/ — runs all offline test suites + typecheck + build
npm run verify:offline

# Individual suites
cd smoke-tests/gemini && node adapter-offline-tests.mjs
cd smoke-tests/atlas && node adapter-offline-tests.mjs
cd smoke-tests/nosana && node nosana-client-offline-tests.mjs
node smoke-tests/cross-provider-invariant-tests.mjs
```

## Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for server-side extraction. **Server-side only — never expose in browser bundle.** | No — demo runs offline with synthetic fixtures when absent. |
| `GEMINI_MODEL` | Model identifier (e.g. `gemini-3.6-flash`, `gemini-3.7-flash`). | No — defaults to `gemini-3.6-flash` in the adapter. |
| `EXTRACTION_PROVIDER` | `gemini` (direct) or `openrouter` (legacy rollback). | No — defaults to `gemini`. |
| `NOSANA_API_KEY` | Nosana API key for decentralized GPU workload submission. **Server-side only.** | No — risk panel uses local synthetic placeholder when absent. |
| `NOSANA_MARKET` | Nosana market address (Solana public key). | No — used only for live workload submission. |
| `NOSANA_COST_CEILING_USD` | Maximum USD spend ceiling for Nosana workloads (safety limit). | No — defaults to `10`. |

Copy `.env.example` to `.env.local` and fill in values. Never commit `.env.local`.

### Fallback Behaviour

When `GEMINI_API_KEY` is absent or the provider is not configured:
- The extraction panel displays a synthetic local placeholder labelled `Synthetic local placeholder — not direct Gemini evidence`.
- The risk panel displays a local fixture labelled `Synthetic local placeholder — not Nosana evidence`.
- The alternatives panel displays a local fixture labelled `Synthetic local placeholder — not Atlas Sandbox evidence`.
- The full demo flow remains functional end-to-end with these placeholders.

## Evidence Labels

All data in the browser demo is clearly labelled:

- **Synthetic local placeholder** — pre-built fixture data, not from a live provider.
- **Historical OpenRouter temporary path** — GEM-01 was executed via OpenRouter as a historical smoke-test; not evidence of direct Google Gemini execution.
- **Atlas Sandbox evidence** — search + verify completed against the Atlas Sandbox environment.
- **Local fallback** — Nosana was not executed; the risk result is a local heuristic simulation.

No local placeholder is ever labelled as live provider evidence. This invariant is enforced by the cross-provider offline test suite.

## Safety

- **Synthetic, non-PII fixtures only.** All airport codes, flight numbers, dates, and prices in the demo are invented.
- **No credential values are included.** API keys are referenced only as blank variable names in `.env.example`.
- **No booking, payment, or write action exists.** No UI handler enables any of these actions.
- **`GEMINI_API_KEY` is server-side only.** The browser bundle does not read, reference, or transmit this key.
- **Human confirmation gate.** Downstream panels remain locked until the user explicitly confirms the itinerary.
- **Atlas is read-only.** No write scope is requested or permitted.
- **Nosana is offline-only.** The client boundary has zero network code, zero credential access, and zero mutation operations.

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
scripts/                      Playwright capture and preflight scripts
docs/                         Documentation and audit reports
```

## Known Limitations

- **Direct Gemini is not yet executed live.** The adapter is implemented and offline-tested. A live direct-Gemini result is not included in this evidence package.
- **OpenRouter was a historical temporary test path.** GEM-01 was executed via OpenRouter; this is not evidence of direct Google Gemini execution.
- **Nosana has not been executed live.** Nosana workload validated offline; local fallback used in recording.
- **Atlas ticketing is activation-gated.** Search and verify succeeded; booking/ticketing is blocked.
- **All browser demo data is synthetic.** Risk and alternatives are local placeholders, not live service results.
- **State resets on browser refresh.** All state is in-memory; no persistence layer exists.
- **No automated unit-test runner.** Validation relies on offline adapter tests and browser walkthrough.

## License

Private — hackathon submission.
