import { describe, expect, it } from 'vitest';
import { gearPoints } from './Gear';

describe('gearPoints', () => {
  it('emits four points per tooth within the outer radius', () => {
    const points = gearPoints(8, 48, 38).split(' ');
    expect(points).toHaveLength(32);
    for (const point of points) {
      const [x = 0, y = 0] = point.split(',').map(Number);
      expect(Math.hypot(x - 50, y - 50)).toBeLessThanOrEqual(48.01);
    }
  });
});
