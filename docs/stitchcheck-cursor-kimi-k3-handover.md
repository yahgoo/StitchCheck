# StitchCheck Handover for Cursor / Kimi K3

Date: 2026-08-24
Project: StitchCheck
Purpose: Continue implementation from the current repository state, correct the live app UI, and make the running app the source of truth before any further video rebuild.

## Immediate user goal

The current UI is cluttered, confusing, and internally inconsistent. The user wants a much simpler traveller-facing experience, similar to a concise slide deck:

1. Welcome and safety.
2. Upload or select an unbooked flight-ticket itinerary.
3. Review a coherent two-leg trip.
4. See the risk cascade immediately, including missed onward flight and accommodation check-in.
5. See a small set of better options, with the recommended option clearly highlighted after Switch is clicked.
6. Finish with a plain-language confirmation.

The user specifically does not want technical provider names such as Atlas, Daytona, Nosana, or Gemini in the main traveller UI.

## Current observed problems

A browser screenshot from the current app shows:

- Page heading: `Your trip`.
- First leg: `AAA → BBB`, flight `SC-101`.
- Second leg: `BBB → CCC`, flight `SC-202`.
- Raw internal field labels: `origin`, `destination`, `flightNumber`, `departureTime`, `arrivalTime`.
- No visible upload-itinerary option on the current screen.
- No obvious way to choose an unbooked flight-ticket input.
- Placeholder airport codes make the product look broken.
- The user is uncertain whether clicking Switch highlights the recommended option; the current interaction is not sufficiently obvious.

A captured 15-page PDF also showed:

- The recovery plan using an unrelated route such as `SIN → BKK` and `BKK → HAN` while the confirmed itinerary uses `AAA → BBB → CCC`.
- The Recovery Plan buried near page 11 of 15.
- A wall of approximately 20 near-identical alternative cards.
- Repeated source/demo wording.
- Provider names in traveller-facing content.
- Raw debug fields on the final page such as `noOrderCreated`, `demoMode`, and `externalCallsMade`.
- Old terms such as `synthetic`, `fictional`, and `Synthetic Carrier` in captured output.

## Existing architecture

- Frontend: React + Vite in `app/`.
- Core domain logic in `core/`.
- Provider scripts and smoke tests in `scripts/`, `workers/`, and `smoke-tests/`.
- Atlas CLI: `atlas-flight` v0.3.12 is installed.
- Atlas live integration has been implemented through a Vite server-side proxy.
- The browser calls local routes:
  - `POST /api/atlas/search`
  - `POST /api/atlas/verify`
- All other Atlas routes are intended to be blocked:
  - booking;
  - order;
  - reservation;
  - payment;
  - ticketing;
  - cancellation;
  - refund.
- Live Atlas Sandbox Search was previously verified with 20 offers for KUL → SIN. A later live run reported actual carriers such as OD, TR, and AK, with a successful Verify response in one run.
- The app has offline and live modes. Offline remains the safe default when not explicitly configured.
- Existing animation phase sequence:
  `trigger → cascade → candidates → collapse → freshness → done`
- Existing cascade items:
  1. Connection window.
  2. Onward flight.
  3. Pre-booked hotel check-in.

## Important data-source rules

The original itinerary and Atlas alternatives are different sources.

- Original itinerary: local/user-provided input in both modes.
- Alternatives: Atlas Sandbox Search + Verify in live mode; local fallback in offline mode.
- Recovery risk computation: verify current implementation and label accurately; do not automatically inherit the Atlas alternatives label.
- Do not show a local original itinerary as Atlas data.
- Do not show local fixture carriers, prices, or routes as live Atlas results.
- Do not fabricate any Atlas field.
- If Atlas does not return a field, use a concise unavailable state such as `Not available from Atlas response`.

## Route consistency requirement

This is a blocking correctness issue.

The confirmed itinerary, recovery animation, and recommendation must be coherent.

If the confirmed itinerary is:

```text
KUL → BKK
BKK → HAN
```

then the recovery UI must use:

- trigger: KUL → BKK;
- connection: BKK;
- onward risk: BKK → HAN;
- accommodation impact tied to the same trip;
- alternatives relevant to that itinerary.

Do not use `SIN → BKK → HAN` unless that is the actual confirmed itinerary.

Current source diagnosis from the previous implementation:

- `core/domain/recovery-plan-adapter.ts` previously hardcoded `SIN → BKK` and `BKK → HAN`.
- `core/domain/risk-computation.ts` previously hardcoded `BKK` and `HAN` labels.
- The fix introduced an `ItineraryContext` flowing from the confirmed extraction into risk/recovery data.
- Verify the current implementation rather than trusting the report.
- If required Atlas alternatives are unavailable for the confirmed route, show an honest no-match/unavailable state instead of unrelated offers.

## Requested UI structure

### Screen 1 — Welcome

Show:

- StitchCheck.
- Short explanation: check whether a connecting trip is at risk before committing.
- Safety text, concise:
  - `Sample documents only.`
  - `Nothing is booked, paid, or changed.`
- CTA: `Get started`.

Do not show Atlas, Daytona, Nosana, Gemini, internal execution modes, or long technical disclaimers.

### Screen 2 — Add itinerary

Provide two clear paths:

1. Upload itinerary.
2. Select two unbooked flight-tickets for the walkthrough.

Recommended copy:

```text
Upload itinerary
```

```text
Choose an unbooked flight-ticket
```

Fields/selectors:

```text
First flight-ticket
Second flight-ticket
```

Do not use:

- `fixture`;
- `demo fixture`;
- `populate itinerary fields`;
- `Synthetic Screenshots`.

Keep sample-document safety protection. If upload processing is not live, make that explicit without pretending it was processed.

### Screen 3 — Review trip

Use a compact boarding-pass-style summary.

Do not show raw internal field names. Use:

- From;
- To;
- Flight;
- Depart;
- Arrive.

Use a coherent route and neutral local carrier wording such as `Sample carrier` where the original itinerary is local.

CTA:

```text
Check my itinerary
```

Allow editing.

### Screen 4 — Answer / options (risk + recommendation)

After **Check my itinerary**, the app advances to a single consolidated **Your options** screen. The header shows a compact **Live checks: N of 3** summary with a **How this works** details panel for provider status.

Show one recommended option card first. Risk/recovery detail lives in a section-level disclosure:

```text
See why this is risky
```

Inside that disclosure, make the recovery animation visible without a long scroll.

Show all three impacts:

```text
First flight delayed
↓
Connection at risk
↓
Second flight may be missed
↓
Hotel check-in may be missed
```

The actual displayed airports must come from the confirmed itinerary context.

Technical details may be collapsed under:

```text
How this was calculated
```

Do not put Nosana, Daytona, Atlas, Gemini, dataset IDs, latency, or raw fallback metadata in the primary traveller view.

### Screen 5 — Better options (same consolidated screen)

Do not render 20 full cards by default on the primary view.

Show:

- one recommended option card;
- verified live alternatives via the unbooked-ticket preview when available;
- `See more verified options` for additional Atlas results (live mode), or `See more options` offline.

For live mode, show actual Atlas-returned carrier, offer ID, price, currency, and status, but keep provider names out of the primary traveller copy if a compact source disclosure can be used.

For offline mode, use coherent local data and neutral carrier text.

### Screen 6 — Decision

Show a plain comparison:

- Current plan: risk summary.
- Recommended plan: route, timing, cost difference if available.

Buttons:

```text
Keep flights
Switch to this plan
```

On Switch:

- set a stable selected plan ID;
- set decision to switch;
- visually highlight recommended plan;
- show checkmark and `Selected` label;
- set `aria-pressed="true"` or equivalent;
- deselect Keep state;
- retain selection after navigation;
- reveal `Submit switch request` as the next action.

On Keep:

- highlight current plan;
- deselect Switch;
- preserve mutual exclusivity.

This is only a local/read-only request. It must not call booking, order, payment, ticketing, reservation, cancellation, or refund APIs.

### Screen 7 — Done

Show:

```text
Your choice has been noted.
Nothing was booked, paid, or changed.
```

Preserve:

```text
Request submitted — awaiting verified supplier outcome
```

Hide raw debug JSON from the primary UI. Technical details may be placed in a collapsed disclosure.

## Copy rules

Remove current user-facing instances of:

- `synthetic`;
- `fictional`;
- `Synthetic Carrier`;
- `Direct Gemini`;
- `Direct Gemini 3.7`;
- `fixture` when used as traveller-facing input terminology;
- repetitive `demo` wording;
- `no external service call was made` when the current run is live.

Use only one small footnote if necessary:

```text
Demo build — sources are tagged where data appears.
```

Prefer not to show provider names in the traveller UI. Technical details can be available in a collapsed section for judges/developers.

Keep safety statements:

```text
Sample documents only.
No booking, payment, reservation, or order is created.
Search is read-only.
```

Keep forbidden success claims absent:

- Booked;
- Switched;
- Ticket issued;
- Payment completed.

Do not use `Switch` as a completed-outcome statement. It is acceptable as a user action label such as `Switch to this plan`, but the result must say the choice was recorded/requested, not that the itinerary was switched.

## Gemini correction

Do not trust old video or deck text.

Inspect the current runtime extraction path and evidence before naming Gemini.

If the app does not run Gemini extraction at runtime, use `Source: Local fixture` and remove Gemini from the traveller UI.

If a technical disclosure needs the provider name, use the exact current provider/model confirmed by code and evidence. Never claim Direct Gemini 3.7 without current proof.

## Existing media state

Do not modify any video, narration, subtitle, SRT, deck, or presentation file until the app UI is corrected and visually verified.

Previous media outputs include a live-v2 video and v5/v6 variants, but they contain known inconsistencies and must not be treated as the source of truth.

The application must be fixed first. A later task will recapture the video from the verified app.

## Tests to preserve/add

Run all existing tests and add/update tests for:

1. Upload itinerary control exists.
2. Two unbooked flight-ticket selectors exist.
3. No fixture terminology appears in traveller-facing selector copy.
4. No `AAA`, `BBB`, or `CCC` placeholder route appears in current UI.
5. Confirmed itinerary route propagates to Recovery Plan.
6. Recovery Plan never uses unrelated hardcoded routes.
7. Connection, onward flight, and hotel check-in all appear.
8. Recovery animation is visible near the top of the post-confirmation view.
9. Alternatives are limited by default with expansion for more.
10. Switch highlights the recommended plan.
11. Keep and Switch are mutually exclusive.
12. Selected plan has accessible selected state.
13. Final safe wording remains unchanged.
14. No booking/payment/order/ticketing/reservation/cancellation/refund call occurs.
15. No forbidden success claims render.
16. No provider names appear in default traveller-facing content.
17. No `synthetic`, `fictional`, or `Direct Gemini` appears in current UI.
18. Live status wording matches actual mode and call outcome.
19. No horizontal overflow.
20. Reduced-motion behavior remains intact.

## Visual QA

Run both modes if possible.

### Offline mode

Verify:

- Welcome is concise.
- Upload/select-itinerary entry point exists.
- Review uses readable labels.
- Route is coherent.
- Risk animation is visible without excessive scrolling.
- All three downstream impacts appear.
- Options are not a wall of cards.
- Switch visibly highlights the recommendation.
- Done screen is plain language.
- Raw debug fields are hidden.
- No provider names in default content.

### Live mode

Verify:

- Original itinerary remains clearly separate from live alternatives.
- Alternatives show actual Atlas-returned data.
- Live source status is scoped to alternatives only, if displayed.
- No unrelated route appears in Recovery Plan.
- No silent fallback occurs.
- Verify result is shown accurately.
- No write action occurs.

Capture screenshots for:

1. Welcome.
2. Upload/select ticket.
3. Review trip.
4. Risk animation above the fold.
5. Alternatives.
6. Recommended option before Switch.
7. Recommended option after Switch.
8. Done.

## Constraints

- Do not access or print `.env.local`.
- Do not expose credentials.
- Do not fabricate Atlas data.
- Do not use local fixture values as live Atlas values.
- Do not call write endpoints.
- Do not modify video/presentation assets during app work.
- Do not weaken safety wording.
- Do not remove underlying provenance data; simplify its display.
- Do not preserve a mismatched route merely to keep a visual animation.

## Expected final report

Return:

1. Current data-flow diagnosis.
2. Route-mismatch root cause and fix.
3. Exact coherent itinerary route used.
4. Upload/select-ticket behavior.
5. Risk animation placement and visible cascade items.
6. Alternatives display count and expansion behavior.
7. Switch selection behavior.
8. Before/after screenshots.
9. Exact copy changes.
10. Provider names removed from default traveller UI.
11. Gemini runtime path, based on current code/evidence.
12. Test results.
13. Typecheck/build results.
14. Live-mode result, if verified.
15. Offline-mode result.
16. Confirmation no provider write action occurred.
17. Confirmation no video/presentation files changed.
18. Remaining issues.
