<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# provide context to codex product design plugin to improve StitchCheck UI

Paste the following into the **Codex product-design plugin**. It gives the plugin the product context, current UI problems, hackathon constraints, and the specific design outcome you want.

```text
You are improving the existing StitchCheck product UI. Treat the repository as an existing working product, not a blank redesign exercise.

## Product

StitchCheck turns a flight screenshot into a confirmed, editable itinerary and helps a traveller understand self-transfer risk before making a decision.

Core user journey:

flight screenshot
→ multimodal extraction
→ editable itinerary fields
→ user correction
→ explicit confirmation
→ connection-risk explanation
→ safer alternatives
→ Keep or Switch decision

The product is not a booking engine. It must not imply that it has booked, paid for, ticketed, reserved, or issued anything.

## Primary user problem

A cheap self-transfer can become an expensive failure cascade:

- the first flight is delayed;
- the traveller misses the second ticket;
- the tickets may not be protected as one itinerary;
- baggage, immigration, terminal changes, and re-check-in can reduce the usable connection time.

StitchCheck should make this risk understandable without claiming certainty.

## Current product behavior

The current UI contains:

- StitchCheck header and status banner;
- synthetic/demo disclosure;
- itinerary confirmation panel;
- corrected fields and correction history;
- connection-risk heuristic result;
- safer alternatives;
- comparison between current self-transfer and alternatives;
- Keep current plan and Switch to alternative actions.

Current evidence modes include:

- local synthetic fixtures;
- OpenRouter temporary extraction path;
- Atlas production search reference prices;
- Atlas sandbox Search/Verify evidence;
- Nosana local placeholder;
- offline VCC/318 guard.

Every mode must be visibly labelled. Never merge or relabel one evidence source as another.

## Current UI issues to solve

Improve the UI for:

1. Information hierarchy.
2. Readability at normal laptop/video-demo size.
3. Clear distinction between confirmed facts, model inference, heuristic risk, provider evidence, and local simulation.
4. Stronger visual focus on the self-transfer risk.
5. More obvious Gemini multimodal extraction moment when that path is actually used.
6. Clear human confirmation boundary.
7. Better comparison of the current plan and safer alternatives.
8. Reduced visual density.
9. Better responsive behavior.
10. Better accessibility and keyboard navigation.
11. Stable layout for Playwright/video capture.
12. No clipping, overflow, unreadably small text, or layout shift.

The current demo video has a rendering/readability problem: the interface appears too small and may have been captured before the layout, fonts, or assets settled. Design changes must support deterministic capture at a fixed viewport.

## Design goal

Create a calm, trustworthy, safety-oriented travel decision interface.

The UI should feel:

- clear;
- evidence-led;
- human-controlled;
- aviation/travel appropriate;
- modern but not flashy;
- polished enough for a hackathon demo;
- understandable within a few seconds.

Do not turn it into:

- a generic chatbot;
- a dashboard with excessive panels;
- a booking checkout;
- an overdecorated travel marketplace;
- a dense data table;
- a fake live-provider console.

## Recommended information architecture

Design the main screen in this order:

### 1. Status and trust layer

Show:

- StitchCheck name;
- short product statement;
- current mode;
- prominent but compact disclosure;
- current evidence provenance.

Example:

```text
Synthetic demo — no live booking or payment
```

For live or provider-backed evidence, use precise labels such as:

```text
Atlas Sandbox Search/Verify — read-only evidence
```

Do not use one generic “live” badge for all sources.

### 2. Confirmed itinerary

Make this the primary object.

Show each leg as a readable flight card with:

- origin and destination;
- airport codes;
- local departure and arrival time;
- flight number;
- date;
- airline/provider if available;
- connection location;
- connection duration;
- edit affordance.

Use an explicit state:

```text
Confirmed by traveller
```

Do not imply that the model’s initial extraction was final.

### 3. Correction history

When a field changes, show:

```text
Correction recorded
SC-202 → SC-200
```

Explain briefly:

```text
The traveller reviewed and corrected the extracted itinerary.
```

Avoid exposing raw model internals unless useful.

### 4. Connection-risk hero

Give the risk result the strongest visual emphasis after the itinerary.

Show:

- risk band: Low, Medium, or High;
- connection duration;
- estimated usable time;
- delay assumption;
- baggage/immigration/terminal assumptions;
- a short failure-cascade explanation;
- uncertainty disclaimer.

Example copy:

```text
Medium connection risk

A delay on the first flight could leave too little usable time for the second ticket. This is a heuristic based on the assumptions shown below, not a guaranteed prediction.
```

Use a calm warning palette. Avoid alarmist red unless the situation is genuinely high risk.

### 5. Evidence and assumptions

Separate:

```text
Known itinerary facts
Model extraction
Heuristic assumptions
Provider-returned evidence
Local synthetic placeholders
```

Use collapsible details for secondary information, but do not hide important disclosures.

### 6. Safer alternatives

Show alternatives as compact comparison cards.

Each card should include:

- route;
- direct or self-transfer type;
- departure/arrival;
- total duration;
- connection duration;
- price status;
- evidence source;
- availability status.

If the price is a reference price, say:

```text
Reference price only — not a bookable offer
```

If synthetic:

```text
Synthetic placeholder — display only
```

If Atlas returned it:

```text
Atlas Search/Verify evidence — read-only
```


### 7. Human decision boundary

Make the final decision area visually clear:

```text
Your decision
Keep current plan
Switch to alternative
```

Include:

```text
This changes the local comparison only. No booking, payment, order, or ticket is created.
```

The UI must not use labels such as:

- Book now;
- Pay;
- Confirm ticket;
- Issue ticket;
- Retry booking;
- Place order.


## Visual direction

Use a restrained design system:

- warm white or very light neutral background;
- deep navy text;
- one trustworthy blue accent;
- amber for medium risk;
- muted red only for high-risk warnings;
- green for confirmed/success states;
- generous spacing;
- clear card grouping;
- 12–16px body text minimum;
- 24–32px section headings;
- strong contrast;
- rounded corners used sparingly;
- subtle borders instead of heavy shadows.

Avoid excessive gradients, neon colors, tiny labels, dense badges, and large empty areas.

## Responsive behavior

Design for:

- 1440×900 demo capture;
- 1280×800 laptop;
- 1024px tablet width;
- mobile fallback.

At 1440×900:

- the main itinerary and risk result must be readable without browser zoom;
- avoid showing the entire page as a tiny full-page capture;
- use a clear single-column narrative or a controlled two-column layout;
- alternatives should remain readable;
- no horizontal scrolling.

At smaller widths:

- stack the itinerary, risk, alternatives, and decision sections;
- preserve the order of importance;
- keep the disclosure visible;
- do not hide risk information behind a menu.


## Video-capture stability

Add or preserve a deterministic capture state.

The design must support:

- fixed viewport;
- no layout shifts after initial load;
- no animations required to understand the page;
- no blinking or moving elements;
- stable card heights;
- stable typography;
- visible ready state;
- no hover-only content;
- no delayed font causing reflow;
- no content that appears only after a long timeout.

If adding a capture-specific class, use a clear convention such as:

```text
.demo-capture
```

In capture mode:

- disable transitions and animations;
- preserve all disclosures;
- keep text at readable size;
- ensure panels are fully populated before capture;
- avoid viewport-relative captions that can clip.


## Gemini moment

When direct Gemini is actually executed and verified, make the multimodal moment visible:

```text
Screenshot uploaded
→ Gemini extracts itinerary fields
→ uncertain field highlighted
→ traveller corrects it
→ itinerary confirmed
```

The UI should distinguish:

```text
Gemini extraction
```

from:

```text
OpenRouter temporary path — not direct Gemini validation
```

Never claim direct Gemini was used unless the evidence artifact confirms it.

## Provider and evidence labels

Use a reusable provenance component with:

- source;
- execution mode;
- read-only/write status;
- timestamp where appropriate;
- synthetic/live/reference/simulated classification.

Examples:

```text
Synthetic local placeholder — display only
```

```text
OpenRouter temporary path — not direct Gemini validation
```

```text
Atlas Sandbox Search/Verify — read-only evidence
```

```text
Atlas production search — reference prices only
```

```text
Simulated ticketing lifecycle — no external order or payment
```

Do not make provider labels visually stronger than the product decision itself.

## Accessibility

Require:

- WCAG-conscious contrast;
- keyboard-accessible controls;
- visible focus states;
- semantic headings;
- labelled buttons;
- no color-only risk communication;
- plain-language explanations;
- screen-reader-friendly status announcements;
- logical tab order;
- adequate click targets;
- no text embedded only in images;
- reduced-motion support.


## Component suggestions

Prefer reusable components such as:

- `TrustBanner`;
- `EvidenceBadge`;
- `ItineraryCard`;
- `EditableFlightField`;
- `CorrectionNotice`;
- `RiskHero`;
- `AssumptionList`;
- `AlternativeCard`;
- `EvidenceDisclosure`;
- `DecisionBoundary`;
- `DemoModeIndicator`.

Do not introduce a large UI framework or unnecessary dependencies unless the repository already uses one.

## Safety constraints

Do not change business logic to make the demo look more successful.

Do not:

- fabricate provider results;
- call external providers;
- expose secrets;
- add real booking/payment/ticketing behavior;
- remove synthetic/live/reference labels;
- imply that heuristic risk is guaranteed;
- imply that a reference price is bookable;
- silently fall back from Gemini to OpenRouter;
- relabel OpenRouter as Gemini;
- change the default fixture-only browser behavior.


## Required deliverables

First produce a design proposal containing:

1. Current UI diagnosis.
2. Proposed information hierarchy.
3. Page layout.
4. Component inventory.
5. Evidence/provenance treatment.
6. Responsive behavior.
7. Accessibility changes.
8. Video-capture stability changes.
9. Copy changes.
10. Acceptance criteria.
11. Files/components expected to change.
12. What must remain unchanged.

Then, only after approval, implement the minimum UI changes.

## Acceptance criteria

The redesign passes when:

- a new viewer understands the product purpose within five seconds;
- the confirmed itinerary is the primary object;
- the self-transfer risk is immediately visible;
- the failure cascade is understandable without reading a long paragraph;
- facts, assumptions, inference, and provider evidence are distinguishable;
- alternatives are comparable at normal zoom;
- the final human decision is obvious;
- no action implies booking, payment, or ticketing;
- all evidence labels remain accurate;
- the UI works at 1440×900 without tiny text;
- there is no horizontal overflow;
- there is no layout shift after ready state;
- keyboard navigation works;
- the default local fixture mode remains intact;
- existing tests and capture workflows remain compatible;
- no secrets or provider calls are introduced.

```

## Design priorities

Ask the plugin to prioritize these in order:

1. Make the **risk story** immediately understandable.
2. Make the **confirmed itinerary** readable.
3. Make **evidence provenance** impossible to miss or misunderstand.
4. Make the UI readable in the video.
5. Improve visual polish only after those four are stable.

The hackathon guide specifically emphasizes showing the working core loop early, making Gemini essential, and delivering a demo of no more than three minutes. That means the redesign should optimize for a clear sequence—screenshot, extraction, correction, risk, alternatives, decision—rather than adding more features.  The existing project notes likewise prioritize capture stability, readable captions, deterministic browser capture, and accurate evidence labels over additional integrations.[^1][^2]


<div align="center">⁂</div>

[^1]: Build-with-Gemini-Hackathon-2026-Participant-Guide.pdf
[^2]: what-are-outstanding-to-code-after-22_00.md```

