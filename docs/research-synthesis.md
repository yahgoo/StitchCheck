# Research Synthesis: StitchCheck

## Decision
- Selected idea: StitchCheck (proposed by Kimi in `docs/research-kimi.md`).
- Selected theme: Most Creative Gemini Hack.
- Decision basis: a NotebookLM research evaluation compared all nine candidate
  ideas from `docs/research-kimi.md`, `docs/research-zai.md`, and
  `docs/research-chatgpt.md` against independent evidence and the
  required-stack constraints in `docs/hackathon-brief.md`, and recommended
  StitchCheck as the strongest candidate.
- Note: the selection report is a NotebookLM research evaluation, not an
  official hackathon-organizer decision.

## Problem
Budget travellers often book two separate low-cost tickets with a tight layover
because it is cheaper than one through ticket. The risk is invisible at
checkout: if the first flight is delayed, the traveller can miss the second
flight, and because the tickets are separate contracts, the second airline has
no obligation to rebook, protect, or refund. Missing the first leg can also
trigger "no-show" clauses that cancel remaining legs without refund. The
traveller is left stranded and must buy a replacement ticket at full price.

## One-Sentence Pitch
Screenshot your cheap separate tickets before paying, and StitchCheck builds a
narrated failure-cascade timeline exposing your real missed-connection risk,
then offers a safer alternative priced through the Atlas sandbox.

## P0 User Journey
1. A synthetic traveler uploads two synthetic, unbooked separate-ticket
   flight screenshots.
2. Gemini extracts airport codes, flight times, dates, airlines, and
   connection duration into validated structured itinerary data (the user
   confirms the parsed itinerary before it is used).
3. Nosana runs a non-PII connection-risk calculation using static/historical
   data and returns a risk score plus a simple explanation.
4. Atlas Sandbox searches for safer alternative flight options.
5. The UI compares the risky plan with a safer option.
6. The user chooses Keep or Switch.
7. P0 ends after the user sees the recommendation and chooses an option.

## Technology Evidence
- **Gemini** — Essential role: multimodal extraction of the two ticket
  screenshots into structured itinerary data that drives every next step, plus
  generation of the failure-cascade narrative. Visible proof: the screenshots
  shown beside the extracted itinerary fields and the narrated timeline.
- **Atlas Sandbox** — Essential role: genuine sandbox-backed flight search
  returning priced safer alternative itineraries for the same journey. Visible
  proof: a results table of real sandbox offers comparing the risky plan
  against the safer option. P0 uses search only; no write actions.
- **Nosana** — Essential role: runs the connection-risk scoring workload on
  static/historical, non-PII delay data; the application consumes the returned
  risk score and explanation. Visible proof: a job/service status display
  (job ID and status) with the resulting risk score rendered in the UI.

## P0 Scope
- Upload of two synthetic ticket screenshots by one synthetic traveler.
- Gemini extraction into structured itinerary data with user confirmation.
- Nosana risk-score computation and visible job status.
- Atlas Sandbox read-only search for safer alternatives.
- Comparison screen (risky plan vs safer option) and Keep/Switch choice.
- Loading, timeout, error, and clearly labelled fallback/replay states.
- Nothing beyond the journey above.

## P1 Only After P0
- Explicit user-confirmed Atlas Sandbox verification/booking rehearsal.
- Fictional passenger data only.
- Any other enhancements.

## Safety and Non-Goals
- No production credentials, real bookings, real payments, or real PII.
- No real-time weather or delay prediction.
- The risk score is a heuristic estimate, not a guaranteed probability; it is
  labelled as such in the UI.
- No Atlas write action without explicit human confirmation.
- Synthetic demo data and fallback/replay behavior are clearly labelled.

## Smoke-Test Risks
1. Gemini screenshot extraction quality: accuracy of airport codes, times,
   dates, and airline names across varied checkout-page layouts.
2. Availability/coverage of the non-PII historical data used for risk scoring:
   whether a suitable dataset exists and covers the demo route/airports.
3. Atlas Sandbox search latency and reliability: whether sandbox search
   returns priced alternative offers quickly enough for a live demo.
4. Nosana job/service deployment: whether the workload can be deployed and
   whether a visible job status can be shown in the UI during the demo.

## Open Questions
Facts that must be verified by official documentation or a successful smoke
test before implementation (per the Evidence Rule in
`docs/hackathon-brief.md`); none of these are assumed to work yet:
- Gemini API capability and limits for multimodal screenshot extraction into
  structured output.
- Atlas Sandbox search behavior for the demo route: availability of priced
  alternative offers and offer-status semantics.
- Nosana deployment model for a batch scoring workload and its job-status
  reporting surface.
- Source and licence of a non-PII historical delay dataset suitable for the
  demo route.

## Stop Condition
This record confirms only that `docs/research-synthesis.md` was created and is
the only project file changed. No PRD, user stories, UAT, SPECS, application
code, or integration setup has been produced.
