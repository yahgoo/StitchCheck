# StitchCheck Session Handoff — 2026-08-22 (Live-Provider Verification)

## Session Summary

Initiated a controlled live-provider verification of the StitchCheck app. Completed **Phase 1 (read-only inspection)** in full. Phases 2–8 are planned and awaiting user approval to proceed.

## Safety Constraints (Active)

1. No booking, reservation, ticketing, payment, checkout, or order creation.
2. No Atlas write or activation endpoint calls.
3. No new Nosana job submission without explicit user confirmation (with full cost/payload details).
4. No Gemini call without verifying model, input image, endpoint, and expected cost.
5. No API keys, tokens, wallet credentials, or `.env.local` values exposed.
6. No file modifications to source, fixtures, evidence, docs, or video assets.
7. No GitHub push or file upload.
8. Final video preserved unchanged.

## Phase 1 — Read-only Inspection (COMPLETED)

### Architecture Findings

| Item | Detail |
|---|---|
| Project root | `/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel` |
| App type | Pure frontend React/Vite/TypeScript SPA at `app/` |
| App start command | `cd app && npm run dev` → Vite dev server at `http://localhost:5173` |
| Backend server | **None.** No separate backend. Browser makes zero direct provider calls. |
| Provider adapters | Standalone Node.js scripts in `smoke-tests/` (outside the browser app) |
| Browser data source | Local fixture JSON (imported at build time) + static `/nosana-risk-result.json` from `app/public/` |

### Adapter Entry Points

| Provider | Adapter Location | Status |
|---|---|---|
| Gemini | `smoke-tests/gemini/direct-gemini-adapter.mjs` | Standalone Node.js script; not wired into browser app |
| Nosana | `app/public/nosana-risk-result.json` (static file) + smoke-test scripts | Browser fetches static JSON only; no live submission path in app |
| Atlas | `smoke-tests/atlas/read-only-atlas-adapter.mjs` (DISABLED BY DEFAULT) + `run-sandbox-search-verify.mjs` (uses `atlas-flight` CLI) | Adapter disabled; CLI installed at `/Users/kmsum/.local/bin/atlas-flight` |

### Environment Variable Status (names only — no values exposed)

```
GEMINI_API_KEY: present
GEMINI_MODEL: present (gemini-3.6-flash)
EXTRACTION_PROVIDER: present (gemini)
NOSANA_API_KEY: present
OPENROUTER_API_KEY: present
ATLAS_BASE_URL: present (sandbox.atriptech.com)
ATLAS_CLIENT_ID: present
ATLAS_CLIENT_SECRET: present
DAYTONA_API_KEY: present
GUARDIAN_MAX_SPEND_SGD: present
```

### Gemini Configuration

- `smoke-tests/gemini/config.json`: `directGeminiEnabled: true`, `providerSelection: "gemini"`
- Pinned model: `gemini-3.7-flash`
- Fallback model: `gemini-3.6-flash` (status: `live_verified`)
- `provider-capabilities.json`: Gemini capability `approved`, supports image input + structured JSON output

### Current Provenance Labels & Fallback Behavior

- **Gemini in-app**: `evidenceSource='local-fixture'`, `executed=false`, `fallbackUsed=true` → **"Fictional itinerary — local demo fixture"**
- **Nosana in-app**: Static file has `evidenceSource='local-fallback'`, `fallbackUsed=true` → **"Local fallback — not Nosana evidence"**
- **Atlas in-app**: Fixture has `evidenceSource='local-fixture'` → **"Fictional alternatives — local demo fixture"**

### Key Code Paths

| File | Purpose |
|---|---|
| `app/src/App.tsx` | Main app component; step-based flow (safety → upload → review → confirmed) |
| `app/src/data/fixtures.ts` | All data comes from local fixtures; `loadNosanaRiskResult()` fetches static JSON |
| `app/src/data/labels.ts` | Provenance-aware label selection (Gemini/Atlas/Nosana) |
| `app/src/data/types.ts` | TypeScript interfaces with provenance fields |
| `app/src/components/ItineraryReview.tsx` | Renders Gemini provenance label via `getGeminiLabel()` |
| `app/src/components/RiskPanel.tsx` | Renders Nosana provenance label with evidence-source-aware styling |
| `app/src/components/AlternativesPanel.tsx` | Renders Atlas provenance label via `getAtlasLabel()` |
| `app/public/nosana-risk-result.json` | Static Nosana result (local fallback, NOT live evidence) |

## Video Preservation Baseline (SHA-256)

| File | SHA-256 |
|---|---|
| `stitchcheck-hackathon-demo-live-v2.mp4` | `d13334bf33ad493b67293ef00547f4dea5730afd45cfa28e6288f6328d5513f5` |
| `stitchcheck-hackathon-demo-v2.mp4` | `ce4a91233d49ab43284256473c21e60ece5253d085387e01d41f8dedb50022d5` |
| `stitchcheck-hackathon-demo-v3.mp4` | `e5925b1f2742eee86a1a817adea347b4c5c3bbee37a42d963a3e3e6efe508bcd` |
| `stitchcheck-hackathon-demo.mp4` | `58af91f5a4a7b0354c78779f65f6d3275260af5552a6b3771dbfd543cd1b14df` |

## Remaining Phases (PENDING)

### Phase 2 — Launch the App
- Command: `cd app && npm run dev`
- No provider calls, no cost
- Expected: app reachable at `http://localhost:5173`

### Phase 3 — Gemini Live Verification
- Script: `smoke-tests/gemini/run-smoke-test.mjs` or direct adapter invocation
- Model: `gemini-3.6-flash` (fallback, live_verified) or `gemini-3.7-flash` (pinned)
- Input: `smoke-tests/gemini/fixtures/gem-01-two-leg-clean.png` (synthetic, non-PII)
- Expected: 1 request, minimal cost
- **Must stop and confirm with user before executing**

### Phase 4 — Nosana Live Verification
- Verify existing artifact displays correctly in the UI (local fallback)
- **No new Nosana job submission without explicit user confirmation**

### Phase 5 — Atlas Live Verification
- `atlas-flight auth status` → check authorization
- `atlas-flight search ...` → read-only search (KUL→SIN, 2026-09-15)
- `atlas-flight verify ...` → read-only price check
- **Must stop and confirm with user before executing search/verify**

### Phase 6 — Browser Verification
- Walk through fictional itinerary flow at `http://localhost:5173`
- Verify provenance labels, SC-202→SC-299 correction, panel unlock behavior

### Phase 7 — Network & Provenance Audit
- Inspect browser network logs; verify no unauthorized provider calls

### Phase 8 — Cleanup & Final Report
- Stop dev servers, verify video checksums unchanged, produce final report

## Resume Instructions

To resume this verification:

1. Read this handoff file.
2. Start at Phase 2 (launch app) unless instructed otherwise.
3. Pause before each live provider call (Phases 3, 5) to request explicit user confirmation.
4. Maintain all safety constraints listed above.
