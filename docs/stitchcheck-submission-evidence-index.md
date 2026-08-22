# StitchCheck Submission Evidence Index

## How to Read This Index

This index organises the evidence artifacts in this repository into three
categories:

- **Verified local behavior.** The React/Vite demo application builds, renders,
  and enforces its confirmation gate. These behaviors are verified by local
  type-check, production build, and browser walkthrough against the acceptance
  checklist. They demonstrate the review-first user experience.

- **Offline contract and test verification.** The Gemini, Atlas, and Nosana
  smoke-test directories contain deterministic offline tests that validate
  adapter contracts, fixture schemas, forbidden-action enforcement, and safety
  boundaries. These offline tests make zero network requests and invoke no
  provider. Offline tests are distinct from live-demo results.

- **Provider execution status.** Separate from local and offline evidence,
  this category records whether any live provider has been called.
  Live-demo results exist at `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/`:
  GEM-LIVE-01 (OpenRouter extraction success), ATL-LIVE-01 (Atlas production
  search, 8 offers), ATL-SBX-SV-01 (Atlas Sandbox search + verify, partial
  success), and NOS-LIVE-01 (blocked before any network request).
  Direct Gemini and Nosana live execution remain unexecuted.

Local and offline evidence must not be presented as live provider evidence.
Offline test results demonstrate that contracts and safeguards are correctly
implemented; they do not demonstrate that any external service works. Offline
implementation and validator evidence — including client modules, adapter
modules, and schema validators — is distinct from live provider execution
evidence and must not be presented as such.

## Claim-to-Evidence Matrix

| Claim | Category | Evidence Artifact | Verification | Boundary |
|---|---|---|---|---|
| Local demo starts and builds. | Verified local behavior | `app/package.json`, `docs/stitchcheck-demo-readiness-report.md` | Production build passes (37 modules). | Local commands only; no external service call. |
| Type-check passes. | Verified local behavior | `docs/stitchcheck-demo-readiness-report.md` | Zero errors reported. | Covers `app/src/` TypeScript only. |
| Browser acceptance walkthrough passes. | Verified local behavior | `docs/react-ui-acceptance-checklist.md`, `docs/stitchcheck-demo-readiness-report.md` | 39 acceptance items verified. | UI rendering and gate behavior only; no provider call. |
| The confirmation gate blocks downstream panels before confirmation. | Verified local behavior | `docs/react-ui-acceptance-checklist.md`, `app/src/components/RiskPanel.tsx`, `app/src/components/AlternativesPanel.tsx` | Panels show `Confirm itinerary first` and remain disabled until explicit user confirmation. | UI-level gate only; does not prove provider integration. |
| Required source and evidence labels are visible. | Verified local behavior | `app/src/data/labels.ts`, `docs/react-ui-acceptance-checklist.md`, `docs/stitchcheck-demo-readiness-report.md` | All three exact labels confirmed visible in correct panels. | Labels are displayed in the local UI; not provider-authentication proof. |
| Synthetic fixture data is used. | Verified local behavior | `smoke-tests/gemini/fixtures/manifest.json`, `smoke-tests/atlas/fixtures/`, `smoke-tests/nosana/fixtures/` | All fixtures are synthetic, fictional, and contain no PII. | Fixture data is not live provider output. |
| Gemini extraction contract is schema-validated offline. | Offline contract verification | `smoke-tests/gemini/extraction-contract.mjs`, `smoke-tests/gemini/extraction-validator.mjs`, `smoke-tests/gemini/schema-validator.mjs` | Contract, extraction validator, and schema validator are aligned. | Offline validation only; no provider call. |
| Gemini offline regression suite passes. | Offline contract verification | `smoke-tests/gemini/adapter-offline-tests.mjs` | 92 passed, 0 failed. | Deterministic offline tests with fake clients; no provider invoked. |
| Atlas offline fixtures and adapter are present. | Offline contract verification | `smoke-tests/atlas/alternatives-contract.mjs`, `smoke-tests/atlas/read-only-atlas-adapter.mjs`, `smoke-tests/atlas/adapter-offline-tests.mjs`, `smoke-tests/atlas/schema-validator.mjs` | 89 passed, 0 failed. | Offline tests with fake clients; distinct from live Atlas production search (ATL-LIVE-01). |
| Nosana local workload and fixtures are present. | Offline contract verification | `smoke-tests/nosana/workload-skeleton.mjs`, `smoke-tests/nosana/schema-validator.mjs`, `smoke-tests/nosana/fixtures/` | Schema-validator fixtures all passed. | Local simulation only; Nosana not executed or deployed. |
| Nosana has a credential-free, offline-only integration boundary with read-only operation validation and sanitization. | Offline contract/test verification | `smoke-tests/nosana/nosana-client.mjs`, `smoke-tests/nosana/nosana-client-offline-tests.mjs`, `docs/nosana-integration-boundary.md` | 75 passed, 0 failed. | No network request, credential use, authentication, deployment, funding, submission, polling, cancellation, or live provider evidence. |
| Atlas duplicate-booking protection enforces query-before-retry for synthetic 318 scenarios. | Offline contract/test verification | `smoke-tests/atlas/duplicate-booking-guard.mjs`, `smoke-tests/atlas/duplicate-booking-guard-offline-tests.mjs`, `docs/atlas-duplicate-booking-protection.md` | 48 passed, 0 failed. | Offline-only state machine; no Atlas authentication, network request, booking, payment, polling, ticketing, cancellation, or live provider evidence. |
| GEM-01 used the temporary OpenRouter path. | Provider execution status | `smoke-tests/gemini/results/results.json`, `smoke-tests/gemini/results/evidence-stub.md` | GEM-01 executed via OpenRouter with synthetic fixture; labelled as temporary path. | OpenRouter temporary path only; not direct Gemini validation. |
| Direct Gemini was not executed. | Provider execution status | `smoke-tests/gemini/results/results.json`, `docs/stitchcheck-demo-readiness-report.md`, `README.md` | Direct Gemini validation status recorded as not executed. | Pass/fail for direct Gemini is intentionally blank. |
| Nosana was not executed or deployed. | Provider execution status | `smoke-tests/nosana/README.md`, `docs/stitchcheck-demo-readiness-report.md`, `README.md`, `docs/stitchcheck-nosana-live-image-resolution.md`, `docs/stitchcheck-nosana-sdk-contract-resolution.md`, `docs/stitchcheck-nosana-live-approval-update.md` | `@nosana/kit@2.7.5` installed; read-only preflight executed (`markets.list` / `credits.balance`); market `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` verified; job definition corrected to allowlisted image `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter`. Live execution not performed. | No live job submitted, no credits spent, no IPFS pin. |
| Atlas Sandbox Search + Verify executed (read-only). | Provider execution status | `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json` (ATL-SBX-SV-01) | PARTIAL_SUCCESS: environment switch ✅, search (20 offers KUL→SIN) ✅, offer list ✅, verify (PRICE_CONFIRMATION_REQUIRED) ✅. Hard stop after Verify. No write call made. Environment restored to Production afterward. | Atlas Sandbox evidence — search + verify completed, price change or offer expired. No order, payment, ticketing, cancellation, or refund. Environment restored to Production. |
| Full voiceover video rendered and validated. | Verified local behavior | `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4`, `docs/stitchcheck-final-video-validation.md` | Duration: 131s. H.264 1920×1080 @ 30fps, AAC 24kHz mono, ~4.0MB. Caption-overlay fix applied (semi-transparent RGBA band, 96px). All 6 scenes validated. | No provider was called during rendering. All audio synthesis performed locally by Kokoro ONNX v0.4.7 (`externalTtsCalls: false`). No Atlas, Nosana, Gemini, or OpenRouter call. No package install, credit spend, or wallet operation. |
| No booking, payment, reservation, ticket, order, verification, or other external action exists. | Verified local behavior | `app/src/App.tsx`, `app/src/data/labels.ts`, `docs/SPECS.md`, `docs/react-ui-acceptance-checklist.md` | No UI handler, route, or button enables any write action. Final statement explicitly denies all external actions. | Applies to the entire local demo; no provider can create write actions through this application. |

## Exact Labels

- `OpenRouter temporary path — not direct Gemini validation` — used in
  `app/src/data/labels.ts`, `smoke-tests/gemini/results/results.json`,
  `smoke-tests/gemini/results/evidence-stub.md`, and
  `docs/react-ui-acceptance-checklist.md`.

- `Synthetic local placeholder — not Nosana evidence` — used in
  `app/src/data/labels.ts`, `smoke-tests/nosana/schema-validator.mjs`,
  `smoke-tests/nosana/README.md`, `smoke-tests/nosana/fixtures/`,
  and `docs/react-ui-acceptance-checklist.md`.

- `Synthetic local placeholder — not Atlas Sandbox evidence` — used in
  `app/src/data/labels.ts`, `smoke-tests/atlas/alternatives-contract.mjs`,
  `smoke-tests/atlas/comparison-adapter.mjs`, `smoke-tests/atlas/schema-validator.mjs`,
  `smoke-tests/atlas/README.md`, `smoke-tests/atlas/fixtures/`,
  and `docs/react-ui-acceptance-checklist.md`.

## Test and Build Record

- Gemini offline tests: 92 passed, 0 failed.
- Atlas offline tests: 89 passed, 0 failed.
- Atlas duplicate-booking guard offline tests: 48 passed, 0 failed.
- Atlas guard integration in verify:offline: passed.
- Nosana client offline tests: 75 passed, 0 failed.
- Nosana integration boundary: offline-only and credential-free.
- Existing Nosana schema-validator fixtures: all passed.
- Nosana workload skeleton: 5 simulated runs, all valid.
- Type-check: passed.
- Production build: passed, 37 modules.
- Local browser acceptance walkthrough: 39 acceptance items passed.

All figures above are supported by `docs/stitchcheck-demo-readiness-report.md`
and the respective offline test modules. No figure in this section was
independently re-verified in this task beyond what those artifacts already
record.

## Provider Status

| Provider | Current Status | What Is Proven | What Is Not Proven |
|---|---|---|---|
| Gemini | Direct Gemini remains unexecuted. OpenRouter temporary path executed for GEM-01 and GEM-LIVE-01. | The extraction contract, validator, and offline regression suite pass offline. GEM-LIVE-01 (OpenRouter) succeeded with valid schema extraction from a synthetic screenshot. | Direct Gemini has not been called; no structured-output evidence from the Gemini API exists. |
| Nosana | Offline boundary implemented; job definition corrected to match official Nosana schema (v0.1) and to the allowlisted image `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter`; live execution not performed. | Credential-free read-only validation, request-envelope construction, fixture normalization, sanitization, mutation rejection, offline tests (75 passed), workload portability tests (37 passed), and corrected job definition (`version: "0.1"`, `type: "container"`, `ops[]`, `createNosanaClient()` SDK init, official-schema `validateJobDefinition()`). `@nosana/kit@2.7.5` installed; read-only preflight executed (`markets.list` / `credits.balance`); market `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` verified. See `docs/stitchcheck-nosana-live-image-resolution.md`, `docs/stitchcheck-nosana-sdk-contract-resolution.md`, `docs/stitchcheck-nosana-live-approval-update.md`. | Authentication, deployment, funding, submission, polling, cancellation, network execution, or live provider behavior. NO live job submitted, no credits spent, no IPFS pin. |
| Atlas | Authentication succeeded via official Atlas Flight Booking Skill (browser ATRIP authorization). Two live production searches: (1) PVG→NRT/HND returned 5 real offers, (2) SIN→BKK returned 8 real offers (ATL-LIVE-01). All offers are reference prices (`price_status: reference`, `bookable: false`) due to `TICKETING_ACTIVATION_REQUIRED`. Atlas Sandbox Search + Verify (ATL-SBX-SV-01): environment switch ✅, search returned 20 offers (KUL→SIN, 2026-09-15), offer list ✅, verify returned PRICE_CONFIRMATION_REQUIRED (price changed $64.38→$203.99). Hard stop after Verify — no write call. Evidence: `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json`. No booking, payment, ticket, or order was created. Ticketing activation pending human action at ATRIP workspace. | Authentication via official Skill and CLI, live production searches returning real flight offers, and Atlas Sandbox read-only Search + Verify with sanitized evidence record. | No booking, payment, ticket, order, verification, or any write action was created. Ticketing activation is pending. Production booking, payment, ticketing, and reliability remain unproven. |
| OpenRouter | Temporary path only; not direct Gemini validation. | GEM-01 was executed via the OpenRouter temporary path with a synthetic fixture and is labelled accordingly. | The OpenRouter path is not direct Gemini validation; results are not transferable to the Gemini API. |

Provider execution status is updated by live-demo results at
`smoke-tests/live-demo-results/2026-08-21T05-37-31Z/`. No offline test result
is upgraded to live provider evidence by this document.

## Submission Use

- **README.** Reference this index when directing reviewers to evidence. The
  README service-status table and this index must agree on every provider
  boundary.

- **Slides.** Use the claim-to-evidence matrix to support any status claim made
  during the presentation. Do not present offline test results as live provider
  evidence.

- **Demo video narration.** Describe the local review-first workflow and the
  offline contract safeguards. State provider execution status separately and
  do not overstate it.

- **Judge Q&A.** When asked whether a provider is live, refer to the Provider
  Status table. Distinguish clearly between offline contract verification and
  live execution evidence.

Safe presenter sentence:

> "This submission demonstrates a review-first local workflow and offline
> contract safeguards; provider execution status is reported separately and
> not overstated."

## Review Checklist

- [ ] All provider claims are status-qualified.
- [ ] No local placeholder is called a live result.
- [ ] No credential or secret is included.
- [ ] No PII or raw provider output is included.
- [ ] No transaction capability is claimed.
- [ ] Evidence artifacts are not modified.
- [ ] Changed files are limited to this new index.
- [ ] Offline Nosana implementation is not presented as live deployment.
- [ ] `executedAgainstProvider: false` remains true for local fixtures.
- [ ] `sourceType: "synthetic-local-placeholder"` remains visible in fixture results.
- [ ] Atlas 318 protection is described as offline-only.
- [ ] Query-before-retry is not presented as live Atlas evidence.
- [ ] `executedAgainstProvider: false` remains true for offline Atlas results.
