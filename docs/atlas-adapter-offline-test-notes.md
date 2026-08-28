# Atlas Adapter Offline Test Notes

## Summary

The read-only Atlas Sandbox adapter boundary for StitchCheck has been implemented. This document records the offline test results and safety invariants.

## Implementation Status

- **Provider-neutral contract**: `smoke-tests/atlas/alternatives-contract.mjs`
- **Read-only adapter**: `smoke-tests/atlas/read-only-atlas-adapter.mjs`
- **Offline test suite**: `smoke-tests/atlas/adapter-offline-tests.mjs`

## Offline Test Results

**Total assertions**: 89  
**Total test sections**: 20  
**Result**: All tests passed

### Test Coverage

1. Disabled-by-default returns a local fallback
2. Exact Atlas placeholder label is present
3. Valid synthetic search/comparison request is accepted
4. Normalized fake-client result passes validation
5. Raw fake-client output is not returned
6. Missing required fields fail safely
7. Malformed dates/times fail safely
8. Impossible connection durations fail safely
9. Booking operation names are rejected
10. Payment/reservation/ticket/order/verification operations are rejected
11. Missing capability approval blocks execution
12. Missing target environment blocks execution
13. Missing injected client blocks execution
14. Missing runtime credential blocks execution
15. Second request in one execution is rejected
16. No network primitive is called
17. No credential is read or exposed
18. Existing local placeholder behavior remains unchanged
19. Adapter cannot bypass the app's confirmation gate
20. No external action is created by the adapter

## Safety Invariants

### Read-Only Operation Allowlist

The adapter supports **only** the following read-only operations:
- `search` — search for safer flight alternatives
- `compare` — compare alternatives against the confirmed itinerary

All other operations are explicitly rejected, including:
- `book`, `create_booking`, `reserve`, `ticket`, `issue`, `pay`, `purchase`, `verify`, `cancel`, `change`, `refund`, `order`

### Disabled by Default

The adapter is disabled by default and remains unreachable unless **all** of the following prerequisites are satisfied:

1. Atlas capability review and approval
2. Target environment explicitly configured
3. Atlas SDK/client reviewed and injected via dependency injection
4. Runtime credential available via secure mechanism
5. Explicit human authorization recorded

### Execution Limits

- **One request maximum per execution** — enforced via module-level call counter
- **No retries, polling, or background execution**
- **Bounded timeout**: 60 seconds
- **Bounded response size**: 10 MB
- **Sanitized errors**: credentials, URLs, headers, PII are stripped

### Evidence Boundary

The adapter preserves the exact evidence label:

> **Synthetic local placeholder — not Atlas Sandbox evidence**

This label appears on:
- All disabled/fallback results
- All normalized provider results (when eventually enabled)
- The adapter's `getLabel()` output

## What the Tests Prove

The offline tests prove that:

- The adapter contract is correctly typed and validated
- Disabled-by-default behavior returns clearly marked local placeholders
- Read-only operation enforcement rejects all forbidden write operations
- Authorization gates (capability, environment, client, credential) block execution when missing
- One-request limit is enforced
- Raw provider output is never returned; only normalized contract fields
- Credentials are resolved internally but never exposed in results
- No network primitives are invoked during disabled or default operation
- The adapter cannot bypass the app's confirmation gate
- All results require user confirmation

## What the Tests Do Not Prove

The offline tests do **not** prove that:

- Atlas Sandbox integration works end-to-end
- The official Atlas SDK (when available) behaves as expected
- Real credentials will be accepted by Atlas
- Live search/comparison requests will succeed
- Atlas will return valid alternatives
- The adapter is production-ready for live execution

## Atlas Sandbox Status

**Historical Atlas Sandbox Search→Verify evidence exists.** The recorded read-only run returned 20 offers and then `PRICE_CONFIRMATION_REQUIRED`; it created no booking, payment, ticket, order, or other write. The most recent Aug 28 attempt was an environment-switch failure, not fresh provider evidence.

The demo build is deliberately offline. Its local alternatives fixture is not presented as Atlas output.

The adapter boundary is implemented and tested offline, but **live execution requires separate human authorization** after reviewing:

- Official Atlas SDK documentation and version
- Target environment selection (Sandbox, staging, production)
- Capability approval for search/comparison operations
- Secure credential setup mechanism
- Cost, quota, permission, and data-handling review
- Explicit one-request authorization

## Offline Tests Are Not Atlas Evidence

The offline tests use **fake clients only**. They validate the adapter contract, validation logic, and safety gates, but they do **not** constitute Atlas Sandbox evidence.

No real Atlas SDK, endpoint, or credential was invoked during testing.

## Future Live Test Requirements

A future live test requires:

1. Official Atlas SDK documentation review
2. Target environment selection and configuration
3. Atlas SDK/client review and approval
4. Secure credential setup via runtime mechanism
5. Explicit human authorization recorded
6. One bounded request with sanitized evidence review
7. Verification that results carry the correct evidence label

## Exact Evidence Label

Preserved exactly:

> `Synthetic local placeholder — not Atlas Sandbox evidence`

This label appears in:
- `smoke-tests/atlas/alternatives-contract.mjs` (ATLAS_LABELS.syntheticLocalFallback)
- `smoke-tests/atlas/read-only-atlas-adapter.mjs` (all results)
- `smoke-tests/atlas/comparison-adapter.mjs` (DISCLAIMER_LABEL)
- `smoke-tests/atlas/schema-validator.mjs` (DISCLAIMER_LABEL)
- `smoke-tests/atlas/local-contract.json` (disclaimerLabel)
- `app/src/data/labels.ts` (LABELS.atlasAlternatives)

## Verification Commands

```bash
# Run offline tests
cd smoke-tests/atlas
node adapter-offline-tests.mjs

# Run typecheck
cd app
npm run typecheck

# Run build
cd app
npm run build
```

## Files Created

- `smoke-tests/atlas/alternatives-contract.mjs` (189 lines)
- `smoke-tests/atlas/read-only-atlas-adapter.mjs` (514 lines)
- `smoke-tests/atlas/adapter-offline-tests.mjs` (1017 lines)
- `docs/atlas-adapter-offline-test-notes.md` (this file)

## Conclusion

The read-only Atlas adapter boundary is implemented and tested offline. All safety gates, operation allowlists, and evidence boundaries are enforced. Historical Sandbox Search→Verify evidence is retained separately; any new live execution still requires explicit authorization.
