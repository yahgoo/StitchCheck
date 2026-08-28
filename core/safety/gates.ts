/* ── Safety gates ──
 *
 * Confirmation gate, write rejection, and feature flag evaluation.
 * These gates ensure that:
 *   1. No downstream work occurs before explicit user confirmation.
 *   2. No write operation can execute without all prerequisites.
 *   3. Feature flags are evaluated consistently. */

import { type ResolvedFlags } from '../flags/feature-flags';

/* ── Error class for safety gate violations ── */

export class SafetyGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafetyGateError';
  }
}

/* ── Ticketing prerequisites ── */

export interface TicketingPrerequisites {
  accountActivation: boolean;
  sandboxCredentials: boolean;
  paymentMethod: boolean;
  refundVoidPath: boolean;
  idempotencyBehavior: boolean;
  writtenPermission: boolean;
  explicitHumanApproval: boolean;
}

export interface PrerequisiteCheck {
  allMet: boolean;
  missing: string[];
  prereqs: TicketingPrerequisites;
}

/**
 * Checks whether all 7 ticketing prerequisites are met.
 * In the current implementation, all prerequisites default to false
 * because real ticketing has not been activated.
 */
export function checkTicketingPrerequisites(
  overrides?: Partial<TicketingPrerequisites>,
): PrerequisiteCheck {
  const prereqs: TicketingPrerequisites = {
    accountActivation: false,
    sandboxCredentials: false,
    paymentMethod: false,
    refundVoidPath: false,
    idempotencyBehavior: false,
    writtenPermission: false,
    explicitHumanApproval: false,
    ...overrides,
  };

  const missing: string[] = [];
  if (!prereqs.accountActivation) missing.push('account_activation');
  if (!prereqs.sandboxCredentials) missing.push('sandbox_credentials');
  if (!prereqs.paymentMethod) missing.push('payment_method');
  if (!prereqs.refundVoidPath) missing.push('refund_void_path');
  if (!prereqs.idempotencyBehavior) missing.push('idempotency_behavior');
  if (!prereqs.writtenPermission) missing.push('written_permission');
  if (!prereqs.explicitHumanApproval) missing.push('explicit_human_approval');

  return {
    allMet: missing.length === 0,
    missing,
    prereqs,
  };
}

/**
 * Asserts that writes are blocked. Throws SafetyGateError if
 * ATLAS_WRITES_ENABLED=true but prerequisites are not met.
 */
export function assertWriteBlocked(flags: ResolvedFlags): void {
  if (flags.ATLAS_WRITES_ENABLED === true) {
    const prereqs = checkTicketingPrerequisites();
    if (!prereqs.allMet) {
      throw new SafetyGateError(
        'ATLAS_WRITES_ENABLED=true but prerequisites not met: ' +
          prereqs.missing.join(', '),
      );
    }
  }
}

/**
 * Asserts that the user has explicitly confirmed the itinerary
 * before any downstream work is allowed.
 */
export function assertUserConfirmed(userConfirmed: boolean): void {
  if (!userConfirmed) {
    throw new SafetyGateError(
      'Downstream work blocked: user has not confirmed the itinerary',
    );
  }
}

/**
 * Validates that a requested operation is allowed under the current flags.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export function validateOperationPermission(
  operation: string,
  _flags: ResolvedFlags,
): { allowed: boolean; reason?: string } {
  const readOnlyOps = ['search', 'compare', 'verify'];
  const forbiddenOps = [
    'book', 'create_booking', 'reserve', 'ticket', 'issue',
    'pay', 'purchase', 'cancel', 'change', 'refund', 'order',
  ];

  if (forbiddenOps.includes(operation)) {
    return { allowed: false, reason: `operation '${operation}' is forbidden` };
  }

  if (readOnlyOps.includes(operation)) {
    return { allowed: true };
  }

  return { allowed: false, reason: `unknown operation '${operation}'` };
}
