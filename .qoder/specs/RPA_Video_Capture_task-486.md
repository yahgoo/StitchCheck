## Plan: StitchCheck Recovery Animation Video Capture

### 1. Create the capture script

**New file**: `scripts/stitchcheck-recovery-animation-video-capture.mjs`

This script is modeled on the existing `stitchcheck-recovery-animation-capture.mjs` (same dev-server bootstrap, same navigation flow) but replaces the screenshot with Playwright video recording.

Key differences from the existing screenshot capture script:
- Browser context created with `recordVideo: { dir: './recordings', size: { width: 1280, height: 800 } }`.
- No CSS transition-disabling injection (that was for deterministic screenshots; the video must show the real animation).
- Phase polling every 200ms with timestamp logging to the console.
- After `done` is reached, wait 3 additional seconds before stopping.
- Close the browser context (not just the browser) so Playwright flushes the video file.
- Rename the resulting `.webm` to a descriptive filename.
- Optionally convert to `.mp4` via `ffmpeg` (confirmed available at `/opt/homebrew/bin/ffmpeg`).

### 2. Script flow (step by step)

```
a. Start Vite dev server on port 5174 (or next free port) if not already running.
   - Reuse the same isStitchCheckRunning() / ensureDevServer() logic from the existing script.

b. Launch Chromium headless with Playwright.
   - Create browser context with:
       viewport: { width: 1280, height: 800 }
       recordVideo: { dir: '<workspace>/recordings', size: { width: 1280, height: 800 } }

c. Navigate to http://localhost:<port>/
   - waitUntil: 'networkidle', timeout 30s

d. Wait for [data-demo-ready="true"] (timeout 15s)

e. Click safety notice button:
   - page.getByRole('button', { name: 'I understand — continue with demo itinerary' }).click()

f. Wait for .sc-upload-panel, select fixtures:
   - page.selectOption('#screenshot-0', 'gem-01')
   - page.selectOption('#screenshot-1', 'gem-01')

g. Click 'Continue to review'
   - Wait for section.sc-itinerary-review to become visible

h. Click 'Confirm itinerary'
   - Wait 800ms for async fixture loading to settle

i. Wait for [data-demo-ready="true"] again (timeout 15s)

j. Locate .rpa element

k. Poll data-rpa-phase every 200ms:
   - Log each transition with an elapsed timestamp (ms since "Confirm itinerary" click)
   - Expected sequence: trigger -> cascade -> candidates -> collapse -> freshness -> done

l. Once phase === 'done', wait 3000ms more (stable hold), then:
   - Close the browser context (context.close()) — this finalizes the video file
   - Close the browser

m. Find the .webm file in ./recordings/, rename to:
   stitchcheck-recovery-animation-<ISO-timestamp>.webm

n. If ffmpeg is available, convert to .mp4:
   ffmpeg -i <input>.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart <output>.mp4
   Report both files; the .mp4 is the primary deliverable.

o. Kill the dev server if we started it.

p. Print the final report (see section 4 below).
```

### 3. Output location

- Video saved to `<workspace>/recordings/` (created if missing).
- `recordings/` is NOT in `.gitignore` yet, so add a one-line entry `recordings/` to `.gitignore` to prevent accidental commits. This is a config safety guard, not an application source change.
  - Alternative: save under `output/recordings/` which is already gitignored. This avoids touching `.gitignore` at all. **Recommended** since it respects the "do not modify source files" restriction more conservatively.

### 4. Final report (printed to console)

The script will output:
1. Local URL and port used
2. Full `data-rpa-phase` sequence with timestamps (ms since trigger)
3. Path/filename of saved video (.webm and/or .mp4)
4. Video duration (from phase timestamps + 3s hold)
5. Confirmation of complete sequence coverage
6. `git status --short` check confirming no source modifications
7. Confirmation no credentials/.env.local accessed
8. Execution mode (offline — `daytona-offline-mock`)
9. Dev-server cleanup status

### 5. Execution

Run via:
```bash
node scripts/stitchcheck-recovery-animation-video-capture.mjs --port 5174
```

### 6. Files touched

| File | Action |
|------|--------|
| `scripts/stitchcheck-recovery-animation-video-capture.mjs` | **Create** (new capture script) |
| `recordings/` (or `output/recordings/`) | **Create** directory (auto by script) |
| `recordings/stitchcheck-recovery-animation-*.webm` | **Create** (video output) |
| `recordings/stitchcheck-recovery-animation-*.mp4` | **Create** (if ffmpeg conversion succeeds) |
| No application source files | **Unchanged** |
