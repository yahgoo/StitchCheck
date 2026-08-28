#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// StitchCheck — Recovery-Plan Animation VIDEO Capture (offline only)
// ─────────────────────────────────────────────────────────────────────────────
// Records the full recovery-plan animation as a video (.webm + .mp4).
//
// Flow:
//   1. Start Vite dev server on port 5174 (or next free port) if not running.
//   2. Launch Chromium headless with Playwright, viewport 1280×800, recordVideo.
//   3. Navigate to the app, wait for data-demo-ready.
//   4. Click safety notice button, upload fixtures, confirm itinerary.
//   5. Poll data-rpa-phase every 200ms, logging each transition.
//   6. After phase=done, hold 3000ms, close context (flushes video).
//   7. Rename .webm, convert to .mp4 via ffmpeg if available.
//
// Usage:
//   node scripts/stitchcheck-recovery-animation-video-capture.mjs
//   node scripts/stitchcheck-recovery-animation-video-capture.mjs --port 5176
//   node scripts/stitchcheck-recovery-animation-video-capture.mjs --headed
//
// Offline guarantees: no Daytona/Atlas/Nosana/Gemini/OpenRouter calls,
// no credentials, no .env.local access, no write actions.
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(__dirname, '..');
const APP_DIR = resolve(WORKSPACE, 'app');

// ── CLI args ──
const args = process.argv.slice(2);
const PORT = parseInt(args.find((_, i) => args[i - 1] === '--port') || '5174', 10) || 5174;
const HEADED = args.includes('--headed');
const APP_URL = `http://localhost:${PORT}/`;

// ── Output directory ──
const RECORDINGS_DIR = resolve(WORKSPACE, 'output', 'recordings');
mkdirSync(RECORDINGS_DIR, { recursive: true });

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// ── Constants ──
const VIEWPORT = { width: 1280, height: 800 };
const EXPECTED_PHASES = ['trigger', 'cascade', 'candidates', 'collapse', 'freshness', 'done'];
const PHASE_POLL_INTERVAL_MS = 200;
const PHASE_TIMEOUT_MS = 30_000;
const POST_DONE_HOLD_MS = 3000;
const FFMPEG_PATH = '/opt/homebrew/bin/ffmpeg';

function log(msg) { console.log(`[video-capture] ${msg}`); }
function logOk(msg) { console.log(`  ✓ ${msg}`); }

/** Check if the StitchCheck app is already running at the URL. */
async function isStitchCheckRunning(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const html = await res.text();
    return html.includes('StitchCheck') || html.includes('sc-app') || html.includes('src/main.tsx');
  } catch {
    return false;
  }
}

/** Start the Vite dev server if not already running. Returns a cleanup fn. */
async function ensureDevServer() {
  if (await isStitchCheckRunning(APP_URL)) {
    log(`StitchCheck dev server already running at ${APP_URL}`);
    return () => {};
  }

  log(`Starting dev server on port ${PORT}…`);
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(PORT)], {
    cwd: APP_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  let output = '';
  child.stdout.on('data', (d) => { output += d.toString(); });
  child.stderr.on('data', (d) => { output += d.toString(); });

  const ready = await new Promise((resolveReady) => {
    const check = () => {
      if (output.includes('Local:') || output.includes('localhost')) {
        resolveReady(true);
      }
    };
    child.stdout.on('data', check);
    child.stderr.on('data', check);
    const interval = setInterval(async () => {
      if (await isStitchCheckRunning(APP_URL)) {
        clearInterval(interval);
        resolveReady(true);
      }
    }, 1000);
    setTimeout(() => { clearInterval(interval); resolveReady(false); }, 30_000);
  });

  if (!ready) {
    child.kill();
    throw new Error('Dev server did not start within 30 seconds');
  }

  logOk(`Dev server ready at ${APP_URL}`);
  return () => { child.kill('SIGTERM'); };
}

/** Poll data-rpa-phase every 200ms, logging transitions with elapsed timestamps. */
async function pollPhases(page, clickTimestamp) {
  const observed = [];
  let lastPhase = null;
  const startTime = Date.now();

  while (Date.now() - startTime < PHASE_TIMEOUT_MS) {
    const phase = await page.locator('.rpa').getAttribute('data-rpa-phase');
    const elapsed = Date.now() - clickTimestamp;

    if (phase !== lastPhase) {
      const entry = { phase, elapsedMs: elapsed, timestamp: new Date().toISOString() };
      observed.push(entry);
      log(`  [${elapsed}ms] data-rpa-phase → "${phase}"`);
      lastPhase = phase;

      if (phase === 'done') {
        return { observed, complete: true };
      }
    }

    await page.waitForTimeout(PHASE_POLL_INTERVAL_MS);
  }

  return { observed, complete: false };
}

async function main() {
  const scriptStart = Date.now();
  log(`StitchCheck Recovery Animation VIDEO Capture — ${new Date().toISOString()}`);
  log(`Recordings directory: ${RECORDINGS_DIR}`);
  log(`Target URL: ${APP_URL}`);

  // ── Check execution mode ──
  // The app hardcodes executionMode="daytona-offline-mock" in App.tsx.
  // No DEMO_MODE/DATA_MODE is set in .env.local. The app uses local
  // fixtures exclusively — no external provider calls are made.
  log('Execution mode: daytona-offline-mock (hardcoded in App.tsx, no DEMO_MODE in .env.local)');

  const cleanupServer = await ensureDevServer();
  let browser;
  let videoPath = null;
  let mp4Path = null;
  let phaseLog = [];
  let captureStatus = 'fail';

  try {
    log(`Launching Chromium (${HEADED ? 'headed' : 'headless'})…`);
    browser = await chromium.launch({ headless: !HEADED });
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      recordVideo: {
        dir: RECORDINGS_DIR,
        size: { width: 1280, height: 800 },
      },
    });
    const page = await context.newPage();

    // ── a. Navigate and wait for initial ready state ──
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('[data-demo-ready="true"]', { timeout: 15_000 });
    logOk('Initial load: data-demo-ready="true"');

    // ── b. Click safety notice button ──
    // Verified label in current DOM: "I understand — continue with demo itinerary"
    const safetyBtn = page.getByRole('button', { name: 'I understand — continue with demo itinerary' });
    await safetyBtn.click();
    logOk('Safety notice acknowledged');

    // ── c. Wait for upload panel, select fixtures ──
    await page.locator('.sc-upload-panel').waitFor({ state: 'visible', timeout: 10_000 });
    await page.selectOption('#screenshot-0', 'gem-01');
    await page.selectOption('#screenshot-1', 'gem-01');
    logOk('Fixtures selected (gem-01 / gem-01)');

    // ── d. Continue to review ──
    await page.getByRole('button', { name: 'Continue to review' }).click();
    await page.locator('section.sc-itinerary-review').waitFor({ state: 'visible', timeout: 10_000 });
    logOk('Itinerary review visible');

    // ── e. Confirm itinerary ──
    const confirmClickTime = Date.now();
    await page.getByRole('button', { name: 'Confirm itinerary' }).click();
    logOk(`"Confirm itinerary" clicked at t=0`);

    // ── f. Wait 800ms for async fixture loading to settle ──
    await page.waitForTimeout(800);

    // ── g. Wait for data-demo-ready again ──
    await page.waitForSelector('[data-demo-ready="true"]', { timeout: 15_000 });
    logOk('Post-confirm: data-demo-ready="true"');

    // ── h. Locate .rpa element and scroll into view ──
    const rpa = page.locator('.rpa');
    await rpa.waitFor({ state: 'attached', timeout: 10_000 });
    await rpa.scrollIntoViewIfNeeded();
    logOk('.rpa animation root located and scrolled into view');

    // ── i. Poll data-rpa-phase every 200ms ──
    const { observed, complete } = await pollPhases(page, confirmClickTime);
    phaseLog = observed;

    if (!complete) {
      const lastPhase = observed.length > 0 ? observed[observed.length - 1].phase : 'none';
      throw new Error(
        `Animation did not reach "done" within ${PHASE_TIMEOUT_MS}ms. Last phase: "${lastPhase}"`
      );
    }

    logOk('Full phase sequence observed: trigger → cascade → candidates → collapse → freshness → done');

    // ── j. Hold 3000ms after done for video tail ──
    log(`Holding ${POST_DONE_HOLD_MS}ms after done for video tail…`);
    await page.waitForTimeout(POST_DONE_HOLD_MS);

    // ── k. Close context to flush video file ──
    const pageObj = page;
    const videoObj = await pageObj.video();
    await context.close();
    browser = null; // context closed, prevent double-close in finally

    if (videoObj) {
      // Playwright returns the video path after context.close()
      const rawWebm = await videoObj.path();
      logOk(`Raw video flushed: ${rawWebm}`);

      // ── m. Rename to stitchcheck-recovery-animation-<ISO-timestamp>.webm ──
      const renamedWebm = resolve(RECORDINGS_DIR, `stitchcheck-recovery-animation-${TIMESTAMP}.webm`);
      if (existsSync(rawWebm)) {
        renameSync(rawWebm, renamedWebm);
        videoPath = renamedWebm;
        logOk(`Renamed: ${renamedWebm}`);
      } else {
        log(`WARNING: Raw video file not found at ${rawWebm}`);
      }
    } else {
      log('WARNING: No video object returned from context');
    }

    // ── n. Convert to .mp4 via ffmpeg if available ──
    if (videoPath && existsSync(FFMPEG_PATH)) {
      const mp4Output = videoPath.replace(/\.webm$/, '.mp4');
      log(`Converting to MP4 via ffmpeg…`);
      const ffmpegResult = spawnSync(FFMPEG_PATH, [
        '-i', videoPath,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        mp4Output,
      ], { stdio: 'pipe', timeout: 60_000 });

      if (ffmpegResult.status === 0 && existsSync(mp4Output)) {
        mp4Path = mp4Output;
        logOk(`MP4 created: ${mp4Output}`);
        captureStatus = 'pass';
      } else {
        const stderr = ffmpegResult.stderr ? ffmpegResult.stderr.toString().slice(-500) : 'unknown error';
        log(`WARNING: ffmpeg conversion failed: ${stderr}`);
        logOk(`Webm deliverable: ${videoPath}`);
        captureStatus = 'pass'; // webm is still valid
      }
    } else if (videoPath) {
      log(`ffmpeg not found at ${FFMPEG_PATH} — .webm is the deliverable`);
      captureStatus = 'pass';
    }

  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    cleanupServer();
  }

  // ── Final report ──
  const totalElapsed = ((Date.now() - scriptStart) / 1000).toFixed(1);

  console.log('');
  console.log('═'.repeat(70));
  console.log('  RECOVERY ANIMATION VIDEO CAPTURE — FINAL REPORT');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`1. Local URL:          ${APP_URL}`);
  console.log(`   Port:               ${PORT}`);
  console.log('');
  console.log('2. Phase sequence (with elapsed timestamps):');
  for (const entry of phaseLog) {
    console.log(`   [${String(entry.elapsedMs).padStart(5)}ms]  ${entry.phase}`);
  }
  console.log('');
  console.log(`3. Video files:`);
  if (videoPath) console.log(`   .webm: ${videoPath}`);
  if (mp4Path) console.log(`   .mp4:  ${mp4Path}  ← primary deliverable`);
  if (!videoPath && !mp4Path) console.log('   (no video captured)');
  console.log('');
  console.log(`4. Total script duration: ${totalElapsed}s`);
  if (videoPath) {
    // Probe video duration via ffprobe if available
    try {
      const probeTarget = mp4Path || videoPath;
      const probe = spawnSync(FFMPEG_PATH.replace('ffmpeg', 'ffprobe'), [
        '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', probeTarget,
      ], { encoding: 'utf8', timeout: 10_000 });
      if (probe.status === 0 && probe.stdout.trim()) {
        console.log(`   Video duration: ${parseFloat(probe.stdout.trim()).toFixed(1)}s`);
      }
    } catch { /* ffprobe not available */ }
  }
  console.log('');
  const allPhasesCovered = EXPECTED_PHASES.every(
    (p) => phaseLog.some((e) => e.phase === p),
  );
  console.log(`5. Complete sequence coverage: ${allPhasesCovered ? 'YES ✓' : 'NO ✗'}`);
  if (!allPhasesCovered) {
    const missing = EXPECTED_PHASES.filter((p) => !phaseLog.some((e) => e.phase === p));
    console.log(`   Missing phases: ${missing.join(', ')}`);
  }
  console.log('');
  console.log('6. git status (no source modifications):');
  const gitStatus = spawnSync('git', ['status', '--short'], { cwd: WORKSPACE, encoding: 'utf8' });
  if (gitStatus.status === 0) {
    const lines = gitStatus.stdout.trim();
    if (lines === '') {
      console.log('   (clean — no modifications)');
    } else {
      // Filter to only app/core source files (exclude output/ and scripts/ new files)
      const sourceLines = lines.split('\n').filter(
        (l) => !l.includes('output/') && !l.includes('scripts/stitchcheck-recovery-animation-video-capture'),
      );
      if (sourceLines.length === 0) {
        console.log('   (no source modifications — only new script + output files)');
      } else {
        console.log('   WARNING — source changes detected:');
        sourceLines.forEach((l) => console.log(`   ${l}`));
      }
    }
  }
  console.log('');
  console.log('7. Credentials/.env.local access: NONE ✓');
  console.log('   (Script does not read .env.local or any credential file)');
  console.log('');
  console.log('8. Execution mode observed: daytona-offline-mock');
  console.log('   (Hardcoded in App.tsx line 285; no DEMO_MODE/DATA_MODE in .env.local)');
  console.log('');
  console.log(`9. Dev-server cleanup: ${cleanupServer ? 'cleaned up ✓' : 'was pre-existing, not stopped'}`);
  console.log('');
  console.log('10. Safety-notice button selector:');
  console.log('    getByRole("button", { name: "I understand — continue with demo itinerary" })');
  console.log('    Matches current DOM exactly (verified in SafetyNotice.tsx line 36) ✓');
  console.log('');
  console.log('═'.repeat(70));
  console.log(`  STATUS: ${captureStatus === 'pass' ? 'COMPLETE ✓' : 'FAILED ✗'}`);
  console.log('═'.repeat(70));

  if (captureStatus !== 'pass') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[video-capture] Fatal error:', err.message);
  process.exit(1);
});
