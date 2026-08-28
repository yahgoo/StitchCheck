## Create `docs/smoke-test-atlas.md`

### Step 1 -- Create the file

**File:** `/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel/docs/smoke-test-atlas.md`

Sources (already read, read-only): `docs/hackathon-brief.md`, `docs/idea-context.md`, `docs/PRD.md`, `docs/UAT.md`, `docs/SPECS.md`, and `Atlas_Flight_Booking_Skill_Qoder_User_Guide.docx`.

Write `# Smoke Test: Atlas Sandbox Alternative Search` with these sections, reproducing the user's specified content:

1. **Purpose** -- Validate whether the Atlas Sandbox can perform a search-only alternative query and return structured results for the comparison view; explicit statement that this is a plan only and Atlas has not been authenticated, configured, called, or proven to work.
2. **P0 Requirement Coverage** -- US-09..US-13, FR-09..FR-13, UAT-16..UAT-25 plus UAT-28 and UAT-29.
3. **Hypothesis** -- The five-point hypothesis specified (structured alternatives; comparison-ready fields; honest empty/timeout/error; strictly read-only; demo-acceptable time or replay/fallback).
4. **Preconditions** -- The six items specified (read the Atlas Qoder User Guide before any future execution; synthetic inputs and Sandbox credentials only when later approved; no real passenger/payment/production data; confirm Sandbox active before every run; no capability claims until the test succeeds; no Gemini or Nosana invocation in this Atlas-only test).
5. **Minimal Search Input** -- The illustrative JSON-like request specified verbatim, with the statement that it is an illustrative contract, not an endpoint, SDK call, or code.
6. **Expected Result Contract** -- The illustrative JSON-like response specified verbatim, plus the four requirements (offerReference display-only; P0 never uses results for verify/book/pay/ticket/reserve/order; no fabricated alternatives on empty/unavailable/invalid; output clearly identified as Atlas Sandbox).
7. **Test Cases** -- Table in the exact 5-column format `| Test ID | Synthetic Input / Condition | Expected Atlas Outcome | Required UI or Safety Behavior | Pass/Fail |` with ATL-01 through ATL-12 as specified; Pass/Fail left blank.
8. **Pass Criteria** -- The eight conditions specified.
9. **Failure Decision** -- The five outcomes specified (no capability claims; record failure mode/environment/latency; no fabricated substitutes; keep P0 search-only, no scope expansion; update PRD/UAT/SPECS if the P0 contract changes).
10. **Evidence to Record After Execution** -- The ten evidence items specified, including proof no write action was attempted.
11. **Stop Condition** -- Confirm only that `docs/smoke-test-atlas.md` was created and is the only project file changed.

### Constraints honored

- Exactly one file created; no other file modified.
- No application code, packages, skills, or dependencies.
- No credential configuration, authentication, URL browsing, Atlas calls, flight searches, offer verification, orders, payments, or integration test execution.
- Every planned Atlas action in the document is read-only/search-only; the document must not claim Atlas was tested, authenticated, or works.

### Verification

- Read back `docs/smoke-test-atlas.md`; confirm ATL-01..ATL-12 present, no capability claims, all actions search-only.
- Check filesystem timestamps to confirm it is the only project file created or modified.
