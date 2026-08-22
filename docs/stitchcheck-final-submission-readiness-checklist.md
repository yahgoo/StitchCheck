# StitchCheck Final Submission Readiness Checklist

## Submission Package

- [x] `README.md` is present and accurately describes the local demo.
- [x] `docs/stitchcheck-slide-deck-outline.md` is present.
- [x] `docs/stitchcheck-demo-narrative-video-plan.md` is present.
- [x] `docs/stitchcheck-judge-qa.md` is present.
- [x] `docs/stitchcheck-submission-evidence-index.md` is present.
- [x] `docs/gemini-contract-alignment-record.md` is present.
- [x] `docs/nosana-integration-boundary.md` is present.
- [x] The local-demo operator guide (`docs/stitchcheck-local-demo-operator-guide.md`) is present.

## Local Demo Verification

- [x] Type-check passes (zero errors; `docs/stitchcheck-demo-readiness-report.md`).
- [x] Production build passes (37 modules; `docs/stitchcheck-demo-readiness-report.md`).
- [x] The local browser walkthrough passes all 39 acceptance items (`docs/react-ui-acceptance-checklist.md`, `docs/stitchcheck-demo-readiness-report.md`).
- [x] The initial downstream state visibly says `Confirm itinerary first` (`docs/react-ui-acceptance-checklist.md`, `docs/stitchcheck-demo-readiness-report.md`).
- [x] One editable extraction field is corrected before confirmation (`docs/react-ui-acceptance-checklist.md`).
- [x] Explicit confirmation unlocks downstream panels (`docs/react-ui-acceptance-checklist.md`, `docs/stitchcheck-demo-readiness-report.md`).
- [x] Required source/evidence labels are visible — all three exact labels confirmed in correct panels (`docs/react-ui-acceptance-checklist.md`, `docs/stitchcheck-demo-readiness-report.md`).
- [x] Keep/Switch remains a local choice with no external action (`docs/react-ui-acceptance-checklist.md`, `docs/stitchcheck-submission-evidence-index.md`).

## Contract and Offline Verification

- [x] Gemini offline tests: 92 passed, 0 failed (`docs/stitchcheck-submission-evidence-index.md`).
- [x] Atlas offline tests: 89 passed, 0 failed (`docs/stitchcheck-submission-evidence-index.md`).
- [x] Nosana client offline tests: 75 passed, 0 failed (`docs/stitchcheck-submission-evidence-index.md`, `docs/nosana-integration-boundary.md`).
- [x] Nosana schema-validator fixtures passed (`docs/stitchcheck-submission-evidence-index.md`).
- [x] Nosana workload skeleton simulated runs passed — 5 simulated runs, all valid (`docs/stitchcheck-submission-evidence-index.md`).
- [x] The Gemini contract-alignment correction is documented (`docs/gemini-contract-alignment-record.md`).
- [x] `executedAgainstProvider: false` remains true for local Nosana fixtures (`docs/nosana-integration-boundary.md`).
- [x] `sourceType: "synthetic-local-placeholder"` remains present for local Nosana results (`docs/nosana-integration-boundary.md`).

## Provider-Evidence Boundaries

| Provider | Safe Submission Wording | Forbidden Wording |
|---|---|---|
| Gemini | `OpenRouter temporary path — not direct Gemini validation`. Direct Gemini remains unexecuted. GEM-01 was executed via an OpenRouter temporary path with a synthetic fixture and is labelled accordingly. | Direct Gemini was tested, passed, or validated. |
| Nosana | Offline boundary and fixtures only. Credential-free read-only validation, sanitization, and offline tests are implemented. No live Nosana execution, deployment, authentication, or network request occurred. | Deployed, authenticated, integrated live, or provider result. |
| Atlas | Authentication succeeded via official Atlas Flight Booking Skill CLI (v0.3.12). Two live production searches returned real offers (PVG→NRT/HND: 5; SIN→BKK: 8 via ATL-LIVE-01). All reference-price only. Ticketing activation pending. No booking, payment, ticket, or order was created. Atlas Sandbox was not used. | Authenticated and executed via production Atlas. Sandbox not used. |
| OpenRouter | Temporary path only; not direct Gemini validation. GEM-01 results are labelled and not transferable to the Gemini API. | Direct Gemini evidence. |

## Demo Recording

1. Start from a clean local state.
2. Use only synthetic fixture data.
3. Hide terminals, credentials, `.env.local`, personal information, notifications, and unrelated tabs.
4. Show the disabled state before confirmation — downstream panels display `Confirm itinerary first`.
5. Show one user correction — edit at least one extracted itinerary field.
6. Show explicit confirmation — the user clicks *Confirm itinerary* and downstream panels unlock.
7. Show downstream panels and source labels — risk panel shows `Synthetic local placeholder — not Nosana evidence`; alternatives panel shows `Synthetic local placeholder — not Atlas Sandbox evidence`.
8. Make a local Keep/Switch choice — select one decision in the comparison view.
9. End with the no-external-action boundary — the final screen states that no booking, payment, reservation, ticket, order, verification, or other write action has been created.
10. Use the approved 90–120 second narrative from `docs/stitchcheck-demo-narrative-video-plan.md`.

## Security and Safety

- [x] No credential appears in source, docs, evidence, screenshots, or recording.
- [x] No `.env.local` content is exposed.
- [x] No PII or raw provider output appears.
- [x] No booking, payment, reservation, ticket, order, verification, or other external action is claimed or performed.
- [x] No live service call is made as part of this checklist.
- [x] No unapproved paid deployment or resource creation occurs.
- [x] No Git operation occurs before human review.

## Final Human Review

- [ ] Read the README, slides outline, demo narrative, Q&A, and evidence index.
- [ ] Confirm every provider claim is status-qualified.
- [ ] Confirm local placeholders are never presented as live results.
- [ ] Confirm the video and slides match the visible demo.
- [ ] Confirm the final submission destination and required fields manually.
- [ ] Confirm any future live smoke test has separate explicit authorization, credential scope, cost limit, timeout, and stop condition.

## Go/No-Go Decision

### Go

The local demo and documentation are ready for submission when all of the
following are true:

- The local React/Vite demo passes type-check, production build, and the
  39-item browser acceptance walkthrough.
- All required documentation assets are present and accurately describe the
  local demo, offline contract verification, and provider execution status.
- Every provider claim is status-qualified: direct Gemini is unexecuted,
  Nosana is offline-only, Atlas production authentication succeeded with
  two live read-only searches (reference-price only, ticketing pending),
  Atlas Sandbox was not used, and OpenRouter is a temporary path only.
- No credential, PII, raw provider output, or external URL appears in any
  artifact.
- No booking, payment, reservation, ticket, order, verification, or other
  write action is claimed or possible.
- The human reviewer has read and confirmed all items in the Final Human
  Review section above.

### No-Go

Stop and do not submit if any of the following conditions exist:

- A credential, secret, or API key value appears in source, documentation,
  evidence, screenshots, or recording.
- `.env.local` content is exposed in any artifact.
- A provider claim is not status-qualified (e.g., direct Gemini described as
  tested, Nosana described as deployed, or Atlas described as authenticated).
- A local placeholder is presented as a live provider result.
- An unexplained UI defect prevents the confirmation gate, source labels, or
  Keep/Switch decision from functioning as described.
- A required submission asset (README, slides outline, demo narrative, or
  evidence index) is missing.
- Any unapproved external service call has been made.
- The human reviewer has not completed the Final Human Review section.

## Current Status

The local React/Vite demo is ready for demonstration, as supported by
`docs/stitchcheck-demo-readiness-report.md` (verdict: Ready). Documentation
assets — including the README, slide deck outline, demo narrative video plan,
evidence index, contract-alignment record, and Nosana integration boundary —
are prepared and present in the repository. Direct Gemini remains unexecuted;
live Nosana execution has not occurred and the offline boundary is
credential-free; Atlas production authentication succeeded via the official
Skill CLI with two live read-only searches returning real offers (all
reference-price only, ticketing activation pending); Atlas Sandbox was not
used. Each of these provider validations is separately gated and incomplete
for full integration. Final submission has not been made; the Go/No-Go
decision and Final Human Review remain for the human reviewer to complete.
