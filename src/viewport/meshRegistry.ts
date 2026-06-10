/** partId → live three.js object, used by the gizmo and the pose sync loop. */

import type * as THREE from 'three';

const registry = new Map<string, THREE.Object3D>();

export function registerMesh(partId: string, obj: THREE.Object3D): void {
  registry.set(partId, obj);
}

export function unregisterMesh(partId: string): void {
  registry.delete(partId);
}

export function getMesh(partId: string): THREE.Object3D | undefined {
  return registry.get(partId);
}

export function allMeshes(): ReadonlyMap<string, THREE.Object3D> {
  return registry;
}
