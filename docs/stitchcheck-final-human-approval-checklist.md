# StitchCheck — Final Human Approval Checklist

> **Date:** 2026-08-21  
> **Purpose:** Three independent approval gates for provider execution. Each gate is separate. Approval of one does not imply approval of another.  
> **Safety rule:** No execution may occur without explicit written human approval for each gate.

---

## Gate A — Atlas: Read-Only Sandbox Search → Verify

### Scope
- Approve **only** read-only Sandbox Search → Verify.
- **Explicitly prohibit** Order, Payment, Ticketing, Cancel, and Refund.

### Current Status
- ✅ Sandbox Search + Verify already completed (ATL-SBX-SV-01).
- ✅ 20 offers returned for KUL → SIN.
- ✅ Verify returned `PRICE_CONFIRMATION_REQUIRED`.
- ✅ Hard stop after Verify — no write occurred.
- ✅ Environment restored to Production.
- ⏸ Ticketing activation remains unresolved (account-level, ATRIP workspace admin action).

### Evidence
- **Evidence file:** `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json`
- **Evidence label:** `Atlas Sandbox evidence — search + verify completed, price change or offer expired`
- **Environment:** Sandbox → restored to Production

### Approval Checkbox

- [ ] **A-01:** I confirm that the Atlas Sandbox Search + Verify (ATL-SBX-SV-01) was read-only and no write occurred.
  - **Exact command that was executed:** `node smoke-tests/atlas/run-sandbox-search-verify.mjs`
  - **Exact external effect:** Read-only Search returned 20 offers; Verify returned PRICE_CONFIRMATION_REQUIRED. No order, payment, ticketing, cancellation, or refund was created.
  - **Exact stop condition:** Script hard-stops after Verify. No `order create`, `order pay`, or ticketing command exists in the script.
  - **Exact evidence artifact:** `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json`

- [ ] **A-02:** I confirm the environment was restored to Production after the Sandbox test.
  - **Exact command:** `atlas-flight environment use production --json`
  - **Exact external effect:** Local CLI config change only. No network request.
  - **Exact stop condition:** N/A (config change is immediate).
  - **Exact evidence artifact:** CLI output confirming `production` environment.

- [ ] **A-03:** I understand that Ticketing activation requires ATRIP workspace admin action and is independent of this approval.

---

## Gate B — Nosana: One Bounded Non-PII Workload

### Scope
- Approve **one bounded non-PII workload only**.
- No PII may enter the workload.

### Prerequisites (all must be resolved before execution)
- [ ] `@nosana/kit` installed (`cd smoke-tests/nosana && npm install @nosana/kit`)
- [ ] Nosana credit account exists with balance > 0
- [ ] Market address verified via read-only `GET /api/markets`
- [ ] Job definition validated locally with SDK `validateJobDefinition()`

### Approval Checkbox

- [ ] **B-01:** I approve one bounded Nosana risk workload execution.
  - **Exact command:** `cd smoke-tests/nosana && node run-risk-job.mjs`
  - **Exact expected external effect:** One container job submitted to Nosana market `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq`. Estimated cost: ~$0.0008 for a 60-second workload. Hard ceiling: US$10.00.
  - **Exact stop condition:** One attempt, zero retries. Hard stop after one result or timeout (60 seconds). Fallback activates if the job fails.
  - **Exact evidence artifact:** `smoke-tests/nosana/results/<UTC-timestamp>/result.json`

- [ ] **B-02:** I confirm the job definition hash matches the approved shape.
  - **Job definition file:** As specified in `docs/stitchcheck-nosana-approval-packet.md` §4.
  - **Schema version:** `"0.1"` (official Nosana schema)
  - **Type:** `"container"`
  - **Image:** `python:3.12-slim`
  - **PII declaration:** `nonPiiDeclaration: true`, `syntheticDemo: true`

- [ ] **B-03:** I confirm no PII enters the workload.
  - **Input fixture:** `smoke-tests/nosana/fixtures/req-nos-clean-two-leg.json` (synthetic airports AAA/BBB/CCC)
  - **Historical data:** `smoke-tests/nosana/fixtures/historical-delay-data.json` (fictional)
  - **No passenger names, emails, passports, bookings, or personal data.**

- [ ] **B-04:** I understand the fallback behavior.
  - If the Nosana job fails, times out, or errors, the local Monte Carlo heuristic activates.
  - The result carries `fallbackUsed: true` and label `"Nosana unavailable — local fallback used; not Nosana evidence"`.

- [ ] **B-05:** I confirm the maximum spend is US$10.00 and accept the estimated cost of ~$0.0008.

---

## Gate C — Gemini: One Direct Extraction Call

### Scope
- Approve **one direct extraction call only**.
- Prohibit sending real passenger PII.

### Prerequisites (all must be resolved before execution)
- [ ] `@google/genai` SDK installed
- [ ] Model identifier approved and recorded in `provider-capabilities.json`
- [ ] `capabilityReviewStatus` set to `"approved"`
- [ ] `directGeminiEnabled: true` set in `config.json`
- [ ] `safetySettings` / `generationConfig` reviewed and applied
- [ ] Execution entry point `run-direct-gemini.mjs` created

### Approval Checkbox

- [ ] **C-01:** I approve one direct Gemini extraction call.
  - **Exact command:** `cd smoke-tests/gemini && node run-direct-gemini.mjs --fixture gem-01-two-leg-clean.png`
  - **Exact expected external effect:** One image+text extraction request sent to the Gemini API. The model processes a synthetic flight itinerary screenshot and returns structured JSON.
  - **Exact stop condition:** One request, zero retries. 60-second timeout. Exit immediately after one result (success or failure).
  - **Exact evidence artifact:** `smoke-tests/gemini/results/<UTC-timestamp>/direct-gemini-result.json`

- [ ] **C-02:** I confirm the approved model identifier.
  - **Model:** _______________ (human must fill in)
  - **Image input support confirmed:** ☐ Yes ☐ No
  - **Structured JSON output confirmed:** ☐ Yes ☐ No

- [ ] **C-03:** I confirm no real passenger PII is sent.
  - **Fixture:** `gem-01-two-leg-clean.png` — synthetic, fictional, no PII.
  - **Airports:** Fictional (AAA, BBB, CCC).
  - **Flight numbers:** Fictional (FA-101, FA-202).
  - **No names, passports, bookings, or personal data.**

- [ ] **C-04:** I confirm schema validation and sanitization.
  - The result passes through `validateExtractionResult()` before being saved.
  - Error messages are sanitized (credentials, URLs, PII stripped).
  - Raw provider output is never returned directly.
  - Result is `Object.freeze()`-d.

- [ ] **C-05:** I confirm the maximum request count is 1.
  - `maxCalls: 1` enforced in adapter.
  - `maxRetries: 0` — no retry.
  - 60-second timeout — `requestTimeoutMs: 60000`.

---

## Summary of Commands Awaiting Approval

| Gate | Command | Status |
|------|---------|--------|
| **A** | `node smoke-tests/atlas/run-sandbox-search-verify.mjs` | ✅ Already executed (read-only). No further action needed. |
| **B** | `cd smoke-tests/nosana && node run-risk-job.mjs` | ⏸ Blocked on SDK install, credit account, market verification. |
| **C** | `cd smoke-tests/gemini && node run-direct-gemini.mjs --fixture gem-01-two-leg-clean.png` | ⏸ Blocked on SDK install, model approval, config flags, entry point creation. |

---

## Safety Statements

**No Atlas order, payment, ticketing, cancellation, or refund was performed.**

**No paid Nosana workload was submitted.**

**No direct Gemini call was made during this review.**

---

- **Created:** 2026-08-21
- **Author:** Final verification lead
- **Each gate requires separate human approval. Approval of one does not imply approval of another.**
