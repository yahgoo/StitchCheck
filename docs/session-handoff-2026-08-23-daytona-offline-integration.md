# StitchCheck Session Handoff — 2026-08-23 (Daytona Offline Integration)

## Session Summary

Integrated the completed Stage 1 (dependency graph, deterministic risk computation, recovery-plan animation) and Stage 2 (Daytona risk worker, offline mock orchestrator) work into one working local demo. The recovery-plan animation is now mounted in the app, driven by an explicit worker→app normalization boundary in `daytona-offline-mock` mode with `isLive: false`. A focused capture scene validates the animation end-to-end. **Stopped after offline integration — no live execution, no commit/push/upload.**

## Safety Constraints (Active)

1. No Daytona sandbox creation; no Daytona/Atlas/Nosana/Gemini/OpenRouter calls.
2. No booking, payment, order, ticketing, refund, cancellation, fare settlement, or supplier-write actions.
3. No `.env.local` or credential access (verified by hash check + secret scan).
4. Execution mode for this demo: `daytona-offline-mock` only. `daytona-live-risk` requires real sandbox lifecycle evidence (create → run worker inside → download output → destroy) and is NOT enabled.
5. Safe flag defaults: `DAYTONA_RISK_COMPUTE_ENABLED=false`, `NOSANA_ENABLED=false`, `NOSANA_LIVE_ENABLED=false`, `ATLAS_LIVE_READ_ONLY=false`, `ATLAS_WRITES_ENABLED=false`.
6. Protected and verified unchanged (sha256): `workers/daytona-risk-worker/**`, worker tests, all smoke-test fixtures, `app-fixture-contracts/**`, `app/public/nosana-risk-result.json`, `.env.local`, and all 237 output media files.

## Files Changed This Session

| File | Change |
|---|---|
| `app/src/data/daytona-offline-risk.ts` | NEW — normalization boundary + offline loader (`createDaytonaOfflineMockWorkerResult` → `normalizeDaytonaOfflineRiskResult` → `riskResultToAnimationData`) |
| `app/src/App.tsx` | Mounted `RecoveryPlanAnimation` in `confirmed` step (between panels grid and `ComparisonView`); traveller-review button flips `confirmationPhase` to `request-submitted` without restarting the timeline |
| `app/src/components/RecoveryPlanAnimation.tsx` | Added `data-rpa-phase` completion marker on `.rpa` root; removed unsafe `as RecoveryPlan \| null` cast; canonical wording; timeline effect deps scoped to `[data.downstreamItems, isTerminalNoPlan]` so it plays once |
| `app/src/types/recovery-plan.ts` | `recommendedPlan: RecoveryPlan \| null` (real compatibility correction) |
| `core/domain/risk-computation.ts` | `const nodes: DependencyNode[]` annotation (fixed pre-existing typecheck errors) |
| `core/domain/recovery-plan-adapter.ts` | Nullable plan return; removed dead `deriveSeed`; terminal states set `rePlanAttemptCount: 2` so the component surfaces `no-safe-plan`; trigger label → "Simulated delay trigger — downstream impact is analysis only" |
| `core/flags/feature-flags.ts` | Wired `DAYTONA_RISK_COMPUTE_ENABLED`, `NOSANA_ENABLED`, `NOSANA_LIVE_ENABLED` (default false; forced false in local/atlas modes) |
| `scripts/stitchcheck-recovery-animation-capture.mjs` | NEW focused capture scene; `app/package.json` gained `capture:recovery` |

## Normalization Mapping (worker → RiskResult)

- `evidenceSource: 'daytona-sandbox'` (not in RiskResult union) → `'local-fallback'`; raw literal preserved as `workerEvidenceSource` on the wrapper.
- `executed` forced `false`; `fallbackUsed` forced `true`; `jobOrServiceReference` forced `null`.
- `workloadStatus` whitelisted to `success | no-safe-plan | error`, else `'error'`.
- `executionMode: 'daytona-offline-mock'`, `isLive: false`, `externalWriteOccurred: false` unconditionally — live claims are impossible at this boundary.
- No `as any` / unsafe casts anywhere in the boundary.

## Displayed Labels (verified in browser)

- Provenance + Mode badges: "Daytona offline mock — no live risk computation executed".
- Simulated trigger: "Simulated delay trigger — downstream impact is analysis only".
- Missing values: "Not available from the current evidence".
- Safe confirmation: "Request submitted — awaiting verified supplier outcome" (verified via browser check after clicking the review button; no "Booked/Switched/Ticket issued/Payment completed" strings present).
- Live label "Daytona live risk computation" asserted absent by the capture script.

## Completion Marker

`.rpa` root exposes `data-rpa-phase`: timeline phases verbatim; terminal no-plan → `no-safe-plan`; `error` reserved. Verified live: success path reaches `done`. Reduced-motion CSS intact; animation plays once; stable end state.

## Capture Scene

`node scripts/stitchcheck-recovery-animation-capture.mjs` (or `npm run capture:recovery` in `app/`): loads demo → confirms → waits `data-demo-ready="true"` → locates `.rpa` → polls terminal `data-rpa-phase` → asserts offline labels → 1920×1080 viewport screenshot (`fullPage: false`) → writes to NEW `output/captures/recovery-animation-<ts>/` with manifest. Passed (10.7s). Existing 6-scene script and fallback videos untouched. Note: captured frame shows an empty gap where candidate cards collapse — artifact of the transition-disabling CSS injected for deterministic capture; in the live app the collapse animates.

## Validation Results

- Worker 77/77 · orchestrator 68/68 · dependency-graph 141/141 · risk-computation 87/87.
- Full `npm run verify:offline` chain (17 suites + typecheck + build) passes end-to-end.
- Typecheck/build: pass. NOTE: the Stage-1/2 claim "typecheck passed" was false at baseline — 7 pre-existing type errors existed and were fixed this session.
- Secret scan: `node scripts/secret-scan.mjs --all` clean. (Repo-wide, the only pattern hits are fake constants in pre-existing `smoke-tests/gemini/interactions-api-offline-tests.mjs`.)
- Protected-file hashes: all 46 protected files + 237 media files unchanged (`shasum -c` OK).

## Known Provenance-Test Status

`smoke-tests/provenance-label-offline-tests.mjs` was 27 passed / 1 failed at baseline (heuristic false-positive: file contains "candidates" and no `// ` comment → "Possible raw Gemini response in RecoveryPlanAnimation.tsx"). It is now **28 passed / 0 failed** — flipped because the component legitimately gained a `//` line comment (eslint-disable for the timeline deps), satisfying the heuristic. The heuristic itself is unchanged and remains fragile; do not treat this as a semantic fix.

## Remaining Issues / Next Steps

1. Provenance "candidates" heuristic is still false-positive-prone (passes only via the `//` comment).
2. `data-rpa-phase="error"` is reserved but never produced (terminal errors surface as `no-safe-plan`).
3. Live Daytona path remains unimplemented by design: requires real sandbox lifecycle evidence and explicit approval before any `daytona-live-risk` work.
4. Pre-existing uncommitted workspace modifications from earlier sessions were left untouched.
