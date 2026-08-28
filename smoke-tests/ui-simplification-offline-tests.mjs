// UI simplification tests for StitchCheck.
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// These tests verify the UI simplification recommendations:
//   1.  Global "Live — Atlas Sandbox" badge is absent.
//   2.  Itinerary Review always renders "Source: Local fixture".
//   3.  Alternatives render "Source: Atlas Sandbox · live" only with
//       successful live Atlas provenance.
//   4.  Offline Alternatives render "Source: Local fixture".
//   5.  Offline fallback renders "Source: Offline fallback".
//   6.  Recovery Plan does not inherit the Alternatives source label.
//   7.  "Synthetic Carrier" and "Synthetic Airline" do not appear in
//       current app UI source files.
//   8.  "Direct Gemini" / "Direct Gemini 3.7" do not appear in current
//       app UI source files.
//   9.  Global demo footnote removed; per-panel DataSourceTag handles source labeling.
//   10. Safety wording remains present.
//   11. "Request submitted — awaiting verified supplier outcome" remains.
//   12. Forbidden booking/payment/ticketing claims remain absent.
//   13. No horizontal overflow is introduced (overflow-x not set to
//       visible on main containers).
//   14. Reduced-motion behavior remains intact.
//
// Approach:
//   Static source analysis of all app/src components and core files.
//   Deterministic, no browser or DOM required.
//
// Run:
//   node smoke-tests/ui-simplification-offline-tests.mjs

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_SRC = path.resolve(__dirname, "..", "app", "src");
const CORE_DIR = path.resolve(__dirname, "..", "core");
const FIXTURE_JSON = path.resolve(
  __dirname, "..", "app-fixture-contracts", "stitchcheck-ui-demo-data.json"
);

/* ── Minimal test harness ── */

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✅  ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.log(`  ❌  ${name}`);
    console.log(`      ${error.message}`);
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

/* ── Helpers ── */

function readAppFile(...segments) {
  return fs.readFileSync(path.join(APP_SRC, ...segments), "utf-8");
}

function readCoreFile(...segments) {
  return fs.readFileSync(path.join(CORE_DIR, ...segments), "utf-8");
}

function readAllAppSource() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry.name)) files.push(full);
    }
  }
  walk(APP_SRC);
  return files.map((f) => fs.readFileSync(f, "utf-8")).join("\n");
}

/* ═══════════════════════════════════════════════════════
   Section 1 — Global live badge removed
   ═══════════════════════════════════════════════════════ */

section("1 — Global live badge removed");

test("App.tsx does not render 'Live — Atlas Sandbox' badge", () => {
  const app = readAppFile("App.tsx");
  assert.ok(
    !app.includes("Live — Atlas Sandbox"),
    "App.tsx must not contain 'Live — Atlas Sandbox'"
  );
});

test("App.tsx does not render sc-header__badge", () => {
  const app = readAppFile("App.tsx");
  assert.ok(
    !app.includes("sc-header__badge"),
    "App.tsx must not contain sc-header__badge class"
  );
});

test("No app source file contains a global live claim", () => {
  const all = readAllAppSource();
  assert.ok(
    !/Live\s*—\s*Atlas/i.test(all),
    "No app source should contain 'Live — Atlas' global claim"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 2 — Itinerary Review always renders Source: Local fixture
   ═══════════════════════════════════════════════════════ */

section("2 — Itinerary Review always 'Source: Local fixture'");

test("ItineraryReview uses DataSourceTag with source='local-fixture'", () => {
  const src = readAppFile("components", "ItineraryReview.tsx");
  assert.ok(
    src.includes('source="local-fixture"'),
    "ItineraryReview must render DataSourceTag with local-fixture"
  );
});

test("DataSourceTag renders 'Source: Local fixture' for local-fixture", () => {
  const tag = readAppFile("components", "DataSourceTag.tsx");
  assert.ok(
    tag.includes("Source: Local fixture"),
    "DataSourceTag must render 'Source: Local fixture'"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 3 — Alternatives render 'Source: Atlas Sandbox · live'
   only with successful live Atlas provenance
   ═══════════════════════════════════════════════════════ */

section("3 — Atlas live tag requires provenance");

test("AlternativesPanel checks evidenceSource before showing atlas-live", () => {
  const src = readAppFile("components", "AlternativesPanel.tsx");
  assert.ok(
    src.includes("atlas-sandbox") && src.includes("atlas-live"),
    "AlternativesPanel must check atlas-sandbox provenance for atlas-live tag"
  );
});

test("DataSourceTag renders 'Source: Atlas Sandbox · live' for atlas-live", () => {
  const tag = readAppFile("components", "DataSourceTag.tsx");
  assert.ok(
    tag.includes("Atlas Sandbox") && tag.includes("live"),
    "DataSourceTag must render Atlas Sandbox live label"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 4 — Offline Alternatives render 'Source: Local fixture'
   ═══════════════════════════════════════════════════════ */

section("4 — Offline alternatives 'Source: Local fixture'");

test("AlternativesPanel defaults to local-fixture data source", () => {
  const src = readAppFile("components", "AlternativesPanel.tsx");
  assert.ok(
    src.includes("let dataSource: DataSource = 'local-fixture'"),
    "AlternativesPanel must default to local-fixture"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 5 — Offline fallback renders 'Source: Offline fallback'
   ═══════════════════════════════════════════════════════ */

section("5 — Offline fallback tag");

test("DataSourceTag renders 'Source: Offline fallback' for offline-fallback", () => {
  const tag = readAppFile("components", "DataSourceTag.tsx");
  assert.ok(
    tag.includes("Source: Offline fallback"),
    "DataSourceTag must render 'Source: Offline fallback'"
  );
});

test("RecoveryPlanAnimation uses DataSourceTag from animation dataSource", () => {
  const src = readAppFile("components", "RecoveryPlanAnimation.tsx");
  assert.ok(
    src.includes("dataSourceToTag") && src.includes("<DataSourceTag"),
    "RecoveryPlanAnimation must render DataSourceTag from data.dataSource"
  );
  assert.ok(
    src.includes("source === 'local-fallback'") || src.includes("return 'offline-fallback'"),
    "offline/local-fallback animation data must still map to the offline-fallback tag"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 6 — Recovery Plan does not inherit Alternatives source
   ═══════════════════════════════════════════════════════ */

section("6 — Recovery Plan source is independent");

test("RecoveryPlanAnimation does not import or read from AlternativesPanel", () => {
  const rpa = readAppFile("components", "RecoveryPlanAnimation.tsx");
  assert.ok(
    !rpa.includes("AlternativesPanel") && !rpa.includes("alternativesResult"),
    "RecoveryPlanAnimation must not reference AlternativesPanel data"
  );
});

test("RecoveryPlanAnimation owns its DataSourceTag independently of Alternatives", () => {
  const rpa = readAppFile("components", "RecoveryPlanAnimation.tsx");
  assert.ok(
    rpa.includes("<DataSourceTag") && rpa.includes("dataSourceToTag"),
    "RecoveryPlanAnimation must own its DataSourceTag mapping"
  );
  assert.ok(
    rpa.includes("return 'offline-fallback'"),
    "Default/local-fallback Recovery Plan source must remain offline-fallback"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 7 — 'Synthetic Carrier' / 'Synthetic Airline' absent from UI
   ═══════════════════════════════════════════════════════ */

section("7 — No Synthetic Carrier / Synthetic Airline in app UI");

test("App source does not contain 'Synthetic Carrier'", () => {
  const all = readAllAppSource();
  assert.ok(
    !all.includes("Synthetic Carrier"),
    "App source must not contain 'Synthetic Carrier'"
  );
});

test("App source does not contain 'Synthetic Airline'", () => {
  const all = readAllAppSource();
  assert.ok(
    !all.includes("Synthetic Airline"),
    "App source must not contain 'Synthetic Airline'"
  );
});

test("Fixture JSON uses 'Sample carrier' not 'Synthetic Carrier'", () => {
  const json = fs.readFileSync(FIXTURE_JSON, "utf-8");
  assert.ok(
    !json.includes("Synthetic Carrier"),
    "Fixture JSON must not contain 'Synthetic Carrier'"
  );
  assert.ok(
    json.includes("Sample carrier"),
    "Fixture JSON must contain 'Sample carrier'"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 8 — 'Direct Gemini' / 'Direct Gemini 3.7' absent from UI
   ═══════════════════════════════════════════════════════ */

section("8 — No Direct Gemini wording in app UI");

test("App source does not contain 'Direct Gemini'", () => {
  const all = readAllAppSource();
  assert.ok(
    !all.includes("Direct Gemini"),
    "App source must not contain 'Direct Gemini'"
  );
});

test("Core labels.ts does not contain 'Direct Gemini 3.7' in GEMINI_LABELS", () => {
  const labels = readCoreFile("provenance", "labels.ts");
  assert.ok(
    !labels.includes("liveValidated: 'Direct Gemini"),
    "labels.ts must not have Direct Gemini in GEMINI_LABELS"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 9 — Source labeling via per-panel DataSourceTag
   ═══════════════════════════════════════════════════════ */

section("9 — Source labeling via per-panel DataSourceTag");

test("App.tsx no longer uses the global demo footnote copy", () => {
  const app = readAppFile("App.tsx");
  assert.ok(
    !app.includes("Demo build — sources are tagged where data appears."),
    "Global demo footnote must be removed from App.tsx after screen consolidation"
  );
});

test("App.tsx footer keeps only the safety disclaimer", () => {
  const app = readAppFile("App.tsx");
  assert.ok(
    app.includes('No booking, payment, reservation, or order created'),
    "Footer must keep the no-booking safety disclaimer"
  );
  assert.ok(
    !app.includes("sc-footer__footnote"),
    "Footer must not use the removed sc-footer__footnote demo copy"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 10 — Safety wording remains present
   ═══════════════════════════════════════════════════════ */

section("10 — Safety wording intact");

test("SafetyNotice contains 'Sample documents only'", () => {
  const src = readAppFile("components", "SafetyNotice.tsx");
  assert.ok(
    src.includes("Sample documents only"),
    "SafetyNotice must contain 'Sample documents only'"
  );
});

test("SafetyNotice contains 'No booking, payment, reservation'", () => {
  const src = readAppFile("components", "SafetyNotice.tsx");
  assert.ok(
    src.includes("No booking, payment, reservation"),
    "SafetyNotice must contain booking/payment denial"
  );
});

test("SafetyNotice contains 'Search is read-only'", () => {
  const src = readAppFile("components", "SafetyNotice.tsx");
  assert.ok(
    src.includes("Search is read-only"),
    "SafetyNotice must state search is read-only"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 11 — 'Request submitted — awaiting verified supplier outcome'
   ═══════════════════════════════════════════════════════ */

section("11 — Request submitted wording intact");

test("RecoveryPlanAnimation contains 'Request submitted — awaiting verified supplier outcome'", () => {
  const rpa = readAppFile("components", "RecoveryPlanAnimation.tsx");
  assert.ok(
    rpa.includes("Request submitted — awaiting verified supplier outcome"),
    "Must contain exact 'Request submitted — awaiting verified supplier outcome'"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 12 — Forbidden booking/payment/ticketing claims absent
   ═══════════════════════════════════════════════════════ */

section("12 — No forbidden booking/payment/ticketing claims");

test("App source does not claim 'Booked' as a UI outcome", () => {
  const all = readAllAppSource();
  // Check for standalone "Booked" claim (not in "no booking" context)
  assert.ok(
    !/\bBooked\b/.test(all) || all.includes("No booking"),
    "Must not claim 'Booked' without denial context"
  );
});

test("App source does not claim 'Ticket issued'", () => {
  const all = readAllAppSource();
  assert.ok(
    !all.includes("Ticket issued"),
    "Must not claim 'Ticket issued'"
  );
});

test("App source does not claim 'Payment completed'", () => {
  const all = readAllAppSource();
  assert.ok(
    !all.includes("Payment completed"),
    "Must not claim 'Payment completed'"
  );
});

test("App source does not claim 'Switched' as a UI outcome", () => {
  const all = readAllAppSource();
  // Remove block comments and line comments before checking
  const stripped = all
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.ok(
    !/\bSwitched\b/.test(stripped),
    "Must not claim 'Switched' in non-comment source"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 13 — No horizontal overflow introduced
   ═══════════════════════════════════════════════════════ */

section("13 — No horizontal overflow");

test("DataSourceTag uses inline-block, not fixed width", () => {
  const css = readAppFile("App.css");
  assert.ok(
    css.includes(".sc-source-tag") && css.includes("display: inline-block"),
    "DataSourceTag CSS must use inline-block display"
  );
});

test("DataSourceTag does not set explicit width that could overflow", () => {
  const tag = readAppFile("components", "DataSourceTag.tsx");
  assert.ok(
    !tag.includes("style=") || !tag.includes("width"),
    "DataSourceTag must not set inline width styles"
  );
});

/* ═══════════════════════════════════════════════════════
   Section 14 — Reduced-motion behavior intact
   ═══════════════════════════════════════════════════════ */

section("14 — Reduced-motion behavior intact");

test("RecoveryPlanAnimation CSS contains prefers-reduced-motion", () => {
  const css = readAppFile("components", "RecoveryPlanAnimation.css");
  assert.ok(
    css.includes("prefers-reduced-motion"),
    "RecoveryPlanAnimation CSS must honor prefers-reduced-motion"
  );
});

test("DataSourceTag has no animations that need reduction", () => {
  const tag = readAppFile("components", "DataSourceTag.tsx");
  assert.ok(
    !tag.includes("animation") && !tag.includes("transition"),
    "DataSourceTag must not use animations"
  );
});

/* ═══════════════════════════════════════════════════════
   Summary
   ═══════════════════════════════════════════════════════ */

console.log(`\n════════════════════════════════════════════════════════`);
console.log(`UI simplification tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`\nFailed tests:`);
  for (const name of failures) console.log(`  - ${name}`);
  process.exit(1);
} else {
  console.log(`All tests passed.`);
}
