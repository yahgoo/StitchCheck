# StitchCheck Capture Selector Map

> **Purpose:** Exact Playwright selectors and UI assertions for capturing the six StitchCheck demo scenes.
> **Source of truth:** `app/src/components/*.tsx`, `app/src/data/labels.ts`, `app/src/data/fixtures.ts`, `app-fixture-contracts/stitchcheck-ui-demo-data.json`.
> **Convention:** Selectors are derived from component source. Selectors marked `needs-runtime-verification` depend on rendered DOM that cannot be statically confirmed from source alone (e.g. computed class names, dynamic compound selectors).

---

## Global Selectors (visible in every step after safety-notice)

| Element | Selector | Visible text / value |
|---|---|---|
| App root | `div.sc-app` | — |
| Header title | `header.sc-header h1` | `StitchCheck` |
| Header badge | `header.sc-header span.sc-header__badge` | `Synthetic Demo — No Live Services` |
| Footer | `footer.sc-footer p` | `StitchCheck Synthetic Demo · No external calls · No booking, payment, or order created · All data is fictional and local` |

---

## Scene 1 — Initial Locked State

### Starting state
- App launched at `http://localhost:5173/`.
- `step === 'safety-notice'` — safety-notice overlay is rendered.

### Transition to review step (prerequisite)
1. Acknowledge safety notice.
2. Select two fixtures (e.g. slot 0 → `gem-01`, slot 1 → `gem-02`).
3. Click **Continue to review**.
4. `step` transitions to `'review'`.

### User action
No action on the review screen yet — capture the locked downstream panels.

### Exact visible text
| Element | Text |
|---|---|
| Itinerary heading | `Review Extracted Itinerary` |
| Source label (extraction) | `OpenRouter temporary path — not direct Gemini validation` |
| Risk panel heading | `Connection Risk` |
| Risk disabled message | `Confirm itinerary first` |
| Risk source label | `Synthetic local placeholder — not Nosana evidence` |
| Alternatives panel heading | `Safer Alternatives` |
| Alternatives disabled message | `Confirm itinerary first` |
| Alternatives source label | `Synthetic local placeholder — not Atlas Sandbox evidence` |
| Confirm button label | `Confirm itinerary` |

### Stable selector candidates

| Element | Selector | Notes |
|---|---|---|
| Itinerary review section | `section.sc-itinerary-review[aria-label="Review extracted itinerary"]` | |
| Source label (extraction) | `section.sc-itinerary-review p.sc-source-label` | Exact text: `OpenRouter temporary path — not direct Gemini validation` |
| First-leg fieldset | `fieldset.sc-fieldset:has(legend:text("First Leg"))` | `needs-runtime-verification` — `:has()` + `:text()` pseudo requires Playwright locator API |
| Second-leg fieldset | `fieldset.sc-fieldset:has(legend:text("Second Leg"))` | `needs-runtime-verification` |
| First-leg flight number input | `input#firstLeg-flightNumber` | Value: `SC-101` |
| Second-leg flight number input | `input#secondLeg-flightNumber` | Value: `SC-202` |
| Connection duration input | `input#connection-duration` | Value: `150` |
| Confirm button | `button.sc-btn.sc-btn--primary:text("Confirm itinerary")` | Enabled (all fields populated) |
| Risk panel (disabled) | `section.sc-panel.sc-panel--disabled[aria-label="Connection risk"]` | `aria-disabled="true"` |
| Risk lock icon | `section[aria-label="Connection risk"] span.sc-panel__lock-icon` | Text: 🔒 |
| Risk disabled text | `section[aria-label="Connection risk"] div.sc-panel__locked p` | `Confirm itinerary first` |
| Risk source label | `section[aria-label="Connection risk"] p.sc-source-label` | `Synthetic local placeholder — not Nosana evidence` |
| Alternatives panel (disabled) | `section.sc-panel.sc-panel--disabled[aria-label="Safer alternatives"]` | `aria-disabled="true"` |
| Alternatives lock icon | `section[aria-label="Safer alternatives"] span.sc-panel__lock-icon` | Text: 🔒 |
| Alternatives disabled text | `section[aria-label="Safer alternatives"] div.sc-panel__locked p` | `Confirm itinerary first` |
| Alternatives source label | `section[aria-label="Safer alternatives"] p.sc-source-label` | `Synthetic local placeholder — not Atlas Sandbox evidence` |

### Assertions before capture

```js
// Itinerary review is visible and editable
await expect(page.locator('section.sc-itinerary-review')).toBeVisible();
await expect(page.locator('input#secondLeg-flightNumber')).toHaveValue('SC-202');
await expect(page.locator('input#firstLeg-flightNumber')).toHaveValue('SC-101');
await expect(page.locator('input#connection-duration')).toHaveValue('150');

// Source label visible
await expect(page.locator('section.sc-itinerary-review p.sc-source-label'))
  .toHaveText('OpenRouter temporary path — not direct Gemini validation');

// Risk panel locked
await expect(page.locator('section[aria-label="Connection risk"]')).toHaveAttribute('aria-disabled', 'true');
await expect(page.locator('section[aria-label="Connection risk"] div.sc-panel__locked p'))
  .toHaveText('Confirm itinerary first');
await expect(page.locator('section[aria-label="Connection risk"] p.sc-source-label'))
  .toHaveText('Synthetic local placeholder — not Nosana evidence');

// Alternatives panel locked
await expect(page.locator('section[aria-label="Safer alternatives"]')).toHaveAttribute('aria-disabled', 'true');
await expect(page.locator('section[aria-label="Safer alternatives"] div.sc-panel__locked p'))
  .toHaveText('Confirm itinerary first');
await expect(page.locator('section[aria-label="Safer alternatives"] p.sc-source-label'))
  .toHaveText('Synthetic local placeholder — not Atlas Sandbox evidence');

// Confirm button is enabled (all fields populated)
await expect(page.locator('button.sc-btn.sc-btn--primary:text("Confirm itinerary")')).toBeEnabled();
```

### Expected locked/unlocked state
| Panel | State |
|---|---|
| Risk | **Locked** — `aria-disabled="true"`, class `sc-panel--disabled`, lock icon visible |
| Alternatives | **Locked** — `aria-disabled="true"`, class `sc-panel--disabled`, lock icon visible |
| Confirm button | **Enabled** — all required fields populated |

### Required evidence labels
- `OpenRouter temporary path — not direct Gemini validation` — visible in itinerary review section
- `Synthetic local placeholder — not Nosana evidence` — visible in risk panel
- `Synthetic local placeholder — not Atlas Sandbox evidence` — visible in alternatives panel

### Reset / recovery
- Click **Restart demo** button (`button.sc-btn.sc-btn--secondary:text("Restart demo")`) at any time, or reload the page (`page.reload()`).

---

## Scene 2 — Edited Itinerary Field

### Starting state
- `step === 'review'`, all fields populated, no corrections yet.
- `input#secondLeg-flightNumber` has value `SC-202`.

### User action
- Clear `input#secondLeg-flightNumber` and type `SC-299`.

### Exact visible text
| Element | Text |
|---|---|
| Correction heading | `Corrections recorded` |
| Correction note list item | `Changed secondLeg.flightNumber: "SC-202" → "SC-299"` |

### Stable selector candidates

| Element | Selector | Notes |
|---|---|---|
| Second-leg flight number input | `input#secondLeg-flightNumber` | Type `SC-299` into this field |
| Corrections container | `div.sc-corrections` | Appears only when `correctionNotes.length > 0` |
| Corrections heading | `div.sc-corrections h3` | `Corrections recorded` |
| Correction note item | `div.sc-corrections ul li` | Dynamic text — see below |
| Confirm button | `button.sc-btn.sc-btn--primary:text("Confirm itinerary")` | Still enabled after edit |

### Assertions before capture

```js
// Field was changed
await expect(page.locator('input#secondLeg-flightNumber')).toHaveValue('SC-299');

// Correction note appeared
await expect(page.locator('div.sc-corrections')).toBeVisible();
await expect(page.locator('div.sc-corrections h3')).toHaveText('Corrections recorded');
await expect(page.locator('div.sc-corrections ul li'))
  .toHaveText('Changed secondLeg.flightNumber: "SC-202" → "SC-299"');

// Panels remain locked
await expect(page.locator('section[aria-label="Connection risk"]')).toHaveAttribute('aria-disabled', 'true');
await expect(page.locator('section[aria-label="Safer alternatives"]')).toHaveAttribute('aria-disabled', 'true');
```

### Expected locked/unlocked state
| Panel | State |
|---|---|
| Risk | **Locked** — unchanged from Scene 1 |
| Alternatives | **Locked** — unchanged from Scene 1 |
| Confirm button | **Enabled** |

### Required evidence labels
- `OpenRouter temporary path — not direct Gemini validation` — still visible in itinerary review
- `Synthetic local placeholder — not Nosana evidence` — still visible in locked risk panel
- `Synthetic local placeholder — not Atlas Sandbox evidence` — still visible in locked alternatives panel

### Reset / recovery
- To undo the edit: clear `input#secondLeg-flightNumber` and re-type `SC-202` — the correction note will disappear automatically.
- Full reset: click **Restart demo** or reload the page.

---

## Scene 3 — Confirmed / Unlocked Panels

### Starting state
- `step === 'review'`, fields corrected (Scene 2 state), confirm button enabled.

### User action
- Click `button.sc-btn.sc-btn--primary:text("Confirm itinerary")`.

### Exact visible text
| Element | Text |
|---|---|
| Confirmed itinerary heading | `✓ Itinerary Confirmed` |
| Confirmed body text | `The itinerary has been confirmed. Risk and alternatives panels are now available. No external service call was made. All downstream data is local synthetic placeholder content.` |
| Status banner | `Success: Itinerary confirmed. No external service call was made. Downstream panels are now active with local synthetic placeholder data.` |
| Risk panel heading (enabled, success) | `Connection Risk — Heuristic Result` |
| Risk band label | `Risk Band:` |
| Risk band value | `medium` |
| Risk score | `Score: 0.42` |
| Risk heuristic disclaimer | `Heuristic risk estimate only — derived from a static/historical synthetic dataset; not a live delay, weather, legal, or guaranteed-outcome prediction. Synthetic local placeholder — not Nosana evidence.` |
| Alternatives panel heading (enabled, success) | `Safer Alternatives — Sandbox Results` |
| Alternatives env label | `Source environment: sandbox-placeholder` |
| Alternative 1 route | `AAA → BBB → CCC (synthetic)` |
| Alternative 2 route | `AAA → CCC direct (synthetic)` |

### Stable selector candidates

| Element | Selector | Notes |
|---|---|---|
| Confirmed itinerary section | `section.sc-itinerary-review--confirmed` or `section.sc-itinerary-review[aria-label="Confirmed itinerary"]` | Replaces the editable review |
| Confirmed heading | `section.sc-itinerary-review--confirmed h2` | `✓ Itinerary Confirmed` |
| Status banner | `div.sc-banner.sc-banner--success` | `role="status"` |
| Status banner text | `div.sc-banner.sc-banner--success strong` + following text node | `Success:` prefix + message |
| Risk panel (enabled) | `section.sc-panel[aria-label="Connection risk"]` | No `sc-panel--disabled` class; no `aria-disabled` |
| Risk heading (success) | `section[aria-label="Connection risk"] h2` | `Connection Risk — Heuristic Result` |
| Risk band container | `div.sc-risk-band.sc-risk-band--medium` | |
| Risk band value | `span.sc-risk-band__value` | `medium` |
| Risk score | `p.sc-risk-score` | `Score: 0.42` |
| Risk disclaimer | `div.sc-disclaimer` (within risk panel) | Full heuristic disclaimer text |
| Risk source label | `section[aria-label="Connection risk"] p.sc-source-label` | `Synthetic local placeholder — not Nosana evidence` |
| Alternatives panel (enabled) | `section.sc-panel[aria-label="Safer alternatives"]` | No `sc-panel--disabled` class |
| Alternatives heading (success) | `section[aria-label="Safer alternatives"] h2` | `Safer Alternatives — Sandbox Results` |
| Alternatives env label | `section[aria-label="Safer alternatives"] p.sc-panel__env-label` | `Source environment: sandbox-placeholder` |
| Alternative cards | `div.sc-alternative-card` | Two cards rendered |
| Alternative 1 heading | `div.sc-alternative-card:nth-child(1) h3` | `AAA → BBB → CCC (synthetic)` |
| Alternative 2 heading | `div.sc-alternative-card:nth-child(2) h3` | `AAA → CCC direct (synthetic)` |
| Alternatives source label | `section[aria-label="Safer alternatives"] p.sc-source-label` | `Synthetic local placeholder — not Atlas Sandbox evidence` |

### Assertions before capture

```js
// Itinerary confirmed section
await expect(page.locator('section[aria-label="Confirmed itinerary"]')).toBeVisible();
await expect(page.locator('section[aria-label="Confirmed itinerary"] h2'))
  .toHaveText('✓ Itinerary Confirmed');

// Status banner
await expect(page.locator('div.sc-banner.sc-banner--success')).toBeVisible();
await expect(page.locator('div.sc-banner.sc-banner--success'))
  .toContainText('Itinerary confirmed. No external service call was made.');

// Risk panel unlocked
const riskPanel = page.locator('section[aria-label="Connection risk"]');
await expect(riskPanel).toBeVisible();
await expect(riskPanel).not.toHaveAttribute('aria-disabled', 'true');
await expect(riskPanel.locator('h2')).toHaveText('Connection Risk — Heuristic Result');
await expect(riskPanel.locator('span.sc-risk-band__value')).toHaveText('medium');
await expect(riskPanel.locator('p.sc-risk-score')).toHaveText('Score: 0.42');
await expect(riskPanel.locator('p.sc-source-label'))
  .toHaveText('Synthetic local placeholder — not Nosana evidence');

// Alternatives panel unlocked
const altPanel = page.locator('section[aria-label="Safer alternatives"]');
await expect(altPanel).toBeVisible();
await expect(altPanel).not.toHaveAttribute('aria-disabled', 'true');
await expect(altPanel.locator('h2')).toHaveText('Safer Alternatives — Sandbox Results');
await expect(altPanel.locator('div.sc-alternative-card')).toHaveCount(2);
await expect(altPanel.locator('p.sc-source-label'))
  .toHaveText('Synthetic local placeholder — not Atlas Sandbox evidence');
```

### Expected locked/unlocked state
| Panel | State |
|---|---|
| Risk | **Unlocked** — showing success fixture (medium band, score 0.42) |
| Alternatives | **Unlocked** — showing success fixture (2 alternatives) |
| Status banner | **Visible** — success type |

### Required evidence labels
- `OpenRouter temporary path — not direct Gemini validation` — visible in confirmed itinerary section
- `Synthetic local placeholder — not Nosana evidence` — visible in risk panel source label and disclaimer
- `Synthetic local placeholder — not Atlas Sandbox evidence` — visible in alternatives panel source label

### Reset / recovery
- Click **Restart demo** (in footer of decision panel, or via `button.sc-btn--secondary:text("Restart demo")`) or reload the page.
- To go back without full reset: click **Cancel and re-upload** (`button.sc-btn--secondary:text("Cancel and re-upload")`) — returns to upload step. Note: after confirmation, the ItineraryReview renders in confirmed mode and does not show a "Cancel" button; use Restart or page reload instead.

---

## Scene 4 — Provider-Status / Result View

### Starting state
- `step === 'confirmed'`, panels unlocked with success-scenario fixtures (Scene 3 state).

### User action
- Scroll to ensure risk panel and alternatives panel are fully visible.
- Optionally, use the demo-scenario dropdowns to switch scenarios (e.g. `select#risk-scenario` → `error`, `select#alt-scenario` → `error`). For the default capture, keep `success` selected.

### Exact visible text (success scenario — default)

**Risk panel:**
| Element | Text |
|---|---|
| Heading | `Connection Risk — Heuristic Result` |
| Risk band | `Risk Band: medium` |
| Score | `Score: 0.42` |
| Disclaimer | `Heuristic risk estimate only — derived from a static/historical synthetic dataset; not a live delay, weather, legal, or guaranteed-outcome prediction. Synthetic local placeholder — not Nosana evidence.` |
| Explanation | `A 75-minute connection at this synthetic airport profile historically misses onward legs in roughly the medium band of the demo dataset. This is a heuristic indication, not a prediction or guarantee, and no booking, order, or payment is involved.` |
| Footer note | `Dataset: synthetic-demo-v0 · Fallback used: no` |
| Source label | `Synthetic local placeholder — not Nosana evidence` |

**Alternatives panel:**
| Element | Text |
|---|---|
| Heading | `Safer Alternatives — Sandbox Results` |
| Env label | `Source environment: sandbox-placeholder` |
| Alt 1 route | `AAA → BBB → CCC (synthetic)` |
| Alt 1 departure | `08:30` |
| Alt 1 arrival | `16:10` |
| Alt 1 duration | `7h 40m` |
| Alt 1 type | `one-stop` |
| Alt 1 connection | `135 min` |
| Alt 1 price | `— placeholder —` |
| Alt 1 availability | `placeholder-availability` |
| Alt 1 reference | `Reference: display-only-reference-a1 (display-only)` |
| Alt 2 route | `AAA → CCC direct (synthetic)` |
| Alt 2 departure | `09:15` |
| Alt 2 arrival | `13:05` |
| Alt 2 duration | `3h 50m` |
| Alt 2 type | `nonstop` |
| Alt 2 connection | `0 min` |
| Alt 2 price | `— placeholder —` |
| Alt 2 reference | `Reference: display-only-reference-a2 (display-only)` |
| Source label | `Synthetic local placeholder — not Atlas Sandbox evidence` |

### Stable selector candidates

| Element | Selector | Notes |
|---|---|---|
| Risk scenario dropdown | `select#risk-scenario` | Options: `success`, `unavailable`, `error`, `timeout`, `failure` |
| Alt scenario dropdown | `select#alt-scenario` | Options: `success`, `empty`, `error`, `timeout` |
| Risk band value | `section[aria-label="Connection risk"] span.sc-risk-band__value` | `medium` |
| Risk score text | `section[aria-label="Connection risk"] p.sc-risk-score` | `Score: 0.42` |
| Risk disclaimer | `section[aria-label="Connection risk"] div.sc-disclaimer` | Full heuristic text |
| Risk explanation | `section[aria-label="Connection risk"] p.sc-explanation` | Cascade explanation |
| Risk footer note | `section[aria-label="Connection risk"] p.sc-panel__footer-note` | `Dataset: synthetic-demo-v0 · Fallback used: no` |
| Alt cards list | `section[aria-label="Safer alternatives"] div.sc-alternatives-list` | |
| Alt cards | `section[aria-label="Safer alternatives"] div.sc-alternative-card` | Count: 2 |
| Alt detail list | `dl.sc-alt-details` (within each card) | |
| Alt env label | `section[aria-label="Safer alternatives"] p.sc-panel__env-label` | Contains `sandbox-placeholder` in `<strong>` |

### Assertions before capture

```js
// Risk panel — success scenario
await expect(page.locator('section[aria-label="Connection risk"] span.sc-risk-band__value'))
  .toHaveText('medium');
await expect(page.locator('section[aria-label="Connection risk"] p.sc-risk-score'))
  .toHaveText('Score: 0.42');
await expect(page.locator('section[aria-label="Connection risk"] p.sc-panel__footer-note'))
  .toHaveText('Dataset: synthetic-demo-v0 · Fallback used: no');

// Alternatives panel — success scenario
await expect(page.locator('section[aria-label="Safer alternatives"] div.sc-alternative-card'))
  .toHaveCount(2);
await expect(page.locator('section[aria-label="Safer alternatives"] p.sc-panel__env-label strong'))
  .toHaveText('sandbox-placeholder');

// Scenario dropdowns are at default 'success'
await expect(page.locator('select#risk-scenario')).toHaveValue('success');
await expect(page.locator('select#alt-scenario')).toHaveValue('success');
```

### Expected locked/unlocked state
| Panel | State |
|---|---|
| Risk | **Unlocked** — success scenario rendered |
| Alternatives | **Unlocked** — success scenario rendered |

### Required evidence labels
- `Synthetic local placeholder — not Nosana evidence` — in risk panel source label and disclaimer
- `Synthetic local placeholder — not Atlas Sandbox evidence` — in alternatives panel source label

### Reset / recovery
- To switch scenario: change `select#risk-scenario` or `select#alt-scenario` to a different option.
- Full reset: click **Restart demo** or reload the page.

---

## Scene 5 — Comparison State

### Starting state
- `step === 'confirmed'`, panels unlocked with success fixtures.
- `ComparisonView` component is rendered between the panels grid and the decision panel.

### User action
- Scroll to the comparison section.

### Exact visible text
| Element | Text |
|---|---|
| Comparison heading | `Compare: Risky Self-Transfer vs Safer Alternatives` |
| Comparison source label | `Synthetic local placeholder — not Atlas Sandbox evidence` |
| Original plan heading | `Your Current Plan` |
| Original plan Nosana label | `Synthetic local placeholder — not Nosana evidence` |
| Original route | `AAA → BBB → CCC (self-transfer, synthetic)` |
| Original leg 1 | `AAA → BBB, SC-101, 08:00–10:30` |
| Original leg 2 | `BBB → CCC, SC-299, 13:00–15:45` |
| Original connection | `150 min` |
| Original risk band | `medium (0.42)` |
| Alternatives heading | `Safer Alternatives` |
| Table header row | `Route | Depart | Arrive | Duration | Type | Price` |
| Alt 1 row | `AAA → BBB → CCC (synthetic) | 08:30 | 16:10 | 7h 40m | one-stop | — placeholder —` |
| Alt 2 row | `AAA → CCC direct (synthetic) | 09:15 | 13:05 | 3h 50m | nonstop | — placeholder —` |

### Stable selector candidates

| Element | Selector | Notes |
|---|---|---|
| Comparison section | `section.sc-comparison[aria-label="Compare itinerary with alternatives"]` | |
| Comparison heading | `section.sc-comparison h2` | `Compare: Risky Self-Transfer vs Safer Alternatives` |
| Comparison source label | `section.sc-comparison > p.sc-source-label` | Atlas label |
| Original plan column | `div.sc-comparison-col--original` | |
| Original plan heading | `div.sc-comparison-col--original h3` | `Your Current Plan` |
| Original Nosana label | `div.sc-comparison-col--original p.sc-source-label--small` | Nosana label |
| Original plan definition list | `div.sc-comparison-col--original dl` | |
| Comparison table | `table.sc-comparison-table` | |
| Table header cells | `table.sc-comparison-table thead th` | 6 columns |
| Table body rows | `table.sc-comparison-table tbody tr` | 2 rows |
| Alternatives column | `div.sc-comparison-col--alternatives` | |
| Alternatives column heading | `div.sc-comparison-col--alternatives h3` | `Safer Alternatives` |
| Alternatives small label | `div.sc-comparison-col--alternatives p.sc-source-label--small` | Atlas label |

### Assertions before capture

```js
// Comparison section visible
await expect(page.locator('section.sc-comparison')).toBeVisible();
await expect(page.locator('section.sc-comparison h2'))
  .toHaveText('Compare: Risky Self-Transfer vs Safer Alternatives');

// Original plan column
await expect(page.locator('div.sc-comparison-col--original h3'))
  .toHaveText('Your Current Plan');
await expect(page.locator('div.sc-comparison-col--original p.sc-source-label--small'))
  .toHaveText('Synthetic local placeholder — not Nosana evidence');

// Comparison table with 2 alternative rows
await expect(page.locator('table.sc-comparison-table')).toBeVisible();
await expect(page.locator('table.sc-comparison-table tbody tr')).toHaveCount(2);

// Alternatives column
await expect(page.locator('div.sc-comparison-col--alternatives h3'))
  .toHaveText('Safer Alternatives');
await expect(page.locator('div.sc-comparison-col--alternatives p.sc-source-label--small'))
  .toHaveText('Synthetic local placeholder — not Atlas Sandbox evidence');
```

### Expected locked/unlocked state
| Panel | State |
|---|---|
| Risk | **Unlocked** — visible above comparison |
| Alternatives | **Unlocked** — visible above comparison |
| Comparison | **Visible** — read-only, no interactive controls |

### Required evidence labels
- `Synthetic local placeholder — not Nosana evidence` — in original plan column small label
- `Synthetic local placeholder — not Atlas Sandbox evidence` — in comparison section source label and alternatives column small label

### Reset / recovery
- Scroll back to top or reload the page.
- Full reset: **Restart demo** or `page.reload()`.

---

## Scene 6 — Keep / Switch Final State

### Starting state
- `step === 'confirmed'`, all panels and comparison visible.
- `DecisionPanel` rendered at the bottom with `decision === null` and `decisionConfirmed === false`.

### User action
1. Click **Keep current plan** (`button:text("Keep current plan")`).
2. Click **Confirm decision** (`button:text("Confirm decision")`).

### Exact visible text

**Before decision (initial decision panel):**
| Element | Text |
|---|---|
| Decision heading | `Your Decision` |
| Decision body (excerpt) | `Choose whether to Keep your current self-transfer plan or Switch to a safer alternative. This is a local demo decision only.` |
| Keep button | `Keep current plan` |
| Switch button | `Switch to alternative` |

**After selecting Keep (before confirm):**
| Element | Text |
|---|---|
| Decision summary heading | `Your Decision: Keep` |
| Decision summary body | `You have chosen to keep your current self-transfer plan. This is a local demo decision only.` |
| Confirm decision button | `Confirm decision` |
| Change button | `Change to Switch` |

**After confirming decision (final state):**
| Element | Text |
|---|---|
| Final heading | `Demo Complete — No Action Created` |
| Final statement | `No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only.` |
| Meta: noOrderCreated | `noOrderCreated: true` |
| Meta: syntheticDemo | `syntheticDemo: true` |
| Meta: externalCallsMade | `externalCallsMade: false` |
| Meta: decision | `decision: keep` |
| Restart button | `Restart demo` |

### Stable selector candidates

| Element | Selector | Notes |
|---|---|---|
| Decision section (pre-confirm) | `section.sc-decision[aria-label="Your decision"]` | Not `.sc-decision--final` |
| Decision heading | `section.sc-decision h2` | `Your Decision` |
| Keep button | `section.sc-decision button.sc-btn:text("Keep current plan")` | `aria-pressed` toggles |
| Switch button | `section.sc-decision button.sc-btn:text("Switch to alternative")` | `aria-pressed` toggles |
| Decision summary (after selection) | `div.sc-decision-summary` | Appears when `decision !== null` |
| Decision summary heading | `div.sc-decision-summary h3` | `Your Decision: Keep` or `Your Decision: Switch` |
| Confirm decision button | `div.sc-decision-summary button.sc-btn--primary:text("Confirm decision")` | |
| Change button | `div.sc-decision-summary button.sc-btn--secondary` | `Change to Switch` or `Change to Keep` |
| Final section (post-confirm) | `section.sc-decision--final[aria-label="Demo complete"]` | Replaces the decision section |
| Final heading | `section.sc-decision--final h2` | `Demo Complete — No Action Created` |
| Final statement | `div.sc-final-statement p` | Exact `FINAL_STATEMENT` text |
| Meta list | `dl.sc-meta-list` | |
| Meta items | `dl.sc-meta-list dd` | `true`, `true`, `false`, `keep` (4 dd elements) |
| Restart button (final) | `section.sc-decision--final button.sc-btn--primary:text("Restart demo")` | |

### Assertions before capture

```js
// --- Phase A: Select Keep ---
const keepBtn = page.locator('section.sc-decision button:text("Keep current plan")');
await expect(keepBtn).toBeVisible();
await keepBtn.click();

// aria-pressed should be true for Keep
await expect(keepBtn).toHaveAttribute('aria-pressed', 'true');
// Decision summary visible
await expect(page.locator('div.sc-decision-summary')).toBeVisible();
await expect(page.locator('div.sc-decision-summary h3'))
  .toHaveText('Your Decision: Keep');

// --- Phase B: Confirm decision ---
await page.locator('div.sc-decision-summary button:text("Confirm decision")').click();

// Final state visible
await expect(page.locator('section.sc-decision--final[aria-label="Demo complete"]')).toBeVisible();
await expect(page.locator('section.sc-decision--final h2'))
  .toHaveText('Demo Complete — No Action Created');
await expect(page.locator('div.sc-final-statement p'))
  .toHaveText('No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only.');

// Metadata
const metaDds = page.locator('dl.sc-meta-list dd');
await expect(metaDds.nth(0)).toHaveText('true');   // noOrderCreated
await expect(metaDds.nth(1)).toHaveText('true');   // syntheticDemo
await expect(metaDds.nth(2)).toHaveText('false');  // externalCallsMade
await expect(metaDds.nth(3)).toHaveText('keep');   // decision
```

### Expected locked/unlocked state
| Panel | State |
|---|---|
| Risk | **Unlocked** — still visible above |
| Alternatives | **Unlocked** — still visible above |
| Comparison | **Visible** |
| Decision | **Final state** — `sc-decision--final`, no further actions available beyond Restart |

### Required evidence labels
- `No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only.` — in `div.sc-final-statement p`
- Metadata: `noOrderCreated: true`, `syntheticDemo: true`, `externalCallsMade: false`

### Reset / recovery
- Click **Restart demo** (`section.sc-decision--final button.sc-btn--primary:text("Restart demo")`) or reload the page.

---

## Appendix A — Selector Verification Notes

| Selector | Status | Reason |
|---|---|---|
| `fieldset.sc-fieldset:has(legend:text("First Leg"))` | `needs-runtime-verification` | Playwright `:has()` + `:text()` compound locator; verify in browser |
| `button.sc-btn.sc-btn--primary:text("Confirm itinerary")` | `needs-runtime-verification` | `:text()` pseudo-class; use `getByRole('button', { name: 'Confirm itinerary' })` as alternative |
| Compound class `sc-panel.sc-panel--disabled` | Stable | Present in source; toggled by `enabled` prop |
| `aria-disabled="true"` on disabled panels | Stable | Hard-coded in JSX for `!enabled` branch |
| `aria-label` values on all `<section>` elements | Stable | Hard-coded string literals in JSX |
| `id` attributes on inputs (`firstLeg-flightNumber`, etc.) | Stable | Generated from `${legKey}-${key}` pattern with fixed field list |
| `sc-final-statement` class | Stable | Hard-coded in `DecisionPanel.tsx` |
| Dynamic correction note text | `needs-runtime-verification` | Exact format depends on runtime string interpolation: `Changed ${leg}.${field}: "${origVal}" → "${value}"` |

## Appendix B — Scene-to-Step Mapping

| Scene | `AppStep` value | `userConfirmed` | `decisionConfirmed` | Key component states |
|---|---|---|---|---|
| 1 — Initial locked | `review` | `false` | `false` | RiskPanel `enabled={false}`, AlternativesPanel `enabled={false}` |
| 2 — Edited field | `review` | `false` | `false` | Same as Scene 1 + `correctionNotes.length > 0` |
| 3 — Confirmed | `confirmed` | `true` | `false` | RiskPanel `enabled={true}`, AlternativesPanel `enabled={true}` |
| 4 — Provider results | `confirmed` | `true` | `false` | Same as Scene 3; scroll to panels |
| 5 — Comparison | `confirmed` | `true` | `false` | ComparisonView rendered; scroll to comparison |
| 6 — Keep/Switch final | `confirmed` | `true` | `true` | DecisionPanel `decisionConfirmed={true}` |

## Appendix C — Playwright Locator Alternatives

For selectors using CSS `:text()` pseudo-class (marked `needs-runtime-verification`), prefer these Playwright-native locators:

```js
// Instead of :text() selectors:
page.getByRole('button', { name: 'Confirm itinerary' })
page.getByRole('button', { name: 'Keep current plan' })
page.getByRole('button', { name: 'Switch to alternative' })
page.getByRole('button', { name: 'Confirm decision' })
page.getByRole('button', { name: 'Restart demo' })
page.getByRole('button', { name: 'I understand — continue with synthetic data' })
page.getByRole('button', { name: 'Continue to review' })
page.getByLabel('Confirm itinerary')
page.getByLabel('Connection risk')
page.getByLabel('Safer alternatives')
page.getByLabel('Compare itinerary with alternatives')
page.getByLabel('Your decision')
page.getByLabel('Demo complete')
page.getByLabel('Review extracted itinerary')
page.getByLabel('Confirmed itinerary')
page.getByText('Confirm itinerary first')
page.getByText('OpenRouter temporary path — not direct Gemini validation')
page.getByText('Synthetic local placeholder — not Nosana evidence')
page.getByText('Synthetic local placeholder — not Atlas Sandbox evidence')
```

---

## Verification

- [x] Exactly six scenes documented (Scene 1–6).
- [x] Each scene contains: starting state, user action, exact visible text, stable selector candidates, assertions before capture, locked/unlocked state, evidence labels, reset/recovery method.
- [x] No selectors are guessed — all derived from component source code.
- [x] Selectors requiring runtime verification are explicitly marked `needs-runtime-verification`.
- [x] No app code or existing files were modified.
- [x] Only `docs/stitchcheck-capture-selector-map.md` was created.
