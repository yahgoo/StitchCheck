# Evidence Labels and Privacy Constraints

This document defines the exact evidence labels and privacy rules for the StitchCheck demo media pipeline.

## Required Evidence Labels

Three exact labels must appear at specified scenes. **Never abbreviate or paraphrase these labels.**

### 1. Gemini Extraction Label

```
OpenRouter temporary path — not direct Gemini validation
```

**When to show:** Scene 2 (editable field and correction)  
**Where visible:** Beside extracted itinerary fields on the review screen  
**Meaning:** Structured extraction used the OpenRouter temporary adapter, not direct Gemini. Direct Gemini remains unexecuted.

### 2. Nosana Risk Label

```
Synthetic local placeholder — not Nosana evidence
```

**When to show:** Scene 4 (sanitized provider status)  
**Where visible:** Risk panel header and disclaimer  
**Meaning:** Risk data is a local synthetic fixture, not a live Nosana workload result. Nosana smoke test was blocked before any network request.

### 3. Atlas Alternatives Label

```
Synthetic local placeholder — not Atlas Sandbox evidence
```

**When to show:** Scene 4 (sanitized provider status)  
**Where visible:** Alternatives panel header and each alternative card  
**Meaning:** Alternative options are local synthetic fixtures, not live Atlas search results. Atlas has not been authenticated or executed.

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

### No Live Provider Calls

- **No direct Gemini execution** — extraction uses local JSON fixtures from OpenRouter temporary path
- **No Nosana execution** — risk results are pre-built fixture shapes
- **No Atlas execution** — alternative results are pre-built fixture shapes
- **No network requests** — all data is local and synthetic

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

2. **Direct Gemini validation occurred** — do not claim that Google Gemini was directly called, validated, or produced results

3. **Nosana was deployed, authenticated, executed, or validated** — the Nosana smoke-test attempt was blocked before any network request

4. **Atlas Sandbox was authenticated, executed, or validated** — Atlas is represented by local synthetic fixtures only

5. **Any booking, payment, reservation, ticket, order, or verification occurred** — the demo is entirely read-only and UI-only

6. **Credentials, PII, raw provider output, or real booking/payment data are shown** — all data in the recording must be synthetic and fictional

## Safety Badge

The header badge `Synthetic Demo — No Live Services` must be visible throughout the recording. This badge serves as the primary boundary indicator.

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
