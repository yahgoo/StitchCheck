## Create `docs/smoke-test-gemini.md`

### Step 1 -- Create the file

**File:** `/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel/docs/smoke-test-gemini.md`

Sources (already read, read-only): `docs/hackathon-brief.md`, `docs/idea-context.md`, `docs/PRD.md`, `docs/SPECS.md`.

Write `# Smoke Test: Gemini Screenshot Extraction` with these sections, reproducing the user's specified content:

1. **Purpose** -- Validate the highest-risk first step: whether Gemini can extract a usable, structured itinerary from two synthetic, unbooked ticket/checkout screenshots.
2. **P0 Requirement Coverage** -- US-03/04/05/09, FR-03/04/05, UAT-06/07/08/09.
3. **Hypothesis** -- The specified testable hypothesis statement verbatim.
4. **Preconditions** -- The four specified items (synthetic only; no PII; confirm official Gemini docs before implementation; no API capability claim until the test succeeds).
5. **Minimal Test Inputs** -- Requirements only, no images created: the five input categories specified.
6. **Expected Structured Output Contract** -- The illustrative JSON-like shape specified verbatim, plus the statement that Nosana risk scoring and Atlas Sandbox search must not begin until the user reviews, corrects if needed, and confirms the data.
7. **Test Cases** -- Table in the exact 5-column format `| Test ID | Synthetic Input | Expected Extraction Outcome | Required Safety or UI Behavior | Pass/Fail |` with GEM-01 through GEM-08 as specified; Pass/Fail left blank.
8. **Pass Criteria** -- The six conditions specified.
9. **Failure Decision** -- The four outcomes specified (do not proceed; record failure mode; user-entered fallback only if Gemini's essential visible role is preserved; update PRD/UAT/SPECS if the P0 contract changes).
10. **Evidence to Record After Execution** -- The eight evidence items specified.
11. **Stop Condition** -- Confirm only that `docs/smoke-test-gemini.md` was created and is the only project file changed.

### Constraints honored

- Exactly one file created; no other file modified.
- No application code, packages, skills, or dependencies.
- No credential configuration, authentication, Gemini calls, URL browsing, image uploads, or integration test execution.
- The document must not claim Gemini was tested or works.

### Verification

- Read back `docs/smoke-test-gemini.md`; confirm it makes no claim that Gemini was tested or works.
- Check filesystem timestamps to confirm it is the only project file created or modified.
