import { describe, expect, it } from 'vitest';
import {
  qFromAxisAngle,
  qFromUnitVectors,
  qMultiply,
  qRotate,
  snapToGrid,
  transformPoint,
  vCross,
  vDot,
  vLength,
} from './math';
import type { Vec3 } from './types';

const close = (a: Vec3, b: Vec3, eps = 1e-9) => {
  expect(Math.abs(a[0] - b[0])).toBeLessThan(eps);
  expect(Math.abs(a[1] - b[1])).toBeLessThan(eps);
  expect(Math.abs(a[2] - b[2])).toBeLessThan(eps);
};

describe('quaternion math', () => {
  it('rotates a vector 90° about Y', () => {
    const q = qFromAxisAngle([0, 1, 0], Math.PI / 2);
    close(qRotate(q, [1, 0, 0]), [0, 0, -1], 1e-12);
  });

  it('qFromUnitVectors aligns arbitrary directions', () => {
    const from: Vec3 = [1, 0, 0];
    const to: Vec3 = [0, 0.6, 0.8];
    const q = qFromUnitVectors(from, to);
    close(qRotate(q, from), to, 1e-9);
  });

  it('qFromUnitVectors handles the antiparallel case', () => {
    const q = qFromUnitVectors([0, 1, 0], [0, -1, 0]);
    close(qRotate(q, [0, 1, 0]), [0, -1, 0], 1e-9);
  });

  it('composes rotations like matrix products', () => {
    const a = qFromAxisAngle([0, 1, 0], 0.7);
    const b = qFromAxisAngle([1, 0, 0], -0.3);
    const v: Vec3 = [0.2, -1, 0.5];
    close(qRotate(qMultiply(a, b), v), qRotate(a, qRotate(b, v)), 1e-12);
  });

  it('transformPoint applies rotation then translation', () => {
    const t = {
      position: [1, 2, 3] as Vec3,
      rotation: qFromAxisAngle([0, 1, 0], Math.PI / 2),
    };
    close(transformPoint(t, [1, 0, 0]), [1, 2, 2], 1e-12);
  });
});

describe('vector helpers', () => {
  it('cross/dot/length basics', () => {
    close(vCross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
    expect(vDot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(vLength([3, 4, 0])).toBe(5);
  });

  it('snapToGrid', () => {
    expect(snapToGrid(1.26, 0.5)).toBe(1.5);
    expect(snapToGrid(-0.74, 0.5)).toBe(-0.5);
  });
});
