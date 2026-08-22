# Evidence Status

This table records the verified status of each provider capability, the proof artifact, and the wording that is/is not permitted in the demo video.

## Provider Evidence

| Capability | Status | Proof / Artifact | Wording Allowed in Video | Wording NOT Allowed |
|---|---|---|---|---|
| **Gemini extraction (direct API)** | Configured, offline-tested, not executed live | `smoke-tests/gemini/direct-gemini-adapter.mjs`, `smoke-tests/gemini/adapter-offline-tests.mjs`, `smoke-tests/gemini/interactions-api-offline-tests.mjs` | "Direct Google Gemini integration is implemented and offline-tested. Gemini 3.7 Interactions API path implemented and offline-tested; live verification pending." | "Live Gemini extraction", "Gemini 3.7 live success", "Gemini API key verified" |
| **Gemini extraction (OpenRouter temporary path)** | Historical smoke-test only — GEM-01 succeeded via OpenRouter | `smoke-tests/gemini/results/results.json`, `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/gemini-live-result.md` | "Historical/temporary OpenRouter smoke-test result; not evidence of direct Google Gemini execution." | "Gemini directly extracted this", "Direct Gemini validated the itinerary", "OpenRouter is the active provider" |
| **Nosana risk workload** | Offline/dry-run validated; live unverified | `smoke-tests/nosana/nosana-client-offline-tests.mjs`, `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/nosana-live-result.md` | "Nosana workload validated offline. Local fallback used in recording." | "Nosana computed this risk", "Nosana job succeeded", "Nosana is live", "Nosana live result" |
| **Nosana offline client boundary** | Verified — zero network, zero credentials, zero mutations | `smoke-tests/nosana/nosana-client-offline-tests.mjs` | "The Nosana client boundary correctly refuses live execution without explicit transport and authorization." | "Nosana is connected", "Nosana is ready" |
| **Atlas Sandbox search** | Live — completed (20 offers, KUL→SIN) | `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json` | "Atlas Sandbox search returned 20 flight offers. Search and verify completed." | "Atlas booked this", "Atlas ticketing succeeded", "Atlas is fully live" |
| **Atlas Sandbox verify** | Live — completed (price change detected) | `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json` (step: verify, `PRICE_CONFIRMATION_REQUIRED`) | "Atlas verify confirmed the offer price had changed. The hard stop was reached — no order created." | "Atlas completed a booking", "Atlas ticketing was successful" |
| **Atlas production search** | Live — completed (8 offers, SIN→BKK) | `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/atlas-live-result.md` | "Atlas production search returned 8 flight offers. All are reference-price only, not bookable." | "Atlas production booking succeeded", "Atlas production ticketing is active" |
| **Atlas ticketing** | Activation-gated, not completed | `atlas-flight auth status --json` → `ticketing_available: false`, `TICKETING_ACTIVATION_REQUIRED` | "Atlas ticketing requires activation. No booking, payment, or ticket was created." | "Atlas ticketing is complete", "Atlas booking succeeded", "Ticketing is live" |
| **Browser demo UI** | Fully functional offline | `app/` passes typecheck and production build | "The React demo walks through the full StitchCheck flow with synthetic data." | "The demo calls live providers", "The demo is connected to Gemini/Nosana/Atlas" |
| **Cross-provider invariant tests** | Verified — all pass | `smoke-tests/cross-provider-invariant-tests.mjs` | "Cross-provider tests ensure no placeholder is ever labelled as live evidence." | N/A |
| **Extraction confirmation gate** | Verified — enforced in UI | `app/src/App.tsx`, `app/src/components/ItineraryReview.tsx` | "The confirmation gate keeps the traveller in control. Panels stay locked until the user confirms." | "The gate calls a provider", "The gate is optional" |

## Evidence Source Labels in the UI

| Label Constant | Value | When Displayed |
|---|---|---|
| `LABELS.geminiExtraction` | `Synthetic local placeholder — not direct Gemini evidence` | Default extraction display (no live call) |
| `LABELS.nosanaRisk` | `Synthetic local placeholder — not Nosana evidence` | Risk panel with local fixture |
| `LABELS.nosanaRiskEvidence` | `Nosana evidence — remote job succeeded; result from decentralized GPU workload` | Only if a real Nosana result file exists with `evidenceSource: 'nosana-evidence'` |
| `LABELS.nosanaRiskFallback` | `Nosana unavailable — local fallback used; not Nosana evidence` | When Nosana result has `evidenceSource: 'local-fallback'` |
| `LABELS.atlasAlternatives` | `Synthetic local placeholder — not Atlas Sandbox evidence` | Alternatives panel with local fixture |

## Key Safety Invariants

1. No local placeholder is ever labelled as live provider evidence.
2. No booking, payment, ticket, order, or write action exists in any provider.
3. All external writes require explicit user confirmation.
4. `GEMINI_API_KEY` is server-side only and never appears in the browser bundle.
5. Nosana has zero network code, zero credential access, and zero mutation operations.
6. Atlas is strictly read-only (search + verify only).

## Final Evidence Table

| Capability | Status | Submission wording |
|---|---|---|
| Direct Gemini 3.6 | Live extraction verified previously | "Direct Gemini 3.6: live extraction verified previously." |
| Direct Gemini 3.7 | Interactions API path implemented and offline-tested; live verification pending | "Gemini 3.7: Interactions API path implemented and offline-tested; live verification pending." |
| OpenRouter | Historical temporary path only | "OpenRouter: historical temporary path only, not the active provider." |
| Atlas Search/Verify | Verified sandbox evidence | "Atlas: Sandbox Search/Verify evidence only; booking/payment not executed." |
| Atlas ticketing | Activation-gated | "No booking or payment was executed." |
| Nosana | Offline/dry-run validated; live unverified | "Nosana: offline/dry-run validated; live execution not verified." |
