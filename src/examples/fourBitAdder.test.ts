/** End-to-end test of the mechanical 4-bit adder: build the real machine in a
 * real Rapier world, servo the input dials, and read the answer off the
 * readout shaft — exactly what a user sees, minus the pixels. */

import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import '@/parts';
import { SimulationEngine } from '@/sim/engine';
import { partPoses } from '@/sim/syncState';
import { fourBitAdderDemo } from './fourBitAdder';

const H = 1 / 120;
const UNIT = Math.PI / 16; // readout shaft angle per 1 of result

/** Yaw of a pure-Y rotation quaternion, in [0, 2π). */
function yawOf(q: [number, number, number, number]): number {
  const phi = 2 * Math.atan2(q[1], q[3]);
  return phi < 0 ? phi + 2 * Math.PI : phi;
}

function computedSum(a: number, b: number): number {
  const engine = new SimulationEngine(fourBitAdderDemo(a, b));
  expect(engine.warnings).toEqual([]);
  for (let i = 0; i < 720; i++) engine.step(H); // 6 simulated seconds
  engine.writePoses();
  const drum = partPoses.get('drum_bit0')!;
  const angle = yawOf(drum.quaternion);
  engine.dispose();
  return angle / UNIT;
}

describe('mechanical 4-bit adder', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('builds with the expected mechanism inventory', { timeout: 30000 }, () => {
    const engine = new SimulationEngine(fourBitAdderDemo(0, 0));
    expect(engine.warnings).toEqual([]);
    const stats = engine.stats();
    // 7 differentials + 9 inferred gear meshes; 8 servo dials.
    expect(stats.couplings).toBe(7 + 9);
    expect(stats.motors).toBe(8);
    engine.dispose();
  });

  it.each([
    [0, 0],
    [1, 0],
    [0, 1],
    [11, 7],
    [15, 15],
    [15, 1],
    [8, 7],
    [5, 10],
    [9, 12],
    [3, 3],
  ])('computes %i + %i mechanically', { timeout: 30000 }, (a, b) => {
    const result = computedSum(a, b);
    // Within 0.15 of a drum sector center — crisp and unambiguous on the
    // display (sectors are 1 unit wide).
    expect(Math.abs(result - (a + b))).toBeLessThan(0.15);
  });
});
