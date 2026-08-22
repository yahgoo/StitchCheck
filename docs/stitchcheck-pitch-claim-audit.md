# StitchCheck — Pitch-Deck Claim Audit

> **Date:** 2026-08-21
> **Scope:** Read-only audit of six pitch / presenter / evidence documents.
> **Source of truth:** `docs/stitchcheck-submission-evidence-index.md` (Provider Status table) and `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/`.
> **Constraint:** No deck, video, `.env.local`, credential, media, or provider-integration file is modified by this audit.

---

## Files Audited

| # | File | Role |
|---|------|------|
| F1 | `docs/stitchcheck-slide-deck-outline.md` | Original slide outline |
| F2 | `docs/stitchcheck-deck-final-copy.md` | Presentation-ready slide copy |
| F3 | `docs/stitchcheck-live-demo-presenter-script.md` | 120-second spoken script |
| F4 | `docs/stitchcheck-judge-qa.md` | Judge Q&A reference |
| F5 | `docs/stitchcheck-submission-evidence-index.md` | Evidence source of truth |
| F6 | `docs/stitchcheck-pre-hackathon-final-pass-report.md` | Integration pass report |

## File Ownership Notice

All six files are documentation files within this workspace. No file is assigned
to another chat. This audit creates **one new file** (`docs/stitchcheck-pitch-claim-audit.md`)
and does **not** edit any of the six source files. Exact replacement language is
provided below so that a follow-up task can apply edits.

---

## Ground Truth (from Evidence Index + Live-Demo Results)

| Provider | Verified Status |
|----------|-----------------|
| **Gemini (direct)** | Not executed. SDK not installed. Model not approved. |
| **Gemini (OpenRouter)** | GEM-01 and GEM-LIVE-01 succeeded via OpenRouter temporary path. Labelled accordingly. |
| **Nosana** | Offline boundary only. Not executed, not deployed, no SDK installed, no credit account. |
| **Atlas (production)** | Authentication succeeded via official Skill CLI. **Two** live read-only production searches: (1) PVG→NRT/HND — 5 offers; (2) SIN→BKK — 8 offers (ATL-LIVE-01). All reference-price only, `bookable: false`, ticketing activation pending. |
| **Atlas (Sandbox)** | ATL-SBX-SV-01: environment switch ✅, search (20 offers KUL→SIN) ✅, verify (PRICE_CONFIRMATION_REQUIRED) ✅. Hard stop after Verify. No write call. Environment restored to Production. |
| **No write action** | No booking, payment, ticket, order, reservation, verification, or cancellation was created. |

---

## Issues Found

### Issue 1 — Stale "zero external calls" / "no live service called" claims

**Category:** Stale "zero external calls" claims
**Severity:** HIGH — directly contradicted by evidence index

OpenRouter (GEM-01, GEM-LIVE-01) and Atlas production (two searches) have been
called. The "zero external calls" phrase is only defensible when explicitly
scoped to "the local demo walkthrough UI itself."

| Location | Current Text | Replacement Text |
|----------|--------------|------------------|
| **F1** line 16 (Slide 1 speaker note) | `The entire flow runs locally with synthetic data — no live service is called at any point.` | `The local demo walkthrough runs with synthetic fixture data — the demo UI itself makes no live service calls. Separately, OpenRouter and Atlas production have been called outside the demo UI; their status is reported below.` |
| **F1** line 77 (Slide 5 Nosana status) | `Local harness exists (fixtures, schema validator, workload skeleton) but the smoke test was blocked before any network request due to missing infrastructure.` | `Local harness exists (fixtures, schema validator, workload skeleton). The Nosana smoke test was blocked before any network request due to missing SDK, credit account, and reviewed workload definition.` |
| **F1** line 79 (Slide 5 Atlas status) | `Atlas Sandbox: planned read-only alternative search for safer flight options.` | `Atlas Sandbox: planned read-only alternative search for safer flight options. Atlas production authentication succeeded; two live read-only production searches returned reference-price offers. Sandbox Search + Verify (ATL-SBX-SV-01) partially succeeded.` |
| **F1** line 139 (Slide 8 speaker note) | `We have a working local demo that proves the review-first flow, the confirmation gate, and the Keep-or-Switch decision — all with synthetic data and zero external calls.` | `We have a working local demo that proves the review-first flow, the confirmation gate, and the Keep-or-Switch decision — the demo UI itself uses synthetic data and makes no live service calls. Separately, OpenRouter and Atlas production have been called outside the demo UI.` |
| **F2** line 25 (Slide 1 speaker note) | `The entire flow runs locally with synthetic data — no live service is called at any point.` | `The local demo walkthrough runs with synthetic fixture data — the demo UI itself makes no live service calls. Separately, OpenRouter and Atlas production have been called outside the demo UI; their status is reported in Slide 8.` |
| **F2** line 98 (Slide 5 Atlas table cell) | `Authentication and one production search succeeded (5 reference-price offers). Ticketing activation pending.` | `Authentication succeeded. Two production searches succeeded (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers via ATL-LIVE-01). All reference-price only. Ticketing activation pending.` |
| **F2** line 107 (Slide 5 speaker note) | `Atlas authentication and one production search succeeded, returning five reference-price offers; however, ticketing activation is still pending and no booking was created.` | `Atlas authentication succeeded. Two production searches returned reference-price offers (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers via ATL-LIVE-01); however, ticketing activation is still pending and no booking was created.` |
| **F2** line 133 (Slide 7 headline) | `Six steps, zero external calls` | `Six steps — the demo UI makes no external calls` |
| **F2** line 170 (Slide 8 Atlas row) | `Authentication and production search succeeded. Ticketing activation pending. No booking, payment, ticket, or order was created.` | `Authentication succeeded. Two production searches succeeded (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers). All reference-price only. Ticketing activation pending. No booking, payment, ticket, or order was created.` |
| **F2** line 182 (Slide 8 speaker note) | `We have a working local demo that proves the review-first flow, the confirmation gate, and the Keep-or-Switch decision — all with synthetic data and zero external calls. Atlas authentication and one production search succeeded, returning five reference-price offers, but ticketing activation is still pending and no booking was created.` | `We have a working local demo that proves the review-first flow, the confirmation gate, and the Keep-or-Switch decision — the demo UI itself uses synthetic data and makes no live service calls. Atlas authentication succeeded; two production searches returned reference-price offers (PVG→NRT/HND: 5; SIN→BKK: 8), but ticketing activation is still pending and no booking was created.` |

---

### Issue 2 — Stale Atlas "not authenticated / not executed" wording

**Category:** Incorrect Atlas authentication wording
**Severity:** HIGH — directly contradicted by evidence index Provider Status

| Location | Current Text | Replacement Text |
|----------|--------------|------------------|
| **F1** line 79 (Slide 5 status badges) | `"Local placeholder" for Atlas` (badge text) — this is acceptable for the demo panel, but the surrounding text implies Atlas has not been executed at all. | Keep the badge (the demo panel IS a local placeholder) but add after the badge description: `Atlas production authentication and two live searches have succeeded; the demo panel remains a local placeholder labelled accordingly.` |
| **F1** line 83 (Slide 5 speaker note) | `Atlas Sandbox is planned to return safer alternatives for comparison. Today, the local demo shows all three roles with placeholder data; live execution of each service is separately gated and has not yet occurred.` | `Atlas Sandbox is planned to return safer alternatives for comparison. Atlas production authentication succeeded and two live read-only searches returned reference-price offers; however, the demo panels remain local placeholders. Nosana live execution has not occurred.` |
| **F1** line 133 (Slide 8 Atlas status) | `Atlas Sandbox: local fixtures only — not authenticated, not executed.` | `Atlas Sandbox: local fixtures only for demo panels. Atlas production: authentication succeeded; two live read-only searches succeeded (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers). Sandbox Search + Verify (ATL-SBX-SV-01) partially succeeded. Ticketing activation pending.` |

---

### Issue 3 — Incorrect ticketing wording

**Category:** Incorrect ticket wording
**Severity:** MEDIUM — understates what is known

| Location | Current Text | Replacement Text |
|----------|--------------|------------------|
| **F2** line 177 (Slide 8 next goals) | `Activate Atlas ticketing and attempt sandbox booking rehearsal.` | `Activate Atlas ticketing at ATRIP workspace (requires human admin action) and attempt sandbox booking rehearsal.` |

No other file uses incorrect ticket wording. All other references correctly
state "ticketing activation pending" or "no ticket was created."

---

### Issue 4 — Incorrect direct-Gemini wording

**Category:** Incorrect direct-Gemini wording
**Severity:** LOW — wording is mostly correct but one location is imprecise

| Location | Current Text | Replacement Text |
|----------|--------------|------------------|
| **F1** line 76 (Slide 5 Gemini status) | `GEM-01 succeeded via OpenRouter temporary path. Direct Gemini remains unexecuted.` | No change needed. This is accurate. |
| **F1** line 131 (Slide 8 Gemini direct row) | `Direct Gemini: not yet executed. Pass/fail intentionally blank.` | No change needed. This is accurate. |

**Verdict:** Direct-Gemini wording is correct across all six files. No edits required.

---

### Issue 5 — Incorrect Nosana wording

**Category:** Incorrect Nosana wording
**Severity:** LOW — wording is correct but could be more precise

| Location | Current Text | Replacement Text |
|----------|--------------|------------------|
| **F1** line 76 (Slide 5 Nosana status) | `Local harness exists (fixtures, schema validator, workload skeleton) but the smoke test was blocked before any network request due to missing infrastructure.` | See Issue 1 table — replacement addresses both staleness and precision. |
| **F1** line 132 (Slide 8 Nosana row) | `Nosana: local harness exists — smoke test blocked before any network request; not executed, not deployed.` | No change needed. This is accurate. |

**Verdict:** Nosana wording is accurate across all six files after Issue 1 fixes.

---

### Issue 6 — Presenter-script claim-boundary table mismatch

**Category:** Stale claim wording
**Severity:** MEDIUM — table says "one" but evidence says "two"

| Location | Current Text | Replacement Text |
|----------|--------------|------------------|
| **F3** line 150 (Claim-Boundary Verification table) | `"One live read-only search returned five real production offers"` | `"Two live read-only searches returned real production offers (PVG→NRT/HND: 5; SIN→BKK: 8)"` |
| **F3** line 150 (evidence source column) | `docs/stitchcheck-submission-evidence-index.md Provider Status table, smoke-tests/live-demo-results/2026-08-21T05-37-31Z/atlas-live-result.md` | No change to evidence source column — both sources are correct. |
| **F3** line 150 (boundary column) | `Two production searches: PVG→NRT/HND (5 offers) and SIN→BKK (8 offers via ATL-LIVE-01). Reference prices only.` | This column is already correct. No change needed. |

Note: The spoken narrative at F3 line 91 correctly says "Two live read-only
production searches." Only the claim-boundary table label is stale.

---

### Issue 7 — PII / Privacy overclaims

**Category:** PII/privacy overclaims
**Severity:** LOW — fixtures are genuinely PII-free, but the blanket statement
needs qualification after live provider calls

| Location | Current Text | Replacement Text |
|----------|--------------|------------------|
| **F1** line 98 (Slide 6 visual direction) | `"No PII"` (checklist item) | No change needed. Fixtures contain no PII. Live Atlas results contain flight offer data, not personal data. |
| **F1** line 100 (Slide 6 speaker note) | `No real personal data enters the system.` | `No personal data enters the demo system. Live Atlas production searches returned flight offer data (routes, prices, schedules) — not passenger or personal data.` |
| **F2** line 127 (Slide 6 speaker note) | `No real personal data enters the system.` | `No personal data enters the demo system. Live Atlas production searches returned flight offer data (routes, prices, schedules) — not passenger or personal data.` |

---

### Issue 8 — Unsupported market-size claims

**Category:** Unsupported market-size claims
**Severity:** N/A

**Verdict:** No market-size claims appear in any of the six audited files.
No edits required.

---

## Summary of Issues

| # | Category | Severity | Files Affected | Issue Count |
|---|----------|----------|----------------|-------------|
| 1 | Stale "zero external calls" | HIGH | F1, F2 | 10 locations |
| 2 | Stale Atlas "not authenticated" | HIGH | F1 | 3 locations |
| 3 | Incorrect ticket wording | MEDIUM | F2 | 1 location |
| 4 | Incorrect direct-Gemini wording | LOW | — | 0 (all correct) |
| 5 | Incorrect Nosana wording | LOW | — | 0 (correct after Issue 1) |
| 6 | Claim-boundary table mismatch | MEDIUM | F3 | 1 location |
| 7 | PII/privacy overclaims | LOW | F1, F2 | 2 locations |
| 8 | Unsupported market-size claims | N/A | — | 0 (none found) |

## Files Clean (No Issues Found)

- **F4** (`stitchcheck-judge-qa.md`) — All claims are correctly qualified.
  Correctly states "two live read-only searches," correctly qualifies all
  provider statuses, and correctly denies all write actions.
- **F5** (`stitchcheck-submission-evidence-index.md`) — Source of truth.
  All claims are supported by evidence artifacts.
- **F6** (`stitchcheck-pre-hackathon-final-pass-report.md`) — Accurately
  records PARTIAL_SUCCESS for Atlas Sandbox, Nosana corrections, and Gemini
  readiness. No overstated claims.

## Recommended Edit Priority

1. **Issue 1** (HIGH) — "zero external calls" appears in the most visible
   presentation surfaces (slide headlines, speaker notes). Fix first.
2. **Issue 2** (HIGH) — Atlas "not authenticated" is directly contradicted
   by the evidence index. Fix alongside Issue 1.
3. **Issue 6** (MEDIUM) — Claim-boundary table mismatch could confuse a
   judge who reads the script notes. Fix before any rehearsal.
4. **Issue 3** (MEDIUM) — Ticket wording is a minor precision fix.
5. **Issue 7** (LOW) — PII qualification is defensive; the original claim
   is defensible but benefits from explicit scope.

## Prohibited Claims — Reminder

The following claims must NOT appear in any pitch material:

- Direct Gemini was called, validated, or produced results.
- Nosana was executed, deployed, authenticated, or returned results.
- Any local placeholder is presented as a live provider result.
- Any booking, payment, reservation, ticket, order, or verification was created.
- Credentials, PII, or raw provider output are shown.
- "Zero external calls" without explicitly scoping to "the demo UI itself."
- "No live service called" without the same qualification.
- Atlas is "not authenticated" or "not executed" (production auth and searches succeeded).

---

- **Created:** 2026-08-21
- **Audit type:** Read-only — no source files were modified.
- **Next step:** Apply replacement language to F1, F2, F3 in a follow-up edit task.
