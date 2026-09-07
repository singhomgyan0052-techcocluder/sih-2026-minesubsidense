/** ============================================
 *  Alert Engine — deterministic, hysteretic,
 *  with cooldown. Pure function.
 *
 *  evaluateNode() never reads the clock — nowS
 *  is passed in so it is unit-testable.
 *  ============================================ */

import {
  TILT, HYST, VIB_RMS_G, CRACK_MM,
  BATTERY_PCT, RSSI_DBM, ALERT_COOLDOWN_S,
} from '../model/constants';

/**
 * Rule codes — each must be stable and unique.
 */
export const RULE_CODES = {
  TILT_ABS:        'TILT_ABS',
  TILT_RATE:       'TILT_RATE',
  CRACK_ABS:       'CRACK_ABS',
  CRACK_RATE:      'CRACK_RATE',
  VIB_ABS:         'VIB_ABS',
  BATTERY_LOW:     'BATTERY_LOW',
  LINK_LOST:       'LINK_LOST',
  SENSOR_SUSPECT:  'SENSOR_SUSPECT',
};

/**
 * Evaluate a single node against all rules.
 *
 * @param {Object} node          — current node state (§4 shape)
 * @param {Object} prevRuleState — per-rule latch state from last evaluation
 * @param {number} nowS          — current simulated epoch seconds
 * @param {Object} [spatialCtx]  — { agree, of, r2 } from corroborate.js
 * @returns {{ level: string, firedRules: Array, nextRuleState: Object }}
 */
export function evaluateNode(node, prevRuleState = {}, nowS = 0, spatialCtx = null) {
  const nextRuleState = { ...prevRuleState };
  const firedRules = [];
  let level = 'normal';

  /**
   * Evaluate a single threshold rule with hysteresis.
   *
   * @param {string} code       — rule code
   * @param {number} value      — current measured/derived value
   * @param {Object} thresholds — { warnEnter, warnExit, critEnter, critExit }
   * @param {string} unit       — display unit
   * @param {boolean} isHard    — true = hard safety threshold (bypasses corroboration)
   */
  function evalThreshold(code, value, thresholds, unit, isHard = false) {
    const prev = nextRuleState[code] || { level: 'normal', lastFiredAt: 0 };
    let ruleLevel = prev.level;

    // Hysteresis logic: enter on high value, leave on low value
    if (value >= thresholds.critEnter) {
      ruleLevel = 'critical';
    } else if (value < thresholds.critExit && ruleLevel === 'critical') {
      // De-escalate from critical
      ruleLevel = value >= thresholds.warnEnter ? 'warning' : 'normal';
    } else if (value >= thresholds.warnEnter && ruleLevel !== 'critical') {
      ruleLevel = 'warning';
    } else if (value < thresholds.warnExit && ruleLevel === 'warning') {
      ruleLevel = 'normal';
    }

    // Apply corroboration gate for soft-threshold CRITICAL (§3.6)
    if (ruleLevel === 'critical' && !isHard && spatialCtx) {
      const { agree, of, r2 } = spatialCtx;
      if (agree < 2 || r2 < 0.70) {
        // Soft threshold alone → WARNING with reason
        ruleLevel = 'warning';
        // Still fire but note the reason
        const shouldFire = checkCooldownAndEscalation(code, ruleLevel, prev, nowS);
        if (shouldFire) {
          firedRules.push({
            code,
            level: ruleLevel,
            value: +value.toFixed(2),
            threshold: thresholds.critEnter,
            unit,
            reason: `single-node excursion — awaiting neighbour agreement (${agree}/${of}, R²=${r2.toFixed(2)})`,
          });
        }
        nextRuleState[code] = { level: ruleLevel, lastFiredAt: shouldFire ? nowS : prev.lastFiredAt };
        if (severityRank(ruleLevel) > severityRank(level)) level = ruleLevel;
        return;
      }
    }

    // Check cooldown and escalation
    const shouldFire = checkCooldownAndEscalation(code, ruleLevel, prev, nowS);
    if (shouldFire && ruleLevel !== 'normal') {
      firedRules.push({
        code,
        level: ruleLevel,
        value: +value.toFixed(2),
        threshold: ruleLevel === 'critical' ? thresholds.critEnter : thresholds.warnEnter,
        unit,
        reason: null,
      });
    }

    nextRuleState[code] = {
      level: ruleLevel,
      lastFiredAt: shouldFire && ruleLevel !== 'normal' ? nowS : prev.lastFiredAt,
    };
    if (severityRank(ruleLevel) > severityRank(level)) level = ruleLevel;
  }

  // ---- Evaluate all rules ----

  // TILT_ABS — on tilt_resultant_mm_per_m
  evalThreshold(RULE_CODES.TILT_ABS, node.tilt_resultant_mm_per_m, {
    warnEnter: HYST.WARN_ENTER,
    warnExit:  HYST.WARN_EXIT,
    critEnter: HYST.CRIT_ENTER,
    critExit:  HYST.CRIT_EXIT,
  }, 'mm/m');

  // VIB_ABS — on vibration_rms_g
  evalThreshold(RULE_CODES.VIB_ABS, node.vibration_rms_g, {
    warnEnter: VIB_RMS_G.WARN,
    warnExit:  VIB_RMS_G.WARN * 0.8,
    critEnter: VIB_RMS_G.CRIT,
    critExit:  VIB_RMS_G.CRIT * 0.8,
  }, 'g RMS');

  // CRACK_ABS — on crack_mm
  evalThreshold(RULE_CODES.CRACK_ABS, node.crack_mm, {
    warnEnter: CRACK_MM.WARN,
    warnExit:  CRACK_MM.WARN * 0.8,
    critEnter: CRACK_MM.CRIT,
    critExit:  CRACK_MM.CRIT * 0.8,
  }, 'mm');

  // BATTERY_LOW
  // Note: battery is inverse — low value is bad
  evalBatteryRule(node, nextRuleState, firedRules, nowS);
  const battState = nextRuleState[RULE_CODES.BATTERY_LOW];
  if (battState && severityRank(battState.level) > severityRank(level)) {
    level = battState.level;
  }

  // LINK_LOST — based on link_state
  if (node.link_state === 'offline') {
    const prev = nextRuleState[RULE_CODES.LINK_LOST] || { level: 'normal', lastFiredAt: 0 };
    const shouldFire = checkCooldownAndEscalation(RULE_CODES.LINK_LOST, 'critical', prev, nowS);
    if (shouldFire) {
      firedRules.push({
        code: RULE_CODES.LINK_LOST,
        level: 'critical',
        value: node.data_age_s,
        threshold: 0,
        unit: 's offline',
        reason: null,
      });
    }
    nextRuleState[RULE_CODES.LINK_LOST] = { level: 'critical', lastFiredAt: shouldFire ? nowS : prev.lastFiredAt };
    if (severityRank('critical') > severityRank(level)) level = 'critical';
  } else {
    nextRuleState[RULE_CODES.LINK_LOST] = { level: 'normal', lastFiredAt: (nextRuleState[RULE_CODES.LINK_LOST] || {}).lastFiredAt || 0 };
  }

  // SENSOR_SUSPECT — based on data_trust
  if (node.data_trust === 'bad' || node.data_trust === 'suspect') {
    const suspectLevel = node.data_trust === 'bad' ? 'warning' : 'watch';
    const prev = nextRuleState[RULE_CODES.SENSOR_SUSPECT] || { level: 'normal', lastFiredAt: 0 };
    const shouldFire = checkCooldownAndEscalation(RULE_CODES.SENSOR_SUSPECT, suspectLevel, prev, nowS);
    if (shouldFire) {
      firedRules.push({
        code: RULE_CODES.SENSOR_SUSPECT,
        level: suspectLevel,
        value: 0,
        threshold: 0,
        unit: '',
        reason: `data quality: ${node.data_trust} — flags: ${(node.quality_flags || []).join(', ') || 'none'}`,
      });
    }
    nextRuleState[RULE_CODES.SENSOR_SUSPECT] = { level: suspectLevel, lastFiredAt: shouldFire ? nowS : prev.lastFiredAt };
  } else {
    nextRuleState[RULE_CODES.SENSOR_SUSPECT] = { level: 'normal', lastFiredAt: (nextRuleState[RULE_CODES.SENSOR_SUSPECT] || {}).lastFiredAt || 0 };
  }

  return { level, firedRules, nextRuleState };
}

/**
 * Battery rule — inverse thresholds (lower is worse).
 */
function evalBatteryRule(node, nextRuleState, firedRules, nowS) {
  const code = RULE_CODES.BATTERY_LOW;
  const prev = nextRuleState[code] || { level: 'normal', lastFiredAt: 0 };
  let ruleLevel = prev.level;

  if (node.battery_pct <= BATTERY_PCT.CRIT) {
    ruleLevel = 'critical';
  } else if (node.battery_pct > BATTERY_PCT.CRIT + 5 && ruleLevel === 'critical') {
    ruleLevel = node.battery_pct <= BATTERY_PCT.WARN ? 'warning' : 'normal';
  } else if (node.battery_pct <= BATTERY_PCT.WARN && ruleLevel !== 'critical') {
    ruleLevel = 'warning';
  } else if (node.battery_pct > BATTERY_PCT.WARN + 5 && ruleLevel === 'warning') {
    ruleLevel = 'normal';
  }

  const shouldFire = checkCooldownAndEscalation(code, ruleLevel, prev, nowS);
  if (shouldFire && ruleLevel !== 'normal') {
    firedRules.push({
      code,
      level: ruleLevel,
      value: node.battery_pct,
      threshold: ruleLevel === 'critical' ? BATTERY_PCT.CRIT : BATTERY_PCT.WARN,
      unit: '%',
      reason: null,
    });
  }
  nextRuleState[code] = {
    level: ruleLevel,
    lastFiredAt: shouldFire && ruleLevel !== 'normal' ? nowS : prev.lastFiredAt,
  };
}

/**
 * Check cooldown: suppress re-firing within ALERT_COOLDOWN_S.
 * Escalation (warning → critical) bypasses cooldown.
 * De-escalation does not trigger a new fire.
 */
function checkCooldownAndEscalation(code, newLevel, prev, nowS) {
  if (newLevel === 'normal') return false;
  // Escalation bypasses cooldown
  if (severityRank(newLevel) > severityRank(prev.level)) return true;
  // Same level — check cooldown
  if (newLevel === prev.level) {
    return (nowS - prev.lastFiredAt) >= ALERT_COOLDOWN_S;
  }
  // De-escalation — do not fire
  return false;
}

/**
 * Severity ranking for comparison.
 */
function severityRank(level) {
  switch (level) {
    case 'critical': return 4;
    case 'warning':  return 3;
    case 'watch':    return 2;
    case 'normal':   return 1;
    default:         return 0;
  }
}

/**
 * Create a full alert object from a fired rule.
 */
export function makeAlert(node, firedRule, nowS, spatialCtx = null) {
  return {
    id: `${node.id}-${firedRule.code}-${nowS}`,
    node_id: node.id,
    panel_id: node.panel_id,
    rule_code: firedRule.code,
    level: firedRule.level,
    raised_at: nowS * 1000,   // epoch ms
    value: firedRule.value,
    threshold: firedRule.threshold,
    unit: firedRule.unit,
    message: `${node.id} · ${firedRule.code} · ${firedRule.value} ${firedRule.unit} ${firedRule.level === 'critical' ? '>' : '≥'} ${firedRule.threshold} ${firedRule.unit} threshold`,
    provenance: {
      rule: { code: firedRule.code, threshold: firedRule.threshold, unit: firedRule.unit },
      ai: null,   // no model deployed
      spatial: spatialCtx || node.spatial_agreement,
    },
    reason: firedRule.reason,
    status: 'pending',
    ack_by: null,
    ack_at: null,
    resolved_at: null,
    note: null,
  };
}
