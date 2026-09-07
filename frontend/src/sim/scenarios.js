/** ============================================
 *  Scenario Definitions
 *
 *  Each scenario is a named parameter set that
 *  drives the simulator's physics model.
 *  ============================================ */

/**
 * @typedef {Object} Scenario
 * @property {string}  name          — human label
 * @property {string}  description   — what to expect
 * @property {number}  tiltDriftRate — mm/m per simulated day added to base tilt
 * @property {number}  crackDriftRate— mm per simulated day added to crack
 * @property {number}  vibNoise      — amplitude of vibration noise (g RMS)
 * @property {number}  tempAmplitude — diurnal temperature swing ±°C from 30°C
 * @property {boolean} hasNodeDeath  — whether a node goes offline mid-run
 * @property {number}  nodeDeathTick — tick at which node dies (if hasNodeDeath)
 * @property {string}  nodeDeathId   — which node dies
 */

export const SCENARIOS = {
  steady: {
    name: 'Steady state',
    description: 'Stable mine — expect no alerts, minor fluctuations only.',
    tiltDriftRate: 0.0,
    crackDriftRate: 0.0,
    vibNoise: 0.03,
    tempAmplitude: 8,
    hasNodeDeath: false,
    nodeDeathTick: Infinity,
    nodeDeathId: null,
  },

  'slow-subsidence': {
    name: 'Slow subsidence (weeks)',
    description: 'Gradual tilt increase on nodes 003/006/007 — expect WARNING then CRITICAL as neighbours corroborate.',
    tiltDriftRate: 0.15,      // mm/m per simulated day
    crackDriftRate: 0.08,     // mm per simulated day
    vibNoise: 0.05,
    tempAmplitude: 10,
    hasNodeDeath: false,
    nodeDeathTick: Infinity,
    nodeDeathId: null,
  },
};

export const DEFAULT_SCENARIO = 'slow-subsidence';
