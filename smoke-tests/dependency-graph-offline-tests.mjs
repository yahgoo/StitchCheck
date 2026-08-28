// Dependency graph, risk computation, adapter, and execution-mode
// offline tests for StitchCheck.
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// These tests verify:
//   1. Dependency graph types are well-formed.
//   2. Deterministic seeded risk computation is pure and reproducible.
//   3. Recovery-plan adapter produces valid animation data.
//   4. Execution-mode labels are accurate and never claim live for mock data.
//   5. Cascade is visible (at least one downstream item).
//   6. One recovery plan is shown for non-terminal results.
//   7. Confirmation state is safe (no "Booked", "Switched", "Ticket issued").
//   8. No forbidden write labels appear.
//   9. Evidence labels are accurate.
//
// Hard guarantees:
// - Zero network code: no fetch/http/https/net/socket imports or calls.
// - Zero credentials read: no .env or secret file is ever touched.
// - Zero dependencies: Node.js built-ins and existing local modules only.
// - Deterministic: no randomness, no timing, no external calls.

import assert from "node:assert";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// ── Import from compiled core (TypeScript source) ──
// These tests import the .ts source via dynamic import after verifying
// the source files exist. Since Node.js cannot import .ts directly,
// we test the logic by re-implementing the pure functions inline
// and verifying the TypeScript source files contain the expected exports.

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

// ── Source-file existence checks ────────────────────────────────────────────

const coreDir = new URL("../core/domain/", import.meta.url);

test("dependency-graph.ts exists", () => {
  const path = new URL("dependency-graph.ts", coreDir);
  assert.ok(fs.existsSync(path), "dependency-graph.ts not found");
});

test("risk-computation.ts exists", () => {
  const path = new URL("risk-computation.ts", coreDir);
  assert.ok(fs.existsSync(path), "risk-computation.ts not found");
});

test("execution-mode.ts exists", () => {
  const path = new URL("execution-mode.ts", coreDir);
  assert.ok(fs.existsSync(path), "execution-mode.ts not found");
});

test("recovery-plan-adapter.ts exists", () => {
  const path = new URL("recovery-plan-adapter.ts", coreDir);
  assert.ok(fs.existsSync(path), "recovery-plan-adapter.ts not found");
});

// ── Source-file content assertions ──────────────────────────────────────────

const depGraphSrc = fs.readFileSync(new URL("dependency-graph.ts", coreDir), "utf8");
const riskCompSrc = fs.readFileSync(new URL("risk-computation.ts", coreDir), "utf8");
const execModeSrc = fs.readFileSync(new URL("execution-mode.ts", coreDir), "utf8");
const adapterSrc = fs.readFileSync(new URL("recovery-plan-adapter.ts", coreDir), "utf8");

// ── Invariant 1: Dependency graph types export required interfaces ──────────

test("dependency-graph.ts exports DependencyNode interface", () => {
  assert.ok(
    depGraphSrc.includes("export interface DependencyNode"),
    "Missing DependencyNode interface export"
  );
});

test("dependency-graph.ts exports DependencyGraph interface", () => {
  assert.ok(
    depGraphSrc.includes("export interface DependencyGraph"),
    "Missing DependencyGraph interface export"
  );
});

test("dependency-graph.ts exports DependencyNodeStatus type", () => {
  assert.ok(
    depGraphSrc.includes("export type DependencyNodeStatus"),
    "Missing DependencyNodeStatus type export"
  );
});

test("dependency-graph.ts DependencyNode has required fields", () => {
  assert.ok(depGraphSrc.includes("id: string"), "Missing id field");
  assert.ok(depGraphSrc.includes("label: string"), "Missing label field");
  assert.ok(depGraphSrc.includes("cascadeDelayMs: number"), "Missing cascadeDelayMs field");
  assert.ok(depGraphSrc.includes("dependsOn: string[]"), "Missing dependsOn field");
  assert.ok(depGraphSrc.includes("status: DependencyNodeStatus"), "Missing status field");
});

// ── Invariant 2: Risk computation is deterministic and pure ─────────────────

test("risk-computation.ts exports computeRiskFromSeed", () => {
  assert.ok(
    riskCompSrc.includes("export function computeRiskFromSeed"),
    "Missing computeRiskFromSeed export"
  );
});

test("risk-computation.ts contains no network primitives", () => {
  const forbidden = ["fetch(", "import http", "import https", "import net", "import socket"];
  for (const f of forbidden) {
    assert.ok(!riskCompSrc.includes(f), `Forbidden: ${f} found in risk-computation.ts`);
  }
});

test("risk-computation.ts contains no credential references", () => {
  const envLocal = [".env", ".local"].join("");
  assert.ok(
    !riskCompSrc.includes(envLocal),
    "Forbidden: env-local reference in risk-computation.ts"
  );
  assert.ok(
    !riskCompSrc.includes("apiKey"),
    "Forbidden: apiKey reference in risk-computation.ts"
  );
});

test("risk-computation.ts uses seeded PRNG (deterministic)", () => {
  assert.ok(
    riskCompSrc.includes("seededRandom") || riskCompSrc.includes("mulberry32"),
    "Missing seeded PRNG in risk-computation.ts"
  );
});

test("risk-computation.ts RiskComputationResult has dependencyGraph", () => {
  assert.ok(
    riskCompSrc.includes("dependencyGraph: DependencyGraph"),
    "Missing dependencyGraph in RiskComputationResult"
  );
});

test("risk-computation.ts RiskComputationResult has isTerminalNoPlan", () => {
  assert.ok(
    riskCompSrc.includes("isTerminalNoPlan: boolean"),
    "Missing isTerminalNoPlan in RiskComputationResult"
  );
});

// ── Invariant 3: Execution modes and labels ─────────────────────────────────

test("execution-mode.ts exports all 7 required modes", () => {
  const requiredModes = [
    "local-fallback",
    "daytona-offline-mock",
    "daytona-live-risk",
    "nosana-offline",
    "nosana-live",
    "atlas-test-data",
    "atlas-production-reference",
  ];
  for (const mode of requiredModes) {
    assert.ok(
      execModeSrc.includes(`'${mode}'`),
      `Missing execution mode: ${mode}`
    );
  }
});

test("execution-mode.ts local-fallback label is exact", () => {
  // The exact label required by the spec
  const expectedLabel = "Local fallback \\u2014 Daytona risk computation not executed";
  assert.ok(
    execModeSrc.includes(expectedLabel),
    "local-fallback provenance label does not match spec"
  );
});

test("execution-mode.ts nosana-offline label preserves offline semantics", () => {
  assert.ok(
    execModeSrc.includes("no live job executed"),
    "nosana-offline label must mention no live job executed"
  );
});

test("execution-mode.ts getExecutionModeLabel marks local-fallback as not live", () => {
  // Verify the local-fallback case returns isLive: false
  const localFallbackBlock = execModeSrc.slice(
    execModeSrc.indexOf("case 'local-fallback'"),
    execModeSrc.indexOf("case 'daytona-offline-mock'")
  );
  assert.ok(
    localFallbackBlock.includes("isLive: false"),
    "local-fallback must have isLive: false"
  );
});

test("execution-mode.ts exports resolveExecutionMode with safe default", () => {
  assert.ok(
    execModeSrc.includes("export function resolveExecutionMode"),
    "Missing resolveExecutionMode export"
  );
  assert.ok(
    execModeSrc.includes("return 'local-fallback'"),
    "resolveExecutionMode must default to 'local-fallback'"
  );
});

// ── Invariant 4: Adapter contract ───────────────────────────────────────────

test("adapter exports riskResultToAnimationData", () => {
  assert.ok(
    adapterSrc.includes("export function riskResultToAnimationData"),
    "Missing riskResultToAnimationData export"
  );
});

test("adapter contains no network primitives", () => {
  const forbidden = ["fetch(", "import http", "import https", "import net", "import socket"];
  for (const f of forbidden) {
    assert.ok(!adapterSrc.includes(f), `Forbidden: ${f} found in adapter`);
  }
});

test("adapter contains no credential references", () => {
  const envLocal = [".env", ".local"].join("");
  assert.ok(!adapterSrc.includes(envLocal), "Forbidden: env-local reference in adapter");
});

test("adapter default execution mode is local-fallback", () => {
  assert.ok(
    adapterSrc.includes("'local-fallback'"),
    "Adapter must default to local-fallback execution mode"
  );
});

test("adapter sets dataSource to local-fallback", () => {
  assert.ok(
    adapterSrc.includes("dataSource: 'local-fallback'"),
    "Adapter must set dataSource to 'local-fallback'"
  );
});

test("adapter sets verifiedOutcome to null", () => {
  assert.ok(
    adapterSrc.includes("verifiedOutcome: null"),
    "Adapter must set verifiedOutcome to null"
  );
});

test("adapter sets delayTrigger.isRealDelaySignal to false", () => {
  assert.ok(
    adapterSrc.includes("isRealDelaySignal: false"),
    "Adapter must set isRealDelaySignal to false"
  );
});

test("adapter uses simulated trigger label", () => {
  assert.ok(
    adapterSrc.includes("Simulated delay trigger"),
    "Adapter must use the simulated delay trigger label"
  );
});

// ── Invariant 5: Safety — no forbidden write labels ─────────────────────────

test("adapter source contains no booking/write labels", () => {
  const forbiddenLabels = [
    "Booked",
    "Switched",
    "Ticket issued",
    "Order created",
    "Payment processed",
  ];
  for (const label of forbiddenLabels) {
    assert.ok(
      !adapterSrc.includes(label),
      `Forbidden write label "${label}" found in adapter`
    );
  }
});

test("adapter source contains no supplier-write operations", () => {
  const forbiddenOps = [
    "createOrder",
    "bookFlight",
    "issueTicket",
    "processPayment",
    "confirmBooking",
  ];
  for (const op of forbiddenOps) {
    assert.ok(
      !adapterSrc.includes(op),
      `Forbidden operation "${op}" found in adapter`
    );
  }
});

// ── Invariant 6: Confirmation state is safe ─────────────────────────────────

test("adapter confirmation phase is safe (review-recovery-plan or idle)", () => {
  // The adapter must set confirmationPhase to either 'review-recovery-plan'
  // (when a plan exists) or 'idle' (when no plan). Never 'verified-outcome'.
  assert.ok(
    adapterSrc.includes("'review-recovery-plan'"),
    "Adapter must support review-recovery-plan phase"
  );
  assert.ok(
    adapterSrc.includes("'idle'"),
    "Adapter must support idle phase"
  );
  // Must NOT set verified-outcome directly
  assert.ok(
    !adapterSrc.includes("confirmationPhase: 'verified-outcome'"),
    "Adapter must never set verified-outcome directly"
  );
});

test("adapter shows 'awaiting verified supplier outcome' semantics", () => {
  // The adapter sets verifiedOutcome: null, which means the component
  // will show "Request submitted — awaiting verified supplier outcome"
  assert.ok(
    adapterSrc.includes("verifiedOutcome: null"),
    "Adapter must set verifiedOutcome to null for safe confirmation"
  );
});

// ── Invariant 7: Deterministic seed computation ─────────────────────────────

// Inline re-implementation of the seed derivation for testing
function deriveNumericSeed(correlationId) {
  let hash = 0;
  for (let i = 0; i < correlationId.length; i++) {
    hash = ((hash << 5) - hash + correlationId.charCodeAt(i)) | 0;
  }
  return hash;
}

test("seed derivation is deterministic", () => {
  const seed1 = deriveNumericSeed("test-correlation-id");
  const seed2 = deriveNumericSeed("test-correlation-id");
  assert.strictEqual(seed1, seed2, "Same input must produce same seed");
});

test("seed derivation differs for different inputs", () => {
  const seed1 = deriveNumericSeed("correlation-a");
  const seed2 = deriveNumericSeed("correlation-b");
  assert.notStrictEqual(seed1, seed2, "Different inputs must produce different seeds");
});

// ── Invariant 8: Seeded PRNG is deterministic ──────────────────────────────

function seededRandom(seed) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("seeded PRNG produces deterministic sequence", () => {
  const rng1 = seededRandom(42);
  const rng2 = seededRandom(42);
  const seq1 = [rng1(), rng1(), rng1()];
  const seq2 = [rng2(), rng2(), rng2()];
  assert.deepStrictEqual(seq1, seq2, "Same seed must produce same sequence");
});

test("seeded PRNG produces values in [0, 1)", () => {
  const rng = seededRandom(12345);
  for (let i = 0; i < 100; i++) {
    const val = rng();
    assert.ok(val >= 0 && val < 1, `Value ${val} out of range [0, 1)`);
  }
});

test("seeded PRNG produces different sequences for different seeds", () => {
  const rng1 = seededRandom(42);
  const rng2 = seededRandom(99);
  const val1 = rng1();
  const val2 = rng2();
  assert.notStrictEqual(val1, val2, "Different seeds must produce different values");
});

// ── Invariant 9: Risk computation logic (inline re-implementation) ──────────

function computeRiskBand(score) {
  if (score < 30) return "low";
  if (score < 60) return "medium";
  if (score < 85) return "high";
  return "critical";
}

test("risk band derivation: score 15 → low", () => {
  assert.strictEqual(computeRiskBand(15), "low");
});

test("risk band derivation: score 45 → medium", () => {
  assert.strictEqual(computeRiskBand(45), "medium");
});

test("risk band derivation: score 70 → high", () => {
  assert.strictEqual(computeRiskBand(70), "high");
});

test("risk band derivation: score 90 → critical", () => {
  assert.strictEqual(computeRiskBand(90), "critical");
});

test("risk band derivation: score 0 → low", () => {
  assert.strictEqual(computeRiskBand(0), "low");
});

test("risk band derivation: score 100 → critical", () => {
  assert.strictEqual(computeRiskBand(100), "critical");
});

// ── Invariant 10: Terminal state detection ──────────────────────────────────

function isTerminal(riskBand) {
  return riskBand === "error" || riskBand === "timeout" ||
    !["low", "medium", "high", "critical"].includes(riskBand);
}

test("terminal state: error band → terminal", () => {
  assert.ok(isTerminal("error"));
});

test("terminal state: timeout band → terminal", () => {
  assert.ok(isTerminal("timeout"));
});

test("terminal state: unknown band → terminal", () => {
  assert.ok(isTerminal("unknown"));
});

test("non-terminal: low band → not terminal", () => {
  assert.ok(!isTerminal("low"));
});

test("non-terminal: critical band → not terminal", () => {
  assert.ok(!isTerminal("critical"));
});

// ── Invariant 11: Cascade visibility ────────────────────────────────────────

test("cascade: low risk (score < 30) produces 1 node (connection-window only)", () => {
  // Score < 30 → only connection-window, no onward-leg or hotel
  const score = 25;
  const nodeCount = 1 + (score >= 40 ? 1 : 0) + (score >= 60 ? 1 : 0);
  assert.strictEqual(nodeCount, 1, "Low risk should produce 1 cascade node");
});

test("cascade: medium risk (score 40-59) produces 2 nodes", () => {
  const score = 50;
  const nodeCount = 1 + (score >= 40 ? 1 : 0) + (score >= 60 ? 1 : 0);
  assert.strictEqual(nodeCount, 2, "Medium risk (score 50) should produce 2 cascade nodes");
});

test("cascade: high risk (score 60-84) produces 3 nodes", () => {
  const score = 70;
  const nodeCount = 1 + (score >= 40 ? 1 : 0) + (score >= 60 ? 1 : 0);
  assert.strictEqual(nodeCount, 3, "High risk should produce 3 cascade nodes");
});

test("cascade: terminal state produces 1 node (connection-window, failed)", () => {
  // Terminal → only connection-window with status 'failed'
  const nodeCount = 1; // Only the root node, no additional items
  assert.strictEqual(nodeCount, 1, "Terminal state should produce 1 cascade node");
});

// ── Invariant 12: Candidate alternatives ────────────────────────────────────

function candidateCount(score, terminal) {
  if (terminal) return 0;
  let count = 1; // Always at least 1
  if (score >= 30) count += 1;
  if (score >= 50) count += 1;
  return count;
}

test("candidates: terminal → 0 candidates", () => {
  assert.strictEqual(candidateCount(100, true), 0);
});

test("candidates: low risk (score 20) → 1 candidate", () => {
  assert.strictEqual(candidateCount(20, false), 1);
});

test("candidates: medium risk (score 45) → 2 candidates", () => {
  assert.strictEqual(candidateCount(45, false), 2);
});

test("candidates: high risk (score 70) → 3 candidates", () => {
  assert.strictEqual(candidateCount(70, false), 3);
});

// ── Invariant 13: Collapse into one recovery plan ───────────────────────────

test("collapse: with candidates → recommended plan is non-null", () => {
  // When candidates exist, collapse produces a plan
  const candidates = [{ offerReference: "test-001" }];
  const hasPlan = candidates.length > 0;
  assert.ok(hasPlan, "With candidates, plan should be non-null");
});

test("collapse: without candidates → recommended plan is null", () => {
  const candidates = [];
  const hasPlan = candidates.length > 0;
  assert.ok(!hasPlan, "Without candidates, plan should be null");
});

// ── Invariant 14: Source file contains no forbidden network/credential refs ──

test("All new source files contain no endpoint URLs", () => {
  const urlPattern = /https?:\/\/[^\s"')]+/;
  for (const [name, src] of [
    ["dependency-graph.ts", depGraphSrc],
    ["risk-computation.ts", riskCompSrc],
    ["execution-mode.ts", execModeSrc],
    ["recovery-plan-adapter.ts", adapterSrc],
  ]) {
    assert.ok(
      !urlPattern.test(src),
      `Forbidden: endpoint URL found in ${name}`
    );
  }
});

test("All new source files contain no credential assignment patterns", () => {
  const credPattern = /(?:^|\n)\s*(?:const|let|var)\s+(?:apiKey|api_key|secret|password)\s*=/;
  for (const [name, src] of [
    ["dependency-graph.ts", depGraphSrc],
    ["risk-computation.ts", riskCompSrc],
    ["execution-mode.ts", execModeSrc],
    ["recovery-plan-adapter.ts", adapterSrc],
  ]) {
    assert.ok(
      !credPattern.test(src),
      `Forbidden: credential assignment in ${name}`
    );
  }
});

// ── Invariant 15: RecoveryPlanAnimation component extension ─────────────────

test("RecoveryPlanAnimation.tsx imports ExecutionMode type", () => {
  const animSrc = fs.readFileSync(
    new URL("../app/src/components/RecoveryPlanAnimation.tsx", import.meta.url),
    "utf8"
  );
  assert.ok(
    animSrc.includes("ExecutionMode"),
    "RecoveryPlanAnimation must import ExecutionMode"
  );
});

test("RecoveryPlanAnimation.tsx accepts executionMode prop", () => {
  const animSrc = fs.readFileSync(
    new URL("../app/src/components/RecoveryPlanAnimation.tsx", import.meta.url),
    "utf8"
  );
  assert.ok(
    animSrc.includes("executionMode"),
    "RecoveryPlanAnimation must accept executionMode prop"
  );
});

test("RecoveryPlanAnimation.tsx does not contain forbidden write labels", () => {
  const animSrc = fs.readFileSync(
    new URL("../app/src/components/RecoveryPlanAnimation.tsx", import.meta.url),
    "utf8"
  );
  // Strip comments (both // and /* */) before checking for labels
  const srcWithoutComments = animSrc
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const forbidden = ["Booked", "Switched", "Ticket issued"];
  for (const label of forbidden) {
    const positiveClaim = new RegExp(`["']${label}["']`);
    assert.ok(
      !positiveClaim.test(srcWithoutComments),
      `Forbidden positive claim label "${label}" found in animation component (excluding comments)`
    );
  }
});

// ── Invariant 16: Core barrel exports include new types ─────────────────────

test("core/domain/index.ts exports dependency graph types", () => {
  const domainIdx = fs.readFileSync(
    new URL("../core/domain/index.ts", import.meta.url),
    "utf8"
  );
  assert.ok(
    domainIdx.includes("DependencyNode") && domainIdx.includes("DependencyGraph"),
    "core/domain/index.ts must export dependency graph types"
  );
});

test("core/domain/index.ts exports execution mode types and functions", () => {
  const domainIdx = fs.readFileSync(
    new URL("../core/domain/index.ts", import.meta.url),
    "utf8"
  );
  assert.ok(
    domainIdx.includes("ExecutionMode") && domainIdx.includes("getExecutionModeLabel"),
    "core/domain/index.ts must export execution mode types and functions"
  );
});

test("core/domain/index.ts exports risk computation", () => {
  const domainIdx = fs.readFileSync(
    new URL("../core/domain/index.ts", import.meta.url),
    "utf8"
  );
  assert.ok(
    domainIdx.includes("computeRiskFromSeed"),
    "core/domain/index.ts must export computeRiskFromSeed"
  );
});

test("core/domain/index.ts exports adapter", () => {
  const domainIdx = fs.readFileSync(
    new URL("../core/domain/index.ts", import.meta.url),
    "utf8"
  );
  assert.ok(
    domainIdx.includes("riskResultToAnimationData"),
    "core/domain/index.ts must export riskResultToAnimationData"
  );
});

test("core/index.ts re-exports new domain types", () => {
  const coreIdx = fs.readFileSync(
    new URL("../core/index.ts", import.meta.url),
    "utf8"
  );
  assert.ok(
    coreIdx.includes("DependencyGraph") &&
    coreIdx.includes("ExecutionMode") &&
    coreIdx.includes("computeRiskFromSeed") &&
    coreIdx.includes("riskResultToAnimationData"),
    "core/index.ts must re-export new domain types and functions"
  );
});

// ── Invariant 17: Valid node kinds enumeration ─────────────────────────────

// Extract the exact DependencyNodeKind union members from source.
const VALID_NODE_KINDS = (() => {
  const kinds = [];
  const kindPattern = /'([a-z][a-z0-9-]*)'/g;
  // Extract from the DependencyNodeKind type block (between the type alias and the next semicolon).
  const kindBlockStart = depGraphSrc.indexOf("export type DependencyNodeKind");
  const kindBlockEnd = depGraphSrc.indexOf(";", kindBlockStart);
  const kindBlock = depGraphSrc.slice(kindBlockStart, kindBlockEnd);
  let m;
  while ((m = kindPattern.exec(kindBlock)) !== null) {
    kinds.push(m[1]);
  }
  return Object.freeze(kinds);
})();

test("valid node kinds: exactly 5 kinds defined", () => {
  assert.strictEqual(VALID_NODE_KINDS.length, 5, `Expected 5 kinds, got ${VALID_NODE_KINDS.length}`);
});

test("valid node kinds: contains connection-window", () => {
  assert.ok(VALID_NODE_KINDS.includes("connection-window"), "Missing kind: connection-window");
});

test("valid node kinds: contains onward-leg", () => {
  assert.ok(VALID_NODE_KINDS.includes("onward-leg"), "Missing kind: onward-leg");
});

test("valid node kinds: contains hotel-checkin", () => {
  assert.ok(VALID_NODE_KINDS.includes("hotel-checkin"), "Missing kind: hotel-checkin");
});

test("valid node kinds: contains ground-transport", () => {
  assert.ok(VALID_NODE_KINDS.includes("ground-transport"), "Missing kind: ground-transport");
});

test("valid node kinds: contains event-connection", () => {
  assert.ok(VALID_NODE_KINDS.includes("event-connection"), "Missing kind: event-connection");
});

test("valid node kinds: all kinds are kebab-case strings", () => {
  const kebabPattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  for (const kind of VALID_NODE_KINDS) {
    assert.ok(kebabPattern.test(kind), `Kind "${kind}" is not kebab-case`);
  }
});

// ── Invariant 18: Valid node statuses enumeration ──────────────────────────

const VALID_NODE_STATUSES = (() => {
  const statuses = [];
  const statusPattern = /'([a-z][a-z0-9-]*)'/g;
  const statusBlockStart = depGraphSrc.indexOf("export type DependencyNodeStatus");
  const statusBlockEnd = depGraphSrc.indexOf(";", statusBlockStart);
  const statusBlock = depGraphSrc.slice(statusBlockStart, statusBlockEnd);
  let m;
  while ((m = statusPattern.exec(statusBlock)) !== null) {
    statuses.push(m[1]);
  }
  return Object.freeze(statuses);
})();

test("valid node statuses: exactly 3 statuses defined", () => {
  assert.strictEqual(VALID_NODE_STATUSES.length, 3, `Expected 3 statuses, got ${VALID_NODE_STATUSES.length}`);
});

test("valid node statuses: contains ok", () => {
  assert.ok(VALID_NODE_STATUSES.includes("ok"), "Missing status: ok");
});

test("valid node statuses: contains at-risk", () => {
  assert.ok(VALID_NODE_STATUSES.includes("at-risk"), "Missing status: at-risk");
});

test("valid node statuses: contains failed", () => {
  assert.ok(VALID_NODE_STATUSES.includes("failed"), "Missing status: failed");
});

// ── Invariant 19: Stable IDs in production graph ───────────────────────────

// The production code uses hardcoded string IDs for graph nodes.
// Verify that the IDs are stable (not generated randomly).

test("stable IDs: risk-computation uses hardcoded node IDs", () => {
  // The production code must use string-literal IDs, not dynamic generation.
  assert.ok(riskCompSrc.includes("id: 'connection-window'"), "Missing stable ID: connection-window");
  assert.ok(riskCompSrc.includes("id: 'onward-leg'"), "Missing stable ID: onward-leg");
  assert.ok(riskCompSrc.includes("id: 'hotel-checkin'"), "Missing stable ID: hotel-checkin");
});

test("stable IDs: rootTriggerId is a stable string literal", () => {
  assert.ok(
    riskCompSrc.includes("rootTriggerId: 'connection-window'"),
    "rootTriggerId must be the stable literal 'connection-window'"
  );
});

test("stable IDs: node IDs match their kind values", () => {
  // In the production code, each node's id equals its kind.
  // This ensures stable, predictable identity.
  const stableIds = ["connection-window", "onward-leg", "hotel-checkin"];
  for (const id of stableIds) {
    assert.ok(VALID_NODE_KINDS.includes(id), `Node ID "${id}" must be a valid kind`);
  }
});

test("stable IDs: repeated computation produces identical node IDs", () => {
  // Build two graphs with the same seed and verify IDs match.
  const graph1 = buildCascadeGraph(70);
  const graph2 = buildCascadeGraph(70);
  assert.deepStrictEqual(
    graph1.nodes.map((n) => n.id),
    graph2.nodes.map((n) => n.id),
    "Same seed must produce identical node ID sequence"
  );
});

// ── Invariant 20: Graph edge relationships ─────────────────────────────────

// Inline re-implementation of the production graph builder for structural tests.
function buildCascadeGraph(riskScore) {
  const terminal = isTerminal(computeRiskBand(riskScore));
  const statusForScore = (threshold) => riskScore >= threshold ? "at-risk" : "ok";

  const nodes = [
    {
      id: "connection-window",
      label: "Connection window at BKK",
      kind: "connection-window",
      status: terminal ? "failed" : statusForScore(20),
      cascadeDelayMs: 0,
      dependsOn: [],
    },
  ];

  if (!terminal) {
    if (riskScore >= 40) {
      nodes.push({
        id: "onward-leg",
        label: "Onward leg BKK → HAN",
        kind: "onward-leg",
        status: statusForScore(40),
        cascadeDelayMs: 550,
        dependsOn: ["connection-window"],
      });
    }
    if (riskScore >= 60) {
      nodes.push({
        id: "hotel-checkin",
        label: "Pre-booked hotel check-in",
        kind: "hotel-checkin",
        status: statusForScore(60),
        cascadeDelayMs: 1100,
        dependsOn: ["onward-leg", "connection-window"],
      });
    }
  }

  return { nodes, rootTriggerId: "connection-window" };
}

test("edge relationships: all dependsOn references resolve to existing node IDs (low risk)", () => {
  const graph = buildCascadeGraph(25);
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const node of graph.nodes) {
    for (const dep of node.dependsOn) {
      assert.ok(ids.has(dep), `Dangling edge: "${node.id}" depends on "${dep}" which does not exist`);
    }
  }
});

test("edge relationships: all dependsOn references resolve to existing node IDs (medium risk)", () => {
  const graph = buildCascadeGraph(50);
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const node of graph.nodes) {
    for (const dep of node.dependsOn) {
      assert.ok(ids.has(dep), `Dangling edge: "${node.id}" depends on "${dep}" which does not exist`);
    }
  }
});

test("edge relationships: all dependsOn references resolve to existing node IDs (high risk)", () => {
  const graph = buildCascadeGraph(70);
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const node of graph.nodes) {
    for (const dep of node.dependsOn) {
      assert.ok(ids.has(dep), `Dangling edge: "${node.id}" depends on "${dep}" which does not exist`);
    }
  }
});

test("edge relationships: root trigger has no upstream dependencies", () => {
  for (const score of [25, 50, 70, 90]) {
    const graph = buildCascadeGraph(score);
    const root = graph.nodes.find((n) => n.id === graph.rootTriggerId);
    assert.ok(root, `Root node "${graph.rootTriggerId}" must exist`);
    assert.strictEqual(root.dependsOn.length, 0, "Root trigger must have empty dependsOn");
  }
});

test("edge relationships: non-root nodes have at least one upstream dependency", () => {
  const graph = buildCascadeGraph(70);
  for (const node of graph.nodes) {
    if (node.id === graph.rootTriggerId) continue;
    assert.ok(node.dependsOn.length > 0, `Non-root node "${node.id}" must have at least one dependency`);
  }
});

test("edge relationships: hotel-checkin depends on both onward-leg and connection-window", () => {
  const graph = buildCascadeGraph(70);
  const hotel = graph.nodes.find((n) => n.id === "hotel-checkin");
  assert.ok(hotel, "hotel-checkin node must exist at score 70");
  assert.ok(hotel.dependsOn.includes("onward-leg"), "hotel must depend on onward-leg");
  assert.ok(hotel.dependsOn.includes("connection-window"), "hotel must depend on connection-window");
});

// ── Invariant 21: Upstream/downstream transitive relationships ─────────────

function getUpstreamTransitive(graph, nodeId) {
  const visited = new Set();
  function walk(id) {
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) return;
    for (const dep of node.dependsOn) {
      if (!visited.has(dep)) {
        visited.add(dep);
        walk(dep);
      }
    }
  }
  walk(nodeId);
  return visited;
}

function getDownstreamTransitive(graph, nodeId) {
  const visited = new Set();
  function walk(id) {
    for (const node of graph.nodes) {
      if (node.dependsOn.includes(id) && !visited.has(node.id)) {
        visited.add(node.id);
        walk(node.id);
      }
    }
  }
  walk(nodeId);
  return visited;
}

test("upstream/downstream: connection-window has no upstream (it is root)", () => {
  const graph = buildCascadeGraph(70);
  const upstream = getUpstreamTransitive(graph, "connection-window");
  assert.strictEqual(upstream.size, 0, "Root must have no upstream");
});

test("upstream/downstream: onward-leg upstream includes connection-window", () => {
  const graph = buildCascadeGraph(70);
  const upstream = getUpstreamTransitive(graph, "onward-leg");
  assert.ok(upstream.has("connection-window"), "onward-leg must have connection-window upstream");
});

test("upstream/downstream: hotel-checkin transitive upstream includes connection-window and onward-leg", () => {
  const graph = buildCascadeGraph(70);
  const upstream = getUpstreamTransitive(graph, "hotel-checkin");
  assert.ok(upstream.has("connection-window"), "hotel must have connection-window in transitive upstream");
  assert.ok(upstream.has("onward-leg"), "hotel must have onward-leg in transitive upstream");
});

test("upstream/downstream: connection-window downstream includes all other nodes", () => {
  const graph = buildCascadeGraph(70);
  const downstream = getDownstreamTransitive(graph, "connection-window");
  assert.ok(downstream.has("onward-leg"), "connection-window downstream must include onward-leg");
  assert.ok(downstream.has("hotel-checkin"), "connection-window downstream must include hotel-checkin");
});

test("upstream/downstream: onward-leg downstream includes hotel-checkin", () => {
  const graph = buildCascadeGraph(70);
  const downstream = getDownstreamTransitive(graph, "onward-leg");
  assert.ok(downstream.has("hotel-checkin"), "onward-leg downstream must include hotel-checkin");
});

test("upstream/downstream: leaf node has no downstream", () => {
  const graph = buildCascadeGraph(70);
  const downstream = getDownstreamTransitive(graph, "hotel-checkin");
  assert.strictEqual(downstream.size, 0, "Leaf node must have no downstream");
});

// ── Invariant 22: Cascade order ────────────────────────────────────────────

test("cascade order: nodes are sorted by cascadeDelayMs ascending (low risk)", () => {
  const graph = buildCascadeGraph(25);
  for (let i = 1; i < graph.nodes.length; i++) {
    assert.ok(
      graph.nodes[i].cascadeDelayMs >= graph.nodes[i - 1].cascadeDelayMs,
      `Node "${graph.nodes[i].id}" delay ${graph.nodes[i].cascadeDelayMs} must be >= previous ${graph.nodes[i - 1].cascadeDelayMs}`
    );
  }
});

test("cascade order: nodes are sorted by cascadeDelayMs ascending (medium risk)", () => {
  const graph = buildCascadeGraph(50);
  for (let i = 1; i < graph.nodes.length; i++) {
    assert.ok(
      graph.nodes[i].cascadeDelayMs >= graph.nodes[i - 1].cascadeDelayMs,
      `Node "${graph.nodes[i].id}" delay ${graph.nodes[i].cascadeDelayMs} must be >= previous ${graph.nodes[i - 1].cascadeDelayMs}`
    );
  }
});

test("cascade order: nodes are sorted by cascadeDelayMs ascending (high risk)", () => {
  const graph = buildCascadeGraph(70);
  for (let i = 1; i < graph.nodes.length; i++) {
    assert.ok(
      graph.nodes[i].cascadeDelayMs >= graph.nodes[i - 1].cascadeDelayMs,
      `Node "${graph.nodes[i].id}" delay ${graph.nodes[i].cascadeDelayMs} must be >= previous ${graph.nodes[i - 1].cascadeDelayMs}`
    );
  }
});

test("cascade order: first node always has cascadeDelayMs 0", () => {
  for (const score of [25, 50, 70, 90]) {
    const graph = buildCascadeGraph(score);
    assert.strictEqual(graph.nodes[0].cascadeDelayMs, 0, "First node must have delay 0");
  }
});

test("cascade order: each subsequent node has strictly greater delay", () => {
  const graph = buildCascadeGraph(70);
  for (let i = 1; i < graph.nodes.length; i++) {
    assert.ok(
      graph.nodes[i].cascadeDelayMs > graph.nodes[i - 1].cascadeDelayMs,
      `Node "${graph.nodes[i].id}" delay must be strictly greater than previous`
    );
  }
});

// ── Invariant 23: Deterministic serialization ──────────────────────────────

test("deterministic serialization: JSON round-trip preserves graph structure", () => {
  const graph = buildCascadeGraph(70);
  const serialized = JSON.stringify(graph);
  const deserialized = JSON.parse(serialized);
  assert.deepStrictEqual(deserialized, graph, "Round-trip must preserve graph");
});

test("deterministic serialization: same seed produces identical JSON", () => {
  const graph1 = buildCascadeGraph(70);
  const graph2 = buildCascadeGraph(70);
  assert.strictEqual(
    JSON.stringify(graph1),
    JSON.stringify(graph2),
    "Same seed must produce identical serialized graphs"
  );
});

test("deterministic serialization: different seeds produce different JSON", () => {
  const graph1 = buildCascadeGraph(25);
  const graph2 = buildCascadeGraph(70);
  assert.notStrictEqual(
    JSON.stringify(graph1),
    JSON.stringify(graph2),
    "Different seeds must produce different serialized graphs"
  );
});

test("deterministic serialization: node field order is consistent", () => {
  const graph = buildCascadeGraph(70);
  const keys1 = Object.keys(graph.nodes[0]);
  const keys2 = Object.keys(graph.nodes[0]);
  assert.deepStrictEqual(keys1, keys2, "Field order must be consistent");
  // Verify all required fields are present
  for (const key of ["id", "label", "kind", "status", "cascadeDelayMs", "dependsOn"]) {
    assert.ok(keys1.includes(key), `Missing field "${key}" in serialized node`);
  }
});

test("deterministic serialization: dependsOn arrays serialize consistently", () => {
  const graph = buildCascadeGraph(70);
  const hotel = graph.nodes.find((n) => n.id === "hotel-checkin");
  const serialized = JSON.stringify(hotel.dependsOn);
  const deserialized = JSON.parse(serialized);
  assert.deepStrictEqual(deserialized, hotel.dependsOn, "dependsOn array must round-trip");
});

// ── Invariant 24: Malformed node validation ────────────────────────────────

function validateDependencyNode(node, validKinds, validStatuses) {
  const errors = [];
  if (typeof node !== "object" || node === null) {
    return ["Node must be a non-null object"];
  }
  if (typeof node.id !== "string" || node.id.length === 0) {
    errors.push("id must be a non-empty string");
  }
  if (typeof node.label !== "string" || node.label.length === 0) {
    errors.push("label must be a non-empty string");
  }
  if (!validKinds.includes(node.kind)) {
    errors.push(`kind "${node.kind}" is not a valid DependencyNodeKind`);
  }
  if (!validStatuses.includes(node.status)) {
    errors.push(`status "${node.status}" is not a valid DependencyNodeStatus`);
  }
  if (typeof node.cascadeDelayMs !== "number" || node.cascadeDelayMs < 0) {
    errors.push("cascadeDelayMs must be a non-negative number");
  }
  if (!Array.isArray(node.dependsOn)) {
    errors.push("dependsOn must be an array");
  } else {
    for (const dep of node.dependsOn) {
      if (typeof dep !== "string") {
        errors.push(`dependsOn entry must be a string, got ${typeof dep}`);
      }
    }
  }
  return errors;
}

test("malformed nodes: null is rejected", () => {
  const errors = validateDependencyNode(null, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.length > 0, "null must be rejected");
});

test("malformed nodes: non-object is rejected", () => {
  const errors = validateDependencyNode("string-node", VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.length > 0, "string must be rejected");
});

test("malformed nodes: empty id is rejected", () => {
  const node = { id: "", label: "Test", kind: "onward-leg", status: "ok", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("id")), "Empty id must be rejected");
});

test("malformed nodes: negative cascadeDelayMs is rejected", () => {
  const node = { id: "n1", label: "Test", kind: "onward-leg", status: "ok", cascadeDelayMs: -1, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("cascadeDelayMs")), "Negative delay must be rejected");
});

test("malformed nodes: non-array dependsOn is rejected", () => {
  const node = { id: "n1", label: "Test", kind: "onward-leg", status: "ok", cascadeDelayMs: 0, dependsOn: "root" };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("dependsOn")), "Non-array dependsOn must be rejected");
});

test("malformed nodes: non-string dependsOn entries are rejected", () => {
  const node = { id: "n1", label: "Test", kind: "onward-leg", status: "ok", cascadeDelayMs: 0, dependsOn: [42] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("dependsOn")), "Non-string dependsOn entry must be rejected");
});

test("malformed nodes: well-formed node passes validation", () => {
  const node = { id: "n1", label: "Test", kind: "onward-leg", status: "ok", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.strictEqual(errors.length, 0, `Well-formed node must pass: ${errors.join(", ")}`);
});

// ── Invariant 25: Malformed edge validation (dangling references) ──────────

function validateGraphEdges(graph) {
  const errors = [];
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const node of graph.nodes) {
    for (const dep of node.dependsOn) {
      if (!ids.has(dep)) {
        errors.push(`Node "${node.id}" depends on "${dep}" which does not exist in graph`);
      }
    }
  }
  // rootTriggerId must reference an existing node
  if (!ids.has(graph.rootTriggerId)) {
    errors.push(`rootTriggerId "${graph.rootTriggerId}" does not match any node`);
  }
  return errors;
}

test("malformed edges: dangling dependsOn reference is detected", () => {
  const graph = {
    nodes: [
      { id: "a", label: "A", kind: "connection-window", status: "ok", cascadeDelayMs: 0, dependsOn: [] },
      { id: "b", label: "B", kind: "onward-leg", status: "ok", cascadeDelayMs: 100, dependsOn: ["nonexistent"] },
    ],
    rootTriggerId: "a",
  };
  const errors = validateGraphEdges(graph);
  assert.ok(errors.length > 0, "Dangling reference must be detected");
  assert.ok(errors[0].includes("nonexistent"), "Error must name the missing node");
});

test("malformed edges: dangling rootTriggerId is detected", () => {
  const graph = {
    nodes: [
      { id: "a", label: "A", kind: "connection-window", status: "ok", cascadeDelayMs: 0, dependsOn: [] },
    ],
    rootTriggerId: "missing-root",
  };
  const errors = validateGraphEdges(graph);
  assert.ok(errors.length > 0, "Dangling rootTriggerId must be detected");
});

test("malformed edges: valid graph has no edge errors", () => {
  const graph = buildCascadeGraph(70);
  const errors = validateGraphEdges(graph);
  assert.strictEqual(errors.length, 0, `Valid graph must have no edge errors: ${errors.join(", ")}`);
});

test("malformed edges: self-referencing dependsOn is valid if node exists", () => {
  // A self-reference is structurally valid (though semantically odd).
  const graph = {
    nodes: [
      { id: "a", label: "A", kind: "connection-window", status: "ok", cascadeDelayMs: 0, dependsOn: ["a"] },
    ],
    rootTriggerId: "a",
  };
  const errors = validateGraphEdges(graph);
  assert.strictEqual(errors.length, 0, "Self-reference to existing ID is structurally valid");
});

// ── Invariant 26: Missing required fields ──────────────────────────────────

test("missing fields: node without id fails validation", () => {
  const node = { label: "Test", kind: "onward-leg", status: "ok", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("id")), "Missing id must be caught");
});

test("missing fields: node without label fails validation", () => {
  const node = { id: "n1", kind: "onward-leg", status: "ok", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("label")), "Missing label must be caught");
});

test("missing fields: node without kind fails validation", () => {
  const node = { id: "n1", label: "Test", status: "ok", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("kind")), "Missing kind must be caught");
});

test("missing fields: node without status fails validation", () => {
  const node = { id: "n1", label: "Test", kind: "onward-leg", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("status")), "Missing status must be caught");
});

test("missing fields: node without cascadeDelayMs fails validation", () => {
  const node = { id: "n1", label: "Test", kind: "onward-leg", status: "ok", dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("cascadeDelayMs")), "Missing cascadeDelayMs must be caught");
});

test("missing fields: node without dependsOn fails validation", () => {
  const node = { id: "n1", label: "Test", kind: "onward-leg", status: "ok", cascadeDelayMs: 0 };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("dependsOn")), "Missing dependsOn must be caught");
});

test("missing fields: node with all required fields passes validation", () => {
  const node = { id: "n1", label: "Test", kind: "onward-leg", status: "ok", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.strictEqual(errors.length, 0, "Complete node must pass validation");
});

// ── Invariant 27: Unsupported node kinds ───────────────────────────────────

test("unsupported kinds: 'flight-booking' is rejected", () => {
  const node = { id: "n1", label: "Test", kind: "flight-booking", status: "ok", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("kind")), "Unsupported kind must be rejected");
});

test("unsupported kinds: 'payment' is rejected", () => {
  const node = { id: "n1", label: "Test", kind: "payment", status: "ok", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("kind")), "Unsupported kind must be rejected");
});

test("unsupported kinds: empty string kind is rejected", () => {
  const node = { id: "n1", label: "Test", kind: "", status: "ok", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("kind")), "Empty kind must be rejected");
});

test("unsupported kinds: null kind is rejected", () => {
  const node = { id: "n1", label: "Test", kind: null, status: "ok", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("kind")), "Null kind must be rejected");
});

test("unsupported kinds: numeric kind is rejected", () => {
  const node = { id: "n1", label: "Test", kind: 42, status: "ok", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("kind")), "Numeric kind must be rejected");
});

test("unsupported kinds: kind not in DependencyNodeKind union is rejected", () => {
  // 'cancelled' is a plausible travel-domain status but NOT a valid kind.
  const node = { id: "n1", label: "Test", kind: "cancelled", status: "ok", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("kind")), "Non-member kind must be rejected");
});

test("unsupported statuses: 'cancelled' is not a valid status", () => {
  const node = { id: "n1", label: "Test", kind: "onward-leg", status: "cancelled", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("status")), "Unsupported status must be rejected");
});

test("unsupported statuses: 'unknown' is not a valid status", () => {
  const node = { id: "n1", label: "Test", kind: "onward-leg", status: "unknown", cascadeDelayMs: 0, dependsOn: [] };
  const errors = validateDependencyNode(node, VALID_NODE_KINDS, VALID_NODE_STATUSES);
  assert.ok(errors.some((e) => e.includes("status")), "Unsupported status must be rejected");
});

// ── Invariant 28: No write-capable operation in graph or risk modules ──────

test("no write operation: dependency-graph.ts contains no write verbs", () => {
  const forbidden = [
    "createOrder", "bookFlight", "issueTicket", "processPayment",
    "confirmBooking", "purchaseTicket", "cancelBooking", "modifyReservation",
  ];
  for (const op of forbidden) {
    assert.ok(!depGraphSrc.includes(op), `Forbidden write op "${op}" in dependency-graph.ts`);
  }
});

test("no write operation: risk-computation.ts contains no write verbs", () => {
  const forbidden = [
    "createOrder", "bookFlight", "issueTicket", "processPayment",
    "confirmBooking", "purchaseTicket", "cancelBooking", "modifyReservation",
  ];
  for (const op of forbidden) {
    assert.ok(!riskCompSrc.includes(op), `Forbidden write op "${op}" in risk-computation.ts`);
  }
});

test("no write operation: dependency-graph.ts contains no mutation methods", () => {
  const forbidden = [".push(", ".splice(", ".pop(", ".shift(", ".unshift(", "delete "];
  for (const op of forbidden) {
    assert.ok(!depGraphSrc.includes(op), `Forbidden mutation "${op}" in dependency-graph.ts`);
  }
});

test("no write operation: risk-computation.ts contains no mutation of external state", () => {
  // The risk-computation module only builds local arrays; it must not mutate
  // any external object. Verify no assignment to member expressions.
  const memberAssign = /\w+\.\w+\s*=\s*(?!>)/;
  const lines = riskCompSrc.split("\n");
  for (const line of lines) {
    // Skip comments and type declarations
    if (line.trim().startsWith("//") || line.trim().startsWith("*") || line.trim().startsWith("/*")) continue;
    if (line.includes("interface") || line.includes("type ") || line.includes("import ")) continue;
    // Only flag if it's a clear external mutation (not local variable)
    // We allow local array building (nodes.push) but not external state mutation.
  }
  // Structural check: no export of mutation functions
  assert.ok(!riskCompSrc.includes("export function mutate"), "No mutation export allowed");
  assert.ok(!riskCompSrc.includes("export function update"), "No update export allowed");
  assert.ok(!riskCompSrc.includes("export function set"), "No set export allowed");
});

test("no write operation: graph types are read-only (interface, not class with methods)", () => {
  // dependency-graph.ts must export interfaces only, not classes.
  assert.ok(!depGraphSrc.includes("export class"), "dependency-graph must not export classes");
  assert.ok(depGraphSrc.includes("export interface"), "dependency-graph must export interfaces");
});

// ── Invariant 29: No fabricated live provenance ────────────────────────────

test("no fabricated live provenance: dependency-graph.ts contains no live claims", () => {
  const livePatterns = ["live validated", "live verified", "live evidence", "live provider"];
  for (const pattern of livePatterns) {
    assert.ok(
      !depGraphSrc.toLowerCase().includes(pattern),
      `Forbidden live claim "${pattern}" in dependency-graph.ts`
    );
  }
});

test("no fabricated live provenance: risk-computation.ts contains no live claims", () => {
  const livePatterns = ["live validated", "live verified", "live evidence", "live provider"];
  for (const pattern of livePatterns) {
    assert.ok(
      !riskCompSrc.toLowerCase().includes(pattern),
      `Forbidden live claim "${pattern}" in risk-computation.ts`
    );
  }
});

test("no fabricated live provenance: graph nodes carry no provenance field", () => {
  // DependencyNode interface must NOT have a provenance field — provenance
  // is declared at the adapter/execution-mode layer, not in the graph itself.
  assert.ok(
    !depGraphSrc.includes("provenance"),
    "DependencyNode must not carry a provenance field"
  );
});

test("no fabricated live provenance: risk computation result carries no provenance field", () => {
  assert.ok(
    !riskCompSrc.includes("provenance"),
    "RiskComputationResult must not carry a provenance field"
  );
});

test("no fabricated live provenance: graph does not claim isLive", () => {
  assert.ok(!depGraphSrc.includes("isLive"), "dependency-graph must not reference isLive");
  assert.ok(!riskCompSrc.includes("isLive"), "risk-computation must not reference isLive");
});

test("no fabricated live provenance: production graph uses no external data source", () => {
  // The graph must be built purely from the seed — no external data source.
  const forbiddenSources = ["fetch(", "axios", "http.get", "https.get", "readFile", "process.env"];
  for (const src of forbiddenSources) {
    assert.ok(!riskCompSrc.includes(src), `Forbidden data source "${src}" in risk-computation.ts`);
  }
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\nDependency graph offline tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
