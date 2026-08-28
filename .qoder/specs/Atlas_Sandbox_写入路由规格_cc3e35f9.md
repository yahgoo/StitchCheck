# StitchCheck — Real Atlas Sandbox Order / Pay / Status Routes Specification

This is a **planning-only deliverable** (Spec Mode). Implementation must not start until the approval gates in Section 22 pass. It is forbidden to execute `order create` / `order pay` or any write command, and forbidden to read `.env.local` contents at any stage.

---

## 1. Executive Summary

On top of the existing default-deny read-only proxy, add a dedicated namespace `/api/atlas/sandbox/*` with exactly five dedicated routes (capabilities / confirm-intent / order / pay / status). All new logic lives in one new server module `app/server/atlas-sandbox-writes.mjs`; the security-critical [atlas-proxy.mjs](file:///Users/kmsum/Downloads/Gemini%20Hackathon%20-%20Daytona%20HackSprint%20-%20Alibaba%20x%20Atlas%20Travel/app/server/atlas-proxy.mjs) receives only ~20 purely additive lines. Write capability is off by default (kill switch `ATLAS_SANDBOX_WRITES_ENABLED=false`); execution requires passing 7 layered gates; passenger and payment data are entirely server-owned (fixed synthetic profile); the payment confirmation id never leaves the server; Order/Pay CLI calls have zero retries; idempotency keys + in-flight locks + paid-order index provide triple duplicate prevention; polling (not webhooks) is the sole source of truth for ticketing status.

**Leader-verified architecture facts:**
- Proxy L27–38: `BLOCKED_PATHS` (exact set: `/api/atlas/order`, `/booking`, `/reservation`, `/payment`, `/ticket`, `/cancel`, `/refund`) and `ALLOWED_ROUTES` (search/verify only); L356 default-denies every unknown path.
- L361–373: existing two gates `DATA_MODE=live`, `ATLAS_LIVE_READ_ONLY=true`; `ATLAS_WRITES_ENABLED` / `ATLAS_TICKETING_SIMULATION_ENABLED` are not read by the proxy today (only by core/orchestrator).
- [vite.config.ts](file:///Users/kmsum/Downloads/Gemini%20Hackathon%20-%20Daytona%20HackSprint%20-%20Alibaba%20x%20Atlas%20Travel/app/vite.config.ts) injects only `__DATA_MODE__` into the browser bundle; has no `proxy:` field (tests assert none may be added).
- [labels.ts](file:///Users/kmsum/Downloads/Gemini%20Hackathon%20-%20Daytona%20HackSprint%20-%20Alibaba%20x%20Atlas%20Travel/core/provenance/labels.ts) `FINAL_STATEMENT` (L146) and header comment (L8) are asserted by banned-words tests — additive-only changes allowed.
- CLI `atlas-flight 0.3.12` installed: `order create --booking-id` (required) + `--passengers-stdin`, `order pay --confirmation-id` (required), `order status --order-no`, all with `--json`.

## 2. Current Architecture and Exact Integration Points

| File | Current behavior | Integration point |
|---|---|---|
| `app/server/atlas-proxy.mjs` | Default-deny dispatcher; `execCli`/`sanitizeResponse`/`sanitizeError`/`sendJson`/`readBody` are module-private | Export those 5 helpers (pure additive); insert a `SANDBOX_ROUTES` exact-set dispatch between the `BLOCKED_PATHS` check (after L353) and the `ALLOWED_ROUTES` check (L356). New paths start with `/api/atlas/sandbox/` and collide with neither exact set |
| `app/vite.config.ts` | Manually parses `.env.local` into `process.env`; injects only `__DATA_MODE__` | Add one boolean `__ATLAS_SANDBOX_WRITES__` to `define` (compile-time UI switch, secondary defense) |
| `app/src/atlas/client.ts` | `atlasSearch`/`atlasVerify` + `AtlasClientError(code,message,httpStatus)` | Clone the same fetch pattern; add 5 new functions |
| `app/src/atlas/types.ts` | `AtlasVerifyResponse.data.booking_id` already typed (L63) | Add sandbox request/response envelope types |
| `app/src/atlas/adapter.ts` | `mapVerifyResponse` (L160–196) currently **drops** `booking_id`/`travelers` | Extend `VerifySummary` with `bookingId?`, `travelers?` passthrough (additive) |
| `app/src/App.tsx` | `AppStep: welcome→trip→risk→options→done`; live branch L117–173; default terminal safety sentences L721–723/750–755/780 | Render the new panel on the options screen only when Verify succeeded with `bookingId` AND both switches are on; default flow byte-for-byte unchanged |
| `core/provenance/labels.ts` | `getAtlasLabel` selects by evidenceSource | Add `atlas-sandbox-writes` branch label + `SANDBOX_WRITE_DISCLOSURE`; keep `FINAL_STATEMENT` and default labels verbatim |
| `core/safety/gates.ts` | `validateOperationPermission` forbids `order`/`pay` (local adapter vocabulary) | **Do not modify**; the sandbox route layer is a separate explicit boundary with its own pure-function gate module |
| `core/simulation/ticketing.ts` | Local offline simulation; `canEnableSimulation` requires writes=false | **Do not modify**; the real sandbox branch is mutually exclusive with it (simulation must be off to avoid two competing ticketing UIs) |
| Test contracts | `smoke-tests/atlas/atlas-live-proxy-tests.mjs` imports the middleware directly and asserts 404/403/405; `atlas-proxy-allowlist-tests.mjs` uses its own frozen reference table (does not import the proxy); `live-mode-banned-words-tests.mjs` scans all `app/src` component sources | New paths are outside all tested path sets → stay green; new component copy must avoid banned phrases |

## 3. Route Contract (all POST, JSON, no generic forwarding)

All routes share the gate chain (Section 4); any failure returns 403/401/400/409 with a machine-readable `error` code.

### 3.1 `POST /api/atlas/sandbox/capabilities` (read-only)
- Request: `{}`; Response: `{ sandboxWritesEnabled: boolean, environment: 'sandbox'|'other' }`.
- Purpose: runtime single source of truth for UI branch visibility (kill switch propagates without restart). Contains no secrets.

### 3.2 `POST /api/atlas/sandbox/confirm-intent`
- Request: `{ operation: 'order'|'pay', bindingRef }` (bindingRef = bookingId or orderNo).
- Response: `{ confirmationToken, expiresInSeconds: 120 }`.
- Token design: `crypto.randomBytes(32).toString('hex')`; server-side `Map<token,{operation, bindingRef, nonce, issuedAt, ttl:120s, used:false}>`; **short-lived (120s), single-use, bound to operation+subject fingerprint**; deleted immediately on use; lazy expiry sweep; map capped at 100 entries with FIFO eviction; issuance rate-limited to 10/min. An order token cannot pay (operation binding prevents cross-use). The UI requests a token only at the instant the human clicks the confirmation dialog — the server never trusts a UI checkbox alone.
- Invalidation (stale-Verify): any new sandbox search context or `OFFER_EXPIRED`/`PRICE_CHANGED` event clears all unused tokens.

### 3.3 `POST /api/atlas/sandbox/order`
- Request: `{ bookingId, travelers:[{traveler_id,passenger_type}], confirmationToken, idempotencyKey }`.
- Forbidden fields: presence of keys like `name/birthday/document/email/mobile/card/pan/cvv/payment/passengers` → 400 `browser_supplied_data_rejected`.
- Execution: `execFile('atlas-flight', ['order','create','--booking-id',bookingId,'--passengers-stdin','--json'])`; passenger JSON written once via `child.stdin` then closed (**never** in argv, logs, or evidence); write-call timeout raised to 20s; **zero retries** (upstream is non-idempotent).
- Success response: `{ orderNo, code:'PAYMENT_CONFIRMATION_REQUIRED', paymentSummary:{currency,total,deadline}, nextAction:'pay', timestamp }`; `payment_confirmation_id` stored server-side only (keyed by orderNo) and **never sent to the browser**.
- Defensive field extraction: `data.order_no|data.orderNo`; confirmation id `data.payment_confirmation_id|data.confirmation_id|data.pay_confirmation_id` (exact key locked after the first supervised live rehearsal, see Section 22).
- Special codes: `DUPLICATE_BOOKING_SUSPECTED` → adopt the returned existing order number as orderNo (reuse, do not recreate); timeout/`ORDER_CREATION_UNKNOWN` → `outcome:'unknown', requires_reconciliation:true`; UI may only query status, never recreate.

### 3.4 `POST /api/atlas/sandbox/pay`
- Request: `{ orderNo, confirmationToken, idempotencyKey }` (the browser never holds the confirmation-id).
- Execution: `['order','pay','--confirmation-id',<server-held id>,'--json']`, **exactly once, zero retries**. The confirmation-id is marked consumed **before** the CLI call.
- Duplicate suppression: paid index `Map<orderNo,{paid,payKey}>`; any second pay for the same orderNo (regardless of prior outcome) → 409 `payment_duplicate_suppressed`, or replay of the completed response with `duplicate:true`.
- Timeout/`PAYMENT_STATUS_UNKNOWN`/`PAYMENT_PROCESSING` → `nextAction:'poll-status'`; a subsequent same-key request reconciles by reading `order status` instead of re-paying; any fresh pay attempt requires a new human-confirmed token.
- `PAYMENT_BALANCE_CHECK_REQUIRED` → surfaced as 200 + code, rendered as a safe stop; re-pay forbidden.

### 3.5 `POST /api/atlas/sandbox/status`
- Request: `{ orderNo }`; no token required (read-only).
- Execution: `['order','status','--order-no',orderNo,'--json']`; the one-retry `execCliWithRetry` is permitted (reads are safe); **single-flight** per orderNo merges concurrent requests into one CLI invocation.
- Response: `{ orderNo, status:'unpaid'|'ticketing'|'ticketed-simulated'|'cancelled'|'unknown', cliCode, rawCode?, terminal:boolean, timestamp }`.
- Status decisions branch on the CLI named `code` as the authority; the numeric mapping `0=unpaid / 1=ticketing / 2=ticketed-simulated / -3=cancelled` is an **unverified provisional constant** isolated in one constant (no repo documentation supports the numeric semantics); unknown values always yield `terminal:false, status:'unknown'`.
- `ticketed` must only ever render as a Sandbox simulation result — never as a real issued ticket.

## 4. Environment and Credential Gates (evaluated in order; any failure rejects)

1. **Kill switch**: `env.ATLAS_SANDBOX_WRITES_ENABLED === 'true'`, else 403 `sandbox_writes_disabled` (read per request; no restart needed).
2. **Environment gate**: `DATA_MODE==='live'` AND `ATLAS_LIVE_READ_ONLY==='true'` AND `ATLAS_ENVIRONMENT==='sandbox'`, else 403.
3. **Production-write flag exclusion**: `ATLAS_WRITES_ENABLED !== 'true'` must hold (the sandbox path never enables the legacy write flag; preserves `assertWriteBlocked` invariants).
4. **Sandbox URL gate**: if `ATLAS_SANDBOX_BASE_URL` is set it must strictly equal `https://sandbox.atriptech.com/`, else 403 `non_sandbox_base_url`; additionally, before every write CLI call run `['environment','use','sandbox','--json']` and require a success code (`ENVIRONMENT_SWITCHED|CONFIGURATION_UPDATED` or already-sandbox). CLI credentials live in the OS keyring and are not inspectable, so the assertion is the environment-selection result code plus the documented URL. The write module **never** executes `environment use production`.
5. **Credential gate**: request bodies containing `environment/profile/clientId/clientSecret/authorization/baseUrl`-style fields → 400; credentials flow only through the CLI/keyring and never appear in requests, responses, logs, or evidence.
6. **Route gate**: only the five exact paths; `/api/atlas/search` and `/api/atlas/verify` remain read-only and unchanged; `BLOCKED_PATHS` and default-deny semantics unchanged.
7. **Input gate**: see Section 7 synthetic data policy.

## 5. State-Machine Design

Default flow (unchanged): `searching → search-complete → verifying → verified → read-only-request-submitted` (RecoveryPlanAnimation terminal state "Request submitted — awaiting verified supplier outcome", `verifiedOutcome !== null` guard preserved).

Sandbox branch (rendered only when `__ATLAS_SANDBOX_WRITES__==='true'` && `DATA_MODE==='live'` && runtime capabilities is true && Verify succeeded with `bookingId`; pure functions in new file `core/simulation/sandbox-order-states.ts`):

```
hidden → opt-in (explicit toggle + acknowledgement checkbox) → order-review (synthetic passenger/itinerary preview)
→ order-submitting → order-created-unpaid
→ payment-review → payment-submitting → pay-accepted
→ status-polling → ticketed-simulated | cancelled (terminal)
Error states: gate-rejected(403) | cli-error(502+code) | unknown-create | unknown-pay
→ safely-stopped ("Result unknown — do not resubmit"; only status checks allowed)
```

- Allowed/forbidden transitions defined centrally by a pure `canTransition(from,event)`; no transition from error/unknown states back to submitting without a fresh human confirmation (new token + new idempotency key).
- **Refresh/reload recovery**: `{orderNo, state}` persisted to sessionStorage (sandbox order numbers are test data — acceptable); on mount with an orderNo, call `/status` once to resync before resuming polling. No server-side background timers; server restart is transparent (status is stateless by orderNo).
- **Timeout recovery**: write timeout → `safely-stopped` + guidance to check status; poll budget exhausted → terminal banner + "Check status later" button (manual re-check allowed).
- **New confirmation token required**: every order, every pay, and any new attempt after an unknown outcome.
- **New idempotency key required**: only for a genuinely new attempt; UI retries of the same attempt keep the key.
- **Stale-Verify invalidation**: a re-Verify returning `OFFER_EXPIRED/PRICE_CHANGED` or a new search resets the branch to hidden/opt-in and the server drops all unused tokens.
- The normal app never enters the Sandbox branch merely because `DATA_MODE=live` (write switch + explicit opt-in also required).

## 6. Confirmation UX and Copy (all banned-word compliant)

Banned phrases (asserted by banned-words tests): "Booked", "Booking confirmed/completed", "Switched", "Ticket issued/confirmed", "Payment completed/confirmed/processed/successful".

| Scenario | Copy |
|---|---|
| Opt-in toggle | "Atlas Sandbox rehearsal (test data only)" + checkbox "I understand this is a sandbox test: no real booking, no real charge, no airline ticket." |
| Order confirmation dialog | "Create sandbox test order? Atlas Sandbox test only. No real booking will be created. Synthetic passenger TEST/TRAVELER." |
| Pay confirmation dialog | "Submit sandbox payment request? No real charge will be made. Sandbox balance only." |
| Polling | "Order request submitted — awaiting sandbox outcome (test data)." |
| Simulated completion | "Sandbox status: TICKETED (simulated test data — no production ticket, no real money). No airline ticket was issued." |
| Cancelled terminal | "Sandbox order cancelled (test environment)." |
| Timeout/unknown | "Result unknown — do not resubmit. Check status below." |
| Gate rejection (403) | "Sandbox writes are disabled or not permitted in this environment." |
| Offer expired | "Offer expired — run a fresh Search/Verify before trying again." |
| Price changed | "Price changed since verification — review required before any order." |
| Duplicate submission | "Duplicate submission suppressed — no second request was sent." |
| Reset | "Reset sandbox rehearsal" (extend `handleRestart`: clear sandbox state + abort polling) |

Layout: desktop — a distinct card under the Verify result block on the options screen with a permanent footnote "Sandbox only — synthetic passenger — no real payment or production ticket"; mobile — vertical stack, full-width buttons, modal confirmation dialogs. Existing safety sentences in `app/src/App.tsx` (L721–723, L750–755, L780) and the mandatory AlternativesPanel phrase remain verbatim.

## 7. Synthetic Test-Data Policy

- **Location**: a single server-owned constant `SYNTHETIC_PASSENGER` inside `app/server/atlas-sandbox-writes.mjs` (one fictional adult: `TEST/TRAVELER`, M, 1990-01-01, nationality JP, document type PP + fixed synthetic document number; contact `test@example.com` / `+0000000000`).
- **Tamper-proofing**: any passenger/payment field in the browser request → 400 rejection; the payload is built server-side from the constant plus validated `traveler_id`/`passenger_type` (sourced from Verify's `data.travelers`; `traveler_id` an opaque string ≤128 chars), delivered via stdin, never written to a temp file.
- **Log redaction**: the stdin payload is never written to responses/logs/evidence; extend `sanitizeResponse` with PAN (`\b(?:\d[ -]?){13,19}\b`), CVV, and document-number regexes.
- **Negative-test profiles** (`Reject`/`Three DS`): not implemented this phase; leave a TODO beside the constant; future selection mechanism replaces the constant with an enum, still behind human confirmation.
- **Payment data**: CLI `order pay` accepts only `--confirmation-id`, indicating sandbox balance payment with no card input; therefore test card values are **never stored or persisted**; full PAN/CVV never enters memory (if the rehearsal reveals card input is required, this item becomes BLOCKED pending approval).
- ⚠️ Exact stdin JSON field names (given_name/surname etc.) come from the Skill's `passenger-input.md`, which has no machine-readable local copy → **BLOCKED item**; isolated in the single constant so a one-line fix suffices after the first supervised rehearsal.

## 8. Idempotency and Duplicate Prevention

- Client: `idempotencyKey = crypto.randomUUID()`, generated once per logical attempt and kept in component state; UI retries reuse the same key; buttons disabled while submitting.
- Server: `Map<key,{state:'in-flight'|'completed'|'failed'|'unknown', response, orderNo, createdAt, ttl:30min}>`; same key in-flight → 409 `in_flight`; completed → replay the stored result (`replayed:true`, CLI never re-invoked); lazy expiry sweep + interval prune (unref'd).
- Operation binding: records carry the operation; key reuse across operations → 400.
- **Pay-specific**: the paid index suppresses any second pay per orderNo; confirmation-id marked consumed pre-flight; after a `pay.do` timeout there is **never** an automatic retry — a same-key follow-up reconciles via status instead (explicitly addressing the pay.do retry risk).
- Poll single-flight: `Map<orderNo, Promise>` merges concurrent `/status` calls.

## 9. Server-Side Implementation Design

New file `app/server/atlas-sandbox-writes.mjs`: exports `createSandboxWriteHandler(env, execCliImpl = execCli)` (second arg is the test-injection seam). Internal structure: gate-chain function → token store → idempotency store → paid index → synthetic passenger constant → five handlers → evidence writer. Node built-ins only (`node:crypto`, `node:child_process`); zero new dependencies. Changes to `atlas-proxy.mjs`: export the 5 helpers (pure additive) + header comment update + ~15 lines of `SANDBOX_ROUTES` dispatch (placed after the BLOCKED_PATHS check and before the ALLOWED_ROUTES check, reusing the same `.catch(500 sanitizeError)` wrapper pattern).

## 10. Browser/Client Implementation Design

- `types.ts`/`client.ts`: sandbox envelope types and 5 fetch functions (clone the `atlasVerify` pattern + `AtlasClientError`).
- `adapter.ts`: `mapVerifyResponse` passes through `bookingId`/`travelers` (additive fields).
- `app/src/components/SandboxOrderPanel.tsx` (new): reducer-driven Section 5 state machine; conditional rendering (else `null`); `AbortController` guarantees a single outstanding request and abort-on-unmount.
- `app/src/App.tsx`: mount the panel + extend `handleRestart` to reset sandbox state; everything else verbatim.
- `app/src/vite-env.d.ts`: declare `__ATLAS_SANDBOX_WRITES__`.

## 11. Order-Status Polling Design

Client-paced (no server background timers): first poll +3s, then ×1.5 exponential backoff with ±20% jitter capped at 10s; total budget 120s and max ~12 requests; abort on terminal status, unmount, or reset (AbortController); budget exhausted → `safely-stopped` + manual "Check status later". Terminal mapping: `TICKETED → ticketed-simulated`, `ORDER_CANCELLED → cancelled`; `PAYMENT_BALANCE_CHECK_REQUIRED → payment-blocked` (never re-pay). Every poll is evidenced with correlationId (=searchId) + orderNo linkage. Polling is read-only and requires no new confirmation token.

## 12. Webhook Decision

**No webhook.** Rationale: the local Vite dev server has no public ingress/TLS; the CLI exposes no inbound webhook surface; `order status` is the documented source of truth; polling cost (≤12 requests/order) is negligible. If added later: HMAC signature validation + event-id dedupe for replay protection + event allowlist `{order.ticketed, order.cancelled}` + payload sanitization + correlation by orderNo — the reserved seam is the idempotency/state store interface.

## 13. Sanitization and Evidence Schema

Append-only JSONL: `output/atlas-sandbox-evidence/<UTC-date>.jsonl` (`output/` already gitignored), one line per operation:

```json
{ "envelopeVersion": 1, "correlationId": "<searchId>", "orderNo": "<opaque>",
  "operation": "order|pay|status|confirm-intent", "environment": "sandbox",
  "route": "/api/atlas/sandbox/order", "idempotencyKeyHash": "sha256:<12-char prefix>",
  "providerResponseCode": "PAYMENT_CONFIRMATION_REQUIRED", "outcome": "created|paid|duplicate|unknown|error|gate_blocked",
  "orderStatusCode": null, "terminal": false, "latencyMs": 0,
  "gateEvaluation": ["kill_switch:ok","environment:ok","token:ok","idempotency:ok"],
  "timestamp": "ISO", "noRealBooking": true, "noRealCharge": true, "noAirlineTicketIssued": true }
```

**Never recorded**: client id/secret, authorization headers, confirmation tokens/confirmation-ids (sha256 prefix only), full PAN, CVV, document numbers, the passenger stdin payload, raw upstream responses in full, full CLI stderr (truncated via `sanitizeError`, 500 chars). Redaction: reuse the existing 5 regexes + add PAN/CVV/document/token regexes; all URLs become `[REDACTED]`.

## 14. Error Handling and Recovery

- Branch exclusively on CLI `code`, never on `message`; `retryable=true` never authorizes a second order/pay.
- 502 carries upstream codes (`OFFER_EXPIRED`, `PASSENGER_INFO_INVALID`, `TICKETING_ACTIVATION_REQUIRED`, etc.); 403 for gate rejections; 409 for duplicate prevention; 400 for validation/forbidden fields.
- Unknown outcomes uniformly become `safely-stopped` + reconciliation guidance; credential/config errors surface as 502 with sanitized messaging and never echo credentials.
- Recovery matrix: ambiguous Order → query status; Pay timeout → poll only, never re-pay; unreconcilable status → kill switch + manual review; suspected credential mixing → kill switch immediately.

## 15. Security and Privacy Controls Summary

execFile with argument arrays (no shell); passengers via stdin; zero write retries; single-use operation-bound tokens; server-held confirmation-id; server-owned synthetic profile; hashed evidence; banned-word-safe copy; `.env.local` read only by the existing server-side vite loader — this spec and the implementation never read its contents.

## 16. Test Plan (specified before implementation; all offline, no network imports, no URL literals in test sources)

**New `smoke-tests/atlas-sandbox-write-gate-tests.mjs`** (imports `createAtlasProxyMiddleware`; mock `execCli` injection):
1. Unit/gates: kill switch false → all write routes 403; `ATLAS_ENVIRONMENT≠sandbox` → 403; `ATLAS_WRITES_ENABLED=true` → refused; non-sandbox base URL → 403; regression re-assertion of default-deny and the 7 BLOCKED_PATHS; search/verify unchanged across every env combination.
2. Tokens: single-use, 120s expiry, operation/bindingRef binding, cross-operation misuse rejected, replay rejected.
3. Idempotency: same key in-flight → 409; completed replay (assert CLI not re-invoked); duplicate pay suppressed (N retries invoke the pay CLI exactly once); key-expiry handling.
4. Inputs: browser-supplied `passengers/card/name` → 400; oversized `traveler_id` → 400.
5. Integration (mocked CLI envelopes): full Search→Verify→Order→Pay→Status success chain; `PRICE_CONFIRMATION_REQUIRED`; `OFFER_EXPIRED`; invalid bookingId; order creation failure; `PAYMENT_BALANCE_CHECK_REQUIRED`; 3DS-style rejection; pay timeout → poll-only; duplicate pay; polling timeout; `ORDER_CANCELLED`; malformed upstream response; upstream config error.
6. Zero-retry assertion: capture CLI invocation counts; order/pay ≤1 per request.
7. Evidence redaction assertion: records contain no URL/email/Bearer/sk-/PAN/passenger payload.
8. State-machine unit tests (`sandbox-order-states.ts` transition table + terminal codes + unknown numeric handling).

**Browser verification**: flag off → panel invisible + routes 403; flag on → explicit opt-in, Order and Pay each require separate confirmation, no write request fires before confirmation (network-panel check), no real-data input controls, Sandbox copy present in every write state, refresh recovery, double-click prevention, terminal status display, no bare production wording.

**Regression**: re-run `atlas-live-proxy-tests.mjs`, `atlas-proxy-allowlist-tests.mjs`, `live-mode-banned-words-tests.mjs`; append the new test file to the `app/package.json` `verify:offline` chain.

## 17. Manual Verification Plan (requires explicit approval before execution)

Preflight (never print secret values): `ATLAS_ENVIRONMENT=sandbox`, `ATLAS_SANDBOX_WRITES_ENABLED=true`, `ATLAS_LIVE_READ_ONLY=true`, `DATA_MODE=live`, CLI environment selection returns sandbox, ATRIP ticketing activation confirmed. Use the documented JKT→DPS route, the synthetic passenger, and a fresh verified offer; separate human approval before Order and before Pay; record sanitized evidence only. Final verification: no production endpoint contacted; no real booking/charge/ticket; no secrets in evidence; `ATLAS_SANDBOX_WRITES_ENABLED=false` disables all write routes with one flag.

## 18. Rollback and Kill Switch

- **Kill switch**: `ATLAS_SANDBOX_WRITES_ENABLED=false` → write routes return 403 immediately (env read per request, no restart); capabilities returns false → UI branch hides on next fetch; Search/Verify and offline simulation unaffected; any in-flight state renders as safely-stopped and is never falsely presented as completed.
- Compile-time second layer: the `__ATLAS_SANDBOX_WRITES__` define uses the same evaluation.
- Full rollback = revert ~20 additive lines in `atlas-proxy.mjs` + delete the new files (they are decoupled, with no invasive coupling).

## 19–21. File Ledger

**Modify** (all additive): `app/server/atlas-proxy.mjs` (helper exports + dispatch + comments), `app/vite.config.ts` (one define line), `app/src/atlas/client.ts`, `app/src/atlas/types.ts`, `app/src/atlas/adapter.ts` (bookingId passthrough), `app/src/App.tsx` (mount + restart reset), `app/src/vite-env.d.ts`, `core/provenance/labels.ts` (additive labels), `.env.example` (names only: `ATLAS_ENVIRONMENT=sandbox`, `ATLAS_SANDBOX_WRITES_ENABLED=false`, `ATLAS_SANDBOX_BASE_URL=https://sandbox.atriptech.com/`), `app/package.json` (verify:offline chain).

**New files** (each justified): `app/server/atlas-sandbox-writes.mjs` (security core: gates/tokens/idempotency/handlers/evidence), `core/simulation/sandbox-order-states.ts` (pure state machine, offline-testable, mirrors the ticketing.ts pattern), `app/src/components/SandboxOrderPanel.tsx` (opt-in UI branch), `smoke-tests/atlas-sandbox-write-gate-tests.mjs` (all Section 16 assertions).

**Must not modify**: `.env.local` (never read), `core/safety/gates.ts`, `core/simulation/ticketing.ts`, `scripts/atlas-orchestrator.mjs`, `RecoveryPlanAnimation.tsx`, `AlternativesPanel.tsx`, `SafetyNotice.tsx`, `DecisionPanel.tsx`, all existing smoke-test files, all video/narration/subtitle/SRT/Keynote/PPTX/PDF presentation files, existing `output/` artifacts, `.rollback-*` directories.

## 22. Approval Gates

| Gate | Status |
|---|---|
| CLI identifier mapping (booking-id ← verify booking_id; confirmation-id ← create response) | Command-level confirmed; **exact create-response field name BLOCKED** (defensive multi-key extraction + first-rehearsal lock) |
| Exact Sandbox URL `https://sandbox.atriptech.com/` | Confirmed (documented + environment-selection result-code assertion) |
| Sandbox credential isolation (keyring; production-flag exclusion) | Confirmed |
| Order/Pay/Status request and response schemas | Confirmed (response field names use defensive extraction, see above) |
| Synthetic passenger stdin exact field names | **BLOCKED — pending first supervised rehearsal** |
| Numeric status codes 0/1/2/-3 semantics | **BLOCKED — no documentation supports them; named codes are authoritative** |
| Sandbox payment method (balance vs test card) | Pending rehearsal confirmation (current CLI shape indicates no card input) |
| Confirmation-token / idempotency / evidence design | Pending approval |
| Webhook decision (none) | Pending approval |
| Manual write test (Section 17) | **Requires explicit approval before execution** |
| Production-write protection / rollback kill switch | Design verified (default-deny + 7 gates + kill switch) |
| ATRIP ticketing activation | **BLOCKED — requires human action in the ATRIP workspace** |

Until a BLOCKED item is resolved, the implementation parts depending on it are marked `BLOCKED — DO NOT IMPLEMENT`; gates/stores/UI scaffolding that do not depend on blocked items may proceed first.

## 23. Implementation Sequence

1. `.env.example` variable names + `vite.config.ts` define + `vite-env.d.ts` (deps: none)
2. `core/simulation/sandbox-order-states.ts` + its unit tests (deps: none)
3. `atlas-proxy.mjs` helper exports and SANDBOX_ROUTES dispatch skeleton (deps: 1)
4. `app/server/atlas-sandbox-writes.mjs` full implementation (deps: 2, 3; passenger constant is a placeholder with comments)
5. `types.ts`/`client.ts`/`adapter.ts` (deps: contract from 4)
6. `SandboxOrderPanel.tsx` + `App.tsx` mount + `labels.ts` additions (deps: 5)
7. `smoke-tests/atlas-sandbox-write-gate-tests.mjs` + verify:offline wiring + full regression run (deps: 3–6)
8. Supervised rehearsal to unblock BLOCKED items (deps: human approval + ticketing activation) → lock field names/numeric mapping → re-run tests
9. Manual verification (Section 17, deps: 8)

## 24. Final Safety Checklist

- [ ] Default flow byte-for-byte unchanged; `FINAL_STATEMENT` and existing safety sentences verbatim
- [ ] Write routes 403 by default; kill switch effective in real time
- [ ] Order/Pay zero retries; pay protected by quadruple defense (token + idempotency + paid index + confirmation-id pre-consumption)
- [ ] Browser never holds credentials/confirmation-id/passenger data; forbidden fields rejected
- [ ] Evidence contains no PAN/CVV/document numbers/tokens/credentials; sha256 prefixes only
- [ ] Every sandbox write state in the UI carries Sandbox/test/simulated qualifiers; no banned words
- [ ] `environment use production` never appears in the write module
- [ ] All three existing contract test suites stay green; new tests are offline, network-free, URL-literal-free
- [ ] Zero changes to videos/presentation/subtitle files

## Rejected Alternatives

1. **Inlining write handlers into `atlas-proxy.mjs`**: too large a diff to the security-critical file, which is directly imported and asserted by `atlas-live-proxy-tests.mjs`; a separate module shrinks the regression surface to ~20 additive lines.
2. **Reusing/loosening `FORBIDDEN_OPERATIONS` in `core/safety/gates.ts`**: would break existing offline test assertions and the global "writes forbidden" invariant; a separate additive gate module keeps the file untouched.
3. **HMAC-signed confirmation tokens (self-signed JWT style)**: short TTL + single-use + in-memory Map gives equivalent replay protection more simply, without key management.
4. **Server-side background poller**: introduces leaked-timer and restart state-loss risk; client-paced polling with server single-flight is simpler and restart-transparent.
5. **Persistent idempotency store (file/DB)**: in-memory suffices for local dev; `/status` being stateless by orderNo makes restart re-attachable; the store interface reserves a future swap seam.
6. **Webhook receiver route**: no public ingress locally and no way to safely authenticate/test it; polling is the documented source of truth.
7. **Treating numeric status codes 0/1/2/-3 as the authoritative branch**: neither the repo nor CLI help documents those semantics — that would be inventing a mapping; named codes are authoritative, numeric mapping isolated and pending verification.
8. **Compile-time define as the sole UI switch**: changing env would require a dev-server restart; the runtime capabilities endpoint is primary with the define as a second layer.