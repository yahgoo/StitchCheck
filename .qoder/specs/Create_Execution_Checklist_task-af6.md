## Create `docs/smoke-test-execution-checklist.md`

### Step 1 -- Create the file

**File:** `/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel/docs/smoke-test-execution-checklist.md`

Sources (already read, read-only): `docs/smoke-test-gemini.md`, `docs/smoke-test-nosana.md`, `docs/smoke-test-atlas.md`, `docs/SPECS.md`, `docs/UAT.md`, `Atlas_Flight_Booking_Skill_Qoder_User_Guide.docx`.

Write `# StitchCheck: Smoke-Test Execution Checklist` with these sections per the user's specification:

1. **Purpose** -- Checklist controls later, human-approved execution of the three independent smoke tests; explicit statement that this document does not execute any test or establish that any integration works.
2. **Execution Order** -- 1. Gemini, 2. Nosana, 3. Atlas Sandbox; brief note that each test is independent and must be documented before building the integrated P0 application.
3. **Global Safety Gate** -- The exact 7-row `| Check | Required Evidence | Pass/Fail |` table specified (synthetic data only; no production credentials; Atlas Sandbox confirmed; Atlas search-only scope; no fabricated evidence; secrets protection; rollback readiness), Pass/Fail blank.
4. **Gemini Execution Gate** -- Table covering the nine specified items (synthetic inputs for GEM-01..GEM-08; confirmed model/API configuration; structured response evidence; extraction accuracy and missing-field outcomes; user correction/confirmation gate; latency; error/timeout behavior; pass/fail decision; evidence link/path), Pass/Fail blank; plus the statement that integrated P0 implementation must not proceed if Gemini cannot have an essential, visible, app-consumed role.
5. **Nosana Execution Gate** -- Table covering the eleven specified items (non-PII synthetic request; deployment method; job/service reference; visible status transitions; structured risk result; heuristic disclaimer; timeout/error/replay; proof no PII transmitted; latency; pass/fail; evidence link/path); plus the equivalent essential-role stop statement.
6. **Atlas Execution Gate** -- Table covering the twelve specified items (Sandbox confirmation; search-only authorization configuration; synthetic search input; status transitions; comparison-ready result fields; empty/error/timeout behavior; Sandbox labelling proof; proof no verify/book/pay/ticket/reserve/order attempted; environment-switch behavior and no offer reuse; latency; pass/fail; evidence link/path); plus the essential search-role stop statement.
7. **Evidence Log Format** -- The exact 10-column table specified, with one blank template row.
8. **Go/No-Go Decision** -- The exact 5-column table specified (one row per service), plus the four decision rules: Go requires all three pass; failures documented before P0 scope changes; P0 changes require updates to `docs/PRD.md`, `docs/UAT.md`, `docs/SPECS.md`; no decorative integrations to compensate for failed tests.
9. **Stop Condition** -- Confirm only that `docs/smoke-test-execution-checklist.md` was created and is the only project file changed.

### Constraints honored

- Exactly one file created; no other file modified.
- No application code, packages, skills, or dependencies.
- No credential configuration, authentication, browsing, external API calls, image uploads, Nosana job submissions, or Atlas searches.
- The document must contain no credentials, endpoints, commands, or API calls, and must not claim any smoke test executed or passed.

### Verification

- Read back the document; confirm no execution claims and no credentials/endpoints/commands/API calls.
- Check filesystem timestamps to confirm it is the only project file created or modified.
