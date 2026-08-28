# Gemini Smoke-Test Fixtures (Synthetic Only)

No fixture images exist in this directory yet. This README defines the rules
and the planned fixture set for GEM-01 through GEM-08.

## Mandatory rules
- Every fixture must be fully synthetic. No real passenger names, booking
  references, payment data, loyalty numbers, phone numbers, emails, or real
  travel data of any kind.
- Use invented carriers (e.g. "Demo Air"), invented airport codes (e.g. AAA,
  BBB, CCC), invented dates, and invented prices, consistent with the
  synthetic contracts in `docs/SPECS.md`.
- Fixtures must be reviewed and confirmed PII-free before any harness run.
- Fixtures must never contain secrets, keys, or tokens.

## Planned fixture set (proposed, not yet created)
| Fixture | For Test | Description |
|---|---|---|
| two-leg-clean.png | GEM-01, GEM-08 | Clear synthetic two-leg itinerary screenshot |
| two-leg-missing-optional.png | GEM-02 | Synthetic itinerary with one optional field absent |
| two-leg-fragmented.png | GEM-03 | Difficult/fragmented synthetic layout |
| non-itinerary.png | GEM-04 | Synthetic image that is not a flight itinerary |
| unreadable-field.png | GEM-05 | Synthetic itinerary with one unreadable required field |
| malformed-output case | GEM-06, GEM-07 | Service-side conditions; no extra fixture required |

GEM-08 reuses the GEM-01 fixture plus a user-corrected field.

## Status
PNG fixtures for GEM-01 through GEM-05 now exist in this directory and are
listed in `manifest.json`; GEM-08 reuses the GEM-01 fixture, and GEM-06 and
GEM-07 are service-side conditions that need no fixture. All fixtures are
synthetic by construction and carry the visible watermark
`SYNTHETIC FIXTURE — NOT REAL DATA — NO PII`.

- Only PNG files are used as OpenRouter image inputs.
- SVG files in this directory are source templates only and are NOT used as
  request inputs.
- The PNGs are generated offline by `generate-fixtures.mjs`, a
  zero-dependency renderer; regenerate after any content change.

Using them in an executed smoke test still requires the same approval as the
smoke-test execution itself.
