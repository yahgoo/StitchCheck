# Evidence Labels and Privacy Constraints

This document defines the exact evidence labels and privacy rules for the StitchCheck demo media pipeline.

## Required Evidence Labels

Three exact labels must appear at specified scenes. **Never abbreviate or paraphrase these labels.**

### 1. Gemini Extraction Label

```
Fictional itinerary — local demo fixture
```

**When to show:** Scene 2 (editable field and correction)  
**Where visible:** Beside extracted itinerary fields on the review screen  
**Meaning:** The browser walkthrough uses a fictional local fixture. Direct Gemini 3.7 live extraction was verified separately via the Interactions API (evidence: `smoke-tests/gemini/results/results-gemini-3.7-flash-success.json`).

### 2. Nosana Risk Label

```
Local fallback — not Nosana evidence
```

**When to show:** Scene 4 (sanitized provider status)  
**Where visible:** Risk panel header and disclaimer  
**Meaning:** Risk data is a local synthetic fixture, not a live Nosana workload result. Nosana workload validated offline; live execution was not verified.

### 3. Atlas Alternatives Label

```
Fictional alternatives — local demo fixture
```

**When to show:** Scene 4 (sanitized provider status)  
**Where visible:** Alternatives panel header and each alternative card  
**Meaning:** Alternative options are local synthetic fixtures. Atlas Sandbox Search/Verify was verified separately read-only. No booking or payment was executed.

## Label Placement Rules

1. **Exact text only** — use the labels verbatim from `app/src/data/labels.ts`
2. **Visible at specified scenes** — do not move labels to different scenes
3. **Not abbreviated** — never shorten or paraphrase
4. **Not combined** — each label appears independently
5. **Context-appropriate** — labels appear where the corresponding UI element is visible

## Privacy Constraints

### No PII

- **All itinerary data is synthetic** — airport codes (AAA/BBB/CCC), flight numbers (SC-101/SC-202), dates, and prices are invented
- **No real passenger data** — no names, passport numbers, or personal identifiers
- **No real booking references** — no confirmation codes or ticket numbers
- **No real payment data** — no credit card numbers or billing information

### No Credentials

- **No `.env.local` access** — do not open or display environment files
- **No API keys visible** — do not show terminal windows with credential values
- **No secrets in screenshots** — hide or blur any credential-bearing UI elements
- **Blank variable names only** — `.env.example` shows variable names without values

### No Live Provider Calls (in the browser walkthrough)

- **Browser walkthrough makes no provider calls** — extraction uses local JSON fixtures
- **Direct Gemini 3.7 live extraction was verified separately** via `ai.interactions.create` (evidence: `smoke-tests/gemini/results/results-gemini-3.7-flash-success.json`)
- **Nosana workload validated offline** — live execution was not verified; risk results are pre-built fixture shapes
- **Atlas Sandbox Search/Verify was verified separately** — read-only; no booking or payment occurred
- **No network requests from the browser** — all data in the demo is local and synthetic

### No Write Actions

- **No booking creation** — no UI handler creates a booking
- **No payment processing** — no payment flow exists
- **No reservation creation** — no reservation system is connected
- **No ticket issuance** — no ticketing functionality exists
- **No order creation** — no order system is present
- **No verification calls** — no external verification occurs

## Prohibited Claims

The following claims are **prohibited** in narration, captions, and any derived artifact:

1. **Local fixtures are live provider outputs** — do not state or imply that any risk estimate, alternative option, or extraction result is a live Gemini, Nosana, or Atlas response

2. **Local fixtures are live Gemini evidence** — the browser walkthrough uses fictional local fixtures; Direct Gemini 3.7 was verified separately

3. **Nosana was deployed, authenticated, or executed live** — Nosana workload validated offline; live execution was not verified; the demo uses local fallback

4. **Atlas Sandbox was not authenticated or verified** — Atlas Sandbox Search/Verify was verified separately read-only; the browser demo uses local fixtures for the alternatives panel

5. **Any booking, payment, reservation, ticket, order, or verification occurred** — the demo is entirely read-only and UI-only

6. **Credentials, PII, raw provider output, or real booking/payment data are shown** — all data in the recording must be synthetic and fictional

## Safety Badge

The header badge `Fictional Demo — Live Providers Where Labelled` must be visible throughout the recording. This badge serves as the primary boundary indicator.

## Final Statement

The final screen must display:

```
No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only.
```

This statement appears in Scene 6 (local Keep/Switch ending).

## Metadata

The final screen must show:
- `noOrderCreated: true`
- `syntheticDemo: true`
- `externalCallsMade: false`

## Verification

Before finalizing the recording:
- [ ] All three exact evidence labels appear at the correct scenes
- [ ] No prohibited claims appear in narration or captions
- [ ] No PII, credentials, or real data is visible
- [ ] Safety badge is visible throughout
- [ ] Final statement is clearly visible
- [ ] Metadata shows no external actions
