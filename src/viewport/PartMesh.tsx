import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { PartInstance } from '@/model/types';
import { getGeometry } from '@/geometry/geometryCache';
import { getPartDef } from '@/parts/registry';
import { useEditorStore } from '@/store/editorStore';
import { useSimStore } from '@/store/simStore';
import { updateGhostFromPoint } from '@/editor/placement';
import { registerMesh, unregisterMesh } from './meshRegistry';

export function PartMesh({ part }: { part: PartInstance }) {
  const groupRef = useRef<THREE.Group>(null);
  const def = getPartDef(part.type);
  const geometry = getGeometry(part.type, part.props);
  const visual = def.visual(part.props);
  const selected = useEditorStore((s) => s.selectedPartId === part.id);
  const placing = useEditorStore((s) => s.placing !== null);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: visual.color,
        metalness: visual.metalness,
        roughness: visual.roughness,
      }),
    [visual.color, visual.metalness, visual.roughness],
  );
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    material.emissive.set(selected ? '#2a6fc9' : '#000000');
    material.emissiveIntensity = selected ? 0.35 : 0;
  }, [selected, material]);

  useEffect(() => {
    const obj = groupRef.current;
    if (!obj) return;
    registerMesh(part.id, obj);
    return () => unregisterMesh(part.id);
  }, [part.id]);

  // Edit-mode pose comes from the document; in run mode SceneParts overwrites
  // it every frame from the physics sync map.
  useEffect(() => {
    const obj = groupRef.current;
    if (!obj) return;
    obj.position.set(...part.transform.position);
    obj.quaternion.set(...part.transform.rotation);
  }, [part.transform]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (placing) return; // placement plane (or this part's hover) owns the click
    e.stopPropagation();
    if (useSimStore.getState().mode === 'edit') {
      useEditorStore.getState().select(part.id);
    }
  };

  // While placing, hovering an existing part aims the ghost at its surface so
  // elevated anchors (axles in bearings, motor couplings…) are snappable.
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!placing) return;
    e.stopPropagation();
    updateGhostFromPoint([e.point.x, e.point.y, e.point.z]);
  };

  return (
    <group ref={groupRef}>
      <mesh
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerMove={onPointerMove}
      />
    </group>
  );
}
