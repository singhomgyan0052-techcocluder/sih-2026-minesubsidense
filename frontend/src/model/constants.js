/** ============================================
 *  SIH 26025 — Mine Subsidence Monitoring System
 *  Domain Constants & Thresholds
 *
 *  Every threshold in the app must be imported
 *  from this file. No magic numbers elsewhere.
 *  [VERIFY] comments = team TODO for citations.
 *  ============================================ */

/** Exact conversion. 1 mm/m = 0.0573 degrees. Safe to use. */
export const DEG_PER_MM_PER_M = 0.0573;
export const degToMmPerM = (deg) => deg / DEG_PER_MM_PER_M;
export const mmPerMToDeg = (mm) => mm * DEG_PER_MM_PER_M;

/** Tilt bands, mm/m, on tilt_resultant_mm_per_m.
 *  [VERIFY] against NCB Subsidence Engineers' Handbook / CSIR-CIMFR guidance
 *  before quoting these to evaluators. Indicative only. */
export const TILT = {
  NORMAL_MAX:  8.0,   // [VERIFY]
  WARN_MAX:    10.0,   // [VERIFY]
  CRITICAL_AT: 20.0,   // [VERIFY]  above this = critical band
};

/** Hysteresis: enter on the high value, leave only on the low value.
 *  Prevents an alert flickering on/off around a single threshold. */
export const HYST = {
  WARN_ENTER: 10.0, WARN_EXIT: 8.0,       // [VERIFY]
  CRIT_ENTER: 20.0, CRIT_EXIT: 16.0,       // [VERIFY]
};

/** Other sensor thresholds. [VERIFY] all of these. */
export const VIB_RMS_G   = { WARN: 0.30, CRIT: 0.60 };   // [VERIFY]
export const CRACK_MM    = { WARN: 3.0,  CRIT: 6.0  };   // [VERIFY]
export const CRACK_RATE  = { WARN: 0.5,  CRIT: 1.5  };   // mm/day  [VERIFY]
export const BATTERY_PCT = { WARN: 40,   CRIT: 20   };
export const RSSI_DBM    = { WARN: -110, CRIT: -120 };   // [VERIFY] vs SX1276 sensitivity

/** Timing. Duty cycle is the anchor for every staleness rule. */
export const SAMPLE_INTERVAL_S   = 300;   // 5 min normal duty cycle
export const EMERGENCY_INTERVAL_S = 30;   // emergency mode
export const STALE_MULTIPLIER    = 3;     // > 3× interval  → stale
export const OFFLINE_MULTIPLIER  = 10;    // > 10× interval → offline
export const ALERT_COOLDOWN_S    = 600;   // per node, per rule

/** Three separate latency budgets. Never collapse into one number. §3.5 */
export const LATENCY_BUDGET = {
  node_buzzer_s: 1,     // decided on the node itself
  dashboard_s:   300,   // bounded by the duty cycle
  critical_sms_s: 60,   // from gateway decision
};

/** Panel geometry for the influence zone. r = H · tan(beta) */
export const PANEL_GEOM = {
  depth_m: 45,          // [VERIFY] actual panel depth
  angle_of_draw_deg: 25,// [VERIFY] site-specific, 20-35 deg typical
};
export const influenceRadiusM = (H, betaDeg) =>
  H * Math.tan((betaDeg * Math.PI) / 180);   // 45 m @ 25 deg = 21.0 m

/** Corroboration: how many neighbours must agree to confirm CRITICAL. §3.6 */
export const CORROBORATION = { MIN_NEIGHBOURS: 2, MIN_R2: 0.70 };  // [VERIFY]

/** Risk index normalisation denominators — mm/m based. [VERIFY] */
export const RISK_NORM = {
  tilt_max_mm_per_m: 8.0,    // [VERIFY]
  vibration_max_g:   1.0,    // [VERIFY]
  crack_max_mm:      10.0,   // [VERIFY]
  settlement_max_mm: 50.0,   // [VERIFY]
};

/** Risk index weights — inspectable, not buried in an expression. */
export const RISK_WEIGHTS = {
  tilt: 0.30,
  vibration: 0.25,
  crack: 0.25,
  settlement: 0.20,
};  // [VERIFY]

/** Deterministic demo seed. */
export const DEFAULT_SEED = 26025;

/** Simulator time scaling.
 *  One 2-second wall-clock tick = 300 s simulated time (= one duty cycle). */
export const SIM_TIME_SCALE = 150;
export const SIM_TICK_MS = 2000;
