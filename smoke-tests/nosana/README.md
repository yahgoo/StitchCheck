# Nosana Smoke-Test Harness — LOCAL-ONLY Preparation Artifacts

**Label: `Synthetic local placeholder — not Nosana evidence`.**

> **Heuristic-risk disclaimer:** everything in this directory models a
> *heuristic* risk estimate derived from a static/historical **synthetic**
> dataset. It is not a live delay, weather, legal, or guaranteed-outcome
> prediction. All local results are heuristic placeholders only and are
> **not Nosana evidence**.

## Current status (explicit)

- **NO Nosana call, job submission, deployment, credential, or
  configuration exists yet.**
- **Nothing in this directory has been executed against Nosana.** The
  workload skeleton simulates lifecycle states locally and writes only to
  `results/results.json`.
- **All fixtures are synthetic** and contain zero PII: invented airport
  codes (AAA/BBB/CCC/…), fictional correlation identifiers, and an invented
  dataset version. No names, emails, booking references, payment data,
  passports, or screenshots.
- No score is ever invented on failure or timeout: simulated failure,
  timeout, and unavailable cases all carry `riskScore: null` and
  `riskBand: "unavailable"`.
- These artifacts do not claim or imply that a Nosana integration works.
  They align with `docs/smoke-test-nosana.md` (NOS-01–10),
  `docs/SPECS.md`, and `docs/PRD.md` as preparation only.

## Layout

- `fixtures/req-nos-*.json` — synthetic non-PII request fixtures matching
  the illustrative input contract in `docs/smoke-test-nosana.md`
  (clean two-leg, degraded/low-confidence, timeout-prone, workload-failure,
  and a deliberately malformed case). Each carries the placeholder label and
  the heuristic-risk disclaimer in its metadata.
- `fixtures/res-nos-*.json` — sample result fixtures (success, unavailable,
  failure, error, timeout shapes) matching the expected result contract.
  Every one is labelled `Synthetic local placeholder — not Nosana evidence`
  and carries a `heuristicDisclaimer`.
- `fixtures/manifest.json` — fixture index with test-case mapping
  (NOS-01–10), validity expectations, and the watermark
  `SYNTHETIC FIXTURE — NOT REAL DATA — NO PII — NOT NOSANA EVIDENCE`.
- `schema-validator.mjs` — plain Node.js, zero dependencies; validates both
  request and result fixtures against the contracts and self-checks that
  broken inputs (including invented scores on failure) are rejected.
- `workload-skeleton.mjs` — plain Node.js, zero dependencies, **zero
  network code** (no fetch/http/https/net of any kind); simulates lifecycle
  states `pending → running → completed | failed | timed_out` (plus
  `rejected` for invalid input) and records transitions locally to
  `results/results.json`, including a `disclaimer` field on the record.
- `results/results.json` — produced by the skeleton run; local simulation
  record only.

## Local usage (offline)

    node smoke-tests/nosana/schema-validator.mjs
    node smoke-tests/nosana/workload-skeleton.mjs

Both commands run fully offline, install nothing, and make zero network
requests. The skeleton prints the heuristic-risk disclaimer to stdout and
embeds it in the recorded results.

## Later execution prerequisites (separate gated steps — none exist yet)

Before any real Nosana smoke-test execution could ever happen, a human must
separately complete and authorize each of the following; **none of these
exist in this repository today**:

1. **Program access** — confirm official Nosana documentation
   (https://learn.nosana.com/) and obtain approved access to the Nosana
   program/API for the hackathon environment.
2. **Credentials** — provision any required API key or auth material in the
   ignored root `.env.local` only (never in source, fixtures, results, or
   docs); the Saturday secret-safety gate applies.
3. **Wallet/compute** — any Solana wallet or compute/quota prerequisites
   required to submit a Nosana job, provisioned and authorized separately.
4. **Deployment** — the actual risk workload image/definition designed,
   reviewed, and deployed, using synthetic non-PII inputs only.
5. **Human authorization** — explicit human approval to make the first real
   Nosana submission, mirroring the Gemini harness's execution gate; without
   it, execution is refused.
6. **Non-PII gate** — proof that submitted inputs contain no PII and no
   screenshots, per `docs/smoke-test-nosana.md` preconditions.

Until all six are satisfied, this directory remains preparation-only, and
the pass/fail columns of NOS-01–10 stay blank.

## No downstream services

This harness contains no Atlas, Gemini, booking, order, payment, or
reservation dependency of any kind. Risk output would require explicit user
confirmation upstream and never triggers downstream action here.
