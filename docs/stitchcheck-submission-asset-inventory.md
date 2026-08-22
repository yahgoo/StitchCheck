# StitchCheck Submission Asset Inventory

## Submission Objective

This package presents a reproducible local demo with honest, explicitly bounded provider evidence. The StitchCheck React application demonstrates a review-first itinerary-risk workflow using synthetic fixture data. Every provider claim is labelled with its exact evidence boundary. No provider has been executed, authenticated, or deployed beyond the documented limits.

---

## Asset Inventory

| Asset | Path | Status | Human action |
|-------|------|--------|--------------|
| Project README | `README.md` | Ready for review | Review and confirm accuracy. |
| Local demo operator guide | `docs/stitchcheck-local-demo-operator-guide.md` | Ready for use | Follow the 12-step demo path during recording. |
| Slide deck outline | `docs/stitchcheck-slide-deck-outline.md` | Ready for slide creation | Build slides from the outline. |
| Demo narrative / video plan | `docs/stitchcheck-demo-narrative-video-plan.md` | Ready for recording | Use as the narration and timeline reference. |
| Recording-day readiness | `docs/stitchcheck-recording-day-readiness.md` | Preflight guidance ready | Use as the recording-day planning reference. |
| Recording cue card | `docs/stitchcheck-demo-recording-cue-card.md` | Ready for recording | Use as the live recording prompt. |
| Final submission checklist | `docs/stitchcheck-final-submission-checklist.md` | Ready for human sign-off | Complete all checkboxes and sign off. |
| Final audit | `docs/stitchcheck-final-submission-audit.md` | GO | Review the audit verdict before submission. |
| Recording preflight | `docs/stitchcheck-recording-preflight-result.md` | READY TO RECORD LOCALLY | Confirm type-check and build still pass before recording. |
| Gemini evidence artifacts | `smoke-tests/gemini/results/results.json`, `smoke-tests/gemini/results/evidence-stub.md` | Bounded evidence only (GEM-01 via OpenRouter temporary path) | Review evidence boundaries; do not upgrade claims. |
| Nosana blocked evidence | `smoke-tests/nosana/results/2026-08-20T15-53-43Z/` | Blocked before any network request | Review the blocked-evidence record; do not upgrade claims. |
| Atlas local artifacts | `smoke-tests/atlas/fixtures/`, `smoke-tests/atlas/README.md` | Local-only, unexecuted | Review evidence boundaries; do not upgrade claims. |

**Note:** Assets listed as outlines, plans, or checklists are not completed videos, slide decks, or recordings. They are preparation documents for human-created deliverables.

---

## Human-Created Assets Still Needed

1. **Local demo recording** — a screen recording of the approximately 100-second walkthrough using the cue card and operator guide.
2. **Slide deck built from the outline** — presentation slides created from `docs/stitchcheck-slide-deck-outline.md`.
3. **Final human review / sign-off** — a human reviewer completes the final submission checklist and confirms all evidence boundaries.
4. **Submission-form text and any required metadata** — hackathon submission platform fields (description, team, links, etc.) completed by the human submitter.
5. **Final package / archive, if the submission platform requires one** — any bundled archive of the repository and recording, packaged only after human review.

---

## Provider Evidence Matrix

| Provider | What is supported | What is not supported | Exact label / status |
|----------|------------------|----------------------|---------------------|
| Gemini | GEM-01 extraction via OpenRouter temporary path; structured-extraction functionality demonstrated with synthetic input. | Direct Gemini was not called, validated, or executed. No other GEM test cases were executed. | `OpenRouter temporary path — not direct Gemini validation` |
| Nosana | Local workload skeleton and fixture harness exist. A smoke-test attempt was intentionally blocked before any network request due to missing infrastructure. | Nosana was not deployed, authenticated, executed, or validated. No workload was submitted. No result was returned. | `Synthetic local placeholder — not Nosana evidence` — blocked before any network request |
| Atlas | Local fixture adapter and synthetic alternative shapes exist for the demo UI. | Atlas Sandbox was not authenticated, executed, or validated. No search was performed. No result was returned. | `Synthetic local placeholder — not Atlas Sandbox evidence` |

---

## Recording Handoff

1. **Read the recording-day readiness report.** Review `docs/stitchcheck-recording-day-readiness.md` for preflight checks, required takes, narration constraints, and go/no-go criteria.
2. **Start the local app using the documented command.** Run `npm run dev` from `app/` and confirm the app loads at http://localhost:5173/ with the safety notice visible.
3. **Follow the six cue-card blocks.** Use `docs/stitchcheck-demo-recording-cue-card.md` as the live recording prompt. Each cue specifies what to do, say, and show.
4. **Capture a clean approximately 100-second take.** Record the full walkthrough in one continuous take. Use the recovery cues if a segment needs retaking.
5. **Have a human reviewer inspect the take against the final checklist.** Compare the recording against `docs/stitchcheck-final-submission-checklist.md` and confirm all evidence labels, safety boundaries, and narration constraints are met.

---

## Final Safety Gate

- No credentials or `.env.local` in media or documentation.
- No live-service execution without separate authorization.
- No provider status upgrades — all claims must remain within documented evidence boundaries.
- No real booking, payment, reservation, ticket, order, or verification action.
- No Git commit or submission packaging before human review.

---

## Handoff Status

- **Local demo:** Ready to record.
- **Documentation and evidence boundaries:** Consistent.
- **Human recording:** Pending.
- **Human submission review:** Pending.
- **Live-provider validation:** Not required for this handoff and remains separately gated.
