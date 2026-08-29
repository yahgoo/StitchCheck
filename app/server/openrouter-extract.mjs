// OpenRouter itinerary extraction proxy for the Vite dev server.
//
//   POST /api/extract — multimodal itinerary extraction
//   GET  /api/extract/status — adapter readiness

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const PINNED_MODEL = 'minimax/minimax-m3:free';

function sanitizeError(msg) {
  if (typeof msg !== 'string') return 'internal error';
  return msg
    .replace(/sk-or-v1-[a-zA-Z0-9]{10,}/g, '[REDACTED]')
    .replace(/sk-[a-zA-Z0-9]{10,}/g, '[REDACTED]')
    .replace(/AIza[a-zA-Z0-9]{20,}/g, '[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, '[REDACTED]')
    .replace(/https?:\/\/[^\s"')]+/g, '[REDACTED]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g, '[REDACTED]')
    .replace(/at\s+[^\n]+/g, '')
    .trim()
    .slice(0, 500) || 'internal error';
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolveBody(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function hasOpenRouterCredential(env) {
  return !!(env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.trim().length > 0);
}

export function createExtractionPlugin(env) {
  let adapterModule = null;

  async function getAdapter() {
    if (adapterModule) return adapterModule;
    try {
      const adapterPath = resolve(
        __dirname,
        '..',
        '..',
        'smoke-tests',
        'extraction',
        'openrouter-extraction-adapter.mjs',
      );
      adapterModule = await import(adapterPath);
      return adapterModule;
    } catch (err) {
      console.error('[extraction-proxy] failed to load adapter:', sanitizeError(err?.message || String(err)));
      return null;
    }
  }

  return {
    name: 'openrouter-extract',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/extract')) return next();

        if (url === '/api/extract/status') {
          if (req.method !== 'GET') {
            sendJson(res, 405, { error: 'method_not_allowed' });
            return;
          }
          handleStatus(res, env);
          return;
        }

        if (url === '/api/extract') {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'method_not_allowed' });
            return;
          }
          await handleExtract(req, res, env, getAdapter);
          return;
        }

        sendJson(res, 404, { error: 'not_found', message: 'unknown extraction route' });
      });
    },
  };
}

function handleStatus(res, env) {
  const dataMode = env.DATA_MODE || 'offline';
  const hasKey = hasOpenRouterCredential(env);
  sendJson(res, 200, {
    dataMode,
    extractionConfigured: dataMode === 'live' && hasKey,
    transport: 'openrouter',
    model: env.EXTRACTION_MODEL || PINNED_MODEL,
    timestamp: new Date().toISOString(),
  });
}

async function handleExtract(req, res, env, getAdapter) {
  const dataMode = env.DATA_MODE || 'offline';
  if (dataMode !== 'live') {
    sendJson(res, 403, {
      error: 'live_mode_not_enabled',
      message: 'Set DATA_MODE=live to enable live itinerary extraction',
    });
    return;
  }

  if (!hasOpenRouterCredential(env)) {
    sendJson(res, 403, {
      error: 'openrouter_key_not_configured',
      message: 'OPENROUTER_API_KEY is not set',
    });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    sendJson(res, 400, { error: 'invalid_request', message: sanitizeError(e.message) });
    return;
  }

  const { image, mediaType, instruction } = body;
  if (!image || typeof image !== 'string') {
    sendJson(res, 400, { error: 'invalid_image', message: 'image field (base64) is required' });
    return;
  }

  const adapterMod = await getAdapter();
  if (!adapterMod?.openrouterExtractionAdapter) {
    sendJson(res, 503, {
      error: 'adapter_not_available',
      message: 'OpenRouter extraction adapter could not be loaded',
    });
    return;
  }

  const adapter = adapterMod.openrouterExtractionAdapter;
  const previousCallCount = typeof adapterMod._resetCallCount === 'function'
    ? adapterMod._resetCallCount()
    : null;
  if (!adapter.isEnabled()) {
    sendJson(res, 503, {
      error: 'adapter_not_enabled',
      message: 'Extraction adapter prerequisites not met (config, OpenRouter credentials, or model approval)',
    });
    return;
  }

  const correlationId = `extract-${Date.now()}`;
  const extractionRequest = {
    image: new Uint8Array(Buffer.from(image, 'base64')),
    mediaType: mediaType || 'image/png',
    instruction: instruction || 'Extract flight itinerary details from this image.',
  };

  try {
    const result = await adapter.extract(extractionRequest);
    const sourceStatus = result.sourceStatus || {};
    const isLiveSuccess =
      sourceStatus.executed === true &&
      sourceStatus.fallbackUsed === false &&
      result.extractionStatus !== 'error';

    const providerStatus = isLiveSuccess ? 'live-success'
      : sourceStatus.executed === true ? 'live-failed'
      : 'offline-fallback';

    sendJson(res, 200, {
      extraction: {
        extractionStatus: result.extractionStatus,
        firstLeg: result.firstLeg,
        secondLeg: result.secondLeg,
        connectionDurationMinutes: result.connectionDurationMinutes,
        missingFields: result.missingFields,
        fieldConfidence: result.fieldConfidence,
        validationMessages: result.validationMessages,
        requiresUserConfirmation: result.requiresUserConfirmation,
        syntheticDemo: result.syntheticDemo,
        evidenceSource: isLiveSuccess ? 'extraction-live' : 'local-fallback',
        provider: 'openrouter',
        executed: sourceStatus.executed ?? false,
        fallbackUsed: sourceStatus.fallbackUsed ?? true,
        validationOutcome: result.extractionStatus === 'success' ? 'valid' : 'partial',
      },
      providerStatus: {
        provider: 'openrouter',
        status: providerStatus,
        executed: sourceStatus.executed ?? false,
        fallbackUsed: sourceStatus.fallbackUsed ?? true,
        evidenceSource: isLiveSuccess ? 'extraction-live' : 'local-fallback',
        retrievedAt: new Date().toISOString(),
        correlationId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    sendJson(res, 502, {
      error: 'extraction_failed',
      message: sanitizeError(err?.message || String(err)),
    });
  }
}

export function writeExtractionLiveEvidence(fields) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', 'Z');
  const dir = resolve(__dirname, '..', '..', 'smoke-tests', 'extraction', 'live-runs', stamp);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'extraction-live-evidence.json');
  writeFileSync(path, `${JSON.stringify(fields, null, 2)}\n`, 'utf8');
  return path;
}

/** @deprecated Use createExtractionPlugin */
export const createGeminiExtractPlugin = createExtractionPlugin;
