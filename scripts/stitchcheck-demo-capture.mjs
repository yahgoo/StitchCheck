#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// StitchCheck — Deterministic Demo Capture Script
// ─────────────────────────────────────────────────────────────────────────────
// Captures the complete 6-scene StitchCheck demo flow using Playwright.
// - Deterministic: fixed viewport, seeded synthetic fixtures, no randomness.
// - Self-contained: starts the Vite dev server if not already running.
// - Evidence-safe: verifies all required disclaimer labels on screen.
// - Graceful fallback: accepts any valid Nosana label variant (placeholder,
//   local-fallback, or live evidence) depending on what the app serves.
// - Reproducible: timestamped output directory, structured JSON manifest.
//
// Usage:
//   node scripts/stitchcheck-demo-capture.mjs
//   node scripts/stitchcheck-demo-capture.mjs --port 5174
//   node scripts/stitchcheck-demo-capture.mjs --headed
//
// No provider integrations, credentials, or write actions are touched.
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
const PORT = parseInt(args.find((_, i) => args[i - 1] === '--port') || '5174', 10) || 5174;
const HEADED = args.includes('--headed');
const APP_URL = `http://localhost:${PORT}/`;

// ── Output directory ──
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT_DIR = resolve(WORKSPACE, 'output', 'captures', `capture-${TIMESTAMP}`);
mkdirSync(OUT_DIR, { recursive: true });

// ── Constants ──
const VIEWPORT = { width: 1920, height: 1080 };
const SCENE_PAUSE_MS = 400;
const MAX_RETRIES = 2;
const MAX_FLOW_RETRIES = 2;

// ── Required evidence labels ──
// The Nosana label has three valid variants depending on app state:
//   1. "Local fallback — not Nosana evidence" (default local-fallback)
//   2. "Nosana workload validated offline — local fallback used; not Nosana evidence" (offline validated)
//   3. "Nosana evidence — remote job succeeded; result from decentralized GPU workload." (live evidence)
// All contain "Nosana" and some form of "evidence" disclaimer.
const EVIDENCE_LABELS = {
  gemini: 'Fictional itinerary \u2014 local demo fixture',
  nosanaVariants: [
    'Local fallback \u2014 not Nosana evidence',
    'Nosana workload validated offline \u2014 local fallback used; not Nosana evidence',
    'Nosana evidence \u2014 remote job succeeded; result from decentralized GPU workload.',
  ],
  // Locked panel uses LABELS.atlasAlternatives (localFixture);
  // post-confirmation panels use getAtlasLabel() which returns offlineFixture.
  atlasLocked: 'Fictional alternatives \u2014 local demo fixture',
  atlas: 'Offline fixture \u2014 not Atlas Sandbox evidence',
};

// ── Helpers ──

function log(msg) { console.log(`[capture] ${msg}`); }
function logOk(msg) { console.log(`  ✓ ${msg}`); }
function logFail(msg) { console.log(`  ✗ ${msg}`); }

/** Wait for a selector to be visible. */
async function assertVisible(page, selector, label) {
  const loc = page.locator(selector);
  await loc.waitFor({ state: 'visible', timeout: 10_000 });
  return loc;
}

/** Assert that an element contains expected text. */
async function assertText(page, selector, expectedText, label) {
  const loc = page.locator(selector);
  await loc.waitFor({ state: 'visible', timeout: 10_000 });
  const text = await loc.textContent();
  if (!text || !text.includes(expectedText)) {
    throw new Error(`[${label}] Expected "${expectedText}" in ${selector}, got: "${text}"`);
  }
}

/** Assert that an element contains one of the variant texts. */
async function assertTextVariant(page, selector, variants, label) {
  const loc = page.locator(selector);
  await loc.waitFor({ state: 'visible', timeout: 10_000 });
  const text = await loc.textContent();
  const matched = variants.find((v) => text && text.includes(v));
  if (!matched) {
    throw new Error(`[${label}] Expected one of [${variants.join(' | ')}] in ${selector}, got: "${text}"`);
  }
  return matched;
}

/**
 * Wait for deterministic browser-ready state before capture.
 * Implements the full stabilization protocol:
 *   1. document.fonts.ready
 *   2. All <img> complete
 *   3. data-demo-ready="true" marker
 *   4. Two requestAnimationFrame cycles
 *   5. Short bounded stabilization delay
 *   6. Scroll position reset
 */
async function waitBrowserReady(page, context = 'page') {
  // 1. Fonts
  await page.evaluate(() => document.fonts.ready);

  // 2. All images complete
  await page.evaluate(() => Promise.all(
    [...document.images].map(img =>
      img.complete ? Promise.resolve() :
      new Promise(r => { img.onload = img.onerror = r; })
    )
  ));

  // 3. App-specific ready marker with diagnostic timeout
  try {
    await page.waitForSelector('[data-demo-ready="true"]', { timeout: 15_000 });
  } catch {
    const debug = await page.evaluate(() => ({
      readyMarker: document.querySelector('[data-demo-ready]')?.getAttribute('data-demo-ready'),
      bodyChildCount: document.body.children.length,
      rootId: document.querySelector('#root')?.id ?? null,
      title: document.title,
      url: location.href,
    }));
    throw new Error(
      `[${context}] data-demo-ready="true" not set within 15s. Debug: ${JSON.stringify(debug)}`
    );
  }

  // 4. Two requestAnimationFrame cycles after the ready marker
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  // 5. Short bounded stabilization delay
  await page.waitForTimeout(150);

  // 6. Scroll position reset
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Inject CSS to disable all transitions and animations during capture. */
async function disableTransitionsForCapture(page) {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });
}

/** Take a screenshot with retry, with viewport stabilization before each attempt. */
async function screenshotWithRetry(page, filename, retries = MAX_RETRIES) {
  const filepath = resolve(OUT_DIR, filename);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.waitForTimeout(100);
      await page.screenshot({ path: filepath, fullPage: false });
      logOk(`${filename} captured`);
      return filepath;
    } catch (err) {
      if (attempt === retries) throw err;
      log(`  retry ${attempt + 1} for ${filename}…`);
      await page.waitForTimeout(500);
    }
  }
}

/** Check if the StitchCheck app is actually running at the URL. */
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

// ── Navigation helpers ──

/** Navigate from initial load to the review step (safety → upload → review). */
async function navigateToReview(page) {
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30_000 });
  await waitBrowserReady(page, 'initial-load');
  await disableTransitionsForCapture(page);
  await assertVisible(page, '.sc-safety-notice', 'nav-safety');
  await page.getByRole('button', { name: 'I understand — continue with demo itinerary' }).click();

  await assertVisible(page, '.sc-upload-panel', 'nav-upload');
  await page.selectOption('#screenshot-0', 'gem-01');
  await page.selectOption('#screenshot-1', 'gem-01');
  await page.waitForTimeout(SCENE_PAUSE_MS);
  await page.getByRole('button', { name: 'Continue to review' }).click();

  await assertVisible(page, 'section.sc-itinerary-review', 'nav-review');
}

// ── Scene capture functions ──
// These are designed as a CONTINUOUS flow. Each scene builds on the previous
// state. If any scene fails, the entire flow must restart.

async function captureScene01_LockedState(page) {
  log('Scene 1: Locked downstream panels');

  await navigateToReview(page);

  // Verify BOTH downstream panels are locked
  const disabledPanels = page.locator('.sc-panel--disabled');
  const count = await disabledPanels.count();
  if (count !== 2) {
    throw new Error(`[scene-01] Expected 2 disabled panels, found ${count}`);
  }

  for (let i = 0; i < 2; i++) {
    const lockIcon = disabledPanels.nth(i).locator('.sc-panel__lock-icon');
    await lockIcon.waitFor({ state: 'visible', timeout: 5000 });
    const panelText = await disabledPanels.nth(i).textContent();
    if (!panelText || !panelText.includes('Confirm itinerary first')) {
      throw new Error(`[scene-01] Disabled panel ${i} missing "Confirm itinerary first"`);
    }
  }
  logOk('Both panels locked with "Confirm itinerary first"');

  // Verify Gemini evidence label
  await assertText(page, 'section.sc-itinerary-review p.sc-source-label',
    EVIDENCE_LABELS.gemini, 'scene-01-gemini-label');
  logOk('Gemini extraction label visible');

  // Verify Nosana label in locked panel
  const nosanaLabel = await assertTextVariant(page,
    'section[aria-label="Connection risk"] p.sc-source-label',
    EVIDENCE_LABELS.nosanaVariants, 'scene-01-nosana-label');
  logOk(`Nosana label: "${nosanaLabel}"`);

  // Verify Atlas label in locked panel
  await assertText(page, 'section[aria-label="Safer alternatives"] p.sc-source-label',
    EVIDENCE_LABELS.atlasLocked, 'scene-01-atlas-label');
  logOk('Atlas alternatives label visible');

  // Scroll to show locked panels and screenshot
  await disabledPanels.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(SCENE_PAUSE_MS);
  await screenshotWithRetry(page, 'scene-01-locked.png');

  return { scene: '01-locked', file: 'scene-01-locked.png', status: 'pass' };
}

async function captureScene02_EditedField(page) {
  log('Scene 2: Edited itinerary field');

  // Edit flight number: SC-202 → SC-299
  const input = page.locator('#secondLeg-flightNumber');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill('SC-299');
  await page.waitForTimeout(SCENE_PAUSE_MS);

  // Verify correction note appeared
  await assertVisible(page, 'div.sc-corrections', 'scene-02-corrections');
  await assertText(page, 'div.sc-corrections', 'SC-299', 'scene-02-correction-text');
  logOk('Correction note visible: SC-202 → SC-299');

  // Verify panels remain locked
  const riskPanel = page.locator('section[aria-label="Connection risk"]');
  const altPanel = page.locator('section[aria-label="Safer alternatives"]');
  if (await riskPanel.getAttribute('aria-disabled') !== 'true' ||
      await altPanel.getAttribute('aria-disabled') !== 'true') {
    throw new Error('[scene-02] Panels should still be locked after edit');
  }
  logOk('Panels remain locked after edit');

  await screenshotWithRetry(page, 'scene-02-edited-field.png');
  return { scene: '02-edited-field', file: 'scene-02-edited-field.png', status: 'pass' };
}

async function captureScene03_ConfirmedUnlocked(page) {
  log('Scene 3: Confirmed and unlocked panels');

  // Click Confirm itinerary
  await page.getByRole('button', { name: 'Confirm itinerary' }).click();
  await page.waitForTimeout(800); // Allow async Nosana fallback fetch

  // Verify status banner
  await assertVisible(page, 'div.sc-banner--success', 'scene-03-banner');
  await assertText(page, 'div.sc-banner--success',
    'Itinerary confirmed', 'scene-03-banner-text');
  logOk('Status banner: "Itinerary confirmed"');

  // Verify panels are now unlocked
  const riskPanel = page.locator('section[aria-label="Connection risk"]');
  const altPanel = page.locator('section[aria-label="Safer alternatives"]');
  await riskPanel.waitFor({ state: 'visible', timeout: 10_000 });
  await altPanel.waitFor({ state: 'visible', timeout: 10_000 });

  const riskDisabled = await riskPanel.getAttribute('aria-disabled');
  const altDisabled = await altPanel.getAttribute('aria-disabled');
  if (riskDisabled === 'true' || altDisabled === 'true') {
    throw new Error('[scene-03] Panels should be unlocked after confirmation');
  }
  logOk('Risk and Alternatives panels unlocked');

  // Verify Nosana label (accept any valid variant)
  const nosanaLabel = await assertTextVariant(page,
    'section[aria-label="Connection risk"] p.sc-source-label',
    EVIDENCE_LABELS.nosanaVariants, 'scene-03-nosana-label');
  logOk(`Nosana label: "${nosanaLabel}"`);

  // Verify Atlas label
  await assertText(page, 'section[aria-label="Safer alternatives"] p.sc-source-label',
    EVIDENCE_LABELS.atlas, 'scene-03-atlas-label');
  logOk('Atlas alternatives label visible');

  // Viewport-stabilized screenshot (never fullPage for video frames)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(100);
  const filepath = resolve(OUT_DIR, 'scene-03-confirmed-unlocked.png');
  await page.screenshot({ path: filepath, fullPage: false });
  logOk('scene-03-confirmed-unlocked.png captured (viewport)');

  return { scene: '03-confirmed-unlocked', file: 'scene-03-confirmed-unlocked.png', status: 'pass' };
}

async function captureScene04_ProviderStatus(page) {
  log('Scene 4: Provider status and evidence labels');

  const riskPanel = page.locator('section[aria-label="Connection risk"]');
  await riskPanel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(SCENE_PAUSE_MS);

  // Verify risk panel heading
  const riskHeading = await riskPanel.locator('h2').textContent();
  if (riskHeading && riskHeading.includes('Heuristic Result')) {
    logOk('Risk panel: "Connection Risk — Heuristic Result"');
  } else if (riskHeading && (riskHeading.includes('Error') || riskHeading.includes('Timeout') || riskHeading.includes('Unavailable'))) {
    logOk(`Risk panel in fallback state: ${riskHeading}`);
  } else {
    throw new Error(`[scene-04] Unexpected risk heading: "${riskHeading}"`);
  }

  // Verify risk band and score (visible in success scenario)
  const riskBand = riskPanel.locator('span.sc-risk-band__value');
  if (await riskBand.isVisible().catch(() => false)) {
    const bandText = await riskBand.textContent();
    logOk(`Risk band: ${bandText}`);
    const scoreText = await riskPanel.locator('p.sc-risk-score').first().textContent();
    logOk(`Risk score: ${scoreText}`);
  }

  // Verify Nosana source label (any variant)
  const nosanaLabel = await assertTextVariant(page,
    'section[aria-label="Connection risk"] p.sc-source-label',
    EVIDENCE_LABELS.nosanaVariants, 'scene-04-nosana-label');
  logOk(`Nosana source label: "${nosanaLabel}"`);

  // Determine Nosana evidence source for manifest
  let nosanaSource = 'local-fallback';
  const evidenceLabelEl = riskPanel.locator('.sc-source-label--evidence');
  if (await evidenceLabelEl.isVisible().catch(() => false)) {
    nosanaSource = 'nosana-evidence';
    logOk('Live Nosana evidence detected');
  } else {
    logOk('Using local synthetic placeholder (expected fallback)');
  }

  await screenshotWithRetry(page, 'scene-04-provider-status.png');
  return { scene: '04-provider-status', file: 'scene-04-provider-status.png', status: 'pass', nosanaSource };
}

async function captureScene05_Comparison(page) {
  log('Scene 5: Comparison view');

  const comparison = page.locator('section.sc-comparison');
  await comparison.scrollIntoViewIfNeeded();
  await page.waitForTimeout(SCENE_PAUSE_MS);

  // Verify comparison heading
  await assertText(page, 'section.sc-comparison h2',
    'Compare: Risky Self-Transfer vs Safer Alternatives', 'scene-05-heading');
  logOk('Comparison heading visible');

  // Verify comparison table
  const rows = page.locator('table.sc-comparison-table tbody tr');
  const rowCount = await rows.count();
  if (rowCount < 1) {
    throw new Error('[scene-05] No alternative rows in comparison table');
  }
  logOk(`Comparison table: ${rowCount} alternative(s)`);

  // Verify Atlas label in comparison
  await assertText(page, 'section.sc-comparison > p.sc-source-label',
    EVIDENCE_LABELS.atlas, 'scene-05-atlas-label');

  // Verify Nosana label in original plan column
  const origLabel = page.locator('div.sc-comparison-col--original p.sc-source-label');
  if (await origLabel.isVisible().catch(() => false)) {
    const origText = await origLabel.textContent();
    if (origText && origText.includes('Nosana')) {
      logOk('Original plan Nosana label visible');
    }
  }

  await screenshotWithRetry(page, 'scene-05-comparison.png');
  return { scene: '05-comparison', file: 'scene-05-comparison.png', status: 'pass' };
}

async function captureScene06_DecisionFinal(page) {
  log('Scene 6: Decision and final state');

  const decisionPanel = page.locator('section.sc-decision');
  await decisionPanel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(SCENE_PAUSE_MS);

  // Select "Keep current plan"
  await page.getByRole('button', { name: 'Keep current plan' }).click();
  await page.waitForTimeout(SCENE_PAUSE_MS);

  // Verify decision summary
  await assertVisible(page, 'div.sc-decision-summary', 'scene-06-summary');
  await assertText(page, 'div.sc-decision-summary h3',
    'Your Decision: Keep', 'scene-06-decision-heading');
  logOk('Decision: Keep current plan');

  // Confirm decision
  await page.getByRole('button', { name: 'Confirm decision' }).click();
  await page.waitForTimeout(SCENE_PAUSE_MS);

  // Verify final state
  await assertVisible(page, 'section.sc-decision--final', 'scene-06-final');
  await assertText(page, 'section.sc-decision--final h2',
    'Demo Complete — No Action Created', 'scene-06-final-heading');
  logOk('Final heading: "Demo Complete — No Action Created"');

  // Verify final statement
  await assertText(page, 'div.sc-final-statement p',
    'No booking, payment, reservation, ticket, order, verification, or other write action has been created.',
    'scene-06-final-statement');
  logOk('Final no-action statement verified');

  // Verify metadata
  const metaDds = page.locator('dl.sc-meta-list dd');
  const meta0 = await metaDds.nth(0).textContent();
  const meta1 = await metaDds.nth(1).textContent();
  const meta2 = await metaDds.nth(2).textContent();
  const meta3 = await metaDds.nth(3).textContent();
  if (meta0 !== 'true' || meta1 !== 'true' || meta2 !== 'false') {
    throw new Error(`[scene-06] Unexpected metadata: ${meta0}, ${meta1}, ${meta2}`);
  }
  logOk(`Metadata: noOrderCreated=${meta0}, syntheticDemo=${meta1}, externalCallsMade=${meta2}, decision=${meta3}`);

  await screenshotWithRetry(page, 'scene-06-keep-switch-final.png');
  return { scene: '06-keep-switch-final', file: 'scene-06-keep-switch-final.png', status: 'pass' };
}

// ── Main ──

async function main() {
  const startTime = Date.now();
  log(`StitchCheck Demo Capture — ${new Date().toISOString()}`);
  log(`Output directory: ${OUT_DIR}`);
  log(`Target URL: ${APP_URL}`);

  const cleanupServer = await ensureDevServer();

  let overallStatus = 'fail';
  let results = [];
  let browser;

  // Ensure cleanup on SIGINT / SIGTERM so no orphan browser or dev server lingers.
  let cleaning = false;
  const cleanupAndExit = async (sig) => {
    if (cleaning) return;
    cleaning = true;
    log(`Received ${sig}, cleaning up…`);
    try { if (browser) await browser.close(); } catch { /* ignore */ }
    cleanupServer();
    process.exit(128);
  };
  process.on('SIGINT', cleanupAndExit);
  process.on('SIGTERM', cleanupAndExit);

  try {

  for (let attempt = 1; attempt <= MAX_FLOW_RETRIES; attempt++) {
    if (attempt > 1) {
      log(`Retry attempt ${attempt}/${MAX_FLOW_RETRIES}…`);
    }

    try {
      log(`Launching Chromium (${HEADED ? 'headed' : 'headless'})…`);
      browser = await chromium.launch({ headless: !HEADED });
      const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
      const page = await context.newPage();

      // Run all 6 scenes as a continuous flow
      const scenes = [
        captureScene01_LockedState,
        captureScene02_EditedField,
        captureScene03_ConfirmedUnlocked,
        captureScene04_ProviderStatus,
        captureScene05_Comparison,
        captureScene06_DecisionFinal,
      ];

      results = [];
      let flowPassed = true;

      for (const sceneFn of scenes) {
        const result = await sceneFn(page);
        results.push(result);
      }

      await browser.close();
      browser = null;
      overallStatus = 'pass';
      break; // Success — exit retry loop
    } catch (err) {
      logFail(`Flow attempt ${attempt} failed: ${err.message}`);
      if (browser) {
        try { await browser.close(); } catch { /* ignore */ }
        browser = null;
      }
      if (attempt < MAX_FLOW_RETRIES) {
        log('  Restarting full flow…');
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  } finally {
    process.off('SIGINT', cleanupAndExit);
    process.off('SIGTERM', cleanupAndExit);
    cleanupServer();
  }

  // Generate capture manifest
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const manifest = {
    captureTimestamp: new Date().toISOString(),
    appUrl: APP_URL,
    viewport: VIEWPORT,
    outputDirectory: OUT_DIR,
    durationSeconds: parseFloat(elapsed),
    overallStatus,
    voiceMode: 'silent',
    voiceModeNote: 'Automated capture is silent by default. Narration uses browser-local Web Speech API and is opt-in only via the UI control. No external TTS or cloud service was called.',
    evidenceLabels: {
      gemini: EVIDENCE_LABELS.gemini, // 'Fictional itinerary — local demo fixture' (matches core provenance)
      nosanaVariants: EVIDENCE_LABELS.nosanaVariants,
      atlasLocked: EVIDENCE_LABELS.atlasLocked,
      atlas: EVIDENCE_LABELS.atlas,
    },
    scenes: results,
    gracefulFallback: {
      nosanaResultSource: results.find((r) => r.nosanaSource)?.nosanaSource || 'unknown',
      note: 'If nosanaSource is "local-fallback", the app used local fallback fixture data. If "nosana-evidence", a live Nosana result was served from app/public/nosana-risk-result.json.',
    },
  };

  const manifestPath = resolve(OUT_DIR, 'capture-manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  logOk(`Manifest written: ${manifestPath}`);

  // Summary
  console.log('');
  console.log('═'.repeat(60));
  console.log(`  Capture ${overallStatus === 'pass' ? 'COMPLETE' : 'FAILED'}`);
  console.log(`  Duration: ${elapsed}s`);
  console.log(`  Scenes: ${results.filter((r) => r.status === 'pass').length}/${results.length} passed`);
  console.log(`  Output: ${OUT_DIR}`);
  console.log('═'.repeat(60));

  if (overallStatus !== 'pass') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[capture] Fatal error:', err.message);
  process.exit(1);
});
