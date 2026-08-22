# Build with Gemini Hackathon Brief

## Deadline
- Build with Gemini hackathon deadline: Saturday, 22 August 2026.
- Objective: select one idea from research, then build a working vertical slice today.

## Required Technology Stack
- Gemini API
- Atlas Flight Booking Sandbox
- Nosana

## Idea Status
- No idea has been selected.
- Do not assume any previous project, persona, target user, industry, or solution.
- An idea will be selected only after research is supplied and evaluated.

## Build Constraints
- The selected idea must fit exactly one official hackathon theme.
- Gemini, Atlas Sandbox, and Nosana must each have an essential, visible role in the same primary user journey.
- Gemini must produce structured output that the application consumes to determine a real next step.
- Atlas must provide a genuine sandbox-backed travel result, verification state, or order status; static mock data is not acceptable.
- Nosana must run, host, or serve a defined workload whose output the application consumes.
- Build a working end-to-end vertical slice today after idea selection.
- Keep the primary flow to one user, one trigger, one decision, and one outcome.
- Do not use production Atlas credentials, real bookings, real payments, or real personal data.
- Any Atlas write action requires explicit human confirmation immediately before the action.
- Include loading, timeout, error, and clearly labelled fallback or replay states.
- Prioritize a repeatable demo over broad scope or visual polish.

## Hard Gate for Selecting an Idea
Reject any candidate unless all statements are true:
1. Removing Gemini materially breaks the intelligence or next decision.
2. Removing Atlas Sandbox materially breaks the travel result or action.
3. Removing Nosana materially breaks a workload whose output the user flow consumes.

For the selected idea, document:
- Gemini evidence: visible user input produces visible Gemini-derived output.
- Atlas evidence: a visible user action produces a real sandbox-backed travel result or status.
- Nosana evidence: a visible job or service status produces output used in the user flow.

## Atlas Safety Notes
- Use Atlas Sandbox only.
- Search is read-only.
- Any booking, payment, ancillary, or post-booking write operation must be behind explicit human confirmation.
- Use fictional test data only.
- After switching Atlas environments, begin a new search and never reuse an earlier offer.

## Official Technical References
Record these URLs verbatim for later planning:
- Gemini API: https://ai.google.dev/gemini-api/docs
- Atlas API Quick Start: https://resources.atriptech.com/api-wen-dang/readme-1/quick-start
- Atlas Flight Booking Skill: https://github.com/atlas-doc/atlas-flight-booking-skill
- Nosana Learn: https://learn.nosana.com/

## Evidence Rule
Future capabilities must be confirmed by official documentation or a successful smoke test. Otherwise, list them as open questions.

## Required Outputs Before Code
After research is available, create:
- docs/idea-scorecard.md
- docs/idea-context.md
- docs/user-stories.md
- docs/PRD.md
- docs/UAT.md
- docs/SPECS.md

## Stop Condition
Do not select an idea.
Do not modify application code.
Confirm only:
1. `docs/hackathon-brief.md` was created.
2. No other files were created or modified.
