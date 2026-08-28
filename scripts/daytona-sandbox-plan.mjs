// Daytona create-sandbox request plan for StitchCheck.
//
// STATUS: DRAFT — this file only CONSTRUCTS and PRINTS the create-sandbox
// request. In its default mode it performs a DRY RUN and makes NO network
// call and creates NO sandbox.
//
// Verified against the real @daytona/sdk type definitions (v0.205.1):
//   - DaytonaConfig:                apiKey, apiUrl, target
//   - create(params, options):      params = CreateSandboxFromImageParams,
//                                   options = { timeout?: number (seconds) }
//   - CreateSandboxBaseParams:      image, resources, envVars, labels,
//                                   autoStopInterval, autoDeleteInterval,
//                                   ttlMinutes, ephemeral, networkBlockAll,
//                                   domainAllowList, ...
//   - Resources:                    { cpu?, gpu?, gpuType?, memory?, disk? }
//                                   (memory/disk are GiB)
//   - domainAllowList:              string, comma-separated allowed domains
//   - networkBlockAll:              boolean
//   - process.executeCommand(..., timeout): timeout in seconds (for the
//                                   worker exec the Lead Agent runs later)
//
// Safety:
//   - Reads DAYTONA_API_KEY from process.env but NEVER prints/logs/persists it.
//   - Live creation is guarded: requires ALLOW_LIVE=1 AND a present API key.
//   - @daytona/sdk is imported lazily, ONLY on the live path, so this file
//     runs as a dry run even when the SDK is not installed.

/* ── Exact sandbox request (Approval Gate 1) ── */

// Comma-separated domain allow-list. Restricted to PyPI (pypi.org,
// files.pythonhosted.org), astral.sh, and the Atlas sandbox host. Everything
// else is blocked by networkBlockAll below.
const DOMAIN_ALLOW_LIST = 'pypi.org,files.pythonhosted.org,astral.sh,sandbox.atriptech.com';

// The exact create-sandbox request parameters, mapped to real SDK property
// names from CreateSandboxFromImageParams / CreateSandboxBaseParams.
const CREATE_SANDBOX_PARAMS = Object.freeze({
  image: 'node:20-slim',                                  // Image: node:20-slim
  resources: Object.freeze({                              // Resources: { cpu: 1, memory: 2 }
    cpu: 1,                                               //   cpu in cores
    memory: 2,                                            //   memory in GiB
  }),
  networkBlockAll: true,                                  // Network: block all otherwise
  domainAllowList: DOMAIN_ALLOW_LIST,                     // Network: PyPI + astral.sh + Atlas sandbox only
  ttlMinutes: 10,                                         // TTL: 10 minutes (hard cap)
  ephemeral: true,                                        // Ephemeral: true
  autoStopInterval: 5,                                    // Auto-stop: 5 minutes
  autoDeleteInterval: 0,                                  // Auto-delete: 0 (delete immediately on stop)
  labels: Object.freeze({
    'stitchcheck-mode': 'daytona',
    'stitchcheck-purpose': 'atlas-read-only-worker',
    'stitchcheck-phase': 'approval-gate-1-draft',
  }),
});

// Options for the create() call. `timeout` is in SECONDS in the real SDK.
// Spec requires exec timeout >= 90 seconds.
const CREATE_SANDBOX_OPTIONS = Object.freeze({
  timeout: 90,                                            // Exec timeout: >= 90 seconds
});

// Separate documentation of the worker-exec timeout the Lead Agent will use
// later with sandbox.process.executeCommand(command, cwd, env, timeoutSeconds).
// Kept here for the Approval Gate 1 presentation; not part of the create call.
const WORKER_EXEC_TIMEOUT_SECONDS = 90;                   // >= 90 seconds

/* ── Secret handling ── */

// Reads the API key from the environment WITHOUT ever exposing its value.
// We only ever surface a boolean ("present" / "absent") in logs.
function readApiKeyPresence() {
  const key = process.env.DAYTONA_API_KEY;
  const present = typeof key === 'string' && key.length > 0;
  return { present };
}

/* ── Live-execution guard ── */

// CLEARLY MARKED GUARD:
// No sandbox is ever created unless BOTH of the following are true:
//   1. ALLOW_LIVE=1 is set in the environment, AND
//   2. DAYTONA_API_KEY is present.
// In this task we only ever run the DRY RUN. Live execution happens later,
// by the serial Lead Agent, only after Approval Gate 1 receives "approved".
function liveExecutionAllowed() {
  const { present } = readApiKeyPresence();
  const flagSet = process.env.ALLOW_LIVE === '1';
  return flagSet && present;
}

/* ── Dry-run summary ── */

function printDryRunSummary() {
  const { present } = readApiKeyPresence();

  console.log('=== DAYTONA CREATE-SANDBOX REQUEST — DRY RUN (no live call) ===');
  console.log('');
  console.log('DAYTONA_API_KEY present:        ' + (present ? 'yes (value never printed)' : 'NO'));
  console.log('ALLOW_LIVE flag set:            ' + (process.env.ALLOW_LIVE === '1' ? 'yes' : 'no'));
  console.log('');
  console.log('--- create(params) — CreateSandboxFromImageParams ---');
  console.log('image:                          ' + CREATE_SANDBOX_PARAMS.image);
  console.log('resources.cpu:                  ' + CREATE_SANDBOX_PARAMS.resources.cpu);
  console.log('resources.memory:               ' + CREATE_SANDBOX_PARAMS.resources.memory + ' (GiB)');
  console.log('networkBlockAll:                ' + CREATE_SANDBOX_PARAMS.networkBlockAll);
  console.log('domainAllowList:                ' + CREATE_SANDBOX_PARAMS.domainAllowList);
  console.log('ttlMinutes:                     ' + CREATE_SANDBOX_PARAMS.ttlMinutes + ' (hard cap)');
  console.log('ephemeral:                      ' + CREATE_SANDBOX_PARAMS.ephemeral);
  console.log('autoStopInterval:               ' + CREATE_SANDBOX_PARAMS.autoStopInterval + ' (minutes)');
  console.log('autoDeleteInterval:             ' + CREATE_SANDBOX_PARAMS.autoDeleteInterval + ' (minutes)');
  console.log('labels:                         ' + JSON.stringify(CREATE_SANDBOX_PARAMS.labels));
  console.log('');
  console.log('--- create(params, options) ---');
  console.log('options.timeout:                ' + CREATE_SANDBOX_OPTIONS.timeout + ' (seconds, >= 90 required)');
  console.log('');
  console.log('--- worker exec (used later by Lead Agent, not part of create) ---');
  console.log('workerExecTimeoutSeconds:       ' + WORKER_EXEC_TIMEOUT_SECONDS + ' (seconds)');
  console.log('');
  console.log('RESULT: request constructed; NO sandbox created; NO network call made.');
  console.log('To run live later (Lead Agent only, after Approval Gate 1 "approved"):');
  console.log('  ALLOW_LIVE=1 DAYTONA_API_KEY=<set-but-never-logged> node scripts/daytona-sandbox-plan.mjs');
}

/* ── Live path (guarded; NOT run in this task) ── */

async function runLive() {
  // Lazy dynamic import so the dry run works even if @daytona/sdk is absent.
  const { Daytona } = await import('@daytona/sdk');

  // Read the key locally; pass it straight to the client; never log it.
  const apiKey = process.env.DAYTONA_API_KEY;

  const daytona = new Daytona({ apiKey });

  console.log('[daytona-sandbox-plan] LIVE: creating sandbox (guarded path)...');
  const sandbox = await daytona.create(CREATE_SANDBOX_PARAMS, CREATE_SANDBOX_OPTIONS);
  console.log('[daytona-sandbox-plan] LIVE: sandbox created: ' + sandbox.id);

  // NOTE: The Lead Agent is responsible for provisioning, running the worker,
  // downloading sanitized evidence, and destroying the sandbox in a `finally`
  // block. This draft only demonstrates the exact create-sandbox request.
  return sandbox;
}

/* ── Entry point ── */

async function main() {
  if (!liveExecutionAllowed()) {
    printDryRunSummary();
    return;
  }

  // Guard passed: this is the live path. It is intentionally NOT exercised in
  // the current (draft) task. Only the serial Lead Agent runs this after
  // Approval Gate 1 receives explicit "approved".
  await runLive();
}

const isMain = process.argv[1] &&
  (process.argv[1].endsWith('daytona-sandbox-plan.mjs') ||
   process.argv[1].endsWith('daytona-sandbox-plan'));

if (isMain) {
  main().catch((error) => {
    console.error('[daytona-sandbox-plan] Fatal: ' + error.message);
    process.exit(1);
  });
}

export {
  CREATE_SANDBOX_PARAMS,
  CREATE_SANDBOX_OPTIONS,
  DOMAIN_ALLOW_LIST,
  WORKER_EXEC_TIMEOUT_SECONDS,
  readApiKeyPresence,
  liveExecutionAllowed,
  printDryRunSummary,
  main,
};
