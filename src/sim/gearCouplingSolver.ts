/** Sequential-impulse solver for the mechanical couplings that Rapier has no
 * native constraint for: gear meshes, torque-limited motors, summing
 * differentials and position servos.
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
 *
 * Differential (summing gearbox; housing H, inputs A, B, output O):
 *   (ω_O−ω_H)·a_O − (ω_A−ω_H)·a_A − (ω_B−ω_H)·a_B = 0   ⇒  θ_O = θ_A + θ_B
 * with the same integrated-drift correction as gears.
 *
 * Servo (the "operator's hand" on input dials): a velocity constraint whose
 * target tracks a position setpoint, impulse clamped to ±τ·h:
 *   Ċ = ω·a − clamp(k_p(θ* − θ), ±v_max) = 0.
 *
 * IMPORTANT: the caller owns the position-level state (gear/differential `C`,
 * servo `theta`) and must update it from the bodies' *actual* pose deltas
 * after integration. The solver must not integrate its own velocities:
 * Rapier integrates poses with pre-solve velocities, so velocity-integrated
 * estimates drift from the true poses and the Baumgarte bias would chase a
 * phantom error, ringing for seconds. The engine measures true per-step
 * rotation deltas from body quaternions instead.
 */

import type { Vec3 } from '@/model/types';
import { vDot, vScale } from '@/model/math';

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

export interface DifferentialConstraint {
  housing: BodyView;
  inA: BodyView;
  inB: BodyView;
  out: BodyView;
  /** Coupling axes in each body's local frame (parallel at build time). */
  localAxisH: Vec3;
  localAxisA: Vec3;
  localAxisB: Vec3;
  localAxisO: Vec3;
  /** Accumulated constraint drift (mutated by the solver). */
  C: number;
}

export interface ServoConstraint {
  body: BodyView;
  localAxis: Vec3;
  targetAngle: number;
  /** Proportional gain (1/s) of the position loop. */
  kp: number;
  maxVel: number;
  maxTorque: number;
  /** Integrated rotation angle about the axis (mutated by the solver). */
  theta: number;
}

export interface CouplingSet {
  gears: GearConstraint[];
  motors: MotorConstraint[];
  differentials?: DifferentialConstraint[];
  servos?: ServoConstraint[];
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

interface DiffRow {
  c: DifferentialConstraint;
  axisH: Vec3;
  axisA: Vec3;
  axisB: Vec3;
  axisO: Vec3;
  /** Housing jacobian a_A + a_B − a_O (general form). */
  jacH: Vec3;
  jH: Vec3; // I_H⁻¹ jacH
  jA: Vec3; // I_A⁻¹ aA
  jB: Vec3;
  jO: Vec3;
  mEff: number;
  bias: number;
}

interface ServoRow {
  c: ServoConstraint;
  axis: Vec3;
  j: Vec3; // I⁻¹ a
  mEff: number;
  targetVel: number;
  accumulated: number;
  limit: number;
}

export function solveCouplings(
  set: CouplingSet,
  h: number,
  iterations = DEFAULT_ITERATIONS,
  beta = BAUMGARTE,
): void {
  const { gears, motors, differentials = [], servos = [] } = set;

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

  const diffRows: DiffRow[] = [];
  for (const c of differentials) {
    const axisH = c.housing.rotateLocal(c.localAxisH);
    const axisA = c.inA.rotateLocal(c.localAxisA);
    const axisB = c.inB.rotateLocal(c.localAxisB);
    const axisO = c.out.rotateLocal(c.localAxisO);
    // Ċ = ω_O·a_O − ω_A·a_A − ω_B·a_B + ω_H·(a_A + a_B − a_O)
    const jacH: Vec3 = [
      axisA[0] + axisB[0] - axisO[0],
      axisA[1] + axisB[1] - axisO[1],
      axisA[2] + axisB[2] - axisO[2],
    ];
    const jH = c.housing.invInertiaMul(jacH);
    const jA = c.inA.invInertiaMul(axisA);
    const jB = c.inB.invInertiaMul(axisB);
    const jO = c.out.invInertiaMul(axisO);
    const w =
      vDot(jacH, jH) + vDot(axisA, jA) + vDot(axisB, jB) + vDot(axisO, jO);
    if (w < 1e-12) continue;
    diffRows.push({
      c,
      axisH,
      axisA,
      axisB,
      axisO,
      jacH,
      jH,
      jA,
      jB,
      jO,
      mEff: 1 / w,
      bias: (beta / h) * c.C,
    });
  }

  const servoRows: ServoRow[] = [];
  for (const c of servos) {
    const axis = c.body.rotateLocal(c.localAxis);
    const j = c.body.invInertiaMul(axis);
    const w = vDot(axis, j);
    if (w < 1e-12) continue;
    const err = c.targetAngle - c.theta;
    servoRows.push({
      c,
      axis,
      j,
      mEff: 1 / w,
      targetVel: Math.max(-c.maxVel, Math.min(c.maxVel, c.kp * err)),
      accumulated: 0,
      limit: c.maxTorque * h,
    });
  }

  // Velocity cache: bodies cross the BodyView boundary (a WASM call for
  // Rapier bodies) once before and once after the iterations, not per
  // impulse — hundreds of iterations stay cheap.
  const cache = new Map<BodyView, Vec3>();
  const vel = (b: BodyView): Vec3 => {
    let w = cache.get(b);
    if (!w) {
      w = b.getAngvel();
      cache.set(b, w);
    }
    return w;
  };
  const addScaled = (b: BodyView, j: Vec3, s: number) => {
    const w = vel(b);
    w[0] += j[0] * s;
    w[1] += j[1] * s;
    w[2] += j[2] * s;
  };

  const diffCdot = (r: DiffRow): number =>
    vDot(vel(r.c.out), r.axisO) -
    vDot(vel(r.c.inA), r.axisA) -
    vDot(vel(r.c.inB), r.axisB) +
    vDot(vel(r.c.housing), r.jacH);

  for (let it = 0; it < iterations; it++) {
    for (const r of servoRows) {
      const cdot = vDot(vel(r.c.body), r.axis) - r.targetVel;
      let lambda = -r.mEff * cdot;
      const next = Math.max(-r.limit, Math.min(r.limit, r.accumulated + lambda));
      lambda = next - r.accumulated;
      r.accumulated = next;
      if (lambda === 0) continue;
      addScaled(r.c.body, r.j, lambda);
    }

    for (const r of motorRows) {
      const cdot = vDot(vel(r.c.b), r.axisB) - vDot(vel(r.c.a), r.axisA) - r.c.targetVel;
      let lambda = -r.mEff * cdot;
      const next = Math.max(-r.limit, Math.min(r.limit, r.accumulated + lambda));
      lambda = next - r.accumulated;
      r.accumulated = next;
      if (lambda === 0) continue;
      addScaled(r.c.a, r.jA, -lambda);
      addScaled(r.c.b, r.jB, lambda);
    }

    for (const r of diffRows) {
      const lambda = -r.mEff * (diffCdot(r) + r.bias);
      if (lambda === 0) continue;
      addScaled(r.c.out, r.jO, lambda);
      addScaled(r.c.inA, r.jA, -lambda);
      addScaled(r.c.inB, r.jB, -lambda);
      addScaled(r.c.housing, r.jH, lambda);
    }

    for (const r of gearRows) {
      const cdot =
        r.c.teethA * vDot(vel(r.c.a), r.axisA) + r.c.teethB * vDot(vel(r.c.b), r.axisB);
      const lambda = -r.mEff * (cdot + r.bias);
      if (lambda === 0) continue;
      addScaled(r.c.a, r.jA, lambda);
      addScaled(r.c.b, r.jB, lambda);
    }
  }

  for (const [body, w] of cache) body.setAngvel(w);
}

export function maxGearDrift(gears: GearConstraint[]): number {
  return gears.reduce((m, g) => Math.max(m, Math.abs(g.C)), 0);
}
