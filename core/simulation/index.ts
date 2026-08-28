/* ── Simulation barrel export ── */

export type {
  SimulationState,
  SimulationTransition,
} from './ticketing';

export {
  advanceSimulation,
  runFullSimulation,
  canEnableSimulation,
  getInitialState,
  isSimulationComplete,
  getNextTransition,
  getStepLabels,
} from './ticketing';

/* ── Atlas Sandbox write rehearsal state machine (pure, fail closed) ── */

export type {
  SandboxOrderState,
  SandboxWriteOperation,
  WriteConfirmation,
  SandboxOrderEvent,
  TransitionContext,
  SandboxProviderOutcome,
} from './sandbox-order-states';

export {
  SANDBOX_ORDER_STATES,
  SANDBOX_TERMINAL_STATES,
  SANDBOX_UNKNOWN_OUTCOME_STATES,
  canTransition,
  transition,
  isKnownState,
  getInitialState as getSandboxInitialState,
  isTerminalState,
  isUnknownOutcomeState,
  canAttemptWrite,
  mapProviderOutcome,
} from './sandbox-order-states';
