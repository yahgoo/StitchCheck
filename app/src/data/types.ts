/* ── TypeScript interfaces for StitchCheck demo data ──
 *
 * MIGRATED: This file now re-exports from the shared core.
 * The canonical source is core/domain/. This file exists for
 * backward compatibility with existing component imports.
 *
 * New code should import from '../../core' directly. */

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
  DecisionData,
  Decision,
  AppStep,
  AlternativesScenario,
} from '../../../core/domain';
