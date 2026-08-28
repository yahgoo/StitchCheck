#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// StitchCheck — Recovery-Plan Animation Capture Scene (offline only)
// ─────────────────────────────────────────────────────────────────────────────
// One focused capture scene for the recovery-plan animation:
//   1. Loads the existing local demo (starts the Vite dev server if needed).
//   2. Reaches the confirmed/recovery state via the normal flow.
//   3. Waits for data-demo-ready="true".
//   4. Locates .rpa (RecoveryPlanAnimation root).
//   5. Waits for data-rpa-phase="done" | "no-safe-plan" | "error".
//   6. Captures a readable 1920×1080 viewport frame (never fullPage).
//   7. Writes output to a NEW capture directory; existing fallback videos
//      and capture outputs are untouched.
//
// Usage:
//   node scripts/stitchcheck-recovery-animation-capture.mjs
//   node scripts/stitchcheck-recovery-animation-capture.mjs --port 5176
//   node scripts/stitchcheck-recovery-animation-capture.mjs --headed
//
// Offline guarantees: no Daytona/Atlas/Nosana/Gemini/OpenRouter calls,
// no credentials, no .env.local access, no write actions. The animation
// runs in 'daytona-offline-mock' mode with local deterministic data.
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(__dirname, '..');
const APP_DIR = resolve(WORKSPACE, 'app');

// ── CLI args ──
const args = process.argv.slice(2);
const PORT = parseInt(args.find((_, i) => args[i - 1] === '--port') || '5175', 10) || 5175;
const HEADED = args.includes('--headed');
const APP_URL = `http://localhost:${PORT}/`;

// ── Output directory (new, dedicated) ──
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT_DIR = resolve(WORKSPACE, 'output', 'captures', `recovery-animation-${TIMESTAMP}`);
mkdirSync(OUT_DIR, { recursive: true });

// ── Constants ──
const VIEWPORT = { width: 1920, height: 1080 };
const TERMINAL_PHASES = ['done', 'no-safe-plan', 'error'];
const PHASE_TIMEOUT_MS = 30_000;

// ── Required offline provenance assertions ──
const OFFLINE_MODE_LABEL = 'Daytona offline mock';
const LIVE_LABEL_FORBIDDEN = 'Daytona live risk computation';
const SIMULATED_TRIGGER_LABEL =
  'Simulated delay trigger \u2014 downstream impact is analysis only';

function log(msg) { console.log(`[recovery-capture] ${msg}`); }
function logOk(msg) { console.log(`  \u2713 ${msg}`); }

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

  log(`Starting dev server on port ${PORT}\u2026`);
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

/** Poll the .rpa completion marker until it reaches a terminal phase. */
async function waitForTerminalPhase(page) {
  const startTime = Date.now();
  let lastPhase = null;
  while (Date.now() - startTime < PHASE_TIMEOUT_MS) {
    lastPhase = await page.locator('.rpa').getAttribute('data-rpa-phase');
    if (lastPhase !== null && TERMINAL_PHASES.includes(lastPhase)) {
      return lastPhase;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(
    `[recovery-capture] .rpa did not reach a terminal phase within ${PHASE_TIMEOUT_MS}ms. ` +
    `Last data-rpa-phase: "${lastPhase}"`,
  );
}

async function main() {
  const startTime = Date.now();
  log(`StitchCheck Recovery Animation Capture \u2014 ${new Date().toISOString()}`);
  log(`Output directory: ${OUT_DIR}`);
  log(`Target URL: ${APP_URL}`);

  const cleanupServer = await ensureDevServer();
  let browser;
  let sceneResult = { scene: 'recovery-animation', status: 'fail' };

  try {
    log(`Launching Chromium (${HEADED ? 'headed' : 'headless'})\u2026`);
    browser = await chromium.launch({ headless: !HEADED });
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();

    // ── 1. Load the existing local demo ──
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('[data-demo-ready="true"]', { timeout: 15_000 });
    logOk('Initial load: data-demo-ready="true"');

    // ── 2. Reach the confirmed/recovery state ──
    await page.getByRole('button', { name: 'I understand \u2014 continue with demo itinerary' }).click();
    await page.locator('.sc-upload-panel').waitFor({ state: 'visible', timeout: 10_000 });
    await page.selectOption('#screenshot-0', 'gem-01');
    await page.selectOption('#screenshot-1', 'gem-01');
    await page.getByRole('button', { name: 'Continue to review' }).click();
    await page.locator('section.sc-itinerary-review').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Confirm itinerary' }).click();
    await page.waitForTimeout(800); // Allow async fixture loading to settle
    logOk('Itinerary confirmed \u2014 recovery state reached');

    // ── 3. Wait for the demo-ready marker again (confirmed step) ──
    await page.waitForSelector('[data-demo-ready="true"]', { timeout: 15_000 });

    // ── 4. Locate .rpa ──
    const rpa = page.locator('.rpa');
    await rpa.waitFor({ state: 'attached', timeout: 10_000 });
    logOk('.rpa animation root located');

    // ── 5. Wait for the completion marker ──
    const terminalPhase = await waitForTerminalPhase(page);
    logOk(`Completion marker reached: data-rpa-phase="${terminalPhase}"`);

    // ── Evidence assertions (offline mode, no live claims) ──
    const rpaText = await rpa.textContent();
    if (!rpaText || !rpaText.includes(OFFLINE_MODE_LABEL)) {
      throw new Error(`[recovery-capture] Offline mode label "${OFFLINE_MODE_LABEL}" not found in .rpa`);
    }
    logOk(`Offline mode label visible: "${OFFLINE_MODE_LABEL}"`);
    if (rpaText.includes(LIVE_LABEL_FORBIDDEN)) {
      throw new Error(`[recovery-capture] Forbidden live label "${LIVE_LABEL_FORBIDDEN}" displayed`);
    }
    logOk('No live risk-computation claim displayed');
    if (!rpaText.includes(SIMULATED_TRIGGER_LABEL)) {
      throw new Error(`[recovery-capture] Simulated trigger label not found in .rpa`);
    }
    logOk('Simulated trigger label visible (analysis only)');

    // Disable CSS transitions for a crisp, deterministic frame.
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
    });

    // ── 6. Capture a readable 1920×1080 viewport frame ──
    await rpa.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(200);
    const filepath = resolve(OUT_DIR, 'recovery-animation-final.png');
    await page.screenshot({ path: filepath, fullPage: false });
    logOk('recovery-animation-final.png captured (viewport, no fullPage)');

    sceneResult = {
      scene: 'recovery-animation',
      file: 'recovery-animation-final.png',
      status: 'pass',
      terminalPhase,
      executionMode: 'daytona-offline-mock',
      provenanceLabel: 'Daytona sandbox \u2014 risk analysis computed locally, no live risk service called',
    };

    await browser.close();
    browser = null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    cleanupServer();
  }

  // ── 7. Manifest ──
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const manifest = {
    captureTimestamp: new Date().toISOString(),
    appUrl: APP_URL,
    viewport: VIEWPORT,
    outputDirectory: OUT_DIR,
    durationSeconds: parseFloat(elapsed),
    overallStatus: sceneResult.status,
    executionMode: 'daytona-offline-mock',
    isLive: false,
    provenanceNote:
      'Offline mock only. No Daytona sandbox was created; no Daytona, Atlas, Nosana, Gemini, or OpenRouter call was made; no credentials were accessed.',
    scenes: [sceneResult],
  };
  const manifestPath = resolve(OUT_DIR, 'capture-manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  logOk(`Manifest written: ${manifestPath}`);

  console.log('');
  console.log('\u2550'.repeat(60));
  console.log(`  Recovery animation capture ${sceneResult.status === 'pass' ? 'COMPLETE' : 'FAILED'}`);
  console.log(`  Duration: ${elapsed}s`);
  console.log(`  Output: ${OUT_DIR}`);
  console.log('\u2550'.repeat(60));

  if (sceneResult.status !== 'pass') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[recovery-capture] Fatal error:', err.message);
  process.exit(1);
});
