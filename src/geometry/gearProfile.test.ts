import { describe, expect, it } from 'vitest';
import { gearDims, gearOutline } from './gearProfile';

describe('gearDims', () => {
  it('derives standard involute radii', () => {
    const d = gearDims(16, 0.5);
    expect(d.rPitch).toBe(4);
    expect(d.rOuter).toBe(4.5);
    expect(d.rRoot).toBeCloseTo(4 - 0.625, 10);
    expect(d.rBase).toBeCloseTo(4 * Math.cos((20 * Math.PI) / 180), 10);
  });

  it('meshing distance of two gears is the sum of pitch radii', () => {
    const a = gearDims(8, 0.5);
    const b = gearDims(24, 0.5);
    expect(a.rPitch + b.rPitch).toBe(8);
  });
});

describe('gearOutline', () => {
  it('keeps every outline point between root and outer radius', () => {
    for (const [teeth, module] of [
      [8, 0.5],
      [16, 0.5],
      [48, 0.25],
    ] as const) {
      const { rRoot, rOuter } = gearDims(teeth, module);
      for (const [x, y] of gearOutline(teeth, module)) {
        const r = Math.hypot(x, y);
        expect(r).toBeGreaterThanOrEqual(rRoot - 1e-9);
        expect(r).toBeLessThanOrEqual(rOuter + 1e-9);
      }
    }
  });

  it('repeats per tooth', () => {
    const teeth = 12;
    const pts = gearOutline(teeth, 0.5);
    expect(pts.length % teeth).toBe(0);
    // Rotating the outline by one pitch maps it onto itself.
    const perTooth = pts.length / teeth;
    const angle = (2 * Math.PI) / teeth;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let i = 0; i < perTooth; i++) {
      const [x, y] = pts[i];
      const [rx, ry] = [x * cos - y * sin, x * sin + y * cos];
      const [nx, ny] = pts[i + perTooth];
      expect(rx).toBeCloseTo(nx, 9);
      expect(ry).toBeCloseTo(ny, 9);
    }
  });
});
