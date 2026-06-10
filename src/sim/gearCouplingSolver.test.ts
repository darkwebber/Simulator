import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@/model/types';
import { vDot, vScale } from '@/model/math';
import {
  solveCouplings,
  type BodyView,
  type CouplingSet,
  type DifferentialConstraint,
  type GearConstraint,
  type MotorConstraint,
  type ServoConstraint,
} from './gearCouplingSolver';

/** Caller-side position bookkeeping (the engine does this from true poses;
 * for fake bodies the velocities ARE the truth, so integrate them). */
function integrate(set: CouplingSet, h: number): void {
  const about = (body: BodyView, axis: Vec3) => vDot(body.getAngvel(), axis);
  for (const g of set.gears) {
    g.C += (g.teethA * about(g.a, g.localAxisA) + g.teethB * about(g.b, g.localAxisB)) * h;
  }
  for (const d of set.differentials ?? []) {
    d.C +=
      (about(d.out, d.localAxisO) -
        about(d.inA, d.localAxisA) -
        about(d.inB, d.localAxisB)) *
      h;
  }
  for (const s of set.servos ?? []) {
    s.theta += about(s.body, s.localAxis) * h;
  }
}

function solveAndIntegrate(set: CouplingSet, h: number, iterations?: number): void {
  solveCouplings(set, h, iterations);
  integrate(set, h);
}

/** Isotropic-inertia fake body; static bodies have invInertia 0. */
class FakeBody implements BodyView {
  w: Vec3 = [0, 0, 0];
  constructor(private invInertia: number) {}
  getAngvel(): Vec3 {
    return this.w;
  }
  setAngvel(v: Vec3): void {
    this.w = v;
  }
  invInertiaMul(v: Vec3): Vec3 {
    return vScale(v, this.invInertia);
  }
  rotateLocal(v: Vec3): Vec3 {
    return v;
  }
}

const Y: Vec3 = [0, 1, 0];
const H = 1 / 120;

function gear(a: BodyView, b: BodyView, teethA: number, teethB: number): GearConstraint {
  return { a, b, localAxisA: Y, localAxisB: Y, teethA, teethB, C: 0 };
}

describe('gear coupling', () => {
  it('enforces the tooth-ratio velocity constraint with counter-rotation', () => {
    const a = new FakeBody(1);
    const b = new FakeBody(1);
    a.w = [0, 30, 0];
    const g = gear(a, b, 8, 24);
    solveCouplings({ gears: [g], motors: [] }, H);
    const cdot = 8 * vDot(a.w, Y) + 24 * vDot(b.w, Y);
    expect(Math.abs(cdot)).toBeLessThan(1e-9);
    // External mesh: opposite signs, 3:1 ratio.
    expect(vDot(a.w, Y) / vDot(b.w, Y)).toBeCloseTo(-3, 6);
    expect(vDot(b.w, Y)).toBeLessThan(0);
  });

  it('a driven gear against a static frame stops the driver', () => {
    const a = new FakeBody(1);
    const frame = new FakeBody(0); // jammed: meshed with an immovable gear
    a.w = [0, 10, 0];
    solveCouplings({ gears: [gear(a, frame, 8, 24)], motors: [] }, H);
    expect(Math.abs(vDot(a.w, Y))).toBeLessThan(1e-9);
  });

  it('propagates through a gear train', () => {
    const a = new FakeBody(1);
    const b = new FakeBody(1);
    const c = new FakeBody(1);
    a.w = [0, 24, 0];
    const g1 = gear(a, b, 8, 16);
    const g2 = gear(b, c, 16, 32);
    solveCouplings({ gears: [g1, g2], motors: [] }, H, 32);
    expect(8 * vDot(a.w, Y) + 16 * vDot(b.w, Y)).toBeCloseTo(0, 5);
    expect(16 * vDot(b.w, Y) + 32 * vDot(c.w, Y)).toBeCloseTo(0, 5);
    // a and c co-rotate (two external meshes), each slower by its ratio.
    expect(vDot(c.w, Y) * vDot(a.w, Y)).toBeGreaterThan(0);
  });

  it('Baumgarte feedback recovers an injected phase error', () => {
    const a = new FakeBody(1);
    const b = new FakeBody(1);
    const g = gear(a, b, 12, 12);
    g.C = 0.5;
    for (let i = 0; i < 400; i++) solveAndIntegrate({ gears: [g], motors: [] }, H);
    expect(Math.abs(g.C)).toBeLessThan(1e-3);
  });

  it('stays bounded over a long run with a driving motor', () => {
    const housing = new FakeBody(0);
    const a = new FakeBody(1);
    const b = new FakeBody(1);
    const g = gear(a, b, 8, 24);
    const m: MotorConstraint = {
      a: housing,
      b: a,
      localAxisA: Y,
      localAxisB: Y,
      targetVel: 5,
      maxTorque: 1000,
    };
    for (let i = 0; i < 5000; i++) solveAndIntegrate({ gears: [g], motors: [m] }, H);
    expect(vDot(a.w, Y)).toBeCloseTo(5, 3);
    expect(vDot(b.w, Y)).toBeCloseTo(-5 / 3, 3);
    expect(Math.abs(g.C)).toBeLessThan(1e-3);
  });
});

describe('motor constraint', () => {
  it('reaches target velocity when unloaded', () => {
    const housing = new FakeBody(0);
    const shaft = new FakeBody(1);
    const m: MotorConstraint = {
      a: housing,
      b: shaft,
      localAxisA: Y,
      localAxisB: Y,
      targetVel: 3,
      maxTorque: 10000,
    };
    for (let i = 0; i < 50; i++) solveCouplings({ gears: [], motors: [m] }, H);
    expect(vDot(shaft.w, Y)).toBeCloseTo(3, 6);
  });

  it('stalls under load: impulse is clamped at maxTorque·h', () => {
    const housing = new FakeBody(0);
    const heavy = new FakeBody(1e-6); // enormous load inertia
    const m: MotorConstraint = {
      a: housing,
      b: heavy,
      localAxisA: Y,
      localAxisB: Y,
      targetVel: 100,
      maxTorque: 50,
    };
    solveCouplings({ gears: [], motors: [m] }, H);
    // Δω = I⁻¹ · τ·h exactly at the torque limit — not the target velocity.
    expect(vDot(heavy.w, Y)).toBeCloseTo(1e-6 * 50 * H, 12);
  });

  it('reversing torque is also clamped symmetrically', () => {
    const housing = new FakeBody(0);
    const shaft = new FakeBody(1);
    shaft.w = [0, 500, 0]; // spinning way past target
    const m: MotorConstraint = {
      a: housing,
      b: shaft,
      localAxisA: Y,
      localAxisB: Y,
      targetVel: 0,
      maxTorque: 60,
    };
    solveCouplings({ gears: [], motors: [m] }, H);
    expect(vDot(shaft.w, Y)).toBeCloseTo(500 - 60 * H, 9);
  });
});

function diff(
  housing: BodyView,
  inA: BodyView,
  inB: BodyView,
  out: BodyView,
): DifferentialConstraint {
  return {
    housing,
    inA,
    inB,
    out,
    localAxisH: Y,
    localAxisA: Y,
    localAxisB: Y,
    localAxisO: Y,
    C: 0,
  };
}

function servo(body: BodyView, targetAngle: number, maxTorque = 1000): ServoConstraint {
  return { body, localAxis: Y, targetAngle, kp: 6, maxVel: 10, maxTorque, theta: 0 };
}

describe('differential constraint', () => {
  it('output velocity is the sum of the input velocities', () => {
    const housing = new FakeBody(0);
    const a = new FakeBody(1);
    const b = new FakeBody(1);
    const out = new FakeBody(1);
    a.w = [0, 3, 0];
    b.w = [0, 5, 0];
    const d = diff(housing, a, b, out);
    solveCouplings({ gears: [], motors: [], differentials: [d] }, H, 32);
    expect(vDot(out.w, Y)).toBeCloseTo(vDot(a.w, Y) + vDot(b.w, Y), 6);
  });

  it('back-drives: holding the output splits motion to the inputs', () => {
    const housing = new FakeBody(0);
    const a = new FakeBody(1);
    const b = new FakeBody(1);
    const locked = new FakeBody(0); // output bolted to the frame
    a.w = [0, 4, 0];
    const d = diff(housing, a, b, locked);
    solveCouplings({ gears: [], motors: [], differentials: [d] }, H, 32);
    // 0 = ωA + ωB  →  B counter-rotates A.
    expect(vDot(a.w, Y) + vDot(b.w, Y)).toBeCloseTo(0, 6);
    expect(vDot(b.w, Y)).toBeLessThan(0);
  });

  it('integrated position: θ_out converges to θ_A + θ_B under servos', () => {
    const housing = new FakeBody(0);
    const a = new FakeBody(1);
    const b = new FakeBody(1);
    const out = new FakeBody(1);
    const d = diff(housing, a, b, out);
    const sA = servo(a, Math.PI);
    const sB = servo(b, Math.PI / 2);
    let thetaOut = 0;
    for (let i = 0; i < 600; i++) {
      solveAndIntegrate(
        { gears: [], motors: [], differentials: [d], servos: [sA, sB] },
        H,
        16,
      );
      thetaOut += vDot(out.w, Y) * H;
    }
    expect(sA.theta).toBeCloseTo(Math.PI, 3);
    expect(sB.theta).toBeCloseTo(Math.PI / 2, 3);
    expect(thetaOut).toBeCloseTo(Math.PI * 1.5, 2);
    expect(Math.abs(d.C)).toBeLessThan(1e-3);
  });
});

describe('servo constraint', () => {
  it('drives to the target angle and holds', () => {
    const body = new FakeBody(1);
    const s = servo(body, Math.PI);
    for (let i = 0; i < 600; i++) {
      solveAndIntegrate({ gears: [], motors: [], servos: [s] }, H);
    }
    expect(s.theta).toBeCloseTo(Math.PI, 4);
    expect(Math.abs(vDot(body.w, Y))).toBeLessThan(1e-3);
  });

  it('respects the velocity limit while travelling', () => {
    const body = new FakeBody(1);
    const s = servo(body, 100, 1e6); // far target → saturated velocity
    solveCouplings({ gears: [], motors: [], servos: [s] }, H);
    expect(vDot(body.w, Y)).toBeCloseTo(10, 6); // maxVel
  });

  it('torque clamp limits acceleration against heavy loads', () => {
    const heavy = new FakeBody(1e-6);
    const s = servo(heavy, Math.PI, 50);
    solveCouplings({ gears: [], motors: [], servos: [s] }, H);
    expect(vDot(heavy.w, Y)).toBeCloseTo(1e-6 * 50 * H, 12);
  });
});
