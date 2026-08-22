# StitchCheck UI Truthfulness Audit

> **Date**: 2026-08-21
> **Auditor**: StitchCheck dev lead
> **Scope**: Every `.tsx` and `.ts` file under `app/src/`, the static JSON at `app/public/nosana-risk-result.json`, and the three reference documents listed below.
> **Constraints**: No provider was called. No provider integration was modified. No secret or `.env.local` content was accessed. No human-confirmation gate was weakened.

## Reference Documents Consulted

1. `docs/stitchcheck-atlas-live-disclosure.md`
2. `docs/stitchcheck-demo-readiness-report.md`
3. `docs/stitchcheck-submission-evidence-index.md`

## Files Audited

| File | Lines |
|---|---|
| `app/src/App.tsx` | 229 |
| `app/src/data/labels.ts` | 20 |
| `app/src/data/fixtures.ts` | 106 |
| `app/src/data/types.ts` | 117 |
| `app/src/components/SafetyNotice.tsx` | 43 |
| `app/src/components/UploadPanel.tsx` | 111 |
| `app/src/components/ItineraryReview.tsx` | 203 |
| `app/src/components/RiskPanel.tsx` | 184 |
| `app/src/components/AlternativesPanel.tsx` | 146 |
| `app/src/components/ComparisonView.tsx` | 78 |
| `app/src/components/DecisionPanel.tsx` | 98 |
| `app/src/components/StatusBanner.tsx` | 48 |
| `app/public/nosana-risk-result.json` | 47 |

## Verification Results

### 1. OpenRouter label — PASS

**Required text**: `OpenRouter temporary path — not direct Gemini validation`

**Defined in**: `app/src/data/labels.ts` (line 4–5) as `LABELS.geminiExtraction`.

**Rendered in**:
- `SafetyNotice.tsx` line 38 — footer of the safety-notice screen.
- `UploadPanel.tsx` line 78 — source label on the upload panel.
- `ItineraryReview.tsx` lines 91 and 128 — source label on both the confirmed and unconfirmed itinerary review.

**Verdict**: Exact text is present and visible in every context where extraction provenance is relevant.

---

### 2. Synthetic risk label — PASS

**Required text**: `Synthetic local placeholder — not Nosana evidence`

**Defined in**: `labels.ts` (line 6–7) as `LABELS.nosanaRisk`.

**Rendered in**:
- `RiskPanel.tsx` line 17 — disabled-state source label.
- `RiskPanel.tsx` line 30 — active-state source label when `riskResult` is null.
- `RiskPanel.tsx` line 48 — fallback source label when `evidenceSource` is not `'nosana-evidence'` and `fallbackUsed` is falsy.
- `ComparisonView.tsx` line 26 — source label on the "Your Current Plan" column.

**Fixture coverage**: Every Nosana fixture (`res-nos-success.json`, `res-nos-error.json`, `res-nos-timeout.json`, `res-nos-failure.json`, `res-nos-unavailable.json`) carries `"placeholderLabel": "Synthetic local placeholder — not Nosana evidence"` and embeds the text in `heuristicDisclaimer`.

**Verdict**: Exact text is present on every risk-panel state and in every fixture.

---

### 3. Synthetic alternatives label — PASS

**Required text**: `Synthetic local placeholder — not Atlas Sandbox evidence`

**Defined in**: `labels.ts` (line 12–13) as `LABELS.atlasAlternatives`.

**Rendered in**:
- `AlternativesPanel.tsx` line 17 — disabled-state source label.
- `AlternativesPanel.tsx` line 50 — active-state source label.
- `ComparisonView.tsx` line 15 — top-level comparison source label.
- `ComparisonView.tsx` line 43 — "Safer Alternatives" column source label.

**Fixture coverage**: Every Atlas fixture (`result-atl-success.json`, `result-atl-empty.json`, `result-atl-error.json`, `result-atl-timeout.json`) carries `"disclaimer": "Synthetic local placeholder — not Atlas Sandbox evidence"` and `"sourceEnvironment": "sandbox-placeholder"`.

**Verdict**: Exact text is present on every alternatives-panel state and in every fixture.

---

### 4. Atlas production search label — PASS

**Required text**: `Atlas production search — reference prices only`

The UI does **not** display any Atlas production search result. All alternatives data rendered in the UI comes from local synthetic fixtures labelled `"Synthetic local placeholder — not Atlas Sandbox evidence"` with `sourceEnvironment: "sandbox-placeholder"`. The one live Atlas production search (documented in `stitchcheck-atlas-live-disclosure.md`) is reported only in documentation, not surfaced in the running application.

The label `Atlas production search — reference prices only` is therefore not required in the UI because the UI never presents production search output. No visitor to the application can mistake a synthetic placeholder for a live Atlas result.

**Verdict**: No misleading claim exists. The UI correctly shows only synthetic-placeholder data.

---

### 5. VCC/318 labelled offline-only — PASS

The VCC/318 duplicate-booking protection is not referenced anywhere in `app/src/`. No UI component mentions VCC, 318, or duplicate-booking protection. The offline-only nature of the guard is correctly documented in:

- `docs/stitchcheck-submission-evidence-index.md` — review checklist item: "Atlas 318 protection is described as offline-only."
- `docs/stitchcheck-atlas-live-disclosure.md` — §2.3: "Offline Duplicate-Booking Guard Is Not Live Atlas Evidence."
- `docs/stitchcheck-demo-readiness-report.md` — service evidence table.

**Verdict**: No misleading claim exists. The guard is correctly documented as offline-only.

---

### 6. Timeout and fallback states do not invent results — PASS

**RiskPanel timeout** (`workloadStatus === 'timeout'`):
- Displays a warning banner: "Timeout: The risk assessment did not complete in time."
- Shows the heuristic disclaimer and fallback explanation.
- Does **not** display a risk band, risk score, or any numeric result.
- Retry button is `disabled` with explanatory aria-label.

**RiskPanel unavailable** (`riskBand === 'unavailable'`):
- Displays: "No risk band could be produced for this itinerary. No score has been invented."
- Does **not** display a risk band or score.

**RiskPanel error** (`workloadStatus === 'error'`):
- Displays the error code and message from the fixture.
- Does **not** display a risk band or score.

**AlternativesPanel timeout/error/empty**:
- Each state shows an appropriate banner (error, warning, or status).
- No alternative cards are rendered.
- Retry button is `disabled` with explanatory aria-label.

**Verdict**: No timeout, error, or unavailable state invents a result that was not produced.

---

### 7. Keep/Switch remains UI-only — PASS

`DecisionPanel.tsx`:
- The `decision` state is typed as `'keep' | 'switch' | null` — a local React state only.
- The panel body states: "This is a **local demo decision only**. No booking, payment, reservation, ticket, order, verification, or any other external action will be created."
- The decision summary reiterates: "No booking, payment, reservation, ticket, order, verification, or any other external action has been created or will be created."
- `onDecision` updates only local React state. No handler calls any external service, creates any order, or triggers any write action.
- The confirmed state displays `externalCallsMade: false` and `noOrderCreated: true`.

**Verdict**: Keep/Switch is purely a UI-level demo control with no external effect.

---

### 8. Retry buttons are either functional or visibly disabled — PASS

All retry buttons in the application are `disabled` with explanatory `aria-label` attributes:

| Component | Button | Disabled | Aria-label | Demo note |
|---|---|---|---|---|
| `RiskPanel.tsx` (unavailable) | Re-run risk assessment | ✅ | "Re-run risk assessment — disabled in synthetic demo" | "Retry is unavailable in this synthetic demo. No live provider is connected." |
| `RiskPanel.tsx` (unavailable) | Proceed without risk guidance | ✅ | "Proceed without risk guidance — disabled in synthetic demo" | Same |
| `RiskPanel.tsx` (error) | Retry risk assessment | ✅ | "Retry risk assessment — disabled in synthetic demo" | Same |
| `RiskPanel.tsx` (timeout) | Retry risk assessment | ✅ | "Retry risk assessment — disabled in synthetic demo" | Same |
| `AlternativesPanel.tsx` (empty) | Retry alternative search | ✅ | "Retry alternative search — disabled in synthetic demo" | Same |
| `AlternativesPanel.tsx` (error) | Retry alternative search | ✅ | "Retry alternative search — disabled in synthetic demo" | Same |
| `AlternativesPanel.tsx` (timeout) | Retry alternative search | ✅ | "Retry alternative search — disabled in synthetic demo" | Same |

No retry button in the application is enabled. Every disabled button carries both a visible demo-note paragraph and an accessible aria-label explaining why it is unavailable.

`StatusBanner.tsx` accepts optional `onRetry` and `onRestart` callbacks, but no caller in the application passes these props. No retry button is therefore rendered via `StatusBanner`.

**Verdict**: All retry buttons are visibly disabled with clear explanations.

---

### 9. No order/payment/ticketing action is reachable — PASS

A comprehensive grep of `app/src/` for `book`, `pay`, `reserve`, `ticket`, `order`, `purchase`, and `verify` found:
- **Zero** handler, route, or button that creates a booking, payment, reservation, ticket, or order.
- All occurrences of these terms appear in **denial** context: "no booking, payment, reservation, or order will be created."

Additional safeguards:
- `FINAL_STATEMENT` in `labels.ts`: "No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only."
- `DecisionPanel.tsx` confirmed state renders `noOrderCreated: true` and `syntheticDemo: true`.
- `App.tsx` footer: "No booking, payment, or order created."
- `SafetyNotice.tsx`: "No booking, payment, reservation, or order will be created."
- Header badge: "Synthetic Demo — No Live Services."

**Verdict**: No write action of any kind is reachable from the UI.

---

### 10. `externalCallsMade` is not falsely set — PASS

`externalCallsMade` appears exactly once in `app/src/`:

- `DecisionPanel.tsx` line 28: `<dt>externalCallsMade:</dt><dd>false</dd>` — hardcoded `false` in the confirmed-state meta list.

Verification that this is truthful:
- `App.tsx` contains no `fetch`, `XMLHttpRequest`, `axios`, or `.env.local` reference in any handler.
- `fixtures.ts` contains one `fetch` call (`loadNosanaRiskResult`, line 67), which fetches the static local file `/nosana-risk-result.json` from `app/public/`. This is a local static-JSON read, not a provider call.
- `nosana-risk-result.json` carries `"provider": "local-fallback"` and `"evidenceSource": "local-fallback"`, correctly identifying itself as a local fallback.
- The `loadNosanaRiskResult` function does not set any `externalCallsMade` flag. The `false` value in `DecisionPanel` is hardcoded and accurate.

**Verdict**: `externalCallsMade: false` is truthful. No provider call is made.

---

## Network-Primitive Scan

A grep of `app/src/` for `fetch`, `XMLHttpRequest`, `axios`, and `.env` found exactly one match:

- `fixtures.ts` line 67: `fetch('/nosana-risk-result.json', { cache: 'no-store' })` — local static-JSON read from the application's own `public/` directory. Not a provider call.

No other network primitive exists in the application source.

---

## UI Corrections Made

**None.** All ten verification points pass. No misleading label was found. No unsafe control was found. The smallest safe UI correction is zero corrections.

---

## Changed Files

This audit created **only**:

```
docs/stitchcheck-ui-truthfulness-audit.md
```

No existing file was created, modified, or deleted. No provider was called. No secret was accessed. No confirmation gate was weakened.
