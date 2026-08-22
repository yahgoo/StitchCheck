# StitchCheck — Privacy Boundary Audit

> **Status:** FINAL — read-only audit; no file modified, no provider called  
> **Date:** 2026-08-21  
> **Owner:** StitchCheck privacy-boundary audit  
> **Scope:** PII handling, credential containment, screenshot boundary, risk-payload sanitization, Atlas evidence sanitization, UI label truthfulness, and booking/payment/ticketing write-protection across `app/src/`, `smoke-tests/gemini/`, `smoke-tests/nosana/`, `smoke-tests/atlas/`, and selected disclosure documents.  
> **Constraint:** No provider was called. No application code was edited. No `.env.local`, credential, final media, deck asset, or provider integration was touched.

---

## 0. Files Read and Ownership

| Area | Files read | Owner / location |
|------|-----------|-----------------|
| App UI | `App.tsx`, `SafetyNotice.tsx`, `RiskPanel.tsx`, `AlternativesPanel.tsx`, `DecisionPanel.tsx` | `app/src/components/` |
| App data | `fixtures.ts`, `labels.ts`, `types.ts` | `app/src/data/` |
| Fixture contract | `stitchcheck-ui-demo-data.json` | `app-fixture-contracts/` |
| Public result | `nosana-risk-result.json` | `app/public/` |
| Gemini harness | `openrouter-adapter.mjs`, `providers.mjs` | `smoke-tests/gemini/` |
| Nosana boundary | `nosana-risk-runner.mjs`, `schema-validator.mjs` | `smoke-tests/nosana/` |
| Atlas boundary | `read-only-atlas-adapter.mjs`, `alternatives-contract.mjs`, `duplicate-booking-guard.mjs` | `smoke-tests/atlas/` |
| Disclosure docs | `stitchcheck-atlas-live-disclosure.md`, `stitchcheck-nosana-approval-packet.md` | `docs/` |

No file was modified. No existing file was assigned to another chat.

---

## 1. Synthetic Demo Data Contains No Real PII

**Verdict: PASS**

### Evidence

| Source | Finding |
|--------|---------|
| `stitchcheck-ui-demo-data.json` § `meta.piiReview` | Explicit declaration: *"All data is synthetic by construction: invented airport codes (AAA/BBB/CCC), fictional correlation identifiers, invented dates and placeholder prices. No real passenger, booking reference, payment data, airline record, PII, or credential appears anywhere in this file."* |
| `stitchcheck-ui-demo-data.json` § `meta.syntheticDemo` | `true` on every UI state object. |
| `stitchcheck-ui-demo-data.json` § extraction data | Airport codes are `AAA`, `BBB`, `CCC` (non-IATA). Airline is `"Synthetic Carrier"`. Flight numbers are `SC-101`, `SC-202`/`SC-299`. No passenger name, email, phone, passport, payment card, or booking reference appears. |
| `nosana-risk-runner.mjs` L548–557 | Default CLI payload uses `origin: "AAA"`, `connectionAirport: "BBB"`, `destination: "CCC"`, `syntheticDemo: true`, `nonPiiDeclaration: true`. |
| `nosana/schema-validator.mjs` L20–38 | `FORBIDDEN_PII_KEYS` array (27 entries including `name`, `email`, `phone`, `passenger`, `bookingReference`, `pnr`, `payment`, `cardNumber`, `passport`, `dateOfBirth`, `address`). |
| `nosana/schema-validator.mjs` L57–71 | `scanPiiKeys()` recursively scans every key in the request object and rejects any match against the forbidden list. |
| `nosana/schema-validator.mjs` L101–106 | `validateRiskRequest()` requires `syntheticDemo === true` and `nonPiiDeclaration === true`; fails validation otherwise. |
| `atlas/duplicate-booking-guard.mjs` L49–75 | Independent `FORBIDDEN_KEYS` list (27 entries) strips PII and credential fields from any candidate before fingerprinting. |
| `atlas/duplicate-booking-guard.mjs` L91–107 | `sanitizeValue()` recursively removes forbidden keys from objects. |
| `app/src/data/types.ts` L27 | `ExtractionResult` interface carries `syntheticDemo: boolean` — always `true` in fixtures. |

### Conclusion

All demo data is synthetic by construction. PII-guard validators actively reject any payload containing real PII-shaped keys. No real passenger name, email, phone, passport, payment card, or booking reference exists in any fixture, type definition, or UI state.

---

## 2. Raw Screenshots Are Not Sent to Nosana

**Verdict: PASS**

### Evidence

| Source | Finding |
|--------|---------|
| `app/src/data/fixtures.ts` L38–44 | Screenshot fixtures (`gem-01` through `gem-05`) are PNG files loaded only as local file paths for UI display. |
| `app/src/components/UploadPanel.tsx` | Screenshots are displayed in-browser only; no upload or network call is made. |
| `smoke-tests/gemini/openrouter-adapter.mjs` L122–137 | Fixture images are base64-encoded and sent **only** to the OpenRouter chat completions endpoint (`https://openrouter.ai/api/v1/chat/completions`) for extraction — never to Nosana. |
| `smoke-tests/nosana/nosana-risk-runner.mjs` L52–115 | The Nosana Python risk script receives only structured itinerary fields (`origin`, `destination`, `connectionAirport`, `connectionDurationMinutes`) and historical delay data — no image, no screenshot, no base64 payload. |
| `smoke-tests/nosana/nosana-risk-runner.mjs` L134–175 | `buildRiskJobDefinition()` serializes only `itineraryPayload` and `historicalData` as JSON env vars. No image field exists in the job definition. |
| `smoke-tests/nosana/schema-validator.mjs` L76–111 | `validateRiskRequest()` accepts only `correlationId`, `origin`, `connectionAirport`, `destination`, `connectionDurationMinutes`, `staticHistoricalDatasetVersion`, `syntheticDemo`, `nonPiiDeclaration` — no image or binary field. |

### Conclusion

Screenshots flow exclusively to the OpenRouter extraction path. The Nosana risk workload receives only sanitized, structured itinerary features (airport codes, connection duration) and synthetic historical delay data. No image data enters the Nosana job definition.

---

## 3. No Credentials or Tokens Enter Logs/Results

**Verdict: PASS**

### Evidence

| Source | Finding |
|--------|---------|
| `smoke-tests/gemini/providers.mjs` L11 | *"Secret values are only length-checked; they are never printed, logged, or serialized."* |
| `smoke-tests/gemini/providers.mjs` L31–42 | `readLocalEnvValue()` reads `.env.local` and returns the raw string; the only readiness output is `keyStatus: "present-not-used"` — the value itself is never included in the return object. |
| `smoke-tests/gemini/openrouter-adapter.mjs` L274 | Key is read into a local variable `key` and used only in the `authorization` header. It is never logged, serialized, or included in any result record. |
| `smoke-tests/gemini/openrouter-adapter.mjs` L184–195 | `summarizeRedacted()` returns only field counts and status — raw response body is redacted (`"note": "raw response redacted"`). |
| `smoke-tests/nosana/nosana-risk-runner.mjs` L11–12 | Header comment: *"NOSANA_API_KEY is read from env and passed to the child process ONLY. It is NEVER printed, logged, or included in any output or result file."* |
| `smoke-tests/nosana/nosana-risk-runner.mjs` L394–399 | Child process inherits `process.env` (which includes `NOSANA_API_KEY`) but the code explicitly comments: *"NEVER add it to any log or output"*. |
| `smoke-tests/nosana/nosana-risk-runner.mjs` L410 | *"NEVER log stderr content that might contain credentials"*. |
| `smoke-tests/nosana/nosana-risk-runner.mjs` L560–668 | CLI output writes only `evidenceSource`, `evidenceLabel`, `latencyMs`, `fallbackUsed`, and risk result fields — no credential, key, or token. |
| `smoke-tests/atlas/read-only-atlas-adapter.mjs` L298–308 | `_sanitizeError()` applies six regex redactions: `sk-*` (OpenAI-style keys), `AIza*` (Google API keys), `Bearer *` tokens, URLs, email addresses, and stack traces. |
| `smoke-tests/atlas/read-only-atlas-adapter.mjs` L108–124 | `_resolveCredential()` returns the credential string for internal use only; `getAtlasReadiness()` (L467–492) never includes the credential value in its output. |
| `smoke-tests/atlas/duplicate-booking-guard.mjs` L12–14 | *"Zero credentials read: no .env or secret file is ever touched."* |
| `app/public/nosana-risk-result.json` | Public result file contains no key, token, or credential — only `riskBand`, `riskScore`, `assumptions`, `evidenceSource`, and `evidenceLabel`. |
| Grep for `console.log.*key\|token\|secret\|password\|credential\|api_key\|bearer\|authorization` | Only 1 match: `workload-skeleton.mjs` L177 — a negative statement: *"No Nosana call, job submission, deployment, credential, or network"*. |

### Conclusion

Credentials are used only in-memory for HTTP authorization headers. They are never printed, logged, serialized into result files, or included in error messages. Error sanitization regexes actively redact key-shaped patterns. The public result JSON contains no credential material.

---

## 4. Risk Payload Contains Only Sanitized Itinerary Features

**Verdict: PASS**

### Evidence

| Source | Finding |
|--------|---------|
| `nosana-risk-runner.mjs` L548–557 | Default CLI payload fields: `correlationId`, `origin` (AAA), `connectionAirport` (BBB), `destination` (CCC), `connectionDurationMinutes` (75), `staticHistoricalDatasetVersion`, `syntheticDemo`, `nonPiiDeclaration`. |
| `nosana-risk-runner.mjs` L134–175 | `buildRiskJobDefinition()` serializes only the itinerary payload and historical delay data into `global.env.RISK_INPUT_DATA` and `global.env.HISTORICAL_DELAY_DATA`. |
| `nosana/schema-validator.mjs` L76–111 | `validateRiskRequest()` enforces: non-empty `correlationId`, 3-letter IATA airport codes, non-negative `connectionDurationMinutes`, `syntheticDemo === true`, `nonPiiDeclaration === true`, and recursive PII-key scan. |
| `nosana/schema-validator.mjs` L57–71 | `scanPiiKeys()` rejects any payload containing keys like `name`, `email`, `phone`, `passenger`, `payment`, `cardNumber`, `passport`, `dateOfBirth`, `address`, etc. |
| `nosana-risk-runner.mjs` L283–291 | Input validation failure triggers immediate fallback — theNosana job is never submitted with invalid/PII-containing input. |
| `nosana-approval-packet.md` §4 | Job definition `meta` includes `syntheticDemo: true` and `nonPiiDeclaration: true` (approval packet shape). |
| `nosana-risk-runner.mjs` L157–165 | Actual job definition `meta` contains only `trigger: "api"` per official schema; custom metadata is excluded from the submitted definition. |
| `app/public/nosana-risk-result.json` | Result contains only: `riskBand`, `riskScore`, `assumptions` (airport-level statistics), `simulationCount`, `explanation` — no passenger data, no PII, no credential. |

### Conclusion

The Nosana risk payload contains only sanitized itinerary features (3-letter airport codes, connection duration in minutes) and synthetic historical delay data. PII-scanning validation rejects any payload containing personal data keys. The result contains only heuristic risk outputs.

---

## 5. Atlas Search/Verify Evidence Is Sanitized

**Verdict: PASS**

### Evidence

| Source | Finding |
|--------|---------|
| `read-only-atlas-adapter.mjs` L250–291 | `_normalizeProviderResult()` creates `Object.freeze()`-d output with only whitelisted fields: `offerReference`, `routeSummary`, `departureTime`, `arrivalTime`, `duration`, `connectionType`, `connectionDurationMinutes`, `priceDisplay`, `currency`, `availabilityLabel`. All other internal fields are stripped. |
| `read-only-atlas-adapter.mjs` L298–308 | `_sanitizeError()` redacts: API key patterns (`sk-*`, `AIza*`), Bearer tokens, URLs, email addresses, and stack traces from any error message. |
| `read-only-atlas-adapter.mjs` L317–386 | `createProviderCallFunction()` enforces: max 1 call, 60s timeout, 10 MB response limit. Error results carry `fallbackUsed: true` and `syntheticDemo: true`. |
| `read-only-atlas-adapter.mjs` L394–458 | `readOnlyAtlasAdapter.execute()` validates operation is read-only, checks authorization (capability approval + environment + client injection + credential), and returns disabled fallback for any unmet prerequisite. |
| `alternatives-contract.mjs` L26–39 | `FORBIDDEN_OPERATIONS` explicitly blocks: `book`, `create_booking`, `reserve`, `ticket`, `issue`, `pay`, `purchase`, `verify`, `cancel`, `change`, `refund`, `order`. |
| `alternatives-contract.mjs` L84–101 | `createDisabledAtlasSearchResult()` returns frozen result with `searchStatus: "disabled"`, `fallbackUsed: true`, `syntheticDemo: true`, `sourceEnvironment: "sandbox-placeholder"`. |
| `duplicate-booking-guard.mjs` L127–138 | All guard results carry `executedAgainstProvider: false`, `sourceType: "synthetic-local-placeholder"`. |
| `duplicate-booking-guard.mjs` L371–382 | `buildRecoveryReceipt()` returns frozen structured state only — *"Never includes raw provider output, card data, PII, or credentials."* |
| `stitchcheck-atlas-live-disclosure.md` §2.2 | *"No booking, payment, ticket, or order was created. No write operation of any kind was performed against Atlas."* |
| Atlas fixture data | All `result-atl-*.json` fixtures use `sourceEnvironment: "sandbox-placeholder"`, fictional airport codes, and `priceDisplay: "— placeholder —"`. |

### Conclusion

Atlas evidence is sanitized through frozen normalization that strips internal fields, error messages are regex-redacted, all results carry `syntheticDemo: true`, and the adapter is disabled by default requiring 5 explicit prerequisites before any provider call. The duplicate-booking guard operates entirely offline with zero network code.

---

## 6. UI Labels Distinguish Synthetic, Fallback, and Live Evidence

**Verdict: PASS**

### Evidence

| Source | Finding |
|--------|---------|
| `app/src/data/labels.ts` L3–14 | Five distinct label constants: |
| | • `geminiExtraction`: *"OpenRouter temporary path — not direct Gemini validation"* |
| | • `nosanaRisk`: *"Synthetic local placeholder — not Nosana evidence"* |
| | • `nosanaRiskEvidence`: *"Nosana evidence — remote job succeeded; result from decentralized GPU workload"* |
| | • `nosanaRiskFallback`: *"Nosana unavailable — local fallback used; not Nosana evidence"* |
| | • `atlasAlternatives`: *"Synthetic local placeholder — not Atlas Sandbox evidence"* |
| `app/src/data/labels.ts` L18–19 | `FINAL_STATEMENT`: *"No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only."* |
| `RiskPanel.tsx` L42–53 | Label selection logic: `evidenceSource === 'nosana-evidence'` → evidence label; `evidenceSource === 'local-fallback'` or `fallbackUsed` → fallback label; otherwise → synthetic placeholder label. CSS classes distinguish `--evidence` and `--fallback` visually. |
| `AlternativesPanel.tsx` L17, L50 | Always displays `LABELS.atlasAlternatives` (*"Synthetic local placeholder — not Atlas Sandbox evidence"*). |
| `SafetyNotice.tsx` L13–28 | Explicit notice: *"This is a synthetic demo application. All data displayed is fictional and local."* Lists: no real documents, no external calls, no booking/payment. Footer shows `LABELS.geminiExtraction`. |
| `App.tsx` L140 | Header badge: *"Synthetic Demo — No Live Services"*. |
| `App.tsx` L209 | Status banner on confirmation: *"Itinerary confirmed. No external service call was made. Downstream panels are now active with local synthetic placeholder data."* |
| `App.tsx` L241–244 | Footer: *"StitchCheck Synthetic Demo · No external calls · No booking, payment, or order created · All data is fictional and local"*. |
| `DecisionPanel.tsx` L24 | Displays `FINAL_STATEMENT` after decision confirmation. |
| `DecisionPanel.tsx` L26–29 | Meta list: `noOrderCreated: true`, `syntheticDemo: true`, `externalCallsMade: false`. |
| `app/public/nosana-risk-result.json` L6–7 | `evidenceSource: "local-fallback"`, `evidenceLabel: "Nosana unavailable — local fallback used; not Nosana evidence."` — correctly triggers fallback label in UI. |
| `stitchcheck-ui-demo-data.json` § `labels` | Labels in fixture match `labels.ts` constants exactly. |

### Conclusion

The UI correctly distinguishes three evidence states (synthetic placeholder, local fallback, live evidence) through dedicated label constants, conditional rendering logic, and visual CSS classes. Every panel, the safety notice, the header, the footer, and the decision panel display accurate source labels. No label overstates the evidence source.

---

## 7. No Booking/Payment/Ticketing Write Is Reachable

**Verdict: PASS**

### Evidence

| Source | Finding |
|--------|---------|
| `stitchcheck-ui-demo-data.json` § `meta.forbiddenActions` | `["verify", "book", "pay", "ticket", "reserve", "order", "write"]` — declared on every UI state. |
| `alternatives-contract.mjs` L26–39 | `FORBIDDEN_OPERATIONS`: `book`, `create_booking`, `reserve`, `ticket`, `issue`, `pay`, `purchase`, `verify`, `cancel`, `change`, `refund`, `order`. |
| `read-only-atlas-adapter.mjs` L413–423 | `execute()` rejects forbidden operations with `createDisabledAtlasSearchResult("forbidden_operation_*")`. |
| `read-only-atlas-adapter.mjs` L24–26 | `READ_ONLY_OPERATIONS` allowlist: only `["search", "compare"]`. |
| `App.tsx` L32–41 | No state variable, handler, or route for booking, payment, ticketing, or order creation. `decision` state is `"keep" | "switch" | null` — a local-only choice. |
| `App.tsx` L134 | `handleConfirmDecision` only sets `decisionConfirmed` to `true` — no external call. |
| `RiskPanel.tsx` L122–127 | Action buttons (`Re-run risk assessment`, `Proceed without risk guidance`) are `disabled` with `aria-label` noting *"disabled in synthetic demo"*. |
| `AlternativesPanel.tsx` L106–107 | `Retry alternative search` button is `disabled` with `aria-label` noting *"disabled in synthetic demo"*. |
| `DecisionPanel.tsx` L44–47 | Explicit text: *"This is a local demo decision only. No booking, payment, reservation, ticket, order, verification, or any other external action will be created."* |
| `DecisionPanel.tsx` L22 | After confirmation: heading reads *"Demo Complete — No Action Created"*. |
| `duplicate-booking-guard.mjs` L12–16 | *"Zero network code: no fetch/http/https/net/socket imports or calls. Zero credentials read. Zero dependencies. No automatic retries or loops."* |
| `duplicate-booking-guard.mjs` L182–184 | `createAttempt()` requires `userConfirmed === true` — returns blocked result otherwise. |
| `stitchcheck-atlas-live-disclosure.md` §2.2 | *"No book, create_booking, reserve, ticket, issue, pay, purchase, verify, cancel, change, refund, order, or equivalent mutation was executed."* |
| `stitchcheck-nosana-approval-packet.md` §10 | *"No paid Nosana workload was submitted during the creation of this document."* |
| Grep for booking keywords in `app/src/` | No `fetch`, `XMLHttpRequest`, `axios`, or network primitive found in any component file. All data flows through local fixture imports. |

### Conclusion

No booking, payment, ticketing, or write operation is reachable from any UI handler, adapter, or smoke-test entry point. Forbidden operations are explicitly enumerated and rejected. All action buttons in error/unavailable states are disabled. The decision panel is a local-only Keep/Switch choice with no external side effect.

---

## Summary Matrix

| # | Verification point | Verdict | Key mechanism |
|---|-------------------|---------|---------------|
| 1 | Synthetic demo data contains no real PII | **PASS** | Invented codes (AAA/BBB/CCC), `syntheticDemo: true`, `nonPiiDeclaration: true`, recursive PII-key scanner |
| 2 | Raw screenshots are not sent to Nosana | **PASS** | Screenshots → OpenRouter only; Nosana receives structured itinerary fields only |
| 3 | No credentials or tokens enter logs/results | **PASS** | Keys used in-memory only; error sanitization regexes; no credential in result JSON |
| 4 | Risk payload contains only sanitized itinerary features | **PASS** | Airport codes + connection duration only; PII-key scan rejects personal fields |
| 5 | Atlas Search/Verify evidence is sanitized | **PASS** | Frozen normalization strips internal fields; adapter disabled by default; 5 prerequisites |
| 6 | UI labels distinguish synthetic, fallback, and live evidence | **PASS** | 5 distinct label constants; conditional rendering by `evidenceSource`/`fallbackUsed` |
| 7 | No booking/payment/ticketing write is reachable | **PASS** | Forbidden-operations blocklist; disabled buttons; no network primitives in UI |

---

## Footer

- **Created:** 2026-08-21
- **Author:** Privacy-boundary audit
- **Review status:** Final
- **No provider was called. No application code was edited. No `.env.local`, credential, final media, deck asset, or provider integration was touched.**
- **No existing file was modified.**
