# StitchCheck React UI Implementation Plan

## Approved Dependencies

The following packages are the **only** approved dependencies for the `app/` directory:

- `react`
- `react-dom`
- `vite`
- `@vitejs/plugin-react`
- `typescript`
- `@types/react`
- `@types/react-dom`

**No router, UI library, state-management library, or additional dependency is approved.** If a need arises for something outside this list, it must be documented and separately approved before installation.

## Local Demo Flow

The application implements the following screens and states in order:

1. **Synthetic itinerary selection/upload.** The user lands on a safety-notice screen, acknowledges the synthetic-demo warning, and selects or uploads two synthetic screenshot fixtures (mapped to the existing `smoke-tests/gemini/fixtures/` PNG files).
2. **Editable extracted itinerary review.** After upload, the app loads a pre-recorded extraction result (from `smoke-tests/gemini/results/results.json` redacted summary or a local fixture) and displays all structured fields — origin, destination, date, airline, flight number, departure time, arrival time, connection duration — as editable form fields beside the source screenshots.
3. **Explicit confirmation control.** A single "Confirm itinerary" button is the only way to proceed. The button is disabled until all required fields are populated. No downstream action fires before this confirmation.
4. **Risk panel disabled until confirmation.** The Nosana risk panel is rendered in a disabled/locked state with the message `Confirm itinerary first` until the user clicks the confirmation control.
5. **Alternative-search panel disabled until confirmation.** The Atlas alternatives panel is rendered in a disabled/locked state with the message `Confirm itinerary first` until the user clicks the confirmation control.
6. **Confirmed-state view with local placeholder risk and alternatives.** After confirmation, the risk panel displays a local synthetic placeholder risk result (sourced from `smoke-tests/nosana/fixtures/res-nos-success.json`) and the alternatives panel displays a local synthetic placeholder comparison (sourced from `smoke-tests/atlas/fixtures/result-atl-success.json` via `comparison-adapter.mjs`). Both panels carry their required disclaimer labels.
7. **Empty, error, and unavailable states.** Each panel supports labelled empty, error, timeout, and unavailable states using the corresponding fixture files. No data is ever fabricated.

## Evidence and Labels

Every screen that displays extraction, risk, or alternative content must show the following exact labels:

- **Existing extraction evidence** (from the OpenRouter temporary path):
  `OpenRouter temporary path — not direct Gemini validation`
- **Nosana local content** (all risk panel output from local fixtures):
  `Synthetic local placeholder — not Nosana evidence`
- **Atlas local content** (all alternative panel output from local fixtures):
  `Synthetic local placeholder — not Atlas Sandbox evidence`

**No local placeholder may be presented as live service evidence.** Every panel, card, or comparison that renders fixture data must visibly carry the appropriate label. Labels persist across retries, replays, and state transitions.

## Safety Behavior

### Pre-confirmation gate
- Before the user clicks "Confirm itinerary", the risk panel and alternative-search panel are **disabled** and display: `Confirm itinerary first`
- No risk calculation, alternative search, or downstream action of any kind may begin before explicit confirmation.
- The confirmation button is the single gate that transitions the app from `AwaitingConfirmation` to `RiskReady` / `AtlasSearching` states.

### Post-confirmation panels
- After confirmation, panels may display **only** local synthetic placeholders sourced from the existing fixture files.
- The risk panel shows the heuristic disclaimer and failure-cascade explanation from the Nosana fixture.
- The alternatives panel shows the sandbox-labelled comparison from the Atlas fixture.

### Forbidden actions
- No UI route, button, text, or handler may enable `verify`, `book`, `pay`, `ticket`, `reserve`, `order`, or any write action.
- The only user decision is Keep or Switch (a local state toggle, not a service call).
- The final decision screen must display: `noOrderCreated: true` and `syntheticDemo: true`.

### Atlas constraints
- Atlas content must visibly state **Sandbox/search-only** when later integrated.
- The `sourceEnvironment` label must be displayed on every Atlas result.
- No offer reuse after an environment switch; a new search is required.

### Gemini constraints
- Direct Gemini 3.7 live extraction succeeded via the Interactions API. The browser walkthrough uses a fictional local fixture, clearly labelled as such.

## Proposed File Layout

```
app/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── index.html
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root component with state machine
│   ├── App.css                   # Global styles
│   ├── index.css                 # Base reset and typography
│   ├── vite-env.d.ts             # Vite type declarations
│   ├── components/
│   │   ├── SafetyNotice.tsx       # Synthetic-demo notice and acknowledgement
│   │   ├── UploadPanel.tsx        # Screenshot selection/upload (two slots)
│   │   ├── ItineraryReview.tsx    # Editable extracted fields + confirm button
│   │   ├── RiskPanel.tsx          # Nosana risk display (disabled until confirm)
│   │   ├── AlternativesPanel.tsx  # Atlas alternatives (disabled until confirm)
│   │   ├── ComparisonView.tsx     # Side-by-side risky plan vs alternatives
│   │   ├── DecisionPanel.tsx      # Keep/Switch toggle + final confirmation
│   │   └── StatusBanner.tsx       # Reusable loading/error/empty/timeout states
│   ├── data/
│   │   ├── fixtures.ts            # Local fixture adapter: imports and re-exports
│   │   │                          #   smoke-tests/gemini/results/results.json
│   │   │                          #   smoke-tests/nosana/fixtures/res-nos-*.json
│   │   │                          #   smoke-tests/atlas/fixtures/result-atl-*.json
│   │   ├── types.ts               # TypeScript interfaces matching SPECS data contracts
│   │   └── labels.ts              # Centralised disclaimer/safety label constants
│   └── __tests__/
│       └── (only if achievable with no additional packages; otherwise omit)
└── public/
    └── (no additional assets needed; fixtures referenced from repo root)
```

Notes:
- Vite configuration uses `@vitejs/plugin-react` with default settings.
- TypeScript configuration targets ES2020, module ESNext, strict mode enabled.
- No test runner is installed; if tests are needed, they are deferred to a later approved step.
- Fixture data is imported by relative path from the repository root (`../../smoke-tests/...`) or copied into `app/src/data/fixtures/` at build time by the Expert.

## Implementation Sequence

Ordered steps for the 22:00 Expert-mode build (Qwen3.7-Max, single owner):

1. **Install only approved packages inside `app/`.** Run `npm init` and install exactly the seven approved packages. Verify `package.json` contains no other dependencies.
2. **Scaffold React/Vite/TypeScript.** Create `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/index.css`, `src/vite-env.d.ts`. Confirm `npm run dev` starts and `npm run build` succeeds with an empty App.
3. **Implement layout and synthetic data adapter.** Create `src/data/types.ts` (interfaces matching SPECS data contracts), `src/data/labels.ts` (all disclaimer constants), and `src/data/fixtures.ts` (local fixture imports). Build the `SafetyNotice`, `UploadPanel`, and `StatusBanner` components. Wire the upload flow to load the pre-recorded Gemini extraction fixture.
4. **Implement edit-and-confirm gate.** Build `ItineraryReview` with editable fields for every extracted itinerary field. Add the "Confirm itinerary" button. Enforce the gate: no panel below this point may activate until `userConfirmed === true`.
5. **Implement disabled and confirmed risk/search states.** Build `RiskPanel` and `AlternativesPanel` in their disabled state (`Confirm itinerary first`). After confirmation, wire them to load the Nosana success fixture and Atlas success fixture respectively. Build `ComparisonView` and `DecisionPanel` for the Keep/Switch flow.
6. **Add labels and forbidden-action safeguards.** Verify every panel carries its exact disclaimer label. Scan all component text, button labels, and handlers for forbidden action tokens (`verify`, `book`, `pay`, `ticket`, `reserve`, `order`, `write`). Add the final decision confirmation screen with `noOrderCreated: true` and `syntheticDemo: true`.
7. **Run type-check and build.** Execute `npx tsc --noEmit` and `npm run build`. Fix any errors. Confirm zero TypeScript errors and a clean production build.
8. **Run localhost browser walkthrough.** Open `http://localhost:5173` (or Vite default port). Walk through the full flow: safety notice → upload → itinerary review → confirm → risk panel activates → alternatives panel activates → comparison → Keep/Switch → final confirmation. Verify all labels, disabled states, empty/error states, and the confirmation gate.
9. **Report files, installed packages, and validation results.** List every file created under `app/`, the exact `package.json` dependency list, the `tsc` output, the `build` output, and the browser walkthrough results (pass/fail per screen).

## Acceptance Checklist

- [ ] Synthetic labels visible on every panel that displays fixture data.
- [ ] Gemini temporary-path label (`OpenRouter temporary path — not direct Gemini validation`) visible on the extraction review screen.
- [ ] Confirmation required before risk and alternatives panels unlock.
- [ ] No external calls made during the entire flow.
- [ ] No `.env.local` access by any component, script, or configuration.
- [ ] No service claim made (no text implies an integration works).
- [ ] No forbidden Atlas/write actions (no verify, book, pay, ticket, reserve, order, or write token in any UI element).
- [ ] Responsive desktop and mobile layout (usable at 375px and 1280px widths).
- [ ] Type-check (`npx tsc --noEmit`) and build (`npm run build`) pass with zero errors.
- [ ] Local browser walkthrough completed end-to-end with all states verified.

## Stop Condition

This task creates **only**:

```
docs/plans/react-ui-implementation-plan.md
```

No other file is created, modified, or deleted. No packages are installed. No `app/` directory is created. No external calls are made.
