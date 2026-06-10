import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDocumentStore } from '@/store/documentStore';
import { useEditorStore } from '@/store/editorStore';
import { useSimStore } from '@/store/simStore';
import { partPoses, springEndpoints } from '@/sim/syncState';
import { num } from '@/parts/partDefinition';
import { PartMesh } from './PartMesh';
import { allMeshes } from './meshRegistry';

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();

export function SceneParts() {
  const parts = useDocumentStore((s) => s.doc.parts);

  // Every frame: edit mode poses come from the document, run/pause poses from
  // the physics snapshot. (A gizmo drag temporarily owns its object.)
  useFrame(() => {
    const doc = useDocumentStore.getState().doc;
    const editor = useEditorStore.getState();
    const editMode = useSimStore.getState().mode === 'edit';

    for (const part of doc.parts) {
      const obj = allMeshes().get(part.id);
      if (!obj) continue;

      if (editMode) {
        if (editor.gizmoDragging && editor.selectedPartId === part.id) continue;
        obj.position.set(...part.transform.position);
        obj.quaternion.set(...part.transform.rotation);
        obj.scale.set(1, 1, 1);
        continue;
      }

      const stretch = springEndpoints.get(part.id);
      if (stretch) {
        // Joint-spring: draw the helix stretched between the live endpoints.
        tmpA.set(...stretch.a);
        tmpB.set(...stretch.b);
        const rest = num(part.props, 'restLength', 6);
        tmpDir.subVectors(tmpB, tmpA);
        const len = Math.max(tmpDir.length(), 1e-4);
        obj.position.copy(tmpA).addScaledVector(tmpDir, 0.5);
        tmpQuat.setFromUnitVectors(UP, tmpDir.normalize());
        obj.quaternion.copy(tmpQuat);
        obj.scale.set(1, len / rest, 1);
        continue;
      }
      const pose = partPoses.get(part.id);
      if (pose) {
        obj.position.set(...pose.position);
        obj.quaternion.set(...pose.quaternion);
        obj.scale.set(1, 1, 1);
      }
    }
  });

  return (
    <>
      {parts.map((part) => (
        <PartMesh key={part.id} part={part} />
      ))}
    </>
  );
}
