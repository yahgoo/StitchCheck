#!/usr/bin/env node
/**
 * Capture RPA animation phases from the StitchCheck demo app.
 * Drives the app through: safety → upload → review → confirm → RPA animation.
 * Polls data-rpa-phase and captures screenshots per phase.
 */
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE = path.resolve(__dirname, '..');
const OUT_DIR = path.join(WORKSPACE, 'output/demo-artifacts/stitchcheck-video/rpa-capture');
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORT = { width: 1920, height: 1080 };

async function main() {
  console.log('Launching Chromium at', VIEWPORT.width, 'x', VIEWPORT.height);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  const phaseLog = [];
  const startTime = Date.now();

  // Navigate to the app
  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForSelector('.sc-app', { timeout: 10000 });
  console.log('App loaded.');

  // Step 1: Safety notice → acknowledge
  console.log('Step 1: Acknowledge safety notice...');
  const safetyBtn = await page.locator('button:has-text("I understand")').first();
  if (await safetyBtn.isVisible()) {
    await safetyBtn.click();
    await page.waitForTimeout(500);
  }

  // Step 2: Upload panel → select fixtures for both slots
  console.log('Step 2: Select fixtures...');
  await page.waitForSelector('.sc-upload', { timeout: 5000 }).catch(() => {});
  
  // Select gem-01 for slot 1 and gem-02 for slot 2
  const selects = await page.locator('select');
  await selects.nth(0).selectOption('gem-01');
  await page.waitForTimeout(300);
  await selects.nth(1).selectOption('gem-02');
  await page.waitForTimeout(300);

  // Click Continue to review
  const continueBtn = await page.locator('button:has-text("Continue"), button:has-text("continue")').first();
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(500);
  }

  // Step 3: Review → confirm itinerary
  console.log('Step 3: Confirm itinerary...');
  await page.waitForSelector('.sc-itinerary-review', { timeout: 5000 }).catch(() => {});
  
  // Scroll down to the confirm button
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  
  // Click the Confirm itinerary button
  const confirmBtn = await page.locator('button:has-text("Confirm itinerary")').first();
  if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmBtn.click();
    console.log('Confirmed itinerary.');
  } else {
    console.log('Confirm button not visible, trying alternative...');
    // Try aria-label
    const altBtn = await page.locator('[aria-label*="Confirm itinerary"]').first();
    await altBtn.click();
    console.log('Confirmed via aria-label.');
  }

  // Step 4: Wait for data-demo-ready
  console.log('Step 4: Waiting for data-demo-ready...');
  await page.waitForFunction(
    () => document.querySelector('.sc-app')?.getAttribute('data-demo-ready') === 'true',
    { timeout: 15000 }
  ).catch(e => console.log('data-demo-ready timeout:', e.message));
  console.log('data-demo-ready=true detected.');

  // Step 5: Scroll .rpa into view
  console.log('Step 5: Scrolling to .rpa...');
  await page.waitForSelector('.rpa', { timeout: 10000 });
  await page.locator('.rpa').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Step 6: Poll data-rpa-phase every 200ms
  console.log('Step 6: Polling RPA phases...');
  let lastPhase = '';
  let captureCount = 0;
  const maxPollTime = 15000; // 15s max
  const pollStart = Date.now();

  while (Date.now() - pollStart < maxPollTime) {
    const elapsed = Date.now() - startTime;
    const phase = await page.evaluate(() => {
      return document.querySelector('.rpa')?.getAttribute('data-rpa-phase') || 'none';
    });

    if (phase !== lastPhase) {
      const phaseTime = Date.now() - pollStart;
      console.log(`  [${phaseTime}ms] Phase: ${lastPhase} → ${phase}`);
      phaseLog.push({
        phase,
        timestampMs: phaseTime,
        elapsedFromStart: elapsed,
      });

      // Capture screenshot for this phase
      const captureName = `rpa-phase-${phase}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${captureName}.png`),
        fullPage: false,
      });
      captureCount++;

      // Also capture a zoomed version focused on the RPA component
      const rpaBox = await page.locator('.rpa').boundingBox();
      if (rpaBox) {
        const pad = 20;
        await page.screenshot({
          path: path.join(OUT_DIR, `${captureName}-zoomed.png`),
          clip: {
            x: Math.max(0, rpaBox.x - pad),
            y: Math.max(0, rpaBox.y - pad),
            width: Math.min(VIEWPORT.width, rpaBox.width + 2 * pad),
            height: Math.min(VIEWPORT.height, rpaBox.height + 2 * pad),
          },
        });
      }

      lastPhase = phase;

      // If we've reached 'done', wait a bit more then stop
      if (phase === 'done' || phase === 'no-safe-plan') {
        await page.waitForTimeout(1000);
        // Take one final screenshot
        await page.screenshot({
          path: path.join(OUT_DIR, `rpa-phase-${phase}-final.png`),
          fullPage: false,
        });
        break;
      }
    }

    await page.waitForTimeout(200);
  }

  // Also capture the full-page view showing RPA in context
  await page.locator('.rpa').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT_DIR, 'rpa-full-context.png'),
    fullPage: false,
  });

  // Write phase timing log
  const phaseTimingPath = path.join(OUT_DIR, 'rpa-phase-timings.json');
  fs.writeFileSync(phaseTimingPath, JSON.stringify({
    captureTimestamp: new Date().toISOString(),
    dataMode: 'daytona-offline-mock',
    phases: phaseLog,
    totalAnimationMs: phaseLog.length > 0 ? phaseLog[phaseLog.length - 1].timestampMs : 0,
  }, null, 2));

  console.log('\n=== Capture Summary ===');
  console.log(`  Phases captured: ${captureCount}`);
  console.log(`  Phase timings:`);
  for (const entry of phaseLog) {
    console.log(`    ${entry.phase}: ${entry.timestampMs}ms`);
  }
  console.log(`  Output directory: ${OUT_DIR}`);
  console.log(`  Phase timings: ${phaseTimingPath}`);

  await browser.close();
}

main().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
