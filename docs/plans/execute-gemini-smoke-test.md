# Execute Gemini Smoke Test: Plan

## Objective
Execute GEM-01 through GEM-08 using synthetic flight-itinerary screenshots and
produce evidence showing whether Gemini can return the required structured
itinerary fields, as defined in `docs/smoke-test-gemini.md` and governed by
`docs/smoke-test-execution-checklist.md`.

This is a plan only. Nothing described here has been executed, and no
integration is claimed to work.

## Repository Findings
Facts recorded from repository inspection; nothing invented:
- Stack and package manager: none found. No `package.json`, lockfile,
  `requirements.txt`, `pyproject.toml`, `go.mod`, or `Cargo.toml` exists. The
  workspace contains documentation artifacts and presentation files only.
- Existing Gemini-related code or configuration: none found.
- Recommended isolated harness location: a new self-contained directory
  (e.g. `smoke-tests/gemini/`) at the workspace root, kept separate from
  `docs/` and from any future main P0 application. Exact path is proposed and
  pending approval.
- Existing environment-variable convention: none found. No `.env.example`,
  no `.gitignore`, and the workspace is not a Git repository.
- Existing test/fixture conventions: none found. No image assets, test
  directories, or fixture conventions exist.
- Gaps or blockers:
  - No application stack exists, so the harness language/runtime requires
    explicit human approval before implementation (not chosen in this plan).
  - A secret-handling convention (local ignored environment file) must be
    created and approved, since none exists.
  - Source-control status for new files is undefined because the workspace is
    not a Git repository; this must be resolved before any secret-bearing file
    is created.

## Allowed Scope
After this plan is approved, exactly the following may be created:
- An isolated Gemini smoke-test harness.
- Synthetic test-image fixtures only.
- A local ignored environment file or approved secret-store entry.
- A machine-readable result artifact with no secrets or PII.
- A human-readable evidence report.
- Minimal package additions only if required by the existing project stack.

The main P0 application is out of scope.

## Safety Gates Before Execution
- [ ] Gemini API access is human-approved.
- [ ] Key is stored only in an ignored local environment file or approved
      secret store; never source-controlled.
- [ ] All images are synthetic and contain no PII.
- [ ] No Atlas or Nosana call will occur.
- [ ] Structured output contract matches `docs/SPECS.md`.
- [ ] Test output redacts secrets and sensitive content.
- [ ] Test harness is separate from main app code.

## Proposed Harness Design
Described without code:
- Input: one or two local synthetic screenshots per test case, drawn from the
  fixture set covering GEM-01 through GEM-07 scenarios.
- Gemini request: multimodal extraction of the screenshots with a structured
  response matching the contract in `docs/smoke-test-gemini.md`.
- Output: the structured contract fields (extractionStatus, firstLeg,
  secondLeg, connectionDurationMinutes, missingFields, fieldConfidence,
  validationMessages, requiresUserConfirmation, syntheticDemo).
- Validation: covers required fields, missing fields, invalid inputs,
  malformed output, timeout, and error cases.
- Evidence capture: latency, result status, missing fields, validation
  messages, model/version, and redacted raw response.
- Confirmation gate: the harness must show that no Nosana or Atlas action is
  possible or triggered; extraction ends at the structured result awaiting
  user review and confirmation.

## GEM Test Execution Matrix

| Test ID | Fixture Needed | Expected Result | Evidence to Capture | Pass/Fail |
|---|---|---|---|---|
| GEM-01 | Clear synthetic two-leg itinerary | extractionStatus success; all core fields populated | Raw redacted response, extracted fields, latency | |
| GEM-02 | Synthetic itinerary with optional field missing | success or partial; missing field flagged | missingFields list, redacted response | |
| GEM-03 | Difficult/fragmented layout | success or partial; low-confidence fields noted | fieldConfidence map, redacted response | |
| GEM-04 | Non-itinerary synthetic image | extractionStatus invalid with validationMessages | Validation messages, redacted response | |
| GEM-05 | Unreadable required field | partial; unreadable field in missingFields | missingFields list, validation messages | |
| GEM-06 | Malformed/unavailable structured output | extractionStatus error | Error detail, retry behavior | |
| GEM-07 | Model timeout or service error | extractionStatus error | Timeout detail, latency, retry path | |
| GEM-08 | GEM-01 fixture plus a corrected field | Corrected value recorded; confirmation explicit | Pre/post correction record, confirmation event | |

## File Change Plan
All paths below are proposed and pending approval; none exist yet.

| Planned File | Purpose | Source-Control Status | Created Only After Approval |
|---|---|---|---|
| Proposed harness directory (e.g. `smoke-tests/gemini/`) entry script | Isolated Gemini extraction harness | Proposed; workspace is not a Git repo — status must be resolved first | Yes |
| Proposed fixtures directory (e.g. `smoke-tests/gemini/fixtures/`) | Synthetic screenshot fixtures for GEM-01..GEM-07 | Proposed | Yes |
| Proposed local env file (e.g. `smoke-tests/gemini/.env.local`) | Gemini API key, never source-controlled | Proposed; ignore convention must be established first | Yes |
| Proposed result artifact (e.g. `smoke-tests/gemini/results.json`) | Machine-readable results, no secrets/PII | Proposed | Yes |
| Proposed evidence report (e.g. `docs/evidence/smoke-test-gemini-results.md`) | Human-readable execution evidence | Proposed | Yes |

## Acceptance and Go/No-Go
- Gemini is "Go" only if it has an essential, visible, app-consumed role:
  structured itinerary extraction used by the eventual UI.
- The test must prove user correction/confirmation is possible before any
  downstream service is permitted.
- A failed test must not be hidden behind mock output or a decorative
  integration.
- Any changed P0 contract requires updates to PRD, UAT, and SPECS.

## Stop Condition
Confirm only that `docs/plans/execute-gemini-smoke-test.md` was created and is
the only project file changed.
