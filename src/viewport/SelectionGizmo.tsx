import { useEffect, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import type * as THREE from 'three';
import { useDocumentStore } from '@/store/documentStore';
import { useEditorStore } from '@/store/editorStore';
import { useSimStore } from '@/store/simStore';
import { movePart } from '@/editor/commands';
import { findSnap } from '@/editor/snapping';
import type { Transform } from '@/model/types';
import { getMesh } from './meshRegistry';

/** Translate/rotate gizmo on the selected part (edit mode only). Drag end
 * commits the transform; if the part landed near a compatible anchor it
 * snaps on and connections are reconciled. */
export function SelectionGizmo() {
  const selectedPartId = useEditorStore((s) => s.selectedPartId);
  const gizmoMode = useEditorStore((s) => s.gizmoMode);
  const mode = useSimStore((s) => s.mode);
  const gridSize = useDocumentStore((s) => s.doc.settings.gridSize);
  // Re-render when parts change so the gizmo finds freshly mounted objects.
  const partCount = useDocumentStore((s) => s.doc.parts.length);
  const [object, setObject] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    setObject(selectedPartId ? (getMesh(selectedPartId) ?? null) : null);
  }, [selectedPartId, partCount]);

  if (!object || mode !== 'edit' || !selectedPartId) return null;

  const commit = () => {
    useEditorStore.getState().setGizmoDragging(false);
    const doc = useDocumentStore.getState().doc;
    const part = doc.parts.find((p) => p.id === selectedPartId);
    if (!part) return;
    let transform: Transform = {
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [
        object.quaternion.x,
        object.quaternion.y,
        object.quaternion.z,
        object.quaternion.w,
      ],
    };
    const snap = findSnap(doc, part.type, part.props, transform, part.id);
    if (snap) transform = snap.transform;
    movePart(selectedPartId, transform);
  };

  return (
    <TransformControls
      object={object}
      mode={gizmoMode}
      translationSnap={gridSize}
      rotationSnap={Math.PI / 12}
      onMouseDown={() => useEditorStore.getState().setGizmoDragging(true)}
      onMouseUp={commit}
    />
  );
}
