# StitchCheck Evidence Reconciliation Report

**Generated:** 2026-08-21
**Purpose:** Audit the evidence index and related documents for factual inconsistencies against live-demo results at `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/`.
**Scope:** Documentation only. No application code, video/deck assets, or secrets were modified.

---

## 1. Ground-Truth Evidence

The following live-demo results are the ground truth for this audit:

| Test ID | Provider | Status | Evidence |
|---------|----------|--------|----------|
| GEM-LIVE-01 | Gemini via OpenRouter | **LIVE** — extraction success | `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/gemini-live-result.md` |
| ATL-LIVE-01 | Atlas production | **LIVE SEARCH** — 8 offers (SIN→BKK) | `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/atlas-live-result.md` |
| NOS-LIVE-01 | Nosana | **BLOCKED** — no live transport | `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/nosana-live-result.md` |

Additionally, a prior Atlas production search (PVG→NRT/HND) returned 5 offers, as recorded in the evidence index Provider Status table before this audit.

---

## 2. Corrections Made

### 2.1 `docs/stitchcheck-submission-evidence-index.md`

| # | Issue | Correction |
|---|-------|------------|
| 1 | Intro said "These tests make zero network requests and invoke no provider" for all evidence categories, implying no external calls exist anywhere. | Clarified that offline tests make zero network requests; added explicit note that offline tests are distinct from live-demo results. |
| 2 | Intro said "no provider execution claim is supportable for direct Gemini, Nosana, or Atlas." | Updated to reference live-demo results (GEM-LIVE-01, ATL-LIVE-01, NOS-LIVE-01). Direct Gemini, Nosana, and Atlas Sandbox remain unexecuted. |
| 3 | Claim matrix row: "Atlas was not authenticated or executed." | Replaced with: "Atlas was authenticated via the official Skill and executed two live production searches." Added evidence paths and boundary notes. |
| 4 | Claim matrix: Atlas offline row said "Atlas not authenticated or executed" in boundary column. | Changed to "distinct from live Atlas production search (ATL-LIVE-01)." |
| 5 | Provider Status table: Atlas mentioned only one search (5 offers, PVG→NRT). | Updated to include both searches (5 + 8 offers). Clarified Sandbox was not used. |
| 6 | Provider Status table: Gemini did not mention GEM-LIVE-01. | Added GEM-LIVE-01 to Gemini status. |
| 7 | Footer said "No provider status is upgraded by this document." | Changed to acknowledge live-demo results update provider status; offline test results are not upgraded. |

### 2.2 `docs/stitchcheck-demo-readiness-report.md`

| # | Issue | Correction |
|---|-------|------------|
| 8 | Atlas row said "has not been authenticated, configured, called, or proven to work" and "Can It Be Described as Live? = No." | Updated to reflect authentication succeeded, two live production searches returned real offers. Changed to "Partial." for live description. |
| 9 | "Claims Not Allowed" said "Atlas Sandbox search has been executed. (No Atlas credential, SDK, or request exists.)" | Changed to: "Atlas production search has been executed via the official Skill CLI." Added accurate description of evidence. |

### 2.3 `README.md`

| # | Issue | Correction |
|---|-------|------------|
| 10 | Service Roles table: Atlas Sandbox said "Not authenticated, not executed." | Updated Atlas row to reflect authentication and two live production searches. |
| 11 | Evidence Status said "Nosana and Atlas are represented only by local synthetic placeholders and have not been executed against any live service." | Split: added Atlas production authentication bullet; clarified that Nosana and Atlas local app data remain synthetic placeholders. |
| 12 | Current Limitations said "Atlas Sandbox is not yet authenticated or executed. No Atlas credential or SDK call exists." | Updated to note production Atlas authentication succeeded; Sandbox was not used (no switch command in CLI). |

### 2.4 `docs/stitchcheck-live-demo-presenter-script.md`

| # | Issue | Correction |
|---|-------|------------|
| 13 | Segment 1 spoken: "zero external calls." | Changed to "the demo walkthrough itself makes no external service calls." |
| 14 | Segment 6 spoken: "One live read-only search returned five real production offers." | Updated to two searches (5 + 8 offers via ATL-LIVE-01). |
| 15 | Segment 7 spoken: "zero external calls." | Removed "zero external calls" from closing narrative. |
| 16 | Claim-boundary table: evidence source for Atlas search claim referenced only evidence index. | Added live-demo result path (ATL-LIVE-01). |

### 2.5 `docs/stitchcheck-final-submission-readiness-checklist.md`

| # | Issue | Correction |
|---|-------|------------|
| 17 | Provider-Evidence Boundaries: Atlas said "remains unauthenticated and unexecuted. No Atlas credential, SDK, or search request exists." | Updated to reflect authentication and two live searches. |
| 18 | Go criteria said "Atlas is unauthenticated." | Updated to "Atlas production authentication succeeded with two live read-only searches." |
| 19 | Current Status said "live Atlas validation remains unauthenticated and unexecuted." | Updated to reflect production authentication and search results. |

### 2.6 `docs/stitchcheck-judge-qa.md`

| # | Issue | Correction |
|---|-------|------------|
| 20 | 30-Second Answer said "zero external service calls. No provider has been executed, deployed, or authenticated." | Updated to reflect OpenRouter live executions and Atlas production authentication. |
| 21 | Q5 said "neither has been executed or authenticated" (re: Nosana and Atlas). | Split: Nosana unchanged; Atlas updated to reflect production authentication. |
| 22 | Q6 said "Atlas remains unauthenticated and unexecuted." | Updated to reflect production authentication and two live searches. |
| 23 | Difficult Q2 said "Direct Gemini and Atlas Sandbox each require their own credential and authorization gate." | Updated to note Atlas Sandbox was not used; production Atlas was authenticated. |

### 2.7 `docs/stitchcheck-live-demo-status-display.md`

| # | Issue | Correction |
|---|-------|------------|
| 24 | Card 2 footnote said "One read-only search returned five production offers (PVG → NRT/HND)." | Updated to two searches (5 + 8 offers via ATL-LIVE-01). |

### 2.8 `docs/stitchcheck-submission-manifest.md`

| # | Issue | Correction |
|---|-------|------------|
| 25 | Section 7: Atlas live search said "One production search returned 5 real offers." | Updated to two searches with full details. |
| 26 | Section 10: Atlas disclosure said "one production search succeeded." | Updated to two searches. |
| 27 | Section 10: `externalCallsMade: false` stated without context. | Added clarification that the demo app makes no external calls; live-demo results are separate and recorded at the live-demo-results path. |

---

## 3. Corrections Proposed but Not Made

The following files contain inconsistencies but were not modified because they are video assets, deck assets, application code, or historical planning documents outside the scope of this audit.

| File | Issue | Reason Not Modified |
|------|-------|---------------------|
| `docs/stitchcheck-slide-deck-outline.md` | Slide 1: "no live service is called at any point." Slide 5: "Atlas Sandbox authentication" awaiting. Slide 8: "Atlas Sandbox: local fixtures only — not authenticated." Speaker notes: "zero external calls." | Deck asset. User instruction: "Do not modify video or deck assets." |
| `docs/stitchcheck-demo-narrative-video-plan.md` | Timeline 1:00–1:20: "Atlas … has not been authenticated or executed." Timeline 1:20–1:40: "Atlas remains unexecuted and not authenticated." Accuracy guardrails: "Do not claim any Atlas search was performed." Closing line: "zero external calls." Verification: "Atlas unexecuted and not authenticated." | Video asset. User instruction: "Do not modify video or deck assets." |
| `docs/stitchcheck-deck-final-copy.md` | Likely contains same stale Atlas claims as slide deck outline. | Deck asset. |
| `docs/stitchcheck-provider-live-test-review-runbook.md` | Header: "No live execution is currently authorized. No SDK has been installed. No credential has been configured. No network request has been made." Atlas row: "Unauthenticated and unexecuted." | Historical planning document predating live-demo results. Was accurate when written. |
| `smoke-tests/atlas/README.md` | "Atlas has not been authenticated, configured, called, or proven to work." "No Atlas credential, SDK, endpoint, authentication, or request code exists." | Describes the offline test directory scope. Accurate for that scope. Offline fixtures remain synthetic placeholders distinct from live-demo results. |
| `app/src/App.tsx` | May contain `externalCallsMade: false` metadata. | Application code. User instruction: "Do not edit application code." |

---

## 4. Unsupported Claims Remaining

The following claims in unmodified files remain inconsistent with the live-demo evidence. Each is documented here for awareness.

### 4.1 "Zero external calls" claims

| File | Claim | Reality |
|------|-------|---------|
| `docs/stitchcheck-slide-deck-outline.md` (lines 16, 83, 139) | "no live service is called at any point"; "zero external calls" | GEM-LIVE-01 made 1 OpenRouter network call; ATL-LIVE-01 made 1 Atlas production search. The demo app itself makes no calls, but the project as a whole made external calls. |
| `docs/stitchcheck-demo-narrative-video-plan.md` (lines 5, 36, 101, 116) | "zero external calls"; "No provider has been executed, authenticated, or deployed" | Same as above. |

### 4.2 "Atlas unauthenticated" claims

| File | Claim | Reality |
|------|-------|---------|
| `docs/stitchcheck-slide-deck-outline.md` (lines 79, 133) | "Atlas Sandbox: local fixtures only — not authenticated, not executed" | Atlas production authentication succeeded. Two live production searches returned real offers. Sandbox was not used. |
| `docs/stitchcheck-demo-narrative-video-plan.md` (lines 35, 36, 75, 116) | "Atlas … has not been authenticated or executed"; "Do not claim any Atlas search was performed" | Atlas production search was performed and returned real offers. |
| `docs/stitchcheck-provider-live-test-review-runbook.md` (line 13) | Atlas: "Unauthenticated and unexecuted" | Was accurate when written; superseded by live-demo results. |

### 4.3 "No provider executed" claims

| File | Claim | Reality |
|------|-------|---------|
| `docs/stitchcheck-demo-narrative-video-plan.md` (line 5) | "No provider has been executed, authenticated, or deployed for this recording." | OpenRouter and Atlas production were executed (separately from the recording). |

### 4.4 Atlas offer count

| File | Claim | Reality |
|------|-------|---------|
| `docs/stitchcheck-slide-deck-outline.md` | Does not mention live Atlas search at all. | Two live searches exist (5 + 8 offers). |

---

## 5. Audit Checklist Results

| Check | Result | Notes |
|-------|--------|-------|
| 1. Whether live OpenRouter and Atlas production-search evidence is referenced. | **Now yes.** All corrected documents reference GEM-LIVE-01, ATL-LIVE-01, and the prior PVG→NRT search. | Evidence index, README, judge Q&A, presenter script, submission manifest all updated. |
| 2. Whether Atlas is incorrectly described as unauthenticated. | **Fixed in corrected files.** Atlas production authentication is now accurately described. | 8 files corrected. 4 files remain unmodified (deck/video/planning assets). |
| 3. Whether "zero external calls" is contradicted by smoke-test evidence. | **Fixed in corrected files.** Spoken narrative no longer claims "zero external calls" as a project-wide fact. | Presenter script corrected. Deck outline and video plan remain unmodified. |
| 4. Whether offline test counts are clearly labelled as fake-client tests. | **Already correct.** All offline test counts (92, 89, 48, 75) are labelled as offline tests with fake clients. | No correction needed. |
| 5. Whether Nosana is accurately labelled as unexecuted unless a real result exists. | **Already correct.** Nosana is consistently described as unexecuted, blocked, and offline-only. NOS-LIVE-01 confirms blocked status. | No correction needed. |
| 6. Whether Sandbox placeholder data is distinguished from live Sandbox evidence. | **Now clarified.** Documents now explicitly state Atlas Sandbox was not used; production Atlas was used instead. | Evidence index, README, judge Q&A, submission manifest updated. |
| 7. Whether every judge-facing claim has an evidence path. | **Fixed in corrected files.** All updated claims include evidence paths to `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/`. | Deck outline and video plan remain unmodified and contain claims without updated evidence paths. |

---

## 6. Files Modified

| File | Action |
|------|--------|
| `docs/stitchcheck-submission-evidence-index.md` | Corrected |
| `docs/stitchcheck-demo-readiness-report.md` | Corrected |
| `README.md` | Corrected |
| `docs/stitchcheck-live-demo-presenter-script.md` | Corrected |
| `docs/stitchcheck-final-submission-readiness-checklist.md` | Corrected |
| `docs/stitchcheck-judge-qa.md` | Corrected |
| `docs/stitchcheck-live-demo-status-display.md` | Corrected |
| `docs/stitchcheck-submission-manifest.md` | Corrected |
| `docs/stitchcheck-evidence-reconciliation-report.md` | **Created** (this file) |

---

## 7. Summary

- **27 corrections made** across 8 documentation files.
- **4 files proposed but not modified** (deck/video assets per user instruction, historical planning document, offline-scope README).
- **3 categories of unsupported claims remain** in unmodified deck/video assets: "zero external calls," "Atlas unauthenticated," and "no provider executed."
- **0 corrections to offline test counts** — these were already accurately labelled.
- **0 corrections to Nosana status** — already accurately described as unexecuted.
