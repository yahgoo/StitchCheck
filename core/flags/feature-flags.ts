/* ── Feature flag definitions and defaults ──
 *
 * All flags default to disabled / safe values.
 * Flags are read from environment variables by orchestrator scripts.
 * The browser app never reads these directly. */

/* Node.js process type — available in orchestrator scripts, not in browser */
declare const process: { env: Record<string, string | undefined> } | undefined;

/* ── Flag value types ── */

export interface FeatureFlags {
  DAYTONA_ENABLED: boolean;
  /** Live Daytona risk computation. Safe default: false. Must remain
   *  false until a real sandbox lifecycle with evidence exists. */
  DAYTONA_RISK_COMPUTE_ENABLED: boolean;
  /** Nosana workload execution. Safe default: false. */
  NOSANA_ENABLED: boolean;
  /** Nosana live job execution. Safe default: false. */
  NOSANA_LIVE_ENABLED: boolean;
  ATLAS_LIVE_READ_ONLY: boolean;
  ATLAS_WRITES_ENABLED: boolean;
  ATLAS_TICKETING_SIMULATION_ENABLED: boolean;
  DEMO_MODE: DemoMode;
}

export type DemoMode = 'local' | 'daytona' | 'atlas';

/* ── Default values (all disabled) ── */

export const DEFAULT_FLAGS: Readonly<FeatureFlags> = Object.freeze({
  DAYTONA_ENABLED: false,
  DAYTONA_RISK_COMPUTE_ENABLED: false,
  NOSANA_ENABLED: false,
  NOSANA_LIVE_ENABLED: false,
  ATLAS_LIVE_READ_ONLY: false,
  ATLAS_WRITES_ENABLED: false,
  ATLAS_TICKETING_SIMULATION_ENABLED: false,
  DEMO_MODE: 'local',
});

/* ── Environment variable names ── */

const ENV_KEYS: Record<keyof FeatureFlags, string> = {
  DAYTONA_ENABLED: 'DAYTONA_ENABLED',
  DAYTONA_RISK_COMPUTE_ENABLED: 'DAYTONA_RISK_COMPUTE_ENABLED',
  NOSANA_ENABLED: 'NOSANA_ENABLED',
  NOSANA_LIVE_ENABLED: 'NOSANA_LIVE_ENABLED',
  ATLAS_LIVE_READ_ONLY: 'ATLAS_LIVE_READ_ONLY',
  ATLAS_WRITES_ENABLED: 'ATLAS_WRITES_ENABLED',
  ATLAS_TICKETING_SIMULATION_ENABLED: 'ATLAS_TICKETING_SIMULATION_ENABLED',
  DEMO_MODE: 'DEMO_MODE',
};

/* ── Parsers ── */

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  const lower = value.toLowerCase().trim();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  return fallback;
}

function parseDemoMode(value: string | undefined): DemoMode {
  if (value === 'daytona' || value === 'atlas' || value === 'local') return value;
  return 'local';
}

/* ── Resolved flags (after evaluation) ── */

export interface ResolvedFlags extends FeatureFlags {
  /** Whether the Daytona orchestrator may create sandboxes. */
  canCreateDaytonaSandbox: boolean;
  /** Whether Atlas read-only operations are permitted. */
  canRunAtlasReadOnly: boolean;
  /** Whether Atlas write operations are permitted (requires all prerequisites). */
  canRunAtlasWrites: boolean;
  /** Whether simulated ticketing UI is enabled. */
  canRunSimulation: boolean;
  /** Whether the app should use live evidence (any mode). */
  isLiveMode: boolean;
}

/**
 * Evaluates feature flags from environment variables.
 * Applies mode-specific constraints:
 *   - DEMO_MODE=daytona: DAYTONA_ENABLED must be true, WRITES must be false.
 *   - DEMO_MODE=atlas: DAYTONA_ENABLED must be false.
 *   - DEMO_MODE=local: all flags false.
 */
export function evaluateFlags(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): ResolvedFlags {
  const raw: FeatureFlags = {
    DAYTONA_ENABLED: parseBool(env[ENV_KEYS.DAYTONA_ENABLED], DEFAULT_FLAGS.DAYTONA_ENABLED),
    DAYTONA_RISK_COMPUTE_ENABLED: parseBool(
      env[ENV_KEYS.DAYTONA_RISK_COMPUTE_ENABLED],
      DEFAULT_FLAGS.DAYTONA_RISK_COMPUTE_ENABLED,
    ),
    NOSANA_ENABLED: parseBool(env[ENV_KEYS.NOSANA_ENABLED], DEFAULT_FLAGS.NOSANA_ENABLED),
    NOSANA_LIVE_ENABLED: parseBool(
      env[ENV_KEYS.NOSANA_LIVE_ENABLED],
      DEFAULT_FLAGS.NOSANA_LIVE_ENABLED,
    ),
    ATLAS_LIVE_READ_ONLY: parseBool(env[ENV_KEYS.ATLAS_LIVE_READ_ONLY], DEFAULT_FLAGS.ATLAS_LIVE_READ_ONLY),
    ATLAS_WRITES_ENABLED: parseBool(env[ENV_KEYS.ATLAS_WRITES_ENABLED], DEFAULT_FLAGS.ATLAS_WRITES_ENABLED),
    ATLAS_TICKETING_SIMULATION_ENABLED: parseBool(
      env[ENV_KEYS.ATLAS_TICKETING_SIMULATION_ENABLED],
      DEFAULT_FLAGS.ATLAS_TICKETING_SIMULATION_ENABLED,
    ),
    DEMO_MODE: parseDemoMode(env[ENV_KEYS.DEMO_MODE]),
  };

  /* Apply mode-specific constraints */
  let daytonaEnabled = raw.DAYTONA_ENABLED;
  let daytonaRiskCompute = raw.DAYTONA_RISK_COMPUTE_ENABLED;
  let nosanaEnabled = raw.NOSANA_ENABLED;
  let nosanaLive = raw.NOSANA_LIVE_ENABLED;
  let atlasLiveReadOnly = raw.ATLAS_LIVE_READ_ONLY;
  let atlasWrites = raw.ATLAS_WRITES_ENABLED;
  let simulation = raw.ATLAS_TICKETING_SIMULATION_ENABLED;

  switch (raw.DEMO_MODE) {
    case 'daytona':
      /* Daytona mode: writes must be off */
      atlasWrites = false;
      simulation = false;
      break;
    case 'atlas':
      /* Atlas mode: Daytona must be off */
      daytonaEnabled = false;
      daytonaRiskCompute = false;
      break;
    case 'local':
    default:
      /* Local mode: everything off */
      daytonaEnabled = false;
      daytonaRiskCompute = false;
      nosanaEnabled = false;
      nosanaLive = false;
      atlasLiveReadOnly = false;
      atlasWrites = false;
      simulation = false;
      break;
  }

  /* Simulation requires writes OFF */
  if (atlasWrites) {
    simulation = false;
  }

  return Object.freeze({
    ...raw,
    DAYTONA_ENABLED: daytonaEnabled,
    DAYTONA_RISK_COMPUTE_ENABLED: daytonaRiskCompute,
    NOSANA_ENABLED: nosanaEnabled,
    NOSANA_LIVE_ENABLED: nosanaLive,
    ATLAS_LIVE_READ_ONLY: atlasLiveReadOnly,
    ATLAS_WRITES_ENABLED: atlasWrites,
    ATLAS_TICKETING_SIMULATION_ENABLED: simulation,
    canCreateDaytonaSandbox: daytonaEnabled,
    canRunAtlasReadOnly: atlasLiveReadOnly,
    canRunAtlasWrites: atlasWrites,
    canRunSimulation: simulation,
    isLiveMode: daytonaEnabled || atlasLiveReadOnly,
  });
}
