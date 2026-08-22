# Nosana Integration Boundary — Offline-Only Implementation

## Purpose

This document describes the Nosana integration boundary implemented for
StitchCheck. The boundary provides a credential-free, network-disabled client
that operates entirely in offline mode with deterministic local fixtures.

**Label: `Synthetic local placeholder — not Nosana evidence`**

## Offline-Only Status

The Nosana integration boundary is **offline-only**. No Nosana API call, job
submission, deployment, credential use, authentication, funding, polling,
cancellation, or network execution has occurred or will occur unless explicit
human authorization is obtained and a separate future-execution path is
enabled.

All artifacts in `smoke-tests/nosana/` are synthetic local placeholders. They
do not claim or imply that a Nosana integration works. They align with
`docs/smoke-test-nosana.md` (NOS-01–10), `docs/SPECS.md`, and `docs/PRD.md`
as preparation only.

## Planned Nosana Role

Nosana's planned role in StitchCheck is to accept a non-PII itinerary summary
and return a heuristic risk band/score with visible workload status. The risk
score is a heuristic estimate derived from a static/historical synthetic
dataset. It is not a live delay, weather, legal, or guaranteed-outcome
prediction.

The planned workflow:

1. User confirms itinerary (after Gemini extraction and review).
2. Nosana accepts a non-PII risk request (origin, connection airport,
   destination, connection duration, dataset version, correlation ID).
3. Nosana returns a structured risk result (risk band, risk score, workload
   status, job/service reference, heuristic disclaimer, failure-cascade
   explanation).
4. The application displays the risk result alongside Atlas alternatives.
5. The user makes a Keep or Switch decision.

This workflow has not been executed against Nosana. The boundary implemented
here validates the contract and safety properties offline.

## Allowed Read-Only Operations

The Nosana client exposes four read-only operations:

1. **validateWorkload(workload)** — Validates a workload descriptor against
   the contract. Returns `{ valid: boolean, issues: string[] }`. Checks
   required fields (correlationId, origin, connectionAirport, destination,
   connectionDurationMinutes, staticHistoricalDatasetVersion, syntheticDemo,
   nonPiiDeclaration), rejects mutation-like fields, enforces timeout and
   retry bounds.

2. **buildRequestEnvelope(workload)** — Builds a sanitized request envelope
   without secrets. Strips forbidden keys (PII, credentials, headers). Returns
   `{ valid: boolean, issues: string[], envelope: Object | null }`.

3. **normalizeFixtureResult(fixtureResult)** — Normalizes a fixture response
   into a safe result. Strips forbidden keys, enforces evidence boundaries
   (`executedAgainstProvider: false`, `sourceType: "synthetic-local-placeholder"`).
   Returns a frozen result object.

4. **getStatus()** — Returns the current workload status. In offline mode,
   always returns `{ status: "disabled", reason: "offline-mode-no-nosana-execution", ... }`.

All operations are read-only with respect to user-facing travel data. No
mutation of external state occurs.

## Rejected Mutation Operations

The following mutation operations are explicitly rejected:

- **submit** — No workload submission.
- **deploy** — No workload deployment.
- **fund** — No funding or payment.
- **cancel** — No cancellation.
- **reserve** — No reservation.
- **purchase** — No purchase or order.
- **delete** — No deletion.

If any of these fields are present in a workload descriptor, validation fails
with an issue like `mutation-like field rejected: submit`. If a caller
attempts to invoke a mutation operation via `rejectMutation(operation)`, an
error is thrown.

## Sanitization Rules

The client enforces strict sanitization of all inputs and outputs:

- **Forbidden keys stripped:** apiKey, api_key, secret, password, token,
  authorization, bearer, credential, name, firstName, lastName, surname,
  email, emailAddress, phone, phoneNumber, passenger, passengers,
  bookingReference, pnr, payment, cardNumber, passport, dateOfBirth, address.
- **Recursive sanitization:** Nested objects and arrays are scanned; forbidden
  keys are removed at any depth.
- **No logging of sensitive data:** The client never logs request headers,
  tokens, credentials, raw responses, or PII.
- **Frozen outputs:** All results are frozen with `Object.freeze()` to prevent
  mutation.

## Test Coverage

The offline test suite (`smoke-tests/nosana/nosana-client-offline-tests.mjs`)
covers:

- Valid workload acceptance (7 assertions).
- Missing required fields rejection (11 assertions).
- Mutation-like operations rejection (10 assertions).
- Offline mode never calls transport (3 assertions).
- Transport rejection without explicit future execution flag (3 assertions).
- Fixture results retain `executedAgainstProvider: false` (3 assertions).
- Fixture results retain `sourceType: "synthetic-local-placeholder"`
  (4 assertions).
- Sanitization of raw headers, tokens, credentials, PII (11 assertions).
- Timeout and retry bounds enforcement (4 assertions).
- Single request attempt limit (3 assertions).
- Existing Nosana fixtures remain valid (7 assertions).
- Invalid mode rejection (1 assertion).
- Constants are frozen (5 assertions).
- Client API is frozen (1 assertion).
- Invalid workload status correction (2 assertions).

**Total: 75 assertions, all passed.**

Existing Nosana tests also pass:

- Schema-validator fixtures: all passed (21 checks).
- Workload-skeleton: 5 simulated runs, all valid.

## Explicit Statements

**`Synthetic local placeholder — not Nosana evidence`**

No deployment, credential use, authentication, funding, submission, polling,
cancellation, or network execution occurred. No Nosana API call, job
submission, deployment, credential, or configuration exists in this
repository. Nothing in `smoke-tests/nosana/` has been executed against Nosana.

All fixtures are synthetic and contain zero PII: invented airport codes
(AAA/BBB/CCC), fictional correlation identifiers, and an invented dataset
version. No names, emails, booking references, payment data, passports, or
screenshots.

No score is invented on failure or timeout: simulated failure, timeout, and
unavailable cases all carry `riskScore: null` and `riskBand: "unavailable"`.

The heuristic-risk disclaimer is surfaced on every run: "Heuristic risk
estimate only — derived from a static/historical synthetic dataset; not a live
delay, weather, legal, or guaranteed-outcome prediction."

## Safety Guarantees

- **Zero network code:** No fetch/http/https/net/socket imports or calls.
- **Zero credentials read:** No .env or secret file is ever touched.
- **Zero dependencies:** Node.js built-ins only.
- **Dependency-injected transport:** Never imports a live SDK.
- **Offline mode by default:** Refuses to run with real transport unless an
  explicit future execution flag is provided.
- **Never logs sensitive data:** No headers, tokens, credentials, raw
  responses, or PII.
- **Returns sanitized structured results only.**
- **Read-only operations:** validate, build envelope, normalize fixture.
- **Rejects mutation operations:** submit, deploy, fund, cancel, reserve,
  purchase, delete.
- **All results carry evidence boundaries:** `executedAgainstProvider: false`,
  `sourceType: "synthetic-local-placeholder"`.

## Future Execution Prerequisites

Before any real Nosana smoke-test execution could ever happen, a human must
separately complete and authorize each of the following; **none of these exist
in this repository today**:

1. **Program access** — Confirm official Nosana documentation and obtain
   approved access to the Nosana program/API for the hackathon environment.
2. **Credentials** — Provision any required API key or auth material in the
   ignored root `.env.local` only (never in source, fixtures, results, or
   docs).
3. **Wallet/compute** — Any Solana wallet or compute/quota prerequisites
   required to submit a Nosana job, provisioned and authorized separately.
4. **Deployment** — The actual risk workload image/definition designed,
   reviewed, and deployed, using synthetic non-PII inputs only.
5. **Human authorization** — Explicit human approval to make the first real
   Nosana submission, mirroring the Gemini harness's execution gate; without
   it, execution is refused.
6. **Non-PII gate** — Proof that submitted inputs contain no PII and no
   screenshots, per `docs/smoke-test-nosana.md` preconditions.

Until all six are satisfied, this directory remains preparation-only, and the
pass/fail columns of NOS-01–10 stay blank.

## Related Artifacts

- `smoke-tests/nosana/nosana-client.mjs` — Client module.
- `smoke-tests/nosana/nosana-client-offline-tests.mjs` — Offline test suite.
- `smoke-tests/nosana/schema-validator.mjs` — Fixture schema validator.
- `smoke-tests/nosana/workload-skeleton.mjs` — Local workload simulation.
- `smoke-tests/nosana/fixtures/` — Synthetic request and result fixtures.
- `smoke-tests/nosana/results/results.json` — Simulated run record.
- `docs/smoke-test-nosana.md` — Smoke-test plan (NOS-01–10).
- `docs/SPECS.md` — Technical specification (Nosana Risk Service).
- `docs/PRD.md` — Product requirements (US-06, US-07, US-08; FR-06, FR-07, FR-08).
