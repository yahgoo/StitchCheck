# StitchCheck Live-Demo Status Display Specification

## Purpose

Define the exact on-screen provider-status cards shown during the StitchCheck
two-minute demo. Each card communicates **what the audience is seeing** and
**what evidence backs it** without exposing raw provider payloads, credentials,
headers, account identifiers, or PII.

This specification is read-only. It creates one file and modifies none.

---

## Card Definitions

Four cards may appear in the status display area. Each card has a fixed label,
visual state, and evidence footnote. The labels below are **exact strings** —
do not paraphrase.

### Card 1 — Gemini Extraction

| Field | Value |
|---|---|
| **Badge** | `LOCAL FIXTURE` |
| **Title** | `Fictional itinerary — local demo fixture` |
| **Evidence label** | `Fictional itinerary — local demo fixture` |
| **Visual state** | Grey badge, dashed border. |
| **When shown** | Segment 2 (0:18–0:36) while GEM-01 extraction result is displayed. |
| **Footnote** | `Browser walkthrough uses fictional local fixture. Direct Gemini 3.7 live extraction was verified separately.` |

### Card 2 — LIVE SEARCH: Atlas Production Data

| Field | Value |
|---|---|
| **Badge** | `LIVE SEARCH` |
| **Title** | `Atlas production data` |
| **Evidence label** | `Reference-price only — no booking, payment, ticket, or order created` |
| **Visual state** | Blue badge, dashed border (indicates read-only scope). |
| **When shown** | Segment 6 (1:22–1:40) **if** the presenter chooses to show the live Atlas search result summary. This card is optional. |
| **Footnote** | `Two read-only production searches returned real offers: five (PVG → NRT/HND) and eight (SIN → BKK, ATL-LIVE-01). All offers are reference prices. Ticketing activation pending. No write action performed.` |

**Display rules for Card 2:**

- Show only the offer count, route summary, and `price_status: reference` label.
- Do **not** show fare values, airline codes beyond IATA route identifiers, seat class, baggage allowance, or any field that could identify a specific booking or passenger.
- Do **not** show raw Atlas JSON, HTTP response bodies, authorization tokens, session cookies, workspace identifiers, or ATRIP account details.

### Card 3 — BLOCKED: Nosana

| Field | Value |
|---|---|
| **Badge** | `BLOCKED` |
| **Title** | `Nosana` |
| **Evidence label** | `Local fallback — not Nosana evidence` |
| **Visual state** | Red badge, muted/greyed-out card body. |
| **When shown** | Segment 5 (1:06–1:22) while the risk panel is visible. |
| **Footnote** | `Smoke-test attempt intentionally blocked before any network request. No workload deployed, no execution, no authentication. Blocked evidence record: smoke-tests/nosana/results/2026-08-20T15-53-43Z/.` |

### Card 4 — LOCAL PLACEHOLDER

| Field | Value |
|---|---|
| **Badge** | `LOCAL PLACEHOLDER` |
| **Title** | `Not provider evidence` |
| **Evidence label** | Varies by panel (see Exact Evidence Labels below). |
| **Visual state** | Amber/yellow badge, dotted border, lock icon overlay. |
| **When shown** | Any panel that displays fixture data rather than live provider output — specifically the alternatives panel (Segment 6) and any risk-panel state not covered by Card 3. |
| **Footnote** | `Pre-built synthetic fixture for UI demonstration only. No external service was called for this data.` |

---

## Exact Evidence Labels

These three exact labels **must** appear on screen at the indicated moments.
They are defined in `app/src/data/labels.ts` and verified by
`docs/react-ui-acceptance-checklist.md`.

| # | Exact label | Card | Segment | Panel |
|---|---|---|---|---|
| 1 | `OpenRouter temporary path — not direct Gemini validation` | Card 1 | 2 | Itinerary review |
| 2 | `Synthetic local placeholder — not Nosana evidence` | Card 3 | 5 | Risk panel |
| 3 | `Synthetic local placeholder — not Atlas Sandbox evidence` | Card 4 | 6 | Alternatives panel |

All three labels must be visible simultaneously or sequentially during the
two-minute walkthrough. Omitting any label invalidates the demo.

---

## Prohibited Content — Never Display

The following categories must **never** appear in any status card, panel,
tooltip, console overlay, or screen capture during the live demo.

| Category | Examples | Rationale |
|---|---|---|
| **Raw provider payloads** | Full JSON response bodies, HTTP response text, base64-encoded blobs. | May contain internal fields, tracing IDs, or unintended data. |
| **API keys and secrets** | `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `ATLAS_*` token values, any `Bearer` token. | Credential exposure. Values live in `.env.local` (gitignored) and must stay there. |
| **HTTP headers** | `Authorization`, `X-Api-Key`, `Cookie`, `Set-Cookie`, any request/response header dump. | Reveals authentication mechanism details and potential session data. |
| **Account identifiers** | ATRIP workspace IDs, Nosana wallet addresses, OpenRouter account IDs, email addresses, organisation names tied to accounts. | PII and account-level security boundary. |
| **PII** | Passenger names, passport numbers, phone numbers, personal email addresses, real booking references. | Synthetic demo policy — no real passenger data exists or is shown. |
| **Write-action confirmations** | Booking references, payment confirmations, ticket numbers, order IDs. | No write action has been performed; showing any would be a false claim. |

### Enforcement rule

> **Before any screen is shown to the audience, the presenter must verify that
> no raw provider payload, credential, header, account identifier, or PII is
> visible. If any such content appears — even partially — stop the demo,
> close the browser, and restart from the last clean state.**

---

## Layout and Timing

| Segment | Time | Cards visible |
|---|---|---|
| 1 — The Problem | 0:00–0:18 | None (safety notice and header badge only). |
| 2 — Extraction | 0:18–0:36 | Card 1 (`LOCAL FIXTURE — Fictional itinerary — local demo fixture`). |
| 3 — Human Correction | 0:36–0:52 | Card 1 (remains visible). |
| 4 — Check itinerary | 0:52–1:06 | Per-panel source tags; compact Live checks bar. |
| 5 — Risk / recovery detail | 1:06–1:22 | Card 3 (`BLOCKED — Nosana`) when shown in **How this works**; recovery animation under **See why this is risky**. |
| 6 — Alternatives | 1:22–1:40 | Recommended card + **See more verified options** (live) or local alternatives disclosure. |
| 7 — Close | 1:40–2:00 | All cards collapse into a single summary strip: `LOCAL FIXTURE: Gemini · LOCAL FALLBACK: Nosana · LOCAL FIXTURE: Atlas · Live providers verified separately` |

---

## Accessibility

- Each card uses `role="status"` and `aria-live="polite"`.
- Badge colour is never the sole differentiator — text label is always present.
- Cards are keyboard-focusable with visible `:focus-visible` outlines.
- Blocked and placeholder cards include an explanatory `aria-label` that
  matches the visible footnote text.

---

## Verification

After implementing or reviewing the status display, confirm:

- [ ] All four card definitions render with correct badge, title, and footnote.
- [ ] All three exact evidence labels appear at the correct segment.
- [ ] No raw payload, key, header, account identifier, or PII is visible in any card, panel, tooltip, or browser console overlay.
- [ ] Card 2 (Atlas live search) is optional and, when shown, displays only offer count, route summary, and `price_status: reference`.
- [ ] Card 3 (Nosana) remains in BLOCKED state throughout — no upgrade.
- [ ] The closing summary strip accurately reflects each card's final state.
- [ ] Accessibility attributes (`role`, `aria-live`, `aria-label`) are present and correct.

---

## Changed-Files Verification

This specification creates exactly one file:

```
docs/stitchcheck-live-demo-status-display.md
```

No existing file is modified, deleted, or renamed. No provider call is made.
No `.env.local` access occurs.
