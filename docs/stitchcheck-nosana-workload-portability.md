# StitchCheck Nosana Workload Portability

> **Status:** IMPLEMENTED — IMAGE SELECTED AND RUNNER UPDATED
>
> **Date:** 2026-08-21
>
> **Resolution:** Container image extracted to a single exported constant
> `RISK_WORKLOAD_IMAGE` in `nosana-risk-runner.mjs`, set to
> `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter` (verified in the
> market's `required_images` allowlist). To switch images, change the
> constant in one place.

---

## 1. Problem Statement

The Nosana market's `required_images` allowlist does not include `python:3.12-slim`
(the image originally specified in the risk-workload job definition). The market
will reject any job that references an image outside its allowlist.

The original image `python:3.12-slim` was not in the market's
`required_images` allowlist. The runner has been updated to use a single
exported constant `RISK_WORKLOAD_IMAGE` set to an allowlisted image.
This document specifies the bounded workload contract so that the image
can be swapped by changing one constant — no other code changes needed.

---

## 2. Bounded Workload Contract

The workload is designed to satisfy all of the following hard constraints
regardless of which container image is used:

| Constraint | Value | Rationale |
|---|---|---|
| Data | Synthetic non-PII only | No passenger, booking, or payment data |
| Dependencies | Standard library only | No `pip install`; no network fetch |
| Simulations | ≤ 1,000 | Bounded compute; deterministic with seed 42 |
| Output | Single JSON line on stdout | Structured `{ riskScore, riskBand, assumptions, simulationCount, explanation }` |
| Exit | Deterministic (exit 0) | No hang, no interactive prompt, no daemon |
| Network | None | Fully offline; all data via env vars |
| Timeout | ≤ 120 seconds | Hard ceiling; workload completes in < 5 s typically |

### 2.1 Input Contract

The workload receives two environment variables:

- **`RISK_INPUT_DATA`** — JSON object with fields:
  - `correlationId` (string)
  - `origin` (3-letter uppercase airport code)
  - `connectionAirport` (3-letter uppercase airport code)
  - `destination` (3-letter uppercase airport code)
  - `connectionDurationMinutes` (non-negative number)
  - `staticHistoricalDatasetVersion` (string)
  - `syntheticDemo` (true)
  - `nonPiiDeclaration` (true)

- **`HISTORICAL_DELAY_DATA`** — JSON object with fields:
  - `airports` — map of airport code → `{ avgDelayMinutes, onTimeRate, tightConnectionRate, sampleSize }`
  - `routes` — array of `{ origin, connection, avgMissRate }`

Both are synthetic, non-PII, and loaded from local fixture files
(`smoke-tests/nosana/fixtures/historical-delay-data.json`).

### 2.2 Output Contract

One JSON line on stdout:

```json
{
  "riskScore": 0.42,
  "riskBand": "medium",
  "assumptions": [
    "Historical average delay at BBB: 20 min",
    "On-time rate: 0.75",
    "Route miss rate: 0.20",
    "Monte Carlo simulations: 500"
  ],
  "simulationCount": 500,
  "explanation": "A 75-minute connection at BBB was evaluated against 500 historical records..."
}
```

### 2.3 Runtime Contract

The workload must be executable as a single command inside the container.
The current approach uses a heredoc:

```sh
python3 << 'PYEOF'
<embedded Python script>
PYEOF
```

**If the allowlisted image uses a different runtime** (e.g. Node.js, plain
`sh`, or a pre-built binary), the `cmd` field in the job definition must be
adapted accordingly. The env var contract (section 2.1–2.2) remains identical.

---

## 3. Portability Mechanism

### 3.1 Single-Constant Image Definition

The container image is defined as one exported constant in
`nosana-risk-runner.mjs` (line 125):

```javascript
export const RISK_WORKLOAD_IMAGE = "docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter";
```

This constant is used in:
- `buildRiskJobDefinition()` — sets `ops[0].args.image`
- Success metadata — fallback for `containerImage` field

**To switch images:** change the `RISK_WORKLOAD_IMAGE` constant to a new
fully-qualified image string. No other code changes are needed.

### 3.2 Image Selection Checklist

Before changing `RISK_WORKLOAD_IMAGE`, verify:

1. [ ] Image is in the target market's `required_images` allowlist.
2. [ ] Image has `python3` available at `$PATH` (for the current heredoc cmd).
3. [ ] Image has Python standard library modules: `json`, `os`, `sys`, `math`, `random`.
4. [ ] Image size is reasonable for IPFS pinning (< 500 MB recommended).
5. [ ] Image is publicly pullable (no private registry auth needed).

If the new image does **not** have Python, the `PYTHON_RISK_SCRIPT` heredoc
must be rewritten for the available runtime. The workload logic (section 4)
is runtime-agnostic and can be ported to Node.js, Go, or plain shell.

### 3.3 Example: Changing the Image

```javascript
// In nosana-risk-runner.mjs, line 125:
export const RISK_WORKLOAD_IMAGE = "docker.io/<new-approved-image>:<tag>";
```

---

## 4. Workload Logic (Runtime-Agnostic Specification)

The workload performs the following deterministic computation:

1. Parse `RISK_INPUT_DATA` and `HISTORICAL_DELAY_DATA` from environment.
2. Look up the connection airport's historical stats:
   - `avgDelayMinutes` (default: 20)
   - `onTimeRate` (default: 0.75)
   - `tightConnectionRate` (default: 0.25)
   - `sampleSize` (default: 500)
3. Look up the route's `avgMissRate` (default: 0.20).
4. Run Monte Carlo simulation:
   - `n_sims = min(1000, max(100, sampleSize))`
   - Seed PRNG with 42 for determinism.
   - For each simulation:
     - Generate delay ~ `max(0, gaussian(avg_delay, avg_delay * 0.4))`
     - If `connectionDurationMinutes - delay < 45`: count as "tight"
   - `tight_ratio = tight_count / n_sims`
5. Compute risk score:
   - `risk_score = round(min(1.0, max(0.0, miss_rate * 0.6 + tight_ratio * 0.4)), 4)`
6. Assign band:
   - `< 0.25` → `"low"`
   - `< 0.55` → `"medium"`
   - `>= 0.55` → `"high"`
7. Emit result as single JSON line on stdout.
8. Exit 0.

---

## 5. What Changed in the Runner

### Extracted Constant (smallest required change)

The image was previously hardcoded as `"python:3.12-slim"` inline in the
job definition builder. It is now a single exported constant:

```javascript
// Line 125:
export const RISK_WORKLOAD_IMAGE = "docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter";

// Line 165 (was: image: "python:3.12-slim"):
image: RISK_WORKLOAD_IMAGE,

// Line 375 (metadata fallback):
containerImage: jobDef.ops?.[0]?.args?.image || RISK_WORKLOAD_IMAGE,
```

No other files are modified. The job definition schema, validation, fallback
logic, evidence labelling, and safety constraints are all unchanged.

---

## 6. Testing

### 6.1 Existing Tests (Unchanged)

All existing offline tests continue to pass:

| Test | Command |
|---|---|
| Schema validator | `node smoke-tests/nosana/schema-validator.mjs` |
| Client offline tests | `node smoke-tests/nosana/nosana-client-offline-tests.mjs` |
| Workload skeleton | `node smoke-tests/nosana/workload-skeleton.mjs` |
| Cross-provider invariants | `node smoke-tests/cross-provider-invariant-tests.mjs` |
| App typecheck | `cd app && npm run typecheck` |
| App build | `cd app && npm run build` |

### 6.2 Portability Verification

To verify the image constant resolves correctly:

```bash
node -e "
  import('./smoke-tests/nosana/nosana-risk-runner.mjs').then(m => {
    console.log('RISK_WORKLOAD_IMAGE:', m.RISK_WORKLOAD_IMAGE);
    const def = m.buildRiskJobDefinition(
      { correlationId: 'test', origin: 'AAA', connectionAirport: 'BBB',
        destination: 'CCC', connectionDurationMinutes: 75,
        staticHistoricalDatasetVersion: 'v1', syntheticDemo: true,
        nonPiiDeclaration: true },
      { airports: {}, routes: [] }
    );
    console.log('Job def image:', def.ops[0].args.image);
    console.log('Match:', def.ops[0].args.image === m.RISK_WORKLOAD_IMAGE);
  });
"
```

---

## 7. Safety Constraints (Unchanged)

- No PII in inputs, outputs, or logs.
- No network access inside the container.
- No credentials logged or persisted.
- Maximum timeout: 120 seconds.
- Estimated cost: ~US$0.0016 per job.
- Hard ceiling: US$10.
- One attempt, zero automatic retries.
- Full fallback to local computation on any failure.
- Evidence labelling unchanged: results are `"nosana-evidence"` only when the
  remote job succeeds; otherwise `"local-fallback"`.

---

## 8. Next Steps

1. **Verify image availability**: confirm `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter`
   is still in the target market's `required_images` allowlist.
2. **Run live preflight**: `node smoke-tests/nosana/run-risk-job.mjs` with
   `NOSANA_API_KEY` set.
3. **Validate evidence**: check `smoke-tests/nosana/results/<UTC>/` for
   correctly labelled artifacts.
4. **If the image must change**: update `RISK_WORKLOAD_IMAGE` in
   `nosana-risk-runner.mjs` line 125 and re-verify against the allowlist.

---

*This document is the workload portability spec for the StitchCheck Nosana
integration. It replaces the missing `stitchcheck-nosana-image-resolution.md`
and provides the bounded workload contract for any allowlisted container image.*
