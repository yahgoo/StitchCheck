# StitchCheck Demo Readiness Report

## Local Demo Readiness

**Verdict: Ready**

The local synthetic React/Vite demo under `app/` is ready for demonstration.

| Check | Status |
|---|---|
| Type-check (`tsc --noEmit`) | Pass — zero errors |
| Production build (`tsc -b && vite build`) | Pass — 37 modules, 68 ms |
| Localhost browser walkthrough | Pass — all 39 acceptance items verified |
| Confirmation-gate behavior | Pass — risk and alternatives panels show `Confirm itinerary first` and remain disabled until explicit confirmation |
| Required labels | Pass — all three exact labels visible in correct panels |
| Responsive / accessibility | Pass — desktop and mobile layouts usable, focus-visible styles present, disabled controls explain why, no color-only meaning |
| No-external-call verification | Pass — zero `fetch`, `XMLHttpRequest`, `axios`, `.env.local` references, or network primitives in `app/src/` |

## Service Evidence Status

| Service | Current Evidence | Can It Be Described as Live? | Remaining Gate |
|---|---|---|---|
| **Gemini** | Direct Gemini 3.7 live extraction succeeded via the Interactions API (`ai.interactions.create`); schema-valid, `fallbackUsed: false`. Evidence: `smoke-tests/gemini/results/results-gemini-3.7-flash-success.json`. A subsequent re-verification attempt returned a transient error and was not retried. GEM-01 was also executed via a historical OpenRouter temporary path. | **Yes.** Direct Gemini 3.7 live extraction validated. Re-verification transient error noted. | None for extraction validation. Browser walkthrough uses a local fixture. |
| **Nosana** | Nosana live job completed and reconciled offline. `riskScore: 0.2895`, `riskBand: medium`, `simulationCount: 800`, `costUsd: 0.044`. Evidence: `smoke-tests/nosana/results/evidence/*-completed_success-reconciled.json`. `@nosana/kit@2.7.5` installed. Offline tests: 75 passed, 0 failed. Browser demo uses local fallback fixture. | **Yes.** Nosana live job completed and reconciled offline. No new submission made. | No additional live submissions. Browser demo uses local fallback. |
| **Atlas** | Authentication succeeded via official Atlas Flight Booking Skill CLI (v0.3.12). Two live production searches: (1) PVG→NRT/HND returned 5 offers, (2) SIN→BKK returned 8 offers (ATL-LIVE-01). All offers `price_status: reference`, `bookable: false`. `TICKETING_ACTIVATION_REQUIRED`. Atlas Sandbox Search + Verify (ATL-SBX-SV-01): environment switch ✅, search returned 20 offers (KUL→SIN), offer list ✅, verify returned PRICE_CONFIRMATION_REQUIRED. Hard stop after Verify — no write. Environment restored to Production afterward. Evidence: `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json`. Local fixtures still labelled `Synthetic local placeholder — not Atlas Sandbox evidence`. Search-only. | **Partial.** Atlas production authentication succeeded, two live production searches returned real offers, and Atlas Sandbox Search + Verify completed (read-only, no write). No booking, payment, ticket, or order was created. | Ticketing activation pending human action at ATRIP workspace. No write action scope. |

## Demo Claims Allowed

The following claims are supportable today:

- **Local synthetic itinerary-review and correction/confirmation experience.** The app renders extracted fields from local JSON fixtures, allows the user to edit and correct them, and records correction notes.
- **Confirmation gate prevents downstream panels from unlocking early.** Risk and alternatives panels display `Confirm itinerary first` and remain `aria-disabled` until the user explicitly confirms the itinerary.
- **Local placeholder risk and alternatives UI states.** After confirmation, the risk panel shows heuristic placeholder results (success, unavailable, error, timeout, failure) and the alternatives panel shows sandbox placeholder results (success, empty, error, timeout). All carry exact disclaimer labels.
- **No booking or other external action is possible.** No UI handler, route, or button enables verify, book, pay, ticket, reserve, order, or write. The final statement explicitly denies any external action.
- **Temporary OpenRouter extraction-interface evidence only, not direct Gemini.** GEM-01 was executed via an OpenRouter temporary path. The result is labelled accordingly and is not direct Gemini validation.

## Claims Not Allowed

The following claims are **not** supportable and must not be made:

- Direct Gemini has passed. (Direct Gemini 3.7 live extraction succeeded via the Interactions API; schema-valid, `fallbackUsed: false`. A subsequent re-verification attempt returned a transient error and was not retried.)
- Nosana works or has been deployed. (Nosana live job was completed and reconciled offline. `riskScore: 0.2895`, `riskBand: medium`, `costUsd: 0.044`. Browser demo uses local fallback fixture.)
- Atlas production search has been executed via the official Skill CLI. (Atlas authentication succeeded; two live production searches returned real offers. Atlas Sandbox Search + Verify (ATL-SBX-SV-01) also completed. All offers are reference-price only with ticketing activation pending.)
- Any local placeholder is a live provider response. (All risk and alternatives data are synthetic fixture shapes.)
- Users can book, pay, reserve, ticket, or order through StitchCheck. (No such capability exists in any form.)

## Tomorrow Priorities

1. **Local UI/demo polish** — address any concrete walkthrough issue found during rehearsal (e.g. responsive edge case, label clarity, scenario-control labelling). Only if a specific defect is identified; do not rebuild for its own sake.
2. **Prepare or seek separately required human authorization and credentials for service smoke tests** — gather Gemini API configuration, Nosana program access, and Atlas Sandbox credentials. Do not execute any service within this task. Each requires explicit human approval before first use.
3. **Begin submission assets** — README for the repository, slide outline for the presentation, and a demo narrative/video plan covering the 12-step walkthrough from the operator guide.

Off-peak coding tomorrow is needed **only** for a specific reported defect, authorized integration work, or submission asset work — not broad rebuilding.

## Credit Guidance

Per the current budget plan (`docs/qoder-credit-budget-plan.md`):

| Scenario | Mode | Model | Rate | Guidance |
|---|---|---|---|---|
| Default awake work | Agent | Qwen3.7-Plus | 0.04x off-peak | Read-only reviews, small fixes, docs, one-file edits. |
| Real unresolved blocker | Agent | Qwen3.7-Max | 0.1x off-peak | Escalate only for a genuine React/TypeScript blocker. Single bounded task. |
| Overnight (if available) | Expert | Qwen3.8-Max | 0.25x off-peak | One-time tightly bounded `app/`-only refinement, strictly sandboxed. Only if available in Expert-mode selector and build is already passing. |

**Preserve at least 400 credits** for final submission materials and emergency fixes.

## Stop Condition

This report creates **only**:

```
docs/stitchcheck-demo-readiness-report.md
```

No other file is created, modified, or deleted.
