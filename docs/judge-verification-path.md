# Judge Verification Path (2026-08-29)

## One command

```bash
npm --prefix app run verify:offline
```

## What it runs

A single chained script (`app/package.json` → `verify:offline`) that executes the full
credential-free offline suite, then a typecheck and a production build:

- Cross-provider invariant tests
- Provenance-label offline tests
- Extraction-adapter offline tests (OpenRouter historical path)
- Atlas adapter / duplicate-booking guard / schema validator / verify-retry resilience
- Nosana client / schema / response-normalization / cost / child-process / UI-label /
  live-evidence-reconciliation / safety-gate / timeout-safety / workload-portability
- Dependency-graph, risk-computation, recovery-animation-accessibility
- Daytona orchestrator / worker-sanitize / risk-orchestrator
- Secret-scan CLI + offline
- Sandbox-order-state and Atlas sandbox write-gate tests
- `npm run typecheck` (`tsc --noEmit`)
- `npm run build` (`tsc -b && vite build`)

## Measured result (this run, 2026-08-29)

- **Wall-clock:** ~14 seconds.
- **Assertion total:** `Results: 354 passed, 0 failed`.
- **Exit code:** `0`.

## Exit-zero meaning

`verify:offline` exits `0` only if **every** chained step passes **and** the typecheck and
production build both succeed. A non-zero exit stops the chain at the first failing step.

## Zero-keys / sockets-disabled claim (asserted, not assumed)

The suite runs with **no provider API keys and no network**. Live assertions in the output
include: `isEnabled() false without credential`, `contract remains network-free`,
`no API key or idempotency-key value in any evidence artifact`,
`offline mode never calls transport`, `transport was never called in offline mode`,
`Dry-run makes no network call`, and `All fixture validations passed (offline, synthetic,
no Nosana contact)`.

## Two extra suites (not in the `verify:offline` chain)

Run these directly — they cover the MiniMax M3 UI copy and the sample-screenshot entry point:

```bash
node smoke-tests/minimax-visibility-fix-offline-tests.mjs   # 8 passed, 0 failed
node smoke-tests/sample-itinerary-screenshot-tests.mjs      # 7 passed, 0 failed
```

Adding these: **354 + 15 = 369 offline assertions, 0 failed.**
