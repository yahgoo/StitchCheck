# StitchCheck — Final Go/No-Go: Read-Only Expert-Mode Final Submission Reconciliation

**Document type:** Read-only Expert-Mode Final Submission Reconciliation (reconciliation report only — no fixes performed)
**Date:** 2026-08-23
**Inputs (read-only, quoted faithfully):**
1. Manifest/artifacts/media audit (Task 1) — `62d78a08-36c1-44b6-a449-6912d8b344d7`
2. Docs claims/wording/provider-readiness audit (Task 2) — `f292741c-d9e0-4745-868f-1f3828c8766a`
3. Code/provenance/flags/scripts/git audit (Task 3) — `a2557ae1-a67c-4739-b8b7-3d6b20029101`

**Execution-boundary statement:** This task modified no files other than creating this report. It read no credentials (`.env.local` was not read), made no provider calls, ran no tests or builds, installed nothing, committed/pushed/uploaded/submitted nothing, and fixed nothing it documented. Anything not verifiable from the three audits is explicitly marked as such.

## Overview

The three audits together establish: the offline demo state is solid and internally consistent at the artifact/path level, but the submission record is materially **unfrozen** and internally **contradictory** — the JSON manifest denies live executions that disk evidence affirms, two mutually exclusive documentation regimes coexist, three different "primary" videos are crowned with no recorded selection, the repo contains 16 modified protected files plus an entirely uncommitted `core/` layer, and every formal human-approval record remains blank.

```text
Offline demo is complete.
Live-provider verification is not complete.
No provider call is authorized by this task.
```

---

## 1. Verified Offline Status

Confirmed offline-only, per Task 3's code audit (read-only):

- **Fixture-only browser app — CONFIRMED (with one nuance).** Network primitive grep (`fetch(`/`XMLHttpRequest`/`axios`/`WebSocket`) in `app/src` hits exactly 3 calls, all in `app/src/data/fixtures.ts`:
  - line 72: `fetch('/nosana-risk-result.json')`
  - line 113: `fetch('/daytona-evidence.json')`
  - line 131: `fetch('/atlas-evidence.json')`

  All are same-origin static JSON paths served by the Vite dev server (public-dir evidence files written by orchestrators), with graceful `null` fallback on 404/parse failure. Zero provider hostnames anywhere in `app/src`. Header comment `fixtures.ts:1–3`: "No external calls. No live service data." `getDefaultExtraction()` (`fixtures.ts:149–159`) hardcodes `evidenceSource:'local-fixture', executed:false, fallbackUsed:true` → renders `Fictional itinerary — local demo fixture`.
- **Flag defaults all OFF.** `core/flags/feature-flags.ts` (169 lines, read fully): eight flags in `DEFAULT_FLAGS` (lines 31–40) — `DAYTONA_ENABLED`, `DAYTONA_RISK_COMPUTE_ENABLED`, `NOSANA_ENABLED`, `NOSANA_LIVE_ENABLED`, `ATLAS_LIVE_READ_ONLY`, `ATLAS_WRITES_ENABLED`, `ATLAS_TICKETING_SIMULATION_ENABLED` all `false`; `DEMO_MODE` defaults `'local'`. `evaluateFlags()` (lines 92–168): `DEMO_MODE=local` (or unset/invalid → `'local'`) forces **all flags false**; `DEMO_MODE=daytona` forces `ATLAS_WRITES_ENABLED=false` and simulation false; `DEMO_MODE=atlas` forces Daytona flags false; invariant: `ATLAS_WRITES_ENABLED=true` forces simulation false. Header (line 5): "The browser app never reads these directly."
- **Safety gates — CONFIRMED.** `core/safety/gates.ts` (125 lines, read fully):
  - `checkTicketingPrerequisites()` (lines 43–71): 7 prerequisites (`account_activation`, `sandbox_credentials`, `payment_method`, `refund_void_path`, `idempotency_behavior`, `written_permission`, `explicit_human_approval`) — all default false; doc comment: "real ticketing has not been activated".
  - `assertWriteBlocked(flags)` (lines 77–87): throws `SafetyGateError` if `ATLAS_WRITES_ENABLED=true` while prerequisites unmet.
  - `assertUserConfirmed()` (lines 93–99): blocks downstream work before itinerary confirmation.
  - `validateOperationPermission()` (lines 105–124): allowlist `['search','compare','verify']`; forbidden list `['book','create_booking','reserve','ticket','issue','pay','purchase','cancel','change','refund','order']`.
- **Offline mocks — CONFIRMED per provider write/live path:**
  - Atlas writes: `ATLAS_WRITES_ENABLED` (default false) + `assertWriteBlocked()` + forbidden-op list. `scripts/atlas-orchestrator.mjs` is documented "STATUS: MOCK MODE — NO REAL ATLAS EXECUTION".
  - Nosana live: `smoke-tests/nosana/nosana-risk-runner.mjs` `isNosanaLivePermitted()` (lines 78–92) requires ALL of: non-local `DEMO_MODE`, `NOSANA_ENABLED='true'`, `NOSANA_LIVE_ENABLED='true'`; plus explicit `--live` CLI flag, `NOSANA_API_KEY` presence, and cost-ceiling validation. Gate fires before any network interaction (lines 382–388), returning structured `safety-gate-blocked` refusal. `run-risk-job.mjs` defaults to dry-run (`DRY_RUN=true` default, lines 91–101).
  - Gemini live: `smoke-tests/gemini/direct-gemini-adapter.mjs` conditional guard (header lines 6–14; enablement check lines 885–894): requires `config.json` `directGeminiEnabled:true`/`providerSelection:'gemini'` AND capability `approved` in `provider-capabilities.json` AND approved model AND `GEMINI_API_KEY` present AND `@google/genai` importable; otherwise returns marked local fallback. Single-request limit, no retry. Live verification is a one-shot runner `live-interactions-verification-runner.mjs` with a hard single-request guard.
  - Daytona sandbox creation: `scripts/daytona-sandbox-plan.mjs` `liveExecutionAllowed()` (lines 85–89) requires `ALLOW_LIVE=1` AND `DAYTONA_API_KEY` present; SDK imported lazily only on the live path. `daytona-orchestrator.mjs` and `daytona-risk-orchestrator.mjs` are declared MOCK/OFFLINE-ONLY with zero network.
- **Captures confirm offline execution mode.** Latest passing capture manifest (`recovery-animation-2026-08-23T14-36-28`): `"overallStatus": "pass"`, `"executionMode": "daytona-offline-mock"`, `"isLive": false`, provenanceLabel `"Daytona offline mock — no live risk computation executed"`, appUrl `http://localhost:5175/`. Latest full 6-scene pass: `capture-2026-08-21T15-53-19` (`nosanaSource: "local-fallback"`, silent voice mode). No capture manifest asserts live-provider content.
- **Structural note (observation, not defect):** `core/` is a TypeScript module layer; the `.mjs` smoke-test runners duplicate flag semantics rather than importing `core/flags`. Semantics match, but there is no single enforced code path.

---

## 2. Exact Test/Build/Capture/Media Status

### 2.1 Tests: 26 suites / claimed 1544 passed / 0 failed — with three count discrepancies

Per Task 1: `output/submission-manifest.json` (generated `2026-08-23T14:48:41.723Z`, file mtime `2026-08-23 23:00:40`) claims `totalSuites: 26` — exactly 26 suite entries present, all 26 source files exist (21 under `smoke-tests/`, 5 under `scripts/`). Independent summation of the 26 per-suite `passed` values equals **1544** (40+28+165+146+50+89+48+9+75+0+157+78+30+20+49+45+58+40+141+87+25+27+16+68+23+30). Arithmetically consistent.

**Three documented discrepancies (docs vs JSON manifest):**

| # | Suite | Docs claim | JSON manifest | Finding |
|---|---|---|---|---|
| 1 | Gemini adapter offline (`smoke-tests/gemini/adapter-offline-tests.mjs`) | **92** passed — in 4 docs: `docs/stitchcheck-submission-manifest.md` §5.2, `docs/stitchcheck-submission-evidence-index.md` ("Test and Build Record"), `docs/stitchcheck-submission-artifact-manifest.md`, `output/demo-artifacts/stitchcheck-video/manifest.md` (QA table) | **165** passed | Suite grew; docs stale |
| 2 | Nosana schema validator | **10** fixtures passed (`docs/stitchcheck-submission-artifact-manifest.md`; evidence index "all passed") | **0** passed / 0 failed | Parser artifact: generator (`scripts/generate-submission-manifest.mjs` lines 134–139) falls into the `'All fixture validations passed' → { passed: 0, failed: 0 }` branch. Not evidence of zero fixtures |
| 3 | Nosana workload portability | **37** passed (evidence index) | **40** passed | Docs stale |

### 2.2 Typecheck/build: pass per manifest only

`typecheck: pass`, `build: pass` in JSON manifest — plausible (generator runs `tsc --noEmit` and `vite build`) but **no independent log persisted; not re-run in this audit**. Counts are only as fresh as the `2026-08-23T14:48Z` generator run, which `execSync`-ran each suite, parsed "N passed, M failed", then discarded the output. **No raw test stdout/log files exist under `output/` for the 26 suites.** The 1544 figure could not be re-verified (re-running tests was prohibited).

### 2.3 Capture status: 18 captures — 15 pass / 3 fail

Per-capture `overallStatus` from each `capture-manifest.json` (18 total: **15 pass, 3 fail**):

| Capture dir | Status | Scenes covered |
|---|---|---|
| `capture-2026-08-21T06-34-22` | **fail** | All 6 scenes failed (locator timeouts); **0 PNGs produced** |
| `capture-2026-08-21T06-37-09` | **fail** | Partial: only scene-01, scene-02 PNGs exist |
| `capture-2026-08-21T06-40-12` | **fail** | Partial: scenes 01–03 PNGs exist |
| `capture-2026-08-21T06-40-33` | pass | All 6 scenes |
| `capture-2026-08-21T06-50-42`, `T06-51-35`, `T07-04-43` | pass | All 6 scenes each |
| `capture-2026-08-21T14-41-47`, `T15-24-51`, `T15-29-19`, `T15-48-20`, `T15-52-41`, `T15-53-19` | pass | All 6 scenes each |
| `recovery-animation-2026-08-23T07-15-33`, `T07-41-51`, `T08-11-57`, `T11-32-14`, `T14-36-28` | pass | 1 scene each (`recovery-animation`, `terminalPhase: done`) |

The three failures are **early historical attempts** (2026-08-21 morning); every capture after `06-40-33` on 08-21 and all five 08-23 recovery captures passed. **Latest capture:** `output/captures/recovery-animation-2026-08-23T14-36-28/recovery-animation-final.png` — mtime **2026-08-23 22:36:38 local** (= `2026-08-23T14:36:38.896Z`), 124,628 bytes, 1920×1080; exactly matches JSON manifest `latestRecoveryCapture`. No file under `output/` is newer except `output/submission-manifest.json` itself (23:00:40). Also present (unreferenced by manifests): 4 step screenshots at `output/` root (`step1-initial-page.png` … `step4-review-page-provenance.png`, all 2026-08-22).

### 2.4 Video lineage and latest render

| Video | mtime (local) | Size | ffprobe-verified |
|---|---|---|---|
| `stitchcheck-demo.mp4` | 2026-08-21 13:25:43 | 2,927,320 B | 120.000 s, H.264 1920×1080, no audio |
| `stitchcheck-voice-caption-sync-proof.mp4` | 2026-08-21 15:40:32 | 637,161 B | not probed |
| `stitchcheck-voice-caption-sync-proof-fix-test.mp4` | 2026-08-21 22:45:26 | 671,811 B | not probed |
| `stitchcheck-full-voiceover-proof.mp4` | 2026-08-21 23:18:58 | 4,158,844 B | 131.000 s, H.264 1920×1080, AAC |
| `hackathon-submission/stitchcheck-hackathon-demo.mp4` | 2026-08-22 09:49:30 | 5,281,199 B | not probed |
| `hackathon-submission/stitchcheck-hackathon-demo-v2.mp4` | 2026-08-22 10:39:14 | 5,789,220 B | not probed |
| `hackathon-submission/stitchcheck-hackathon-demo-v3.mp4` | 2026-08-22 11:05:48 | 6,090,514 B | not probed |
| `hackathon-submission/stitchcheck-hackathon-demo-live-v2.mp4` | 2026-08-22 13:48:21 | 5,377,877 B | not probed |
| `hackathon-submission-live-v2/stitchcheck-hackathon-demo-live-v2.mp4` | 2026-08-22 13:49:44 | 5,126,280 B | not probed |
| `hackathon-submission/stitchcheck-hackathon-demo-live-v2-clean.mp4` | 2026-08-22 15:06:23 | 5,113,399 B | not probed |
| **`stitchcheck-demo-fixed-v1.mp4`** | **2026-08-22 23:36:16** | **3,049,921 B** | **120.000 s, H.264 1920×1080, AAC** |

- **Latest/final render: `output/demo-artifacts/stitchcheck-video/stitchcheck-demo-fixed-v1.mp4`** — newest mtime among all mp4s under `output/demo-artifacts/`. JSON manifest `latestVideo` is accurate; timestamps match file mtimes exactly (`15:36:16.490Z` = 23:36:16 local). Supporting assets exist: `render-fix-v1.sh` (23:35:34), `frames-fixed-v1/` (5 PNGs, 23:36:37–39), `scene-0X-*.png` re-captures (23:34:00–03), `capture-scenes.mjs` (23:33:43).
- **Stale designations:** (1) `docs/stitchcheck-submission-manifest.md` §4 + §9 item 7 + sign-off checklist crown `stitchcheck-full-voiceover-proof.mp4` — exists and metadata accurate, but 5 renders older than fixed-v1 → **STALE designation**; (2) evidence index claim row cites the same file, no mention of fixed-v1 or the five 08-22 hackathon renders → **STALE**; (3) `output/demo-artifacts/stitchcheck-video/manifest.md` (2026-08-21) says **"Voiceover: Status: NOT PRODUCED"** — superseded and doubly contradicted by voice WAVs on disk (`voice/scene-01..06.wav`, `hackathon-submission/voice/seg-01..07*.wav`, `hackathon-submission-live-v2/voice/seg-01..07.wav`) → **STALE**; (4) both human manifests omit the entire `hackathon-submission*` family (six renders); (5) no doc references a nonexistent video path — the staleness is about *which* video is canonical, not broken paths.

---

## 3. Provenance Consistency

### 3.1 Canonical source and UI consumption — consistent at import level

`core/provenance/labels.ts` (180 lines, read fully) is declared the single canonical source; `app/src/data/labels.ts` re-exports from it. All panels import via the re-export (`RiskPanel.tsx`, `SafetyNotice.tsx`, `ComparisonView.tsx`, `AlternativesPanel.tsx`). `RecoveryPlanAnimation.tsx:546` hardcodes `'Fictional alternatives — local demo fixture'` (matches core).

**Gemini (`GEMINI_LABELS`, `getGeminiLabel()` lines 20–56):**
| Constant | String value | Condition |
|---|---|---|
| `liveValidated` | `Direct Gemini 3.7 — live validated` | `evidenceSource='gemini-live'` AND `provider='gemini'` AND `executed=true` AND `fallbackUsed=false` AND `validationOutcome='valid'` |
| `localFixture` | `Fictional itinerary — local demo fixture` | `evidenceSource='local-fixture'` AND `executed=false` AND `fallbackUsed=true` |
| `offlineFixture` | `Offline fixture — not direct Gemini evidence` | fallback for any other/contradictory provenance |

**Atlas (`ATLAS_UI_LABELS`, `getAtlasLabel()` lines 60–123):**
| Constant | String value | Condition |
|---|---|---|
| `sandboxLive` | `Atlas Sandbox — live Search/Verify` | `atlas-sandbox` + executed + no fallback |
| `productionSearch` | `Atlas production Search — reference prices only` | `atlas-production` + executed + no fallback |
| `localFixture` | `Fictional alternatives — local demo fixture` | `local-fixture` |
| `offlineFixture` | `Offline fixture — not Atlas Sandbox evidence` | conservative default |
| `daytonaSandbox` | `Daytona sandbox evidence — Atlas Search/Verify, read-only` | `daytona-sandbox` + executed + no fallback |
| `daytonaFallback` | `Daytona sandbox unavailable — local fallback used` | `daytona-sandbox` + `fallbackUsed=true` |
| `simulated` | `Simulated ticketing — no real order created` | `atlas-simulated` |

**Nosana (`NOSANA_UI_LABELS`, `getNosanaLabel()` lines 127–156):**
| Constant | String value | Condition |
|---|---|---|
| `liveEvidence` | `Nosana evidence — remote job succeeded; result from decentralized GPU workload.` | `nosana-evidence` + `fallbackUsed=false` |
| `offlineValidated` | `Nosana workload validated offline — local fallback used; not Nosana evidence` | `nosana-evidence` + `fallbackUsed=true` |
| `localFallback` | `Local fallback — not Nosana evidence` | everything else |

**Other constants (lines 160–179):** `OPENROUTER_HISTORICAL_LABEL` = `Historical temporary OpenRouter test path — not the active provider`; backward-compat `LABELS` object (`LABELS.nosanaRisk` = localFallback, `LABELS.atlasAlternatives` = localFixture, `LABELS.geminiExtraction` = localFixture); `DISABLED_MESSAGE` = `Confirm itinerary first`; `FINAL_STATEMENT` = `No booking, payment, reservation, ticket, order, verification, or other write action has been created. This demo uses fictional data only.` `core/provenance/metadata.ts`: `createDaytonaProvenance()` produces `Daytona sandbox evidence — Atlas Search/Verify, read-only` or `Daytona sandbox evidence — sandbox not yet destroyed`; `createDaytonaFallbackProvenance()` produces `Daytona sandbox unavailable — local fallback used`.

Labels defined OUTSIDE core/provenance: `safety-gate-blocked` (evidenceSource, emitted by `nosana-risk-runner.mjs` `buildGateBlockedResult()` with `evidenceLabel: "Nosana live execution blocked by safety gate — not Nosana evidence."`; not referenced in `app/src` — RiskPanel treats any non-`nosana-evidence` source as `localFallback`); Daytona offline-mock labels in `app/src/data/daytona-offline-risk.ts` (lines 266, 269, 280, 142/256); orchestrator-side labels in `scripts/atlas-orchestrator.mjs` (lines 22–25) and `scripts/daytona-risk-orchestrator.mjs` (line 33) mirror the core strings.

### 3.2 Drift found (evidence-backed)

1. **Capture script stale assertions.** `scripts/stitchcheck-demo-capture.mjs` `EVIDENCE_LABELS` (lines 54–62) asserts:
   - Atlas: `'Synthetic local placeholder — not Atlas Sandbox evidence'` — the app now renders `LABELS.atlasAlternatives` = `'Fictional alternatives — local demo fixture'` (`AlternativesPanel.tsx:17`) or `ATLAS_UI_LABELS.offlineFixture` (`ComparisonView.tsx:15`). **No variant matches; scenes 01/03/05 atlas assertions (lines 286–288, 358–360, 440–441) would fail against current app copy.**
   - Nosana variants: `'Synthetic local placeholder — not Nosana evidence'`, `'Nosana unavailable — local fallback used; not Nosana evidence'` — neither matches current `LABELS.nosanaRisk` = `'Local fallback — not Nosana evidence'` rendered by `RiskPanel.tsx`. Scene 01/03/04 Nosana assertions (lines 280–283, 352–355, 400–403) would fail in fixture mode.
   - The script is modified since last commit (`M scripts/stitchcheck-demo-capture.mjs`) yet still carries pre-migration labels.
2. **Narration "3.7" omission.** `app/src/components/useNarration.ts:24` says the label reads `Direct Gemini — live validated`, but the canonical label is `Direct Gemini 3.7 — live validated` (`core/provenance/labels.ts:22`). The narrated scene uses the local fixture (renders `Fictional itinerary — local demo fixture` per `fixtures.ts:149–159`) — wording may be intentional, but matches no rendered label exactly.
3. **`daytona-offline-risk.ts` `'daytona-sandbox'` literal hazard.** `app/src/data/daytona-offline-risk.ts` uses `evidenceSource: 'daytona-sandbox'` (lines 164, 275) for an **offline mock** result; the file's own comment (lines 8–10) acknowledges the literal is "NOT part of the RiskResult evidence union". If ever passed to `getAtlasLabel()` with `executed=true, fallbackUsed=false`, it would resolve to the live `daytonaSandbox` label — a **latent label-inflation hazard**. Execution mode is forced to `'daytona-offline-mock'`, `isLive: false` (lines 87, 187–188).
4. **Comment-only non-canonical label.** `app/src/types/recovery-plan.ts:96–98` comment cites `"Atlas Sandbox Search/Verify — read-only, real Atlas Sandbox inventory, executed inside Daytona sandbox"`; no such string exists in `core/provenance/labels.ts` (closest: `daytonaSandbox`). Comment only, not rendered.

---

## 4. Stale Claims (Consolidated)

1. **JSON manifest hardcoded `knownRemainingIssues` contradicts on-disk live evidence (critical).** Generated 2026-08-23, still contains verbatim:
   - `"No live Gemini request executed — adapter validated offline only via contract tests"`
   - `"No live Nosana job executed — client validated offline only via schema and mock tests"`

   Contradicted by evidence predating manifest generation: `smoke-tests/gemini/results/results-gemini-3.7-flash-success.json` (`"providerMode": "direct"`, `"modelIdentifier": "gemini-3.7-flash"`, `"runAt": "2026-08-22T03:52:48.955Z"`, `"outcome": "success"`); `live-verification-gemini-3.7-flash-2026-08-22T06-42-11-937Z.json` (exists); `smoke-tests/nosana/results/evidence/` (185 files incl. `2026-08-22T05-15-31-529Z-output_invalid.json` and `2026-08-22T05-32-55-889Z-completed_success-reconciled.json`, "RECONCILED live Nosana evidence"); evidence index: "Direct Gemini 3.7 live extraction succeeded. Nosana live job completed and reconciled offline." Root cause: `knownRemainingIssues` is a hardcoded literal array in `scripts/generate-submission-manifest.mjs` (lines 319–328), never updated after the 2026-08-22 live validations.
2. **Two mutually exclusive doc regimes.** Aug 21/22-AM corpus ("not executed / blocked / sandbox not attempted", ~15 docs incl. manifest, readiness-final, disclosure, judge-qa, presenter-script, status-display) vs Aug 22-PM/Aug 23 corpus (evidence index, evidence-status, SUBMISSION, README, dependency-graph-recovery: all three providers live-validated once). The disclosure doc even lists the now-true Sandbox claim as "false / prohibited".
3. **Three conflicting primary-video designations, selection unresolved:** manifest/readiness-final primary = `stitchcheck-full-voiceover-proof.mp4` (131 s); `SUBMISSION.md` primary = `stitchcheck-hackathon-demo-v2.mp4` (161 s); `docs/hackathon-demo-video-report.md` final candidate = `stitchcheck-hackathon-demo-v3.mp4` (166.3 s) with decision still open: "Which should be submitted?" — no later doc records the final selection (while disk reality shows `stitchcheck-demo-fixed-v1.mp4` is the newest render).
4. **README "Submitted" vs "Not uploaded".** `README.md` lines 9–10: "**Status:** Submitted" but "**Demo video:** `<YOUR_YOUTUBE_URL_HERE>`" and `git clone <repo-url>` placeholders; `docs/hackathon-demo-video-report.md` line 4: "Local preparation complete. **Not uploaded.** Awaiting your approval." and line 203: "No claim of hackathon submission completion." The "Submitted" status is not backed by any doc; the video URL placeholder is unfilled. Submission state is unverifiable.
5. **Deck PDF placeholder.** `docs/stitchcheck-submission-manifest.md` §3: "Deck file (to be attached) — _[PLACEHOLDER …]_". On disk only `output/submission/stitchcheck-deck/stitchcheck-deck.html` (20,342 bytes) and `generate_deck.py` exist. **No exported deck PDF exists anywhere under `output/`.**
6. **Test-count drift.** 92 (evidence index) vs 165 (JSON manifest, video report, GEMINI_INTEGRATION_COMPLETE) vs "300+" (README) for the Gemini offline suite; 37 modules (evidence index) vs 39 (readiness-final) for portability; `GEMINI_INTEGRATION_COMPLETE.md` also says "205 tests passing" and "Uses `gemini-2.5-flash` model" (superseded by `gemini-3.7-flash`). Ambiguous which count is current without re-running (prohibited).
7. **SHA-256 duplication anomaly.** Same hash `58af91f5…` appears for both `stitchcheck-hackathon-demo.mp4` (`docs/session-handoff-2026-08-22-live-provider-verification.md` line 87) and `stitchcheck-hackathon-demo-v3.mp4` (`docs/hackathon-demo-video-report.md` line 22) — same hash, two filenames. Unverifiable from docs alone; needs artifact check. (The JSON manifest itself contains no hashes of any artifact.)
8. **Stale video-dir `manifest.md`.** `output/demo-artifacts/stitchcheck-video/manifest.md` (2026-08-21): "Voiceover: Status: NOT PRODUCED" — contradicted by every subsequent render and by voice WAVs on disk.
9. Additional stale items: superseded session handoffs still presenting old status (`docs/session-handoff-2026-08-20-1549.md`, `-2026-08-21-voice-caption-proof.md`, `-2026-08-22-live-provider-verification.md` Phases 2–8 "PENDING"); `docs/stitchcheck-live-demo-status-display.md` Nosana card "BLOCKED" (mtime Aug 22 13:32, four minutes before the evidence index); `docs/stitchcheck-provider-authorization-matrix.md` line 14 "One live job submitted but output validation failed; local fallback used" (superseded half-state); `docs/stitchcheck-atlas-sandbox-smoke-test.md` "Status: PREPARED — NOT YET EXECUTED" (mtime Aug 22 10:51).
10. Generator drift: current `scripts/generate-submission-manifest.mjs` emits a `videoFreshness` field; the on-disk JSON lacks it (produced by an earlier generator version).

---

## 5. Protected-File Decisions

### 5.1 Git reality (read-only: `git status --short`, `git log --oneline -5`, `git diff --stat`)

Only 3 commits exist:

```
4959653 Remove exposed test key and add secret scanning
e88e66d Finalize StitchCheck hackathon submission evidence and provenance
47af5cb Prepare StitchCheck Gemini hackathon submission
```

**16 protected files (`app/src/**`, `scripts/**`, `smoke-tests/**`) are modified** (18 modified tracked files total; `git diff --stat` total 1,134 insertions / 391 deletions):

- Protected/core modified (changed after freeze commits `e88e66d`/`4959653`): `app/src/App.css`, `app/src/App.tsx`, `app/src/data/fixtures.ts`, `app/src/data/labels.ts` (collapsed to a re-export shim), `app/src/data/types.ts`; `app/package.json`, `app/tsconfig.app.json`, `app/vite.config.ts`; `scripts/secret-scan.mjs`, `scripts/stitchcheck-demo-capture.mjs`; `smoke-tests/gemini/direct-gemini-adapter.mjs` (+73 lines per diffstat), `smoke-tests/gemini/interactions-api-offline-tests.mjs`; `smoke-tests/nosana/nosana-cost-unit-tests.mjs`, `smoke-tests/nosana/nosana-risk-runner.mjs`, `smoke-tests/nosana/nosana-timeout-safety-tests.mjs`; `smoke-tests/provenance-label-offline-tests.mjs`; plus `.env.example` (+44 lines, config example).
- Non-protected modified: `Agentic AI Hackathon 2H.pdf` (deck re-export, 24.9 MB → 7.5 MB).

**Untracked/never committed — protected/core:**

- **`core/` (ENTIRE DIRECTORY NEVER COMMITTED)** — the canonical provenance/flags/safety module layer that `app/src/data/labels.ts` now depends on.
- `app/src/components/RecoveryPlanAnimation.{tsx,css}`, `app/src/components/SimulationPanel.tsx`, `app/src/data/daytona-offline-risk.ts`, `app/src/types/`
- **`workers/`** (daytona-atlas-worker, daytona-risk-worker)
- **18 untracked scripts** incl. `scripts/atlas-orchestrator.mjs`, all daytona orchestrators, `provenance-consistency-check.mjs`, `generate-submission-manifest.mjs`, capture/test scripts
- **5 smoke-tests**: `dependency-graph-offline-tests.mjs`, `gemini/live-interactions-verification-runner.mjs`, `nosana/nosana-safety-gate-tests.mjs`, `recovery-animation-accessibility-offline-tests.mjs`, `risk-computation-offline-tests.mjs` — plus live-evidence outputs (`smoke-tests/gemini/results/live-verification-gemini-3.7-flash-2026-08-22T06-42-11-937Z.json`, `smoke-tests/nosana/results/2026-08-22T05-27-57-614Z/`, `2026-08-22T05-32-04-134Z/`, `evidence/`).

**Rollback directories** (both present, untracked):
- `.rollback-2026-08-22/` → `config.json.bak`, `direct-gemini-adapter.mjs.bak`, `interactions-api-offline-tests.mjs.bak`, `evidence-sha256.txt`
- `.rollback-2026-08-22-postdiag/` → `direct-gemini-adapter.mjs.bak`, `live-interactions-verification-runner.mjs.bak`

Two rollback snapshots were taken on 2026-08-22 around the Gemini direct-integration/verification work (pre- and post-diagnosis). These dirs are backups, not git history; they would ship only if explicitly included. Stray `:memory:.ses` artifact at root (untracked).

JSON manifest records `noProtectedFilesModified: false` and discloses `app/src/` changes (`5 files changed, 256 insertions(+), 304 deletions(-)` across `App.css`, `App.tsx`, `fixtures.ts`, `labels.ts`, `types.ts`) — self-consistently disclosed, but the manifest does NOT claim an untouched working tree.

### 5.2 Decision needed (NOT performed by this task)

The submission is **NOT frozen at git level**: any submission built from HEAD would be missing `core/` entirely and would fail the `app/src/data/labels.ts` re-export chain. A human decision is required between: **(a) freeze/commit** — commit `core/`, `workers/`, the 18 scripts, the 5 smoke-tests, and the 16 modified protected files as the frozen submission state; or **(b) amend the manifest** to accurately reflect that protected files were modified and `core/` is uncommitted. This report performs neither.

---

## 6. Remaining Risks

1. **Secret-scan limitations** (source: `docs/secret-scan-usage.md` mtime Aug 23 22:58, and `scripts/secret-scan.mjs` 270 lines read fully):
   - **`.env*` files are hard-excluded in every mode** (code line 68): "The scanner **always skips** … **`.env*` filenames** — `.env`, `.env.local`, `.env.production`, etc. (hard exclusion to protect credential files from being scanned and accidentally surfaced in output)." The scanner cannot verify `.env.local` contents.
   - **Binary files skipped**: pdf, pptx, ppt, docx, doc, png, jpg, jpeg, gif, bmp, ico, svg, webp, mp3, mp4, wav, avi, mov, webm, ogg, zip, tar, gz, bz2, 7z, rar, exe, dll, so, dylib, woff, woff2, ttf, otf, eot, **key** (Keynote). A secret pasted into a slide deck would not be caught.
   - **`--all` is HEAD-only**: "Only the **last committed version** of each file is scanned. Uncommitted changes (staged or unstaged) are invisible to `--all`." **Git history is never scanned** — commit `4959653` ("Remove exposed test key") implies a key once existed in history; this scanner cannot detect it there.
   - **`--all` mode is broken** (per `docs/session-handoff-2026-08-23-stitchcheck-offline-complete.md` line 160): "`scripts/secret-scan.mjs --all` is broken because it applies a diff-line filter to raw file contents; untracked files are not covered by the scanner." The daytona handoff's report of the same `--all` run as "clean" is therefore questionable.
   - **No hook installed automatically**: "Running `npm run secret-scan` does not wire anything into git … Until you do, commits proceed without any secret scanning." (Whether a hook is actually installed in `.git/hooks/` was **not inspected — unverifiable**.)
   - **Default mode scans nothing in the current state**: default mode scans staged diff only; with everything currently unstaged/untracked, a default run scans nothing. Diff modes scan added lines only.
   - **Nonexistent allow-list referenced by the error message**: the failure message at line 263 advises "add them to the allow-list in scripts/secret-scan.mjs" — no allow-list exists in the code ("no built-in allow-list or ignore-list for known-safe values … the message is advisory only").
   - Also: pure regex, no entropy analysis; silent skips with no summary; no recursive `.env`-directory exclusion; no validation of findings (cannot distinguish real credentials from synthetic placeholders).
   - Complementary code-side controls exist: `core/safety/secrets.ts` (`looksLikeSecret()`, `redactForLogging()`/`createSafeLogger()`, `assertNoSecrets()`).
2. **Nosana runner `DEMO_MODE=local` guard gap** (08-23 handoff lines 125–139): `nosana-risk-runner.mjs` bypasses centralized `evaluateFlags()` — under `DEMO_MODE=local` + Nosana flags + `--live`, "the runner may proceed toward live execution despite local demo mode. Next action: apply and test the narrow `DEMO_MODE=local` guard before any live Nosana work." Not fixed (this task fixes nothing).
3. **Unverified 1544 test count**: no persisted logs; counts are only as fresh as the `2026-08-23T14:48Z` generator run; re-running was prohibited. Same for `typecheck: pass` / `build: pass`.
4. **No artifact hashes in JSON manifest** (no SHA-256 fields anywhere); the only SHA-256 records are the docs entries with the duplication anomaly (§4 item 7).
5. **Missing `app/public` evidence JSONs**: `app/public/` contains only `nosana-risk-result.json`; `daytona-evidence.json` and `atlas-evidence.json` are absent, so those loaders return `null` and callers fall back to fixtures — **graceful by design, not a defect**, but noted as a remaining gap.
6. **Live-capable scripts inventory**: `scripts/daytona-sandbox-plan.mjs` (ALLOW_LIVE guard), `scripts/daytona-provision-sandbox.sh` (DRAFT; performs network installs — `curl -LsSf https://astral.sh/uv/install.sh | sh`, apt-get, uv — if executed), plus outside `scripts/`: `smoke-tests/gemini/live-interactions-verification-runner.mjs` and `smoke-tests/nosana/run-risk-job.mjs --live` (each double-gated). Everything else is offline or localhost-only.

---

## 7. Final Submission Checklist (all unchecked — decisions required, none performed here)

- [ ] **Reconcile `knownRemainingIssues`** in `scripts/generate-submission-manifest.mjs` (lines 319–328) — remove/regenerate the hardcoded denials of live Gemini/Nosana execution that contradict on-disk evidence, then regenerate `output/submission-manifest.json`.
- [ ] **Choose and crown ONE canonical video** — resolve the three conflicting designations (§4 item 3) vs disk reality (`stitchcheck-demo-fixed-v1.mp4`, newest render); update `docs/stitchcheck-submission-manifest.md` §4/§9, `SUBMISSION.md` line 34, evidence index, and video report with the single selection; resolve the SHA-256 `58af91f5…` duplication anomaly.
- [ ] **Update stale doc counts/statuses** — Gemini 92→165 across 4 docs; portability 37→40 (evidence index); Nosana schema-validator 10 vs 0 parser artifact; reconcile the two mutually exclusive status regimes (Aug 21/22-AM corpus vs Aug 22-PM/23 corpus); fix the disclosure doc that lists a now-true claim as "false / prohibited".
- [ ] **Export the deck PDF** — replace the `_[PLACEHOLDER …]_` in `docs/stitchcheck-submission-manifest.md` §3; currently only the HTML (`output/submission/stitchcheck-deck/stitchcheck-deck.html`, 20,342 bytes) exists.
- [ ] **Fill README video URL or correct the "Submitted" status** — replace `<YOUR_YOUTUBE_URL_HERE>` / `<repo-url>` placeholders, or change "Status: Submitted" to match `docs/hackathon-demo-video-report.md` ("Not uploaded. Awaiting your approval.").
- [ ] **Decide git freeze** — commit `core/`, `workers/`, the 18 untracked scripts, the 5 untracked smoke-tests, and the 16 modified protected files, OR amend the manifest; decide disposition of `.rollback-2026-08-22*/` dirs and stray `:memory:.ses`.
- [ ] **Run secret-scan with `--untracked` + `--working-tree`** (default mode scans nothing in the current unstaged state); note `--all` is documented broken; install the pre-commit hook if desired; human-review any findings (scanner cannot validate them).
- [ ] **Record human sign-offs** — Gate A/B/C checkboxes, authorization-matrix sign-off blocks, Nosana separate explicit approval, submission-level checklist (§9); all are currently blank despite live executions having occurred.

---

## 8. Provider Readiness — Gemini / Nosana / Atlas (Separate)

> **08-23 handoff caveat (latest-dated doc, lines 216–218):** "It is not yet live-provider verified. No live-provider readiness claim should be made for Gemini, Nosana, or Atlas until the remaining safety gates and explicit authorization requirements are satisfied."

### 8.1 Gemini (direct; OpenRouter historical)

- **Documented live evidence:** Direct Gemini 3.7 live extraction succeeded once via `ai.interactions.create` — evidence index line 51: "Gemini 3.7 (`gemini-3.7-flash`) via `ai.interactions.create`; outcome: success; schema-valid; `fallbackUsed: false`; latency ~4922 ms. Live extraction validated." Artifacts/IDs: `smoke-tests/gemini/results/results-gemini-3.7-flash-success.json` (`"providerMode": "direct"`, `"runAt": "2026-08-22T03:52:48.955Z"`, `"outcome": "success"`); `live-verification-gemini-3.7-flash-2026-08-22T06-42-11-937Z.json`; GEM-01 / GEM-LIVE-01 (OpenRouter — labelled `Historical temporary OpenRouter test path — not the active provider`). Gemini 3.6 "live-verified previously" (`SUBMISSION.md` line 68; `docs/evidence-status.md` line 10).
- **Contradicting stale docs:** `docs/stitchcheck-submission-manifest.md` lines 115/169 "Direct Gemini | **Not executed.** Pass/fail is intentionally blank."; `docs/stitchcheck-final-submission-readiness-final.md` line 145 "**No direct Gemini call was made.**"; `docs/stitchcheck-deck-final-copy.md` line 167 "⬜ Not executed" vs same file line 182 speaker note "Direct Gemini 3.7 live extraction was verified separately" (**internal contradiction**); `docs/stitchcheck-tomorrow-rehearsal-pack.md` line 39 vs 65/155 (**internal contradiction**); `docs/stitchcheck-eight-slide-visual-spec.md` line 271; `docs/stitchcheck-hackathon-requirements-decision.md` line 67; `docs/gemini-live-smoke-test-authorization-packet.md` line 13; `smoke-tests/gemini/results/evidence-stub.md` line 30; `GEMINI_INTEGRATION_COMPLETE.md` line 187. JSON manifest `knownRemainingIssues` still denies it (§4 item 1).
- **Qualified README caveat:** `README.md` line 38: "implemented and offline-validated; **a later live verification attempt during final polish returned a transient error and was not retried, per project safety rules.** The previously captured successful live evidence artifact remains available in `smoke-tests/gemini/results/`." Corroborated by 08-23 handoff line 145 (retry path interacted with the single-request guard).
- **Explicitly NOT done:** no live extraction inside the browser demo (walkthrough uses local fixture — evidence index line 115); no retry of the failed final-polish attempt. Authorization-packet prerequisites (§9) remain owner-pending.

### 8.2 Nosana

- **Documented live evidence:** one live job accepted and completed 2026-08-22 — evidence index line 52: "Nosana live job accepted and completed; result reconciled offline. Job `BNZTHNoARu98EdaqPU5WiCaFWZAyU1e9NYCZJj2h1afY` accepted and completed on market `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` … `riskScore: 0.2895`, `riskBand: medium`, `simulationCount: 800`. `creditsUsed: 44` … `costUsd: 0.044`." Result recovered via `opStates.logs.log` parser fix. Artifacts/IDs: `smoke-tests/nosana/results/evidence/2026-08-22T05-15-31-529Z-output_invalid.json` (original), `2026-08-22T05-32-55-889Z-completed_success-reconciled.json`, `opstates-live-result-sanitized.json`, 185 evidence files total; earlier blocked attempt NOS-LIVE-01 / NOS-ATTEMPT-001 (`smoke-tests/nosana/results/2026-08-20T15-53-43Z/`). `docs/stitchcheck-nosana-live-ready-final.md` line 3: lead gate passed, 10 gates, `@nosana/kit@2.7.5`.
- **Contradicting stale docs:** `docs/stitchcheck-submission-manifest.md` line 142 "Live execution | **Not executed, not deployed, not authenticated.**"; `docs/stitchcheck-final-submission-readiness-final.md` line 143 "**No paid Nosana workload was submitted.**"; `docs/stitchcheck-live-demo-status-display.md` line 57 "BLOCKED … No workload deployed" (mtime Aug 22 13:32 — same reconciliation batch as the evidence index); `docs/stitchcheck-tomorrow-rehearsal-pack.md` lines 44/306 "remains entirely offline"; `docs/stitchcheck-live-demo-presenter-script.md` line 77; `docs/stitchcheck-judge-qa.md` line 80; `docs/stitchcheck-hackathon-requirements-decision.md` lines 88/131; `docs/stitchcheck-eight-slide-visual-spec.md` line 272; `docs/stitchcheck-deck-final-copy.md` line 169 "⬜ Not verified"; authorization-matrix line 14 superseded half-state.
- **Explicitly NOT done:** evidence index line 116: "No new submission was made during reconciliation. The browser walkthrough uses a local fallback fixture, not the live evidence. Reliable live execution, deployment, funding, polling, cancellation, or live provider behaviour beyond the single completed job [is not proven]." **Unresolved safety gap (08-23 handoff lines 125–139):** `nosana-risk-runner.mjs` bypasses centralized `evaluateFlags()` — `DEMO_MODE=local` guard must be applied and tested before any live Nosana work. Separate explicit human approval for any further submission is required and unrecorded (§9).

### 8.3 Atlas (Sandbox / Production)

- **Documented live evidence:** auth via official Skill (ATRIP browser authorization); production searches PVG→NRT/HND (5 offers) and SIN→BKK (8 offers) under **ATL-LIVE-01**, all `price_status: reference`, `bookable: false`; Sandbox Search+Verify **ATL-SBX-SV-01** — evidence index line 54: "ATL-SBX-SV-01 | PARTIAL_SUCCESS: environment switch ✅, search (20 offers KUL→SIN) ✅, offer list ✅, verify (PRICE_CONFIRMATION_REQUIRED) ✅. Hard stop after Verify. No write call made." ($64.38→$203.99; environment restored to Production.) Artifact: `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json`; also `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/` (`atlas-live-result.md`, `gemini-live-result.md`, `nosana-live-result.md`, `summary.md`).
- **Contradicting stale docs — most severe single contradiction in the corpus:** `docs/stitchcheck-atlas-live-disclosure.md` (self-labelled "Status: FINAL … Date: 2026-08-21") §2.1 line 68 "**Status**: ❌ Sandbox rehearsal was not attempted." and §5 lists as a **prohibited false claim**: "Atlas Sandbox search was executed or returned results" — directly conflicting with ATL-SBX-SV-01 (executed 2026-08-21T07:02). Also: `docs/stitchcheck-judge-qa.md` line 80 ("no Sandbox switch command in CLI v0.3.12"); `docs/stitchcheck-hackathon-requirements-decision.md` line 79; `docs/stitchcheck-submission-manifest.md` line 130 "Sandbox booking rehearsal | Not yet attempted" (its own §10 disclosure mentions ATL-SBX-SV-01 — **internal inconsistency in the same file**); `docs/stitchcheck-atlas-sandbox-smoke-test.md` line 3 "PREPARED — NOT YET EXECUTED" (mtime Aug 22 10:51); `docs/stitchcheck-atlas-sandbox-readiness.md` line 184.
- **Explicitly NOT done:** evidence index line 117: "No booking, payment, ticket, order, verification, or any write action was created. Ticketing activation is pending. Production booking, payment, ticketing, and reliability remain unproven." Ticketing: `ticketing_available: false`, `TICKETING_ACTIVATION_REQUIRED`. Contradicting latest view: 08-23 handoff lines 151–153: "Atlas live-readiness remains incomplete. The adapter/orchestrator boundary exists, but concrete SDK/client wiring, credential loader configuration, capability approval, and target environment configuration still require review."

---

## 9. Exact Owner Approvals Required

**`docs/stitchcheck-final-human-approval-checklist.md`** — three independent gates; "No execution may occur without explicit written human approval for each gate":

- [ ] **Gate A — Atlas Sandbox Search→Verify** (Owner: Human reviewer): A-01 confirm read-only, no write (command `node smoke-tests/atlas/run-sandbox-search-verify.mjs`); A-02 environment restored to Production; A-03 ticketing activation is a separate ATRIP admin action. Status column (line 136): "✅ Already executed (read-only). No further action needed." — **but checkboxes remain unchecked; no recorded human signature.**
- [ ] **Gate B — Nosana one bounded non-PII workload** (Owner: Human reviewer): prerequisites (SDK install, credit balance > 0, market verified via `GET /api/markets`, `validateJobDefinition()`); B-01…B-05 (approve one job; job-definition hash `python:3.12-slim`, schema "0.1", `nonPiiDeclaration: true`; no PII; fallback behavior; "maximum spend is US$10.00 and accept the estimated cost of ~$0.0008"). **All unchecked.**
- [ ] **Gate C — Gemini one direct extraction call** (Owner: Human reviewer): prerequisites (`@google/genai` installed, model ID approved in `provider-capabilities.json`, `directGeminiEnabled: true`, safety settings, entry point); C-01…C-05 (one request, `maxRetries: 0`, 60 s timeout, sanitized output, "human must fill in" model identifier). **All unchecked.**

**`docs/stitchcheck-provider-authorization-matrix.md`:** 15 gates per provider (Gemini, Atlas), each "Owner: Human reviewer", all recorded as "**Pending**" (lines 20–34) — despite the same doc's status table acknowledging live evidence already exists; sign-off blocks (lines 111–135) are **blank**. Final rule (line 139): "No provider request may occur until every applicable matrix gate is complete, the exact request scope is approved, and a human records GO for that provider."

**Nosana lead-gate + separate explicit approval chain:** `docs/stitchcheck-nosana-live-ready-final.md` line 188: "DO NOT EXECUTE WITHOUT SEPARATE EXPLICIT HUMAN APPROVAL. … Live submission requires, in order: (1) lead gate clearance … then (2) separate explicit human approval of the exact submission, including the allowlisted image and the 120-second timeout." Supersession chain: `nosana-final-live-approval.md` ("NOT READY — CONTAINER IMAGE BLOCKER") → `nosana-live-approval-update.md` ("PREPARED — AWAITING LEAD GATE + SEPARATE EXPLICIT HUMAN APPROVAL") → `nosana-live-ready-final.md` ("LEAD-GATE COMPLETE — ALL 10 GATES PASS — AWAITING SEPARATE EXPLICIT HUMAN APPROVAL"). The live job executed, yet the separate explicit approval is not recorded anywhere.

**Gemini authorization packet prerequisites:** `docs/gemini-live-smoke-test-authorization-packet.md` — 9+ prerequisites, each "**Owner: Human**" (SDK review, image-input support, structured-output support, model identifier, capability status, `directGeminiEnabled`, secure credential, cost/quota/retention review, DI wiring).

**Submission-level sign-offs:** `docs/stitchcheck-submission-manifest.md` §11 (20 items, incl. "Human has read and approved this manifest before submission"); `docs/stitchcheck-final-submission-readiness-final.md` §6–7 — five open human decisions (Nosana live attempt, direct Gemini live attempt, Atlas ticketing activation, deck file export, submission format) and a Go/No-Go checklist, all unchecked; `docs/hackathon-demo-video-report.md` §10: video upload and git push "Awaiting your explicit approval."

**Ambiguity flag:** no document contains a *filled-in* human signature/sign-off (matrix sign-off blocks blank; Gate A–C checkboxes unchecked), **yet live executions (Gemini 3.7, Nosana job, ATL-SBX-SV-01) occurred.** Approval evidence exists only as prose assertions in later docs; the formal approval records are unverifiable from docs alone.

---

## Overall Recommendation

**Recommendation: NO-GO for declaring full submission readiness** until the Section 7 checklist items are resolved and the Section 9 human approvals are recorded. This is a reconciliation conclusion, not a judgment on the offline work — the offline demo is genuinely complete and internally consistent at the artifact level; what is incomplete is the *record*: contradictory manifests/docs, an unfrozen repository, an unverified test count, an uncrowned video, and blank approval records.

```text
Offline demo is complete.
Live-provider verification is not complete.
No provider call is authorized by this task.
```

**Final attestation:** this task modified no files other than creating `docs/stitchcheck-final-go-no-go.md`, read no credentials (`.env.local` was not read), made no provider calls, ran no tests/builds, installed nothing, committed/pushed/uploaded/submitted nothing, and fixed none of the issues documented above.
