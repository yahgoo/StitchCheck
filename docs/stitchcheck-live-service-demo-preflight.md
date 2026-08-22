# StitchCheck Live-Service Demo Preflight

## Organizer Requirement

The following decisions must be made by the human organizer before any live-service validation can proceed. Leave these placeholders blank until explicitly filled:

- **Required Gemini model/API path:** _[TO BE FILLED — e.g., gemini-2.5-flash, gemini-1.5-pro, specific endpoint]_
- **Required Nosana environment and job type:** _[TO BE FILLED — e.g., testnet, mainnet; specific workload type]_
- **Required Atlas Sandbox capability:** _[TO BE FILLED — e.g., flight search, order status, specific Sandbox endpoints]_
- **Whether provider output must be visible on screen:** _[TO BE FILLED — yes/no; if yes, specify which outputs]_
- **Whether screenshots/video are required:** _[TO BE FILLED — yes/no; if yes, specify capture requirements]_
- **Maximum allowed cost:** _[TO BE FILLED — e.g., $0.00, $1.00, $10.00; specify currency and billing account]_
- **Required live-demo duration:** _[TO BE FILLED — e.g., 30 seconds, 2 minutes, 5 minutes]_
- **Required fallback behavior:** _[TO BE FILLED — e.g., revert to offline placeholders, show error state, abort demo]_

No live-service validation may proceed until all placeholders above are explicitly filled and approved by the human organizer.

---

## Credential and Authorization Matrix

| Service | Credential Owner | Credential Location | Scope | Expiry | Cost Limit | Human Approval | Verified |
|---------|-----------------|---------------------|-------|--------|------------|----------------|----------|
| Gemini | _[TO BE FILLED]_ | _[TO BE FILLED — e.g., .env.local GEMINI_API_KEY]_ | _[TO BE FILLED — e.g., vision API, structured output]_ | _[TO BE FILLED]_ | _[TO BE FILLED]_ | _[TO BE FILLED — yes/no]_ | _[TO BE FILLED — yes/no]_ |
| Nosana | _[TO BE FILLED]_ | _[TO BE FILLED — e.g., wallet address, API key]_ | _[TO BE FILLED — e.g., testnet job submission]_ | _[TO BE FILLED]_ | _[TO BE FILLED]_ | _[TO BE FILLED — yes/no]_ | _[TO BE FILLED — yes/no]_ |
| Atlas Sandbox | _[TO BE FILLED]_ | _[TO BE FILLED — e.g., .env.local ATLAS_SANDBOX_KEY]_ | _[TO BE FILLED — e.g., read-only search, Sandbox only]_ | _[TO BE FILLED]_ | _[TO BE FILLED]_ | _[TO BE FILLED — yes/no]_ | _[TO BE FILLED — yes/no]_ |

**Do not write credential values in this table.** This table records only metadata about credential ownership, location, scope, and approval status. Actual credential values must never appear in this document, any documentation file, or any evidence artifact.

---

## One-Test-Per-Service Plan

### Gemini: Structured Extraction Test

**Test ID:** GEM-LIVE-01

**Purpose:** Validate that Gemini can extract structured itinerary fields from one synthetic screenshot fixture.

**Input:** One synthetic fixture (e.g., GEM-01) — a fictional itinerary screenshot containing no PII, no real booking data, no payment information.

**Expected output:** Structured JSON with extracted fields (origin, destination, dates, flight numbers, etc.) matching the extraction contract defined in `smoke-tests/gemini/extraction-contract.mjs`.

**Authorization required:** Human must explicitly approve this test before execution.

**Cost estimate:** _[TO BE FILLED — based on model pricing and input size]_

**Success criteria:** Extraction returns valid structured output matching the contract schema; extractionStatus is "success"; all required fields are present.

**Failure handling:** If extraction fails or returns invalid output, abort the live demo and revert to offline placeholder mode. Do not retry without human approval.

**No booking, payment, or external action occurs.** This test is read-only extraction from a synthetic image.

---

### Nosana: Minimum-Cost Risk Workload Test

**Test ID:** NOS-LIVE-01

**Purpose:** Validate that Nosana can execute one minimum-cost, non-production risk-assessment workload.

**Input:** One synthetic risk-assessment request envelope matching the contract defined in `smoke-tests/nosana/nosana-client.mjs` — containing synthetic itinerary data, no PII, no real booking references.

**Expected output:** One workload result with workloadStatus, riskBand, and visible status fields matching the schema defined in `smoke-tests/nosana/schema-validator.mjs`.

**Authorization required:** Human must explicitly approve this test before execution. Human must confirm the environment is testnet/non-production. Human must confirm the cost is within the approved limit.

**Cost estimate:** _[TO BE FILLED — based on Nosana pricing for minimum workload]_

**Success criteria:** Workload completes with workloadStatus "success" or "completed"; riskBand is present; result matches the schema; cost is within the approved limit.

**Failure handling:** If workload fails, times out, or exceeds cost limit, abort immediately. Do not retry without human approval. Revert to offline placeholder mode.

**No deployment, funding, submission, polling, cancellation, or production action occurs.** This test is a single minimum-cost workload on a test/non-production environment only.

---

### Atlas: Read-Only Sandbox Comparison Test

**Test ID:** ATL-LIVE-01

**Purpose:** Validate that Atlas Sandbox can perform one read-only alternative-search or comparison request.

**Input:** One synthetic search request based on the confirmed itinerary from GEM-LIVE-01 — containing synthetic airport codes, dates, and flight numbers; no PII, no real booking references.

**Expected output:** One or more synthetic alternative flight options with offerReference, pricing, and comparison data matching the schema defined in `smoke-tests/atlas/schema-validator.mjs`.

**Authorization required:** Human must explicitly approve this test before execution. Human must confirm the environment is Sandbox (not production). Human must confirm the request is read-only (search/comparison only).

**Cost estimate:** _[TO BE FILLED — based on Atlas Sandbox pricing]_

**Success criteria:** Search returns valid alternative options; searchStatus is "success"; results match the schema; no booking, payment, or order is created.

**Failure handling:** If search fails or returns invalid output, abort the live demo and revert to offline placeholder mode. Do not retry without human approval.

**No booking, payment, reservation, ticketing, order, verification, or cancellation action occurs.** This test is read-only search/comparison in the Sandbox environment only.

---

## Preflight Stop Conditions

**Stop immediately and do not proceed if any of the following conditions are true:**

1. **Cost or billing is unclear.** If the cost of any test cannot be estimated or if billing accounts are not explicitly approved, stop.

2. **Environment is not sandbox/test.** If any service would execute against a production environment, mainnet, or live booking system, stop. Only sandbox, testnet, or explicitly isolated test environments are permitted.

3. **Required model, endpoint, or job configuration is unclear.** If the specific Gemini model, Nosana job type, or Atlas Sandbox endpoint is not explicitly specified and approved, stop.

4. **Credentials are missing or over-permissioned.** If any credential is not present, not verified, or has broader permissions than required for the approved test, stop.

5. **A service would create a deployment or external write action beyond approval.** If any test would result in deployment, funding, submission, booking, payment, reservation, ticketing, order, verification, cancellation, or any other external write action not explicitly approved, stop.

6. **Raw responses would expose secrets, PII, or private data.** If any provider response would contain credentials, API keys, tokens, PII, booking/payment data, private URLs, or account identifiers, stop. Do not log, store, or display such data.

7. **The organizer's live-demo requirement cannot be satisfied safely.** If the required demo duration, visible output, or fallback behavior cannot be achieved without violating safety constraints, stop.

**No test may proceed unless all stop conditions are verified as false.**

---

## Evidence Capture

For each live-service test, capture only the following sanitized fields:

### Required Fields

- **Timestamp:** ISO 8601 UTC timestamp of the request (e.g., `2026-08-21T14:30:00Z`).
- **Service and test ID:** Service name and test identifier (e.g., `Gemini / GEM-LIVE-01`, `Nosana / NOS-LIVE-01`, `Atlas / ATL-LIVE-01`).
- **Status:** Request status (e.g., `success`, `failed`, `timeout`, `aborted`).
- **Request purpose:** One-sentence description of what the test validates (e.g., "Validate structured extraction from synthetic fixture").
- **Fixture identifier:** Synthetic fixture used (e.g., `GEM-01`, synthetic itinerary data).
- **Sanitized result summary:** High-level summary of the result without raw output (e.g., "Extraction returned 12 fields matching contract schema" or "Risk workload returned medium risk band").
- **Whether the request reached the provider:** Boolean — `true` if the request was sent to the provider and a response was received; `false` if the request was blocked before reaching the provider (e.g., due to credential failure, network error, or preflight stop condition).
- **What the result proves:** One-sentence statement of what the result validates (e.g., "Proves that Gemini can extract structured fields from a synthetic screenshot" or "Proves that Nosana can execute a minimum-cost workload on testnet").
- **What it does not prove:** One-sentence statement of what the result does not validate (e.g., "Does not prove that Gemini produces accurate extractions for real-world itineraries" or "Does not prove that Nosana is production-ready or deployed").

### Prohibited Content

**Explicitly prohibit capturing, logging, storing, or displaying:**

- Raw provider output (full JSON responses, raw text, unstructured data)
- HTTP headers, authorization tokens, API keys, or credentials
- PII (personally identifiable information) — passenger names, email addresses, phone numbers, physical addresses
- Booking, payment, reservation, ticket, order, or verification data
- Private URLs, account identifiers, wallet addresses, or internal endpoints
- Screenshots or video containing any of the above

**All evidence artifacts must contain only sanitized, high-level summaries.** No raw provider output may appear in any documentation file, evidence artifact, or demo recording.

---

## Demo Sequence

If all preflight stop conditions are verified as false and all organizer requirements are filled, the following live-demo sequence may proceed:

### Step 1: Gemini Extraction (GEM-LIVE-01)

- Human selects synthetic fixture GEM-01.
- Gemini extracts structured itinerary fields from the synthetic screenshot.
- UI displays extracted fields in editable form.
- **Visible proof:** Extraction label `OpenRouter temporary path — not direct Gemini validation` is replaced with Gemini evidence label (if approved) or remains as temporary-path label.

### Step 2: Human Review and Correction

- Human reviews the extracted fields.
- Human corrects one field (e.g., changes second-leg flight number from SC-202 to SC-299).
- UI displays correction note.
- **Visible proof:** Correction is visible and recorded locally.

### Step 3: Human Confirmation

- Human explicitly confirms the itinerary.
- Confirmation gate unlocks downstream panels.
- **Visible proof:** Status banner appears: "Itinerary confirmed. No external service call was made." (until Nosana/Atlas steps execute).

### Step 4: Nosana Risk Workload (NOS-LIVE-01)

- Nosana executes the authorized minimum-cost risk workload.
- UI displays risk result with heuristic band/score.
- **Visible proof:** Risk panel shows Nosana result with label `Synthetic local placeholder — not Nosana evidence` (if Nosana is not fully validated) or Nosana evidence label (if fully validated and approved).

### Step 5: Atlas Sandbox Comparison (ATL-LIVE-01)

- Atlas Sandbox performs the authorized read-only alternative search.
- UI displays alternative options with comparison data.
- **Visible proof:** Alternatives panel shows Atlas results with label `Synthetic local placeholder — not Atlas Sandbox evidence` (if Atlas is not fully validated) or Atlas evidence label (if fully validated and approved).

### Step 6: Provider Labels and Sanitized Statuses

- UI displays all three provider labels and sanitized statuses.
- **Visible proof:** All labels are visible and accurately reflect the validation status of each provider.

### Step 7: Local Keep or Switch Decision

- Human chooses Keep or Switch locally.
- UI displays final decision.
- **Visible proof:** Decision is recorded locally; no external action occurs.

### Step 8: No External Transaction

- Final statement appears: "No booking, payment, reservation, ticket, order, verification, or other write action has been created."
- **Visible proof:** Metadata shows `noOrderCreated: true`, `syntheticDemo: true` (or `liveDemo: true` if approved), `externalCallsMade: false` (or lists the approved calls if any).

**The demo ends here.** No further external actions occur.

---

## Current Truth

**The following statements remain true until live-service validation is completed and explicitly approved:**

- `OpenRouter temporary path — not direct Gemini validation`
- Direct Gemini remains unexecuted until separately validated.
- Nosana remains unexecuted and undeployed until separately authorized.
- Atlas remains unauthenticated and unexecuted until separately authorized.
- Offline fixtures and tests are not live provider evidence.

**No live-service validation has occurred as of the creation of this document.** This preflight plan is a preparation artifact only. No provider request has been made. No credential has been accessed. No test has been executed. All provider claims remain accurately bounded by the statements above.

---

## Verification

Before executing any live-service test:

- [ ] All organizer requirement placeholders are filled.
- [ ] Credential and authorization matrix is complete and verified.
- [ ] All preflight stop conditions are verified as false.
- [ ] Evidence capture rules are understood and will be followed.
- [ ] Demo sequence is approved by the human organizer.
- [ ] Current truth statements are acknowledged and will be preserved.

**No test may proceed until all checkboxes above are marked.**
