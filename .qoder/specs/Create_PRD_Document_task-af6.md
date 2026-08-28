## Create `docs/PRD.md`

### Step 1 -- Create the file

**File:** `/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel/docs/PRD.md`

Sources (already read, read-only): `docs/hackathon-brief.md`, `docs/research-synthesis.md`, `docs/idea-context.md`, `docs/user-stories.md`.

Write `# StitchCheck: Product Requirements Document` with these sections per the user's specification:

1. **Product Overview** -- Plain-language StitchCheck description; theme: Most Creative Gemini Hack; P0 outcome: help a budget traveller decide Keep or Switch before paying.
2. **Problem Statement** -- Risk of separately purchased tickets with a tight connection; no unverified statistics stated as facts; explicit statement that the product offers a risk heuristic, not a guarantee or real-time prediction.
3. **Target User** -- Budget-conscious self-transfer traveller; P0 uses only a synthetic demo traveller and synthetic screenshots.
4. **P0 Goal** -- One user / one trigger / one decision / one outcome, exactly as specified (synthetic traveller; two synthetic screenshots; Keep or Switch; recorded decision state with no booking/payment/reservation/order).
5. **P0 User Journey** -- The 10 sequential stages specified, from landing safety notice through final decision state confirming nothing was booked or paid.
6. **Functional Requirements** -- Numbered requirements (FR-01 onward) traceable to US-01..US-13, covering all 13 specified capability areas (upload validation, synthetic warnings/no-PII, Gemini extraction, confirmation gate, invalid-upload feedback, Nosana risk score, heuristic explanation, Nosana states, Atlas search-only results, Atlas states, comparison, Keep/Switch, final no-order confirmation).
7. **Required Technology Evidence** -- Three subsections (Gemini, Nosana, Atlas Flight Booking Sandbox) with essential role and visible demo proof as specified; P0 must not create/verify/pay/ticket any Atlas order.
8. **Screens and States** -- The 7 specified P0 screens/views, each requiring loading/empty/error/timeout/retry and labelled fallback/replay where applicable.
9. **Non-Functional Requirements** -- The 7 items specified (demo-friendly UI, synthetic/heuristic labels, no real PII/payments/credentials/bookings, no Atlas writes in P0, repeatable demo, graceful failure handling, no Atlas offer reuse after environment switch).
10. **Out of Scope** -- The 6 items specified.
11. **P1 After P0** -- Atlas offer verification, sandbox booking rehearsal with fictional data, optional enhancements.
12. **Dependencies and Open Questions** -- Only facts needing official documentation review or smoke tests (the 5 items specified); explicit note that integrations are not claimed to work.
13. **Acceptance Criteria** -- P0 success = visible demo proving Gemini-derived itinerary data, Nosana-derived risk score plus job/service status, Atlas Sandbox-derived alternatives, a Keep/Switch choice, and no booking/payment/reservation/order.
14. **Traceability** -- Compact table mapping PRD requirement IDs -> related user-story IDs -> technology (Gemini / Nosana / Atlas Sandbox / UI/Safety).
15. **Stop Condition** -- Confirm only that `docs/PRD.md` was created and is the only project file changed.

### Constraints honored

- Exactly one file created; all other docs untouched.
- No application code, architecture, dependencies, credentials, integrations, mock screenshots, test data, UAT, or SPECS.
- No URL browsing, tool installs, authentication, or API calls.

### Verification

- Read back `docs/PRD.md` for completeness and consistency with `docs/user-stories.md` (FR-to-US traceability).
- Check filesystem timestamps to confirm it is the only project file created or modified.
