// Daytona risk worker — dependency graph builder.
//
// Constructs the downstream dependency graph from itinerary input
// and computed risk metrics. Each node represents a downstream
// itinerary item whose risk status depends on upstream propagation.
//
// Graph structure aligns with core/domain/dependency-graph.ts types:
//   DependencyNode { id, label, kind, status, cascadeDelayMs, dependsOn }
//   DependencyGraph { nodes, rootTriggerId }
//
// Additionally, edges are included for explicit source→dest reasoning.
//
// This module runs INSIDE the Daytona sandbox (offline mode).

import { deriveRiskBand } from './risk-engine.mjs';

/* ── Node kind mapping ──
 * Matches DependencyNodeKind from core/domain/dependency-graph.ts */

const VALID_NODE_KINDS = Object.freeze([
  'connection-window',
  'onward-leg',
  'hotel-checkin',
  'ground-transport',
  'event-connection',
]);

/**
 * Map downstream commitment labels to dependency node kinds.
 */
function commitmentToNodeKind(commitment) {
  const lower = commitment.toLowerCase().replace(/\s+/g, '-');
  if (lower.includes('hotel') || lower.includes('checkin') || lower.includes('check-in')) {
    return 'hotel-checkin';
  }
  if (lower.includes('ground') || lower.includes('transport')) {
    return 'ground-transport';
  }
  if (lower.includes('event') || lower.includes('connection')) {
    return 'event-connection';
  }
  if (lower.includes('onward') || lower.includes('leg') || lower.includes('flight')) {
    return 'onward-leg';
  }
  // Default: connection-window
  return 'connection-window';
}

/**
 * Build a display label for a dependency node.
 */
function buildNodeLabel(kind, leg, index) {
  switch (kind) {
    case 'connection-window':
      return leg
        ? `Connection window at ${leg.origin}`
        : `Connection window ${index + 1}`;
    case 'onward-leg':
      return leg
        ? `Onward leg ${leg.origin} → ${leg.destination}`
        : `Onward leg ${index + 1}`;
    case 'hotel-checkin':
      return 'Pre-booked hotel check-in';
    case 'ground-transport':
      return 'Ground transport connection';
    case 'event-connection':
      return 'Event/tour connection';
    default:
      return `Downstream dependency ${index + 1}`;
  }
}

/**
 * Build the dependency graph.
 *
 * @param {Object} params
 * @param {Object[]} params.flightLegs - Input flight legs.
 * @param {string[]} params.downstreamCommitments - Commitment labels.
 * @param {string|null} params.hotelCheckinCutoff - Hotel cutoff time.
 * @param {number} params.riskScore - Computed risk score (0–100).
 * @param {boolean} params.isTerminalNoPlan - Whether in terminal state.
 * @returns {Object} { dependencyGraph, edges }
 */
export function buildDependencyGraph(params) {
  const {
    flightLegs,
    downstreamCommitments,
    hotelCheckinCutoff,
    riskScore,
    isTerminalNoPlan,
  } = params;

  const nodes = [];
  const edges = [];
  let cascadeOrder = 0;
  const CASCADE_STEP_MS = 550;

  // Determine the first affected leg (always leg index 0 for the trigger)
  const firstLeg = flightLegs[0];
  const rootTriggerId = 'trigger-first-leg-delayed';

  // Root trigger node: the first flight leg delayed
  nodes.push({
    id: rootTriggerId,
    kind: 'onward-leg',
    label: firstLeg
      ? `First leg delayed: ${firstLeg.origin} → ${firstLeg.destination}`
      : 'First leg delayed',
    status: isTerminalNoPlan ? 'failed' : 'at-risk',
    cascadeOrder: cascadeOrder++,
    dependencyReason: 'Initial delay trigger — upstream disruption',
    dependsOn: [],
  });

  // Connection window node (always present if multi-leg)
  if (flightLegs.length >= 2) {
    const connectionLeg = flightLegs[1];
    const connectionId = 'connection-window';
    const connectionStatus = isTerminalNoPlan
      ? 'failed'
      : (riskScore >= 20 ? 'at-risk' : 'ok');

    nodes.push({
      id: connectionId,
      kind: 'connection-window',
      label: connectionLeg
        ? `Connection window at ${connectionLeg.origin}`
        : 'Connection window at hub',
      status: connectionStatus,
      cascadeOrder: cascadeOrder++,
      dependencyReason: 'Delay on first leg reduces available connection time',
      dependsOn: [rootTriggerId],
    });

    edges.push({
      sourceId: rootTriggerId,
      destinationId: connectionId,
      reason: 'First-leg delay propagates to connection window',
    });
  }

  // Onward leg node (if risk is high enough and multi-leg)
  if (flightLegs.length >= 2 && !isTerminalNoPlan && riskScore >= 40) {
    const onwardLeg = flightLegs[flightLegs.length - 1];
    const onwardId = 'onward-leg';
    const onwardStatus = riskScore >= 40 ? 'at-risk' : 'ok';

    nodes.push({
      id: onwardId,
      kind: 'onward-leg',
      label: onwardLeg
        ? `Onward leg ${onwardLeg.origin} → ${onwardLeg.destination}`
        : 'Onward leg',
      status: onwardStatus,
      cascadeOrder: cascadeOrder++,
      dependencyReason: 'Connection window risk propagates to onward flight',
      dependsOn: ['connection-window'],
    });

    edges.push({
      sourceId: 'connection-window',
      destinationId: onwardId,
      reason: 'Tight connection threatens onward leg viability',
    });
  }

  // Hotel/check-in node (if risk is high enough or commitment exists)
  const hasHotelCommitment = (downstreamCommitments || []).some(
    c => c.toLowerCase().includes('hotel') || c.toLowerCase().includes('check')
  );
  if (!isTerminalNoPlan && (riskScore >= 60 || hasHotelCommitment)) {
    const hotelId = 'hotel-checkin';
    const hotelStatus = riskScore >= 60 ? 'at-risk' : 'ok';
    const hotelDeps = [];

    // Depends on onward-leg if it exists, otherwise connection-window
    if (nodes.find(n => n.id === 'onward-leg')) {
      hotelDeps.push('onward-leg');
    }
    if (nodes.find(n => n.id === 'connection-window')) {
      hotelDeps.push('connection-window');
    }
    if (hotelDeps.length === 0) {
      hotelDeps.push(rootTriggerId);
    }

    nodes.push({
      id: hotelId,
      kind: 'hotel-checkin',
      label: hotelCheckinCutoff
        ? `Pre-booked hotel check-in (cutoff: ${hotelCheckinCutoff})`
        : 'Pre-booked hotel check-in',
      status: hotelStatus,
      cascadeOrder: cascadeOrder++,
      dependencyReason: 'Onward delay propagates to hotel check-in cutoff',
      dependsOn: hotelDeps,
    });

    for (const dep of hotelDeps) {
      edges.push({
        sourceId: dep,
        destinationId: hotelId,
        reason: `Delay cascade from ${dep} threatens hotel check-in window`,
      });
    }
  }

  // Additional downstream commitments from input
  if (downstreamCommitments && !isTerminalNoPlan) {
    for (let i = 0; i < downstreamCommitments.length; i++) {
      const commitment = downstreamCommitments[i];
      const kind = commitmentToNodeKind(commitment);

      // Skip if already covered by built-in nodes
      if (kind === 'hotel-checkin' && nodes.find(n => n.id === 'hotel-checkin')) continue;
      if (kind === 'connection-window' && nodes.find(n => n.id === 'connection-window')) continue;
      if (kind === 'onward-leg' && nodes.find(n => n.id === 'onward-leg')) continue;

      const nodeId = `downstream-${kind}-${i}`;
      const threshold = 50 + i * 10;
      const nodeStatus = riskScore >= threshold ? 'at-risk' : 'ok';

      // Depends on the deepest existing node
      const deepestNode = nodes[nodes.length - 1];
      const deps = deepestNode ? [deepestNode.id] : [rootTriggerId];

      nodes.push({
        id: nodeId,
        kind,
        label: buildNodeLabel(kind, null, i),
        status: nodeStatus,
        cascadeOrder: cascadeOrder++,
        dependencyReason: `Downstream commitment: ${commitment}`,
        dependsOn: deps,
      });

      for (const dep of deps) {
        edges.push({
          sourceId: dep,
          destinationId: nodeId,
          reason: `Cascade from ${dep} to downstream commitment`,
        });
      }
    }
  }

  // Terminal state: collapse to failed statuses
  if (isTerminalNoPlan) {
    for (const node of nodes) {
      if (node.id !== rootTriggerId) {
        node.status = 'failed';
      }
    }
  }

  // Sort nodes by cascadeOrder (ascending)
  nodes.sort((a, b) => a.cascadeOrder - b.cascadeOrder);

  // Map to core-compatible shape (cascadeDelayMs = cascadeOrder * CASCADE_STEP_MS)
  const coreNodes = nodes.map(n => ({
    id: n.id,
    label: n.label,
    kind: n.kind,
    status: n.status,
    cascadeDelayMs: n.cascadeOrder * CASCADE_STEP_MS,
    dependsOn: n.dependsOn,
    // Extended fields for the worker output
    cascadeOrder: n.cascadeOrder,
    dependencyReason: n.dependencyReason,
  }));

  return {
    dependencyGraph: {
      nodes: coreNodes,
      rootTriggerId,
    },
    edges,
  };
}
