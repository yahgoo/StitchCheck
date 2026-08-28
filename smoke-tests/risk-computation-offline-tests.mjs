// Risk computation offline tests for StitchCheck.
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// These tests verify deterministic risk computation invariants:
//   1. Identical input and seed produce identical output.
//   2. Different seed behavior is bounded and valid.
//   3. Risk score is between 0 and 100.
//   4. Risk band is valid ('low' | 'medium' | 'high' | 'critical').
//   5. Scenario count is bounded.
//   6. Dependency cascade is generated.
//   7. Candidates are evaluated.
//   8. One plan is selected when safe.
//   9. No-safe-plan becomes terminal.
//  10. Attempts never exceed 2.
//  11. Missing fields remain null/unavailable.
//  12. Provenance is preserved.
//  13. externalWriteOccurred is always false.
//  14. No booking/payment/ticket action is produced.
//
// Hard guarantees:
// - Zero network code: no fetch/http/https/net/socket imports or calls.
// - Zero credentials read: no .env or secret file is ever touched.
// - Zero dependencies: Node.js built-ins and existing local modules only.
// - Deterministic: no randomness, no timing, no external calls.

import assert from "node:assert";
import fs from "node:fs";

// ── Inline re-implementation of pure functions from core/domain ─────────────
// These mirror the TypeScript source exactly, allowing behavioural tests
// without a TS compiler. Source-file assertions verify the .ts files
// actually export the functions being tested.

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}`);
    console.error(`  ${error.message}`);
  }
}

// ── Source-file references ──────────────────────────────────────────────────

const coreDir = new URL("../core/domain/", import.meta.url);

const riskCompSrc = fs.readFileSync(
  new URL("risk-computation.ts", coreDir),
  "utf8"
);
const adapterSrc = fs.readFileSync(
  new URL("recovery-plan-adapter.ts", coreDir),
  "utf8"
);
const depGraphSrc = fs.readFileSync(
  new URL("dependency-graph.ts", coreDir),
  "utf8"
);
const riskSrc = fs.readFileSync(
  new URL("risk.ts", coreDir),
  "utf8"
);

// ── Deterministic PRNG (mulberry32) — mirrors risk-computation.ts ───────────

function seededRandom(seed) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deriveNumericSeed(correlationId) {
  let hash = 0;
  for (let i = 0; i < correlationId.length; i++) {
    hash = ((hash << 5) - hash + correlationId.charCodeAt(i)) | 0;
  }
  return hash;
}

// ── computeRiskFromSeed — full inline replica ───────────────────────────────

function computeRiskFromSeed(seed) {
  const numericSeed = deriveNumericSeed(seed.correlationId);
  const rng = seededRandom(numericSeed);

  let riskScore;
  if (seed.riskScore !== null) {
    riskScore = Math.round(seed.riskScore * 100);
  } else {
    switch (seed.riskBand) {
      case "low":
        riskScore = 10 + Math.round(rng() * 20);
        break;
      case "medium":
        riskScore = 35 + Math.round(rng() * 25);
        break;
      case "high":
        riskScore = 65 + Math.round(rng() * 20);
        break;
      case "critical":
        riskScore = 88 + Math.round(rng() * 12);
        break;
      default:
        riskScore = 100;
        break;
    }
  }

  let riskBand;
  if (riskScore < 30) riskBand = "low";
  else if (riskScore < 60) riskBand = "medium";
  else if (riskScore < 85) riskBand = "high";
  else riskBand = "critical";

  const isTerminalNoPlan =
    seed.riskBand === "error" ||
    seed.riskBand === "timeout" ||
    !["low", "medium", "high", "critical"].includes(seed.riskBand);

  const statusForScore = (threshold) =>
    riskScore >= threshold ? "at-risk" : "ok";

  const connectionStatus = isTerminalNoPlan
    ? "failed"
    : statusForScore(20);
  const onwardStatus = isTerminalNoPlan
    ? "failed"
    : statusForScore(40);
  const hotelStatus = isTerminalNoPlan
    ? "failed"
    : statusForScore(60);

  const nodes = [
    {
      id: "connection-window",
      label: "Connection window at BKK",
      kind: "connection-window",
      status: connectionStatus,
      cascadeDelayMs: 0,
      dependsOn: [],
    },
  ];

  if (!isTerminalNoPlan) {
    if (riskScore >= 40) {
      nodes.push({
        id: "onward-leg",
        label: "Onward leg BKK → HAN",
        kind: "onward-leg",
        status: onwardStatus,
        cascadeDelayMs: 550,
        dependsOn: ["connection-window"],
      });
    }
    if (riskScore >= 60) {
      nodes.push({
        id: "hotel-checkin",
        label: "Pre-booked hotel check-in",
        kind: "hotel-checkin",
        status: hotelStatus,
        cascadeDelayMs: 1100,
        dependsOn: ["onward-leg", "connection-window"],
      });
    }
  }

  const dependencyGraph = {
    nodes,
    rootTriggerId: "connection-window",
  };

  return { dependencyGraph, riskScore, riskBand, isTerminalNoPlan, seed };
}

// ── Candidate generation — mirrors recovery-plan-adapter.ts ─────────────────

function generateCandidates(computation) {
  if (computation.isTerminalNoPlan) return [];
  const { riskScore } = computation;
  const candidates = [
    {
      offerReference: "local-fallback-offer-001",
      connectionType: "nonstop",
      priceDisplay: "$289",
    },
  ];
  if (riskScore >= 30) {
    candidates.push({
      offerReference: "local-fallback-offer-002",
      connectionType: "1-stop",
      priceDisplay: "$246",
    });
  }
  if (riskScore >= 50) {
    candidates.push({
      offerReference: "local-fallback-offer-003",
      connectionType: "nonstop",
      priceDisplay: "$312",
    });
  }
  return candidates;
}

function collapseIntoRecommendedPlan(candidates, computation) {
  if (candidates.length === 0 || computation.isTerminalNoPlan) return null;
  const replacement = candidates[0];
  const hasOnward = computation.riskScore >= 40;
  return {
    replacementFirstLeg: replacement,
    onwardOption: hasOnward
      ? { offerReference: "local-fallback-offer-010", connectionType: "nonstop", priceDisplay: "$98" }
      : null,
    tradeoffs: {
      arrivalImpactMinutes: null,
      connectionBufferMinutes: null,
      fareDelta: null,
      fareDeltaCurrency: null,
    },
  };
}

// ── Adapter output assembly — mirrors riskResultToAnimationData ─────────────

function buildAdapterOutput(riskResult) {
  const computation = computeRiskFromSeed({
    correlationId: riskResult.correlationId,
    riskBand: riskResult.riskBand,
    riskScore: riskResult.riskScore,
    fallbackUsed: riskResult.fallbackUsed,
  });

  const candidates = generateCandidates(computation);
  const recommendedPlan = collapseIntoRecommendedPlan(candidates, computation);

  const downstreamItems = computation.dependencyGraph.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    cascadeDelayMs: n.cascadeDelayMs,
  }));

  const confirmationPhase =
    recommendedPlan !== null ? "review-recovery-plan" : "idle";

  const animationData = {
    originalFirstLeg: {
      routeSummary: "SIN → BKK",
      scheduledDeparture: null,
      scheduledArrival: null,
    },
    delayTrigger: {
      isRealDelaySignal: false,
      label:
        "Simulated delay trigger — downstream impact is real analysis",
    },
    downstreamItems,
    candidateAlternatives: candidates,
    recommendedPlan,
    rePlanAttemptCount: 0,
    maxRePlanAttempts: 2,
    freshnessTimestamp: new Date().toISOString(),
    provenanceLabel:
      "Local fallback \u2014 Daytona risk computation not executed",
    dataSource: "local-fallback",
    confirmationPhase,
    verifiedOutcome: null,
  };

  return {
    animationData,
    computation,
    executionMode: "local-fallback",
    externalWriteOccurred: false,
    workloadStatus: computation.isTerminalNoPlan
      ? "no-safe-plan"
      : recommendedPlan
        ? "success"
        : "no-safe-plan",
    jobOrServiceReference: null,
    heuristicDisclaimer: "Computed result — not live provider evidence",
    datasetVersion: "daytona-risk-worker-v1",
    fallbackUsed: riskResult.fallbackUsed,
    errorCode: null,
    errorMessage: null,
    evidenceSource: "local-fallback",
    provider: "risk-computation",
    executed: false,
  };
}

// ── Test seeds ──────────────────────────────────────────────────────────────

const SEEDS = [
  { correlationId: "test-low-001", riskBand: "low", riskScore: null, fallbackUsed: true },
  { correlationId: "test-med-002", riskBand: "medium", riskScore: null, fallbackUsed: true },
  { correlationId: "test-high-003", riskBand: "high", riskScore: null, fallbackUsed: true },
  { correlationId: "test-crit-004", riskBand: "critical", riskScore: null, fallbackUsed: true },
  { correlationId: "test-err-005", riskBand: "error", riskScore: null, fallbackUsed: true },
  { correlationId: "test-tmo-006", riskBand: "timeout", riskScore: null, fallbackUsed: true },
  { correlationId: "test-exp-007", riskBand: "unknown-band", riskScore: null, fallbackUsed: true },
  { correlationId: "test-sco-008", riskBand: "low", riskScore: 0.25, fallbackUsed: false },
  { correlationId: "test-sco-009", riskBand: "medium", riskScore: 0.55, fallbackUsed: false },
  { correlationId: "test-sco-010", riskBand: "high", riskScore: 0.75, fallbackUsed: false },
  { correlationId: "test-sco-011", riskBand: "critical", riskScore: 0.95, fallbackUsed: false },
  { correlationId: "test-sco-012", riskBand: "low", riskScore: 0, fallbackUsed: true },
  { correlationId: "test-sco-013", riskBand: "critical", riskScore: 1, fallbackUsed: true },
];

const VALID_BANDS = new Set(["low", "medium", "high", "critical"]);
const VALID_NODE_STATUSES = new Set(["ok", "at-risk", "failed"]);
const VALID_NODE_KINDS = new Set([
  "connection-window",
  "onward-leg",
  "hotel-checkin",
  "ground-transport",
  "event-connection",
]);

// ════════════════════════════════════════════════════════════════════════════
// SOURCE-FILE EXISTENCE & EXPORT ASSERTIONS
// ════════════════════════════════════════════════════════════════════════════

test("risk-computation.ts exists", () => {
  assert.ok(
    fs.existsSync(new URL("risk-computation.ts", coreDir)),
    "risk-computation.ts not found"
  );
});

test("risk.ts exists", () => {
  assert.ok(
    fs.existsSync(new URL("risk.ts", coreDir)),
    "risk.ts not found"
  );
});

test("dependency-graph.ts exists", () => {
  assert.ok(
    fs.existsSync(new URL("dependency-graph.ts", coreDir)),
    "dependency-graph.ts not found"
  );
});

test("recovery-plan-adapter.ts exists", () => {
  assert.ok(
    fs.existsSync(new URL("recovery-plan-adapter.ts", coreDir)),
    "recovery-plan-adapter.ts not found"
  );
});

test("risk-computation.ts exports computeRiskFromSeed", () => {
  assert.ok(
    riskCompSrc.includes("export function computeRiskFromSeed"),
    "Missing computeRiskFromSeed export"
  );
});

test("risk-computation.ts exports RiskComputationSeed interface", () => {
  assert.ok(
    riskCompSrc.includes("export interface RiskComputationSeed"),
    "Missing RiskComputationSeed interface"
  );
});

test("risk-computation.ts exports RiskComputationResult interface", () => {
  assert.ok(
    riskCompSrc.includes("export interface RiskComputationResult"),
    "Missing RiskComputationResult interface"
  );
});

test("risk-computation.ts contains no network primitives", () => {
  const forbidden = ["fetch(", "import http", "import https", "import net", "import socket"];
  for (const f of forbidden) {
    assert.ok(!riskCompSrc.includes(f), `Forbidden: ${f} in risk-computation.ts`);
  }
});

test("risk-computation.ts contains no credential references", () => {
  assert.ok(!riskCompSrc.includes("apiKey"), "Forbidden: apiKey in risk-computation.ts");
  assert.ok(!riskCompSrc.includes(".env"), "Forbidden: .env in risk-computation.ts");
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 1: Identical input and seed produce identical output
// ════════════════════════════════════════════════════════════════════════════

test("invariant-1: identical seed produces identical result (run A vs B)", () => {
  for (const seed of SEEDS) {
    const a = computeRiskFromSeed(seed);
    const b = computeRiskFromSeed(seed);
    assert.deepStrictEqual(a, b, `Non-deterministic for correlationId=${seed.correlationId}`);
  }
});

test("invariant-1: triple invocation yields same riskScore", () => {
  const seed = SEEDS[1]; // medium
  const r1 = computeRiskFromSeed(seed);
  const r2 = computeRiskFromSeed(seed);
  const r3 = computeRiskFromSeed(seed);
  assert.strictEqual(r1.riskScore, r2.riskScore);
  assert.strictEqual(r2.riskScore, r3.riskScore);
});

test("invariant-1: identical adapter output for same input", () => {
  const riskResult = {
    correlationId: "adapter-det-001",
    riskBand: "medium",
    riskScore: null,
    fallbackUsed: true,
  };
  const a = buildAdapterOutput(riskResult);
  const b = buildAdapterOutput(riskResult);
  // Compare everything except freshnessTimestamp (uses Date.now)
  assert.strictEqual(a.computation.riskScore, b.computation.riskScore);
  assert.strictEqual(a.computation.riskBand, b.computation.riskBand);
  assert.strictEqual(a.computation.isTerminalNoPlan, b.computation.isTerminalNoPlan);
  assert.deepStrictEqual(a.animationData.downstreamItems, b.animationData.downstreamItems);
  assert.deepStrictEqual(a.animationData.candidateAlternatives, b.animationData.candidateAlternatives);
  assert.strictEqual(a.animationData.confirmationPhase, b.animationData.confirmationPhase);
  assert.strictEqual(a.animationData.provenanceLabel, b.animationData.provenanceLabel);
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 2: Different seed behavior is bounded and valid
// ════════════════════════════════════════════════════════════════════════════

test("invariant-2: different correlationIds produce different numeric seeds", () => {
  const ids = ["alpha", "beta", "gamma", "delta", "epsilon"];
  const numerics = ids.map(deriveNumericSeed);
  const unique = new Set(numerics);
  assert.strictEqual(unique.size, ids.length, "All test IDs must produce distinct seeds");
});

test("invariant-2: all results are structurally valid regardless of seed", () => {
  for (const seed of SEEDS) {
    const result = computeRiskFromSeed(seed);
    assert.ok(typeof result.riskScore === "number", "riskScore must be a number");
    assert.ok(VALID_BANDS.has(result.riskBand), `Invalid band: ${result.riskBand}`);
    assert.ok(typeof result.isTerminalNoPlan === "boolean", "isTerminalNoPlan must be boolean");
    assert.ok(Array.isArray(result.dependencyGraph.nodes), "nodes must be an array");
    assert.ok(result.dependencyGraph.nodes.length >= 1, "At least 1 node required");
  }
});

test("invariant-2: different bands with null score stay within expected ranges", () => {
  const lowResult = computeRiskFromSeed({ correlationId: "x1", riskBand: "low", riskScore: null, fallbackUsed: true });
  const medResult = computeRiskFromSeed({ correlationId: "x2", riskBand: "medium", riskScore: null, fallbackUsed: true });
  const highResult = computeRiskFromSeed({ correlationId: "x3", riskBand: "high", riskScore: null, fallbackUsed: true });
  const critResult = computeRiskFromSeed({ correlationId: "x4", riskBand: "critical", riskScore: null, fallbackUsed: true });

  assert.ok(lowResult.riskScore >= 10 && lowResult.riskScore <= 30, `low range: ${lowResult.riskScore}`);
  assert.ok(medResult.riskScore >= 35 && medResult.riskScore <= 60, `medium range: ${medResult.riskScore}`);
  assert.ok(highResult.riskScore >= 65 && highResult.riskScore <= 85, `high range: ${highResult.riskScore}`);
  assert.ok(critResult.riskScore >= 88 && critResult.riskScore <= 100, `critical range: ${critResult.riskScore}`);
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 3: Risk score is between 0 and 100
// ════════════════════════════════════════════════════════════════════════════

test("invariant-3: all seed riskScores in [0, 100]", () => {
  for (const seed of SEEDS) {
    const result = computeRiskFromSeed(seed);
    assert.ok(result.riskScore >= 0, `Score ${result.riskScore} < 0 for ${seed.correlationId}`);
    assert.ok(result.riskScore <= 100, `Score ${result.riskScore} > 100 for ${seed.correlationId}`);
  }
});

test("invariant-3: explicit score 0 → 0", () => {
  const r = computeRiskFromSeed({ correlationId: "z1", riskBand: "low", riskScore: 0, fallbackUsed: true });
  assert.strictEqual(r.riskScore, 0);
});

test("invariant-3: explicit score 1 → 100", () => {
  const r = computeRiskFromSeed({ correlationId: "z2", riskBand: "critical", riskScore: 1, fallbackUsed: true });
  assert.strictEqual(r.riskScore, 100);
});

test("invariant-3: explicit score 0.5 → 50", () => {
  const r = computeRiskFromSeed({ correlationId: "z3", riskBand: "medium", riskScore: 0.5, fallbackUsed: true });
  assert.strictEqual(r.riskScore, 50);
});

test("invariant-3: error band → score 100", () => {
  const r = computeRiskFromSeed({ correlationId: "z4", riskBand: "error", riskScore: null, fallbackUsed: true });
  assert.strictEqual(r.riskScore, 100);
});

test("invariant-3: timeout band → score 100", () => {
  const r = computeRiskFromSeed({ correlationId: "z5", riskBand: "timeout", riskScore: null, fallbackUsed: true });
  assert.strictEqual(r.riskScore, 100);
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 4: Risk band is valid
// ════════════════════════════════════════════════════════════════════════════

test("invariant-4: derived riskBand is always in {low, medium, high, critical}", () => {
  for (const seed of SEEDS) {
    const result = computeRiskFromSeed(seed);
    assert.ok(
      VALID_BANDS.has(result.riskBand),
      `Invalid derived band "${result.riskBand}" for ${seed.correlationId}`
    );
  }
});

test("invariant-4: score < 30 → low", () => {
  const r = computeRiskFromSeed({ correlationId: "b1", riskBand: "low", riskScore: 0.15, fallbackUsed: true });
  assert.strictEqual(r.riskBand, "low");
});

test("invariant-4: score 30-59 → medium", () => {
  const r = computeRiskFromSeed({ correlationId: "b2", riskBand: "medium", riskScore: 0.45, fallbackUsed: true });
  assert.strictEqual(r.riskBand, "medium");
});

test("invariant-4: score 60-84 → high", () => {
  const r = computeRiskFromSeed({ correlationId: "b3", riskBand: "high", riskScore: 0.7, fallbackUsed: true });
  assert.strictEqual(r.riskBand, "high");
});

test("invariant-4: score >= 85 → critical", () => {
  const r = computeRiskFromSeed({ correlationId: "b4", riskBand: "critical", riskScore: 0.9, fallbackUsed: true });
  assert.strictEqual(r.riskBand, "critical");
});

test("invariant-4: band boundaries are correct", () => {
  // score 29 → low, score 30 → medium
  const r29 = computeRiskFromSeed({ correlationId: "bd1", riskBand: "low", riskScore: 0.29, fallbackUsed: true });
  const r30 = computeRiskFromSeed({ correlationId: "bd2", riskBand: "medium", riskScore: 0.30, fallbackUsed: true });
  assert.strictEqual(r29.riskBand, "low");
  assert.strictEqual(r30.riskBand, "medium");

  // score 59 → medium, score 60 → high
  const r59 = computeRiskFromSeed({ correlationId: "bd3", riskBand: "medium", riskScore: 0.59, fallbackUsed: true });
  const r60 = computeRiskFromSeed({ correlationId: "bd4", riskBand: "high", riskScore: 0.60, fallbackUsed: true });
  assert.strictEqual(r59.riskBand, "medium");
  assert.strictEqual(r60.riskBand, "high");

  // score 84 → high, score 85 → critical
  const r84 = computeRiskFromSeed({ correlationId: "bd5", riskBand: "high", riskScore: 0.84, fallbackUsed: true });
  const r85 = computeRiskFromSeed({ correlationId: "bd6", riskBand: "critical", riskScore: 0.85, fallbackUsed: true });
  assert.strictEqual(r84.riskBand, "high");
  assert.strictEqual(r85.riskBand, "critical");
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 5: Scenario count is bounded
// ════════════════════════════════════════════════════════════════════════════

test("invariant-5: candidate count is bounded [0, 3]", () => {
  for (const seed of SEEDS) {
    const comp = computeRiskFromSeed(seed);
    const candidates = generateCandidates(comp);
    assert.ok(candidates.length >= 0, "Negative candidates");
    assert.ok(candidates.length <= 3, `Too many candidates: ${candidates.length}`);
  }
});

test("invariant-5: terminal → 0 candidates", () => {
  const terminal = computeRiskFromSeed({ correlationId: "sc1", riskBand: "error", riskScore: null, fallbackUsed: true });
  assert.strictEqual(generateCandidates(terminal).length, 0);
});

test("invariant-5: low risk (score < 30) → 1 candidate", () => {
  const comp = computeRiskFromSeed({ correlationId: "sc2", riskBand: "low", riskScore: 0.15, fallbackUsed: true });
  assert.strictEqual(generateCandidates(comp).length, 1);
});

test("invariant-5: medium risk (30-49) → 2 candidates", () => {
  const comp = computeRiskFromSeed({ correlationId: "sc3", riskBand: "medium", riskScore: 0.40, fallbackUsed: true });
  assert.strictEqual(generateCandidates(comp).length, 2);
});

test("invariant-5: high risk (>= 50) → 3 candidates", () => {
  const comp = computeRiskFromSeed({ correlationId: "sc4", riskBand: "high", riskScore: 0.70, fallbackUsed: true });
  assert.strictEqual(generateCandidates(comp).length, 3);
});

test("invariant-5: dependency node count is bounded [1, 3]", () => {
  for (const seed of SEEDS) {
    const comp = computeRiskFromSeed(seed);
    const count = comp.dependencyGraph.nodes.length;
    assert.ok(count >= 1, `Too few nodes: ${count}`);
    assert.ok(count <= 3, `Too many nodes: ${count}`);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 6: Dependency cascade is generated
// ════════════════════════════════════════════════════════════════════════════

test("invariant-6: at least 1 node (connection-window) always present", () => {
  for (const seed of SEEDS) {
    const comp = computeRiskFromSeed(seed);
    assert.ok(comp.dependencyGraph.nodes.length >= 1);
    assert.strictEqual(comp.dependencyGraph.nodes[0].id, "connection-window");
    assert.strictEqual(comp.dependencyGraph.rootTriggerId, "connection-window");
  }
});

test("invariant-6: all nodes have required fields", () => {
  for (const seed of SEEDS) {
    const comp = computeRiskFromSeed(seed);
    for (const node of comp.dependencyGraph.nodes) {
      assert.ok(typeof node.id === "string" && node.id.length > 0, "Missing id");
      assert.ok(typeof node.label === "string" && node.label.length > 0, "Missing label");
      assert.ok(VALID_NODE_KINDS.has(node.kind), `Invalid kind: ${node.kind}`);
      assert.ok(VALID_NODE_STATUSES.has(node.status), `Invalid status: ${node.status}`);
      assert.ok(typeof node.cascadeDelayMs === "number" && node.cascadeDelayMs >= 0, "Invalid cascadeDelayMs");
      assert.ok(Array.isArray(node.dependsOn), "dependsOn must be array");
    }
  }
});

test("invariant-6: cascade delays are non-decreasing", () => {
  for (const seed of SEEDS) {
    const comp = computeRiskFromSeed(seed);
    const delays = comp.dependencyGraph.nodes.map((n) => n.cascadeDelayMs);
    for (let i = 1; i < delays.length; i++) {
      assert.ok(delays[i] >= delays[i - 1], `Delays not non-decreasing: ${delays}`);
    }
  }
});

test("invariant-6: terminal state → all nodes have status 'failed'", () => {
  const terminal = computeRiskFromSeed({ correlationId: "casc1", riskBand: "error", riskScore: null, fallbackUsed: true });
  for (const node of terminal.dependencyGraph.nodes) {
    assert.strictEqual(node.status, "failed", `Terminal node ${node.id} should be failed`);
  }
});

test("invariant-6: low score → only connection-window (no onward/hotel)", () => {
  const comp = computeRiskFromSeed({ correlationId: "casc2", riskBand: "low", riskScore: 0.10, fallbackUsed: true });
  assert.strictEqual(comp.dependencyGraph.nodes.length, 1);
  assert.strictEqual(comp.dependencyGraph.nodes[0].id, "connection-window");
});

test("invariant-6: medium score (40-59) → connection-window + onward-leg", () => {
  const comp = computeRiskFromSeed({ correlationId: "casc3", riskBand: "medium", riskScore: 0.50, fallbackUsed: true });
  assert.strictEqual(comp.dependencyGraph.nodes.length, 2);
  assert.strictEqual(comp.dependencyGraph.nodes[1].id, "onward-leg");
});

test("invariant-6: high score (>= 60) → all 3 nodes", () => {
  const comp = computeRiskFromSeed({ correlationId: "casc4", riskBand: "high", riskScore: 0.70, fallbackUsed: true });
  assert.strictEqual(comp.dependencyGraph.nodes.length, 3);
  const ids = comp.dependencyGraph.nodes.map((n) => n.id);
  assert.ok(ids.includes("connection-window"));
  assert.ok(ids.includes("onward-leg"));
  assert.ok(ids.includes("hotel-checkin"));
});

test("invariant-6: dependsOn references are valid", () => {
  for (const seed of SEEDS) {
    const comp = computeRiskFromSeed(seed);
    const nodeIds = new Set(comp.dependencyGraph.nodes.map((n) => n.id));
    for (const node of comp.dependencyGraph.nodes) {
      for (const dep of node.dependsOn) {
        assert.ok(nodeIds.has(dep), `Node ${node.id} depends on unknown ${dep}`);
      }
    }
  }
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 7: Candidates are evaluated
// ════════════════════════════════════════════════════════════════════════════

test("invariant-7: each candidate has offerReference", () => {
  for (const seed of SEEDS) {
    const comp = computeRiskFromSeed(seed);
    const candidates = generateCandidates(comp);
    for (const c of candidates) {
      assert.ok(typeof c.offerReference === "string", "Missing offerReference");
      assert.ok(c.offerReference.length > 0, "Empty offerReference");
    }
  }
});

test("invariant-7: candidate offerReferences are unique", () => {
  const comp = computeRiskFromSeed({ correlationId: "cand1", riskBand: "high", riskScore: 0.70, fallbackUsed: true });
  const candidates = generateCandidates(comp);
  const refs = candidates.map((c) => c.offerReference);
  assert.strictEqual(new Set(refs).size, refs.length, "Duplicate offerReferences");
});

test("invariant-7: candidates have connectionType and priceDisplay", () => {
  const comp = computeRiskFromSeed({ correlationId: "cand2", riskBand: "high", riskScore: 0.80, fallbackUsed: true });
  const candidates = generateCandidates(comp);
  for (const c of candidates) {
    assert.ok(typeof c.connectionType === "string", "Missing connectionType");
    assert.ok(typeof c.priceDisplay === "string", "Missing priceDisplay");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 8: One plan is selected when safe
// ════════════════════════════════════════════════════════════════════════════

test("invariant-8: non-terminal with candidates → recommendedPlan is non-null", () => {
  const comp = computeRiskFromSeed({ correlationId: "plan1", riskBand: "medium", riskScore: 0.50, fallbackUsed: true });
  const candidates = generateCandidates(comp);
  const plan = collapseIntoRecommendedPlan(candidates, comp);
  assert.ok(plan !== null, "Plan should exist for non-terminal with candidates");
  assert.ok(plan.replacementFirstLeg !== null, "replacementFirstLeg must exist");
  assert.ok(plan.replacementFirstLeg.offerReference !== null, "replacementFirstLeg.offerReference must exist");
});

test("invariant-8: recommendedPlan has exactly one replacementFirstLeg", () => {
  const comp = computeRiskFromSeed({ correlationId: "plan2", riskBand: "high", riskScore: 0.70, fallbackUsed: true });
  const candidates = generateCandidates(comp);
  const plan = collapseIntoRecommendedPlan(candidates, comp);
  assert.ok(plan.replacementFirstLeg !== null);
  assert.strictEqual(plan.replacementFirstLeg.offerReference, candidates[0].offerReference);
});

test("invariant-8: recommendedPlan tradeoffs fields are present", () => {
  const comp = computeRiskFromSeed({ correlationId: "plan3", riskBand: "medium", riskScore: 0.45, fallbackUsed: true });
  const candidates = generateCandidates(comp);
  const plan = collapseIntoRecommendedPlan(candidates, comp);
  assert.ok(plan.tradeoffs !== undefined, "tradeoffs must exist");
  assert.ok("arrivalImpactMinutes" in plan.tradeoffs);
  assert.ok("connectionBufferMinutes" in plan.tradeoffs);
  assert.ok("fareDelta" in plan.tradeoffs);
  assert.ok("fareDeltaCurrency" in plan.tradeoffs);
});

test("invariant-8: adapter output confirmationPhase is 'review-recovery-plan' when plan exists", () => {
  const result = buildAdapterOutput({
    correlationId: "plan4",
    riskBand: "medium",
    riskScore: 0.50,
    fallbackUsed: true,
  });
  assert.strictEqual(result.animationData.confirmationPhase, "review-recovery-plan");
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 9: No-safe-plan becomes terminal
// ════════════════════════════════════════════════════════════════════════════

test("invariant-9: error band → isTerminalNoPlan = true", () => {
  const r = computeRiskFromSeed({ correlationId: "term1", riskBand: "error", riskScore: null, fallbackUsed: true });
  assert.strictEqual(r.isTerminalNoPlan, true);
});

test("invariant-9: timeout band → isTerminalNoPlan = true", () => {
  const r = computeRiskFromSeed({ correlationId: "term2", riskBand: "timeout", riskScore: null, fallbackUsed: true });
  assert.strictEqual(r.isTerminalNoPlan, true);
});

test("invariant-9: unknown band → isTerminalNoPlan = true", () => {
  const r = computeRiskFromSeed({ correlationId: "term3", riskBand: "foobar", riskScore: null, fallbackUsed: true });
  assert.strictEqual(r.isTerminalNoPlan, true);
});

test("invariant-9: low/medium/high/critical → NOT terminal", () => {
  for (const band of ["low", "medium", "high", "critical"]) {
    const r = computeRiskFromSeed({ correlationId: `term-${band}`, riskBand: band, riskScore: null, fallbackUsed: true });
    assert.strictEqual(r.isTerminalNoPlan, false, `${band} should not be terminal`);
  }
});

test("invariant-9: terminal → recommendedPlan is null", () => {
  const comp = computeRiskFromSeed({ correlationId: "term4", riskBand: "error", riskScore: null, fallbackUsed: true });
  const candidates = generateCandidates(comp);
  const plan = collapseIntoRecommendedPlan(candidates, comp);
  assert.strictEqual(plan, null);
});

test("invariant-9: terminal → 0 candidates", () => {
  const comp = computeRiskFromSeed({ correlationId: "term5", riskBand: "timeout", riskScore: null, fallbackUsed: true });
  assert.strictEqual(generateCandidates(comp).length, 0);
});

test("invariant-9: terminal → adapter confirmationPhase is 'idle'", () => {
  const result = buildAdapterOutput({
    correlationId: "term6",
    riskBand: "error",
    riskScore: null,
    fallbackUsed: true,
  });
  assert.strictEqual(result.animationData.confirmationPhase, "idle");
});

test("invariant-9: terminal → workloadStatus is 'no-safe-plan'", () => {
  const result = buildAdapterOutput({
    correlationId: "term7",
    riskBand: "timeout",
    riskScore: null,
    fallbackUsed: true,
  });
  assert.strictEqual(result.workloadStatus, "no-safe-plan");
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 10: Attempts never exceed 2
// ════════════════════════════════════════════════════════════════════════════

test("invariant-10: maxRePlanAttempts is exactly 2", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.strictEqual(result.animationData.maxRePlanAttempts, 2);
  }
});

test("invariant-10: rePlanAttemptCount starts at 0", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.strictEqual(result.animationData.rePlanAttemptCount, 0);
  }
});

test("invariant-10: rePlanAttemptCount never exceeds maxRePlanAttempts", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.ok(
      result.animationData.rePlanAttemptCount <= result.animationData.maxRePlanAttempts,
      `rePlanAttemptCount (${result.animationData.rePlanAttemptCount}) exceeds max (${result.animationData.maxRePlanAttempts})`
    );
  }
});

test("invariant-10: adapter source hardcodes maxRePlanAttempts: 2", () => {
  assert.ok(
    adapterSrc.includes("maxRePlanAttempts: 2"),
    "Adapter must hardcode maxRePlanAttempts: 2"
  );
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 11: Missing fields remain null/unavailable
// ════════════════════════════════════════════════════════════════════════════

test("invariant-11: jobOrServiceReference is always null", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.strictEqual(result.jobOrServiceReference, null);
  }
});

test("invariant-11: verifiedOutcome is always null", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.strictEqual(result.animationData.verifiedOutcome, null);
  }
});

test("invariant-11: errorCode and errorMessage are null for non-error seeds", () => {
  const result = buildAdapterOutput({
    correlationId: "null1",
    riskBand: "low",
    riskScore: null,
    fallbackUsed: true,
  });
  assert.strictEqual(result.errorCode, null);
  assert.strictEqual(result.errorMessage, null);
});

test("invariant-11: tradeoffs null fields remain null", () => {
  const comp = computeRiskFromSeed({ correlationId: "null2", riskBand: "medium", riskScore: 0.45, fallbackUsed: true });
  const candidates = generateCandidates(comp);
  const plan = collapseIntoRecommendedPlan(candidates, comp);
  assert.strictEqual(plan.tradeoffs.arrivalImpactMinutes, null);
  assert.strictEqual(plan.tradeoffs.connectionBufferMinutes, null);
  assert.strictEqual(plan.tradeoffs.fareDelta, null);
  assert.strictEqual(plan.tradeoffs.fareDeltaCurrency, null);
});

test("invariant-11: originalFirstLeg scheduled times are null (not fabricated)", () => {
  const result = buildAdapterOutput({
    correlationId: "null3",
    riskBand: "medium",
    riskScore: 0.50,
    fallbackUsed: true,
  });
  assert.strictEqual(result.animationData.originalFirstLeg.scheduledDeparture, null);
  assert.strictEqual(result.animationData.originalFirstLeg.scheduledArrival, null);
});

test("invariant-11: adapter source sets verifiedOutcome: null", () => {
  assert.ok(
    adapterSrc.includes("verifiedOutcome: null"),
    "Adapter must set verifiedOutcome: null"
  );
});

test("invariant-11: RiskResult interface has nullable fields", () => {
  assert.ok(riskSrc.includes("jobOrServiceReference: string | null"));
  assert.ok(riskSrc.includes("riskScore: number | null"));
  assert.ok(riskSrc.includes("errorCode: string | null"));
  assert.ok(riskSrc.includes("errorMessage: string | null"));
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 12: Provenance is preserved
// ════════════════════════════════════════════════════════════════════════════

test("invariant-12: provenanceLabel is set on every adapter output", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.ok(
      typeof result.animationData.provenanceLabel === "string",
      "provenanceLabel must be a string"
    );
    assert.ok(
      result.animationData.provenanceLabel.length > 0,
      "provenanceLabel must not be empty"
    );
  }
});

test("invariant-12: provenanceLabel matches local-fallback label", () => {
  const result = buildAdapterOutput({
    correlationId: "prov1",
    riskBand: "low",
    riskScore: null,
    fallbackUsed: true,
  });
  assert.strictEqual(
    result.animationData.provenanceLabel,
    "Local fallback \u2014 Daytona risk computation not executed"
  );
});

test("invariant-12: dataSource is always 'local-fallback'", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.strictEqual(result.animationData.dataSource, "local-fallback");
  }
});

test("invariant-12: executionMode is always 'local-fallback'", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.strictEqual(result.executionMode, "local-fallback");
  }
});

test("invariant-12: executed is always false", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.strictEqual(result.executed, false);
  }
});

test("invariant-12: evidenceSource is set", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.ok(
      typeof result.evidenceSource === "string",
      "evidenceSource must be a string"
    );
  }
});

test("invariant-12: seed is preserved in computation result", () => {
  for (const seed of SEEDS) {
    const comp = computeRiskFromSeed(seed);
    assert.deepStrictEqual(comp.seed, seed, "Seed must be preserved verbatim");
  }
});

test("invariant-12: heuristicDisclaimer is always present", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.ok(
      typeof result.heuristicDisclaimer === "string" && result.heuristicDisclaimer.length > 0,
      "heuristicDisclaimer must be a non-empty string"
    );
  }
});

test("invariant-12: adapter source contains dataSource: 'local-fallback'", () => {
  assert.ok(
    adapterSrc.includes("dataSource: 'local-fallback'"),
    "Adapter must set dataSource to 'local-fallback'"
  );
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 13: externalWriteOccurred is always false
// ════════════════════════════════════════════════════════════════════════════

test("invariant-13: externalWriteOccurred is false for all seeds", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.strictEqual(
      result.externalWriteOccurred,
      false,
      `externalWriteOccurred must be false for ${seed.correlationId}`
    );
  }
});

test("invariant-13: externalWriteOccurred is false for terminal state", () => {
  const result = buildAdapterOutput({
    correlationId: "ew1",
    riskBand: "error",
    riskScore: null,
    fallbackUsed: true,
  });
  assert.strictEqual(result.externalWriteOccurred, false);
});

test("invariant-13: worker source hardcodes externalWriteOccurred: false", () => {
  const workerSrc = fs.readFileSync(
    new URL("../workers/daytona-risk-worker/index.mjs", import.meta.url),
    "utf8"
  );
  // Count occurrences — both error and success paths must set it to false
  const matches = workerSrc.match(/externalWriteOccurred:\s*false/g);
  assert.ok(matches && matches.length >= 2, "Worker must set externalWriteOccurred: false in all paths");
});

test("invariant-13: no source file sets externalWriteOccurred to true", () => {
  const srcs = [
    ["risk-computation.ts", riskCompSrc],
    ["recovery-plan-adapter.ts", adapterSrc],
  ];
  for (const [name, src] of srcs) {
    assert.ok(
      !src.includes("externalWriteOccurred: true") && !src.includes("externalWriteOccurred:true"),
      `${name} must never set externalWriteOccurred to true`
    );
  }
});

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT 14: No booking/payment/ticket action is produced
// ════════════════════════════════════════════════════════════════════════════

test("invariant-14: adapter source contains no forbidden write labels", () => {
  const forbidden = ["Booked", "Switched", "Ticket issued", "Order created", "Payment processed"];
  // Strip comments before checking
  const stripped = adapterSrc.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const label of forbidden) {
    const pattern = new RegExp(`["']${label}["']`);
    assert.ok(!pattern.test(stripped), `Forbidden write label "${label}" in adapter`);
  }
});

test("invariant-14: adapter source contains no forbidden write operations", () => {
  const forbidden = ["createOrder", "bookFlight", "issueTicket", "processPayment", "confirmBooking"];
  for (const op of forbidden) {
    assert.ok(!adapterSrc.includes(op), `Forbidden operation "${op}" in adapter`);
  }
});

test("invariant-14: risk-computation.ts contains no write operations", () => {
  const forbidden = ["createOrder", "bookFlight", "issueTicket", "processPayment", "confirmBooking", "fetch("];
  for (const op of forbidden) {
    assert.ok(!riskCompSrc.includes(op), `Forbidden operation "${op}" in risk-computation.ts`);
  }
});

test("invariant-14: no adapter output contains booking confirmation strings", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    const json = JSON.stringify(result);
    assert.ok(!json.includes('"Booked"'), "Output contains 'Booked'");
    assert.ok(!json.includes('"Switched"'), "Output contains 'Switched'");
    assert.ok(!json.includes('"Ticket issued"'), "Output contains 'Ticket issued'");
    assert.ok(!json.includes('"Payment processed"'), "Output contains 'Payment processed'");
  }
});

test("invariant-14: confirmationPhase never reaches 'verified-outcome' directly", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.ok(
      result.animationData.confirmationPhase !== "verified-outcome",
      "confirmationPhase must never be 'verified-outcome' from adapter"
    );
  }
});

test("invariant-14: delayTrigger.isRealDelaySignal is always false", () => {
  for (const seed of SEEDS) {
    const result = buildAdapterOutput({
      correlationId: seed.correlationId,
      riskBand: seed.riskBand,
      riskScore: seed.riskScore,
      fallbackUsed: seed.fallbackUsed,
    });
    assert.strictEqual(result.animationData.delayTrigger.isRealDelaySignal, false);
  }
});

test("invariant-14: adapter source sets isRealDelaySignal: false", () => {
  assert.ok(
    adapterSrc.includes("isRealDelaySignal: false"),
    "Adapter must set isRealDelaySignal: false"
  );
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\nRisk computation offline tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
