# Evidence Status

This table records the verified status of each provider capability, the proof artifact, and the wording that is/is not permitted in the demo video.

## Provider Evidence

| Capability | Status | Proof / Artifact | Wording Allowed in Video | Wording NOT Allowed |
|---|---|---|---|---|
| **Gemini extraction (direct 3.7)** | Live extraction validated — `ai.interactions.create` succeeded, schema-validated, `fallbackUsed: false` | `smoke-tests/gemini/results/results-gemini-3.7-flash-success.json` | "Direct Gemini — live validated." "Direct Google Gemini 3.7 — live extraction validated." | "Synthetic Gemini", "OpenRouter active path", "Gemini not yet executed" |
| **Gemini extraction (direct 3.6)** | Live extraction verified previously | Previous evidence package | "Direct Gemini — live validated." | "Gemini 3.6 only", "Gemini not live" |
| **Gemini extraction (OpenRouter temporary path)** | Historical smoke-test only — GEM-01 succeeded via OpenRouter | `smoke-tests/gemini/results/results.json`, `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/gemini-live-result.md` | "Historical temporary OpenRouter test path — not the active provider." | "Gemini directly extracted this", "OpenRouter is the active provider" |
| **Nosana risk workload** | Live job completed; result validated via `opStates.logs.log` parser fix. `riskScore: 0.2895`, `riskBand: medium`, `simulationCount: 800`. `creditsUsed: 44`, `costUsd: 0.044`. | `smoke-tests/nosana/results/evidence/2026-08-22T05-15-31-529Z-output_invalid.json` (original live evidence), `smoke-tests/nosana/results/evidence/*-completed_success-reconciled.json` (reconciled), `smoke-tests/nosana/fixtures/opstates-live-result-sanitized.json` (sanitized fixture) | "Nosana — live job completed, result validated." "Nosana evidence — remote job succeeded." | "Nosana not submitted", "Nosana cost unknown", "creditsUsed is USD" (creditsUsed is internal credit metadata, costUsd is the USD equivalent) |
| **Nosana offline client boundary** | Verified — zero network, zero credentials, zero mutations | `smoke-tests/nosana/nosana-client-offline-tests.mjs` | "The Nosana client boundary correctly refuses live execution without explicit transport and authorization." | "Nosana is connected", "Nosana is ready" |
| **Atlas Sandbox search** | Live — completed (20 offers, KUL→SIN) | `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json` | "Atlas Sandbox — live Search/Verify." "Atlas Sandbox search returned 20 flight offers." | "Atlas booked this", "Atlas ticketing succeeded", "Atlas is fully live" |
| **Atlas Sandbox verify** | Live — completed (price change detected) | `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json` (step: verify, `PRICE_CONFIRMATION_REQUIRED`) | "Atlas verify confirmed the offer price had changed. The hard stop was reached — no order created." | "Atlas completed a booking", "Atlas ticketing was successful" |
| **Atlas production search** | Live — completed (8 offers, SIN→BKK) | `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/atlas-live-result.md` | "Atlas production search returned 8 flight offers. All are reference-price only, not bookable." | "Atlas production booking succeeded", "Atlas production ticketing is active" |
| **Atlas ticketing** | Activation-gated, not completed | `atlas-flight auth status --json` → `ticketing_available: false`, `TICKETING_ACTIVATION_REQUIRED` | "Atlas ticketing requires activation. No booking, payment, or ticket was created." | "Atlas ticketing is complete", "Atlas booking succeeded", "Ticketing is live" |
| **Browser demo UI** | Fully functional offline; uses fictional local fixtures by default | `app/` passes typecheck and production build | "The React demo walks through the full StitchCheck flow with a fictional local fixture itinerary. No provider call is made from the browser. Live provider processing where explicitly labelled." | "The demo calls live providers", "The demo is connected to Gemini/Nosana/Atlas", "Direct Gemini — live validated" (for the default browser flow) |
| **Cross-provider invariant tests** | Verified — all pass | `smoke-tests/cross-provider-invariant-tests.mjs` | "Cross-provider tests ensure no offline fixture is ever labelled as live evidence." | N/A |
| **Extraction confirmation gate** | Verified — enforced in UI | `app/src/App.tsx`, `app/src/components/ItineraryReview.tsx` | "The confirmation gate keeps the traveller in control. Panels stay locked until the user confirms." | "The gate calls a provider", "The gate is optional" |

## Evidence Source Labels in the UI

| Label Constant | Value | When Displayed |
|---|---|---|
| `GEMINI_LABELS.liveValidated` | `Direct Gemini 3.7 — live validated` | When extraction has `evidenceSource: 'gemini-live'`, `provider: 'gemini'`, `executed: true`, `fallbackUsed: false`, `validationOutcome: 'valid'` |
| `GEMINI_LABELS.localFixture` | `Fictional itinerary — local demo fixture` | Default extraction display for the browser walkthrough (`evidenceSource: 'local-fixture'`, `executed: false`, `fallbackUsed: true`, `provenanceMode: 'fictional-local'`). The browser makes no provider call. |
| `NOSANA_UI_LABELS.liveEvidence` | `Nosana evidence — remote job succeeded; result from decentralized GPU workload.` | When risk result has `evidenceSource: 'nosana-evidence'`, `fallbackUsed: false` (reconciled live evidence). |
| `NOSANA_UI_LABELS.offlineValidated` | `Nosana workload validated offline — local fallback used; not Nosana evidence` | When Nosana result has `evidenceSource: 'nosana-evidence'` but `fallbackUsed: true`, or when offline-validated metadata is present but fallback was used. |
| `NOSANA_UI_LABELS.localFallback` | `Local fallback — not Nosana evidence` | Risk panel with local fixture (`evidenceSource: 'local-fallback'`) |
| `ATLAS_UI_LABELS.sandboxLive` | `Atlas Sandbox — live Search/Verify` | Only when search result has `evidenceSource: 'atlas-sandbox'`, `executed: true`, `fallbackUsed: false` |
| `ATLAS_UI_LABELS.localFixture` | `Fictional alternatives — local demo fixture` | Alternatives panel with local fixture (`evidenceSource: 'local-fixture'`) |
| `ATLAS_UI_LABELS.offlineFixture` | `Offline fixture — not Atlas Sandbox evidence` | Conservative default for Atlas alternatives |

## Key Safety Invariants

1. No offline fixture is ever labelled as live provider evidence.
2. No booking, payment, ticket, order, or write action exists in any provider.
3. All external writes require explicit user confirmation.
4. `GEMINI_API_KEY` is server-side only and never appears in the browser bundle.
5. Nosana has zero network code in the client boundary; one live job was submitted and completed through the runner.
6. Atlas is strictly read-only (search + verify only). No booking, payment, ticket, reservation, or other external write occurred.
7. Labels are selected based on evidence fields (`evidenceSource`, `provider`, `executed`, `fallbackUsed`, `validationOutcome`), not provider name alone.
8. The browser walkthrough uses fictional local fixtures (`provenanceMode: 'fictional-local'`). It does not consume live provider output.
9. The live Gemini label requires ALL of: `evidenceSource: 'gemini-live'`, `provider: 'gemini'`, `executed: true`, `fallbackUsed: false`, `validationOutcome: 'valid'`.
10. Missing or contradictory provenance always resolves to a conservative offline/fictional label.

## Final Evidence Table

| Capability | Status | Submission wording |
|---|---|---|
| Direct Gemini 3.7 | Live extraction validated | "Direct Gemini 3.7 — live validated. `ai.interactions.create` succeeded, schema-validated, `fallbackUsed: false`." |
| Direct Gemini 3.6 | Live extraction verified previously | "Direct Gemini — live validated." |
| OpenRouter | Historical temporary path only | "Historical temporary OpenRouter test path — not the active provider." |
| Atlas Search/Verify | Verified sandbox evidence | "Atlas Sandbox — live Search/Verify. Booking/payment not executed." |
| Atlas ticketing | Activation-gated | "No booking or payment was executed." |
| Nosana | Live job completed; result validated | "Nosana — live job accepted and completed; result recovered from `opStates.logs.log`; `costUsd: 0.044`; risk output schema-valid." |

## Provenance Table

| Capability | Input/data status | Execution status | Allowed wording |
|---|---|---|---|
| Gemini 3.7 | Fictional itinerary image | Live, schema-validated | Direct Gemini 3.7 — live validated |
| Atlas Sandbox | Sandbox route/fare data | Live Search/Verify | Atlas Sandbox — live Search/Verify |
| Nosana | Fictional test itinerary; synthetic/offline historical delay dataset | Live job completed; result validated | Nosana — live job completed, result validated |
| Booking/payment | None | Not executed | No booking, payment, ticket, reservation, or other external write occurred. |

> The demo uses a fictional itinerary and live provider processing where explicitly labelled. It does not use real passenger PII, and it does not complete booking or payment.
