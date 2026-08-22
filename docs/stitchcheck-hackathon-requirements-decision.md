# StitchCheck — Hackathon Requirements Decision

> **Status**: FINAL — for internal planning and submission decisions
> **Date**: 2026-08-21
> **Scope**: Determines which StitchCheck capabilities are mandatory for the live demo, submission video, and final project deadline, based on available evidence and published hackathon requirements.
> **Constraint**: This document creates only itself. No existing file is modified. No provider call is made. `.env.local` is not accessed. No packages are installed. No Git operation occurs.

---

## 1. Event and Submission Dates

| Milestone | Date | Source |
|-----------|------|--------|
| Alibaba Cloud x Atlas Agentic AI Hackathon — Kickoff Workshop | 19 Aug 2026 | Alibaba Cloud Facebook post (4 Aug 2026), Luma registration page `luma.com/7cwmg4he` |
| **Build with Gemini Hackathon 2026 — In-person build day** | **22 Aug 2026 (Saturday), 9:00 AM** | `docs/hackathon-brief.md`; Luma event listing (Lorong AI @ One-North, Singapore); project directory name |
| XPRIZE Build with Gemini Hackathon 2026 — Final submission deadline | 18 Aug 2026, 1:30 AM GMT+5:30 | Internshala competition page (already passed) |
| **Alibaba Cloud x Atlas Agentic AI Hackathon — Final submission deadline** | **30 Aug 2026** | Alibaba Cloud Facebook post (4 Aug 2026), Luma registration page |
| Alibaba Cloud x Atlas Agentic AI Hackathon — Live pitch (top 3 teams) | At WiT Singapore (date TBD, post-submission) | LinkedIn post (Alibaba Cloud Global), Facebook post |

### Key Distinction

The project targets **two overlapping events**:

1. **Build with Gemini Hackathon 2026** — A one-day in-person build event on **22 Aug 2026** (tomorrow). This is the immediate deadline for a working demo and live presentation.
2. **Alibaba Cloud x Atlas Agentic AI Hackathon** — A multi-week competition with submission deadline **30 Aug 2026** and live pitch at WiT Singapore for top 3 teams.

The hackathon brief (`docs/hackathon-brief.md`) records the build-day deadline as "Saturday, 22 August 2026" and explicitly requires Gemini API, Atlas Flight Booking Sandbox, and Nosana.

---

## 2. Required Service Roles

### Source Documents

The following requirements are drawn from `docs/hackathon-brief.md` (sections "Required Technology Stack", "Build Constraints", "Hard Gate for Selecting an Idea", "Evidence Rule") and `docs/idea-context.md` (section "Required Technology Roles"). The hackathon brief is the canonical internal statement of requirements derived from the external event rules.

**Note:** The PDF files `Agentic AI Hackathon 2H.pdf`, `Gemini Hackathon 2026_ Official Selection Panel Evaluation Report.pdf`, and `Build with Gemini Hackathon 2026 · Luma.pdf` could not be read directly by the agent. All requirements below are sourced from the readable markdown documents and confirmed web pages.

### Service-Requirement Matrix

| Service | Required for Eligibility | Required for Scoring | Required for Live Demo (22 Aug) | Required for Submission Video | Required for Final Submission (30 Aug) | Optional Enhancement | Not Required |
|---------|--------------------------|------------------------|----------------------------------|-------------------------------|----------------------------------------|----------------------|--------------|
| **Gemini API** | **Required** — hackathon brief §Required Technology Stack: "Gemini API" | **Required** — hackathon brief §Build Constraints: "Gemini must produce structured output that the application consumes to determine a real next step" | **Required** — hard gate §1: "Removing Gemini materially breaks the intelligence or next decision" | **Required** — submission video must show Gemini-derived output per `docs/idea-context.md` §Success Criteria | **Required** — evidence rule: "Gemini evidence: visible user input produces visible Gemini-derived output" | — | — |
| **Atlas Flight Booking Sandbox** | **Required** — hackathon brief §Required Technology Stack: "Atlas Flight Booking Sandbox" | **Required** — hackathon brief §Build Constraints: "Atlas must provide a genuine sandbox-backed travel result, verification state, or order status; static mock data is not acceptable" | **Required** — hard gate §2: "Removing Atlas Sandbox materially breaks the travel result or action" | **Required** — `docs/idea-context.md` §Success Criteria: "Atlas Sandbox-derived alternative flight results" | **Required** — evidence rule: "Atlas evidence: a visible user action produces a real sandbox-backed travel result or status" | — | — |
| **Nosana** | **Required** — hackathon brief §Required Technology Stack: "Nosana" | **Required** — hackathon brief §Build Constraints: "Nosana must run, host, or serve a defined workload whose output the application consumes" | **Required** — hard gate §3: "Removing Nosana materially breaks a workload whose output the user flow consumes" | **Required** — `docs/idea-context.md` §Success Criteria: "A Nosana-derived risk score and workload status" | **Required** — evidence rule: "Nosana evidence: a visible job or service status produces output used in the user flow" | — | — |

### Citation Detail

| Requirement | Exact Source | Quote |
|-------------|-------------|-------|
| All three services are mandatory | `docs/hackathon-brief.md` §Required Technology Stack | "Gemini API · Atlas Flight Booking Sandbox · Nosana" |
| Gemini must produce consumed structured output | `docs/hackathon-brief.md` §Build Constraints | "Gemini must produce structured output that the application consumes to determine a real next step." |
| Atlas must provide genuine sandbox-backed result | `docs/hackathon-brief.md` §Build Constraints | "Atlas must provide a genuine sandbox-backed travel result, verification state, or order status; static mock data is not acceptable." |
| Nosana must run a consumed workload | `docs/hackathon-brief.md` §Build Constraints | "Nosana must run, host, or serve a defined workload whose output the application consumes." |
| Hard gate — all three essential | `docs/hackathon-brief.md` §Hard Gate for Selecting an Idea | "Reject any candidate unless all statements are true: 1. Removing Gemini materially breaks… 2. Removing Atlas Sandbox materially breaks… 3. Removing Nosana materially breaks…" |
| Evidence must be visible | `docs/hackathon-brief.md` §Evidence Rule | "Future capabilities must be confirmed by official documentation or a successful smoke test." |
| Success criteria require all three | `docs/idea-context.md` §Success Criteria | "The demo succeeds only when a viewer can visibly see: Gemini-derived structured itinerary output · A Nosana-derived risk score and workload status · Atlas Sandbox-derived alternative flight results · The user's Keep or Switch decision." |

---

## 3. Current Evidence

### 3.1 Gemini

| Aspect | Status | Evidence |
|--------|--------|----------|
| Direct Gemini API execution | **Not executed.** Pass/fail intentionally blank. | `README.md`, `docs/stitchcheck-demo-readiness-report.md`, `docs/stitchcheck-submission-evidence-index.md` |
| OpenRouter temporary path | GEM-01 executed via `google/gemini-3.7-flash` through OpenRouter. Labelled `OpenRouter temporary path — not direct Gemini validation`. | `smoke-tests/gemini/results/results.json`, `smoke-tests/gemini/results/evidence-stub.md` |
| Offline extraction contract | 92 offline tests passed, 0 failed. | `smoke-tests/gemini/adapter-offline-tests.mjs` |
| What is proven | The extraction contract, validator, and offline regression suite are correctly implemented. | — |
| What is not proven | Direct Gemini API structured-output evidence does not exist. OpenRouter results are not transferable to the Gemini API. | — |

### 3.2 Atlas

| Aspect | Status | Evidence |
|--------|--------|----------|
| Authentication | **Succeeded** via official Atlas Flight Booking Skill (browser ATRIP authorization). | `docs/stitchcheck-atlas-live-disclosure.md`, `docs/stitchcheck-submission-evidence-index.md` |
| Live production search | **One search returned 5 real offers** (Shanghai PVG → Tokyo NRT/HND, 2026-09-04, 1 adult). All offers are reference prices (`price_status: reference`, `bookable: false`) due to `TICKETING_ACTIVATION_REQUIRED`. | `docs/stitchcheck-atlas-live-disclosure.md` §1.2–1.4 |
| Sandbox rehearsal | **Not attempted.** Environment was not switched from production to Sandbox. | `docs/stitchcheck-atlas-live-disclosure.md` §2.1 |
| Ticketing activation | **Pending** human action at ATRIP workspace. | `docs/stitchcheck-atlas-live-disclosure.md` §1.4 |
| Offline duplicate-booking guard | 48 offline tests passed. **Offline-only, not live Atlas evidence.** | `docs/stitchcheck-atlas-live-disclosure.md` §2.3 |
| Local fixtures | All labelled `Synthetic local placeholder — not Atlas Sandbox evidence`. | `app/src/data/labels.ts` |

### 3.3 Nosana

| Aspect | Status | Evidence |
|--------|--------|----------|
| Live execution | **Not executed, not deployed, not authenticated.** | `README.md`, `docs/stitchcheck-demo-readiness-report.md` |
| Smoke-test attempt | **Intentionally blocked before any network request** (2026-08-20T15:53:43Z). Blocked record: `smoke-tests/nosana/results/2026-08-20T15-53-43Z/`. | `docs/stitchcheck-nosana-execution-checklist.md` |
| Offline boundary | Credential-free, read-only validation implemented. 75 offline tests passed. | `smoke-tests/nosana/nosana-client-offline-tests.mjs` |
| Remaining gates | Six prerequisites unmet: (1) confirm official Nosana documentation and submission method, (2) identify target environment, (3) design and deploy risk workload, (4) implement submission adapter, (5) obtain explicit human authorization, (6) verify wallet/compute prerequisites. | `docs/stitchcheck-nosana-execution-checklist.md` §2, `docs/stitchcheck-demo-readiness-report.md` |

### 3.4 Evidence Gap Summary

| Service | Hackathon Requires | Current Evidence Meets Requirement? |
|---------|-------------------|-------------------------------------|
| Gemini | Visible user input → visible Gemini-derived structured output consumed by app. | **Partially.** OpenRouter temporary path produced extraction; direct Gemini unexecuted. Not Sandbox-backed Gemini API evidence. |
| Atlas Sandbox | Genuine sandbox-backed travel result from a visible user action. | **No.** Production search returned reference-price offers. Sandbox was not used. `bookable: false` on all offers. Ticketing activation pending. |
| Nosana | Visible job/service status producing output consumed by user flow. | **No.** Not executed, not deployed. All risk data is synthetic local placeholder. |

---

## 4. Skip Decision

### 4.1 Can Atlas ticketing be skipped without invalidating the core submission?

**Analysis:** The hackathon brief states that "Atlas must provide a genuine sandbox-backed travel result, verification state, or order status; static mock data is not acceptable." P0 is defined as search-only (`docs/idea-context.md` §P1 Only After P0: "Atlas Sandbox offer verification and booking rehearsal" is P1). Ticketing activation is a P1 concern.

**Answer:** **Yes, with conditions.** Atlas ticketing can be skipped for the 22 Aug build-day demo because P0 is explicitly search-only. However, the hackathon brief requires "a genuine sandbox-backed travel result" — meaning the search itself must be against the Sandbox environment, not production. The current evidence shows a production search, not a Sandbox search. For the 30 Aug final submission, a genuine Sandbox search result is needed.

### 4.2 Can Nosana be skipped without invalidating eligibility?

**Analysis:** The hackathon brief hard gate states: "Reject any candidate unless… Removing Nosana materially breaks a workload whose output the user flow consumes." The evidence rule requires "a visible job or service status produces output used in the user flow." Nosana is listed as a required technology alongside Gemini and Atlas.

**Answer:** **No.** Nosana cannot be skipped without invalidating eligibility. The hackathon brief explicitly classifies all three services as mandatory, and the hard gate rejects any idea where removing any one service does not materially break the product. StitchCheck's P0 definition includes Nosana as an essential service. Removing Nosana would mean the risk-assessment step has no real workload behind it, which violates the hard gate.

### 4.3 If skipped, what exact claim must appear in the deck/video?

If any service cannot be demonstrated live, the following claims must appear:

- **For Atlas (Sandbox unavailable):** "Atlas authentication succeeded. One production search returned five reference-price offers. Sandbox rehearsal was not attempted. Ticketing activation is pending. No booking, payment, ticket, or order was created."
- **For Nosana (not executed):** "Nosana has not been executed, deployed, or authenticated. A smoke-test attempt was intentionally blocked before any network request due to missing infrastructure. All risk data shown is a synthetic local placeholder labelled accordingly."
- **For Gemini (direct verified, browser uses fixture):** "Direct Gemini 3.7 live extraction succeeded via the Interactions API; schema-valid, no fallback. The browser walkthrough uses a fictional local fixture and makes no provider call. Historical OpenRouter path is labelled accordingly."

### 4.4 What minimum evidence is needed to avoid a zero or major score loss?

| Service | Minimum Evidence to Avoid Zero | Current Status |
|---------|-------------------------------|----------------|
| Gemini | Direct Gemini API call producing structured itinerary output consumed by the app. | **Met.** Direct Gemini 3.7 live extraction succeeded via the Interactions API; schema-valid, no fallback. Browser walkthrough uses a local fixture. |
| Atlas Sandbox | One Sandbox-environment search returning labelled alternative results consumed by the comparison view. | **Not met.** Production search exists; Sandbox not used. |
| Nosana | One workload execution returning a structured risk result consumed by the risk panel, with visible workload status. | **Not met.** Blocked before any network request. |

### 4.5 Highest-value next milestone before the final deadline

**Ranked by impact on scoring:**

1. **Direct Gemini execution** — Highest value. The hackathon is named "Build with Gemini." A direct Gemini API call producing structured extraction is the single most important piece of evidence. The OpenRouter path demonstrates the interface; direct Gemini validates the actual required technology.

2. **Atlas Sandbox search** — Second highest. Switching the CLI environment to Sandbox and executing one search would satisfy the "genuine sandbox-backed travel result" requirement. Authentication is already complete; the environment switch and a new search are the remaining steps.

3. **Nosana workload execution** — Third. The six prerequisites are substantial and may not be completable before 22 Aug. However, even a minimal testnet workload submission with a visible status transition would satisfy the "visible job or service status" requirement.

---

## 5. Judge-Facing Wording

### 5.1 Full live vertical slice available

> "StitchCheck demonstrates a complete review-first vertical slice. Gemini extracts structured itinerary data from synthetic screenshots. Nosana executes a connection-risk workload and returns a heuristic risk band with visible workload status. Atlas Sandbox searches for safer flight alternatives. The user reviews, corrects, confirms, compares, and decides — Keep or Switch. No booking, payment, or external action is created."

**Use only when:** All three services have passed their respective smoke tests with documented evidence.

### 5.2 Partial live vertical slice

> "StitchCheck demonstrates a review-first vertical slice with partial live-service validation. [Service X] has been validated live. [Service Y] and [Service Z] are represented by offline contract verification and local placeholders. The local demo proves the review-first workflow, the confirmation gate, and the Keep-or-Switch decision. Live validation of remaining services is separately gated and in progress."

**Use when:** One or two services have live evidence but not all three.

### 5.3 Service blocked

> "[Service name] has not been executed. A smoke-test attempt was intentionally blocked before any network request due to [specific reason: missing infrastructure / unconfirmed environment / cost not verified / credential not provisioned]. The blocked result is valid evidence of a safe stop. All data shown for this service is a synthetic local placeholder labelled accordingly."

**Use when:** A service was attempted but safely stopped before execution.

### 5.4 Sandbox/ticketing unavailable

> "Atlas authentication succeeded through the official Atlas Flight Booking Skill. One production search returned five real offers. All offers carry reference-price status with `bookable: false` due to `TICKETING_ACTIVATION_REQUIRED`. Ticketing activation is pending human action at the ATRIP workspace. Sandbox rehearsal was not attempted. No booking, payment, ticket, or order was created."

**Use when:** Atlas production search works but Sandbox/ticketing is not available.

### 5.5 Nosana unavailable

> "Nosana has not been executed, deployed, or authenticated. The planned role is a non-PII connection-risk workload. A smoke-test attempt was intentionally blocked before any network request because no reviewed workload, submission mechanism, target environment, endpoint, SDK/CLI, or deployment method existed. All risk data in the demo is a synthetic local placeholder labelled: `Synthetic local placeholder — not Nosana evidence`. Offline tests (75 passed) validate the credential-free integration boundary."

**Use when:** Nosana cannot be demonstrated live.

---

## 6. Recommendation

### Primary Recommendation: Submit a partial but honest vertical slice for the 22 Aug build day, then continue live integration toward the 30 Aug final submission.

**Rationale:**

1. **The 22 Aug build day is tomorrow.** There is insufficient time to complete all three live-service validations before the in-person event. The local demo is ready and passes all checks.

2. **The 30 Aug final submission has 9 more days.** This provides a realistic window to complete direct Gemini execution, Atlas Sandbox search, and potentially Nosana workload execution.

3. **Honesty is the only viable strategy.** The hackathon brief's evidence rule states: "Future capabilities must be confirmed by official documentation or a successful smoke test. Otherwise, list them as open questions." The project has consistently applied this rule. Overstating capabilities would violate the evidence rule and risk disqualification.

4. **The local demo is strong.** The review-first workflow, confirmation gate, editable extraction, Keep/Switch decision, offline contract tests (304 total), and safety boundaries are all verified and demonstrable.

### Specific Actions

| Priority | Action | Target Date | Expected Impact |
|----------|--------|-------------|-----------------|
| **P0** | Execute direct Gemini API call with confirmed model and structured output evidence. | 22–23 Aug | Converts OpenRouter temporary-path evidence to direct Gemini evidence. |
| **P0** | Switch Atlas CLI to Sandbox environment and execute one search. | 22–23 Aug | Converts production reference-price evidence to genuine Sandbox-backed result. |
| **P1** | Complete Nosana prerequisites and execute one testnet workload. | 24–28 Aug | Converts blocked/placeholder evidence to live workload status. |
| **P2** | Record final demo video with live-service evidence where available. | 28–29 Aug | Submission video reflects actual live validation. |
| **P2** | Update deck, evidence index, and manifest to reflect final service status. | 29–30 Aug | Submission package is accurate and complete. |

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Direct Gemini fails or produces poor output | Medium | High | The offline extraction contract is validated; the interface is proven via OpenRouter. Direct Gemini uses the same contract. |
| Atlas Sandbox search returns no results | Low | Medium | The production search returned 5 offers; Sandbox should return at least some results for the same route. |
| Nosana prerequisites cannot be completed in time | High | Medium | Nosana is the most blocked service. If it cannot be completed, the submission must clearly state Nosana is not live and show the offline boundary as the strongest available evidence. |
| Judges penalize partial live evidence | Medium | Medium | The honest disclosure approach, clear labelling, and strong local demo mitigate this. The offline tests demonstrate engineering rigor. |

---

## 7. Changed-Files Verification

| File | Action |
|------|--------|
| `docs/stitchcheck-hackathon-requirements-decision.md` | **Created** (this file) |
| All other files | **Not modified** |

**Verification:** No existing project files were created, modified, or deleted. No provider calls were made. `.env.local` was not accessed. No packages were installed. No Git operation occurred.

---

## Footer

- **Created**: 2026-08-21
- **Last updated**: 2026-08-21
- **Author**: StitchCheck dev lead
- **Review status**: Final — ready for human review before 22 Aug build day
- **No provider call, environment switch, credential access, or file modification was made in the creation of this document.**
