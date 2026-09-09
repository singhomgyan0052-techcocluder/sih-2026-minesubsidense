/** ============================================
 *  Settlement Integration — §3.2, §3.3
 *
 *  Settlement is INFERRED by integrating tilt
 *  along a chain of nodes with known spacing,
 *  relative to a stable reference node.
 *
 *  It is NEVER measured directly. No sensor in
 *  the bill of materials can do that.
 *  ============================================ */

/**
 * Integrate settlement along the node chain from the reference node.
 *
 * settlement(node_i) = settlement(ref) + Σ(tilt_k × spacing_k)
 *
 * @param {Array} nodes — all nodes in the fleet
 * @param {Object} [prevSettlements] — previous settlement values keyed by node id
 * @returns {Object} — map of node id → { settlement_inferred_mm, settlement_err_mm }
 */
export function integrateSettlement(nodes, prevSettlements = {}) {
  const refNode = nodes.find(n => n.is_reference);
  
  // Build adjacency from parent_node links
  // Chain: ref → children → grandchildren etc.
  const childMap = {};
  nodes.forEach(n => {
    if (refNode && n.parent_node && n.parent_node !== 'GW-1' && n.parent_node !== refNode.gateway_id) {
      if (!childMap[n.parent_node]) childMap[n.parent_node] = [];
      childMap[n.parent_node].push(n.id);
    }
  });

  // Also add nodes whose parent is GW-1 as children of the reference
  // (they're one hop from gateway, reference is also one hop)
  if (refNode) {
    nodes.forEach(n => {
      if (n.id === refNode.id) return;
      if (n.parent_node === 'GW-1' || n.parent_node === refNode.gateway_id) {
        if (!childMap[refNode.id]) childMap[refNode.id] = [];
        childMap[refNode.id].push(n.id);
      }
    });
  }

  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  const results = {};
  const visited = new Set();
  const queue = [];

  // Per-sample tilt error — [VERIFY] from MPU6050/6500 datasheet
  const TILT_ERR_MM_PER_M = 0.15; // [VERIFY]

  if (refNode) {
    // Reference node: always zero
    results[refNode.id] = {
      settlement_inferred_mm: 0,
      settlement_err_mm: 0,
    };
    queue.push(refNode.id);
    visited.add(refNode.id);
  }

  while (queue.length > 0) {
    const parentId = queue.shift();
    const children = childMap[parentId] || [];

    children.forEach(childId => {
      if (visited.has(childId)) return;
      visited.add(childId);

      const child = nodeMap[childId];
      const parentResult = results[parentId];

      if (!child || parentResult === undefined) return;

      // Integrate: settlement = parent_settlement + tilt × spacing
      // The minus sign: subsidence is negative-going
      const spacing = child.spacing_m || 25;
      const integrated = parentResult.settlement_inferred_mm - child.tilt_resultant_mm_per_m * spacing;

      // Monotonic clamp: magnitude only increases (value only decreases since negative)
      const prevValue = prevSettlements[childId]?.settlement_inferred_mm ?? integrated;
      const clampedSettlement = Math.min(prevValue, integrated);

      // Error propagation: sqrt(parent_err² + (tilt_err × spacing)²)
      const tiltErrContrib = TILT_ERR_MM_PER_M * spacing;
      const errMm = Math.sqrt(
        parentResult.settlement_err_mm * parentResult.settlement_err_mm +
        tiltErrContrib * tiltErrContrib
      );

      results[childId] = {
        settlement_inferred_mm: +clampedSettlement.toFixed(1),
        settlement_err_mm: +errMm.toFixed(1),
      };

      queue.push(childId);
    });
  }

  // Handle any nodes not reached by BFS (disconnected) or if there is no reference node
  nodes.forEach(n => {
    if (!results[n.id]) {
      const spacing = n.spacing_m || 25; // default 25m
      // Calculate independent settlement relative to a theoretical gateway anchor
      const independentSettlement = - (n.tilt_resultant_mm_per_m * spacing);
      
      const prevValue = prevSettlements[n.id]?.settlement_inferred_mm ?? independentSettlement;
      // Monotonic clamp (only gets more negative)
      const clampedSettlement = Math.min(prevValue, independentSettlement);
      
      const tiltErrContrib = TILT_ERR_MM_PER_M * spacing;

      results[n.id] = {
        settlement_inferred_mm: +clampedSettlement.toFixed(1),
        settlement_err_mm: +tiltErrContrib.toFixed(1),
      };
    }
  });

  return results;
}
