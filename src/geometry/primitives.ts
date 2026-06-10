import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function boxGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

/** Cylinder along local +Y. */
export function cylinderGeometry(
  radius: number,
  height: number,
  segments = 32,
): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius, radius, height, segments);
}

export function merged(
  geos: Array<{ geometry: THREE.BufferGeometry; position?: [number, number, number] }>,
): THREE.BufferGeometry {
  const parts = geos.map(({ geometry, position }) => {
    if (position) geometry.translate(...position);
    return geometry;
  });
  const result = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return result ?? new THREE.BufferGeometry();
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private coilRadius: number,
    private length: number,
    private coils: number,
  ) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const angle = t * this.coils * Math.PI * 2;
    return target.set(
      this.coilRadius * Math.cos(angle),
      (t - 0.5) * this.length,
      this.coilRadius * Math.sin(angle),
    );
  }
}

/** Coil spring along local +Y, centered at the origin. */
export function springGeometry(
  coilRadius: number,
  wireRadius: number,
  length: number,
  coils = 8,
): THREE.BufferGeometry {
  const curve = new HelixCurve(coilRadius, length, coils);
  return new THREE.TubeGeometry(curve, coils * 16, wireRadius, 8, false);
}
