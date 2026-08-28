/* ── Domain model barrel export ── */

export type {
  FlightLeg,
  FieldConfidence,
  ExtractionResult,
} from './itinerary';

export type {
  RiskResult,
  RiskScenario,
} from './risk';

export type {
  Alternative,
  SearchResult,
  ComparisonOriginal,
  ComparisonAlternative,
  ComparisonData,
  AlternativesScenario,
} from './search';

export type {
  DecisionData,
  Decision,
  AppStep,
} from './decision';

export type {
  DependencyNodeStatus,
  DependencyNodeKind,
  DependencyNode,
  DependencyGraph,
} from './dependency-graph';

export type {
  RiskComputationSeed,
  RiskComputationResult,
  ItineraryContext,
} from './risk-computation';

export {
  computeRiskFromSeed,
} from './risk-computation';

export type {
  ExecutionMode,
  ExecutionModeLabel,
} from './execution-mode';

export {
  VALID_EXECUTION_MODES,
  getExecutionModeLabel,
  isExecutionModeLive,
  resolveExecutionMode,
} from './execution-mode';

export type {
  RecoveryPlanFromRiskResult,
} from './recovery-plan-adapter';

export {
  riskResultToAnimationData,
} from './recovery-plan-adapter';
