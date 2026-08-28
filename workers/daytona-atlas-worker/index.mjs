// Daytona Atlas worker — entry point.
//
// Runs INSIDE the Daytona sandbox. Orchestrates Atlas Search and Verify
// operations, sanitizes output, and writes the evidence envelope.
//
// This script is uploaded to the sandbox by the orchestrator and
// executed via `node /worker/index.mjs`.
//
// Environment variables (set by orchestrator):
//   CORRELATION_ID    — unique identifier for this run
//   SEARCH_ORIGIN     — IATA origin code
//   SEARCH_DESTINATION — IATA destination code
//   SEARCH_DATE       — ISO-8601 departure date
//   SEARCH_CURRENCY   — currency code (e.g. USD)
//
// Output: /worker/output/evidence.json

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeAtlasSearch } from './atlas-search.mjs';
import { executeAtlasVerify } from './atlas-verify.mjs';
import { sanitizeOutput, validateSanitized } from './sanitize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const OUTPUT_FILE = join(OUTPUT_DIR, 'evidence.json');

/* ── Configuration ── */

const CORRELATION_ID = process.env.CORRELATION_ID || 'unknown';
const SEARCH_ORIGIN = process.env.SEARCH_ORIGIN || 'KUL';
const SEARCH_DESTINATION = process.env.SEARCH_DESTINATION || 'SIN';
const SEARCH_DATE = process.env.SEARCH_DATE || '2026-09-15';
const SEARCH_CURRENCY = process.env.SEARCH_CURRENCY || 'USD';

/* ── Main ── */

async function main() {
  console.log(`[worker] Starting Atlas worker for correlationId=${CORRELATION_ID}`);

  const operations = [];

  /* Step 1: Atlas Search */
  console.log('[worker] Executing Atlas Search...');
  const searchResult = await executeAtlasSearch({
    origin: SEARCH_ORIGIN,
    destination: SEARCH_DESTINATION,
    date: SEARCH_DATE,
    currency: SEARCH_CURRENCY,
    correlationId: CORRELATION_ID,
  });
  operations.push(searchResult);
  console.log(`[worker] Search completed: status=${searchResult.status}, latency=${searchResult.latencyMs}ms`);

  /* Step 2: Atlas Verify (only if search succeeded and returned offers) */
  if (searchResult.status === 'success' && searchResult.responseSummary.firstOfferReference) {
    console.log('[worker] Executing Atlas Verify...');
    const verifyResult = await executeAtlasVerify({
      offerReference: searchResult.responseSummary.firstOfferReference,
      correlationId: CORRELATION_ID,
    });
    operations.push(verifyResult);
    console.log(`[worker] Verify completed: status=${verifyResult.status}, latency=${verifyResult.latencyMs}ms`);
  } else {
    console.log('[worker] Skipping Verify (no offer to verify)');
  }

  /* Step 3: Build envelope */
  const envelope = {
    envelopeVersion: 1,
    correlationId: CORRELATION_ID,
    sandboxId: process.env.SANDBOX_ID || 'unknown',
    createdAt: new Date().toISOString(),
    destroyedAt: null,
    operations,
    provenance: {
      evidenceSource: 'daytona-sandbox',
      provider: 'atlas',
      executed: true,
      fallbackUsed: false,
      readOnly: true,
      sandboxDestroyed: false,
      label: 'Daytona sandbox evidence \u2014 Atlas Search/Verify, read-only',
    },
    sanitized: true,
  };

  /* Step 4: Sanitize (first pass — worker side) */
  const sanitized = sanitizeOutput(envelope);

  /* Step 5: Validate no forbidden keys remain */
  const issues = validateSanitized(sanitized);
  if (issues.length > 0) {
    console.error(`[worker] Sanitization issues: ${issues.join(', ')}`);
    /* Write a fallback envelope instead */
    const fallback = {
      envelopeVersion: 1,
      correlationId: CORRELATION_ID,
      sandboxId: process.env.SANDBOX_ID || 'unknown',
      createdAt: new Date().toISOString(),
      destroyedAt: null,
      operations: [],
      provenance: {
        evidenceSource: 'daytona-sandbox',
        provider: 'atlas',
        executed: false,
        fallbackUsed: true,
        readOnly: true,
        sandboxDestroyed: false,
        label: 'Daytona sandbox evidence \u2014 sanitization failed',
      },
      sanitized: true,
      sanitizationIssues: issues,
    };
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(OUTPUT_FILE, JSON.stringify(fallback, null, 2));
    return;
  }

  /* Step 6: Write output */
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(sanitized, null, 2));
  console.log(`[worker] Evidence written to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(`[worker] Fatal error: ${error.message}`);
  process.exit(1);
});
