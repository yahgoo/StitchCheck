// Offline unit tests for the Atlas Sandbox write rehearsal state machine
// (core/simulation/sandbox-order-states.ts).
//
// Run:  node sandbox-order-state-tests.mjs
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//   - No network, no CLI, no credentials, no .env files touched.
//   - Node strips the TypeScript types natively (erasable syntax only).
//
// Exit code 0 = all tests passed. Exit code 1 = one or more failures.

import {
  SANDBOX_ORDER_STATES,
  SANDBOX_TERMINAL_STATES,
  SANDBOX_UNKNOWN_OUTCOME_STATES,
  canTransition,
  transition,
  isKnownState,
  getInitialState,
  isTerminalState,
  isUnknownOutcomeState,
  canAttemptWrite,
  mapProviderOutcome,
} from '../core/simulation/sandbox-order-states.ts';

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
    failures.push(message);
    console.log(`    ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

/* ── Event fixtures ── */

const ORDER_CONFIRM = { confirmationToken: 'tok_order_1', idempotencyKey: 'idem_order_1' };
const PAY_CONFIRM = { confirmationToken: 'tok_pay_1', idempotencyKey: 'idem_pay_1' };

/* ── Tests ── */

async function runTests() {
  console.log('Sandbox Order State Machine Tests\n');

  /* ── 1. Exact state set ── */
  section('1. Exact state set');
  {
    const expectedStates = [
      'hidden', 'opt-in', 'order-review', 'order-submitting',
      'order-created-unpaid', 'payment-review', 'payment-submitting',
      'pay-accepted', 'status-polling', 'ticketed-simulated', 'cancelled',
      'gate-rejected', 'cli-error', 'unknown-create', 'unknown-pay',
      'safely-stopped',
    ];
    assertEqual(SANDBOX_ORDER_STATES.length, expectedStates.length, 'state list has exactly 16 states');
    for (const s of expectedStates) {
      assert(SANDBOX_ORDER_STATES.includes(s), `state '${s}' exists`);
      assert(isKnownState(s), `'${s}' is a known state`);
    }
    assert(!SANDBOX_ORDER_STATES.includes('ticketed'), "'ticketed' does NOT exist — only 'ticketed-simulated'");
    assertEqual(getInitialState(), 'hidden', 'initial state is hidden');
  }

  /* ── 2. No write state reachable from hidden without opt-in ── */
  section('2. hidden requires explicit opt-in');
  {
    const writeStates = new Set([
      'order-review', 'order-submitting', 'order-created-unpaid',
      'payment-review', 'payment-submitting', 'pay-accepted',
      'status-polling', 'ticketed-simulated',
    ]);
    const allEvents = [
      { type: 'hide' }, { type: 'review-payment' },
      { type: 'submit-order', ...ORDER_CONFIRM },
      { type: 'submit-pay', ...PAY_CONFIRM },
      { type: 'order-accepted', orderNo: 'o1' },
      { type: 'order-gate-rejected' }, { type: 'order-cli-error' },
      { type: 'order-outcome-unknown' }, { type: 'pay-accepted' },
      { type: 'pay-gate-rejected' }, { type: 'pay-cli-error' },
      { type: 'pay-outcome-unknown' }, { type: 'start-polling' },
      { type: 'status-ticketed-simulated' }, { type: 'status-cancelled' },
      { type: 'poll-budget-exhausted' }, { type: 'status-check' },
      { type: 'status-unknown' }, { type: 'reset' },
    ];
    for (const event of allEvents) {
      const next = transition('hidden', event);
      assert(
        next === null || !writeStates.has(next),
        `hidden + '${event.type}' never reaches a write state`,
      );
    }
    assertEqual(transition('hidden', { type: 'opt-in' }), 'opt-in', 'hidden + opt-in → opt-in');
  }

  /* ── 3. Happy path requires separate Order/Pay confirmations ── */
  section('3. Happy path with separate confirmations');
  {
    let state = 'hidden';
    state = transition(state, { type: 'opt-in' });
    assertEqual(state, 'opt-in', 'opt-in acknowledged');
    state = transition(state, { type: 'reset' });
    assertEqual(state, 'order-review', 'opt-in → order-review');
    assert(canAttemptWrite(state, 'order'), 'order attempt allowed from order-review');
    assert(!canAttemptWrite(state, 'pay'), 'pay attempt NOT allowed from order-review');
    state = transition(state, { type: 'submit-order', ...ORDER_CONFIRM });
    assertEqual(state, 'order-submitting', 'submit-order (confirmed) → order-submitting');
    state = transition(state, { type: 'order-accepted', orderNo: 'ord_123' });
    assertEqual(state, 'order-created-unpaid', 'order accepted → order-created-unpaid');
    state = transition(state, { type: 'review-payment' });
    assertEqual(state, 'payment-review', 'payment review entered explicitly');
    assert(canAttemptWrite(state, 'pay'), 'pay attempt allowed from payment-review');
    state = transition(state, { type: 'submit-pay', ...PAY_CONFIRM });
    assertEqual(state, 'payment-submitting', 'submit-pay (confirmed) → payment-submitting');
    state = transition(state, { type: 'pay-accepted' });
    assertEqual(state, 'pay-accepted', 'pay accepted');
    state = transition(state, { type: 'start-polling' });
    assertEqual(state, 'status-polling', 'polling started');
    state = transition(state, { type: 'status-ticketed-simulated' });
    assertEqual(state, 'ticketed-simulated', 'terminal simulated ticket state');
    assert(isTerminalState(state), 'ticketed-simulated is terminal');
  }

  /* ── 4. Write events without confirmation are rejected ── */
  section('4. Confirmation + idempotency key required on writes');
  {
    assertEqual(
      transition('order-review', { type: 'submit-order' }),
      null, 'submit-order without token/key is forbidden');
    assertEqual(
      transition('order-review', { type: 'submit-order', confirmationToken: '', idempotencyKey: 'k' }),
      null, 'submit-order with empty token is forbidden');
    assertEqual(
      transition('payment-review', { type: 'submit-pay', confirmationToken: 't', idempotencyKey: '' }),
      null, 'submit-pay with empty key is forbidden');
    assertEqual(
      transition('payment-review', { type: 'submit-pay' }),
      null, 'submit-pay without token/key is forbidden');
    // A pay confirmation cannot drive an order submission.
    assertEqual(
      transition('order-review', { type: 'submit-pay', ...PAY_CONFIRM }),
      null, 'submit-pay is not valid from order-review');
  }

  /* ── 5. Stale idempotency keys are rejected ── */
  section('5. New attempt needs a fresh idempotency key');
  {
    const ctx = { usedIdempotencyKeys: new Set(['idem_order_1']) };
    assert(
      !canTransition('order-review', { type: 'submit-order', ...ORDER_CONFIRM }, ctx),
      'reused idempotency key is rejected');
    assert(
      canTransition('order-review', { type: 'submit-order', confirmationToken: 'tok_new', idempotencyKey: 'idem_new' }, ctx),
      'fresh confirmation + fresh key is accepted');
    const ctxArray = { usedIdempotencyKeys: ['idem_order_1'] };
    assert(
      !canTransition('order-review', { type: 'submit-order', ...ORDER_CONFIRM }, ctxArray),
      'array-form used keys also rejected');
  }

  /* ── 6. Unknown outcomes never auto-retry ── */
  section('6. Unknown outcomes: no automatic retry');
  {
    for (const unknown of SANDBOX_UNKNOWN_OUTCOME_STATES) {
      assert(isUnknownOutcomeState(unknown), `'${unknown}' is an unknown-outcome state`);
      const retryEvents = [
        { type: 'submit-order', ...ORDER_CONFIRM },
        { type: 'submit-pay', ...PAY_CONFIRM },
        { type: 'order-accepted', orderNo: 'o' },
        { type: 'pay-accepted' },
        { type: 'start-polling' },
      ];
      for (const event of retryEvents) {
        assertEqual(
          transition(unknown, event), null,
          `${unknown}: '${event.type}' cannot retry forward`);
      }
      // Only status-check / reset / hide are available.
      assert(canTransition(unknown, { type: 'status-check' }), `${unknown}: status-check allowed`);
      assertEqual(transition(unknown, { type: 'reset' }), 'order-review', `${unknown}: reset returns to order-review`);
    }
    // After reset, a NEW write needs a NEW confirmation event (table shape).
    assert(
      canTransition('order-review', { type: 'submit-order', confirmationToken: 'tok_2', idempotencyKey: 'idem_2' }),
      'new attempt after reset requires (and accepts) a fresh confirmation event');
  }

  /* ── 7. Error states fail closed ── */
  section('7. Gate/CLI error states');
  {
    assertEqual(transition('order-submitting', { type: 'order-gate-rejected' }), 'gate-rejected', 'order gate rejection');
    assertEqual(transition('order-submitting', { type: 'order-cli-error' }), 'cli-error', 'order CLI error');
    assertEqual(transition('payment-submitting', { type: 'pay-gate-rejected' }), 'gate-rejected', 'pay gate rejection');
    assertEqual(transition('payment-submitting', { type: 'pay-cli-error' }), 'cli-error', 'pay CLI error');
    assertEqual(transition('gate-rejected', { type: 'submit-order', ...ORDER_CONFIRM }), null,
      'gate-rejected cannot submit directly — reset first');
    assertEqual(transition('cli-error', { type: 'submit-pay', ...PAY_CONFIRM }), null,
      'cli-error cannot submit directly — reset first');
  }

  /* ── 8. Terminal states accept nothing ── */
  section('8. Terminal states');
  {
    for (const terminal of SANDBOX_TERMINAL_STATES) {
      assert(isTerminalState(terminal), `'${terminal}' is terminal`);
      const events = [
        { type: 'opt-in' }, { type: 'submit-order', ...ORDER_CONFIRM },
        { type: 'submit-pay', ...PAY_CONFIRM }, { type: 'start-polling' },
      ];
      for (const event of events) {
        assertEqual(transition(terminal, event), null, `${terminal}: '${event.type}' forbidden`);
      }
    }
    // safely-stopped allows manual status re-checks (and app restart via
    // reset/hide) but never a write.
    assert(canTransition('safely-stopped', { type: 'status-check' }), 'safely-stopped allows manual status check');
    assert(canTransition('safely-stopped', { type: 'reset' }), 'safely-stopped allows app restart reset');
    assertEqual(
      transition('safely-stopped', { type: 'submit-pay', ...PAY_CONFIRM }), null,
      'safely-stopped never accepts a write');
    assertEqual(transition('status-polling', { type: 'poll-budget-exhausted' }), 'safely-stopped',
      'poll budget exhausted → safely-stopped');
    assertEqual(transition('status-polling', { type: 'status-cancelled' }), 'cancelled',
      'status cancelled → terminal cancelled');
  }

  /* ── 9. Provider outcome mapping fails closed ── */
  section('9. Unknown/numeric provider codes never succeed');
  {
    assertEqual(mapProviderOutcome('order', 'PAYMENT_CONFIRMATION_REQUIRED'), 'accepted', 'known order code accepted');
    assertEqual(mapProviderOutcome('order', 'DUPLICATE_BOOKING_SUSPECTED'), 'accepted', 'duplicate-suspected adopts existing order');
    assertEqual(mapProviderOutcome('pay', 'PAYMENT_ACCEPTED'), 'accepted', 'known pay code accepted');
    assertEqual(mapProviderOutcome('order', 'ORDER_CREATION_UNKNOWN'), 'unknown', 'unknown-create code');
    assertEqual(mapProviderOutcome('pay', 'PAYMENT_STATUS_UNKNOWN'), 'unknown', 'unknown-pay code');
    assertEqual(mapProviderOutcome('pay', 'PAYMENT_PROCESSING'), 'unknown', 'processing maps to unknown');
    for (const code of ['0', '1', '2', '-3', '99']) {
      assertEqual(mapProviderOutcome('order', code), 'unknown', `numeric order code '${code}' → unknown`);
      assertEqual(mapProviderOutcome('pay', code), 'unknown', `numeric pay code '${code}' → unknown`);
    }
    assertEqual(mapProviderOutcome('order', null), 'unknown', 'null code → unknown');
    assertEqual(mapProviderOutcome('order', ''), 'unknown', 'empty code → unknown');
    assertEqual(mapProviderOutcome('order', 'SOME_UNSEEN_CODE'), 'unknown', 'unrecognized named code → unknown');
    assertEqual(mapProviderOutcome('pay', 'PAYMENT_CONFIRMATION_REQUIRED'), 'unknown',
      'order code is not accepted for pay (operation-bound)');
  }

  /* ── 10. Invalid inputs fail closed ── */
  section('10. Invalid inputs');
  {
    assertEqual(transition('not-a-state', { type: 'opt-in' }), null, 'unknown state rejected');
    assertEqual(canTransition('hidden', null), false, 'null event rejected');
    assertEqual(transition('order-submitting', { type: 'order-accepted', orderNo: '' }), null,
      'order-accepted without orderNo rejected');
  }

  /* ── Summary ── */
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
