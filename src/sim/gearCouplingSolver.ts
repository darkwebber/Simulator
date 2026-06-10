/** Sequential-impulse solver for gear couplings and torque-limited motors.
 *
 * Runs after each `world.step()`, adjusting angular velocities directly.
 * Pure math over the BodyView interface — unit tests drive it with fake
 * bodies, and Rapier's API surface stays isolated in the engine's adapter.
 *
 * Gear constraint between bodies i, j (tooth counts nᵢ, nⱼ, world axes aᵢ, aⱼ):
 *   Ċ = nᵢ·(ωᵢ·aᵢ) + nⱼ·(ωⱼ·aⱼ) = 0
 * with Baumgarte feedback on the accumulated phase error
 *   C = ∫Ċ dt   (steered back to 0 so tooth phase cannot drift over time).
 *
 * Motor constraint (housing a, shaft b, target velocity v, torque limit τ):
 *   Ċ = (ω_b·a_b) − (ω_a·a_a) − v = 0,  accumulated impulse clamped to ±τ·h —
 * which is exactly how a stalling motor behaves.
 */

import type { Vec3 } from '@/model/types';
import { vAdd, vDot, vScale } from '@/model/math';

export interface BodyView {
  getAngvel(): Vec3;
  setAngvel(v: Vec3): void;
  /** World-space inverse-inertia times vector: I⁻¹·v. Zero for static bodies. */
  invInertiaMul(v: Vec3): Vec3;
  /** Rotate a body-local direction into world space (current orientation). */
  rotateLocal(v: Vec3): Vec3;
}

export interface GearConstraint {
  a: BodyView;
  b: BodyView;
  localAxisA: Vec3;
  localAxisB: Vec3;
  teethA: number;
  teethB: number;
  /** Accumulated phase error C (mutated by the solver). */
  C: number;
}

export interface MotorConstraint {
  a: BodyView;
  b: BodyView;
  localAxisA: Vec3;
  localAxisB: Vec3;
  targetVel: number;
  maxTorque: number;
}

const DEFAULT_ITERATIONS = 8;
const BAUMGARTE = 0.2;

interface GearRow {
  c: GearConstraint;
  axisA: Vec3;
  axisB: Vec3;
  jA: Vec3; // nA · I_A⁻¹ aA
  jB: Vec3;
  mEff: number;
  bias: number;
}

interface MotorRow {
  c: MotorConstraint;
  axisA: Vec3;
  axisB: Vec3;
  jA: Vec3; // I_A⁻¹ aA
  jB: Vec3;
  mEff: number;
  accumulated: number;
  limit: number;
}

export function solveCouplings(
  gears: GearConstraint[],
  motors: MotorConstraint[],
  h: number,
  iterations = DEFAULT_ITERATIONS,
  beta = BAUMGARTE,
): void {
  const gearRows: GearRow[] = [];
  for (const c of gears) {
    const axisA = c.a.rotateLocal(c.localAxisA);
    const axisB = c.b.rotateLocal(c.localAxisB);
    const invA = c.a.invInertiaMul(axisA);
    const invB = c.b.invInertiaMul(axisB);
    const w = c.teethA ** 2 * vDot(axisA, invA) + c.teethB ** 2 * vDot(axisB, invB);
    if (w < 1e-12) continue; // both bodies effectively immovable about the axis
    gearRows.push({
      c,
      axisA,
      axisB,
      jA: vScale(invA, c.teethA),
      jB: vScale(invB, c.teethB),
      mEff: 1 / w,
      bias: (beta / h) * c.C,
    });
  }

  const motorRows: MotorRow[] = [];
  for (const c of motors) {
    const axisA = c.a.rotateLocal(c.localAxisA);
    const axisB = c.b.rotateLocal(c.localAxisB);
    const invA = c.a.invInertiaMul(axisA);
    const invB = c.b.invInertiaMul(axisB);
    const w = vDot(axisA, invA) + vDot(axisB, invB);
    if (w < 1e-12) continue;
    motorRows.push({
      c,
      axisA,
      axisB,
      jA: invA,
      jB: invB,
      mEff: 1 / w,
      accumulated: 0,
      limit: c.maxTorque * h,
    });
  }

  for (let it = 0; it < iterations; it++) {
    for (const r of motorRows) {
      const wA = r.c.a.getAngvel();
      const wB = r.c.b.getAngvel();
      const cdot = vDot(wB, r.axisB) - vDot(wA, r.axisA) - r.c.targetVel;
      let lambda = -r.mEff * cdot;
      const next = Math.max(-r.limit, Math.min(r.limit, r.accumulated + lambda));
      lambda = next - r.accumulated;
      r.accumulated = next;
      if (lambda === 0) continue;
      r.c.a.setAngvel(vAdd(wA, vScale(r.jA, -lambda)));
      r.c.b.setAngvel(vAdd(wB, vScale(r.jB, lambda)));
    }

    for (const r of gearRows) {
      const wA = r.c.a.getAngvel();
      const wB = r.c.b.getAngvel();
      const cdot =
        r.c.teethA * vDot(wA, r.axisA) + r.c.teethB * vDot(wB, r.axisB);
      const lambda = -r.mEff * (cdot + r.bias);
      if (lambda === 0) continue;
      r.c.a.setAngvel(vAdd(wA, vScale(r.jA, lambda)));
      r.c.b.setAngvel(vAdd(wB, vScale(r.jB, lambda)));
    }
  }

  // Integrate the residual phase error for the next step's Baumgarte bias.
  for (const r of gearRows) {
    const cdot =
      r.c.teethA * vDot(r.c.a.getAngvel(), r.axisA) +
      r.c.teethB * vDot(r.c.b.getAngvel(), r.axisB);
    r.c.C += cdot * h;
  }
}

export function maxGearDrift(gears: GearConstraint[]): number {
  return gears.reduce((m, g) => Math.max(m, Math.abs(g.C)), 0);
}
