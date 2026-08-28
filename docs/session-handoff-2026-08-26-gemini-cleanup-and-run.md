# StitchCheck Session Handoff — 2026-08-26 Gemini Cleanup & Dev Server

## Purpose

Execute the dead Gemini harness removal from `a/cursor-prompt-gemini-cleanup-and-run.txt`: delete confirmed-unused direct-Gemini extraction test files, run full regression, and start the dev server with `DATA_MODE=live` for manual demo checking. No commit, push, or provider execution.

## Prompt source

`a/cursor-prompt-gemini-cleanup-and-run.txt`

## What was done

### 1. Dead Gemini harness removed (`smoke-tests/extraction/`)

Deleted three files confirmed unused at runtime (live extraction uses `openrouter-extraction-adapter`; `app/` and `core/` never imported the direct-Gemini module):

| File | Reason |
|---|---|
| `smoke-tests/extraction/direct-gemini-adapter.mjs` | Restored in prior session for investigation; not wired into app runtime |
| `smoke-tests/extraction/gemini-3.7-routing-regression-tests.mjs` | Failed on config drift (OpenRouter/MiniMax pins), not missing code |
| `smoke-tests/extraction/interactions-api-offline-tests.mjs` | Same config drift; live path covered by `openrouter-extraction-adapter-offline-tests.mjs` |

**Not touched:** Atlas write routes, Nosana execution, OpenRouter/MiniMax extraction logic, route-continuity, best-option, disclosure-dedup, screen-consolidation, video/narration/subtitle files.

### 2. Grep / reference audit

| Location | Result |
|---|---|
| `app/` | No `direct-gemini`, `gemini-3.7-routing`, or `interactions-api-offline` references |
| `core/` | No references |
| `smoke-tests/extraction/config.json` | OpenRouter/MiniMax only; direct Gemini in `deprecated` block |
| Manifest / CI / `package.json` | No references to the three deleted `extraction/` paths — **no manifest cleanup needed** |
| `scripts/generate-submission-manifest.mjs` | Lists `smoke-tests/gemini/` copies only (separate legacy tree) |

**Remaining (intentional or orphaned, not blocking):**

- `smoke-tests/extraction/live-interactions-verification-runner.mjs` — orphan; still imports deleted `./direct-gemini-adapter.mjs`. Not in `*-tests.mjs` sweep. Safe to delete in a follow-up.
- `smoke-tests/extraction/provider-capabilities.json` — historical `gemini-3.7-flash` deprecation note.
- `smoke-tests/extraction/results/*.json` — archived live-evidence artifacts.
- `smoke-tests/gemini/` — full legacy Gemini tree still on disk (out of scope for this prompt).
- `docs/`, `README.md` — historical/changelog mentions.

### 3. Regression verification

```bash
cd app && npm run typecheck   # PASS
cd app && npm run build       # PASS (71 modules)

# Full smoke-tests *-tests.mjs sweep
for f in smoke-tests/**/*-tests.mjs; do node "$f"; done
```

| Metric | Result |
|---|---|
| Suites run | **36** (was 38; 2 Gemini extraction suites removed) |
| Previously-passing | **35/35** still pass |
| Pre-existing failure | `nosana/nosana-cost-unit-tests.mjs` — 79 pass / **3 fail** (dry-run metadata; documented, out of scope) |
| OpenRouter extraction | `openrouter-extraction-adapter-offline-tests.mjs` — 20/20 pass |

No broken imports from the deletion in any suite in the sweep.

### 4. Dev server started for manual check

- Command: `cd app && npm run dev` (background)
- URL: http://localhost:5173/
- Verified: HTTP **200**, valid HTML
- `DATA_MODE=live` confirmed in Vite log: `[atlas-proxy] registering middleware, DATA_MODE=live`
- Source: `.env.local` line 16 (`DATA_MODE=live`)

## Files deleted (this session)

- `smoke-tests/extraction/direct-gemini-adapter.mjs`
- `smoke-tests/extraction/gemini-3.7-routing-regression-tests.mjs`
- `smoke-tests/extraction/interactions-api-offline-tests.mjs`

## Files modified

None (deletions only).

## Constraints observed

- Did **not** touch Atlas write routes, Nosana execution, OpenRouter extraction, route-continuity, or screen-consolidation logic.
- Did **not** touch video, narration, or subtitle files.
- Did **not** weaken unrelated test assertions.
- Did **not** commit or push.

## Manual check path

Welcome → **Try a sample itinerary** → **Check my itinerary** → expand **See why this is risky** / **How this works** / **See more verified options** → Keep or Switch → Done.

## Status block

```text
GEMINI_CLEANUP_STATUS = REMOVED
REGRESSION_STATUS = ALL_PASS (35/35 previously-passing; nosana-cost-unit-tests pre-existing 3 internal failures unchanged)
DEV_SERVER_STATUS = RUNNING at http://localhost:5173/
READY_FOR_MANUAL_CHECK = YES
```

## Recommended next actions

1. **Optional cleanup:** Delete `smoke-tests/extraction/live-interactions-verification-runner.mjs` (orphan after adapter removal).
2. **Optional:** Decide whether to retire the entire `smoke-tests/gemini/` tree or keep it as archived evidence-only.
3. **Manual demo:** Walk the flow above in the browser while the dev server is up.
4. **If committing:** Stage only the three deletions (+ this handoff if desired); do not commit `.env.local`.

## Session status

**COMPLETE** — Dead Gemini extraction harness removed; regression green for previously-passing suites; dev server live for manual check.
