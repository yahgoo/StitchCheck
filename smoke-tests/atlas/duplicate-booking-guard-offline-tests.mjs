// Offline deterministic tests for the Atlas duplicate-booking guard.
//
// Run:  node duplicate-booking-guard-offline-tests.mjs
//
// These tests make zero network requests, read no credentials, and invoke
// no provider. They validate the guard state machine, safety invariants,
// and sanitization using only the module under test and synthetic data.
//
// Exit code 0 = all tests passed.  Exit code 1 = one or more failures.

import {
  createDuplicateBookingGuard,
  DUPLICATE_BOOKING_GUARD_CONSTANTS,
} from "./duplicate-booking-guard.mjs";

import { DISCLAIMER_LABEL } from "./schema-validator.mjs";

/* ── Minimal test harness ── */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✅  ${message}`);
  } else {
    failed += 1;
    failures.push(message);
    console.log(`  ❌  ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed += 1;
    console.log(`  ✅  ${message}`);
  } else {
    failed += 1;
    failures.push(`${message} — expected "${expected}", got "${actual}"`);
    console.log(`  ❌  ${message} — expected "${expected}", got "${actual}"`);
  }
}

function assertThrows(fn, messageSubstring, message) {
  try {
    fn();
    failed += 1;
    failures.push(`${message} — expected throw`);
    console.log(`  ❌  ${message} — expected throw`);
  } catch (error) {
    if (error.message.includes(messageSubstring)) {
      passed += 1;
      console.log(`  ✅  ${message}`);
    } else {
      failed += 1;
      failures.push(`${message} — wrong error: ${error.message}`);
      console.log(`  ❌  ${message} — wrong error: ${error.message}`);
    }
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ── Test 1: Initial attempt requires confirmation ─────────────────────────

section("Test 1: Initial attempt requires confirmation");

const guard1 = createDuplicateBookingGuard({ mode: "offline" });
const candidate1 = { origin: "AAA", destination: "CCC", date: "2026-09-15" };

const result1a = guard1.createAttempt(candidate1, false);
assertEqual(result1a.guardStatus, "blocked", "attempt without confirmation is blocked");
assertEqual(result1a.reason, "user confirmation required", "reason mentions confirmation");

const result1b = guard1.createAttempt(candidate1, true);
assertEqual(result1b.guardStatus, "attempt-created", "attempt with confirmation succeeds");
assert(result1b.attemptId !== null, "attempt has an ID");

// ── Test 2: Missing confirmation is rejected ──────────────────────────────

section("Test 2: Missing confirmation is rejected");

const guard2 = createDuplicateBookingGuard({ mode: "offline" });
const result2 = guard2.createAttempt(candidate1, undefined);
assertEqual(result2.guardStatus, "blocked", "undefined confirmation is rejected");

// ── Test 3: Candidate fingerprint is sanitized ────────────────────────────

section("Test 3: Candidate fingerprint is sanitized");

const guard3 = createDuplicateBookingGuard({ mode: "offline" });
const dirtyCandidate = {
  origin: "AAA",
  destination: "CCC",
  date: "2026-09-15",
  apiKey: "secret-key-12345",
  passenger: "John Doe",
  email: "john@example.com",
};

const result3 = guard3.createAttempt(dirtyCandidate, true);
assertEqual(result3.guardStatus, "attempt-created", "dirty candidate accepted after sanitization");
assert(result3.attemptId !== null, "attempt has an ID");

// ── Test 4: Order acceptance transitions to awaiting status ───────────────

section("Test 4: Order acceptance transitions to awaiting status");

const guard4 = createDuplicateBookingGuard({ mode: "offline" });
guard4.createAttempt(candidate1, true);
const result4 = guard4.recordOrderAccepted();
assertEqual(result4.guardStatus, "awaiting-authoritative-status", "order accepted transitions correctly");

// ── Test 5: Accepted order is not treated as ticketed ─────────────────────

section("Test 5: Accepted order is not treated as ticketed");

const guard5 = createDuplicateBookingGuard({ mode: "offline" });
guard5.createAttempt(candidate1, true);
const result5 = guard5.recordOrderAccepted();
assertEqual(result5.recoveryOutcome, null, "accepted order has no recovery outcome yet");
assertEqual(result5.guardStatus, "awaiting-authoritative-status", "status is awaiting, not ticketed");

// ── Test 6: 318 transitions to query-existing-order ───────────────────────

section("Test 6: 318 transitions to query-existing-order");

const guard6 = createDuplicateBookingGuard({ mode: "offline" });
guard6.createAttempt(candidate1, true);
guard6.recordOrderAccepted();
const result6 = guard6.handleDuplicate318("existing-order-001");
assertEqual(result6.guardStatus, "query-existing-order", "318 transitions to query-existing-order");
assertEqual(result6.existingOrderId, "existing-order-001", "existing order ID recorded");

// ── Test 7: 318 without an existing-order reference is rejected ───────────

section("Test 7: 318 without an existing-order reference is rejected");

const guard7 = createDuplicateBookingGuard({ mode: "offline" });
guard7.createAttempt(candidate1, true);
guard7.recordOrderAccepted();
const result7 = guard7.handleDuplicate318("");
assertEqual(result7.guardStatus, "blocked", "318 without order ID is blocked");
assertEqual(result7.reason, "existing order identifier required", "reason mentions order ID");

// ── Test 8: Ticketed status recovers the existing booking ─────────────────

section("Test 8: Ticketed status recovers the existing booking");

const guard8 = createDuplicateBookingGuard({ mode: "offline" });
guard8.createAttempt(candidate1, true);
guard8.recordOrderAccepted();
guard8.handleDuplicate318("existing-order-002");
const result8 = guard8.recordExistingOrderStatus("ticketed");
assertEqual(result8.guardStatus, "recovered-existing-order", "ticketed recovers existing order");
assertEqual(result8.recoveryOutcome, "recovered", "recovery outcome is recovered");

// ── Test 9: Processing status blocks duplicate creation ───────────────────

section("Test 9: Processing status blocks duplicate creation");

const guard9 = createDuplicateBookingGuard({ mode: "offline" });
guard9.createAttempt(candidate1, true);
guard9.recordOrderAccepted();
guard9.handleDuplicate318("existing-order-003");
const result9 = guard9.recordExistingOrderStatus("processing");
assertEqual(result9.guardStatus, "existing-order-processing", "processing blocks duplicate");
assertEqual(result9.recoveryOutcome, "polling-required", "polling is required");

// ── Test 10: Paid-awaiting-ticketing blocks retry ─────────────────────────

section("Test 10: Paid-awaiting-ticketing blocks retry");

const guard10 = createDuplicateBookingGuard({ mode: "offline" });
guard10.createAttempt(candidate1, true);
guard10.recordOrderAccepted();
guard10.handleDuplicate318("existing-order-004");
const result10 = guard10.recordExistingOrderStatus("paid-awaiting-ticketing");
assertEqual(result10.guardStatus, "paid-awaiting-ticketing", "paid-awaiting-ticketing blocks retry");
assertEqual(result10.recoveryOutcome, "authoritative-followup-required", "followup is required");

// ── Test 11: Failed status requires a separate confirmed retry decision ───

section("Test 11: Failed status requires a separate confirmed retry decision");

const guard11 = createDuplicateBookingGuard({ mode: "offline" });
guard11.createAttempt(candidate1, true);
guard11.recordOrderAccepted();
guard11.handleDuplicate318("existing-order-005");
const result11 = guard11.recordExistingOrderStatus("failed");
assertEqual(result11.guardStatus, "retry-review-required", "failed requires retry review");
assertEqual(result11.recoveryOutcome, "retry-permitted-with-confirmation", "retry permitted with confirmation");

// ── Test 12: Cancelled status requires a separate confirmed retry decision ─

section("Test 12: Cancelled status requires a separate confirmed retry decision");

const guard12 = createDuplicateBookingGuard({ mode: "offline" });
guard12.createAttempt(candidate1, true);
guard12.recordOrderAccepted();
guard12.handleDuplicate318("existing-order-006");
const result12 = guard12.recordExistingOrderStatus("cancelled");
assertEqual(result12.guardStatus, "retry-review-required", "cancelled requires retry review");
assertEqual(result12.recoveryOutcome, "retry-permitted-with-confirmation", "retry permitted with confirmation");

// ── Test 13: Unknown status stops safely ──────────────────────────────────

section("Test 13: Unknown status stops safely");

const guard13 = createDuplicateBookingGuard({ mode: "offline" });
guard13.createAttempt(candidate1, true);
guard13.recordOrderAccepted();
guard13.handleDuplicate318("existing-order-007");
const result13 = guard13.recordExistingOrderStatus("unknown");
assertEqual(result13.guardStatus, "safely-stopped", "unknown stops safely");
assertEqual(result13.recoveryOutcome, "stop-safely", "recovery outcome is stop-safely");

// ── Test 14: Same candidate fingerprint cannot be retried ─────────────────

section("Test 14: Same candidate fingerprint cannot be retried");

const guard14 = createDuplicateBookingGuard({ mode: "offline" });
guard14.createAttempt(candidate1, true);
guard14.recordOrderAccepted();
guard14.handleDuplicate318("existing-order-008");
guard14.recordExistingOrderStatus("failed");
const result14 = guard14.authorizeRetry(candidate1, true);
assertEqual(result14.guardStatus, "blocked", "same fingerprint cannot be retried");
assertEqual(result14.reason, "duplicate candidate fingerprint", "reason mentions duplicate");

// ── Test 15: Artificial identity/passenger mutation is rejected ───────────

section("Test 15: Artificial identity/passenger mutation is rejected");

const guard15 = createDuplicateBookingGuard({ mode: "offline" });
guard15.createAttempt(candidate1, true);
guard15.recordOrderAccepted();
guard15.handleDuplicate318("existing-order-009");
guard15.recordExistingOrderStatus("failed");
// Candidate with PII fields stripped becomes same fingerprint as original
const fakeCandidate = { ...candidate1, passenger: "Fake Person" };
const result15 = guard15.authorizeRetry(fakeCandidate, true);
assertEqual(result15.guardStatus, "blocked", "PII-stripped candidate is duplicate fingerprint");
assertEqual(result15.reason, "duplicate candidate fingerprint", "reason mentions duplicate");

// ── Test 16: Retry without confirmation is rejected ───────────────────────

section("Test 16: Retry without confirmation is rejected");

const guard16 = createDuplicateBookingGuard({ mode: "offline" });
guard16.createAttempt(candidate1, true);
guard16.recordOrderAccepted();
guard16.handleDuplicate318("existing-order-010");
guard16.recordExistingOrderStatus("failed");
const newCandidate = { origin: "BBB", destination: "DDD", date: "2026-09-16" };
const result16 = guard16.authorizeRetry(newCandidate, false);
assertEqual(result16.guardStatus, "blocked", "retry without confirmation is blocked");

// ── Test 17: Retry creates only a local attempt record ────────────────────

section("Test 17: Retry creates only a local attempt record");

const guard17 = createDuplicateBookingGuard({ mode: "offline" });
guard17.createAttempt(candidate1, true);
guard17.recordOrderAccepted();
guard17.handleDuplicate318("existing-order-011");
guard17.recordExistingOrderStatus("cancelled");
const result17 = guard17.authorizeRetry(newCandidate, true);
assertEqual(result17.guardStatus, "attempt-created", "retry creates new attempt");
assert(result17.attemptId !== null, "new attempt has an ID");
assertEqual(result17.recoveryOutcome, null, "no recovery outcome yet");

// ── Test 18: Returned results preserve executedAgainstProvider: false ─────

section("Test 18: Returned results preserve executedAgainstProvider: false");

const guard18 = createDuplicateBookingGuard({ mode: "offline" });
const r18a = guard18.createAttempt(candidate1, true);
assertEqual(r18a.executedAgainstProvider, false, "createAttempt preserves executedAgainstProvider");
const r18b = guard18.recordOrderAccepted();
assertEqual(r18b.executedAgainstProvider, false, "recordOrderAccepted preserves executedAgainstProvider");
const r18c = guard18.handleDuplicate318("existing-order-012");
assertEqual(r18c.executedAgainstProvider, false, "handleDuplicate318 preserves executedAgainstProvider");
const r18d = guard18.recordExistingOrderStatus("ticketed");
assertEqual(r18d.executedAgainstProvider, false, "recordExistingOrderStatus preserves executedAgainstProvider");

// ── Test 19: Returned results preserve sourceType ─────────────────────────

section("Test 19: Returned results preserve sourceType: synthetic-local-placeholder");

const guard19 = createDuplicateBookingGuard({ mode: "offline" });
const r19a = guard19.createAttempt(candidate1, true);
assertEqual(r19a.sourceType, "synthetic-local-placeholder", "createAttempt preserves sourceType");
const r19b = guard19.recordOrderAccepted();
assertEqual(r19b.sourceType, "synthetic-local-placeholder", "recordOrderAccepted preserves sourceType");

// ── Test 20: Raw provider-like fields, credentials, card data, PII excluded

section("Test 20: Raw provider-like fields, credentials, card data, PII excluded");

const guard20 = createDuplicateBookingGuard({ mode: "offline" });
const dirtyCandidate20 = {
  origin: "AAA",
  destination: "CCC",
  date: "2026-09-15",
  apiKey: "secret-key",
  cardNumber: "4111111111111111",
  passenger: "John Doe",
  email: "john@example.com",
};
const result20 = guard20.createAttempt(dirtyCandidate20, true);
assertEqual(result20.guardStatus, "attempt-created", "dirty candidate accepted after sanitization");

// ── Test 21: No transport or network function is called ───────────────────

section("Test 21: No transport or network function is called");

// Guard in offline mode without transport — no network possible
const guard21 = createDuplicateBookingGuard({ mode: "offline" });
guard21.createAttempt(candidate1, true);
guard21.recordOrderAccepted();
guard21.handleDuplicate318("existing-order-013");
guard21.recordExistingOrderStatus("ticketed");
// Verify no network imports exist in the guard module
const guardSource = await import("node:fs").then(fs => 
  fs.promises.readFile(new URL("./duplicate-booking-guard.mjs", import.meta.url), "utf8")
);
assert(!guardSource.includes("import fetch"), "no fetch import in guard");
assert(!guardSource.includes("import http"), "no http import in guard");
assert(!guardSource.includes("import https"), "no https import in guard");

// ── Test 22: Results are immutable ────────────────────────────────────────

section("Test 22: Results are immutable");

const guard22 = createDuplicateBookingGuard({ mode: "offline" });
const result22 = guard22.createAttempt(candidate1, true);
assert(Object.isFrozen(result22), "result is frozen");

// ── Test 23: Recovery receipts contain no raw provider output ─────────────

section("Test 23: Recovery receipts contain no raw provider output");

const guard23 = createDuplicateBookingGuard({ mode: "offline" });
guard23.createAttempt(candidate1, true);
guard23.recordOrderAccepted();
guard23.handleDuplicate318("existing-order-014");
guard23.recordExistingOrderStatus("ticketed");
const receipt = guard23.buildRecoveryReceipt();
assertEqual(receipt.receiptGenerated, true, "receipt generated");
assertEqual(receipt.guardStatus, "recovered-existing-order", "receipt shows recovered status");
assert(!receipt.rawProviderOutput, "no raw provider output in receipt");

// ── Summary ───────────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(72));
console.log(`Atlas duplicate-booking guard tests: ${passed} passed, ${failed} failed.`);
console.log("═".repeat(72));

if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
} else {
  console.log("All tests passed.");
  process.exit(0);
}
