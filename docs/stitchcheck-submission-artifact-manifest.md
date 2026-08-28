# StitchCheck Submission Artifact Manifest

## Purpose

This is a human-review manifest for the local demo and submission documents. It catalogs the artifacts that comprise the StitchCheck submission package and records the verified offline results. This manifest is not a provider-execution record and does not constitute live validation. No provider has been executed, authenticated, or deployed as part of this manifest.

## Core Submission Artifacts

| Artifact | Purpose | Status | Evidence Boundary |
|----------|---------|--------|-------------------|
| `README.md` | Project overview, status, and quickstart | Present | No live provider claims |
| `docs/stitchcheck-slide-deck-outline.md` | Slide deck structure for judge presentation | Present | Informational only |
| `docs/stitchcheck-demo-narrative-video-plan.md` | Demo recording plan and narrative structure | Present | No live execution |
| `docs/stitchcheck-judge-qa.md` | Judge Q&A preparation sheet | Present | All claims status-qualified |
| `docs/stitchcheck-final-submission-readiness-checklist.md` | Final submission readiness checklist | Present | Submission not yet made |
| `docs/stitchcheck-submission-evidence-index.md` | Evidence matrix and provider status | Present | All boundaries explicit |

## Technical and Safety Artifacts

| Artifact | Purpose | Status | Evidence Boundary |
|----------|---------|--------|-------------------|
| `docs/stitchcheck-demo-readiness-report.md` | Demo readiness verification report | Present | Service evidence status recorded |
| `docs/gemini-contract-alignment-record.md` | Gemini contract corrections and alignment | Present | Historical Gemini evidence preserved under `smoke-tests/extraction/`; active demo extraction is offline |
| `docs/nosana-integration-boundary.md` | Nosana offline boundary documentation | Present | The documented label applies |
| `docs/cross-provider-invariant-test-record.md` | Cross-provider invariant test record | Present | All invariants verified offline |
| `docs/stitchcheck-preflight-checklist.md` | Preflight checker documentation | Present | Read-only verification |
| `scripts/stitchcheck-preflight.mjs` | Preflight checker script | Present | No network, no credentials |
| `app/package.json` | Application package configuration | Present | Scripts verified |

## Verified Local and Offline Results

The following results have been verified through offline execution:

- Preflight: 23 passed, 0 failed.
- Cross-provider invariant tests: 40 passed, 0 failed.
- Gemini offline tests: 92 passed, 0 failed.
- Atlas offline tests: 89 passed, 0 failed.
- Nosana client offline tests: 75 passed, 0 failed.
- Atlas schema-validator fixtures: 9 passed.
- Nosana schema-validator fixtures: 10 passed.
- Type-check passed.
- Production build passed with 37 modules.
- Local browser walkthrough passed 39 acceptance items.

These results do not prove live provider availability, deployment, authentication, provider accuracy, or production readiness. All results are from offline, deterministic, local-only execution with synthetic fixtures.

## Provider Boundaries

| Provider | Verified Statement | Not Proven |
|----------|-------------------|------------|
| Gemini | Historical live evidence is preserved under `smoke-tests/extraction/`. The active ready-made demo does no extraction and correctly shows MiniMax offline. | Fresh-run reliability, accuracy across diverse inputs, or production readiness. |
| Nosana | Historical evidence is reconciled. The current browser runtime fixture is a permitted dry-run preview (`jobId: null`, fallback true), not a submitted workload. | Additional job submissions, current live risk assessment, or production readiness. |
| Atlas | Historical Sandbox Search→Verify evidence returned 20 offers and then `PRICE_CONFIRMATION_REQUIRED`, with no write. The most recent Aug 28 run was an environment-switch failure, not fresh evidence. | Booking, payment, ticketing, or reliability. |
| OpenRouter | Historical temporary path only; it is not direct Gemini evidence. | Direct Gemini validation, model routing guarantees, or provider equivalence. |

## Exact Evidence Labels

The following exact labels appear once each in the submission artifacts:

- `OpenRouter temporary path — not direct Gemini validation`
- `Synthetic local placeholder — not Nosana evidence`
- `Synthetic local placeholder — not Atlas Sandbox evidence`

These labels are the canonical evidence boundaries for their respective providers. Refer to them as "the documented label" elsewhere in this manifest.

## Human Review Before Submission

Before submitting, the human reviewer must:

- [ ] Review all core submission artifacts.
- [ ] Run `npm run preflight`.
- [ ] Run `npm run verify:offline`.
- [ ] Complete the local browser walkthrough.
- [ ] Record the demo without credentials, PII, or unrelated windows visible.
- [ ] Confirm all provider claims are status-qualified.
- [ ] Confirm no final submission has been claimed or made.
- [ ] Complete the actual submission process manually.

## Limitations

This manifest distinguishes historical provider evidence from the active offline demo. It does not prove:

- A fresh provider run during this submission build.
- Current provider availability, deployment, or authentication state.
- Any booking, payment, ticketing, order, or other external write.
- Provider accuracy, latency, cost, or availability.
- Production readiness.
- Successful final submission.

All artifacts and results documented herein are from local, offline, deterministic execution with synthetic fixtures. No live provider has been invoked, authenticated, or deployed. No final submission has been made.
