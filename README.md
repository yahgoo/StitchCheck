# StitchCheck — Alibaba Cloud x Atlas Agentic AI Hackathon

StitchCheck turns a flight screenshot into a confirmed itinerary, explains self-transfer failure risk, and compares safer alternatives before a traveller commits. Built with **MiniMax M3 (via Nosana)**, **Nosana** (risk computation), **Atlas Sandbox** (flight search/verification), and **Alibaba Cloud** (infrastructure).

## Hackathon Submission

- **Event:** Alibaba Cloud x Atlas Agentic AI Hackathon — Daytona HackSprint, Singapore
- **Project status:** Functional prototype — live, verified integrations across four sponsor stacks (Daytona, Nosana, Atlas Sandbox, MiniMax M3 via Nosana)
- **Demo video:** Local artifact — see [Video Artifacts](#video-artifacts) section below. Not yet uploaded to an external platform.

## Problem

Price-conscious frequent budget travellers face self-transfer failure cascades: when the first flight is delayed, the second ticket is missed, and the traveller is stranded with no recourse.

Budget travellers stitch two separately purchased one-way flights to save money. A self-transfer connection carries **no contractual protection**: if the first leg is delayed or cancelled, the second leg is orphaned, no airline is responsible for rebooking, and downstream commitments cascade into unrecoverable losses. The traveller bears **100% of the misconnection risk**, and **no one discloses the probability** — it is an unpriced bet.

StitchCheck quantifies that hidden risk — a Monte Carlo connection-risk score computed in an isolated sandbox — and proves a safer alternative exists by verifying real single-ticket fares for the same route. The traveller decides with a number instead of a guess.

## Solution

StitchCheck extracts structured itinerary data from a flight screenshot using **MiniMax M3 (via Nosana)**, identifies the self-transfer failure cascade, produces an editable confirmed itinerary, and compares safer alternatives via Atlas Sandbox before the traveller commits.

## How it works

1. **Screenshot extraction** — the traveller uploads a booking-page screenshot of two separately purchased flights. **MiniMax M3 (via Nosana)** parses the image into a structured, editable itinerary (origins, destinations, dates, airlines, flight numbers, times, connection duration). The "Extracted by MiniMax M3" provenance tag is derived from real extraction state — never hardcoded.
2. **Human correction and confirmation** — the traveller reviews and corrects every extracted field beside the source image. Downstream panels remain locked until explicit confirmation.
3. **Connection-risk simulation** — **Nosana** decentralized GPU compute runs the Monte Carlo connection-risk simulation as a real job; the completed-job evidence (job ID, IPFS-anchored result, `evidenceSource`, `fallbackUsed`, risk band) is reconciled and surfaced in the UI. The risk score itself is produced by **Daytona**: a sandboxed, reproducible risk-computation worker (`daytona-risk-worker-v1`) scores the connection risk (score 54, risk band *medium*) inside an ephemeral, network-blocked sandbox.
4. **Verified safer alternatives** — **Atlas Sandbox** Search/Verify (strictly read-only) finds and verifies real single-ticket alternatives for the same route. The traveller compares side-by-side and decides to keep the self-transfer or switch. **No booking, payment, or order is created at any point.**

## Tech stack

| Component | Role |
|---|---|
| **MiniMax M3** (via Nosana) | Screenshot → structured itinerary extraction |
| **Nosana** | Risk computation — Monte Carlo connection-risk simulation on decentralized GPU compute |
| **Atlas Sandbox** | Flight search / verification of safer single-ticket alternatives |
| **Alibaba Cloud** | Infrastructure |

**Safety architecture**: 7-layer gate chain (kill switch, live mode, read-only, production flag exclusion, sandbox environment, sandbox base URL exact match, execution approval) — all fail-closed by default.

## Sponsored integrations

Primary sponsors:

- **Daytona** — sandboxed, reproducible risk-computation worker (`daytona-risk-worker-v1`) runs connection-risk scoring in an isolated, network-blocked sandbox (risk score 54, risk band *medium*, 6 ms worker latency). Live evidence is surfaced directly in the UI under "How this was calculated" with the tag `Source: Daytona sandbox · live`.
- **Nosana** — the Monte Carlo connection-risk simulation runs as a Nosana GPU job. Completed-job evidence — job ID, `evidenceSource: "nosana-evidence"`, `fallbackUsed: false`, risk band *medium* (0.2895 over 800 simulations, $0.044 cost), IPFS-anchored job definition and result hashes — is reconciled and surfaced to the user as `Nosana · live` in the provider bar.

Supporting providers:

- **Atlas Sandbox** — live Search/Verify calls find and verify real single-ticket alternatives (18 alternatives surfaced in the final live walkthrough), strictly **read-only**: no booking, payment, order, or ticketing writes.
- **MiniMax M3** (via Nosana) — itinerary screenshot-to-structured-data extraction, replacing manual data entry and feeding directly into the risk simulation.
- **Alibaba Cloud** — underlying infrastructure for the submission stack.

## Provider and evidence status

The default browser launch (`DATA_MODE=offline`) runs fully offline from local fixtures. The live evidence below was captured with dedicated smoke-test runners under `DATA_MODE=live` and reconciled into the app.

| Component | Status | Key evidence |
|---|---|---|
| **MiniMax M3 extraction** (via Nosana) | **Live, verified.** Real extraction in the final submission walkthrough produced the `Extracted by MiniMax M3` provenance tag from actual state (`evidenceSource`, `fallbackUsed` fields drive the label; extraction not skipped, not fallback). | `demo-evidence/2026-08-29-submission-final/00-report.txt`, `smoke-tests/extraction/` |
| **Nosana risk simulation** | **Live, verified.** One completed job: ID `8CfUkxFgZnPpC5kxiphD1kozwiJeLYBC4KB33bKPAEp1`, `riskScore: 0.2895`, `riskBand: medium`, 800 simulations, `costUsd: 0.044`, submitted 2026-08-28T13:39:46Z. IPFS job def `QmPF9E4NZyfu44m2eNHuHZufJ4cccoAPBkidcrJs6QEQVm`, result `QmXG2ZpA6AJYd2zTHxVCarGpPuY6RvtETKoNMYjV3vz6uG`. `evidenceSource: "nosana-evidence"`, `fallbackUsed: false`. | `smoke-tests/nosana/results/evidence/2026-08-28T13-40-14-358Z-completed_success.json`, `app/public/nosana-risk-result.json` |
| **Atlas Sandbox alternatives** | **Live Search/Verify, read-only.** Sandbox search returned 20 real KUL→SIN offers; individual verify calls confirm fares and expose drift (see metric below); the live walkthrough surfaced 18 verified single-ticket alternatives tagged `Source: Atlas Sandbox · live`. Hard stop after Verify — no write call in this walkthrough (predates the 2026-08-29 sandbox rehearsal; see [Submission evidence status](#submission-evidence-status)). Offer IDs and fare-drift values recorded in evidence. | `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json`, `demo-evidence/2026-08-29-four-live-providers/00-report.txt` |
| **Daytona risk worker** | **Live sandbox worker.** One ephemeral sandbox (`node:20-slim`, cpu 1, memory 2 GiB, `networkBlockAll: true`), risk worker exit 0: `riskScore: 54`, `riskBand: medium`, dataset `daytona-risk-worker-v1`, 6 ms latency, `externalWriteOccurred: false`, sandbox destroyed in `finally`. Envelope consumed by the UI. | `smoke-tests/daytona/results/daytona-live-risk-2026-08-28T13-01-59-259Z.json`, `app/public/daytona-risk-live-result.json` |

## Submission evidence status

| Item | Status | Detail |
|---|---|---|
| Mock ticketing | **Complete** (items 4–7) | Atlas mock-ticketing follow-up items 4–7 completed; sandbox-only — no production booking |
| Sandbox rehearsal | **Successful** | Order `TESTA20260829181717829`, PNR `S30798`, terminal status `TICKETED` — Atlas Sandbox environment only |
| Extraction provider | **MiniMax M3 (via Nosana)** | Live extraction validated; see `docs/evidence-status.md` |

Evidence: `output/atlas-sandbox-evidence-2026-08-29.jsonl` (orderNo redacted by the secret scanner), `docs/demo-video-script-3min.md`.

## Demo Assets

- **Presentation deck (HTML):** [`deck/index.html`](deck/index.html) — 10 slides, printable to PDF via browser print-to-PDF
- **Deck PDF:** [StitchCheck-Deck-Daytona-Nosana-10-Slides.pdf](deck/StitchCheck-Deck-Daytona-Nosana-10-Slides.pdf) — export from `deck/index.html`
- **Demo video:** Local artifact — see [Video Artifacts](#video-artifacts) section below. Not yet uploaded to an external platform.

## Mock Ticketing

The repo includes a fully functional mock ticketing flow that runs against the Atlas Sandbox API — **no real bookings, payments, or tickets**.

- **Pipeline:** Search → Verify → Order → Pay → Ticketed
- **Safety:** All write endpoints are fail-closed by default (`ATLAS_SANDBOX_WRITES_ENABLED=false`, `ATLAS_WRITES_ENABLED=false`). The sandbox rehearsal succeeded (order `TESTA20260829181717829`, PNR `S30798`, terminal `TICKETED`) — exclusively inside the Atlas Sandbox environment.
- **Evidence:** `output/atlas-sandbox-evidence-2026-08-29.jsonl` (bookingId `book_ae786a2307f7d670b2f114fd`)
- **Implementation:** `scripts/atlas-sandbox-writes.mjs`, `app/src/components/SandboxOrderPanel.tsx`, `scripts/sandbox-write-gate-tests.mjs`

See the "Mock Ticketing Flow" slide (slide 8) in the deck for the full safety gate chain.

**To enable mock ticketing** (for testing only — not for production):

1. Edit `.env.local` and un-comment the 4 sandbox-write flags:
   ```
   ATLAS_SANDBOX_WRITES_ENABLED=true
   ATLAS_ENVIRONMENT=sandbox
   ATLAS_SANDBOX_BASE_URL=https://sandbox.atriptech.com/
   ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED=true
   ```
2. Restart dev server (`npm run dev`)
3. Run through the flow: Use sample → Check my itinerary → Options → Verify and select plan → Start Atlas Sandbox rehearsal → acknowledge → Create sandbox test order → Pay

**Safety gates** (all must pass for mock ticketing to execute):

1. `kill_switch` — `ATLAS_SANDBOX_WRITES_ENABLED === 'true'`
2. `live_mode` — `DATA_MODE === 'live'`
3. `read_only` — `ATLAS_LIVE_READ_ONLY === 'true'`
4. `production_flag_exclusion` — `ATLAS_WRITES_ENABLED !== 'true'` (sandbox and production writes are mutually exclusive)
5. `sandbox_environment` — `ATLAS_ENVIRONMENT === 'sandbox'`
6. `sandbox_base_url` — `ATLAS_SANDBOX_BASE_URL` exact match (including trailing slash)
7. `execution_approval` — `ATLAS_SANDBOX_WRITES_EXECUTION_APPROVED === 'true'` (final human checkpoint)

## Quantified metric (honest and traceable)

> The single price-verified fare (`off_11db11bad81302c295da16f1`) moved **$64.38 → $203.99, +217%**, between Search and Verify.

- **Source file:** `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json`
- **Offer:** `off_11db11bad81302c295da16f1` (KUL → SIN, `OD807`, 2026-09-15) — search `total_price: 64.38` (`price_status: "current"`), verify returned `PRICE_CONFIRMATION_REQUIRED` with `previous_price: 64.38`, `current_price: 203.99`.
- One search, one verify, one confirmed fare-drift event. A fare that looked current at search time no longer held at verify time — exactly the unpriced risk StitchCheck surfaces. Full context: `docs/quantified-metric-2026-08-29.md`.

## Setup

### Prerequisites

- Node.js >= 20
- npm

### Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd <repo-dir>

# Install dependencies (app workspace)
cd app && npm install && cd ..

# Configure environment (placeholders only; fill in values only for live paths)
cp .env.example .env.local

# Start development server (runs entirely offline with demo fixtures by default)
cd app && npm run dev
```

Additional commands (from `app/`): `npm run build` (production build), `npm run typecheck`.

### Environment Variables

Copy `.env.example` to `.env.local` and fill in values only if you want to exercise live paths. The browser demo runs fully offline without any keys.

```bash
cp .env.example .env.local
# Edit .env.local — never commit it
```

| Variable | Purpose | Required |
|---|---|---|
| `NOSANA_API_KEY` | **Primary** — Nosana API key for MiniMax M3 extraction and GPU workload submission — server-side only, never exposed in the browser bundle | No — demo runs offline with fixtures when absent |
| `OPENROUTER_API_KEY` | Legacy/optional OpenRouter extraction transport — server-side only | No |
| `EXTRACTION_MODEL` | Extraction model identifier (default `minimax/minimax-m3:free`) | No |
| `ATLAS_CLIENT_ID` / `ATLAS_CLIENT_SECRET` | Atlas API credentials — server-side only | No — demo runs offline when absent |
| `DATA_MODE` | `offline` (fixture-only, default) or `live` (surfaces reconciled live evidence) | No — defaults to `offline` |
| `NOSANA_MARKET` | Nosana market address (Solana public key) | No |
| `NOSANA_COST_CEILING_USD` | Maximum USD spend ceiling (safety limit) | No — defaults to `10` |
| `DAYTONA_API_KEY` | Daytona API key for sandbox lifecycle — server-side only | No |
| `DAYTONA_ENABLED` / `DAYTONA_RISK_COMPUTE_ENABLED` | Daytona sandbox-creation and risk-compute safety flags | No — both default to `false` |
| `NOSANA_ENABLED` / `NOSANA_LIVE_ENABLED` | Nosana submission and live-execution safety flags | No — both default to `false` |
| `ATLAS_LIVE_READ_ONLY` | Allow Atlas read-only Search/Verify | No — defaults to `false` |
| `ATLAS_WRITES_ENABLED` | Atlas write kill switch | No — **must remain `false`**; verified by the sandbox write-gate suite |

Never commit `.env.local` or any file containing real credentials.

## Judge verification path

One credential-free command reproduces the entire offline evidence chain:

```bash
npm --prefix app run verify:offline
```

- **Wall-clock:** ~14 seconds.
- **Result:** `Results: 354 passed, 0 failed`, exit code `0` (followed by `tsc --noEmit` typecheck and a production `vite build`).
- **Zero keys, sockets disabled:** the suite runs with **no provider API keys and no network**. The output asserts this directly — e.g. `isEnabled() false without credential`, `contract remains network-free`, `offline mode never calls transport`, `transport was never called in offline mode`, `Dry-run makes no network call`.
- **Two extra suites** (outside the chained command) cover the MiniMax M3 UI copy and the sample-screenshot entry point:

```bash
node smoke-tests/minimax-visibility-fix-offline-tests.mjs   # 8 passed, 0 failed
node smoke-tests/sample-itinerary-screenshot-tests.mjs      # 7 passed, 0 failed
```

Full detail: `docs/judge-verification-path.md`.

## Safety posture

> **Sandbox rehearsal completed — production writes remain disabled.**

- **No *production* booking, payment, ticketing, reservation, or order writes** — this invariant holds across every provider path and is enforced, not just documented: `smoke-tests/atlas/sandbox-write-gate-tests.mjs` (354 assertions) proves all write-capable Atlas sandbox endpoints remain default-denied behind the execution-approval flag. The one rehearsed order existed only inside the Atlas Sandbox environment (see [Submission evidence status](#submission-evidence-status)).
- Daytona sandbox ran with `networkBlockAll: true`, risk-worker only, no external write occurred (`externalWriteOccurred: false`), and was destroyed in `finally`.
- Nosana live execution is gated by a safety preflight (`NOSANA_ENABLED`, `NOSANA_LIVE_ENABLED`, `DEMO_MODE`, cost ceiling); exactly one job was submitted per explicit approval, no retries.
- `OPENROUTER_API_KEY`, `ATLAS_CLIENT_SECRET`, `NOSANA_API_KEY`, `DAYTONA_API_KEY`, and all provider keys are server-side only — the browser bundle does not read, reference, or transmit these keys.
- Human confirmation gate — downstream panels remain locked until the user explicitly confirms the itinerary.
- Nosana's risk output is a heuristic indication, not a guaranteed probability.
- All browser fixtures are synthetic, fictional, non-PII; no real passenger personal data is processed.

## Testing

Quick commands:

```bash
npm --prefix app run verify:offline                       # full chained offline suite (~14 s, zero keys, zero network)
node smoke-tests/atlas/adapter-offline-tests.mjs          # Atlas smoke coverage (adapter contract, offline)
node smoke-tests/atlas/sandbox-write-gate-tests.mjs       # Atlas sandbox write-gate (default-deny)
node smoke-tests/nosana/nosana-client-offline-tests.mjs   # Nosana smoke coverage (client boundary, offline)
```

> Note: no npm scripts named `test:smoke:atlas` or `test:smoke:nosana` exist in `package.json`; the `node` commands above are the actual equivalents.

The offline suite covers extraction, risk, sandbox, and cross-cutting provenance/safety invariants:

| Suite | Location | Coverage |
|---|---|---|
| OpenRouter extraction adapter offline tests | `smoke-tests/extraction/openrouter-extraction-adapter-offline-tests.mjs` | MiniMax M3 extraction contract, schema validation, fallback labels |
| MiniMax visibility tests | `smoke-tests/minimax-visibility-fix-offline-tests.mjs` | Provenance-tag truthfulness in the UI |
| Nosana suites (10+) | `smoke-tests/nosana/` | Client boundary, cost ceiling, safety gate, timeout watchdog, live-evidence reconciliation, UI-label truthfulness |
| Atlas adapter / guard / write-gate | `smoke-tests/atlas/` | Search/Verify contract, duplicate-booking prevention, sandbox write-gate (default-deny) |
| Daytona suites | `smoke-tests/daytona/`, `smoke-tests/risk-computation-offline-tests.mjs` | Orchestrator, worker sanitization, risk-worker determinism |
| Cross-cutting invariants | `smoke-tests/cross-provider-invariant-tests.mjs`, `smoke-tests/provenance-label-offline-tests.mjs` | Placeholder/evidence boundary, label semantics across all providers |

All tests make zero network requests and use no credentials.

### Secret scanning

A lightweight pre-commit secret scanner is available at `scripts/secret-scan.mjs`. It checks staged files for credential-shaped patterns (API keys, sk- tokens, Bearer tokens, etc.) and refuses the commit if any match.

```bash
node scripts/secret-scan.mjs          # scan staged changes (default)
node scripts/secret-scan.mjs --all    # scan all tracked files
cp scripts/secret-scan.mjs .git/hooks/pre-commit   # install as a hook
```

No external dependencies required.

## Honest limits — design decisions

These are deliberate boundaries, not oversights:

- **Offline-reconciled by default.** The default launch (`DATA_MODE=offline`) is deterministic and fixture-based so any reviewer gets the same walkthrough. Live evidence is surfaced only when the reconciled artifacts are loaded under `DATA_MODE=live`.
- **`DATA_MODE=live` is an explicit gate.** No silent live calls; every live path additionally requires its own provider flag (`NOSANA_LIVE_ENABLED`, `DAYTONA_ENABLED`, `ATLAS_LIVE_READ_ONLY`, …), each defaulting to `false`.
- **Mock ticketing is sandbox-only.** Atlas mock-ticketing items 4–7 are complete and the sandbox rehearsal succeeded (order `TESTA20260829181717829`, terminal `TICKETED`) — but only inside the Atlas Sandbox. `ATLAS_WRITES_ENABLED` and the sandbox write flags remain fail-closed in `.env.local`; no production ticket was ever issued.
- **One-shot live evidence.** Daytona sandbox and Nosana job quotas were honored — one successful execution each, no re-runs for polish; evidence is preserved rather than regenerated.
- **Heuristic risk model.** The risk score is a Monte Carlo heuristic over modeled delay distributions, not an airline-guaranteed probability.
- **No persistence.** All application state resets on browser refresh.

## Known limitations

- **Mock ticketing** — sandbox-only; no live booking is ever created.
- **Nosana extraction** — free tier; may be subject to rate limits.
- **Atlas Sandbox** — test routes only; not production inventory.

## Video Artifacts

The following demo video artifacts exist locally. They have not been uploaded to any external platform.

| Artifact | Path | Details |
|---|---|---|
| Latest render | `output/demo-artifacts/stitchcheck-video/stitchcheck-demo-fixed-v1.mp4` | 120s, H.264 1920×1080, AAC audio |
| Full voiceover proof | `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` | 131s, H.264 1920×1080, AAC 24kHz mono, ~4.0 MB. Voiceover produced locally via Kokoro ONNX v0.4.7 — no external TTS call. |
| Hackathon demo (live v2) | `output/demo-artifacts/stitchcheck-video/hackathon-submission-live-v2/stitchcheck-hackathon-demo-live-v2.mp4` | ~5.0 MB |
| Hackathon demo v2 | `output/demo-artifacts/stitchcheck-video/hackathon-submission/stitchcheck-hackathon-demo-v2.mp4` | ~5.5 MB |

To view: open any `.mp4` file in a media player. All videos were rendered offline — no provider was called during rendering.

## Development attribution

- **Development:** Built with Qoder (AI-assisted development).
- **Travel-tech context:** WiT Singapore is the travel-tech context, not an endorsement.

## Repository Structure

```
app/                          React/Vite/TypeScript demo application
  src/components/             UI components (9 components + narration hook)
  src/data/                   Fixtures, types, live-evidence loaders, label constants
core/                         Canonical provenance, safety, and flag modules
app-fixture-contracts/        JSON contracts defining UI data shapes
smoke-tests/
  extraction/                 MiniMax M3 (OpenRouter) adapter, offline tests, fixtures
  atlas/                      Atlas adapter, offline tests, write-gate, live evidence
  nosana/                     Nosana client boundary, offline tests, live job evidence
  daytona/                    Daytona runner results and offline tests
  cross-provider-invariant-tests.mjs
  provenance-label-offline-tests.mjs
scripts/                      Capture, orchestrator, live-runner, and preflight scripts
workers/
  daytona-risk-worker/        Daytona sandbox risk-computation worker (daytona-risk-worker-v1)
  daytona-atlas-worker/       Daytona Atlas worker (not live)
demo-evidence/                Timestamped live-walkthrough reports and screenshots
docs/                         Documentation, audit reports, judge verification path
```

## License

Private — hackathon submission.
