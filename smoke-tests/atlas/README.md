# Atlas Smoke Test — Local-Only Preparation

Strictly local preparation artifacts for the Atlas search-only smoke test
defined in `docs/smoke-test-atlas.md` (test cases ATL-01 through ATL-12).

> **All examples in this directory are `Synthetic local placeholder — not Atlas Sandbox evidence`.**

## Hard truth statements

- Atlas has **not** been authenticated, configured, called, or proven to work.
- **No Atlas credential, SDK, endpoint, authentication, or request code exists**
  anywhere in this directory.
- Nothing here reads or requires `.env.local`, any environment secret, or any
  network resource.
- This preparation is **search-only**. No write actions are represented,
  prepared, or permitted: no offer verification, no purchase, no payment, no
  ticketing, no reservation, and no purchase-request creation. The validator
  actively fails any fixture whose text contains any of the seven forbidden
  action tokens — `verify`, `book`, `pay`, `ticket`, `reserve`, `order`,
  `write` — declared in `local-contract.json` and `schema-validator.mjs`.
- Nothing in this directory is evidence that Atlas search works. Do not claim
  it does.
- Later real execution against the Atlas Sandbox requires the preconditions in
  `docs/smoke-test-atlas.md` **plus separate, explicit human authorization**.

## Files

| File | Purpose |
|---|---|
| `fixtures/query-atl-normal-two-leg.json` | Synthetic search input: normal two-leg confirmed itinerary (ATL-01/02/03/04). |
| `fixtures/query-atl-tight-connection.json` | Synthetic search input: two-leg itinerary with a 50-minute connection (ATL-01/03/04/11). |
| `fixtures/query-atl-empty-result.json` | Synthetic search input paired with a labelled empty outcome (ATL-05). |
| `fixtures/query-atl-error.json` | Synthetic search input paired with a labelled search-error outcome (ATL-07). |
| `fixtures/query-atl-timeout.json` | Synthetic search input paired with a labelled timeout outcome (ATL-06). |
| `fixtures/result-atl-success.json` | Placeholder completed outcome with an alternatives array (ATL-03/04/08/11). |
| `fixtures/result-atl-empty.json` | Placeholder labelled empty outcome (ATL-05). |
| `fixtures/result-atl-error.json` | Placeholder labelled search-error outcome (ATL-07). |
| `fixtures/result-atl-timeout.json` | Placeholder labelled timeout outcome (ATL-06). |
| `schema-validator.mjs` | Zero-dependency Node validator for query and result fixtures, including forbidden write-action token enforcement and PII guards. |
| `comparison-adapter.mjs` | Pure local function producing the UI-ready, Sandbox-labelled, search-only comparison structure (original itinerary vs alternatives: legs, durations, connection time, price placeholder). |
| `local-contract.json` | Declares search-only semantics, the sandbox placeholder marker, the disclaimer label, and the forbidden actions list. |
| `result-shape.d.ts` | TypeScript definitions of the UI-ready result and comparison shapes with the sandbox marker. |

All fixtures use synthetic airport codes (`AAA`, `BBB`, `CCC`), synthetic
dates, placeholder prices, and zero personally identifiable information.

Every result fixture carries:

- the exact disclaimer `Synthetic local placeholder — not Atlas Sandbox evidence`
- the sandbox marker `sourceEnvironment: "sandbox-placeholder"`

## Verification (offline only)

```bash
# Validate all fixtures (schema + disclaimer + forbidden-action scan)
node smoke-tests/atlas/schema-validator.mjs

# Validate a single fixture file (also used for the forbidden-token demo)
node smoke-tests/atlas/schema-validator.mjs path/to/query-atl-example.json

# Print a sample UI-ready comparison built from local fixtures
node smoke-tests/atlas/comparison-adapter.mjs
```

Both commands are fully offline: they read local files only and never touch
the network, credentials, or any external service.

## Safety rules enforced here

1. Every fixture must carry the exact disclaimer label above.
2. Every result fixture must carry the `sandbox-placeholder` environment marker.
3. Query fixtures may only describe confirmed synthetic itineraries
   (`confirmedItinerary: true`), per ATL-12.
4. Completed results must include alternatives; empty/timeout/error results
   must include none — the UI must never fabricate alternatives (ATL-05/06/07).
5. Forbidden action tokens — `verify`, `book`, `pay`, `ticket`, `reserve`,
   `order`, `write` (declared once in the validator and contract) — fail
   validation if found anywhere in fixture text.

## What happens later (not here)

Real execution is a separate, separately authorized task. It must follow
`docs/smoke-test-atlas.md`, use only synthetic inputs and Sandbox credentials,
confirm the Sandbox environment is active before every run, and record honest
evidence — including proof that no write action was attempted.
