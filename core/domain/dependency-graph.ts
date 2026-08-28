/* ── Dependency graph types ──
 *
 * Models the dependency graph for recovery-plan cascade visualization.
 * Each node represents a downstream itinerary item whose risk status
 * depends on upstream delay propagation.
 *
 * Shared across browser app, orchestrators, and workers. */

/** Risk status of a dependency node. */
export type DependencyNodeStatus = 'ok' | 'at-risk' | 'failed';

/** Kind of downstream dependency item. */
export type DependencyNodeKind =
  | 'connection-window'
  | 'onward-leg'
  | 'hotel-checkin'
  | 'ground-transport'
  | 'event-connection';

/** A single node in the downstream dependency graph. */
export interface DependencyNode {
  /** Unique identifier for this node. */
  id: string;
  /** Human-readable display label. */
  label: string;
  /** Kind of dependency item. */
  kind: DependencyNodeKind;
  /** Current risk status after cascade evaluation. */
  status: DependencyNodeStatus;
  /** Delay in ms before this node transitions to at-risk in the animation. */
  cascadeDelayMs: number;
  /** IDs of upstream dependency nodes that affect this one. */
  dependsOn: string[];
}

/** The full dependency graph for a recovery scenario. */
export interface DependencyGraph {
  /** All nodes in the graph, ordered by cascadeDelayMs ascending. */
  nodes: DependencyNode[];
  /** ID of the root trigger node (the delayed leg). */
  rootTriggerId: string;
}
