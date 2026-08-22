# StitchCheck React UI Acceptance Checklist

## Scope

This checklist validates **only** the local React/Vite demo interface built under `app/`. It confirms that the UI renders correctly, enforces the confirmation gate, displays the required disclaimer labels, and blocks forbidden actions. It does **not** prove that Gemini, OpenRouter, Nosana, or Atlas integration works. All data displayed is local synthetic fixture data.

## Startup and Safety Notice

- [ ] App loads locally without an external request.
- [ ] A synthetic-demo safety notice is visible on the landing screen.
- [ ] User acknowledges that displayed placeholders are not live-service evidence.
- [ ] No credential or API-key value is displayed anywhere in the UI.

## Itinerary Input and Review

- [ ] User can choose a local synthetic screenshot fixture.
- [ ] Existing extraction label is visible exactly: `OpenRouter temporary path — not direct Gemini validation`
- [ ] Extracted itinerary fields are editable.
- [ ] User can correct at least one field.
- [ ] Required/missing-field state is understandable.
- [ ] No direct-Gemini success claim is shown.

## Confirmation Gate

- [ ] Risk and alternatives panels initially show: `Confirm itinerary first`
- [ ] Risk and alternatives actions are disabled before confirmation.
- [ ] User must explicitly confirm the itinerary.
- [ ] Confirmation state is visibly shown.
- [ ] Confirmation does not trigger an external request.
- [ ] No downstream booking or write action becomes available.

## Local Placeholder Panels

- [ ] After confirmation, risk panel shows exact label: `Synthetic local placeholder — not Nosana evidence`
- [ ] Risk panel includes a heuristic-risk disclaimer.
- [ ] After confirmation, alternatives panel shows exact label: `Synthetic local placeholder — not Atlas Sandbox evidence`
- [ ] Alternatives content is visibly Sandbox-labelled and search-only.
- [ ] Empty, error, unavailable, and timeout states render clearly.
- [ ] Local placeholders are not described as actual service results.

## Comparison and Decision

- [ ] Comparison shows the reviewed itinerary beside synthetic alternatives.
- [ ] Keep/Switch is a local UI selection only.
- [ ] Final decision explicitly states no booking, payment, reservation, ticket, order, verification, or other write action occurs.
- [ ] No UI text, button, route, or handler offers forbidden Atlas/write actions.

## Responsive and Accessibility Checks

- [ ] Desktop layout is readable.
- [ ] Mobile-width layout remains usable.
- [ ] Inputs and buttons have visible labels.
- [ ] Keyboard focus is visible.
- [ ] Disabled controls communicate why they are unavailable.
- [ ] Status/error information is understandable without color alone.

## Build Verification

- [ ] Only approved packages were installed inside `app/`.
- [ ] Type-check passes.
- [ ] Production build passes.
- [ ] Localhost browser walkthrough completed.
- [ ] No external network request was made.
- [ ] No `.env.local` access occurred.
- [ ] No Git operation occurred.

## Stop Condition

This task creates **only**:

```
docs/react-ui-acceptance-checklist.md
```

No other file is created, modified, or deleted.
