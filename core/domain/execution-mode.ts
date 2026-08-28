/* ── Execution mode types and provenance labels ──
 *
 * Every result must declare exactly one execution mode.
 * Labels are never displayed for a mode that wasn't actually executed.
 * Fallback data is always labelled as such — never as "live". */

/** Execution mode for a recovery-plan result. */
export type ExecutionMode =
  | 'local-fallback'
  | 'daytona-offline-mock'
  | 'daytona-live-risk'
  | 'nosana-offline'
  | 'nosana-live'
  | 'atlas-test-data'
  | 'atlas-production-reference';

/** All valid execution modes (for validation). */
export const VALID_EXECUTION_MODES: readonly ExecutionMode[] = Object.freeze([
  'local-fallback',
  'daytona-offline-mock',
  'daytona-live-risk',
  'nosana-offline',
  'nosana-live',
  'atlas-test-data',
  'atlas-production-reference',
]);

/** Provenance label for a given execution mode. */
export interface ExecutionModeLabel {
  /** The execution mode. */
  mode: ExecutionMode;
  /** Human-readable provenance label for UI display. */
  provenanceLabel: string;
  /** Whether this mode represents a live (non-mock) execution. */
  isLive: boolean;
}

/**
 * Returns the provenance label for a given execution mode.
 *
 * Stage 1 always uses 'local-fallback' with the label:
 * "Local fallback — Daytona risk computation not executed"
 */
export function getExecutionModeLabel(mode: ExecutionMode): ExecutionModeLabel {
  switch (mode) {
    case 'local-fallback':
      return {
        mode,
        provenanceLabel:
          'Local fallback \u2014 Daytona risk computation not executed',
        isLive: false,
      };
    case 'daytona-offline-mock':
      return {
        mode,
        provenanceLabel:
          'Daytona sandbox \u2014 risk analysis computed locally, no live risk service called',
        isLive: false,
      };
    case 'daytona-live-risk':
      return {
        mode,
        provenanceLabel:
          'Daytona live risk computation \u2014 read-only, sandboxed',
        isLive: true,
      };
    case 'nosana-offline':
      return {
        mode,
        provenanceLabel:
          'Nosana workload prepared and offline-validated \u2014 no live job executed',
        isLive: false,
      };
    case 'nosana-live':
      return {
        mode,
        provenanceLabel:
          'Nosana live workload \u2014 decentralized GPU evidence',
        isLive: true,
      };
    case 'atlas-test-data':
      return {
        mode,
        provenanceLabel:
          'Atlas demo data \u2014 demo alternatives, not live inventory',
        isLive: false,
      };
    case 'atlas-production-reference':
      return {
        mode,
        provenanceLabel:
          'Atlas production Search \u2014 reference prices only, read-only',
        isLive: true,
      };
  }
}

/** Returns whether the given execution mode is live. */
export function isExecutionModeLive(mode: ExecutionMode): boolean {
  return getExecutionModeLabel(mode).isLive;
}

/**
 * Validates that a string is a valid ExecutionMode.
 * Returns the mode if valid, or 'local-fallback' as the safe default.
 */
export function resolveExecutionMode(value: string | undefined): ExecutionMode {
  if (value !== undefined && VALID_EXECUTION_MODES.includes(value as ExecutionMode)) {
    return value as ExecutionMode;
  }
  return 'local-fallback';
}
