/** ============================================
 *  Link Health — §9
 *
 *  Classifies node connectivity state from
 *  data_age_s and the timing constants.
 *  ============================================ */

import {
  SAMPLE_INTERVAL_S, EMERGENCY_INTERVAL_S,
  STALE_MULTIPLIER, OFFLINE_MULTIPLIER,
} from '../model/constants';

/**
 * Classify the link state of a node.
 *
 * @param {Object} node — current node state
 * @param {number} nowMs — current time in epoch ms
 * @returns {'ok' | 'stale' | 'offline'}
 */
export function classifyLink(node, nowMs) {
  const interval = node.sample_mode === 'emergency'
    ? EMERGENCY_INTERVAL_S
    : SAMPLE_INTERVAL_S;

  const ageS = (nowMs - node.last_seen) / 1000;

  if (ageS > interval * OFFLINE_MULTIPLIER) return 'offline';
  if (ageS > interval * STALE_MULTIPLIER) return 'stale';
  return 'ok';
}

/**
 * Format data age as a human-readable string.
 *
 * @param {number} ageS — age in seconds
 * @returns {string}
 */
export function formatAge(ageS) {
  if (ageS < 0) return '0s';
  if (ageS < 60) return `${Math.floor(ageS)}s`;
  if (ageS < 3600) {
    const m = Math.floor(ageS / 60);
    const s = Math.floor(ageS % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(ageS / 3600);
  const m = Math.floor((ageS % 3600) / 60);
  return `${h}h ${m}m`;
}
