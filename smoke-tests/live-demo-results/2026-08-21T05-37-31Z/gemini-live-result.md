# GEM-LIVE-01 — Gemini Extraction via OpenRouter

- **Timestamp:** 2026-08-21T05:36:19Z
- **Test ID:** GEM-LIVE-01
- **Route:** OpenRouter (temporary path)
- **Model slug:** `google/gemini-3.7-flash`
- **HTTP status:** 200 (success)
- **Latency:** 2,946 ms
- **Extraction status:** success
- **Schema-validation status:** valid
- **Missing-field count:** 0
- **`requiresUserConfirmation`:** true
- **`confirmationGateStatus`:** pending_user_review
- **First leg fields:** 7
- **Second leg fields:** 7
- **Network calls made:** 1
- **Fixture:** gem-01-two-leg-clean (synthetic, non-PII)

## Exact evidence label

`OpenRouter temporary path — not direct Gemini validation`

## What this proves

- OpenRouter can successfully route a Gemini-structured extraction request and return valid, schema-conformant itinerary data from a synthetic screenshot fixture.
- The extraction contract (origin, destination, date, airline, flight number, departure time, arrival time for both legs) is satisfied.
- The confirmation gate (`requiresUserConfirmation: true`, `pending_user_review`) is preserved.

## What this does not prove

- This is NOT direct Gemini API validation. The request was routed through OpenRouter's temporary path.
- This does not prove extraction accuracy on real-world itineraries.
- This does not prove structured-output capability of the Gemini API directly.
- Direct Gemini remains not executed.

## Sanitized field summary

Both legs returned 7 fields each (origin, destination, departure date, airline, flight number, departure time, arrival time). No fields missing. Connection duration computed. No validation messages.
