/** Tuple-based vector/quaternion math shared by snapping, mesh detection and the
 * coupling solver. Kept free of three.js so it runs in node tests. */

import type { Quat, Transform, Vec3 } from './types';

export const EPS = 1e-9;

export function vAdd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vScale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function vDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vCross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vLength(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

export function vNormalize(a: Vec3): Vec3 {
  const l = vLength(a);
  return l < EPS ? [0, 0, 0] : vScale(a, 1 / l);
}

export function vDistance(a: Vec3, b: Vec3): number {
  return vLength(vSub(a, b));
}

export function qMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function qConjugate(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

export function qNormalize(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  if (l < EPS) return [0, 0, 0, 1];
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

export function qRotate(q: Quat, v: Vec3): Vec3 {
  // v' = q * v * q⁻¹, expanded.
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx,
  ];
}

export function qFromAxisAngle(axis: Vec3, angle: number): Quat {
  const half = angle / 2;
  const s = Math.sin(half);
  const u = vNormalize(axis);
  return [u[0] * s, u[1] * s, u[2] * s, Math.cos(half)];
}

/** Shortest-arc rotation taking unit vector `from` to unit vector `to`. */
export function qFromUnitVectors(from: Vec3, to: Vec3): Quat {
  const d = vDot(from, to);
  if (d > 1 - 1e-8) return [0, 0, 0, 1];
  if (d < -1 + 1e-8) {
    // 180°: rotate about any axis perpendicular to `from`.
    let perp = vCross([1, 0, 0], from);
    if (vLength(perp) < 1e-6) perp = vCross([0, 1, 0], from);
    return qFromAxisAngle(vNormalize(perp), Math.PI);
  }
  const axis = vCross(from, to);
  const q: Quat = [axis[0], axis[1], axis[2], 1 + d];
  return qNormalize(q);
}

/** Apply a transform to a local point, producing a world point. */
export function transformPoint(t: Transform, p: Vec3): Vec3 {
  return vAdd(t.position, qRotate(t.rotation, p));
}

/** Rotate a local direction into world space. */
export function transformDirection(t: Transform, d: Vec3): Vec3 {
  return qRotate(t.rotation, d);
}

export function snapToGrid(value: number, step: number): number {
  return Math.round(value / step) * step;
}
