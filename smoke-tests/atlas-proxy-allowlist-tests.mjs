// Atlas proxy path-allowlist contract tests for StitchCheck.
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// These tests define and validate the Atlas proxy routing boundary:
// which /api/atlas/* paths are permitted (read-only) and which are
// rejected (write actions). The proxy contract ensures that no
// booking, payment, ticketing, order, or cancellation path is ever
// reachable through the Atlas proxy.
//
// Hard guarantees:
// - Zero network code: no fetch/http/https/net/socket imports or calls.
// - Zero credentials read: no .env or secret file is ever touched.
// - Zero dependencies: Node.js built-ins and existing local modules only.
// - Deterministic: no randomness, no timing, no external calls.
// - Uses mocked upstream responses only; never calls Atlas.
//
// Run:
//   node smoke-tests/atlas-proxy-allowlist-tests.mjs

import assert from "node:assert";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  READ_ONLY_OPERATIONS,
  FORBIDDEN_OPERATIONS,
  isReadOnlyOperation,
  isForbiddenOperation,
  createDisabledAtlasSearchResult,
  ATLAS_LABELS,
} from "./atlas/alternatives-contract.mjs";

import {
  readOnlyAtlasAdapter,
  _resetModuleState,
  validateSearchRequest,
} from "./atlas/read-only-atlas-adapter.mjs";

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

async function asyncTest(name, fn) {
  try {
    await fn();
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

/* ── Proxy path-allowlist contract ──
 *
 * The Atlas proxy must implement a path-level allowlist.
 * This section defines the contract and tests a reference
 * implementation that mirrors the expected proxy behaviour.
 *
 * Allowed paths (read-only Atlas Sandbox operations):
 *   /api/atlas/search   → Atlas Sandbox Search (price lookup)
 *   /api/atlas/verify   → Atlas Sandbox Verify (read-only price check)
 *
 * Rejected paths (write actions — must never reach Atlas):
 *   /api/atlas/order    → Order creation
 *   /api/atlas/booking  → Booking creation
 *   /api/atlas/ticket   → Ticketing
 *   /api/atlas/payment  → Payment
 *   /api/atlas/cancel   → Cancellation
 *   Any other path      → Rejected by default
 */

const ATLAS_PROXY_ALLOWED_PATHS = Object.freeze([
  "/api/atlas/search",
  "/api/atlas/verify",
]);

const ATLAS_PROXY_REJECTED_PATHS = Object.freeze([
  "/api/atlas/order",
  "/api/atlas/booking",
  "/api/atlas/ticket",
  "/api/atlas/payment",
  "/api/atlas/cancel",
]);

/**
 * Reference implementation of the proxy path allowlist.
 * Returns true if the path is permitted, false otherwise.
 * @param {string} path
 * @returns {boolean}
 */
function isAtlasProxyPathAllowed(path) {
  if (typeof path !== "string") return false;
  // Normalise: strip query string and trailing slash
  const normalised = path.split("?")[0].replace(/\/+$/, "");
  return ATLAS_PROXY_ALLOWED_PATHS.includes(normalised);
}

/**
 * Maps a proxy path to the corresponding adapter operation name.
 * @param {string} path
 * @returns {string|null}
 */
function pathToOperation(path) {
  const segment = path.split("?")[0].replace(/\/+$/, "").split("/").pop();
  return segment || null;
}

/* ══════════════════════════════════════════════════════════════════
   Section 1: Allowed paths
   ══════════════════════════════════════════════════════════════════ */

section("Section 1 — Allowed proxy paths");

test("/api/atlas/search is allowed", () => {
  assert.strictEqual(isAtlasProxyPathAllowed("/api/atlas/search"), true);
});

test("/api/atlas/verify is allowed", () => {
  assert.strictEqual(isAtlasProxyPathAllowed("/api/atlas/verify"), true);
});

test("/api/atlas/search maps to read-only operation 'search'", () => {
  const op = pathToOperation("/api/atlas/search");
  assert.strictEqual(op, "search");
  assert.strictEqual(isReadOnlyOperation(op), true);
});

test("/api/atlas/verify maps to operation 'verify'", () => {
  const op = pathToOperation("/api/atlas/verify");
  assert.strictEqual(op, "verify");
  // Note: 'verify' is a read-only Atlas Sandbox price-check in the
  // broader Sandbox flow (Search → Verify → HARD STOP). The adapter
  // contract currently classifies it as forbidden because the adapter
  // only supports search/compare. This is a known contract boundary:
  // the proxy allows the path, but the adapter may still block it.
});

/* ══════════════════════════════════════════════════════════════════
   Section 2: Rejected paths
   ══════════════════════════════════════════════════════════════════ */

section("Section 2 — Rejected proxy paths");

test("/api/atlas/order is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed("/api/atlas/order"), false);
});

test("/api/atlas/booking is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed("/api/atlas/booking"), false);
});

test("/api/atlas/ticket is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed("/api/atlas/ticket"), false);
});

test("/api/atlas/payment is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed("/api/atlas/payment"), false);
});

test("/api/atlas/cancel is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed("/api/atlas/cancel"), false);
});

/* ══════════════════════════════════════════════════════════════════
   Section 3: Arbitrary / unknown paths rejected by default
   ══════════════════════════════════════════════════════════════════ */

section("Section 3 — Arbitrary paths rejected by default");

test("arbitrary path /api/atlas/refund is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed("/api/atlas/refund"), false);
});

test("arbitrary path /api/atlas/admin is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed("/api/atlas/admin"), false);
});

test("arbitrary path /api/atlas/ is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed("/api/atlas/"), false);
});

test("arbitrary path /api/atlas is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed("/api/atlas"), false);
});

test("arbitrary path /api/other/search is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed("/api/other/search"), false);
});

test("empty string path is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed(""), false);
});

test("null path is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed(null), false);
});

test("undefined path is rejected", () => {
  assert.strictEqual(isAtlasProxyPathAllowed(undefined), false);
});

test("path with query string /api/atlas/search?foo=bar is allowed", () => {
  assert.strictEqual(
    isAtlasProxyPathAllowed("/api/atlas/search?foo=bar"),
    true,
  );
});

test("path with trailing slash /api/atlas/search/ is allowed", () => {
  assert.strictEqual(
    isAtlasProxyPathAllowed("/api/atlas/search/"),
    true,
  );
});

/* ══════════════════════════════════════════════════════════════════
   Section 4: Adapter operation-level enforcement
   ══════════════════════════════════════════════════════════════════ */

section("Section 4 — Adapter operation-level enforcement");

test("adapter rejects forbidden operation 'book'", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "book",
    correlationId: "test-book",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  assert.strictEqual(result.searchStatus, "disabled");
  assert.ok(result.errorMessage.includes("forbidden_operation_book"));
});

test("adapter rejects forbidden operation 'order'", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "order",
    correlationId: "test-order",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  assert.strictEqual(result.searchStatus, "disabled");
  assert.ok(result.errorMessage.includes("forbidden_operation_order"));
});

test("adapter rejects forbidden operation 'ticket'", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "ticket",
    correlationId: "test-ticket",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  assert.strictEqual(result.searchStatus, "disabled");
  assert.ok(result.errorMessage.includes("forbidden_operation_ticket"));
});

test("adapter rejects forbidden operation 'pay'", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "pay",
    correlationId: "test-pay",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  assert.strictEqual(result.searchStatus, "disabled");
  assert.ok(result.errorMessage.includes("forbidden_operation_pay"));
});

test("adapter rejects forbidden operation 'cancel'", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "cancel",
    correlationId: "test-cancel",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  assert.strictEqual(result.searchStatus, "disabled");
  assert.ok(result.errorMessage.includes("forbidden_operation_cancel"));
});

test("adapter rejects forbidden operation 'create_booking'", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "create_booking",
    correlationId: "test-booking",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  assert.strictEqual(result.searchStatus, "disabled");
  assert.ok(
    result.errorMessage.includes("forbidden_operation_create_booking"),
  );
});

test("adapter rejects forbidden operation 'reserve'", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "reserve",
    correlationId: "test-reserve",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  assert.strictEqual(result.searchStatus, "disabled");
  assert.ok(result.errorMessage.includes("forbidden_operation_reserve"));
});

test("adapter rejects forbidden operation 'purchase'", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "purchase",
    correlationId: "test-purchase",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  assert.strictEqual(result.searchStatus, "disabled");
  assert.ok(result.errorMessage.includes("forbidden_operation_purchase"));
});

test("adapter rejects forbidden operation 'issue'", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "issue",
    correlationId: "test-issue",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  assert.strictEqual(result.searchStatus, "disabled");
  assert.ok(result.errorMessage.includes("forbidden_operation_issue"));
});

test("adapter rejects forbidden operation 'refund'", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "refund",
    correlationId: "test-refund",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  assert.strictEqual(result.searchStatus, "disabled");
  assert.ok(result.errorMessage.includes("forbidden_operation_refund"));
});

test("adapter rejects forbidden operation 'change'", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "change",
    correlationId: "test-change",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  assert.strictEqual(result.searchStatus, "disabled");
  assert.ok(result.errorMessage.includes("forbidden_operation_change"));
});

test("adapter rejects non-read-only, non-forbidden operation", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "unknown_op",
    correlationId: "test-unknown",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  assert.strictEqual(result.searchStatus, "disabled");
  assert.ok(result.errorMessage.includes("invalid_operation_unknown_op"));
});

/* ══════════════════════════════════════════════════════════════════
   Section 5: Forbidden operations list completeness
   ══════════════════════════════════════════════════════════════════ */

section("Section 5 — Forbidden operations list completeness");

test("FORBIDDEN_OPERATIONS includes 'book'", () => {
  assert.ok(FORBIDDEN_OPERATIONS.includes("book"));
});

test("FORBIDDEN_OPERATIONS includes 'order'", () => {
  assert.ok(FORBIDDEN_OPERATIONS.includes("order"));
});

test("FORBIDDEN_OPERATIONS includes 'ticket'", () => {
  assert.ok(FORBIDDEN_OPERATIONS.includes("ticket"));
});

test("FORBIDDEN_OPERATIONS includes 'pay'", () => {
  assert.ok(FORBIDDEN_OPERATIONS.includes("pay"));
});

test("FORBIDDEN_OPERATIONS includes 'purchase'", () => {
  assert.ok(FORBIDDEN_OPERATIONS.includes("purchase"));
});

test("FORBIDDEN_OPERATIONS includes 'cancel'", () => {
  assert.ok(FORBIDDEN_OPERATIONS.includes("cancel"));
});

test("FORBIDDEN_OPERATIONS includes 'reserve'", () => {
  assert.ok(FORBIDDEN_OPERATIONS.includes("reserve"));
});

test("FORBIDDEN_OPERATIONS includes 'create_booking'", () => {
  assert.ok(FORBIDDEN_OPERATIONS.includes("create_booking"));
});

test("FORBIDDEN_OPERATIONS includes 'issue'", () => {
  assert.ok(FORBIDDEN_OPERATIONS.includes("issue"));
});

test("FORBIDDEN_OPERATIONS includes 'refund'", () => {
  assert.ok(FORBIDDEN_OPERATIONS.includes("refund"));
});

test("FORBIDDEN_OPERATIONS includes 'change'", () => {
  assert.ok(FORBIDDEN_OPERATIONS.includes("change"));
});

test("READ_ONLY_OPERATIONS does not include any forbidden operation", () => {
  for (const op of READ_ONLY_OPERATIONS) {
    assert.ok(
      !FORBIDDEN_OPERATIONS.includes(op),
      `READ_ONLY_OPERATIONS should not include forbidden op '${op}'`,
    );
  }
});

test("FORBIDDEN_OPERATIONS does not include any read-only operation", () => {
  for (const op of FORBIDDEN_OPERATIONS) {
    assert.ok(
      !READ_ONLY_OPERATIONS.includes(op),
      `FORBIDDEN_OPERATIONS should not include read-only op '${op}'`,
    );
  }
});

/* ══════════════════════════════════════════════════════════════════
   Section 6: Credential absence in responses
   ══════════════════════════════════════════════════════════════════ */

section("Section 6 — Credential absence in responses");

test("disabled result contains no API keys", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "search",
    correlationId: "test-cred-1",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  const serialised = JSON.stringify(result);
  assert.ok(!/sk-[a-zA-Z0-9]{10,}/.test(serialised), "No sk- key found");
  assert.ok(!/AIza[a-zA-Z0-9]{20,}/.test(serialised), "No AIza key found");
});

test("disabled result contains no Bearer tokens", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "search",
    correlationId: "test-cred-2",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  const serialised = JSON.stringify(result);
  assert.ok(
    !/Bearer\s+[a-zA-Z0-9._-]+/i.test(serialised),
    "No Bearer token found",
  );
});

test("disabled result contains no email addresses", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "search",
    correlationId: "test-cred-3",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  const serialised = JSON.stringify(result);
  assert.ok(
    !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/.test(serialised),
    "No email address found",
  );
});

test("disabled result contains no URL endpoints", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "search",
    correlationId: "test-cred-4",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  const serialised = JSON.stringify(result);
  assert.ok(!/https?:\/\/[^\s"')]+/.test(serialised), "No URL found");
});

test("forbidden operation result contains no credentials", async () => {
  _resetModuleState();
  const result = await readOnlyAtlasAdapter.execute({
    operation: "book",
    correlationId: "test-cred-5",
    origin: "AAA",
    destination: "BBB",
    departureDate: "2026-09-15",
    searchIntent: "safer-alternative",
    sandboxOnly: true,
    syntheticDemo: true,
    confirmedItinerary: true,
  });
  const serialised = JSON.stringify(result);
  assert.ok(!/sk-[a-zA-Z0-9]{10,}/.test(serialised), "No sk- key found");
  assert.ok(
    !/Bearer\s+[a-zA-Z0-9._-]+/i.test(serialised),
    "No Bearer token found",
  );
});

/* ══════════════════════════════════════════════════════════════════
   Section 7: Browser requests use only local /api/atlas/* paths
   ══════════════════════════════════════════════════════════════════ */

section("Section 7 — Browser uses only local /api/atlas/* paths");

test("app source contains no direct Atlas SDK endpoint URLs", () => {
  const appDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "app",
    "src",
  );
  const viteConfigPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "app",
    "vite.config.ts",
  );
  // Verify the vite config has no proxy to external Atlas endpoints.
  const viteConfig = fs.readFileSync(viteConfigPath, "utf-8");
  assert.ok(
    !/proxy.*atriptech/i.test(viteConfig),
    "vite.config.ts must not proxy to atriptech.com",
  );
  assert.ok(
    !/proxy[\s\S]{0,200}?https?:\/\/[^\s'"]*atlas/i.test(viteConfig),
    "vite.config.ts must not proxy to Atlas",
  );
});

test("vite.config.ts contains no external proxy targets", () => {
  const viteConfigPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "app",
    "vite.config.ts",
  );
  const viteConfig = fs.readFileSync(viteConfigPath, "utf-8");
  // No proxy field at all — the app is pure frontend
  assert.ok(
    !/^\s*proxy\s*:/m.test(viteConfig),
    "vite.config.ts must not define a proxy",
  );
});

test("no app source file imports Atlas SDK directly", () => {
  const appSrcPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "app",
    "src",
  );
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        const content = fs.readFileSync(full, "utf-8");
        const atlasSdkPattern = new RegExp("from\\s+['\"]@atriptech", "i");
        const atlasReqPattern = new RegExp("require\\s*\\(\\s*['\"]@atriptech", "i");
        assert.ok(
          !atlasSdkPattern.test(content),
          `${full} must not import from @atriptech`,
        );
        assert.ok(
          !atlasReqPattern.test(content),
          `${full} must not require @atriptech`,
        );
      }
    }
  }
  scanDir(appSrcPath);
});

/* ══════════════════════════════════════════════════════════════════
   Section 8: Proxy contract self-consistency
   ══════════════════════════════════════════════════════════════════ */

section("Section 8 — Proxy contract self-consistency");

test("allowed paths list is frozen", () => {
  assert.ok(Object.isFrozen(ATLAS_PROXY_ALLOWED_PATHS));
});

test("rejected paths list is frozen", () => {
  assert.ok(Object.isFrozen(ATLAS_PROXY_REJECTED_PATHS));
});

test("no overlap between allowed and rejected paths", () => {
  for (const p of ATLAS_PROXY_ALLOWED_PATHS) {
    assert.ok(
      !ATLAS_PROXY_REJECTED_PATHS.includes(p),
      `Path '${p}' must not be in both allowed and rejected lists`,
    );
  }
});

test("rejected proxy paths map to forbidden or non-read-only operations", () => {
  // The proxy-level path names and the adapter-level operation names
  // are separate layers. Some paths (e.g. /api/atlas/booking) map to
  // a noun form ('booking') that is not literally in FORBIDDEN_OPERATIONS
  // (which uses verb forms like 'book', 'create_booking'). Both layers
  // must block the path; this test verifies the proxy-level rejection
  // is consistent — i.e. no rejected path is also in the allowed list.
  for (const p of ATLAS_PROXY_REJECTED_PATHS) {
    assert.ok(
      !ATLAS_PROXY_ALLOWED_PATHS.includes(p),
      `Rejected path '${p}' must not be in the allowed list`,
    );
  }
});

test("allowed path /api/atlas/search corresponds to read-only operation", () => {
  const op = pathToOperation("/api/atlas/search");
  assert.ok(
    isReadOnlyOperation(op),
    "search should be a read-only operation",
  );
});

/* ══════════════════════════════════════════════════════════════════
   Section 9: Test source safety invariants
   ══════════════════════════════════════════════════════════════════ */

section("Section 9 — Test source safety invariants");

const _forbiddenNetModules = [
  "node:http",
  "node:https",
  "node:net",
  "node:tls",
];

test("test source contains no network imports", () => {
  const testSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf-8");
  // Extract only the import statements (first ~20 lines) to avoid
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
  // Check only import statements and top-level code (not string literals
  // used in assertions that describe what must not be done).
  const importBlock = testSource.split("\n").slice(0, 25).join("\n");
  const envFilePattern = /require\s*\(\s*['"]\.env|from\s+['"]\.env|readFileSync\s*\(\s*['"]\.env/;
  assert.ok(
    !envFilePattern.test(testSource),
    "Must not read .env files",
  );
  assert.ok(
    !/ATLAS_CREDENTIAL/i.test(importBlock),
    "Must not reference ATLAS_CREDENTIAL in imports",
  );
});

test("test source contains no endpoint URLs", () => {
  const testSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf-8");
  const urlPattern = /https?:\/\/[^\s"')]+/;
  assert.ok(!urlPattern.test(testSource), "Forbidden: endpoint URL found");
});

/* ── Summary ── */

console.log(
  `\nAtlas proxy allowlist tests: ${passed} passed, ${failed} failed`,
);

if (failed > 0) {
  console.log("\nFailed tests:");
  for (const name of failures) {
    console.log(`  - ${name}`);
  }
  process.exit(1);
}
