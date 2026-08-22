# Gemini Contract Alignment Record

## Purpose

This record documents an offline contract-alignment correction within the
Gemini smoke-test boundary. Two inconsistencies between the schema validator
and the extraction contract were identified and resolved so that all validators
within the boundary agree on accepted value shapes. This record does not
constitute direct Gemini validation or a live provider execution.

## Scope

The reviewed boundary covers four modules under `smoke-tests/gemini/`:

- Extraction contract (`extraction-contract.mjs`)
- Extraction validator (`extraction-validator.mjs`)
- Schema validator (`schema-validator.mjs`)
- Offline adapter tests (`adapter-offline-tests.mjs`)

Application UI behavior, provider-status claims, credentials, and network
behavior were outside the change scope. No file in `app/` was modified. No
smoke-test source code outside the two named modules was changed.

## Inconsistencies Corrected

| Issue | Previous Mismatch | Correct Contract Behavior | Correction |
|---|---|---|---|
| `fieldConfidence` | The contract and extraction validator use string confidence labels such as `high`, `medium`, `low`, and `none`. The schema validator previously required all `fieldConfidence` values to be numeric, which would reject contract-compatible results. | The schema validator accepts the contract-compatible string confidence values and preserves existing numeric handling where applicable. | Updated the schema validator to accept non-empty string values and finite numbers for `fieldConfidence` entries, aligned with the extraction validator. |
| `extractionStatus` | The contract and extraction validator include `disabled` as a valid extraction status. The schema validator previously omitted `disabled` from its accepted status list, which would reject disabled results produced by the contract's own fallback constructor. | The schema validator recognizes `disabled` as a valid extraction status, consistent with the contract and extraction validator. | Added `disabled` to the accepted `EXTRACTION_STATUSES` list in the schema validator. |

## Regression Coverage

Five assertions were added as Test 22 in the Gemini offline adapter tests.
Coverage includes:

- String confidence values are accepted by the schema validator.
- Disabled-status results with string confidence values pass validation.
- Empty-string confidence values are rejected.
- Numeric confidence values continue to be accepted for forward compatibility.
- The schema validator and extraction validator agree on the same valid result.

Verified result: **92 passed, 0 failed**.

## Verification Results

- Gemini offline tests: 92 passed, 0 failed.
- Atlas offline tests: 89 passed, 0 failed.
- Nosana schema-validator fixtures: all passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Confirmation gate and its visible `Confirm itinerary first` label were not
  changed.

## Evidence Boundary

OpenRouter temporary path — not direct Gemini validation

- Direct Gemini remains unexecuted.
- Nosana remains unexecuted and undeployed.
- Atlas remains unauthenticated and unexecuted.
- No provider status was upgraded by this offline correction.
- Existing provider evidence artifacts were not modified.

## Safety Verification

- No credentials or `.env.local` access were involved.
- No network primitives were added to modified files.
- No PII, raw provider output, booking/payment data, or external actions were
  introduced.
- No Git operations occurred.

## Reviewer Takeaway

The correction ensures that a result shaped exactly to the extraction contract
is not rejected by one validator simply because it disagrees with another on
the type of confidence labels or the set of recognized statuses. The human
confirmation gate and the evidence-boundary labels that distinguish synthetic
placeholder output from live provider evidence remain intact and unaffected by
this change.
