# Atlas Sandbox Writes — Confirmation-Token Rate-Limit Contract (429)

Reference doc for the sandbox-write endpoints implemented in
`app/server/atlas-sandbox-writes.mjs` (items 4–7, branch
`feature/atlas-sandbox-mock-ticketing`, commit `81c6d78`). Recorded 2026-08-29;
facts verified against the implementation, not inferred.

## Contract

Token issuance in `handleConfirmIntent` (`POST` confirm-intent) is rate-limited
to **10 tokens per 60 seconds, per server instance**:

- Window constants: `TOKEN_RATE_WINDOW_MS = 60_000`, `TOKEN_RATE_MAX = 10`
  (`createIssuanceRateLimiter`, sliding window).
- Implementation is **lazy-trimmed**: expired entries are dropped on the next
  `allow()` check. **No timers are created** — an idle server does zero
  background work, and the limiter uses the injected `now()` clock so offline
  tests control time deterministically.

## Behavior on limit

The **11th confirm-intent request within the window** returns:

```json
HTTP 429
{ "error": "token_rate_limited",
  "message": "too many confirmation-token requests; retry after the window elapses" }
```

Only requests that pass the limiter call `rateLimiter.record()`; rejected
requests do not extend the window.

## Scope

This limits **token issuance**, not order/pay/status calls directly. A
confirmation token must be issued before any sandbox write can be attempted,
so the 429 gate is the **outer gate** in front of the write path. Order, pay,
and status endpoints have their own guards (token verification, idempotency,
paid-index 409) and are not separately rate-limited.

## Implication for rehearsal scripts

Anyone scripting a rehearsal or load test against the sandbox-write endpoints
must throttle to **≤ 10 confirm-intent calls per 60 s per server process**, or
expect 429s. Note:

- The limiter is **in-process / in-memory**, not shared or distributed.
  Multiple server instances (e.g. horizontal scaling) each get their own
  independent 60-second window.
- Restarting the server clears the window (no persistence).
- Offline tests inject their own `now()` clock, so the suite can exercise the
  limit deterministically without waiting (see
  `smoke-tests/atlas/sandbox-write-gate-tests.mjs`).

## Known gap (not fixed in this pass)

No `Retry-After` header is currently returned on 429 responses. Clients must
fall back to the "retry after the window elapses" message and back off
manually. Flagged as a known gap; adding the header is a candidate follow-up,
out of scope for the items 4–7 audit pass.
