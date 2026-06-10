import { describe, expect, it } from 'vitest';
import { qFromAxisAngle } from '@/model/math';
import type { Quat, Vec3 } from '@/model/types';
import { detectGearMeshes, type GearInfo } from './gearMeshDetector';

const ID: Quat = [0, 0, 0, 1];

function g(
  partId: string,
  position: Vec3,
  teeth: number,
  opts: Partial<GearInfo> & { rotation?: Quat } = {},
): GearInfo {
  const module = opts.module ?? 0.5;
  return {
    partId,
    islandIndex: opts.islandIndex ?? Number(partId.replace(/\D/g, '') || 0),
    transform: { position, rotation: opts.rotation ?? ID },
    teeth,
    module,
    faceWidth: opts.faceWidth ?? 1,
    pitchRadius: (module * teeth) / 2,
  };
}

describe('detectGearMeshes', () => {
  it('detects two gears at exact pitch distance', () => {
    // 16T (r=4) + 16T (r=4): centers 8 apart, parallel Y axes.
    const { meshes, warnings } = detectGearMeshes([
      g('g0', [0, 5, 0], 16, { islandIndex: 0 }),
      g('g1', [8, 5, 0], 16, { islandIndex: 1 }),
    ]);
    expect(meshes).toHaveLength(1);
    expect(warnings).toHaveLength(0);
    expect(meshes[0].teethA).toBe(16);
  });

  it('accepts small center-distance error (3%)', () => {
    const { meshes } = detectGearMeshes([
      g('g0', [0, 5, 0], 16, { islandIndex: 0 }),
      g('g1', [8.2, 5, 0], 16, { islandIndex: 1 }),
    ]);
    expect(meshes).toHaveLength(1);
  });

  it('warns on a near-miss instead of coupling', () => {
    const { meshes, warnings } = detectGearMeshes([
      g('g0', [0, 5, 0], 16, { islandIndex: 0 }),
      g('g1', [9, 5, 0], 16, { islandIndex: 1 }),
    ]);
    expect(meshes).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/almost mesh/);
  });

  it('ignores far-apart gears silently', () => {
    const { meshes, warnings } = detectGearMeshes([
      g('g0', [0, 5, 0], 16, { islandIndex: 0 }),
      g('g1', [30, 5, 0], 16, { islandIndex: 1 }),
    ]);
    expect(meshes).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('rejects skew axes', () => {
    const { meshes } = detectGearMeshes([
      g('g0', [0, 5, 0], 16, { islandIndex: 0 }),
      g('g1', [8, 5, 0], 16, {
        islandIndex: 1,
        rotation: qFromAxisAngle([1, 0, 0], Math.PI / 4),
      }),
    ]);
    expect(meshes).toHaveLength(0);
  });

  it('requires face-width overlap on the shared axis', () => {
    const { meshes } = detectGearMeshes([
      g('g0', [0, 5, 0], 16, { islandIndex: 0 }),
      g('g1', [8, 8, 0], 16, { islandIndex: 1 }), // 3 cm apart axially, 1 cm faces
    ]);
    expect(meshes).toHaveLength(0);
  });

  it('warns on module mismatch at meshing distance', () => {
    // 16T m=0.5 (r=4) + 10T m=0.8 (r=4): distance 8 matches but teeth differ in size.
    const { meshes, warnings } = detectGearMeshes([
      g('g0', [0, 5, 0], 16, { islandIndex: 0, module: 0.5 }),
      g('g1', [8, 5, 0], 10, { islandIndex: 1, module: 0.8 }),
    ]);
    expect(meshes).toHaveLength(0);
    expect(warnings[0]).toMatch(/different modules/);
  });

  it('skips gears rigidly joined in the same body island', () => {
    const { meshes } = detectGearMeshes([
      g('g0', [0, 5, 0], 16, { islandIndex: 7 }),
      g('g1', [8, 5, 0], 16, { islandIndex: 7 }),
    ]);
    expect(meshes).toHaveLength(0);
  });

  it('handles flipped gears (anti-parallel axes) as parallel', () => {
    const { meshes } = detectGearMeshes([
      g('g0', [0, 5, 0], 16, { islandIndex: 0 }),
      g('g1', [8, 5, 0], 16, {
        islandIndex: 1,
        rotation: qFromAxisAngle([1, 0, 0], Math.PI),
      }),
    ]);
    expect(meshes).toHaveLength(1);
    // Axes are sign-normalized so the solver sees a consistent frame.
    const dot =
      meshes[0].worldAxisA[0] * meshes[0].worldAxisB[0] +
      meshes[0].worldAxisA[1] * meshes[0].worldAxisB[1] +
      meshes[0].worldAxisA[2] * meshes[0].worldAxisB[2];
    expect(dot).toBeGreaterThan(0.99);
  });
});
