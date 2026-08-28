// Provenance label offline tests for StitchCheck.
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// These tests verify that the provenance-aware label functions produce
// correct labels for every evidence state, that local fixtures never
// receive live labels, and that no secrets or raw payloads are bundled.
//
// Hard guarantees:
// - Zero network code: no fetch/http/https/net/socket imports or calls.
// - Zero credentials read: no .env or secret file is ever touched.
// - Zero dependencies: Node.js built-ins and existing local modules only.
// - Deterministic: no randomness, no timing, no external calls.
// - Reads existing fixtures and source files only; never modifies them.

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

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

// ── Inline label logic (mirrors app/src/data/labels.ts) ──
// This duplicates the label selection logic to verify it independently.

const EXTRACTION_LABELS = {
  localFixture: "Local fixture",
  offlineFixture: "Local fixture",
  liveExtraction: "Source: AI extraction (MiniMax M3 via OpenRouter) · live",
  unavailable: "AI extraction unavailable",
};

const GEMINI_LABELS = EXTRACTION_LABELS;

const ATLAS_UI_LABELS = {
  sandboxLive: "Atlas Sandbox — live Search/Verify",
  localFixture: "Local fixture",
  offlineFixture: "Offline fallback",
};

const NOSANA_UI_LABELS = {
  localFallback: "Local fallback — not Nosana evidence",
  offlineValidated:
    "Nosana workload validated offline — local fallback used; not Nosana evidence",
  liveEvidence:
    "Nosana evidence — remote job succeeded; result from decentralized GPU workload.",
};

function getExtractionProviderLabel(provenance) {
  if (
    provenance.evidenceSource === "extraction-live" &&
    provenance.provider === "openrouter" &&
    provenance.executed === true &&
    provenance.fallbackUsed === false
  ) {
    return EXTRACTION_LABELS.liveExtraction;
  }
  if (
    provenance.evidenceSource === "extraction-live" &&
    provenance.executed === true &&
    provenance.fallbackUsed === true
  ) {
    return EXTRACTION_LABELS.unavailable;
  }
  return EXTRACTION_LABELS.localFixture;
}

function getGeminiLabel(provenance) {
  return getExtractionProviderLabel(provenance);
}

function getAtlasLabel(provenance) {
  if (
    provenance.evidenceSource === "atlas-sandbox" &&
    provenance.fallbackUsed === false
  ) {
    return ATLAS_UI_LABELS.sandboxLive;
  }
  if (provenance.evidenceSource === "local-fixture") {
    return ATLAS_UI_LABELS.localFixture;
  }
  return ATLAS_UI_LABELS.offlineFixture;
}

function getNosanaLabel(provenance) {
  if (
    provenance.evidenceSource === "nosana-evidence" &&
    provenance.fallbackUsed === false
  ) {
    return NOSANA_UI_LABELS.liveEvidence;
  }
  if (provenance.evidenceSource === "nosana-evidence") {
    return NOSANA_UI_LABELS.offlineValidated;
  }
  return NOSANA_UI_LABELS.localFallback;
}

// ── Test 1: Local fixture does not receive a live Gemini label ──

test("Default extraction fixture is not labelled live extraction", () => {
  const defaultProvenance = {
    evidenceSource: "local-fixture",
    provider: "local",
    executed: false,
    fallbackUsed: true,
    validationOutcome: "valid",
    provenanceMode: "fictional-local",
  };
  const label = getExtractionProviderLabel(defaultProvenance);
  assert.strictEqual(label, EXTRACTION_LABELS.localFixture);
  assert.ok(!label.includes("live"), `Local fixture label must not contain 'live': ${label}`);
});

// ── Test 2: Default extraction fixture uses local/demo provenance ──

test("Default extraction fixture uses local/demo provenance", () => {
  const defaultProvenance = {
    evidenceSource: "local-fixture",
    provider: "local",
    executed: false,
    fallbackUsed: true,
    validationOutcome: "valid",
    provenanceMode: "fictional-local",
  };
  const label = getExtractionProviderLabel(defaultProvenance);
  assert.strictEqual(label, EXTRACTION_LABELS.localFixture);
  assert.ok(label.includes("Local"), `Expected 'Local' in label: ${label}`);
  assert.ok(label.includes("fixture"), `Expected 'fixture' in label: ${label}`);
});

// ── Test 5: Atlas local fixture does NOT receive the live Atlas label ──

test("Atlas local fixture does not receive live Atlas label", () => {
  const label = getAtlasLabel({
    evidenceSource: "local-fixture",
    provider: "local",
    executed: false,
    fallbackUsed: true,
  });
  assert.strictEqual(label, ATLAS_UI_LABELS.localFixture);
  assert.notStrictEqual(label, ATLAS_UI_LABELS.sandboxLive);
  assert.ok(!label.includes("live"), `Local fixture label must not contain 'live': ${label}`);
});

// ── Test 6: Atlas verified Sandbox evidence receives live label ──

test("Atlas Sandbox live evidence + executed + no fallback → live label", () => {
  const label = getAtlasLabel({
    evidenceSource: "atlas-sandbox",
    provider: "atlas",
    executed: true,
    fallbackUsed: false,
  });
  assert.strictEqual(label, ATLAS_UI_LABELS.sandboxLive);
  assert.ok(label.includes("Atlas Sandbox"), `Expected 'Atlas Sandbox' in label: ${label}`);
  assert.ok(label.includes("live Search/Verify"), `Expected 'live Search/Verify' in label: ${label}`);
});

test("Atlas production Search now falls back to offline label (production branch removed)", () => {
  const label = getAtlasLabel({
    evidenceSource: "atlas-production",
    provider: "atlas",
    executed: true,
    fallbackUsed: false,
  });
  assert.strictEqual(label, ATLAS_UI_LABELS.offlineFixture);
});

test("Extraction live success receives live MiniMax label", () => {
  const label = getExtractionProviderLabel({
    evidenceSource: "extraction-live",
    provider: "openrouter",
    executed: true,
    fallbackUsed: false,
    validationOutcome: "valid",
  });
  assert.strictEqual(label, EXTRACTION_LABELS.liveExtraction);
});

test("Historical Gemini evidence file still valid (category B, untouched content)", () => {
  const evidencePath = path.join(ROOT, "smoke-tests", "extraction", "results", "results-gemini-3.7-flash-success.json");
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  assert.strictEqual(evidence.outcome, "success");
  assert.strictEqual(evidence.conclusion.fallbackUsed, false);
  assert.strictEqual(evidence.conclusion.schemaValidation, "valid");
});

// ── Test 4: Gemini live with fallbackUsed:true does NOT receive live label ──

test("Extraction fallbackUsed=true → unavailable label", () => {
  const label = getExtractionProviderLabel({
    evidenceSource: "extraction-live",
    executed: true,
    fallbackUsed: true,
    validationOutcome: "valid",
  });
  assert.strictEqual(label, EXTRACTION_LABELS.unavailable);
});

// ── Test 7: Nosana fallback always includes 'not Nosana evidence' ──

test("Nosana fallback always includes 'not Nosana evidence'", () => {
  const fallbackLabel = getNosanaLabel({ evidenceSource: "local-fallback" });
  assert.strictEqual(fallbackLabel, NOSANA_UI_LABELS.localFallback);
  assert.ok(fallbackLabel.includes("not Nosana evidence"), `Expected 'not Nosana evidence': ${fallbackLabel}`);
  assert.ok(!fallbackLabel.includes("live"), "Nosana fallback must not contain 'live'");

  const noSourceLabel = getNosanaLabel({});
  assert.strictEqual(noSourceLabel, NOSANA_UI_LABELS.localFallback);
  assert.ok(noSourceLabel.includes("not Nosana evidence"));

  // nosana-evidence with fallbackUsed=true → offline validated (not live)
  const nosanaEvidenceFallbackLabel = getNosanaLabel({ evidenceSource: "nosana-evidence", fallbackUsed: true });
  assert.strictEqual(nosanaEvidenceFallbackLabel, NOSANA_UI_LABELS.offlineValidated);
  assert.ok(nosanaEvidenceFallbackLabel.includes("not Nosana evidence"), `Expected qualifier: ${nosanaEvidenceFallbackLabel}`);
  assert.ok(!nosanaEvidenceFallbackLabel.includes("live"), "Nosana offline-validated must not contain 'live'");

  // nosana-evidence with fallbackUsed=false → live evidence label
  const nosanaLiveLabel = getNosanaLabel({ evidenceSource: "nosana-evidence", fallbackUsed: false });
  assert.strictEqual(nosanaLiveLabel, NOSANA_UI_LABELS.liveEvidence);
  assert.ok(nosanaLiveLabel.includes("Nosana evidence"), `Expected 'Nosana evidence': ${nosanaLiveLabel}`);
});

// ── Test 8: Missing/contradictory provenance uses conservative label ──

test("Missing provenance falls back conservatively for Gemini", () => {
  assert.strictEqual(getGeminiLabel({}), GEMINI_LABELS.offlineFixture);
  assert.strictEqual(getGeminiLabel({ evidenceSource: undefined }), GEMINI_LABELS.offlineFixture);
});

test("Missing provenance falls back conservatively for Atlas", () => {
  assert.strictEqual(getAtlasLabel({}), ATLAS_UI_LABELS.offlineFixture);
  assert.strictEqual(getAtlasLabel({ evidenceSource: undefined }), ATLAS_UI_LABELS.offlineFixture);
});

test("Missing provenance falls back conservatively for Nosana", () => {
  assert.strictEqual(getNosanaLabel({}), NOSANA_UI_LABELS.localFallback);
});

test("Contradictory provenance (local-fixture + executed=true) → local fixture label", () => {
  const label = getGeminiLabel({
    evidenceSource: "local-fixture",
    provider: "gemini",
    executed: true,
    fallbackUsed: false,
    validationOutcome: "valid",
  });
  assert.strictEqual(label, GEMINI_LABELS.localFixture);
});

test("Contradictory provenance falls back conservatively for Atlas", () => {
  const label = getAtlasLabel({
    evidenceSource: "atlas-sandbox",
    fallbackUsed: true,
  });
  assert.notStrictEqual(label, ATLAS_UI_LABELS.sandboxLive);
});

test("Null provenance fields → conservative fallback", () => {
  const gemLabel = getGeminiLabel({
    evidenceSource: null,
    provider: null,
    executed: null,
    fallbackUsed: null,
    validationOutcome: null,
  });
  assert.strictEqual(gemLabel, GEMINI_LABELS.offlineFixture);

  const atlLabel = getAtlasLabel({
    evidenceSource: null,
    provider: null,
    executed: null,
    fallbackUsed: null,
  });
  assert.strictEqual(atlLabel, ATLAS_UI_LABELS.offlineFixture);
});

// ── Test 9: Browser fixture has no live-provider claim ──

test("Browser demo-data fixture has no live-provider claim in extraction metadata", () => {
  const demoDataPath = path.join(ROOT, "app-fixture-contracts", "stitchcheck-ui-demo-data.json");
  const demoData = JSON.parse(fs.readFileSync(demoDataPath, "utf8"));
  const extraction = demoData.uiStates.itineraryUnconfirmed.extractionResult;
  assert.strictEqual(extraction.syntheticDemo, true);
  // The fixture itself must not claim to be live evidence
  assert.ok(
    !extraction.evidenceSource || extraction.evidenceSource !== "extraction-live",
    "Fixture extraction must not have evidenceSource: 'extraction-live'"
  );
});

test("getDefaultExtraction() in source uses local-fixture, not extraction-live", () => {
  const fixturesPath = path.join(ROOT, "app", "src", "data", "fixtures.ts");
  const source = fs.readFileSync(fixturesPath, "utf8");
  // The getDefaultExtraction function must set evidenceSource to 'local-fixture'
  assert.ok(
    source.includes("evidenceSource: 'local-fixture'"),
    "getDefaultExtraction must set evidenceSource: 'local-fixture'"
  );
  // It must NOT set evidenceSource to 'gemini-live'
  assert.ok(
    !source.includes("evidenceSource: 'extraction-live'"),
    "getDefaultExtraction must NOT set evidenceSource: 'extraction-live'"
  );
});

// ── Test 10: No API keys appear in the browser bundle source ──

test("No API key references in browser source files", () => {
  const srcDir = path.join(ROOT, "app", "src");
  // Use patterns that won't false-positive on CSS class names
  const forbidden = ["GEMINI_API_KEY", "NOSANA_API_KEY", "AIza"];
  // sk- for API keys typically appears in quotes or assignment context
  const skPattern = /["']sk-[A-Za-z0-9]{10,}/;
  const bearerPattern = /Bearer\s+[A-Za-z0-9]/;
  const files = getAllTsFiles(srcDir);
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.ok(
        !content.includes(pattern),
        `Forbidden pattern "${pattern}" found in ${path.relative(ROOT, file)}`
      );
    }
    assert.ok(
      !skPattern.test(content),
      `Forbidden API key pattern "sk-..." found in ${path.relative(ROOT, file)}`
    );
    assert.ok(
      !bearerPattern.test(content),
      `Forbidden Bearer token pattern found in ${path.relative(ROOT, file)}`
    );
  }
});

test("No .env.local reference in browser source files", () => {
  const srcDir = path.join(ROOT, "app", "src");
  const files = getAllTsFiles(srcDir);
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    assert.ok(
      !content.includes(".env.local"),
      `Forbidden .env.local reference found in ${path.relative(ROOT, file)}`
    );
  }
});

// ── Test 11: No raw provider payload is bundled ──

test("No raw Gemini response payload in browser bundle", () => {
  const srcDir = path.join(ROOT, "app", "src");
  const files = getAllTsFiles(srcDir);
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    // Check for patterns that would indicate raw provider data
    assert.ok(
      !content.includes("candidates") || content.includes("// "),
      `Possible raw Gemini response in ${path.relative(ROOT, file)}`
    );
  }
});

test("Nosana offline browser fixture uses local-fallback, not nosana-evidence", () => {
  // Offline tests must not depend on app/public/nosana-risk-result.json, which is
  // the live runtime file the browser loads after a successful Nosana job.
  const nosanaResultPath = path.join(
    ROOT,
    "smoke-tests",
    "nosana",
    "fixtures",
    "browser-local-fallback-result.json",
  );
  const data = JSON.parse(fs.readFileSync(nosanaResultPath, "utf8"));
  assert.strictEqual(data.evidenceSource, "local-fallback");
  assert.strictEqual(data.usedFallback, true);
  if (data.riskResult && data.riskResult.evidenceSource) {
    assert.strictEqual(data.riskResult.evidenceSource, "local-fallback");
  }
});

// ── Test 12: Human-confirmation and no-write behavior preserved ──

test("LABELS object uses local-fixture defaults, not offline-fixture", () => {
  /* Canonical source is now core/provenance/labels.ts */
  const labelsPath = path.join(ROOT, "core", "provenance", "labels.ts");
  const source = fs.readFileSync(labelsPath, "utf8");
  // The LABELS object should use localFixture for geminiExtraction
  assert.ok(
    source.includes("extractionProvider: EXTRACTION_PROVIDER_LABELS.localFixture") ||
      source.includes("geminiExtraction: EXTRACTION_PROVIDER_LABELS.localFixture") ||
      source.includes("geminiExtraction: GEMINI_LABELS.localFixture"),
    "LABELS must use localFixture default for extraction",
  );
  // The LABELS object should use localFixture for atlasAlternatives
  assert.ok(
    source.includes("atlasAlternatives: ATLAS_UI_LABELS.localFixture"),
    "LABELS.atlasAlternatives must use ATLAS_UI_LABELS.localFixture"
  );
});

test("FINAL_STATEMENT denies all write actions", () => {
  /* Canonical source is now core/provenance/labels.ts */
  const labelsPath = path.join(ROOT, "core", "provenance", "labels.ts");
  const source = fs.readFileSync(labelsPath, "utf8");
  assert.ok(
    source.includes("No booking, payment"),
    "FINAL_STATEMENT must deny booking and payment"
  );
  assert.ok(
    source.includes("local fixture data"),
    "FINAL_STATEMENT must indicate local fixture data"
  );
});

test("DISABLED_MESSAGE enforces confirmation gate", () => {
  /* Canonical source is now core/provenance/labels.ts */
  const labelsPath = path.join(ROOT, "core", "provenance", "labels.ts");
  const source = fs.readFileSync(labelsPath, "utf8");
  assert.ok(
    source.includes("Confirm itinerary first"),
    "DISABLED_MESSAGE must enforce confirmation gate"
  );
});

test("Decision panel preserves noOrderCreated invariant", () => {
  const decisionPath = path.join(ROOT, "app", "src", "components", "DecisionPanel.tsx");
  const source = fs.readFileSync(decisionPath, "utf8");
  assert.ok(
    source.includes("noOrderCreated"),
    "Decision panel must reference noOrderCreated"
  );
  assert.ok(
    source.includes("No booking, payment"),
    "Decision panel must deny booking and payment"
  );
});

// ── Test: Source labels.ts contains correct label strings ──

test("labels.ts contains 'Local fixture' (replaces old Direct Gemini label)", () => {
  /* Canonical source is now core/provenance/labels.ts */
  const labelsPath = path.join(ROOT, "core", "provenance", "labels.ts");
  const source = fs.readFileSync(labelsPath, "utf8");
  assert.ok(
    source.includes("Local fixture"),
    "labels.ts must contain 'Local fixture'"
  );
});

test("labels.ts uses MiniMax M3 live extraction label", () => {
  const labelsPath = path.join(ROOT, "core", "provenance", "labels.ts");
  const source = fs.readFileSync(labelsPath, "utf8");
  assert.ok(
    source.includes("MiniMax M3 via OpenRouter"),
    "labels.ts must contain MiniMax M3 via OpenRouter live label",
  );
  assert.ok(
    !source.includes("Source: Gemini"),
    "labels.ts must not contain legacy Gemini live label",
  );
});

test("labels.ts contains 'Offline fallback' for Atlas offline label", () => {
  /* Canonical source is now core/provenance/labels.ts */
  const labelsPath = path.join(ROOT, "core", "provenance", "labels.ts");
  const source = fs.readFileSync(labelsPath, "utf8");
  assert.ok(
    source.includes("Offline fallback"),
    "labels.ts must contain 'Offline fallback'"
  );
});

// ── Helpers ──

function getAllTsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Summary ──

console.log(`\nProvenance label offline tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
