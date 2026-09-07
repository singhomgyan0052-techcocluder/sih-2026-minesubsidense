/** ============================================
 *  Status Fusion — separate rule_level from status.
 *
 *  Precedence (highest wins):
 *    1. link_state === 'offline'  → 'offline'
 *    2. data_trust === 'bad'      → 'suspect'
 *    3. rule_level === 'critical' → 'critical'
 *    4. rule_level === 'warning'  → 'warning'
 *    5. link_state === 'stale'    → 'stale'
 *    6. otherwise                 → 'normal'
 *
 *  An offline node is NOT safe. It retains
 *  last_known_level so the UI can show:
 *  "⚫ OFFLINE (was 🟡 WARNING 12 min ago)"
 *  ============================================ */

/**
 * Fuse a node's link_state, data_trust, and rule_level
 * into a single display status.
 *
 * @param {Object} node — current node state
 * @param {Object} [prevFusionState] — previous { status, last_known_level, last_known_at }
 * @returns {{ status: string, last_known_level: string|null, last_known_at: number|null }}
 */
export function fuseStatus(node, prevFusionState = {}) {
  const prev = prevFusionState || {};
  let status = 'normal';
  let last_known_level = prev.last_known_level || null;
  let last_known_at = prev.last_known_at || null;

  if (node.link_state === 'offline') {
    // Retain the last known level from when the node was alive
    if (prev.status && prev.status !== 'offline' && prev.status !== 'stale') {
      last_known_level = prev.status;
      last_known_at = node.last_seen;
    }
    status = 'offline';
  } else if (node.data_trust === 'bad') {
    status = 'suspect';
    last_known_level = null;
    last_known_at = null;
  } else if (node.rule_level === 'critical') {
    status = 'critical';
    last_known_level = null;
    last_known_at = null;
  } else if (node.rule_level === 'warning' || node.rule_level === 'watch') {
    status = 'warning';
    last_known_level = null;
    last_known_at = null;
  } else if (node.link_state === 'stale') {
    status = 'stale';
    // Keep last known level from live state
    if (prev.status && prev.status !== 'stale' && prev.status !== 'offline') {
      last_known_level = prev.status;
      last_known_at = node.last_seen;
    }
  } else {
    status = 'normal';
    last_known_level = null;
    last_known_at = null;
  }

  return { status, last_known_level, last_known_at };
}
