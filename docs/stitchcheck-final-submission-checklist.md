# StitchCheck Final Submission Checklist

## 1. Local Demo Gate

- [ ] Type-check passes (`npm run typecheck` from `app/`).
- [ ] Production build passes (`npm run build` from `app/`).
- [ ] Local demo walkthrough passes all 39 acceptance items in `docs/react-ui-acceptance-checklist.md`.
- [ ] Confirmation gate initially blocks downstream panels.
- [ ] `Confirm itinerary first` is visible before confirmation on both Risk and Alternatives panels.
- [ ] User can edit an extracted field (origin, destination, dates, flight numbers, times, connection duration).
- [ ] User correction occurs before confirmation (e.g. second-leg flight number SC-202 → SC-299).
- [ ] Explicit confirmation unlocks downstream panels.
- [ ] Required source labels are visible:
  - `OpenRouter temporary path — not direct Gemini validation`
  - `Synthetic local placeholder — not Nosana evidence`
  - `Synthetic local placeholder — not Atlas Sandbox evidence`
- [ ] Keep/Switch decision remains local — no external action is triggered.
- [ ] No external action is available (final statement: "No booking, payment, reservation, ticket, order, verification, or other write action has been created").

---

## 2. Submission Assets

- [ ] `README.md` reviewed — public-facing project description with service roles, evidence status, and safety boundaries.
- [ ] `docs/stitchcheck-slide-deck-outline.md` reviewed — 8-slide hackathon presentation outline with speaker notes.
- [ ] `docs/stitchcheck-demo-narrative-video-plan.md` reviewed — **file does not exist yet**; video production was blocked by missing Kokoro TTS and HyperFrames CLI. The fallback recording package (`docs/stitchcheck-demo-recording-fallback.md`) and recording runbook (`docs/stitchcheck-local-recording-runbook.md`) are available instead.
- [ ] Final demo recording completed using synthetic data only.
- [ ] Recording excludes terminals, credentials, `.env.local`, notifications, personal information, and unrelated tabs.
- [ ] Narrative does not claim unexecuted provider integrations — no provider is described as live, deployed, authenticated, or validated.

---

## 3. Evidence Boundaries

| Provider | Recorded Status | Exact Safe Wording | Forbidden Claim |
|---|---|---|---|
| **Gemini** | GEM-01 executed via OpenRouter temporary path (`google/gemini-3.7-flash`). Evidence at `smoke-tests/gemini/results/`. Direct Gemini remains unexecuted. | `OpenRouter temporary path — not direct Gemini validation` | Direct Gemini was tested or passed. |
| **Nosana** | Blocked before any network request. Evidence at `smoke-tests/nosana/results/2026-08-20T15-53-43Z/`. No reviewed workload, submission mechanism, target environment, endpoint, SDK/CLI, or deployment method exists. | `Synthetic local placeholder — not Nosana evidence` | Nosana was deployed, authenticated, executed, or validated. |
| **Atlas** | Local fixtures and comparison adapter only. Not authenticated, not executed. Evidence at `smoke-tests/atlas/`. | `Synthetic local placeholder — not Atlas Sandbox evidence` | Atlas Sandbox was authenticated, executed, or validated. |

---

## 4. Safety and Scope

- [ ] No secrets, API keys, bearer tokens, wallet addresses, or credentials appear in any project file, evidence artifact, or documentation.
- [ ] No PII or raw provider output appears in any project file, evidence artifact, or documentation.
- [ ] No real booking, payment, reservation, ticket, order, or verification data appears anywhere in the repository.
- [ ] No booking, payment, reservation, ticket, order, verification, or other external write action exists in the application.
- [ ] Nosana API key is not included in project files, evidence files, documentation, or terminal output.
- [ ] The Nosana blocked result at `smoke-tests/nosana/results/2026-08-20T15-53-43Z/` remains unchanged.
- [ ] No live-service claim is inferred from local fixtures — all risk and alternatives data are labelled synthetic placeholders.

---

## 5. File and Change Review

- [ ] Only intended files changed — no unintended modifications to source, documentation, or evidence.
- [ ] `app/` is unchanged unless a specific approved defect was fixed (one minimal fix: disabled panels now render in review step in `app/src/App.tsx`).
- [ ] Smoke-test evidence files are unchanged — Gemini results, Nosana blocked record, and Atlas fixtures are intact.
- [ ] PRD (`docs/PRD.md`), UAT (`docs/UAT.md`), SPECS (`docs/SPECS.md`), and test plans are unchanged.
- [ ] `.env.local` was not accessed, read, printed, scanned, or modified.
- [ ] No Git operations were performed without human review — no init, commit, push, or remote changes.
- [ ] No generated build artifacts or temporary files are included in the submission.

---

## 6. Final Human Review

Complete this sequence before submission:

1. **Run the local demo** from the operator guide (`docs/stitchcheck-local-demo-operator-guide.md`). Walk through all six steps: safety notice → fixture selection → field review and correction → disabled panels visible → confirmation and unlock → Keep/Switch decision.
2. **Review the README, slide outline, and demo narrative together.** Confirm that all three documents tell a consistent story and use identical evidence labels.
3. **Watch the complete recording once without editing.** Confirm the six visible moments are present, narration matches the UI, and no forbidden content appears.
4. **Check every provider claim against the readiness report** (`docs/stitchcheck-demo-readiness-report.md`). Confirm no provider is described as live without valid evidence.
5. **Remove any accidental secret, PII, or external-service claim.** Search all submission artifacts for API keys, tokens, wallet addresses, personal data, and live-service assertions.
6. **Approve the final submission package manually.** Sign the operator sign-off in `docs/stitchcheck-final-recording-handoff.md` and the recording-day checklist in `docs/stitchcheck-recording-day-checklist.md`.

---

## 7. Known Open Items

The following items are explicitly open and must not be silently presented as completed integrations:

- **Direct Gemini validation remains unexecuted.** Pass/fail for direct Gemini is intentionally blank. Only the OpenRouter temporary path has been tested (GEM-01). Direct Gemini requires separate human authorization, credentials, and execution.
- **Nosana remains blocked before network access.** The project lacks the reviewed workload, submission mechanism, target environment, endpoint, SDK/CLI, and deployment method. The smoke-test attempt was intentionally stopped at the cost and safety gate. Six prerequisites must be completed before retrying (see `smoke-tests/nosana/results/2026-08-20T15-53-43Z/summary.md`).
- **Atlas Sandbox remains unauthenticated and unexecuted.** No Atlas credential, SDK, endpoint, or request code exists. Sandbox search-only execution requires separate credentials and explicit human authorization.
- **These open items must not be silently presented as completed integrations.** Any presentation, video, or document that implies Nosana or Atlas has been deployed, authenticated, or validated is inaccurate.

---

## 8. Final Go/No-Go

### GO only if

- [ ] The local demo is reproducible — a fresh browser session at http://localhost:5173/ loads the safety notice and completes the full six-step flow.
- [ ] The video and written assets are consistent — README, slide outline, and recording tell the same story with identical evidence labels.
- [ ] All evidence labels are present — all three exact labels appear in the demo UI, documentation, and recording.
- [ ] No forbidden content appears — no secrets, PII, raw provider output, credentials, or real booking/payment data in any artifact.
- [ ] Human review is complete — the operator has run the demo, watched the recording, checked all claims, and signed off.

### NO-GO if

- [ ] Any provider is described as live without valid evidence — Gemini direct, Nosana, or Atlas claimed as executed, deployed, authenticated, or validated.
- [ ] Any credential or PII appears — API keys, tokens, wallet addresses, personal data, or secret-like values in any file, recording, or documentation.
- [ ] The confirmation gate is missing or bypassable — risk and alternatives panels must show `Confirm itinerary first` and remain disabled until explicit user confirmation.
- [ ] The recording shows an external action — any booking, payment, reservation, ticket, order, verification, or write action visible or implied.
- [ ] The local demo cannot be reproduced — `npm run dev` fails, the app shows errors, or the six-step flow is broken.

---

## Accuracy Rules

- **Local-demo verdict: Ready.** The React/Vite demo passes type-check, production build, and browser walkthrough.
- **Exact three evidence labels preserved** — no paraphrasing, no abbreviation.
- **Nosana status: blocked.** Blocked before any network request. Not executed, not deployed, not authenticated.
- **No provider status upgraded** — Gemini direct remains unexecuted, Nosana remains blocked, Atlas remains unauthenticated.
- **No unsupported dates, URLs, metrics, or performance claims added.**
