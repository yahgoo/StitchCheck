# StitchCheck — Pitch-Claim Corrections Applied

> **Date:** 2026-08-21
> **Scope:** Apply verified pitch-claim corrections to three documentation files.
> **Source of truth:** `docs/stitchcheck-pitch-claim-audit.md`, `docs/stitchcheck-submission-evidence-index.md`.
> **Constraint:** No source code, app/src, provider integrations, `.env.local`, or final media assets modified.

---

## Files Changed

| # | File | Corrections Applied |
|---|------|---------------------|
| 1 | `docs/stitchcheck-slide-deck-outline.md` | 9 |
| 2 | `docs/stitchcheck-deck-final-copy.md` | 8 |
| 3 | `docs/stitchcheck-demo-narrative-video-plan.md` | 6 |
| | **Total** | **23** |

---

## Correction Detail

### File 1: `docs/stitchcheck-slide-deck-outline.md`

| # | Issue | Location | Old Claim Summary | New Claim Summary | Evidence Source |
|---|-------|----------|-------------------|-------------------|-----------------|
| 1 | Issue 1 | Line 16 (Slide 1 speaker note) | "The entire flow runs locally with synthetic data — no live service is called at any point." | "The local demo walkthrough runs with synthetic fixture data — the demo UI itself makes no live service calls. Separately, OpenRouter and Atlas production have been called outside the demo UI." | Evidence Index Provider Status |
| 2 | Issue 1 | Line 76 (Slide 5 Nosana status) | "smoke test was blocked before any network request due to missing infrastructure" | "smoke test was blocked before any network request due to missing SDK, credit account, and reviewed workload definition" | Evidence Index, pre-hackathon report |
| 3 | Issue 1+2 | Line 77 (Slide 5 Atlas status) | "Atlas Sandbox: planned read-only alternative search for safer flight options." | Added: "Atlas production authentication succeeded; two live read-only production searches returned reference-price offers. Sandbox Search + Verify (ATL-SBX-SV-01) partially succeeded." | Evidence Index Provider Status |
| 4 | Issue 2 | Line 79 (Slide 5 awaiting) | "Awaiting live execution: direct Gemini, Nosana workload deployment and submission, Atlas Sandbox authentication." | Removed Atlas Sandbox authentication from awaiting list; added: "Atlas production authentication and two live searches have succeeded; the demo panel remains a local placeholder labelled accordingly." | Evidence Index Provider Status |
| 5 | Issue 2 | Line 81 (Slide 5 visual) | Badge description for Atlas without qualification | Added clarification: demo panel IS a local placeholder, but Atlas production authentication and two live searches have succeeded | Evidence Index Provider Status |
| 6 | Issue 2 | Line 83 (Slide 5 speaker note) | "live execution of each service is separately gated and has not yet occurred" | "Atlas production authentication succeeded and two live read-only searches returned reference-price offers; however, the demo panels remain local placeholders. Nosana live execution has not occurred." | Evidence Index Provider Status |
| 7 | Issue 7 | Line 100 (Slide 6 speaker note) | "No real personal data enters the system." | "No personal data enters the demo system. Live Atlas production searches returned flight offer data (routes, prices, schedules) — not passenger or personal data." | Evidence Index, live-demo results |
| 8 | Issue 2 | Line 133 (Slide 8 Atlas status) | "Atlas Sandbox: local fixtures only — not authenticated, not executed." | "Atlas Sandbox: local fixtures only for demo panels. Atlas production: authentication succeeded; two live read-only searches succeeded (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers). Sandbox Search + Verify (ATL-SBX-SV-01) partially succeeded. Ticketing activation pending." | Evidence Index Provider Status |
| 9 | Issue 1 | Line 139 (Slide 8 speaker note) | "all with synthetic data and zero external calls" | "the demo UI itself uses synthetic data and makes no live service calls. Separately, OpenRouter and Atlas production have been called outside the demo UI." | Evidence Index Provider Status |

### File 2: `docs/stitchcheck-deck-final-copy.md`

| # | Issue | Location | Old Claim Summary | New Claim Summary | Evidence Source |
|---|-------|----------|-------------------|-------------------|-----------------|
| 10 | Issue 1 | Line 25 (Slide 1 speaker note) | "The entire flow runs locally with synthetic data — no live service is called at any point." | "The local demo walkthrough runs with synthetic fixture data — the demo UI itself makes no live service calls. Separately, OpenRouter and Atlas production have been called outside the demo UI; their status is reported in Slide 8." | Evidence Index Provider Status |
| 11 | Issue 1 | Line 98 (Slide 5 Atlas table cell) | "Authentication and one production search succeeded (5 reference-price offers)." | "Authentication succeeded. Two production searches succeeded (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers via ATL-LIVE-01). All reference-price only." | Evidence Index, ATL-LIVE-01 |
| 12 | Issue 1 | Line 107 (Slide 5 speaker note) | "Atlas authentication and one production search succeeded, returning five reference-price offers" | "Atlas authentication succeeded. Two production searches returned reference-price offers (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers via ATL-LIVE-01)" | Evidence Index, ATL-LIVE-01 |
| 13 | Issue 7 | Line 127 (Slide 6 speaker note) | "No real personal data enters the system." | "No personal data enters the demo system. Live Atlas production searches returned flight offer data (routes, prices, schedules) — not passenger or personal data." | Evidence Index, live-demo results |
| 14 | Issue 1 | Line 133 (Slide 7 headline) | "Six steps, zero external calls" | "Six steps — the demo UI makes no external calls" | Evidence Index Provider Status |
| 15 | Issue 1 | Line 170 (Slide 8 Atlas row) | "Authentication and production search succeeded." | "Authentication succeeded. Two production searches succeeded (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers). All reference-price only." | Evidence Index, ATL-LIVE-01 |
| 16 | Issue 3 | Line 177 (Slide 8 next goals) | "Activate Atlas ticketing and attempt sandbox booking rehearsal." | "Activate Atlas ticketing at ATRIP workspace (requires human admin action) and attempt sandbox booking rehearsal." | Evidence Index Provider Status |
| 17 | Issue 1 | Line 182 (Slide 8 speaker note) | "all with synthetic data and zero external calls. Atlas authentication and one production search succeeded, returning five reference-price offers" | "the demo UI itself uses synthetic data and makes no live service calls. Atlas authentication succeeded; two production searches returned reference-price offers (PVG→NRT/HND: 5; SIN→BKK: 8)" | Evidence Index, ATL-LIVE-01 |

### File 3: `docs/stitchcheck-demo-narrative-video-plan.md`

| # | Issue | Location | Old Claim Summary | New Claim Summary | Evidence Source |
|---|-------|----------|-------------------|-------------------|-----------------|
| 18 | Issue 1+2 | Line 5 (Recording Goal) | "No provider has been executed, authenticated, or deployed for this recording." | "Direct Gemini and Nosana live execution remain unexecuted. Atlas production authentication succeeded; two live read-only production searches returned reference-price offers; the demo panels remain local placeholders." | Evidence Index Provider Status |
| 19 | Issue 2 | Line 35 (1:00–1:20 spoken narrative) | "Atlas is a planned, read-only role represented by local fixtures only and has not been authenticated or executed." | "Atlas production authentication succeeded; two live read-only production searches returned reference-price offers (PVG→NRT/HND: 5; SIN→BKK: 8), all reference-price only with ticketing activation pending. The demo panels you see remain local placeholders." | Evidence Index, ATL-LIVE-01 |
| 20 | Issue 1+2 | Line 36 (1:20–1:40 spoken narrative) | "Atlas remains unexecuted and not authenticated. This local demo ends here, having demonstrated the review-first flow with synthetic data and zero external calls." | "Atlas production authentication succeeded; two live read-only searches returned reference-price offers; ticketing activation is pending; no booking was created. This local demo ends here, having demonstrated the review-first flow with synthetic data — the demo UI itself makes no live service calls. Separately, OpenRouter and Atlas production have been called outside the demo UI." | Evidence Index Provider Status |
| 21 | Issue 2 | Line 75 (Accuracy Guardrails) | "Atlas Sandbox was authenticated, executed, or validated. Atlas is represented by local synthetic fixtures only." | "Atlas production searches returned reference-price offers only. Atlas production authentication succeeded and two live read-only production searches returned real offers. All offers are reference-price only with ticketing activation pending. The demo UI panels remain local synthetic placeholders." | Evidence Index Provider Status |
| 22 | Issue 1 | Line 101 (Closing Line) | "an honest local demo with synthetic data and zero external calls" | "an honest local demo with synthetic data — the demo UI itself makes no live service calls; separately, OpenRouter and Atlas production have been called outside the demo UI." | Evidence Index Provider Status |
| 23 | Issue 2 | Line 116 (Verification checklist) | "Atlas unexecuted and not authenticated" | "Atlas production authentication succeeded with two live read-only searches (reference-price only); demo panels remain local placeholders" | Evidence Index Provider Status |

---

## Unresolved Claims

**None.** All 23 corrections have been applied. All stale occurrences of prohibited phrases have been removed or replaced.

---

## Validation Results

### Stale-Claim Search (Post-Edit)

| Prohibited Phrase | Occurrences Remaining | Status |
|---|---:|---|
| "zero external calls" | 0 | ✅ Removed |
| "no live service" (unscoped) | 0 | ✅ Removed (only correctly scoped "demo UI makes no live service calls" and badge name remain) |
| "not authenticated" (re: Atlas) | 0 | ✅ Removed |
| "no provider executed" (unqualified) | 0 | ✅ Removed |
| "fully privacy-preserving" | 0 | ✅ Never present |
| "purchased tickets" (pre-purchase context violation) | 0 | ✅ N/A — all "purchased flight" references describe the general problem, not the demo traveler's state |

### Evidence Cross-Check

All named provider claims compared against `docs/stitchcheck-submission-evidence-index.md`:

| Provider | Claim in Edited Files | Matches Evidence Index? |
|---|---|---|
| Gemini (direct) | Not executed. Pass/fail intentionally blank. | ✅ Yes |
| Gemini (OpenRouter) | GEM-01 succeeded via OpenRouter temporary path. Labelled accordingly. | ✅ Yes |
| Atlas (production) | Authentication succeeded. Two production searches (PVG→NRT/HND: 5; SIN→BKK: 8). Reference-price only. Ticketing activation pending. | ✅ Yes |
| Atlas (Sandbox) | ATL-SBX-SV-01 partially succeeded. Search + Verify completed. Hard stop after Verify. No write call. Environment restored. | ✅ Yes |
| Nosana | Offline boundary only. Not executed, not deployed. Blocked before any network request. | ✅ Yes |
| No write action | No booking, payment, ticket, order, or verification created. | ✅ Yes |

### Test / Build / Capture Results

| Check | Result | Details |
|---|---|---|
| TypeScript typecheck | **PASS** | 0 errors (`tsc --noEmit -p tsconfig.app.json`) |
| Production build | **PASS** | 39 modules transformed, 68 ms |
| Cross-provider invariant tests | **PASS** | 40 passed, 0 failed |
| Gemini adapter offline tests | **PASS** | 92 passed, 0 failed |
| Atlas adapter offline tests | **PASS** | 89 passed, 0 failed |
| Atlas duplicate-booking guard | **PASS** | 48 passed, 0 failed |
| Nosana client offline tests | **PASS** | 75 passed, 0 failed |
| **Total offline tests** | **PASS** | **344 passed, 0 failed** |
| Deterministic six-scene capture | **PASS** | 6/6 scenes, 6.4 s, output at `output/captures/capture-2026-08-21T15-24-51/` |

### Provider / External-Write Confirmation

- **No provider was called during this task.** ✅
- **No external write was performed.** ✅
- **No packages were installed.** ✅
- **No source code (app/src) was modified.** ✅
- **No `.env.local` was modified.** ✅
- **No final media assets were altered.** ✅
- **No Atlas order, payment, ticketing, cancellation, or refund was performed.** ✅
- **No Nosana workload was submitted.** ✅
- **No direct Gemini call was made.** ✅

---

## Central Pitch Preserved

> "StitchCheck helps travelers test a cheap self-transfer before buying two independent flights."

All safety language and human confirmation requirements preserved throughout.

---

- **Created:** 2026-08-21
- **Corrections applied:** 23
- **Remaining stale claims:** 0
- **Files modified:** 3 (documentation only)
- **Test/build/capture:** All pass
