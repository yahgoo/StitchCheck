// nosana-child-process-regression-tests.mjs — OFFLINE-ONLY regression suite.
//
// Catches the exact class of bug that caused two live-execution failures:
//   1. "generateIdempotencyKey is not defined" (destructured import lost)
//   2. "nosanaKit is not defined" (block-scoped const lost across try blocks)
//
// Approach:
//   - Create a fake @nosana/kit module in a temp directory.
//   - Create an ESM resolver+loader that intercepts @nosana/kit imports.
//   - Spawn nosana_run_job.mjs as a real child process with the loader.
//   - Assert the child reaches the fake jobs.list() without ReferenceErrors.
//   - Assert no credentials or secrets leak to stdout or stderr.
//
// Also includes source-invariant tests that statically verify:
//   - No destructuring from the nosanaKit namespace object.
//   - Shared cross-block bindings are not re-declared inside try blocks.
//
// Hard guarantees:
//   - No network calls of any kind.
//   - No real Nosana SDK is loaded (intercepted by the fake loader).
//   - No credentials are used (fake API key, never printed).

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const RUN_JOB_PATH = path.join(here, "nosana_run_job.mjs");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${message}`);
  }
}

function section(name) {
  console.log(`\n${name}`);
}

// ── Fake SDK fixture ────────────────────────────────────────────────────────

const FAKE_IDEMPOTENCY_KEY = "fake-idempotency-key-for-regression-test-00000";
const FAKE_JOB_ADDRESS = "fakeJobAddress123456";
const FAKE_IPFS_HASH = "QmFakeIpfsHashForRegressionTest";
const FAKE_MARKET = "fakeMarketAddress";

/**
 * Creates a temporary directory containing three files:
 *   1. fake-nosana-kit.mjs    — fake @nosana/kit module
 *   2. fake-kit-resolver.mjs  — ESM resolver hook (intercepts @nosana/kit)
 *   3. fake-kit-loader.mjs    — entry point loaded via --import
 *
 * The loader calls register() to register the resolver.
 * The resolver redirects @nosana/kit imports to the fake module.
 *
 * Returns { tmpDir, loaderPath, cleanup }.
 */
function createFakeSdkFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nosana-test-"));

  // ── 1. Fake @nosana/kit module ──────────────────────────────────────
  const fakeKitCode = `
export const NosanaNetwork = { MAINNET: "mainnet" };

export function generateIdempotencyKey() {
  return "${FAKE_IDEMPOTENCY_KEY}";
}

export function createNosanaClient(network, config) {
  return {
    ipfs: {
      pin: async (jobDef) => "${FAKE_IPFS_HASH}",
      retrieve: async (hash) => ({
        riskScore: 0.42,
        riskBand: "medium",
        assumptions: ["Fake assumption from child-process test"],
        simulationCount: 500,
        explanation: "Fake explanation from child-process regression test fixture.",
      }),
    },
    api: {
      jobs: {
        list: async (params, options) => ({
          job: "${FAKE_JOB_ADDRESS}",
          credits: { creditsUsed: 5, costUSD: 0.001 },
          ipfsResult: "QmFakeResult",
        }),
        get: async (jobId) => ({
          jobStatus: "completed",
          ipfsResult: "QmFakeResult",
        }),
      },
    },
  };
}

export function validateJobDefinition(jobDef) {
  return { success: true, data: jobDef, errors: [] };
}
`;
  fs.writeFileSync(path.join(tmpDir, "fake-nosana-kit.mjs"), fakeKitCode);

  // ── 2. Resolver hook ────────────────────────────────────────────────
  //
  // Intercepts resolve for "@nosana/kit" and redirects to the fake module.
  // Uses import.meta.url (the resolver file's own URL) to locate the fake
  // module — both files are siblings in the same temp directory.
  const resolverCode = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@nosana/kit") {
    return {
      url: new URL("fake-nosana-kit.mjs", import.meta.url).href,
      shortCircuit: true,
      format: "module",
    };
  }
  return nextResolve(specifier, context);
}
`;
  fs.writeFileSync(path.join(tmpDir, "fake-kit-resolver.mjs"), resolverCode);

  // ── 3. Loader entry point ───────────────────────────────────────────
  //
  // Loaded via --import. Calls module.register() to register the resolver.
  const loaderCode = `
import { register } from "node:module";
register("./fake-kit-resolver.mjs", import.meta.url);
`;
  fs.writeFileSync(path.join(tmpDir, "fake-kit-loader.mjs"), loaderCode);

  return {
    tmpDir,
    loaderPath: path.join(tmpDir, "fake-kit-loader.mjs"),
    cleanup() {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
    },
  };
}

/**
 * Spawns nosana_run_job.mjs as a child process with the given env and options.
 * Returns a promise that resolves with { stdout, stderr, code }.
 */
function spawnRunJob(env, extraArgs = [], nodeArgs = []) {
  return new Promise((resolvePromise) => {
    const args = [
      ...nodeArgs,
      RUN_JOB_PATH,
      "--market", FAKE_MARKET,
      "--timeout", "3600",
      ...extraArgs,
    ];
    const child = spawn("node", args, {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => {
      resolvePromise({ stdout, stderr, code });
    });
    child.on("error", (err) => {
      resolvePromise({ stdout, stderr: stderr + "\n" + err.message, code: -1 });
    });
  });
}

// ── Minimal valid job definition for the child process ──────────────────────

const MINIMAL_JOB_DEF = JSON.stringify({
  version: "0.1",
  type: "container",
  ops: [
    {
      id: "test-op",
      type: "container/run",
      args: {
        image: "docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter",
        cmd: "echo test",
      },
    },
  ],
  meta: { trigger: "api" },
  global: {
    env: {
      RISK_INPUT_DATA: '{"test":true}',
      HISTORICAL_DELAY_DATA: '{"airports":{},"routes":[]}',
    },
  },
});

// ── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  const { tmpDir, loaderPath, cleanup } = createFakeSdkFixture();
  const nodeArgs = ["--import", `file://${loaderPath}`];

  // ── Section 1: Child-process reaches fake jobs.list() ───────────────

  section("Section 1: Child-process regression — reaches fake jobs.list()");

  const result = await spawnRunJob(
    {
      NOSANA_API_KEY: "fake-api-key-for-testing-only",
      NOSANA_JOB_DEF: MINIMAL_JOB_DEF,
    },
    [],
    nodeArgs,
  );

  const combinedOutput = result.stdout + "\n" + result.stderr;

  // 1a. No ReferenceError for the known failure patterns
  assert(
    !combinedOutput.includes("generateIdempotencyKey is not defined"),
    "no 'generateIdempotencyKey is not defined' ReferenceError",
  );
  assert(
    !combinedOutput.includes("nosanaKit is not defined"),
    "no 'nosanaKit is not defined' ReferenceError",
  );
  assert(
    !combinedOutput.includes("createNosanaClient is not defined"),
    "no 'createNosanaClient is not defined' ReferenceError",
  );
  assert(
    !combinedOutput.includes("NosanaNetwork is not defined"),
    "no 'NosanaNetwork is not defined' ReferenceError",
  );

  // 1b. Stdout contains exactly one valid JSON result
  const stdoutLines = result.stdout.trim().split("\n").filter((l) => l.trim());
  assert(stdoutLines.length >= 1, "stdout has at least one line");

  let parsed = null;
  try {
    parsed = JSON.parse(stdoutLines[stdoutLines.length - 1]);
  } catch {
    // Will be caught by the next assertion
  }
  assert(parsed !== null && typeof parsed === "object", "last stdout line is valid JSON");

  // 1c. The child process reached the fake jobs.list() — evidenced by
  // the fake job address in the result.
  assert(
    parsed !== null && parsed.jobId === FAKE_JOB_ADDRESS,
    `result contains fake job address (got: ${parsed?.jobId})`,
  );

  // 1d. The fake market was passed through correctly
  assert(
    parsed !== null && parsed.market === FAKE_MARKET,
    `result contains fake market address (got: ${parsed?.market})`,
  );

  // 1e. The fake IPFS hash was used
  assert(
    parsed !== null && parsed.ipfsHash === FAKE_IPFS_HASH,
    `result contains fake IPFS hash (got: ${parsed?.ipfsHash})`,
  );

  // 1f. Success — the full flow completed with fake data
  assert(
    parsed !== null && parsed.success === true,
    "child process reports success (full flow completed with fake SDK)",
  );

  // 1g. Output contains the fake risk result
  assert(
    parsed !== null && parsed.output?.riskScore === 0.42,
    "output contains fake risk score from fake IPFS retrieve",
  );

  // 1h. No secrets leaked to stdout
  const forbidden = [
    "fake-api-key-for-testing-only",
    FAKE_IDEMPOTENCY_KEY,
    "NOSANA_API_KEY=fake",
  ];
  assert(
    !forbidden.some((s) => result.stdout.includes(s)),
    "no API key or idempotency-key value in stdout",
  );

  // 1i. No secrets leaked to stderr
  assert(
    !forbidden.some((s) => result.stderr.includes(s)),
    "no API key or idempotency-key value in stderr",
  );

  // ── Section 2: NOSANA_DEBUG_EXPORTS diagnostic ──────────────────────

  section("Section 2: NOSANA_DEBUG_EXPORTS=1 diagnostic");

  const debugResult = await spawnRunJob(
    {
      NOSANA_API_KEY: "fake-api-key-for-testing-only",
      NOSANA_JOB_DEF: MINIMAL_JOB_DEF,
      NOSANA_DEBUG_EXPORTS: "1",
    },
    [],
    nodeArgs,
  );

  assert(
    debugResult.stderr.includes("@nosana/kit export diagnostic"),
    "debug diagnostic header appears on stderr",
  );
  assert(
    debugResult.stderr.includes("createNosanaClient: function"),
    "debug diagnostic shows createNosanaClient type",
  );
  assert(
    debugResult.stderr.includes("NosanaNetwork: object"),
    "debug diagnostic shows NosanaNetwork type",
  );
  assert(
    debugResult.stderr.includes("generateIdempotencyKey: function"),
    "debug diagnostic shows generateIdempotencyKey type",
  );
  assert(
    !debugResult.stderr.includes("fake-api-key-for-testing-only"),
    "debug diagnostic does not leak API key to stderr",
  );
  assert(
    !debugResult.stderr.includes(FAKE_IDEMPOTENCY_KEY),
    "debug diagnostic does not leak idempotency key value to stderr",
  );

  // ── Section 3: Source-invariant tests ───────────────────────────────

  section("Section 3: Source-invariant tests on nosana_run_job.mjs");

  const sourceCode = fs.readFileSync(RUN_JOB_PATH, "utf8");

  // 3a. No destructuring from nosanaKit
  const destructurePattern = /(?:const|let|var)\s*\{[^}]*\}\s*=\s*nosanaKit\b/;
  assert(
    !destructurePattern.test(sourceCode),
    "no destructuring from nosanaKit namespace object",
  );

  // 3b. Shared cross-block bindings are declared in the outer function scope,
  // not re-declared inside try/catch blocks.
  // Strategy: find the SDK-init try block (identified by the "Dynamic import"
  // comment) and verify all shared bindings are declared before it.
  const sharedBindings = ["nosanaKit", "nosanaClient", "job", "jobId", "creditsUsed", "costUsd"];
  const sdkInitTryPattern = /Dynamic import[\s\S]*?\btry\s*\{/;
  const sdkTryMatch = sourceCode.match(sdkInitTryPattern);
  if (sdkTryMatch) {
    const tryKeywordIdx = sourceCode.indexOf("try", sdkTryMatch.index);
    const preTryCode = sourceCode.slice(0, tryKeywordIdx);
    for (const binding of sharedBindings) {
      const declPattern = new RegExp(`\\b(?:let|const)\\s+${binding}\\b`);
      assert(
        declPattern.test(preTryCode),
        `'${binding}' is declared in outer scope before SDK-init try block`,
      );
    }
  } else {
    assert(false, "could not locate SDK-init try block for scope analysis");
  }

  // 3c. The namespace import pattern is used (not destructured)
  assert(
    sourceCode.includes('nosanaKit = await import("@nosana/kit")') ||
    sourceCode.includes("nosanaKit = await import('@nosana/kit')"),
    "namespace import assigned to outer-scoped nosanaKit",
  );

  // 3d. Point-of-use access pattern for SDK members
  assert(
    sourceCode.includes("nosanaKit.createNosanaClient("),
    "createNosanaClient accessed via namespace at point of use",
  );
  assert(
    sourceCode.includes("nosanaKit.NosanaNetwork.MAINNET"),
    "NosanaNetwork.MAINNET accessed via namespace at point of use",
  );
  assert(
    sourceCode.includes("nosanaKit.generateIdempotencyKey"),
    "generateIdempotencyKey accessed via namespace at point of use",
  );

  // ── Cleanup & Summary ───────────────────────────────────────────────

  cleanup();

  console.log("");
  console.log("=".repeat(72));
  console.log(`Nosana child-process regression tests: ${passed} passed, ${failed} failed.`);
  console.log("=".repeat(72));

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTests().catch((err) => {
  console.error("Fatal error in child-process regression tests:", err.message);
  process.exitCode = 1;
});
