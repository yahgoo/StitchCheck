# StitchCheck: User Stories

## Scope
These stories describe only StitchCheck P0:
synthetic screenshot upload -> Gemini itinerary extraction and user confirmation
-> Nosana risk score -> Atlas Sandbox safer-alternative search -> Keep or Switch.

P0 ends at the Keep or Switch decision. Atlas Sandbox booking, payment,
offer verification, real users, real PII, and production integrations are out
of scope.

## Primary Persona

### Budget Self-Transfer Traveller
A budget-conscious traveler considering two separately purchased flight tickets
with a tight connection and wanting to understand the risk before paying.

## P0 User Stories

### US-01: Upload two synthetic ticket screenshots
**User story:** As a Budget Self-Transfer Traveller, I want to upload two
synthetic, unbooked flight-ticket or checkout screenshots, so that the system
can analyse my planned self-transfer itinerary.

**Acceptance criteria:**
- Given I am on the P0 demo screen with no itinerary loaded
- When I upload two synthetic, unbooked flight-ticket or checkout screenshots
- Then the system accepts both images and begins itinerary extraction
- And I see confirmation that both screenshots were received

### US-02: Synthetic demo labelling and no real data
**User story:** As a Budget Self-Transfer Traveller, I want to clearly see that
the upload is synthetic demo material, so that I know no real personal data
should be used.

**Acceptance criteria:**
- Given I am using the P0 demo
- When I view the upload screen or begin an upload
- Then a visible label identifies all inputs as synthetic demo material
- And the screen states that no real personal data should be used

### US-03: Gemini-extracted structured itinerary
**User story:** As a Budget Self-Transfer Traveller, I want to receive
Gemini-extracted itinerary details in structured fields, so that I can verify
what the system understood from my screenshots.

**Acceptance criteria:**
- Given two screenshots have been accepted
- When Gemini completes itinerary extraction
- Then structured fields are displayed: origin, destination, date, airline,
  flight number when available, departure time, arrival time, and connection
  duration
- And each field is shown alongside the screenshot it was derived from

### US-04: Review, correct, and confirm the itinerary
**User story:** As a Budget Self-Transfer Traveller, I want to review, correct,
and explicitly confirm the extracted itinerary, so that no risk calculation or
alternative search begins from wrong data.

**Acceptance criteria:**
- Given the extracted itinerary fields are displayed
- When I edit any incorrect field and confirm the itinerary
- Then my confirmed values are used for all subsequent steps
- And no risk calculation or Atlas search starts before my explicit confirmation

### US-05: Validation feedback for unusable screenshots
**User story:** As a Budget Self-Transfer Traveller, I want understandable
validation feedback when my screenshots are unreadable, incomplete, or not a
valid two-leg self-transfer, so that I know what to fix.

**Acceptance criteria:**
- Given I upload screenshots that are unreadable, incomplete, or do not
  describe a valid two-leg self-transfer
- When extraction or validation fails
- Then the system shows a plain-language explanation of what is wrong
- And I am given a path to re-upload or correct the inputs without losing
  my session

### US-06: Nosana-derived connection-risk result
**User story:** As a Budget Self-Transfer Traveller, I want to receive a
Nosana-derived connection-risk result based on non-PII static/historical data,
so that my Keep/Switch decision is grounded in a computed score.

**Acceptance criteria:**
- Given I have confirmed my itinerary
- When the Nosana risk-scoring workload completes
- Then a connection-risk score derived from non-PII static/historical data is
  displayed
- And the result is clearly attributed to the Nosana workload

### US-07: Plain-language failure-cascade explanation
**User story:** As a Budget Self-Transfer Traveller, I want a plain-language
failure-cascade explanation of what could happen if the first flight is
delayed, so that I understand the consequence without false precision.

**Acceptance criteria:**
- Given the risk result is displayed
- When I read the failure-cascade explanation
- Then it describes possible consequences of a delay on the first leg in plain
  language
- And the score is not presented as a guarantee or as a real-time prediction

### US-08: Visible Nosana workload status
**User story:** As a Budget Self-Transfer Traveller, I want to see the Nosana
workload status, so that I know the risk score came from a real completed job.

**Acceptance criteria:**
- Given a risk calculation has been triggered
- When the Nosana workload runs
- Then loading, completion, timeout, and error states are each visibly handled
- And any replay/fallback state is clearly labelled as such

### US-09: Atlas Sandbox safer-alternative comparison table
**User story:** As a Budget Self-Transfer Traveller, I want to see Atlas
Sandbox-backed safer alternative flight-search results in a comparison table,
so that "Switch" is a concrete, priced option.

**Acceptance criteria:**
- Given my itinerary is confirmed and risk result is shown
- When the Atlas Sandbox search completes with results
- Then safer alternative options are displayed in a comparison table with
  sandbox-backed pricing
- And the results are labelled as Atlas Sandbox data

### US-10: Atlas Sandbox search state handling
**User story:** As a Budget Self-Transfer Traveller, I want clear loading,
empty-result, timeout, and error states for the Atlas Sandbox search, so that
I am never left without a path forward.

**Acceptance criteria:**
- Given an Atlas Sandbox search is in progress or has failed
- When loading, empty results, timeout, or an error occurs
- Then each state is visibly and distinctly communicated
- And a retry or labelled replay path is offered

### US-11: Compare risky plan versus safer alternative
**User story:** As a Budget Self-Transfer Traveller, I want to compare the
risky self-transfer itinerary with a safer alternative, so that I can make an
informed decision from clearly labelled system information.

**Acceptance criteria:**
- Given both the risky itinerary and sandbox alternatives are available
- When I view the comparison view
- Then the risky self-transfer and the safer alternative are shown side by
  side using only information available from the system
- And every displayed datum is clearly labelled by its source or as synthetic

### US-12: Single Keep or Switch decision
**User story:** As a Budget Self-Transfer Traveller, I want to choose Keep or
Switch as the single P0 decision, so that the demo has one clear outcome.

**Acceptance criteria:**
- Given the comparison view is complete
- When I select Keep or Switch
- Then exactly one decision is recorded and no other decision point exists in
  the P0 flow
- And the choice is visually confirmed on screen

### US-13: Final decision state with explicit P0 boundary
**User story:** As a Budget Self-Transfer Traveller, I want a final decision
state confirming my selected option, so that I understand exactly what the demo
did and did not do.

**Acceptance criteria:**
- Given I have chosen Keep or Switch
- When the final decision state is shown
- Then my selected option is confirmed in plain language
- And the screen clearly states that P0 has not created a booking, payment,
  reservation, or order

## Cross-Cutting Safety Stories

### SS-01: No real PII, payments, or production credentials
**User story:** As a demo operator, I want the P0 demo to accept no real PII,
payment details, production credentials, or production bookings, so that the
demo cannot cause real-world harm.

**Acceptance criteria:**
- Given the P0 demo is running
- When any input or integration is exercised
- Then only synthetic data is accepted and no production credential, payment,
  or booking pathway exists

### SS-02: Atlas remains search-only in P0
**User story:** As a demo operator, I want Atlas Sandbox usage to remain
search-only in P0, so that no sandbox order state is mutated by the demo.

**Acceptance criteria:**
- Given the P0 flow is executing
- When Atlas is invoked at any point
- Then only search operations occur and no Atlas write action is available

### SS-03: Risk information is a heuristic
**User story:** As a Budget Self-Transfer Traveller, I want the risk score
presented as a heuristic from static/historical data, so that I do not treat
it as a guaranteed outcome.

**Acceptance criteria:**
- Given the risk score is displayed
- When I view any risk-related text
- Then it is labelled a heuristic estimate, not a guarantee or real-time
  prediction

### SS-04: Synthetic and fallback states stay labelled
**User story:** As a viewer of the demo, I want synthetic demo inputs and any
fallback/replay states to remain clearly labelled, so that I can distinguish
live results from replays.

**Acceptance criteria:**
- Given any synthetic input or fallback/replay is shown
- When it appears in the UI
- Then it carries a visible label identifying it as synthetic or replayed data

### SS-05: Restart after failure
**User story:** As a Budget Self-Transfer Traveller, I want to restart the P0
demo using synthetic inputs after a failure, so that a failed run does not end
the demo.

**Acceptance criteria:**
- Given any step has failed or timed out
- When I choose to restart
- Then the demo resets to the upload step with synthetic inputs
- And no partial state from the failed run is presented as live data

## P1 Stories — Not for P0 Build

Listed separately; intentionally without P0 acceptance criteria:
- Atlas Sandbox offer verification.
- Explicitly user-confirmed Sandbox booking rehearsal.
- Fictional passenger details for a Sandbox-only order.
- Saved trips, accounts, notifications, live delay feeds, and production
  integrations.

## Traceability

| Story  | Gemini | Nosana | Atlas Sandbox | UI/Safety |
|--------|--------|--------|---------------|-----------|
| US-01  |        |        |               | X         |
| US-02  |        |        |               | X         |
| US-03  | X      |        |               | X         |
| US-04  | X      |        |               | X         |
| US-05  | X      |        |               | X         |
| US-06  |        | X      |               | X         |
| US-07  | X      | X      |               | X         |
| US-08  |        | X      |               | X         |
| US-09  |        |        | X             | X         |
| US-10  |        |        | X             | X         |
| US-11  |        |        | X             | X         |
| US-12  |        |        |               | X         |
| US-13  |        |        |               | X         |

## Stop Condition
Confirm only that `docs/user-stories.md` was created and is the only project
file changed.
