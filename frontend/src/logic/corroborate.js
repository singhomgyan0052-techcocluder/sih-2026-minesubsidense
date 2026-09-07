/** ============================================
 *  Spatial Corroboration — §3.6
 *
 *  No lone node escalates to CRITICAL on a soft
 *  threshold. Wind, passing traffic, and a faulty
 *  sensor all look like a single-node excursion.
 *  ============================================ */

import { influenceRadiusM, PANEL_GEOM, CORROBORATION } from '../model/constants';

/**
 * Great-circle distance between two lat/lng points (Haversine), in metres.
 */
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in metres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find neighbours of a node within the influence radius.
 * Excludes nodes with data_trust === 'bad' and link_state === 'offline'.
 *
 * @param {Object} node    — the node to find neighbours for
 * @param {Array}  allNodes — all nodes in the fleet
 * @param {number} [radiusM] — search radius in metres
 * @returns {Array} neighbour nodes
 */
export function neighboursOf(node, allNodes, radiusM = null) {
  const radius = radiusM || influenceRadiusM(PANEL_GEOM.depth_m, PANEL_GEOM.angle_of_draw_deg);

  return allNodes.filter(n => {
    if (n.id === node.id) return false;
    if (n.data_trust === 'bad') return false;
    if (n.link_state === 'offline') return false;

    const dist = haversineM(node.lat, node.lng, n.lat, n.lng);
    return dist <= radius;
  });
}

/**
 * Compute spatial agreement for a node.
 *
 * @param {Object} node       — the node being evaluated
 * @param {Array}  neighbours — neighbours from neighboursOf()
 * @returns {{ agree: number, of: number, r2: number }}
 */
export function spatialAgreement(node, neighbours) {
  if (neighbours.length === 0) {
    return { agree: 0, of: 0, r2: 0 };
  }

  const of = neighbours.length;
  let agree = 0;

  // Count neighbours whose tilt is moving in a consistent direction
  // "Consistent" = same sign trend, and tilt resultant above a minimum threshold
  const nodeTilt = node.tilt_resultant_mm_per_m;
  const nodeTrend = node.trend_mm_per_m_per_day;
  const tiltThreshold = 0.5; // minimum tilt to be considered "moving"

  neighbours.forEach(n => {
    const nTilt = n.tilt_resultant_mm_per_m;
    const nTrend = n.trend_mm_per_m_per_day;

    // Agree if both are tilting, both trending in same direction
    if (nTilt > tiltThreshold && nodeTilt > tiltThreshold) {
      if ((nodeTrend >= 0 && nTrend >= 0) || (nodeTrend < 0 && nTrend < 0)) {
        agree++;
      }
    }
  });

  // R² of a linear fit of tilt vs distance
  // Simple linear regression: tilt_resultant = a + b × distance
  const distances = neighbours.map(n => haversineM(node.lat, node.lng, n.lat, n.lng));
  const tilts = neighbours.map(n => n.tilt_resultant_mm_per_m);

  // Add the node itself to the regression
  distances.unshift(0);
  tilts.unshift(nodeTilt);

  const r2 = computeR2(distances, tilts);

  return { agree, of, r2: +r2.toFixed(2) };
}

/**
 * Coefficient of determination (R²) for a linear fit.
 */
function computeR2(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;

  const xMean = xs.reduce((s, x) => s + x, 0) / n;
  const yMean = ys.reduce((s, y) => s + y, 0) / n;

  let ssRes = 0;
  let ssTot = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumXY += (xs[i] - xMean) * (ys[i] - yMean);
    sumX2 += (xs[i] - xMean) * (xs[i] - xMean);
    ssTot += (ys[i] - yMean) * (ys[i] - yMean);
  }

  if (ssTot === 0 || sumX2 === 0) return 0;

  const b = sumXY / sumX2;
  const a = yMean - b * xMean;

  for (let i = 0; i < n; i++) {
    const predicted = a + b * xs[i];
    ssRes += (ys[i] - predicted) * (ys[i] - predicted);
  }

  return Math.max(0, 1 - ssRes / ssTot);
}

/**
 * Check if a node meets the corroboration requirements for CRITICAL.
 *
 * @param {Object} spatial — { agree, of, r2 } from spatialAgreement()
 * @returns {boolean}
 */
export function meetsCorroboration(spatial) {
  return spatial.agree >= CORROBORATION.MIN_NEIGHBOURS && spatial.r2 >= CORROBORATION.MIN_R2;
}
