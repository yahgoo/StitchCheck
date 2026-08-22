# StitchCheck Local Demo Operator Guide

## Purpose

This guide operates the **local synthetic** StitchCheck React/Vite demo. It does **not** prove that direct Gemini, Nosana, or Atlas is live or validated. All data displayed is fictional, local, and contains no PII. No external service is called at any point.

## Start Locally

All commands run from the `app/` directory. These are **local commands only** — no external service calls occur.

```bash
# Install dependencies (approved packages only)
npm install

# Type-check without emitting files
npm run typecheck

# Production build
npm run build

# Development server (localhost)
npm run dev

# Preview production build locally
npm run preview
```

## Recommended Demo Path

1. **Open the local app** at the URL shown by `npm run dev` (typically `http://localhost:5173`).
2. **Read and acknowledge the synthetic-demo notice.** The safety notice must be visible before proceeding. Click *I understand — continue with synthetic data*.
3. **Select synthetic itinerary fixture(s).** Choose from the provided synthetic screenshot fixtures (GEM-01 through GEM-05). These are fictional images only.
4. **Show the editable itinerary review.** Extracted fields (origin, destination, dates, flight numbers, times, connection duration) are displayed in editable inputs beside the source screenshots.
5. **Correct one field visibly.** Change any field — for example, correct the second-leg flight number from `SC-202` to `SC-299`. Correction notes appear automatically.
6. **Point out that risk and alternatives are disabled.** Both panels show: `Confirm itinerary first`. All controls are locked with a visible lock icon and `aria-disabled="true"`.
7. **Confirm the itinerary explicitly.** Click *Confirm itinerary*. A status banner appears confirming no external call was made.
8. **Show the local risk placeholder and its heuristic disclaimer.** The risk panel displays a risk band (e.g. "medium") with the disclaimer: *Heuristic risk estimate only — not a live delay, weather, legal, or guaranteed-outcome prediction.*
9. **Show local Atlas Sandbox-labelled alternatives.** The alternatives panel displays synthetic results labelled: *Source environment: sandbox-placeholder*. Each result is fictional and display-only.
10. **Compare the original itinerary with alternatives.** The comparison view shows the self-transfer plan side-by-side with safer alternatives in a table.
11. **Choose Keep or Switch as a local UI-only decision.** Select either option and confirm. The final statement appears.
12. **Show the final no-order/no-external-action statement.** The screen displays: *No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only.*

## Required Speaking Labels

Point out each of these exact labels during the demo at the indicated moments:

| Label | When to show |
|---|---|
| `OpenRouter temporary path — not direct Gemini validation` | On the itinerary review screen, beside extracted fields. Visible from step 4 onward. |
| `Synthetic local placeholder — not Nosana evidence` | On the risk panel, after confirmation (step 8). Visible in the panel header and disclaimer. |
| `Synthetic local placeholder — not Atlas Sandbox evidence` | On the alternatives panel, after confirmation (step 9). Visible in the panel header and each alternative card. |

## Safety Talking Points

- **All itinerary data and screenshots are synthetic and contain no PII.** Airport codes (AAA/BBB/CCC), flight numbers (SC-101/SC-202), dates, and prices are invented. No real passenger, booking reference, or payment data exists.
- **Human review, correction, and explicit confirmation gate downstream panels.** The user must review extracted fields, may correct them, and must explicitly confirm before risk or alternatives panels activate.
- **No booking, payment, reservation, ticket, order, verification, or other external action occurs.** This is stated explicitly in the final screen and in the footer of every page.
- **Risk and alternative examples are local placeholders, not claimed live service results.** The risk panel uses Nosana fixture shapes; the alternatives panel uses Atlas fixture shapes. Neither represents a live service call.

## Scenario Controls

After itinerary confirmation, both the risk panel and alternatives panel expose a **Demo scenario** dropdown. These switch between local fixture shapes to demonstrate different UI states. **None of these represent live service behaviour.**

### Risk panel scenarios

| Scenario | What it shows |
|---|---|
| **Success** | Risk band "medium" with score 0.42 and heuristic disclaimer. |
| **Unavailable** | No risk band produced; no score invented; replay/proceed options shown. |
| **Error** | Validation error before any workload; error code `SIMULATED_INVALID_REQUEST`; retry option. |
| **Timeout** | Workload exceeded time budget; error code `SIMULATED_WORKLOAD_TIMEOUT`; retry option. |
| **Workload Failure** | Workload failed internally; error code `SIMULATED_WORKLOAD_FAILURE`; retry option. |

### Alternatives panel scenarios

| Scenario | What it shows |
|---|---|
| **Success** | Two synthetic alternatives (one-stop and nonstop) with placeholder prices. |
| **Empty** | No results found; retry option shown; no alternatives fabricated. |
| **Error** | Search failed; error code `SYNTHETIC_SEARCH_FAILED`; retry option. |
| **Timeout** | Search did not complete in time; error code `SYNTHETIC_SEARCH_TIMEOUT`; retry option. |

## Known Limitations

- **No live direct-Gemini execution in the app.** Extraction data comes from local JSON fixtures derived from a prior OpenRouter temporary-path smoke test.
- **No live Nosana execution.** Risk results are pre-built fixture shapes.
- **No live Atlas Sandbox execution.** Alternative results are pre-built fixture shapes.
- **Data resets after page reload.** All state is in-memory; no persistence.
- **Browser walkthrough is available; no automated unit-test runner is installed.** Validation relies on manual browser testing against the acceptance checklist.

## Pre-Demo Checklist

- [ ] Run `npm run typecheck` — confirm zero errors.
- [ ] Run `npm run build` — confirm production build succeeds.
- [ ] Start localhost app with `npm run dev`.
- [ ] Confirm three required labels are visible during walkthrough.
- [ ] Demonstrate correction of at least one field before confirmation.
- [ ] Demonstrate that risk and alternatives panels are disabled with `Confirm itinerary first` before confirmation.
- [ ] Demonstrate the final no-order statement after decision confirmation.
- [ ] Do not open `.env.local` or use credentials.

## Stop Condition

This guide creates **only**:

```
docs/stitchcheck-local-demo-operator-guide.md
```

No other file is created, modified, or deleted.
