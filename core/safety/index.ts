/* ── Safety barrel export ── */

export {
  SafetyGateError,
  checkTicketingPrerequisites,
  assertWriteBlocked,
  assertUserConfirmed,
  validateOperationPermission,
} from './gates';

export type {
  TicketingPrerequisites,
  PrerequisiteCheck,
} from './gates';

export {
  looksLikeSecret,
  redactForLogging,
  createSafeLogger,
  assertNoSecrets,
} from './secrets';
