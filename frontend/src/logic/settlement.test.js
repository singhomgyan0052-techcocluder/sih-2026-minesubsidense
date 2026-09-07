import { integrateSettlement } from './settlement';
import { makeNode } from '../model/nodeShape';

describe('settlement logic', () => {
  test('Reference node stays at 0 settlement and 0 error', () => {
    const nodes = [
      makeNode({ id: 'NODE-008', is_reference: true, parent_node: 'GW-1' }),
      makeNode({ id: 'NODE-001', parent_node: 'NODE-008', spacing_m: 25, tilt_resultant_mm_per_m: 2.0 }),
    ];

    const results = integrateSettlement(nodes);
    expect(results['NODE-008'].settlement_inferred_mm).toBe(0);
    expect(results['NODE-008'].settlement_err_mm).toBe(0);
  });

  test('Hand-computed 3-node chain matches expected settlement and error growth', () => {
    // NODE-008 (ref) -> NODE-001 (spacing 25, tilt 2.0) -> NODE-002 (spacing 25, tilt 3.0)
    // NODE-001 settlement = 0 - (2.0 * 25) = -50.0 mm
    // NODE-001 error = sqrt(0 + (0.15 * 25)^2) = sqrt(14.0625) = 3.75 -> 3.8 mm
    // NODE-002 settlement = -50.0 - (3.0 * 25) = -125.0 mm
    // NODE-002 error = sqrt(3.75^2 + (0.15 * 25)^2) = sqrt(28.125) = 5.3 mm
    const nodes = [
      makeNode({ id: 'NODE-008', is_reference: true, parent_node: 'GW-1' }),
      makeNode({ id: 'NODE-001', parent_node: 'NODE-008', spacing_m: 25, tilt_resultant_mm_per_m: 2.0 }),
      makeNode({ id: 'NODE-002', parent_node: 'NODE-001', spacing_m: 25, tilt_resultant_mm_per_m: 3.0 }),
    ];

    const results = integrateSettlement(nodes);
    expect(results['NODE-001'].settlement_inferred_mm).toBe(-50.0);
    expect(results['NODE-002'].settlement_inferred_mm).toBe(-125.0);
    expect(results['NODE-002'].settlement_err_mm).toBeGreaterThan(results['NODE-001'].settlement_err_mm);
  });

  test('500 ticks: settlement magnitude only increases (monotonic non-increasing values)', () => {
    let nodes = [
      makeNode({ id: 'NODE-008', is_reference: true, parent_node: 'GW-1' }),
      makeNode({ id: 'NODE-001', parent_node: 'NODE-008', spacing_m: 25, tilt_resultant_mm_per_m: 2.0 }),
    ];

    let prevSettlements = {};
    let lastSettlement = 0;

    for (let tick = 0; tick < 500; tick++) {
      // Vary tilt up and down (e.g. 2.0 -> 1.0 -> 4.0)
      const mockTilt = 2.0 + Math.sin(tick) * 1.5;
      nodes[1] = { ...nodes[1], tilt_resultant_mm_per_m: mockTilt };

      const res = integrateSettlement(nodes, prevSettlements);
      const val = res['NODE-001'].settlement_inferred_mm;

      expect(val).toBeLessThanOrEqual(lastSettlement);
      lastSettlement = val;
      prevSettlements = res;
    }
  });
});
