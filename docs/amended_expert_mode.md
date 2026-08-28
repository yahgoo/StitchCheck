Use Expert mode for one live, budget-capped Daytona sandbox + read-only Atlas dry run using REAL Atlas Sandbox route/fare/schedule data, and use that real result to power the dependency-graph "recovery plan" animation. Allocate approximately 80% of session effort to the live real-data path plus the animation that visualizes it; allocate approximately 20% to confirming the existing offline/fixture fallback remains intact and submission-ready.

## Time allocation (enforce explicitly)

- 80% — Phases 1 through 7 below (live Daytona sandbox + real Atlas data + the animation built on top of it). Within this, prioritize getting one successful real-data Search/Verify result AND wiring it into a working animation over polishing documentation.
- 20% — Fallback preservation checklist (Phase 8). Should be fast because the fallback already works; do not expand its scope.

At roughly the 80% time mark, pause and tell me: "Live path + animation effort budget reached — moving to fallback verification now," then proceed to Phase 8. If either the live data path or the animation is incomplete at that mark, tell me the exact blocking step and let me decide whether to extend the budget.

## Critical correction: no synthetic route/fare data

The Atlas Sandbox must be queried with a REAL route that actually exists in Atlas's live inventory (a genuine airport pair served by one of the 140+ low-cost carriers, real near-future date). Do not invent a fictional flight number or fare. The organizer's brief explicitly states: "Use the Atlas Sandbox to test ideas against real routes, fares and schedules — not a synthetic demo." Traveler/passenger details (name, email, phone) still remain non-PII placeholders — that is a separate, unrelated privacy rule.

## The animation ("wow moment") — what to build

This is the visual centerpiece for the demo video. Build it as a real UI component driven by real data, not a canned/scripted animation with hardcoded outcomes:

1. **Trigger state**: the confirmed itinerary's first leg is shown as delayed (using the real Atlas-derived risk/delay signal already in the app, or a clearly labeled simulated delay trigger if no live delay signal exists — label this exactly as "Simulated delay trigger — downstream impact is real analysis").
2. **Cascade visualization**: the downstream leg(s) — connecting flight, and hotel/check-in if modeled — visually transition to a red/at-risk state one after another (staggered, not instant), representing the dependency graph being evaluated.
3. **Collapse into one plan**: multiple individually-plausible alternative legs (pulled from the real Atlas Search result in Phase 5) briefly appear, then visually collapse/merge into exactly one recommended recovery plan — a replacement first leg plus a compatible onward option — with visible trade-offs (arrival impact, connection buffer, fare delta if known from real data).
4. **Re-plan attempt counter**: if no safe plan is found from the real result set, show "Re-plan attempt 1 of 2," then a terminal state "No safe plan found — escalate to traveller/agent." Do not loop indefinitely.
5. **Freshness badge**: immediately before the confirmation screen, show "Availability refreshed just now" with the real timestamp from the Phase 5 Atlas call and the provenance badge `Atlas Sandbox Search/Verify — read-only, real Atlas Sandbox inventory, executed inside Daytona sandbox`.
6. **Confirmation and outcome states**: "Review recovery plan" then "Confirm switch request" — never "Booked" or "Switched." After confirmation, show "Request submitted — awaiting verified supplier outcome" unless a real verification response was actually received in Phase 5, in which case show the real verified state.

Do not fabricate any downstream data (fare deltas, arrival times) that isn't derivable from either the real Phase 5 Atlas response or the existing already-validated risk heuristic. If a needed data point isn't available from real data, show it as "not available from Sandbox response" rather than inventing a number.

## Current state (do not re-implement)

Already built and passing offline: core/domain, core/provenance, core/evidence, core/safety, core/flags, core/contracts; scripts/daytona-orchestrator.mjs (mock-mode); scripts/atlas-orchestrator.mjs (mock-mode); workers/daytona-atlas-worker/; 27 orchestrator offline tests + 16 worker sanitize tests, all passing. No live Daytona sandbox has ever been created. No live Atlas call has ever run through Daytona. No animation currently exists.

## Hard constraints (apply to every expert and the Lead Agent, regardless of time budget)

Do not, under any circumstances:
- create more than 1 Daytona sandbox, ever, in this session;
- call Atlas Search more than once or Verify more than once;
- use a fabricated, hardcoded, or synthetic route/flight/fare in the live call;
- use real passenger PII;
- create an order, confirm a booking, process payment, or issue a ticket — hard-disabled at the code level;
- claim "Booked" or "Switched" in the animation unless a real verified outcome was received;
- read, print, log, or persist any secret value anywhere;
- leave a sandbox running — must be destroyed in a `finally` block with shown confirmation;
- exceed a 10-minute total sandbox lifetime;
- commit, push, or upload anything;
- let any expert independently make a live external call — only the Lead Agent may, only after explicit approval at the gates below;
- expand the fallback-preservation slice (Phase 8) into new feature work;
- invent data values in the animation that aren't traceable to real Phase 5 output or the existing validated risk heuristic.

## PHASE 1 — Parallel expert prep (safe, no live calls, run concurrently) — part of the 80%

- Expert A — Re-run the full existing offline test suite. Report pass/fail only.
- Expert B — Draft the exact `@daytona/sdk` create-sandbox request (image, resources, `domainAllowList` restricted to PyPI, astral.sh, and the Atlas sandbox host, `networkBlockAll` otherwise, exec timeout >=90s).
- Expert C — Draft the exact provisioning script (uv, Python 3.12, `atlas-flight-booking==0.3.12`, PATH), not yet run.
- Expert D — Identify a real, currently plausible search route from Atlas's documented network, sourced from Atlas's own docs/examples/onboarding materials. Confirm non-PII traveler placeholders.
- Expert E — Review the worker sanitization/redaction pipeline for correctness against the forbidden-key list, preserving genuine route/fare/schedule facts.
- Expert F — Build the animation component (cascade-to-red states, collapse-into-one-plan transition, re-plan attempt counter, freshness badge, confirmation/outcome states) as a self-contained component that accepts a data prop — do not wire it to live data yet, use a placeholder data shape matching the real Atlas response schema. Use an economical model tier for this since it's UI/CSS/motion work.

Wait for all six experts. Consolidate into one plan, including Expert D's real route with justification and Expert F's animation component ready to receive real data.

## PHASE 2 — Approval Gate 1 (human-only) — part of the 80%

Show me the consolidated sandbox-creation plan, provisioning script, proposed REAL route with justification, and a preview/description of the animation component's states. Wait for "approved."

## PHASE 3 — Serial live execution (Lead Agent only) — part of the 80%

After approval: create exactly one sandbox, run the approved provisioning script, report exact exit codes and timings. Destroy and report failure immediately if provisioning fails.

## PHASE 4 — Approval Gate 2 (human-only) — part of the 80%

Show me the exact `atlas-flight` Search command using the approved real route and non-PII placeholder traveler details. Wait for approval.

## PHASE 5 — Serial live Atlas call (Lead Agent only) — part of the 80%

After approval: run exactly one Search call; confirm the response reflects real Sandbox inventory; if offers are returned, run exactly one Verify call on the first offer; sanitize before it reaches any log or chat output; report the sanitized result with provenance metadata including `dataSource: "real-atlas-sandbox-inventory"`.

## PHASE 5.5 — Wire real data into the animation — part of the 80%

Take the sanitized, real Phase 5 result and feed it into Expert F's animation component as its data prop, replacing the placeholder shape. Confirm the animation renders using this real result: real route/fare/schedule values shown in the "collapse into one plan" state, real timestamp in the freshness badge, real provenance label. If the real result lacks a field the animation expects (e.g., no fare delta available), the animation must show "not available from Sandbox response" for that field — do not substitute a fabricated value.

## PHASE 6 — Guaranteed cleanup (Lead Agent only, always runs) — part of the 80%

Destroy the sandbox in a `finally` block regardless of outcome. Show destroy confirmation and total lifetime. Confirm no secret appears anywhere.

## PHASE 7 — Evidence labeling — part of the 80%

Save the sanitized result with provenance label exactly: `Atlas Sandbox Search/Verify — read-only, real Atlas Sandbox inventory, executed inside Daytona sandbox`. Do not merge with prior fixture-based evidence. Note in the same evidence record that the animation component now renders this real result.

## PHASE 8 — Fallback preservation checklist — the 20% slice

1. Confirm the existing fixture-only demo path still runs and passes its tests, unmodified.
2. Confirm existing fallback video hashes are unchanged.
3. Confirm feature flags still default safely for the fixture-only path.
4. Confirm the fixture-only path's evidence labels are untouched and not confused with the new real-data label.
5. Confirm the new animation component, when given fixture data instead of real data, still renders correctly and does not silently claim "real Sandbox inventory" for fixture input — the component must reflect whichever provenance label it's actually given.
6. If everything is already true without changes, simply confirm it — do not add new fallback code.

## FINAL REPORT

Return:
- confirmation of the 80/20 time split followed, with the checkpoint statement noted;
- Phase 1 expert outputs summary and model tiers used;
- the real route selected, its source justification, and confirmation it is not synthetic;
- exact sandbox lifecycle timings and commands executed;
- sanitized Atlas result with confirmation the data is real Sandbox inventory;
- confirmation the animation now renders this real result end-to-end;
- any fields the animation had to show as "not available from Sandbox response";
- confirmation sandbox was destroyed and no secret was exposed;
- confirmation no order/payment/ticket action was attempted, and no "Booked"/"Switched" claim was shown without a real verified outcome;
- Phase 8 fallback-preservation results;
- explicit statement of what is now live-verified with real data + working animation vs. still mock/fixture-only.

## If anything fails or looks ambiguous at any phase

Stop immediately, destroy any running sandbox, and report the exact failure with the smallest safe next step. Do not substitute synthetic data or fabricated animation values to "make it look finished" — an honest partial result (e.g., animation works but one field says "not available") is acceptable; a fabricated complete result is not.