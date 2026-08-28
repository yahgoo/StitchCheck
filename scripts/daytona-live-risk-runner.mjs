#!/usr/bin/env node
// Daytona live risk-worker cycle — ONE sandbox, risk worker only, no Atlas.
//
// Gate: ALLOW_LIVE=1 AND DAYTONA_API_KEY present.
// Lifecycle: create → upload worker → exec once → download → destroy in finally.
// Never prints credential values. Sandbox id logged as first 8 chars only.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const WORKER_DIR = join(PROJECT_ROOT, 'workers', 'daytona-risk-worker');
const RESULTS_DIR = join(PROJECT_ROOT, 'smoke-tests', 'daytona', 'results');
const PUBLIC_RESULT = join(PROJECT_ROOT, 'app', 'public', 'daytona-risk-live-result.json');

const WORKER_FILES = [
  'index.mjs',
  'input-schema.mjs',
  'risk-engine.mjs',
  'graph-builder.mjs',
  'recovery-evaluator.mjs',
  'sanitize.mjs',
];

function buildCreateParams() {
  // SDK mutates labels (adds code-toolbox-language). Must be extensible.
  return {
    image: 'node:20-slim',
    language: 'javascript',
    resources: { cpu: 1, memory: 2 },
    networkBlockAll: true,
    ttlMinutes: 10,
    ephemeral: true,
    autoStopInterval: 5,
    autoDeleteInterval: 0,
    labels: {
      'stitchcheck-mode': 'daytona',
      'stitchcheck-purpose': 'risk-worker-only',
      'stitchcheck-phase': 'gate1-approved-live',
    },
  };
}

const CREATE_TIMEOUT_S = 180;
const WORKER_EXEC_TIMEOUT_S = 90;
const MISSING_SANDBOX = 'not available from Sandbox response';

function loadEnvLocal() {
  const envPath = join(PROJECT_ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eq = trimmed.indexOf('=');
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

function keyPresent() {
  const key = process.env.DAYTONA_API_KEY;
  return typeof key === 'string' && key.length > 0;
}

function redactId(id) {
  if (typeof id !== 'string' || id.length === 0) return 'unknown';
  return id.slice(0, 8);
}

function liveAllowed() {
  return process.env.ALLOW_LIVE === '1' && keyPresent();
}

function buildRiskInput() {
  return {
    itineraryId: 'itin-daytona-live-001',
    flightLegs: [
      {
        legId: 'leg-1',
        origin: 'KUL',
        destination: 'SIN',
        scheduledDeparture: '2026-09-15T08:00:00Z',
        scheduledArrival: '2026-09-15T09:00:00Z',
      },
      {
        legId: 'leg-2',
        origin: 'SIN',
        destination: 'BKK',
        scheduledDeparture: '2026-09-15T11:30:00Z',
        scheduledArrival: '2026-09-15T13:00:00Z',
      },
    ],
    connectionDurationMinutes: 150,
    downstreamCommitments: ['hotel-checkin'],
    hotelCheckinCutoff: '2026-09-15T18:00:00Z',
    candidateRecoveryOptions: [
      { optionId: 'opt-1', routeSummary: 'KUL → SIN', connectionType: 'nonstop' },
      { optionId: 'opt-2', routeSummary: 'KUL → SIN', connectionType: '1-stop' },
    ],
    deterministicSeed: 'stitchcheck-daytona-live-risk-001',
    scenarioLimit: 5,
  };
}

function stampWorkerResult(raw, meta) {
  const result = raw && typeof raw === 'object' ? { ...raw } : {};
  result.executed = true;
  result.fallbackUsed = false;
  result.executionEnvironment = 'daytona-live-risk';
  result.evidenceLabel = 'Daytona live risk computation \u2014 read-only, sandboxed';
  result.jobOrServiceReference = meta.sandboxIdFirst8;
  if (!result.provenance || typeof result.provenance !== 'object') {
    result.provenance = {};
  }
  result.provenance = {
    ...result.provenance,
    executed: true,
    fallbackUsed: false,
    readOnly: true,
    sandboxDestroyed: meta.sandboxDestroyed,
    label: 'Daytona live risk computation \u2014 read-only, sandboxed',
  };
  result.externalWriteOccurred = false;
  return result;
}

async function main() {
  loadEnvLocal();

  if (!liveAllowed()) {
    console.log('[daytona-live-risk] REFUSED: need ALLOW_LIVE=1 and DAYTONA_API_KEY present.');
    process.exit(2);
  }

  const correlationId = process.env.CORRELATION_ID || `daytona-live-${randomUUID()}`;
  const startedAt = new Date().toISOString();

  const { Daytona } = await import('@daytona/sdk');
  const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY });

  let sandbox = null;
  let sandboxDestroyed = false;
  let destroyError = null;
  let workerRaw = null;
  let execExit = null;
  let cycleError = null;

  try {
    console.log('[daytona-live-risk] Creating sandbox (image=node:20-slim, networkBlockAll, ttl=10m)...');
    sandbox = await daytona.create(buildCreateParams(), { timeout: CREATE_TIMEOUT_S });
    console.log(`[daytona-live-risk] Created sandbox ${redactId(sandbox.id)}`);

    await sandbox.fs.createFolder('worker', '755');
    await sandbox.fs.createFolder('worker/input', '755');
    await sandbox.fs.createFolder('worker/output', '755');

    for (const file of WORKER_FILES) {
      await sandbox.fs.uploadFile(join(WORKER_DIR, file), `worker/${file}`);
    }
    const inputJson = JSON.stringify(buildRiskInput(), null, 2);
    await sandbox.fs.uploadFile(Buffer.from(inputJson), 'worker/input/risk-request.json');
    console.log('[daytona-live-risk] Worker files uploaded.');

    const exec = await sandbox.process.executeCommand(
      'node worker/index.mjs',
      undefined,
      {
        CORRELATION_ID: correlationId,
        EXECUTION_MODE: 'daytona-live-risk',
        TIMEOUT_MS: '5000',
      },
      WORKER_EXEC_TIMEOUT_S,
    );
    execExit = exec.exitCode;
    console.log(`[daytona-live-risk] Worker exitCode=${exec.exitCode}`);
    if (typeof exec.result === 'string' && exec.result.length > 0) {
      const snippet = exec.result.slice(0, 400).replace(/https?:\/\/[^\s]+/g, '[REDACTED]');
      console.log(`[daytona-live-risk] Worker stdout (truncated): ${snippet}`);
    }

    const buf = await sandbox.fs.downloadFile('worker/output/result.json');
    workerRaw = JSON.parse(buf.toString('utf8'));
    console.log('[daytona-live-risk] Downloaded worker output.');
  } catch (err) {
    cycleError = err;
    console.error(`[daytona-live-risk] Cycle error: ${err?.message || String(err)}`);
  } finally {
    if (sandbox) {
      try {
        console.log(`[daytona-live-risk] Destroying sandbox ${redactId(sandbox.id)}...`);
        await daytona.delete(sandbox, 60, true);
        sandboxDestroyed = true;
        console.log('[daytona-live-risk] Sandbox destroyed (confirmed).');
      } catch (err) {
        destroyError = err;
        console.error(`[daytona-live-risk] Destroy failed: ${err?.message || String(err)}`);
        console.error('[daytona-live-risk] TTL/ephemeral will auto-delete within 10 minutes.');
      }
    }
  }

  const success = Boolean(workerRaw) && execExit === 0 && sandboxDestroyed && !cycleError;
  const envelope = {
    envelopeVersion: 1,
    correlationId,
    startedAt,
    finishedAt: new Date().toISOString(),
    sandboxIdFirst8: sandbox ? redactId(sandbox.id) : null,
    sandboxDestroyed,
    destroyError: destroyError ? String(destroyError.message || destroyError).slice(0, 200) : null,
    cycleError: cycleError ? String(cycleError.message || cycleError).slice(0, 200) : null,
    execExitCode: execExit,
    success,
    missingFieldLabel: MISSING_SANDBOX,
    workerResult: workerRaw ? stampWorkerResult(workerRaw, {
      sandboxIdFirst8: sandbox ? redactId(sandbox.id) : 'unknown',
      sandboxDestroyed,
    }) : null,
  };

  mkdirSync(RESULTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const archived = join(RESULTS_DIR, `daytona-live-risk-${ts}.json`);
  writeFileSync(archived, JSON.stringify(envelope, null, 2) + '\n', 'utf8');
  console.log(`[daytona-live-risk] Evidence written: ${archived}`);

  if (success) {
    mkdirSync(dirname(PUBLIC_RESULT), { recursive: true });
    writeFileSync(PUBLIC_RESULT, JSON.stringify(envelope, null, 2) + '\n', 'utf8');
    console.log('[daytona-live-risk] Public live result written for the app.');
  } else {
    console.log('[daytona-live-risk] Not writing public live result (cycle not clean).');
  }

  process.exit(success ? 0 : 1);
}

main().catch((err) => {
  console.error(`[daytona-live-risk] Fatal: ${err?.message || String(err)}`);
  process.exit(1);
});
