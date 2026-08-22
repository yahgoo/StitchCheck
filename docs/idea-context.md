# StitchCheck: Idea Context

## Product Summary
StitchCheck helps budget travellers assess the risk of buying two separate
flight tickets with a tight connection before they pay.

## Hackathon Theme
- Most Creative Gemini Hack.

## User Problem
When a traveller books two flights as separate tickets instead of one through
itinerary, each ticket is its own contract. If the first flight is delayed and
the second flight is missed, the second airline generally has no obligation to
rebook, protect, or refund the traveller, because it never sold the connection.
Budget carriers may also apply "no-show" rules that can cancel remaining legs
of the booking without refund. The savings from stitching separate tickets are
visible at checkout, but this exposure is not. No specific statistics are
asserted here; the underlying evidence is documented in
`docs/research-kimi.md` and the NotebookLM research evaluation.

## Target User
- Budget-conscious traveller considering a self-transfer itinerary made from
  two separately booked flights.
- The P0 demo user is a synthetic traveler using synthetic screenshots only.

## P0 Definition
P0 is the smallest working demo that proves StitchCheck's central value.
P0 must include:
1. Upload of two synthetic, unbooked flight-ticket/check-out screenshots.
2. Gemini extraction of flight details into structured itinerary data.
3. User review and correction/confirmation of extracted itinerary data.
4. Nosana risk-scoring workload using non-PII static or historical data.
5. Visible risk score and plain-language failure-cascade explanation.
6. Atlas Sandbox search for safer alternative flight options.
7. A comparison view: risky self-transfer versus safer alternative.
8. A single decision: Keep or Switch.
9. P0 ends after the user chooses Keep or Switch.

## Required Technology Roles

### Gemini
- Extract itinerary details from screenshots.
- Return structured app-consumed data.
- Generate a clear, user-facing risk explanation.

### Atlas Flight Booking Sandbox
- Search for safer flight alternatives.
- Display sandbox-backed results in the comparison view.
- P0 must remain search-only.

### Nosana
- Run or serve the non-PII risk-scoring workload.
- Return a risk score consumed by the application.
- Show a visible workload/job/service status in the demo.

## P1 Only After P0
- Atlas Sandbox offer verification and booking rehearsal.
- Fictional passenger data only.
- Explicit user confirmation immediately before every Atlas write action.
- Any enhancements such as saved trips, notifications, live delay feeds,
  accounts, or production integrations.

## Safety Boundaries
- No real PII.
- No real booking, payment, or production credentials.
- No claim that risk scores guarantee an outcome.
- Clearly label all screenshots, travelers, routes, and data as synthetic demo
  material where applicable.
- Include loading, timeout, error, and replay/fallback states.
- Do not reuse Atlas offers after switching environments.

## Success Criteria
The demo succeeds only when a viewer can visibly see:
- Gemini-derived structured itinerary output.
- A Nosana-derived risk score and workload status.
- Atlas Sandbox-derived alternative flight results.
- The user's Keep or Switch decision.

## Open Questions
List only items that require official documentation review or smoke testing:
- Gemini multimodal structured-output behavior.
- Atlas Sandbox search, offer, and latency behavior.
- Nosana workload deployment, output retrieval, and status visibility.
- Availability and suitability of static historical data for a non-PII risk
  heuristic.

## Stop Condition
Confirm only that `docs/idea-context.md` was created and is the only project
file changed.
