/* ── Atlas simulated ticketing state machine ──
 *
 * Local-only simulation. No Atlas order, payment, or ticket is created.
 * Demonstrates the order lifecycle shape for the Atlas hackathon demo.
 *
 * State machine:
 *   IDLE -> SIMULATED_ORDER_CREATED -> SIMULATED_PAYMENT_PENDING ->
 *   SIMULATED_TICKETED -> SIMULATION_COMPLETE
 *
 * Each transition is triggered by user action with a deliberate delay. */

import type {
  SimulatedTicketingLifecycle,
  SimulatedTicketingStep,
} from '../contracts/envelopes';

/* ── Types ── */

export type SimulationState =
  | 'idle'
  | 'simulated-order-created'
  | 'simulated-payment-pending'
  | 'simulated-ticketed'
  | 'simulation-complete';

export interface SimulationTransition {
  fromState: SimulationState;
  toState: SimulationState;
  step: SimulatedTicketingStep;
  delayMs: number;
}

/* ── Transition definitions ── */

const TRANSITIONS: SimulationTransition[] = [
  {
    fromState: 'idle',
    toState: 'simulated-order-created',
    step: {
      step: 'order-created',
      status: 'simulated',
      simulatedAt: '',
      disclaimer: 'SIMULATION ONLY — no real order created',
    },
    delayMs: 1500,
  },
  {
    fromState: 'simulated-order-created',
    toState: 'simulated-payment-pending',
    step: {
      step: 'payment-pending',
      status: 'simulated',
      simulatedAt: '',
      disclaimer: 'SIMULATION ONLY — no real payment created',
    },
    delayMs: 1200,
  },
  {
    fromState: 'simulated-payment-pending',
    toState: 'simulated-ticketed',
    step: {
      step: 'ticket-issued',
      status: 'simulated',
      simulatedAt: '',
      disclaimer: 'SIMULATION ONLY — no real ticket created',
    },
    delayMs: 2000,
  },
];

const FINAL_DISCLAIMER =
  'SIMULATION ONLY — no real order, payment, or ticket created' as const;

/* ── State machine ── */

/**
 * Returns the next transition from the current state, or null if complete.
 */
export function getNextTransition(
  currentState: SimulationState,
): SimulationTransition | null {
  return TRANSITIONS.find((t) => t.fromState === currentState) ?? null;
}

/**
 * Advances the simulation by one step. Returns the new state and the
 * step record with a timestamp. Returns null if already complete.
 */
export function advanceSimulation(
  currentState: SimulationState,
): { newState: SimulationState; step: SimulatedTicketingStep; delayMs: number } | null {
  const transition = getNextTransition(currentState);
  if (!transition) return null;

  const step: SimulatedTicketingStep = {
    ...transition.step,
    simulatedAt: new Date().toISOString(),
  };

  return {
    newState: transition.toState,
    step,
    delayMs: transition.delayMs,
  };
}

/**
 * Runs the full simulation synchronously (for envelope creation).
 * Returns the completed lifecycle record.
 */
export function runFullSimulation(): SimulatedTicketingLifecycle {
  const steps: SimulatedTicketingStep[] = [];
  let state: SimulationState = 'idle';

  for (const transition of TRANSITIONS) {
    if (transition.fromState !== state) break;
    steps.push({
      ...transition.step,
      simulatedAt: new Date().toISOString(),
    });
    state = transition.toState;
  }

  return {
    simulationOnly: true,
    steps,
    finalDisclaimer: FINAL_DISCLAIMER,
  };
}

/**
 * Checks whether simulation can be enabled based on feature flags.
 * Simulation requires ATLAS_TICKETING_SIMULATION_ENABLED=true AND
 * ATLAS_WRITES_ENABLED=false.
 */
export function canEnableSimulation(flags: {
  ATLAS_TICKETING_SIMULATION_ENABLED: boolean;
  ATLAS_WRITES_ENABLED: boolean;
}): boolean {
  return (
    flags.ATLAS_TICKETING_SIMULATION_ENABLED === true &&
    flags.ATLAS_WRITES_ENABLED === false
  );
}

/**
 * Returns the initial simulation state.
 */
export function getInitialState(): SimulationState {
  return 'idle';
}

/**
 * Returns whether the simulation is complete.
 */
export function isSimulationComplete(state: SimulationState): boolean {
  return state === 'simulation-complete';
}

/**
 * Returns all step labels for display purposes.
 */
export function getStepLabels(): Array<{ step: string; label: string }> {
  return [
    { step: 'order-created', label: 'Order Created (simulated)' },
    { step: 'payment-pending', label: 'Payment Pending (simulated)' },
    { step: 'ticket-issued', label: 'Ticket Issued (simulated)' },
  ];
}
