import { evaluateNode } from './alertEngine';
import { makeNode } from '../model/nodeShape';

describe('alertEngine', () => {
  test('Hysteresis: stepping 1.8 -> 2.4 -> 1.9 -> 2.3 fires warning once', () => {
    let node = makeNode({ id: 'N1', tilt_resultant_mm_per_m: 1.8 });
    let state = {};
    let now = 100;

    // 1. 1.8 mm/m -> Normal
    let res = evaluateNode(node, state, now);
    expect(res.level).toBe('normal');
    expect(res.firedRules).toHaveLength(0);
    state = res.nextRuleState;

    // 2. 2.4 mm/m -> Warning (fires rule)
    now += 10;
    node = { ...node, tilt_resultant_mm_per_m: 2.4 };
    res = evaluateNode(node, state, now);
    expect(res.level).toBe('warning');
    expect(res.firedRules).toHaveLength(1);
    expect(res.firedRules[0].code).toBe('TILT_ABS');
    state = res.nextRuleState;

    // 3. 1.9 mm/m -> Drops below enter (2.0) but above exit (1.6), stays warning, does NOT fire new alert
    now += 10;
    node = { ...node, tilt_resultant_mm_per_m: 1.9 };
    res = evaluateNode(node, state, now);
    expect(res.level).toBe('warning');
    expect(res.firedRules).toHaveLength(0);
    state = res.nextRuleState;

    // 4. 2.3 mm/m -> Still in warning, cooldown active, does NOT fire new alert
    now += 10;
    node = { ...node, tilt_resultant_mm_per_m: 2.3 };
    res = evaluateNode(node, state, now);
    expect(res.level).toBe('warning');
    expect(res.firedRules).toHaveLength(0);
  });

  test('Latch: crossing 5.0 then 4.5 stays critical; 3.9 clears to warning/normal', () => {
    let node = makeNode({ id: 'N1', tilt_resultant_mm_per_m: 5.2 });
    let state = {};
    let now = 100;

    // Crossing 5.0 (critEnter: 5.0) -> Critical
    let res = evaluateNode(node, state, now);
    expect(res.level).toBe('critical');
    state = res.nextRuleState;

    // Drops to 4.5 -> Above critExit (4.0), stays Critical
    now += 10;
    node = { ...node, tilt_resultant_mm_per_m: 4.5 };
    res = evaluateNode(node, state, now);
    expect(res.level).toBe('critical');
    state = res.nextRuleState;

    // Drops to 3.9 -> Below critExit (4.0), clears Critical (becomes warning because 3.9 >= 2.0 warnEnter)
    now += 10;
    node = { ...node, tilt_resultant_mm_per_m: 3.9 };
    res = evaluateNode(node, state, now);
    expect(res.level).toBe('warning');
  });

  test('Determinism: identical inputs produce deep-equal outputs', () => {
    const node = makeNode({ id: 'N1', tilt_resultant_mm_per_m: 3.5, vibration_rms_g: 0.4 });
    const state = {};
    const now = 500;

    const res1 = evaluateNode(node, state, now);
    const res2 = evaluateNode(node, state, now);

    expect(res1).toEqual(res2);
  });

  test('Cooldown and Escalation: same rule suppresses refire within cooldown, escalation bypasses', () => {
    let node = makeNode({ id: 'N1', tilt_resultant_mm_per_m: 2.5 });
    let state = {};
    let now = 100;

    // Fires warning
    let res = evaluateNode(node, state, now);
    expect(res.firedRules).toHaveLength(1);
    expect(res.firedRules[0].level).toBe('warning');
    state = res.nextRuleState;

    // 100 seconds later (cooldown is 600s), same level -> does NOT fire
    now += 100;
    res = evaluateNode(node, state, now);
    expect(res.firedRules).toHaveLength(0);
    state = res.nextRuleState;

    // Escalation to Critical -> Bypasses cooldown and fires!
    now += 100;
    node = { ...node, tilt_resultant_mm_per_m: 5.5 };
    res = evaluateNode(node, state, now);
    expect(res.firedRules).toHaveLength(1);
    expect(res.firedRules[0].level).toBe('critical');
  });
});
