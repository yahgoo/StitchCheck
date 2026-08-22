# StitchCheck Session Handoff — 2026-08-20

## Resume Instruction

At 22:00 Singapore time:

- Switch Qoder to Expert mode.
- Select Qwen3.7-Max.
- Open and run `2200 prompt.md`.
- Use one implementation owner only.
- Do not dispatch parallel coding or QA agents unless a concrete blocker occurs.
- Target 250–350 credits for the UI build.
- Escalate to Qwen3.8-Max only for a genuine unresolved cross-file React or TypeScript blocker.

## Current Project State

- The 22:00 React/Vite implementation is planned and preflight-audited as **Ready**.
- No React/Vite application exists yet under `app/`.
- No UI packages have been installed.
- GEM-01 passed only as: `OpenRouter temporary path — not direct Gemini validation`
- Human correction and confirmation evidence for GEM-01 is recorded.
- Direct Gemini remains unexecuted.
- Nosana remains unconfigured and unexecuted.
- Atlas Sandbox remains unconfigured and unexecuted.

## Completed Preparation Artifacts

- `docs/plans/react-ui-implementation-plan.md`
- `docs/react-ui-acceptance-checklist.md`
- `docs/plans/react-ui-expert-mode-handoff.md`
- `docs/qoder-credit-budget-plan.md`
- `app-fixture-contracts/stitchcheck-ui-demo-data.json`
- `app-fixture-contracts/stitchcheck-ui-copy-map.json`
- `smoke-tests/gemini/results/results.json`
- `smoke-tests/gemini/results/evidence-stub.md`
- `smoke-tests/nosana/`
- `smoke-tests/atlas/`

## Approved UI Dependencies

The following packages are the **only** approved dependencies for the `app/` directory:

- `react`
- `react-dom`
- `vite`
- `@vitejs/plugin-react`
- `typescript`
- `@types/react`
- `@types/react-dom`

**Any other dependency requires stopping and reporting the package name and reason before install.**

## Fixed Product and Evidence Rules

- Existing Gemini evidence must retain: `OpenRouter temporary path — not direct Gemini validation`
- Local risk content must retain: `Synthetic local placeholder — not Nosana evidence`
- Local alternatives content must retain: `Synthetic local placeholder — not Atlas Sandbox evidence`
- Local placeholders never prove a service integration works.
- User review, correction, and explicit itinerary confirmation are required before local risk or alternatives panels unlock.
- The UI must never enable verify, book, pay, ticket, reserve, order, write, or any other external action.

## Safety Rules

- Never access `.env.local` during the UI build.
- No external network request, authentication, credential use, or service execution.
- Do not change Gemini evidence, provider settings, or fixture data.
- Do not add Nosana or Atlas SDKs, endpoints, credentials, or request code.
- Do not modify PRD, UAT, SPECS, smoke-test plans, execution checklist, or Go/No-Go records.
- Do not initialize Git, stage, commit, create branches, add remotes, or push.

## 22:00 Completion Checks

The Expert-mode build must:

1. Install only the seven approved packages inside `app/`.
2. Build the React/Vite/TypeScript local demo.
3. Consume only local synthetic fixture contracts.
4. Enforce the confirmation gate.
5. Render disabled, confirmed, empty, error, unavailable, and timeout states.
6. Show all required labels.
7. Run type-check and production build.
8. Complete localhost browser walkthrough using `docs/react-ui-acceptance-checklist.md`.
9. Report changed files, packages installed, validations, limitations, external calls made, and credit usage if available.

## Stop and Report Conditions

Stop rather than improvising if:

- An unapproved package is required.
- Any credential, API call, authentication, or live service is needed.
- Existing local fixtures cannot support a UI requirement.
- A safety label or confirmation gate conflicts with the design.
- Any task would alter evidence or imply an unexecuted service passed.

## Next Action

At 22:00, run `2200 prompt.md` in Expert mode with Qwen3.7-Max.
