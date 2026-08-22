Execute the approved React UI Expert-mode implementation handoff.

Read and follow exactly:
@docs/plans/react-ui-expert-mode-handoff.md
@docs/plans/react-ui-implementation-plan.md
@docs/react-ui-acceptance-checklist.md

Implement the UI under `app/` only.

You have approval to install exactly these packages inside `app/`:
- react
- react-dom
- vite
- @vitejs/plugin-react
- typescript
- @types/react
- @types/react-dom

Use one implementation owner. Do not dispatch parallel coding agents unless a
specific blocker requires it.

Follow every build step, constraint, stop/report condition, and acceptance
check in the handoff. Run type-check, production build, and a localhost browser
walkthrough. Stop immediately and report if any unapproved dependency, service
credential, external request, or safety conflict is required.

Return only:
- Changed files
- Exact packages installed
- Type-check result
- Build result
- Browser-walkthrough result
- External calls made
- Remaining limitations
- Credit use, if available