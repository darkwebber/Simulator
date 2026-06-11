/** Tooth-phase assignment for meshed gears.
 *
 * Mesh detection couples gears by center distance alone; every gear's outline
 * is modeled with a tooth centered at profile angle 0, so two correctly
 * positioned gears render tooth-tip into tooth-tip. This module rotates each
 * meshed gear about its own axis so a tooth faces the neighbor's gap.
 *
 * The phase is cosmetic: colliders stop at the root circle and the coupling
 * solver constrains rotation *rates*, so any constant per-gear offset is a
 * valid pose for the same machine. It is applied as a render-time rotation
 * and never written back to the document.
 */

import {
  qConjugate,
  qRotate,
  transformDirection,
  vDot,
  vNormalize,
  vScale,
  vSub,
} from '@/model/math';
import type { Vec3 } from '@/model/types';
import type { DetectedMesh, GearInfo } from './gearMeshDetector';

const LOCAL_GEAR_AXIS: Vec3 = [0, 1, 0];

/** Polar angle of a world direction in a gear's tooth-profile plane.
 * `gearOutline` centers a tooth on profile angle 0, and rotating the part by
 * +ψ about its local +Y moves that tooth to profile angle +ψ. */
function profileAngle(gear: GearInfo, worldDir: Vec3): number {
  const local = qRotate(qConjugate(gear.transform.rotation), worldDir);
  return Math.atan2(-local[2], local[0]);
}

const frac = (x: number) => x - Math.floor(x);

/**
 * Phase (radians about the gear's local +Y) per meshed gear, keyed by partId.
 * Gears that mesh nothing are absent (phase 0).
 *
 * Each mesh imposes one congruence between the two gears' tooth grids at the
 * line of centers: with s = tooth-grid offset at the contact direction in
 * tooth pitches, proper interlock is s_A + σ·s_B ≡ ½ (mod 1), where σ is the
 * sign of the axes' alignment (a flipped gear meshes mirror-handed). Phases
 * propagate breadth-first from the lowest partId of each mesh cluster, so a
 * tree of meshes is always exact; on graph cycles the first assignment wins.
 */
export function computeGearPhases(
  gears: GearInfo[],
  meshes: DetectedMesh[],
): Map<string, number> {
  const byId = new Map(gears.map((g) => [g.partId, g]));
  const neighbors = new Map<string, string[]>();
  for (const m of meshes) {
    if (!byId.has(m.aPartId) || !byId.has(m.bPartId)) continue;
    (neighbors.get(m.aPartId) ?? neighbors.set(m.aPartId, []).get(m.aPartId)!).push(m.bPartId);
    (neighbors.get(m.bPartId) ?? neighbors.set(m.bPartId, []).get(m.bPartId)!).push(m.aPartId);
  }

  const phases = new Map<string, number>();
  for (const root of [...neighbors.keys()].sort()) {
    if (phases.has(root)) continue;
    phases.set(root, 0);
    const queue = [root];
    while (queue.length > 0) {
      const A = byId.get(queue.shift()!)!;
      const phiA = phases.get(A.partId)!;
      for (const bId of neighbors.get(A.partId) ?? []) {
        if (phases.has(bId)) continue;
        const B = byId.get(bId)!;

        // Line of centers, projected perpendicular to the (parallel) axes.
        const axisA = transformDirection(A.transform, LOCAL_GEAR_AXIS);
        let d = vSub(B.transform.position, A.transform.position);
        d = vNormalize(vSub(d, vScale(axisA, vDot(d, axisA))));

        const pitchA = (2 * Math.PI) / A.teeth;
        const pitchB = (2 * Math.PI) / B.teeth;
        const sA = frac((profileAngle(A, d) - phiA) / pitchA);
        const sigma =
          vDot(axisA, transformDirection(B.transform, LOCAL_GEAR_AXIS)) >= 0 ? 1 : -1;
        const sB = frac(0.5 - sigma * sA);

        let phiB = profileAngle(B, vScale(d, -1)) - sB * pitchB;
        // Minimal equivalent rotation — phase is modulo one tooth pitch.
        phiB -= Math.round(phiB / pitchB) * pitchB;
        phases.set(bId, phiB);
        queue.push(bId);
      }
    }
  }
  return phases;
}
