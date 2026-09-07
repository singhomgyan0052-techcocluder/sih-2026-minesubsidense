import { neighboursOf, spatialAgreement } from './corroborate';
import { evaluateNode } from './alertEngine';
import { makeNode } from '../model/nodeShape';

describe('spatial corroboration logic', () => {
  test('data_trust: "bad" and link_state: "offline" are excluded from neighbours', () => {
    const baseNode = makeNode({ id: 'N1', lat: 23.780, lng: 86.410 });
    const neighbours = [
      makeNode({ id: 'N2', lat: 23.7801, lng: 86.4101, data_trust: 'good' }),
      makeNode({ id: 'N3', lat: 23.7802, lng: 86.4102, data_trust: 'bad' }),
      makeNode({ id: 'N4', lat: 23.7803, lng: 86.4103, link_state: 'offline' }),
    ];

    const result = neighboursOf(baseNode, [baseNode, ...neighbours], 500);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('N2');
  });

  test('Isolated node at 6 mm/m soft threshold yields WARNING when spatial agreement fails', () => {
    const node = makeNode({ id: 'N1', tilt_resultant_mm_per_m: 6.0 });
    const spatialCtx = { agree: 0, of: 0, r2: 0.1 };

    const res = evaluateNode(node, {}, 100, spatialCtx);
    expect(res.level).toBe('warning');
    expect(res.firedRules[0].reason).toContain('single-node excursion');
  });

  test('Three coherent adjacent nodes yield CRITICAL and R² >= 0.7', () => {
    const baseNode = makeNode({ id: 'N1', lat: 23.780, lng: 86.410, tilt_resultant_mm_per_m: 6.0, trend_mm_per_m_per_day: 1.0 });
    const n2 = makeNode({ id: 'N2', lat: 23.7801, lng: 86.4101, tilt_resultant_mm_per_m: 5.5, trend_mm_per_m_per_day: 0.9 });
    const n3 = makeNode({ id: 'N3', lat: 23.7802, lng: 86.4102, tilt_resultant_mm_per_m: 5.0, trend_mm_per_m_per_day: 0.8 });
    const n4 = makeNode({ id: 'N4', lat: 23.7803, lng: 86.4103, tilt_resultant_mm_per_m: 4.5, trend_mm_per_m_per_day: 0.7 });

    const neighbours = neighboursOf(baseNode, [baseNode, n2, n3, n4], 500);
    const spatialCtx = spatialAgreement(baseNode, neighbours);

    expect(spatialCtx.agree).toBe(3);
    expect(spatialCtx.of).toBe(3);
    expect(spatialCtx.r2).toBeGreaterThanOrEqual(0.70);

    const res = evaluateNode(baseNode, {}, 100, spatialCtx);
    expect(res.level).toBe('critical');
  });
});
