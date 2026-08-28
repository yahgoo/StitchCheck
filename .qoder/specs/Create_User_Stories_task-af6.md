## Create `docs/user-stories.md`

### Step 1 -- Create the file

**File:** `/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel/docs/user-stories.md`

Sources (already read, read-only): `docs/hackathon-brief.md`, `docs/research-synthesis.md`, `docs/idea-context.md`.

Write `# StitchCheck: User Stories` with these sections, following the user's specification exactly:

1. **Scope** -- The specified scope statement: stories cover only P0 (synthetic screenshot upload -> Gemini extraction and user confirmation -> Nosana risk score -> Atlas Sandbox safer-alternative search -> Keep or Switch). P0 ends at the Keep/Switch decision; Atlas booking, payment, offer verification, real users, real PII, and production integrations are out of scope.
2. **Primary Persona** -- `### Budget Self-Transfer Traveller` with the specified description.
3. **P0 User Stories** -- Thirteen stories US-01 through US-13, each in the mandated format (`**User story:**` plus Given/When/Then/And `**Acceptance criteria:**`), covering in order:
   - US-01 upload two synthetic unbooked ticket/checkout screenshots
   - US-02 clear synthetic-demo labelling, no real personal data
   - US-03 Gemini-extracted structured fields (origin, destination, date, airline, flight number when available, departure/arrival times, connection duration)
   - US-04 user review/correction/explicit confirmation before risk calculation or search
   - US-05 understandable validation feedback for unreadable/incomplete/non-two-leg inputs
   - US-06 Nosana-derived connection-risk result from non-PII static/historical data
   - US-07 plain-language failure-cascade explanation, not a guarantee or real-time prediction
   - US-08 visible Nosana workload status: loading, completion, timeout, error, labelled replay/fallback
   - US-09 Atlas Sandbox-backed safer alternatives in a comparison table
   - US-10 Atlas search loading/empty/timeout/error states with retry or replay
   - US-11 comparison of risky self-transfer vs safer alternative using system-labelled information
   - US-12 single Keep or Switch decision
   - US-13 final decision state confirming the choice and stating P0 created no booking/payment/reservation/order
4. **Cross-Cutting Safety Stories** -- Stories covering the six specified topics: no real PII/payments/production credentials/bookings; Atlas search-only in P0; no Atlas write action in P0; risk is a heuristic not a guarantee; synthetic inputs and fallback/replay clearly labelled; user can restart the demo with synthetic inputs after failure. (Numbered SS-01 onward, same format.)
5. **P1 Stories -- Not for P0 Build** -- Listed separately without P0 acceptance criteria: Atlas Sandbox offer verification; user-confirmed Sandbox booking rehearsal; fictional passenger details for Sandbox-only order; saved trips, accounts, notifications, live delay feeds, production integrations.
6. **Traceability** -- Compact table mapping each P0 story (US-01..US-13) to one or more of: Gemini, Nosana, Atlas Sandbox, UI/Safety.
7. **Stop Condition** -- Confirm only that `docs/user-stories.md` was created and is the only project file changed.

### Constraints honored

- Exactly one file created; no other file created or modified.
- No application code, architecture, PRD, UAT, SPECS, dependencies, credentials, integrations, mock screenshots, or test data.
- No URL browsing, tool installs, authentication, or API calls.

### Verification

- Read back `docs/user-stories.md` for completeness (all 13 P0 stories, safety stories, P1 list, traceability table).
- Check filesystem timestamps to confirm it is the only project file created or modified.
