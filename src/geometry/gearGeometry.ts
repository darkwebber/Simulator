import * as THREE from 'three';
import { gearOutline } from './gearProfile';

/**
 * Extruded involute spur gear. Rotation axis is local +Y (the simulator-wide
 * convention for rotational parts).
 */
export function buildGearGeometry(
  teeth: number,
  module: number,
  width: number,
  boreRadius: number,
): THREE.BufferGeometry {
  const outline = gearOutline(teeth, module);
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();

  if (boreRadius > 0) {
    const bore = new THREE.Path();
    bore.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
    shape.holes.push(bore);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: Math.min(0.06, width * 0.1),
    bevelSize: Math.min(0.04, module * 0.1),
    bevelSegments: 1,
    curveSegments: 8,
  });
  // Extrusion runs 0..width along +Z; center it and point the axis along +Y.
  geometry.translate(0, 0, -width / 2);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}
