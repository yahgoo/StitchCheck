// nosana-safety-gate-tests.mjs — OFFLINE-ONLY test suite.
//
// Proves that the NOSANA_ENABLED + NOSANA_LIVE_ENABLED safety gate blocks
// live Nosana execution when either flag is disabled or unset.
//
// Tests:
//   1. NOSANA_LIVE_ENABLED=false blocks live execution
//   2. Unset NOSANA_LIVE_ENABLED blocks live execution
//   3. NOSANA_ENABLED=false blocks execution
//   4. Dry-run still blocks execution (even when flags are true)
//   5. Blocked execution performs no network/IPFS/job submission
//   6. Blocked results are not labelled as live evidence
//   7. Both flags plus explicit live invocation are necessary
//   8. Existing offline behaviour remains unchanged
//
// Hard guarantees:
//   - Zero network calls.
//   - Zero credentials read.
//   - Zero external provider contact.
//   - Dependency injection via temporary process.env overrides only.
//   - Deterministic and fully offline.

import assert from "node:assert";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import {
  runNosanaRiskWorkload,
  isNosanaLivePermitted,
} from "./nosana-risk-runner.mjs";

let passed = 0;
let failed = 0;

function test(name, fn) {
  const result = fn();
  if (result && typeof result.then === "function") {
    return result
      .then(() => {
        passed += 1;
        console.log(`  ✓ ${name}`);
      })
      .catch((err) => {
        failed += 1;
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
      });
  }
  try {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
  return Promise.resolve();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEST_PAYLOAD = {
  correlationId: "safety-gate-test-" + Date.now(),
  origin: "AAA",
  connectionAirport: "BBB",
  destination: "CCC",
  connectionDurationMinutes: 75,
  staticHistoricalDatasetVersion: "hist-delay-v1",
  syntheticDemo: true,
  nonPiiDeclaration: true,
};

/**
 * Runs a test body with a temporary process.env overlay.
 * Restores original values after the body completes.
 */
async function withEnv(overrides, fn) {
  const saved = {};
  const keys = Object.keys(overrides);
  for (const key of keys) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  try {
    await fn();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

function assertBlocked(result, testLabel) {
  assert.strictEqual(
    result.evidenceSource,
    "safety-gate-blocked",
    `${testLabel}: evidenceSource must be "safety-gate-blocked"`,
  );
  assert.strictEqual(
    result.usedFallback,
    true,
    `${testLabel}: usedFallback must be true`,
  );
  assert.strictEqual(
    result.externalWriteOccurred,
    false,
    `${testLabel}: externalWriteOccurred must be false`,
  );
  assert.strictEqual(
    result.provider,
    "none",
    `${testLabel}: provider must be "none"`,
  );
  assert.strictEqual(
    result.jobMetadata,
    null,
    `${testLabel}: jobMetadata must be null`,
  );
  assert.strictEqual(
    result.riskResult.evidenceSource,
    "safety-gate-blocked",
    `${testLabel}: riskResult.evidenceSource must be "safety-gate-blocked"`,
  );
  assert.strictEqual(
    result.riskResult.errorCode,
    "NOSANA_SAFETY_GATE_BLOCKED",
    `${testLabel}: errorCode must be NOSANA_SAFETY_GATE_BLOCKED`,
  );
  assert.strictEqual(
    result.riskResult.workloadStatus,
    "blocked",
    `${testLabel}: workloadStatus must be "blocked"`,
  );
  // The label must not CLAIM to be Nosana evidence. It may contain the
  // phrase "not Nosana evidence" (an explicit denial), which is acceptable.
  assert.ok(
    !result.evidenceLabel.startsWith("Nosana evidence"),
    `${testLabel}: evidenceLabel must not claim to be Nosana evidence`,
  );
  assert.ok(
    !result.evidenceSource.includes("nosana-evidence"),
    `${testLabel}: evidenceSource must not be "nosana-evidence"`,
  );
}

// ── Test runner ──────────────────────────────────────────────────────────────

async function runTests() {
  console.log("=".repeat(72));
  console.log("StitchCheck Nosana safety-gate tests — OFFLINE ONLY");
  console.log("=".repeat(72));

  // ── Section 1: isNosanaLivePermitted unit tests ─────────────────────

  console.log("\nSection 1: isNosanaLivePermitted unit tests");

  await test("both flags false → not permitted", () => {
    const result = isNosanaLivePermitted({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" });
    assert.strictEqual(result.permitted, false);
    assert.strictEqual(result.nosanaEnabled, false);
    assert.strictEqual(result.nosanaLiveEnabled, false);
  });

  await test("NOSANA_ENABLED=true, NOSANA_LIVE_ENABLED=false → not permitted", () => {
    const result = isNosanaLivePermitted({ DEMO_MODE: "daytona", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "false" });
    assert.strictEqual(result.permitted, false);
    assert.strictEqual(result.nosanaEnabled, true);
    assert.strictEqual(result.nosanaLiveEnabled, false);
  });

  await test("NOSANA_ENABLED=false, NOSANA_LIVE_ENABLED=true → not permitted", () => {
    const result = isNosanaLivePermitted({ DEMO_MODE: "daytona", NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "true" });
    assert.strictEqual(result.permitted, false);
    assert.strictEqual(result.nosanaEnabled, false);
    assert.strictEqual(result.nosanaLiveEnabled, true);
  });

  await test("both flags true, non-local mode → permitted", () => {
    const result = isNosanaLivePermitted({ DEMO_MODE: "daytona", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" });
    assert.strictEqual(result.permitted, true);
    assert.strictEqual(result.nosanaEnabled, true);
    assert.strictEqual(result.nosanaLiveEnabled, true);
  });

  await test("both flags unset → not permitted", () => {
    const result = isNosanaLivePermitted({});
    assert.strictEqual(result.permitted, false);
  });

  await test("NOSANA_ENABLED unset, NOSANA_LIVE_ENABLED=true → not permitted", () => {
    const result = isNosanaLivePermitted({ DEMO_MODE: "daytona", NOSANA_LIVE_ENABLED: "true" });
    assert.strictEqual(result.permitted, false);
    assert.strictEqual(result.nosanaEnabled, false);
    assert.strictEqual(result.nosanaLiveEnabled, true);
  });

  await test("NOSANA_ENABLED=true, NOSANA_LIVE_ENABLED unset → not permitted", () => {
    const result = isNosanaLivePermitted({ DEMO_MODE: "daytona", NOSANA_ENABLED: "true" });
    assert.strictEqual(result.permitted, false);
    assert.strictEqual(result.nosanaEnabled, true);
    assert.strictEqual(result.nosanaLiveEnabled, false);
  });

  // ── Section 2: Runner safety-gate blocking ──────────────────────────

  console.log("\nSection 2: Runner safety-gate blocking");

  await test("NOSANA_LIVE_ENABLED=false blocks live execution", () =>
    withEnv({ NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assertBlocked(result, "LIVE_ENABLED=false");
    }),
  );

  await test("unset NOSANA_LIVE_ENABLED blocks live execution", () =>
    withEnv({ NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: undefined }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assertBlocked(result, "LIVE_ENABLED=unset");
    }),
  );

  await test("NOSANA_ENABLED=false blocks execution", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "true" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assertBlocked(result, "ENABLED=false");
    }),
  );

  await test("both flags false blocks execution", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assertBlocked(result, "both=false");
    }),
  );

  await test("both flags unset blocks execution", () =>
    withEnv({ NOSANA_ENABLED: undefined, NOSANA_LIVE_ENABLED: undefined }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assertBlocked(result, "both=unset");
    }),
  );

  // ── Section 3: Blocked execution performs no network/IPFS/job ───────

  console.log("\nSection 3: Blocked execution performs no network/IPFS/job submission");

  await test("blocked result has null jobMetadata (no job submitted)", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.strictEqual(result.jobMetadata, null);
    }),
  );

  await test("blocked result has null output (no IPFS interaction)", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.strictEqual(result.output, null);
    }),
  );

  await test("blocked result has externalWriteOccurred=false", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.strictEqual(result.externalWriteOccurred, false);
    }),
  );

  await test("blocked result has provider='none' (no provider called)", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.strictEqual(result.provider, "none");
    }),
  );

  await test("blocked result has null riskScore (no computation performed)", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.strictEqual(result.riskResult.riskScore, null);
      assert.strictEqual(result.riskResult.riskBand, "unavailable");
    }),
  );

  await test("safetyGate metadata is attached to blocked result", () =>
    withEnv({ DEMO_MODE: "daytona", NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "true" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.ok(result.safetyGate, "safetyGate field must be present");
      assert.strictEqual(result.safetyGate.nosanaEnabled, false);
      assert.strictEqual(result.safetyGate.nosanaLiveEnabled, true);
      assert.strictEqual(result.safetyGate.permitted, false);
    }),
  );

  // ── Section 4: Blocked results are not labelled as live evidence ────

  console.log("\nSection 4: Blocked results are not labelled as live evidence");

  await test("evidenceSource is not 'nosana-evidence' when blocked", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.notStrictEqual(result.evidenceSource, "nosana-evidence");
    }),
  );

  await test("evidenceLabel does not claim to be Nosana evidence when blocked", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      // The label may contain "not Nosana evidence" (an explicit denial)
      // but must not start with "Nosana evidence" (a positive claim).
      assert.ok(!result.evidenceLabel.startsWith("Nosana evidence"));
    }),
  );

  await test("riskResult.evidenceSource is not 'nosana-evidence' when blocked", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.notStrictEqual(result.riskResult.evidenceSource, "nosana-evidence");
    }),
  );

  await test("fallbackUsed is true when blocked", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.strictEqual(result.usedFallback, true);
      assert.strictEqual(result.riskResult.fallbackUsed, true);
    }),
  );

  // ── Section 5: Both flags plus explicit live invocation are necessary ─

  console.log("\nSection 5: Both flags plus explicit live invocation are necessary");

  await test("flags true + dryRun=true (default) does not reach live path", () =>
    withEnv({ NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" }, async () => {
      // dryRun defaults to true; without --live the runner should not submit.
      // Without NOSANA_API_KEY, the runner falls back to local result.
      // Either way, it must NOT produce nosana-evidence.
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.notStrictEqual(result.evidenceSource, "nosana-evidence");
    }),
  );

  await test("flags true + skipNosana=true does not reach live path", () =>
    withEnv({ NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD, { skipNosana: true });
      assert.notStrictEqual(result.evidenceSource, "nosana-evidence");
      assert.strictEqual(result.usedFallback, true);
    }),
  );

  await test("flags true + no API key does not reach live path", () =>
    withEnv(
      { NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true", NOSANA_API_KEY: undefined },
      async () => {
        const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
        assert.notStrictEqual(result.evidenceSource, "nosana-evidence");
        assert.strictEqual(result.usedFallback, true);
      },
    ),
  );

  // ── Section 6: Existing offline behaviour remains unchanged ─────────

  console.log("\nSection 6: Existing offline behaviour remains unchanged");

  await test("default env (all flags unset) returns blocked result", () =>
    withEnv({ NOSANA_ENABLED: undefined, NOSANA_LIVE_ENABLED: undefined }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.strictEqual(result.evidenceSource, "safety-gate-blocked");
      assert.strictEqual(result.usedFallback, true);
      assert.strictEqual(result.externalWriteOccurred, false);
    }),
  );

  await test("blocked result has valid correlationId from payload", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.strictEqual(result.riskResult.correlationId, TEST_PAYLOAD.correlationId);
    }),
  );

  await test("blocked result has datasetVersion from payload", () =>
    withEnv({ NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "false" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.strictEqual(
        result.riskResult.datasetVersion,
        TEST_PAYLOAD.staticHistoricalDatasetVersion,
      );
    }),
  );

  // ── Section 6b: DEMO_MODE gate tests ─────────────────────────────────

  console.log("\nSection 6b: DEMO_MODE gate tests (DEMO_MODE safety fix)");

  // Test 1: unset DEMO_MODE blocks even when both Nosana flags are "true"
  await test("unset DEMO_MODE blocks even when both Nosana flags are true", () => {
    const result = isNosanaLivePermitted({ NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" });
    assert.strictEqual(result.permitted, false);
    assert.strictEqual(result.nosanaEnabled, false);
    assert.strictEqual(result.nosanaLiveEnabled, false);
    assert.strictEqual(result.demoMode, "local");
  });

  // Test 2: DEMO_MODE=local blocks even when both flags are "true"
  await test("DEMO_MODE=local blocks even when both flags are true", () => {
    const result = isNosanaLivePermitted({ DEMO_MODE: "local", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" });
    assert.strictEqual(result.permitted, false);
    assert.strictEqual(result.nosanaEnabled, false);
    assert.strictEqual(result.nosanaLiveEnabled, false);
  });

  // Test 3: mixed-case/whitespace "local" still blocks (normalization works)
  await test('mixed-case/whitespace " Local " still blocks', () => {
    const result = isNosanaLivePermitted({ DEMO_MODE: " Local ", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" });
    assert.strictEqual(result.permitted, false);
    assert.strictEqual(result.demoMode, "local");
  });

  await test('uppercase "LOCAL" still blocks', () => {
    const result = isNosanaLivePermitted({ DEMO_MODE: "LOCAL", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" });
    assert.strictEqual(result.permitted, false);
    assert.strictEqual(result.demoMode, "local");
  });

  // Test 4: non-local mode with either flag false blocks
  await test("non-local mode with NOSANA_ENABLED=false blocks", () => {
    const result = isNosanaLivePermitted({ DEMO_MODE: "daytona", NOSANA_ENABLED: "false", NOSANA_LIVE_ENABLED: "true" });
    assert.strictEqual(result.permitted, false);
  });

  await test("non-local mode with NOSANA_LIVE_ENABLED=false blocks", () => {
    const result = isNosanaLivePermitted({ DEMO_MODE: "atlas", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "false" });
    assert.strictEqual(result.permitted, false);
  });

  // Test 5: non-local mode with both flags true passes only the flag-gate check
  await test("non-local mode with both flags true passes flag-gate check", () => {
    const result = isNosanaLivePermitted({ DEMO_MODE: "daytona", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" });
    assert.strictEqual(result.permitted, true);
    assert.strictEqual(result.nosanaEnabled, true);
    assert.strictEqual(result.nosanaLiveEnabled, true);
    assert.strictEqual(result.demoMode, "daytona");
  });

  // Test 6: dryRun=true still blocks actual execution (even when flags pass)
  await test("dryRun=true still blocks actual execution", () =>
    withEnv({ DEMO_MODE: "daytona", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD, { dryRun: true });
      assert.notStrictEqual(result.evidenceSource, "nosana-evidence");
      assert.strictEqual(result.usedFallback, true);
    }),
  );

  // Test 7: skipNosana=true still blocks
  await test("skipNosana=true still blocks", () =>
    withEnv({ DEMO_MODE: "daytona", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD, { skipNosana: true });
      assert.notStrictEqual(result.evidenceSource, "nosana-evidence");
      assert.strictEqual(result.usedFallback, true);
    }),
  );

  // Test 8: blocked execution does not spawn a child process
  await test("DEMO_MODE=local blocked execution does not spawn child process", () =>
    withEnv({ DEMO_MODE: "local", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.strictEqual(result.jobMetadata, null, "jobMetadata must be null — no child process spawned");
      assert.strictEqual(result.provider, "none");
    }),
  );

  // Test 9: blocked execution does not import or invoke the Nosana SDK
  await test("DEMO_MODE=local blocked execution does not invoke Nosana SDK", () =>
    withEnv({ DEMO_MODE: "local", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.strictEqual(result.output, null, "output must be null — no SDK invocation");
      assert.strictEqual(result.evidenceSource, "safety-gate-blocked");
    }),
  );

  // Test 10: blocked results cannot receive a live provenance label
  await test("DEMO_MODE=local blocked results cannot receive live provenance label", () =>
    withEnv({ DEMO_MODE: "local", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.notStrictEqual(result.evidenceSource, "nosana-evidence");
      assert.ok(!result.evidenceLabel.startsWith("Nosana evidence"));
      assert.notStrictEqual(result.riskResult.evidenceSource, "nosana-evidence");
    }),
  );

  // Runner-level DEMO_MODE integration tests
  await test("DEMO_MODE=local with both flags true blocks runner", () =>
    withEnv({ DEMO_MODE: "local", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assertBlocked(result, "DEMO_MODE=local");
      assert.strictEqual(result.safetyGate.demoMode, "local");
    }),
  );

  await test("unset DEMO_MODE with both flags true blocks runner", () =>
    withEnv({ DEMO_MODE: undefined, NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" }, async () => {
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assertBlocked(result, "DEMO_MODE=unset");
      assert.strictEqual(result.safetyGate.demoMode, "local");
    }),
  );

  await test("DEMO_MODE=daytona with both flags true passes gate but dryRun/credential checks still block", () =>
    withEnv({ DEMO_MODE: "daytona", NOSANA_ENABLED: "true", NOSANA_LIVE_ENABLED: "true" }, async () => {
      // Without NOSANA_API_KEY, the runner falls back to local result.
      // Without --live, dryRun defaults to true.
      // Either way, it must NOT produce nosana-evidence.
      const result = await runNosanaRiskWorkload(TEST_PAYLOAD);
      assert.notStrictEqual(result.evidenceSource, "nosana-evidence");
      assert.strictEqual(result.usedFallback, true);
    }),
  );

  // ── Section 7: Source-invariant tests ───────────────────────────────

  console.log("\nSection 7: Source-invariant tests");

  const testSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");

  await test("test source contains no network primitives", () => {
    const netModules = ["fetch", "http", "https", "net", "socket"]
      .map((m) => `import ${m}`);
    for (const mod of netModules) {
      assert.ok(!testSource.includes(mod), `Forbidden import: ${mod}`);
    }
  });

  await test("test source contains no credential references", () => {
    const envLocal = [".env", ".local"].join("");
    assert.ok(!testSource.includes(envLocal), "Forbidden: env-local reference");
  });

  // ── Summary ─────────────────────────────────────────────────────────

  console.log("\n" + "=".repeat(72));
  console.log(`Nosana safety-gate tests: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(72));

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log("\nAll safety-gate tests passed (offline, synthetic, no Nosana contact).");
  }
}

runTests().catch((err) => {
  console.error("Fatal error in safety-gate tests:", err.message);
  process.exitCode = 1;
});
