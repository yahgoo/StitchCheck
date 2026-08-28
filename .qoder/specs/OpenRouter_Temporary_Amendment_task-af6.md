## Create `docs/plans/openrouter-temporary-extraction-amendment.md`

### Step 1 -- Create the amendment file

**File:** `/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel/docs/plans/openrouter-temporary-extraction-amendment.md`

The `docs/plans/` directory already exists. Sources (read-only, in context): `docs/plans/implement-gemini-smoke-test-harness.md`, `docs/plans/execute-gemini-smoke-test.md`, `docs/smoke-test-gemini.md`, `docs/smoke-test-execution-checklist.md`, `docs/SPECS.md`, `docs/UAT.md`, plus a fresh read-only harness inspection (foundation unchanged: zero-dependency `package.json`, `run-smoke-test.mjs` with no network calls, fixtures README only, `.env.example`/`.env.local` with blank `GEMINI_API_KEY=`, `.gitignore` ignoring `.env.local`).

Write `# Amendment: Temporary OpenRouter Extraction Path` with the exact sections and mandated content:

1. **Purpose and Scope** -- OpenRouter is a temporary, separately labelled provider path to test the extraction interface while direct Gemini access is unavailable; must never be described as a successful direct Gemini smoke test; direct Gemini execution remains required on hackathon day when organizer access is available; both paths share the same synthetic fixtures and structured-output contract to enable comparison.
2. **Secret Safety** -- only `OPENROUTER_API_KEY` in the ignored local `.env.local` during the temporary phase; `.env.example` lists only empty variable names (`OPENROUTER_API_KEY=` and `GEMINI_API_KEY=`); neither secret is ever printed, logged, persisted, or committed; `.env.local` remains never-commit; secret scan plus human review before Saturday's commit.
3. **Provider Abstraction** -- provider interface letting the harness explicitly select `openrouter` or `gemini` via non-secret local configuration; default is `openrouter` only during the temporary phase; direct Gemini disabled unless explicit local provider selection and `GEMINI_API_KEY` are both present; evidence records `provider`, `modelIdentifier`, and provider mode; OpenRouter and direct-Gemini results are never merged or relabelled.
4. **Model Capability Gate** -- verify from official OpenRouter documentation that the selected model supports image input and structured JSON output before implementation; record the exact model identifier only after human approval; if no approved model supports both, stop without making a request.
5. **Rate-Limit Safety** -- maximum one attempt per GEM case in the first round; on 429 honor `Retry-After` when provided, else bounded exponential backoff with jitter; retries capped at two after the initial attempt; no indefinite loops and no concurrent requests; record 429s, retry count, delay, and final outcome in redacted evidence; a rate-limit failure is a documented test failure/blocker, never grounds to silently switch models or fabricate outcomes.
6. **Test and Evidence Rules** -- synthetic non-PII fixtures only; editable extraction fields and explicit local user confirmation preserved; zero downstream-service dependencies, calls, configuration, endpoints, or code paths; all GEM-01..GEM-08 outcomes labelled `OpenRouter temporary path`; direct-Gemini pass/fail left blank until actually executed; a temporary OpenRouter result cannot satisfy the Gemini Go/No-Go gate.
7. **Hackathon-Day Switch** -- the exact six-step sequence: organizer provides approved direct Gemini access; human adds `GEMINI_API_KEY` only to ignored local `.env.local`; human explicitly selects provider `gemini`; full GEM-01..GEM-08 matrix rerun with the same fixtures; distinct redacted Gemini evidence saved; Gemini execution gate and Go/No-Go completed without relying on the OpenRouter result.
8. **Stop Condition** -- only this amendment file is created; no implementation and no external request occur.

### Step 2 -- Verify (read-only)

1. Read back the amendment.
2. Confirm all eight sections are present with the mandated wording, including the never-merge rule, the capability-gate stop, the rate-limit caps, and the six-step switch sequence.
3. Confirm no code, dependency, env file, fixture, result, or existing document was changed.
4. Verify via filesystem timestamps (`find -newermt` + `stat -f`; workspace is not a Git repo) that the amendment file is the only project file created or modified.

### Constraints

- Amendment document only; no installs, keys, authentication, external calls, GEM execution, Git operations, or downstream-service functionality.
- Report format: Amendment file path, Required human approvals, Proposed implementation changes after approval, Remaining blockers.