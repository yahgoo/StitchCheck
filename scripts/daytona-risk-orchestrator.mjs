// Daytona risk orchestrator — offline mock for StitchCheck.
//
// STATUS: OFFLINE-ONLY MOCK — ZERO LIVE EXECUTION
//
// Manages a fully mocked Daytona sandbox lifecycle for risk computation.
// No real Daytona SDK, no network, no credentials, no PII, no provider calls.
//
// Lifecycle:
//   validate input
//   → create mock sandbox
//   → upload mock worker/input
//   → execute mock worker
//   → download mock result
//   → sanitize result
//   → build risk envelope
//   → destroy mock sandbox (finally)
//
// Safety guarantees:
//   - No real Daytona SDK call.
//   - No network (no fetch/http/https/net/socket).
//   - No credentials read or written.
//   - No PII in any output.
//   - No Atlas/Nosana/Gemini/OpenRouter calls.
//   - Bounded input/output (MAX_INPUT_BYTES / MAX_OUTPUT_BYTES).
//   - Fixed timeout (WORKER_TIMEOUT_MS).
//   - Deterministic result (seeded from correlationId + scenario).
//   - Guaranteed cleanup (sandbox destroyed in finally).
//   - Explicit 'daytona-offline-mock' provenance.
//   - No booking/payment/order/ticket/refund/cancellation/supplier-write.
//   - externalWriteOccurred === false always.
//
// Provenance label:
//   "Daytona offline mock — no live risk computation executed"

import { randomUUID } from 'node:crypto';

/* ── Configuration ── */

export const RISK_ORCHESTRATOR_CONFIG = Object.freeze({
  /** Maximum input payload size in bytes. */
  maxInputBytes: 4096,
  /** Maximum output payload size in bytes. */
  maxOutputBytes: 8192,
  /** Fixed worker execution timeout in milliseconds. */
  workerTimeoutMs: 5000,
  /** Sandbox auto-stop interval in minutes. */
  sandboxAutoStopMinutes: 5,
  /** Sandbox TTL in minutes. */
  sandboxTtlMinutes: 15,
  /** Fixed mock worker latency in milliseconds (deterministic). */
  mockWorkerLatencyMs: 42,
});

/** Valid risk scenarios for the mock worker. */
export const VALID_RISK_SCENARIOS = Object.freeze([
  'success', 'unavailable', 'error', 'timeout', 'failure',
]);

/** Valid risk bands. */
export const VALID_RISK_BANDS = Object.freeze([
  'low', 'medium', 'high', 'critical',
]);

/* ── Forbidden keys — consistent with core/evidence/normalizer.ts ── */

export const FORBIDDEN_KEYS = Object.freeze(new Set([
  'apiKey', 'api_key', 'secret', 'password', 'token',
  'authorization', 'bearer', 'credential',
  'name', 'firstName', 'lastName', 'surname',
  'email', 'emailAddress', 'phone', 'phoneNumber',
  'passenger', 'passengers', 'bookingReference', 'pnr',
  'payment', 'cardNumber', 'passport', 'dateOfBirth', 'address',
]));

/* ── Forbidden write operations — none of these can ever occur ── */

const FORBIDDEN_WRITE_OPS = Object.freeze(new Set([
  'book', 'create_booking', 'reserve', 'ticket', 'issue',
  'pay', 'purchase', 'cancel', 'change', 'refund', 'order',
  'create_order', 'supplier_write', 'booking', 'payment',
  'cancellation', 'refund_request',
]));

/* ── Deterministic mock worker ── */

/**
 * Derives a deterministic numeric seed from a string.
 * Pure function: same input → same output.
 */
function deriveNumericSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Deterministic mock risk computation.
 * Given the same correlationId + scenario, always produces the same result.
 * No network, no side effects, no credentials.
 */
function deterministicMockCompute(correlationId, scenario, riskBand) {
  const seed = deriveNumericSeed(correlationId + ':' + scenario + ':' + riskBand);
  let state = seed | 0;
  function nextRand() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  let score;
  let effectiveBand;
  let fallbackUsed;
  let errorCode = null;
  let errorMessage = null;

  switch (scenario) {
    case 'success':
      if (riskBand && VALID_RISK_BANDS.includes(riskBand)) {
        effectiveBand = riskBand;
      } else {
        effectiveBand = 'medium';
      }
      switch (effectiveBand) {
        case 'low':      score = 10 + Math.round(nextRand() * 20); break;
        case 'medium':   score = 35 + Math.round(nextRand() * 25); break;
        case 'high':     score = 65 + Math.round(nextRand() * 20); break;
        case 'critical': score = 88 + Math.round(nextRand() * 12); break;
      }
      fallbackUsed = false;
      break;
    case 'unavailable':
      score = null;
      effectiveBand = 'unavailable';
      fallbackUsed = true;
      errorCode = 'provider_unavailable';
      errorMessage = 'Mock provider unavailable';
      break;
    case 'error':
      score = null;
      effectiveBand = 'error';
      fallbackUsed = true;
      errorCode = 'mock_worker_error';
      errorMessage = 'Mock worker error';
      break;
    case 'timeout':
      score = null;
      effectiveBand = 'timeout';
      fallbackUsed = true;
      errorCode = 'mock_worker_timeout';
      errorMessage = 'Mock worker timeout';
      break;
    case 'failure':
      score = null;
      effectiveBand = 'failure';
      fallbackUsed = true;
      errorCode = 'mock_worker_failure';
      errorMessage = 'Mock worker failure';
      break;
    default:
      score = null;
      effectiveBand = 'error';
      fallbackUsed = true;
      errorCode = 'unknown_scenario';
      errorMessage = 'Unknown scenario: ' + scenario;
  }

  return Object.freeze({
    riskScore: score,
    riskBand: effectiveBand,
    fallbackUsed,
    errorCode,
    errorMessage,
    simulationCount: 1000,
    assumptions: Object.freeze([
      'Deterministic computation — no live risk computation executed',
      'Seeded from correlationId + scenario',
    ]),
  });
}

/* ── Mock sandbox client ── */

/**
 * Creates a mock Daytona sandbox client for offline risk orchestration.
 * No real sandbox is created. All operations are simulated in-memory.
 *
 * Returns an object with create/delete methods and a lifecycle log.
 */
export function createMockRiskSandboxClient() {
  let counter = 0;
  const lifecycleLog = [];

  return {
    /** Array of lifecycle events for inspection/testing. */
    lifecycleLog,

    async create(params) {
      counter += 1;
      const id = `mock-risk-sandbox-${counter}-${randomUUID().slice(0, 8)}`;
      lifecycleLog.push({ event: 'create', sandboxId: id, timestamp: new Date().toISOString() });

      let uploadedFiles = [];
      let workerOutput = null;
      let destroyed = false;

      return {
        id,
        state: 'started',

        fs: {
          async uploadFile(path, content) {
            if (destroyed) throw new Error('Sandbox already destroyed');
            uploadedFiles.push({ path, size: Buffer.byteLength(content) });
            lifecycleLog.push({ event: 'upload', path, size: Buffer.byteLength(content) });
          },

          async downloadFile(path) {
            if (destroyed) throw new Error('Sandbox already destroyed');
            lifecycleLog.push({ event: 'download', path });
            if (workerOutput) {
              return Buffer.from(JSON.stringify(workerOutput));
            }
            return Buffer.from('{}');
          },
        },

        process: {
          async exec(cmd, opts) {
            if (destroyed) throw new Error('Sandbox already destroyed');
            lifecycleLog.push({ event: 'exec', cmd, timeoutMs: opts?.timeout });

            /* Simulate timeout if configured */
            if (opts?._simulateTimeout) {
              throw new Error('Worker execution timed out');
            }

            /* Simulate worker failure if configured */
            if (opts?._simulateFailure) {
              return { exitCode: 1, stderr: 'Mock worker failure' };
            }

            return { exitCode: 0, stderr: '' };
          },
        },

        /** Test-only: set the output that downloadFile will return. */
        _setOutput(output) {
          workerOutput = output;
        },

        /** Test-only: mark sandbox as destroyed (called by client.delete). */
        _markDestroyed() {
          destroyed = true;
        },

        _isDestroyed() {
          return destroyed;
        },

        _getUploadedFiles() {
          return [...uploadedFiles];
        },
      };
    },

    async delete(sandbox, opts) {
      const id = sandbox?.id || 'unknown';
      lifecycleLog.push({ event: 'delete', sandboxId: id, timestamp: new Date().toISOString() });
      sandbox._markDestroyed();
    },
  };
}

/* ── Sanitization ── */

/**
 * Recursively strips forbidden keys (credentials, PII) from a value.
 * Returns a new object; does not mutate the input.
 */
export function sanitizeRiskOutput(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeRiskOutput);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    result[key] = typeof value === 'object' && value !== null
      ? sanitizeRiskOutput(value)
      : value;
  }
  return result;
}

/* ── Input validation ── */

/**
 * Validates orchestrator input.
 * Returns { valid: true, correlationId, scenario, riskBand } or
 * { valid: false, reason }.
 */
export function validateRiskInput(options) {
  if (!options || typeof options !== 'object') {
    return { valid: false, reason: 'options must be a non-null object' };
  }

  /* Correlation ID — use explicit undefined/null check, not ||, to catch empty string */
  let correlationId = (options.correlationId !== undefined && options.correlationId !== null)
    ? options.correlationId
    : null;
  if (correlationId !== null) {
    if (typeof correlationId !== 'string' || correlationId.length === 0 || correlationId.length > 128) {
      return { valid: false, reason: 'correlationId must be a non-empty string of max 128 chars' };
    }
  } else {
    correlationId = randomUUID();
  }

  /* Scenario */
  let scenario = options.scenario || 'success';
  if (!VALID_RISK_SCENARIOS.includes(scenario)) {
    return { valid: false, reason: `Invalid scenario '${scenario}'. Must be one of: ${VALID_RISK_SCENARIOS.join(', ')}` };
  }

  /* Risk band (optional) */
  let riskBand = options.riskBand || null;
  if (riskBand !== null && !VALID_RISK_BANDS.includes(riskBand)) {
    return { valid: false, reason: `Invalid riskBand '${riskBand}'. Must be one of: ${VALID_RISK_BANDS.join(', ')}` };
  }

  /* Input size check */
  const inputPayload = JSON.stringify(options);
  if (Buffer.byteLength(inputPayload) > RISK_ORCHESTRATOR_CONFIG.maxInputBytes) {
    return {
      valid: false,
      reason: `Input exceeds maximum size of ${RISK_ORCHESTRATOR_CONFIG.maxInputBytes} bytes`,
    };
  }

  return { valid: true, correlationId, scenario, riskBand };
}

/* ── Write-operation safety assertion ── */

/**
 * Asserts that no forbidden write operation exists in the output.
 * Returns { safe: true } or { safe: false, violations: string[] }.
 */
export function assertNoWriteOperations(output) {
  const violations = [];

  function scan(obj, path) {
    if (obj === null || obj === undefined || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => scan(item, `${path}[${i}]`));
      return;
    }
    for (const [key, value] of Object.entries(obj)) {
      if (FORBIDDEN_WRITE_OPS.has(key.toLowerCase())) {
        violations.push(`forbidden write key '${key}' at ${path}`);
      }
      if (typeof value === 'object' && value !== null) {
        scan(value, `${path}.${key}`);
      }
    }
  }

  scan(output, 'root');
  return violations.length === 0
    ? { safe: true, violations: [] }
    : { safe: false, violations };
}

/**
 * Asserts that no credentials or PII leaked into the output.
 * Returns { clean: true } or { clean: false, leakedKeys: string[] }.
 */
export function assertNoCredentialLeakage(output) {
  const leaked = [];

  function scan(obj, path) {
    if (obj === null || obj === undefined || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => scan(item, `${path}[${i}]`));
      return;
    }
    for (const [key, value] of Object.entries(obj)) {
      if (FORBIDDEN_KEYS.has(key)) {
        leaked.push(`${key} at ${path}`);
      }
      if (typeof value === 'object' && value !== null) {
        scan(value, `${path}.${key}`);
      }
    }
  }

  scan(output, 'root');
  return leaked.length === 0
    ? { clean: true, leakedKeys: [] }
    : { clean: false, leakedKeys: leaked };
}

/* ── Envelope constructors ── */

function createRiskFallbackEnvelope(correlationId, reason) {
  return Object.freeze({
    envelopeVersion: 1,
    correlationId,
    sandboxId: '',
    createdAt: new Date().toISOString(),
    destroyedAt: null,
    executionMode: 'daytona-offline-mock',
    riskResult: Object.freeze({
      riskBand: 'error',
      riskScore: null,
      fallbackUsed: true,
      errorCode: 'orchestrator_fallback',
      errorMessage: reason,
      simulationCount: 0,
      assumptions: Object.freeze([]),
    }),
    sanitized: true,
    externalWriteOccurred: false,
    provenance: Object.freeze({
      evidenceSource: 'daytona-offline-mock',
      provider: 'daytona-mock',
      executed: false,
      fallbackUsed: true,
      readOnly: true,
      sandboxDestroyed: false,
      externalWriteOccurred: false,
      label: 'Daytona sandbox \u2014 risk analysis computed locally, no live risk service called',
    }),
    lifecycle: Object.freeze({
      stagesCompleted: Object.freeze([]),
      sandboxCreated: false,
      sandboxDestroyed: false,
    }),
  });
}

function createRiskSuccessEnvelope(correlationId, sandboxId, riskResult, sanitizedResult, sandboxDestroyed, lifecycleStages) {
  return Object.freeze({
    envelopeVersion: 1,
    correlationId,
    sandboxId,
    createdAt: new Date().toISOString(),
    destroyedAt: sandboxDestroyed ? new Date().toISOString() : null,
    executionMode: 'daytona-offline-mock',
    riskResult: Object.freeze({ ...riskResult }),
    sanitized: true,
    externalWriteOccurred: false,
    provenance: Object.freeze({
      evidenceSource: 'daytona-offline-mock',
      provider: 'daytona-mock',
      executed: true,
      fallbackUsed: riskResult.fallbackUsed,
      readOnly: true,
      sandboxDestroyed,
      externalWriteOccurred: false,
      label: 'Daytona sandbox \u2014 risk analysis computed locally, no live risk service called',
    }),
    lifecycle: Object.freeze({
      stagesCompleted: Object.freeze([...lifecycleStages]),
      sandboxCreated: true,
      sandboxDestroyed,
    }),
  });
}

/* ── Main orchestrator ── */

/**
 * Runs the offline mock Daytona risk orchestrator.
 *
 * Lifecycle:
 *   1. Validate input
 *   2. Create mock sandbox
 *   3. Upload mock worker/input
 *   4. Execute mock worker
 *   5. Download mock result
 *   6. Sanitize result
 *   7. Build risk envelope
 *   8. Destroy mock sandbox (finally)
 *
 * @param {object} options
 * @param {string} [options.correlationId] - Correlation ID (auto-generated if omitted)
 * @param {string} [options.scenario] - Risk scenario: success|unavailable|error|timeout|failure
 * @param {string} [options.riskBand] - Risk band: low|medium|high|critical (for success scenario)
 * @param {boolean} [options._simulateTimeout] - Test-only: simulate worker timeout
 * @param {boolean} [options._simulateFailure] - Test-only: simulate worker failure
 * @returns {object} { envelope, lifecycle }
 */
export async function runDaytonaRiskOrchestrator(options = {}) {
  const stagesCompleted = [];
  let sandbox = null;
  let sandboxDestroyed = false;
  let client = null;
  let computedResult = null;
  let sanitizedResult = null;
  let orchestrationError = null;

  /* ── Stage 1: Validate input ── */
  const validation = validateRiskInput(options);
  if (!validation.valid) {
    console.log(`[daytona-risk-orchestrator] Validation failed: ${validation.reason}`);
    const envelope = createRiskFallbackEnvelope(
      options?.correlationId || 'invalid-input',
      validation.reason,
    );
    return { envelope, lifecycle: { stagesCompleted, sandboxCreated: false, sandboxDestroyed: false } };
  }

  const { correlationId, scenario, riskBand } = validation;
  console.log(`[daytona-risk-orchestrator] Starting: correlationId=${correlationId}, scenario=${scenario}`);
  stagesCompleted.push('validate-input');

  try {
    /* ── Stage 2: Create mock sandbox ── */
    client = createMockRiskSandboxClient();
    sandbox = await client.create({
      language: 'typescript',
      image: 'node:20-slim',
      resources: { cpu: 1, memory: 2 },
      ephemeral: true,
      autoStopInterval: RISK_ORCHESTRATOR_CONFIG.sandboxAutoStopMinutes,
      ttlMinutes: RISK_ORCHESTRATOR_CONFIG.sandboxTtlMinutes,
      labels: {
        'stitchcheck-mode': 'daytona-offline-mock',
        'stitchcheck-purpose': 'risk-computation',
      },
    });
    console.log(`[daytona-risk-orchestrator] Mock sandbox created: ${sandbox.id}`);
    stagesCompleted.push('create-sandbox');

    /* ── Stage 3: Upload mock worker/input ── */
    const workerPayload = JSON.stringify({
      correlationId,
      scenario,
      riskBand,
      computationType: 'deterministic-mock',
    });

    if (Buffer.byteLength(workerPayload) > RISK_ORCHESTRATOR_CONFIG.maxInputBytes) {
      throw new Error(`Worker payload exceeds maximum input size of ${RISK_ORCHESTRATOR_CONFIG.maxInputBytes} bytes`);
    }

    await sandbox.fs.uploadFile('/worker/input.json', Buffer.from(workerPayload));
    await sandbox.fs.uploadFile('/worker/index.mjs', Buffer.from('// deterministic mock risk worker'));
    stagesCompleted.push('upload-worker');
    console.log('[daytona-risk-orchestrator] Mock worker and input uploaded');

    /* ── Stage 4: Execute mock worker ── */
    const execOptions = {
      timeout: RISK_ORCHESTRATOR_CONFIG.workerTimeoutMs,
      env: {
        CORRELATION_ID: correlationId,
        SCENARIO: scenario,
      },
    };

    /* Test-only simulation flags */
    if (options._simulateTimeout) execOptions._simulateTimeout = true;
    if (options._simulateFailure) execOptions._simulateFailure = true;

    const execResult = await sandbox.process.exec(
      'node /worker/index.mjs',
      execOptions,
    );

    if (execResult.exitCode !== 0) {
      throw new Error(`Worker exited with code ${execResult.exitCode}: ${execResult.stderr || 'unknown error'}`);
    }

    stagesCompleted.push('execute-worker');
    console.log('[daytona-risk-orchestrator] Mock worker executed successfully');

    /* ── Stage 5: Download mock result ── */
    computedResult = deterministicMockCompute(correlationId, scenario, riskBand);
    sandbox._setOutput(computedResult);

    const downloadBuf = await sandbox.fs.downloadFile('/worker/output/risk-result.json');
    let rawOutput;
    try {
      rawOutput = JSON.parse(downloadBuf.toString('utf-8'));
    } catch {
      rawOutput = {};
    }

    /* Verify output size */
    const outputJson = JSON.stringify(rawOutput);
    if (Buffer.byteLength(outputJson) > RISK_ORCHESTRATOR_CONFIG.maxOutputBytes) {
      throw new Error(`Worker output exceeds maximum size of ${RISK_ORCHESTRATOR_CONFIG.maxOutputBytes} bytes`);
    }

    stagesCompleted.push('download-result');
    console.log('[daytona-risk-orchestrator] Mock result downloaded');

    /* ── Stage 6: Sanitize result ── */
    sanitizedResult = sanitizeRiskOutput(rawOutput);

    /* Safety assertions */
    const writeCheck = assertNoWriteOperations(sanitizedResult);
    if (!writeCheck.safe) {
      console.error(`[daytona-risk-orchestrator] CRITICAL: Write operations detected: ${writeCheck.violations.join(', ')}`);
      throw new Error('Sanitization failed: forbidden write operations detected in output');
    }

    const credCheck = assertNoCredentialLeakage(sanitizedResult);
    if (!credCheck.clean) {
      console.error(`[daytona-risk-orchestrator] CRITICAL: Credential leakage detected: ${credCheck.leakedKeys.join(', ')}`);
      throw new Error('Sanitization failed: credential/PII leakage detected in output');
    }

    stagesCompleted.push('sanitize-result');
    console.log('[daytona-risk-orchestrator] Result sanitized and verified');

  } catch (error) {
    console.error(`[daytona-risk-orchestrator] Error: ${error.message}`);
    orchestrationError = error;

  } finally {
    /* ── Stage 8: Always destroy mock sandbox ── */
    if (sandbox && client) {
      try {
        await client.delete(sandbox, { timeout: 5 });
        sandboxDestroyed = true;
        stagesCompleted.push('destroy-sandbox');
        console.log(`[daytona-risk-orchestrator] Mock sandbox destroyed: ${sandbox.id}`);
      } catch (deleteError) {
        console.error(`[daytona-risk-orchestrator] Sandbox deletion failed: ${deleteError.message}`);
        console.error('[daytona-risk-orchestrator] TTL will auto-destroy after 15 minutes.');
      }
    }
  }

  /* ── Stage 7: Build risk envelope (after finally, so lifecycle is complete) ── */
  let envelope;
  if (orchestrationError) {
    envelope = createRiskFallbackEnvelope(correlationId, orchestrationError.message);
  } else {
    envelope = createRiskSuccessEnvelope(
      correlationId,
      sandbox.id,
      computedResult,
      sanitizedResult,
      sandboxDestroyed,
      stagesCompleted,
    );
    console.log(`[daytona-risk-orchestrator] Risk envelope built: band=${computedResult.riskBand}, score=${computedResult.riskScore}`);
  }

  return {
    envelope,
    lifecycle: {
      stagesCompleted: [...stagesCompleted],
      sandboxCreated: !!sandbox,
      sandboxDestroyed,
    },
  };
}

/* ── CLI entry point ── */

const isMain = process.argv[1] &&
  (process.argv[1].endsWith('daytona-risk-orchestrator.mjs') ||
   process.argv[1].endsWith('daytona-risk-orchestrator'));

if (isMain) {
  const args = process.argv.slice(2);
  const corrIdArg = args.find(a => a.startsWith('--correlation-id='));
  const scenarioArg = args.find(a => a.startsWith('--scenario='));
  const riskBandArg = args.find(a => a.startsWith('--risk-band='));

  const runOptions = {
    correlationId: corrIdArg?.split('=')[1] || process.env.CORRELATION_ID || undefined,
    scenario: scenarioArg?.split('=')[1] || process.env.RISK_SCENARIO || 'success',
    riskBand: riskBandArg?.split('=')[1] || process.env.RISK_BAND || undefined,
  };

  runDaytonaRiskOrchestrator(runOptions)
    .then(({ envelope }) => {
      console.log('\n' + JSON.stringify(envelope, null, 2));
      console.log(`\n[daytona-risk-orchestrator] Provenance: ${envelope.provenance.label}`);
      console.log(`[daytona-risk-orchestrator] externalWriteOccurred: ${envelope.externalWriteOccurred}`);
    })
    .catch((error) => {
      console.error(`[daytona-risk-orchestrator] Fatal: ${error.message}`);
      process.exit(1);
    });
}
