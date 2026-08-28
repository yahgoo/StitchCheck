// Daytona Atlas worker — Atlas Search operation.
//
// Runs INSIDE the Daytona sandbox. Executes a read-only Atlas Search
// via the atlas-flight CLI and returns a sanitized summary.
//
// Safety: read-only. No order, payment, or write operation.

import { execFile } from 'node:child_process';

const CLI_TIMEOUT_MS = 60_000;

/**
 * Executes an Atlas Search via the atlas-flight CLI.
 * Returns a sanitized operation record.
 *
 * @param {Object} params
 * @param {string} params.origin - IATA origin code
 * @param {string} params.destination - IATA destination code
 * @param {string} params.date - ISO-8601 departure date
 * @param {string} params.currency - Currency code (e.g. USD)
 * @param {string} params.correlationId - Correlation identifier
 * @returns {Promise<Object>} Sanitized operation record
 */
export async function executeAtlasSearch(params) {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const args = [
      'search',
      '--origin', params.origin,
      '--destination', params.destination,
      '--depart', params.date,
      '--adults', '1',
      '--currency', params.currency,
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
          operation: 'search',
          status: error.killed ? 'timeout' : 'error',
          requestSummary: {
            origin: params.origin,
            destination: params.destination,
            departureDate: params.date,
            currency: params.currency,
          },
          responseSummary: {},
          latencyMs,
          errorCode: error.killed ? 'process_timeout' : 'search_failed',
          errorMessage: error.killed ? 'Search timed out' : 'Search returned an error',
        });
        return;
      }

      /* Build sanitized response summary */
      const offers = parsed?.offers || parsed?.data?.offers || [];
      resolve({
        operation: 'search',
        status: 'success',
        requestSummary: {
          origin: params.origin,
          destination: params.destination,
          departureDate: params.date,
          currency: params.currency,
        },
        responseSummary: {
          offerCount: offers.length,
          firstOfferReference: offers[0]?.id || null,
          priceDisplay: offers[0]?.price?.total || null,
          currency: params.currency,
        },
        latencyMs,
        errorCode: null,
        errorMessage: null,
      });
    });
  });
}
