# StitchCheck Automated Demo-Capture Workflow

## Overview

Deterministic, zero-click browser capture of the complete StitchCheck demo flow.
Uses Playwright/Chromium to drive the local Vite dev server through all 6 demo
scenes, capturing screenshots with evidence-label assertions at each step.

**Properties:**
- Deterministic browser launch with fixed viewport (1920×1080).
- Seeded synthetic demo data (GEM-01 fixture only).
- Automatic capture of the complete StitchCheck flow (6 scenes).
- Visible evidence labels verified at every scene.
- No manual clicking — fully automated.
- Reproducible output in timestamped directories.
- Graceful fallback if a live Nosana result is unavailable.

---

## Command to Run

### Prerequisites

```bash
# Install Playwright in the scripts directory (one-time)
cd scripts && npm install

# Chromium browser (one-time)
npx playwright install chromium
```

### Run the capture

```bash
# Default (headless, port 5174)
node scripts/stitchcheck-demo-capture.mjs

# Custom port
node scripts/stitchcheck-demo-capture.mjs --port 5175

# Headed mode (visible browser)
node scripts/stitchcheck-demo-capture.mjs --headed

# Via npm script (from app/)
cd app && npm run capture
```

---

## Expected Output Files

All files are written to a timestamped directory under `output/captures/`:

```
output/captures/capture-YYYY-MM-DDTHH-MM-SS/
├── capture-manifest.json       # Structured JSON report
├── scene-01-locked.png         # Review-First Gate — locked downstream panels
├── scene-02-edited-field.png   # User Correction — edited flight number SC-299
├── scene-03-confirmed-unlocked.png  # Confirmation Gate Unlocked (full page)
├── scene-04-provider-status.png     # Service Roles and Evidence — provider labels
├── scene-05-comparison.png     # Risk vs Alternatives — comparison view
└── scene-06-keep-switch-final.png   # Demo Complete — no external action
```

### Manifest fields

| Field | Description |
|-------|-------------|
| `captureTimestamp` | ISO-8601 timestamp of the capture run |
| `appUrl` | URL of the dev server used |
| `viewport` | `{ width, height }` |
| `outputDirectory` | Absolute path to the output directory |
| `durationSeconds` | Total wall-clock duration |
| `overallStatus` | `"pass"` or `"fail"` |
| `evidenceLabels` | Required disclaimer labels and accepted variants |
| `scenes[]` | Per-scene results: `{ scene, file, status, nosanaSource? }` |
| `gracefulFallback.nosanaResultSource` | `"local-fallback"` or `"nosana-evidence"` |

---

## Duration

Typical end-to-end capture: **5–8 seconds** (headless Chromium).

| Phase | Duration |
|-------|----------|
| Dev server startup (if needed) | 2–5 s |
| Browser launch | 1–2 s |
| 6 scenes (navigate + assert + screenshot) | 3–5 s |
| Manifest generation | < 0.1 s |

---

## Scenes Captured

| # | Scene | Key assertions |
|---|-------|----------------|
| 1 | Locked downstream panels | 2 disabled panels, lock icons, "Confirm itinerary first", Gemini + Nosana + Atlas labels |
| 2 | Edited itinerary field | Flight number SC-202 → SC-299, correction note visible, panels remain locked |
| 3 | Confirmed and unlocked | Status banner, panels unlocked, Nosana + Atlas labels visible |
| 4 | Provider status | Risk band (medium), score, Nosana source label, Gemini label still present |
| 5 | Comparison view | Comparison heading, 2 alternative rows, Atlas + Nosana labels |
| 6 | Decision and final state | "Keep current plan" selected, final statement, metadata (noOrderCreated, syntheticDemo, externalCallsMade) |

---

## Evidence Labels Verified

All three required disclaimer labels are verified on screen:

| # | Label | Scene(s) verified |
|---|-------|-------------------|
| 1 | `OpenRouter temporary path — not direct Gemini validation` | 1, 4 |
| 2 | `Synthetic local placeholder — not Nosana evidence` (or fallback variant) | 1, 3, 4, 5 |
| 3 | `Synthetic local placeholder — not Atlas Sandbox evidence` | 1, 3, 5 |

The Nosana label accepts three valid variants depending on app state:
- `"Synthetic local placeholder — not Nosana evidence"` — base fixture (locked panels)
- `"Nosana unavailable — local fallback used; not Nosana evidence"` — fallback after confirmation
- `"Nosana evidence — …"` — live Nosana result (if ever served)

---

## Failure Recovery

### Automatic recovery

The script implements **whole-flow retry** (up to 2 attempts). If any scene fails:
1. The browser is closed.
2. A fresh browser is launched.
3. The entire 6-scene flow restarts from scratch.

This ensures deterministic state — no stale React state or partial navigation.

### Manual recovery

If the script exits with a non-zero code:

1. **Dev server not starting:** Check that port 5174 (or `--port`) is free. Kill any existing process: `lsof -i :5174`.
2. **Playwright browser error:** Run `npx playwright install chromium` from `scripts/`.
3. **App build error:** Run `cd app && npm run typecheck && npm run build` to verify the app compiles.
4. **Stale dev server:** If the script detects a non-StitchCheck app on the target port, it starts a new server. Use `--port` to specify a different port.

### Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Dev server did not start within 30 seconds` | Port occupied or npm not available | Use `--port` or kill existing process |
| `Expected 2 disabled panels, found N` | App code changed | Run `npm run typecheck` in `app/` |
| `nosanaSource: "nosana-evidence"` | Live Nosana result served | This is valid — manifest records the source |

---

## Graceful Fallback

The app's `loadNosanaRiskResult()` function attempts to fetch `/nosana-risk-result.json`.
- If the file exists and contains valid data, the app uses it (and labels it accordingly).
- If the fetch fails (404, network error), the app falls back to the local synthetic fixture.

The capture script records which path was taken in the manifest's `gracefulFallback.nosanaResultSource` field. Both paths produce valid, labelled output.

---

## Changed Files

| File | Action |
|------|--------|
| `scripts/stitchcheck-demo-capture.mjs` | **Created** — main capture script |
| `scripts/package.json` | **Created** — Playwright dependency for scripts |
| `app/package.json` | **Modified** — added `capture` npm script |

### Not modified (by design)

- `app/src/` — no application code changes
- `.env.local` — not accessed
- `docs/` — no existing documentation changed
- `smoke-tests/` — no test changes
- `output/demo-artifacts/` — existing video assets untouched
- No provider integrations, Atlas ticketing, Nosana, or credentials touched
