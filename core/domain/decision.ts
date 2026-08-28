/* ── Decision domain model ──
 * Shared across browser app, orchestrators, and workers.
 * Extracted from app/src/data/types.ts as the canonical source. */

export interface DecisionData {
  selectedDecision: string | null;
  options: string[];
  noOrderCreated: boolean;
  syntheticDemo: boolean;
  finalStatement: string;
}

export type Decision = 'keep' | 'switch' | null;

export type AppStep = 'welcome' | 'trip' | 'risk' | 'options' | 'decision' | 'done';
