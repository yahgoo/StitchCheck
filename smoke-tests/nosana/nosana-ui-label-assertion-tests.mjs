// nosana-ui-label-assertion-tests.mjs — Offline tests asserting that the UI
// label logic correctly distinguishes live evidence from fallback/offline.
//
// These tests mirror the logic in app/src/components/RiskPanel.tsx:
//   - evidenceSource === "nosana-evidence" → may show "live" label
//   - evidenceSource === "local-fallback" or fallbackUsed === true → must NOT show "live"
//   - evidenceSource === "dry-run" → must NOT show "live"
//
// Zero network, zero credentials, zero dependencies.

// Inline the LABELS constants from app/src/data/labels.ts to avoid
// TypeScript import issues in Node.js ESM.
const LABELS = {
  nosanaRisk:
    'Synthetic local placeholder \u2014 not Nosana evidence',
  nosanaRiskEvidence:
    'Nosana evidence \u2014 remote job succeeded; result from decentralized GPU workload',
  nosanaRiskFallback:
    'Nosana unavailable \u2014 local fallback used; not Nosana evidence',
};

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

// ── Simulate the RiskPanel label-selection logic ────────────────────────────

function getSourceLabel(riskResult) {
  const isNosanaEvidence = riskResult.evidenceSource === "nosana-evidence";
  const isNosanaLive = isNosanaEvidence && !riskResult.fallbackUsed;
  const isLocalFallback = riskResult.evidenceSource === "local-fallback" || riskResult.fallbackUsed;

  if (isNosanaLive) return LABELS.nosanaRiskEvidence;
  if (isNosanaEvidence) return LABELS.nosanaRiskFallback;
  if (isLocalFallback) return LABELS.nosanaRiskFallback;
  return LABELS.nosanaRisk;
}

function labelSaysLive(label) {
  return /nosana evidence/i.test(label) && /remote job succeeded/i.test(label);
}

function labelSaysFallback(label) {
  return /fallback/i.test(label) || /not nosana evidence/i.test(label);
}

// ── Test 1: fallback status must NOT produce a "live" label ────────────────

section("Test 1: fallback/offline status must NOT produce a 'live' label");

const fallbackResults = [
  {
    name: "local-fallback evidenceSource",
    data: { evidenceSource: "local-fallback", fallbackUsed: true, workloadStatus: "completed" },
  },
  {
    name: "fallbackUsed=true with unknown source",
    data: { evidenceSource: "unknown", fallbackUsed: true, workloadStatus: "completed" },
  },
  {
    name: "dry-run evidenceSource",
    data: { evidenceSource: "dry-run", fallbackUsed: true, workloadStatus: "completed" },
  },
  {
    name: "no evidenceSource, fallbackUsed=true",
    data: { fallbackUsed: true, workloadStatus: "completed" },
  },
];

for (const tc of fallbackResults) {
  const label = getSourceLabel(tc.data);
  assert(
    !labelSaysLive(label),
    `${tc.name}: label does NOT say "live" (got: "${label.slice(0, 60)}…")`,
  );
  assert(
    labelSaysFallback(label),
    `${tc.name}: label correctly indicates fallback/placeholder`,
  );
}

// ── Test 2: live_success status MAY produce a "live" label ─────────────────

section("Test 2: nosana-evidence status MAY produce a 'live' label");

const liveResult = {
  evidenceSource: "nosana-evidence",
  fallbackUsed: false,
  workloadStatus: "completed",
};

const liveLabel = getSourceLabel(liveResult);
assert(
  labelSaysLive(liveLabel),
  `nosana-evidence: label says "live" (got: "${liveLabel.slice(0, 60)}…")`,
);
assert(
  !labelSaysFallback(liveLabel),
  `nosana-evidence: label does NOT say "fallback"`,
);

// ── Test 3: LABELS constants have expected content ──────────────────────────

section("Test 3: LABELS constants have expected content");

assert(
  /not nosana evidence/i.test(LABELS.nosanaRiskFallback),
  "nosanaRiskFallback contains 'not Nosana evidence'",
);
assert(
  /nosana evidence/i.test(LABELS.nosanaRiskEvidence),
  "nosanaRiskEvidence contains 'Nosana evidence'",
);
assert(
  /not nosana evidence/i.test(LABELS.nosanaRisk),
  "nosanaRisk (default placeholder) contains 'not Nosana evidence'",
);

// ── Test 4: invariant — fallbackUsed=true NEVER co-occurs with a live label ─

section("Test 4: invariant — fallbackUsed=true NEVER produces a live label");

// Note: The updated UI logic checks evidenceSource === "nosana-evidence"
// AND fallbackUsed === false for the live label. If evidenceSource is
// "nosana-evidence" but fallbackUsed is true, the offline-validated label
// is shown instead. The contradictory case should not occur in real data
// but is handled defensively.
const allCombinations = [
  { evidenceSource: "local-fallback", fallbackUsed: true },
  { evidenceSource: "dry-run", fallbackUsed: true },
  { evidenceSource: "local-fallback", fallbackUsed: false },
  { evidenceSource: "dry-run", fallbackUsed: false },
  { evidenceSource: undefined, fallbackUsed: true },
  { evidenceSource: "nosana-evidence", fallbackUsed: true },
];

for (const combo of allCombinations) {
  const label = getSourceLabel(combo);
  if (combo.fallbackUsed || combo.evidenceSource !== "nosana-evidence") {
    assert(
      !labelSaysLive(label),
      `fallbackUsed=${combo.fallbackUsed}, source=${combo.evidenceSource}: NOT live`,
    );
  }
}

// ── Test 5: only the exact combination evidenceSource="nosana-evidence" +
//            fallbackUsed=false may show "live" ──────────────────────────────

section("Test 5: only nosana-evidence + fallbackUsed=false may show 'live'");

const onlyLiveCombo = { evidenceSource: "nosana-evidence", fallbackUsed: false };
const onlyLiveLabel = getSourceLabel(onlyLiveCombo);
assert(
  labelSaysLive(onlyLiveLabel),
  "nosana-evidence + fallbackUsed=false: label says 'live'",
);

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(72)}`);
console.log(`UI label assertion tests: ${passed} passed, ${failed} failed.`);
console.log(`${"=".repeat(72)}`);

if (failed > 0) {
  process.exitCode = 1;
}
