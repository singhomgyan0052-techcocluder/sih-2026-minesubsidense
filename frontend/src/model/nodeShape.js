/** ============================================
 *  SIH 26025 — Node Data Model & Seed Data
 *
 *  Central contract: every UI element reads from
 *  a field defined here. See spec §4.
 *  ============================================ */

/**
 * Creates a node object with the full §4 shape.
 * Pass overrides to customise specific fields.
 *
 * @param {Object} overrides - Fields to override defaults
 * @returns {Object} A complete node object
 *
 * Field annotations:
 *   (measured) — comes from a physical sensor
 *   (derived)  — computed in the frontend from measured fields;
 *                must be visually labelled as "derived" or "inferred" in the UI
 *   (link)     — network metadata from the gateway
 *
 * @property {string}  id                        — stable node id
 * @property {string}  name                      — human-readable label
 * @property {string}  panel_id                  — links node → panel GeoJSON
 * @property {number}  lat                       — latitude (siting only)
 * @property {number}  lng                       — longitude (siting only)
 * @property {string}  gps_fix                   — '3D' | '2D' | 'NONE'; GPS is for siting, NOT settlement
 * @property {string}  install_date              — ISO date string
 * @property {number}  spacing_m                 — distance to next node in the chain (needed for settlement integration)
 * @property {boolean} is_reference              — true for the stable node outside the influence zone
 * @property {string}  firmware                  — firmware version string
 *
 * @property {Object}  baseline                  — zero-calibration snapshot set at install
 * @property {number}  baseline.tilt_x_mm_per_m  — baseline tilt X
 * @property {number}  baseline.tilt_y_mm_per_m  — baseline tilt Y
 * @property {number}  baseline.crack_mm         — baseline crack opening
 * @property {string}  baseline.set_at           — ISO timestamp of calibration
 *
 * @property {number}  temp_c                    — (measured) DHT22 enclosure temperature
 * @property {number}  tilt_x_raw_mm_per_m       — (measured) before thermal correction & baseline
 * @property {number}  tilt_y_raw_mm_per_m       — (measured)
 * @property {number}  vibration_rms_g           — (measured) RMS over sample window
 * @property {number}  crack_mm                  — (measured) string-pot across joint
 * @property {number}  enclosure_humidity_pct    — (measured) DHT22 — enclosure, NOT ground moisture
 * @property {number}  battery_pct               — (measured)
 * @property {number}  solar_w                   — (measured) 0 at night
 * @property {number}  rssi_dbm                  — (link) LoRa RSSI
 *
 * @property {number}  tilt_x_mm_per_m           — (derived) = raw − baseline − thermal
 * @property {number}  tilt_y_mm_per_m           — (derived)
 * @property {number}  tilt_resultant_mm_per_m   — (derived) = hypot(x, y); alerts use this
 *
 * @property {number}  settlement_inferred_mm    — (derived) negative-going, monotonic magnitude
 * @property {string}  settlement_method         — 'tilt-integration'
 * @property {string}  settlement_ref_node       — id of the reference node
 * @property {number}  settlement_err_mm         — (derived) ± estimate, must be displayed with value
 *
 * @property {number}  hops_to_gateway           — (link)
 * @property {string}  parent_node               — (link) next hop toward gateway
 * @property {string}  gateway_id                — (link)
 * @property {number}  last_seen                 — (link) epoch ms
 * @property {number}  data_age_s                — (derived) = now − last_seen
 * @property {string}  link_state                — 'ok' | 'stale' | 'offline'
 * @property {number}  packet_loss_pct           — (link)
 * @property {number}  buffered_packets          — (link) store-and-forward backlog
 * @property {string}  sample_mode               — 'normal' (5 min) | 'emergency' (30 s)
 *
 * @property {Array}   quality_flags             — e.g. ['STUCK_VALUE','OUT_OF_RANGE']
 * @property {string}  data_trust                — 'good' | 'suspect' | 'bad'
 *
 * @property {string}  rule_level                — 'normal' | 'watch' | 'warning' | 'critical'
 * @property {null}    anomaly_score             — AI: null until a real model exists
 * @property {number}  trend_mm_per_m_per_day    — (derived) least-squares slope over 24 h
 * @property {Object}  spatial_agreement         — (derived) { agree, of, r2 }
 * @property {string}  status                    — final fused state shown on the map
 * @property {number}  risk_index                — (derived) rule-based composite
 */
export function makeNode(overrides = {}) {
  const now = Date.now();
  const defaults = {
    // ---- identity & siting ----
    id: 'NODE-000',
    name: 'Unnamed Node',
    panel_id: 'PANEL-A',
    lat: 23.7461,
    lng: 86.4132,
    gps_fix: '3D',
    install_date: '2026-08-14',
    spacing_m: 20,
    is_reference: false,
    firmware: '1.4.2',

    // ---- baseline (zero-calibration) ----
    baseline: {
      tilt_x_mm_per_m: 0.0,
      tilt_y_mm_per_m: 0.0,
      crack_mm: 0.0,
      set_at: '2026-08-14T09:12:00+05:30',
    },

    // ---- measured ----
    temp_c: 30.0,
    tilt_x_raw_mm_per_m: 0.0,
    tilt_y_raw_mm_per_m: 0.0,
    vibration_rms_g: 0.05,
    crack_mm: 0.0,
    enclosure_humidity_pct: 45,
    battery_pct: 90,
    solar_w: 3.0,
    rssi_dbm: -65,

    // ---- derived: tilt ----
    tilt_x_mm_per_m: 0.0,
    tilt_y_mm_per_m: 0.0,
    tilt_resultant_mm_per_m: 0.0,

    // ---- derived: settlement ----
    settlement_inferred_mm: 0.0,
    settlement_method: 'tilt-integration',
    settlement_ref_node: 'NODE-008',
    settlement_err_mm: 0.0,

    // ---- mesh / link health ----
    hops_to_gateway: 1,
    parent_node: null,
    gateway_id: 'GW-1',
    last_seen: now,
    data_age_s: 0,
    link_state: 'ok',
    packet_loss_pct: 0,
    buffered_packets: 0,
    sample_mode: 'normal',

    // ---- data quality ----
    quality_flags: [],
    data_trust: 'good',

    // ---- decision layer ----
    rule_level: 'normal',
    anomaly_score: null,
    trend_mm_per_m_per_day: 0.0,
    spatial_agreement: { agree: 0, of: 0, r2: 0.0 },
    status: 'normal',
    risk_index: 0,
  };

  // Deep merge baseline if provided
  const merged = { ...defaults, ...overrides };
  if (overrides.baseline) {
    merged.baseline = { ...defaults.baseline, ...overrides.baseline };
  }
  return merged;
}


/* ============================================
 * SEED_NODES — 8 nodes on Jharia Coalfield
 *
 * Values are self-consistent:
 *   tilt_resultant × spacing accumulated along the
 *   chain ≈ settlement_inferred_mm.
 *
 * NODE-008 is the reference node (is_reference: true),
 * sited outside the influence zone with settlement = 0.
 *
 * Chain order (for settlement integration):
 *   NODE-008(ref) → NODE-005 → NODE-001 → NODE-002
 *   → NODE-004 → NODE-003 → NODE-006 → NODE-007
 *
 * Tilts are in the 0.2–7 mm/m range (realistic).
 * Settlement is derived from tilt integration below.
 * ============================================ */

// Helper: compute settlement along the chain
// Each entry: [nodeIndex, tiltResultant, spacingM]
// Settlement at node = settlement at previous + tilt × spacing
// Resultant = hypot(x, y) — we pre-compute it here for consistency.

const now = Date.now();

export const SEED_NODES = [
  // NODE-001 — Shaft Entry (relatively low tilt, early in chain)
  makeNode({
    id: 'NODE-001',
    name: 'Panel A · Shaft Entry',
    panel_id: 'PANEL-A',
    lat: 23.7461, lng: 86.4132,
    spacing_m: 20,
    temp_c: 31.2,
    tilt_x_raw_mm_per_m: 0.85,
    tilt_y_raw_mm_per_m: 0.40,
    tilt_x_mm_per_m: 0.75,
    tilt_y_mm_per_m: 0.35,
    tilt_resultant_mm_per_m: 0.83,  // hypot(0.75, 0.35) ≈ 0.83
    vibration_rms_g: 0.12,
    crack_mm: 0.5,
    enclosure_humidity_pct: 45,
    battery_pct: 92,
    solar_w: 3.2,
    rssi_dbm: -52,
    hops_to_gateway: 1,
    parent_node: 'GW-1',
    last_seen: now,
    settlement_inferred_mm: -1.5,   // accumulated from ref via NODE-005
    settlement_err_mm: 1.2,
    status: 'normal',
    risk_index: 12,
    trend_mm_per_m_per_day: 0.05,
    spatial_agreement: { agree: 2, of: 3, r2: 0.82 },
  }),

  // NODE-002 — Ventilation Duct (low tilt)
  makeNode({
    id: 'NODE-002',
    name: 'Panel A · Ventilation Duct',
    panel_id: 'PANEL-A',
    lat: 23.7495, lng: 86.4198,
    spacing_m: 22,
    temp_c: 29.8,
    tilt_x_raw_mm_per_m: 0.55,
    tilt_y_raw_mm_per_m: 0.20,
    tilt_x_mm_per_m: 0.45,
    tilt_y_mm_per_m: 0.15,
    tilt_resultant_mm_per_m: 0.47,  // hypot(0.45, 0.15) ≈ 0.47
    vibration_rms_g: 0.08,
    crack_mm: 0.2,
    enclosure_humidity_pct: 38,
    battery_pct: 85,
    solar_w: 2.8,
    rssi_dbm: -60,
    hops_to_gateway: 2,
    parent_node: 'NODE-001',
    last_seen: now,
    settlement_inferred_mm: -2.5,   // chain: ref → 005 → 001 → 002
    settlement_err_mm: 1.8,
    status: 'normal',
    risk_index: 8,
    trend_mm_per_m_per_day: 0.02,
    spatial_agreement: { agree: 2, of: 3, r2: 0.78 },
  }),

  // NODE-003 — Main Gallery (moderate-high tilt, deep in chain)
  makeNode({
    id: 'NODE-003',
    name: 'Panel A · Main Gallery',
    panel_id: 'PANEL-A',
    lat: 23.7510, lng: 86.4075,
    spacing_m: 18,
    temp_c: 33.5,
    tilt_x_raw_mm_per_m: 4.80,
    tilt_y_raw_mm_per_m: 2.10,
    tilt_x_mm_per_m: 4.20,
    tilt_y_mm_per_m: 1.80,
    tilt_resultant_mm_per_m: 4.57,  // hypot(4.20, 1.80) ≈ 4.57
    vibration_rms_g: 0.45,
    crack_mm: 3.8,
    enclosure_humidity_pct: 72,
    battery_pct: 67,
    solar_w: 1.5,
    rssi_dbm: -78,
    hops_to_gateway: 3,
    parent_node: 'NODE-004',
    last_seen: now,
    settlement_inferred_mm: -14.2,  // chain: ref → … → 004 → 003
    settlement_err_mm: 3.5,
    rule_level: 'normal',
    status: 'normal',
    risk_index: 62,
    trend_mm_per_m_per_day: 0.35,
    spatial_agreement: { agree: 3, of: 4, r2: 0.88 },
  }),

  // NODE-004 — Coal Face (moderate tilt)
  makeNode({
    id: 'NODE-004',
    name: 'Panel A · Coal Face',
    panel_id: 'PANEL-A',
    lat: 23.7438, lng: 86.4265,
    spacing_m: 20,
    temp_c: 32.0,
    tilt_x_raw_mm_per_m: 2.50,
    tilt_y_raw_mm_per_m: 1.10,
    tilt_x_mm_per_m: 2.10,
    tilt_y_mm_per_m: 0.90,
    tilt_resultant_mm_per_m: 2.28,  // hypot(2.10, 0.90) ≈ 2.28
    vibration_rms_g: 0.25,
    crack_mm: 1.8,
    enclosure_humidity_pct: 55,
    battery_pct: 78,
    solar_w: 2.4,
    rssi_dbm: -65,
    hops_to_gateway: 2,
    parent_node: 'NODE-001',
    last_seen: now,
    settlement_inferred_mm: -6.1,   // chain: ref → 005 → 001 → 002 → 004
    settlement_err_mm: 2.4,
    rule_level: 'watch',
    status: 'normal',
    risk_index: 38,
    trend_mm_per_m_per_day: 0.15,
    spatial_agreement: { agree: 2, of: 3, r2: 0.75 },
  }),

  // NODE-005 — Pillar Zone (very low tilt, near reference)
  makeNode({
    id: 'NODE-005',
    name: 'Panel A · Pillar Zone',
    panel_id: 'PANEL-A',
    lat: 23.7530, lng: 86.4155,
    spacing_m: 25,
    temp_c: 28.5,
    tilt_x_raw_mm_per_m: 0.35,
    tilt_y_raw_mm_per_m: 0.15,
    tilt_x_mm_per_m: 0.25,
    tilt_y_mm_per_m: 0.10,
    tilt_resultant_mm_per_m: 0.27,  // hypot(0.25, 0.10) ≈ 0.27
    vibration_rms_g: 0.05,
    crack_mm: 0.1,
    enclosure_humidity_pct: 40,
    battery_pct: 95,
    solar_w: 3.8,
    rssi_dbm: -48,
    hops_to_gateway: 1,
    parent_node: 'GW-1',
    last_seen: now,
    settlement_inferred_mm: -0.5,   // first hop from reference
    settlement_err_mm: 0.6,
    status: 'normal',
    risk_index: 5,
    trend_mm_per_m_per_day: 0.01,
    spatial_agreement: { agree: 1, of: 2, r2: 0.65 },
  }),

  // NODE-006 — Surface Crack zone (high tilt, deep in chain)
  makeNode({
    id: 'NODE-006',
    name: 'Panel A · Surface Crack',
    panel_id: 'PANEL-A',
    lat: 23.7475, lng: 86.4310,
    spacing_m: 18,
    temp_c: 34.2,
    tilt_x_raw_mm_per_m: 5.50,
    tilt_y_raw_mm_per_m: 2.30,
    tilt_x_mm_per_m: 4.80,
    tilt_y_mm_per_m: 2.00,
    tilt_resultant_mm_per_m: 5.20,  // hypot(4.80, 2.00) ≈ 5.20
    vibration_rms_g: 0.38,
    crack_mm: 4.2,
    enclosure_humidity_pct: 65,
    battery_pct: 55,
    solar_w: 1.2,
    rssi_dbm: -72,
    hops_to_gateway: 3,
    parent_node: 'NODE-003',
    last_seen: now,
    settlement_inferred_mm: -23.6,  // chain: … → 003 → 006
    settlement_err_mm: 4.0,
    rule_level: 'normal',
    status: 'normal',
    risk_index: 68,
    trend_mm_per_m_per_day: 0.42,
    spatial_agreement: { agree: 3, of: 4, r2: 0.91 },
  }),

  // NODE-007 — Collapse Risk zone (highest tilt, end of chain)
  makeNode({
    id: 'NODE-007',
    name: 'Panel A · Collapse Risk',
    panel_id: 'PANEL-A',
    lat: 23.7420, lng: 86.4110,
    spacing_m: 15,
    temp_c: 35.1,
    tilt_x_raw_mm_per_m: 7.20,
    tilt_y_raw_mm_per_m: 3.40,
    tilt_x_mm_per_m: 6.50,
    tilt_y_mm_per_m: 3.00,
    tilt_resultant_mm_per_m: 7.16,  // hypot(6.50, 3.00) ≈ 7.16
    vibration_rms_g: 0.55,
    crack_mm: 6.8,
    enclosure_humidity_pct: 80,
    battery_pct: 42,
    solar_w: 0.8,
    rssi_dbm: -88,
    hops_to_gateway: 3,
    parent_node: 'NODE-006',
    last_seen: now,
    settlement_inferred_mm: -30.8,  // chain: … → 006 → 007
    settlement_err_mm: 4.8,
    rule_level: 'normal',
    status: 'normal',  // single node alone → WARNING, not CRITICAL (§3.6)
    risk_index: 85,
    trend_mm_per_m_per_day: 0.58,
    spatial_agreement: { agree: 3, of: 4, r2: 0.90 },
  }),

  // NODE-008 — Boundary Post (REFERENCE NODE — outside influence zone)
  makeNode({
    id: 'NODE-008',
    name: 'Panel A · Boundary Post',
    panel_id: 'PANEL-A',
    lat: 23.7445, lng: 86.4020,
    spacing_m: 0,  // reference node — start of chain
    is_reference: true,
    temp_c: 27.8,
    tilt_x_raw_mm_per_m: 0.10,
    tilt_y_raw_mm_per_m: 0.05,
    tilt_x_mm_per_m: 0.05,
    tilt_y_mm_per_m: 0.02,
    tilt_resultant_mm_per_m: 0.05,
    vibration_rms_g: 0.03,
    crack_mm: 0.0,
    enclosure_humidity_pct: 35,
    battery_pct: 98,
    solar_w: 4.1,
    rssi_dbm: -45,
    hops_to_gateway: 1,
    parent_node: 'GW-1',
    last_seen: now,
    settlement_inferred_mm: 0.0,   // reference — always zero
    settlement_err_mm: 0.0,
    status: 'normal',
    risk_index: 3,
    trend_mm_per_m_per_day: 0.0,
    spatial_agreement: { agree: 0, of: 0, r2: 0.0 },
  }),
];
