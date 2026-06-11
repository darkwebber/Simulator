import { describe, expect, it } from 'vitest';
import {
  qConjugate,
  qFromAxisAngle,
  qRotate,
  transformDirection,
  vDot,
  vNormalize,
  vScale,
  vSub,
} from '@/model/math';
import type { Quat, Vec3 } from '@/model/types';
import { detectGearMeshes, type GearInfo } from './gearMeshDetector';
import { computeGearPhases } from './gearPhase';

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

/** Tooth-grid offset (in pitches) of `gear` at world direction `d`, with the
 * assigned phase applied. 0 = tooth center at the contact, 0.5 = gap center. */
function gridOffset(gear: GearInfo, phase: number, d: Vec3): number {
  const local = qRotate(qConjugate(gear.transform.rotation), d);
  const gamma = Math.atan2(-local[2], local[0]);
  const s = ((gamma - phase) / ((2 * Math.PI) / gear.teeth)) % 1;
  return s < 0 ? s + 1 : s;
}

/** Assert every detected mesh interlocks: s_A + σ·s_B ≡ ½ (mod 1). */
function expectInterlocked(gears: GearInfo[]) {
  const { meshes } = detectGearMeshes(gears);
  expect(meshes.length).toBeGreaterThan(0);
  const phases = computeGearPhases(gears, meshes);
  const byId = new Map(gears.map((x) => [x.partId, x]));
  for (const m of meshes) {
    const A = byId.get(m.aPartId)!;
    const B = byId.get(m.bPartId)!;
    const axisA = transformDirection(A.transform, [0, 1, 0]);
    let d = vSub(B.transform.position, A.transform.position);
    d = vNormalize(vSub(d, vScale(axisA, vDot(d, axisA))));
    const sA = gridOffset(A, phases.get(A.partId) ?? 0, d);
    const sB = gridOffset(B, phases.get(B.partId) ?? 0, vScale(d, -1));
    const sigma =
      vDot(axisA, transformDirection(B.transform, [0, 1, 0])) >= 0 ? 1 : -1;
    const residual = (((sA + sigma * sB - 0.5) % 1) + 1) % 1;
    const error = Math.min(residual, 1 - residual);
    expect(error).toBeLessThan(1e-9);
  }
}

describe('computeGearPhases', () => {
  it('offsets one of two identical gears by half a tooth pitch', () => {
    const gears = [g('g0', [0, 5, 0], 16), g('g1', [8, 5, 0], 16)];
    const { meshes } = detectGearMeshes(gears);
    const phases = computeGearPhases(gears, meshes);
    // g0 is the BFS root and keeps its document pose.
    expect(phases.get('g0')).toBe(0);
    // g0 has a tooth centered on the line of centers, so g1 must rotate by
    // exactly half a tooth pitch (π/16 for 16 teeth) to present a gap.
    expect(Math.abs(phases.get('g1')!)).toBeCloseTo(Math.PI / 16, 9);
    expectInterlocked(gears);
  });

  it('leaves unmeshed gears without a phase', () => {
    const gears = [g('g0', [0, 5, 0], 16), g('g1', [30, 5, 0], 16)];
    const phases = computeGearPhases(gears, detectGearMeshes(gears).meshes);
    expect(phases.size).toBe(0);
  });

  it('interlocks unequal tooth counts (16T–24T)', () => {
    // r = 4 and 6 → centers 10 apart.
    expectInterlocked([g('g0', [0, 5, 0], 16), g('g1', [10, 5, 0], 24)]);
  });

  it('interlocks gears whose document poses are already rotated', () => {
    expectInterlocked([
      g('g0', [0, 5, 0], 16, { rotation: qFromAxisAngle([0, 1, 0], 0.7) }),
      g('g1', [8, 5, 0], 16, { rotation: qFromAxisAngle([0, 1, 0], -1.3) }),
    ]);
  });

  it('interlocks a flipped gear (anti-parallel axes)', () => {
    expectInterlocked([
      g('g0', [0, 5, 0], 16),
      g('g1', [8, 5, 0], 16, { rotation: qFromAxisAngle([1, 0, 0], Math.PI) }),
    ]);
  });

  it('interlocks gears on horizontal axles', () => {
    const lieDown = qFromAxisAngle([0, 0, 1], Math.PI / 2); // gear axis → −X
    expectInterlocked([
      g('g0', [0, 5, 0], 16, { rotation: lieDown }),
      g('g1', [0, 5, 8], 16, { rotation: lieDown }),
    ]);
  });

  it('propagates phases exactly through a gear train (tree)', () => {
    // 16T–16T–24T chain along x, plus a branch off the middle gear along z.
    expectInterlocked([
      g('g0', [0, 5, 0], 16),
      g('g1', [8, 5, 0], 16, { rotation: qFromAxisAngle([0, 1, 0], 0.4) }),
      g('g2', [18, 5, 0], 24),
      g('g3', [8, 5, 8], 16),
    ]);
  });

  it('is deterministic regardless of input order', () => {
    const gears = [
      g('g0', [0, 5, 0], 16),
      g('g1', [8, 5, 0], 16),
      g('g2', [18, 5, 0], 24),
    ];
    const a = computeGearPhases(gears, detectGearMeshes(gears).meshes);
    const reversed = [...gears].reverse();
    const b = computeGearPhases(reversed, detectGearMeshes(reversed).meshes);
    for (const [id, phase] of a) expect(b.get(id)).toBeCloseTo(phase, 12);
  });
});
