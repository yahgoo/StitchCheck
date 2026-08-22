# StitchCheck Live Provider Demo — Summary

**Generated:** 2026-08-21T05:37:31Z
**Directory:** `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/`

---

## Provider Results

| Provider | Test ID | Status | Reached Provider | One Attempt |
|----------|---------|--------|-----------------|-------------|
| Gemini (via OpenRouter) | GEM-LIVE-01 | **LIVE** — extraction success | Yes | Yes (1 network call) |
| Nosana | NOS-LIVE-01 | **BLOCKED** — no live transport | No | No (blocked before submission) |
| Atlas | ATL-LIVE-01 | **LIVE SEARCH** — production, 8 offers | Yes | Yes (1 search request) |

---

## Live-Demo Display Labels

- **`LIVE — OpenRouter Gemini extraction`** — GEM-LIVE-01 succeeded. Label: `OpenRouter temporary path — not direct Gemini validation`.
- **`BLOCKED — Nosana`** — No live transport, SDK, credential, or workload definition exists. Offline-only client boundary enforced.
- **`LIVE SEARCH — Atlas production`** — ATL-LIVE-01 returned 8 real production offers. All `price_status: reference`, `bookable: false`. Ticketing blocked (`TICKETING_ACTIVATION_REQUIRED`).
- **`NOT LIVE — local placeholder`** — Nosana risk data and Atlas alternatives in the local app remain synthetic placeholders.

---

## Sanitized Metrics

### Gemini (GEM-LIVE-01)
- Model: `google/gemini-3.7-flash` via OpenRouter
- Latency: 2,946 ms
- Extraction: success, 0 missing fields, 7 fields per leg
- Validation: valid schema
- Confirmation gate: `requiresUserConfirmation: true`, `pending_user_review`

### Nosana (NOS-LIVE-01)
- Spend: $0.00 (no workload submitted)
- Blocker: No live transport, SDK, credential, cost estimator, or environment configuration exists

### Atlas (ATL-LIVE-01)
- Environment: Production (no Sandbox switch command in CLI v0.3.12)
- Search: SIN → BKK, 2026-09-10, 1 adult
- Offers: 8 (all reference prices, not bookable)
- Ticketing: blocked (`TICKETING_ACTIVATION_REQUIRED`)

---

## Safety Verification

- No credentials exposed in any artifact.
- No production booking, payment, ticket, order, or write action occurred.
- Exactly one attempt per provider (Gemini: 1 network call; Atlas: 1 search; Nosana: 0 — blocked).
- Nosana spend: $0.00 (≤ $10.00 limit).
- No direct Gemini call occurred (OpenRouter temporary path only).
- Atlas environment accurately recorded as production; Sandbox not available.
- All evidence files contain only sanitized metadata and summaries.
