## Create `docs/plans/implement-gemini-smoke-test-harness.md`

### Step 1 -- Create the file

**File:** `/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel/docs/plans/implement-gemini-smoke-test-harness.md`

Sources (already read, read-only): `docs/plans/execute-gemini-smoke-test.md`, `docs/smoke-test-gemini.md`, `docs/smoke-test-execution-checklist.md`, `docs/SPECS.md`, `docs/UAT.md`, plus a fresh read-only workspace inspection (no app code, no Git repo, no `.gitignore`; Node v24.14.1 and npm 11.11.0 detected locally).

Write `# Implement Gemini Smoke-Test Harness: Plan` with the sections exactly as the user specified:

1. **Confirmed Technical Decisions** -- record the approved decisions: React + Vite + TypeScript for the eventual P0 prototype; Node.js/npm for the isolated harness; harness kept separate from the future P0 app; synthetic-only fixtures with no PII; Gemini's essential visible app-consumed role (structured itinerary extraction shown for user review/correction); zero Nosana/Atlas packages, configuration, SDK, API calls, or dependencies; Git commits/pushes intentionally deferred until Saturday's hackathon (no init/stage/commit/branch/remote/push now); never place the Gemini API key anywhere that could later be committed.

2. **Secret-Safety Design** -- root `.gitignore` created before any secret file even though Git is deferred; ignored key file named `.env.local` containing only `GEMINI_API_KEY` locally, never committed/displayed/logged/copied; tracked `.env.example` documents only the empty variable name; harness fails safely with a clear missing-key status without exposing values; results/evidence redact headers, env values, and secret-like strings; before Saturday's commit: secret scan, confirm `.env.local` ignored and no key in tracked/staged content.

3. **Proposed Project Layout** -- minimal layout keeping the future React/Vite P0 app separate, harness under `smoke-tests/gemini/`, fixtures under the harness, results artifact and evidence report under the harness, no production app files; all paths labelled proposed until approval.

4. **Harness Behavior** -- reads one or two local synthetic fixtures; sends a multimodal Gemini extraction request; validates the SPECS/GEM structured output contract; records latency, model identifier, test ID, status, missing fields, validation messages, redacted response summary; handles malformed input, missing fields, invalid structured output, timeout, API error, missing API key; proves no Nosana/Atlas reachability (no related packages, config, network targets, or code paths).

5. **User Confirmation Demonstration** -- minimal local review artifact/interface showing extracted fields as editable with an explicit confirmation state required before any downstream action could be enabled; state that no downstream action exists in this harness.

6. **GEM-01 Through GEM-08 Mapping** -- the mandated 5-column table (`| Test ID | Harness Scenario | Fixture/Input | Expected Outcome | Evidence |`), eight rows, no Pass/Fail outcomes since execution has not occurred.

7. **Proposed File Changes** -- the mandated 5-column table (`| Proposed File | Why Needed | Contains Secrets? | Commit Status Saturday | Created After Approval? |`) covering root `.gitignore`, `.env.example`, `smoke-tests/gemini/` harness files, fixtures, results artifact, evidence report; `.env.local` marked "Never commit"; `.gitignore` and `.env.example` marked "Commit Saturday after review".

8. **Saturday Pre-Commit Gate** -- the exact seven unchecked checkboxes specified by the user.

9. **Execution Prerequisites** -- the exact seven unchecked checkboxes specified by the user.

10. **Stop Condition** -- this planning task creates only `docs/plans/implement-gemini-smoke-test-harness.md` and changes no other project file.

### Step 2 -- Verify (read-only)

1. Read back the document.
2. Confirm it contains no Git operations other than documenting the deferred Saturday pre-commit safety gate (no init/stage/commit/branch/remote/push actions planned for this task).
3. Confirm every proposed file is labelled proposed/pending approval and no implementation, installs, fixtures, env files, credentials, or Gemini calls occur.
4. Verify via filesystem timestamps (`find -newermt` + `stat -f`; workspace is not a Git repo) that the new plan file is the only project file created or modified.

### Constraints

- No implementation of any kind; plan document only.
- No modification of any existing documentation or other file.
- No package installs, Git operations, Vite app creation, npm manifests, fixtures, `.env` files, credentials, authentication, or Gemini calls.
- Report format: Plan file path, Proposed files after approval, Required human approvals, Blockers.