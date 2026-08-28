/* ── StitchCheck shared core ──
 *
 * Canonical source for domain models, provenance labels,
 * evidence normalization, safety gates, feature flags,
 * and evidence envelope contracts.
 *
 * Used by:
 *   - app/ (browser SPA via TypeScript imports)
 *   - scripts/ (orchestrators via compiled output)
 *   - workers/ (Daytona sandbox worker) */

/* ── Domain models ── */
export type {
  FlightLeg,
  FieldConfidence,
  ExtractionResult,
  RiskResult,
  RiskScenario,
  Alternative,
  SearchResult,
  ComparisonOriginal,
  ComparisonAlternative,
  ComparisonData,
  AlternativesScenario,
  DecisionData,
  Decision,
  AppStep,
  DependencyNodeStatus,
  DependencyNodeKind,
  DependencyNode,
  DependencyGraph,
  RiskComputationSeed,
  RiskComputationResult,
  ExecutionMode,
  ExecutionModeLabel,
  RecoveryPlanFromRiskResult,
} from './domain';

export {
  computeRiskFromSeed,
  VALID_EXECUTION_MODES,
  getExecutionModeLabel,
  isExecutionModeLive,
  resolveExecutionMode,
  riskResultToAnimationData,
} from './domain';

/* ── Provenance ── */
export type {
  ProviderLiveStatus,
  ProviderStatusResult,
  ExtractionProvenance,
  GeminiProvenance,
  AtlasProvenance,
  NosanaProvenance,
  DaytonaProvenance,
} from './provenance';

export {
  deriveProviderStatus,
  createDaytonaProvenance,
  createDaytonaFallbackProvenance,
  EXTRACTION_PROVIDER_LABELS,
  GEMINI_LABELS,
  getExtractionProviderLabel,
  getGeminiLabel,
  ATLAS_UI_LABELS,
  getAtlasLabel,
  NOSANA_UI_LABELS,
  getNosanaLabel,
  OPENROUTER_HISTORICAL_LABEL,
  LABELS,
  DISABLED_MESSAGE,
  FINAL_STATEMENT,
  SANDBOX_WRITE_DISCLOSURE,
} from './provenance';

/* ── Evidence normalization ── */
export {
  FORBIDDEN_KEYS,
  stripForbiddenKeys,
  isForbiddenKey,
  createNormalizedFallbackResult,
  validateEvidenceBoundary,
} from './evidence';

/* ── Safety gates ── */
export {
  SafetyGateError,
  checkTicketingPrerequisites,
  assertWriteBlocked,
  assertUserConfirmed,
  validateOperationPermission,
  looksLikeSecret,
  redactForLogging,
  createSafeLogger,
  assertNoSecrets,
} from './safety';

export type {
  TicketingPrerequisites,
  PrerequisiteCheck,
} from './safety';

/* ── Feature flags ── */
export {
  DEFAULT_FLAGS,
  evaluateFlags,
} from './flags';

export type {
  FeatureFlags,
  DemoMode,
  ResolvedFlags,
} from './flags';

/* ── Evidence envelope contracts ── */
export type {
  DaytonaEvidenceEnvelope,
  DaytonaOperation,
  DaytonaRequestSummary,
  DaytonaResponseSummary,
  DaytonaEnvelopeProvenance,
  AtlasEvidenceEnvelope,
  AtlasOperation,
  AtlasEnvelopeProvenance,
  SimulatedTicketingLifecycle,
  SimulatedTicketingStep,
} from './contracts';

export {
  createDaytonaFallbackEnvelope,
  createAtlasFallbackEnvelope,
} from './contracts';

/* ── Simulation ── */
export type {
  SimulationState,
  SimulationTransition,
} from './simulation';

export {
  advanceSimulation,
  runFullSimulation,
  canEnableSimulation,
  getInitialState,
  isSimulationComplete,
  getNextTransition,
  getStepLabels,
} from './simulation';

/* ── Atlas Sandbox write rehearsal state machine (pure, fail closed) ── */
export type {
  SandboxOrderState,
  SandboxWriteOperation,
  WriteConfirmation,
  SandboxOrderEvent,
  TransitionContext,
  SandboxProviderOutcome,
} from './simulation';

export {
  SANDBOX_ORDER_STATES,
  SANDBOX_TERMINAL_STATES,
  SANDBOX_UNKNOWN_OUTCOME_STATES,
  canTransition,
  transition,
  isKnownState,
  getSandboxInitialState,
  isTerminalState,
  isUnknownOutcomeState,
  canAttemptWrite,
  mapProviderOutcome,
} from './simulation';
