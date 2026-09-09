/** ============================================
 *  Risk Index — rule-based composite
 *
 *  NOT "AI". A weighted sum with inspectable
 *  weights and documented denominators.
 *  Display only — does NOT drive status or alerts.
 *  ============================================ */

import { RISK_WEIGHTS, RISK_NORM } from '../model/constants';

/**
 * Compute the composite risk index for a node.
 *
 * @param {Object} node — current node state (§4 shape)
 * @returns {{ index: number, breakdown: Object }}
 */
export function computeRiskIndex(node) {
  if (!node) return { index: 0, breakdown: {} };

  const tiltVal = Number(node.tilt_resultant_mm_per_m) || 0;
  const vibVal = Number(node.vibration_rms_g) || 0;
  const crackVal = Number(node.crack_mm) || 0;
  const settlVal = Number(node.settlement_inferred_mm) || 0;

  const tiltNorm = Math.min(1, Math.max(0, tiltVal / (RISK_NORM.tilt_max_mm_per_m || 8)));
  const vibNorm = Math.min(1, Math.max(0, vibVal / (RISK_NORM.vibration_max_g || 1)));
  const crackNorm = Math.min(1, Math.max(0, crackVal / (RISK_NORM.crack_max_mm || 10)));
  const settlNorm = Math.min(1, Math.max(0, Math.abs(settlVal) / (RISK_NORM.settlement_max_mm || 50)));

  const tiltContrib = tiltNorm * (RISK_WEIGHTS.tilt || 0.3) * 100;
  const vibContrib = vibNorm * (RISK_WEIGHTS.vibration || 0.25) * 100;
  const crackContrib = crackNorm * (RISK_WEIGHTS.crack || 0.25) * 100;
  const settlContrib = settlNorm * (RISK_WEIGHTS.settlement || 0.2) * 100;

  let index = Math.round(tiltContrib + vibContrib + crackContrib + settlContrib);

  // Fallback map: force UI risk circle color if rule-engine marks it worse
  if (node.status === 'critical' && index < 75) {
    index = Math.max(index, 80);
  } else if (node.status === 'warning' && index < 40) {
    index = Math.max(index, 50);
  } else if (node.status === 'stale' || node.status === 'suspect') {
    // Optionally don't force index on stale
  }

  return {
    index,
    breakdown: {
      tilt: {
        value: tiltVal,
        max: RISK_NORM.tilt_max_mm_per_m,
        norm: +tiltNorm.toFixed(2),
        weight: RISK_WEIGHTS.tilt,
        contrib: +tiltContrib.toFixed(1),
      },
      vibration: {
        value: vibVal,
        max: RISK_NORM.vibration_max_g,
        norm: +vibNorm.toFixed(2),
        weight: RISK_WEIGHTS.vibration,
        contrib: +vibContrib.toFixed(1),
      },
      crack: {
        value: crackVal,
        max: RISK_NORM.crack_max_mm,
        norm: +crackNorm.toFixed(2),
        weight: RISK_WEIGHTS.crack,
        contrib: +crackContrib.toFixed(1),
      },
      settlement: {
        value: Math.abs(settlVal),
        max: RISK_NORM.settlement_max_mm,
        norm: +settlNorm.toFixed(2),
        weight: RISK_WEIGHTS.settlement,
        contrib: +settlContrib.toFixed(1),
      },
    },
  };
}
