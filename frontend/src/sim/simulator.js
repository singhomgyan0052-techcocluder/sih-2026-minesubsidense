/** ============================================
 *  Deterministic Simulator
 *
 *  Produces measurement-only data from a seeded
 *  PRNG. Does NOT compute statuses or alerts —
 *  that is the alert engine's job.
 *
 *  Time scaling: SIM_TIME_SCALE = 150
 *    → one 2 s wall-clock tick = 300 s simulated
 *    → one simulated day = 288 ticks ≈ 9.6 min wall
 *  ============================================ */

import { mulberry32 } from './prng';
import { SCENARIOS, DEFAULT_SCENARIO } from './scenarios';
import {
  DEFAULT_SEED,
  SIM_TIME_SCALE,
  SAMPLE_INTERVAL_S,
} from '../model/constants';

/**
 * Creates a simulator instance.
 *
 * @param {Object}  opts
 * @param {number}  opts.seed     — PRNG seed (default: 26025)
 * @param {Array}   opts.nodes    — initial node array (SEED_NODES)
 * @param {string}  opts.scenario — scenario key from SCENARIOS
 * @returns {{ step: () => Object[], tick: number, simTimeS: number, seed: number }}
 */
export function createSimulator({
  seed = DEFAULT_SEED,
  nodes,
  scenario = DEFAULT_SCENARIO,
} = {}) {
  const rng = mulberry32(seed);
  const sc = SCENARIOS[scenario] || SCENARIOS[DEFAULT_SCENARIO];

  // Deep clone the initial state so mutations don't affect the caller
  let state = nodes.map(n => ({ ...n, baseline: { ...n.baseline } }));
  let tick = 0;
  // Start simulated time at a morning hour for realistic diurnal cycle
  const simStartEpochS = Math.floor(Date.now() / 1000);

  /** Gaussian approximation via Box-Muller (uses 2 rng calls) */
  function gauss(mean, stddev) {
    const u1 = rng() || 1e-10;
    const u2 = rng();
    return mean + stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /** Uniform in [lo, hi) */
  function uniform(lo, hi) {
    return lo + rng() * (hi - lo);
  }

  /** Clamp to range */
  function clamp(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  /**
   * Advance one tick. Returns the next full node array.
   * Produces measurements only — no statuses, no alerts.
   */
  function step() {
    tick += 1;
    const simTimeS = simStartEpochS + tick * SAMPLE_INTERVAL_S;
    const simDayFrac = (tick % 288) / 288; // fraction of a simulated day
    const simDays = tick / 288;             // total simulated days elapsed

    // Diurnal temperature: peaks at ~14:00 (frac ≈ 0.58), troughs at ~05:00 (frac ≈ 0.21)
    const diurnalPhase = 2 * Math.PI * (simDayFrac - 0.58);
    const tempBase = 30; // °C mean

    const nextState = state.map((node, idx) => {
      const n = { ...node, baseline: { ...node.baseline } };

      // --- Node death scenario ---
      if (sc.hasNodeDeath && n.id === sc.nodeDeathId && tick >= sc.nodeDeathTick) {
        // Node goes silent — keep its last values but stop updating last_seen
        n.data_age_s = (tick - sc.nodeDeathTick) * SAMPLE_INTERVAL_S;
        return n;
      }

      // --- Temperature: diurnal curve + node-specific offset ---
      const tempOffset = idx * 0.4; // slight per-node variation
      n.temp_c = +(tempBase + sc.tempAmplitude * Math.cos(diurnalPhase) + tempOffset + gauss(0, 0.3)).toFixed(1);

      // --- Tilt: gradual drift (subsidence signal) + thermal artefact ---
      // Only nodes in the active zone drift (not the reference node)
      const driftMultiplier = n.is_reference ? 0 : (1 + idx * 0.3); // deeper nodes drift faster
      const tiltDrift = sc.tiltDriftRate * simDays * driftMultiplier;

      // Thermal artefact: MEMS zero-g offset drift proportional to temp deviation
      // [VERIFY] coefficient from MPU6050/6500 datasheet
      const thermalCoeff = 0.08; // mm/m per °C deviation — [VERIFY]
      const tempDeviation = n.temp_c - tempBase;
      const thermalOffset = thermalCoeff * tempDeviation;

      // Raw tilt = baseline offset + real drift + thermal artefact + noise
      const baseTiltX = n.baseline.tilt_x_mm_per_m || 0;
      const baseTiltY = n.baseline.tilt_y_mm_per_m || 0;

      // Get the seed tilt from the initial state (node's starting corrected tilt)
      const seedTiltX = nodes[idx].tilt_x_mm_per_m;
      const seedTiltY = nodes[idx].tilt_y_mm_per_m;

      const realTiltX = seedTiltX + tiltDrift + gauss(0, 0.05);
      const realTiltY = seedTiltY + tiltDrift * 0.4 + gauss(0, 0.03);

      n.tilt_x_raw_mm_per_m = +(baseTiltX + realTiltX + thermalOffset + gauss(0, 0.02)).toFixed(2);
      n.tilt_y_raw_mm_per_m = +(baseTiltY + realTiltY + thermalOffset * 0.5 + gauss(0, 0.01)).toFixed(2);

      // Corrected tilt = raw − baseline − thermal
      n.tilt_x_mm_per_m = +(n.tilt_x_raw_mm_per_m - baseTiltX - thermalOffset).toFixed(2);
      n.tilt_y_mm_per_m = +(n.tilt_y_raw_mm_per_m - baseTiltY - thermalOffset * 0.5).toFixed(2);
      n.tilt_resultant_mm_per_m = +Math.hypot(n.tilt_x_mm_per_m, n.tilt_y_mm_per_m).toFixed(2);

      // --- Vibration: noise around baseline ---
      const vibBase = nodes[idx].vibration_rms_g;
      n.vibration_rms_g = +clamp(vibBase + gauss(0, sc.vibNoise), 0.01, 2.5).toFixed(3);

      // --- Crack: monotonic drift + noise ---
      const crackDrift = n.is_reference ? 0 : sc.crackDriftRate * simDays * (driftMultiplier * 0.5);
      const seedCrack = nodes[idx].crack_mm;
      n.crack_mm = +clamp(seedCrack + crackDrift + Math.abs(gauss(0, 0.02)), 0, 15).toFixed(2);

      // --- Settlement: derived from tilt integration (done separately) ---
      // The simulator generates tilt; settlement is computed by integrateSettlement()
      // For now, accumulate a rough estimate that only decreases (monotonic)
      const prevSettlement = node.settlement_inferred_mm;
      const tiltContribution = -(n.tilt_resultant_mm_per_m * n.spacing_m / 1000) * SAMPLE_INTERVAL_S / 86400;
      n.settlement_inferred_mm = +Math.min(prevSettlement, prevSettlement + tiltContribution).toFixed(1);
      n.settlement_err_mm = +(nodes[idx].settlement_err_mm + simDays * 0.01).toFixed(1);

      // --- Battery: slow drain, solar charge during day ---
      const isDaytime = simDayFrac > 0.25 && simDayFrac < 0.75;
      n.solar_w = isDaytime ? +(2 + 3 * Math.sin(Math.PI * (simDayFrac - 0.25) / 0.5) + gauss(0, 0.2)).toFixed(1) : 0.0;
      n.solar_w = Math.max(0, n.solar_w);
      const batteryDelta = isDaytime ? 0.002 : -0.01;
      n.battery_pct = Math.round(clamp(node.battery_pct + batteryDelta + gauss(0, 0.1), 0, 100));

      // --- Enclosure humidity ---
      n.enclosure_humidity_pct = Math.round(clamp(node.enclosure_humidity_pct + gauss(0, 1), 10, 95));

      // --- RSSI: small fluctuations ---
      n.rssi_dbm = Math.round(clamp(node.rssi_dbm + gauss(0, 2), -130, -30));

      // --- Link metadata ---
      n.last_seen = simTimeS * 1000; // epoch ms
      n.data_age_s = 0; // just received
      n.packet_loss_pct = Math.round(clamp(node.packet_loss_pct + gauss(0, 0.5), 0, 30));

      // --- Trend (simplified least-squares proxy) ---
      n.trend_mm_per_m_per_day = +(sc.tiltDriftRate * driftMultiplier + gauss(0, 0.02)).toFixed(3);
      if (n.is_reference) n.trend_mm_per_m_per_day = 0;

      return n;
    });

    state = nextState;
    return {
      nodes: nextState.map(n => ({ ...n })),
      tick,
      simTimeS,
      simTimestamp: simTimeS * 1000,
    };
  }

  return {
    step,
    get tick() { return tick; },
    get simTimeS() { return simStartEpochS + tick * SAMPLE_INTERVAL_S; },
    seed,
    scenario: sc.name,
    scenarioKey: scenario,
  };
}
