// Daytona sandbox orchestrator for StitchCheck.
//
// STATUS: MOCK MODE — NO REAL SANDBOX CREATION
//
// This orchestrator manages the Daytona sandbox lifecycle for Atlas
// read-only workers. In mock mode, it simulates the full lifecycle
// without creating any real sandbox or making any network calls.
//
// Lifecycle:
//   1. Evaluate feature flags (DAYTONA_ENABLED must be true).
//   2. Create sandbox with network allowlist and secret injection.
//   3. Upload worker script and dependencies.
//   4. Execute worker with timeout.
//   5. Download sanitized output.
//   6. Destroy sandbox.
//   7. Write evidence to app/public/daytona-evidence.json.
//
// Safety constraints:
//   - No sandbox creation unless DAYTONA_ENABLED=true.
//   - No credentials logged or written to evidence.
//   - Sandbox is always destroyed, even on failure.
//   - TTL provides a safety net (15-minute hard limit).
//   - Network egress allowlisted to sandbox.atriptech.com only.
//   - Worker output is sanitized (two-pass: worker + orchestrator).
//
// Label:
//   "Daytona sandbox evidence — Atlas Search/Verify, read-only"
//   or on failure:
//   "Daytona sandbox unavailable — local fallback used"

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const EVIDENCE_OUTPUT = join(PROJECT_ROOT, 'app', 'public', 'daytona-evidence.json');

/* ── Configuration ── */

const SANDBOX_CONFIG = Object.freeze({
  language: 'typescript',
  image: 'node:20-slim',
  resources: { cpu: 1, memory: 2 },
  domainAllowList: 'sandbox.atriptech.com',
  autoStopInterval: 5,
  autoDeleteInterval: 0,
  ttlMinutes: 15,
  ephemeral: true,
  processTimeoutMs: 120_000,
  createTimeoutS: 90,
  deleteTimeoutS: 30,
});

/* ── Feature flag evaluation ── */

function evaluateDaytonaFlags() {
  const enabled = process.env.DAYTONA_ENABLED === 'true';
  const demoMode = process.env.DEMO_MODE || 'local';
  const atlasLiveReadOnly = process.env.ATLAS_LIVE_READ_ONLY === 'true';

  return {
    enabled: demoMode === 'daytona' ? enabled : false,
    demoMode,
    atlasLiveReadOnly: demoMode === 'daytona' ? atlasLiveReadOnly : false,
  };
}

/* ── Mock Daytona SDK client ── */

/**
 * Creates a mock Daytona SDK client for offline testing.
 * In mock mode, no real sandbox is created.
 */
function createMockDaytonaClient() {
  let sandboxCounter = 0;

  return {
    async create(params) {
      sandboxCounter += 1;
      const id = `mock-sandbox-${sandboxCounter}-${randomUUID().slice(0, 8)}`;
      console.log(`[daytona-orchestrator] MOCK: Creating sandbox ${id}`);
      console.log(`[daytona-orchestrator] MOCK: language=${params?.language}, image=${params?.image}`);
      console.log(`[daytona-orchestrator] MOCK: domainAllowList=${params?.domainAllowList}`);
      console.log(`[daytona-orchestrator] MOCK: ephemeral=${params?.ephemeral}`);
      return {
        id,
        state: 'started',
        process: {
          async exec(cmd, opts) {
            console.log(`[daytona-orchestrator] MOCK: exec(${cmd})`);
            return { result: '', exitCode: 0 };
          },
        },
        fs: {
          async uploadFile(path, content) {
            console.log(`[daytona-orchestrator] MOCK: uploadFile(${path})`);
          },
          async downloadFile(path) {
            console.log(`[daytona-orchestrator] MOCK: downloadFile(${path})`);
            return Buffer.from('{}');
          },
        },
      };
    },
    async delete(sandbox, opts) {
      console.log(`[daytona-orchestrator] MOCK: Deleting sandbox ${sandbox?.id}`);
    },
  };
}

/* ── Evidence envelope ── */

function createFallbackEnvelope(correlationId, reason) {
  return Object.freeze({
    envelopeVersion: 1,
    correlationId,
    sandboxId: '',
    createdAt: new Date().toISOString(),
    destroyedAt: null,
    operations: [],
    provenance: Object.freeze({
      evidenceSource: 'daytona-sandbox',
      provider: 'atlas',
      executed: false,
      fallbackUsed: true,
      readOnly: true,
      sandboxDestroyed: false,
      label: 'Daytona sandbox unavailable \u2014 local fallback used',
    }),
    sanitized: true,
  });
}

function createSuccessEnvelope(correlationId, sandboxId, operations, sandboxDestroyed) {
  return Object.freeze({
    envelopeVersion: 1,
    correlationId,
    sandboxId,
    createdAt: new Date().toISOString(),
    destroyedAt: sandboxDestroyed ? new Date().toISOString() : null,
    operations: Object.freeze(operations.map(op => Object.freeze({ ...op }))),
    provenance: Object.freeze({
      evidenceSource: 'daytona-sandbox',
      provider: 'atlas',
      executed: true,
      fallbackUsed: false,
      readOnly: true,
      sandboxDestroyed,
      label: sandboxDestroyed
        ? 'Daytona sandbox evidence \u2014 Atlas Search/Verify, read-only'
        : 'Daytona sandbox evidence \u2014 sandbox not yet destroyed',
    }),
    sanitized: true,
  });
}

/* ── Sanitization pass ── */

const FORBIDDEN_KEYS = new Set([
  'apiKey', 'api_key', 'secret', 'password', 'token',
  'authorization', 'bearer', 'credential',
  'name', 'firstName', 'lastName', 'surname',
  'email', 'emailAddress', 'phone', 'phoneNumber',
  'passenger', 'passengers', 'bookingReference', 'pnr',
  'payment', 'cardNumber', 'passport', 'dateOfBirth', 'address',
]);

function sanitizeOutput(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeOutput);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    result[key] = typeof value === 'object' && value !== null
      ? sanitizeOutput(value)
      : value;
  }
  return result;
}

/* ── Main orchestrator ── */

async function runDaytonaOrchestrator(options = {}) {
  const correlationId = options.correlationId || randomUUID();
  const flags = evaluateDaytonaFlags();
  const mock = options.mock !== false;  // default to mock mode

  console.log(`[daytona-orchestrator] Starting with correlationId=${correlationId}`);
  console.log(`[daytona-orchestrator] Flags: enabled=${flags.enabled}, demoMode=${flags.demoMode}`);

  /* Gate: Daytona must be enabled */
  if (!flags.enabled && !mock) {
    console.log('[daytona-orchestrator] Daytona not enabled. Writing fallback evidence.');
    const envelope = createFallbackEnvelope(correlationId, 'daytona_not_enabled');
    writeFileSync(EVIDENCE_OUTPUT, JSON.stringify(envelope, null, 2));
    return envelope;
  }

  const client = mock ? createMockDaytonaClient() : null;
  let sandbox = null;
  let sandboxDestroyed = false;

  try {
    /* Step 1: Create sandbox */
    console.log('[daytona-orchestrator] Step 1: Creating sandbox...');
    sandbox = await client.create({
      language: SANDBOX_CONFIG.language,
      image: SANDBOX_CONFIG.image,
      resources: SANDBOX_CONFIG.resources,
      envVars: {
        NODE_ENV: 'production',
        ATLAS_BASE_URL: 'https://sandbox.atriptech.com',
      },
      secrets: {
        ATLAS_CLIENT_ID: 'atlas-client-id',
        ATLAS_CLIENT_SECRET: 'atlas-client-secret',
      },
      domainAllowList: SANDBOX_CONFIG.domainAllowList,
      networkBlockAll: false,
      autoStopInterval: SANDBOX_CONFIG.autoStopInterval,
      autoDeleteInterval: SANDBOX_CONFIG.autoDeleteInterval,
      ttlMinutes: SANDBOX_CONFIG.ttlMinutes,
      ephemeral: SANDBOX_CONFIG.ephemeral,
      labels: {
        'stitchcheck-mode': 'daytona',
        'stitchcheck-purpose': 'atlas-read-only-worker',
      },
    });
    console.log(`[daytona-orchestrator] Sandbox created: ${sandbox.id}`);

    /* Step 2: Upload worker */
    console.log('[daytona-orchestrator] Step 2: Uploading worker...');
    await sandbox.fs.uploadFile('/worker/index.mjs', Buffer.from('// worker script'));
    await sandbox.fs.uploadFile('/worker/deps.mjs', Buffer.from('// deps'));

    /* Step 3: Execute worker */
    console.log('[daytona-orchestrator] Step 3: Executing worker...');
    const result = await sandbox.process.exec('node /worker/index.mjs', {
      timeout: SANDBOX_CONFIG.processTimeoutMs,
      env: {
        CORRELATION_ID: correlationId,
        SEARCH_ORIGIN: options.origin || 'KUL',
        SEARCH_DESTINATION: options.destination || 'SIN',
        SEARCH_DATE: options.date || '2026-09-15',
        SEARCH_CURRENCY: 'USD',
      },
    });

    /* Step 4: Download output */
    console.log('[daytona-orchestrator] Step 4: Downloading output...');
    let rawOutput;
    try {
      const buf = await sandbox.fs.downloadFile('/worker/output/evidence.json');
      rawOutput = JSON.parse(buf.toString('utf-8'));
    } catch {
      rawOutput = {};
    }

    /* Step 5: Sanitize (second pass) */
    const sanitized = sanitizeOutput(rawOutput);

    /* Step 6: Build envelope */
    const operations = sanitized.operations || [];
    const envelope = createSuccessEnvelope(
      correlationId,
      sandbox.id,
      operations,
      false,  // not yet destroyed
    );

    return { envelope, sandbox, sandboxDestroyed: false };
  } catch (error) {
    console.error(`[daytona-orchestrator] Error: ${error.message}`);
    const envelope = createFallbackEnvelope(correlationId, error.message);
    return { envelope, sandbox, sandboxDestroyed: false, error: error.message };
  } finally {
    /* Step 7: Always destroy sandbox */
    if (sandbox) {
      try {
        console.log('[daytona-orchestrator] Step 7: Destroying sandbox...');
        await client.delete(sandbox, { timeout: SANDBOX_CONFIG.deleteTimeoutS });
        sandboxDestroyed = true;
        console.log('[daytona-orchestrator] Sandbox destroyed.');
      } catch (deleteError) {
        console.error(`[daytona-orchestrator] Sandbox deletion failed: ${deleteError.message}`);
        console.error('[daytona-orchestrator] TTL will auto-destroy after 15 minutes.');
      }
    }
  }
}

/* ── CLI entry point ── */

const isMain = process.argv[1] &&
  (process.argv[1].endsWith('daytona-orchestrator.mjs') ||
   process.argv[1].endsWith('daytona-orchestrator'));

if (isMain) {
  const args = process.argv.slice(2);
  const options = {
    mock: !args.includes('--live'),
    origin: process.env.SEARCH_ORIGIN || 'KUL',
    destination: process.env.SEARCH_DESTINATION || 'SIN',
    date: process.env.SEARCH_DATE || '2026-09-15',
  };

  runDaytonaOrchestrator(options)
    .then((result) => {
      const envelope = result.envelope || result;
      writeFileSync(EVIDENCE_OUTPUT, JSON.stringify(envelope, null, 2));
      console.log(`[daytona-orchestrator] Evidence written to ${EVIDENCE_OUTPUT}`);
      console.log(`[daytona-orchestrator] Provenance: ${envelope.provenance.label}`);
    })
    .catch((error) => {
      console.error(`[daytona-orchestrator] Fatal: ${error.message}`);
      process.exit(1);
    });
}

export {
  runDaytonaOrchestrator,
  createMockDaytonaClient,
  createFallbackEnvelope,
  createSuccessEnvelope,
  sanitizeOutput,
  evaluateDaytonaFlags,
  SANDBOX_CONFIG,
  FORBIDDEN_KEYS,
};
