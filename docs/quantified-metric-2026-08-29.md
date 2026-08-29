# Quantified Atlas fare-drift metric (2026-08-29)

## The metric

> The single price-verified fare (`off_11db11bad81302c295da16f1`) moved **$64.38 → $203.99, +217%**, between Search and Verify.

## Why this matters

A fare that looked current at search time had already drifted by the time we asked Atlas to
confirm it. The traveller's "self-transfer connection" bet was priced on a number that no
longer held — exactly the unpriced risk StitchCheck surfaces.

## Traceability

- **Source file:** `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json`
- **Offer ID:** `off_11db11bad81302c295da16f1` (KUL → SIN, `OD807`, 2026-09-15)
- **Search step:** `total_price` = `64.38` (`price_status: "current"`)
- **Verify step:** `responseCode` = `PRICE_CONFIRMATION_REQUIRED`,
  `previous_price` = `64.38`, `current_price` = `203.99`, `price_change` = `"increased"`
- **Math:** (203.99 − 64.38) / 64.38 = 2.169 → **+217%** (rounded)
- **Hard stop recorded:** `AFTER_VERIFY — no Order, Payment, Ticketing, or any write`
  (`hardStopReached: true`, `result: "PARTIAL_SUCCESS"`)

## Note on the "1 of 3" phrasing (do not use it)

**Only ONE offer was price-verified in this evidence capture.** The `verify` step was run a
single time, against `off_11db11bad81302c295da16f1`. The `offer_count: 20` figure in this
file refers to the number of offers returned by the **search** step, **not** to the number of
verify calls. An earlier research note described this as "1 of 3" fares verified; that was
incorrect. The honest framing is: one search, one verify, one confirmed fare-drift event of
+217%.
