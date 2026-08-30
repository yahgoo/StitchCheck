#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// One-off deck PDF export for the updated Alibaba × Atlas hackathon deck.
// Mirrors scripts/export-deck-pdf.mjs, but takes explicit input/output paths
// so the previous deck PDF is never overwritten. Human review only.
// Usage: node deck/export-updated-deck-pdf.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK_DIR = resolve(__dirname);
const HTML_PATH = resolve(DECK_DIR, 'StitchCheck-Alibaba-Atlas-Hackathon-2026-Updated.html');
const PDF_PATH = resolve(DECK_DIR, 'StitchCheck-Alibaba-Atlas-Hackathon-2026-Updated.pdf');

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all(
      [...document.images].map((img) => img.complete ? Promise.resolve()
        : new Promise((r) => { img.onload = img.onerror = r; })),
    ));
    const slideCount = await page.locator('section.slide').count();
    await page.pdf({
      path: PDF_PATH,
      width: '1280px',
      height: '720px',
      printBackground: true,
      pageRanges: `1-${slideCount}`,
    });
    console.log(`[deck-pdf] slides=${slideCount} -> ${PDF_PATH}`);
  } finally {
    await browser.close();
  }
};

run().catch((err) => { console.error('[deck-pdf] fatal:', err.message); process.exit(1); });
