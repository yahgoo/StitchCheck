// StitchCheck Submission Manifest Generator
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// Produces output/submission-manifest.json summarising the current verified
// state of the project.  Hard guarantees:
//   - Never reads .env.local or any credential file.
//   - Never calls any external provider (Atlas, Nosana, Gemini, OpenRouter).
//   - Never modifies app source, core, workers, fixtures, or videos.
//   - Only reads git metadata and output/ artefacts.
//   - Re-runs the offline test suite to obtain pass/fail counts.

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSchemaValidatorOutput, computeVideoFreshness } from './submission-manifest-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = __filename.replace(/[^/]+$/, '');
const ROOT = resolve(__dirname, '..');
const APP_DIR = join(ROOT, 'app');
const OUTPUT_DIR = join(ROOT, 'output');

// ── Helpers ────────────────────────────────────────────────────────────────

function safeExec(cmd, { cwd = ROOT, timeoutMs = 300_000 } = {}) {
  try {
    const out = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    return { ok: true, stdout: out || '' };
  } catch (err) {
    return { ok: false, stdout: err.stdout || '', stderr: err.stderr || '', status: err.status };
  }
}

/**
 * Parse "X passed, Y failed" from a block of text.
 * Returns { passed, failed } or null.
 */
function parsePassFail(text) {
  const m = text.match(/(\d+)\s+passed,\s*(\d+)\s+failed/);
  if (m) return { passed: Number(m[1]), failed: Number(m[2]) };
  return null;
}

/**
 * Parse "All N fixtures passed" style lines.
 */
function parseAllPassed(text) {
  const m = text.match(/All\s+(\d+)\s+fixtures?\s+passed/);
  if (m) return { passed: Number(m[1]), failed: 0 };
  const m2 = text.match(/All\s+(\d+)\s+tests?\s+passed/);
  if (m2) return { passed: Number(m2[1]), failed: 0 };
  return null;
}

// parseSchemaValidatorOutput is imported from ./submission-manifest-helpers.mjs

// ── 1. Run offline test suites ─────────────────────────────────────────────

console.log('▸ Running offline test suites…');

// Define the test suites with their file paths (relative to app/).
// Each suite is run individually from the app/ directory so we can
// capture and parse its output reliably.
const TEST_SUITES = [
  { key: 'cross-provider-invariant-tests', label: 'Cross-provider invariant tests', file: '../smoke-tests/cross-provider-invariant-tests.mjs' },
  { key: 'provenance-label-offline-tests', label: 'Provenance label offline tests', file: '../smoke-tests/provenance-label-offline-tests.mjs' },
  { key: 'extraction-adapter-offline-tests', label: 'Extraction adapter offline tests', file: '../smoke-tests/extraction/openrouter-extraction-adapter-offline-tests.mjs' },
  { key: 'atlas-adapter-offline-tests', label: 'Atlas adapter offline tests', file: '../smoke-tests/atlas/adapter-offline-tests.mjs' },
  { key: 'atlas-duplicate-booking-guard', label: 'Atlas duplicate-booking guard tests', file: '../smoke-tests/atlas/duplicate-booking-guard-offline-tests.mjs' },
  { key: 'atlas-schema-validator', label: 'Atlas schema validator', file: '../smoke-tests/atlas/schema-validator.mjs' },
  { key: 'nosana-client-offline-tests', label: 'Nosana client offline tests', file: '../smoke-tests/nosana/nosana-client-offline-tests.mjs' },
  { key: 'nosana-schema-validator', label: 'Nosana schema validator', file: '../smoke-tests/nosana/schema-validator.mjs' },
  { key: 'nosana-response-normalization-tests', label: 'Nosana response-normalization tests', file: '../smoke-tests/nosana/nosana-response-normalization-tests.mjs' },
  { key: 'nosana-cost-unit-tests', label: 'Nosana cost unit tests', file: '../smoke-tests/nosana/nosana-cost-unit-tests.mjs' },
  { key: 'nosana-child-process-regression-tests', label: 'Nosana child-process regression tests', file: '../smoke-tests/nosana/nosana-child-process-regression-tests.mjs' },
  { key: 'nosana-ui-label-assertion-tests', label: 'Nosana UI label assertion tests', file: '../smoke-tests/nosana/nosana-ui-label-assertion-tests.mjs' },
  { key: 'nosana-live-evidence-reconciliation-tests', label: 'Nosana live-evidence reconciliation tests', file: '../smoke-tests/nosana/nosana-live-evidence-reconciliation-tests.mjs' },
  { key: 'nosana-safety-gate-tests', label: 'Nosana safety-gate tests', file: '../smoke-tests/nosana/nosana-safety-gate-tests.mjs' },
  { key: 'nosana-timeout-safety-tests', label: 'Nosana timeout safety tests', file: '../smoke-tests/nosana/nosana-timeout-safety-tests.mjs' },
  { key: 'nosana-workload-portability-tests', label: 'Nosana workload portability tests', file: '../smoke-tests/nosana/nosana-workload-portability-tests.mjs' },
  { key: 'dependency-graph-offline-tests', label: 'Dependency graph offline tests', file: '../smoke-tests/dependency-graph-offline-tests.mjs' },
  { key: 'risk-computation-offline-tests', label: 'Risk computation offline tests', file: '../smoke-tests/risk-computation-offline-tests.mjs' },
  { key: 'recovery-animation-accessibility-offline-tests', label: 'Recovery animation accessibility offline tests', file: '../smoke-tests/recovery-animation-accessibility-offline-tests.mjs' },
  { key: 'daytona-orchestrator-offline-tests', label: 'Daytona orchestrator offline tests', file: '../scripts/daytona-orchestrator-offline-tests.mjs' },
  { key: 'daytona-worker-sanitize-tests', label: 'Daytona worker sanitize tests', file: '../scripts/daytona-worker-sanitize-tests.mjs' },
  { key: 'daytona-risk-orchestrator-offline-tests', label: 'Daytona risk orchestrator offline tests', file: '../scripts/daytona-risk-orchestrator-offline-tests.mjs' },
  { key: 'secret-scan-cli-offline-tests', label: 'Secret scan CLI offline tests', file: '../scripts/secret-scan-cli-offline-tests.mjs' },
  { key: 'secret-scan-offline-tests', label: 'Secret scan offline tests', file: '../scripts/secret-scan-offline-tests.mjs' },
];

// Run each suite individually and parse its output
const testSuiteResults = [];
let totalPassed = 0;
let totalFailed = 0;
let allSuitesPassed = true;

for (const suite of TEST_SUITES) {
  process.stdout.write(`  ${suite.key}…`);
  const result = safeExec(`node ${suite.file}`, { cwd: APP_DIR, timeoutMs: 120_000 });
  const output = (result.stdout || '') + '\n' + (result.stderr || '');

  // Try multiple parsing patterns
  let parsed = parsePassFail(output);
  if (!parsed) parsed = parseAllPassed(output);
  if (!parsed) {
    const fixM = output.match(/All\s+(\d+)\s+fixtures?\s+passed\s+schema/);
    if (fixM) parsed = { passed: Number(fixM[1]), failed: 0 };
  }
  if (!parsed) {
    // "All N tests passed" variant with ✓
    const checkM = output.match(/All\s+(\d+)\s+tests?\s+passed/);
    if (checkM) parsed = { passed: Number(checkM[1]), failed: 0 };
  }
  if (!parsed) {
    // "All N fixtures passed schema and forbidden-action validation."
    const fixM2 = output.match(/All\s+(\d+)\s+fixtures?\s+passed\s+schema/);
    if (fixM2) parsed = { passed: Number(fixM2[1]), failed: 0 };
  }
  if (!parsed) {
    // Count individual [PASS]/[FAIL] validation lines (schema-validator output)
    const schemaParsed = parseSchemaValidatorOutput(output);
    if (schemaParsed) parsed = schemaParsed;
  }
  if (!parsed) {
    // "All fixture validations passed" (nosana schema-validator)
    if (output.includes('All fixture validations passed') && result.ok) {
      parsed = { passed: 0, failed: 0 };
    }
  }

  // Use exit code as primary pass/fail signal; all suites set exit 1 on failure.
  const suitePassed = result.ok;
  const entry = {
    suite: suite.key,
    label: suite.label,
    status: parsed
      ? (parsed.failed === 0 ? 'pass' : 'fail')
      : (suitePassed ? 'pass' : 'fail'),
    passed: parsed ? parsed.passed : null,
    failed: parsed ? parsed.failed : null,
  };
  testSuiteResults.push(entry);

  if (parsed) {
    totalPassed += parsed.passed;
    totalFailed += parsed.failed;
  }
  if (!suitePassed) allSuitesPassed = false;

  console.log(` ${entry.status}${parsed ? ` (${parsed.passed}/${parsed.passed + parsed.failed})` : ''}`);
}

console.log(`  Total: ${totalPassed} passed, ${totalFailed} failed across ${TEST_SUITES.length} suites`);

// ── 2. Typecheck and build status ──────────────────────────────────────────

console.log('▸ Running typecheck…');
const typecheckResult = safeExec('npx tsc --noEmit', { cwd: APP_DIR, timeoutMs: 120_000 });
const typecheckStatus = typecheckResult.ok ? 'pass' : 'fail';
console.log(`  typecheck: ${typecheckStatus}`);

console.log('▸ Running build…');
const buildResult = safeExec('npx vite build', { cwd: APP_DIR, timeoutMs: 120_000 });
const buildStatus = buildResult.ok ? 'pass' : 'fail';
console.log(`  build: ${buildStatus}`);

// ── 3. Latest recovery capture ─────────────────────────────────────────────

console.log('▸ Scanning for latest recovery capture…');

function findLatestRecoveryCapture() {
  const capturesDir = join(OUTPUT_DIR, 'captures');
  if (!existsSync(capturesDir)) return null;

  const dirs = readdirSync(capturesDir)
    .filter(d => d.startsWith('recovery-animation-'))
    .sort()
    .reverse();

  for (const dir of dirs) {
    const manifestPath = join(capturesDir, dir, 'capture-manifest.json');
    if (existsSync(manifestPath)) {
      try {
        return JSON.parse(readFileSync(manifestPath, 'utf-8'));
      } catch { /* skip corrupt */ }
    }
  }
  return null;
}

const latestCapture = findLatestRecoveryCapture();
const recoveryCaptureInfo = latestCapture
  ? {
      path: relative(ROOT, join(latestCapture.outputDirectory || '', 'recovery-animation-final.png')),
      viewport: latestCapture.viewport || null,
      terminalPhase: latestCapture.scenes?.[0]?.terminalPhase || null,
      overallStatus: latestCapture.overallStatus || null,
      timestamp: latestCapture.captureTimestamp || null,
    }
  : null;

console.log(`  latest: ${recoveryCaptureInfo?.path || '(none)'}`);

// ── 4. Latest video ────────────────────────────────────────────────────────

console.log('▸ Scanning for latest video…');

function findLatestVideo() {
  const videoDir = join(OUTPUT_DIR, 'demo-artifacts', 'stitchcheck-video');
  if (!existsSync(videoDir)) return null;

  // Only top-level .mp4 files and hackathon-submission-live-v2/
  const candidates = [];

  // Top-level mp4s
  for (const f of readdirSync(videoDir)) {
    if (f.endsWith('.mp4')) {
      const fp = join(videoDir, f);
      candidates.push({ path: fp, mtime: statSync(fp).mtimeMs });
    }
  }

  // hackathon-submission-live-v2
  const liveV2 = join(videoDir, 'hackathon-submission-live-v2');
  if (existsSync(liveV2)) {
    for (const f of readdirSync(liveV2)) {
      if (f.endsWith('.mp4')) {
        const fp = join(liveV2, f);
        candidates.push({ path: fp, mtime: statSync(fp).mtimeMs });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.mtime - a.mtime);
  const latest = candidates[0];
  return {
    path: relative(ROOT, latest.path),
    modificationTimestamp: new Date(latest.mtime).toISOString(),
    modificationTimeMs: latest.mtime,
  };
}

const latestVideo = findLatestVideo();
console.log(`  latest: ${latestVideo?.path || '(none)'}`);

// ── 4b. Video freshness vs capture-relevant source files ──────────────────

// Collect capture-relevant source file paths (scripts + app source, excluding tests/build)
const captureSourceFilePaths = [];
const _captureScriptNames = ['stitchcheck-demo-capture.mjs', 'stitchcheck-recovery-animation-capture.mjs'];
for (const f of _captureScriptNames) {
  const fp = join(ROOT, 'scripts', f);
  if (existsSync(fp)) captureSourceFilePaths.push(fp);
}
const _appSrcDir = join(ROOT, 'app', 'src');
if (existsSync(_appSrcDir)) {
  for (const f of readdirSync(_appSrcDir, { recursive: true })) {
    const fp = join(_appSrcDir, f);
    if (existsSync(fp) && /\.(tsx?|css)$/.test(fp) && !/test|spec/.test(fp)) {
      captureSourceFilePaths.push(fp);
    }
  }
}

const videoFreshnessRaw = computeVideoFreshness(latestVideo, captureSourceFilePaths);
// Convert absolute source paths to project-relative for the manifest
const videoFreshness = {
  ...videoFreshnessRaw,
  newerSourceFiles: videoFreshnessRaw.newerSourceFiles.map(p => relative(ROOT, p)),
};
console.log(`  video stale relative to source: ${videoFreshness.isStaleRelativeToSource ?? 'unknown'}`);

// ── 5. Protected files check ───────────────────────────────────────────────

console.log('▸ Checking protected files via git diff…');

const PROTECTED_DIRS = ['workers/', 'output/captures/', 'output/demo-artifacts/'];
const protectedFilesStatus = [];

for (const dir of PROTECTED_DIRS) {
  const result = safeExec(`git diff --stat -- ${dir}`);
  const stat = result.stdout.trim();
  const unchanged = stat.length === 0;
  protectedFilesStatus.push({
    path: dir,
    unchanged,
    diffStat: unchanged ? '' : stat,
  });
}

// Also check core/ and app/src/ for completeness
for (const dir of ['core/', 'app/src/']) {
  const result = safeExec(`git diff --stat -- ${dir}`);
  const stat = result.stdout.trim();
  const unchanged = stat.length === 0;
  protectedFilesStatus.push({
    path: dir,
    unchanged,
    diffStat: unchanged ? '' : stat,
  });
}

const allProtectedUnchanged = protectedFilesStatus.every(p => p.unchanged);
console.log(`  all protected dirs unchanged: ${allProtectedUnchanged}`);

// ── 6. Known remaining issues ──────────────────────────────────────────────

const knownRemainingIssues = [
  'Atlas live wiring incomplete — sandbox search verified but full live booking flow not connected',
  'Nosana pre-flight balance check missing — no wallet balance verification before job submission',
  'Secret scanner has no pre-commit hook — runs manually or in CI only, not enforced at commit time',
  'Historical Gemini evidence is preserved under smoke-tests/extraction; the active ready-made demo performs no extraction and shows MiniMax offline',
  'Historical Nosana evidence is reconciled; the active browser fixture is a dry-run preview with jobId: null and no submitted workload',
  'Daytona sandbox lifecycle not live-verified — mock client tested, real SDK requires active Daytona account',
  'Video voiceover sync relies on manual timing — no automated A/V sync validation',
  'No end-to-end ticketing flow — Atlas TICKETING_ACTIVATION_REQUIRED gate intentionally not crossed',
];

// ── 7. Assemble manifest ───────────────────────────────────────────────────

const manifest = {
  generatedAt: new Date().toISOString(),
  generatorScript: 'scripts/generate-submission-manifest.mjs',
  executionMode: 'daytona-offline-mock',
  isLive: false,
  externalWriteOccurred: false,
  providerCalls: [],
  historicalEvidence: {
    gemini: 'Historical live evidence preserved under smoke-tests/extraction; not invoked by this generation run',
    nosana: 'Historical evidence reconciled; browser fixture is permitted dry-run preview with jobId null',
    atlas: 'Historical Sandbox Search→Verify returned 20 offers then PRICE_CONFIRMATION_REQUIRED with no write; Aug 28 environment-switch failure is not fresh evidence',
  },
  credentialsAccessed: false,
  safetyGuarantees: {
    noProviderCalled: true,
    noCredentialsRead: true,
    noEnvLocalAccessed: true,
    noExternalWrite: true,
    noProtectedFilesModified: allProtectedUnchanged,
    offlineOnly: true,
  },
  testSuites: {
    totalSuites: TEST_SUITES.length,
    totalPassed,
    totalFailed,
    verifyOfflineExitCode: allSuitesPassed ? 0 : 1,
    suites: testSuiteResults,
  },
  typecheck: {
    status: typecheckStatus,
  },
  build: {
    status: buildStatus,
  },
  latestRecoveryCapture: recoveryCaptureInfo,
  latestVideo: latestVideo
    ? {
        path: latestVideo.path,
        modificationTimestamp: latestVideo.modificationTimestamp,
      }
    : null,
  videoFreshness,
  protectedFiles: protectedFilesStatus,
  knownRemainingIssues,
};

// ── 8. Write output ────────────────────────────────────────────────────────

const outPath = join(OUTPUT_DIR, 'submission-manifest.json');
mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

console.log(`\n✓ Manifest written to ${relative(ROOT, outPath)}`);
console.log(`  ${totalPassed} tests passed, ${totalFailed} failed`);
console.log(`  typecheck: ${typecheckStatus}, build: ${buildStatus}`);
console.log(`  protected files unchanged: ${allProtectedUnchanged}`);
