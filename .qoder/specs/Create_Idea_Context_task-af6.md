## Create `docs/idea-context.md`

### Step 1 -- Create the file

**File:** `/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel/docs/idea-context.md`

Sources (already read, read-only): `docs/hackathon-brief.md`, `docs/research-synthesis.md`, `docs/notebooklm-deep-research-report.md` (exists, 321 lines), and the attached selection-panel evaluation PDF.

Write the file titled `# StitchCheck: Idea Context` with these sections, following the user's specification:

1. **Product Summary** -- StitchCheck helps budget travellers assess the risk of buying two separate flight tickets with a tight connection before they pay.
2. **Hackathon Theme** -- Most Creative Gemini Hack.
3. **User Problem** -- Plain-language explanation that separately booked flights may not protect the traveller if the first flight is delayed and the second is missed (separate contracts, no rebooking/refund obligation, no-show cascade risk). Constraint: do not state unverified statistics as facts.
4. **Target User** -- Budget-conscious traveller considering a self-transfer itinerary of two separately booked flights; P0 demo user is synthetic using synthetic screenshots only.
5. **P0 Definition** -- The 9 numbered items specified: upload two synthetic screenshots; Gemini extraction to structured itinerary; user review/correction/confirmation; Nosana non-PII risk scoring on static/historical data; visible risk score plus plain-language failure-cascade explanation; Atlas Sandbox search for safer alternatives; comparison view; single Keep/Switch decision; P0 ends after the choice.
6. **Required Technology Roles** -- Three subsections:
   - Gemini: extract itinerary details from screenshots; return structured app-consumed data; generate user-facing risk explanation.
   - Atlas Flight Booking Sandbox: search for safer alternatives; display sandbox-backed results in the comparison view; P0 remains search-only.
   - Nosana: run/serve the non-PII risk-scoring workload; return app-consumed risk score; visible workload/job/service status in the demo.
7. **P1 Only After P0** -- Atlas Sandbox offer verification and booking rehearsal; fictional passenger data only; explicit user confirmation immediately before every Atlas write action; enhancements (saved trips, notifications, live delay feeds, accounts, production integrations).
8. **Safety Boundaries** -- The six items specified (no real PII; no real booking/payment/production credentials; risk scores don't guarantee outcomes; label synthetic material; loading/timeout/error/replay states; no reuse of Atlas offers after switching environments).
9. **Success Criteria** -- Viewer can visibly see: Gemini-derived structured itinerary output; Nosana-derived risk score and workload status; Atlas Sandbox-derived alternative flight results; the Keep/Switch decision.
10. **Open Questions** -- Only items requiring official documentation or smoke testing: Gemini multimodal structured-output behavior; Atlas Sandbox search/offer/latency behavior; Nosana deployment/output retrieval/status visibility; availability and suitability of static historical data for the non-PII risk heuristic.
11. **Stop Condition** -- Confirm only that `docs/idea-context.md` was created and is the only project file changed.

### Constraints honored

- Exactly one file created; all existing docs untouched.
- No application code, packages, skills, or dependencies.
- No URL browsing, credentials, authentication, or API calls; no Gemini/Atlas/Nosana integrations.
- No User Stories, PRD, UAT, or SPECS.

### Verification

- Read back `docs/idea-context.md` to confirm all sections.
- Check filesystem timestamps to confirm it is the only project file created or modified.
