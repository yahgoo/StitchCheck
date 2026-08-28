// Daytona Atlas worker — Atlas Verify operation.
//
// Runs INSIDE the Daytona sandbox. Executes a read-only Atlas Verify
// via the atlas-flight CLI and returns a sanitized summary.
//
// Safety: read-only. No order, payment, or write operation.

import { execFile } from 'node:child_process';

const CLI_TIMEOUT_MS = 60_000;

/**
 * Executes an Atlas Verify via the atlas-flight CLI.
 * Returns a sanitized operation record.
 *
 * @param {Object} params
 * @param {string} params.offerReference - The offer to verify
 * @param {string} params.correlationId - Correlation identifier
 * @returns {Promise<Object>} Sanitized operation record
 */
export async function executeAtlasVerify(params) {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const args = [
      'verify',
      '--offer-id', params.offerReference,
      '--output', 'json',
    ];

    execFile('atlas-flight', args, {
      timeout: CLI_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      const latencyMs = Date.now() - startTime;
      const raw = (stdout || '').trim();
      let parsed = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }

      if (error) {
        resolve({
          operation: 'verify',
          status: error.killed ? 'timeout' : 'error',
          requestSummary: { offerReference: params.offerReference },
          responseSummary: {},
          latencyMs,
          errorCode: error.killed ? 'process_timeout' : 'verify_failed',
          errorMessage: error.killed ? 'Verify timed out' : 'Verify returned an error',
        });
        return;
      }

      /* Build sanitized response summary */
      const verifyStatus = parsed?.status || parsed?.data?.status || 'unknown';
      const price = parsed?.price?.total || parsed?.data?.price?.total || null;

      resolve({
        operation: 'verify',
        status: 'success',
        requestSummary: { offerReference: params.offerReference },
        responseSummary: {
          verifyStatus,
          priceDisplay: price,
          currency: parsed?.currency || 'USD',
        },
        latencyMs,
        errorCode: null,
        errorMessage: null,
      });
    });
  });
}
