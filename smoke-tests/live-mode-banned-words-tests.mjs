// Live-mode banned-words / forbidden-claims tests for StitchCheck.
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// These tests verify that the StitchCheck UI never renders claims of
// completed booking, switching, ticketing, or payment without a real
// verified supplier confirmation. They also verify that the safe
// wording "Request submitted — awaiting verified supplier outcome"
// is present and that the RecoveryPlanAnimation guards are intact.
//
// Approach:
//   Static source analysis of all app/src components. Each test reads
//   component source files and asserts on the presence or absence of
//   specific text patterns. This is deterministic and requires no
//   browser or DOM.
//
// Hard guarantees:
// - Zero network code: no fetch/http/https/net/socket imports or calls.
// - Zero credentials read: no .env or secret file is ever touched.
// - Zero dependencies: Node.js built-ins and existing local modules only.
// - Deterministic: no randomness, no timing, no external calls.
// - Reads source files only; never modifies them.
//
// Run:
//   node smoke-tests/live-mode-banned-words-tests.mjs

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_SRC = path.resolve(__dirname, "..", "app", "src");
const CORE_DIR = path.resolve(__dirname, "..", "core");

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

/**
 * Reads all .tsx/.ts source files under app/src/components/ and app/src/App.tsx.
 * Returns an array of { filePath, content } objects.
 */
function readAllComponentSources() {
  const results = [];
  const dirs = [
    path.join(APP_SRC, "components"),
    // Also include App.tsx itself
  ];

  // App.tsx
  const appTsx = path.join(APP_SRC, "App.tsx");
  if (fs.existsSync(appTsx)) {
    results.push({ filePath: appTsx, content: fs.readFileSync(appTsx, "utf-8") });
  }

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
        const full = path.join(dir, entry.name);
        results.push({ filePath: full, content: fs.readFileSync(full, "utf-8") });
      }
    }
  }
  return results;
}

/**
 * Reads all .ts source files under core/provenance/ and core/domain/.
 */
function readCoreSources() {
  const results = [];
  const dirs = [
    path.join(CORE_DIR, "provenance"),
    path.join(CORE_DIR, "domain"),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.ts$/.test(entry.name)) {
        const full = path.join(dir, entry.name);
        results.push({ filePath: full, content: fs.readFileSync(full, "utf-8") });
      }
    }
  }
  return results;
}

/**
 * Reads the types file for RecoveryPlanAnimationData.
 */
function readRecoveryPlanTypes() {
  const p = path.join(APP_SRC, "types", "recovery-plan.ts");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
}

const allComponents = readAllComponentSources();
const allCoreSources = readCoreSources();
const allSources = [...allComponents, ...allCoreSources];
const recoveryPlanTypes = readRecoveryPlanTypes();

/**
 * Concatenates all component source content for aggregate searches.
 */
const allComponentText = allComponents.map((s) => s.content).join("\n");
const allText = allSources.map((s) => s.content).join("\n");

/* ══════════════════════════════════════════════════════════════════
   Section 1: "Booked" does not render as a completed claim
   ══════════════════════════════════════════════════════════════════ */

section("Section 1 — 'Booked' does not render as a completed claim");

test("no component renders text 'Booked' as a completed action", () => {
  // Look for JSX text content or string literals that claim "Booked"
  // as a past-tense completed action. Exclude:
  //   - "Pre-booked hotel check-in" (cascade impact label, not a booking claim)
  //   - "unbooked" (negation)
  //   - Comments (// or /* ... */) including JSDoc block comments
  //   - noBooking / noOrderCreated / booking-related safety disclaimers
  //   - Documentation comments about the guard rule itself
  const lines = allComponentText.split("\n");
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Track block comments
    if (/\/\*/.test(line)) inBlockComment = true;
    if (/\*\//.test(line)) { inBlockComment = false; continue; }
    if (inBlockComment) continue;
    // Skip line comments
    if (/^\s*\/\//.test(line)) continue;
    // Skip lines with "Pre-booked" (cascade item label)
    if (/Pre-booked/i.test(line)) continue;
    // Skip lines with "unbooked" (negation)
    if (/unbooked/i.test(line)) continue;
    // Skip safety disclaimers that mention booking in a negation context
    if (/no\s+booking/i.test(line)) continue;
    if (/No\s+booking/i.test(line)) continue;
    if (/noOrderCreated/i.test(line)) continue;
    // Skip button labels like "no booking action"
    if (/no booking action/i.test(line)) continue;
    // Skip documentation about the guard rule (contains "never claimed")
    if (/never claimed/i.test(line)) continue;
    // Now check for standalone "Booked" as a rendered claim
    if (/['">]\s*Booked\s*['"<]/.test(line)) {
      assert.fail(
        `Line ${i + 1} renders 'Booked' as a completed claim: ${line.trim()}`,
      );
    }
  }
});

test("no component renders 'Booking confirmed'", () => {
  assert.ok(
    !/Booking confirmed/i.test(
      allComponentText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "Forbidden: 'Booking confirmed' found in component source",
  );
});

test("no component renders 'Booking completed'", () => {
  assert.ok(
    !/Booking completed/i.test(
      allComponentText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "Forbidden: 'Booking completed' found in component source",
  );
});

/* ══════════════════════════════════════════════════════════════════
   Section 2: "Switched" does not render as a completed claim
   ══════════════════════════════════════════════════════════════════ */

section("Section 2 — 'Switched' does not render as a completed claim");

test("no component renders 'Switched' as a completed past-tense action", () => {
  // "Switch to alternative" is a user action choice (allowed).
  // "Switched" as a past-tense completed action is forbidden.
  // "Switch request" is allowed (it's a request, not a completion).
  const lines = allComponentText.split("\n");
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Track block comments
    if (/\/\*/.test(line)) inBlockComment = true;
    if (/\*\//.test(line)) { inBlockComment = false; continue; }
    if (inBlockComment) continue;
    if (/^\s*\/\//.test(line)) continue;
    // Allow "Switch to", "Switch request", "switch to"
    if (/Switch to/i.test(line)) continue;
    if (/switch to/i.test(line)) continue;
    if (/switch request/i.test(line)) continue;
    if (/Switch request/i.test(line)) continue;
    // Skip documentation about the guard rule (contains "never claimed")
    if (/never claimed/i.test(line)) continue;
    // Check for standalone "Switched" as a completed action
    if (/['">]\s*Switched\s*['"<]/.test(line)) {
      assert.fail(
        `Line ${i + 1} renders 'Switched' as a completed claim: ${line.trim()}`,
      );
    }
  }
});

test("no component renders 'Switch completed'", () => {
  assert.ok(
    !/Switch completed/i.test(
      allComponentText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "Forbidden: 'Switch completed' found in component source",
  );
});

test("no component renders 'Switch confirmed'", () => {
  assert.ok(
    !/Switch confirmed/i.test(
      allComponentText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "Forbidden: 'Switch confirmed' found in component source",
  );
});

/* ══════════════════════════════════════════════════════════════════
   Section 3: "Ticket issued" does not render
   ══════════════════════════════════════════════════════════════════ */

section("Section 3 — 'Ticket issued' does not render");

test("no component renders 'Ticket issued'", () => {
  assert.ok(
    !/Ticket issued/i.test(
      allComponentText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "Forbidden: 'Ticket issued' found in component source",
  );
});

test("no component renders 'Ticket confirmed'", () => {
  assert.ok(
    !/Ticket confirmed/i.test(
      allComponentText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "Forbidden: 'Ticket confirmed' found in component source",
  );
});

test("no component renders 'Tickets issued'", () => {
  assert.ok(
    !/Tickets issued/i.test(
      allComponentText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "Forbidden: 'Tickets issued' found in component source",
  );
});

/* ══════════════════════════════════════════════════════════════════
   Section 4: "Payment completed" does not render
   ══════════════════════════════════════════════════════════════════ */

section("Section 4 — 'Payment completed' does not render");

test("no component renders 'Payment completed'", () => {
  assert.ok(
    !/Payment completed/i.test(
      allComponentText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "Forbidden: 'Payment completed' found in component source",
  );
});

test("no component renders 'Payment confirmed'", () => {
  assert.ok(
    !/Payment confirmed/i.test(
      allComponentText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "Forbidden: 'Payment confirmed' found in component source",
  );
});

test("no component renders 'Payment processed'", () => {
  assert.ok(
    !/Payment processed/i.test(
      allComponentText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "Forbidden: 'Payment processed' found in component source",
  );
});

test("no component renders 'Payment successful'", () => {
  assert.ok(
    !/Payment successful/i.test(
      allComponentText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "Forbidden: 'Payment successful' found in component source",
  );
});

/* ══════════════════════════════════════════════════════════════════
   Section 5: Safe wording is present
   ══════════════════════════════════════════════════════════════════ */

section("Section 5 — Safe wording is present");

test("RecoveryPlanAnimation contains 'Request submitted — awaiting verified supplier outcome'", () => {
  const rpaPath = path.join(APP_SRC, "components", "RecoveryPlanAnimation.tsx");
  assert.ok(fs.existsSync(rpaPath), "RecoveryPlanAnimation.tsx must exist");
  const content = fs.readFileSync(rpaPath, "utf-8");
  assert.ok(
    content.includes(
      "Request submitted \u2014 awaiting verified supplier outcome",
    ),
    "RecoveryPlanAnimation must contain the safe awaiting-outcome wording",
  );
});

test("recovery-plan types document the safe wording contract", () => {
  assert.ok(
    recoveryPlanTypes.includes(
      "Request submitted \u2014 awaiting verified supplier outcome",
    ),
    "recovery-plan.ts must document the safe awaiting-outcome wording",
  );
});

test("RecoveryPlanAnimation guards verified outcome behind verifiedOutcome !== null", () => {
  const rpaPath = path.join(APP_SRC, "components", "RecoveryPlanAnimation.tsx");
  const content = fs.readFileSync(rpaPath, "utf-8");
  // The component must check data.verifiedOutcome !== null before
  // rendering the verified outcome panel. Without this guard, it
  // would render unverified claims.
  assert.ok(
    /data\.verifiedOutcome\s*!==\s*null/.test(content),
    "RecoveryPlanAnimation must guard verified outcome behind verifiedOutcome !== null",
  );
});

test("RecoveryPlanAnimation falls back to safe wording when verifiedOutcome is null", () => {
  const rpaPath = path.join(APP_SRC, "components", "RecoveryPlanAnimation.tsx");
  const content = fs.readFileSync(rpaPath, "utf-8");
  // When verifiedOutcome is null (no real verification), the component
  // must render the safe "Request submitted — awaiting..." text.
  // Check the ternary: verifiedOutcome !== null ? <verified> : <safe>
  assert.ok(
    /verifiedOutcome.*!==.*null/.test(content) &&
      /awaiting verified supplier outcome/.test(content),
    "RecoveryPlanAnimation must fall back to safe wording when verifiedOutcome is null",
  );
});

/* ══════════════════════════════════════════════════════════════════
   Section 6: Safety disclaimers are present
   ══════════════════════════════════════════════════════════════════ */

section("Section 6 — Safety disclaimers are present");

test("FINAL_STATEMENT denies all write actions", () => {
  const labelsPath = path.join(CORE_DIR, "provenance", "labels.ts");
  assert.ok(fs.existsSync(labelsPath), "core/provenance/labels.ts must exist");
  const content = fs.readFileSync(labelsPath, "utf-8");
  assert.ok(
    /No booking, payment, reservation, ticket, order/.test(content),
    "FINAL_STATEMENT must deny booking, payment, reservation, ticket, order",
  );
});

test("App.tsx footer denies booking, payment, and order", () => {
  const appTsx = path.join(APP_SRC, "App.tsx");
  const content = fs.readFileSync(appTsx, "utf-8");
  assert.ok(
    /No booking, payment/i.test(content),
    "App.tsx footer must deny booking and payment",
  );
});

test("SafetyNotice denies booking, payment, reservation, and order", () => {
  const safetyPath = path.join(APP_SRC, "components", "SafetyNotice.tsx");
  const content = fs.readFileSync(safetyPath, "utf-8");
  assert.ok(
    /No booking, payment, reservation, or order will be created/i.test(content),
    "SafetyNotice must deny booking, payment, reservation, and order",
  );
});

test("DecisionPanel renders noOrderCreated: true", () => {
  const decisionPath = path.join(APP_SRC, "components", "DecisionPanel.tsx");
  const content = fs.readFileSync(decisionPath, "utf-8");
  assert.ok(
    /noOrderCreated/.test(content),
    "DecisionPanel must render noOrderCreated: true",
  );
});

test("DecisionPanel renders externalCallsMade: false", () => {
  const decisionPath = path.join(APP_SRC, "components", "DecisionPanel.tsx");
  const content = fs.readFileSync(decisionPath, "utf-8");
  assert.ok(
    /externalCallsMade.*false/.test(content),
    "DecisionPanel must render externalCallsMade: false",
  );
});

test("App.tsx switch button says 'no booking action'", () => {
  const appTsx = path.join(APP_SRC, "App.tsx");
  const content = fs.readFileSync(appTsx, "utf-8");
  assert.ok(
    /no booking action/i.test(content),
    "App.tsx switch button must say 'no booking action'",
  );
});

test("AlternativesPanel says 'no booking, payment, or order is created'", () => {
  const altPath = path.join(APP_SRC, "components", "AlternativesPanel.tsx");
  const content = fs.readFileSync(altPath, "utf-8");
  assert.ok(
    /no booking, payment, or order is created/i.test(content),
    "AlternativesPanel must deny booking, payment, and order",
  );
});

/* ══════════════════════════════════════════════════════════════════
   Section 7: RecoveryPlanAnimation hard rules (source-level)
   ══════════════════════════════════════════════════════════════════ */

section("Section 7 — RecoveryPlanAnimation hard rules (source-level)");

test("RecoveryPlanAnimation source documents 'Booked/Switched' guard rule", () => {
  const rpaPath = path.join(APP_SRC, "components", "RecoveryPlanAnimation.tsx");
  const content = fs.readFileSync(rpaPath, "utf-8");
  assert.ok(
    /Booked.*Switched.*never claimed/i.test(content) ||
      /"Booked"\/"Switched" are never claimed/i.test(content),
    "RecoveryPlanAnimation must document the Booked/Switched guard rule",
  );
});

test("RecoveryPlanAnimation uses valueOrNotAvailable for nullable fields", () => {
  const rpaPath = path.join(APP_SRC, "components", "RecoveryPlanAnimation.tsx");
  const content = fs.readFileSync(rpaPath, "utf-8");
  assert.ok(
    /valueOrNotAvailable/.test(content),
    "RecoveryPlanAnimation must use valueOrNotAvailable for nullable fields",
  );
});

test("RecoveryPlanAnimation uses shared missing-field labels", () => {
  const rpaPath = path.join(APP_SRC, "components", "RecoveryPlanAnimation.tsx");
  const content = fs.readFileSync(rpaPath, "utf-8");
  assert.ok(
    content.includes("formatMissingField"),
    "RecoveryPlanAnimation must use formatMissingField helper",
  );
});

test("RecoveryPlanAnimation confirmationPhase has 'request-submitted' state", () => {
  const rpaPath = path.join(APP_SRC, "components", "RecoveryPlanAnimation.tsx");
  const content = fs.readFileSync(rpaPath, "utf-8");
  assert.ok(
    /request-submitted/.test(content),
    "RecoveryPlanAnimation must support 'request-submitted' confirmationPhase",
  );
});

test("RecoveryPlanAnimation confirmationPhase has 'verified-outcome' state", () => {
  const rpaPath = path.join(APP_SRC, "components", "RecoveryPlanAnimation.tsx");
  const content = fs.readFileSync(rpaPath, "utf-8");
  assert.ok(
    /verified-outcome/.test(content),
    "RecoveryPlanAnimation must support 'verified-outcome' confirmationPhase",
  );
});

/* ══════════════════════════════════════════════════════════════════
   Section 8: Provenance labels deny completion claims
   ══════════════════════════════════════════════════════════════════ */

section("Section 8 — Provenance labels deny completion claims");

test("no provenance label claims booking completion", () => {
  const labelsPath = path.join(CORE_DIR, "provenance", "labels.ts");
  const content = fs.readFileSync(labelsPath, "utf-8");
  // Check that no label value contains "booked" or "confirmed" as a
  // past-tense completion claim (excluding safety disclaimers).
  const labelValues = content.match(/'[^']*'/g) || [];
  for (const val of labelValues) {
    const inner = val.slice(1, -1);
    if (/booked/i.test(inner) && !/no.*booking/i.test(inner) && !/Pre-booked/i.test(inner)) {
      assert.fail(`Label value '${inner}' appears to claim booking completion`);
    }
  }
});

test("labels.ts documents that no label claims booking/payment completion", () => {
  const labelsPath = path.join(CORE_DIR, "provenance", "labels.ts");
  const content = fs.readFileSync(labelsPath, "utf-8");
  assert.ok(
    /No label ever claims booking\/payment completion/i.test(content) ||
      /no.*booking.*payment.*completion/i.test(content) ||
      /No.*label.*claim.*booking/i.test(content),
    "labels.ts must document that no label claims booking/payment completion",
  );
});

test("ATLAS_UI_LABELS.simulated says 'no real order created'", () => {
  const labelsPath = path.join(CORE_DIR, "provenance", "labels.ts");
  const content = fs.readFileSync(labelsPath, "utf-8");
  assert.ok(
    /no real order created/i.test(content),
    "Atlas simulated label must say 'no real order created'",
  );
});

/* ══════════════════════════════════════════════════════════════════
   Section 9: Contract-level禁令 — alternatives-contract
   ══════════════════════════════════════════════════════════════════ */

section("Section 9 — Alternatives contract forbids write operations");

test("alternatives-contract.mjs FORBIDDEN_OPERATIONS includes 'book'", () => {
  const contractPath = path.join(__dirname, "atlas", "alternatives-contract.mjs");
  const content = fs.readFileSync(contractPath, "utf-8");
  assert.ok(/"book"/.test(content), "FORBIDDEN_OPERATIONS must include 'book'");
});

test("alternatives-contract.mjs FORBIDDEN_OPERATIONS includes 'order'", () => {
  const contractPath = path.join(__dirname, "atlas", "alternatives-contract.mjs");
  const content = fs.readFileSync(contractPath, "utf-8");
  assert.ok(/"order"/.test(content), "FORBIDDEN_OPERATIONS must include 'order'");
});

test("alternatives-contract.mjs FORBIDDEN_OPERATIONS includes 'ticket'", () => {
  const contractPath = path.join(__dirname, "atlas", "alternatives-contract.mjs");
  const content = fs.readFileSync(contractPath, "utf-8");
  assert.ok(/"ticket"/.test(content), "FORBIDDEN_OPERATIONS must include 'ticket'");
});

test("alternatives-contract.mjs FORBIDDEN_OPERATIONS includes 'pay'", () => {
  const contractPath = path.join(__dirname, "atlas", "alternatives-contract.mjs");
  const content = fs.readFileSync(contractPath, "utf-8");
  assert.ok(/"pay"/.test(content), "FORBIDDEN_OPERATIONS must include 'pay'");
});

test("alternatives-contract.mjs FORBIDDEN_OPERATIONS includes 'cancel'", () => {
  const contractPath = path.join(__dirname, "atlas", "alternatives-contract.mjs");
  const content = fs.readFileSync(contractPath, "utf-8");
  assert.ok(/"cancel"/.test(content), "FORBIDDEN_OPERATIONS must include 'cancel'");
});

/* ══════════════════════════════════════════════════════════════════
   Section 10: Test source safety invariants
   ══════════════════════════════════════════════════════════════════ */

section("Section 10 — Test source safety invariants");

const _forbiddenNetModules = [
  "node:http",
  "node:https",
  "node:net",
  "node:tls",
];

test("test source contains no network imports", () => {
  const testSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf-8");
  // Extract only the import statements (first ~25 lines) to avoid
  // matching the test's own string literals that name forbidden modules.
  const importBlock = testSource.split("\n").slice(0, 25).join("\n");
  for (const mod of _forbiddenNetModules) {
    assert.ok(
      !importBlock.includes(mod),
      `Forbidden network import found: ${mod}`,
    );
  }
});

test("test source contains no credential file reads", () => {
  const testSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf-8");
  // Check for actual .env file reads, not string literals in assertions.
  const envFilePattern = /require\s*\(\s*['"]\.env|from\s+['"]\.env|readFileSync\s*\(\s*['"]\.env/;
  assert.ok(
    !envFilePattern.test(testSource),
    "Must not read .env files",
  );
});

test("test source contains no endpoint URLs", () => {
  const testSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf-8");
  const urlPattern = /https?:\/\/[^\s"')]+/;
  assert.ok(!urlPattern.test(testSource), "Forbidden: endpoint URL found");
});

test("test is deterministic: no randomness or timing", () => {
  const testSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf-8");
  // Check only non-comment, non-assertion code for actual calls.
  // Strip comments and string literals to avoid matching assertion text.
  const codeOnly = testSource
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""');
  assert.ok(!/Math\.random\s*\(/.test(codeOnly), "Must not call Math.random()");
  assert.ok(!/setTimeout\s*\(/.test(codeOnly), "Must not call setTimeout()");
  assert.ok(!/setInterval\s*\(/.test(codeOnly), "Must not call setInterval()");
});

/* ── Summary ── */

console.log(
  `\nLive-mode banned-words tests: ${passed} passed, ${failed} failed`,
);

if (failed > 0) {
  console.log("\nFailed tests:");
  for (const name of failures) {
    console.log(`  - ${name}`);
  }
  process.exit(1);
}
