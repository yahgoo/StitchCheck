# React UI Expert-Mode Handoff

## Run Settings

- **Qoder mode:** Expert.
- **Earliest start:** 22:00 Singapore time.
- **Preferred model:** Qwen3.7-Max.
- **Ownership:** Use one implementation owner; do not dispatch parallel coding agents unless a specific blocker requires it.
- **Credit target:** 250–350 credits.
- **Escalation:** Escalate to Qwen3.8-Max only for a genuine unresolved cross-file React or TypeScript blocker. Qwen3.8-Max costs 2.5x more than Qwen3.7-Max off-peak; do not use it as a default.

## Allowed Packages

Install **only** the following inside `app/`:

- `react`
- `react-dom`
- `vite`
- `@vitejs/plugin-react`
- `typescript`
- `@types/react`
- `@types/react-dom`

**No other package may be installed without stopping and reporting the package name and reason.** If a dependency beyond these seven is needed, halt the build and document why before proceeding.

## Fixed Product Truth

These facts are established and must not be altered or contradicted by the UI:

- GEM-01 passed as: `OpenRouter temporary path — not direct Gemini validation` (historical). Direct Gemini 3.7 live extraction was subsequently verified via the Interactions API.
- Direct Gemini 3.7 live extraction succeeded; schema-valid, no fallback. The browser walkthrough uses a local fixture.
- Nosana workload validated offline; live execution was not verified. Atlas Sandbox Search/Verify was verified read-only.
- Local risk and alternatives data are synthetic placeholders, not service evidence.
- The user must edit/review and explicitly confirm itinerary data before local risk or alternatives panels unlock.
- No booking, payment, verification, ticket, reservation, order, or write action may exist in the application.

## Required Labels

The following three labels must appear verbatim in the UI where their respective content is displayed:

1. `OpenRouter temporary path — not direct Gemini validation`
2. `Synthetic local placeholder — not Nosana evidence`
3. `Synthetic local placeholder — not Atlas Sandbox evidence`

Every panel, card, or comparison that renders fixture data must visibly carry the appropriate label. Labels persist across retries, replays, and state transitions.

## Build Sequence

Execute these steps in exact order:

1. **Create `app/` and install only approved packages inside it.** Run `npm init` and install exactly the seven approved packages. Verify `package.json` contains no other dependencies.
2. **Scaffold the React/Vite/TypeScript application.** Create `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/index.css`, `src/vite-env.d.ts`. Confirm `npm run dev` starts and `npm run build` succeeds with an empty App.
3. **Create local-only fixture adapters.** Create `src/data/types.ts` (interfaces matching SPECS data contracts), `src/data/labels.ts` (all disclaimer constants), and `src/data/fixtures.ts` (local fixture imports from `smoke-tests/`).
4. **Build UI components from the implementation plan.** Implement `SafetyNotice`, `UploadPanel`, `ItineraryReview`, `RiskPanel`, `AlternativesPanel`, `ComparisonView`, `DecisionPanel`, and `StatusBanner` as specified in `docs/plans/react-ui-implementation-plan.md`.
5. **Enforce confirmation gating.** The "Confirm itinerary" button is the single gate. Risk and alternatives panels display `Confirm itinerary first` and are non-interactive until `userConfirmed === true`.
6. **Render disabled, empty, error, unavailable, and timeout states.** Each panel supports all labelled states using the corresponding fixture files. No data is ever fabricated.
7. **Add comparison and no-order decision UI.** Build the side-by-side comparison and the Keep/Switch toggle. The final screen displays `noOrderCreated: true` and `syntheticDemo: true`.
8. **Run type-check and production build.** Execute `npx tsc --noEmit` and `npm run build`. Fix any errors. Confirm zero TypeScript errors and a clean production build.
9. **Run localhost browser walkthrough against every section of `docs/react-ui-acceptance-checklist.md`.** Walk the full flow: safety notice → upload → itinerary review → confirm → risk panel activates → alternatives panel activates → comparison → Keep/Switch → final confirmation. Check off every item in the acceptance checklist.
10. **Report package list, changed files, tests, remaining limitations, and exact credit use if Qoder exposes it.** List every file created under `app/`, the exact `package.json` dependency list, the `tsc` output, the `build` output, the browser walkthrough results (pass/fail per checklist item), and any known limitations.

## Non-Negotiable Constraints

- **Never access `.env.local`.**
- **No external requests, authentication, service execution, or credential use.**
- **No changes to existing Gemini evidence or provider configuration.**
- **No Nosana or Atlas SDK, endpoint, or request code.**
- **No Git operations** — no init, stage, commit, branch, remote, or push.
- **No fabricated integration claims** — no UI text, comment, or label implies a service works.
- **No modification to PRD, UAT, SPECS, smoke-test plans, or Go/No-Go records.**

## Stop and Report Conditions

The Expert run must **stop rather than improvise** if any of the following occurs:

- Any unapproved dependency is needed.
- A live service credential, request, or API is required.
- The UI requires a contract not supported by existing local fixtures.
- A safety label or confirmation gate conflicts with the UI design.
- The requested work would alter evidence or imply a service passed.

In each case, halt, document the blocker, and report it. Do not work around it silently.

## Completion Criteria

The build is accepted only when every section of `docs/react-ui-acceptance-checklist.md` is satisfied:

- **Startup and Safety Notice** — all four items pass.
- **Itinerary Input and Review** — all six items pass.
- **Confirmation Gate** — all six items pass.
- **Local Placeholder Panels** — all six items pass.
- **Comparison and Decision** — all four items pass.
- **Responsive and Accessibility Checks** — all six items pass.
- **Build Verification** — all seven items pass.

Any unchecked item is a defect that must be fixed before the build is considered complete, or documented with a demo-safe workaround.

## Stop Condition

This task creates **only**:

```
docs/plans/react-ui-expert-mode-handoff.md
```

No other file is created, modified, or deleted.
