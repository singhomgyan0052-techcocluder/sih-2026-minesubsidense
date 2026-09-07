import { degToMmPerM, mmPerMToDeg, influenceRadiusM } from './constants';

describe('constants math helpers', () => {
  test('degToMmPerM converts degrees to mm/m accurately', () => {
    // 15 deg / 0.0573 ≈ 261.78 mm/m
    const result = degToMmPerM(15);
    expect(result).toBeCloseTo(261.78, 1);
  });

  test('mmPerMToDeg converts mm/m to degrees', () => {
    // 5 mm/m * 0.0573 = 0.2865 deg
    const result = mmPerMToDeg(5);
    expect(result).toBeCloseTo(0.2865, 4);
  });

  test('influenceRadiusM computes radius based on depth and angle of draw', () => {
    // 45 m * tan(25 deg) ≈ 20.98 m
    const result = influenceRadiusM(45, 25);
    expect(result).toBeCloseTo(20.98, 1);
  });
});
