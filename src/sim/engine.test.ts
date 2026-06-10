/** End-to-end physics test: build the bundled demo machine in a real Rapier
 * world and verify the whole pipeline — islands, joints, motor drive, gear
 * coupling, pose sync — produces the physically correct result. */

import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import '@/parts';
import { gearReductionDemo } from '@/examples/gearReduction';
import { SimulationEngine } from './engine';
import { partPoses, springEndpoints } from './syncState';
import { qRotate } from '@/model/math';
import type { Quat, Vec3 } from '@/model/types';

const H = 1 / 120;

function spinAbout(prev: Quat, next: Quat, axis: Vec3, h: number): number {
  // Small-angle estimate of angular velocity about `axis` between two frames.
  const a0 = qRotate(prev, [1, 0, 0]);
  const a1 = qRotate(next, [1, 0, 0]);
  // Project both onto the plane ⊥ axis and measure the signed angle.
  const proj = (v: Vec3): [number, number] => {
    const d = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
    const p: Vec3 = [v[0] - d * axis[0], v[1] - d * axis[1], v[2] - d * axis[2]];
    // Build a 2D basis: use world X/Z when axis ≈ Y.
    return [p[0], p[2]];
  };
  const [x0, z0] = proj(a0);
  const [x1, z1] = proj(a1);
  const cross = x0 * z1 - z0 * x1;
  const dot = x0 * x1 + z0 * z1;
  // Y axis: positive rotation about +Y moves X toward -Z, so flip the sign.
  return -Math.atan2(cross, dot) / h;
}

describe('SimulationEngine on the demo machine', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('drives the 8T→24T train at exactly 3:1 with counter-rotation', () => {
    const engine = new SimulationEngine(gearReductionDemo());
    expect(engine.warnings).toEqual([]);

    const stats = engine.stats();
    // plate+motor+post = static island; axle1+gearA; axle2+gearB; loose disc.
    expect(stats.bodies).toBe(3);
    expect(stats.couplings).toBe(1);
    expect(stats.motors).toBe(1);

    // Let it spin up: 3 simulated seconds.
    for (let i = 0; i < 360; i++) engine.step(H);
    engine.writePoses();
    const prevA = partPoses.get('gearA')!;
    const prevB = partPoses.get('gearB')!;
    engine.step(H);
    engine.writePoses();
    const nextA = partPoses.get('gearA')!;
    const nextB = partPoses.get('gearB')!;

    const Y: Vec3 = [0, 1, 0];
    const wA = spinAbout(prevA.quaternion, nextA.quaternion, Y, H);
    const wB = spinAbout(prevB.quaternion, nextB.quaternion, Y, H);

    // Motor target: 30 rpm = π rad/s on the pinion axle.
    expect(wA).toBeCloseTo(Math.PI, 1);
    // 3:1 reduction, counter-rotating.
    expect(wB / wA).toBeCloseTo(-1 / 3, 2);

    // Gears stayed at their mounting heights (no drift through joints).
    expect(nextA.position[1]).toBeCloseTo(9.1, 1);
    expect(nextB.position[1]).toBeCloseTo(9.1, 1);
    // Tooth phase error stays negligible.
    expect(engine.stats().maxGearDrift).toBeLessThan(1e-2);

    // The loose disc fell under gravity and rests on the plate (y = 0.5 + 0.5).
    const disc = partPoses.get('weight')!;
    expect(disc.position[1]).toBeGreaterThan(0.8);
    expect(disc.position[1]).toBeLessThan(1.2);

    expect(springEndpoints.size).toBe(0);
    engine.dispose();
  });

  it('motor stalls when the output gear is jammed against the frame', () => {
    const doc = gearReductionDemo();
    // Weld the output axle to its post: gearB becomes part of the static
    // frame, so the meshed pinion must not turn no matter the motor torque.
    const bearing = doc.connections.find((c) => c.id === 'c_axle2_post')!;
    bearing.kind = 'fixed';
    const engine = new SimulationEngine(doc);
    for (let i = 0; i < 240; i++) engine.step(H);
    engine.writePoses();
    const prev = partPoses.get('gearA')!;
    engine.step(H);
    engine.writePoses();
    const next = partPoses.get('gearA')!;
    const w = spinAbout(prev.quaternion, next.quaternion, [0, 1, 0], H);
    expect(Math.abs(w)).toBeLessThan(0.05); // jammed solid
    engine.dispose();
  });
});
