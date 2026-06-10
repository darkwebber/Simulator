/** Geometric gear-mesh inference. Gears mesh because they are *positioned* to
 * mesh — exactly like real hardware. Pure functions over edit-pose data. */

import {
  transformDirection,
  vCross,
  vDot,
  vLength,
  vScale,
  vSub,
} from '@/model/math';
import type { Transform, Vec3 } from '@/model/types';

export interface GearInfo {
  partId: string;
  /** Index of the rigid-body island the gear belongs to. */
  islandIndex: number;
  transform: Transform;
  teeth: number;
  module: number;
  faceWidth: number;
  pitchRadius: number;
}

export interface DetectedMesh {
  aPartId: string;
  bPartId: string;
  islandA: number;
  islandB: number;
  /** World axes at build time, sign-normalized so dot(axisA, axisB) > 0. */
  worldAxisA: Vec3;
  worldAxisB: Vec3;
  teethA: number;
  teethB: number;
}

export interface MeshDetectResult {
  meshes: DetectedMesh[];
  warnings: string[];
}

const AXIS_PARALLEL_TOL = 0.02; // |sin| of angle between axes
const CENTER_DISTANCE_TOL = 0.03; // fraction of r1+r2
const NEAR_MISS_TOL = 0.18;

const LOCAL_GEAR_AXIS: Vec3 = [0, 1, 0];

export function detectGearMeshes(gears: GearInfo[]): MeshDetectResult {
  const meshes: DetectedMesh[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < gears.length; i++) {
    for (let j = i + 1; j < gears.length; j++) {
      const A = gears[i];
      const B = gears[j];
      const axisA = transformDirection(A.transform, LOCAL_GEAR_AXIS);
      let axisB = transformDirection(B.transform, LOCAL_GEAR_AXIS);
      if (vLength(vCross(axisA, axisB)) > AXIS_PARALLEL_TOL) continue;
      if (vDot(axisA, axisB) < 0) axisB = vScale(axisB, -1);

      const d = vSub(B.transform.position, A.transform.position);
      const axial = vDot(d, axisA);
      const radialVec = vSub(d, vScale(axisA, axial));
      const radial = vLength(radialVec);
      const sum = A.pitchRadius + B.pitchRadius;
      if (radial < 1e-6) continue; // concentric, not a mesh

      const overlap = Math.abs(axial) < (A.faceWidth + B.faceWidth) / 2;
      const atMeshDistance = Math.abs(radial - sum) <= CENTER_DISTANCE_TOL * sum;
      const nearMeshDistance = Math.abs(radial - sum) <= NEAR_MISS_TOL * sum;

      if (!overlap || !nearMeshDistance) continue;
      if (Math.abs(A.module - B.module) > 1e-6) {
        warnings.push(
          `Gears ${A.partId} and ${B.partId} are positioned to mesh but have ` +
            `different modules (${A.module} vs ${B.module}) — they will not couple.`,
        );
        continue;
      }
      if (!atMeshDistance) {
        warnings.push(
          `Gears ${A.partId} and ${B.partId} almost mesh (center distance ` +
            `${radial.toFixed(2)}, ideal ${sum.toFixed(2)}) — nudge them together.`,
        );
        continue;
      }
      if (A.islandIndex === B.islandIndex) continue; // rigidly joined already

      meshes.push({
        aPartId: A.partId,
        bPartId: B.partId,
        islandA: A.islandIndex,
        islandB: B.islandIndex,
        worldAxisA: axisA,
        worldAxisB: axisB,
        teethA: A.teeth,
        teethB: B.teeth,
      });
    }
  }
  return { meshes, warnings };
}
