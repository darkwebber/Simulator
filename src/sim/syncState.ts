/** Per-frame pose snapshot shared between the engine and the renderer.
 * A plain mutable map (not zustand) — it changes 120×/s and must never cause
 * React re-renders. The renderer polls it inside useFrame. */

import type { Quat, Vec3 } from '@/model/types';

export interface PartPose {
  position: Vec3;
  quaternion: Quat;
}

export const partPoses = new Map<string, PartPose>();

/** Live endpoints of springs that became joints (for stretch rendering). */
export const springEndpoints = new Map<string, { a: Vec3; b: Vec3 }>();

export const poseVersion = { n: 0 };

export function clearPoses(): void {
  partPoses.clear();
  springEndpoints.clear();
  poseVersion.n++;
}
